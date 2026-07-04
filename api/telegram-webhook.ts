/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Telegram webhook — receives updates when a parent messages the bot and links
// their chat to a student. Phase 1: /start greeting, link by child name / អត្តលេខ,
// /list, /unlink. Set the webhook once (see docs/TELEGRAM_SETUP.md) with a
// secret_token; we verify it on every call so only Telegram can reach this.

import { getAdmin } from '../server/db';
import { sendMessage } from '../server/telegram';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (n: number) => Res; json: (b: any) => void; end: (b?: any) => void };

const HELP =
  'សួស្តី! 🌸 នេះជា Bot ព័ត៌មានសិស្ស <b>សាលាសហគមន៍ច្បារច្រុះ</b>។\n\n' +
  'ដើម្បីទទួលព័ត៌មានអវត្តមាន និងលទ្ធផលសិក្សារបស់កូនអ្នក សូមផ្ញើ <b>ឈ្មោះកូន</b> ឬ <b>អត្តលេខ</b>។\n\n' +
  'ពាក្យបញ្ជា៖\n• /list — មើលកូនដែលបានភ្ជាប់\n• /unlink — លុបការភ្ជាប់ទាំងអស់';

// Distinct (name, grade) students matching a name substring or exact អត្តលេខ.
async function findStudents(admin: ReturnType<typeof getAdmin>, query: string) {
  let { data } = await admin
    .from('student_scores')
    .select('name, grade, extra_data')
    .eq('extra_data->>studentId', query)
    .limit(50);
  if (!data || data.length === 0) {
    ({ data } = await admin
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

async function link(admin: ReturnType<typeof getAdmin>, chatId: number, s: { name: string; grade: string; studentId?: string }) {
  await admin.from('telegram_links').upsert(
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

  // Always ACK 200 so Telegram doesn't retry; work happens via the Bot API.
  try {
    const msg = req.body?.message || req.body?.edited_message;
    const chatId: number | undefined = msg?.chat?.id;
    const text: string = (msg?.text || '').trim();
    if (!chatId || !text) { res.status(200).json({ ok: true }); return; }

    const admin = getAdmin();

    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, HELP);
      res.status(200).json({ ok: true }); return;
    }

    if (text === '/list') {
      const { data } = await admin.from('telegram_links').select('student_name, grade').eq('chat_id', String(chatId));
      const lines = (data || []).map(r => `• ${r.student_name} (${r.grade})`);
      await sendMessage(chatId, lines.length ? 'កូនដែលបានភ្ជាប់៖\n' + lines.join('\n') : 'អ្នកមិនទាន់បានភ្ជាប់កូនណាម្នាក់ទេ។ សូមផ្ញើឈ្មោះកូន ឬអត្តលេខ។');
      res.status(200).json({ ok: true }); return;
    }

    if (text === '/unlink' || text === '/stop') {
      await admin.from('telegram_links').delete().eq('chat_id', String(chatId));
      await sendMessage(chatId, 'បានលុបការភ្ជាប់ទាំងអស់រួចរាល់។ អ្នកនឹងលែងទទួលសារ។');
      res.status(200).json({ ok: true }); return;
    }

    // "Name | Grade" — the exact pick when several classes matched earlier.
    if (text.includes('|')) {
      const [nm, gr] = text.split('|').map(s => s.trim());
      const matches = (await findStudents(admin, nm)).filter(s => s.grade === gr);
      if (matches.length === 1) {
        await link(admin, chatId, matches[0]);
        await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${matches[0].name}</b> (${matches[0].grade})។`);
      } else {
        await sendMessage(chatId, 'រកមិនឃើញ។ សូមផ្ញើឈ្មោះ ឬអត្តលេខរបស់កូនម្ដងទៀត។');
      }
      res.status(200).json({ ok: true }); return;
    }

    // Otherwise treat the text as a child's name or អត្តលេខ.
    const found = await findStudents(admin, text);
    if (found.length === 0) {
      await sendMessage(chatId, `រកមិនឃើញសិស្សឈ្មោះ ឬអត្តលេខ "<b>${text}</b>" ទេ។ សូមពិនិត្យ រួចផ្ញើម្ដងទៀត។`);
    } else if (found.length === 1) {
      await link(admin, chatId, found[0]);
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
