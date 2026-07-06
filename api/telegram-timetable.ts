/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Send the weekly class timetable privately to the parents linked to that class.
// Triggered from the in-app timetable manager (POST { secret, grade }) or by URL
// (?secret=CRON_SECRET). Auth accepts ANNOUNCE_SECRET or CRON_SECRET.
//
// Self-contained (see telegram-webhook.ts note): only npm modules imported.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined>; query?: Record<string, any> };
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

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DEFAULT_DAYS = ['ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

// Grouped-by-day plain text (HTML-escaped). Empty timetable → null.
function timetableText(grade: string, raw: any): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const days: string[] = Array.isArray(raw.days) && raw.days.length ? raw.days : DEFAULT_DAYS;
  const periods: string[] = Array.isArray(raw.periods) ? raw.periods : [];
  const grid: any[][] = Array.isArray(raw.grid) ? raw.grid : [];
  let any = false;
  const out = [`🗓️ <b>កាលវិភាគសិក្សា</b> — ${esc(grade)}`];
  days.forEach((day, di) => {
    const rows: string[] = [];
    periods.forEach((p, pi) => {
      const s = grid[pi]?.[di];
      if (s && String(s).trim()) { rows.push(`  ${esc(p)}: ${esc(String(s).trim())}`); any = true; }
    });
    if (rows.length) out.push('', `📌 <b>${esc(day)}</b>`, ...rows);
  });
  return any ? out.join('\n') : null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const provided = body.secret || req.query?.secret
    || (typeof req.headers['authorization'] === 'string' ? (req.headers['authorization'] as string).replace(/^Bearer\s+/, '') : '');
  const valid = [process.env.ANNOUNCE_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (!provided || !valid.includes(provided)) { res.status(401).json({ error: 'unauthorized' }); return; }

  const onlyGrade: string | undefined = body.grade || req.query?.grade;

  try {
    const db = getAdmin();

    // Linked parents (filtered to the class when a grade is given).
    let lq = db.from('telegram_links').select('chat_id, grade');
    if (onlyGrade) lq = lq.eq('grade', onlyGrade);
    const { data: links } = await lq;
    const pairs = [...new Map((links || []).map(l => [`${(l as any).chat_id}||${(l as any).grade}`, l])).values()];

    // Which classes to send: the one requested, else every class with a linked parent.
    const grades = onlyGrade ? [onlyGrade] : [...new Set((links || []).map(l => (l as any).grade))];
    if (grades.length === 0) { res.status(200).json({ private: 0, group: 0 }); return; }

    const { data: settings } = await db
      .from('school_settings')
      .select('setting_key, setting_value')
      .in('setting_key', grades.map(g => `school_timetable::${g}`));
    const textByGrade = new Map<string, string>();
    for (const s of settings || []) {
      const grade = String((s as any).setting_key).replace('school_timetable::', '');
      const txt = timetableText(grade, (s as any).setting_value);
      if (txt) textByGrade.set(grade, txt);
    }

    const jobs: Promise<any>[] = [];

    // 1. Private — to each linked parent of the class.
    let priv = 0;
    for (const p of pairs) {
      const txt = textByGrade.get((p as any).grade);
      if (!txt) continue;
      priv++;
      jobs.push(sendMessage(String((p as any).chat_id), txt).catch(err => console.error('private send failed', err?.message || err)));
    }

    // 2. Group — the timetable is general info, so also post it to the parent group.
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID;
    let group = 0;
    if (groupId) {
      for (const [, txt] of textByGrade) {
        group++;
        jobs.push(sendMessage(groupId, txt).catch(err => console.error('group send failed', err?.message || err)));
      }
    }

    await Promise.allSettled(jobs);
    res.status(200).json({ grades: [...textByGrade.keys()], private: priv, group });
  } catch (e: any) {
    console.error('telegram-timetable error', e?.message || e);
    res.status(500).json({ error: e?.message || 'failed' });
  }
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
