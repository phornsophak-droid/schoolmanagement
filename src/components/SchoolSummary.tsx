/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { X, Sparkles, Loader2, Copy, Check, BarChart3 } from 'lucide-react';
import { StudentScore } from '../types';
import { computeSchoolSummary, monthsWithData, summaryToKhmerText, summaryForPrompt, toKh } from '../utils/schoolSummary';
import { hasGemini, generateSchoolSummaryAI } from '../lib/gemini';

interface SchoolSummaryProps {
  students: StudentScore[];
  onClose: () => void;
}

export default function SchoolSummary({ students, onClose }: SchoolSummaryProps) {
  const months = useMemo(() => monthsWithData(students), [students]);
  const [month, setMonth] = useState<string>(() => months[months.length - 1] || 'មិថុនា');
  const summary = useMemo(() => computeSchoolSummary(students, month), [students, month]);
  const computedText = useMemo(() => summaryToKhmerText(summary), [summary]);

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);

  const runAi = async () => {
    setAiBusy(true); setAiError(''); setAiText(null);
    try {
      const text = await generateSchoolSummaryAI(summaryForPrompt(summary), month);
      setAiText(text);
    } catch (e) {
      console.error('AI summary failed', e);
      setAiError('មិនអាចភ្ជាប់ AI បានទេ — សូមប្រើសេចក្ដីសង្ខេបស្វ័យប្រវត្តិខាងក្រោម។');
    } finally { setAiBusy(false); }
  };

  const shownText = aiText || computedText;
  const copyText = async () => {
    try { await navigator.clipboard.writeText(shownText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const stat = (label: string, value: string, accent: string) => (
    <div className={`flex-1 min-w-[120px] rounded-xl border p-3 ${accent}`}>
      <div className="text-[11px] font-semibold opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl my-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md"><BarChart3 size={18} /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">សង្ខេបលទ្ធផលសិក្សារួមសាលា</h3>
              <p className="text-[11px] text-slate-500">លទ្ធផល · របាយការណ៍ · ចំណុចកែលម្អខែបន្ទាប់</p>
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Month selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-600">ខែ៖</label>
            <select value={month} onChange={e => { setMonth(e.target.value); setAiText(null); setAiError(''); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-indigo-500 focus:outline-none">
              {(months.length ? months : [month]).map(m => <option key={m} value={m}>ខែ{m}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-2">
            {stat('សិស្សសរុប', toKh(summary.totalStudents), 'bg-slate-50 border-slate-200 text-slate-700')}
            {stat('មធ្យមភាគរួម', summary.schoolAvg != null ? toKh(summary.schoolAvg.toFixed(2)) : '-', 'bg-blue-50 border-blue-200 text-blue-700')}
            {stat('អត្រាជាប់', toKh(summary.passRate) + '%', 'bg-emerald-50 border-emerald-200 text-emerald-700')}
            {stat('A / B', toKh(summary.dist.A) + ' / ' + toKh(summary.dist.B), 'bg-amber-50 border-amber-200 text-amber-700')}
            {stat('E / F', toKh(summary.dist.E) + ' / ' + toKh(summary.dist.F), 'bg-rose-50 border-rose-200 text-rose-700')}
            {summary.absences.hasData && stat('អវត្តមាន (លើក)', toKh(summary.absences.total), 'bg-orange-50 border-orange-200 text-orange-700')}
            {summary.absences.hasData && stat('អត្រាវត្តមាន', toKh(summary.absences.attendanceRate) + '%', 'bg-teal-50 border-teal-200 text-teal-700')}
          </div>

          {/* AI / copy actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasGemini() && (
              <button onClick={runAi} disabled={aiBusy || summary.totalStudents === 0} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
                {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} បង្កើនជាមួយ AI
              </button>
            )}
            <button onClick={copyText} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'បានចម្លង' : 'ចម្លងអត្ថបទ'}
            </button>
            {aiText && <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1"><Sparkles size={12} /> បង្កើតដោយ AI</span>}
          </div>
          {aiError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{aiError}</p>}

          {/* Summary text */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-700 m-0">{shownText}</pre>
          </div>

          {!hasGemini() && (
            <p className="text-[11px] text-slate-400">
              💡 ដើម្បីបង្កើតជាមួយ AI៖ បន្ថែម <code className="px-1 bg-slate-100 rounded">VITE_GEMINI_API_KEY</code> (កូនសោ AI Studio ឥតគិតថ្លៃ) នៅក្នុង Vercel។ បើគ្មាន — សេចក្ដីសង្ខេបស្វ័យប្រវត្តិខាងលើនៅតែដំណើរការ។
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
