/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Printer, X, Camera, Download, Loader2, Image as ImageIcon, Award } from 'lucide-react';
import { StudentScore } from '../types';
import { baseStudentName } from '../utils/studentKey';
import { transliterateKhmerName } from '../utils/khmerToLatin';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature, { teacherNameForGrade } from './TeacherSignature';
import { khmerLunarFull } from '../utils/khmerDate';
import { exportCertToPdf, exportCertToImage } from '../utils/exportPdf';
import { getAcademicYear, getEndYear, academicYearNumForMonth } from '../lib/schoolYear';
import certFrameEnglish from '../assets/cert-frame-english.jpg';
import certFrame from '../assets/cert-frame.png';

interface MeritCertificateProps {
  student: StudentScore;
  students: StudentScore[]; // full list — to resolve dob from any of the student's rows
  scoreOverride?: number | null; // the average for the active period (semester/annual)
  periodPhrase?: string;         // e.g. "ប្រចាំខែមិថុនា ឆ្នាំសិក្សា ២០២៥-២០២៦"
  // 'merit' = ប័ណ្ណសរសើរ (default). 'completion' = វិញ្ញាបនបត្របញ្ជាក់ការសិក្សា — the
  // grade-6 study-completion certificate; same frame/logo/school name, different
  // title + wording, and always the Khmer layout.
  certType?: 'merit' | 'completion';
  onClose: () => void;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const EN_MONTHS: Record<string, string> = {
  'មករា': 'January', 'កុម្ភៈ': 'February', 'មីនា': 'March', 'មេសា': 'April',
  'ឧសភា': 'May', 'មិថុនា': 'June', 'កក្កដា': 'July', 'សីហា': 'August',
  'កញ្ញា': 'September', 'តុលា': 'October', 'វិច្ឆិកា': 'November', 'ធ្នូ': 'December'
};
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
  if (idx < 0) return { day: '.....', year: toKh(getEndYear()), lunar: khmerLunarFull(new Date()) };
  const yearNum = academicYearNumForMonth(idx);
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

export default function MeritCertificate({ student, students, scoreOverride, periodPhrase, certType = 'merit', onClose }: MeritCertificateProps) {
  const isCompletion = certType === 'completion';
  // The completion certificate is always the Khmer layout, even for English classes.
  const isEnglish = !isCompletion && /grade|អង់គ្លេស/i.test(student.grade);
  const certName = isEnglish ? (student.englishName ? student.englishName.trim() : transliterateKhmerName(baseStudentName(student.name))) : baseStudentName(student.name);
  const teacherName = teacherNameForGrade(student.grade);
  const avgVal = scoreOverride ?? student.overallAvg;
  const avgKh = avgVal != null && avgVal > 0 ? toKh(avgVal.toFixed(2)).replace('.', ',') : '..........';
  const niddes = gradeBand(avgVal);
  const period = periodPhrase || `ប្រចាំខែ${student.month} ឆ្នាំសិក្សា ${getAcademicYear()}`;
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
  const enEndDate = (() => {
    const idx = KH_MONTHS.indexOf((dateMonth || '').trim());
    if (idx < 0) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const yearNum = academicYearNumForMonth(idx);
    return new Date(yearNum, idx, MONTH_LAST_DAY[idx]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

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
      try { await exportCertToPdf(el, `${isCompletion ? 'វិញ្ញាបនបត្រ' : 'ប័ណ្ណសរសើរ'}_${student.name.replace(/\s+/g, '_')}`, CERT_EXPORT_WIDTH); }
      catch (e: any) { console.error('PDF export failed', e); alert('មិនអាចទាញយក PDF បានទេ - សូមព្យាយាមម្តងទៀត។ Error: ' + String(e?.message || e)); }
      finally { setPdfBusy(false); }
  };
  // Download the certificate as a PNG image.
  const [imgBusy, setImgBusy] = useState(false);
  const handleDownloadImage = async () => {
    const el = document.getElementById('merit-cert');
    if (!el) return;
    setImgBusy(true);
      try { await exportCertToImage(el, `${isCompletion ? 'វិញ្ញាបនបត្រ' : 'ប័ណ្ណសរសើរ'}_${student.name.replace(/\s+/g, '_')}`, CERT_EXPORT_WIDTH); }
      catch (e: any) { console.error('Image export failed', e); alert('មិនអាចបង្កើតរូបភាពបានទេ — សូមព្យាយាមម្តងទៀត។ Error: ' + String(e?.message || e)); }
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

  let enTitle = "Student of the Month";
  let enPeriod = period || 'January 2025';
  Object.keys(EN_MONTHS).forEach(khMonth => {
    if (period.includes(khMonth)) enPeriod = EN_MONTHS[khMonth];
  });
  
  if (/(ឆមាស|semester)/i.test(period)) {
    enTitle = "Student of the Semester";
    enPeriod = /១|1/.test(period) ? "Semester 1" : /២|2/.test(period) ? "Semester 2" : "the Semester";
  } else if (/(ត្រីមាស|quarter|term)/i.test(period)) {
    enTitle = "Student of the Term";
    enPeriod = /១|1/.test(period) ? "Term 1" : /២|2/.test(period) ? "Term 2" : /៣|3/.test(period) ? "Term 3" : /៤|4/.test(period) ? "Term 4" : "the Term";
  } else if (/(ប្រចាំឆ្នាំ|yearly|year)/i.test(period)) {
    enTitle = "Student of the Year";
    enPeriod = "the Academic Year";
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {/* max-w-5xl normally; in landscape (short viewport) the width is also
          capped so the 1.414:1 certificate fits on screen without scrolling. */}
      <div className="w-full" style={{ maxWidth: 'min(64rem, calc((100dvh - 120px) * 1.414))' }}>
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">{isCompletion ? 'វិញ្ញាបនបត្របញ្ជាក់ការសិក្សា' : 'ប័ណ្ណសរសើរ'} — {student.name} ({niddes.en})</h3>
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
            <div className="relative w-full cert-english overflow-hidden bg-white text-[#0f2249] font-sans" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size' }}>
              
              {/* Uploaded Image Frame */}
              <img src={certFrameEnglish} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none object-cover" />

              {/* Central Large Watermark (School Logo) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                <SchoolLogo className="w-[40cqw] h-auto grayscale" />
              </div>

              {/* Content Container */}
              <div className="relative w-full h-full flex flex-col items-center justify-start pt-[8cqw] px-[10cqw]">
                
                {/* Header / Logo */}
                <div style={{ width: '9cqw', marginBottom: '1cqw' }}>
                  <SchoolLogo className="w-full h-auto mix-blend-multiply" />
                </div>
                
                {/* Title */}
                <h1 className="font-serif tracking-widest text-[#0f2249] flex items-center justify-center font-bold" style={{ fontSize: '3.8cqw' }}>
                  <span style={{ fontSize: '4.5cqw' }}>C</span>ERTIFICATE
                  <span className="mx-3" style={{ fontSize: '2.5cqw', fontStyle: 'italic', fontWeight: 'normal', textTransform: 'lowercase' }}>of</span>
                  <span style={{ fontSize: '4.5cqw' }}>A</span>CHIEVEMENT
                </h1>
                
                {/* Subtitle */}
                <div className="flex items-center justify-center gap-3 mt-[1.5cqw] w-[80%]">
                  <div className="w-[0.5cqw] h-[0.5cqw] bg-[#d0a747] rotate-45 shrink-0"></div>
                  <div className="flex-grow h-[2px] bg-[#d0a747]"></div>
                  <p className="uppercase tracking-[0.15em] font-medium text-[#0f2249] shrink-0 px-3" style={{ fontSize: '1.2cqw' }}>
                    THIS CERTIFICATE IS PROUDLY PRESENTED TO
                  </p>
                  <div className="flex-grow h-[2px] bg-[#d0a747]"></div>
                  <div className="w-[0.5cqw] h-[0.5cqw] bg-[#d0a747] rotate-45 shrink-0"></div>
                </div>
                
                {/* Name */}
                  <h2 className={`mt-[2cqw] text-[#0f2249] ${!certName.match(/[ក-៹]/) ? 'font-bold' : ''}`} style={{ 
                    fontFamily: certName.match(/[ក-៹]/) ? "'Khmer OS Muol Light','Khmer OS Moul Light','Moul',serif" : "'Poppins', sans-serif", 
                    fontSize: certName.match(/[ក-៹]/) ? '4.5cqw' : '5.5cqw',
                    lineHeight: 1.2
                  }}>
                    {certName}
                  </h2>
                
                {/* Separator */}
                <div className="w-[75%] h-[1.5px] bg-[#d0a747] mt-[0.5cqw] mb-[2cqw]"></div>
                
                {/* Paragraph */}
                <div className="text-center text-[#334155] flex flex-col gap-1.5" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '1.2cqw', lineHeight: 1.6, maxWidth: '85%' }}>
                  <p>
                    For being the <span className="font-bold text-[#0f2249]">{enTitle}</span> of <span className="font-bold text-[#0f2249]">{student.grade.match(/^[a-zA-Z]/) ? student.grade : `Class ${student.grade.replace(/^ថ្នាក់ទី\s*/, '')}`}</span> for <span className="font-bold text-[#0f2249]">{enPeriod}</span>. Your hard work, positive attitude, and good behavior make you a wonderful student. You are kind, respectful, and always ready to learn.
                  </p>
                  <p>
                    We are proud of your achievements. Keep doing your best and continue to be a great example for others.
                  </p>
                </div>
              </div>
              
              {/* Footer Area */}
              <div className="absolute inset-x-0 bottom-[7cqw] flex justify-between items-end px-[12cqw]">
                
                {/* Principal */}
                  <div className="text-center flex flex-col items-center w-[20cqw] sig-container">
                    <div style={{ height: '6cqw', width: '100%' }} className="flex items-end justify-center mb-1">
                      <PrincipalSignature height="6cqw" />
                    </div>
                    <div className="w-full h-[2px] bg-[#d0a747] mb-[0.8cqw] opacity-70"></div>
                    <div className="text-[#0f2249] font-bold tracking-wider uppercase" style={{ fontSize: '1.2cqw' }}>PHORN SOPHAK</div>
                  <div className="text-slate-600 uppercase mt-[0.2cqw]" style={{ fontSize: '1cqw' }}>SCHOOL PRINCIPAL</div>
                </div>

                {/* Center Seal and Date */}
                <div className="flex flex-col items-center justify-end w-[25cqw] translate-y-[1cqw]">
                  {/* Dynamic SVG Medal */}
                  <div className="relative flex justify-center items-center mb-[1cqw]">
                    <div style={{ position: 'relative', width: '12cqw', height: '15.6cqw' }}>
                    <svg viewBox="0 0 100 130" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}>
                      <defs>
                        <linearGradient id="goldM" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f3d578" />
                          <stop offset="30%" stopColor="#d0a747" />
                          <stop offset="50%" stopColor="#fff5c3" />
                          <stop offset="70%" stopColor="#d0a747" />
                          <stop offset="100%" stopColor="#b38222" />
                        </linearGradient>
                        <linearGradient id="blueRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#08142c" />
                          <stop offset="20%" stopColor="#142c5c" />
                          <stop offset="50%" stopColor="#1e3a8a" />
                          <stop offset="80%" stopColor="#142c5c" />
                          <stop offset="100%" stopColor="#08142c" />
                        </linearGradient>
                        <linearGradient id="blueCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#0f2249" />
                          <stop offset="100%" stopColor="#08142c" />
                        </linearGradient>
                      </defs>
                      
                      {/* Left Ribbon */}
                      <polygon points="25,60 10,120 25,105 40,120 45,60" fill="url(#blueRibbon)" />
                      <polygon points="25,60 14,116 25,102 36,116 41,60" fill="none" stroke="url(#goldM)" strokeWidth="1.5" />
                      
                      {/* Right Ribbon */}
                      <polygon points="55,60 60,120 75,105 90,120 75,60" fill="url(#blueRibbon)" />
                      <polygon points="59,60 64,116 75,102 86,116 75,60" fill="none" stroke="url(#goldM)" strokeWidth="1.5" />

                      {/* Gold Seal Base */}
                      <path d="M 50 2 C 54 2 56 6 60 7 C 64 8 68 5 71 8 C 74 11 73 15 77 18 C 81 21 86 21 88 25 C 90 29 87 33 89 37 C 91 41 96 44 96 48 C 96 52 91 55 89 59 C 87 63 90 67 88 71 C 86 75 81 75 77 78 C 73 81 74 85 71 88 C 68 91 64 88 60 89 C 56 90 54 94 50 94 C 46 94 44 90 40 89 C 36 88 32 91 29 88 C 26 85 27 81 23 78 C 19 75 14 75 12 71 C 10 67 13 63 11 59 C 9 55 4 52 4 48 C 4 44 9 41 11 37 C 13 33 10 29 12 25 C 14 21 19 21 23 18 C 27 15 26 11 29 8 C 32 5 36 8 40 7 C 44 6 46 2 50 2 Z" fill="url(#goldM)" />
                      
                      {/* Inner Circles */}
                      <circle cx="50" cy="48" r="38" fill="url(#blueCenter)" />
                      <circle cx="50" cy="48" r="36" fill="none" stroke="url(#goldM)" strokeWidth="1" strokeDasharray="1.5,1.5" />
                      <circle cx="50" cy="48" r="34" fill="none" stroke="url(#goldM)" strokeWidth="1.5" />

                      {/* Stars Top */}
                      <g fill="url(#goldM)" transform="translate(50, 20)">
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(0, 0) scale(1.6)" />
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(-12, 3) scale(1.2)" />
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(12, 3) scale(1.2)" />
                      </g>

                      {/* Stars Bottom */}
                      <g fill="url(#goldM)" transform="translate(50, 76)">
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(0, 0) scale(1.6)" />
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(-12, -3) scale(1.2)" />
                        <polygon points="0,-3 1,-1 3,-1 1.5,0.5 2,2.5 0,1.5 -2,2.5 -1.5,0.5 -3,-1 -1,-1" transform="translate(12, -3) scale(1.2)" />
                      </g>

                    </svg>
                    {/* letter as an HTML overlay */}
                    <div style={{ position: 'absolute', left: '50%', top: '37%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#efd27a', textShadow: '0 0.1cqw 0.2cqw rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
                      <span style={{ fontFamily: 'serif', fontSize: '5cqw', fontWeight: 900, lineHeight: 1 }}>{niddes?.en || 'A'}</span>
                    </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-end justify-center w-full translate-y-[-1cqw]">
                    <div className="text-[#0f2249] font-bold tracking-wider mr-2" style={{ fontSize: '1.2cqw' }}>DATE:</div>
                    <div className="border-b-[2px] border-[#d0a747] text-[#0f2249] font-bold px-4 text-center" style={{ fontSize: '1.2cqw', minWidth: '12cqw' }}>
                      {enEndDate}
                    </div>
                  </div>
                </div>
                {/* Teacher */}
                  <div className="text-center flex flex-col items-center w-[20cqw] sig-container">
                    <div style={{ height: '6cqw', width: '100%' }} className="flex items-end justify-center mb-1">
                      <TeacherSignature grade={student.grade} height="6cqw" />
                    </div>
                    <div className="w-full h-[2px] bg-[#d0a747] mb-[0.8cqw] opacity-70"></div>
                    <div className="text-[#0f2249] font-bold tracking-wider uppercase" style={{ fontSize: '1.2cqw' }}>
                    {(!teacherName || teacherName.includes('យន') || teacherName.includes('យ៉ាវ')) ? 'YORN YAV' : teacherName}
                  </div>
                  <div className="text-slate-600 uppercase mt-[0.2cqw]" style={{ fontSize: '1cqw' }}>CLASS TEACHER</div>
                </div>
              </div>
              
              <style>{`
                .cert-english .sig-container p { display: none !important; }
              `}</style>
            </div>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size' }}>
              <img src={certFrame} alt="" className="absolute inset-0 w-full h-full pointer-events-none select-none" />
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
                  <h1 className="font-extrabold text-red-600 tracking-wide" style={{ fontFamily: "'Khmer OS Muol Light','Khmer OS Moul Light','Moul',serif", fontSize: isCompletion ? '3cqw' : '3.8cqw', lineHeight: 1.15 }}>{isCompletion ? 'វិញ្ញាបនបត្របញ្ជាក់ការសិក្សា' : 'ប័ណ្ណសរសើរ'}</h1>
                  <p className="font-bold text-slate-700" style={{ fontSize: '2.4cqw' }}>នាយកសាលាសហគមន៍ច្បារច្រុះ</p>
                </div>

                {/* Body — scales with the frame, justified to both margins. Sized so the
                    date of birth lands on line 1 and the niddes on line 2 (even for long names). */}
                <div className="text-justify mt-1" style={{ fontSize: '2.0cqw', lineHeight: 1.55 }}>
                  {isCompletion ? (
                    <p>
                      សូមបញ្ជាក់ថាសិស្សឈ្មោះ <span className="font-bold text-red-700">{student.name}</span>{' '}
                      ភេទ <span className="font-bold">{student.gender}</span>{' '}
                      {dobText
                        ? <>កើតនៅ<span style={{ whiteSpace: 'nowrap' }}>{renderDob(dobText)}</span> </>
                        : <>កើតនៅថ្ងៃទី.......ខែ.........ឆ្នាំ......... </>}
                      ពិតជាបានបញ្ចប់ការសិក្សានៅកម្រិតថ្នាក់ទី <span className="font-bold">{student.grade.replace(/^ថ្នាក់ទី\s*/, '')}</span> ដោយជោគជ័យ ដោយទទួលបានមធ្យមភាគប្រចាំឆ្នាំ{' '}
                      <span className="font-bold text-red-700">{avgKh}</span>{' '}
                      និងនិទ្ទេស <span className="font-bold text-red-700" style={{ whiteSpace: 'nowrap' }}>{niddes.km} ({niddes.en})</span>{' '}
                      ក្នុងឆ្នាំសិក្សា <span className="font-bold">{getAcademicYear()}</span> ។
                    </p>
                  ) : (
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
                  )}
                  <p className="mt-3">{isCompletion ? 'វិញ្ញាបនបត្រ' : 'ប័ណ្ណសរសើរ'}នេះប្រគល់ជូនសាមីខ្លួនប្រើប្រាស់តាមការដែលអាចប្រើបាន។</p>
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
