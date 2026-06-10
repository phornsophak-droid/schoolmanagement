/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { StudentScore } from '../types';

const SCHOOL_NAME = 'សាលាសហគមន៍ច្បារច្រុះ';

// ===========================================================================
// Report template definitions
// ===========================================================================

type Block =
  | { kind: 'attendance'; num: string; title: string; totalLabel: string; avgLabel: string; absenceLabel?: string; rateLabel: string; commentsLabel: string }
  | { kind: 'studyResult'; num: string; title: string; commentsLabel: string }
  | { kind: 'text'; num: string; title: string; label?: string; field: string; default?: string; rows?: number }
  | { kind: 'progress'; num: string; title: string; strengthsLabel: string; improvementsLabel: string; defaultStrengths?: string; defaultImprovements?: string };

export interface ReportTemplate {
  key: string;
  title: string;
  subtitle?: string;
  aggregateKeyword?: string; // when the base label is chosen, aggregate all sections sharing this keyword
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

// Return the report template that fits a class, or null if it uses the default report.
export function getReportTemplate(grade: string): ReportTemplate | null {
  const g = grade || '';
  if (g.includes('អង់គ្លេស')) return ENGLISH_TEMPLATE;
  if (g.includes('កីឡា') || g.includes('អប់រំកាយ')) return SPORTS_TEMPLATE;
  return null;
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

  const update = (key: string, value: string) => {
    setFields(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Unique students + A–F distribution from each student's mean score.
  const stats = useMemo(() => {
    let recs = students.filter(s => s.grade === grade);
    if (recs.length === 0 && template.aggregateKeyword) {
      recs = students.filter(s => (s.grade || '').includes(template.aggregateKeyword!));
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

  const lineInput = 'border-b border-slate-300 outline-none focus:border-blue-500 bg-transparent px-1';

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">📄 {template.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{grade} • {period} — ស្ថិតិបំពេញស្វ័យប្រវត្តិ ផ្នែកអត្ថបទសរសេរដោយផ្ទាល់ (រក្សាទុកស្វ័យប្រវត្តិ)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <Printer size={13} /> បោះពុម្ព / PDF
          </button>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {/* The printable report sheet */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print:p-0 print:border-0 print:shadow-none text-slate-800 text-sm leading-relaxed">

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
          // text
          return (
            <div key={block.num}>
              <SectionTitle n={block.num} title={block.title} />
              <FieldArea label={block.label || ''} value={fields[block.field] ?? ''} onChange={v => update(block.field, v)} rows={block.rows || 3} />
            </div>
          );
        })}

        {/* Signature */}
        <div className="grid grid-cols-2 gap-8 mt-10 text-[13px]">
          <div className="space-y-1">
            <p><span className="font-bold">ឈ្មោះគ្រូ៖</span> {teacherName || '__________________'}</p>
            <p className="pt-6"><span className="font-bold">ហត្ថលេខា៖</span> __________________</p>
          </div>
          <div className="text-right space-y-1">
            <p className="pt-6"><span className="font-bold">កាលបរិច្ឆេទ៖</span> {fields.date}</p>
          </div>
        </div>
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
