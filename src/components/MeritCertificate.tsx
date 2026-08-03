/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Printer, X, Camera, Download, Loader2, Image as ImageIcon, Award } from 'lucide-react';
import { StudentScore } from '../types';
import { baseStudentName } from '../utils/studentKey';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature, { teacherNameForGrade } from './TeacherSignature';
import { khmerLunarFull } from '../utils/khmerDate';
import { exportElementToPdf, exportElementToImage } from '../utils/exportPdf';

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

// Render the period with the MONTH and the academic YEAR in bold, while
// "ប្រចាំខែ" / "ឆ្នាំសិក្សា" stay normal weight. Falls back to bolding just the
// year range for non-monthly phrases (semester / annual).
const YEAR_RANGE = /[០-៩]{4}\s*[-–]\s*[០-៩]{4}/;
const renderPeriod = (period: string): React.ReactNode => {
  const m = period.match(/^(ប្រចាំខែ)(.+?)\s*(ឆ្នាំសិក្សា)\s*([០-៩]{4}\s*[-–]\s*[០-៩]{4})\s*$/);
  if (m) return <>{m[1]}<span className="font-bold">{m[2]}</span> {m[3]} <span className="font-bold">{m[4]}</span></>;
  return period.split(new RegExp(`(${YEAR_RANGE.source})`)).map((p, i) =>
    YEAR_RANGE.test(p) ? <span key={i} className="font-bold">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>);
};

// Render a "ថ្ងៃទី <d> ខែ <m> ឆ្នាំ <y>" date with the day / month / year values in
// bold and the labels normal. Falls back to bolding the whole string if the date
// isn't in that long form (e.g. a raw "DD/MM/YYYY").
const renderDob = (text: string): React.ReactNode => {
  const m = text.match(/^(ថ្ងៃទី)\s*(.+?)\s*(ខែ)\s*(.+?)\s*(ឆ្នាំ)\s*(.+?)\s*$/);
  if (m) return <>{m[1]} <span className="font-bold">{m[2]}</span> {m[3]} <span className="font-bold">{m[4]}</span> {m[5]} <span className="font-bold">{m[6]}</span></>;
  return <span className="font-bold">{text}</span>;
};

