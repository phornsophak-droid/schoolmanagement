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
  FileText
} from 'lucide-react';
import { StudentScore, KhmerScore, MathScore, SchoolUser, ENGLISH_SUBJECTS, SCIENCE_SUBJECTS, SOCIAL_SUBJECTS, isEnglishClass, getCustomSubjects } from '../types';
import { calculateStudentFields, clampScore, rankStudents, generateUniqueId } from '../mockData';
import StudentReportCard from './StudentReportCard';
import SemesterReportCard from './SemesterReportCard';
import * as XLSX from 'xlsx';

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
  selectedGrade,
  setSelectedGrade,
  onSaveStudents,
  currentUser,
  grades,
  onAddGrade,
  onDeleteGrade
}: GradebookProps) {
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
  const buildScoreRecord = (name: string, gender: 'ប្រុស' | 'ស្រី', vals: (number | null)[], month: string, existingId?: string): StudentScore => {
    const base = {
      id: existingId || generateUniqueId(),
      name, gender, grade: selectedGrade, month,
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
    const header = ['ឈ្មោះ', 'ភេទ', ...scoreHeaders];
    const names = Array.from(new Set(students.filter(s => s.grade === selectedGrade).map(s => s.name.trim()))).sort((a, b) => a.localeCompare(b, 'km'));
    const body = names.map(n => {
      const rec = students.find(s => s.grade === selectedGrade && s.name.trim() === n);
      return [n, rec?.gender || '', ...scoreHeaders.map(() => '')];
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
        let updated = [...students];
        let count = 0;
        for (let i = 1; i < rows.length; i++) { // row 0 = header
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;
          const name = String(row[0] ?? '').replace(/[﻿​]/g, '').replace(/\s+/g, ' ').trim();
          if (!name || name === 'ឈ្មោះ' || name === 'ឈ្មោះសិស្ស') continue;
          const rawGender = String(row[1] ?? '').trim().toLowerCase();
          const gender: 'ប្រុស' | 'ស្រី' = (rawGender.includes('ស្រី') || rawGender === 'f' || rawGender === 'female') ? 'ស្រី' : 'ប្រុស';
          const vals = scoreHeaders.map((_, idx) => num(row[2 + idx]));
          const existing = updated.find(s => s.name.trim() === name && s.grade === selectedGrade && s.month === targetMonth);
          const rec = buildScoreRecord(name, gender, vals, targetMonth, existing?.id);
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

        {/* Scrollable grid student table listing */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          {activeMode === 'monthly' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                {viewingEnglish ? (
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th className="px-2 py-3 text-center sticky left-0 z-20 bg-slate-50 w-12 min-w-12">ល.រ</th>
                    <th className="px-3 py-3 sticky left-12 z-20 bg-slate-50 shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
                    <th className="px-4 py-3 text-center">អត្តលេខ</th>
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
                    <th className="px-4 py-3 text-center">ផ្សេងៗ</th>
                    <th className="px-4 py-3 text-right">សកម្មភាព</th>
                  </tr>
                ) : (
                  <>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                    <th rowSpan={2} className="px-2 py-3 text-center sticky left-0 z-20 bg-slate-50 w-12 min-w-12">ល.រ</th>
                    <th rowSpan={2} className="px-3 py-3 sticky left-12 z-20 bg-slate-50 shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">គោត្តនាម និងនាម</th>
                    <th rowSpan={2} className="px-3 py-3 text-center">អត្តលេខ</th>
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
                    <th rowSpan={2} className="px-3 py-3 text-center">ផ្សេងៗ</th>
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
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((st, idx) => {
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
                        <td className="px-2 py-3 text-center font-semibold font-mono text-slate-500 sticky left-0 z-10 bg-white w-12 min-w-12">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 sticky left-12 z-10 bg-white shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">{st.name}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-500">{st.studentId || '-'}</td>
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
                              <td key={sub.key} className="px-4 py-3 text-center font-mono text-slate-500">{v !== null && v !== undefined ? v : '-'}</td>
                            );
                          })
                        ) : (
                          <>
                            <td className="px-3 py-3 text-center font-mono text-slate-600 border-l border-slate-100">{st.khmer.listening ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.khmer.speaking ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.khmer.reading ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.khmer.writing ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600 border-l border-slate-100">{st.math.numbers ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.math.measurement ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.math.geometry ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.math.algebra ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-600">{st.math.statistics ?? '-'}</td>
                            {SCIENCE_SUBJECTS.map((sub, i) => (
                              <td key={sub.key} className={`px-3 py-3 text-center font-mono text-slate-500 ${i === 0 ? 'border-l border-slate-100' : ''}`}>{st.scienceScores?.[sub.key] ?? '-'}</td>
                            ))}
                            {SOCIAL_SUBJECTS.map((sub, i) => (
                              <td key={sub.key} className={`px-3 py-3 text-center font-mono text-slate-500 ${i === 0 ? 'border-l border-slate-100' : ''}`}>{st.socialScores?.[sub.key] ?? '-'}</td>
                            ))}
                            <td className="px-3 py-3 text-center font-mono text-slate-500 border-l border-slate-100">{st.physicalEducation ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-500">{st.health ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-500">{st.lifeSkills ?? '-'}</td>
                            <td className="px-3 py-3 text-center font-mono text-slate-500">{st.foreignLanguage ?? '-'}</td>
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
                        <td className="px-3 py-3 text-center text-[11px] text-slate-500 max-w-[120px] truncate" title={st.note || ''}>{st.note || '-'}</td>
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
                  <th className="px-3 py-3 sticky left-0 z-10 bg-slate-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
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
                  <th className="px-4 py-3.5 sticky left-0 z-10 bg-slate-50 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
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
    </div>
  );
}
