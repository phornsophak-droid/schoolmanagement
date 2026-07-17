/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// AI Worksheet Generator — data model, AI generation (Gemini, structured JSON),
// a free offline math generator, and Supabase persistence. Pure logic only; the
// UI lives in components/WorksheetGenerator.tsx.

import { getClient, hasGemini, getGeminiModel } from './gemini';
import { ollamaReachable, ollamaGenerateJSON } from './ollama';
import { getSupabaseClient } from './supabase';
import { pickApproved, bulkAddQuestions, toWSQuestion, hydrateQuestions } from './questionBank';

export type WorksheetType =
  | 'multiple_choice' | 'fill_blank' | 'matching' | 'true_false'
  | 'short_answer' | 'essay' | 'word_problems' | 'reading' | 'writing' | 'mixed';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type WSLanguage = 'km' | 'en' | 'bilingual';

export interface WorksheetParams {
  grade: string;
  subject: string;
  lesson: string;
  topic: string;
  language: WSLanguage;
  difficulty: Difficulty;
  count: number;
  type: WorksheetType;
  types?: WorksheetType[];
  // Optional source material (lesson/workbook text pasted by the teacher, e.g.
  // copied from a doc in the Document Bank). When present the AI grounds the
  // questions ON this text instead of inventing generic content.
  source?: string;
}

// One question. Fields used depend on the worksheet type:
//  - multiple_choice: prompt + options[] + answer (the correct option text)
//  - matching: pairs[] (answer is implicit in the pairs)
//  - everything else: prompt + answer
export interface WSQuestion {
  prompt: string;
  options?: string[];
  pairs?: { left: string; right: string }[];
  answer: string;
  // A reading passage (អត្ថបទ) that precedes and belongs to this question —
  // rendered full-width ABOVE it, never folded into the answer options.
  context?: string;
}

export interface Worksheet {
  id: string;
  title: string;
  instructions: string;
  params: WorksheetParams;
  questions: WSQuestion[];
  createdBy: string;     // teacher name (the app has no per-user auth)
  createdAt: string;
}

// Human labels (km) for the dropdowns / rendering.
export const TYPE_LABELS: Record<WorksheetType, string> = {
  multiple_choice: 'ពហុជ្រើសរើស (Multiple Choice)',
  fill_blank: 'បំពេញចន្លោះ (Fill in the Blank)',
  matching: 'ផ្គូផ្គង (Matching)',
  true_false: 'ត្រូវ/ខុស (True or False)',
  short_answer: 'ឆ្លើយខ្លី (Short Answer)',
  essay: 'អត្ថបទ (Essay)',
  word_problems: 'លំហាត់មានន័យ (Word Problems)',
  reading: 'អំណាន (Reading)',
  writing: 'សរសេរ (Writing Practice)',
  mixed: 'លំហាត់ចម្រុះ (Mixed Exercises)',
};
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'ងាយ (Easy)', medium: 'មធ្យម (Medium)', hard: 'ពិបាក (Hard)', mixed: 'ចម្រុះ (30/50/20)',
};
export const LANGUAGE_LABELS: Record<WSLanguage, string> = { km: 'ខ្មែរ', en: 'English', bilingual: 'ខ្មែរ + English' };

export const SUBJECTS = ['គណិតវិទ្យា', 'ភាសាខ្មែរ', 'ភាសាអង់គ្លេស', 'វិទ្យាសាស្ត្រ', 'សិក្សាសង្គម', 'កុំព្យូទ័រ', 'សិល្បៈ'];

// ---------------------------------------------------------------------------
// Parse a teacher's OWN pasted question list into WSQuestion[] — VERBATIM, with
// NO AI. The teacher who already has questions just pastes them and gets a clean
// laid-out worksheet ("រក្សាសំណួរដើម" — keep the original questions).
//
// Recognised shape (very forgiving):
//   <optional header line, e.g. "កិច្ចការ៖ …">
//   ១. <prompt> [answer] A. opt | B. opt | C. opt | D. opt
//   ២. <prompt>
//      ក. opt
//      ខ. opt
//      ចម្លើយ៖ ខ
// Numbers may be Khmer (១២៣) or Latin (123); option labels A–H, a–h, or Khmer
// consonants (ក ខ គ …); options separated by "|" or line breaks. A bracketed
// [X] or a "ចម្លើយ៖ X" tail is taken as the answer key and stripped from the
// printed prompt. Questions with fewer than 2 detected options stay as plain
// (fill-in / short-answer) prompts, so nothing is ever lost.
// ---------------------------------------------------------------------------
export interface ParsedPaste { instructions: string; questions: WSQuestion[]; multipleChoice: boolean; }

