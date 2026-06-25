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

// --- Lossless compression --------------------------------------------------
// A full year of daily attendance overflowed the browser's ~5 MB localStorage
// quota. The bloat is structural: every record repeats a 36-char student UUID
// per student plus the word "present"/"absent"/… thousands of times. We pack it
// without losing anything: UUIDs are stored ONCE in a dictionary and referenced
// by index, and the state words become single letters. encode()/decode() are
// exact inverses, so every reader still gets the identical record shape.
type AnyRec = { [k: string]: any; studentStates?: Record<string, string> };
const STATE_CODE: Record<string, string> = { present: 'p', late: 'l', permission: 'c', absent: 'a' };
const STATE_NAME: Record<string, string> = { p: 'present', l: 'late', c: 'permission', a: 'absent' };
const REASON = '_reason';

function encode(records: AnyRec[]): string {
  const ids: string[] = [];
  const idIndex = new Map<string, number>();
  const idx = (uuid: string): number => {
    let i = idIndex.get(uuid);
    if (i === undefined) { i = ids.length; ids.push(uuid); idIndex.set(uuid, i); }
    return i;
  };
  const r = records.map(rec => {
    const s: Record<string, string> = {};
    const states = rec.studentStates || {};
    for (const key in states) {
      if (key.endsWith(REASON)) s[idx(key.slice(0, -REASON.length)) + '_r'] = states[key];
      else s[String(idx(key))] = STATE_CODE[states[key]] ?? states[key];
    }
    const out: any = { i: rec.id, d: rec.date, g: rec.grade, p: rec.presentCount, c: rec.permissionCount, a: rec.absentCount, s };
    if (rec.session !== undefined) out.x = rec.session;
    if (rec.lateCount !== undefined) out.l = rec.lateCount;
    return out;
  });
  return JSON.stringify({ _v: 2, ids, r });
}

function decode(payload: { ids: string[]; r: any[] }): AnyRec[] {
  const ids = payload.ids || [];
  return (payload.r || []).map(rec => {
    const states: Record<string, string> = {};
    const s = rec.s || {};
    for (const k in s) {
      if (k.endsWith('_r')) states[ids[+k.slice(0, -2)] + REASON] = s[k];
      else states[ids[+k]] = STATE_NAME[s[k]] ?? s[k];
    }
    const out: AnyRec = {
      id: rec.i, date: rec.d, grade: rec.g,
      presentCount: rec.p, permissionCount: rec.c, absentCount: rec.a,
      studentStates: states,
    };
    if (rec.x !== undefined) out.session = rec.x;
    if (rec.l !== undefined) out.lateCount = rec.l;
    return out;
  });
}

// Read the attendance records, transparently handling both the new compressed
// form and any legacy plain-JSON array already in storage.
export function loadAttendance(): AnyRec[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return []; }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;                       // legacy plain array
    if (parsed && parsed._v === 2) return decode(parsed);           // compressed
    return [];
  } catch { return []; }
}

// Persist daily-attendance records (compressed). If the quota is still hit, drop
// the OLDEST records from the LOCAL cache and retry — Supabase keeps the full
// history and re-hydrates on next load. Never throws. Returns whether it saved
// and how many old local records were evicted to fit.
export function persistAttendance(records: { date?: string; [key: string]: any }[]): { ok: boolean; evicted: number } {
  let list = records as AnyRec[];
  let evicted = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      localStorage.setItem(KEY, encode(list));
      return { ok: true, evicted };
    } catch (e) {
      if (!isQuotaError(e) || list.length <= 1) return { ok: false, evicted };
      const sorted = [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const keep = Math.max(1, Math.floor(sorted.length * 0.75));
      evicted += sorted.length - keep;
      list = sorted.slice(0, keep);
    }
  }
  return { ok: false, evicted };
}
