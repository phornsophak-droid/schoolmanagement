/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Standardized online tests (តេស្តស្តង់ដា) — the exam engine behind the student
// quiz. A test is DEFINED by a teacher/principal from questions in the separate
// standardTestBank, then OPENED with a short join code. Students (no account)
// enter the code, pick their name from the class roster, and take the test with
// a countdown; answers are auto-graded client-side and saved to the
// test_submissions table (one attempt per student per test).
//
// Storage: test definitions live in the school_settings KV under
// 'standard_tests' (small JSON, negligible egress — same pattern as lessons &
// timetable). Submissions grow per-student so they live in a real Postgres
// table (test_submissions in schema.sql §9b).

import { syncUpsertSetting, fetchSetting, getSupabaseClient } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';
import { standardTestBank, BankQuestion } from './questionBank';

// ---------------------------------------------------------------- Types ----

export interface TestQuestion {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'matching';
  prompt: string;
  options?: string[];                        // multiple_choice
  pairs?: { left: string; right: string }[]; // matching
  answer: string;                            // multiple_choice / fill_blank
  context?: string;                          // reading passage shown above the prompt
  audioUrl?: string;                         // RESERVED for the dictation phase
  points?: number;                           // overrides pointsPerQuestion
}

export interface StandardTest {
  id: string;
  code: string;              // join code, '' while draft
  title: string;
  grades: string[];          // classes that may take this test
  subject: string;
  durationSec: number;
  status: 'draft' | 'open' | 'closed';
  questionIds: string[];     // picked from standardTestBank while drafting
  questions?: TestQuestion[]; // FROZEN snapshot, filled when the test opens
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  pointsPerQuestion: number;
  antiCheat: boolean;        // count tab switches on the student device
  createdBy: string;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
}

// Student answers: matching questions map left→right, everything else is a string.
export type TestAnswers = Record<string, string | Record<string, string>>;

export interface GradeDetail {
  expected: string;
  got: string;
  earned: number;
  points: number;
  correct: boolean; // full marks
}

export interface GradedResult {
  score: number;
  maxScore: number;
  detail: Record<string, GradeDetail>;
}

export interface TestSubmission {
  id: string;
  testId: string;
  grade: string;
  subject: string;
  studentName: string;
  answers: TestAnswers;
  detail: Record<string, GradeDetail>;
  score: number;
  maxScore: number;
  startedAt?: string;
  submittedAt: string;
  durationUsedSec: number;
  autoSubmitted: boolean;
  tabSwitches: number;
}

// ------------------------------------------------- Test definitions (KV) ----

const KEY = 'standard_tests';
kvHydrate(KEY);

export const hydrateTests = (): Promise<void> => kvHydrate(KEY);

export const loadTests = (): StandardTest[] => {
  const a = kvReadSync<StandardTest[]>(KEY, []);
  return Array.isArray(a) ? a : [];
};

export const refreshTestsFromCloud = async (): Promise<StandardTest[]> => {
  await kvHydrate(KEY);
  try {
    const v = await fetchSetting(KEY);
    if (Array.isArray(v)) { await kvWrite(KEY, v); return v; }
  } catch { /* offline — keep local */ }
  return loadTests();
};

const persistAll = async (list: StandardTest[]): Promise<StandardTest[]> => {
  await kvWrite(KEY, list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — saved locally */ }
  return list;
};

export const saveTest = async (t: StandardTest): Promise<StandardTest[]> => {
  const list = loadTests();
  const idx = list.findIndex(x => x.id === t.id);
  if (idx >= 0) list[idx] = t; else list.unshift(t);
  return persistAll(list);
};

export const deleteTest = async (id: string): Promise<StandardTest[]> =>
  persistAll(loadTests().filter(t => t.id !== id));