const Q_NUM_RE = /^\s*(?:[0-9]{1,3}|[០-៩]{1,3})\s*[.)．៖:]\s*/;

// Khmer option labels (ក ខ គ …), matching how options render on the sheet.
const KH_OPT = ['ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច', 'ឆ', 'ជ'];
// Map an answer TOKEN to a 0-based option index — but ONLY letters count as option
// labels (Khmer consonant ក/ខ/គ… or Latin A/B/C…). A digit is deliberately NOT a
// label: brackets like [២] in real papers are lesson/points markers, not answers.
function labelToIndex(tok: string): number {
  const t = (tok || '').trim();
  const ki = KH_OPT.indexOf(t);
  if (ki >= 0) return ki;
  if (/^[A-Ha-h]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
  return -1;
}

// Strip every [..] from the text; return it plus the LAST bracket's raw content
// (the caller decides whether that content is actually an answer label).
function stripBrackets(s: string): { text: string; bracket: string } {
  const brs = [...s.matchAll(/\[([^\]]{1,24})\]/g)];
  const bracket = brs.length ? brs[brs.length - 1][1].trim() : '';
  const text = s.replace(/\s*\[[^\]]{1,24}\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return { text, bracket };
}

// Turn a raw answer token into a clean answer for the key.
//  - Multiple-choice (>=2 options): the token must be an option LABEL (ក/A) or the
//    exact text of an option → returns "ក. <option>". Anything else (e.g. a stray
//    lesson number) yields "" so no WRONG answer is shown.
//  - No options (short answer): the token itself is the answer value.
function resolveAnswer(token: string, options: string[]): string {
  const t = (token || '').trim();
  if (!t) return '';
  if (options.length >= 2) {
    const idx = labelToIndex(t);
    if (idx >= 0 && idx < options.length) return `${KH_OPT[idx] || t}. ${options[idx]}`;
    const oi = options.findIndex(o => o.trim() === t);
    if (oi >= 0) return `${KH_OPT[oi] || t}. ${options[oi]}`;
    return '';
  }
  return t;
}

// Punctuated option labels: "A." "ក)" "(A)" "(ក)" — a label + trailing punct + space.
function strictLabelMarks(norm: string): { idx: number; end: number }[] {
  const re = /(^|[\s\]])[(（]?((?:[A-Ha-h])|[ក-អ])[.)）．៖:]\s+/g;
  const marks: { idx: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) marks.push({ idx: m.index + m[1].length, end: re.lastIndex });
  return marks;
}

// GLUED labels: "…ស្មើនឹង៖A. 0.9 kgB. 0.9 gC. 9.0 g" — Word/PDF extraction often
// loses the space BEFORE an option label, so strictLabelMarks (which requires
// whitespace there) misses some or all options and they stay glued inside the
// prompt. Here a label may be preceded by ANYTHING — a Khmer letter, ។, ៖, or a
// latin unit like "kg" — because real papers glue after both scripts.
//
// The safety net is the SEQUENCE requirement below: candidates only become
// options when their letters run ក,ខ,គ… / A,B,C… starting at the first, so a
// stray letter+punctuation inside the prompt (e.g. "…នឹង៖" → ង) is dropped.
function gluedLabelMarks(norm: string): { idx: number; end: number }[] {
  const re = /[(（]?((?:[A-Ha-h])|[ក-អ])[.)）．៖:]\s*/g;
  const cands: { start: number; end: number; seq: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const letter = m[1];
    let seq = KH_OPT.indexOf(letter);
    if (seq < 0 && /^[A-Ha-h]$/.test(letter)) seq = letter.toUpperCase().charCodeAt(0) - 65;
    cands.push({ start: m.index, end: re.lastIndex, seq });
  }
  const marks: { idx: number; end: number }[] = [];
  let expect = 0;
  for (const c of cands) {
    if (c.seq === expect) { marks.push({ idx: c.start, end: c.end }); expect++; }
  }
  return marks.length >= 2 ? marks : [];
}

