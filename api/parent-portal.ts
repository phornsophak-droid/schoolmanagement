/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// SECURE PARENT PORTAL — server-side proxy (Security Phase 2).
// ----------------------------------------------------------------------------
// Today the browser reads student_scores with the public ANON key, so the login
// screen is only cosmetic: anyone with the anon key can read EVERY child. This
// endpoint moves the privileged read to the server, behind the SERVICE_ROLE key
// (never shipped to the browser), and returns ONLY the one child a parent proves
// they may see. Once the client is wired to this and anon read on student_scores
// is locked down, the confidentiality hole is closed.
//
// Stateless: every privileged call re-sends the parent credential (child name +
// password) and the server re-verifies before returning or mutating anything —
// no session token to manage. Over HTTPS this is the same exposure as any login.
//
// Self-contained (see telegram-webhook.ts note): only npm modules imported. The
// child-matching logic mirrors src/lib/parentAuth.ts (keep the two in sync).
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const config = { maxDuration: 30 };

// ── session token (HMAC) ────────────────────────────────────────────────────
// After a successful login the server hands the browser a signed token that
// encodes WHICH child it may see (never a password). Later calls (records) send
// the token back; the server verifies the signature + expiry and needs no
// password re-check and no student_scores auth query. Secret = the service-role
// key (already server-only) so no extra env var is needed.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function tokenSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET || 'dev-secret';
}
interface TokenPayload { n: string; g: string; s?: string; exp: number }
function signToken(p: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token: string): TokenPayload | null {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type Res = { status: (n: number) => Res; json: (b: any) => void };

// ── service-role client (server-only secret) ────────────────────────────────
let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// ── name matching (ported from src/lib/parentAuth.ts) ───────────────────────
const normName = (s: string) => (s || '')
  .replace(/[​‌‍‎‏⁠﻿]/g, '')
  .replace(/[ៈ៖:：]/g, '') // ៈ ៖ : ： (interchangeable colon-like signs)
  .replace(/\s+/g, ' ').trim().toLowerCase();
const stripTag = (n: string) => (n || '').replace(/\s*\([^)]*\)\s*$/, '');
const bare = (s: string) => normName(stripTag(s)).replace(/\s/g, '');
const isSub = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };

