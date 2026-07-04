/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Telegram webhook — receives updates when a parent messages the bot and links
// their chat to a student. /start greeting, link by child name / អត្តលេខ (auto-links
// ALL of the child's classes — general + after-hours), /list, /unlink. Set the
// webhook once (see docs/TELEGRAM_SETUP.md) with a secret_token; we verify it on
// every call so only Telegram can reach this.
//
// Self-contained on purpose: Vercel transpiles each /api file individually and
// does NOT bundle helpers from outside /api (ERR_MODULE_NOT_FOUND). Only real npm
// modules are imported here.

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
  'សួស្តី! នេះជា Bot ព័ត៌មានសិស្ស <b>សាលាសហគមន៍ច្បារច្រុះ</b>។\n\n' +
  'ដើម្បីទទួលព័ត៌មានអវត្តមាន និងលទ្ធផលសិក្សារបស់កូនអ្នក សូមផ្ញើ <b>ឈ្មោះកូន</b> ឬ <b>អត្តលេខ</b>។\n' +
  'ការផ្ញើឈ្មោះម្ដង នឹងភ្ជាប់គ្រប់ថ្នាក់របស់កូន (ទូទៅ និងក្រៅម៉ោង)។\n\n' +
  'ពាក្យបញ្ជា៖\n• /list — មើលកូនដែលបានភ្ជាប់\n• /unlink — លុបការភ្ជាប់ទាំងអស់';

// After-hours class detection (mirrors the app's EXTRA_CLASS_KEYWORDS). A child's
// general class is their identity anchor; after-hours rows carry a subject tag.
const EXTRA_CLASS_KEYWORDS = ['GRADE', 'គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtra = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
// After-hours names carry a trailing "(subject)" tag, e.g. "ផន វិណា (PE)".
const stripTag = (n: string) => (n || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
const baseName = (n: string) => stripTag(n).toLowerCase();

type Row = { name: string; grade: string; studentId?: string };

// Distinct (name, grade) rows matching an exact អត្តលេខ or a name substring.
async function findRows(db: SupabaseClient, query: string): Promise<Row[]> {
  let { data } = await db
    .from('student_scores')
    .select('name, grade, extra_data')
    .eq('extra_data->>studentId', query)
    .limit(500);
  if (!data || data.length === 0) {
    ({ data } = await db
      .from('student_scores')
      .select('name, grade, extra_data')
      .ilike('name', `%${query}%`)
      .limit(500));
  }
  const seen = new Map<string, Row>();
  for (const r of data || []) {
    const key = `${r.name}||${r.grade}`;
    if (!seen.has(key)) seen.set(key, { name: r.name, grade: r.grade, studentId: (r as any).extra_data?.studentId });
  }
  return [...seen.values()];
}

async function linkMany(db: SupabaseClient, chatId: number, rows: Row[]) {
  if (rows.length === 0) return;
  await db.from('telegram_links').upsert(
    rows.map(r => ({ chat_id: String(chatId), student_name: r.name, grade: r.grade, student_id: r.studentId ?? null })),
    { onConflict: 'chat_id,student_name,grade' },
  );
}

// Decide what to link for a typed name/ID. Prefer rows whose base name matches
// exactly. One (or zero) general class → one child → link ALL their classes.
// Several general classes → likely different people → ask the parent to pick.
function resolveChild(rows: Row[], query: string): { link?: Row[]; ambiguous?: Row[]; display?: string } {
  const base = baseName(query);
  const exact = rows.filter(r => baseName(r.name) === base);
  const use = exact.length ? exact : rows;
  if (use.length === 0) return {};
  const generals = use.filter(r => !isExtra(r.grade));
  if (generals.length > 1) return { ambiguous: generals };
  return { link: use, display: stripTag((generals[0] || use[0]).name) };
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

    // "Name | Grade" — the exact pick when the name was ambiguous (different children).
    // Links just that one class (the after-hours rows can't be safely attributed).
    if (text.includes('|')) {
      const [nm, gr] = text.split('|').map(s => s.trim());
      const match = (await findRows(db, nm)).find(r => r.grade === gr && baseName(r.name) === baseName(nm));
      if (match) {
        await linkMany(db, chatId, [match]);
        await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${stripTag(match.name)}</b> (${match.grade})។`);
      } else {
        await sendMessage(chatId, 'រកមិនឃើញ។ សូមផ្ញើឈ្មោះ ឬអត្តលេខរបស់កូនម្ដងទៀត។');
      }
      res.status(200).json({ ok: true }); return;
    }

    // Otherwise treat the text as a child's name or អត្តលេខ → link ALL their classes.
    const { link, ambiguous, display } = resolveChild(await findRows(db, text), text);
    if (ambiguous) {
      const opts = ambiguous.map(r => `• ${stripTag(r.name)} | ${r.grade}`).join('\n');
      await sendMessage(chatId, `មានសិស្សច្រើននាក់ឈ្មោះស្រដៀងគ្នា។ សូមជ្រើសថ្នាក់ចំណេះទូទៅរបស់កូនអ្នក តាមទម្រង់ <b>ឈ្មោះ | ថ្នាក់</b>៖\n${opts}`);
    } else if (link && link.length) {
      await linkMany(db, chatId, link);
      const list = link.map(r => `• ${r.grade}`).join('\n');
      await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${display}</b> — គ្រប់ថ្នាក់ (${link.length})៖\n${list}\n\nអ្នកនឹងទទួលព័ត៌មានអវត្តមាន និងលទ្ធផលសិក្សាពីគ្រប់ថ្នាក់។`);
    } else {
      await sendMessage(chatId, `រកមិនឃើញសិស្សឈ្មោះ ឬអត្តលេខ "<b>${text}</b>" ទេ។ សូមពិនិត្យ រួចផ្ញើម្ដងទៀត។`);
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('telegram-webhook error', e?.message || e);
    res.status(200).json({ ok: true }); // still ACK so Telegram doesn't hammer retries
  }
}
