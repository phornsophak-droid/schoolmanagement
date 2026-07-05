/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Megaphone, Send, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Principal-only composer that posts a GENERAL announcement to the parent Telegram
// group via /api/telegram-announce. No student data — general notices only. The
// send password (ANNOUNCE_SECRET) is entered once and kept in localStorage.
const SECRET_KEY = 'telegram_announce_secret';

export default function TelegramAnnounce() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [secret, setSecret] = useState(() => { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    const msg = message.trim();
    if (!msg) { setStatus({ ok: false, text: 'សូមសរសេរសារជាមុនសិន។' }); return; }
    if (!secret.trim()) { setStatus({ ok: false, text: 'សូមបញ្ចូលពាក្យសម្ងាត់ផ្ញើ។' }); return; }
    setSending(true); setStatus(null);
    try {
      const res = await fetch('/api/telegram-announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, secret: secret.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        try { localStorage.setItem(SECRET_KEY, secret.trim()); } catch { /* ignore */ }
        setStatus({ ok: true, text: 'បានផ្ញើប្រកាសទៅ Group មាតាបិតារួចរាល់ ✓' });
        setMessage('');
      } else {
        const err = data.error === 'unauthorized' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'
          : data.error === 'bot token / group id not configured' ? 'Group មិនទាន់តំឡើងក្នុង Vercel (TELEGRAM_GROUP_CHAT_ID)។'
          : ('ផ្ញើមិនបាន៖ ' + (data.error || res.status));
        setStatus({ ok: false, text: err });
      }
    } catch {
      setStatus({ ok: false, text: 'ផ្ញើមិនបាន — សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត។' });
    } finally { setSending(false); }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setStatus(null); }}
        className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 transition-all text-left"
      >
        <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600"><Megaphone size={20} /></div>
        <div>
          <div className="text-sm font-bold text-slate-800">ប្រកាសទៅ Group មាតាបិតា</div>
          <div className="text-[11px] text-slate-500">ផ្ញើសេចក្តីជូនដំណឹងទូទៅតាម Telegram</div>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => !sending && setOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Megaphone size={16} className="text-sky-600" /> ប្រកាសទៅ Group មាតាបិតា</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">សារប្រកាស</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  placeholder="ឧ. ថ្ងៃសុក្រនេះសាលាឈប់សម្រាកមួយថ្ងៃ ដោយសារ..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-sky-500 resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">⚠️ ផ្ញើទៅ Group រួម — កុំដាក់ព័ត៌មានផ្ទាល់ខ្លួនរបស់សិស្សណាម្នាក់។</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ពាក្យសម្ងាត់ផ្ញើ (ANNOUNCE_SECRET)</label>
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="បញ្ចូលម្ដង — ចងចាំទុកក្នុងឧបករណ៍នេះ"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              {status && (
                <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-xl ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {status.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                  <span>{status.text}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
              <button onClick={() => setOpen(false)} disabled={sending} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200">បិទ</button>
              <button onClick={send} disabled={sending} className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm">
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} ផ្ញើប្រកាស
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
