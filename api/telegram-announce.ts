/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Post a general announcement to the parent GROUP. Called from the in-app
// composer (principal only). Gated by ANNOUNCE_SECRET so a random POST can't spam
// the group. No student data here — announcements are general (holidays, events).
//
// Self-contained (see telegram-webhook.ts note): no imports needed at all.

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (n: number) => Res; json: (b: any) => void };

export default async function handler(req: Req, res: Res) {
  // Same-origin POST from the app; allow simple CORS preflight just in case.
  if (req.method === 'OPTIONS') { res.status(200).json({ ok: true }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const secret = process.env.ANNOUNCE_SECRET;
  if (!secret || body.secret !== secret) { res.status(401).json({ error: 'unauthorized' }); return; }

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

  try {
    // An image (e.g. the shift-schedule table) is sent as a photo so it renders as
    // a proper picture instead of a text grid; otherwise a plain HTML text message.
    let data: any;
    if (doc) {
      // An editable Word (.doc) report → send as a document file.
      const base64 = doc.replace(/^data:application\/msword;base64,/, '');
      const form = new FormData();
      form.append('chat_id', String(groupId));
      const caption = String(body.caption || message || '').replace(/<[^>]+>/g, '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      const fname = String(body.filename || 'report.doc').replace(/[^\w.\-]/g, '_');
      form.append('document', new Blob([Buffer.from(base64, 'base64')], { type: 'application/msword' }) as any, fname.endsWith('.doc') ? fname : `${fname}.doc`);
      const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
      data = await r.json();
    } else if (pdf) {
      // A rendered PDF (e.g. a long work report) → send as a document file.
      const base64 = pdf.replace(/^data:application\/pdf;base64,/, '');
      const form = new FormData();
      form.append('chat_id', String(groupId));
      const caption = String(body.caption || message || '').replace(/<[^>]+>/g, '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      const fname = String(body.filename || 'report.pdf').replace(/[^\w.\-]/g, '_');
      form.append('document', new Blob([Buffer.from(base64, 'base64')], { type: 'application/pdf' }) as any, fname.endsWith('.pdf') ? fname : `${fname}.pdf`);
      const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
      data = await r.json();
    } else if (image) {
      const base64 = image.replace(/^data:image\/\w+;base64,/, '');
      const form = new FormData();
      form.append('chat_id', String(groupId));
      const caption = String(body.caption || message || '').slice(0, 1000);
      if (caption) form.append('caption', caption);
      form.append('photo', new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }) as any, 'schedule.png');
      const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
      data = await r.json();
    } else {
      const header = target === 'teacher' ? '📋 <b>របាយការណ៍ការងារគ្រូ</b>' : '📢 <b>សេចក្តីជូនដំណឹង</b>';
      const text = `${header}\n\n${escapeHtml(message)}\n\n— សាលាសហគមន៍ច្បារច្រុះ`;
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: groupId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      data = await r.json();
    }
    if (!data.ok) { res.status(502).json({ error: data.description || 'telegram error' }); return; }
    res.status(200).json({ ok: true, message_id: data.result?.message_id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
function escapeHtml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
