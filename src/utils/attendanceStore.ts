/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const KEY = 'school_daily_attendance';

const isQuotaError = (e: unknown): boolean => {
  const err = e as { name?: string; code?: number; message?: string } | null;
  return !!err && (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 || err.code === 1014 ||
    /quota|exceeded/i.test(err.message || '')
  );
};

// Persist daily-attendance records to localStorage. A full school year of marks
// for many classes can exceed the browser's ~5 MB quota; when that happens a
// plain setItem THROWS, which previously aborted the save (and skipped the cloud
// sync) → lost data. Here we instead drop the OLDEST records from the LOCAL cache
// and retry — Supabase keeps the full history and re-hydrates it on next load.
// Returns whether it saved and how many old local records were evicted to fit.
export function persistAttendance(records: { date?: string }[]): { ok: boolean; evicted: number } {
  let list = records;
  let evicted = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return { ok: true, evicted };
    } catch (e) {
      if (!isQuotaError(e) || list.length <= 1) return { ok: false, evicted };
      // Keep the newest 75% (records carry an ISO `date`), drop the oldest.
      const sorted = [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const keep = Math.max(1, Math.floor(sorted.length * 0.75));
      evicted += sorted.length - keep;
      list = sorted.slice(0, keep);
    }
  }
  return { ok: false, evicted };
}
