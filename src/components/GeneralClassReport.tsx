/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, X, Send, CheckCircle2, Save, AlertTriangle } from 'lucide-react';
import { StudentScore } from '../types';
import { khmerMonthEnd } from '../utils/khmerDate';
import { submitReport, getSubmission, submissionDate, sendSubmissionToTelegram } from '../utils/reportSubmit';
import { exportElementToMultipagePdf } from '../utils/exportPdf';
import TeacherSignature from './TeacherSignature';

interface GeneralClassReportProps {
  students: StudentScore[];
  grade: string;
  period: string;       // month
  teacherName?: string;
  onClose: () => void;
}

// Subject / activity rows shared by sections 2 (taught) and 3 (next-month plan).
const ACTIVITY_ROWS = [
  'ភាសាខ្មែរ', 'គណិតវិទ្យា', 'សិក្សាសង្គម', 'វិទ្យាសាស្ត្រ', 'អប់រំកាយ-កីឡា', 'សុខភាព អនាម័យ',
  'បំណិនជីវិត', 'បណ្ណាល័យ', 'សកម្មភាព PLP', 'គម្រោងសិក្សា', 'កញ្ចប់អំណាន', 'ជំនួយគណិត',
  'កិច្ចការផ្ទះ', 'ថ្នាក់បន្ថែមថ្ងៃសៅរ៍', 'កិច្ចតែងការបង្រៀន', 'សកម្មភាពផ្សេងៗ',
];
const KH_NUM = ['១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩', '១០'];

