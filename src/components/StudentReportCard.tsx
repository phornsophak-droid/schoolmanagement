/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Printer, X } from 'lucide-react';
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

// Khmer grade word (និទ្ទេស) for a 0–10 score. Blank when unscored.
const gradeWord = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v <= 0) return '';
  if (v >= 9) return 'ល្អប្រសើរ';
  if (v >= 8) return 'ល្អ';
  if (v >= 7) return 'ល្អបង្គួរ';
  if (v >= 6) return 'មធ្យម';
  if (v >= 5) return 'ខ្សោយ';
  return 'ខ្សោយណាស់';
};
// A–F letter for a 0–10 score. Blank when unscored.
const gradeLetter = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v <= 0) return '';
  if (v >= 9) return 'A';
  if (v >= 8) return 'B';
  if (v >= 7) return 'C';
  if (v >= 6) return 'D';
  if (v >= 5) return 'E';
  return 'F';
};
// Combined និទ្ទេស cell: bold A–F letter + Khmer word.
const GradeCell = ({ v }: { v: number | null | undefined }) => {
  const l = gradeLetter(v);
  if (!l) return null;
  return <span><span className="font-bold">{l}</span> {gradeWord(v)}</span>;
};
const toKh = (n: number) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

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
            <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
              <SchoolLogo size={52} />
              <div>
                <div className="text-base font-extrabold tracking-wide">CamKids</div>
                <div>សាលាសហគមន៍ច្បារច្រុះ</div>
              </div>
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
            <div><span className="font-bold">ផលសិក្សាថ្នាក់ទី៖</span> {student.grade}</div>
            <div><span className="font-bold">អត្តលេខ៖</span> {student.studentId || '...........'}</div>
          </div>

          {/* Scores table */}
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-1 py-1 w-10">ល.រ</th>
                <th className="border border-slate-300 px-2 py-1 text-left">ឈ្មោះមុខវិជ្ជា</th>
                <th className="border border-slate-300 px-1 py-1 w-16">ពិន្ទុ</th>
                <th className="border border-slate-300 px-1 py-1 w-20">ចំណាត់ថ្នាក់</th>
                <th className="border border-slate-300 px-1 py-1 w-24">និទ្ទេស</th>
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((sub, i) => {
                const val = sub.get(student);
                return (
                  <tr key={i} className="text-center">
                    <td className="border border-slate-300 px-1 py-0.5">{KH_NUM[i]}</td>
                    <td className="border border-slate-300 px-2 py-0.5 text-left">{sub.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{num(val)}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{rankIn(sub.get)}</td>
                    <td className="border border-slate-300 px-1 py-0.5"><GradeCell v={val} /></td>
                  </tr>
                );
              })}
              <tr className="text-center font-bold bg-slate-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>សរុបពិន្ទុ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono">{student.totalScore !== undefined ? Number(student.totalScore).toFixed(2) : '0.00'}</td>
                <td className="border border-slate-300 px-1 py-0.5"></td>
                <td className="border border-slate-300 px-1 py-0.5"></td>
              </tr>
              <tr className="text-center font-bold bg-blue-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>មធ្យមភាគ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono text-blue-700">{student.overallAvg !== null && student.overallAvg !== undefined ? student.overallAvg.toFixed(2) : '0.00'}</td>
                <td className="border border-slate-300 px-1 py-0.5">{avgRank}</td>
                <td className="border border-slate-300 px-1 py-0.5"><GradeCell v={student.overallAvg} /></td>
              </tr>
              <tr className="text-center">
                <td className="border border-slate-300 px-1 py-0.5 text-left" colSpan={2}>ចំនួនអវត្តមាន</td>
                <td className="border border-slate-300 px-1 py-0.5">.........</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>អត់ច្បាប់ .........</td>
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
              <p>ច្បារច្រុះ ថ្ងៃទី......... ខែ......... ឆ្នាំ២០២៦</p>
              <p className="font-bold pt-1">គ្រូ ឬឪពុកម្តាយទទួលថ្នាក់</p>
              <p className="text-slate-300 pt-8">..............................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
