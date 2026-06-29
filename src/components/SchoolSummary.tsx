/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { X, Sparkles, Loader2, Copy, Check, BarChart3 } from 'lucide-react';
import { StudentScore } from '../types';
import { computeSchoolSummary, monthsWithData, summaryToKhmerText, summaryForPrompt, toKh, SummaryPeriod } from '../utils/schoolSummary';
import { hasGemini, generateSchoolSummaryAI } from '../lib/gemini';

interface SchoolSummaryProps {
  students: StudentScore[];
  scopeGrade?: string; // set for a class teacher → summarise only their class
  onClose: () => void;
}

// Dependency-free SVG donut of the absence reasons (excused / unexcused / late).
function AbsenceReasonChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;
  const size = 150, stroke = 26, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.filter(s => s.value > 0).map((s, i) => {
            const len = (s.value / total) * C;
            const seg = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
                strokeWidth={stroke} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800" style={{ fontSize: 22, fontWeight: 800 }}>{toKh(total)}</text>
        <text x="50%" y="60%" textAnchor="middle" dominantBaseline="central" className="fill-slate-400" style={{ fontSize: 11 }}>លើក</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 font-semibold min-w-[78px]">{s.label}</span>
            <span className="text-slate-800 font-bold">{toKh(s.value)}</span>
            <span className="text-slate-400">({toKh(Math.round((s.value / total) * 100))}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bars of WHY students were away (the per-student reason field).
function ReasonBars({ reasons }: { reasons: { reason: string; count: number }[] }) {
  const top = reasons.slice(0, 6);
  const max = Math.max(1, ...top.map(r => r.count));
  const total = reasons.reduce((a, r) => a + r.count, 0) || 1;
  return (
    <div className="space-y-2">
      {top.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-44 shrink-0 text-slate-600 truncate" title={r.reason}>{r.reason}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-4 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </div>
          <span className="w-6 text-right font-bold text-slate-800">{toKh(r.count)}</span>
          <span className="w-10 text-right text-slate-400">{toKh(Math.round((r.count / total) * 100))}%</span>
        </div>
      ))}
    </div>
  );
}

export default function SchoolSummary({ students, scopeGrade, onClose }: SchoolSummaryProps) {
  const months = useMemo(() => monthsWithData(students, scopeGrade), [students, scopeGrade]);
  const [periodKind, setPeriodKind] = useState<'month' | 'sem1' | 'sem2' | 'year'>('month');
  const [month, setMonth] = useState<string>(() => months[months.length - 1] || 'មិថុនា');
  const period = useMemo<SummaryPeriod>(() =>
    periodKind === 'sem1' ? { kind: 'semester', sem: 1 }
    : periodKind === 'sem2' ? { kind: 'semester', sem: 2 }
    : periodKind === 'year' ? { kind: 'year' }
    : { kind: 'month', month }, [periodKind, month]);
  const summary = useMemo(() => computeSchoolSummary(students, period, scopeGrade), [students, period, scopeGrade]);
  const computedText = useMemo(() => summaryToKhmerText(summary), [summary]);
  const resetAi = () => { setAiText(null); setAiError(''); };

  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);

  const runAi = async () => {
    setAiBusy(true); setAiError(''); setAiText(null);
    try {
      const text = await generateSchoolSummaryAI(summaryForPrompt(summary), summary.periodLabel);
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
              <h3 className="text-sm font-bold text-slate-800">{scopeGrade ? `សង្ខេបលទ្ធផលថ្នាក់ ${scopeGrade}` : 'សង្ខេបលទ្ធផលសិក្សារួមសាលា'}</h3>
              <p className="text-[11px] text-slate-500">លទ្ធផល · របាយការណ៍ · ចំណុចកែលម្អខែបន្ទាប់</p>
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Period selector — month / semester / year */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {([['month', 'ប្រចាំខែ'], ['sem1', 'ឆមាសទី១'], ['sem2', 'ឆមាសទី២'], ['year', 'ប្រចាំឆ្នាំ']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => { setPeriodKind(k); resetAi(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodKind === k ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {periodKind === 'month' && (
              <select value={month} onChange={e => { setMonth(e.target.value); resetAi(); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-indigo-500 focus:outline-none">
                {(months.length ? months : [month]).map(m => <option key={m} value={m}>ខែ{m}</option>)}
              </select>
            )}
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

          {/* Absence breakdown — by reason (why) and by type (excused/unexcused/late) */}
          {summary.absences.hasData && summary.absences.reasons.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">មូលហេតុនៃការអវត្តមាន — {summary.periodLabel}</h4>
              <ReasonBars reasons={summary.absences.reasons} />
            </div>
          )}
          {summary.absences.hasData && (summary.absences.permission + summary.absences.absent + summary.absences.late) > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-3">ប្រភេទនៃការអវត្តមាន — {summary.periodLabel}</h4>
              <AbsenceReasonChart segments={[
                { label: 'ច្បាប់', value: summary.absences.permission, color: '#3b82f6' },
                { label: 'អត់ច្បាប់', value: summary.absences.absent, color: '#ef4444' },
                { label: 'យឺត', value: summary.absences.late, color: '#f59e0b' },
              ]} />
            </div>
          )}

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
