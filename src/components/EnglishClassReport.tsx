/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { StudentScore } from '../types';

interface EnglishClassReportProps {
  students: StudentScore[];
  grade: string;       // the selected after-hours class (e.g. an English section)
  period: string;      // evaluation period label
  teacherName?: string;
  onClose: () => void;
}

const SCHOOL_NAME = 'សាលាសហគមន៍ច្បារច្រុះ';

const letterOf = (avg: number | null): string => {
  if (avg === null || avg === undefined) return '-';
  if (avg >= 9.0) return 'A';
  if (avg >= 8.0) return 'B';
  if (avg >= 7.0) return 'C';
  if (avg >= 6.0) return 'D';
  if (avg >= 5.0) return 'E';
  return 'F';
};

// Default editable narrative content, seeded from the school's report template.
const DEFAULTS = {
  topicsCovered: '',
  strengths: '• ការកើនឡើងនៃវាក្យសព្ទ និងការផ្គុំប្រយោគ។\n• ការចូលរួមកាន់តែច្រើនក្នុងសកម្មភាពថ្នាក់រៀន។\n• ជំនាញអាន និងការយល់ន័យល្អប្រសើរ។\n• ទំនុកចិត្តក្នុងការនិយាយភាសាអង់គ្លេសកាន់តែខ្លាំង។',
  improvements: '• ការបញ្ចេញសំឡេង (Pronunciation)\n• ការប្រកប (Spelling)\n• ការយល់ន័យពេលស្តាប់ (Listening)\n• ទំនុកចិត្តក្នុងការនិយាយ\n• ជំនាញសរសេរ',
  challenges: '',
  support: '• ការគាំទ្រជាក្រុមតូចសម្រាប់សិស្សដែលជួបការលំបាក។\n• សកម្មភាពអនុវត្តបន្ថែម និងកិច្ចការផ្ទះ។\n• ល្បែងអន្តរកម្ម និងលំហាត់និយាយ។\n• លើកទឹកចិត្តឱ្យអាន និងអនុវត្តភាសាអង់គ្លេសនៅផ្ទះ។',
  successStories: '',
  nextPlan: '',
  reflection: '',
  attendanceComments: '',
  studyComments: '',
  attAvgPresent: '',
  attAvgAbsent: '',
  attRate: '',
  date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
};

type Fields = typeof DEFAULTS;

