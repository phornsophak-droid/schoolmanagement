/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// សៀវភៅសិក្ខាគារិក — the official MoEYS student record book, shown read-only for
// reference. The .docx is converted to HTML once at build time (handbook.html,
// imported raw) and rendered here; a button exports it as a multi-page A4 PDF.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Loader2, X, Trash2 } from 'lucide-react';
import handbookHtml from '../assets/handbook.html?raw';
import { exportElementToMultipagePdf } from '../utils/exportPdf';
import { kvReadSync, kvWrite, kvHydrate } from '../lib/kvStore';
import { StudentScore } from '../types';
import { distinctStudentKey } from '../utils/studentKey';
import {
  SEM_SUBJECTS, SEM1_MONTHS, SEM2_MONTHS,
  examAvgOf, monthlyAvgOf, semesterAvgOf, annualAcademicRaw, readAnnualExtra,
} from '../utils/scoring';
import { tallyAbsences } from '../utils/attendance';
import FitToWidth from './FitToWidth';

const PHOTO_KEY = 'handbook_photo';
const SCHOOL = 'សាលាបឋមសិក្សាសហគមន៍ច្បារច្រុះ';
const YEAR = '២០២៥-២០២៦';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const fx = (v: number | null | undefined) => (v === null || v === undefined ? '' : toKh(v.toFixed(2)));

// Fill the layout's {{key|width}} slots. An empty value keeps the original dotted
// rule, so an unfilled book still prints exactly like the blank form.
const fillTokens = (html: string, values: Record<string, string>) =>
  html.replace(/\{\{([a-z0-9_]+)(?:\|(\d+))?\}\}/g, (_m, key: string, width?: string) => {
    const v = (values[key] ?? '').trim();
    if (v) return `<span class="fill">${v}</span>`;
    return width ? '.'.repeat(Number(width)) : '';
  });

// Shrink the chosen photo before storing it. A phone camera shot is several MB —
// far more than the box needs — and the app has hit localStorage quota before, so
// cap the long edge and re-encode as JPEG.
const downscale = (file: File, maxEdge = 600): Promise<string> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    resolve(c.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
  img.src = url;
});

// A4 landscape at 96dpi — 297mm wide. The sheets are laid out at this exact size
// (matching the .docx page setup) and scaled down on screen by FitToWidth.
const SHEET_W = Math.round((297 / 25.4) * 96); // 1123px

interface Props {
  students?: StudentScore[];
  grades?: string[];
  onClose?: () => void;
}