export const uuid = (): string =>
  ((crypto as any).randomUUID ? crypto.randomUUID() : `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// Join code: 4 chars, no look-alikes (0/O, 1/I/L) so it survives a whiteboard.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const genCode = (taken: Set<string>): string => {
  for (let tries = 0; tries < 200; tries++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!taken.has(c)) return c;
  }
  return `T${Date.now().toString(36).toUpperCase().slice(-4)}`;
};

const shuffle = <T>(a: T[]): T[] => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

// Open a test: freeze a snapshot of its bank questions (later edits/deletes in
// the bank can't break a running test) and assign a join code unique among
// currently-open tests.
export const openTest = async (id: string): Promise<StandardTest | null> => {
  const list = loadTests();
  const t = list.find(x => x.id === id);
  if (!t) return null;
  const byId = new Map(standardTestBank.loadQuestions().map(q => [q.id, q]));
  const questions: TestQuestion[] = t.questionIds
    .map(qid => byId.get(qid))
    .filter((q): q is BankQuestion => !!q)
    .map(q => ({
      id: q.id,
      type: (q.type === 'matching' ? 'matching' : q.type === 'fill_blank' ? 'fill_blank' : 'multiple_choice'),
      prompt: q.prompt || '',
      options: q.options,
      pairs: q.pairs,
      answer: q.answer || '',
      context: (q as any).context,
    }));
  if (!questions.length) throw new Error('តេស្តនេះគ្មានសំណួរទេ — សូមជ្រើសសំណួរពីធនាគារសិន។');
  const taken = new Set(list.filter(x => x.status === 'open' && x.id !== id).map(x => x.code));
  t.code = genCode(taken);
  t.questions = questions;
  t.status = 'open';
  t.openedAt = new Date().toISOString();
  await persistAll(list);
  return t;
};

export const closeTest = async (id: string): Promise<StandardTest[]> => {
  const list = loadTests();
  const t = list.find(x => x.id === id);
  if (t) { t.status = 'closed'; t.closedAt = new Date().toISOString(); }
  return persistAll(list);
};

// Student device: resolve a join code → the open test. Always tries the cloud
// first (the student's phone has no synced local copy).
export const findOpenTestByCode = async (code: string): Promise<StandardTest | null> => {
  const c = (code || '').trim().toUpperCase();
  if (!c) return null;
  let list: StandardTest[] = [];
  try {
    const v = await fetchSetting(KEY);
    if (Array.isArray(v)) list = v;
  } catch { list = loadTests(); }
  if (!list.length) list = loadTests();
  return list.find(t => t.status === 'open' && t.code === c) || null;
};

// ---------------------------------------------------------- Auto-grading ----

// Khmer-aware answer normalization: ignore zero-width chars, the colon family
// (ៈ vs ៖ vs : — same lesson as the parent-portal name lookup), Khmer vs Arabic
// digits, extra whitespace, and case.
const KH_DIGITS = '០១២៣៤៥៦៧៨៩';
export const normAnswer = (s: string): string =>
  (s || '')
    .replace(/[​‌‍﻿ ]/g, '')
    .replace(/[០-៩]/g, d => String(KH_DIGITS.indexOf(d)))
    .replace(/[ៈ៖:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const gradeTest = (test: StandardTest, answers: TestAnswers): GradedResult => {
  const detail: Record<string, GradeDetail> = {};
  let score = 0, maxScore = 0;
  for (const q of test.questions || []) {
    const pts = q.points ?? test.pointsPerQuestion ?? 1;
    maxScore += pts;
    const got = answers[q.id];
    if (q.type === 'matching') {
      const pairs = q.pairs || [];
      const map = (got && typeof got === 'object') ? got as Record<string, string> : {};
      const hit = pairs.filter(p => normAnswer(map[p.left] || '') === normAnswer(p.right)).length;
      const earned = pairs.length ? Math.round((hit / pairs.length) * pts * 100) / 100 : 0;
      score += earned;
      detail[q.id] = {
        expected: pairs.map(p => `${p.left}→${p.right}`).join(', '),
        got: pairs.map(p => `${p.left}→${map[p.left] || ''}`).join(', '),
        earned, points: pts, correct: hit === pairs.length,
      };
    } else {
      const g = typeof got === 'string' ? got : '';
      const correct = !!g && normAnswer(g) === normAnswer(q.answer);
      const earned = correct ? pts : 0;
      score += earned;
      detail[q.id] = { expected: q.answer, got: g, earned, points: pts, correct };
    }
  }
  return { score: Math.round(score * 100) / 100, maxScore, detail };
};

// Deterministic per-student presentation: shuffle questions/options ONCE from a
// seed (student key) so a page refresh mid-test shows the same order.
const seededShuffle = <T>(a: T[], seed: string): T[] => {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

export const presentQuestions = (test: StandardTest, seed: string): TestQuestion[] => {
  let qs = test.questions || [];
  if (test.shuffleQuestions) qs = seededShuffle(qs, seed);
  if (test.shuffleOptions) qs = qs.map(q => q.options ? { ...q, options: seededShuffle(q.options, seed + q.id) } : q);
  // Matching: the right-hand side is always shuffled for display (otherwise the
  // pairs arrive pre-matched); the display order comes from the same seed.
  return qs.map(q => q.pairs ? { ...q, pairs: q.pairs } : q);
};

export const matchingRightOptions = (q: TestQuestion, seed: string): string[] =>
  seededShuffle((q.pairs || []).map(p => p.right), seed + '::rights::' + q.id);

// ------------------------------------------------------- Submissions (DB) ----

export const studentKeyOf = (name: string): string =>
  normAnswer(name).replace(/\s/g, '');

export const submissionId = (testId: string, grade: string, studentName: string): string =>
  `${testId}::${grade}::${studentKeyOf(studentName)}`;

// One prior attempt lookup (blocks retakes). null = no attempt yet.
export const fetchPriorSubmission = async (testId: string, grade: string, studentName: string): Promise<TestSubmission | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('test_submissions')
    .select('*')
    .eq('id', submissionId(testId, grade, studentName))
    .limit(1);
  if (error || !data || !data.length) return null;
  return mapRow(data[0]);
};

export interface SubmitMeta {
  startedAt: string;
  durationUsedSec: number;
  autoSubmitted: boolean;
  tabSwitches: number;
}

// Grade + upsert. Returns the graded result so the student sees their score.
export const submitTest = async (
  test: StandardTest, grade: string, studentName: string, answers: TestAnswers, meta: SubmitMeta,
): Promise<GradedResult> => {
  const graded = gradeTest(test, answers);
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('មិនអាចភ្ជាប់ទៅ Server បានទេ។');
  const { error } = await supabase.from('test_submissions').upsert({
    id: submissionId(test.id, grade, studentName),
    test_id: test.id,
    grade,
    subject: test.subject,
    student_name: studentName,
    student_key: studentKeyOf(studentName),
    answers,
    detail: graded.detail,
    score: graded.score,
    max_score: graded.maxScore,
    started_at: meta.startedAt,
    submitted_at: new Date().toISOString(),
    duration_used_sec: meta.durationUsedSec,
    auto_submitted: meta.autoSubmitted,
    tab_switches: meta.tabSwitches,
  });
  if (error) throw error;
  return graded;
};

export const fetchSubmissionsFor = async (testId: string): Promise<TestSubmission[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('test_submissions')
    .select('*')
    .eq('test_id', testId)
    .order('score', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
};

const mapRow = (r: any): TestSubmission => ({
  id: r.id,
  testId: r.test_id,
  grade: r.grade,
  subject: r.subject,
  studentName: r.student_name,
  answers: r.answers || {},
  detail: r.detail || {},
  score: Number(r.score ?? 0),
  maxScore: Number(r.max_score ?? 0),
  startedAt: r.started_at || undefined,
  submittedAt: r.submitted_at || r.created_at,
  durationUsedSec: Number(r.duration_used_sec ?? 0),
  autoSubmitted: !!r.auto_submitted,
  tabSwitches: Number(r.tab_switches ?? 0),
});