export default function MeritCertificate({ student, students, scoreOverride, periodPhrase, onClose }: MeritCertificateProps) {
  const isEnglish = /grade|អង់គ្លេស/i.test(student.grade);
  const teacherName = teacherNameForGrade(student.grade);
  const niddes = gradeBand(scoreOverride ?? student.overallAvg);
  const period = periodPhrase || `ប្រចាំខែ${student.month} ឆ្នាំសិក្សា ២០២៥-២០២៦`;
  // Issue date auto-fills from the record's month for a monthly cert. For a
  // semester/year cert the record's "month" is an exam string (e.g. ប្រឡងឆមាសទី១),
  // so derive the period-end calendar month from the phrase instead.
  const isCalMonth = KH_MONTHS.includes((student.month || '').trim());
  const dateMonth = isCalMonth ? student.month
    : /ឆមាសទី\s*១/.test(period) ? 'មីនា'
    : /ឆមាសទី\s*២/.test(period) ? 'សីហា'
    : /ប្រចាំឆ្នាំ/.test(period) ? 'សីហា'
    : student.month;
  const endDate = monthEndDate(dateMonth);

  // Date of birth — fall back to any of this student's rows (by អត្តលេខ, then name).
  const dobFrom = (pred: (s: StudentScore) => boolean) => students.find(s => pred(s) && !!s.dob)?.dob;
  const sid = (student as any).studentId;
  const resolvedDob = student.dob
    || (sid ? dobFrom(s => (s as any).studentId === sid) : '')
    || dobFrom(s => s.name?.trim() === student.name?.trim())
    // After-hours classes tag the name ("… (PE)"); match the general-class row by
    // the base name so the dob carries over to extra-class certificates too.
    || dobFrom(s => baseStudentName(s.name) === baseStudentName(student.name))
    || '';
  const dobText = formatDob(resolvedDob);

  // Student photo — uploaded once per student, kept in localStorage (not in Supabase).
  const photoKey = `meritphoto::${student.grade}::${student.name.trim()}`;
  const [photo, setPhoto] = useState<string>(() => {
    try { return localStorage.getItem(photoKey) || ''; } catch { return ''; }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  // The certificate is laid out in container-query units (cqw). Both prior export
  // paths broke on phones: window.print() (mobile Chrome mis-paginates the
  // landscape sheet) and plain html2canvas (no cqw support → cramped). We render
  // via html2canvas at a FIXED width so cqw resolves to full size on every device.
  const CERT_EXPORT_WIDTH = 1240;
  const [pdfBusy, setPdfBusy] = useState(false);
  const handleDownloadPdf = async () => {
    const el = document.getElementById('merit-cert');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToPdf(el, `ប័ណ្ណសរសើរ_${student.name.replace(/\s+/g, '_')}`, CERT_EXPORT_WIDTH); }
    catch (e) { console.error('PDF export failed', e); alert('មិនអាចបង្កើត PDF បានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setPdfBusy(false); }
  };
  // Download the certificate as a PNG image.
  const [imgBusy, setImgBusy] = useState(false);
  const handleDownloadImage = async () => {
    const el = document.getElementById('merit-cert');
    if (!el) return;
    setImgBusy(true);
    try { await exportElementToImage(el, `ប័ណ្ណសរសើរ_${student.name.replace(/\s+/g, '_')}`, CERT_EXPORT_WIDTH); }
    catch (e) { console.error('Image export failed', e); alert('មិនអាចបង្កើតរូបភាពបានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setImgBusy(false); }
  };
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {/* max-w-5xl normally; in landscape (short viewport) the width is also
          capped so the 1.414:1 certificate fits on screen without scrolling. */}
      <div className="w-full" style={{ maxWidth: 'min(64rem, calc((100dvh - 120px) * 1.414))' }}>
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">ប័ណ្ណសរសើរ — {student.name} ({niddes.en})</h3>
          <div className="flex items-center justify-end flex-wrap gap-2">
            <button onClick={handleDownloadPdf} disabled={pdfBusy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} ទាញយក PDF
            </button>
            <button onClick={handleDownloadImage} disabled={imgBusy} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              {imgBusy ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} ទាញយករូបភាព
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        {/* Certificate sheet (landscape) */}
        <div id="merit-cert" className="bg-white rounded-b-2xl">
          {isEnglish ? (
            <div className="relative w-full overflow-hidden text-[#0f2249] bg-white font-sans" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size', border: '1.5cqw solid #0f2249', padding: '1cqw' }}>
              <div className="relative w-full h-full border-[0.4cqw] border-[#c89b3f] flex flex-col items-center justify-center p-[4cqw]">
                {/* Top Corners */}
                <div className="absolute top-0 left-0 w-[4cqw] h-[4cqw] border-t-[0.4cqw] border-l-[0.4cqw] border-[#0f2249]" style={{ transform: 'translate(-0.4cqw, -0.4cqw)' }} />
                <div className="absolute top-0 right-0 w-[4cqw] h-[4cqw] border-t-[0.4cqw] border-r-[0.4cqw] border-[#0f2249]" style={{ transform: 'translate(0.4cqw, -0.4cqw)' }} />
                <div className="absolute bottom-0 left-0 w-[4cqw] h-[4cqw] border-b-[0.4cqw] border-l-[0.4cqw] border-[#0f2249]" style={{ transform: 'translate(-0.4cqw, 0.4cqw)' }} />
                <div className="absolute bottom-0 right-0 w-[4cqw] h-[4cqw] border-b-[0.4cqw] border-r-[0.4cqw] border-[#0f2249]" style={{ transform: 'translate(0.4cqw, 0.4cqw)' }} />
                
                {/* Decorative Swirls could be placed here if we had SVGs, but the clean border looks great. */}
                
                {/* Logo */}
                <div style={{ width: '8cqw', marginTop: '-2cqw' }}><SchoolLogo className="w-full h-auto" /></div>
                <div className="font-bold mt-1 text-[#0f2249]" style={{ fontSize: '1cqw' }}>CHBAR CHROS COMMUNITY SCHOOL</div>
                
                {/* Title */}
                <h1 className="mt-[1.5cqw] font-serif uppercase tracking-widest text-[#0f2249]" style={{ fontSize: '4.2cqw', fontWeight: 900 }}>
                  Certificate of Achievement
                </h1>
                
                {/* Subtitle */}
                <div className="flex items-center gap-4 mt-[1cqw] w-3/4">
                  <div className="h-[0.15cqw] bg-[#c89b3f] flex-1"></div>
                  <p className="uppercase tracking-widest text-slate-700 font-semibold" style={{ fontSize: '1cqw' }}>
                    This certificate is proudly presented to
                  </p>
                  <div className="h-[0.15cqw] bg-[#c89b3f] flex-1"></div>
                </div>
                
                {/* Name */}
                <h2 className="mt-[1cqw] text-[#0f2249]" style={{ fontFamily: "'Great Vibes', cursive", fontSize: '7.5cqw', fontWeight: 500 }}>
                  {student.name}
                </h2>
                <div className="w-[75%] h-[0.15cqw] bg-[#c89b3f] mt-2 mb-[2cqw]"></div>
                
                {/* Reason */}
                <p className="text-center text-slate-700 max-w-[85%]" style={{ fontSize: '1.2cqw', lineHeight: 1.6 }}>
                  For your outstanding effort and achievement in academic performance,<br/>
                  positive attitude, and active participation in all learning activities.<br/>
                  Keep up the great work!
                </p>
                
                {/* Bottom Section */}
                <div className="absolute bottom-[2cqw] left-[5cqw] right-[5cqw] flex justify-between items-end">
                  {/* Principal */}
                  <div className="text-center flex flex-col items-center w-[22cqw]">
                    <div style={{ height: '5cqw' }} className="flex items-end justify-center">
                      <PrincipalSignature height="100%" />
                    </div>
                    <div className="w-full h-[0.15cqw] bg-[#0f2249] mt-[1cqw] mb-[0.5cqw]"></div>
                    <p className="font-bold text-[#0f2249]" style={{ fontSize: '1.2cqw' }}>PHORN SOPHAK</p>
                    <p className="text-slate-500 uppercase tracking-wider" style={{ fontSize: '0.9cqw' }}>School Principal</p>
                  </div>
                  
                  {/* Ribbon */}
                  <div className="flex flex-col items-center" style={{ marginBottom: '1cqw' }}>
                    <div className="relative flex items-center justify-center bg-amber-400 rounded-full border-[0.4cqw] border-amber-200 shadow-sm" style={{ width: '6.5cqw', height: '6.5cqw' }}>
                      <Award size={48} className="absolute text-amber-600" style={{ width: '4.5cqw', height: '4.5cqw' }} />
                    </div>
                    <div className="flex items-end gap-2 mt-[1cqw]">
                      <span className="font-bold text-[#0f2249]" style={{ fontSize: '1.1cqw' }}>DATE:</span>
                      <span className="border-b-[0.15cqw] border-[#0f2249] w-[12cqw] inline-block text-center text-[#0f2249] font-medium" style={{ fontSize: '1.1cqw' }}>
                        {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Teacher */}
                  <div className="text-center flex flex-col items-center w-[22cqw]">
                    <div style={{ height: '5cqw' }} className="flex items-end justify-center relative teacher-sig-container">
                      <TeacherSignature grade={student.grade} height="100%" />
                    </div>
                    <div className="w-full h-[0.15cqw] bg-[#0f2249] mt-[1cqw] mb-[0.5cqw]"></div>
                    <p className="font-bold text-[#0f2249] uppercase" style={{ fontSize: '1.2cqw' }}>
                      {teacherName || '..............................'}
                    </p>
                    <p className="text-slate-500 uppercase tracking-wider" style={{ fontSize: '0.9cqw' }}>Class Teacher</p>
                  </div>
                </div>
              </div>
              
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
                .teacher-sig-container p { display: none; }
              `}</style>
            </div>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size' }}>
              <img src="/cert-frame.png" alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />
              <div className="absolute inset-0 flex flex-col text-slate-800" style={{ padding: '7.5% 13% 11%' }}>

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
                  <h1 className="font-extrabold text-red-600 tracking-wide" style={{ fontFamily: "'Khmer OS Muol Light','Khmer OS Moul Light','Moul',serif", fontSize: '3.8cqw', lineHeight: 1.15 }}>ប័ណ្ណសរសើរ</h1>
                  <p className="font-bold text-slate-700" style={{ fontSize: '2.4cqw' }}>នាយកសាលាសហគមន៍ច្បារច្រុះ</p>
                </div>

                {/* Body — scales with the frame, justified to both margins. Sized so the
                    date of birth lands on line 1 and the niddes on line 2 (even for long names). */}
                <div className="text-justify mt-1" style={{ fontSize: '2.0cqw', lineHeight: 1.55 }}>
                  <p>
                    សូមសរសើរចំពោះសិស្សឈ្មោះ <span className="font-bold text-red-700">{student.name}</span>{' '}
                    ភេទ <span className="font-bold">{student.gender}</span>{' '}
                    {dobText
                      ? <>កើតនៅ<span style={{ whiteSpace: 'nowrap' }}>{renderDob(dobText)}</span> </>
                      : <>កើតនៅថ្ងៃទី.......ខែ.........ឆ្នាំ......... </>}
                    រៀនថ្នាក់ទី <span className="font-bold">{student.grade.replace(/^ថ្នាក់ទី\s*/, '')}</span>{' '}
                    ដែលទទួលបានលទ្ធផលល្អក្នុងការសិក្សា និងទទួលបាននិទ្ទេស{' '}
                    <span className="font-bold text-red-700" style={{ whiteSpace: 'nowrap' }}>{niddes.km} ({niddes.en})</span>
                    {' '}{renderPeriod(period)} ។
                  </p>
                  <p className="mt-3">ប័ណ្ណសរសើរនេះប្រគល់ជូនសាមីខ្លួនប្រើប្រាស់តាមការដែលអាចប្រើបាន។</p>
                </div>

                {/* Signatures — principal (left), student photo (center), teacher + date (right).
                    Top-aligned so «បានឃើញ និងឯកភាព» sits level with the date; the teacher
                    signature height is matched so the two names line up at the bottom too. */}
                <div className="grid gap-3 mt-auto text-center items-start" style={{ gridTemplateColumns: '1fr auto 1fr', fontSize: '1.9cqw' }}>
                  <div style={{ transform: 'translateX(-12%)' }}>
                    <p className="font-bold">បានឃើញ និងឯកភាព</p>
                    <p className="font-bold">នាយកសាលា</p>
                    <PrincipalSignature height="7.5cqw" />
                  </div>

                  {/* Photo — centered between the principal block and the teacher block. Empty box is screen-only (click to add). */}
                  <div className="flex flex-col items-center self-center">
                    {photo ? (
                      <>
                        <div className="rounded-lg overflow-hidden border-2 border-amber-300 shadow-sm" style={{ width: '6cqw', height: '7.5cqw' }}>
                          <img src={photo} alt={student.name} className="w-full h-full object-cover" />
                        </div>
                        <button onClick={() => fileRef.current?.click()} className="rc-no-print mt-0.5 text-[10px] text-blue-500 hover:underline">ប្តូររូប</button>
                      </>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="rc-no-print flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-blue-500 hover:border-blue-300 border border-dashed border-slate-200 rounded-lg"
                        style={{ width: '6cqw', height: '7.5cqw' }}
                        title="ចុចដើម្បីបញ្ចូលរូបថត"
                      >
                        <Camera size={16} />
                        <span className="text-[9px]">បញ្ចូលរូប</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <p style={{ fontSize: '1.3cqw', whiteSpace: 'nowrap' }}>{endDate.lunar}</p>
                    <p style={{ fontSize: '1.3cqw', whiteSpace: 'nowrap' }}>ច្បារច្រុះ ថ្ងៃទី{endDate.day} ខែ{dateMonth} ឆ្នាំ{endDate.year}</p>
                    <p className="font-bold pt-1">គ្រូប្រចាំថ្នាក់</p>
                    <TeacherSignature grade={student.grade} height="6.5cqw" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
