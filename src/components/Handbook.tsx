/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// សៀវភៅសិក្ខាគារិក — the official MoEYS student record book, shown read-only for
// reference. The .docx is converted to HTML once at build time (handbook.html,
// imported raw) and rendered here; a button exports it as a multi-page A4 PDF.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Loader2, X, Trash2, Upload, CalendarDays, Plus } from 'lucide-react';
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
import { formatDobKh } from '../utils/khmerDate';
import { parseRosterRows, mergeRoster } from '../lib/rosterImport';
import FitToWidth from './FitToWidth';

const PHOTO_KEY = 'handbook_photo';
const YEAR_DATES_KEY = 'handbook_year_dates';
const SCHOOL = 'សាលាសហគមន៍ច្បារច្រុះ';
// Where the school sits — the cover asks for ឃុំ / ស្រុក / ខេត្ត.
const SCHOOL_COMMUNE = 'ក្រាំងចេក';
const SCHOOL_DISTRICT = 'សាមគ្គីមុនីជ័យ';
const SCHOOL_PROVINCE = 'កំពង់ស្ពឺ';
const YEAR_START = 2025;                 // the current school year runs 2025-2026
const YEAR = `${'២០២៥'}-${'២០២៦'}`;

export interface YearDates { open: string; close: string }

// Opening/closing dates of each school year, keyed by the year it starts. These are
// the school's own calendar (the 2020-21 and 2021-22 years opened late because of
// COVID), taken from the completed grade-6 book — they're the same for every student,
// so the history rows can be filled from here. Shipped as DEFAULTS: the panel lets the
// principal correct them and add each new year, and those edits win (see mergedYearDates).
const SCHOOL_YEAR_DATES: Record<number, YearDates> = {
  2020: { open: '១១ មករា ២០២១', close: '១៧ ធ្នូ ២០២១' },
  2021: { open: '១០ មករា ២០២២', close: '៣០ វិច្ឆិកា ២០២២' },
  2022: { open: '០២ មករា ២០២៣', close: '១៧ វិច្ឆិកា ២០២៣' },
  2023: { open: '០១ ធ្នូ ២០២៣', close: '៣០ កញ្ញា ២០២៤' },
  2024: { open: '០១ វិច្ឆិកា ២០២៤', close: '៣១ សីហា ២០២៥' },
  2025: { open: '០១ វិច្ឆិកា ២០២៥', close: '៣១ សីហា ២០២៦' },
};

// Saved edits override the shipped defaults, year by year.
export const mergedYearDates = (saved: Record<string, YearDates>): Record<number, YearDates> => {
  const out: Record<number, YearDates> = { ...SCHOOL_YEAR_DATES };
  for (const [y, d] of Object.entries(saved || {})) {
    const n = Number(y);
    if (Number.isFinite(n) && d && (d.open || d.close)) out[n] = { open: d.open || '', close: d.close || '' };
  }
  return out;
};

// Grade level out of a class name: "ថ្នាក់ទី ៣ក" → 3, "ថ្នាក់ទី៦" → 6.
// Returns 0 for មត្តេយ្យ and anything else without a ថ្នាក់ទី number.
const KH_D = '០១២៣៤៥៦៧៨៩';
export const gradeLevelOf = (className: string): number => {
  const m = (className || '').match(/ថ្នាក់ទី\s*([០-៩0-9]+)/);
  if (!m) return 0;
  const n = Number([...m[1]].map(c => (KH_D.indexOf(c) >= 0 ? String(KH_D.indexOf(c)) : c)).join(''));
  return Number.isFinite(n) ? n : 0;
};

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const fx = (v: number | null | undefined) => (v === null || v === undefined ? '' : toKh(v.toFixed(2)));

