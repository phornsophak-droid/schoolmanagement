/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Client for the secure Parent Portal proxy (api/parent-portal.ts, Phase 2).
// Student data is read on the SERVER with the service-role key and only the one
// child ever reaches the browser — the anon key no longer reads whole classes.
//
// Every function returns `null` when the endpoint is UNREACHABLE (running the
// dev server with no /api, or before the function is deployed) so callers can
// fall back to the legacy anon path during the transition. A reachable endpoint
// that answers `{ ok: false, ... }` (wrong password, expired token) returns that
// object — callers must treat a non-null result as authoritative and NOT fall back.

export interface ApiChild { name: string; grade: string; studentId?: string }
export interface ApiLoginResult { ok: boolean; child?: ApiChild; firstTime?: boolean; token?: string; error?: string; matches?: ApiChild[] }
export interface ApiRecordsResult { ok: boolean; records?: any[]; error?: string }

async function post(payload: Record<string, any>): Promise<any | null> {
  try {
    const res = await fetch('/api/parent-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // 404 (not deployed), 405, 500 (no service key) → treat as "no endpoint" so
    // the caller falls back to the legacy anon path.
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // network/offline → fall back
  }
}

export async function apiLogin(name: string, password: string): Promise<ApiLoginResult | null> {
  return post({ action: 'login', name, password });
}

export async function apiRecords(token: string): Promise<ApiRecordsResult | null> {
  if (!token) return null; // no token (legacy session) → fall back
  return post({ action: 'records', token });
}

export async function apiChangePassword(token: string, newPassword: string): Promise<{ ok: boolean; error?: string } | null> {
  if (!token) return null;
  return post({ action: 'changePassword', token, newPassword });
}