// Bare labels: "ក … ខ … គ …" — single option letters with NO punctuation. Only
// accepted when they appear IN SEQUENCE (ក,ខ,គ… or A,B,C… starting at the first),
// so ordinary single-letter words aren't mistaken for options.
function bareLabelMarks(norm: string): { idx: number; end: number }[] {
  const re = /(^|[\s\n])((?:[A-Ha-h])|[ក-អ])(?=[\s\n])/g;
  const cands: { start: number; len: number; seq: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const letter = m[2];
    let seq = KH_OPT.indexOf(letter);
    if (seq < 0 && /^[A-Ha-h]$/.test(letter)) seq = letter.toUpperCase().charCodeAt(0) - 65;
    cands.push({ start: m.index + m[1].length, len: letter.length, seq });
  }
  const marks: { idx: number; end: number }[] = [];
  let expect = 0;
  for (const c of cands) {
    if (c.seq === expect) { marks.push({ idx: c.start, end: c.start + c.len + 1 }); expect++; }
  }
  return marks.length >= 2 ? marks : [];
}

// Split one question block into prompt + options (+ answer).
function splitQuestion(block: string): { prompt: string; options: string[]; answer: string } {
  // An explicit "ចម្លើយ៖ X" (or English "Answer: X") marker is the strongest,
  // most trustworthy answer signal.
  let marker = '';
  const am = block.match(/(?:ចម្លើយ|answer|ans)\s*[:៖]\s*([^\n|]+)/i);
  if (am) { marker = am[1].trim(); block = (block.slice(0, am.index) + block.slice(am.index! + am[0].length)).trim(); }

  // Pipe-separated inline options → newlines, so every option starts a "segment".
  const norm = block.replace(/\s*\|\s*/g, '\n');
  // An option label = a single letter/consonant, optionally wrapped in parens, with
  // a trailing . ) ） ． ៖ : then a space — e.g. "A." "ក)" "(A)" "(ក)". Preceded by
  // start-of-text, whitespace, or a closing bracket. Options may be separated by
  // "|", line breaks, OR just spaces (the paren style "(A) … (B) …"). If no
  // PUNCTUATED labels are found, fall back to BARE labels ("ក … ខ … គ …").
  let marks = strictLabelMarks(norm);
  // Glued labels are sequence-validated (high precision), so trust them whenever
  // they recover MORE options than the strict pass — e.g. strict sees only B/C/D
  // on their own lines while A is glued to the prompt.
  const glued = gluedLabelMarks(norm);
  if (glued.length > marks.length) marks = glued;
  if (marks.length < 2) marks = bareLabelMarks(norm);

  if (marks.length < 2) {
    const { text, bracket } = stripBrackets(block.replace(/\n+/g, ' '));
    // Short answer: trust the marker; else the bracket value.
    return { prompt: text, options: [], answer: (marker ? resolveAnswer(marker, []) || marker : resolveAnswer(bracket, [])) };
  }
  const options: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].idx : norm.length;
    options.push(norm.slice(marks[i].end, end).replace(/\n+/g, ' ').trim());
  }
  const opts = options.filter(Boolean);
  const { text: prompt, bracket } = stripBrackets(norm.slice(0, marks[0].idx).replace(/\n+/g, ' '));
  // Prefer the explicit marker (verbatim if it doesn't map to a label); else accept
  // a bracket ONLY when it's a genuine option label — never a lesson number.
  const answer = (marker ? resolveAnswer(marker, opts) || marker : resolveAnswer(bracket, opts));
  return { prompt, options: opts, answer };
}

