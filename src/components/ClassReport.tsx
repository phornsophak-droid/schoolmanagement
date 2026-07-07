/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Printer, X, Send, CheckCircle2 } from 'lucide-react';
import { StudentScore } from '../types';
import HealthClinicReport from './HealthClinicReport';
import GeneralClassReport from './GeneralClassReport';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature from './TeacherSignature';
import { submitReport, getSubmission, submissionDate, sendSubmissionToTelegram } from '../utils/reportSubmit';
import { exportElementToMultipagePdf } from '../utils/exportPdf';

const SCHOOL_NAME = 'សាលាសហគមន៍ច្បារច្រុះ';

// ===========================================================================
// Report template definitions
// ===========================================================================

type Block =
  | { kind: 'attendance'; num: string; title: string; totalLabel: string; avgLabel: string; absenceLabel?: string; rateLabel: string; commentsLabel: string }
  | { kind: 'studyResult'; num: string; title: string; commentsLabel: string }
  | { kind: 'text'; num: string; title: string; label?: string; field: string; default?: string; rows?: number }
  | { kind: 'progress'; num: string; title: string; strengthsLabel: string; improvementsLabel: string; defaultStrengths?: string; defaultImprovements?: string }
  | { kind: 'multiText'; num: string; title: string; items: { label: string; field: string; rows?: number }[] }
  | { kind: 'levelTable'; valueHeader: string; rows: { label: string; field: string }[] };

export interface ReportTemplate {
  key: string;
  title: string;
  subtitle?: string;
  aggregateKeyword?: string; // when the base label is chosen, aggregate all sections sharing this keyword
  showHeaderTotal?: boolean; // show the auto student count in the header
  signatureStyle?: 'simple' | 'approval';
  blocks: Block[];
}

// English after-hours class report (matches the school's English Class Report).
const ENGLISH_TEMPLATE: ReportTemplate = {
  key: 'english',
  title: 'English Class Report',
  subtitle: 'របាយការណ៍លទ្ធផលថ្នាក់ភាសាអង់គ្លេស',
  aggregateKeyword: 'អង់គ្លេស',
  blocks: [
    { kind: 'attendance', num: '1', title: 'Student Attendance (វត្តមានសិស្ស)', totalLabel: 'Total Students Enrolled (សិស្សសរុប)', avgLabel: 'Average Attendance (មធ្យមភាគមានវត្តមាន)', absenceLabel: 'Average Absence (មធ្យមភាគអវត្តមាន)', rateLabel: 'Attendance Rate (អត្រាវត្តមាន)', commentsLabel: 'Attendance Comments (មតិយោបល់អំពីវត្តមាន)' },
    { kind: 'studyResult', num: '2', title: 'Study Result (លទ្ធផលសិក្សា)', commentsLabel: 'Comments (មតិយោបល់)' },
    { kind: 'text', num: '3', title: 'Topics Covered (មេរៀនដែលបានសិក្សា)', label: 'During this reporting period, students learned:', field: 'topicsCovered', rows: 4 },
    { kind: 'progress', num: '4', title: 'Student Progress (វឌ្ឍនភាពសិស្ស)', strengthsLabel: 'Strengths and Achievements (ចំណុចខ្លាំង និងសមិទ្ធផល)', improvementsLabel: 'Areas for Improvement (ចំណុចគួរកែលម្អ)',
      defaultStrengths: '• ការកើនឡើងនៃវាក្យសព្ទ និងការផ្គុំប្រយោគ។\n• ការចូលរួមកាន់តែច្រើនក្នុងសកម្មភាពថ្នាក់រៀន។\n• ជំនាញអាន និងការយល់ន័យល្អប្រសើរ។\n• ទំនុកចិត្តក្នុងការនិយាយភាសាអង់គ្លេសកាន់តែខ្លាំង។',
      defaultImprovements: '• ការបញ្ចេញសំឡេង (Pronunciation)\n• ការប្រកប (Spelling)\n• ការយល់ន័យពេលស្តាប់ (Listening)\n• ទំនុកចិត្តក្នុងការនិយាយ\n• ជំនាញសរសេរ' },
    { kind: 'text', num: '5', title: 'Challenges (បញ្ហាប្រឈម)', field: 'challenges', rows: 3 },
    { kind: 'text', num: '6', title: 'Support and Interventions (ការគាំទ្រ និងអន្តរាគមន៍)', field: 'support', rows: 4,
      default: '• ការគាំទ្រជាក្រុមតូចសម្រាប់សិស្សដែលជួបការលំបាក។\n• សកម្មភាពអនុវត្តបន្ថែម និងកិច្ចការផ្ទះ។\n• ល្បែងអន្តរកម្ម និងលំហាត់និយាយ។\n• លើកទឹកចិត្តឱ្យអាន និងអនុវត្តភាសាអង់គ្លេសនៅផ្ទះ។' },
    { kind: 'text', num: '7', title: 'Success Stories (រឿងជោគជ័យ)', label: 'សូមចែករំលែកសមិទ្ធផល ឬលទ្ធផលវិជ្ជមានរបស់សិស្ស៖', field: 'successStories', rows: 3 },
    { kind: 'text', num: '8', title: 'Plan for the Next Reporting Period (ផែនការសម្រាប់រយៈពេលបន្ទាប់)', field: 'nextPlan', rows: 3 },
    { kind: 'text', num: '9', title: "Teacher's Reflection (ការឆ្លុះបញ្ចាំងរបស់គ្រូ)", label: 'សូមរៀបរាប់ការសង្កេត ការព្រួយបារម្ភ និងអនុសាសន៍របស់អ្នក៖', field: 'reflection', rows: 3 },
  ],
};