// Module-level cell input (stable identity → keeps focus while typing).
function Cell({ value, onChange, center = true }: { value: string; onChange: (v: string) => void; center?: boolean }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-transparent outline-none focus:bg-blue-50 px-1 py-0.5 ${center ? 'text-center' : ''}`}
    />
  );
}
function Area({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Auto-grow the height to fit the text.
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{ overflow: 'hidden' }}
      className="w-full text-[13px] border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 resize-y leading-relaxed mb-2" />
  );
}
const td = 'border border-slate-300 px-1 py-1';
const th = 'border border-slate-300 px-1 py-1.5 font-bold bg-slate-100';

export default function GeneralClassReport({ students, grade, period, teacherName, onClose }: GeneralClassReportProps) {
  const storeKey = `genreport::${grade}::${period}`;
  const [f, setF] = useState<Record<string, string>>({});

  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); setF(s ? JSON.parse(s) : {}); } catch { setF({}); }
  }, [storeKey]);

  // Update state instantly; persist DEBOUNCED (per-keystroke localStorage writes
  // blocked the main thread and dropped characters while typing).
  const set = (key: string, value: string) => setF(prev => ({ ...prev, [key]: value }));
  const fRef = useRef(f);
  fRef.current = f;
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(storeKey, JSON.stringify(f)); } catch { /* ignore */ } }, 400);
    return () => clearTimeout(t);
  }, [f, storeKey]);
  useEffect(() => () => { try { localStorage.setItem(storeKey, JSON.stringify(fRef.current)); } catch { /* ignore */ } }, [storeKey]);
  const v = (k: string) => f[k] || '';

  // Submission state — the submit time becomes the report's printed date.
  const [submittedAt, setSubmittedAt] = useState<string>('');
  const [status, setStatus] = useState<'' | 'sent' | 'failed'>('');
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const s = getSubmission(storeKey);
    setSubmittedAt(s?.submittedAt || '');
    setStatus(s?.status || (s?.submittedAt ? 'sent' : '')); // legacy records = sent
  }, [storeKey]);

  // Explicit save — persist current answers immediately (they also auto-save).
  const handleSave = () => {
    try { localStorage.setItem(storeKey, JSON.stringify(f)); } catch { /* ignore */ }
    setToast('បានរក្សាទុក ✓');
    setTimeout(() => setToast(''), 2500);
  };

  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);
    // Send FIRST, then ALWAYS record the outcome (sent / failed) so the teacher
    // can tell whether the group actually received it.
    const submittedAtIso = new Date().toISOString();
    setSubmittedAt(submittedAtIso); // paint the date onto the sheet so the PDF shows it
    setToast('កំពុងផ្ញើរបាយការណ៍ជា PDF ចូល Telegram…');
    await new Promise(r => setTimeout(r, 60));
    const el = document.getElementById('gen-class-print');
    const meta = { key: storeKey, grade, period, type: 'general', title: 'របាយការណ៍ប្រចាំខែ ថ្នាក់ចំណេះដឹងទូទៅ', teacher: teacherName || '', submittedAt: submittedAtIso };
    const r = el ? await sendSubmissionToTelegram(el, meta) : { ok: false, error: 'no-element' };
    submitReport({ ...meta, data: f, status: r.ok ? 'sent' : 'failed', error: r.ok ? undefined : (r.error || 'failed') });
    setStatus(r.ok ? 'sent' : 'failed');
    if (r.ok) {
      setToast('បានផ្ញើរបាយការណ៍ជា PDF ចូល Telegram ✓');
    } else {
      setToast('');
      alert(r.error === 'no-secret' ? 'ផ្ញើមិនបាន — គ្មានពាក្យសម្ងាត់ Telegram (ANNOUNCE_SECRET)។'
        : r.error === 'no-element' ? 'ផ្ញើមិនបាន — រកមិនឃើញសន្លឹករបាយការណ៍។'
        : 'ផ្ញើទៅ Telegram មិនបាន៖ ' + (r.error || '') + '\nកំណត់ត្រា៖ បរាជ័យ — សូមចុច «ផ្ញើម្ដងទៀត»។');
    }
    setTimeout(() => setToast(''), 4000);
    setSending(false);
  };
  const subDate = submittedAt ? submissionDate(submittedAt) : null;

  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async () => {
    const el = document.getElementById('gen-class-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToMultipagePdf(el, 'CCC-General-Report'); }
    catch { alert('បង្កើត PDF មិនបានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setPdfBusy(false); }
  };

  // Auto-computed statistics for this class & month.
  const st = useMemo(() => {
    const recs = students.filter(s => s.grade === grade && s.month === period);
    const fem = (a: StudentScore[]) => a.filter(s => s.gender === 'ស្រី');
    const boys = recs.filter(s => s.gender === 'ប្រុស');
    const girls = fem(recs);
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const pass = recs.filter(s => s.result === 'ជាប់');
    const fail = recs.filter(s => s.result === 'ធ្លាក់');
    const slow = recs.filter(s => (s as any).status === 'រៀនយឺត');
    const drop = recs.filter(s => (s as any).status === 'បោះបង់');
    const abc = (arr: StudentScore[], key: 'khmerAvg' | 'mathAvg') => arr.filter(s => (s[key] ?? -1) >= 7).length;
    return {
      total: recs.length, female: girls.length, boys: boys.length, girlsLen: girls.length,
      pass: pass.length, passF: fem(pass).length, passPct: pct(pass.length, recs.length),
      fail: fail.length, failF: fem(fail).length, failPct: pct(fail.length, recs.length),
      slow: slow.length, slowF: fem(slow).length, slowPct: pct(slow.length, recs.length), slowList: slow,
      drop: drop.length, dropF: fem(drop).length, dropPct: pct(drop.length, recs.length),
      khmerAll: pct(abc(recs, 'khmerAvg'), recs.length), khmerB: pct(abc(boys, 'khmerAvg'), boys.length), khmerG: pct(abc(girls, 'khmerAvg'), girls.length),
      mathAll: pct(abc(recs, 'mathAvg'), recs.length), mathB: pct(abc(boys, 'mathAvg'), boys.length), mathG: pct(abc(girls, 'mathAvg'), girls.length),
    };
  }, [students, grade, period]);

  const Num = ({ n }: { n: number }) => <span className="font-bold">{n}</span>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rc-no-print fixed top-20 right-8 z-50 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl shadow-xl text-xs font-bold">
          🔔 {toast}
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">📄 របាយការណ៍ប្រចាំខែ ថ្នាក់ចំណេះដឹងទូទៅ</h3>
          <p className="text-xs text-slate-400 mt-0.5">{grade} • {period} — ស្ថិតិគណនាស្វ័យប្រវត្តិ ផ្នែកផ្សេងបំពេញដោយផ្ទាល់ (រក្សាទុកស្វ័យប្រវត្តិ)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm border border-slate-200 transition-colors">
            <Save size={13} /> រក្សាទុក
          </button>
          <button onClick={handleSubmit} disabled={sending} className={`px-4 py-2 ${status === 'sent' ? 'bg-emerald-600 hover:bg-emerald-700' : status === 'failed' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors`}>
            {status === 'sent' ? <CheckCircle2 size={13} /> : status === 'failed' ? <AlertTriangle size={13} /> : <Send size={13} />} {sending ? 'កំពុងផ្ញើ…' : status === 'sent' ? 'បានបញ្ជូន ✓' : status === 'failed' ? 'ផ្ញើមិនបាន ⚠ ផ្ញើម្ដងទៀត' : 'បញ្ជូនរបាយការណ៍'}
          </button>
          <button onClick={handlePdf} disabled={pdfBusy} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <Printer size={13} /> {pdfBusy ? 'កំពុងបង្កើត…' : 'ទាញយក PDF'}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {/* Printable sheet */}
      <div id="gen-class-print" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print:p-0 print:border-0 print:shadow-none text-slate-800 text-[12px] leading-relaxed">

        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h1 className="text-lg font-extrabold tracking-wide">របាយការណ៍ប្រចាំខែថ្នាក់ចំណេះដឹងទូទៅ</h1>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-1 mb-4 text-[13px]">
          <div><span className="font-bold">សម្រាប់ខែ៖</span> {period}</div>
          <div><span className="font-bold">ថ្នាក់៖</span> {grade}</div>
          <div><span className="font-bold">គ្រូបន្ទុកថ្នាក់៖</span> {teacherName || '____________'}</div>
        </div>

        {/* 1. Study results */}
        <SectionTitle title="១. ព័ត៌មានអំពីលទ្ធផលនៃការសិក្សា" />

        {/* Table A: enrolment */}
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr>
              <th className={th} colSpan={2}>សិស្សដើមឆ្នាំ</th>
              <th className={th} colSpan={2}>សិស្សក្នុងខែ</th>
              <th className={th} colSpan={3}>សិស្សបោះបង់</th>
              <th className={th} colSpan={2}>សិស្សអវត្តមានច្រើន</th>
            </tr>
            <tr className="text-[11px]">
              <th className={th}>សរុប</th><th className={th}>ស្រី</th>
              <th className={th}>សរុប</th><th className={th}>ស្រី</th>
              <th className={th}>សរុប</th><th className={th}>ស្រី</th><th className={th}>%</th>
              <th className={th}>សរុប</th><th className={th}>%</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className={td}><Cell value={v('startTotal')} onChange={x => set('startTotal', x)} /></td>
              <td className={td}><Cell value={v('startFemale')} onChange={x => set('startFemale', x)} /></td>
              <td className={td}><Num n={st.total} /></td>
              <td className={td}><Num n={st.female} /></td>
              <td className={td}><Num n={st.drop} /></td>
              <td className={td}><Num n={st.dropF} /></td>
              <td className={td}>{st.dropPct}%</td>
              <td className={td}><Cell value={v('absMany')} onChange={x => set('absMany', x)} /></td>
              <td className={td}><Cell value={v('absManyPct')} onChange={x => set('absManyPct', x)} /></td>
            </tr>
          </tbody>
        </table>

        {/* Table B: pass / fail / slow */}
        <table className="w-full border-collapse mb-3">
          <thead>
            <tr>
              <th className={th} colSpan={3}>សិស្សជាប់មធ្យមភាគ</th>
              <th className={th} colSpan={3}>សិស្សធ្លាក់មធ្យមភាគ</th>
              <th className={th} colSpan={3}>សិស្សរៀនយឺត</th>
            </tr>
            <tr className="text-[11px]">
              <th className={th}>សរុប</th><th className={th}>ស្រី</th><th className={th}>%</th>
              <th className={th}>សរុប</th><th className={th}>ស្រី</th><th className={th}>%</th>
              <th className={th}>សរុប</th><th className={th}>ស្រី</th><th className={th}>%</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className={td}><Num n={st.pass} /></td><td className={td}><Num n={st.passF} /></td><td className={td}>{st.passPct}%</td>
              <td className={td}><Num n={st.fail} /></td><td className={td}><Num n={st.failF} /></td><td className={td}>{st.failPct}%</td>
              <td className={td}><Num n={st.slow} /></td><td className={td}><Num n={st.slowF} /></td><td className={td}>{st.slowPct}%</td>
            </tr>
          </tbody>
        </table>

        {/* Table C: ABC percentages */}
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className={th} colSpan={3}>ភាគរយ ABC មុខវិជ្ជាភាសាខ្មែរ</th>
              <th className={th} colSpan={3}>ភាគរយ ABC មុខវិជ្ជាគណិត</th>
              <th className={th} colSpan={3}>ភាគរយ ABC សមត្ថភាពអានស្តង់ដា (១នាទី)</th>
            </tr>
            <tr className="text-[11px]">
              <th className={th}>សរុប</th><th className={th}>ប្រុស</th><th className={th}>ស្រី</th>
              <th className={th}>សរុប</th><th className={th}>ប្រុស</th><th className={th}>ស្រី</th>
              <th className={th}>សរុប</th><th className={th}>ប្រុស</th><th className={th}>ស្រី</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className={td}>{st.khmerAll}%</td><td className={td}>{st.khmerB}%</td><td className={td}>{st.khmerG}%</td>
              <td className={td}>{st.mathAll}%</td><td className={td}>{st.mathB}%</td><td className={td}>{st.mathG}%</td>
              <td className={td}><Cell value={v('readAll')} onChange={x => set('readAll', x)} /></td>
              <td className={td}><Cell value={v('readB')} onChange={x => set('readB', x)} /></td>
              <td className={td}><Cell value={v('readG')} onChange={x => set('readG', x)} /></td>
            </tr>
          </tbody>
        </table>

        {/* 2 & 3. Activities taught / next plan */}
        {([
          { num: '២', title: 'សកម្មភាពរៀន និងបង្រៀន', prefix: 's2', lessonHead: 'ចំណងជើងមេរៀន (ទំព័រ) ដែលបានបង្រៀន' },
          { num: '៣', title: 'ផែនការរៀន និងបង្រៀនខែបន្ទាប់', prefix: 's3', lessonHead: 'ចំណងជើងមេរៀន / សកម្មភាពគ្រោងបង្រៀន' },
        ] as const).map(sec => (
          <div key={sec.prefix}>
            <SectionTitle title={`${sec.num}. ${sec.title}`} />
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr>
                  <th className={`${th} w-44`}>មុខវិជ្ជា-សកម្មភាព</th>
                  <th className={th}>{sec.lessonHead}</th>
                  <th className={`${th} w-28`}>ភាគរយ(%) សម្រេចបាន</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVITY_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td className={`${td} font-semibold`}>{row}</td>
                    <td className={td}><Cell value={v(`${sec.prefix}_${i}_lesson`)} onChange={x => set(`${sec.prefix}_${i}_lesson`, x)} center={false} /></td>
                    <td className={td}><Cell value={v(`${sec.prefix}_${i}_pct`)} onChange={x => set(`${sec.prefix}_${i}_pct`, x)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* 4. Slow learners list */}
        <SectionTitle title="៤. ចំនួនសិស្សរៀនយឺត" />
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className={`${th} w-10`}>ល.រ</th><th className={th}>ឈ្មោះ</th><th className={`${th} w-14`}>ភេទ</th>
              <th className={th}>មុខវិជ្ជា</th><th className={th}>ផែនការរំលស់ (ជួយបំប៉ន)</th><th className={th}>ផ្សេងៗ</th>
            </tr>
          </thead>
          <tbody>
            {KH_NUM.map((kn, i) => {
              const auto = st.slowList[i];
              return (
                <tr key={i}>
                  <td className={`${td} text-center`}>{kn}</td>
                  <td className={td}><Cell value={f[`slow_${i}_name`] ?? (auto ? auto.name : '')} onChange={x => set(`slow_${i}_name`, x)} center={false} /></td>
                  <td className={`${td} text-center`}><Cell value={f[`slow_${i}_gender`] ?? (auto ? auto.gender : '')} onChange={x => set(`slow_${i}_gender`, x)} /></td>
                  <td className={td}><Cell value={v(`slow_${i}_subject`)} onChange={x => set(`slow_${i}_subject`, x)} center={false} /></td>
                  <td className={td}><Cell value={v(`slow_${i}_plan`)} onChange={x => set(`slow_${i}_plan`, x)} center={false} /></td>
                  <td className={td}><Cell value={v(`slow_${i}_other`)} onChange={x => set(`slow_${i}_other`, x)} center={false} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 5. Absentees list */}
        <SectionTitle title="៥. សិស្សអវត្តមាន ចាប់ពី ៣ដងឡើង ដោយគ្មានច្បាប់" />
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className={`${th} w-10`}>ល.រ</th><th className={th}>ឈ្មោះ</th><th className={`${th} w-14`}>ភេទ</th>
              <th className={th}>ចំនួនអវត្តមាន</th><th className={th}>មូលហេតុ</th><th className={th}>ទំនាក់ទំនងអ្នកអាណាព្យាបាល</th>
            </tr>
          </thead>
          <tbody>
            {KH_NUM.map((kn, i) => (
              <tr key={i}>
                <td className={`${td} text-center`}>{kn}</td>
                <td className={td}><Cell value={v(`abs_${i}_name`)} onChange={x => set(`abs_${i}_name`, x)} center={false} /></td>
                <td className={`${td} text-center`}><Cell value={v(`abs_${i}_gender`)} onChange={x => set(`abs_${i}_gender`, x)} /></td>
                <td className={`${td} text-center`}><Cell value={v(`abs_${i}_count`)} onChange={x => set(`abs_${i}_count`, x)} /></td>
                <td className={td}><Cell value={v(`abs_${i}_reason`)} onChange={x => set(`abs_${i}_reason`, x)} center={false} /></td>
                <td className={td}><Cell value={v(`abs_${i}_guardian`)} onChange={x => set(`abs_${i}_guardian`, x)} center={false} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 6. Challenges & solutions */}
        <SectionTitle title="៦. បញ្ហាប្រឈម និងដំណោះស្រាយ" />
        <Area value={v('challenges')} onChange={x => set('challenges', x)} rows={4} />

        {/* Signature */}
        <div className="flex justify-end mt-10 text-center text-[13px]">
          <div className="space-y-1">
            <p>{subDate ? subDate.lunar : khmerMonthEnd(period).lunar}</p>
            <p>ច្បារច្រុះ ថ្ងៃទី{subDate ? subDate.day : '.........'} ខែ{subDate ? subDate.month : '.........'} ឆ្នាំ{subDate ? subDate.year : khmerMonthEnd(period).year}</p>
            <p className="font-bold pt-2">គ្រូបន្ទុកថ្នាក់</p>
            <TeacherSignature grade={grade} height={64} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-[14px] font-bold text-slate-800 mt-6 mb-2 border-l-4 border-blue-600 pl-2">{title}</h2>;
}