export default function EnglishClassReport({ students, grade, period, teacherName, onClose }: EnglishClassReportProps) {
  const storeKey = `engreport::${grade}::${period}`;

  const [fields, setFields] = useState<Fields>(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  });

  // Reload the saved narrative whenever the class/period changes.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      setFields(saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS });
    } catch { setFields({ ...DEFAULTS }); }
  }, [storeKey]);

  const update = (key: keyof Fields, value: string) => {
    setFields(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Auto-computed roster stats for this class: unique students + A–F distribution
  // from each student's mean score across the available records.
  const stats = useMemo(() => {
    // When given the whole-subject label (e.g. the monthly-report wizard passes
    // "ថ្នាក់ភាសាអង់គ្លេស"), aggregate every English section; otherwise match the
    // exact section the academic tab selected.
    const baseLabels = ['ថ្នាក់ភាសាអង់គ្លេស', 'ថ្នាក់ភាសាអង់គ្លេស (រួម)'];
    const aggregate = baseLabels.includes(grade.trim());
    const recs = students.filter(s => aggregate ? s.grade.includes('អង់គ្លេស') : s.grade === grade);
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
  }, [students, grade]);

  const lineInput = 'border-b border-slate-300 outline-none focus:border-blue-500 bg-transparent px-1 print:border-slate-400';

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">📄 គម្រូរបាយការណ៍ថ្នាក់ភាសាអង់គ្លេស (English Class Report)</h3>
          <p className="text-xs text-slate-400 mt-0.5">{grade} • {period} — ស្ថិតិបំពេញស្វ័យប្រវត្តិ ផ្នែកអត្ថបទសរសេរដោយផ្ទាល់ (រក្សាទុកស្វ័យប្រវត្តិ)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
          >
            <Printer size={13} /> បោះពុម្ព / PDF
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {/* The printable report sheet */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print:p-0 print:border-0 print:shadow-none text-slate-800 text-sm leading-relaxed">

        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-5">
          <h1 className="text-lg font-extrabold uppercase tracking-wide">English Class Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">របាយការណ៍លទ្ធផលថ្នាក់ភាសាអង់គ្លេស</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 text-[13px]">
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">School Name:</span><span>{SCHOOL_NAME}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Teacher:</span><span>{teacherName || '__________________'}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Grade/Class:</span><span>{grade}</span></div>
          <div className="flex gap-2"><span className="font-bold whitespace-nowrap">Reporting Period:</span><span>{period}</span></div>
          <div className="flex gap-2 items-center">
            <span className="font-bold whitespace-nowrap">Date:</span>
            <input value={fields.date} onChange={e => update('date', e.target.value)} className={`${lineInput} w-40`} />
          </div>
        </div>

        {/* 1. Attendance */}
        <SectionTitle n="1" title="Student Attendance (វត្តមានសិស្ស)" />
        <table className="w-full border-collapse text-[13px] mb-2">
          <tbody>
            <Row label="Total Students Enrolled (សិស្សសរុប)" value={<span className="font-bold">{stats.total}</span>} />
            <Row label="Average Attendance (មធ្យមភាគមានវត្តមាន)" value={<input value={fields.attAvgPresent} onChange={e => update('attAvgPresent', e.target.value)} className={`${lineInput} w-24 text-center`} />} />
            <Row label="Average Absence (មធ្យមភាគអវត្តមាន)" value={<input value={fields.attAvgAbsent} onChange={e => update('attAvgAbsent', e.target.value)} className={`${lineInput} w-24 text-center`} />} />
            <Row label="Attendance Rate (អត្រាវត្តមាន)" value={<span><input value={fields.attRate} onChange={e => update('attRate', e.target.value)} className={`${lineInput} w-16 text-center`} /> %</span>} />
          </tbody>
        </table>
        <FieldArea label="Attendance Comments (មតិយោបល់អំពីវត្តមាន)" value={fields.attendanceComments} onChange={v => update('attendanceComments', v)} rows={2} />

        {/* 2. Study Result */}
        <SectionTitle n="2" title="Study Result (លទ្ធផលសិក្សា)" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map(g => (
            <div key={g} className="flex items-center justify-center gap-1.5 border border-slate-300 rounded-lg py-1.5">
              <span className="font-extrabold text-slate-700">{g} =</span>
              <span className="font-mono font-bold text-blue-700">{stats.dist[g]}</span>
            </div>
          ))}
        </div>
        <FieldArea label="Comments (មតិយោបល់)" value={fields.studyComments} onChange={v => update('studyComments', v)} rows={2} />

        {/* 3. Topics Covered */}
        <SectionTitle n="3" title="Topics Covered (មេរៀនដែលបានសិក្សា)" />
        <FieldArea label="During this reporting period, students learned:" value={fields.topicsCovered} onChange={v => update('topicsCovered', v)} rows={4} />

        {/* 4. Student Progress */}
        <SectionTitle n="4" title="Student Progress (វឌ្ឍនភាពសិស្ស)" />
        <FieldArea label="Strengths and Achievements (ចំណុចខ្លាំង និងសមិទ្ធផល)" value={fields.strengths} onChange={v => update('strengths', v)} rows={4} />
        <FieldArea label="Areas for Improvement (ចំណុចគួរកែលម្អ)" value={fields.improvements} onChange={v => update('improvements', v)} rows={4} />

        {/* 5. Challenges */}
        <SectionTitle n="5" title="Challenges (បញ្ហាប្រឈម)" />
        <FieldArea label="" value={fields.challenges} onChange={v => update('challenges', v)} rows={3} />

        {/* 6. Support and Interventions */}
        <SectionTitle n="6" title="Support and Interventions (ការគាំទ្រ និងអន្តរាគមន៍)" />
        <FieldArea label="" value={fields.support} onChange={v => update('support', v)} rows={4} />

        {/* 7. Success Stories */}
        <SectionTitle n="7" title="Success Stories (រឿងជោគជ័យ)" />
        <FieldArea label="សូមចែករំលែកសមិទ្ធផល ឬលទ្ធផលវិជ្ជមានរបស់សិស្ស៖" value={fields.successStories} onChange={v => update('successStories', v)} rows={3} />

        {/* 8. Plan for Next Period */}
        <SectionTitle n="8" title="Plan for the Next Reporting Period (ផែនការសម្រាប់រយៈពេលបន្ទាប់)" />
        <FieldArea label="" value={fields.nextPlan} onChange={v => update('nextPlan', v)} rows={3} />

        {/* 9. Teacher's Reflection */}
        <SectionTitle n="9" title="Teacher's Reflection (ការឆ្លុះបញ្ចាំងរបស់គ្រូ)" />
        <FieldArea label="សូមរៀបរាប់ការសង្កេត ការព្រួយបារម្ភ និងអនុសាសន៍របស់អ្នក៖" value={fields.reflection} onChange={v => update('reflection', v)} rows={3} />

        {/* Signature */}
        <div className="grid grid-cols-2 gap-8 mt-10 text-[13px]">
          <div className="space-y-1">
            <p><span className="font-bold">Teacher's Name:</span> {teacherName || '__________________'}</p>
            <p className="pt-6"><span className="font-bold">Signature:</span> __________________</p>
          </div>
          <div className="text-right space-y-1">
            <p className="pt-6"><span className="font-bold">Date:</span> {fields.date}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="text-[13px] font-bold text-slate-800 bg-slate-100 print:bg-slate-100 rounded px-3 py-1.5 mt-5 mb-2">
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
        className="w-full text-[13px] border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 resize-y print:border-slate-300 leading-relaxed"
      />
    </div>
  );
}
