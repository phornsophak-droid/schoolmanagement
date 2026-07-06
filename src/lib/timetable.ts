/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Weekly class timetable (កាលវិភាគសិក្សា). One per class, stored in school_settings
// as JSON (key school_timetable::<grade>) — reuses the existing settings sync, so
// it appears on every device and in the Parent Portal. Editable by the principal
// (any class) and the class's own teacher.

import { fetchSetting, syncUpsertSetting } from './supabase';

export interface Timetable {
  days: string[];      // column headers (ចន្ទ … សៅរ៍)
  periods: string[];   // row labels (time / period name)
  grid: string[][];    // grid[periodIndex][dayIndex] = subject text
}

export const DEFAULT_DAYS = ['ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const DEFAULT_PERIODS = ['ម៉ោងទី១', 'ម៉ោងទី២', 'ម៉ោងទី៣', 'ម៉ោងទី៤', 'ម៉ោងទី៥'];

export const timetableKey = (grade: string) => `school_timetable::${grade}`;

export function emptyTimetable(): Timetable {
  const days = [...DEFAULT_DAYS];
  const periods = [...DEFAULT_PERIODS];
  return { days, periods, grid: periods.map(() => days.map(() => '')) };
}

// Coerce stored/partial data into a valid, rectangular Timetable.
export function normalizeTimetable(raw: any): Timetable {
  if (!raw || typeof raw !== 'object') return emptyTimetable();
  const days = Array.isArray(raw.days) && raw.days.length ? raw.days.map(String) : [...DEFAULT_DAYS];
  const periods = Array.isArray(raw.periods) && raw.periods.length ? raw.periods.map(String) : [...DEFAULT_PERIODS];
  const grid = periods.map((_: string, p: number) => days.map((_: string, d: number) => String(raw.grid?.[p]?.[d] ?? '')));
  return { days, periods, grid };
}

export async function loadTimetable(grade: string): Promise<Timetable> {
  try { return normalizeTimetable(await fetchSetting(timetableKey(grade))); }
  catch { return emptyTimetable(); }
}

export async function saveTimetable(grade: string, tt: Timetable): Promise<void> {
  await syncUpsertSetting(timetableKey(grade), tt);
}

// True when a timetable has no subjects filled in at all.
export const isTimetableEmpty = (tt: Timetable): boolean =>
  tt.grid.every(row => row.every(c => !c || !c.trim()));

// Plain-text render (grouped by day) for Telegram. Empty days are skipped.
export function timetableToText(grade: string, tt: Timetable): string {
  const out = [`🗓️ កាលវិភាគសិក្សា — ${grade}`];
  tt.days.forEach((day, di) => {
    const rows = tt.periods
      .map((p, pi) => { const s = tt.grid[pi]?.[di]; return s && s.trim() ? `  ${p}: ${s.trim()}` : null; })
      .filter(Boolean) as string[];
    if (rows.length) out.push('', `📌 ${day}`, ...rows);
  });
  return out.join('\n');
}