// Physical-Education & Sports after-hours class report (all Khmer).
const SPORTS_TEMPLATE: ReportTemplate = {
  key: 'sports',
  title: 'របាយការណ៍ថ្នាក់អប់រំកាយ និងកីឡា',
  subtitle: 'Physical Education & Sports Class Report',
  blocks: [
    { kind: 'attendance', num: '១', title: 'ស្ថានភាពវត្តមានសិស្ស', totalLabel: 'ចំនួនសិស្សសរុប', avgLabel: 'ចំនួនសិស្សចូលរៀនជាមធ្យម', rateLabel: 'ភាគរយវត្តមាន', commentsLabel: 'កំណត់សម្គាល់អំពីវត្តមាន៖' },
    { kind: 'text', num: '២', title: 'សកម្មភាពដែលបានអនុវត្ត', label: 'ក្នុងអំឡុងពេលរាយការណ៍នេះ សិស្សបានចូលរួមសកម្មភាពដូចជា៖', field: 'activities', rows: 4 },
    { kind: 'progress', num: '៣', title: 'វឌ្ឍនភាពសិស្ស', strengthsLabel: 'ចំណុចល្អ និងសមិទ្ធផល', improvementsLabel: 'ចំណុចដែលត្រូវកែលម្អ' },
    { kind: 'text', num: '៤', title: 'បញ្ហាប្រឈម', field: 'challenges', rows: 3 },
    { kind: 'text', num: '៥', title: 'សុវត្ថិភាព និងសុខុមាលភាពសិស្ស', field: 'safety', rows: 3 },
    { kind: 'text', num: '៦', title: 'សមិទ្ធផលគួរឱ្យកត់សម្គាល់', field: 'achievements', rows: 3 },
    { kind: 'text', num: '៧', title: 'បញ្ហាប្រឈម (បន្ថែម)', field: 'challenges2', rows: 3 },
    { kind: 'text', num: '៨', title: 'ផែនការសម្រាប់រយៈពេលបន្ទាប់', field: 'nextPlan', rows: 3 },
    { kind: 'text', num: '៩', title: 'ការឆ្លុះបញ្ចាំងរបស់គ្រូ', field: 'reflection', rows: 4 },
  ],
};

