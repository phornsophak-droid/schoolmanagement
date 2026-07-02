/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Lesson Library — small TEXT snippets of lesson/worksheet content that teachers
// save once and reuse as the AI worksheet generator's source material. Stored as a
// single JSON array in the generic school_settings KV (no new table, cloud-synced),
// and mirrored to localStorage for instant reads. Text is tiny → negligible egress.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

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

// Lesson source texts can be whole documents → large. kvStore auto-routes big
// blobs to IndexedDB (localStorage stays for small sets). Hydrate the cache at
// startup so synchronous reads see IndexedDB-backed data.
kvHydrate(KEY);

export function loadLessons(): LessonSource[] {
  const a = kvReadSync<LessonSource[]>(KEY, []);
  return Array.isArray(a) ? a : [];
}

// Pull the shared library from the cloud so every device/teacher sees the same set.
export async function refreshLessonsFromCloud(): Promise<LessonSource[]> {
  await kvHydrate(KEY);
  try {
    const v = await fetchSetting(KEY);
    if (Array.isArray(v)) { await kvWrite(KEY, v); return v; }
  } catch { /* offline — keep local */ }
  return loadLessons();
}

// Insert/replace by id, persist locally (auto-routed), then mirror to the cloud
// (fire-and-forget safe — never throws to the UI).
export async function saveLesson(lesson: LessonSource): Promise<LessonSource[]> {
  const list = loadLessons();
  const idx = list.findIndex(l => l.id === lesson.id);
  if (idx >= 0) list[idx] = lesson; else list.unshift(lesson);
  await kvWrite(KEY, list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — saved locally */ }
  return list;
}

export async function deleteLesson(id: string): Promise<LessonSource[]> {
  const list = loadLessons().filter(l => l.id !== id);
  await kvWrite(KEY, list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — removed locally */ }
  return list;
}