export function parsePastedQuestions(text: string): ParsedPaste {
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim());
  const firstQ = lines.findIndex(l => Q_NUM_RE.test(l));

  // No numbering at all → each non-empty line is its own question.
  if (firstQ === -1) {
    const qs = lines.filter(Boolean).map(l => {
      const s = splitQuestion(l);
      return { prompt: s.prompt, options: s.options.length ? s.options : undefined, answer: s.answer } as WSQuestion;
    }).filter(q => q.prompt);
    return { instructions: '', questions: qs, multipleChoice: qs.some(q => !!q.options?.length) };
  }

  const instructions = lines.slice(0, firstQ).filter(Boolean).join(' ').trim();
  // Group lines per question. A LONG standalone paragraph (a reading passage —
  // ≥90 chars or starting with "អត្ថបទ") is NOT part of the current question's
  // options; it becomes CONTEXT for the NEXT question. Short non-numbered lines
  // (e.g. bare-label option rows) still belong to the current question.
  const groups: { lines: string[]; context: string }[] = [];
  let pending = '';
  let inPassage = false;
  const PASSAGE_MIN = 90;
  for (let i = firstQ; i < lines.length; i++) {
    const l = lines[i];
    if (Q_NUM_RE.test(l)) {
      groups.push({ lines: [l.replace(Q_NUM_RE, '')], context: pending });
      pending = ''; inPassage = false;
    } else if (l) {
      if (!inPassage && (l.length >= PASSAGE_MIN || /^\s*អត្ថបទ/.test(l))) inPassage = true;
      if (inPassage) pending = pending ? `${pending}\n${l}` : l;
      else if (groups.length) groups[groups.length - 1].lines.push(l);
    }
  }
  const questions: WSQuestion[] = groups.map(g => {
    const s = splitQuestion(g.lines.join('\n'));
    return { prompt: s.prompt, options: s.options.length ? s.options : undefined, answer: s.answer, context: g.context || undefined } as WSQuestion;
  }).filter(q => q.prompt);

  return { instructions, questions, multipleChoice: questions.some(q => !!q.options?.length) };
}

// ---------------------------------------------------------------------------
// Separate answer-key section support. Teachers often keep the key apart from
// the questions ("អត្រាកំណែ"): a heading line followed by numbered answers
// (១. ក  ២. ខ … or "1) B", one per line or inline). The key's numbers map onto
// the questions IN DOCUMENT ORDER (question #1 = key #1).
// ---------------------------------------------------------------------------

// Split the document at an answer-key heading line. Papers title this section
// several ways — "អត្រាកំណែ", "ចម្លើយសង្ខេប", "កូនសោចម្លើយ", "Answer key" — and it may
// carry a leading emoji/bullet, so allow a little decoration before the word.
export function splitAnswerKey(text: string): { body: string; keyText: string } {
  const m = text.match(
    /(^|\n)[ \t]*[^\p{L}\n]{0,3}[ \t]*(?:អត្រាកំណែ|ចម្លើយសង្ខេប|កូនសោចម្លើយ|answer\s*key)[^\n]*\n?/iu
  );
  if (!m || m.index === undefined) return { body: text, keyText: '' };
  return { body: text.slice(0, m.index), keyText: text.slice(m.index + m[0].length) };
}

const KH_DIGITS = '០១២៣៤៥៦៧៨៩';
const keyNum = (s: string): number => Number([...s].map(c => (KH_DIGITS.indexOf(c) >= 0 ? KH_DIGITS.indexOf(c) : c)).join(''));

// "១. ក ២. ខ" / "1) B\n2) C" / "៣- សាលា" → Map(question number → raw answer).
//
// Real keys glue each entry onto the previous answer's text —
// "១. មាតុភូមិ - A. [មា-តុ-ភូម]២. សេវាកម្ម - B. …" — so whitespace before the
// number cannot be required. Instead the numbers must COUNT UP 1,2,3,…: a digit
// inside an answer ("រូបភាពទី៥)") doesn't fit the running sequence and is
// ignored, which is what keeps the glued scan honest.
// A single key entry is short ("ខ", "C. 7 (ព្រោះ 28 ÷ 4 = 7)"). Anything far longer
// means the scan lost the sequence and one entry swallowed the rest of the key —
// drop it rather than store a glob of every remaining answer as one question's.
const MAX_KEY_ENTRY_LEN = 200;