// Art after-hours class report (all Khmer; competency-level table instead of A-F).
const ART_TEMPLATE: ReportTemplate = {
  key: 'art',
  title: 'របាយការណ៍សកម្មភាព និងលទ្ធផលសិក្សាថ្នាក់គំនូរ',
  subtitle: 'Art Class Activity & Result Report',
  showHeaderTotal: true,
  signatureStyle: 'approval',
  blocks: [
    { kind: 'multiText', num: '១', title: 'សេចក្តីផ្តើម និងគោលបំណង (Introduction & Objectives)', items: [
      { label: 'សេចក្តីផ្តើម៖', field: 'introduction', rows: 2 },
      { label: 'គោលបំណង៖', field: 'objectives', rows: 3 },
    ]},
    { kind: 'text', num: '២', title: 'ខ្លឹមសារមេរៀន និងសកម្មភាពអនុវត្ត (Key Activities)', field: 'activities', rows: 4 },
    { kind: 'multiText', num: '៣', title: 'លទ្ធផល និងវឌ្ឍនភាពរបស់សិស្ស (Results & Progress)', items: [
      { label: 'ការចូលរួម៖', field: 'participation', rows: 2 },
      { label: 'ជំនាញបច្ចេកទេស៖', field: 'techSkills', rows: 2 },
      { label: 'ភាពច្នៃប្រឌិត៖', field: 'creativity', rows: 2 },
    ]},
    { kind: 'levelTable', valueHeader: 'កម្រិតសមត្ថភាព / ការវាយតម្លៃ', rows: [
      { label: 'កម្រិតខ្ពស់ (ពូកែ និងមានគំនិតច្នៃប្រឌិតខ្ពស់)', field: 'levelHigh' },
      { label: 'កម្រិតមធ្យម (យល់បច្ចេកទេស និងគូរបានល្អ)', field: 'levelMid' },
      { label: 'កម្រិតមូលដ្ឋាន (ត្រូវការការណែនាំបន្ថែម)', field: 'levelBasic' },
    ]},
    { kind: 'multiText', num: '៤', title: 'បញ្ហាប្រឈម និងដំណោះស្រាយ (Challenges & Solutions)', items: [
      { label: 'បញ្ហាប្រឈម៖', field: 'challenges', rows: 2 },
      { label: 'ដំណោះស្រាយ៖', field: 'solutions', rows: 2 },
    ]},
    { kind: 'text', num: '៥', title: 'ទិសដៅអនុវត្តបន្ត (Future Plans)', field: 'futurePlans', rows: 3 },
    { kind: 'text', num: '៦', title: 'សេចក្តីសន្និដ្ឋាន (Conclusion)', field: 'conclusion', rows: 3 },
  ],
};

// The Health class uses a bespoke clinic monthly report (rendered by
// HealthClinicReport); only the key is needed here to route to it.
const HEALTH_TEMPLATE: ReportTemplate = {
  key: 'health',
  title: 'របាយការណ៍ប្រចាំខែ គិលានុបដ្ឋាកយិកា',
  blocks: [],
};

// General-knowledge classes (មត្តេយ្យ–ទី៦) use a bespoke monthly report rendered
// by GeneralClassReport; only the key is needed to route to it.
const GENERAL_TEMPLATE: ReportTemplate = {
  key: 'general',
  title: 'របាយការណ៍ប្រចាំខែថ្នាក់ចំណេះដឹងទូទៅ',
  blocks: [],
};

// After-hours subject keywords. A class matching one of these but with no
// bespoke template (e.g. Computer) keeps the generic wizard rather than the
// general-knowledge report.
const EXTRA_KEYWORDS = ['អង់គ្លេស', 'អប់រំសុខភាព', 'កីឡា', 'អប់រំកាយ', 'គំនូរ', 'កុំព្យូទ័រ'];

