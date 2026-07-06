/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Telegram webhook. Parents link their child (one name links ALL their classes),
// then ASK QUESTIONS answered by Gemini grounded in their own child's real data
// (attendance + grades). Commands: /start, /link <name>, /list, /unlink.
// Set the webhook once (docs/TELEGRAM_SETUP.md) with a secret_token, verified here.
//
// Self-contained on purpose: Vercel transpiles each /api file individually and
// does NOT bundle helpers from outside /api (ERR_MODULE_NOT_FOUND). Only real npm
// modules are imported here.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const config = { maxDuration: 30 };

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
async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
const sendMessage = (chatId: string | number, text: string) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
const sendTyping = (chatId: string | number) => tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

const HELP =
  'សួស្តី! នេះជា Bot ព័ត៌មានសិស្ស <b>សាលាសហគមន៍ច្បារច្រុះ</b>។\n\n' +
  '• ផ្ញើ <b>ឈ្មោះកូន</b> ឬ <b>អត្តលេខ</b> ដើម្បីភ្ជាប់កូន (លើកដំបូង) — ភ្ជាប់គ្រប់ថ្នាក់ស្វ័យប្រវត្តិ។\n' +
  '• ក្រោយភ្ជាប់រួច អ្នកអាច <b>សួរសំណួរ</b>អំពីកូន (ឧ. «កូនខ្ញុំអវត្តមានប៉ុន្មានដង?», «ពិន្ទុកូនខ្ញុំយ៉ាងណា?»)។\n\n' +
  'ពាក្យបញ្ជា៖\n• /link ឈ្មោះ — បន្ថែមកូនថ្មី\n• /list — មើលកូនដែលបានភ្ជាប់\n• /unlink — លុបការភ្ជាប់ទាំងអស់';

