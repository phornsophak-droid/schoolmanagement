/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student scores can also outgrow the ~5 MB localStorage cap at 2000+ students.
// Like attendance, they now live in IndexedDB (free, hundreds of MB) with a
// synchronous in-memory cache so the existing sync reads keep working.
// initScoresStore() loads it at startup, migrating any old localStorage copy once.

type Rec = any;
const LS_KEY = 'school_student_scores_v2';
const DB_NAME = 'school_app';
const DB_STORE = 'cache';
const IDB_KEY = 'scores';

// --- IndexedDB (built-in; shares the same DB/store as the attendance cache) ----
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

// Seed synchronously from any existing localStorage copy so the first reads work
// before IndexedDB has loaded.
let cache: Rec[] = (() => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } })();
let usingIdb = false;

export async function initScoresStore(): Promise<void> {
  try {
    const fromIdb = await idbGet<Rec[]>(IDB_KEY);
    if (Array.isArray(fromIdb)) cache = fromIdb;          // IndexedDB is authoritative
    else if (cache.length > 0) await idbSet(IDB_KEY, cache); // one-time migration
    usingIdb = true;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } // reclaim the ~MBs
    console.info(`Scores store ready (IndexedDB): ${cache.length} records`);
  } catch (e) {
    console.warn('IndexedDB unavailable — scores stay in localStorage', e);
  }
}

export function loadScores(): Rec[] { return cache; }

// Save scores. With IndexedDB there's no practical quota wall. Never throws;
// returns false only if both IndexedDB and the localStorage fallback fail.
export function persistScores(list: Rec[]): boolean {
  cache = list;
  if (usingIdb) {
    idbSet(IDB_KEY, cache).catch(e => {
      console.warn('IndexedDB scores write failed; falling back to localStorage', e);
      try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); } catch { /* in memory + cloud */ }
    });
    return true;
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); return true; }
  catch (e) { console.warn(`localStorage scores write failed (quota?)`, e); return false; }
}

// Wipe the scores cache (used by Factory Reset, which must clear IndexedDB too).
export async function clearScoresStore(): Promise<void> {
  cache = [];
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  try { await idbSet(IDB_KEY, []); } catch { /* ignore */ }
}
