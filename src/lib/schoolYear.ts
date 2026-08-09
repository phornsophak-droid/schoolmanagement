/**
 * Single source of truth for the current SCHOOL YEAR.
 *
 * The year "២០២៥-២០២៦" used to be hardcoded in ~20 places (certificates, report
 * cards, gradebook, attendance registers, worksheets, Parent Portal…), so the app
 * could never move on to 2026-2027 or beyond. Everything now reads it from here.
 *
 * The value auto-derives from the calendar (Cambodia's school year runs Sep→Aug, so
 * Sep–Dec belong to the START year and Jan–Aug to the END year) and the principal
 * can OVERRIDE it — e.g. to switch to 2026-2027 a few weeks early — via a setting
 * stored in school_settings (cloud-synced, quota-free memory cache).
 */
import { getCachedSetting, setCachedSetting } from './settingsCache';
import { syncUpsertSetting } from './supabase';

// Stored value = the START calendar year as a plain number string, e.g. "2026" for
// the 2026-2027 school year. Empty/unset → auto-derive from today.
export const SCHOOL_YEAR_KEY = 'school_academic_year_start';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// Start calendar year for a date: on/after September it's this year, else last year.
export function autoStartYear(d: Date = new Date()): number {
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
}

// The active school year's START calendar year (override if set, else auto).
export function getStartYear(): number {
  const raw = getCachedSetting(SCHOOL_YEAR_KEY) || (() => { try { return localStorage.getItem(SCHOOL_YEAR_KEY) || ''; } catch { return ''; } })();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 2000 && n < 3000 ? n : autoStartYear();
}
export function getEndYear(): number { return getStartYear() + 1; }

// Khmer label, no spaces: "២០២៦-២០២៧".
export function getAcademicYear(): string {
  const s = getStartYear();
  return `${toKh(s)}-${toKh(s + 1)}`;
}
// Latin label: "2026-2027".
export function getAcademicYearLatin(): string {
  const s = getStartYear();
  return `${s}-${s + 1}`;
}

// The calendar year a given month (0=Jan … 11=Dec) falls in for the active school
// year — Sep–Dec → start year, Jan–Aug → end year. Used on signature/issue dates.
export function academicYearNumForMonth(monthIndex: number): number {
  const s = getStartYear();
  return monthIndex >= 8 ? s : s + 1;
}
export function academicYearKhForMonth(monthIndex: number): string {
  return toKh(academicYearNumForMonth(monthIndex));
}

// Principal override. Pass the START year (2026 → "2026-2027"); pass null to clear
// the override and fall back to auto-derivation.
export async function setStartYear(year: number | null): Promise<void> {
  const v = year == null ? '' : String(year);
  setCachedSetting(SCHOOL_YEAR_KEY, v);
  try { if (v) localStorage.setItem(SCHOOL_YEAR_KEY, v); else localStorage.removeItem(SCHOOL_YEAR_KEY); } catch { /* ignore */ }
  try { await syncUpsertSetting(SCHOOL_YEAR_KEY, v); } catch { /* offline — kept locally + memory */ }
}
