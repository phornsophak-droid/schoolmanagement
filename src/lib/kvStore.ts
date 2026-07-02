/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Auto-routing local key/value store. Small JSON values stay in localStorage
// (synchronous, instant reads). LARGE values — e.g. lesson/document text pasted
// or extracted from uploaded PDFs/Word — are routed automatically to IndexedDB,
// which has no ~5MB localStorage cap. An in-memory string cache keeps the
// existing SYNCHRONOUS getters working after hydrate() has run.
//
// Values are cached/stored as JSON STRINGS (like localStorage), so every read
// returns a fresh parsed copy that callers can safely mutate.

const THRESHOLD = 512 * 1024;   // ~0.5MB (UTF-16 code units) → route to IndexedDB
const DB_NAME = 'school_kv';
const STORE = 'kv';

// ---- IndexedDB (best-effort; every op degrades gracefully to a no-op) ----
let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function idbGet(key: string): Promise<string | undefined> {
  const d = await openDb(); if (!d) return undefined;
  return new Promise(resolve => {
    try {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as string | undefined);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function idbPut(key: string, val: string): Promise<void> {
  const d = await openDb(); if (!d) return;
  return new Promise(resolve => {
    try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }
    catch { resolve(); }
  });
}
async function idbDelete(key: string): Promise<void> {
  const d = await openDb(); if (!d) return;
  return new Promise(resolve => {
    try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }
    catch { resolve(); }
  });
}

// ---- Cache + API ----
const mem = new Map<string, string>();      // key → JSON string
const hydrated = new Set<string>();

// Synchronous read. Returns the cached value (or the localStorage value if the
// cache is cold, for small/legacy data). Large values held only in IndexedDB
// become available once kvHydrate(key) has resolved.
export function kvReadSync<T>(key: string, fallback: T): T {
  let s = mem.get(key);
  if (s === undefined) {
    try { const ls = localStorage.getItem(key); if (ls !== null) { mem.set(key, ls); s = ls; } } catch { /* ignore */ }
  }
  if (s === undefined) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// Load a key into the in-memory cache from disk (localStorage first, else
// IndexedDB). Call once at startup so synchronous getters see large values too.
export async function kvHydrate(key: string): Promise<void> {
  if (hydrated.has(key)) return;
  try { const ls = localStorage.getItem(key); if (ls !== null) { mem.set(key, ls); hydrated.add(key); return; } } catch { /* ignore */ }
  const idb = await idbGet(key);
  if (idb !== undefined) mem.set(key, idb);
  hydrated.add(key);
}

// Write a value, auto-routing by size: large → IndexedDB, small → localStorage.
// Keeps exactly one copy on disk (removes the other location).
export async function kvWrite(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  mem.set(key, json);
  hydrated.add(key);
  if (json.length > THRESHOLD) {
    await idbPut(key, json);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  try {
    localStorage.setItem(key, json);
    await idbDelete(key);
  } catch {
    // localStorage full/blocked → fall back to IndexedDB.
    await idbPut(key, json);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}