// Fill the layout's {{key|width}} slots. An empty value keeps the original dotted
// rule, so an unfilled book still prints exactly like the blank form.
const fillTokens = (html: string, values: Record<string, string>) =>
  html.replace(/\{\{([a-z0-9_]+)(?:\|(\d+))?\}\}/g, (_m, key: string, width?: string) => {
    const v = (values[key] ?? '').trim();
    // A slot with a width is a ruled line on the form: draw it as a leader that
    // stretches to the edge, sharing the room in proportion to that width when a
    // line carries several. Slots without one sit inside a table cell.
    if (width) return `<span class="lead" style="flex-grow:${Number(width)}">${v}</span>`;
    return v ? `<span class="fill">${v}</span>` : '';
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
  onSaveStudents?: (students: StudentScore[]) => void;
  onClose?: () => void;
}

export default function Handbook({ students = [], grades = [], onSaveStudents, onClose }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [photo, setPhoto] = useState('');
  const [grade, setGrade] = useState('');
  const [studentKey, setStudentKey] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // School-year opening/closing dates: shipped defaults + the principal's edits.
  const [savedDates, setSavedDates] = useState<Record<string, YearDates>>({});
  const [showDates, setShowDates] = useState(false);
  useEffect(() => { kvHydrate(YEAR_DATES_KEY).then(() => setSavedDates(kvReadSync<Record<string, YearDates>>(YEAR_DATES_KEY, {}))); }, []);
  const yearDates = useMemo(() => mergedYearDates(savedDates), [savedDates]);
  const editDate = async (year: number, field: keyof YearDates, val: string) => {
    const base = yearDates[year] || { open: '', close: '' };
    const next = { ...savedDates, [year]: { ...base, [field]: val } };
    setSavedDates(next);
    await kvWrite(YEAR_DATES_KEY, next);
  };

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
      sch_commune: SCHOOL_COMMUNE, sch_district: SCHOOL_DISTRICT, sch_province: SCHOOL_PROVINCE,
      name: student.name,
      class: student.grade,
      dob: formatDobKh(student.dob || ''),
      birthplace: student.birthPlace || '',
      // The form asks for "ឈ្មោះ និងមុខរបរ" — name and occupation together.
      father: [student.fatherName, student.fatherJob].filter(Boolean).join(' — '),
      mother: [student.motherName, student.motherJob].filter(Boolean).join(' — '),
      address: student.address || '',
      remark: student.remark || '',
    };
    // The identity table is the student's schooling history: one row per grade from
    // ១ up to the grade they're in now, with the school year stepping back to match
    // (a ថ្នាក់ទី៦ this year started ថ្នាក់ទី១ five years ago). Entry/exit dates aren't
    // held anywhere, so those columns stay blank to be written in.
    const lvl = gradeLevelOf(student.grade);
    if (lvl >= 1) {
      for (let g = 1; g <= Math.min(lvl, 6); g++) {
        const i = g - 1;
        const y = YEAR_START - (lvl - g);
        v[`y_${i}`] = `${toKh(y)}-${toKh(y + 1)}`;
        v[`g_${i}`] = toKh(g);
        v[`sch_${i}`] = SCHOOL;
        // Same calendar for everyone; the ID follows the student through every year.
        const cal = yearDates[y];
        if (cal) { v[`in_${i}`] = cal.open; v[`out_${i}`] = cal.close; }
        v[`sid_${i}`] = student.studentId || '';
      }
    } else {
      // មត្តេយ្យ / unnumbered class — just this year.
      const cal = yearDates[YEAR_START];
      v.y_0 = YEAR; v.g_0 = student.grade; v.sch_0 = SCHOOL; v.sid_0 = student.studentId || '';
      if (cal) { v.in_0 = cal.open; v.out_0 = cal.close; }
    }

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
  }, [student, records, students, yearDates]);

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

  // ---- Import the official roster workbook to fill in what the app lacks ----
  const rosterRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const onRosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !onSaveStudents) return;
    setImportMsg({ text: 'កំពុងអាន…', ok: true });
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const sheets = wb.SheetNames.map(n => ({
        name: n,
        rows: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, blankrows: false, raw: false }),
      }));
      const rows = parseRosterRows(sheets);
      if (!rows.length) { setImportMsg({ text: 'រកជួរសិស្សមិនឃើញក្នុងឯកសារនេះ។', ok: false }); return; }
      // Work on a copy so React sees a new array and the save is explicit.
      const copy = students.map(s => ({ ...s }));
      const res = mergeRoster(copy, rows);
      // Nothing matched is a FAILURE, not "already complete" — say so plainly.
      if (res.matchedStudents === 0) {
        setImportMsg({ text: `រកឃើញ ${toKh(rows.length)} ជួរ តែរកសិស្សត្រូវគ្នាក្នុង App មិនឃើញសោះ — សូមពិនិត្យថាបញ្ជីឈ្មោះត្រូវនឹងឆ្នាំសិក្សានេះ។`, ok: false });
        return;
      }
      if (res.fieldsFilled === 0) {
        setImportMsg({ text: `រកឃើញ ${toKh(rows.length)} ជួរ · ផ្គូផ្គង ${toKh(res.matchedStudents)} — ព័ត៌មានពេញរួចហើយ គ្មានអ្វីត្រូវបំពេញ។`, ok: true });
        return;
      }
      onSaveStudents(copy);
      const miss = res.unmatched.length ? ` · រកមិនឃើញក្នុង App ${toKh(res.unmatched.length)}` : '';
      setImportMsg({
        text: `នាំចូល ${toKh(rows.length)} ជួរ · ផ្គូផ្គង ${toKh(res.matchedStudents)} · បំពេញ ${toKh(res.fieldsFilled)} ព័ត៌មាន${miss} ✓`,
        ok: true,
      });
    } catch (err: any) {
      setImportMsg({ text: `អានឯកសារមិនបាន៖ ${err?.message || ''}`, ok: false });
    }
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
        /* Column layout so the panel's content can be spread over its full height
           instead of bunching at the top and leaving the box half empty. */
        .handbook-body .panel { flex: 1 1 0; min-width: 0; border: 2.5px double #0000FF; padding: 4mm 5mm; box-sizing: border-box; overflow: hidden;
          display: flex; flex-direction: column; }
        /* A panel's main grid takes the height left over, so its rows breathe and
           the table reaches the bottom rule as it does on the printed form. */
        .handbook-body .panel > table.grid:last-child { flex: 1 1 auto; height: 100%; }
        .handbook-body .panel.blank { border: none; }
        .handbook-body p { margin: 3px 0; overflow-wrap: anywhere; }
        .handbook-body .ctr { text-align: center; }
        .handbook-body .big { font-size: 13pt; font-weight: 700; }
        .handbook-body .title { font-size: 22pt; font-weight: 800; margin: 12mm 0 8mm; letter-spacing: .5px; }
        .handbook-body .title2 { font-size: 14pt; font-weight: 800; margin: 2mm 0; }
        .handbook-body .uline { text-decoration: underline; text-underline-offset: 4px; }
        .handbook-body .deco { letter-spacing: 2px; }
        .handbook-body .mt { margin-top: 8mm; } .handbook-body .mt2 { margin-top: 10mm; } .handbook-body .mt3 { margin-top: 5mm; }
        .handbook-body .fields p { margin: 2.5mm 0; }
        .handbook-body .fields2 p { margin: 2.5mm 0; }
        /* Cover: title block at the top, the fields in the lower half and the
           closing mark on the bottom rule — the spacing of the printed cover. */
        .handbook-body .panel.cover .fields { margin-top: auto; }
        .handbook-body .panel.cover .btm { margin-top: auto; margin-bottom: 2mm; }
        .handbook-body .btm { margin-top: 8mm; }
        /* Ruled lines are leaders: the label sits at the left and the rule runs on
           to the panel edge, so a short answer never leaves a stub of a line. */
        .handbook-body .fields p, .handbook-body .fields2 p,
        .handbook-body .hdr, .handbook-body td.pad p { display: flex; align-items: baseline; gap: 2mm; white-space: nowrap; }
        /* Basis auto: a rule is never narrower than the answer written on it, and
           only the leftover room is shared out by the slot's width. */
        .handbook-body .lead { flex: 1 1 auto; min-width: 0; border-bottom: 1px dotted #0000FF;
          font-weight: 700; text-align: center; padding: 0 1.5mm; white-space: normal; }
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
        /* The form's tables are marked class="grid", which collides with Tailwind's
           .grid utility (display: grid) and stops the cells from filling the row —
           the table ends up a narrow column inside its box. Pin the table display
           back so the widths and the stretched height apply. */
        .handbook-body table.grid { display: table; }
        .handbook-body table.grid tr { display: table-row; }
        .handbook-body table.grid td { display: table-cell; }
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
          {onSaveStudents && (
            <>
              <input ref={rosterRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onRosterFile} />
              <button
                onClick={() => rosterRef.current?.click()}
                title="នាំចូលបញ្ជីឈ្មោះសិស្ស (.xlsx) — បំពេញ ទីកន្លែងកំណើត និងមុខរបរឪពុក/ម្ដាយ"
                className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5"
              >
                <Upload size={13} /> នាំចូលបញ្ជីឈ្មោះ
              </button>
            </>
          )}
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
            onClick={() => setShowDates(v => !v)}
            title="កែថ្ងៃចូលរៀន / ចេញ របស់ឆ្នាំសិក្សានីមួយៗ"
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <CalendarDays size={13} /> ថ្ងៃចូល/ចេញ
          </button>
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

      {/* School-year calendar — shipped defaults, editable, saved locally. */}
      {showDates && (
        <div className="rc-no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
            <CalendarDays size={13} className="text-slate-400" /> ថ្ងៃចូលរៀន និងថ្ងៃចេញ តាមឆ្នាំសិក្សា
            <span className="font-semibold text-slate-400">— កែបាន និងបន្ថែមឆ្នាំថ្មី</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-1 pr-2 font-bold">ឆ្នាំសិក្សា</th>
                  <th className="py-1 pr-2 font-bold">ថ្ងៃ ខែ ឆ្នាំចូលរៀន</th>
                  <th className="py-1 font-bold">ថ្ងៃ ខែ ឆ្នាំចេញ</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(yearDates).map(Number).sort((a, b) => a - b).map(y => (
                  <tr key={y} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-semibold text-slate-600 whitespace-nowrap">{toKh(y)}-{toKh(y + 1)}</td>
                    <td className="py-1 pr-2">
                      <input
                        value={yearDates[y]?.open || ''}
                        onChange={e => editDate(y, 'open', e.target.value)}
                        placeholder="ឧ. ០១ វិច្ឆិកា ២០២៥"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={yearDates[y]?.close || ''}
                        onChange={e => editDate(y, 'close', e.target.value)}
                        placeholder="ឧ. ៣១ សីហា ២០២៦"
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => {
              const next = Math.max(...Object.keys(yearDates).map(Number)) + 1;
              editDate(next, 'open', '');
            }}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
          >
            <Plus size={12} /> បន្ថែមឆ្នាំសិក្សាថ្មី
          </button>
        </div>
      )}

      {importMsg && (
        <p className={`rc-no-print text-[11px] font-bold px-3 py-2 rounded-xl border ${importMsg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {importMsg.text}
        </p>
      )}

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
