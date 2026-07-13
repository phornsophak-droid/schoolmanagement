/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CalendarDays, Send, Save, Pencil, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SchoolUser } from '../types';
import { fetchSetting, syncUpsertSetting } from '../lib/supabase';
import { renderElementToPngDataUrl } from '../utils/exportPdf';
import SchoolLogo from './SchoolLogo';

// Weekly SHIFT schedule (កាលវិភាគប្រចាំសប្តាហ៍) — which classes study in the morning
// vs afternoon shift. Shown in the announcements area; the principal edits it and
// can send it to the parent Telegram group via /api/telegram-announce (same bot /
// ANNOUNCE_SECRET as the general announcement).

const SETTING_KEY = 'shift_schedule';
const LS_KEY = 'shift_schedule';
const SECRET_KEY = 'telegram_announce_secret';

type Shift = { morning: string[]; afternoon: string[]; title?: string };

const DEFAULT_TITLE = 'កាលវិភាគប្រចាំសប្តាហ៍';
const parseLines = (s: string): string[] => s.split('\n').map(x => x.trim()).filter(Boolean);

function readLocal(): Shift {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return { morning: v.morning || [], afternoon: v.afternoon || [], title: v.title || '' }; }
  catch { return { morning: [], afternoon: [], title: '' }; }
}

export default function ShiftSchedule({ currentUser }: { currentUser?: SchoolUser | null }) {
  const isPrincipal = currentUser?.role === 'principal';
  const [shift, setShift] = useState<Shift>(() => readLocal());
  const [editing, setEditing] = useState(false);
  const [mDraft, setMDraft] = useState('');
  const [aDraft, setADraft] = useState('');
  const [tDraft, setTDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [secret, setSecret] = useState(() => { try { return localStorage.getItem(SECRET_KEY) || ''; } catch { return ''; } });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchSetting(SETTING_KEY).then(v => {
      if (v && (Array.isArray(v.morning) || Array.isArray(v.afternoon))) {
        const s = { morning: v.morning || [], afternoon: v.afternoon || [], title: v.title || '' };
        setShift(s);
        try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
      }
    }).catch(() => { /* offline — use local */ });
  }, []);

  const startEdit = () => { setMDraft(shift.morning.join('\n')); setADraft(shift.afternoon.join('\n')); setTDraft(shift.title || ''); setEditing(true); setStatus(null); };

  const save = async () => {
    const s: Shift = { morning: parseLines(mDraft), afternoon: parseLines(aDraft), title: tDraft.trim() };
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
      // Render the table to an image so the group gets a clean picture, not text.
      let image: string | undefined;
      const el = document.getElementById('shift-print');
      if (el) { try { image = await renderElementToPngDataUrl(el, 900); } catch { /* fall back below */ } }
      const res = await fetch('/api/telegram-announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // alsoPrivate: the shift schedule is a general notice → also DM each linked parent.
        body: JSON.stringify({ image, caption: `📅 ${shift.title?.trim() || DEFAULT_TITLE} — សាលាសហគមន៍ច្បារច្រុះ`, secret: secret.trim(), alsoPrivate: true }),
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
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={16} className="text-indigo-600" /> {shift.title?.trim() || DEFAULT_TITLE}</h3>
        {isPrincipal && !editing && (
          <button onClick={startEdit} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1.5"><Pencil size={12} /> កែ</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">ចំណងជើង</span>
            <input value={tDraft} onChange={e => setTDraft(e.target.value)} placeholder="ឧ. កាលវិភាគប្រចាំសប្តាហ៍ ២ (ថ្ងៃ៦–១១ កក្កដា) ២០២៥-២០២៦" className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
          </label>
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

      {/* Off-screen printable — captured to an image for the Telegram group */}
      <div style={{ position: 'absolute', left: -99999, top: 0 }} aria-hidden>
        <div id="shift-print" style={{ width: 900, background: '#fff', padding: 28, boxSizing: 'border-box', color: '#1e293b', fontFamily: "'Kantumruy Pro', sans-serif" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 60 }}><SchoolLogo className="w-full h-auto" /></div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#047857' }}>សាលាសហគមន៍ច្បារច្រុះ</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{shift.title?.trim() || DEFAULT_TITLE}</div>
            </div>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #94a3b8', padding: '9px 8px', background: '#eef2ff', width: '50%' }}>🌅 វេនព្រឹក</th>
                <th style={{ border: '1px solid #94a3b8', padding: '9px 8px', background: '#fff7ed', width: '50%' }}>🌇 វេនរសៀល</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(shift.morning.length, shift.afternoon.length, 1) }).map((_, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center' }}>{shift.morning[i] || ''}</td>
                  <td style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'center' }}>{shift.afternoon[i] || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
