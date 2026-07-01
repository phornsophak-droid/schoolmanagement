/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// In-memory mirror of school_settings, populated from the cloud sync (App.tsx).
// Signature images are large base64 strings; on a device whose localStorage is
// near its ~5 MB quota (lots of cached students/attendance), caching them there
// fails silently and they "disappear" on reload — the save succeeds to the cloud
// (green) but the local copy never sticks. This memory cache is quota-free, so a
// signature displays reliably as long as the cloud sync ran. localStorage stays a
// best-effort offline fallback.

type Listener = () => void;

const settings = new Map<string, string>();
const listeners = new Set<Listener>();

// Merge a batch of settings (e.g. the whole `settings` object from a cloud sync).
// Only string values are cached (signatures / scalar settings), not JSON blobs.
export function mergeCachedSettings(obj: Record<string, any> | undefined | null): void {
  if (!obj) return;
  let changed = false;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v !== 'string') continue;
    if (settings.get(k) !== v) { settings.set(k, v); changed = true; }
  }
  if (changed) listeners.forEach(l => l());
}

export function setCachedSetting(key: string, value: string): void {
  if (settings.get(key) === value) return;
  settings.set(key, value);
  listeners.forEach(l => l());
}

export function getCachedSetting(key: string): string | undefined {
  return settings.get(key);
}

// All cached keys with the given prefix — for subject-based signature resolution
// across historical key forms (canonical "គំនូរ" vs raw grade "ថ្នាក់គំនូរ").
export function cachedKeysWithPrefix(prefix: string): string[] {
  const out: string[] = [];
  settings.forEach((_v, k) => { if (k.startsWith(prefix)) out.push(k); });
  return out;
}

export function subscribeSettings(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
