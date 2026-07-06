/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CalendarDays, Send, Save, Pencil, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SchoolUser } from '../types';
import { fetchSetting, syncUpsertSetting } from '../lib/supabase';

// Weekly SHIFT schedule (កាលវិភាគប្រចាំសប្តាហ៍) — which classes study in the morning
// vs afternoon shift. Shown in the announcements area; the principal edits it and
// can send it to the parent Telegram group via /api/telegram-announce (same bot /
// ANNOUNCE_SECRET as the general announcement).

const SETTING_KEY = 'shift_schedule';
const LS_KEY = 'shift_schedule';
const SECRET_KEY = 'telegram_announce_secret';

type Shift = { morning: string[]; afternoon: string[] };

const parseLines = (s: string): string[] => s.split('\n').map(x => x.trim()).filter(Boolean);

function readLocal(): Shift {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return { morning: v.morning || [], afternoon: v.afternoon || [] }; }
  catch { return { morning: [], afternoon: [] }; }
}

// Format the schedule as a Telegram message.
function formatMessage(s: Shift): string {
  const list = (arr: string[]) => arr.length ? arr.map(c => `• ${c}`).join('\n') : '—';
  return `📅 <b>កាលវិភាគប្រចាំសប្តាហ៍</b>\n\n` +
    `🌅 <b>វេនព្រឹក</b>\n${list(s.morning)}\n\n` +
    `🌇 <b>វេនរសៀល</b>\n${list(s.afternoon)}\n\n` +
    `— សាលាសហគមន៍ច្បារច្រុះ`;
}

export default function ShiftSchedule({ currentUser }: { currentUser?: SchoolUser | null }) {
  const isPrincipal = currentUser?.role === 'principal';
  const [shift, setShift] = useState<Shift>(() => readLocal());
  const [editing, setEditing] = useState(false);
  const [mDraft, setMDraft] = useState('');
  const [aDraft, setADraft] = useState('');
  const [sending, setSending] = useState(false);
  const [secret, setSecret] = useState(() => { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchSetting(SETTING_KEY).then(v => {
      if (v && (Array.isArray(v.morning) || Array.isArray(v.afternoon))) {
        const s = { morning: v.morning || [], afternoon: v.afternoon || [] };
        setShift(s);
        try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
      }
    }).catch(() => { /* offline — use local */ });
  }, []);

  const startEdit = () => { setMDraft(shift.morning.join('\n')); setADraft(shift.afternoon.join('\n')); setEditing(true); setStatus(null); };

  const save = async () => {
    const s: Shift = { morning: parseLines(mDraft), afternoon: parseLines(aDraft) };
    setShift(s);
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    setEditing(false);
    try { await syncUpsertSetting(SETTING_KEY, s); setStatus({ ok: true, text: 'បានរក្សាទុក (គ្រប់ឧបករណ៍) ✓' }); }
    catch { setStatus({ ok: false, text: 'បានរក្សាទុកក្នុងម៉ាស៊ីន — ភ្ជាប់ Cloud បរាជ័យ' }); }
  };

  const send = async () => {
    if (!shift.morning.length && !shift.afternoon.length) { setStatus({ ok: false, text: 'កាលវិភាគទទេ — សូមបញ្ចូលថ្នាក់ជាមុនសិន។' }); return; }
    if (!secret.trim()) { setStatus({ ok: false, text: 'សូមបញ្ចូលពាក្យសម្ងាត់ផ្ញើ (ANNOUNCE_SECRET)។' }); return; }
    setSending(true); setStatus(null);
    try {
      const res = await fetch('/api/telegram-announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: formatMessage(shift), secret: secret.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        try { localStorage.setItem(SECRET_KEY, secret.trim()); } catch { /* ignore */ }
        setStatus({ ok: true, text: 'បានផ្ញើកាលវិភាគទៅ Group Telegram រួចរាល់ ✓' });
      } else {
        const err = data.error === 'unauthorized' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'
          : data.error === 'bot token / group id not configured' ? 'Group មិនទាន់តំឡើងក្នុង Vercel (TELEGRAM_GROUP_CHAT_ID)។'
          : ('ផ្ញើមិនបាន៖ ' + (data.error || res.status));
        setStatus({ ok: false, text: err });
      }
    } catch { setStatus({ ok: false, text: 'ផ្ញើមិនបាន — សូមពិនិត្យអ៊ីនធឺណិត។' }); }
    finally { setSending(false); }
  };

  const rows = Math.max(shift.morning.length, shift.afternoon.length);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={16} className="text-indigo-600" /> កាលវិភាគប្រចាំសប្តាហ៍</h3>
        {isPrincipal && !editing && (
          <button onClick={startEdit} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1.5"><Pencil size={12} /> កែ</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase">🌅 វេនព្រឹក (ថ្នាក់មួយបន្ទាត់)</span><textarea value={mDraft} onChange={e => setMDraft(e.target.value)} rows={7} placeholder={'មត្តេយ្យ ២\nថ្នាក់ទី ១ក\n...'} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 resize-y" /></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase">🌇 វេនរសៀល (ថ្នាក់មួយបន្ទាត់)</span><textarea value={aDraft} onChange={e => setADraft(e.target.value)} rows={7} placeholder={'មត្តេយ្យ ១\nថ្នាក់ទី ១ខ\n...'} className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 resize-y" /></label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200">បោះបង់</button>
            <button onClick={save} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"><Save size={12} /> រក្សាទុក</button>
          </div>
        </div>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <thead><tr className="bg-slate-100"><th className="border border-slate-300 px-2 py-1.5 w-1/2">វេនព្រឹក</th><th className="border border-slate-300 px-2 py-1.5 w-1/2">វេនរសៀល</th></tr></thead>
          <tbody>
            {rows === 0 ? (
              <tr><td colSpan={2} className="border border-slate-300 px-2 py-4 text-center text-slate-400">មិនទាន់មានកាលវិភាគ{isPrincipal ? ' — ចុច «កែ» ដើម្បីបញ្ចូល។' : '។'}</td></tr>
            ) : Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="text-center">
                <td className="border border-slate-300 px-2 py-1.5">{shift.morning[i] || ''}</td>
                <td className="border border-slate-300 px-2 py-1.5">{shift.afternoon[i] || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {status && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-xl ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {status.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{status.text}</span>
        </div>
      )}

      {/* Principal-only: send to the parent Telegram group via the CCC bot */}
      {isPrincipal && !editing && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="ANNOUNCE_SECRET" className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-500" />
          <button onClick={send} disabled={sending} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm shrink-0">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} ផ្ញើទៅ Telegram
          </button>
        </div>
      )}
    </div>
  );
}
