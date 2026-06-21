/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Printer, X, Camera } from 'lucide-react';
import { StudentScore } from '../types';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature from './TeacherSignature';
import { khmerLunarFull } from '../utils/khmerDate';

interface MeritCertificateProps {
  student: StudentScore;
  students: StudentScore[]; // full list — to resolve dob from any of the student's rows
  onClose: () => void;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// niddes word + letter for a 0–10 average (same bands as the report cards).
const gradeBand = (v: number | null | undefined): { km: string; en: string } => {
  if (v === null || v === undefined || v <= 0) return { km: '', en: '' };
  if (v >= 9) return { km: 'ល្អប្រសើរ', en: 'A' };
  if (v >= 8) return { km: 'ល្អណាស់', en: 'B' };
  if (v >= 7) return { km: 'ល្អ', en: 'C' };
  if (v >= 6) return { km: 'ល្អបង្គួរ', en: 'D' };
  if (v >= 5) return { km: 'មធ្យម', en: 'E' };
  return { km: 'ខ្សោយ', en: 'F' };
};

// End-of-month date for the signature block (school year: Sep–Dec 2025, Jan–Aug 2026).
const monthEndDate = (month: string) => {
  const idx = KH_MONTHS.indexOf((month || '').trim());
  if (idx < 0) return { day: '.....', year: '២០២៦', lunar: khmerLunarFull(new Date()) };
  const yearNum = idx >= 8 ? 2025 : 2026;
  const date = new Date(yearNum, idx, MONTH_LAST_DAY[idx]);
  return { day: toKh(MONTH_LAST_DAY[idx]), year: toKh(yearNum), lunar: khmerLunarFull(date) };
};

export default function MeritCertificate({ student, students, onClose }: MeritCertificateProps) {
  const niddes = gradeBand(student.overallAvg);
  const endDate = monthEndDate(student.month);

  // Date of birth — fall back to any of this student's rows (by អត្តលេខ, then name).
  const dobFrom = (pred: (s: StudentScore) => boolean) => students.find(s => pred(s) && !!s.dob)?.dob;
  const sid = (student as any).studentId;
  const resolvedDob = student.dob
    || (sid ? dobFrom(s => (s as any).studentId === sid) : '')
    || dobFrom(s => s.name?.trim() === student.name?.trim())
    || '';

  // Student photo — uploaded once per student, kept in localStorage (not in Supabase).
  const photoKey = `meritphoto::${student.grade}::${student.name.trim()}`;
  const [photo, setPhoto] = useState<string>(() => {
    try { return localStorage.getItem(photoKey) || ''; } catch { return ''; }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPhoto(url);
      try { localStorage.setItem(photoKey, url); } catch { /* photos are local only */ }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const printCss = `@media print {
    @page { size: A4 landscape; margin: 8mm; }
    body * { visibility: hidden !important; }
    #merit-cert, #merit-cert * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #merit-cert { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
    .rc-no-print { display: none !important; }
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="w-full max-w-5xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">ប័ណ្ណសរសើរ — {student.name} ({niddes.en})</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              <Printer size={13} /> បោះពុម្ព / PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        {/* Certificate sheet (landscape) */}
        <div id="merit-cert" className="bg-white rounded-b-2xl">
          {/* Decorative frame image — place the file at public/cert-frame.png */}
          <div className="relative w-full" style={{ aspectRatio: '1.414 / 1' }}>
            <img src="/cert-frame.png" alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />
            <div className="absolute inset-0 flex flex-col justify-between text-slate-800" style={{ padding: '6.5% 8.5% 5.5%' }}>

              {/* Header: logo+school (left), kingdom (right) */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col items-center gap-1 text-emerald-700">
                  <SchoolLogo size={64} />
                  <div className="text-sm font-bold whitespace-nowrap">សាលាសហគមន៍ច្បារច្រុះ</div>
                </div>
                <div className="text-center text-[13px] text-emerald-800">
                  <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
                  <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                  <div className="text-amber-600 tracking-widest">~ ~ ~ ~ ~</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center -mt-2">
                <h1 className="text-5xl font-extrabold text-red-600 tracking-wide" style={{ fontFamily: 'inherit' }}>ប័ណ្ណសរសើរ</h1>
                <p className="text-lg font-bold text-slate-700 mt-1">នាយកសាលាសហគមន៍ច្បារច្រុះ</p>
              </div>

              {/* Body + photo */}
              <div className="flex gap-6 mt-5">
                <div className="flex-1 text-[15px] leading-loose text-justify">
                  <p>
                    សូមសរសើរចំពោះសិស្សឈ្មោះ <span className="font-bold text-red-700">{student.name}</span>{' '}
                    {resolvedDob
                      ? <>កើតនៅ <span className="font-semibold">{resolvedDob}</span> </>
                      : <>កើតនៅថ្ងៃទី.......ខែ.........ឆ្នាំ......... </>}
                    រៀនថ្នាក់ទី <span className="font-bold">{student.grade.replace(/^ថ្នាក់ទី\s*/, '')}</span>{' '}
                    ដែលទទួលបានលទ្ធផលក្នុងការសិក្សា និងទទួលបាននិទ្ទេស{' '}
                    <span className="font-bold text-red-700">{niddes.km} ({niddes.en})</span> ប្រចាំខែ {student.month}{' '}
                    ក្នុងឆ្នាំសិក្សា <span className="font-bold">២០២៥-២០២៦</span> ។
                  </p>
                  <p className="mt-2">ប័ណ្ណសរសើរនេះប្រគល់ជូនសាមីខ្លួនប្រើប្រាស់តាមការដែលអាចប្រើបាន។</p>
                </div>

                {/* Photo */}
                <div className="shrink-0">
                  <div className="w-28 h-36 rounded-lg overflow-hidden bg-slate-50 border-2 border-amber-300 shadow-sm">
                    {photo ? (
                      <img src={photo} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <button onClick={() => fileRef.current?.click()} className="rc-no-print w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-slate-100 transition-colors">
                        <Camera size={22} />
                        <span className="text-[10px] font-bold">បញ្ចូលរូបថត</span>
                      </button>
                    )}
                  </div>
                  {photo && (
                    <button onClick={() => fileRef.current?.click()} className="rc-no-print mt-1 w-full text-[10px] text-blue-500 hover:underline text-center">ប្តូររូប</button>
                  )}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-10 mt-8 text-[12px] text-center">
                <div>
                  <p className="font-bold">បានឃើញ និងឯកភាព</p>
                  <p className="font-bold">នាយកសាលា</p>
                  <PrincipalSignature />
                </div>
                <div>
                  <p>{endDate.lunar}</p>
                  <p>ច្បារច្រុះ ថ្ងៃទី{endDate.day} ខែ{student.month} ឆ្នាំ{endDate.year}</p>
                  <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
                  <TeacherSignature grade={student.grade} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