const EXTRA = ['GRADE', 'គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtra = (g: string) => EXTRA.some(k => (g || '').includes(k));

interface ChildRow { name: string; grade: string; studentId?: string; }
const childKey = (name: string, studentId?: string) =>
  studentId && studentId.trim() ? `id:${studentId.trim()}` : `nm:${normName(name)}`;

// Find every student_scores row that plausibly matches the typed name. Same two
// passes as parentAuth.findChild: narrow AND-token query, then a subsequence probe.
async function findChild(db: SupabaseClient, nameTyped: string): Promise<ChildRow[]> {
  const q = normName(nameTyped);
  if (!q) return [];
  const tokens = q.split(' ').filter(t => t.length >= 2);
  const nq = q.replace(/\s/g, '');
  const seen = new Map<string, ChildRow>();
  const put = (r: any) => { const k = `${r.name}||${r.grade}`; if (!seen.has(k)) seen.set(k, { name: r.name, grade: r.grade, studentId: r.studentId }); };

  if (tokens.length) {
    let query = db.from('student_scores').select('name, grade, studentId:extra_data->>studentId');
    for (const t of tokens) query = query.ilike('name', `%${t}%`);
    const { data } = await query.limit(500);
    for (const r of (data || []) as any[]) {
      const full = normName(r.name);
      if (full === q || full.includes(q) || tokens.every(t => full.includes(t))) put(r);
    }
  }
  if (seen.size === 0 && nq.length > 0) {
    const probe = '%' + nq.slice(0, 4).split('').join('%') + '%';
    const { data } = await db.from('student_scores')
      .select('name, grade, studentId:extra_data->>studentId')
      .ilike('name', probe).limit(2000);
    for (const r of (data || []) as any[]) {
      const nn = bare(r.name);
      if (nn.length >= 3 && (isSub(nq, nn) || isSub(nn, nq))) put(r);
    }
  }
  return [...seen.values()];
}

// The single GENERAL-class child is the login anchor (matches parentAuth.resolveGeneral).
function resolveGeneral(rows: ChildRow[]): { child?: ChildRow; ambiguous?: ChildRow[] } {
  const generals = rows.filter(r => !isExtra(r.grade));
  const names = [...new Set(generals.map(r => normName(r.name)))];
  if (names.length > 1) return { ambiguous: generals };
  if (generals.length >= 1) return { child: generals[0] };
  if (rows.length === 1) return { child: rows[0] };
  if (rows.length > 1) return { ambiguous: rows };
  return {};
}

// Every FULL student_scores row for a known child, across all their classes
// (studentId match + tolerant name match). Returns raw DB rows for the client to
// map — only this one child's data ever leaves the server.
async function fetchChildRecords(db: SupabaseClient, child: ChildRow): Promise<any[]> {
  const rows = new Map<string, any>();
  // Dedup by the row's own primary key — every MONTH is a separate row for the
  // same (grade, name), so keying on grade||name would collapse the whole year to
  // one month. `id` only dedups a row that both probes (studentId + name) returned.
  const put = (r: any) => {
    const k = String(r.id ?? `${r.grade}||${String(r.name || '').trim()}||${r.month || ''}`);
    if (!rows.has(k)) rows.set(k, r);
  };
  const targetBase = normName(stripTag(child.name));
  const tokens = targetBase.split(' ').filter(t => t.length >= 2);
  const sid = (child.studentId || '').trim();
  const nq = bare(child.name);

  if (sid) {
    const { data } = await db.from('student_scores').select('*').eq('extra_data->>studentId', sid).limit(500);
    for (const r of (data || []) as any[]) put(r);
  }
  if (nq.length > 0) {
    const probe = '%' + nq.slice(0, 4).split('').join('%') + '%';
    const { data } = await db.from('student_scores').select('*').ilike('name', probe).limit(2000);
    for (const r of (data || []) as any[]) {
      const full = normName(stripTag(r.name));
      const nn = bare(r.name);
      if (full === targetBase || full.includes(targetBase)
        || (tokens.length > 0 && tokens.every(t => full.includes(t)))
        || (nn.length >= 3 && (isSub(nq, nn) || isSub(nn, nq)))) put(r);
    }
  }
  return [...rows.values()];
}

// Strip every personal identifier from a classmate row, keeping only what the
// client needs to compute this child's RANK (grade, month, numeric scores, and
// the sub-score maps for per-subject ranks). No real name / studentId / dob /
// parents / address / phone leaves the server — a parent gets an anonymous score
// distribution, never another child's identity.
//
// The `name` becomes a STABLE pseudonym (a hash of the real name+grade) rather
// than blank: the semester/annual report card groups a classmate's monthly+exam
// rows by name to build one semester average per student, so a blank name would
// collapse the whole class into one entry and every rank would read ១. The hash
// keeps each classmate distinct for ranking without revealing who they are.
function pseudoName(r: any): string {
  return '~' + crypto.createHash('sha256').update(`${r.name || ''}|${r.grade || ''}`).digest('hex').slice(0, 12);
}
function anonymizeRow(r: any): any {
  const ed = r.extra_data || {};
  return {
    ...r,
    name: pseudoName(r),
    gender: null,
    extra_data: {
      group: ed.group ?? null,
      englishScores: ed.englishScores ?? null,
      scienceScores: ed.scienceScores ?? null,
      socialScores: ed.socialScores ?? null,
    },
  };
}

// ── school_settings KV (service-role read/write) ────────────────────────────
async function readSetting(db: SupabaseClient, key: string): Promise<any> {
  const { data } = await db.from('school_settings').select('setting_value').eq('setting_key', key).limit(1);
  return data && data.length ? data[0].setting_value : null;
}
// Update every row for the key (heals duplicates), insert if none — mirrors
// syncUpsertSetting so a value written here is read back consistently.
async function writeSetting(db: SupabaseClient, key: string, value: any): Promise<void> {
  const { data: updated } = await db.from('school_settings')
    .update({ setting_value: value }).eq('setting_key', key).select('setting_key');
  if (!updated || updated.length === 0) {
    await db.from('school_settings').insert({ setting_key: key, setting_value: value });
  }
}

const ACCT_KEY = 'parent_portal_accounts';
const PASS_KEY = 'parent_portal_passcode';
interface ParentAccount { name: string; grade: string; studentId?: string; password: string; updatedAt: number; }
type ParentAccounts = Record<string, ParentAccount>;

// Resolve the child a caller proves they may see. Returns the child + whether the
// supplied password is valid (against their personal account, or first-login the
// shared passcode). `create` writes the account on a successful first login.
async function verifyParent(
  db: SupabaseClient, name: string, password: string, create: boolean,
): Promise<{ ok: boolean; child?: ChildRow; firstTime?: boolean; error?: string; matches?: ChildRow[] }> {
  const rows = await findChild(db, name);
  const { child, ambiguous } = resolveGeneral(rows);
  if (ambiguous) return { ok: false, error: 'ambiguous', matches: ambiguous };
  if (!child) return { ok: false, error: 'noName' };

  const accts = (await readSetting(db, ACCT_KEY) as ParentAccounts) || {};
  const acct = accts[childKey(child.name, child.studentId)];
  if (acct) {
    return (password || '') === acct.password ? { ok: true, child } : { ok: false, error: 'wrongPass' };
  }
  // First login → the shared passcode.
  const shared = (await readSetting(db, PASS_KEY) as string) || 'ccc2026';
  if (!shared) return { ok: false, error: 'noPasscode' };
  if ((password || '') !== shared) return { ok: false, error: 'wrongPass' };
  if (create) {
    const key = childKey(child.name, child.studentId);
    const next = { ...accts, [key]: { name: child.name, grade: child.grade, studentId: child.studentId, password: shared, updatedAt: Date.now() } };
    await writeSetting(db, ACCT_KEY, next);
  }
  return { ok: true, child, firstTime: true };
}

// ── handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }
  let body: any = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const action = String(body?.action || '');
  const name = String(body?.name || '');
  const password = String(body?.password || '');

  try {
    const db = getAdmin();

    if (action === 'login') {
      const r = await verifyParent(db, name, password, true);
      if (!r.ok || !r.child) { res.status(200).json({ ok: false, error: r.error, matches: r.matches }); return; }
      const token = signToken({ n: r.child.name, g: r.child.grade, s: r.child.studentId, exp: Date.now() + TOKEN_TTL_MS });
      res.status(200).json({ ok: true, child: r.child, firstTime: !!r.firstTime, token });
      return;
    }

    if (action === 'records') {
      const p = verifyToken(String(body?.token || ''));
      if (!p) { res.status(200).json({ ok: false, error: 'expired' }); return; }
      const records = await fetchChildRecords(db, { name: p.n, grade: p.g, studentId: p.s });
      // Anonymized classmates for the child's classes so the client can compute
      // each month's ranking (overall + per-subject) without any other child's
      // identity — the child's own rows are excluded (they're in `records`).
      // Fetch each grade separately AND paginate: a single .in() over several
      // grades hits PostgREST's 1000-row cap and silently drops classmates, which
      // made the monthly average rank wrong. One complete grade at a time fixes it.
      const grades = [...new Set(records.map(r => r.grade))];
      const recordIds = new Set(records.map(r => r.id));
      const roster: any[] = [];
      for (const g of grades) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from('student_scores').select('*').eq('grade', g).range(from, from + 999);
          if (error || !data || data.length === 0) break;
          for (const r of data) if (!recordIds.has(r.id)) roster.push(anonymizeRow(r));
          if (data.length < 1000) break;
        }
      }
      res.status(200).json({ ok: true, records, roster });
      return;
    }

    if (action === 'changePassword') {
      const p = verifyToken(String(body?.token || ''));
      if (!p) { res.status(200).json({ ok: false, error: 'expired' }); return; }
      const newPassword = String(body?.newPassword || '').trim();
      if (newPassword.length < 1) { res.status(200).json({ ok: false, error: 'shortPass' }); return; }
      const accts = (await readSetting(db, ACCT_KEY) as ParentAccounts) || {};
      accts[childKey(p.n, p.s)] = { name: p.n, grade: p.g, studentId: p.s, password: newPassword, updatedAt: Date.now() };
      await writeSetting(db, ACCT_KEY, accts);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e: any) {
    console.error('parent-portal error', e?.message || e);
    res.status(500).json({ ok: false, error: 'server' });
  }
}