// Return the report template that fits a class, or null if it uses the default report.
export function getReportTemplate(grade: string): ReportTemplate | null {
  const g = grade || '';
  if (g.includes('អង់គ្លេស') || g.includes('GRADE')) return ENGLISH_TEMPLATE;
  if (g.includes('អប់រំសុខភាព')) return HEALTH_TEMPLATE;
  if (g.includes('កីឡា') || g.includes('អប់រំកាយ')) return SPORTS_TEMPLATE;
  if (g.includes('គំនូរ')) return ART_TEMPLATE;
  if (EXTRA_KEYWORDS.some(k => g.includes(k))) return null; // other after-hours class → wizard
  return GENERAL_TEMPLATE; // general-knowledge classes
}

// ===========================================================================
// Component
// ===========================================================================

interface ClassReportProps {
  template: ReportTemplate;
  students: StudentScore[];
  grade: string;
  period: string;
  teacherName?: string;
  onClose: () => void;
}

const letterOf = (avg: number | null): string => {
  if (avg === null || avg === undefined) return '-';
  if (avg >= 9.0) return 'A';
  if (avg >= 8.0) return 'B';
  if (avg >= 7.0) return 'C';
  if (avg >= 6.0) return 'D';
  if (avg >= 5.0) return 'E';
  return 'F';
};

