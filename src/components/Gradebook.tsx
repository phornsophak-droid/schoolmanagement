/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  HelpCircle 
} from 'lucide-react';
import { StudentScore, KhmerScore, MathScore, SchoolUser } from '../types';
import { calculateStudentFields, clampScore, rankStudents, generateUniqueId } from '../mockData';

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
  const gradesList = grades || DEFAULT_GRADES_LIST;
  const [newClassName, setNewClassName] = useState('');
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  // Lock grade selection to teacher's grade if teacher role
  useEffect(() => {
    if (currentUser && currentUser.role === 'teacher') {
      setSelectedGrade(currentUser.grade);
    }
  }, [currentUser, setSelectedGrade]);

  // UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [science, setScience] = useState('');
  const [socialStudies, setSocialStudies] = useState('');
  const [physicalEducation, setPhysicalEducation] = useState('');
  const [health, setHealth] = useState('');
  const [lifeSkills, setLifeSkills] = useState('');
  const [foreignLanguage, setForeignLanguage] = useState('');

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
      return matchMonth && matchGrade;
    });

    let list = [...monthlyRecords];

    // 2. Search query filter
    if (searchTerm.trim() !== '') {
      list = list.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 3. Compute rankings inside the filtered group
    return rankStudents(list);
  }, [students, selectedMonth, selectedGrade, searchTerm]);

  // Semester aggregation values
  const semesterStudents = useMemo(() => {
    const uniqueStudentsMap = new Map<string, { name: string; gender: 'ប្រុស' | 'ស្រី'; grade: string }>();
    students.forEach(s => {
      if (selectedGrade === 'ទាំងអស់' || s.grade === selectedGrade) {
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
  }, [students, selectedGrade, selectedSemester]);

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
      if (selectedGrade === 'ទាំងអស់' || s.grade === selectedGrade) {
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
  }, [students, selectedGrade]);

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
    setFormGrade(currentUser && currentUser.role === 'teacher' ? currentUser.grade : (selectedGrade === 'ទាំងអស់' ? (gradesList[0] || 'ថ្នាក់ទី៦') : selectedGrade));
    
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
    setScience('');
    setSocialStudies('');
    setPhysicalEducation('');
    setHealth('');
    setLifeSkills('');
    setForeignLanguage('');
    
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

    setScience(student.science !== null ? student.science.toString() : '');
    setSocialStudies(student.socialStudies !== null ? student.socialStudies.toString() : '');
    setPhysicalEducation(student.physicalEducation !== null ? student.physicalEducation.toString() : '');
    setHealth(student.health !== null ? student.health.toString() : '');
    setLifeSkills(student.lifeSkills !== null ? student.lifeSkills.toString() : '');
    setForeignLanguage(student.foreignLanguage !== null ? student.foreignLanguage.toString() : '');

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
    setScience(record?.science != null ? record.science.toString() : '');
    setSocialStudies(record?.socialStudies != null ? record.socialStudies.toString() : '');
    setPhysicalEducation(record?.physicalEducation != null ? record.physicalEducation.toString() : '');
    setHealth(record?.health != null ? record.health.toString() : '');
    setLifeSkills(record?.lifeSkills != null ? record.lifeSkills.toString() : '');
    setForeignLanguage(record?.foreignLanguage != null ? record.foreignLanguage.toString() : '');
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

    const payload: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'> = {
      id: targetId,
      name: formName.trim(),
      gender: formGender,
      grade: formGrade,
      month: formMonth,
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
      science: science === '' ? null : clampScore(parseFloat(science) || 0),
      socialStudies: socialStudies === '' ? null : clampScore(parseFloat(socialStudies) || 0),
      physicalEducation: physicalEducation === '' ? null : clampScore(parseFloat(physicalEducation) || 0),
      health: health === '' ? null : clampScore(parseFloat(health) || 0),
      lifeSkills: lifeSkills === '' ? null : clampScore(parseFloat(lifeSkills) || 0),
      foreignLanguage: foreignLanguage === '' ? null : clampScore(parseFloat(foreignLanguage) || 0)
    };

    const calculatedPayload = calculateStudentFields(payload);

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

            {/* Column 2: Key split subjects with sub-scores */}
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

            {/* Column 3: Secondary Subjects */}
            <div className="space-y-4 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <h4 className="font-medium text-slate-700 text-sm border-b border-slate-100 pb-2">៣. មុខវិជ្ជាបន្ថែមទាំង ៦</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                <div>
                  <label className="block text-slate-500 mb-1">វិទ្យាសាស្ត្រ</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={science}
                    onChange={(e) => setScience(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1">សិក្សាសង្គម</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={socialStudies}
                    onChange={(e) => setSocialStudies(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-center"
                  />
                </div>

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
              សរុប {activeMode === 'monthly' ? filteredStudents.length : activeMode === 'semester' ? filteredSemesterStudents.length : filteredAnnualStudents.length} នាក់
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
                <span className="px-3 py-1 text-[11px] bg-blue-50 text-blue-700/90 font-bold border-l border-slate-200 font-sans">
                  ថ្នាក់៖ {currentUser.grade} 🔒
                </span>
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
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500">
                  <th className="px-2 py-3 text-center sticky left-0 z-20 bg-slate-50 w-12 min-w-12">ល.រ</th>
                  <th className="px-3 py-3 sticky left-12 z-20 bg-slate-50 shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">ឈ្មោះសិស្ស</th>
                  <th className="px-4 py-3 text-center">ភេទ</th>
                  <th className="px-4 py-3 text-center">ថ្នាក់សិក្សា</th>
                  <th className="px-4 py-3 text-center">ខែ</th>
                  <th className="px-4 py-3 text-center">ភាសាខ្មែរ (មធ្យម)</th>
                  <th className="px-4 py-3 text-center">គណិត (មធ្យម)</th>
                  <th className="px-4 py-3 text-center">វិទ្យាសាស្ត្រ</th>
                  <th className="px-4 py-3 text-center">សិក្សាសង្គម</th>
                  <th className="px-4 py-3 text-center">អប់រំកាយកីឡា</th>
                  <th className="px-4 py-3 text-center">សុខភាព</th>
                  <th className="px-4 py-3 text-center">បំណិនជីវិត</th>
                  <th className="px-4 py-3 text-center">ភាសាបរទេស</th>
                  <th className="px-4 py-3 text-center text-blue-600 bg-blue-50/50 rounded-tl-md">ពិន្ទុសរុប</th>
                  <th className="px-4 py-3 text-center text-blue-600 bg-blue-50/50 rounded-tr-md">មធ្យមភាគរួម</th>
                  <th className="px-4 py-3 text-center">និទ្ទេស</th>
                  <th className="px-4 py-3 text-center">លទ្ធផល</th>
                  <th className="px-4 py-3 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((st) => {
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
                          {st.ranking ? `${st.ranking}` : '-'}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 sticky left-12 z-10 bg-white shadow-[6px_0_8px_-4px_rgba(0,0,0,0.12)] whitespace-nowrap">{st.name}</td>
                        <td className="px-4 py-3 text-center">{st.gender}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{st.grade}</td>
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">{st.month}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          {[st.khmer.listening, st.khmer.writing, st.khmer.reading, st.khmer.speaking].some(s => s !== null && s !== undefined) ? st.khmerAvg : '-'} 
                          <span className="text-[9px] text-slate-400 block font-normal">
                            ({st.khmer.listening !== null && st.khmer.listening !== undefined ? st.khmer.listening : '-'}/{st.khmer.writing !== null && st.khmer.writing !== undefined ? st.khmer.writing : '-'}/{st.khmer.reading !== null && st.khmer.reading !== undefined ? st.khmer.reading : '-'}/{st.khmer.speaking !== null && st.khmer.speaking !== undefined ? st.khmer.speaking : '-'})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {[st.math.numbers, st.math.measurement, st.math.geometry, st.math.algebra, st.math.statistics].some(s => s !== null && s !== undefined) ? st.mathAvg : '-'}
                          <span className="text-[9px] text-slate-400 block font-normal">
                            ({st.math.numbers !== null && st.math.numbers !== undefined ? st.math.numbers : '-'}/{st.math.measurement !== null && st.math.measurement !== undefined ? st.math.measurement : '-'}/{st.math.geometry !== null && st.math.geometry !== undefined ? st.math.geometry : '-'}/{st.math.algebra !== null && st.math.algebra !== undefined ? st.math.algebra : '-'}/{st.math.statistics !== null && st.math.statistics !== undefined ? st.math.statistics : '-'})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.science !== null && st.science !== undefined ? st.science : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.socialStudies !== null && st.socialStudies !== undefined ? st.socialStudies : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.physicalEducation !== null && st.physicalEducation !== undefined ? st.physicalEducation : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.health !== null && st.health !== undefined ? st.health : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.lifeSkills !== null && st.lifeSkills !== undefined ? st.lifeSkills : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono text-slate-500">{st.foreignLanguage !== null && st.foreignLanguage !== undefined ? st.foreignLanguage : '-'}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                          {st.totalScore !== undefined ? st.totalScore : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 bg-blue-50/10">
                          {st.totalScore !== undefined ? st.overallAvg : '-'}
                        </td>
                        <td className={`px-4 py-3 text-center ${gradeColor}`}>{st.gradeLetter}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${badgeColors}`}>
                            {st.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                    <td colSpan={17} className="px-4 py-12 text-center text-slate-400 font-medium">
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
                  <th className="px-3 py-3">ឈ្មោះសិស្ស</th>
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
                        <td className="px-3 py-3.5 font-bold text-slate-800">{st.name}</td>
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
                  <th className="px-4 py-3.5">ឈ្មោះសិស្ស</th>
                  <th className="px-4 py-3.5 text-center">ភេទ</th>
                  <th className="px-4 py-3.5 text-center">ថ្នាក់សិក្សា</th>
                  <th className="px-4 py-3.5 text-center bg-indigo-50/30 text-indigo-700">មធ្យមភាគ ឆមាសទី ១</th>
                  <th className="px-4 py-3.5 text-center bg-blue-50/30 text-blue-700">មធ្យមភាគ ឆមាសទី ២</th>
                  <th className="px-4 py-3.5 text-center bg-emerald-600 text-white font-extrabold">មធ្យមភាគរួមប្រចាំឆ្នាំ</th>
                  <th className="px-4 py-3.5 text-center">និទ្ទេស</th>
                  <th className="px-4 py-3.5 text-center">លទ្ធផលប្រចាំឆ្នាំ</th>
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
                        <td className="px-4 py-4 font-bold text-slate-800">{st.name}</td>
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
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400 font-medium font-sans">
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
    </div>
  );
}
