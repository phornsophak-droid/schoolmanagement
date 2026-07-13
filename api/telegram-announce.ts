/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Post a general announcement to the parent GROUP. Called from the in-app
// composer (principal only). Gated by ANNOUNCE_SECRET so a random POST can't spam
// the group. No student data here — announcements are general (holidays, events).
//
// Self-contained (see telegram-webhook.ts note): only real npm modules imported.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

// Service-role client (bypasses RLS) — only needed to read the parent→bot chat
// links for the private fan-out. Returns null if not configured so the group send
// still works on its own.
let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export default async function handler(req: Req, res: Res) {
  // Same-origin POST from the app; allow simple CORS preflight just in case.
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  // Accept either env var so ONE value (VITE_ANNOUNCE_SECRET, also baked into the
  // client for auto-send on every device) can gate both sides. ANNOUNCE_SECRET is
  // still honoured for backward compatibility.
  const secrets = [process.env.ANNOUNCE_SECRET, process.env.VITE_ANNOUNCE_SECRET].filter(Boolean);
  if (secrets.length === 0 || !secrets.includes(body.secret)) { res.status(401).json({ error: 'unauthorized' }); return; }

  const message = String(body.message || '').trim();
  const image: string = typeof body.image === 'string' && body.image.startsWith('data:image') ? body.image : '';
  const pdf: string = typeof body.pdf === 'string' && body.pdf.startsWith('data:application/pdf') ? body.pdf : '';
  const doc: string = typeof body.doc === 'string' && body.doc.startsWith('data:application/msword') ? body.doc : '';
  if (!message && !image && !pdf && !doc) { res.status(400).json({ error: 'empty message' }); return; }

  // target=teacher → the TEACHERS' group (work reports); default = parent group.
  const target = body.target === 'teacher' ? 'teacher' : 'parent';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupId = target === 'teacher'
    ? process.env.TELEGRAM_TEACHER_GROUP_CHAT_ID
    : process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!token || !groupId) { res.status(500).json({ error: 'bot token / group id not configured' }); return; }

  // Robustly extract the base64 payload from a data URL. jsPDF's datauristring is
  // "data:application/pdf;filename=generated.pdf;base64,..." — a strict prefix
  // replace misses the ";filename=" part and corrupts the file, so slice from
  // "base64,".
  const b64 = (dataUrl: string): string => { const i = dataUrl.indexOf('base64,'); return i >= 0 ? dataUrl.slice(i + 7) : dataUrl; };

  // Build + send to a given chat id. An image (e.g. the shift-schedule table) goes
  // as a photo; otherwise a plain HTML text message. Returns Telegram's JSON.
  const sendTo = async (chatId: string): Promise<any> => {
    if (doc) {
      // An editable Word (.doc) report → send as a document file.
      const base64 = b64(doc);
      const form = new FormData();
      form.append('chat_id', chatId);
      const caption = String(body.caption || message || '').replace(/<[^>]+>/g, '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      const fname = String(body.filename || 'report.doc').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').trim();
      form.append('document', new Blob([Buffer.from(base64, 'base64')], { type: 'application/msword' }) as any, fname.endsWith('.doc') ? fname : `${fname}.doc`);
      const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
      return r.json();
    }
    if (pdf) {
      // A rendered PDF (e.g. a long work report) → send as a document file.
      const base64 = b64(pdf);
      const form = new FormData();
      form.append('chat_id', chatId);
      const caption = String(body.caption || message || '').replace(/<[^>]+>/g, '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      const fname = String(body.filename || 'report.pdf').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').trim();
      form.append('document', new Blob([Buffer.from(base64, 'base64')], { type: 'application/pdf' }) as any, fname.endsWith('.pdf') ? fname : `${fname}.pdf`);
      const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
      return r.json();
    }
    if (image) {
      const base64 = b64(image);
      const form = new FormData();
      form.append('chat_id', chatId);
      const caption = String(body.caption || message || '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      form.append('photo', new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }) as any, 'schedule.png');
      const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
      return r.json();
    }
    const header = target === 'teacher' ? '📋 <b>របាយការណ៍ការងារគ្រូ</b>' : '📢 <b>សេចក្តីជូនដំណឹង</b>';
    const text = `${header}\n\n${escapeHtml(message)}\n\n— សាលាសហគមន៍ច្បារច្រុះ`;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return r.json();
  };

  try {
    // If a plain group was upgraded to a SUPERGROUP its chat id changed; Telegram
    // rejects the old id and returns the new one in parameters.migrate_to_chat_id.
    // Retry once with the migrated id so the send still lands (env var can stay).
    let data = await sendTo(String(groupId));
    const migrated = data?.parameters?.migrate_to_chat_id;
    if (!data.ok && migrated) data = await sendTo(String(migrated));
    if (!data.ok) { res.status(502).json({ error: data.description || 'telegram error' }); return; }

    // Also deliver the announcement to each linked parent's PRIVATE chat with the
    // bot, so parents who don't watch the group still receive it. Parents only —
    // telegram_links holds parent→student links; teacher reports stay group-only.
    // Best-effort: the group send already succeeded, so a fan-out failure doesn't
    // fail the request.
    let privateSent = 0;
    if (target === 'parent') {
      try {
        const db = getAdmin();
        if (db) {
          const { data: links } = await db.from('telegram_links').select('chat_id');
          const groupIdStr = String(groupId);
          const chatIds = [...new Set((links || []).map((l: any) => String(l.chat_id)).filter(Boolean))]
            .filter(id => id !== groupIdStr);
          const results = await Promise.allSettled(chatIds.map(id => sendTo(id)));
          privateSent = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.ok).length;
        }
      } catch { /* private fan-out is best-effort */ }
    }

    res.status(200).json({ ok: true, message_id: data.result?.message_id, privateSent });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
function escapeHtml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
