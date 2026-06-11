/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { Printer, X, PenLine } from 'lucide-react';
import { StudentScore } from '../types';
import SchoolLogo from './SchoolLogo';

interface StudentReportCardProps {
  student: StudentScore;
  students: StudentScore[]; // full list, used to build the class roster for ranking
  onClose: () => void;
}

// The 21 sub-subjects of a general class, in report-card order, with an accessor.
const SUBJECTS: { km: string; get: (s: StudentScore) => number | null | undefined }[] = [
  { km: 'ស្តាប់', get: s => s.khmer?.listening },
  { km: 'សរសេរ', get: s => s.khmer?.writing },
  { km: 'អាន', get: s => s.khmer?.reading },
  { km: 'និយាយ', get: s => s.khmer?.speaking },
  { km: 'ចំនួន', get: s => s.math?.numbers },
  { km: 'រង្វាស់រង្វាល់', get: s => s.math?.measurement },
  { km: 'ធរណីមាត្រ', get: s => s.math?.geometry },
  { km: 'ពិជគណិត', get: s => s.math?.algebra },
  { km: 'ស្ថិតិ', get: s => s.math?.statistics },
  { km: 'ជីវវិទ្យា', get: s => s.scienceScores?.biology },
  { km: 'គីមីវិទ្យា', get: s => s.scienceScores?.chemistry },
  { km: 'រូបវិទ្យា', get: s => s.scienceScores?.physics },
  { km: 'ផែនដី-បរិស្ថាន', get: s => s.scienceScores?.earth },
  { km: 'សីលធម៌-ពលរដ្ឋ', get: s => s.socialScores?.morality },
  { km: 'ភូមិវិទ្យា', get: s => s.socialScores?.geography },
  { km: 'ប្រវត្តិវិទ្យា', get: s => s.socialScores?.history },
  { km: 'គេហៈវិទ្យា-អប់រំសិល្បៈ', get: s => s.socialScores?.home },
  { km: 'អប់រំកាយ-កីឡា', get: s => s.physicalEducation },
  { km: 'សុខភាព-អនាម័យ', get: s => s.health },
  { km: 'បំណិនជីវិត', get: s => s.lifeSkills },
  { km: 'ភាសាបរទេស', get: s => s.foreignLanguage },
];

const KH_NUM = ['១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩', '១០', '១១', '១២', '១៣', '១៤', '១៥', '១៦', '១៧', '១៨', '១៩', '២០', '២១'];

// និទ្ទេស (grade) bands — Khmer word + English letter — for a 0–10 score.
// Thresholds per the school's scale. Blank when unscored.
const gradeBand = (v: number | null | undefined): { km: string; en: string } => {
  if (v === null || v === undefined || v <= 0) return { km: '', en: '' };
  if (v > 9.5) return { km: 'ល្អប្រសើរ', en: 'A' };
  if (v > 9) return { km: 'ល្អណាស់', en: 'B' };
  if (v > 8) return { km: 'ល្អ', en: 'C' };
  if (v > 6.5) return { km: 'ល្អបង្គួរ', en: 'D' };
  if (v > 5) return { km: 'មធ្យម', en: 'E' };
  return { km: 'ខ្សោយ', en: 'F' };
};
const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// The last day of the report month, auto-dated per the school year (Sep–Dec 2025,
// Jan–Aug 2026). Returns { day, month, year } as Khmer-numeral strings.
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const monthEndDate = (month: string) => {
  const idx = KH_MONTHS.indexOf((month || '').trim());
  if (idx < 0) return { day: '.........', year: '២០២៦' };
  const year = idx >= 8 ? '២០២៥' : '២០២៦'; // កញ្ញា–ធ្នូ → 2025, else 2026
  return { day: toKh(MONTH_LAST_DAY[idx]), year };
};