export function parseAnswerKey(keyText: string): Map<number, string> {
  const out = new Map<number, string>();
  // A number is EITHER all-Latin or all-Khmer digits — never a mix. Keys glue the
  // next entry straight onto the previous answer, so an answer ending in a Latin
  // digit ran into the following Khmer number ("…=45" + "៤." → "45៤" = 454), which
  // hid that entry, stalled the sequence, and made the previous answer swallow the
  // rest of the key.
  const re = /([0-9]{1,3}|[០-៩]{1,3})\s*[.)។៖:\-]\s*/g;
  const cands: { num: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(keyText))) cands.push({ num: keyNum(m[1]), start: m.index, end: re.lastIndex });
  // Walk the numbers upward. Tolerate a SMALL gap so one garbled entry can't stall
  // the scan (a stall let the last match run to the end of the document).
  const marks: { num: number; start: number; end: number }[] = [];
  let expect = 1;
  for (const c of cands) {
    if (c.num >= expect && c.num <= expect + 2) { marks.push(c); expect = c.num + 1; }
  }
  for (let i = 0; i < marks.length; i++) {
    const valEnd = i + 1 < marks.length ? marks[i + 1].start : keyText.length;
    // Compact keys list entries inline — "១. A, ២. B, ៣. A" — so each value keeps
    // the separator that led into the next entry. Trim those edges, or the label
    // ("A,") no longer resolves to an option.
    const val = keyText.slice(marks[i].end, valEnd)
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;،៖។|/]+|[\s,;،៖។|/]+$/g, '')
      .trim();
    if (val && val.length <= MAX_KEY_ENTRY_LEN) out.set(marks[i].num, val);
  }
  return out;
}

// A key entry is often more than a bare label — "មាតុភូមិ - A. [មា-តុ-ភូម]"
// recaps the question, then gives the label AND the option text. Pull both out.
const KEY_ENTRY_RE = /[-–—]\s*[(（]?([A-Ha-hក-អ])[)）]?\s*[.)．៖:]\s*(.*)$/;

// Fill each question's answer from the key (an inline "ចម្លើយ៖" always wins).
// Labels (ក/A) resolve to the option text; free text is kept verbatim.
// Returns how many answers were applied.
export function applyAnswerKey(questions: WSQuestion[], key: Map<number, string>): number {
  let applied = 0;
  questions.forEach((q, i) => {
    if (q.answer) return;
    const raw = key.get(i + 1);
    if (!raw) return;
    const opts = q.options || [];
    const m = raw.match(KEY_ENTRY_RE);
    if (m) {
      // Multiple choice: trust the label and resolve it against this question's
      // own options (their order may differ from the key's). With no options the
      // text after the label IS the answer — the recap before it is not.
      const [, label, tail] = m;
      q.answer = (opts.length >= 2 ? resolveAnswer(label, opts) : '') || tail.trim() || raw;
    } else {
      q.answer = resolveAnswer(raw, opts) || raw;
    }
    applied++;
  });
  return applied;
}

// ---------------------------------------------------------------------------
// Free offline generator — randomised arithmetic. Works with no AI key and is
// unlimited/free, so daily math practice never depends on the network.
// ---------------------------------------------------------------------------
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Pick a sensible number range from grade + difficulty.
function mathRange(grade: string, difficulty: Difficulty): number {
  const g = (grade.match(/\d/) || ['1'])[0];
  const base = grade.includes('មត្តេយ្យ') ? 10 : Math.min(10000, 10 ** Math.max(1, Number(g)));
  return Math.max(10, Math.round(base * (difficulty === 'easy' ? 0.3 : difficulty === 'hard' ? 1 : 0.6)));
}

