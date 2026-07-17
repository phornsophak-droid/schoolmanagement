/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Question Bank — a curated, reusable store of exam/worksheet questions. Questions
// are added manually or auto-collected (as drafts) from AI generations; the
// principal approves them, and approved questions are reused by the worksheet
// generator before it ever calls the AI.
//
// Storage mirrors lessons.ts: one JSON array in the school_settings KV
// (cloud-synced, tiny → negligible egress) + a localStorage mirror for instant
// reads. All access is kept behind this module so a future migration to a
// dedicated table is a one-file change.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';
import type { WSQuestion, WorksheetType, Difficulty, WorksheetParams } from './worksheets';

export interface BankQuestion extends WSQuestion {
  id: string;
  grade: string;
  subject: string;
  lesson?: string;        // free text or a curriculum lesson title
  objective?: string;     // learning objective (from the curriculum)
  month?: string;         // ខែ (មករា…ធ្នូ) — tags an imported exam's questions
  examType?: string;      // ប្រភេទតេស្ត (តេស្តប្រចាំខែ/ឆមាស…) for easy picking
  type: WorksheetType;
  difficulty: Difficulty;
  status?: 'draft' | 'approved'; // kept for backward compatibility with old data, but ignored
  source?: 'ai' | 'manual';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Tag vocabularies for imported exams (shared by the bank UI and the test
// composer's pick filters).
export const BANK_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
export const EXAM_TYPES = ['តេស្តប្រចាំខែ', 'ប្រឡងឆមាសទី១', 'ប្រឡងឆមាសទី២', 'ប្រឡងប្រចាំឆ្នាំ', 'តេស្តស្តង់ដា'];

const uuid = (): string => ((crypto as any).randomUUID ? crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

// Identity of a question for duplicate detection. The OPTIONS (and matching
// pairs) are part of it, not just the prompt: real exams reuse one generic stem
// — "ចូរជ្រើសរើសចម្លើយត្រឹមត្រូវ។" — across many questions that differ only in
// their choices, and keying on the prompt alone silently swallowed those.
const dupKey = (q: Pick<BankQuestion, 'grade' | 'subject' | 'type' | 'prompt' | 'options' | 'pairs'>): string => [
  q.grade, q.subject, q.type,
  (q.prompt || '').trim(),
  (q.options || []).map(o => (o || '').trim()).join('~'),
  (q.pairs || []).map(p => `${(p.left || '').trim()}>${(p.right || '').trim()}`).join('~'),
].join('|');

const shuffle = <T>(a: T[]): T[] => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

// A bank is just a JSON array under one KV key. The factory lets us have SEVERAL
// independent banks (the worksheet bank + a SEPARATE standardized-test bank) that
// share all the storage/sync/pick logic but never mix questions.
export interface BankApi {
  key: string;
  hydrate: () => Promise<void>;
  loadQuestions: () => BankQuestion[];
  refreshFromCloud: () => Promise<BankQuestion[]>;
  saveQuestion: (q: BankQuestion) => Promise<BankQuestion[]>;
  deleteQuestion: (id: string) => Promise<BankQuestion[]>;
  // Bulk delete in ONE persist/sync (deleting an import mistake one-by-one
  // would be 60 cloud writes).
  deleteMany: (ids: string[]) => Promise<BankQuestion[]>;
  bulkAddQuestions: (qs: Omit<BankQuestion, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<number>;
  pickApproved: (params: WorksheetParams, count: number) => { used: BankQuestion[]; shortfall: number };
}

function makeBank(KEY: string): BankApi {
  // A large bank auto-routes to IndexedDB via kvStore. Hydrate at startup so the
  // synchronous readers below (and generateFromBank's pickApproved) see it.
  kvHydrate(KEY);

  const loadQuestions = (): BankQuestion[] => {
    const a = kvReadSync<BankQuestion[]>(KEY, []);
    return Array.isArray(a) ? a : [];
  };

  const refreshFromCloud = async (): Promise<BankQuestion[]> => {
    await kvHydrate(KEY);
    try {
      const v = await fetchSetting(KEY);
      if (Array.isArray(v)) { await kvWrite(KEY, v); return v; }
    } catch { /* offline — keep local */ }
    return loadQuestions();
  };

  const persistAll = async (list: BankQuestion[]): Promise<BankQuestion[]> => {
    await kvWrite(KEY, list);
    try { await syncUpsertSetting(KEY, list); } catch { /* offline — saved locally */ }
    return list;
  };

  const saveQuestion = async (q: BankQuestion): Promise<BankQuestion[]> => {
    const list = loadQuestions();
    const stamped = { ...q, updatedAt: new Date().toISOString() };
    const idx = list.findIndex(x => x.id === q.id);
    if (idx >= 0) list[idx] = stamped; else list.unshift(stamped);
    return persistAll(list);
  };

  const deleteQuestion = async (id: string): Promise<BankQuestion[]> =>
    persistAll(loadQuestions().filter(q => q.id !== id));

  const deleteMany = async (ids: string[]): Promise<BankQuestion[]> => {
    const drop = new Set(ids);
    return persistAll(loadQuestions().filter(q => !drop.has(q.id)));
  };

  // Add many AI/imported questions at once, skipping exact duplicates. Returns how
  // many were actually added (callers report qs.length - added as skipped).
  //
  // The batch is collected first and inserted as ONE block, so the questions keep
  // the ORDER they arrived in (an imported exam stays in its original numbering).
  // Unshifting them one-by-one reversed the whole import.
  const bulkAddQuestions = async (qs: Omit<BankQuestion, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> => {
    if (!qs.length) return 0;
    const list = loadQuestions();
    const seen = new Set(list.map(dupKey));
    const now = new Date().toISOString();
    const batch: BankQuestion[] = [];
    for (const q of qs) {
      const key = dupKey(q);
      if (q.prompt && seen.has(key)) continue;
      seen.add(key);
      batch.push({ ...q, id: uuid(), createdAt: now, updatedAt: now });
    }
    if (batch.length) await persistAll([...batch, ...list]);
    return batch.length;
  };

  // Pick up to `count` questions matching the params (grade+subject+type; difficulty
  // and lesson narrow further). Returns the chosen questions + the shortfall.
  const pickApproved = (params: WorksheetParams, count: number): { used: BankQuestion[]; shortfall: number } => {
    const topic = (params.topic || '').trim().toLowerCase();
    const onTopic = (q: BankQuestion): boolean =>
      !topic || [q.prompt, q.lesson, q.objective].some(f => (f || '').toLowerCase().includes(topic));
    const pool = loadQuestions().filter(q =>
      q.grade === params.grade &&
      q.subject === params.subject &&
      q.type === params.type &&
      (!params.difficulty || q.difficulty === params.difficulty) &&
      (!params.lesson || !q.lesson || q.lesson === params.lesson) &&
      onTopic(q)
    );
    const used = shuffle(pool).slice(0, count);
    return { used, shortfall: Math.max(0, count - used.length) };
  };

  return { key: KEY, hydrate: () => kvHydrate(KEY), loadQuestions, refreshFromCloud, saveQuestion, deleteQuestion, deleteMany, bulkAddQuestions, pickApproved };
}

// The default worksheet/exam bank, and a SEPARATE standardized-test bank.
export const questionBank = makeBank('question_bank');
export const standardTestBank = makeBank('standard_test_bank');

// Backward-compatible named exports (all bound to the default bank).
export const hydrateQuestions = questionBank.hydrate;
export const loadQuestions = questionBank.loadQuestions;
export const refreshQuestionsFromCloud = questionBank.refreshFromCloud;
export const saveQuestion = questionBank.saveQuestion;
export const deleteQuestion = questionBank.deleteQuestion;
export const bulkAddQuestions = questionBank.bulkAddQuestions;
export const pickApproved = questionBank.pickApproved;

// Strip a bank question down to a plain WSQuestion for the worksheet renderer.
export const toWSQuestion = (q: BankQuestion): WSQuestion => ({
  prompt: q.prompt, options: q.options, pairs: q.pairs, answer: q.answer,
});
