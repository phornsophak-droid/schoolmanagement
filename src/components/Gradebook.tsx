/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  UserPlus,
  FolderLock,
  Search,
  GraduationCap,
  HelpCircle,
  Download,
  Upload,
  FileText,
  Table2,
  RotateCcw,
  Hash
} from 'lucide-react';
import { StudentScore, KhmerScore, MathScore, SchoolUser, ENGLISH_SUBJECTS, SCIENCE_SUBJECTS, SOCIAL_SUBJECTS, isEnglishClass, getCustomSubjects } from '../types';
import { calculateStudentFields, clampScore, rankStudents, generateUniqueId } from '../mockData';
import StudentReportCard from './StudentReportCard';
import SemesterReportCard from './SemesterReportCard';
import HonorRoll, { HonorEntry } from './HonorRoll';
import * as XLSX from 'xlsx';

// Inline score cell — local text state, commits on blur/Enter so parent
// re-renders never steal focus while typing.
function ScoreInput({ value, onCommit }: { value: number | null | undefined; onCommit: (v: number | null) => void }) {
  const initial = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value === null || value === undefined ? '' : String(value)); }, [value, focused]);
  const commit = () => {
    const t = text.trim();
    if (t === '') { onCommit(null); return; }
    const n = parseFloat(t);
    onCommit(isNaN(n) ? null : n);
  };
  return (
    <input
      value={text}
      inputMode="decimal"
      onFocus={() => setFocused(true)}
      onChange={e => setText(e.target.value)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-11 text-center bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-blue-50 rounded px-0.5 py-1 outline-none font-mono text-slate-700"
    />
  );
}

// Ready-made teacher-remark phrases, grouped — teachers pick (and may combine) them
// from the inline dropdown, or type freely.
const REMARK_PRESETS: { label: string; items: string[] }[] = [
  { label: '១. មតិយោបល់វិជ្ជមាន', items: [
    'ធ្វើបានល្អ ត្រូវខិតខំប្រឹងប្រែងបន្តទៀត។',
    'មានការរីកចម្រើនល្អក្នុងការសិក្សា។',
    'ចូលរៀនទៀងទាត់ និងគោរពវិន័យបានល្អ។',
    'ចូលរួមសកម្មភាពក្នុងថ្នាក់បានល្អ។',
    'មានទំនាក់ទំនងល្អជាមួយមិត្តភក្តិ និងគ្រូ។',
    'បំពេញកិច្ចការផ្ទះបានទៀងទាត់។',
  ] },
  { label: '២. មតិយោបល់សម្រាប់ការកែលម្អ', items: [
    'ត្រូវពង្រឹងជំនាញគណិតវិទ្យាបន្ថែម។',
    'ត្រូវពង្រឹងការអានឱ្យបានញឹកញាប់ជាងមុន។',
    'ត្រូវហាត់សរសេរឱ្យបានស្អាត និងត្រឹមត្រូវជាងមុន។',
    'ត្រូវបង្កើនការយកចិត្តទុកដាក់ក្នុងម៉ោងសិក្សា។',
    'ត្រូវចូលរួមឆ្លើយសំណួរ និងបញ្ចេញមតិឱ្យបានច្រើនជាងមុន។',
    'ត្រូវបំពេញកិច្ចការផ្ទះឱ្យបានទៀងទាត់។',
    'ត្រូវពង្រឹងការប្រកបពាក្យ និងការសរសេរអត្ថបទ។',
    'ត្រូវពង្រឹងការអានយល់ និងការសង្ខេបខ្លឹមសារ។',
    'ត្រូវបង្កើនទំនុកចិត្តក្នុងការរៀន និងការបង្ហាញសមត្ថភាពរបស់ខ្លួន។',
    'ត្រូវខិតខំប្រឹងប្រែងបន្ថែមដើម្បីទទួលបានលទ្ធផលកាន់តែល្អ។',
  ] },
  { label: '៣. មតិយោបល់សម្រាប់សិស្សពូកែ', items: [
    'បន្តរក្សាលទ្ធផលល្អ និងជួយមិត្តភក្តិក្នុងការសិក្សា។',
    'មានសមត្ថភាពល្អ ត្រូវបន្តអភិវឌ្ឍខ្លួនឱ្យកាន់តែប្រសើរ។',
    'បង្ហាញភាពជាអ្នកដឹកនាំ និងការទទួលខុសត្រូវបានល្អ។',
    'គួរបន្តអានសៀវភៅ និងស្រាវជ្រាវបន្ថែមដើម្បីពង្រីកចំណេះដឹង។',
  ] },
  { label: '៤. មតិយោបល់សម្រាប់សិស្សត្រូវការការគាំទ្របន្ថែម', items: [
    'ត្រូវការការគាំទ្រ និងការតាមដានបន្ថែមពីមាតាបិតា។',
    'ត្រូវចំណាយពេលអាន និងធ្វើលំហាត់នៅផ្ទះឱ្យបានច្រើនជាងមុន។',
    'ត្រូវបង្កើនការយកចិត្តទុកដាក់ និងការផ្តោតអារម្មណ៍ក្នុងថ្នាក់រៀន។',
    'ត្រូវខិតខំប្រឹងប្រែងបន្ថែម ដើម្បីសម្រេចបានលទ្ធផលល្អប្រសើរ។',
  ] },
];

