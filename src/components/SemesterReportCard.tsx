/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { Printer, X, PenLine } from 'lucide-react';
import { StudentScore } from '../types';
import SchoolLogo from './SchoolLogo';

interface SemesterReportCardProps {
  student: StudentScore;       // any record of the student (for identity)
  students: StudentScore[];    // full list, for the exam record, monthly records & ranking
  semester: 1 | 2;
  onClose: () => void;
}

const SEM1_MONTHS = ['ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា'];
const SEM2_MONTHS = ['ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];
const examMonthOf = (sem: 1 | 2) => (sem === 1 ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២');

// The 14 semester-exam subjects, each derived from the exam record's fields.
const SEM_SUBJECTS: { km: string; get: (s: StudentScore) => number | null | undefined }[] = [
  { km: 'អំណាន', get: s => s.khmer?.reading },
  { km: 'ស្តាប់ និងនិយាយ', get: s => s.khmer?.listening },
  { km: 'សរសេរតាមអាន', get: s => s.khmer?.writing },
  { km: 'តែងសេចក្តី', get: s => s.khmer?.speaking },
  { km: 'គណិតវិទ្យា', get: s => s.mathAvg },
  { km: 'វិទ្យាសាស្ត្រ', get: s => s.science },
  { km: 'សីលធម៌-ពលរដ្ឋវិទ្យា', get: s => s.socialScores?.morality },
  { km: 'ភូមិវិទ្យា', get: s => s.socialScores?.geography },
  { km: 'ប្រវត្តិវិទ្យា', get: s => s.socialScores?.history },
  { km: 'គេហៈវិទ្យា-អប់រំសិល្បៈ', get: s => s.socialScores?.home },
  { km: 'អប់រំកាយ-កីឡា', get: s => s.physicalEducation },
  { km: 'សុខភាព-អនាម័យ', get: s => s.health },
  { km: 'បំណិនជីវិត', get: s => s.lifeSkills },
  { km: 'ភាសាបរទេស', get: s => s.foreignLanguage },
];

const KH_NUM = ['១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩', '១០', '១១', '១២', '១៣', '១៤'];

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
const fix = (v: number | null | undefined) => (v !== null && v !== undefined && v > 0 ? v.toFixed(2) : '-');

export default function SemesterReportCard({ student, students, semester, onClose }: SemesterReportCardProps) {
  const months = semester === 1 ? SEM1_MONTHS : SEM2_MONTHS;
  const examMonth = examMonthOf(semester);
  const nameKey = student.name.trim();

  // Compute the semester figures for one student (used for this card + ranking).
  const computeFor = (name: string) => {
    const recs = students.filter(s => s.name.trim() === name && s.grade === student.grade);
    const exam = recs.find(s => s.month === examMonth);
    const examVals = SEM_SUBJECTS.map(sub => (exam ? sub.get(exam) : null)).filter((v): v is number => v !== null && v !== undefined && v > 0);
    const examTotal = examVals.reduce((a, b) => a + b, 0);
    const examAvg = examVals.length ? examTotal / examVals.length : null;
    const monthAvgs = months
      .map(m => recs.find(s => s.month === m)?.overallAvg)
      .filter((v): v is number => v !== null && v !== undefined);
    const monthlyAvg = monthAvgs.length ? monthAvgs.reduce((a, b) => a + b, 0) / monthAvgs.length : null;
    let semAvg: number | null = null;
    if (examAvg !== null && monthlyAvg !== null) semAvg = (examAvg + monthlyAvg) / 2;
    else semAvg = examAvg ?? monthlyAvg;
    return { exam, examTotal, examAvg, monthlyAvg, semAvg };
  };

  const me = useMemo(() => computeFor(nameKey), [students, nameKey, semester]);

  const rank = useMemo(() => {
    if (me.semAvg === null) return '';
    const names = new Set(students.filter(s => s.grade === student.grade).map(s => s.name.trim()));
    const finals = [...names].map(n => computeFor(n).semAvg).filter((v): v is number => v !== null);
    return toKh(finals.filter(v => v > me.semAvg!).length + 1);
  }, [students, student.grade, me.semAvg, semester]);

  // One shared teacher signature image (same store as the monthly card).
  const SIG_KEY = 'school_teacher_signature_v1';
  const [signature, setSignature] = useState<string>(() => { try { return localStorage.getItem(SIG_KEY) || ''; } catch { return ''; } });
  const sigInputRef = useRef<HTMLInputElement>(null);
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); setSignature(url); try { localStorage.setItem(SIG_KEY, url); } catch { /* ignore */ } };
    reader.readAsDataURL(file);
  };

  // Auto end-of-semester date (last semester month).
  const lastMonth = months[months.length - 1];
  const endDay = lastMonth === 'កុម្ភៈ' ? '២៨' : (['មេសា', 'មិថុនា', 'កញ្ញា', 'វិច្ឆិកា'].includes(lastMonth) ? '៣០' : '៣១');

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #semester-report-card, #semester-report-card * { visibility: visible !important; }
    #semester-report-card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; }
    .rc-no-print { display: none !important; }
  }`;

  const meBand = gradeBand(me.semAvg);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <div className="w-full max-w-3xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">ព្រឹត្តបត្រឆមាសទី {toKh(semester)} — {student.name}</h3>
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

        {/* Printable card */}
        <div id="semester-report-card" className="bg-white rounded-b-2xl shadow-xl p-8 text-slate-800 text-[12px] leading-relaxed">
          <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col items-center font-semibold text-emerald-700">
              <SchoolLogo size={56} />
              <div className="mt-1 text-base font-bold">សាលាសហគមន៍ច្បារច្រុះ</div>
            </div>
            <div className="text-center text-[11px]">
              <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
            </div>
          </div>

          <div className="text-center my-3">
            <h1 className="text-base font-extrabold text-indigo-700">ព្រឹត្តបត្រពិន្ទុសិស្សប្រចាំ ឆមាសទី {toKh(semester)}</h1>
            <p className="text-[11px] text-slate-500">ឆ្នាំសិក្សា ២០២៥ - ២០២៦</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-3 text-[12px]">
            <div><span className="font-bold">គោត្តនាម និងនាម៖</span> {student.name}</div>
            <div><span className="font-bold">ភេទ៖</span> {student.gender}</div>
            <div><span className="font-bold">លទ្ធផលសិក្សា៖</span> {student.grade}</div>
            <div><span className="font-bold">អត្តលេខ៖</span> {student.studentId || '...........'}</div>
          </div>

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
              {SEM_SUBJECTS.map((sub, i) => {
                const val = me.exam ? sub.get(me.exam) : null;
                const g = gradeBand(val);
                return (
                  <tr key={i} className="text-center">
                    <td className="border border-slate-300 px-1 py-0.5">{KH_NUM[i]}</td>
                    <td className="border border-slate-300 px-2 py-0.5 text-left">{sub.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{fix(val)}</td>
                    <td className="border border-slate-300 px-1 py-0.5"></td>
                    <td className="border border-slate-300 px-1 py-0.5">{g.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-bold">{g.en}</td>
                  </tr>
                );
              })}
              <tr className="text-center font-bold bg-slate-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>សរុបពិន្ទុ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono">{me.examTotal > 0 ? me.examTotal.toFixed(2) : '-'}</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={3}></td>
              </tr>
              <tr className="text-center font-bold">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>មធ្យមភាគប្រឡងឆមាស</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono">{fix(me.examAvg)}</td>
                <td className="border border-slate-300 px-1 py-0.5"></td>
                <td className="border border-slate-300 px-1 py-0.5">{gradeBand(me.examAvg).km}</td>
                <td className="border border-slate-300 px-1 py-0.5">{gradeBand(me.examAvg).en}</td>
              </tr>
              <tr className="text-center font-bold">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>មធ្យមភាគប្រចាំខែ</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono">{fix(me.monthlyAvg)}</td>
                <td className="border border-slate-300 px-1 py-0.5"></td>
                <td className="border border-slate-300 px-1 py-0.5">{gradeBand(me.monthlyAvg).km}</td>
                <td className="border border-slate-300 px-1 py-0.5">{gradeBand(me.monthlyAvg).en}</td>
              </tr>
              <tr className="text-center font-bold bg-blue-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>មធ្យមភាគប្រចាំឆមាស</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono text-blue-700">{fix(me.semAvg)}</td>
                <td className="border border-slate-300 px-1 py-0.5">{rank}</td>
                <td className="border border-slate-300 px-1 py-0.5">{meBand.km}</td>
                <td className="border border-slate-300 px-1 py-0.5 font-bold">{meBand.en}</td>
              </tr>
              <tr className="text-center">
                <td className="border border-slate-300 px-1 py-0.5 text-left" colSpan={2}>ចំនួនអវត្តមាន</td>
                <td className="border border-slate-300 px-1 py-0.5">.........</td>
                <td className="border border-slate-300 px-1 py-0.5">ច្បាប់ ......</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>អត់ច្បាប់ ......</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-6 text-[11px] text-center">
            <div>
              <p className="font-bold">បានឃើញ និងឯកភាព</p>
              <p className="font-bold">នាយកសាលា</p>
              <p className="text-slate-300 pt-10">..............................</p>
            </div>
            <div>
              <p>ច្បារច្រុះ ថ្ងៃទី{endDay} ខែ{lastMonth} ឆ្នាំ២០២៦</p>
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
