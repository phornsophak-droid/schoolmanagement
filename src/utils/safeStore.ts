/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Write JSON to localStorage without ever throwing. A quota error (or private-mode
// restriction) returns false instead of crashing the caller — the in-memory state
// and the Supabase copy remain the source of truth, so nothing is lost in-session
// and the data re-hydrates from the cloud on next load.
export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`localStorage write failed for "${key}" (quota or restricted)`, e);
    return false;
  }
}