export default function Handbook({ students = [], grades = [], onClose }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [photo, setPhoto] = useState('');
  const [grade, setGrade] = useState('');
  const [studentKey, setStudentKey] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Who this book is for ----
  const roster = useMemo(() => {
    const seen = new Map<string, StudentScore>();
    for (const s of students) {
      if (grade && s.grade !== grade) continue;
      const k = distinctStudentKey(s.name, s.grade);
      if (!seen.has(k)) seen.set(k, s);
    }
    return [...seen.entries()]
      .map(([k, s]) => ({ key: k, name: s.name, grade: s.grade }))
      .sort((a, b) => a.name.localeCompare(b.name, 'km'));
  }, [students, grade]);

  // Every monthly/exam record for the chosen student — the score source.
  const records = useMemo(
    () => (studentKey ? students.filter(s => distinctStudentKey(s.name, s.grade) === studentKey) : []),
    [students, studentKey]
  );
  const student = records[0];

  // Map the student's data onto the layout's fill slots.
  const values = useMemo<Record<string, string>>(() => {
    if (!student) return {};
    const v: Record<string, string> = {
      school: SCHOOL, year: YEAR,
      name: student.name,
      class: student.grade,
      dob: student.dob || '',
      father: student.fatherName || '',
      mother: student.motherName || '',
      address: student.address || '',
      remark: student.remark || '',
    };
    // The identity table's first row = this year's enrolment.
    v.y_0 = YEAR; v.g_0 = student.grade; v.sch_0 = SCHOOL; v.sid_0 = student.studentId || '';

    // Per-subject semester-exam scores.
    const examOf = (sem: 1 | 2) => records.find(s => s.month === (sem === 1 ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២'));
    ([1, 2] as const).forEach(sem => {
      const exam = examOf(sem);
      SEM_SUBJECTS.forEach((sub, i) => {
        const raw = exam ? sub.get(exam) : null;
        v[`s${sem}_${i}`] = raw === null || raw === undefined ? '' : fx(raw as number);
      });
      // Totals block: sum, exam mean, monthly mean, semester mean.
      const nums = SEM_SUBJECTS.map(s => (exam ? s.get(exam) : null)).filter((x): x is number => typeof x === 'number' && x > 0);
      v[`t${sem}_0`] = nums.length ? fx(nums.reduce((a, b) => a + b, 0)) : '';
      v[`t${sem}_1`] = fx(examAvgOf(records, sem));
      v[`t${sem}_2`] = fx(monthlyAvgOf(records, sem));
      v[`t${sem}_3`] = fx(semesterAvgOf(records, sem));
    });

    // ខ- ចំនួនពេលអវត្តមាន, from the saved attendance. tallyAbsences maps the Khmer
    // semester months onto dates and matches every id this person has, so the counts
    // agree with the attendance module (មានច្បាប់ = permission, គ្មានច្បាប់ = absent).
    const roll = students.map(s => ({ id: s.id, name: s.name, grade: s.grade }));
    const a1 = tallyAbsences(student.name, student.grade, SEM1_MONTHS, roll);
    const a2 = tallyAbsences(student.name, student.grade, SEM2_MONTHS, roll);
    const num = (n: number) => (n ? toKh(n) : '');
    v.a1p = num(a1.permission); v.a1a = num(a1.absent);
    v.a2p = num(a2.permission); v.a2a = num(a2.absent);
    v.atot = num(a1.total + a2.total);

    // Competences + the annual result.
    const extra = readAnnualExtra(student.grade, student.name);
    v.c_0 = fx(annualAcademicRaw(records));
    v.c_1 = extra.skills ? fx(extra.skills) : '';
    v.c_2 = extra.conduct ? fx(extra.conduct) : '';
    const annual = annualAcademicRaw(records);
    v.c_3 = annual === null ? '' : fx(annual * 0.8 + (extra.skills || 0) * 0.1 + (extra.conduct || 0) * 0.1);
    return v;
  }, [student, records, students]);

  const filledHtml = useMemo(() => fillTokens(handbookHtml, values), [values]);

  useEffect(() => { kvHydrate(PHOTO_KEY).then(() => setPhoto(kvReadSync<string>(PHOTO_KEY, ''))); }, []);

  // The sheets come from a static HTML string, so wire the photo frame after it
  // renders: clicking it opens the picker, and the chosen image fills the box.
  useEffect(() => {
    const box = rootRef.current?.querySelector('.photo') as HTMLElement | null;
    if (!box) return;
    box.style.cursor = 'pointer';
    box.title = photo ? 'ចុចដើម្បីប្ដូររូបថត' : 'ចុចដើម្បីដាក់រូបថត ៤×៦';
    const labels = box.querySelectorAll('span');
    if (photo) {
      box.style.backgroundImage = `url("${photo}")`;
      box.style.backgroundSize = 'cover';
      box.style.backgroundPosition = 'center';
      labels.forEach(s => { (s as HTMLElement).style.display = 'none'; });
    } else {
      box.style.backgroundImage = '';
      labels.forEach(s => { (s as HTMLElement).style.display = ''; });
    }
    const open = () => fileRef.current?.click();
    box.addEventListener('click', open);
    return () => box.removeEventListener('click', open);
  }, [photo]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const dataUrl = await downscale(f);
      setPhoto(dataUrl);
      await kvWrite(PHOTO_KEY, dataUrl);
    } catch { /* unreadable image — keep the previous one */ }
  };

  const removePhoto = async () => {
    setPhoto('');
    await kvWrite(PHOTO_KEY, '');
  };

  const downloadPdf = async () => {
    const el = document.getElementById('handbook-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToMultipagePdf(el, 'សៀវភៅសិក្ខាគារិក', SHEET_W); }
    catch { /* ignore — user can retry */ }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <style>{`
        /* Mirrors the .docx page setup exactly: A4 landscape, 1cm margins, two
           columns 1.27cm apart (w:pgSz 16840x11907 landscape, w:pgMar 567,
           w:cols num=2 space=720). Each sheet = one landscape page holding two
           book-pages side by side, all in the document's blue (#0000FF). */
        .handbook-body { color: #0000FF; font-size: 10.5pt; line-height: 1.55; }
        /* Fixed A4-landscape box — the whole point is 3 sheets, so the content is
           tuned to fit 210mm rather than being allowed to spill onto a 4th page. */
        .handbook-body .sheet {
          width: 297mm; height: 210mm; padding: 10mm; margin: 0 auto 14px;
          display: flex; gap: 12.7mm; background: #fff; box-sizing: border-box; overflow: hidden;
        }
        .handbook-body .panel { flex: 1 1 0; min-width: 0; border: 2.5px double #0000FF; padding: 4mm 5mm; box-sizing: border-box; overflow: hidden; }
        .handbook-body .panel.blank { border: none; }
        .handbook-body p { margin: 3px 0; overflow-wrap: anywhere; }
        .handbook-body .ctr { text-align: center; }
        .handbook-body .big { font-size: 13pt; font-weight: 700; }
        .handbook-body .title { font-size: 22pt; font-weight: 800; margin: 12mm 0 8mm; letter-spacing: .5px; }
        .handbook-body .title2 { font-size: 14pt; font-weight: 800; margin: 2mm 0; }
        .handbook-body .uline { text-decoration: underline; text-underline-offset: 4px; }
        .handbook-body .deco { letter-spacing: 2px; }
        .handbook-body .mt { margin-top: 8mm; } .handbook-body .mt2 { margin-top: 10mm; } .handbook-body .mt3 { margin-top: 5mm; }
        .handbook-body .fields { margin-top: 12mm; } .handbook-body .fields p { margin: 2.5mm 0; }
        .handbook-body .fields2 p { margin: 2.5mm 0; }
        .handbook-body .btm { margin-top: 8mm; }
        .handbook-body .ind { text-indent: 8mm; margin: 2mm 0; }
        .handbook-body .item { margin: 1.8mm 0; text-align: justify; }
        /* The instructions run long; give that panel a tighter scale so all seven
           points fit its half-sheet instead of being clipped. */
        .handbook-body .panel.instr { font-size: 9pt; line-height: 1.4; }
        .handbook-body .panel.instr .item { margin: 1.2mm 0; }
        .handbook-body .panel.instr .sub, .handbook-body .panel.instr .sub2 { margin-top: 1mm; margin-bottom: 1mm; }
        .handbook-body .panel.instr .title2 { font-size: 13pt; }
        .handbook-body .sub { margin: 1.5mm 0 1.5mm 6mm; }
        .handbook-body .sub2 { margin: 0 0 1.5mm 10mm; }
        .handbook-body .note { margin-top: 3mm; } .handbook-body .note2 { margin-left: 22mm; }
        /* "average" fraction — a numerator over a rule, as in the original */
        .handbook-body .frac { display: inline-block; text-align: center; vertical-align: middle; }
        .handbook-body .frac .num { display: block; border-bottom: 1.5px solid #0000FF; padding: 0 2mm; }
        .handbook-body .frac .den { display: block; }
        /* Identity panel: photo box on the LEFT, title beside it. */
        .handbook-body .idhead { display: flex; flex-direction: row-reverse; align-items: flex-start; gap: 4mm; }
        .handbook-body .idtitle { flex: 1; }
        .handbook-body .photo { width: 26mm; height: 34mm; border: 1.5px solid #0000FF; display: flex; flex-direction: column;
          align-items: center; justify-content: center; font-size: 10pt; shrink: 0; }
        .handbook-body .hdr { margin-bottom: 2mm; font-size: 9.5pt; }
        .handbook-body .sig { text-align: center; margin-top: 4mm; font-size: 9.5pt; }
        .handbook-body .sig .who { font-weight: 700; margin-top: 8mm; }
        .handbook-body .two { display: flex; gap: 4mm; } .handbook-body .two > * { flex: 1; text-align: center; }
        /* Tables — fixed layout so wide grids never push the sheet wider. */
        .handbook-body table.grid { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8pt; line-height: 1.25; }
        .handbook-body table.grid td { border: 1px solid #0000FF; padding: 0.6mm 1.2mm; vertical-align: middle; word-wrap: break-word; }
        .handbook-body table.grid td.sec { text-align: center; font-weight: 800; font-size: 10pt; }
        .handbook-body table.grid td.hd { text-align: center; font-weight: 700; }
        .handbook-body table.grid td.lbl { text-align: left; }
        .handbook-body table.grid td.v { text-align: center; }
        .handbook-body table.grid td.b { font-weight: 700; }
        /* Auto-filled values sit on the form's rule, like handwriting on the line. */
        .handbook-body .fill { font-weight: 700; border-bottom: 1px solid #0000FF; padding: 0 1.5mm; }
        .handbook-body table.grid td .fill { border-bottom: none; padding: 0; }
        .handbook-body table.grid td.dot, .handbook-body table.grid td.pad { vertical-align: top; height: auto; padding: 2mm; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .handbook-body .sheet { margin: 0; page-break-after: always; break-after: page; box-shadow: none; }
          .handbook-body .sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
            <BookOpen size={16} className="text-emerald-600" /> សៀវភៅសិក្ខាគារិក
          </h3>
          {/* Pick a student → the book fills from their records. */}
          <select
            value={grade}
            onChange={e => { setGrade(e.target.value); setStudentKey(''); }}
            className="px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none focus:border-emerald-500"
          >
            <option value="">— គ្រប់ថ្នាក់ —</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={studentKey}
            onChange={e => setStudentKey(e.target.value)}
            className="px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none focus:border-emerald-500 max-w-[190px]"
          >
            <option value="">— ទម្រង់ទទេ (មិនបំពេញ) —</option>
            {roster.map(r => <option key={r.key} value={r.key}>{r.name}{grade ? '' : ` · ${r.grade}`}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          {photo && (
            <button
              onClick={removePhoto}
              title="លុបរូបថត"
              className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5"
            >
              <Trash2 size={13} /> លុបរូបថត
            </button>
          )}
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 shadow-sm"
          >
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ទាញយក PDF
          </button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <X size={13} /> បិទ
            </button>
          )}
        </div>
      </div>

      {/* Document — fixed at the real A4-landscape width and scaled down to fit the
          screen without reflowing (print/PDF still use the full size). */}
      <div className="bg-slate-100 rounded-2xl border border-slate-200 p-3 overflow-hidden">
        <FitToWidth designWidth={SHEET_W} fitHeight={false}>
          <div ref={rootRef} id="handbook-print" className="handbook-body" style={{ width: SHEET_W }} dangerouslySetInnerHTML={{ __html: filledHtml }} />
        </FitToWidth>
      </div>
    </div>
  );
}
