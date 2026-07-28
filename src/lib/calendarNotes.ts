/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Per-day notes for the Khmer calendar (កំណត់សំគាល់) — the school marks exam days,
// meetings, events… keyed by date (YYYY-MM-DD). Stored as one JSON object in the
// generic school_settings KV (cloud-synced) mirrored to localStorage for instant
// reads — the same storage pattern as [[project-announcements]] announcements.ts.
// Shared across devices, so every staff member sees the same marks.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

export type CalNotes = Record<string, string>; // { 'YYYY-MM-DD': note }

const KEY = 'school_calendar_notes';

kvHydrate(KEY);

// "2026-07-27" for a Date, in local time (calendars are local, not UTC).
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function loadCalNotes(): CalNotes {
  const v = kvReadSync<CalNotes>(KEY, {});
  return v && typeof v === 'object' ? v : {};
}

// Pull the shared notes from the cloud so every device matches.
export async function refreshCalNotesFromCloud(): Promise<CalNotes> {
  await kvHydrate(KEY);
  try {
    const v = await fetchSetting(KEY);
    if (v && typeof v === 'object') { await kvWrite(KEY, v); return v as CalNotes; }
  } catch { /* offline — keep local */ }
  return loadCalNotes();
}

// Set (or clear, when text is blank) the note for one day; persist + mirror.
export async function setCalNote(key: string, text: string): Promise<CalNotes> {
  const notes = { ...loadCalNotes() };
  const t = text.trim();
  if (t) notes[key] = t; else delete notes[key];
  await kvWrite(KEY, notes);
  try { await syncUpsertSetting(KEY, notes); } catch { /* offline — saved locally */ }
  return notes;
}