// After-hours class detection (mirrors the app's EXTRA_CLASS_KEYWORDS).
const EXTRA_CLASS_KEYWORDS = ['GRADE', 'គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtra = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
const stripTag = (n: string) => (n || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
const baseName = (n: string) => stripTag(n).toLowerCase();
const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];
const fmt = (v: any) => (v === null || v === undefined || v === '') ? '-' : Number(v).toFixed(2);

type Row = { name: string; grade: string; studentId?: string };
type Link = { student_name: string; grade: string };

async function findRows(db: SupabaseClient, rawQuery: string): Promise<Row[]> {
  const query = (rawQuery || '').trim();
  const seen = new Map<string, Row>();
  const add = (arr: any[] | null | undefined) => {
    for (const r of arr || []) {
      const key = `${r.name}||${r.grade}`;
      if (!seen.has(key)) seen.set(key, { name: r.name, grade: r.grade, studentId: (r as any).extra_data?.studentId });
    }
  };

  // 1. Student ID (អត្តលេខ). Real IDs are ≥3 chars/digits (grade numbers like "5"
  // are shorter and must NOT be treated as an ID). Try exact, then a contains match
  // (handles a leading zero the parent added/omitted, e.g. 756 vs 0756).
  const idTok = (query.match(/\b[A-Za-z]?\d{3,}[A-Za-z]?\b/g) || [])[0];
  if (idTok) {
    let { data } = await db.from('student_scores').select('name, grade, extra_data').eq('extra_data->>studentId', idTok).limit(500);
    add(data);
    if (seen.size === 0) {
      const digits = idTok.replace(/^0+/, '') || idTok;
      ({ data } = await db.from('student_scores').select('name, grade, extra_data').ilike('extra_data->>studentId', `%${digits}%`).limit(500));
      add(data);
    }
  }

  // 2. Name — strip noise the parent may add (ថ្នាក់/អត្តលេខ/ID + grade & id tokens),
  // then require EACH remaining word to appear (order- and spacing-independent).
  if (seen.size === 0) {
    const cleaned = query
      .replace(/អត្តលេខ|ថ្នាក់ទី\S*|ថ្នាក់\S*|មត្តេយ្យ\S*|grade|GRADE|ID|id/g, ' ')
      .replace(/\b[A-Za-z]?\d+[A-Za-zក-៿]?\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = cleaned.split(' ').filter(t => t.length >= 2).slice(0, 5);
    if (tokens.length) {
      let q = db.from('student_scores').select('name, grade, extra_data');
      for (const t of tokens) q = q.ilike('name', `%${t}%`);
      const { data } = await q.limit(500);
      add(data);
    }

    // 3. Subsequence fallback — the parent may DROP or ADD a letter (e.g. type
    // "វិៈបុត្រ" for the stored "វិរៈបុត្រ"), so no token is a clean substring.
    // Fetch by the FIRST word (usually spelled right) then keep names where the
    // whole typed query appears as a subsequence (same order, gaps allowed).
    if (seen.size === 0 && tokens.length) {
      const nq = cleaned.replace(/\s/g, '');
      const isSubseq = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };
      // Fetch by the shorter of the first two words' prefix so a mis-typed later
      // letter still pulls candidates, then keep bidirectional-subsequence matches.
      const probe = tokens[0].slice(0, 3);
      const { data } = await db.from('student_scores').select('name, grade, extra_data').ilike('name', `%${probe}%`).limit(500);
      add((data || []).filter((r: any) => { const nn = String(r.name || '').replace(/\s/g, ''); return nn.length >= 3 && (isSubseq(nq, nn) || isSubseq(nn, nq)); }));
    }
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

function resolveChild(rows: Row[], query: string): { link?: Row[]; ambiguous?: Row[]; display?: string } {
  const base = baseName(query);
  const exact = rows.filter(r => baseName(r.name) === base);
  const use = exact.length ? exact : rows;
  if (use.length === 0) return {};
  const generals = use.filter(r => !isExtra(r.grade));
  if (generals.length > 1) return { ambiguous: generals };
  return { link: use, display: stripTag((generals[0] || use[0]).name) };
}

// Link a child from a typed name/ID (used by first-time onboarding and /link).
async function handleLink(db: SupabaseClient, chatId: number, query: string) {
  const { link, ambiguous, display } = resolveChild(await findRows(db, query), query);
  if (ambiguous) {
    const opts = ambiguous.map(r => `• ${stripTag(r.name)} | ${r.grade}`).join('\n');
    await sendMessage(chatId, `មានសិស្សច្រើននាក់ឈ្មោះស្រដៀងគ្នា។ សូមជ្រើសថ្នាក់ចំណេះទូទៅរបស់កូនអ្នក តាមទម្រង់ <b>ឈ្មោះ | ថ្នាក់</b>៖\n${opts}`);
  } else if (link && link.length) {
    await linkMany(db, chatId, link);
    const list = link.map(r => `• ${r.grade}`).join('\n');
    await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${display}</b> — គ្រប់ថ្នាក់ (${link.length})៖\n${list}\n\nឥឡូវអ្នកអាចសួរសំណួរអំពីកូន (ឧ. «អវត្តមានប៉ុន្មានដង?»)។`);
  } else {
    await sendMessage(chatId,
      `រកមិនឃើញសិស្សឈ្មោះ ឬអត្តលេខ "<b>${query}</b>" ទេ។\n\n` +
      'សូមសាកម្ដងទៀត៖\n' +
      '• ផ្ញើ <b>តែឈ្មោះ</b> (កុំដាក់ថ្នាក់/អត្តលេខបន្ថែម) ឧ. <code>ឡាំ វិៈបុត្រ</code>\n' +
      '• ឬ ផ្ញើ <b>តែអត្តលេខ</b> ឧ. <code>756</code>\n' +
      'បើនៅតែរកមិនឃើញ សូមទាក់ទងសាលា ដើម្បីផ្ទៀងផ្ទាត់ការសរសេរឈ្មោះ។');
  }
}

// Compact Khmer digest of the parent's linked children — attendance tally + latest
// monthly grades — used to ground Gemini's answer in real data.
async function buildContext(db: SupabaseClient, links: Link[]): Promise<string> {
  const names = [...new Set(links.map(l => l.student_name))];
  const grades = [...new Set(links.map(l => l.grade))];
  const linked = [...new Set(links.map(l => `${l.student_name}||${l.grade}`))];

  const { data: scoreRows } = await db
    .from('student_scores')
    .select('id, name, grade, month, overall_avg, grade_letter, ranking, khmer_avg, math_avg, science, social_studies, physical_education, health, life_skills, foreign_language')
    .in('name', names);
  const byChild = new Map<string, any[]>();
  const idsByChild = new Map<string, string[]>();
  for (const r of scoreRows || []) {
    const key = `${(r as any).name}||${(r as any).grade}`;
    if (!linked.includes(key)) continue;
    let a = byChild.get(key); if (!a) { a = []; byChild.set(key, a); } a.push(r);
    let ids = idsByChild.get(key); if (!ids) { ids = []; idsByChild.set(key, ids); } ids.push((r as any).id);
  }

  const tally = new Map<string, { absent: number; permission: number }>();
  if (grades.length) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('student_attendance').select('student_states').in('grade', grades).range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const st = (row as any).student_states || {};
        for (const id of Object.keys(st)) {
          const s = st[id];
          if (s !== 'absent' && s !== 'permission') continue;
          const t = tally.get(id) || { absent: 0, permission: 0 };
          if (s === 'absent') t.absent++; else t.permission++;
          tally.set(id, t);
        }
      }
      if (data.length < 1000) break;
    }
  }

  const parts: string[] = [];
  for (const key of linked) {
    const [nm, gr] = key.split('||');
    const monthly = (byChild.get(key) || []).filter(r => r.month && !String(r.month).startsWith('ប្រឡង'));
    monthly.sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));
    const latest = monthly[monthly.length - 1];
    let ab = 0, pe = 0;
    for (const id of idsByChild.get(key) || []) { const t = tally.get(id); if (t) { ab += t.absent; pe += t.permission; } }
    let s = `- ${stripTag(nm)} — ថ្នាក់ ${gr}\n  អវត្តមានសរុប៖ ${ab + pe} ដង (គ្មានច្បាប់ ${ab}, មានច្បាប់ ${pe})`;
    if (latest) {
      s += `\n  លទ្ធផលខែ${latest.month}៖ មធ្យមភាគ ${fmt(latest.overall_avg)} (និទ្ទេស ${latest.grade_letter || '-'})` + (latest.ranking ? `, ចំណាត់ថ្នាក់ទី ${latest.ranking}` : '');
      if (!isExtra(gr)) {
        s += `\n  ពិន្ទុមុខវិជ្ជា៖ ភាសាខ្មែរ ${fmt(latest.khmer_avg)}, គណិត ${fmt(latest.math_avg)}, វិទ្យាសាស្ត្រ ${fmt(latest.science)}, សិក្សាសង្គម ${fmt(latest.social_studies)}, កាយ-កីឡា ${fmt(latest.physical_education)}, សុខភាព ${fmt(latest.health)}, បំណិនជីវិត ${fmt(latest.life_skills)}, ភាសាបរទេស ${fmt(latest.foreign_language)}`;
      }
    }
    parts.push(s);
  }
  return parts.join('\n');
}

async function answerQuestion(question: string, context: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return 'សូមអភ័យទោស មុខងារឆ្លើយសំណួរមិនទាន់បើកនៅឡើយទេ។ សូមទាក់ទងសាលាដោយផ្ទាល់។';
  const ai = new GoogleGenAI({ apiKey: key });
  const prompt =
    `អ្នកគឺជា Bot ជំនួយការមាតាបិតា នៃសាលាសហគមន៍ច្បារច្រុះ។ សូមឆ្លើយសំណួរមាតាបិតាជាភាសាខ្មែរ ដោយសុភាព ខ្លី និងច្បាស់។\n` +
    `ច្បាប់៖\n` +
    `- ប្រើតែទិន្នន័យកូនខាងក្រោមប៉ុណ្ណោះ។ កុំបង្កើតលេខ ឬព័ត៌មានថ្មី។\n` +
    `- បើសំណួរជាព័ត៌មានទូទៅ (ម៉ោងរៀន ថ្ងៃឈប់...) ដែលគ្មានក្នុងទិន្នន័យ សូមណែនាំឱ្យទាក់ទងសាលាដោយផ្ទាល់។\n` +
    `- បើសួរអំពីកូនដែលគ្មានក្នុងទិន្នន័យ សូមប្រាប់ថាអ្នកមិនមានព័ត៌មាននោះទេ។\n` +
    `- សរសេរជាអក្សរធម្មតា។ កុំប្រើ markdown (** ឬ #)។ អាចប្រើ • សម្រាប់បញ្ជី។\n\n` +
    `ទិន្នន័យកូន៖\n${context || '(គ្មានទិន្នន័យ)'}\n\n` +
    `សំណួរមាតាបិតា៖ ${question}`;
  const res = await ai.models.generateContent({ model: 'gemini-2.5-flash-lite', contents: prompt });
  let out = (res.text || '').trim();
  if (!out) return 'សូមអភ័យទោស ខ្ញុំមិនអាចឆ្លើយបានទេ។ សូមទាក់ទងសាលា។';
  // Telegram is in HTML mode: escape any literal HTML from the model, then turn
  // markdown **bold** into <b> and "* " bullets into "• " so it renders cleanly.
  out = out.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[*-]\s+/gm, '• ');
  return out;
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
    const chatType: string | undefined = msg?.chat?.type;
    const text: string = (msg?.text || '').trim();
    if (!chatId || !text) { res.status(200).json({ ok: true }); return; }

    // In a group the bot ONLY reveals the chat id (to set TELEGRAM_GROUP_CHAT_ID);
    // it never links/answers there — student data stays in private chats.
    if (chatType && chatType !== 'private') {
      if (/^\/(chatid|id)\b/.test(text)) await sendMessage(chatId, `Chat ID: <code>${chatId}</code>`);
      res.status(200).json({ ok: true }); return;
    }

    const db = getAdmin();

    if (text === '/start' || text === '/help') { await sendMessage(chatId, HELP); res.status(200).json({ ok: true }); return; }

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

    if (text === '/link') { await sendMessage(chatId, 'សូមផ្ញើ៖ <code>/link ឈ្មោះកូន</code> ឬ <code>/link អត្តលេខ</code>'); res.status(200).json({ ok: true }); return; }
    if (text.startsWith('/link ')) { await handleLink(db, chatId, text.slice(6).trim()); res.status(200).json({ ok: true }); return; }

    // "Name | Grade" — the exact pick when a name was ambiguous.
    if (text.includes('|')) {
      const [nm, gr] = text.split('|').map(s => s.trim());
      const match = (await findRows(db, nm)).find(r => r.grade === gr && baseName(r.name) === baseName(nm));
      if (match) { await linkMany(db, chatId, [match]); await sendMessage(chatId, `✅ បានភ្ជាប់ជាមួយ <b>${stripTag(match.name)}</b> (${match.grade})។`); }
      else await sendMessage(chatId, 'រកមិនឃើញ។ សូមផ្ញើឈ្មោះ ឬអត្តលេខរបស់កូនម្ដងទៀត។');
      res.status(200).json({ ok: true }); return;
    }

    // Plain text: not linked yet → treat as a name to link (onboarding).
    // Already linked → treat as a QUESTION answered from their child's data.
    const { data: links } = await db.from('telegram_links').select('student_name, grade').eq('chat_id', String(chatId));
    if (!links || links.length === 0) {
      await handleLink(db, chatId, text);
    } else {
      await sendTyping(chatId);
      try {
        const ctx = await buildContext(db, links as Link[]);
        const answer = await answerQuestion(text, ctx);
        await sendMessage(chatId, answer);
      } catch (err: any) {
        const reason = err?.message || err?.error?.message || String(err);
        console.error('qa error', reason);
        const quota = /quota|resource[_ ]?exhausted|rate.?limit|429|too many requests/i.test(reason);
        await sendMessage(chatId, quota
          ? 'សូមអភ័យទោស ប្រព័ន្ធកំពុងមមាញឹកបន្តិច។ សូមរង់ចាំមួយភ្លែត រួចសួរម្ដងទៀត។ 🙏'
          : 'សូមអភ័យទោស មានបញ្ហាបច្ចេកទេសបណ្ដោះអាសន្ន។ សូមព្យាយាមម្ដងទៀត ឬទាក់ទងសាលា។');
      }
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('telegram-webhook error', e?.message || e);
    res.status(200).json({ ok: true }); // still ACK so Telegram doesn't hammer retries
  }
}
