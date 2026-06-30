/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Lesson Library — small TEXT snippets of lesson/worksheet content that teachers
// save once and reuse as the AI worksheet generator's source material. Stored as a
// single JSON array in the generic school_settings KV (no new table, cloud-synced),
// and mirrored to localStorage for instant reads. Text is tiny → negligible egress.

import { syncUpsertSetting, fetchSetting } from './supabase';

export interface LessonSource {
  id: string;
  title: string;
  subject?: string;
  grade?: string;
  content: string;
  createdBy?: string;
  createdAt: string;
}

const KEY = 'lesson_sources';

export function loadLessons(): LessonSource[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

function persistLocal(list: LessonSource[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// Pull the shared library from the cloud so every device/teacher sees the same set.
export async function refreshLessonsFromCloud(): Promise<LessonSource[]> {
  try {
    const v = await fetchSetting(KEY);
    if (Array.isArray(v)) { persistLocal(v); return v; }
  } catch { /* offline — keep local */ }
  return loadLessons();
}

// Insert/replace by id, persist locally, then mirror to the cloud (fire-and-forget
// safe — never throws to the UI).
export async function saveLesson(lesson: LessonSource): Promise<LessonSource[]> {
  const list = loadLessons();
  const idx = list.findIndex(l => l.id === lesson.id);
  if (idx >= 0) list[idx] = lesson; else list.unshift(lesson);
  persistLocal(list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — saved locally */ }
  return list;
}

export async function deleteLesson(id: string): Promise<LessonSource[]> {
  const list = loadLessons().filter(l => l.id !== id);
  persistLocal(list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — removed locally */ }
  return list;
}
