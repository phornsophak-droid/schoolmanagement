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
  type: WorksheetType;
  difficulty: Difficulty;
  status?: 'draft' | 'approved'; // kept for backward compatibility with old data, but ignored
  source?: 'ai' | 'manual';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

const uuid = (): string => ((crypto as any).randomUUID ? crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

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

  // Add many AI/imported questions at once. De-dupes on identical prompt within the
  // same grade+subject+type. Returns how many were actually added.
  const bulkAddQuestions = async (qs: Omit<BankQuestion, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<number> => {
    if (!qs.length) return 0;
    const list = loadQuestions();
    const seen = new Set(list.map(q => `${q.grade}|${q.subject}|${q.type}|${(q.prompt || '').trim()}`));
    const now = new Date().toISOString();
    let added = 0;
    for (const q of qs) {
      const key = `${q.grade}|${q.subject}|${q.type}|${(q.prompt || '').trim()}`;
      if (q.prompt && seen.has(key)) continue;
      seen.add(key);
      list.unshift({ ...q, id: uuid(), createdAt: now, updatedAt: now });
      added++;
    }
    if (added) await persistAll(list);
    return added;
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

  return { key: KEY, hydrate: () => kvHydrate(KEY), loadQuestions, refreshFromCloud, saveQuestion, deleteQuestion, bulkAddQuestions, pickApproved };
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
