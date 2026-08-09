import React, { useState } from 'react';
import { X, CalendarRange, Minus, Plus, CheckCircle, Wand2 } from 'lucide-react';
import { getStartYear, setStartYear, autoStartYear, SCHOOL_YEAR_KEY } from '../lib/schoolYear';
import { getCachedSetting } from '../lib/settingsCache';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const label = (start: number) => `${toKh(start)}-${toKh(start + 1)}`;

// Principal-only: choose the active SCHOOL YEAR. Everything (certificates, report
// cards, gradebook, attendance registers, worksheets, Parent Portal) reads it from
// src/lib/schoolYear.ts, so changing it here rolls the whole app over to the new
// year. It only changes the YEAR LABEL — it does not touch any student data.
export default function SchoolYearSetting({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [start, setStart] = useState<number>(() => getStartYear());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!open) return null;

  const isOverride = !!(getCachedSetting(SCHOOL_YEAR_KEY) || (() => { try { return localStorage.getItem(SCHOOL_YEAR_KEY); } catch { return ''; } })());
  const auto = autoStartYear();

  const save = async (val: number | null) => {
    setSaving(true);
    try { await setStartYear(val); setStart(val ?? autoStartYear()); setSaved(true); setTimeout(() => setSaved(false), 1600); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <CalendarRange size={16} className="text-blue-500" /> ឆ្នាំសិក្សា
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            ជ្រើសឆ្នាំសិក្សាបច្ចុប្បន្ន។ វានឹងបង្ហាញនៅលើ ព្រឹត្តិបត្រពិន្ទុ ប័ណ្ណសរសើរ តារាងវត្តមាន និងកន្លែងផ្សេងៗ។ <b>មិនប៉ះទិន្នន័យសិស្សទេ។</b>
          </p>

          <div className="flex items-center justify-center gap-4 py-2">
            <button onClick={() => setStart(s => Math.max(2020, s - 1))} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Minus size={18} /></button>
            <div className="text-center min-w-[9rem]">
              <div className="text-2xl font-black text-slate-800 font-mono tracking-wide">{label(start)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">ស្វ័យប្រវត្តិ៖ {label(auto)}{start === auto && !isOverride ? ' (កំពុងប្រើ)' : ''}</div>
            </div>
            <button onClick={() => setStart(s => Math.min(2035, s + 1))} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Plus size={18} /></button>
          </div>

          {saved && <p className="text-center text-[12px] font-bold text-emerald-600 flex items-center justify-center gap-1"><CheckCircle size={14} /> រក្សាទុករួច</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              title="គិតតាមកាលបរិច្ឆេទដោយស្វ័យប្រវត្តិ"
            >
              <Wand2 size={14} /> ស្វ័យប្រវត្តិ
            </button>
            <button
              onClick={() => save(start)}
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <CheckCircle size={14} /> កំណត់ {label(start)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