export default function StudentReportCard({ student, students, onClose }: StudentReportCardProps) {
  // Classmates (same class & month) used for per-subject ranking.
  const roster = useMemo(
    () => students.filter(s => s.grade === student.grade && s.month === student.month),
    [students, student.grade, student.month]
  );

  // 1-based rank of this student's score within the class for a given accessor.
  const rankIn = (get: (s: StudentScore) => number | null | undefined): string => {
    const mine = get(student);
    if (mine === null || mine === undefined || mine <= 0) return '';
    const scores = roster.map(get).filter((x): x is number => x !== null && x !== undefined && x > 0);
    const higher = scores.filter(x => x > mine).length;
    return toKh(higher + 1);
  };

  const avgRank = useMemo(() => {
    const mine = student.overallAvg;
    if (mine === null || mine === undefined) return '';
    const avgs = roster.map(s => s.overallAvg).filter((x): x is number => x !== null && x !== undefined);
    return toKh(avgs.filter(x => x > mine).length + 1);
  }, [roster, student.overallAvg]);

  // Auto end-of-month date for the signature block.
  const endDate = monthEndDate(student.month);

  // One shared teacher signature image (data URL), uploaded once and reused.
  const SIG_KEY = 'school_teacher_signature_v1';
  const [signature, setSignature] = useState<string>(() => {
    try { return localStorage.getItem(SIG_KEY) || ''; } catch { return ''; }
  });
  const sigInputRef = useRef<HTMLInputElement>(null);
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setSignature(url);
      try { localStorage.setItem(SIG_KEY, url); } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
  };

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #student-report-card, #student-report-card * { visibility: visible !important; }
    #student-report-card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; }
    .rc-no-print { display: none !important; }
  }`;

  const num = (v: number | null | undefined) => (v !== null && v !== undefined && v > 0 ? v.toFixed(2) : '0.00');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>

      <div className="w-full max-w-3xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">ព្រឹត្តបត្រពិន្ទុសិស្ស — {student.name}</h3>
          <div className="flex items-center gap-2">
            <input ref={sigInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
            <button onClick={() => sigInputRef.current?.click()} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-indigo-200 transition-colors">
              <PenLine size={13} /> {signature ? 'ប្តូរហត្ថលេខាគ្រូ' : 'បញ្ចូលហត្ថលេខាគ្រូ'}
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              <Printer size={13} /> បោះពុម្ព / PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        {/* The printable card */}
        <div id="student-report-card" className="bg-white rounded-b-2xl shadow-xl p-8 text-slate-800 text-[12px] leading-relaxed">

          <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col items-center text-[11px] font-semibold text-emerald-700">
              <SchoolLogo size={56} />
              <div className="mt-1">សាលាសហគមន៍ច្បារច្រុះ</div>
            </div>
            <div className="text-center text-[11px]">
              <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
            </div>
          </div>

          <div className="text-center my-3">
            <h1 className="text-base font-extrabold text-indigo-700">ព្រឹត្តបត្រពិន្ទុសិស្សប្រចាំខែ {student.month}</h1>
            <p className="text-[11px] text-slate-500">ឆ្នាំសិក្សា ២០២៥ - ២០២៦</p>
          </div>

          {/* Student info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-3 text-[12px]">
            <div><span className="font-bold">គោត្តនាម និងនាម៖</span> {student.name}</div>
            <div><span className="font-bold">ភេទ៖</span> {student.gender}</div>
            <div><span className="font-bold">លទ្ធផលសិក្សា៖</span> {student.grade}</div>
            <div><span className="font-bold">អត្តលេខ៖</span> {student.studentId || '...........'}</div>
          </div>

          {/* Scores table */}
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1 py-1 w-10" rowSpan={2}>ល.រ</th>
                <th className="border border-slate-300 px-2 py-1 text-left" rowSpan={2}>ឈ្មោះមុខវិជ្ជា</th>
                <th className="border border-slate-300 px-1 py-1 w-16" rowSpan={2}>ពិន្ទុ</th>
                <th className="border border-slate-300 px-1 py-1 w-20" rowSpan={2}>ចំណាត់ថ្នាក់</th>
                <th className="border border-slate-300 px-1 py-1" colSpan={2}>និទ្ទេស</th>
              </tr>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1 py-1 w-24">ភាសាខ្មែរ</th>
                <th className="border border-slate-300 px-1 py-1 w-16">English</th>
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((sub, i) => {
                const val = sub.get(student);
                const g = gradeBand(val);
                return (
                  <tr key={i} className="text-center">
                    <td className="border border-slate-300 px-1 py-0.5">{KH_NUM[i]}</td>
                    <td className="border border-slate-300 px-2 py-0.5 text-left">{sub.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{num(val)}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{rankIn(sub.get)}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{g.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-bold">{g.en}</td>
                  </tr>
                );
              })}
              <tr className="text-center font-bold bg-slate-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>សរុបពិន្ទុ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono">{student.totalScore !== undefined ? Number(student.totalScore).toFixed(2) : '0.00'}</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={3}></td>
              </tr>
              <tr className="text-center font-bold bg-blue-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>មធ្យមភាគ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono text-blue-700">{student.overallAvg !== null && student.overallAvg !== undefined ? student.overallAvg.toFixed(2) : '0.00'}</td>
                <td className="border border-slate-300 px-1 py-0.5">{avgRank}</td>
                <td className="border border-slate-300 px-1 py-0.5">{gradeBand(student.overallAvg).km}</td>
                <td className="border border-slate-300 px-1 py-0.5 font-bold">{gradeBand(student.overallAvg).en}</td>
              </tr>
              <tr className="text-center">
                <td className="border border-slate-300 px-1 py-0.5 text-left" colSpan={2}>ចំនួនអវត្តមាន</td>
                <td className="border border-slate-300 px-1 py-0.5">.........</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={3}>អត់ច្បាប់ .........</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-6 text-[11px] text-center">
            <div>
              <p className="font-bold">បានឃើញ និងឯកភាព</p>
              <p className="font-bold">នាយកសាលា</p>
              <p className="text-slate-300 pt-10">..............................</p>
            </div>
            <div>
              <p>ច្បារច្រុះ ថ្ងៃទី{endDate.day} ខែ{student.month} ឆ្នាំ{endDate.year}</p>
              <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
              {signature ? (
                <img src={signature} alt="ហត្ថលេខាគ្រូ" className="h-16 mx-auto object-contain mt-1" />
              ) : (
                <p className="text-slate-300 pt-8">..............................</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
