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

function stripBrackets(s: string): { text: string; answer: string } {
  const brs = [...s.matchAll(/\[([^\]]{1,24})\]/g)];
  const answer = brs.length ? brs[brs.length - 1][1].trim() : '';
  const text = s.replace(/\s*\[[^\]]{1,24}\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return { text, answer };
}

// Split one question block into prompt + options (+ answer).
function splitQuestion(block: string): { prompt: string; options: string[]; answer: string } {
  let answer = '';
  const am = block.match(/ចម្លើយ\s*[:៖]\s*([^\n|]+)/);
  if (am) { answer = am[1].trim(); block = (block.slice(0, am.index) + block.slice(am.index! + am[0].length)).trim(); }

  // Pipe-separated inline options → newlines, so every option starts a "segment".
  const norm = block.replace(/\s*\|\s*/g, '\n');
  // An option label = a single letter/consonant then . ) ． ៖ : then a space,
  // preceded by start-of-text, whitespace, or a closing bracket.
  const re = /(^|[\s\]])((?:[A-Ha-h])|[ក-អ])[.)．៖:]\s+/g;
  const marks: { idx: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) marks.push({ idx: m.index + m[1].length, end: re.lastIndex });

  if (marks.length < 2) {
    const { text, answer: a } = stripBrackets(block.replace(/\n+/g, ' '));
    return { prompt: text, options: [], answer: answer || a };
  }
  const options: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].idx : norm.length;
    options.push(norm.slice(marks[i].end, end).replace(/\n+/g, ' ').trim());
  }
  const { text: prompt, answer: a } = stripBrackets(norm.slice(0, marks[0].idx).replace(/\n+/g, ' '));
  return { prompt, options: options.filter(Boolean), answer: answer || a };
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
  const groups: string[][] = [];
  for (let i = firstQ; i < lines.length; i++) {
    const l = lines[i];
    if (Q_NUM_RE.test(l)) groups.push([l.replace(Q_NUM_RE, '')]);
    else if (groups.length && l) groups[groups.length - 1].push(l);
  }
  const questions: WSQuestion[] = groups.map(g => {
    const s = splitQuestion(g.join('\n'));
    return { prompt: s.prompt, options: s.options.length ? s.options : undefined, answer: s.answer } as WSQuestion;
  }).filter(q => q.prompt);

  return { instructions, questions, multipleChoice: questions.some(q => !!q.options?.length) };
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
