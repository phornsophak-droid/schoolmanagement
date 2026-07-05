/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// On-demand: send each linked parent a PRIVATE grade report for their child's
// latest month. Triggered by the principal (open the URL with ?secret=CRON_SECRET,
// or Authorization: Bearer) whenever a month's grades are finalised — grades don't
// change daily, so this is manual rather than a cron.
//
// Self-contained (see telegram-webhook.ts note): only npm modules imported.

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

const EXTRA_CLASS_KEYWORDS = ['GRADE', 'គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtra = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
const stripTag = (n: string) => (n || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];
const fmt = (v: any) => (v === null || v === undefined || v === '') ? '-' : Number(v).toFixed(2);

export default async function handler(req: Req, res: Res) {
  const secret = process.env.CRON_SECRET;
  const ok = !secret
    || req.headers['authorization'] === `Bearer ${secret}`
    || req.query?.secret === secret;
  if (!ok) { res.status(401).json({ error: 'unauthorized' }); return; }

  try {
    const db = getAdmin();

    // 1. All parent links → chat_ids per child.
    const { data: links } = await db.from('telegram_links').select('chat_id, student_name, grade');
    if (!links || links.length === 0) { res.status(200).json({ children: 0, sent: 0 }); return; }
    const chatsFor = new Map<string, string[]>();
    for (const l of links) {
      const key = `${(l as any).student_name}||${(l as any).grade}`;
      const arr = chatsFor.get(key) || [];
      arr.push(String((l as any).chat_id));
      chatsFor.set(key, arr);
    }
    const names = [...new Set(links.map(l => (l as any).student_name))];

    // 2. Latest monthly grade row per linked child.
    const { data: rows } = await db
      .from('student_scores')
      .select('name, grade, month, overall_avg, grade_letter, ranking, khmer_avg, math_avg, science, social_studies, physical_education, health, life_skills, foreign_language')
      .in('name', names);
    const latest = new Map<string, any>();
    for (const r of rows || []) {
      const key = `${(r as any).name}||${(r as any).grade}`;
      if (!chatsFor.has(key)) continue;
      const m = (r as any).month;
      if (!m || String(m).startsWith('ប្រឡង')) continue; // skip exam rows
      const prev = latest.get(key);
      if (!prev || MONTH_ORDER.indexOf(m) > MONTH_ORDER.indexOf(prev.month)) latest.set(key, r);
    }

    // 3. Send a private grade report per child.
    const jobs: Promise<any>[] = [];
    for (const [key, r] of latest) {
      const chats = chatsFor.get(key);
      if (!chats || chats.length === 0) continue;
      const [nm, gr] = key.split('||');
      let text =
        `📊 ព្រឹត្តបត្រពិន្ទុ\nសិស្ស <b>${stripTag(nm)}</b> ថ្នាក់ ${gr}\n` +
        `ខែ <b>${r.month}</b> — មធ្យមភាគ <b>${fmt(r.overall_avg)}</b> (និទ្ទេស ${r.grade_letter || '-'})` +
        (r.ranking ? `, ចំណាត់ថ្នាក់ទី <b>${r.ranking}</b>` : '') + '។';
      if (!isExtra(gr)) {
        text += `\n\nពិន្ទុមុខវិជ្ជា៖\n` +
          `• ភាសាខ្មែរ ${fmt(r.khmer_avg)}\n• គណិតវិទ្យា ${fmt(r.math_avg)}\n` +
          `• វិទ្យាសាស្ត្រ ${fmt(r.science)}\n• សិក្សាសង្គម ${fmt(r.social_studies)}\n` +
          `• កាយ-កីឡា ${fmt(r.physical_education)}\n• សុខភាព ${fmt(r.health)}\n` +
          `• បំណិនជីវិត ${fmt(r.life_skills)}\n• ភាសាបរទេស ${fmt(r.foreign_language)}`;
      }
      text += `\n\nសូមមេត្តាមាតាបិតាបន្តលើកទឹកចិត្ត និងតាមដានការសិក្សារបស់កូន។ 🙏\nសូមអរគុណ។\n— សាលាសហគមន៍ច្បារច្រុះ`;
      for (const chat of chats) {
        jobs.push(sendMessage(chat, text).catch(err => console.error('send failed', chat, err?.message || err)));
      }
    }
    await Promise.allSettled(jobs);

    res.status(200).json({ children: latest.size, sent: jobs.length });
  } catch (e: any) {
    console.error('telegram-grades error', e?.message || e);
    res.status(500).json({ error: e?.message || 'failed' });
  }
}
