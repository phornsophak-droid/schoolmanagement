/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CalendarDays, Save, Printer, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { SchoolUser } from '../types';
import { Timetable, emptyTimetable, loadTimetable, saveTimetable } from '../lib/timetable';
import { exportElementToPdf } from '../utils/exportPdf';
import SchoolLogo from './SchoolLogo';

// Weekly-timetable manager. Principal edits any class; a teacher edits their own.
export default function TimetableManager({ grades, currentUser }: { grades: string[]; currentUser: SchoolUser | null }) {
  const isPrincipal = currentUser?.role === 'principal';
  const teacherGrade = currentUser?.grade && currentUser.grade !== 'ទាំងអស់' ? currentUser.grade : '';
  const editableGrades = isPrincipal ? grades : (teacherGrade ? [teacherGrade] : []);

  const [grade, setGrade] = useState(editableGrades[0] || '');
  const [tt, setTt] = useState<Timetable>(emptyTimetable());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!grade) return;
    setLoading(true); setStatus(null);
    loadTimetable(grade).then(setTt).finally(() => setLoading(false));
  }, [grade]);

  const setCell = (p: number, d: number, v: string) => setTt(t => { const grid = t.grid.map(r => r.slice()); grid[p][d] = v; return { ...t, grid }; });
  const setPeriod = (p: number, v: string) => setTt(t => { const periods = t.periods.slice(); periods[p] = v; return { ...t, periods }; });
  const addPeriod = () => setTt(t => ({ ...t, periods: [...t.periods, `ម៉ោងទី${t.periods.length + 1}`], grid: [...t.grid, t.days.map(() => '')] }));
  const removePeriod = (p: number) => setTt(t => ({ ...t, periods: t.periods.filter((_, i) => i !== p), grid: t.grid.filter((_, i) => i !== p) }));

  const save = async () => {
    setSaving(true); setStatus(null);
    try { await saveTimetable(grade, tt); setStatus({ ok: true, text: 'បានរក្សាទុករួចរាល់ ✓' }); }
    catch (e: any) { setStatus({ ok: false, text: 'រក្សាទុកមិនបាន៖ ' + (e?.message || 'សូមព្យាយាមម្ដងទៀត') }); }
    finally { setSaving(false); }
  };

  // Save first (so parents get the current version), then push to their private chats.
  const sendTelegram = async () => {
    let secret = '';
    try { secret = localStorage.getItem('telegram_announce_secret') || ''; } catch { /* ignore */ }
    if (!secret) {
      secret = (window.prompt('សូមបញ្ចូលពាក្យសម្ងាត់ផ្ញើ (ANNOUNCE_SECRET)') || '').trim();
      if (!secret) return;
      try { localStorage.setItem('telegram_announce_secret', secret); } catch { /* ignore */ }
    }
    setTgBusy(true); setStatus(null);
    try {
      await saveTimetable(grade, tt);
      const res = await fetch('/api/telegram-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, grade }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) setStatus({ ok: true, text: `បានផ្ញើកាលវិភាគទៅមាតាបិតាថ្នាក់នេះ (${data.sent || 0} សារ) ✓` });
      else setStatus({ ok: false, text: data.error === 'unauthorized' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។' : ('ផ្ញើមិនបាន៖ ' + (data.error || res.status)) });
    } catch { setStatus({ ok: false, text: 'ផ្ញើមិនបាន — សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត។' }); }
    finally { setTgBusy(false); }
  };

  const printPdf = async () => {
    const el = document.getElementById('timetable-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToPdf(el, `កាលវិភាគ_${grade.replace(/\s+/g, '_')}`, 1000); }
    catch { alert('បង្កើត PDF មិនបានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setPdfBusy(false); }
  };

  if (editableGrades.length === 0) {
    return <div className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 p-6">មិនមានថ្នាក់សម្រាប់កែកាលវិភាគទេ។</div>;
  }

  const inputCls = 'w-full px-1.5 py-1 bg-transparent text-center outline-none focus:bg-blue-50 rounded';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 max-w-5xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={16} className="text-blue-600" /> កាលវិភាគសិក្សាប្រចាំសប្តាហ៍</h2>
        <div className="flex items-center gap-2">
          {isPrincipal ? (
            <select value={grade} onChange={e => setGrade(e.target.value)} className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500">
              {editableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          ) : (
            <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">{grade}</span>
          )}
          <button onClick={printPdf} disabled={pdfBusy || loading} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} PDF
          </button>
          <button onClick={sendTelegram} disabled={tgBusy || loading} title="ផ្ញើកាលវិភាគទៅមាតាបិតាថ្នាក់នេះតាម Telegram" className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 disabled:opacity-60 text-sky-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
            {tgBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Telegram
          </button>
          <button onClick={save} disabled={saving || loading} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} រក្សាទុក
          </button>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-3 ${status.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {status.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}<span>{status.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm"><Loader2 size={18} className="animate-spin" /> កំពុងទាញ...</div>
      ) : (
        <>
          {/* Editable grid */}
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="border border-slate-300 p-1.5 bg-slate-100 w-32 text-slate-600">ម៉ោង / ថ្ងៃ</th>
                  {tt.days.map((d, di) => <th key={di} className="border border-slate-300 p-1.5 bg-slate-100 text-slate-700">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {tt.periods.map((p, pi) => (
                  <tr key={pi}>
                    <td className="border border-slate-300 p-1 bg-slate-50">
                      <div className="flex items-center gap-1">
                        <input value={p} onChange={e => setPeriod(pi, e.target.value)} className="w-full px-1 py-1 bg-transparent text-[11px] font-semibold text-slate-600 outline-none focus:bg-blue-50 rounded" />
                        <button onClick={() => removePeriod(pi)} title="លុបជួរនេះ" className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={12} /></button>
                      </div>
                    </td>
                    {tt.days.map((_, di) => (
                      <td key={di} className="border border-slate-300 p-0.5">
                        <input value={tt.grid[pi]?.[di] || ''} onChange={e => setCell(pi, di, e.target.value)} placeholder="—" className={inputCls} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addPeriod} className="mt-3 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 border border-blue-100">
            <Plus size={13} /> បន្ថែមម៉ោង
          </button>

          {/* Off-screen printable version (text, not inputs — html2canvas renders it cleanly) */}
          <div style={{ position: 'absolute', left: -99999, top: 0 }} aria-hidden>
            <div id="timetable-print" style={{ width: 1000, background: '#fff', padding: 28, boxSizing: 'border-box', color: '#1e293b', fontFamily: "'Kantumruy Pro', sans-serif" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 64 }}><SchoolLogo className="w-full h-auto" /></div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#047857' }}>សាលាសហគមន៍ច្បារច្រុះ</div>
                  <div style={{ fontSize: 14, color: '#334155' }}>កាលវិភាគសិក្សាប្រចាំសប្តាហ៍ — {grade}</div>
                </div>
              </div>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #94a3b8', padding: '8px 6px', background: '#f1f5f9', width: 140 }}>ម៉ោង / ថ្ងៃ</th>
                    {tt.days.map((d, di) => <th key={di} style={{ border: '1px solid #94a3b8', padding: '8px 6px', background: '#f1f5f9' }}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tt.periods.map((p, pi) => (
                    <tr key={pi}>
                      <td style={{ border: '1px solid #94a3b8', padding: '8px 6px', background: '#f8fafc', fontWeight: 600 }}>{p}</td>
                      {tt.days.map((_, di) => <td key={di} style={{ border: '1px solid #94a3b8', padding: '8px 6px', textAlign: 'center' }}>{tt.grid[pi]?.[di] || ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
