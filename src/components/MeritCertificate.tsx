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
  const certName = isEnglish ? (student.englishName ? student.englishName.trim() : transliterateKhmerName(baseStudentName(student.name))) : baseStudentName(student.name);
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
  const enEndDate = (() => {
    const idx = KH_MONTHS.indexOf((dateMonth || '').trim());
    if (idx < 0) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const yearNum = idx >= 8 ? 2025 : 2026;
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
            <div className="relative w-full cert-english overflow-hidden bg-white text-[#0f2249]" style={{ aspectRatio: '1.414 / 1', containerType: 'inline-size' }}>
              {/* Pure CSS/SVG Background Frame matching the user's template */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 707">
                {/* Outer Dark Blue Background */}
                <rect x="0" y="0" width="1000" height="707" fill="#051b43" />
                
                {/* Outer Thin Gold Border */}
                <rect x="15" y="15" width="970" height="677" fill="none" stroke="#d0a747" strokeWidth="2" />
                
                {/* Corner Gold Double Ribbons */}
                <g fill="#d0a747">
                  {/* Top Left */}
                  <polygon points="0,100 0,70 70,0 100,0" />
                  <polygon points="0,150 0,110 110,0 150,0" />
                  {/* Top Right */}
                  <polygon points="1000,100 1000,70 930,0 900,0" />
                  <polygon points="1000,150 1000,110 890,0 850,0" />
                  {/* Bottom Left */}
                  <polygon points="0,607 0,637 70,707 100,707" />
                  <polygon points="0,557 0,597 110,707 150,707" />
                  {/* Bottom Right */}
                  <polygon points="1000,607 1000,637 930,707 900,707" />
                  <polygon points="1000,557 1000,597 890,707 850,707" />
                </g>
                
                {/* Inner White Octagon */}
                <polygon points="200,40 800,40 960,200 960,507 800,667 200,667 40,507 40,200" fill="#ffffff" stroke="#d0a747" strokeWidth="6" />
                
                {/* Inner Thin Dark Blue Octagon */}
                <polygon points="222,52 778,52 948,222 948,485 778,655 222,655 52,485 52,222" fill="none" stroke="#051b43" strokeWidth="1.5" />
                
                {/* Innermost Thin Gold Octagon */}
                <polygon points="234,58 766,58 942,234 942,473 766,649 234,649 58,473 58,234" fill="none" stroke="#d0a747" strokeWidth="1" />
                
                {/* Gold Wave Watermarks (Left and Right) */}
                <g opacity="0.35" stroke="#d0a747" strokeWidth="0.8" fill="none">
                  {/* Left Waves */}
                  <path d="M 50 200 C 200 250, 250 450, 50 500" />
                  <path d="M 50 220 C 180 270, 230 430, 50 480" />
                  <path d="M 50 240 C 160 290, 210 410, 50 460" />
                  <path d="M 50 260 C 140 310, 190 390, 50 440" />
                  <path d="M 50 280 C 120 330, 170 370, 50 420" />
                  <path d="M 50 500 C 200 450, 250 250, 50 200" />
                  <path d="M 50 480 C 180 430, 230 270, 50 220" />
                  <path d="M 50 460 C 160 410, 210 290, 50 240" />
                  
                  {/* Right Waves */}
                  <path d="M 950 200 C 800 250, 750 450, 950 500" />
                  <path d="M 950 220 C 820 270, 770 430, 950 480" />
                  <path d="M 950 240 C 840 290, 790 410, 950 460" />
                  <path d="M 950 260 C 860 310, 810 390, 950 440" />
                  <path d="M 950 280 C 880 330, 830 370, 950 420" />
                  <path d="M 950 500 C 800 450, 750 250, 950 200" />
                  <path d="M 950 480 C 820 430, 770 270, 950 220" />
                  <path d="M 950 460 C 840 410, 790 290, 950 240" />
                </g>
              </svg>
              
              {/* Content Container */}
              <div className="absolute inset-0 flex flex-col items-center z-10" style={{ padding: '5cqw 12cqw' }}>
                
                {/* Header / Logo */}
                <div style={{ width: '12cqw', marginBottom: '1cqw' }}>
                  <SchoolLogo className="w-full h-auto" />
                </div>
                
                {/* Title */}
                <h1 className="font-serif uppercase tracking-wider text-[#0f2249]" style={{ fontSize: '3.6cqw', fontWeight: 900, textShadow: '1px 1px 0px rgba(0,0,0,0.1)' }}>
                  Certificate <span style={{ fontSize: '2.2cqw', fontStyle: 'italic', textTransform: 'lowercase', margin: '0 0.5cqw' }}>of</span> Achievement
                </h1>
                
                {/* Subtitle */}
                <div className="flex items-center justify-center gap-3 mt-[1cqw]">
                  <div className="w-[0.8cqw] h-[0.8cqw] bg-[#d0a747] rotate-45"></div>
                  <p className="uppercase tracking-[0.2em] font-semibold text-slate-700" style={{ fontSize: '1.2cqw' }}>
                    This certificate is proudly presented to
                  </p>
                  <div className="w-[0.8cqw] h-[0.8cqw] bg-[#d0a747] rotate-45"></div>
                </div>
                
                {/* Name */}
                <h2 className="mt-[1cqw] font-bold text-[#0f2249]" style={{ 
                  fontFamily: certName.match(/[ក-អ]/) ? "'Khmer OS Muol Light','Khmer OS Moul Light','Moul',serif" : "'Great Vibes', cursive", 
                  fontSize: certName.match(/[ក-អ]/) ? '4.5cqw' : '7.5cqw',
                  lineHeight: 1.2
                }}>
                  {certName}
                </h2>
                
                {/* Separator */}
                <div className="w-3/4 h-[0.15cqw] bg-[#d0a747] mt-[0.5cqw] mb-[1cqw]"></div>
                
                {/* Paragraph */}
                <div className="text-center text-slate-800 flex flex-col gap-2" style={{ fontSize: '1.3cqw', lineHeight: 1.5, maxWidth: '95%' }}>
                  <p>
                    for being the <span className="font-bold text-[#0f2249]">{enTitle}</span> for <span className="font-bold text-[#0f2249]">{enPeriod}</span>.
                  </p>
                  <p>
                    Your hard work, positive attitude, and good behavior have made you a wonderful student. You are kind, respectful, and always eager to learn.
                  </p>
                  <p>
                    We are proud of all you have achieved. Keep doing your best and continue to be a shining example for others.
                  </p>
                  <p className="font-bold mt-1 text-[#0f2249]">
                    Congratulations! Keep up the great work!
                  </p>
                </div>
                

              </div>
              
              {/* Signatures & Date Section */}
              <div className="absolute inset-x-0 bottom-0 flex justify-between items-end px-[10cqw] z-20" style={{ height: '22cqw' }}>
                {/* Principal Signature */}
                <div className="text-center flex flex-col items-center w-[22cqw] sig-container" style={{ paddingBottom: '7cqw' }}>
                  <div style={{ height: '8cqw', width: '100%' }} className="flex items-end justify-center">
                    <PrincipalSignature height="8cqw" />
                  </div>
                  <div className="w-full h-[0.15cqw] bg-[#0f2249] mt-[0.5cqw] mb-[0.5cqw]"></div>
                  <div className="text-[#0f2249] font-bold tracking-wider" style={{ fontSize: '1.2cqw' }}>PHORN SOPHAK</div>
                  <div className="text-slate-600 tracking-widest uppercase mt-[0.2cqw]" style={{ fontSize: '0.9cqw' }}>School Principal</div>
                </div>
                
                {/* Seal & Date */}
                <div className="text-center flex flex-col items-center justify-end" style={{ width: '22cqw', paddingBottom: '7cqw' }}>
                  <div className="mb-[1.5cqw] relative flex justify-center items-center">
                    <svg width="13cqw" height="13cqw" viewBox="0 0 100 100" className="drop-shadow-lg">
                      <defs>
                        <linearGradient id="gGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f7e192" />
                          <stop offset="50%" stopColor="#c38e30" />
                          <stop offset="100%" stopColor="#f7e192" />
                        </linearGradient>
                        <linearGradient id="gGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#c38e30" />
                          <stop offset="50%" stopColor="#f7e192" />
                          <stop offset="100%" stopColor="#c38e30" />
                        </linearGradient>
                      </defs>
                      <path d="M 25 65 L 15 95 L 35 85 L 50 100 L 65 85 L 85 95 L 75 65 Z" fill="url(#gGrad2)" />
                      <circle cx="50" cy="45" r="30" fill="url(#gGrad1)" />
                      <circle cx="50" cy="45" r="26" fill="url(#gGrad2)" />
                      <circle cx="50" cy="45" r="24" fill="url(#gGrad1)" />
                      <text x="50" y="47" textAnchor="middle" dominantBaseline="middle" fill="#0f2249" fontSize="24" fontWeight="bold" fontFamily="serif">
                        {niddes.en || 'A'}
                      </text>
                    </svg>
                  </div>
                  <div className="flex items-end justify-center w-full">
                    <div className="text-[#0f2249] font-bold tracking-wider mr-2" style={{ fontSize: '1.2cqw' }}>DATE:</div>
                    <div className="border-b-[0.15cqw] border-[#0f2249] text-[#0f2249] font-medium px-2 text-center" style={{ fontSize: '1.2cqw', minWidth: '10cqw' }}>
                      {enEndDate}
                    </div>
                  </div>
                </div>
                
                {/* Teacher Signature */}
                <div className="text-center flex flex-col items-center w-[22cqw] sig-container" style={{ paddingBottom: '7cqw' }}>
                  <div style={{ height: '8cqw', width: '100%' }} className="flex items-end justify-center">
                    <TeacherSignature grade={student.grade} height="8cqw" />
                  </div>
                  <div className="w-full h-[0.15cqw] bg-[#0f2249] mt-[0.5cqw] mb-[0.5cqw]"></div>
                  <div className="text-[#0f2249] font-bold tracking-wider uppercase" style={{ fontSize: '1.2cqw' }}>
                    {(!teacherName || teacherName.includes('យន') || teacherName.includes('យ៉ាវ')) ? 'YORN YAV' : teacherName}
                  </div>
                  <div className="text-slate-600 tracking-widest uppercase mt-[0.2cqw]" style={{ fontSize: '0.9cqw' }}>Class Teacher</div>
                </div>
              </div>
              
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
                .cert-english .sig-container p { display: none !important; }
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
