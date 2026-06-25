/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Attendance can outgrow the ~5 MB localStorage cap (a full year × many classes ×
// 2000+ students). It now lives in IndexedDB instead — a built-in, free browser
// store that holds hundreds of MB. A synchronous in-memory cache keeps the
// existing sync read API (loadAttendance) working; initAttendanceStore() loads it
// from IndexedDB at startup (migrating any old localStorage data the first time).

type AnyRec = { [k: string]: any; studentStates?: Record<string, string> };
const LS_KEY = 'school_daily_attendance';
const DB_NAME = 'school_app';
const DB_STORE = 'cache';
const IDB_KEY = 'attendance';

// --- Legacy localStorage codec (only for the one-time migration / fallback) ----
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
    const out: AnyRec = { id: rec.i, date: rec.d, grade: rec.g, presentCount: rec.p, permissionCount: rec.c, absentCount: rec.a, studentStates: states };
    if (rec.x !== undefined) out.session = rec.x;
    if (rec.l !== undefined) out.lateCount = rec.l;
    return out;
  });
}

function readLegacyLocalStorage(): AnyRec[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { return []; }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;            // legacy plain array
    if (parsed && parsed._v === 2) return decode(parsed); // compressed
    return [];
  } catch { return []; }
}

// --- IndexedDB (built-in, no dependency) ---------------------------------------
let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(db => new Promise<T | undefined>((resolve, reject) => {
    const r = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  }));
}
function idbSet(key: string, value: unknown): Promise<void> {
  return openDB().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// --- In-memory cache + public API ----------------------------------------------
// Seed synchronously from any existing localStorage data so the very first reads
// (before IndexedDB has loaded) still work; init() then takes over from IndexedDB.
let cache: AnyRec[] = readLegacyLocalStorage();
let usingIdb = false;

// Load attendance from IndexedDB into the cache at startup. On first run it
// migrates the old localStorage copy into IndexedDB and frees the localStorage
// key. Falls back to localStorage if IndexedDB is unavailable (e.g. private mode).
export async function initAttendanceStore(): Promise<void> {
  try {
    const fromIdb = await idbGet<AnyRec[]>(IDB_KEY);
    if (Array.isArray(fromIdb)) {
      cache = fromIdb;                       // IndexedDB is authoritative
    } else if (cache.length > 0) {
      await idbSet(IDB_KEY, cache);          // one-time migration of existing data
    }
    usingIdb = true;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } // reclaim the ~MBs
    console.info(`Attendance store ready (IndexedDB): ${cache.length} records`);
  } catch (e) {
    console.warn('IndexedDB unavailable — attendance stays in localStorage', e);
    // cache already holds the localStorage data; persist() will keep using it.
  }
}

export function loadAttendance(): AnyRec[] { return cache; }

// Wipe the attendance cache (used by Factory Reset, which must clear IndexedDB too).
export async function clearAttendanceStore(): Promise<void> {
  cache = [];
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  try { await idbSet(IDB_KEY, []); } catch { /* ignore */ }
}

// Save attendance. With IndexedDB there is effectively no quota wall, so this
// just updates the cache and write-throughs to IndexedDB. If IndexedDB is
// unavailable it falls back to the compressed localStorage path. Never throws.
export function persistAttendance(records: { date?: string; [key: string]: any }[]): { ok: boolean; evicted: number } {
  cache = records as AnyRec[];
  if (usingIdb) {
    idbSet(IDB_KEY, cache).catch(e => {
      console.warn('IndexedDB attendance write failed; falling back to localStorage', e);
      writeLocalStorageFallback(cache);
    });
    return { ok: true, evicted: 0 };
  }
  return writeLocalStorageFallback(cache);
}

// Compressed localStorage fallback (used only when IndexedDB is unavailable):
// drop the oldest records if the quota is hit, never throw.
function writeLocalStorageFallback(records: AnyRec[]): { ok: boolean; evicted: number } {
  let list = records;
  let evicted = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    try { localStorage.setItem(LS_KEY, encode(list)); return { ok: true, evicted }; }
    catch (e) {
      const err = e as { name?: string; message?: string };
      const quota = err && (err.name === 'QuotaExceededError' || /quota|exceeded/i.test(err.message || ''));
      if (!quota || list.length <= 1) return { ok: false, evicted };
      const sorted = [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const keep = Math.max(1, Math.floor(sorted.length * 0.75));
      evicted += sorted.length - keep;
      list = sorted.slice(0, keep);
    }
  }
  return { ok: false, evicted };
}
