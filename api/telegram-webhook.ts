/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Telegram webhook — receives updates when a parent messages the bot and links
// their chat to a student. Phase 1: /start greeting, link by child name / អត្តលេខ,
// /list, /unlink. Set the webhook once (see docs/TELEGRAM_SETUP.md) with a
// secret_token; we verify it on every call so only Telegram can reach this.
//
// Self-contained on purpose: Vercel transpiles each /api file individually and
// does NOT bundle helpers from outside /api, so cross-directory imports fail at
// runtime (ERR_MODULE_NOT_FOUND). Only real npm modules are imported here.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

// --- Supabase (service role — bypasses RLS to read the locked telegram_links) ---
let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// --- Telegram Bot API ---
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

const HELP =
  'សួស្តី! 🌸 នេះជា Bot ព័ត៌មានសិស្ស <b>សាលាសហគមន៍ច្បារច្រុះ</b>។\n\n' +
  'ដើម្បីទទួលព័ត៌មានអវត្តមាន និងលទ្ធផលសិក្សារបស់កូនអ្នក សូមផ្ញើ <b>ឈ្មោះកូន</b> ឬ <b>អត្តលេខ</b>។\n\n' +
  'ពាក្យបញ្ជា៖\n• /list — មើលកូនដែលបានភ្ជាប់\n• /unlink — លុបការភ្ជាប់ទាំងអស់';

// Distinct (name, grade) students matching a name substring or exact អត្តលេខ.
async function findStudents(db: SupabaseClient, query: string) {
  let { data } = await db
    .from('student_scores')
    .select('name, grade, extra_data')
    .eq('extra_data->>studentId', query)
    .limit(50);
  if (!data || data.length === 0) {
    ({ data } = await db
      .from('student_scores')
      .select('name, grade, extra_data')
      .ilike('name', `%${query}%`)
      .limit(50));
  }
  const seen = new Map<string, { name: string; grade: string; studentId?: string }>();
  for (const r of data || []) {
    const key = `${r.name}||${r.grade}`;
    if (!seen.has(key)) seen.set(key, { name: r.name, grade: r.grade, studentId: (r as any).extra_data?.studentId });
  }
  return [...seen.values()];
}

async function link(db: SupabaseClient, chatId: number, s: { name: string; grade: string; studentId?: string }) {
  await db.from('telegram_links').upsert(
    { chat_id: String(chatId), student_name: s.name, grade: s.grade, student_id: s.studentId ?? null },
    { onConflict: 'chat_id,student_name,grade' },
  );
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).json({ error: 'bad secret' }); return;
  }

  try {
    const msg = req.body?.message || req.body?.edited_message;
    const chatId: number | undefined = msg?.chat?.id;
    const text: string = (msg?.text || '').trim();
    if (!chatId || !text) { res.status(200).json({ ok: true }); return; }

    const db = getAdmin();

    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, HELP);
      res.status(200).json({ ok: true }); return;
    }

    if (text === '/list') {
      const { data } = await db.from('telegram_links').select('student_name, grade').eq('chat_id', String(chatId));
      const lines = (data || []).map(r => `• ${r.student_name} (${r.grade})`);
      await sendMessage(chatId, lines.length ? 'កូនដែលបានភ្ជាប់៖\n' + lines.join('\n') : 'អ្នកមិនទាន់បានភ្ជាប់កូនណាម្នាក់ទេ។ សូមផ្ញើឈ្មោះកូន ឬអត្តលេខ។');
      res.status(200).json({ ok: true }); return;
    }

    if (text === '/unlink' || text === '/stop') {
      await db.from('telegram_links').delete().eq('chat_id', String(chatId));
      await sendMessage(chatId, 'បានលុបការភ្ជាប់ទាំងអស់រួចរាល់។ អ្នកនឹងលែងទទួលសារ។');
      res.status(200).json({ ok: true }); return;
    }

    // "Name | Grade" — the exact pick when several classes matched earlier.
    if (text.includes('|')) {
      const [nm, gr] = text.split('|').map(s => s.trim());
      const matches = (await findStudents(db, nm)).filter(s => s.grade === gr);
      if (matches.length === 1) {
        await link(db, chatId, matches[0]);
        await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${matches[0].name}</b> (${matches[0].grade})។`);
      } else {
        await sendMessage(chatId, 'រកមិនឃើញ។ សូមផ្ញើឈ្មោះ ឬអត្តលេខរបស់កូនម្ដងទៀត។');
      }
      res.status(200).json({ ok: true }); return;
    }

    // Otherwise treat the text as a child's name or អត្តលេខ.
    const found = await findStudents(db, text);
    if (found.length === 0) {
      await sendMessage(chatId, `រកមិនឃើញសិស្សឈ្មោះ ឬអត្តលេខ "<b>${text}</b>" ទេ។ សូមពិនិត្យ រួចផ្ញើម្ដងទៀត។`);
    } else if (found.length === 1) {
      await link(db, chatId, found[0]);
      await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${found[0].name}</b> (${found[0].grade})។ អ្នកនឹងទទួលព័ត៌មានអវត្តមាន និងលទ្ធផលសិក្សា។`);
    } else {
      const opts = found.map(s => `• ${s.name} | ${s.grade}`).join('\n');
      await sendMessage(chatId, `មានសិស្សច្រើននាក់ត្រូវនឹងឈ្មោះនេះ។ សូមផ្ញើឱ្យច្បាស់តាមទម្រង់ <b>ឈ្មោះ | ថ្នាក់</b>៖\n${opts}`);
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('telegram-webhook error', e?.message || e);
    res.status(200).json({ ok: true }); // still ACK so Telegram doesn't hammer retries
  }
}