export function generateMathLocal(params: WorksheetParams): WSQuestion[] {
  const max = mathRange(params.grade, params.difficulty);
  const ops = /ដក/.test(params.topic) ? ['-'] : /គុណ/.test(params.topic) ? ['×']
    : /ចែក/.test(params.topic) ? ['÷'] : /បូក/.test(params.topic) ? ['+']
    : ['+', '-']; // default mix
  const seen = new Set<string>();
  const out: WSQuestion[] = [];
  let guard = 0;
  while (out.length < params.count && guard++ < params.count * 30) {
    const op = ops[rint(0, ops.length - 1)];
    let a = rint(1, max), b = rint(1, max), ans: number;
    if (op === '-') { if (b > a) [a, b] = [b, a]; ans = a - b; }
    else if (op === '×') { a = rint(2, 12); b = rint(2, 12); ans = a * b; }
    else if (op === '÷') { b = rint(2, 12); ans = rint(2, 12); a = b * ans; }
    else ans = a + b;
    const key = `${a}${op}${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prompt = params.type === 'word_problems'
      ? `មានវត្ថុ ${a} ${op === '+' ? 'បន្ថែម' : op === '-' ? 'យកចេញ' : op === '×' ? 'ដងនៃ' : 'ចែកជា'} ${b}។ សរុបនៅសល់ប៉ុន្មាន?`
      : `${a} ${op} ${b} =`;
    out.push({ prompt, answer: String(ans) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// AI generator — Gemini returns STRUCTURED JSON we parse straight into questions.
// ---------------------------------------------------------------------------
function langInstruction(l: WSLanguage): string {
  return l === 'en' ? 'Write everything in English.'
    : l === 'bilingual' ? 'Write each question in Khmer first, then the English translation in (parentheses).'
    : 'សរសេរទាំងអស់ជាភាសាខ្មែរត្រឹមត្រូវ (Khmer Unicode)។';
}

// Shared prompt — same instructions whether it runs on Gemini or local Ollama.
function buildWorksheetPrompt(params: WorksheetParams): string {
  const mixedFormats = params.types && params.types.length > 0 
    ? params.types.map(t => TYPE_LABELS[t].split('(')[0].trim()).join(', ')
    : 'Multiple Choice, Fill in the Blank, Matching, True/False, Short Answer, Essay, Word Problems, Reading, and Writing Practice';

  const shape = params.type === 'multiple_choice'
    ? `Each item: { "prompt": string, "options": [4 strings], "answer": string (must equal exactly one option) }.`
    : params.type === 'matching'
      ? `Each item: { "prompt": "ផ្គូផ្គង", "pairs": [ { "left": string, "right": string } ], "answer": "" }. Put ${params.count} pairs in ONE item.`
      : params.type === 'true_false'
        ? `Each item: { "prompt": string (a statement), "answer": "ត្រូវ" or "ខុស" (or "True"/"False" for English) }.`
        : params.type === 'mixed'
          ? `Each item: { "prompt": string (question/instructions), "options"?: [4 strings] (if multiple choice), "pairs"?: [{"left": string, "right": string}] (if matching), "answer": string }. Use a highly diverse mix of ONLY these formats: ${mixedFormats}.`
          : `Each item: { "prompt": string, "answer": string (the model/expected answer) }.`;

  const source = (params.source || '').trim();
  const sourceBlock = source
    ? `

Base the questions STRICTLY on this lesson/source material (do NOT invent facts outside it; quote/adapt it faithfully):
"""
${source.slice(0, 12000)}
"""`
    : '';

  return `You generate printable school worksheet questions for a teacher.
Return ONLY a JSON object: { "questions": [ ... ] } with EXACTLY ${params.type === 'matching' ? 1 : params.count} item(s).
${shape}

Constraints:
- Grade: ${params.grade}. Subject: ${params.subject}. Lesson: ${params.lesson || '(general)'}. Topic: ${params.topic || '(general)'}.
- ${params.difficulty === 'mixed' ? 'Difficulty distribution: 30% easy, 50% medium, 20% hard.' : `Difficulty: ${params.difficulty}.`} Worksheet type: ${params.type}.
- ${langInstruction(params.language)}
- Age-appropriate. Clear and unambiguous. NO duplicate questions. Vary the wording and numbers.
- Do not add commentary, markdown, or anything outside the JSON.${sourceBlock}`;
}

// Parse the model's JSON text into questions (tolerant of code-fences).
function parseWorksheetJSON(text: string): WSQuestion[] {
  const t = (text || '').trim();
  let parsed: any;
  try { parsed = JSON.parse(t); }
  catch { parsed = JSON.parse(t.replace(/^```json?/i, '').replace(/```$/, '').trim()); }
  const questions: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  if (!questions.length) throw new Error('Empty AI response');
  return questions.map(q => ({
    prompt: String(q.prompt ?? ''),
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
    pairs: Array.isArray(q.pairs) ? q.pairs.map((p: any) => ({ left: String(p.left), right: String(p.right) })) : undefined,
    answer: String(q.answer ?? ''),
  })).filter(q => q.prompt || q.pairs);
}

export async function generateWorksheetAI(params: WorksheetParams): Promise<WSQuestion[]> {
  const ai = getClient();
  if (!ai) throw new Error('Gemini API key not configured');
  const res = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: buildWorksheetPrompt(params),
    config: { responseMimeType: 'application/json' },
  });
  return parseWorksheetJSON(res.text || '');
}

// Local, free, private generation via Ollama (e.g. Gemma) running on the machine.
export async function generateWorksheetOllama(params: WorksheetParams): Promise<WSQuestion[]> {
  const text = await ollamaGenerateJSON(buildWorksheetPrompt(params));
  return parseWorksheetJSON(text);
}

// Main entry. Order of preference (all free): local Ollama → Gemini free key →
// offline math generator. Each step falls through if it's unavailable or fails.
export async function generateQuestions(params: WorksheetParams): Promise<WSQuestion[]> {
  const isMath = params.subject.includes('គណិត');

  // 1. Local Ollama (free + private) when reachable.
  if (await ollamaReachable()) {
    try { return await generateWorksheetOllama(params); }
    catch (e) { console.warn('Ollama generation failed, falling back', e); }
  }

  // 2. Gemini free key (works on every device).
  if (hasGemini()) {
    try { return await generateWorksheetAI(params); }
    catch (e) { if (isMath) return generateMathLocal(params); throw e; }
  }

  // 3. Offline math generator (no AI needed).
  if (isMath) return generateMathLocal(params);
  throw new Error('ត្រូវការ Ollama (ក្នុងស្រុក) ឬ Gemini API key សម្រាប់មុខវិជ្ជានេះ (គណិតវិទ្យាដំណើរការដោយឥតគិតថ្លៃ)។');
}

// ---------------------------------------------------------------------------
// Bank-first generation. Reuse APPROVED questions from the Question Bank, and
// call the AI ONLY for the shortfall. Newly generated AI questions are saved back
// to the bank as unapproved drafts (fire-and-forget) so the bank grows over time.
// ---------------------------------------------------------------------------
export interface BankGenResult { questions: WSQuestion[]; fromBank: number; fromAI: number; }

export async function generateFromBank(params: WorksheetParams): Promise<BankGenResult> {
  await hydrateQuestions(); // ensure the (possibly IndexedDB-backed) bank is loaded
  const { used, shortfall } = pickApproved(params, params.count);
  let ai: WSQuestion[] = [];
  if (shortfall > 0) {
    try {
      ai = await generateQuestions({ ...params, count: shortfall });
    } catch (e) {
      if (!used.length) throw e; // nothing from the bank either → surface the error
      console.warn('AI shortfall generation failed; using bank questions only', e);
    }
    if (ai.length) {
      // Save the AI questions to the bank as drafts (never throws to the UI).
      bulkAddQuestions(ai.map(q => ({
        ...q,
        grade: params.grade, subject: params.subject,
        lesson: params.lesson || undefined,
        type: params.type, difficulty: params.difficulty,
        status: 'draft' as const, source: 'ai' as const,
      }))).catch(() => { /* offline — drafts saved locally by bulkAddQuestions */ });
    }
  }
  return { questions: [...used.map(toWSQuestion), ...ai], fromBank: used.length, fromAI: ai.length };
}

// ---------------------------------------------------------------------------
// Exam papers (វិញ្ញាសាប្រឡង) — monthly / semester / annual. Every exam is built
// with a FIXED DIFFICULTY MIX so grading is consistent:
//   ងាយ 30% (3 ពិន្ទុ) · មធ្យម 50% (5 ពិន្ទុ) · ពិបាក 20% (2 ពិន្ទុ)  = 10 ពិន្ទុ
// Each tier is its own section (bank-first, then AI for the shortfall). The tier
// question TYPE progresses from recall → application → reasoning for variety.
// ---------------------------------------------------------------------------
export type ExamPeriod = 'month' | 'semester' | 'year';
export const EXAM_PERIOD_LABELS: Record<ExamPeriod, string> = {
  month: 'ប្រចាំខែ', semester: 'ប្រចាំឆមាស', year: 'ប្រចាំឆ្នាំ',
};

export interface ExamSection { label: string; type: WorksheetType; questions: WSQuestion[]; points: number; }

// Difficulty tiers — ratio of questions and the fixed points per tier (total 10).
const EXAM_TIERS: { difficulty: Difficulty; ratio: number; points: number }[] = [
  { difficulty: 'easy', ratio: 0.3, points: 3 },
  { difficulty: 'medium', ratio: 0.5, points: 5 },
  { difficulty: 'hard', ratio: 0.2, points: 2 },
];
// How many questions in total per period (the 30/50/20 split is applied to this).
const EXAM_TOTAL_Q: Record<ExamPeriod, number> = { month: 10, semester: 20, year: 30 };
// A sensible question type per tier (recall → application → reasoning). Essay/
// reading don't suit maths, so maths uses word problems for the hard tier.
const tierType = (difficulty: Difficulty, isMath: boolean): WorksheetType =>
  difficulty === 'easy' ? 'multiple_choice'
    : difficulty === 'medium' ? 'short_answer'
      : isMath ? 'word_problems' : 'essay';

// Split a total into the tier ratios, keeping the sum exact.
function tierCounts(total: number): number[] {
  const easy = Math.max(1, Math.round(total * 0.3));
  const medium = Math.max(1, Math.round(total * 0.5));
  const hard = Math.max(1, total - easy - medium);
  return [easy, medium, hard];
}

// Generate a full exam paper as three difficulty sections (easy/medium/hard) with
// the fixed 3/5/2 points. Bank-first per tier; skips a tier only if it fails.
export async function generateExam(params: WorksheetParams, period: ExamPeriod): Promise<ExamSection[]> {
  const isMath = params.subject.includes('គណិត');
  // Honour the user's chosen question count; fall back to the per-period default.
  const total = params.count && params.count > 0 ? params.count : EXAM_TOTAL_Q[period];
  const counts = tierCounts(total);
  const sections: ExamSection[] = [];
  for (let i = 0; i < EXAM_TIERS.length; i++) {
    const tier = EXAM_TIERS[i];
    const count = counts[i];
    const type = tierType(tier.difficulty, isMath);
    try {
      // Bank-first per tier: reuse approved questions at this difficulty, AI fills rest.
      const { questions } = await generateFromBank({ ...params, type, difficulty: tier.difficulty, count });
      if (questions.length) sections.push({
        // Show only the Khmer exercise type — no difficulty word and no English.
        // (The difficulty still drives generation above via tier.difficulty.)
        label: TYPE_LABELS[type].split('(')[0].trim(),
        type, questions, points: tier.points,
      });
    } catch (e) { console.warn('Exam tier failed', tier.difficulty, e); }
  }
  if (!sections.length) throw new Error('បង្កើតវិញ្ញាសាមិនបានសម្រេច — សូមព្យាយាមម្ដងទៀត។');
  return sections;
}

// ---------------------------------------------------------------------------
// Supabase persistence (single table `worksheets`, JSON columns — run the SQL
// in the migration note). Falls back silently when offline; never throws to the UI.
// ---------------------------------------------------------------------------
export async function saveWorksheet(ws: Worksheet): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { error } = await sb.from('worksheets').upsert({
    id: ws.id,
    title: ws.title,
    subject: ws.params.subject,
    grade: ws.params.grade,
    teacher: ws.createdBy,
    params: ws.params,
    questions: ws.questions,
    instructions: ws.instructions,
    archived: false,
    updated_at: new Date().toISOString(),
  });
  if (error) { console.warn('saveWorksheet failed', error); return false; }
  return true;
}

export async function fetchWorksheets(teacher?: string): Promise<Worksheet[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  let q = sb.from('worksheets').select('*').eq('archived', false).order('updated_at', { ascending: false });
  if (teacher) q = q.eq('teacher', teacher);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id, title: r.title, instructions: r.instructions || '',
    params: r.params, questions: r.questions || [], createdBy: r.teacher || '', createdAt: r.updated_at,
  }));
}

export async function archiveWorksheet(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb.from('worksheets').update({ archived: true }).eq('id', id);
}
