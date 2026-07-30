/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Parent Portal login. Two-step model requested by the school:
//   • First login  = a SHARED passcode (set by the principal) + the child's name.
//   • After that   = the child's own personal password (the parent may change it).
// A parent only ever sees their OWN child (the login resolves which child, and the
// portal is scoped to that one).
//
// Storage mirrors [[project-announcements]] / gameScores: the shared passcode and
// the per-child accounts live in the school_settings KV (cloud-synced) mirrored to
// localStorage. The check is client-side (like the app's existing PIN login) — it
// gates casual access, not a hardened auth system (no real backend auth here).

import { getSupabaseClient, fetchSetting, syncUpsertSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

const PASS_KEY = 'parent_portal_passcode'; // shared code (string)
const ACCT_KEY = 'parent_portal_accounts'; // { [childKey]: ParentAccount }
const SESSION_KEY = 'parent_portal_session'; // localStorage, the logged-in child

// Normalize a Khmer name for comparison: drop zero-width/bidi marks and the
// interchangeable colon-like signs (ៈ ៖ : ：), collapse spaces, lowercase.
export const normParentName = (s: string) => (s || '')
  .replace(/[​‌‍‎‏⁠﻿]/g, '')
  .replace(/[ៈ៖:：]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

export interface ParentAccount { name: string; grade: string; studentId?: string; password: string; updatedAt: number; }
export type ParentAccounts = Record<string, ParentAccount>;
export interface ChildRow { name: string; grade: string; studentId?: string; }
export interface ParentSession { name: string; grade: string; studentId?: string }

// One account per child: keyed by studentId when present (survives name edits),
// otherwise by the normalized name.
export const childKey = (name: string, _grade: string, studentId?: string) =>
  studentId && studentId.trim() ? `id:${studentId.trim()}` : `nm:${normParentName(name)}`;

kvHydrate(PASS_KEY);
kvHydrate(ACCT_KEY);

// ── shared passcode ────────────────────────────────────────────────────────
export function loadPasscode(): string { return kvReadSync<string>(PASS_KEY, '') || ''; }
export async function getPasscode(): Promise<string> {
  await kvHydrate(PASS_KEY);
  try { const v = await fetchSetting(PASS_KEY); if (typeof v === 'string') { await kvWrite(PASS_KEY, v); return v; } } catch { /* offline */ }
  return loadPasscode();
}
export async function setPasscode(code: string): Promise<void> {
  const c = (code || '').trim();
  await kvWrite(PASS_KEY, c);
  try { await syncUpsertSetting(PASS_KEY, c); } catch { /* offline — saved locally */ }
}

// ── per-child accounts ───────────────────────────────────────────────────────
export function loadAccounts(): ParentAccounts { const v = kvReadSync<ParentAccounts>(ACCT_KEY, {}); return v && typeof v === 'object' ? v : {}; }
export async function refreshAccounts(): Promise<ParentAccounts> {
  await kvHydrate(ACCT_KEY);
  try { const v = await fetchSetting(ACCT_KEY); if (v && typeof v === 'object') { await kvWrite(ACCT_KEY, v); return v as ParentAccounts; } } catch { /* offline */ }
  return loadAccounts();
}
export async function saveAccount(acct: ParentAccount): Promise<ParentAccounts> {
  let accts = loadAccounts();
  try { const v = await fetchSetting(ACCT_KEY); if (v && typeof v === 'object') accts = v as ParentAccounts; } catch { /* offline */ }
  const key = childKey(acct.name, acct.grade, acct.studentId);
  accts = { ...accts, [key]: { ...acct, updatedAt: Date.now() } };
  await kvWrite(ACCT_KEY, accts);
  try { await syncUpsertSetting(ACCT_KEY, accts); } catch { /* offline — saved locally */ }
  return accts;
}
// Principal reset: clear a child's personal password so their next login uses the
// shared passcode again.
export async function resetAccount(key: string): Promise<ParentAccounts> {
  let accts = loadAccounts();
  try { const v = await fetchSetting(ACCT_KEY); if (v && typeof v === 'object') accts = v as ParentAccounts; } catch { /* offline */ }
  const next = { ...accts }; delete next[key];
  await kvWrite(ACCT_KEY, next);
  try { await syncUpsertSetting(ACCT_KEY, next); } catch { /* offline */ }
  return next;
}

// ── child lookup (anchored on the general class, like the Telegram bot) ──────
const EXTRA = ['GRADE', 'គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtra = (g: string) => EXTRA.some(k => (g || '').includes(k));

export async function findChild(nameTyped: string): Promise<ChildRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const q = normParentName(nameTyped);
  if (!q) return [];
  const tokens = q.split(' ').filter(t => t.length >= 2);
  const probe = ([...tokens].sort((a, b) => b.length - a.length)[0] || q).slice(0, 2);
  const { data } = await supabase.from('student_scores').select('name, grade, extra_data').ilike('name', `%${probe}%`).limit(800);
  const bare = (s: string) => normParentName(s).replace(/\s/g, '');
  const nq = bare(q);
  const isSub = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };
  const seen = new Map<string, ChildRow>();
  for (const r of (data || []) as any[]) {
    const full = normParentName(r.name);
    const nn = bare(r.name);
    const ok = full === q || full.includes(q) || (tokens.length > 0 && tokens.every(t => full.includes(t))) || (nn.length >= 3 && (isSub(nq, nn) || isSub(nn, nq)));
    if (!ok) continue;
    const k = `${r.name}||${r.grade}`;
    if (!seen.has(k)) seen.set(k, { name: r.name, grade: r.grade, studentId: r.extra_data?.studentId });
  }
  return [...seen.values()];
}

// Pick the single GENERAL-class child (the anchor). Several distinct general-class
// names → ambiguous, let the parent be more specific.
export function resolveGeneral(rows: ChildRow[]): { child?: ChildRow; ambiguous?: ChildRow[] } {
  const generals = rows.filter(r => !isExtra(r.grade));
  const names = [...new Set(generals.map(r => normParentName(r.name)))];
  if (names.length > 1) return { ambiguous: generals };
  if (generals.length >= 1) return { child: generals[0] };
  if (rows.length === 1) return { child: rows[0] };
  if (rows.length > 1) return { ambiguous: rows };
  return {};
}

// ── login ────────────────────────────────────────────────────────────────────
export interface LoginResult { ok: boolean; child?: ChildRow; firstTime?: boolean; error?: 'noName' | 'ambiguous' | 'wrongPass' | 'noPasscode'; matches?: ChildRow[]; }
export async function parentLogin(nameTyped: string, password: string): Promise<LoginResult> {
  const rows = await findChild(nameTyped);
  const { child, ambiguous } = resolveGeneral(rows);
  if (ambiguous) return { ok: false, error: 'ambiguous', matches: ambiguous };
  if (!child) return { ok: false, error: 'noName' };

  const accts = await refreshAccounts();
  const acct = accts[childKey(child.name, child.grade, child.studentId)];
  if (acct) {
    return (password || '') === acct.password ? { ok: true, child } : { ok: false, error: 'wrongPass' };
  }
  // First login → must match the shared passcode.
  const shared = await getPasscode();
  if (!shared) return { ok: false, error: 'noPasscode' };
  if ((password || '') === shared) {
    await saveAccount({ name: child.name, grade: child.grade, studentId: child.studentId, password: shared, updatedAt: Date.now() });
    return { ok: true, child, firstTime: true };
  }
  return { ok: false, error: 'wrongPass' };
}

export async function changeParentPassword(child: ChildRow, newPass: string): Promise<void> {
  await saveAccount({ name: child.name, grade: child.grade, studentId: child.studentId, password: (newPass || '').trim(), updatedAt: Date.now() });
}

// ── session ──────────────────────────────────────────────────────────────────
export function loadSession(): ParentSession | null { try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
export function saveSession(s: ParentSession) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
export function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
