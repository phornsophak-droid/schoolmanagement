/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Daily job (Vercel Cron) — reads today's attendance and sends each linked parent
// a PRIVATE message about their own child's absence. No student data ever goes to
// a group. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token; a
// ?secret= query param is also accepted for browser testing).
//
// Self-contained on purpose: Vercel transpiles each /api file individually and
// does NOT bundle helpers from outside /api (ERR_MODULE_NOT_FOUND). Only real npm
// modules are imported here.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, any> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// Today's date (YYYY-MM-DD) in Cambodia time (ICT, UTC+7, no DST) — matches the
// device-local date DailyAttendance.tsx writes, so the cron picks the right day.
function todayICT(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function sendMessage(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage failed: ${data.description || res.status}`);
}

const STATUS_TEXT: Record<string, string> = {
  absent: '⚠️ អវត្តមាន<b>គ្មានច្បាប់</b>',
  permission: '📩 សុំច្បាប់ឈប់ (<b>មានច្បាប់</b>)',
};

export default async function handler(req: Req, res: Res) {
  // Vercel Cron sends the secret as a Bearer token; a ?secret= query param is also
  // accepted so the run can be triggered/tested from a browser.
  const secret = process.env.CRON_SECRET;
  const ok = !secret
    || req.headers['authorization'] === `Bearer ${secret}`
    || req.query?.secret === secret;
  if (!ok) { res.status(401).json({ error: 'unauthorized' }); return; }

  try {
    const db = getAdmin();
    const date = todayICT();

    // 1. Today's attendance rows → each student's worst status (absent wins).
    const { data: rows } = await db
      .from('student_attendance')
      .select('student_states')
      .eq('date', date);

    const statusById = new Map<string, 'absent' | 'permission'>();
    for (const row of rows || []) {
      const states = (row as any).student_states || {};
      for (const id of Object.keys(states)) {
        const st = states[id];
        if (st === 'absent') statusById.set(id, 'absent');
        else if (st === 'permission' && statusById.get(id) !== 'absent') statusById.set(id, 'permission');
      }
    }
    if (statusById.size === 0) { res.status(200).json({ date, absent: 0, sent: 0 }); return; }

    // 2. Resolve those ids → name + grade.
    const ids = [...statusById.keys()];
    const { data: scores } = await db
      .from('student_scores')
      .select('id, name, grade')
      .in('id', ids);

    const person = new Map<string, { name: string; grade: string; status: 'absent' | 'permission' }>();
    for (const s of scores || []) {
      const st = statusById.get((s as any).id);
      if (!st) continue;
      const key = `${(s as any).name}||${(s as any).grade}`;
      const prev = person.get(key);
      if (!prev || (st === 'absent' && prev.status !== 'absent')) {
        person.set(key, { name: (s as any).name, grade: (s as any).grade, status: st });
      }
    }

    // 3. Parent links → who to message for each person.
    const { data: links } = await db.from('telegram_links').select('chat_id, student_name, grade');
    const chatsFor = new Map<string, string[]>();
    for (const l of links || []) {
      const key = `${(l as any).student_name}||${(l as any).grade}`;
      const arr = chatsFor.get(key) || [];
      arr.push(String((l as any).chat_id));
      chatsFor.set(key, arr);
    }

    // 4. Send private messages.
    const jobs: Promise<any>[] = [];
    for (const [key, p] of person) {
      const chats = chatsFor.get(key);
      if (!chats || chats.length === 0) continue;
      const text =
        `ជម្រាបសួរ! 🌸\nសិស្ស <b>${p.name}</b> ថ្នាក់ ${p.grade}\n` +
        `${STATUS_TEXT[p.status]} នៅថ្ងៃទី <b>${date}</b>។\n\n` +
        (p.status === 'absent' ? 'សូមមេត្តាទាក់ទងសាលា ប្រសិនបើមានចម្ងល់។ ' : '') +
        'សូមអរគុណ។\n— សាលាសហគមន៍ច្បារច្រុះ';
      for (const chat of chats) {
        jobs.push(sendMessage(chat, text).catch(err => console.error('send failed', chat, err?.message || err)));
      }
    }
    await Promise.allSettled(jobs);

    res.status(200).json({ date, absent: person.size, sent: jobs.length });
  } catch (e: any) {
    console.error('telegram-cron error', e?.message || e);
    res.status(500).json({ error: e?.message || 'failed' });
  }
}