export default function ClassReport({ template, students, grade, period, teacherName, onClose }: ClassReportProps) {
  const storeKey = `classreport::${template.key}::${grade}::${period}`;

  // Build the default field values from the template.
  const defaults = useMemo(() => {
    const d: Record<string, string> = { date: new Date().toLocaleDateString('en-CA'), attAvgPresent: '', attAvgAbsent: '', attRate: '', attendanceComments: '', studyComments: '', strengths: '', improvements: '' };
    template.blocks.forEach(b => {
      if (b.kind === 'text') d[b.field] = b.default || '';
      if (b.kind === 'progress') { d.strengths = b.defaultStrengths || ''; d.improvements = b.defaultImprovements || ''; }
      if (b.kind === 'multiText') b.items.forEach(it => { d[it.field] = ''; });
      if (b.kind === 'levelTable') b.rows.forEach(r => { d[`${r.field}Count`] = ''; d[`${r.field}Pct`] = ''; });
    });
    return d;
  }, [template]);

  const [fields, setFields] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...defaults };
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      setFields(saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults });
    } catch { setFields({ ...defaults }); }
  }, [storeKey, defaults]);

  // Update state instantly; persist DEBOUNCED (per-keystroke localStorage writes
  // blocked the main thread and dropped characters while typing).
  const update = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(storeKey, JSON.stringify(fields)); } catch { /* ignore */ } }, 400);
    return () => clearTimeout(t);
  }, [fields, storeKey]);
  useEffect(() => () => { try { localStorage.setItem(storeKey, JSON.stringify(fieldsRef.current)); } catch { /* ignore */ } }, [storeKey]);

  // Submission — saves to the cloud for the principal; the submit time becomes the date.
  const [submittedAt, setSubmittedAt] = useState<string>('');
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { setSubmittedAt(getSubmission(storeKey)?.submittedAt || ''); }, [storeKey]);
  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);
    // Send FIRST, record ONLY if Telegram confirms — otherwise the "បានបញ្ជូន ✓"
    // log would lie (report shown as submitted while the group never got it).
    const submittedAtIso = new Date().toISOString();
    const d = submissionDate(submittedAtIso);
    const stamped = { ...fields, date: `ច្បារច្រុះ ថ្ងៃទី${d.day} ខែ${d.month} ឆ្នាំ${d.year}` };
    setFields(stamped);
    try { localStorage.setItem(storeKey, JSON.stringify(stamped)); } catch { /* ignore */ }
    setToast('កំពុងផ្ញើរបាយការណ៍ជា PDF ចូល Telegram…');
    await new Promise(r => setTimeout(r, 60));
    const el = document.getElementById('class-report-print');
    const meta = { key: storeKey, grade, period, type: template.key, title: template.title, teacher: teacherName || '', submittedAt: submittedAtIso };
    const r = el ? await sendSubmissionToTelegram(el, meta) : { ok: false, error: 'no-element' };
    if (r.ok) {
      submitReport({ ...meta, data: stamped });
      setSubmittedAt(submittedAtIso);
      setToast('បានផ្ញើរបាយការណ៍ជា PDF ចូល Telegram ✓');
    } else {
      setToast('');
      alert(r.error === 'no-secret' ? 'មិនបានផ្ញើ — គ្មានពាក្យសម្ងាត់ Telegram (ANNOUNCE_SECRET)។'
        : r.error === 'no-element' ? 'មិនបានផ្ញើ — រកមិនឃើញសន្លឹករបាយការណ៍។'
        : 'ផ្ញើទៅ Telegram មិនបាន៖ ' + (r.error || '') + '\nរបាយការណ៍មិនត្រូវបានកត់ត្រាថាបញ្ជូនទេ — សូមព្យាយាមម្ដងទៀត។');
    }
    setTimeout(() => setToast(''), 4000);
    setSending(false);
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async () => {
    const el = document.getElementById('class-report-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToMultipagePdf(el, 'CCC-Report'); }
    catch { alert('បង្កើត PDF មិនបានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setPdfBusy(false); }
  };

  // Unique students + A–F distribution from each student's mean score.
  const stats = useMemo(() => {
    let recs = students.filter(s => s.grade === grade);
    if (recs.length === 0 && template.aggregateKeyword) {
      recs = students.filter(s => (s.grade || '').includes(template.aggregateKeyword!)
        || (template.aggregateKeyword === 'អង់គ្លេស' && (s.grade || '').includes('GRADE')));
    }
    const byStudent = new Map<string, number[]>();
    recs.forEach(s => {
      const key = `${s.name.trim()}_${s.gender}`;
      if (!byStudent.has(key)) byStudent.set(key, []);
      if (s.overallAvg !== null && s.overallAvg !== undefined) byStudent.get(key)!.push(s.overallAvg);
    });
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    byStudent.forEach(vals => {
      if (vals.length === 0) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const letter = letterOf(avg);
      if (letter !== '-') dist[letter]++;
    });
    return { total: byStudent.size, dist };
  }, [students, grade, template]);

  // The Health class has a bespoke clinic form rather than the block layout.
  if (template.key === 'health') {
    return <HealthClinicReport grade={grade} period={period} teacherName={teacherName} onClose={onClose} />;
  }
  // General-knowledge classes use their own statistics-rich monthly report.
  if (template.key === 'general') {
    return <GeneralClassReport students={students} grade={grade} period={period} teacherName={teacherName} onClose={onClose} />;
  }

  const lineInput = 'border-b border-slate-300 outline-none focus:border-blue-500 bg-transparent px-1';

  return (
    <div className="space-y-4">
      {toast && (
        <div className="print:hidden fixed top-20 right-8 z-50 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl shadow-xl text-xs font-bold">
          🔔 {toast}
        </div>
      )}
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">📄 {template.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{grade} • {period} — ស្ថិតិបំពេញស្វ័យប្រវត្តិ ផ្នែកអត្ថបទសរសេរដោយផ្ទាល់ (រក្សាទុកស្វ័យប្រវត្តិ)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSubmit} disabled={sending} className={`px-4 py-2 ${submittedAt ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors`}>
            {submittedAt ? <CheckCircle2 size={13} /> : <Send size={13} />} {sending ? 'កំពុងផ្ញើ…' : submittedAt ? 'បានបញ្ជូន ✓' : 'បញ្ជូនរបាយការណ៍'}
          </button>
          <button onClick={handlePdf} disabled={pdfBusy} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <Printer size={13} /> {pdfBusy ? 'កំពុងបង្កើត…' : 'ទាញយក PDF'}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {/* The printable report sheet */}
      <div id="class-report-print" className="rc-grow-inputs bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print:p-0 print:border-0 print:shadow-none text-slate-800 text-sm leading-relaxed">

        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-5">
          <h1 className="text-lg font-extrabold uppercase tracking-wide">{template.title}</h1>
          {template.subtitle && <p className="text-xs text-slate-500 mt-0.5">{template.subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 text-[13px]">
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">ឈ្មោះសាលា៖</span><span>{SCHOOL_NAME}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">គ្រូបង្រៀន៖</span><span>{teacherName || '__________________'}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">ថ្នាក់៖</span><span>{grade}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">រយៈពេលរាយការណ៍៖</span><span>{period}</span></div>
          <div className="flex gap-2 items-center">
            <span className="font-bold whitespace-nowrap">កាលបរិច្ឆេទ៖</span>
            <input value={fields.date} onChange={e => update('date', e.target.value)} className={`${lineInput} w-40`} />
          </div>
          {template.showHeaderTotal && (
            <div className="flex gap-2"><span className="font-bold whitespace-nowrap">ចំនួនសិស្សសរុប៖</span><span className="font-bold">{stats.total} នាក់</span></div>
          )}
        </div>

        {template.blocks.map(block => {
          if (block.kind === 'attendance') {
            return (
              <div key={block.num}>
                <SectionTitle n={block.num} title={block.title} />
                <table className="w-full border-collapse text-[13px] mb-2">
                  <tbody>
                    <Row label={block.totalLabel} value={<span className="font-bold">{stats.total}</span>} />
                    <Row label={block.avgLabel} value={<input value={fields.attAvgPresent} onChange={e => update('attAvgPresent', e.target.value)} className={`${lineInput} w-24 text-center`} />} />
                    {block.absenceLabel && <Row label={block.absenceLabel} value={<input value={fields.attAvgAbsent} onChange={e => update('attAvgAbsent', e.target.value)} className={`${lineInput} w-24 text-center`} />} />}
                    <Row label={block.rateLabel} value={<span><input value={fields.attRate} onChange={e => update('attRate', e.target.value)} className={`${lineInput} w-16 text-center`} /> %</span>} />
                  </tbody>
                </table>
                <FieldArea label={block.commentsLabel} value={fields.attendanceComments} onChange={v => update('attendanceComments', v)} rows={2} />
              </div>
            );
          }
          if (block.kind === 'studyResult') {
            return (
              <div key={block.num}>
                <SectionTitle n={block.num} title={block.title} />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map(g => (
                    <div key={g} className="flex items-center justify-center gap-1.5 border border-slate-300 rounded-lg py-1.5">
                      <span className="font-extrabold text-slate-700">{g} =</span>
                      <span className="font-mono font-bold text-blue-700">{stats.dist[g]}</span>
                    </div>
                  ))}
                </div>
                <FieldArea label={block.commentsLabel} value={fields.studyComments} onChange={v => update('studyComments', v)} rows={2} />
              </div>
            );
          }
          if (block.kind === 'progress') {
            return (
              <div key={block.num}>
                <SectionTitle n={block.num} title={block.title} />
                <FieldArea label={block.strengthsLabel} value={fields.strengths} onChange={v => update('strengths', v)} rows={4} />
                <FieldArea label={block.improvementsLabel} value={fields.improvements} onChange={v => update('improvements', v)} rows={4} />
              </div>
            );
          }
          if (block.kind === 'multiText') {
            return (
              <div key={block.num}>
                <SectionTitle n={block.num} title={block.title} />
                {block.items.map(it => (
                  <div key={it.field}>
                    <FieldArea label={it.label} value={fields[it.field] ?? ''} onChange={v => update(it.field, v)} rows={it.rows || 2} />
                  </div>
                ))}
              </div>
            );
          }
          if (block.kind === 'levelTable') {
            const totalCount = block.rows.reduce((sum, r) => sum + (parseFloat(fields[`${r.field}Count`] || '') || 0), 0);
            return (
              <table key="levelTable" className="w-full border-collapse text-[13px] mb-4 mt-1">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="border border-slate-300 px-2 py-2 w-12 font-bold">ល.រ</th>
                    <th className="border border-slate-300 px-2 py-2 text-left font-bold">{block.valueHeader}</th>
                    <th className="border border-slate-300 px-2 py-2 w-32 font-bold">ចំនួនសិស្ស (នាក់)</th>
                    <th className="border border-slate-300 px-2 py-2 w-24 font-bold">ភាគរយ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((r, i) => (
                    <tr key={r.field}>
                      <td className="border border-slate-300 px-2 py-2 text-center">{['១', '២', '៣', '៤', '៥'][i] || i + 1}</td>
                      <td className="border border-slate-300 px-2 py-2">{r.label}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center"><input value={fields[`${r.field}Count`] ?? ''} onChange={e => update(`${r.field}Count`, e.target.value)} className={`${lineInput} w-16 text-center`} /></td>
                      <td className="border border-slate-300 px-2 py-2 text-center"><input value={fields[`${r.field}Pct`] ?? ''} onChange={e => update(`${r.field}Pct`, e.target.value)} className={`${lineInput} w-12 text-center`} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="border border-slate-300 px-2 py-2 text-center" colSpan={2}>សរុប</td>
                    <td className="border border-slate-300 px-2 py-2 text-center">{totalCount || '—'}</td>
                    <td className="border border-slate-300 px-2 py-2 text-center">១០០%</td>
                  </tr>
                </tbody>
              </table>
            );
          }
          // text
          return (
            <div key={block.num}>
              <SectionTitle n={block.num} title={block.title} />
              <FieldArea label={block.label || ''} value={fields[block.field] ?? ''} onChange={v => update(block.field, v)} rows={block.rows || 3} />
            </div>
          );
        })}

        {/* Signature */}
        {template.signatureStyle === 'approval' ? (
          <div className="grid grid-cols-2 gap-8 mt-12 text-[13px] text-center">
            <div className="space-y-1">
              <p className="font-bold">បានឃើញ និងពិនិត្យត្រឹមត្រូវ</p>
              <p className="font-bold">នាយកសាលា/ប្រធានស្ថាប័ន</p>
              <PrincipalSignature />
            </div>
            <div className="space-y-1">
              <p>ថ្ងៃ.......... ខែ.......... ឆ្នាំ២០....</p>
              <p className="font-bold">អ្នកធ្វើរបាយការណ៍</p>
              <p className="font-bold">គ្រូបង្រៀន</p>
              <TeacherSignature grade={grade} height={60} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 mt-10 text-[13px]">
            <div className="space-y-1">
              <p><span className="font-bold">គ្រូបង្រៀន</span></p>
              <TeacherSignature grade={grade} height={60} />
            </div>
            <div className="text-right space-y-1">
              <p className="pt-6"><span className="font-bold">កាលបរិច្ឆេទ៖</span> {fields.date}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="text-[13px] font-bold text-slate-800 bg-slate-100 print:bg-slate-100 rounded px-3 py-1.5 mt-5 mb-2 border-l-4 border-blue-600">
      {n}. {title}
    </h2>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-200">
      <td className="py-1.5 pr-4">{label}</td>
      <td className="py-1.5 text-right w-40">{value}</td>
    </tr>
  );
}

function FieldArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div className="mb-3">
      {label && <p className="text-[12px] font-semibold text-slate-600 mb-1">{label}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full text-[13px] border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 resize-y leading-relaxed"
      />
    </div>
  );
}
