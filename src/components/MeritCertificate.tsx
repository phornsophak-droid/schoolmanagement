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
  scoreOverride?: number | null; // the average for the active period (semester/annual)
  periodPhrase?: string;         // e.g. "ប្រចាំខែមិថុនា ឆ្នាំសិក្សា ២០២៥-២០២៦"
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

// Format a stored dob string (DD/MM/YYYY or YYYY-MM-DD) as "ថ្ងៃទី D ខែ M ឆ្នាំ Y".
const khToAscii = (s: string) => s.replace(/[០-៩]/g, d => String('០១២៣៤៥៦៧៨៩'.indexOf(d)));
const formatDob = (rawIn: string): string | null => {
  if (!rawIn) return null;
  const raw = khToAscii(rawIn.trim());
  let m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  let d = 0, mo = 0, y = 0;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else { m = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } }
  if (d && mo >= 1 && mo <= 12 && y) return `ថ្ងៃទី ${toKh(d)} ខែ ${KH_MONTHS[mo - 1]} ឆ្នាំ ${toKh(y)}`;
  return raw;
};

// End-of-month date for the signature block (school year: Sep–Dec 2025, Jan–Aug 2026).
const monthEndDate = (month: string) => {
  const idx = KH_MONTHS.indexOf((month || '').trim());
  if (idx < 0) return { day: '.....', year: '២០២៦', lunar: khmerLunarFull(new Date()) };
  const yearNum = idx >= 8 ? 2025 : 2026;
  const date = new Date(yearNum, idx, MONTH_LAST_DAY[idx]);
  return { day: toKh(MONTH_LAST_DAY[idx]), year: toKh(yearNum), lunar: khmerLunarFull(date) };
};

export default function MeritCertificate({ student, students, scoreOverride, periodPhrase, onClose }: MeritCertificateProps) {
  const niddes = gradeBand(scoreOverride ?? student.overallAvg);
  const endDate = monthEndDate(student.month);
  const period = periodPhrase || `ប្រចាំខែ${student.month} ឆ្នាំសិក្សា ២០២៥-២០២៦`;

  // Date of birth — fall back to any of this student's rows (by អត្តលេខ, then name).
  const dobFrom = (pred: (s: StudentScore) => boolean) => students.find(s => pred(s) && !!s.dob)?.dob;
  const sid = (student as any).studentId;
  const resolvedDob = student.dob
    || (sid ? dobFrom(s => (s as any).studentId === sid) : '')
    || dobFrom(s => s.name?.trim() === student.name?.trim())
    || '';
  const dobText = formatDob(resolvedDob);

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
          <div className="relative w-full" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size' }}>
            <img src="/cert-frame.png" alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />
            <div className="absolute inset-0 flex flex-col text-slate-800" style={{ padding: '7.5% 13% 15.5%' }}>

              {/* Header: CAMKIDS org (left), kingdom motto (right) */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col items-center text-emerald-700" style={{ fontSize: '2cqw' }}>
                  <div style={{ width: '9.5cqw', marginTop: '2.5cqw' }}><SchoolLogo className="w-full h-auto" /></div>
                  <div className="font-bold mt-0.5">សាលាសហគមន៍ច្បារច្រុះ</div>
                </div>
                <div className="text-center text-emerald-800" style={{ fontSize: '1.9cqw' }}>
                  <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
                  <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                  <div className="text-amber-600 tracking-widest">~ ~ ~ ~ ~</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mt-1">
                <h1 className="font-extrabold text-red-600 tracking-wide" style={{ fontFamily: "'Khmer OS Muol Light','Khmer OS Moul Light',serif", fontSize: '28pt', lineHeight: 1.15 }}>ប័ណ្ណសរសើរ</h1>
                <p className="font-bold text-slate-700" style={{ fontSize: '2.4cqw' }}>នាយកសាលាសហគមន៍ច្បារច្រុះ</p>
              </div>

              {/* Body — scales with the frame, justified to both margins */}
              <div className="text-justify mt-1" style={{ fontSize: '2.3cqw', lineHeight: 1.18 }}>
                <p>
                  សូមសរសើរចំពោះសិស្សឈ្មោះ <span className="font-bold text-red-700">{student.name}</span>{' '}
                  ភេទ <span className="font-bold">{student.gender}</span>{' '}
                  {dobText
                    ? <>កើតនៅ<span className="font-semibold">{dobText}</span> </>
                    : <>កើតនៅថ្ងៃទី.......ខែ.........ឆ្នាំ......... </>}
                  រៀនថ្នាក់ទី <span className="font-bold">{student.grade.replace(/^ថ្នាក់ទី\s*/, '')}</span>{' '}
                  ដែលទទួលបានលទ្ធផលល្អក្នុងការសិក្សា និងទទួលបាននិទ្ទេស{' '}
                  <span className="font-bold text-red-700">{niddes.km} ({niddes.en})</span>
                  {' '}<span className="font-bold">{period}</span> ។
                </p>
                <p className="mt-1">ប័ណ្ណសរសើរនេះប្រគល់ជូនសាមីខ្លួនប្រើប្រាស់តាមការដែលអាចប្រើបាន។</p>
              </div>

              {/* Student photo — centered just below the text. Empty box is screen-only (click to add). */}
              <div className="flex justify-center mt-1">
                {photo ? (
                  <div className="flex flex-col items-center">
                    <div className="rounded-lg overflow-hidden border-2 border-amber-300 shadow-sm" style={{ width: '5.5cqw', height: '6.5cqw' }}>
                      <img src={photo} alt={student.name} className="w-full h-full object-cover" />
                    </div>
                    <button onClick={() => fileRef.current?.click()} className="rc-no-print mt-0.5 text-[10px] text-blue-500 hover:underline">ប្តូររូប</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rc-no-print flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-blue-500 hover:border-blue-300 border border-dashed border-slate-200 rounded-lg"
                    style={{ width: '5.5cqw', height: '6.5cqw' }}
                    title="ចុចដើម្បីបញ្ចូលរូបថត"
                  >
                    <Camera size={18} />
                    <span className="text-[9px]">បញ្ចូលរូប</span>
                  </button>
                )}
              </div>

              {/* Signatures — principal (left), spacer (center), teacher (right) */}
              <div className="grid gap-3 mt-auto text-center items-end" style={{ gridTemplateColumns: '1fr auto 1fr', fontSize: '1.9cqw' }}>
                <div style={{ transform: 'translateX(-12%)' }}>
                  <p className="font-bold">បានឃើញ និងឯកភាព</p>
                  <p className="font-bold">នាយកសាលា</p>
                  <PrincipalSignature height="6cqw" />
                </div>

                {/* Spacer keeps the principal & teacher columns where they were (photo moved up). */}
                <div style={{ width: '6.5cqw' }} aria-hidden />

                <div>
                  <p style={{ fontSize: '1.3cqw', whiteSpace: 'nowrap' }}>{endDate.lunar}</p>
                  <p style={{ fontSize: '1.3cqw', whiteSpace: 'nowrap' }}>ច្បារច្រុះ ថ្ងៃទី{endDate.day} ខែ{student.month} ឆ្នាំ{endDate.year}</p>
                  <p className="font-bold pt-1">គ្រូប្រចាំថ្នាក់</p>
                  <TeacherSignature grade={student.grade} height="4.5cqw" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
