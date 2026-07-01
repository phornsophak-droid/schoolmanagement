/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Curriculum Manager — the school's editable subject list and, per grade+subject,
// a set of lessons each with learning objectives. Feeds the dropdowns of the
// worksheet generator and the question bank so questions can be tagged to a
// lesson/objective.
//
// Storage mirrors lessons.ts: one JSON object in the school_settings KV
// (cloud-synced, tiny) + a localStorage mirror. Distinct from the source-text
// "Lesson Library" (lessons.ts), which stores pasted lesson TEXT for the AI.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { SUBJECTS } from './worksheets';

export interface CurriculumLesson {
  id: string;
  grade: string;
  subject: string;
  title: string;
  objectives: string[];
  material?: string;   // lesson text (typed or extracted from an uploaded file)
  order?: number;
}

export interface Curriculum {
  subjects: string[];
  lessons: CurriculumLesson[];
}

const KEY = 'curriculum';

const uuid = (): string => ((crypto as any).randomUUID ? crypto.randomUUID() : `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const empty = (): Curriculum => ({ subjects: [], lessons: [] });

export function loadCurriculum(): Curriculum {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Array.isArray(v.subjects) && Array.isArray(v.lessons)) return v;
  } catch { /* ignore */ }
  return empty();
}

function persistLocal(c: Curriculum) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export async function refreshCurriculumFromCloud(): Promise<Curriculum> {
  try {
    const v = await fetchSetting(KEY);
    if (v && Array.isArray(v.subjects) && Array.isArray(v.lessons)) { persistLocal(v); return v; }
  } catch { /* offline — keep local */ }
  return loadCurriculum();
}

async function persist(c: Curriculum): Promise<Curriculum> {
  persistLocal(c);
  try { await syncUpsertSetting(KEY, c); } catch { /* offline — saved locally */ }
  return c;
}

// Effective subject list: custom subjects if any were defined, else the built-in
// SUBJECTS. Callers use this everywhere a subject dropdown appears.
export function curriculumSubjects(): string[] {
  const c = loadCurriculum();
  return c.subjects.length ? c.subjects : SUBJECTS;
}

export function lessonsFor(grade: string, subject: string): CurriculumLesson[] {
  return loadCurriculum().lessons
    .filter(l => l.grade === grade && l.subject === subject)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
}

// The lesson text for a specific lesson title (used to ground AI generation on
// the curriculum material when the teacher picks that lesson).
export function lessonMaterial(grade: string, subject: string, title: string): string {
  const l = loadCurriculum().lessons.find(x => x.grade === grade && x.subject === subject && x.title === title);
  return l?.material || '';
}

export async function saveSubject(name: string): Promise<Curriculum> {
  const n = name.trim();
  if (!n) return loadCurriculum();
  const c = loadCurriculum();
  // Start from the built-in list the first time so removing one from the visible
  // set actually persists a custom list.
  const base = c.subjects.length ? c.subjects : [...SUBJECTS];
  if (!base.includes(n)) base.push(n);
  return persist({ ...c, subjects: base });
}

export async function removeSubject(name: string): Promise<Curriculum> {
  const c = loadCurriculum();
  const base = c.subjects.length ? c.subjects : [...SUBJECTS];
  return persist({ ...c, subjects: base.filter(s => s !== name) });
}

export async function saveLesson(lesson: CurriculumLesson): Promise<Curriculum> {
  const c = loadCurriculum();
  const clean: CurriculumLesson = {
    ...lesson,
    id: lesson.id || uuid(),
    title: lesson.title.trim(),
    objectives: lesson.objectives.map(o => o.trim()).filter(Boolean),
    material: (lesson.material || '').trim() || undefined,
  };
  const idx = c.lessons.findIndex(l => l.id === clean.id);
  if (idx >= 0) c.lessons[idx] = clean; else c.lessons.push(clean);
  return persist({ ...c, lessons: [...c.lessons] });
}

export async function removeLesson(id: string): Promise<Curriculum> {
  const c = loadCurriculum();
  return persist({ ...c, lessons: c.lessons.filter(l => l.id !== id) });
}
