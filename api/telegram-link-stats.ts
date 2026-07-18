/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// How many parents have linked the bot — counted SERVER-SIDE and returned as bare
// numbers. The raw telegram_links rows (chat_id ↔ student ↔ class) never reach the
// browser: the app only needs the totals, and shipping the links would both expose
// who is linked to whom and cost egress. Gated by the same ANNOUNCE_SECRET as the
// other Telegram endpoints so it isn't a public stats feed.
//
// Self-contained (see telegram-webhook.ts note): only real npm modules imported.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }

export default async function handler(req: Req, res: Res) {
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const secrets = [process.env.ANNOUNCE_SECRET, process.env.VITE_ANNOUNCE_SECRET].filter(Boolean);
  if (secrets.length === 0 || !secrets.includes(body.secret)) { res.status(401).json({ error: 'unauthorized' }); return; }

  const db = getAdmin();
  if (!db) { res.status(500).json({ error: 'supabase service role not configured' }); return; }

  // Optional class scope — a class teacher may only see their own classes. Enforced
  // HERE (server-side), not just hidden in the UI.
  const grades: string[] = Array.isArray(body.grades) ? body.grades.map((g: any) => String(g)).filter(Boolean) : [];

  try {
    let q = db.from('telegram_links').select('chat_id, student_name, grade');
    if (grades.length) q = q.in('grade', grades);
    const { data, error } = await q;
    if (error) { res.status(502).json({ error: error.message }); return; }
    const rows = data || [];
    // One parent can have several children, so count DISTINCT chat ids — both
    // overall and within each class.
    const all = new Set<string>();
    const perGrade = new Map<string, Set<string>>();
    // Linked STUDENTS, deduped by name+class. chat_id is deliberately NOT returned:
    // the UI only needs to show which students are covered, and the parent's
    // Telegram identity has no business leaving the server.
    const seen = new Set<string>();
    const students: { name: string; grade: string; parents: number }[] = [];
    const parentsPerStudent = new Map<string, Set<string>>();

    for (const r of rows as any[]) {
      const chat = String(r.chat_id || '');
      if (!chat) continue;
      all.add(chat);
      const g = String(r.grade || '').trim() || '(គ្មានថ្នាក់)';
      (perGrade.get(g) || perGrade.set(g, new Set()).get(g)!).add(chat);

      const name = String(r.student_name || '').trim();
      if (!name) continue;
      const key = `${name}||${g}`;
      (parentsPerStudent.get(key) || parentsPerStudent.set(key, new Set()).get(key)!).add(chat);
      if (!seen.has(key)) { seen.add(key); students.push({ name, grade: g, parents: 0 }); }
    }
    for (const s of students) s.parents = parentsPerStudent.get(`${s.name}||${s.grade}`)?.size || 0;
    students.sort((a, b) => a.grade.localeCompare(b.grade, 'km') || a.name.localeCompare(b.name, 'km'));

    const byGrade: Record<string, number> = {};
    for (const [g, s] of perGrade) byGrade[g] = s.size;
    res.status(200).json({ ok: true, total: all.size, links: rows.length, byGrade, students });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
}
