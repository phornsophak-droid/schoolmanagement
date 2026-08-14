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

// Drop a trailing "(subject)" tag that after-hours rosters append to the name.
export const stripSubjectTag = (n: string) => (n || '').replace(/\s*\([^)]*\)\s*$/, '');

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
export function loadPasscode(): string { return kvReadSync<string>(PASS_KEY, 'ccc2026') || 'ccc2026'; }
export async function getPasscode(): Promise<string> {
  await kvHydrate(PASS_KEY);
  try { const v = await fetchSetting(PASS_KEY); if (typeof v === 'string' && v.trim() !== '') { await kvWrite(PASS_KEY, v); return v; } } catch { /* offline */ }
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
  const bare = (s: string) => normParentName(s).replace(/\s/g, '');
  const nq = bare(q);
  const isSub = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };
  const seen = new Map<string, ChildRow>();
  const put = (r: any) => { const k = `${r.name}||${r.grade}`; if (!seen.has(k)) seen.set(k, { name: r.name, grade: r.grade, studentId: r.extra_data?.studentId }); };

  // 1. Narrow AND-token query first — requires every word, so the result is small
  //    and never truncated by the row limit (unlike a 2-letter probe).
  if (tokens.length) {
    let query = supabase.from('student_scores').select('name, grade, extra_data');
    for (const t of tokens) query = query.ilike('name', `%${t}%`);
    const { data } = await query.limit(500);
    for (const r of (data || []) as any[]) {
      const full = normParentName(r.name);
      if (full === q || full.includes(q) || tokens.every(t => full.includes(t))) put(r);
    }
  }
  // 2. Subsequence fallback (spelling drift, missing/extra spaces)
  if (seen.size === 0 && nq.length > 0) {
    // Interleave '%' between the first 4 characters of the space-stripped query.
    // e.g. "សុវណ្ណ" -> "%ស%ុ%វ%ណ%". Matches DB "សុវណ្ណ", "សុ វណ", etc.
    const probeChars = nq.slice(0, 4).split('');
    const probe = '%' + probeChars.join('%') + '%';
    
    const { data } = await supabase.from('student_scores')
      .select('name, grade, extra_data')
      .ilike('name', probe)
      .limit(2000);
      
    for (const r of (data || []) as any[]) {
      const nn = bare(r.name);
      if (nn.length >= 3 && (isSub(nq, nn) || isSub(nn, nq))) put(r);
    }
  }
  return [...seen.values()];
}

// Every class a KNOWN child studies (used after login). Matches by studentId AND by
// name — but the NAME query requires EVERY word of the name (AND ilike), so the
// result set stays small. This avoids the earlier intermittent bug where a broad
// 2-letter probe + row limit (no ORDER BY) sometimes truncated a class (e.g. GRADE)
// out of the results, making it flicker in and out on refresh. The caller keeps only
// ACTIVE classes, which drops orphaned rows from deleted classes.
export async function findChildClasses(sess: { name: string; studentId?: string }): Promise<ChildRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const seen = new Map<string, ChildRow>();
  const put = (r: any) => { const k = `${r.grade}||${String(r.name || '').trim()}`; if (!seen.has(k)) seen.set(k, { name: r.name, grade: r.grade, studentId: r.extra_data?.studentId }); };
  const targetBase = normParentName(stripSubjectTag(sess.name));
  const tokens = targetBase.split(' ').filter(t => t.length >= 2);
  const sid = (sess.studentId || '').trim();

  // 1. Same អត្តលេខ (reliable across classes when present).
  if (sid) {
    try {
      const { data } = await supabase.from('student_scores').select('name, grade, extra_data').eq('extra_data->>studentId', sid).limit(500);
      (data || []).forEach(put);
    } catch { /* offline */ }
  }
  // 2. By name — TOLERANT (exact base, contains, all-tokens, or subsequence so a
  //    small spelling drift across rosters still joins).
  if (tokens.length || targetBase) {
    try {
      const bare = (s: string) => normParentName(stripSubjectTag(s)).replace(/\s/g, '');
      const nq = bare(sess.name);
      const probeChars = nq.slice(0, 4).split('');
      const probe = '%' + probeChars.join('%') + '%';
      
      const { data } = await supabase.from('student_scores')
        .select('name, grade')
        .ilike('name', probe)
        .order('name', { ascending: true })
        .limit(2000);
        
      const isSub = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };
      for (const r of (data || []) as any[]) {
        const full = normParentName(stripSubjectTag(r.name));
        const nn = bare(r.name);
        if (full === targetBase || full.includes(targetBase) || (tokens.length > 0 && tokens.every(t => full.includes(t))) || (nn.length >= 3 && (isSub(nq, nn) || isSub(nn, nq)))) {
          put({ name: r.name, grade: r.grade });
        }
      }
    } catch { /* offline */ }
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