// Inline teacher-remark cell — free text + a preset picker; commits on blur/Enter/pick.
function RemarkInput({ value, onCommit }: { value: string | undefined; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value || '');
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value || ''); }, [value, focused]);
  const addPreset = (p: string) => {
    const cur = text.trim();
    if (cur.includes(p)) return; // already added — skip duplicates
    const next = cur ? `${cur} ${p}` : p;
    setText(next);
    onCommit(next);
  };
  return (
    <div className="flex flex-col gap-1 w-36">
      <input
        value={text}
        placeholder="មូលវិចារ..."
        onFocus={() => setFocused(true)}
        onChange={e => setText(e.target.value)}
        onBlur={() => { setFocused(false); onCommit(text); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full text-left bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-blue-50 rounded px-1 py-1 outline-none text-[11px] text-slate-700"
      />
      <select
        value=""
        onChange={e => { if (e.target.value) addPreset(e.target.value); e.target.value = ''; }}
        className="w-full text-[10px] text-blue-600 bg-blue-50/60 border border-blue-100 rounded px-1 py-0.5 outline-none cursor-pointer"
        title="ជ្រើសមូលវិចារសម្រេច"
      >
        <option value="">➕ ជ្រើសមូលវិចារ...</option>
        {REMARK_PRESETS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map(it => <option key={it} value={it}>{it}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

interface GradebookProps {
  students: StudentScore[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedGrade: string;
  setSelectedGrade: (grade: string) => void;
  onSaveStudents: (updatedList: StudentScore[]) => void;
  currentUser?: SchoolUser | null;
  grades?: string[];
  onAddGrade?: (newGrade: string) => void;
  onDeleteGrade?: (gradeToDelete: string) => void;
}

const MONTHS_LIST = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

const SEMESTER_1_MONTHS = ['ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា'];
const SEMESTER_2_MONTHS = ['ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

const DEFAULT_GRADES_LIST = [
  'មត្តេយ្យ ១',
  'មត្តេយ្យ ២',
  'ថ្នាក់ទី ១ក',
  'ថ្នាក់ទី ១ខ',
  'ថ្នាក់ទី ២ក',
  'ថ្នាក់ទី ២ខ',
  'ថ្នាក់ទី ៣ក',
  'ថ្នាក់ទី ៣ខ',
  'ថ្នាក់ទី ៤ក',
  'ថ្នាក់ទី ៤ខ',
  'ថ្នាក់ទី ៥ក',
  'ថ្នាក់ទី ៥ខ',
  'ថ្នាក់ទី ៦',
  'ថ្នាក់ភាសាអង់គ្លេស',
  'ថ្នាក់គំនូរ',
  'ថ្នាក់កីឡា និងអប់រំកាយ',
  'ថ្នាក់អប់រំសុខភាព'
];

// Class-category split: "extra" (after-hours skill classes) vs "general" (មត្តេយ្យ–ទី៦).
const EXTRA_CLASS_KEYWORDS = ['ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
// The subject keyword inside an after-hours class name, used to group its sections (3A, 3B...).
const getSubjectKey = (grade: string) => EXTRA_CLASS_KEYWORDS.find(k => (grade || '').includes(k)) || '';

export default function Gradebook({
  students,
  selectedMonth,
  setSelectedMonth,
  selectedGrade: selectedGradeProp,
  setSelectedGrade,
  onSaveStudents,
  currentUser,
  grades,
  onAddGrade,
  onDeleteGrade
}: GradebookProps) {
  // Teachers are hard-locked to their own class for all viewing/filtering. Compute the
  // effective grade locally so it holds even when the parent's setSelectedGrade is a
  // no-op (e.g. the mobile portal passes () => {}). Principals/admins use the selection.
  const selectedGrade = (currentUser?.role === 'teacher' && currentUser.grade && currentUser.grade !== 'ទាំងអស់')
    ? currentUser.grade
    : selectedGradeProp;

  // Class category (general = មត្តេយ្យ–ទី៦; extra = after-hours skill classes)
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>('general');
  const inCat = (grade: string) => (classCategory === 'extra' ? isExtraClass(grade) : !isExtraClass(grade));
  const gradesList = (grades || DEFAULT_GRADES_LIST).filter(g => inCat(g));
  // An after-hours teacher (e.g. English) teaches several groups (3A, 3B...) within their subject.
  const isExtraTeacher = currentUser?.role === 'teacher' && isExtraClass(currentUser.grade);
  const teacherSubjectGrades = isExtraTeacher
    ? (grades || DEFAULT_GRADES_LIST).filter(g => g.includes(getSubjectKey(currentUser!.grade)))
    : [];
  // Custom-criteria classes (English, Health…) show their own columns instead of
  // the general subjects. `customSubjects` is null for general classes.
  const customSubjects = getCustomSubjects(selectedGrade);
  const viewingEnglish = !!customSubjects;

  // The per-student monthly report card (general classes only).
  const [reportCardStudent, setReportCardStudent] = useState<StudentScore | null>(null);
  // The per-student semester / annual report card.
  const [semReportStudent, setSemReportStudent] = useState<StudentScore | null>(null);
  const [semReportPeriod, setSemReportPeriod] = useState<1 | 2 | 'year'>(1);

  // Per-student annual skills (បំណិន) & conduct (ចរិយា) entry, stored in localStorage
  // and read by the annual report card.
  const annualExtraKey = (grade: string, name: string) => `annualextra::${grade}::${name.trim()}`;
  const readAnnualExtra = (grade: string, name: string) => {
    try { const e = JSON.parse(localStorage.getItem(annualExtraKey(grade, name)) || '{}'); return { skills: Number(e.skills) || 0, conduct: Number(e.conduct) || 0 }; } catch { return { skills: 0, conduct: 0 }; }
  };
  const [honorOpen, setHonorOpen] = useState(false);
  // Top-5 honor roll for the current mode (month / semester / year).
  const honorData = (): { subtitle: string; entries: HonorEntry[] } => {
    let roster: any[] = [];
    let subtitle = '';
    let scoreOf = (s: any): number | null => s.overallAvg ?? null;
    if (activeMode === 'semester') { roster = filteredSemesterStudents; subtitle = `ប្រចាំ ឆមាសទី ${selectedSemester}`; scoreOf = (s) => s.semesterAvg ?? null; }
    else if (activeMode === 'annual') { roster = filteredAnnualStudents; subtitle = 'ប្រចាំឆ្នាំ'; scoreOf = (s) => s.annualAvg ?? null; }
    else { roster = filteredStudents; subtitle = `ប្រចាំខែ ${selectedMonth === 'ទាំងអស់' ? '' : selectedMonth}`; }
    const entries = [...roster]
      .sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999))
      .slice(0, 5)
      .map((s, i) => ({ rank: s.ranking ?? (i + 1), name: s.name, score: scoreOf(s) }));
    return { subtitle, entries };
  };

  const [extraForm, setExtraForm] = useState<{ open: boolean; name: string; grade: string; skills: string; conduct: string }>({ open: false, name: '', grade: '', skills: '', conduct: '' });
  const openExtraForm = (name: string, grade: string) => {
    const e = readAnnualExtra(grade, name);
    setExtraForm({ open: true, name, grade, skills: e.skills ? String(e.skills) : '', conduct: e.conduct ? String(e.conduct) : '' });
  };
  const saveExtraForm = () => {
    try { localStorage.setItem(annualExtraKey(extraForm.grade, extraForm.name), JSON.stringify({ skills: Number(extraForm.skills) || 0, conduct: Number(extraForm.conduct) || 0 })); } catch { /* ignore */ }
    setExtraForm(f => ({ ...f, open: false }));
  };

  // ---- Score import / template (Excel/CSV) ----
  const scoreFileRef = useRef<HTMLInputElement>(null);
  // Subject column headers (after Name & Gender) for the import template / parser.
  const GENERAL_SCORE_HEADERS = [
    'ស្តាប់', 'និយាយ', 'អាន', 'សរសេរ',
    'ចំនួន', 'រង្វាស់រង្វាល់', 'ធរណីមាត្រ', 'ពិជគណិត', 'ស្ថិតិ',
    ...SCIENCE_SUBJECTS.map(s => s.km),
    ...SOCIAL_SUBJECTS.map(s => s.km),
    'កាយ-កីឡា', 'សុខភាព', 'បំណិនជីវិត', 'ភាសាបរទេស',
  ];
  const scoreHeaders = customSubjects ? customSubjects.map(s => s.km) : GENERAL_SCORE_HEADERS;

  // Build a StudentScore record from a row's numeric values (order matches scoreHeaders).
  const buildScoreRecord = (name: string, gender: 'ប្រុស' | 'ស្រី', vals: (number | null)[], month: string, existingId?: string, studentId?: string, remark?: string): StudentScore => {
    const base = {
      id: existingId || generateUniqueId(),
      name, gender, grade: selectedGrade, month, studentId: studentId || undefined,
      remark: remark || undefined,
      khmer: { listening: null, writing: null, reading: null, speaking: null },
      math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
      science: null, socialStudies: null, physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null,
    };
    if (customSubjects) {
      const englishScores: Record<string, number | null> = {};
      customSubjects.forEach((s, i) => { englishScores[s.key] = vals[i] ?? null; });
      return calculateStudentFields({ ...base, englishScores });
    }
    const scienceScores: Record<string, number | null> = {};
    SCIENCE_SUBJECTS.forEach((s, i) => { scienceScores[s.key] = vals[9 + i] ?? null; });
    const socialScores: Record<string, number | null> = {};
    SOCIAL_SUBJECTS.forEach((s, i) => { socialScores[s.key] = vals[13 + i] ?? null; });
    return calculateStudentFields({
      ...base,
      khmer: { listening: vals[0], speaking: vals[1], reading: vals[2], writing: vals[3] },
      math: { numbers: vals[4], measurement: vals[5], geometry: vals[6], algebra: vals[7], statistics: vals[8] },
      scienceScores, socialScores,
      physicalEducation: vals[17], health: vals[18], lifeSkills: vals[19], foreignLanguage: vals[20],
    });
  };

  // Download a pre-filled Excel template (registered students + blank score columns) for the selected class.
  const handleDownloadScoreTemplate = () => {
    if (selectedGrade === 'ទាំងអស់') { alert('សូមជ្រើសរើសថ្នាក់ជាក់លាក់មុនទាញយកគំរូ!'); return; }
    const header = ['អត្តលេខ', 'ឈ្មោះ', 'ភេទ', ...scoreHeaders, 'មូលវិចារគ្រូ'];
    // Keep the class's natural roster order (no alphabetical sort) so the template
    // matches the order the user expects and can be filled/imported row-for-row.
    const names = Array.from(new Set(students.filter(s => s.grade === selectedGrade).map(s => s.name.trim())));
    const body = names.map(n => {
      const rec = students.find(s => s.grade === selectedGrade && s.name.trim() === n);
      return [rec?.studentId || '', n, rec?.gender || '', ...scoreHeaders.map(() => ''), rec?.remark || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ពិន្ទុ');
    XLSX.writeFile(wb, `គំរូពិន្ទុ_${selectedGrade}.xlsx`);
  };

  // Import scores from an uploaded Excel/CSV file into the selected class + month.
  const handleImportScores = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedGrade === 'ទាំងអស់') { alert('សូមជ្រើសរើសថ្នាក់ជាក់លាក់មុននាំចូល!'); e.target.value = ''; return; }
    const targetMonth = selectedMonth !== 'ទាំងអស់' ? selectedMonth : 'មេសា';
    const num = (v: any): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      const n = parseFloat(String(v).trim());
      return isNaN(n) ? null : clampScore(n);
    };
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
        // Locate columns by header text so order/extra columns can't shift scores onto
        // the wrong subject. Falls back to the legacy "name, gender, scores" layout.
        const headerRow = (rows[0] || []).map((h: any) => String(h ?? '').replace(/[﻿​]/g, '').trim());
        let idCol = headerRow.findIndex(h => h.includes('អត្តលេខ'));
        let nameCol = headerRow.findIndex(h => h.includes('ឈ្មោះ') || h.includes('នាម'));
        let genderCol = headerRow.findIndex(h => h.includes('ភេទ'));
        const remarkCol = headerRow.findIndex(h => h.includes('មូលវិចារ'));
        if (nameCol < 0) nameCol = idCol >= 0 ? idCol + 1 : 0;
        if (genderCol < 0) genderCol = nameCol + 1;
        const scoreStart = Math.max(idCol, nameCol, genderCol) + 1;
        let updated = [...students];
        let count = 0;
        for (let i = 1; i < rows.length; i++) { // row 0 = header
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;
          const studentId = idCol >= 0 ? String(row[idCol] ?? '').replace(/[﻿​]/g, '').trim() : '';
          const name = String(row[nameCol] ?? '').replace(/[﻿​]/g, '').replace(/\s+/g, ' ').trim();
          if (!name || name === 'ឈ្មោះ' || name === 'ឈ្មោះសិស្ស') continue;
          const rawGender = String(row[genderCol] ?? '').trim().toLowerCase();
          const gender: 'ប្រុស' | 'ស្រី' = (rawGender.includes('ស្រី') || rawGender === 'f' || rawGender === 'female') ? 'ស្រី' : 'ប្រុស';
          const vals = scoreHeaders.map((_, idx) => num(row[scoreStart + idx]));
          const remark = remarkCol >= 0 ? String(row[remarkCol] ?? '').replace(/[﻿​]/g, '').trim() : '';
          // Match by EXACT name first — the template carries the app's own names, so this
          // maps each row to the right student regardless of row order. អត្តលេខ is used only
          // to disambiguate when several students share the same name, then as a last resort.
          const sameScope = (s: StudentScore) => s.grade === selectedGrade && s.month === targetMonth;
          const byName = updated.filter(s => sameScope(s) && s.name.trim() === name);
          let existing: StudentScore | undefined;
          if (byName.length === 1) existing = byName[0];
          else if (byName.length > 1) existing = (studentId ? byName.find(s => (s.studentId || '').trim() === studentId) : undefined) || byName[0];
          else if (studentId) existing = updated.find(s => sameScope(s) && (s.studentId || '').trim() === studentId);
          const rec = buildScoreRecord(name, gender, vals, targetMonth, existing?.id, studentId || existing?.studentId, remark || existing?.remark);
          updated = existing ? updated.map(s => s.id === existing.id ? rec : s) : [...updated, rec];
          count++;
        }
        if (count > 0) {
          onSaveStudents(updated);
          alert(`បាននាំចូលពិន្ទុ ${count} សិស្ស សម្រាប់ «${selectedGrade}» ខែ «${targetMonth}» ✓`);
        } else {
          alert('រកមិនឃើញទិន្នន័យត្រឹមត្រូវក្នុងឯកសារ! សូមប្រើគំរូដែលបានទាញយក។');
        }
      } catch (err) {
        console.error('Score import failed', err);
        alert('មានបញ្ហាក្នុងការអានឯកសារ! សូមប្រាកដថាប្រើគំរូ Excel/CSV ដែលបានទាញយក។');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // Wipe every score record for the selected class + month — used to recover from a
  // bad import (wrong columns) so it can be re-imported cleanly.
  const handleResetMonthScores = () => {
    if (selectedGrade === 'ទាំងអស់' || selectedMonth === 'ទាំងអស់') {
      alert('សូមជ្រើសរើស ថ្នាក់ និង ខែ ជាក់លាក់ជាមុនសិន ដើម្បីកំណត់ឡើងវិញ!');
      return;
    }
    const toRemove = students.filter(s => s.grade === selectedGrade && s.month === selectedMonth);
    if (toRemove.length === 0) {
      alert(`គ្មានពិន្ទុសម្រាប់ «${selectedGrade}» ខែ «${selectedMonth}» ទេ។`);
      return;
    }
    if (!window.confirm(`លុបពិន្ទុ ${toRemove.length} នាក់ សម្រាប់ «${selectedGrade}» ខែ «${selectedMonth}»?\n\nប្រើពេលនាំចូលខុស — បន្ទាប់មកនាំចូលឡើងវិញ។ សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។`)) return;
    const remaining = students.filter(s => !(s.grade === selectedGrade && s.month === selectedMonth));
    onSaveStudents(remaining);
    alert(`បានកំណត់ឡើងវិញ ✓ លុបពិន្ទុ ${toRemove.length} នាក់ហើយ។ ឥឡូវអ្នកអាចនាំចូលឡើងវិញ។`);
  };

  // អត្តលេខ belongs to a student's general (homeroom) class. Copy it onto every
  // record that lacks one — including their after-hours classes, whose names carry a
  // class suffix like "(E)/(A)/(H)/(PE)". Matching strips that suffix + all spaces.
  const idKey = (name: string, gender: string) =>
    `${String(name || '').replace(/[﻿​]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '').trim()}|${gender}`;
  const handleBackfillIds = () => {
    // Source of truth: IDs from general-class records only.
    const known = new Map<string, string>();
    students.forEach(s => {
      const id = (s.studentId || '').trim();
      if (id && !isExtraClass(s.grade)) { const k = idKey(s.name, s.gender); if (!known.has(k)) known.set(k, id); }
    });
    let filled = 0;
    const updated = students.map(s => {
      if ((s.studentId || '').trim()) return s;
      const id = known.get(idKey(s.name, s.gender));
      if (id) { filled++; return { ...s, studentId: id }; }
      return s;
    });
    const stillMissing = new Set(updated.filter(s => !(s.studentId || '').trim()).map(s => `${s.name.trim()}|${s.grade}`)).size;
    if (filled === 0) {
      alert(`គ្មានអត្តលេខអាចចម្លងបានទេ។\nសិស្ស ${stillMissing} នាក់ មិនមានឈ្មោះត្រូវគ្នាក្នុងថ្នាក់ទូទៅ — សូមបញ្ចូលដោយដៃតាមប៊ូតុង «កែ»។`);
      return;
    }
    onSaveStudents(updated);
    alert(`បានចម្លងអត្តលេខ ${filled} កំណត់ត្រា ✓ ពីថ្នាក់ទូទៅ (រួមថ្នាក់ក្រៅម៉ោងរបស់សិស្សដូចគ្នា)។\nនៅសល់ ${stillMissing} នាក់ ឈ្មោះមិនត្រូវគ្នាក្នុងថ្នាក់ទូទៅ — សូមបញ្ចូលដោយដៃ។`);
  };

  const [newClassName, setNewClassName] = useState('');
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  // Lock grade selection (and category) to teacher's own class
  useEffect(() => {
    if (currentUser && currentUser.role === 'teacher') {
      setSelectedGrade(currentUser.grade);
      setClassCategory(isExtraClass(currentUser.grade) ? 'extra' : 'general');
    }
  }, [currentUser, setSelectedGrade]);

  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeGroup, setSelectedGradeGroup] = useState('ទាំងអស់'); // group filter (after-hours)

  // Monthly vs Semester Mode declarations
  const [activeMode, setActiveMode] = useState<'monthly' | 'semester' | 'annual'>('monthly');
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');

  // Semester Exam Score Input states
  const [isExamFormOpen, setIsExamFormOpen] = useState(false);
  const [examStudentName, setExamStudentName] = useState('');
  const [examStudentGrade, setExamStudentGrade] = useState('');
  const [examStudentGender, setExamStudentGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [examScoreInput, setExamScoreInput] = useState('0');


  // Form states
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [formGrade, setFormGrade] = useState('ថ្នាក់ទី៦');
  const [formMonth, setFormMonth] = useState('មេសា');

  // Sub-subjects Khmer
  const [khmerListening, setKhmerListening] = useState('');
  const [khmerWriting, setKhmerWriting] = useState('');
  const [khmerReading, setKhmerReading] = useState('');
  const [khmerSpeaking, setKhmerSpeaking] = useState('');

  // Sub-subjects Math
  const [mathNumbers, setMathNumbers] = useState('');
  const [mathMeasurement, setMathMeasurement] = useState('');
  const [mathGeometry, setMathGeometry] = useState('');
  const [mathAlgebra, setMathAlgebra] = useState('');
  const [mathStatistics, setMathStatistics] = useState('');

  // Other fields
  const [physicalEducation, setPhysicalEducation] = useState('');
  const [health, setHealth] = useState('');
  const [lifeSkills, setLifeSkills] = useState('');
  const [foreignLanguage, setForeignLanguage] = useState('');

  // Official extras: student ID + free-text note.
  const [formStudentId, setFormStudentId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formRemark, setFormRemark] = useState('');

  // Sub-subject score maps (string while editing), keyed by SUBJECT[].key.
  const [scienceScores, setScienceScores] = useState<Record<string, string>>({});
  const [socialScores, setSocialScores] = useState<Record<string, string>>({});

  // Custom-criteria class scores (keyed by the class's subject keys), strings while editing.
  const [englishScores, setEnglishScores] = useState<Record<string, string>>({});
  const formCustomSubjects = getCustomSubjects(formGrade);
  const formIsEnglish = !!formCustomSubjects;

  // Filter registered students in the active grade to select from when creating scores
  const registeredStudentsInFormGrade = useMemo(() => {
    const uniqueNames = new Set<string>();

    // Show every registered student in this grade so the entry list always equals the
    // full class roster. Students who already have a record for the selected month stay
    // selectable and are edited in place (see handleFormSubmit upsert) — this fixes the
    // empty dropdown for the registration month (e.g. មេសា).
    students.forEach(s => {
      if (s.grade === formGrade) {
        uniqueNames.add(s.name.trim());
      }
    });

    // Return the sorted list alphabetically
    return Array.from(uniqueNames).sort((a, b) => a.localeCompare(b, 'km'));
  }, [students, formGrade]);

  // Filter students based on top filter selections
  const filteredStudents = useMemo(() => {
    // If selectedMonth is 'ទាំងអស់' or selectedGrade is 'ទាំងអស់', fall back to standard filtering
    if (selectedGrade === 'ទាំងអស់') {
      let list = students.filter(student => {
        if (student.month === 'ប្រឡងឆមាសទី១' || student.month === 'ប្រឡងឆមាសទី២') {
          return false;
        }
        if (!inCat(student.grade)) return false;
        const matchMonth = selectedMonth === 'ទាំងអស់' ? true : student.month === selectedMonth;
        return matchMonth;
      });

      if (searchTerm.trim() !== '') {
        list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      return rankStudents(list);
    }

    // 1. Filter students matching the active grade and active month
    const monthlyRecords = students.filter(student => {
      if (student.month === 'ប្រឡងឆមាសទី១' || student.month === 'ប្រឡងឆមាសទី២') {
        return false;
      }
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : student.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : student.grade === selectedGrade;
      return matchMonth && matchGrade && inCat(student.grade);
    });

    let list = [...monthlyRecords];

    // 2. Search query filter
    if (searchTerm.trim() !== '') {
      list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 2b. Group filter (after-hours classes split into groups)
    if (selectedGradeGroup !== 'ទាំងអស់') {
      list = list.filter(student => (student.group || '') === selectedGradeGroup);
    }

    // 3. Compute rankings inside the filtered group
    return rankStudents(list);
  }, [students, selectedMonth, selectedGrade, searchTerm, classCategory, selectedGradeGroup]);

  // Inline (in-table) score entry. When on with a specific class + month selected, the
  // grid lists the FULL class roster so scores can be typed straight in — students who
  // have no record yet appear as blank synthetic rows (id prefixed __new__).
  const [inlineEdit, setInlineEdit] = useState(false);
  const inlineReady = inlineEdit && selectedGrade !== 'ទាំងអស់' && selectedMonth !== 'ទាំងអស់';

  // Monthly table order: 'list' = class roster / Excel order (default), 'rank' = by average.
  // The ចំណាត់ថ្នាក់ column always shows the real rank regardless of row order.
  const [tableSort, setTableSort] = useState<'list' | 'rank'>('list');
  const orderRows = (base: StudentScore[]): StudentScore[] => {
    if (tableSort === 'rank') return base;
    const idx = new Map(students.map((s, i) => [s.id, i]));
    return [...base].sort((a, b) => (idx.has(a.id) ? idx.get(a.id)! : 1e9) - (idx.has(b.id) ? idx.get(b.id)! : 1e9));
  };

  const monthlyRows = useMemo(() => {
    if (!inlineReady) return orderRows(filteredStudents);
    const meta = new Map<string, StudentScore>();
    students.forEach(s => { if (s.grade === selectedGrade && !meta.has(s.name.trim())) meta.set(s.name.trim(), s); });
    let list: StudentScore[] = Array.from(meta.entries()).map(([name, sample]) => {
      const existing = students.find(s => s.grade === selectedGrade && s.month === selectedMonth && s.name.trim() === name);
      if (existing) return existing;
      return calculateStudentFields({
        id: `__new__${selectedGrade}__${selectedMonth}__${name}`,
        name, gender: sample.gender, grade: selectedGrade, month: selectedMonth, group: sample.group,
        studentId: sample.studentId,
        khmer: { listening: null, speaking: null, reading: null, writing: null },
        math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
        science: null, socialStudies: null, scienceScores: {}, socialScores: {},
        physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null,
        ...(customSubjects ? { englishScores: {} } : {}),
      });
    });
    if (selectedGradeGroup !== 'ទាំងអស់') list = list.filter(s => (s.group || '') === selectedGradeGroup);
    if (searchTerm.trim() !== '') list = list.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return orderRows(rankStudents(list));
  }, [inlineReady, students, selectedGrade, selectedMonth, selectedGradeGroup, searchTerm, customSubjects, filteredStudents, tableSort]);

  // Mutate a row's underlying record (creating it for blank rows), recompute and persist.
  const applyToRecord = (row: StudentScore, mutate: (rec: StudentScore) => void) => {
    const isNew = String(row.id).startsWith('__new__');
    let rec: StudentScore;
    if (isNew) {
      const sample = students.find(s => s.grade === selectedGrade && s.name.trim() === row.name.trim());
      rec = calculateStudentFields({
        id: generateUniqueId(),
        name: row.name, gender: row.gender, grade: selectedGrade, month: selectedMonth, group: row.group,
        studentId: row.studentId ?? sample?.studentId,
        khmer: { listening: null, speaking: null, reading: null, writing: null },
        math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
        science: null, socialStudies: null, scienceScores: {}, socialScores: {},
        physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null,
        ...(customSubjects ? { englishScores: {} } : {}),
      });
    } else {
      const found = students.find(s => s.id === row.id);
      if (!found) return;
      rec = JSON.parse(JSON.stringify(found)) as StudentScore;
    }
    mutate(rec);
    const calc = calculateStudentFields(rec);
    const updated = isNew ? [...students, calc] : students.map(s => (s.id === rec.id ? calc : s));
    onSaveStudents(updated);
  };

  // Apply an edited score to a row's record.
  const commitScore = (row: StudentScore, assign: (rec: StudentScore, val: number | null) => void, raw: number | null) =>
    applyToRecord(row, rec => assign(rec, raw === null ? null : clampScore(raw)));

  // Apply an edited teacher remark (flows to the student report card via StudentScore.remark).
  const commitRemark = (row: StudentScore, text: string) =>
    applyToRecord(row, rec => { rec.remark = text.trim() || undefined; });

  // Distinct groups in the selected class (drives the group filter for custom classes).
  const availableGradeGroups = useMemo(() => {
    return Array.from(new Set<string>(
      students.filter(s => s.grade === selectedGrade && s.group).map(s => s.group as string)
    )).sort((a, b) => a.localeCompare(b, 'km'));
  }, [students, selectedGrade]);

  // Semester aggregation values
  const semesterStudents = useMemo(() => {
    const uniqueStudentsMap = new Map<string, { name: string; gender: 'ប្រុស' | 'ស្រី'; grade: string }>();
    students.forEach(s => {
      if ((selectedGrade === 'ទាំងអស់' || s.grade === selectedGrade) && inCat(s.grade)) {
        if (s.month !== 'ប្រឡងឆមាសទី១' && s.month !== 'ប្រឡងឆមាសទី២') {
          const key = `${s.name.trim()}_${s.grade}`;
          if (!uniqueStudentsMap.has(key)) {
            uniqueStudentsMap.set(key, { name: s.name.trim(), gender: s.gender, grade: s.grade });
          }
        }
      }
    });

    const targetMonths = selectedSemester === '1' ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS;
    const examMonthName = selectedSemester === '1' ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២';

    const roster = Array.from(uniqueStudentsMap.values()).map(student => {
      const monthlyRecords = students.filter(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        targetMonths.includes(s.month)
      );

      const monthAveragesMap: Record<string, number> = {};
      let sumMonthlyAvgs = 0;
      let activeMonthsCount = 0;

      targetMonths.forEach(m => {
        const record = monthlyRecords.find(r => r.month === m);
        if (record && record.totalScore !== undefined) {
          monthAveragesMap[m] = record.overallAvg;
          sumMonthlyAvgs += record.overallAvg;
          activeMonthsCount++;
        }
      });

      const overallMonthlyAvg = activeMonthsCount > 0 ? clampScore(sumMonthlyAvgs / activeMonthsCount) : null;

      const examRecord = students.find(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        s.month === examMonthName
      );

      const examScore = examRecord ? examRecord.overallAvg : null;

      let semesterAvg: number | null = null;
      if (overallMonthlyAvg !== null && examScore !== null) {
        semesterAvg = clampScore((overallMonthlyAvg + examScore) / 2);
      } else if (overallMonthlyAvg !== null) {
        semesterAvg = overallMonthlyAvg;
      } else if (examScore !== null) {
        semesterAvg = examScore;
      }

      let gradeLetter = '-';
      let result = '-';
      if (semesterAvg !== null) {
        if (semesterAvg >= 9.0) gradeLetter = 'A';
        else if (semesterAvg >= 8.0) gradeLetter = 'B';
        else if (semesterAvg >= 7.0) gradeLetter = 'C';
        else if (semesterAvg >= 6.0) gradeLetter = 'D';
        else if (semesterAvg >= 5.0) gradeLetter = 'E';
        else gradeLetter = 'F';

        result = semesterAvg >= 5.0 ? 'ជាប់' : 'ធ្លាក់';
      }

      return {
        ...student,
        monthAverages: monthAveragesMap,
        overallMonthlyAvg,
        examScore,
        semesterAvg,
        gradeLetter,
        result
      };
    });

    const sorted = roster.sort((a, b) => (b.semesterAvg ?? 0) - (a.semesterAvg ?? 0));
    return sorted.map((student, idx) => ({
      ...student,
      ranking: idx + 1
    }));
  }, [students, selectedGrade, selectedSemester, classCategory]);

  const filteredSemesterStudents = useMemo(() => {
    let list = semesterStudents;
    if (searchTerm.trim() !== '') {
      list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [semesterStudents, searchTerm]);

  // Annual (Yearly) aggregation values
  const annualStudents = useMemo(() => {
    const uniqueStudentsMap = new Map<string, { name: string; gender: 'ប្រុស' | 'ស្រី'; grade: string }>();
    students.forEach(s => {
      if ((selectedGrade === 'ទាំងអស់' || s.grade === selectedGrade) && inCat(s.grade)) {
        if (s.month !== 'ប្រឡងឆមាសទី១' && s.month !== 'ប្រឡងឆមាសទី២') {
          const key = `${s.name.trim()}_${s.grade}`;
          if (!uniqueStudentsMap.has(key)) {
            uniqueStudentsMap.set(key, { name: s.name.trim(), gender: s.gender, grade: s.grade });
          }
        }
      }
    });

    const roster = Array.from(uniqueStudentsMap.values()).map(student => {
      // Semester 1 calculation
      const mRecords1 = students.filter(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        SEMESTER_1_MONTHS.includes(s.month)
      );
      let sumMonthlyAvgs1 = 0;
      let count1 = 0;
      SEMESTER_1_MONTHS.forEach(m => {
        const record = mRecords1.find(r => r.month === m);
        if (record && record.totalScore !== undefined) {
          sumMonthlyAvgs1 += record.overallAvg;
          count1++;
        }
      });
      const overallMonthlyAvg1 = count1 > 0 ? clampScore(sumMonthlyAvgs1 / count1) : null;
      const examRecord1 = students.find(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        s.month === 'ប្រឡងឆមាសទី១'
      );
      const examScore1 = examRecord1 ? examRecord1.overallAvg : null;
      const s1Valid = count1 > 0 || examScore1 !== null;
      const s1Avg = s1Valid ? (examScore1 !== null ? (overallMonthlyAvg1 !== null ? clampScore((overallMonthlyAvg1 + examScore1) / 2) : examScore1) : overallMonthlyAvg1) : null;

      // Semester 2 calculation
      const mRecords2 = students.filter(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        SEMESTER_2_MONTHS.includes(s.month)
      );
      let sumMonthlyAvgs2 = 0;
      let count2 = 0;
      SEMESTER_2_MONTHS.forEach(m => {
        const record = mRecords2.find(r => r.month === m);
        if (record && record.totalScore !== undefined) {
          sumMonthlyAvgs2 += record.overallAvg;
          count2++;
        }
      });
      const overallMonthlyAvg2 = count2 > 0 ? clampScore(sumMonthlyAvgs2 / count2) : null;
      const examRecord2 = students.find(s =>
        s.name.trim() === student.name &&
        s.grade === student.grade &&
        s.month === 'ប្រឡងឆមាសទី២'
      );
      const examScore2 = examRecord2 ? examRecord2.overallAvg : null;
      const s2Valid = count2 > 0 || examScore2 !== null;
      const s2Avg = s2Valid ? (examScore2 !== null ? (overallMonthlyAvg2 !== null ? clampScore((overallMonthlyAvg2 + examScore2) / 2) : examScore2) : overallMonthlyAvg2) : null;

      // Annual Average
      let annualAvg: number | null = null;
      if (s1Valid && s2Valid && s1Avg !== null && s2Avg !== null) {
        annualAvg = clampScore((s1Avg + s2Avg) / 2);
      } else if (s1Valid && s1Avg !== null) {
        annualAvg = s1Avg;
      } else if (s2Valid && s2Avg !== null) {
        annualAvg = s2Avg;
      }

      let gradeLetter = '-';
      let result = '-';
      if (annualAvg !== null) {
        if (annualAvg >= 9.0) gradeLetter = 'A';
         else if (annualAvg >= 8.0) gradeLetter = 'B';
         else if (annualAvg >= 7.0) gradeLetter = 'C';
         else if (annualAvg >= 6.0) gradeLetter = 'D';
         else if (annualAvg >= 5.0) gradeLetter = 'E';
         else gradeLetter = 'F';

         result = annualAvg >= 5.0 ? 'ជាប់' : 'ធ្លាក់';
      }

      return {
        ...student,
        s1Avg,
        s2Avg,
        annualAvg,
        gradeLetter,
        result
      };
    });

    const sorted = roster.sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
    return sorted.map((student, idx) => ({
      ...student,
      ranking: idx + 1
    }));
  }, [students, selectedGrade, classCategory]);

  const filteredAnnualStudents = useMemo(() => {
    let list = annualStudents;
    if (searchTerm.trim() !== '') {
      list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [annualStudents, searchTerm]);

  // Open form for creating new student
  const handleOpenCreateForm = () => {
    setEditingStudentId(null);
    setFormName('');
    setFormGender('ប្រុស');
    setFormGrade(currentUser && currentUser.role === 'teacher' ? (selectedGrade !== 'ទាំងអស់' ? selectedGrade : currentUser.grade) : (selectedGrade === 'ទាំងអស់' ? (gradesList[0] || 'ថ្នាក់ទី៦') : selectedGrade));
    
    if (activeMode === 'semester') {
      setFormMonth(selectedSemester === '1' ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២');
    } else {
      setFormMonth(selectedMonth === 'ទាំងអស់' ? 'មេសា' : selectedMonth);
    }
    
    // reset scores
    setKhmerListening('');
    setKhmerWriting('');
    setKhmerReading('');
    setKhmerSpeaking('');
    setMathNumbers('');
    setMathMeasurement('');
    setMathGeometry('');
    setMathAlgebra('');
    setMathStatistics('');
    setScienceScores({});
    setSocialScores({});
    setPhysicalEducation('');
    setHealth('');
    setLifeSkills('');
    setForeignLanguage('');
    setEnglishScores({});
    setFormStudentId('');
    setFormNote('');
    setFormRemark('');

    setIsFormOpen(true);
  };

  // Open form to edit student scores
  const handleEditClick = (student: StudentScore) => {
    setEditingStudentId(student.id);
    setFormName(student.name);
    setFormGender(student.gender);
    setFormGrade(student.grade);
    setFormMonth(student.month);

    // Populate score fields
    setKhmerListening(student.khmer.listening !== null ? student.khmer.listening.toString() : '');
    setKhmerWriting(student.khmer.writing !== null ? student.khmer.writing.toString() : '');
    setKhmerReading(student.khmer.reading !== null ? student.khmer.reading.toString() : '');
    setKhmerSpeaking(student.khmer.speaking !== null ? student.khmer.speaking.toString() : '');

    setMathNumbers(student.math.numbers !== null ? student.math.numbers.toString() : '');
    setMathMeasurement(student.math.measurement !== null ? student.math.measurement.toString() : '');
    setMathGeometry(student.math.geometry !== null ? student.math.geometry.toString() : '');
    setMathAlgebra(student.math.algebra !== null ? student.math.algebra.toString() : '');
    setMathStatistics(student.math.statistics !== null ? student.math.statistics.toString() : '');

    setPhysicalEducation(student.physicalEducation !== null ? student.physicalEducation.toString() : '');
    setHealth(student.health !== null ? student.health.toString() : '');
    setLifeSkills(student.lifeSkills !== null ? student.lifeSkills.toString() : '');
    setForeignLanguage(student.foreignLanguage !== null ? student.foreignLanguage.toString() : '');
    setFormStudentId(student.studentId || '');
    setFormNote(student.note || '');
    setFormRemark(student.remark || '');

    const loadMap = (subjects: { key: string }[], src?: Record<string, number | null>) => {
      const m: Record<string, string> = {};
      subjects.forEach(s => { const v = src?.[s.key]; m[s.key] = v != null ? v.toString() : ''; });
      return m;
    };
    setScienceScores(loadMap(SCIENCE_SUBJECTS, student.scienceScores));
    setSocialScores(loadMap(SOCIAL_SUBJECTS, student.socialScores));
    setEnglishScores(loadMap(getCustomSubjects(student.grade) || ENGLISH_SUBJECTS, student.englishScores));

    setIsFormOpen(true);
  };

  // Fill the score inputs from an existing record (or clear them when none exists), so
  // picking a student who already has a score for the month edits it instead of wiping it.
  const applyRecordScoresToForm = (record?: StudentScore | null) => {
    setKhmerListening(record?.khmer?.listening != null ? record.khmer.listening.toString() : '');
    setKhmerWriting(record?.khmer?.writing != null ? record.khmer.writing.toString() : '');
    setKhmerReading(record?.khmer?.reading != null ? record.khmer.reading.toString() : '');
    setKhmerSpeaking(record?.khmer?.speaking != null ? record.khmer.speaking.toString() : '');
    setMathNumbers(record?.math?.numbers != null ? record.math.numbers.toString() : '');
    setMathMeasurement(record?.math?.measurement != null ? record.math.measurement.toString() : '');
    setMathGeometry(record?.math?.geometry != null ? record.math.geometry.toString() : '');
    setMathAlgebra(record?.math?.algebra != null ? record.math.algebra.toString() : '');
    setMathStatistics(record?.math?.statistics != null ? record.math.statistics.toString() : '');
    setPhysicalEducation(record?.physicalEducation != null ? record.physicalEducation.toString() : '');
    setHealth(record?.health != null ? record.health.toString() : '');
    setLifeSkills(record?.lifeSkills != null ? record.lifeSkills.toString() : '');
    setForeignLanguage(record?.foreignLanguage != null ? record.foreignLanguage.toString() : '');
    setFormStudentId(record?.studentId || '');
    setFormNote(record?.note || '');
    setFormRemark(record?.remark || '');
    // Sub-subject + English categories
    const loadMap = (subjects: { key: string }[], src?: Record<string, number | null>) => {
      const m: Record<string, string> = {};
      subjects.forEach(s => { const v = src?.[s.key]; m[s.key] = v != null ? v.toString() : ''; });
      return m;
    };
    setScienceScores(loadMap(SCIENCE_SUBJECTS, record?.scienceScores));
    setSocialScores(loadMap(SOCIAL_SUBJECTS, record?.socialScores));
    setEnglishScores(loadMap(getCustomSubjects(record?.grade || formGrade) || ENGLISH_SUBJECTS, record?.englishScores));
  };

  // Action: Save or Update student
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះសិស្ស!');
      return;
    }

    // Upsert: when not explicitly editing, reuse the student's existing record for this
    // month so re-entering scores updates it instead of creating a duplicate.
    const existingMonthRecord = !editingStudentId
      ? students.find(s => s.name.trim() === formName.trim() && s.grade === formGrade && s.month === formMonth)
      : null;
    const targetId = editingStudentId || existingMonthRecord?.id || generateUniqueId();

    // Convert a sub-score string map into a numeric map.
    const toNumMap = (subjects: { key: string }[], src: Record<string, string>) =>
      subjects.reduce((acc, s) => {
        const v = src[s.key];
        acc[s.key] = (v === undefined || v === '') ? null : clampScore(parseFloat(v) || 0);
        return acc;
      }, {} as Record<string, number | null>);

    const payload: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'> = {
      id: targetId,
      name: formName.trim(),
      gender: formGender,
      grade: formGrade,
      month: formMonth,
      studentId: formStudentId.trim() || undefined,
      note: formNote.trim() || undefined,
      remark: formRemark.trim() || undefined,
      khmer: {
        listening: khmerListening === '' ? null : clampScore(parseFloat(khmerListening) || 0),
        writing: khmerWriting === '' ? null : clampScore(parseFloat(khmerWriting) || 0),
        reading: khmerReading === '' ? null : clampScore(parseFloat(khmerReading) || 0),
        speaking: khmerSpeaking === '' ? null : clampScore(parseFloat(khmerSpeaking) || 0),
      },
      math: {
        numbers: mathNumbers === '' ? null : clampScore(parseFloat(mathNumbers) || 0),
        measurement: mathMeasurement === '' ? null : clampScore(parseFloat(mathMeasurement) || 0),
        geometry: mathGeometry === '' ? null : clampScore(parseFloat(mathGeometry) || 0),
        algebra: mathAlgebra === '' ? null : clampScore(parseFloat(mathAlgebra) || 0),
        statistics: mathStatistics === '' ? null : clampScore(parseFloat(mathStatistics) || 0),
      },
      science: null,
      socialStudies: null,
      scienceScores: toNumMap(SCIENCE_SUBJECTS, scienceScores),
      socialScores: toNumMap(SOCIAL_SUBJECTS, socialScores),
      physicalEducation: physicalEducation === '' ? null : clampScore(parseFloat(physicalEducation) || 0),
      health: health === '' ? null : clampScore(parseFloat(health) || 0),
      lifeSkills: lifeSkills === '' ? null : clampScore(parseFloat(lifeSkills) || 0),
      foreignLanguage: foreignLanguage === '' ? null : clampScore(parseFloat(foreignLanguage) || 0)
    };

    // For custom-criteria classes (English, Health…), store that class's criteria and
    // null out the general subjects so the overall average comes from them only.
    const finalPayload = formCustomSubjects
      ? {
          ...payload,
          khmer: { listening: null, writing: null, reading: null, speaking: null },
          math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
          science: null, socialStudies: null, scienceScores: undefined, socialScores: undefined,
          physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null,
          englishScores: formCustomSubjects.reduce((acc, s) => {
            const v = englishScores[s.key];
            acc[s.key] = (v === undefined || v === '') ? null : clampScore(parseFloat(v) || 0);
            return acc;
          }, {} as Record<string, number | null>),
        }
      : payload;

    const calculatedPayload = calculateStudentFields(finalPayload);

    let updatedList: StudentScore[];
    if (editingStudentId || existingMonthRecord) {
      // Edit / upsert an existing record in place (no duplicates)
      const idToReplace = editingStudentId || existingMonthRecord!.id;
      updatedList = students.map(s => s.id === idToReplace ? calculatedPayload : s);
    } else {
      // Add a brand-new record
      updatedList = [...students, calculatedPayload];
    }

    onSaveStudents(updatedList);
    setIsFormOpen(false);
    setEditingStudentId(null);
  };

  // Action: Delete Student
  const handleDeleteClick = (id: string, name: string) => {
    if (currentUser?.role === 'teacher') {
      alert('គណនីគ្រូមិនមានសិទ្ធិលុបពិន្ទុរបស់សិស្សឡើយ!');
      return;
    }
    if (window.confirm(`តើអ្នកពិតជាចង់លុបពិន្ទុរបស់សិស្សឈ្មោះ «${name}» ឬទេ?`)) {
      const updated = students.filter(s => s.id !== id);
      onSaveStudents(updated);
    }
  };

  // Action: Save Semester Exam Score
  const handleExamFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreVal = clampScore(parseFloat(examScoreInput) || 0);
    const targetMonth = selectedSemester === '1' ? 'ប្រឡងឆមាសទី១' : 'ប្រឡងឆមាសទី២';
    
    // Check if an exam record already exists for this student/grade/semester
    const existingIdx = students.findIndex(s => 
      s.name.trim() === examStudentName.trim() && 
      s.grade === examStudentGrade && 
      s.month === targetMonth
    );
    
    const payload: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'> = {
      id: existingIdx >= 0 ? students[existingIdx].id : generateUniqueId(),
      name: examStudentName,
      gender: examStudentGender,
      grade: examStudentGrade,
      month: targetMonth,
      khmer: { listening: scoreVal, writing: scoreVal, reading: scoreVal, speaking: scoreVal },
      math: { numbers: scoreVal, measurement: scoreVal, geometry: scoreVal, algebra: scoreVal, statistics: scoreVal },
      science: scoreVal,
      socialStudies: scoreVal,
      physicalEducation: scoreVal,
      health: scoreVal,
      lifeSkills: scoreVal,
      foreignLanguage: scoreVal
    };
    
    const calculated = calculateStudentFields(payload);
    
    let updated: StudentScore[];
    if (existingIdx >= 0) {
      updated = students.map((s, idx) => idx === existingIdx ? calculated : s);
    } else {
      updated = [...students, calculated];
    }
    
    onSaveStudents(updated);
    setIsExamFormOpen(false);
    alert(`បានរក្សាទុកពិន្ទុប្រឡងឆមាសរបស់សិស្ស «${examStudentName}» ដោយជោគជ័យ!`);
  };

  return (
    <div className="space-y-6">
      {/* Class category tabs (principal): General vs Extra */}
      {currentUser?.role !== 'teacher' && (
        <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100 w-full">
          <button
            onClick={() => { setClassCategory('general'); setSelectedGrade('ទាំងអស់'); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${classCategory === 'general' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            📘 ថ្នាក់ចំណេះទូទៅ
            <span className="hidden sm:inline text-[11px] font-medium opacity-80">(មត្តេយ្យ–ទី៦)</span>
          </button>
          <button
            onClick={() => { setClassCategory('extra'); setSelectedGrade('ទាំងអស់'); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            🎨 ថ្នាក់ក្រៅម៉ោង
            <span className="hidden sm:inline text-[11px] font-medium opacity-80">(ភាសា/គំនូរ/កុំព្យូទ័រ...)</span>
          </button>
        </div>
      )}

      {/* Search and Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">សៀវភៅតាមដាន និងគ្រប់គ្រងពិន្ទុសិស្ស</h2>
          <p className="text-sm text-slate-500 mt-1">
            បញ្ចូលពិន្ទុសិស្សតាមមុខវិជ្ជា គណនាមធ្យមភាគ និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser?.role !== 'teacher' && (
            <button
              type="button"
              onClick={() => setIsClassManagerOpen(!isClassManagerOpen)}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                isClassManagerOpen
                  ? 'bg-indigo-600 text-white border-indigo-650 shadow-md shadow-indigo-600/10'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/80'
              }`}
            >
              <Plus size={16} />
              បន្ថែមថ្នាក់ថ្មី
            </button>
          )}

          {activeMode === 'monthly' && (
            <>
              <button
                onClick={handleDownloadScoreTemplate}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-slate-700 font-semibold hover:bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all"
                title="ទាញយកគំរូ Excel"
              >
                <Download size={16} />
                គំរូ
              </button>
              <button
                onClick={() => scoreFileRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 text-white font-semibold hover:bg-emerald-700 rounded-xl text-sm transition-all shadow-md shadow-emerald-500/10"
                title="នាំចូលពិន្ទុពី Excel/CSV"
              >
                <Upload size={16} />
                នាំចូលពីកុំព្យូទ័រ
              </button>
              <input
                ref={scoreFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportScores}
              />
              <button
                onClick={handleBackfillIds}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-amber-700 font-semibold hover:bg-amber-50 border border-amber-200 rounded-xl text-sm transition-all"
                title="បំពេញអត្តលេខដែលខ្វះ ដោយចម្លងពីកំណត់ត្រាផ្សេងរបស់សិស្សដូចគ្នា"
              >
                <Hash size={16} />
                បំពេញអត្តលេខ
              </button>
              <button
                onClick={handleResetMonthScores}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-rose-600 font-semibold hover:bg-rose-50 border border-rose-200 rounded-xl text-sm transition-all"
                title="លុបពិន្ទុថ្នាក់+ខែនេះ ដើម្បីនាំចូលឡើងវិញ (ករណីនាំចូលខុស)"
              >
                <RotateCcw size={16} />
                កំណត់ឡើងវិញ
              </button>
              <button
                onClick={() => setInlineEdit(v => !v)}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 font-semibold rounded-xl text-sm transition-all border ${inlineEdit ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/10' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                title="បញ្ចូលពិន្ទុក្នុងតារាងផ្ទាល់"
              >
                <Table2 size={16} />
                {inlineEdit ? 'កំពុងបញ្ចូលក្នុងតារាង ✓' : 'បញ្ចូលក្នុងតារាង'}
              </button>
              <button
                onClick={() => setTableSort(s => (s === 'list' ? 'rank' : 'list'))}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 font-semibold rounded-xl text-sm transition-all border bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                title="ប្តូររបៀបតម្រៀបជួរ (តាមបញ្ជី / តាមចំណាត់ថ្នាក់)"
              >
                {tableSort === 'list' ? '🔢 តម្រៀប៖ តាមបញ្ជី' : '🏆 តម្រៀប៖ ចំណាត់ថ្នាក់'}
              </button>
            </>
          )}

          <button
            id="btn_add_student_score"
            onClick={handleOpenCreateForm}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white font-semibold hover:bg-blue-700 rounded-xl text-sm transition-all shadow-md shadow-blue-500/10"
          >
            <UserPlus size={16} />
            បញ្ចូលពិន្ទុ
          </button>
        </div>
      </div>

      {/* Dynamic Class Manager Panel */}
      {isClassManagerOpen && currentUser?.role !== 'teacher' && (
        <div id="class_manager_panel" className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={18} />
              គ្រប់គ្រង និងបន្ថែមថ្នាក់រៀនក្នុងប្រព័ន្ធ
            </h3>
            <button
              type="button"
              onClick={() => setIsClassManagerOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Input Column */}
            <div className="md:col-span-1 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-600 block flex items-center gap-1">បន្ថែមថ្នាក់ថ្មី</span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="ឧ. ថ្នាក់ទី៦អា, ថ្នាក់ទី៧..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newClassName.trim()) {
                      alert('សូមបញ្ចូលឈ្មោះថ្នាក់រៀនថ្មី!');
                      return;
                    }
                    if (onAddGrade) {
                      onAddGrade(newClassName.trim());
                      setNewClassName('');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Plus size={14} />
                  បន្ថែមថ្នាក់ចូលប្រព័ន្ធ
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                * បន្ទាប់ពីបន្ថែមថ្នាក់ថ្មីរួច អ្នកនឹងអាចជ្រើសរើសថ្នាក់នេះនៅពេលបញ្ចូលពិន្ទុសិស្ស ឬរៀបចំរបាយការណ៍ប្រចាំខែ។
              </p>
            </div>

            {/* List Column */}
            <div className="md:col-span-2 space-y-3">
              <span className="text-xs font-bold text-slate-600 block">បញ្ជីថ្នាក់រៀនបច្ចុប្បន្ន ({gradesList.length} ថ្នាក់)</span>
              <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-1 text-xs">
                {gradesList.map((g) => {
                  return (
                    <div
                      key={g}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 shadow-3xs hover:border-indigo-200 transition-all hover:bg-indigo-50/20"
                    >
                      <span className="font-sans font-medium">{g}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onDeleteGrade) {
                            onDeleteGrade(g);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-550 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors"
                        title="លុបថ្នាក់នេះ"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sliding/Responsive Score Entry Form Modal or Inline Section */}
      {isFormOpen && (
        <div id="gradebook_form_container" className="bg-white p-6 rounded-2xl border border-blue-100 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-blue-50">
            <h3 className="font-semibold text-slate-800 text-base flex items-center gap-1.5">
              <GraduationCap className="text-blue-600" size={20} />
              {editingStudentId ? `កែសម្រួលពិន្ទុរបស់សិស្ស៖ ${formName}` : 'បញ្ចូលពិន្ទុសិស្ស'}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 px-2.5 text-sm bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-100 transition-colors"
            >
              <X size={16} className="inline mr-1" />បិទ
            </button>
          </div>

          <form onSubmit={handleFormSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: General Student Specs */}
            <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">១. ព័ត៌មានផ្ទាល់ខ្លួន</h4>
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ឈ្មោះសិស្ស</label>
                {editingStudentId ? (
                  <input
                    type="text"
                    disabled
                    value={formName}
                    className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg outline-none font-medium text-slate-500 font-sans"
                  />
                ) : (
                  <>
                    <select
                      required
                      value={formName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        setFormName(selectedName);
                        const sRecord = students.find(s => s.name.trim() === selectedName.trim() && s.grade === formGrade);
                        if (sRecord) {
                          setFormGender(sRecord.gender);
                        }
                        // Pre-fill any existing scores for this month so re-entry edits instead of wiping
                        const monthRecord = students.find(s => s.name.trim() === selectedName.trim() && s.grade === formGrade && s.month === formMonth);
                        applyRecordScoresToForm(monthRecord || null);
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800 font-sans"
                    >
                      <option value="">-- ជ្រើសរើសឈ្មោះសិស្ស --</option>
                      {registeredStudentsInFormGrade.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {!editingStudentId && registeredStudentsInFormGrade.length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-1 font-semibold leading-relaxed">
                        ⚠️ មិនទាន់មានឈ្មោះសិស្សចុះឈ្មោះក្នុងថ្នាក់នេះទេ។ {currentUser?.role === 'teacher' ? 'សូមទំនាក់ទំនងទៅកាន់លោកនាយកសាលាដើម្បីចុះឈ្មោះសិស្សជាមុនសិន។' : 'សូមចូលទៅកាន់មុខងារ «គ្រប់គ្រងថ្នាក់ និងសិស្ស» ដើម្បីចុះឈ្មោះសិស្សថ្មីជាមុនសិន។'}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">អត្តលេខ</label>
                <input
                  type="text"
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  placeholder="ឧ. 17804"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ភេទ</label>
                  <select
                    disabled={currentUser?.role === 'teacher'}
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as 'ប្រុស' | 'ស្រី')}
                    className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    <option value="ប្រុស">ប្រុស</option>
                    <option value="ស្រី">ស្រី</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ថ្នាក់សិក្សា</label>
                  <select
                    disabled={currentUser?.role === 'teacher'}
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800"
                  >
                    {gradesList.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">សម្រាប់ខែ / ឆមាស</label>
                <select
                  value={formMonth}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    setFormMonth(newMonth);
                    if (!editingStudentId && formName.trim()) {
                      const monthRecord = students.find(s => s.name.trim() === formName.trim() && s.grade === formGrade && s.month === newMonth);
                      applyRecordScoresToForm(monthRecord || null);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-800 font-sans"
                >
                  <optgroup label="ពិន្ទុប្រចាំខែ (Monthly Scores)">
                    {MONTHS_LIST.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <optgroup label="ពិន្ទុប្រឡងឆមាស (Semester Exams)">
                    <option value="ប្រឡងឆមាសទី១">ប្រឡងឆមាសទី១ (Semester 1 Exam)</option>
                    <option value="ប្រឡងឆមាសទី២">ប្រឡងឆមាសទី២ (Semester 2 Exam)</option>
                  </optgroup>
                </select>
              </div>

              {(formMonth === 'ប្រឡងឆមាសទី១' || formMonth === 'ប្រឡងឆមាសទី២') && (
                <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed shadow-3xs">
                  <HelpCircle size={18} className="flex-shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">💡 ការបញ្ចូលពិន្ទុឆមាស៖</span>
                    អ្នកកំពុងរៀបចំបញ្ចូលពិន្ទុសម្រាប់ «{formMonth}»។ អ្នកអាចបញ្ចូលពិន្ទុជាក់ស្តែងតាមមុខវិជ្ជានីមួយៗជារង្វាស់លម្អិត ឬបញ្ចូលតម្លៃស្មើៗគ្នាក៏បាន។
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ផ្សេងៗ (កំណត់សម្គាល់)</label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  placeholder="កំណត់សម្គាល់បន្ថែម..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">មូលវិចារគ្រូបន្ទុកថ្នាក់ (បង្ហាញលើព្រឹត្តបត្រ)</label>
                <select
                  value=""
                  onChange={(e) => {
                    const p = e.target.value;
                    if (p) setFormRemark(prev => {
                      const cur = prev.trim();
                      if (cur.includes(p)) return prev; // skip duplicates
                      return cur ? `${cur} ${p}` : p;
                    });
                    e.target.value = '';
                  }}
                  className="w-full mb-1.5 px-3 py-2 text-xs text-blue-700 bg-blue-50/60 border border-blue-100 rounded-lg outline-none cursor-pointer focus:border-blue-400"
                  title="ជ្រើសមូលវិចារសម្រេច"
                >
                  <option value="">➕ ជ្រើសមូលវិចារសម្រេច...</option>
                  {REMARK_PRESETS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(it => <option key={it} value={it}>{it}</option>)}
                    </optgroup>
                  ))}
                </select>
                <textarea
                  value={formRemark}
                  onChange={(e) => setFormRemark(e.target.value)}
                  rows={2}
                  placeholder="ឧ. មានការប្រឹងប្រែង គួរបន្តរក្សា... (ឬជ្រើសពីបញ្ជីខាងលើ)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800 resize-none"
                />
              </div>

              <div className="pt-2">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2.5 text-xs text-blue-700/90 leading-relaxed">
                  <HelpCircle size={18} className="flex-shrink-0 text-blue-500" />
                  <div>
                    <span className="font-semibold block mb-0.5">ការកំណត់ពិន្ទុ៖</span>
                    ពិន្ទុរង និងពិន្ទុមុខវិជ្ជានីមួយៗត្រូវស្ថិតនៅចន្លោះពីគំនិត ០ ដល់ ១០ ជានិច្ច។ មធ្យមភាគប្រចាំខែរួម និងចំណាត់ថ្នាក់នឹងត្រូវរៀបចំដោយម៉ាស៊ីនស្វ័យប្រវត្ត។
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Key split subjects with sub-scores (hidden for English classes) */}
            {!formIsEnglish && (
            <div className="space-y-5 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">២. ភាសាខ្មែរ និងគណិតវិទ្យា (ពិន្ទុរង)</h4>
              
              {/* Khmer Box */}
              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-3">
                <span className="text-xs font-bold text-blue-600 block">ភាសាខ្មែរ (៤ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពស្ដាប់</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={khmerListening}
                      onChange={(e) => setKhmerListening(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពនិយាយ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={khmerSpeaking}
                      onChange={(e) => setKhmerSpeaking(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពអាន</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={khmerReading}
                      onChange={(e) => setKhmerReading(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">សមត្ថភាពសរសេរ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={khmerWriting}
                      onChange={(e) => setKhmerWriting(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Math Box */}
              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-blue-600 block">គណិតវិទ្យា (៥ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ចំនួន</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={mathNumbers}
                      onChange={(e) => setMathNumbers(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">រង្វាស់រង្វាល់</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={mathMeasurement}
                      onChange={(e) => setMathMeasurement(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ធរណីមាត្រ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={mathGeometry}
                      onChange={(e) => setMathGeometry(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">ពិជគណិត</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={mathAlgebra}
                      onChange={(e) => setMathAlgebra(e.target.value)}
                      className="w-full px-2 py-1.25 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">ស្ថិតិ</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={mathStatistics}
                      onChange={(e) => setMathStatistics(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Column 3: custom-criteria columns (English 8 / Health 5 …) OR general subjects */}
            <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              {formCustomSubjects ? (
                <>
                  <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">ផ្នែកវាយតម្លៃរបស់ថ្នាក់ ({formCustomSubjects.length} ផ្នែក)</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                    {formCustomSubjects.map(s => (
                      <div key={s.key}>
                        <label className="block text-slate-500 mb-1">{s.km}</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={englishScores[s.key] ?? ''}
                          onChange={(e) => setEnglishScores(prev => ({ ...prev, [s.key]: e.target.value }))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
              <>
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">៣. មុខវិជ្ជាបន្ថែម</h4>

              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-blue-600 block">វិទ្យាសាស្ត្រ (៤ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {SCIENCE_SUBJECTS.map(s => (
                    <div key={s.key}>
                      <label className="block text-[10px] text-slate-400 mb-0.5">{s.km}</label>
                      <input
                        type="number" min="0" max="10" step="0.1"
                        value={scienceScores[s.key] ?? ''}
                        onChange={(e) => setScienceScores(prev => ({ ...prev, [s.key]: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200/60 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-blue-600 block">សិក្សាសង្គម (៤ ផ្នែករង)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {SOCIAL_SUBJECTS.map(s => (
                    <div key={s.key}>
                      <label className="block text-[10px] text-slate-400 mb-0.5">{s.km}</label>
                      <input
                        type="number" min="0" max="10" step="0.1"
                        value={socialScores[s.key] ?? ''}
                        onChange={(e) => setSocialScores(prev => ({ ...prev, [s.key]: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none focus:border-blue-500 font-mono text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                <div>
                  <label className="block text-slate-500 mb-1">កាយ-កីឡា</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={physicalEducation}
                    onChange={(e) => setPhysicalEducation(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">សុខភាព</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={health}
                    onChange={(e) => setHealth(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">បំណិនជីវិត</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={lifeSkills}
                    onChange={(e) => setLifeSkills(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">ភាសាបរទេស</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={foreignLanguage}
                    onChange={(e) => setForeignLanguage(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>
              </div>
              </>
              )}

              {/* Form Save Button Action */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingStudentId(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  id="btn_submit_score"
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-600/15"
                >
                  <Check size={16} />
                  {editingStudentId ? 'ធ្វើបច្ចុប្បន្នភាព' : 'រក្សាទុកទិន្នន័យ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Mode Switcher Buttons */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-fit text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveMode('monthly')}
          className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeMode === 'monthly'
              ? 'bg-white text-slate-800 shadow-xs font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          🗓️ ពិន្ទុប្រចាំខែ (Monthly Scores)
        </button>
        <button
          id="btn_semester_mode"
          onClick={() => setActiveMode('semester')}
          className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeMode === 'semester'
              ? 'bg-white text-slate-800 shadow-xs font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          🎓 ពិន្ទុឆមាស (Semester Scores)
        </button>
        <button
          id="btn_annual_mode"
          onClick={() => setActiveMode('annual')}
          className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeMode === 'annual'
              ? 'bg-white text-slate-800 shadow-xs font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          🏆 លទ្ធផលប្រចាំឆ្នាំ (Annual Results)
        </button>
      </div>

      {/* List Filter Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 text-base">
              {activeMode === 'monthly' 
                ? 'តារាងឈ្មោះ និងពិន្ទុសិស្សប្រចាំខែ' 
                : activeMode === 'semester' 
                  ? `តារាងសង្ខេបពិន្ទុប្រចាំឆមាសទី ${selectedSemester}` 
                  : 'តារាងលទ្ធផលរួមប្រចាំឆ្នាំរបស់សិស្ស (Annual Summary)'
              }
            </h3>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono text-xs border border-slate-200">
              សរុប {activeMode === 'monthly' ? new Set(filteredStudents.map(s => `${s.name.trim()}_${s.grade}`)).size : activeMode === 'semester' ? filteredSemesterStudents.length : filteredAnnualStudents.length} នាក់
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Local Search input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ស្វែងរកតាមឈ្មោះសិស្ស..."
                className="pl-8 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 transition-all text-xs"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            {/* Honor roll (top 5) for the current period */}
            <button
              onClick={() => setHonorOpen(true)}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
              title="តារាងកិត្តិយស (សិស្សពូកែ ៥ នាក់)"
            >
              🏅 តារាងកិត្តិយស
            </button>

            {/* Group filter — after-hours classes split into groups */}
            {viewingEnglish && availableGradeGroups.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500">ក្រុម៖</span>
                <select
                  value={selectedGradeGroup}
                  onChange={(e) => setSelectedGradeGroup(e.target.value)}
                  className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded text-indigo-700 font-bold outline-none focus:border-blue-500"
                >
                  <option value="ទាំងអស់">គ្រប់ក្រុម</option>
                  {availableGradeGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}

            {/* Quick selectors matching the upper selections */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              {activeMode === 'monthly' ? (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-white border-none text-slate-600 outline-none font-medium text-slate-700"
                >
                  <option value="ទាំងអស់">គ្រប់ខែ</option>
                  {MONTHS_LIST.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : activeMode === 'semester' ? (
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as '1' | '2')}
                  className="px-3 py-1 text-[11px] bg-white border-none text-indigo-700 font-bold outline-none"
                >
                  <option value="1">ឆមាសទី ១</option>
                  <option value="2">ឆមាសទី ២</option>
                </select>
              ) : (
                <span className="px-3 py-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 rounded-md">
                  លទ្ធផលប្រចាំឆ្នាំ 🎓
                </span>
              )}

              {currentUser?.role === 'teacher' ? (
                isExtraTeacher && teacherSubjectGrades.length > 1 ? (
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 font-bold border-l border-slate-200 outline-none font-sans rounded-r-md"
                  >
                    {teacherSubjectGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <span className="px-3 py-1 text-[11px] bg-blue-50 text-blue-700/90 font-bold border-l border-slate-200 font-sans">
                    ថ្នាក់៖ {currentUser.grade} 🔒
                  </span>
                )
              ) : (
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-white border-none text-slate-600 outline-none font-medium"
                >
                  <option value="ទាំងអស់">គ្រប់ថ្នាក់</option>
                  {gradesList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {inlineEdit && activeMode === 'monthly' && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium flex items-center gap-2">
            <Table2 size={13} className="shrink-0" />
            {inlineReady
              ? 'បញ្ចូលពិន្ទុក្នុងប្រអប់ផ្ទាល់ — ពិន្ទុរក្សាទុកស្វ័យប្រវត្តិពេលចេញពីប្រអប់ (Enter ឬ ប៉ះកន្លែងផ្សេង)។ សិស្សទាំងអស់ក្នុងថ្នាក់បង្ហាញ បើទោះមិនទាន់មានពិន្ទុ។'
              : 'សូមជ្រើសរើស ថ្នាក់ និង ខែ ជាក់លាក់ ដើម្បីបង្ហាញសិស្សទាំងអស់ និងបញ្ចូលពិន្ទុក្នុងតារាង។'}
          </div>
        )}

        {/* Scrollable grid student table listing — header rows & first columns stay frozen */}
        <style>{`
          .gb-scroll thead th { position: sticky; top: 0; z-index: 20; background: #f8fafc; }
          .gb-scroll thead th.gb-corner { z-index: 30; }
          .gb-scroll thead tr:nth-child(2) th { top: 33px; }
        `}</style>
        <div className="gb-scroll overflow-auto max-h-[70vh] border border-slate-100 rounded-xl">
          {activeMode === 'monthly' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                {viewingEnglish ? (
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th className="gb-corner px-1 py-3 text-center sticky left-0 z-20 bg-slate-50 w-9 min-w-9">ល.រ</th>
                    <th className="gb-corner px-1 py-3 text-center sticky left-9 z-20 bg-slate-50 w-14 min-w-14">អត្តលេខ</th>
                    <th className="gb-corner px-2 py-3 sticky left-[92px] z-20 bg-slate-50 shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
                    <th className="px-4 py-3 text-center">ភេទ</th>
                    <th className="px-4 py-3 text-center">ថ្នាក់សិក្សា</th>
                    <th className="px-4 py-3 text-center">ក្រុម</th>
                    <th className="px-4 py-3 text-center">ខែ</th>
                    {(customSubjects || []).map(s => (
                      <th key={s.key} className="px-4 py-3 text-center whitespace-nowrap">{s.km}</th>
                    ))}
                    <th className="px-4 py-3 text-center text-blue-600 bg-blue-50/50">ពិន្ទុសរុប</th>
                    <th className="px-4 py-3 text-center text-blue-600 bg-blue-50/50">មធ្យមភាគរួម</th>
                    <th className="px-4 py-3 text-center">ចំណាត់ថ្នាក់</th>
                    <th className="px-4 py-3 text-center">និទ្ទេស</th>
                    <th className="px-4 py-3 text-center">លទ្ធផល</th>
                    <th className="px-4 py-3 text-center">មូលវិចារគ្រូ</th>
                    <th className="px-4 py-3 text-right">សកម្មភាព</th>
                  </tr>
                ) : (
                  <>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th rowSpan={2} className="gb-corner px-1 py-3 text-center sticky left-0 z-20 bg-slate-50 w-9 min-w-9">ល.រ</th>
                    <th rowSpan={2} className="gb-corner px-1 py-3 text-center sticky left-9 z-20 bg-slate-50 w-14 min-w-14">អត្តលេខ</th>
                    <th rowSpan={2} className="gb-corner px-2 py-3 sticky left-[92px] z-20 bg-slate-50 shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">គោត្តនាម និងនាម</th>
                    <th rowSpan={2} className="px-4 py-3 text-center">ភេទ</th>
                    <th rowSpan={2} className="px-4 py-3 text-center">ថ្នាក់</th>
                    <th rowSpan={2} className="px-4 py-3 text-center">ខែ</th>
                    <th colSpan={4} className="px-2 py-2 text-center border-l border-slate-200 text-blue-600">ភាសាខ្មែរ</th>
                    <th colSpan={5} className="px-2 py-2 text-center border-l border-slate-200 text-blue-600">គណិតវិទ្យា</th>
                    <th colSpan={4} className="px-2 py-2 text-center border-l border-slate-200 text-blue-600">វិទ្យាសាស្ត្រ</th>
                    <th colSpan={4} className="px-2 py-2 text-center border-l border-slate-200 text-blue-600">សិក្សាសង្គម</th>
                    <th rowSpan={2} className="px-3 py-3 text-center border-l border-slate-200">កាយ-<br/>កីឡា</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">សុខភាព</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">បំណិន<br/>ជីវិត</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">ភាសា<br/>បរទេស</th>
                    <th rowSpan={2} className="px-3 py-3 text-center text-blue-600 bg-blue-50/50">ពិន្ទុ<br/>សរុប</th>
                    <th rowSpan={2} className="px-3 py-3 text-center text-blue-600 bg-blue-50/50">មធ្យម<br/>ភាគ</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">ចំណាត់<br/>ថ្នាក់</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">និទ្ទេស</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">លទ្ធផល</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">មូលវិចារគ្រូ</th>
                    <th rowSpan={2} className="px-4 py-3 text-right">សកម្មភាព</th>
                  </tr>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-[10px] font-semibold text-slate-400">
                    <th className="px-2 py-2 text-center border-l border-slate-200 font-normal">ស្តាប់</th>
                    <th className="px-2 py-2 text-center font-normal">និយាយ</th>
                    <th className="px-2 py-2 text-center font-normal">អាន</th>
                    <th className="px-2 py-2 text-center font-normal">សរសេរ</th>
                    <th className="px-2 py-2 text-center border-l border-slate-200 font-normal">ចំនួន</th>
                    <th className="px-2 py-2 text-center font-normal">រង្វាស់</th>
                    <th className="px-2 py-2 text-center font-normal">ធរណី</th>
                    <th className="px-2 py-2 text-center font-normal">ពិជគណិត</th>
                    <th className="px-2 py-2 text-center font-normal">ស្ថិតិ</th>
                    {SCIENCE_SUBJECTS.map((s, i) => (
                      <th key={s.key} className={`px-2 py-2 text-center font-normal whitespace-nowrap ${i === 0 ? 'border-l border-slate-200' : ''}`}>{s.km}</th>
                    ))}
                    {SOCIAL_SUBJECTS.map((s, i) => (
                      <th key={s.key} className={`px-2 py-2 text-center font-normal whitespace-nowrap ${i === 0 ? 'border-l border-slate-200' : ''}`}>{s.km}</th>
                    ))}
                  </tr>
                  </>
                )}
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {monthlyRows.length > 0 ? (
                  monthlyRows.map((st, idx) => {
                    let badgeColors = 'bg-rose-50 text-rose-600 border-rose-200';
                    if (st.result === 'ជាប់') {
                      badgeColors = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                    }

                    let gradeColor = 'text-slate-500';
                    if (st.gradeLetter === 'A') gradeColor = 'text-blue-600 font-bold';
                    else if (st.gradeLetter === 'B') gradeColor = 'text-blue-500 font-bold';
                    else if (st.gradeLetter === 'C') gradeColor = 'text-emerald-600 font-bold';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-1 py-3 text-center font-semibold font-mono text-slate-500 sticky left-0 z-10 bg-white w-9 min-w-9">
                          {idx + 1}
                        </td>
                        <td className="px-1 py-3 text-center font-mono sticky left-9 z-10 bg-white w-14 min-w-14">{(st.studentId || '').trim() ? <span className="text-slate-500">{st.studentId}</span> : (isExtraClass(st.grade) ? <span className="text-slate-300">-</span> : <span className="px-1 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-bold">គ្មាន</span>)}</td>
                        <td className="px-2 py-3 font-semibold text-slate-800 sticky left-[92px] z-10 bg-white shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">{st.name}</td>
                        <td className="px-4 py-3 text-center">{st.gender}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{st.grade}</td>
                        {customSubjects && (
                          <td className="px-4 py-3 text-center">
                            {st.group ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">{st.group}</span> : <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">{st.month}</td>
                        {customSubjects ? (
                          customSubjects.map(sub => {
                            const v = st.englishScores?.[sub.key];
                            return (
                              <td key={sub.key} className="px-2 py-3 text-center font-mono text-slate-500">
                                {inlineEdit
                                  ? <ScoreInput value={v} onCommit={val => commitScore(st, (r, x) => { r.englishScores = { ...(r.englishScores || {}), [sub.key]: x }; }, val)} />
                                  : (v !== null && v !== undefined ? v : '-')}
                              </td>
                            );
                          })
                        ) : (
                          <>
                            <td className="px-2 py-3 text-center font-mono text-slate-600 border-l border-slate-100">{inlineEdit ? <ScoreInput value={st.khmer.listening} onCommit={val => commitScore(st, (r, x) => { r.khmer.listening = x; }, val)} /> : (st.khmer.listening ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.khmer.speaking} onCommit={val => commitScore(st, (r, x) => { r.khmer.speaking = x; }, val)} /> : (st.khmer.speaking ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.khmer.reading} onCommit={val => commitScore(st, (r, x) => { r.khmer.reading = x; }, val)} /> : (st.khmer.reading ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.khmer.writing} onCommit={val => commitScore(st, (r, x) => { r.khmer.writing = x; }, val)} /> : (st.khmer.writing ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600 border-l border-slate-100">{inlineEdit ? <ScoreInput value={st.math.numbers} onCommit={val => commitScore(st, (r, x) => { r.math.numbers = x; }, val)} /> : (st.math.numbers ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.math.measurement} onCommit={val => commitScore(st, (r, x) => { r.math.measurement = x; }, val)} /> : (st.math.measurement ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.math.geometry} onCommit={val => commitScore(st, (r, x) => { r.math.geometry = x; }, val)} /> : (st.math.geometry ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.math.algebra} onCommit={val => commitScore(st, (r, x) => { r.math.algebra = x; }, val)} /> : (st.math.algebra ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-600">{inlineEdit ? <ScoreInput value={st.math.statistics} onCommit={val => commitScore(st, (r, x) => { r.math.statistics = x; }, val)} /> : (st.math.statistics ?? '-')}</td>
                            {SCIENCE_SUBJECTS.map((sub, i) => (
                              <td key={sub.key} className={`px-2 py-3 text-center font-mono text-slate-500 ${i === 0 ? 'border-l border-slate-100' : ''}`}>{inlineEdit ? <ScoreInput value={st.scienceScores?.[sub.key]} onCommit={val => commitScore(st, (r, x) => { r.scienceScores = { ...(r.scienceScores || {}), [sub.key]: x }; }, val)} /> : (st.scienceScores?.[sub.key] ?? '-')}</td>
                            ))}
                            {SOCIAL_SUBJECTS.map((sub, i) => (
                              <td key={sub.key} className={`px-2 py-3 text-center font-mono text-slate-500 ${i === 0 ? 'border-l border-slate-100' : ''}`}>{inlineEdit ? <ScoreInput value={st.socialScores?.[sub.key]} onCommit={val => commitScore(st, (r, x) => { r.socialScores = { ...(r.socialScores || {}), [sub.key]: x }; }, val)} /> : (st.socialScores?.[sub.key] ?? '-')}</td>
                            ))}
                            <td className="px-2 py-3 text-center font-mono text-slate-500 border-l border-slate-100">{inlineEdit ? <ScoreInput value={st.physicalEducation} onCommit={val => commitScore(st, (r, x) => { r.physicalEducation = x; }, val)} /> : (st.physicalEducation ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-500">{inlineEdit ? <ScoreInput value={st.health} onCommit={val => commitScore(st, (r, x) => { r.health = x; }, val)} /> : (st.health ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-500">{inlineEdit ? <ScoreInput value={st.lifeSkills} onCommit={val => commitScore(st, (r, x) => { r.lifeSkills = x; }, val)} /> : (st.lifeSkills ?? '-')}</td>
                            <td className="px-2 py-3 text-center font-mono text-slate-500">{inlineEdit ? <ScoreInput value={st.foreignLanguage} onCommit={val => commitScore(st, (r, x) => { r.foreignLanguage = x; }, val)} /> : (st.foreignLanguage ?? '-')}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                          {st.totalScore !== undefined ? st.totalScore : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 bg-blue-50/10">
                          {st.totalScore !== undefined ? st.overallAvg : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-700">{st.ranking ?? '-'}</td>
                        <td className={`px-4 py-3 text-center ${gradeColor}`}>{st.gradeLetter}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${badgeColors}`}>
                            {st.result}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-[11px] text-slate-500 max-w-[140px]">
                          {inlineEdit
                            ? <RemarkInput value={st.remark} onCommit={text => commitRemark(st, text)} />
                            : <span className="block max-w-[140px] truncate" title={st.remark || ''}>{st.remark || '-'}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!customSubjects && (
                              <button
                                onClick={() => setReportCardStudent(st)}
                                className="p-1 px-1.5 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-all font-medium inline-flex items-center gap-1 text-[10px]"
                                title="ព្រឹត្តបត្រពិន្ទុសិស្ស"
                              >
                                <FileText size={11} /> ព្រឹត្តបត្រ
                              </button>
                            )}
                            <button
                              onClick={() => handleEditClick(st)}
                              className="p-1 px-1.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-all font-medium inline-flex items-center gap-1 text-[10px]"
                              title="កែសម្រួលដាំពិន្ទុ"
                            >
                              <Edit3 size={11} /> កែ
                            </button>
                            {currentUser?.role !== 'teacher' && (
                              <button
                                onClick={() => handleDeleteClick(st.id, st.name)}
                                className="p-1 text-rose-500 border border-transparent rounded hover:border-rose-100 hover:bg-rose-50 transition-all"
                                title="លុបពិន្ទុ"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={customSubjects ? 14 + customSubjects.length : 34} className="px-4 py-12 text-center text-slate-400 font-medium">
                      <FolderLock size={32} className="mx-auto text-slate-300 mb-2" />
                      គ្មានទិន្នន័យពិន្ទុទេ សូមចុច «បញ្ចូលពិន្ទុ» ដើម្បីបន្ថែមពិន្ទុសម្រាប់សិស្សដែលមានស្រាប់ក្នុងថ្នាក់!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeMode === 'semester' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                  <th className="px-3 py-3 text-center">ចំណាត់ថ្នាក់</th>
                  <th className="gb-corner px-3 py-3 sticky left-0 z-10 bg-slate-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
                  <th className="px-3 py-3 text-center">ភេទ</th>
                  <th className="px-3 py-3 text-center">ថ្នាក់សិក្សា</th>
                  {(selectedSemester === '1' ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS).map(m => (
                    <th key={m} className="px-2 py-3 text-center font-normal">{m}</th>
                  ))}
                  <th className="px-3 py-3 text-center bg-indigo-50/30 text-indigo-700">មធ្យមភាគប្រចាំខែ</th>
                  <th className="px-3 py-3 text-center bg-blue-50/30 text-blue-700">ពិន្ទុប្រឡងឆមាស</th>
                  <th className="px-3 py-3 text-center bg-indigo-600 text-white font-extrabold">មធ្យមភាគឆមាស</th>
                  <th className="px-3 py-3 text-center">និទ្ទេស</th>
                  <th className="px-3 py-3 text-center">លទ្ធផល</th>
                  <th className="px-3 py-3 text-right">កំណត់ពិន្ទុឆមាស</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {filteredSemesterStudents.length > 0 ? (
                  filteredSemesterStudents.map((st) => {
                    let badgeColors = 'bg-rose-50 text-rose-600 border-rose-200';
                    if (st.result === 'ជាប់') {
                      badgeColors = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                    }

                    let gradeColor = 'text-slate-500';
                    if (st.gradeLetter === 'A') gradeColor = 'text-blue-600 font-bold';
                    else if (st.gradeLetter === 'B') gradeColor = 'text-blue-500 font-bold';
                    else if (st.gradeLetter === 'C') gradeColor = 'text-emerald-600 font-bold';

                    const monthList = selectedSemester === '1' ? SEMESTER_1_MONTHS : SEMESTER_2_MONTHS;

                    return (
                      <tr key={`${st.name}_${st.grade}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-3.5 text-center font-bold text-slate-550 font-mono">
                          {st.ranking}
                        </td>
                        <td className="px-3 py-3.5 font-bold text-slate-800 sticky left-0 z-10 bg-white shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">{st.name}</td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            st.gender === 'ស្រី' 
                              ? 'bg-rose-50 border border-pink-100 text-rose-600'
                              : 'bg-blue-50 border border-blue-100 text-blue-600'
                          }`}>
                            {st.gender}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center text-slate-400 font-sans font-bold">{st.grade}</td>
                        {monthList.map(m => {
                          const mVal = st.monthAverages[m];
                          return (
                            <td key={m} className={`px-2 py-3.5 text-center font-mono ${mVal ? 'text-slate-700 font-bold' : 'text-slate-300'}`}>
                              {mVal !== undefined && mVal !== null ? mVal.toFixed(1) : '-'}
                            </td>
                          );
                        })}
                        
                        <td className="px-3 py-3.5 text-center font-bold font-mono text-indigo-700 bg-indigo-50/10">
                          {st.overallMonthlyAvg !== null && st.overallMonthlyAvg !== undefined ? st.overallMonthlyAvg.toFixed(2) : '-'}
                        </td>
                        
                        <td className="px-3 py-3.5 text-center font-bold font-mono text-blue-650 bg-blue-50/10 text-blue-600">
                          {st.examScore !== null && st.examScore !== undefined ? st.examScore.toFixed(2) : (
                            <span className="text-[10px] text-slate-400 font-normal italic">គ្មានពិន្ទុ</span>
                          )}
                        </td>
                        
                        <td className="px-3 py-3.5 text-center font-black font-mono text-white bg-indigo-600">
                          {st.semesterAvg !== null && st.semesterAvg !== undefined ? st.semesterAvg.toFixed(2) : '-'}
                        </td>
                        
                        <td className={`px-3 py-3.5 text-center font-semibold font-sans ${gradeColor}`}>{st.gradeLetter}</td>
                        
                        <td className="px-3 py-3.5 text-center">
                          <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${badgeColors}`}>
                            {st.result}
                          </span>
                        </td>
                        
                        <td className="px-3 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                const rec = students.find(s => s.name.trim() === st.name.trim() && s.grade === st.grade);
                                if (rec) { setSemReportPeriod(selectedSemester === '2' ? 2 : 1); setSemReportStudent(rec); }
                              }}
                              className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                              title="ព្រឹត្តបត្រឆមាស"
                            >
                              <FileText size={11} /> ព្រឹត្តបត្រ
                            </button>
                            <button
                              onClick={() => {
                                setExamStudentName(st.name);
                                setExamStudentGrade(st.grade);
                                setExamStudentGender(st.gender);
                                setExamScoreInput(st.examScore !== null ? st.examScore.toString() : '0');
                                setIsExamFormOpen(true);
                              }}
                              className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                            >
                              <Edit3 size={11} /> បញ្ចូល/កែពិន្ទុ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={16} className="px-4 py-12 text-center text-slate-400 font-medium">
                      <FolderLock size={32} className="mx-auto text-slate-300 mb-2" />
                      មិនទាន់មានទិន្នន័យខែសិក្សាណាមួយ សម្រាប់ឆមាសនេះឡើយ។ សូមកត់ត្រាពិន្ទុប្រចាំខែជាមុនសិន!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                  <th className="px-4 py-3.5 text-center">ចំណាត់ថ្នាក់ប្រចាំឆ្នាំ</th>
                  <th className="gb-corner px-4 py-3.5 sticky left-0 z-10 bg-slate-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
                  <th className="px-4 py-3.5 text-center">ភេទ</th>
                  <th className="px-4 py-3.5 text-center">ថ្នាក់សិក្សា</th>
                  <th className="px-4 py-3.5 text-center bg-indigo-50/30 text-indigo-700">មធ្យមភាគ ឆមាសទី ១</th>
                  <th className="px-4 py-3.5 text-center bg-blue-50/30 text-blue-700">មធ្យមភាគ ឆមាសទី ២</th>
                  <th className="px-4 py-3.5 text-center bg-emerald-600 text-white font-extrabold">មធ្យមភាគរួមប្រចាំឆ្នាំ</th>
                  <th className="px-4 py-3.5 text-center">និទ្ទេស</th>
                  <th className="px-4 py-3.5 text-center">លទ្ធផលប្រចាំឆ្នាំ</th>
                  <th className="px-4 py-3.5 text-right">ព្រឹត្តបត្រ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {filteredAnnualStudents.length > 0 ? (
                  filteredAnnualStudents.map((st) => {
                    let badgeColors = 'bg-rose-50 text-rose-600 border-rose-205';
                    if (st.result === 'ជាប់') {
                      badgeColors = 'bg-emerald-50 text-emerald-600 border-emerald-205';
                    }

                    let gradeColor = 'text-slate-500';
                    if (st.gradeLetter === 'A') gradeColor = 'text-blue-600 font-bold';
                    else if (st.gradeLetter === 'B') gradeColor = 'text-blue-500 font-bold';
                    else if (st.gradeLetter === 'C') gradeColor = 'text-emerald-500 font-bold';

                    return (
                      <tr key={`${st.name}_${st.grade}_annual`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 text-center font-bold text-slate-600 font-mono text-xs">
                          {st.ranking === 1 ? '🏆 ' : ''}{st.ranking}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-800 sticky left-0 z-10 bg-white shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">{st.name}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            st.gender === 'ស្រី' 
                              ? 'bg-rose-50 border border-pink-100 text-rose-600'
                              : 'bg-blue-50 border border-blue-100 text-blue-600'
                          }`}>
                            {st.gender}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-slate-400 font-bold">{st.grade}</td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/5">
                          {st.s1Avg !== null && st.s1Avg !== undefined ? st.s1Avg.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-blue-700 bg-blue-50/5">
                          {st.s2Avg !== null && st.s2Avg !== undefined ? st.s2Avg.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-4 text-center font-extrabold font-mono text-white bg-emerald-600">
                          {st.annualAvg !== null && st.annualAvg !== undefined ? st.annualAvg.toFixed(2) : '-'}
                        </td>
                        <td className={`px-4 py-4 text-center font-extrabold font-sans ${gradeColor}`}>{st.gradeLetter}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 border text-xs font-bold rounded-full ${badgeColors}`}>
                            {st.result}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openExtraForm(st.name, st.grade)}
                              className="px-2.5 py-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 hover:text-amber-800 rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                              title="វាយបញ្ចូល បំណិនសម្បទា និងចរិយាសម្បទា"
                            >
                              <Edit3 size={11} /> បំណិន/ចរិយា
                            </button>
                            <button
                              onClick={() => {
                                const rec = students.find(s => s.name.trim() === st.name.trim() && s.grade === st.grade);
                                if (rec) { setSemReportPeriod('year'); setSemReportStudent(rec); }
                              }}
                              className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                              title="ព្រឹត្តបត្រប្រចាំឆ្នាំ"
                            >
                              <FileText size={11} /> ព្រឹត្តបត្រ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400 font-medium font-sans">
                      <FolderLock size={32} className="mx-auto text-slate-300 mb-2" />
                      មិនទាន់មានទិន្នន័យពិន្ទុណាមួយដើម្បីគណនាលទ្ធផលប្រចាំឆ្នាំបានឡើយ។
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Semester Exam Form Modal Dialog */}
      {isExamFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Edit3 size={16} className="text-blue-600" />
                បញ្ចូលពិន្ទុប្រឡងឆមាស៖ {examStudentName}
              </h3>
              <button 
                onClick={() => setIsExamFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExamFormSubmit} noValidate className="space-y-4 text-xs font-semibold">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <p className="text-slate-500 font-semibold">សិស្ស៖ <span className="font-bold text-slate-800">{examStudentName} ({examStudentGender})</span></p>
                <p className="text-slate-500 font-semibold">ថ្នាក់៖ <span className="font-bold text-slate-800">{examStudentGrade}</span></p>
                <p className="text-slate-500 font-semibold">ឆមាស៖ <span className="font-bold text-indigo-750 text-indigo-600">ឆមាសទី {selectedSemester}</span></p>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">ពិន្ទុប្រឡងឆមាសរួម (០ ដល់ ១០)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={examScoreInput}
                  onChange={(e) => setExamScoreInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800 font-mono font-bold"
                />
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed font-normal">
                * ពិន្ទុប្រឡងឆមាសនេះនឹងយកទៅគណនាមធ្យមភាគឆមាសរួបរួមជាមួយមធ្យមភាគប្រចាំខែ ដោយរូបមន្ត៖ <br />
                <span className="font-bold text-indigo-600">មធ្យមភាគឆមាស = (មធ្យមភាគប្រចាំខែ + ពិន្ទុប្រឡង) / ២</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExamFormOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg font-bold"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs whitespace-nowrap"
                >
                  រក្សាទុកពិន្ទុ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportCardStudent && (
        <StudentReportCard
          student={reportCardStudent}
          students={students}
          onClose={() => setReportCardStudent(null)}
        />
      )}

      {semReportStudent && (
        <SemesterReportCard
          student={semReportStudent}
          students={students}
          period={semReportPeriod}
          onClose={() => setSemReportStudent(null)}
        />
      )}

      {honorOpen && (() => { const h = honorData(); return (
        <HonorRoll subtitle={h.subtitle} grade={selectedGrade} entries={h.entries} onClose={() => setHonorOpen(false)} />
      ); })()}

      {/* Annual skills / conduct entry form */}
      {extraForm.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Edit3 size={16} className="text-amber-600" />
                បំណិនសម្បទា និងចរិយាសម្បទា៖ {extraForm.name}
              </h3>
              <button onClick={() => setExtraForm(f => ({ ...f, open: false }))} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveExtraForm(); }} className="space-y-4 text-xs font-semibold">
              <p className="text-[11px] text-slate-400 font-normal leading-relaxed">វាយតម្លៃ ០ ដល់ ១០។ លទ្ធផលប្រចាំឆ្នាំ = ចំណេះវិជ្ជា (៨០%) + បំណិនសម្បទា (១០%) + ចរិយាសម្បទា (១០%)។</p>
              <div>
                <label className="block text-slate-500 mb-1">បំណិនសម្បទា (០ ដល់ ១០)</label>
                <input type="number" min="0" max="10" step="0.01" value={extraForm.skills}
                  onChange={(e) => setExtraForm(f => ({ ...f, skills: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500 text-slate-800 font-mono font-bold" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">ចរិយាសម្បទា (០ ដល់ ១០)</label>
                <input type="number" min="0" max="10" step="0.01" value={extraForm.conduct}
                  onChange={(e) => setExtraForm(f => ({ ...f, conduct: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500 text-slate-800 font-mono font-bold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setExtraForm(f => ({ ...f, open: false }))} className="px-3.5 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg font-bold">បោះបង់</button>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs">រក្សាទុក</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
