/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// AI Worksheet Generator — data model, AI generation (Gemini, structured JSON),
// a free offline math generator, and Supabase persistence. Pure logic only; the
// UI lives in components/WorksheetGenerator.tsx.

import { getClient, hasGemini } from './gemini';
import { getSupabaseClient } from './supabase';

export type WorksheetType =
  | 'multiple_choice' | 'fill_blank' | 'matching' | 'true_false'
  | 'short_answer' | 'essay' | 'word_problems' | 'reading' | 'writing';

export type Difficulty = 'easy' | 'medium' | 'hard';
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
};
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'ងាយ', medium: 'មធ្យម', hard: 'ពិបាក' };
export const LANGUAGE_LABELS: Record<WSLanguage, string> = { km: 'ខ្មែរ', en: 'English', bilingual: 'ខ្មែរ + English' };

export const SUBJECTS = ['គណិតវិទ្យា', 'ភាសាខ្មែរ', 'ភាសាអង់គ្លេស', 'វិទ្យាសាស្ត្រ', 'សិក្សាសង្គម', 'កុំព្យូទ័រ', 'សិល្បៈ'];

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

export async function generateWorksheetAI(params: WorksheetParams): Promise<WSQuestion[]> {
  const ai = getClient();
  if (!ai) throw new Error('Gemini API key not configured');

  const shape = params.type === 'multiple_choice'
    ? `Each item: { "prompt": string, "options": [4 strings], "answer": string (must equal exactly one option) }.`
    : params.type === 'matching'
      ? `Each item: { "prompt": "ផ្គូផ្គង", "pairs": [ { "left": string, "right": string } ], "answer": "" }. Put ${params.count} pairs in ONE item.`
      : params.type === 'true_false'
        ? `Each item: { "prompt": string (a statement), "answer": "ត្រូវ" or "ខុស" (or "True"/"False" for English) }.`
        : `Each item: { "prompt": string, "answer": string (the model/expected answer) }.`;

  const prompt = `You generate printable school worksheet questions for a teacher.
Return ONLY a JSON object: { "questions": [ ... ] } with EXACTLY ${params.type === 'matching' ? 1 : params.count} item(s).
${shape}

Constraints:
- Grade: ${params.grade}. Subject: ${params.subject}. Lesson: ${params.lesson || '(general)'}. Topic: ${params.topic || '(general)'}.
- Difficulty: ${params.difficulty}. Worksheet type: ${params.type}.
- ${langInstruction(params.language)}
- Age-appropriate. Clear and unambiguous. NO duplicate questions. Vary the wording and numbers.
- Do not add commentary, markdown, or anything outside the JSON.`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  const text = (res.text || '').trim();
  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch { parsed = JSON.parse(text.replace(/^```json?/i, '').replace(/```$/, '').trim()); }
  const questions: WSQuestion[] = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  if (!questions.length) throw new Error('Empty AI response');
  return questions.map(q => ({
    prompt: String(q.prompt ?? ''),
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
    pairs: Array.isArray(q.pairs) ? q.pairs.map((p: any) => ({ left: String(p.left), right: String(p.right) })) : undefined,
    answer: String(q.answer ?? ''),
  })).filter(q => q.prompt || q.pairs);
}

// Main entry: AI when available & not pure math, else the free local math generator.
export async function generateQuestions(params: WorksheetParams): Promise<WSQuestion[]> {
  const isMath = params.subject.includes('គណិត');
  const arithmetic = isMath && /បូក|ដក|គុណ|ចែក|word_problems/.test(params.topic + ' ' + params.type);
  if (arithmetic && (!hasGemini() || params.type === 'word_problems' || params.type === 'fill_blank')) {
    // Free, unlimited, offline for arithmetic.
    if (!hasGemini()) return generateMathLocal(params);
  }
  if (hasGemini()) {
    try { return await generateWorksheetAI(params); }
    catch (e) { if (isMath) return generateMathLocal(params); throw e; }
  }
  if (isMath) return generateMathLocal(params);
  throw new Error('ត្រូវការ Gemini API key សម្រាប់មុខវិជ្ជានេះ (គណិតវិទ្យាដំណើរការដោយឥតគិតថ្លៃ)។');
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
