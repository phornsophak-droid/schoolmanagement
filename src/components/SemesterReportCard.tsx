/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { Printer, X, PenLine } from 'lucide-react';
import { StudentScore } from '../types';
import SchoolLogo from './SchoolLogo';
import { khmerLunarFull } from '../utils/khmerDate';

interface SemesterReportCardProps {
  student: StudentScore;       // any record of the student (for identity)
  students: StudentScore[];    // full list, for exam records, monthly records & ranking
  period: 1 | 2 | 'year';      // semester 1, semester 2, or annual
  onClose: () => void;
}

const SEM1_MONTHS = ['ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា'];
const SEM2_MONTHS = ['ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

// The 14 exam subjects, each derived from an exam record's fields.
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
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

interface StudentFigures { subjVals: (number | null)[]; examTotal: number; examAvg: number | null; monthlyAvg: number | null; academic: number | null; finalAvg: number | null; }

// Teacher-entered annual skills/conduct scores, persisted per student.
const extraKey = (grade: string, name: string) => `annualextra::${grade}::${name}`;
const readExtra = (grade: string, name: string): { skills: number; conduct: number } => {
  try { const e = JSON.parse(localStorage.getItem(extraKey(grade, name)) || '{}'); return { skills: Number(e.skills) || 0, conduct: Number(e.conduct) || 0 }; } catch { return { skills: 0, conduct: 0 }; }
};

// One semester's average = (its 14-subject exam avg + its monthly avg) / 2.
const semesterAvgOf = (recs: StudentScore[], sem: 1 | 2): number | null => {
  const exMonth = sem === 1 ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២';
  const exam = recs.find(s => s.month === exMonth);
  const examVals = SEM_SUBJECTS.map(sub => (exam ? sub.get(exam) : null)).filter((v): v is number => v !== null && v !== undefined && v > 0);
  const examAvg = examVals.length ? examVals.reduce((a, b) => a + b, 0) / examVals.length : null;
  const mList = sem === 1 ? SEM1_MONTHS : SEM2_MONTHS;
  const monthlyAvg = mean(mList.map(m => recs.find(s => s.month === m)?.overallAvg).filter((v): v is number => v !== null && v !== undefined));
  if (examAvg !== null && monthlyAvg !== null) return (examAvg + monthlyAvg) / 2;
  return examAvg ?? monthlyAvg;
};

export default function SemesterReportCard({ student, students, period, onClose }: SemesterReportCardProps) {
  const isYear = period === 'year';
  const months = isYear ? [...SEM1_MONTHS, ...SEM2_MONTHS] : (period === 1 ? SEM1_MONTHS : SEM2_MONTHS);
  const examMonths = isYear ? ['ប្រឡងឆមាសទី១', 'ប្រឡងឆមាសទី២'] : [period === 1 ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២'];
  const nameKey = student.name.trim();

  // Annual skills (បំណិន) & conduct (ចរិយា) are entered in the gradebook's annual
  // table (per student) and read here read-only from localStorage.
  const meExtra = readExtra(student.grade, nameKey);

  // Figures for every classmate (for the card itself + ranking), computed once.
  const classData = useMemo<Record<string, StudentFigures>>(() => {
    const names = [...new Set(students.filter(s => s.grade === student.grade).map(s => s.name.trim()))];
    const map: Record<string, StudentFigures> = {};
    names.forEach(n => {
      const recs = students.filter(s => s.name.trim() === n && s.grade === student.grade);
      const exams = recs.filter(s => examMonths.includes(s.month));
      const subjVals = SEM_SUBJECTS.map(sub => {
        const vals = exams.map(e => sub.get(e)).filter((v): v is number => v !== null && v !== undefined && v > 0);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      });
      const scored = subjVals.filter((v): v is number => v !== null && v > 0);
      const examTotal = scored.reduce((a, b) => a + b, 0);
      const examAvg = scored.length ? examTotal / scored.length : null;
      const monthAvgs = months.map(m => recs.find(s => s.month === m)?.overallAvg).filter((v): v is number => v !== null && v !== undefined);
      const monthlyAvg = mean(monthAvgs);
      let academic: number | null = null;
      let finalAvg: number | null;
      if (isYear) {
        // Annual raw avg = (semester1 avg + semester2 avg) / 2; academic = 80% of it.
        const semAvgs = [semesterAvgOf(recs, 1), semesterAvgOf(recs, 2)].filter((v): v is number => v !== null && v !== undefined);
        const annualRaw = semAvgs.length ? semAvgs.reduce((a, b) => a + b, 0) / semAvgs.length : null;
        academic = annualRaw !== null ? annualRaw * 0.8 : null;
        const ex = readExtra(student.grade, n);
        finalAvg = academic !== null ? academic + 0.1 * ex.skills + 0.1 * ex.conduct : null;
      } else {
        finalAvg = (examAvg !== null && monthlyAvg !== null) ? (examAvg + monthlyAvg) / 2 : (examAvg ?? monthlyAvg);
      }
      map[n] = { subjVals, examTotal, examAvg, monthlyAvg, academic, finalAvg };
    });
    return map;
  }, [students, student.grade, period]);

  const me: StudentFigures = classData[nameKey] || { subjVals: SEM_SUBJECTS.map(() => null), examTotal: 0, examAvg: null, monthlyAvg: null, academic: null, finalAvg: null };

  const rankBySubject = (i: number): string => {
    const myVal = me.subjVals[i];
    if (myVal === null || myVal === undefined || myVal <= 0) return '';
    const vals = Object.values(classData).map((d: StudentFigures) => d.subjVals[i]).filter((v): v is number => v !== null && v > 0);
    return toKh(vals.filter(v => v > myVal).length + 1);
  };
  const finalRank = useMemo(() => {
    if (me.finalAvg === null) return '';
    const finals = Object.values(classData).map((d: StudentFigures) => d.finalAvg).filter((v): v is number => v !== null);
    return toKh(finals.filter(v => v > me.finalAvg!).length + 1);
  }, [classData, me.finalAvg]);

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

  // Auto end-of-period date (last month of the period).
  const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const lastMonth = months[months.length - 1];
  const lastIdx = KH_MONTHS.indexOf(lastMonth);
  const endDayNum = lastMonth === 'កុម្ភៈ' ? 28 : (['មេសា', 'មិថុនា', 'កញ្ញា', 'វិច្ឆិកា'].includes(lastMonth) ? 30 : 31);
  const endDay = toKh(endDayNum);
  const endLunar = khmerLunarFull(new Date(lastIdx >= 8 ? 2025 : 2026, lastIdx < 0 ? 4 : lastIdx, endDayNum));

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #semester-report-card, #semester-report-card * { visibility: visible !important; }
    #semester-report-card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; }
    .rc-no-print { display: none !important; }
  }`;

  const periodTitle = isYear ? 'ប្រចាំឆ្នាំ' : `ឆមាសទី ${toKh(period as number)}`;
  const meBand = gradeBand(me.finalAvg);
  const colSpanEnd = isYear ? 2 : 3; // niddes columns to span in the absence row

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <div className="w-full max-w-3xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">ព្រឹត្តបត្រ{periodTitle} — {student.name}</h3>
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
              <SchoolLogo size={84} />
              <div className="mt-1 text-lg font-bold">សាលាសហគមន៍ច្បារច្រុះ</div>
            </div>
            <div className="text-center text-[11px]">
              <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
            </div>
          </div>

          <div className="text-center my-3">
            <h1 className="text-base font-extrabold text-indigo-700">ព្រឹត្តបត្រពិន្ទុសិស្ស {periodTitle}</h1>
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
                const val = me.subjVals[i];
                const g = gradeBand(val);
                return (
                  <tr key={i} className="text-center">
                    <td className="border border-slate-300 px-1 py-0.5">{KH_NUM[i]}</td>
                    <td className="border border-slate-300 px-2 py-0.5 text-left">{sub.km}</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{fix(val)}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{isYear ? rankBySubject(i) : ''}</td>
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

              {!isYear && (
                <>
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
                </>
              )}

              {isYear && (
                <>
                  <tr className="text-center font-bold">
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>ចំណេះវិជ្ជា (៨០%)</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{fix(me.academic)}</td>
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={3}></td>
                  </tr>
                  <tr className="text-center font-bold">
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>បំណិនសម្បទា (១០%)</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{(0.1 * meExtra.skills).toFixed(2)}</td>
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={3}></td>
                  </tr>
                  <tr className="text-center font-bold">
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>ចរិយាសម្បទា (១០%)</td>
                    <td className="border border-slate-300 px-1 py-0.5 font-mono">{(0.1 * meExtra.conduct).toFixed(2)}</td>
                    <td className="border border-slate-300 px-1 py-0.5" colSpan={3}></td>
                  </tr>
                </>
              )}

              <tr className="text-center font-bold bg-blue-50">
                <td className="border border-slate-300 px-1 py-0.5" colSpan={2}>{isYear ? 'មធ្យមភាគប្រចាំឆ្នាំ' : 'មធ្យមភាគប្រចាំឆមាស'}</td>
                <td className="border border-slate-300 px-1 py-0.5 font-mono text-blue-700">{fix(me.finalAvg)}</td>
                <td className="border border-slate-300 px-1 py-0.5">{finalRank}</td>
                <td className="border border-slate-300 px-1 py-0.5">{meBand.km}</td>
                <td className="border border-slate-300 px-1 py-0.5 font-bold">{meBand.en}</td>
              </tr>
              <tr className="text-center">
                <td className="border border-slate-300 px-1 py-0.5 text-left" colSpan={2}>ចំនួនអវត្តមាន</td>
                <td className="border border-slate-300 px-1 py-0.5">.........</td>
                <td className="border border-slate-300 px-1 py-0.5">ច្បាប់ ......</td>
                <td className="border border-slate-300 px-1 py-0.5" colSpan={colSpanEnd}>អត់ច្បាប់ ......</td>
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
              <p>{endLunar}</p>
              <p>ច្បារច្រុះ ថ្ងៃទី{endDay} ខែ{lastMonth} ឆ្នាំ{lastIdx >= 8 ? '២០២៥' : '២០២៦'}</p>
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
