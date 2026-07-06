/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Search, 
  BookOpen, 
  Calendar, 
  Trash2, 
  Eye, 
  Plus, 
  FolderOpen,
  FolderLock,
  Sparkles,
  ChevronRight,
  Send
} from 'lucide-react';
import { SchoolReport, StudentScore, SchoolUser, getCustomSubjects } from '../types';
import { motion } from 'motion/react';
import ReportWizard from './ReportWizard';
import ClassReport, { getReportTemplate } from './ClassReport';
import ClassRankingReport from './ClassRankingReport';
import SchoolSummary from './SchoolSummary';
import { semesterAvgOf, annualAcademicRaw, annualFinalOf } from '../utils/scoring';
import { loadSubmissions, submissionDate, ReportSubmission } from '../utils/reportSubmit';
import { renderElementToPngDataUrl } from '../utils/exportPdf';

interface ReportsHubProps {
  reports: SchoolReport[];
  onSaveReport: (report: SchoolReport) => void;
  onDeleteReport: (id: string) => void;
  onViewReport: (report: SchoolReport) => void;
  students: StudentScore[];
  grades: string[];
  currentUser?: SchoolUser | null;
  onCancel: () => void;
  // When true, render ONLY the academic-results report (no work-report tab) — used
  // to embed this report as a tab inside the Gradebook / scores section.
  embeddedAcademic?: boolean;
}

const SEMESTER_1_MONTHS = ['ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា'];
const SEMESTER_2_MONTHS = ['ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

const KHMER_MONTHS_LIST = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

// Class-category split: "extra" (after-hours skill classes) vs "general" (មត្តេយ្យ–ទី៦).
// 'គ្លេស' (the English-language root) catches spelling variants like អង់គ្លេស / អ់គ្លេស.
const EXTRA_CLASS_KEYWORDS = ['GRADE','គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
// The subject keyword an after-hours class belongs to (e.g. "អង់គ្លេស"), used to
// group all of one teacher's class sections (3A, 3B...) under the same subject.
const getExtraSubjectKey = (grade: string) => EXTRA_CLASS_KEYWORDS.find(k => (grade || '').includes(k)) || '';

// Convert a 0–10 average into the official A–F grade band (same thresholds as
// the per-student designation). Core-subject averages are shown as these letters.
const scoreToLetter = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return '-';
  if (score >= 9.0) return 'A';
  if (score >= 8.0) return 'B';
  if (score >= 7.0) return 'C';
  if (score >= 6.0) return 'D';
  if (score >= 5.0) return 'E';
  return 'F';
};

export default function ReportsHub({
  reports,
  onSaveReport,
  onDeleteReport,
  onViewReport,
  students,
  grades,
  currentUser,
  onCancel,
  embeddedAcademic = false
}: ReportsHubProps) {
  const gradesList = grades || [
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
  
  // Tab states: 'monthly_progress' (សរសេររបាយការណ៍) or 'academic' (របាយការណ៍លទ្ធផលសិក្សាសិស្ស)
  // The academic-results report moved to the Gradebook, so this view is single-mode:
  // 'academic' when embedded there, otherwise 'monthly_progress' (the work report).
  const [activeTab] = useState<'monthly_progress' | 'academic'>(embeddedAcademic ? 'academic' : 'monthly_progress');
  const [showSchoolSummary, setShowSchoolSummary] = useState(false);
  
  // Report wizard activation state within the tab
  const [isWritingReport, setIsWritingReport] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<SchoolReport | null>(null);

  // Search filter for saved progress reports
  const [progressSearchGrade, setProgressSearchGrade] = useState('ទាំងអស់');
  const [progressSearchMonth, setProgressSearchMonth] = useState('ទាំងអស់');

  // Teacher accounts are locked to their own class; principals/admins see all.
  const isTeacher = currentUser?.role === 'teacher';
  const teacherGrade = currentUser?.grade || '';
  const teacherLocked = isTeacher && teacherGrade !== '' && teacherGrade !== 'ទាំងអស់';
  const isExtraTeacher = teacherLocked && isExtraClass(teacherGrade);
  const isGeneralTeacher = teacherLocked && !isExtraTeacher;

  // When set, the academic tab shows the fillable English/after-hours report template.
  const [showEnglishTemplate, setShowEnglishTemplate] = useState(false);
  const [showRankingTable, setShowRankingTable] = useState(false);
  const [reviewing, setReviewing] = useState<ReportSubmission | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  // Send the OPEN (reviewing) work report to the TEACHERS' Telegram group as a
  // tidy IMAGE (rendered from the on-screen report) via the CCC bot.
  const sendSubmissionToTeachers = async (s: ReportSubmission) => {
    let secret = '';
    try { secret = localStorage.getItem('telegram_announce_secret') || ''; } catch { /* ignore */ }
    if (!secret) {
      secret = (window.prompt('ពាក្យសម្ងាត់ផ្ញើ (ANNOUNCE_SECRET)៖') || '').trim();
      if (!secret) return;
    }
    const el = document.getElementById('submitted-report-view');
    if (!el) { alert('សូមបើករបាយការណ៍ (មើល) ជាមុនសិន។'); return; }
    setSendingKey(s.key);
    try {
      const image = await renderElementToPngDataUrl(el);
      const d = submissionDate(s.submittedAt);
      const caption = `${s.title} — ${s.grade} · ${s.period} · គ្រូ ${s.teacher || ''} · បញ្ជូន ${d.day} ${d.month} ${d.year}`;
      const res = await fetch('/api/telegram-announce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'teacher', image, caption, secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        try { localStorage.setItem('telegram_announce_secret', secret); } catch { /* ignore */ }
        alert('បានផ្ញើរបាយការណ៍ (រូបភាព) ទៅគ្រុបគ្រូ Telegram ✓');
      } else {
        alert(data.error === 'unauthorized' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។'
          : data.error === 'bot token / group id not configured' ? 'គ្រុបគ្រូមិនទាន់តំឡើងក្នុង Vercel (TELEGRAM_TEACHER_GROUP_CHAT_ID)។'
          : 'ផ្ញើមិនបាន៖ ' + (data.error || res.status));
      }
    } catch (e: any) { alert('ផ្ញើមិនបាន — ' + (e?.message || 'សូមពិនិត្យអ៊ីនធឺណិត។')); }
    finally { setSendingKey(null); }
  };

  // Academic Report filters state
  const [scopeType, setScopeType] = useState<'class' | 'combined'>('class');
  const [selectedGrade, setSelectedGrade] = useState<string>(
    teacherLocked ? teacherGrade : (gradesList[0] || 'ថ្នាក់ទី៦')
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ប្រចាំឆ្នាំ'); // month, exam, or annual ('ប្រចាំឆ្នាំ')
  const [academicSearchName, setAcademicSearchName] = useState('');

  // Class category (general / extra) — scopes every grade dropdown & report list.
  // A locked teacher's category follows the class they teach and cannot be changed.
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>(
    teacherLocked && isExtraClass(teacherGrade) ? 'extra' : 'general'
  );
  const inCat = (grade: string) => (classCategory === 'extra' ? isExtraClass(grade) : !isExtraClass(grade));
  const categoryGrades = gradesList.filter(g => inCat(g));

  // Grade dropdown options, restricted for locked teacher accounts:
  //  - general teacher → only their own class
  //  - extra teacher   → only their subject's sections (e.g. all English groups)
  //  - principal/admin → every class in the selected category
  const gradeOptions = isExtraTeacher
    ? categoryGrades.filter(g => g.includes(getExtraSubjectKey(teacherGrade)))
    : isGeneralTeacher
      ? [teacherGrade]
      : categoryGrades;

  // Clamp helper
  const clampScore = (score: number) => {
    return Math.max(0, Math.min(10, parseFloat(score.toFixed(2))));
  };

  // Switch to writing custom reports
  const handleStartNewReport = () => {
    setReportToEdit(null);
    setIsWritingReport(true);
  };

  const handleEditReport = (report: SchoolReport) => {
    setReportToEdit(report);
    setIsWritingReport(true);
  };

  const handleSaveReportHub = (report: SchoolReport) => {
    onSaveReport(report);
    setIsWritingReport(false);
    setReportToEdit(null);
  };

  // Filter progress reports
  const filteredProgressReports = useMemo(() => {
    return reports.filter(r => {
      if (!inCat(r.generalInfo.grade)) return false;
      const matchGrade = progressSearchGrade === 'ទាំងអស់' ? true : r.generalInfo.grade === progressSearchGrade;
      const matchMonth = progressSearchMonth === 'ទាំងអស់' ? true : r.generalInfo.month === progressSearchMonth;
      return matchGrade && matchMonth;
    });
  }, [reports, progressSearchGrade, progressSearchMonth, classCategory]);

  // ==========================================
  // ACADEMIC REPORTS ENGINE
  // ==========================================

  // After-hours classes (English, Health) score on their own criteria stored in
  // englishScores, not the general subjects. When a single such class is selected,
  // the report uses those custom subjects and a simple average instead of the
  // semester/exam model that only applies to general academic classes.
  const reportCustomSubjects = useMemo(() => {
    const targetGrade = (!teacherLocked && scopeType === 'combined') ? 'ទាំងអស់' : selectedGrade;
    if (targetGrade === 'ទាំងអស់') return null;
    return getCustomSubjects(targetGrade);
  }, [scopeType, selectedGrade, teacherLocked]);

  const processedAcademicRoster = useMemo(() => {
    // Locked teachers never get the combined (all-class) view — always their own class.
    const targetGrade = (!teacherLocked && scopeType === 'combined') ? 'ទាំងអស់' : selectedGrade;

    // Filter students by grade if needed
    const baseRosterStudents = students.filter(s => {
      if (targetGrade === 'ទាំងអស់') return inCat(s.grade);
      return s.grade === targetGrade;
    });

    if (baseRosterStudents.length === 0) return [];

    // Get unique students under this filter context
    const uniqueStudentsMap = new Map<string, { name: string; gender: 'ប្រុស' | 'ស្រី'; grade: string }>();
    baseRosterStudents.forEach(s => {
      const key = `${s.name.trim()}_${s.grade}`;
      if (!uniqueStudentsMap.has(key)) {
        uniqueStudentsMap.set(key, { name: s.name.trim(), gender: s.gender, grade: s.grade });
      }
    });

    const uniqueStudentsList = Array.from(uniqueStudentsMap.values());

    // 1. ANNUAL PERFORMANCE CALCULATION
    if (selectedPeriod === 'ប្រចាំឆ្នាំ') {
      const roster = uniqueStudentsList.map(student => {
        // After-hours custom class (English/Health): no semester/exam model — the
        // annual figure is simply the mean of the entered criteria across records.
        const customSubs = getCustomSubjects(student.grade);
        if (customSubs) {
          const recs = students.filter(s => s.name.trim() === student.name && s.grade === student.grade);
          const overallVals = recs.map(r => r.overallAvg).filter((v): v is number => v !== null && v !== undefined);
          const annualAvg = overallVals.length > 0 ? clampScore(overallVals.reduce((a, b) => a + b, 0) / overallVals.length) : null;
          const customSubjects: Record<string, number | null> = {};
          customSubs.forEach(sub => {
            const vs = recs.map(r => r.englishScores?.[sub.key]).filter((v): v is number => v !== null && v !== undefined);
            customSubjects[sub.key] = vs.length > 0 ? clampScore(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
          });
          let gradeLetter = '-';
          let result = '-';
          if (annualAvg !== null) {
            gradeLetter = annualAvg >= 9.0 ? 'A' : annualAvg >= 8.0 ? 'B' : annualAvg >= 7.0 ? 'C' : annualAvg >= 6.0 ? 'D' : annualAvg >= 5.0 ? 'E' : 'F';
            result = annualAvg >= 5.0 ? 'ជាប់' : 'ធ្លាក់';
          }
          return {
            id: `${student.name}_${student.grade}_annual`,
            name: student.name,
            gender: student.gender,
            grade: student.grade,
            overallAvg: annualAvg,
            gradeLetter,
            result,
            s1Avg: null as number | null,
            s2Avg: null as number | null,
            subjects: { khmer: null, math: null, science: null, socialStudies: null, physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null },
            customSubjects,
          };
        }

        // Official semester & annual averages — shared with the report cards
        // (semester = (exam + monthly)/2; annual = 80% academic + 10% បំណិន + 10% ចរិយា).
        const recs = students.filter(s => s.name.trim() === student.name && s.grade === student.grade);
        const s1Avg = semesterAvgOf(recs, 1);
        const s2Avg = semesterAvgOf(recs, 2);
        const annualAvg = annualFinalOf(recs, student.grade, student.name);

        // Grade Designation
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

        // Subject averages across the year
        const getSubjAnnAvg = (subj: string) => {
          const records = students.filter(s => s.name.trim() === student.name && s.grade === student.grade);
          if (records.length === 0) return null;
          let sum = 0;
          let count = 0;
          records.forEach(r => {
            if (subj === 'khmer') {
              const hasVal = [r.khmer.listening, r.khmer.writing, r.khmer.reading, r.khmer.speaking].some(s => s !== null && s !== undefined);
              if (hasVal) { sum += r.khmerAvg; count++; }
            }
            else if (subj === 'math') {
              const hasVal = [r.math.numbers, r.math.measurement, r.math.geometry, r.math.algebra, r.math.statistics].some(s => s !== null && s !== undefined);
              if (hasVal) { sum += r.mathAvg; count++; }
            }
            else if (subj === 'science' && r.science !== null && r.science !== undefined) { sum += r.science; count++; }
            else if (subj === 'socialStudies' && r.socialStudies !== null && r.socialStudies !== undefined) { sum += r.socialStudies; count++; }
            else if (subj === 'physicalEducation' && r.physicalEducation !== null && r.physicalEducation !== undefined) { sum += r.physicalEducation; count++; }
            else if (subj === 'health' && r.health !== null && r.health !== undefined) { sum += r.health; count++; }
            else if (subj === 'lifeSkills' && r.lifeSkills !== null && r.lifeSkills !== undefined) { sum += r.lifeSkills; count++; }
            else if (subj === 'foreignLanguage' && r.foreignLanguage !== null && r.foreignLanguage !== undefined) { sum += r.foreignLanguage; count++; }
          });
          return count > 0 ? clampScore(sum / count) : null;
        };

        return {
          id: `${student.name}_${student.grade}_annual`,
          name: student.name,
          gender: student.gender,
          grade: student.grade,
          overallAvg: annualAvg,
          gradeLetter,
          result,
          s1Avg,
          s2Avg,
          subjects: {
            khmer: getSubjAnnAvg('khmer'),
            math: getSubjAnnAvg('math'),
            science: getSubjAnnAvg('science'),
            socialStudies: getSubjAnnAvg('socialStudies'),
            physicalEducation: getSubjAnnAvg('physicalEducation'),
            health: getSubjAnnAvg('health'),
            lifeSkills: getSubjAnnAvg('lifeSkills'),
            foreignLanguage: getSubjAnnAvg('foreignLanguage'),
          },
          customSubjects: null as Record<string, number | null> | null,
        };
      });

      // Sort by score
      const sorted = roster.sort((a, b) => b.overallAvg - a.overallAvg);
      return sorted.map((st, i) => ({ ...st, ranking: i + 1 }));

    } else {
      // 2. PERIOD-SPECIFIC PERFORMANCE (Month or Semester Exam)
      const periodStudents = students.filter(s => {
        const matchGrade = targetGrade === 'All' || targetGrade === 'ទាំងអស់' ? inCat(s.grade) : s.grade === targetGrade;
        return matchGrade && s.month === selectedPeriod;
      });

      // For a semester-exam period, general classes are ranked by the combined
      // semester average ((exam + monthly)/2) to match the report card.
      const semNum = selectedPeriod === 'ប្រឡងឆមាសទី១' ? 1 : selectedPeriod === 'ប្រឡងឆមាសទី២' ? 2 : null;

      const roster = periodStudents.map(student => {
        // For after-hours classes, expose the custom criteria for this month's record.
        const customSubs = getCustomSubjects(student.grade);
        let customSubjects: Record<string, number | null> | null = null;
        if (customSubs) {
          customSubjects = {};
          customSubs.forEach(sub => { customSubjects![sub.key] = student.englishScores?.[sub.key] ?? null; });
        }

        let overallAvg = student.overallAvg;
        let gradeLetter = student.gradeLetter;
        let result = student.result;
        if (semNum && !customSubs) {
          const recs = students.filter(s => s.name.trim() === student.name.trim() && s.grade === student.grade);
          const semAvg = semesterAvgOf(recs, semNum);
          if (semAvg !== null) {
            overallAvg = semAvg;
            gradeLetter = semAvg >= 9 ? 'A' : semAvg >= 8 ? 'B' : semAvg >= 7 ? 'C' : semAvg >= 6 ? 'D' : semAvg >= 5 ? 'E' : 'F';
            result = semAvg >= 5 ? 'ជាប់' : 'ធ្លាក់';
          }
        }

        return {
          id: student.id,
          name: student.name,
          gender: student.gender,
          grade: student.grade,
          overallAvg,
          gradeLetter,
          result,
          s1Avg: 0 as number | null,
          s2Avg: 0 as number | null,
          subjects: {
            khmer: student.khmerAvg,
            math: student.mathAvg,
            science: student.science,
            socialStudies: student.socialStudies,
            physicalEducation: student.physicalEducation,
            health: student.health,
            lifeSkills: student.lifeSkills,
            foreignLanguage: student.foreignLanguage
          },
          customSubjects,
        };
      });

      const sorted = roster.sort((a, b) => b.overallAvg - a.overallAvg);
      return sorted.map((st, i) => ({ ...st, ranking: i + 1 }));
    }
  }, [students, scopeType, selectedGrade, selectedPeriod, classCategory, teacherLocked]);

  // Filter roster by student search input
  const filteredAcademicRoster = useMemo(() => {
    if (!academicSearchName.trim()) return processedAcademicRoster;
    return processedAcademicRoster.filter(s =>
      s.name.toLowerCase().includes(academicSearchName.toLowerCase())
    );
  }, [processedAcademicRoster, academicSearchName]);

  // Combined statistics
  const reportStats = useMemo(() => {
    const total = processedAcademicRoster.length;
    if (total === 0) return { total: 0, female: 0, male: 0, pass: 0, fail: 0, scored: 0, avg: 0, dist: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 } };

    const female = processedAcademicRoster.filter(s => s.gender === 'ស្រី').length;
    const male = total - female;
    // Pass/fail only count students who actually have a result; students with no
    // scores yet ('-') are excluded so the rates aren't skewed to 100% fail.
    const pass = processedAcademicRoster.filter(s => s.result === 'ជាប់').length;
    const fail = processedAcademicRoster.filter(s => s.result === 'ធ្លាក់').length;
    const scoredResults = pass + fail;

    let sumScore = 0;
    let scored = 0;
    processedAcademicRoster.forEach(s => {
      if (s.overallAvg !== null && s.overallAvg !== undefined) { sumScore += s.overallAvg; scored++; }
    });
    const avg = scored > 0 ? parseFloat((sumScore / scored).toFixed(2)) : 0;

    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    processedAcademicRoster.forEach(s => {
      if (s.gradeLetter === 'A') dist.A++;
      else if (s.gradeLetter === 'B') dist.B++;
      else if (s.gradeLetter === 'C') dist.C++;
      else if (s.gradeLetter === 'D') dist.D++;
      else if (s.gradeLetter === 'E') dist.E++;
      else if (s.gradeLetter === 'F') dist.F++; // '-' (no scores) is not counted as a fail
    });

    return { total, female, male, pass, fail, scored: scoredResults, avg, dist };
  }, [processedAcademicRoster]);

  // Subject averages + per-subject A–F headcount for report presentation.
  const subjectAverages = useMemo(() => {
    const total = processedAcademicRoster.length;
    if (total === 0) return [];

    // After-hours classes report on their own criteria (English/Health); general
    // classes report on the standard subjects. The values are read from the
    // matching map on each roster row (customSubjects vs subjects).
    const CUSTOM_COLORS = [
      'from-blue-500 to-indigo-500', 'from-cyan-500 to-blue-500', 'from-amber-500 to-orange-500',
      'from-indigo-500 to-purple-500', 'from-teal-500 to-emerald-500', 'from-pink-500 to-rose-500',
      'from-emerald-500 to-emerald-600', 'from-violet-500 to-purple-650',
    ];
    const GENERAL_DEFS: { key: string; name: string; color: string }[] = [
      { key: 'khmer', name: 'ភាសាខ្មែរ', color: 'from-blue-500 to-indigo-500' },
      { key: 'math', name: 'គណិតវិទ្យា', color: 'from-cyan-500 to-blue-500' },
      { key: 'science', name: 'វិទ្យាសាស្ត្រ', color: 'from-amber-500 to-orange-500' },
      { key: 'socialStudies', name: 'សិក្សាសង្គម', color: 'from-indigo-500 to-purple-500' },
      { key: 'physicalEducation', name: 'លំហាត់កីឡា', color: 'from-teal-500 to-emerald-500' },
      { key: 'health', name: 'អប់រំសុខភាព', color: 'from-pink-500 to-rose-500' },
      { key: 'lifeSkills', name: 'បំណិនជីវិត', color: 'from-emerald-500 to-emerald-600' },
      { key: 'foreignLanguage', name: 'ភាសាបរទេស', color: 'from-violet-500 to-purple-650' }
    ];
    const useCustom = !!reportCustomSubjects;
    const SUBJECT_DEFS = useCustom
      ? reportCustomSubjects!.map((s, i) => ({ key: s.key, name: s.km, color: CUSTOM_COLORS[i % CUSTOM_COLORS.length] }))
      : GENERAL_DEFS;

    return SUBJECT_DEFS.map(def => {
      let sum = 0;
      let count = 0;
      const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
      processedAcademicRoster.forEach(s => {
        const source = useCustom ? (s.customSubjects || {}) : s.subjects;
        const v = (source as any)[def.key];
        if (v !== null && v !== undefined) {
          sum += v;
          count++;
          const letter = scoreToLetter(v);      // each student's A–F band for this subject
          if (letter !== '-') dist[letter]++;
        }
      });
      const avg = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
      // avg = mean of sub-subjects; letter = the band of that mean; dist = headcount per band.
      return { name: def.name, avg, letter: count > 0 ? scoreToLetter(avg) : '-', color: def.color, dist, count };
    });
  }, [processedAcademicRoster, reportCustomSubjects]);

  // Top students podium list
  const topStudents = useMemo(() => {
    return processedAcademicRoster.slice(0, 3);
  }, [processedAcademicRoster]);

  // Handle printing
  const handlePrintAcademicReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Toolbar Title (Hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">មជ្ឈមណ្ឌលរបាយការណ៍សាលារៀន (School Reports)</h2>
            <p className="text-xs text-slate-500 mt-1">ចងក្រងរបាយការណ៍សកម្មភាព និងលទ្ធផលសិក្សារួមសាលា</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSchoolSummary(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
          >
            <Sparkles size={14} /> សង្ខេបលទ្ធផល (AI)
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/60 transition-colors"
          >
            ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង
          </button>
        </div>
      </div>

      {showSchoolSummary && (
        <SchoolSummary students={students} scopeGrade={teacherLocked ? teacherGrade : undefined} onClose={() => setShowSchoolSummary(false)} />
      )}

      {/* Tab toggle removed — the academic-results report now lives in the Gradebook
          (embeddedAcademic). The Reports page shows only the monthly work report. */}

      {/* Class-category selector (general / extra) — scopes all report data (Hidden in print).
          Locked for teacher accounts, who only ever see their own class category. */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-xl mx-auto w-full print:hidden">
        <button
          disabled={teacherLocked}
          onClick={() => {
            setClassCategory('general');
            setSelectedGrade(gradesList.find(g => !isExtraClass(g)) || '');
            setProgressSearchGrade('ទាំងអស់');
            setShowEnglishTemplate(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${classCategory === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          📘 ថ្នាក់ចំណេះទូទៅ
        </button>
        <button
          disabled={teacherLocked}
          onClick={() => {
            setClassCategory('extra');
            setSelectedGrade(gradesList.find(g => isExtraClass(g)) || '');
            setProgressSearchGrade('ទាំងអស់');
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          🎨 ថ្នាក់ក្រៅម៉ោង
        </button>
        {teacherLocked && (
          <span className="hidden sm:flex items-center gap-1 px-2 text-[10px] font-bold text-slate-400 whitespace-nowrap">
            <FolderLock size={12} /> ចាក់សោតាមថ្នាក់គ្រូ
          </span>
        )}
      </div>

      {/* ========================================================== */}
      {/* TAB 1: MONTHLY PROGRESS REPORT WIZARD */}
      {/* ========================================================== */}
      {activeTab === 'monthly_progress' && (
        <div className="space-y-6">
          {isWritingReport ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">សរសេររបាយការណ៍ការងារថ្នាក់រៀន</span>
                <button
                  onClick={() => {
                    setIsWritingReport(false);
                    setReportToEdit(null);
                  }}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 text-[11px] font-bold transition-colors"
                >
                  បោះបង់សរសេរ ✕
                </button>
              </div>
              <ReportWizard
                onSaveReport={handleSaveReportHub}
                onCancel={() => {
                  setIsWritingReport(false);
                  setReportToEdit(null);
                }}
                students={students}
                reportToEdit={reportToEdit}
                grades={grades}
                currentUser={currentUser}
              />
            </motion.div>
          ) : (
            <div className="space-y-6 print:hidden">
              {/* Write New Action Banner */}
              <div className="p-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-white rounded-2xl border border-blue-100/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-500 animate-pulse" />
                    ចាប់ផ្តើមសរសេររបាយការណ៍ការងារប្រចាំខែថ្មី
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xl">
                    ដំណើរការដោយប្រព័ន្ធ Wizard ៦ជំហាន ដើម្បីទាញយកទិន្នន័យស្ថិតិសិស្សានុសិស្ស វាយតម្លៃមុខវិជ្ជា ចងក្រងសកម្មភាពថ្នាក់រៀន កសាងផែនការ បញ្ហាប្រឈម និងសកម្មភាពដោះស្រាយបានយ៉ាងលឿន។
                  </p>
                </div>

                <button
                  id="btn_hub_write_new"
                  onClick={handleStartNewReport}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                >
                  <Plus size={15} />
                  សរសេររបាយការណ៍ថ្មី
                </button>
              </div>

              {/* Saved Reports Database List */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">បញ្ជីរបាយការណ៍ការងារកន្លងមក</h3>
                    <p className="text-xs text-slate-400 mt-1">ចម្រោះ និងគ្រប់គ្រងរបាយការណ៍ការងាររៀបចំដោយគ្រូជំនាញ</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold font-mono">ថ្នាក់៖</span>
                      <select
                        value={progressSearchGrade}
                        onChange={(e) => setProgressSearchGrade(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium cursor-pointer"
                      >
                        <option value="ទាំងអស់">ទាំងអស់</option>
                        {categoryGrades.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold font-mono">ខែ៖</span>
                      <select
                        value={progressSearchMonth}
                        onChange={(e) => setProgressSearchMonth(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-medium cursor-pointer"
                      >
                        <option value="ទាំងអស់">ទាំងអស់</option>
                        {KHMER_MONTHS_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {filteredProgressReports.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProgressReports.map((report) => (
                      <div 
                        key={report.id}
                        className="p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-50/10 hover:border-blue-100/60 transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                              <Calendar size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                របាយការណ៍ {report.generalInfo.month} - {report.generalInfo.grade}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">
                                គ្រូ៖ {report.generalInfo.teacherName} <span className="mx-1">|</span> ឆ្នាំសិក្សា៖ {report.generalInfo.academicYear}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                              សកម្ម ({report.studentStats.currentTotal} នាក់)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            កាលបរិច្ឆេទបង្កើត៖ {new Date(report.createdAt).toLocaleDateString('kh-KH')}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onViewReport(report)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-3xs"
                            >
                              <Eye size={12} />
                              ពិនិត្យមើល
                            </button>

                            <button
                              onClick={() => handleEditReport(report)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-3xs"
                            >
                              កែសម្រួល
                            </button>

                            {currentUser?.role !== 'teacher' && (
                              <button
                                onClick={() => onDeleteReport(report.id)}
                                className="p-1.5 bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-all"
                                title="លុបរបាយការណ៍"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <FolderOpen size={40} className="text-slate-200 mb-2" />
                    <p className="text-xs">មិនទាន់មានរបាយការណ៍ការងារណាមួយត្រូវតាមលក្ខខណ្ឌចម្រោះគ្លឹបទេ។</p>
                    <button
                      onClick={handleStartNewReport}
                      className="mt-3 px-3.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-105"
                    >
                      បង្កើតរបាយការណ៍ឥឡូវនេះ
                    </button>
                  </div>
                )}
              </div>

              {/* Submitted reports (cloud) — for the principal to review */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600" /> របាយការណ៍ដែលបានបញ្ជូន
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">របាយការណ៍ការងារដែលគ្រូបានបញ្ជូនមក (រក្សាទុកក្នុង Cloud)</p>
                </div>
                {(() => {
                  const subs = loadSubmissions().filter(s => (teacherLocked ? gradeOptions.includes(s.grade) : true));
                  if (subs.length === 0) return <p className="text-xs text-slate-400 py-4 text-center">មិនទាន់មានរបាយការណ៍ដែលបានបញ្ជូនទេ។</p>;
                  return (
                    <div className="divide-y divide-slate-100">
                      {subs.map(s => {
                        const d = submissionDate(s.submittedAt);
                        return (
                          <div key={s.key} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{s.grade} • {s.period} • {s.teacher || 'គ្រូ'} • បានបញ្ជូន {d.day} {d.month} {d.year}</p>
                            </div>
                            <button
                              onClick={() => { try { localStorage.setItem(s.key, JSON.stringify(s.data)); } catch { /* ignore */ } setReviewing(s); }}
                              className="px-3 py-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 shrink-0 flex items-center gap-1"
                            >
                              <Eye size={12} /> មើល
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: STUDENT ACADEMIC PERFORMANCE REPORTS (CLASS & COMBINED) */}
      {/* ========================================================== */}
      {activeTab === 'academic' && (
        <div className="space-y-6">

          {showEnglishTemplate && getReportTemplate(selectedGrade) ? (
            <ClassReport
              template={getReportTemplate(selectedGrade)!}
              students={students}
              grade={selectedGrade}
              period={selectedPeriod}
              teacherName={currentUser?.name}
              onClose={() => setShowEnglishTemplate(false)}
            />
          ) : (
          <>
          {/* PRINT-ONLY HEADER BANNER */}
          <div className="hidden print:block text-center space-y-1.5 relative select-none pb-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-md tracking-wide">ព្រះរាជាណាចក្រកម្ពុជា</h3>
            <h4 className="font-bold text-slate-700 text-xs tracking-widest">ជាតិ សាសនា ព្រះមហាក្សត្រ</h4>
            <div className="text-xs text-slate-400 leading-none mt-1">~ ~ ~ ~ ~ ~ ~ ~ ~</div>
            <div className="absolute left-0 top-0 text-left text-[10px] space-y-1 font-semibold text-slate-600">
              <p>ក្រសួងអប់រំ យុវជន និងកីឡា</p>
              <p>សាលាសហគមន៍ច្បារច្រុះ</p>
            </div>
            
            <div className="pt-6 text-center space-y-1">
              <h2 className="text-md font-extrabold text-slate-900 uppercase">
                របាយការណ៍លទ្ធផលសិក្សាសិស្សានុសិស្ស
              </h2>
              <p className="text-xs text-slate-500">
                ប្រភេទ៖ <span className="font-bold text-slate-800">{scopeType === 'combined' ? 'របាយការណ៍រួមគ្រប់ថ្នាក់' : `ថ្នាក់រៀន៖ ${selectedGrade}`}</span> | 
                រយៈពេលវាយតម្លៃ៖ <span className="font-bold text-blue-700">{selectedPeriod}</span>
              </p>
            </div>
          </div>

          {/* FILTER CONTROLS BAR (Hidden in print) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:hidden space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">កំណត់ប៉ារ៉ាម៉ែត្រទាញយករបាយការណ៍</h3>
                <p className="text-xs text-slate-400 mt-0.5">ជ្រើសរើសប្រភេទថ្នាក់ និងរយៈពេលដើម្បីចងក្រងស្ថិតិភ្លាមៗ</p>
              </div>

              <div className="flex items-center gap-2">
                {classCategory === 'extra' && getReportTemplate(selectedGrade) && (
                  <button
                    onClick={() => setShowEnglishTemplate(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/10 transition-colors"
                  >
                    <FileText size={13} />
                    គម្រូរបាយការណ៍
                  </button>
                )}
                <button
                  onClick={() => setShowRankingTable(true)}
                  disabled={processedAcademicRoster.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition-colors"
                >
                  <Award size={13} />
                  តារាងចំណាត់ថ្នាក់សរុប
                </button>
                <button
                  onClick={handlePrintAcademicReport}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-slate-900/10 transition-colors"
                >
                  <Printer size={13} />
                  បោះពុម្ពជាសន្លឹករបាយការណ៍ (Print/PDF)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              {/* Filter 1: Scope Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">ប្រភេទរបាយការណ៍</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setScopeType('class')}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      scopeType === 'class' ? 'bg-white text-slate-700 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    តាមថ្នាក់នីមួយៗ
                  </button>
                  <button
                    disabled={teacherLocked}
                    onClick={() => {
                      setScopeType('combined');
                    }}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      scopeType === 'combined' && !teacherLocked ? 'bg-white text-slate-700 shadow-3xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    របាយការណ៍រួម (គ្រប់ថ្នាក់)
                  </button>
                </div>
              </div>

              {/* Filter 2: Select Grade (conditional) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">ថ្នាក់សិក្សា</label>
                {scopeType === 'class' || teacherLocked ? (
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    disabled={isGeneralTeacher}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer focus:border-blue-500 outline-none transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <div className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-450 font-bold flex items-center gap-1">
                    🔓 គ្រប់ថ្នាក់ (ទាំងអស់)
                  </div>
                )}
              </div>

              {/* Filter 3: Evaluation Period */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">រយៈពេលវាយតម្លៃ</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer focus:border-blue-500 outline-none transition-colors"
                >
                  <option value="ប្រចាំឆ្នាំ">🏆 លទ្ធផលប្រចាំឆ្នាំ (Annual Score)</option>
                  <optgroup label="ប្រឡងតាមឆមាស">
                    <option value="ប្រឡងឆមាសទី១">ឆមាសទី ១ (Exam S1)</option>
                    <option value="ប្រឡងឆមាសទី២">ឆមាសទី ២ (Exam S2)</option>
                  </optgroup>
                  <optgroup label="ពិន្ទុតាមខែ">
                    {KHMER_MONTHS_LIST.map(m => (
                      <option key={m} value={m}>ខែ {m}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Filter 4: In-Report Student Search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 font-mono uppercase">ស្វែងរកឈ្មោះសិស្ស</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ស្វែងរកក្នុងតារាង..."
                    value={academicSearchName}
                    onChange={(e) => setAcademicSearchName(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* REPORT CANVAS CONTENT */}
          {processedAcademicRoster.length > 0 ? (
            <div className="space-y-6">
              
              {/* A. KPI CARDS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold font-serif leading-none">សិស្សសរុប</p>
                    <h4 className="text-base font-bold text-slate-800 font-mono mt-1">{reportStats.total} នាក់</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">ស្រី {reportStats.female} នាក់ ({((reportStats.female / reportStats.total) * 100).toFixed(0)}%)</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-55 font-bold bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold font-serif leading-none">អត្រាប្រឡងជាប់</p>
                    <h4 className="text-base font-bold text-emerald-600 font-mono mt-1">
                      {reportStats.scored > 0 ? ((reportStats.pass / reportStats.scored) * 100).toFixed(0) : 0}%
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">សរុបជាប់ {reportStats.pass} នាក់</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-500 rounded-lg">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold font-serif leading-none">អត្រាធ្លាក់</p>
                    <h4 className="text-base font-bold text-rose-500 font-mono mt-1">
                      {reportStats.scored > 0 ? ((reportStats.fail / reportStats.scored) * 100).toFixed(0) : 0}%
                    </h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">សរុបធ្លាក់ {reportStats.fail} នាក់</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                    <Award size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold font-serif leading-none">មធ្យមភាគរួម</p>
                    <h4 className="text-base font-bold text-amber-600 font-mono mt-1">{reportStats.avg} /១០</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">រង្វាយតម្លៃទូទៅ</p>
                  </div>
                </div>
              </div>

              {/* B. ANALYTICAL BREAKDOWNS (GRADE DIST & SUBJECT STATS) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Grade Distribution Chart */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 font-serif uppercase tracking-wider">
                      <TrendingUp size={14} className="text-indigo-500" />
                      បំរែបំរួល និងការបែកចែកនិទ្ទេស (Grade Dist)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">រចនាសម្ព័ន្ធនិទ្ទេសសិស្សានុសិស្សសរុបក្នុងរបាយការណ៍</p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(g => {
                      const count = (reportStats.dist as any)[g] || 0;
                      const pct = reportStats.total > 0 ? (count / reportStats.total) * 100 : 0;
                      
                      let barColor = 'bg-slate-300';
                      let textColor = 'text-slate-500';
                      if (g === 'A') { barColor = 'bg-blue-600'; textColor = 'text-blue-600'; }
                      else if (g === 'B') { barColor = 'bg-indigo-500'; textColor = 'text-indigo-500'; }
                      else if (g === 'C') { barColor = 'bg-emerald-500'; textColor = 'text-emerald-500'; }
                      else if (g === 'D') { barColor = 'bg-teal-500'; textColor = 'text-teal-500'; }
                      else if (g === 'E') { barColor = 'bg-amber-500'; textColor = 'text-amber-500'; }
                      else { barColor = 'bg-rose-500'; textColor = 'text-rose-500'; }

                      return (
                        <div key={g} className="flex items-center gap-3">
                          <span className={`w-4 font-bold text-xs ${textColor} text-center`}>{g}</span>
                          <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${barColor} rounded-full transition-all duration-500`} 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[10px] font-bold font-mono text-slate-600">
                            {count} នាក់ ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Subject Scores Performance Breakdown */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 font-serif uppercase tracking-wider">
                      <BookOpen size={14} className="text-blue-500" />
                      មធ្យមភាគពិន្ទុវិភាគតាមមុខវិជ្ជា (Subject Breakdown)
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">មធ្យមភាគវាយតម្លៃលើខឿនមុខវិជ្ជាស្នូលនិងកម្រិតទូទៅ</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {subjectAverages.map(subj => {
                      // Solid segment colour per A–F band (one stacked bar per subject).
                      const segColor: Record<string, string> = {
                        A: 'bg-blue-500',
                        B: 'bg-indigo-500',
                        C: 'bg-emerald-500',
                        D: 'bg-teal-500',
                        E: 'bg-amber-500',
                        F: 'bg-rose-500',
                      };
                      const totalScored = subj.count || 0;
                      return (
                        <div key={subj.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span>{subj.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">សរុប {totalScored} នាក់</span>
                          </div>
                          {/* Stacked bar: each A–F band is a segment sized by its headcount. */}
                          <div className="flex w-full h-6 rounded-lg overflow-hidden bg-slate-100">
                            {totalScored === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-300">
                                គ្មានទិន្នន័យ
                              </div>
                            ) : (
                              (['A', 'B', 'C', 'D', 'E', 'F'] as const).map(band => {
                                const n = subj.dist[band] || 0;
                                if (n === 0) return null;
                                const pct = (n / totalScored) * 100;
                                const pctLabel = Math.round(pct);
                                return (
                                  <div
                                    key={band}
                                    title={`និទ្ទេស ${band}: ${n} នាក់ (${pctLabel}%)`}
                                    style={{ width: `${pct}%` }}
                                    className={`flex items-center justify-center ${segColor[band]} text-white text-[9px] font-bold font-mono border-r border-white/40 last:border-r-0 overflow-hidden whitespace-nowrap`}
                                  >
                                    {band} {n}{pct >= 14 ? ` (${pctLabel}%)` : ''}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* C. STUDENT PODIUM EXCELLENCE (Hidden in print if needed, but looks amazing!) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:hidden">
                <h4 className="font-semibold text-slate-800 text-xs font-serif uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  🏆 សិស្សានុសិស្សដែលមានលទ្ធផលសិក្សាលេចធ្លោជាងគេ (Top Student Honors)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topStudents.map((st, i) => {
                    let containerStyle = 'border-slate-100 bg-slate-50/50';
                    let badgeIcon = '🥈';
                    if (i === 0) {
                      containerStyle = 'border-amber-100 bg-amber-50/20';
                      badgeIcon = '🏆 លេខ ១';
                    } else if (i === 1) {
                      badgeIcon = '🥈 លេខ ២';
                    } else {
                      badgeIcon = '🥉 លេខ ៣';
                    }

                    return (
                      <div 
                        key={st.id} 
                        className={`p-4 border rounded-xl flex items-center justify-between gap-4 ${containerStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-xl">{st.ranking === 1 ? '🥇' : st.ranking === 2 ? '🥈' : '🥉'}</div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-800">{st.name}</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              ថ្នាក់៖ <span className="font-bold">{st.grade}</span> | ភេទ៖ <span className="font-bold">{st.gender}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full block text-center mb-1">
                            {badgeIcon}
                          </span>
                          <span className="text-xs font-extrabold font-mono text-blue-600">
                            {st.overallAvg !== null && st.overallAvg !== undefined ? st.overallAvg.toFixed(2) : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* D. REPORT ROSTER TABLE */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">តារាងឈ្មោះ និងពិន្ទុលទ្ធផលសិក្សាផ្លូវការ</h3>
                    <p className="text-xs text-slate-400 mt-1">ទិន្នន័យត្រូវបានវាយតម្លៃដោយស្វ័យប្រវត្តិ និងរៀបចំតាមចំណាត់ថ្នាក់</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 font-mono text-xs text-slate-600 rounded-full">
                    សរុប {filteredAcademicRoster.length} នាក់
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider font-bold text-slate-500 font-serif">
                        <th className="px-4 py-3.5 text-center w-16">ចំណាត់ថ្នាក់</th>
                        <th className="px-4 py-3.5">ឈ្មោះសិស្ស</th>
                        <th className="px-4 py-3.5 text-center w-16">ភេទ</th>
                        <th className="px-4 py-3.5 text-center">ថ្នាក់សិក្សា</th>
                        {selectedPeriod === 'ប្រចាំឆ្នាំ' && (
                          <>
                            <th className="px-4 py-3.5 text-center text-slate-500 font-mono bg-indigo-50/20">មធ្យមភាគ ឆ.១</th>
                            <th className="px-4 py-3.5 text-center text-slate-500 font-mono bg-blue-50/20">មធ្យមភាគ ឆ.២</th>
                          </>
                        )}
                        <th className="px-4 py-3.5 text-center bg-blue-50/20 text-blue-700">ពិន្ទុសរុប</th>
                        <th className="px-4 py-3.5 text-center bg-blue-50/30 text-blue-800">មធ្យមភាគសរុប</th>
                        <th className="px-4 py-3.5 text-center">និទ្ទេស</th>
                        <th className="px-4 py-3.5 text-center">លទ្ធផល</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-serif">
                      {filteredAcademicRoster.length > 0 ? (
                        filteredAcademicRoster.map((st) => {
                          const isGold = st.ranking === 1;
                          const isSilver = st.ranking === 2;
                          const isBronze = st.ranking === 3;

                          let rankBadge = `${st.ranking}`;
                          if (isGold) rankBadge = '🥇';
                          else if (isSilver) rankBadge = '🥈';
                          else if (isBronze) rankBadge = '🥉';

                          let badgeColor = 'bg-rose-50 text-rose-600 border-rose-201';
                          if (st.result === 'ជាប់') {
                            badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-201';
                          }

                          let gradeColor = 'text-slate-500';
                          if (st.gradeLetter === 'A') gradeColor = 'text-blue-600 font-bold';
                          else if (st.gradeLetter === 'B') gradeColor = 'text-blue-500 font-bold';
                          else if (st.gradeLetter === 'C') gradeColor = 'text-emerald-500 font-bold';

                          return (
                            <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-4 text-center font-bold font-mono text-slate-600">
                                {rankBadge}
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
                              {selectedPeriod === 'ប្រចាំឆ្នាំ' && (
                                <>
                                  <td className="px-4 py-4 text-center font-mono text-slate-500 font-bold bg-indigo-50/5">
                                    {st.s1Avg !== null && st.s1Avg !== undefined ? st.s1Avg.toFixed(2) : '-'}
                                  </td>
                                  <td className="px-4 py-4 text-center font-mono text-slate-500 font-bold bg-blue-50/5">
                                    {st.s2Avg !== null && st.s2Avg !== undefined ? st.s2Avg.toFixed(2) : '-'}
                                  </td>
                                </>
                              )}
                              <td className="px-4 py-4 text-center font-bold font-mono text-blue-600 bg-blue-50/5">
                                {st.totalScore !== undefined ? st.totalScore : '-'}
                              </td>
                              <td className="px-4 py-4 text-center font-extrabold font-mono text-blue-700 bg-blue-50/10">
                                {st.overallAvg !== null && st.overallAvg !== undefined ? st.overallAvg.toFixed(2) : '-'}
                              </td>
                              <td className={`px-4 py-4 text-center font-extrabold font-sans ${gradeColor}`}>{st.gradeLetter}</td>
                              <td className="px-4 py-4 text-center">
                                <span className={`px-2.5 py-1 border text-[10px] font-bold rounded-full ${badgeColor}`}>
                                  {st.result}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={selectedPeriod === 'ប្រចាំឆ្នាំ' ? 10 : 8} className="px-4 py-12 text-center text-slate-400 font-medium">
                            <FolderLock size={32} className="mx-auto text-slate-300 mb-2" />
                            មិនមានឈ្មោះសិស្សត្រូវនឹងលក្ខខណ្ឌចម្រោះស្វែងរកនោះឡើយ។
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* E. PRINT-ONLY COMPONENT SIGNATURE BLOCK (Perfect Document Alignment) */}
              <div className="hidden print:grid grid-cols-2 gap-8 pt-12 text-xs font-semibold select-none">
                <div className="text-center space-y-16">
                  <p className="text-slate-500">បានឃើញ និងឯកភាព</p>
                  <p className="font-serif">នាយកសាលា</p>
                  <div className="pt-2 text-slate-300 font-serif">...........................................</div>
                </div>

                <div className="text-center space-y-16">
                  <p className="text-slate-500">ថ្ងៃទី...... ខែ...... ឆ្នាំ២០២...</p>
                  <p className="font-serif">គ្រូបន្ទុកថ្នាក់រៀបចំ</p>
                  <div className="pt-2 text-slate-300 font-serif">...........................................</div>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <FolderLock size={40} className="text-slate-300 mb-2" />
              <p className="text-sm font-medium">មិនមានទិន្នន័យពិន្ទុណាមួយដើម្បីចងក្រងរបាយការណ៍លទ្ធផលសិក្សាសិស្សក្នុងថ្នាក់/រយៈពេលនេះបានឡើយ។</p>
              <p className="text-xs text-slate-400 mt-1">សូមទៅកាន់ «តារាងពិន្ទុសិស្ស» ដើម្បីបញ្ចូលពិន្ទុ និងមធ្យមភាគសិស្សជាមុនសិន។</p>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {showRankingTable && (
        <ClassRankingReport
          roster={processedAcademicRoster}
          grade={(!teacherLocked && scopeType === 'combined') ? 'ទាំងអស់' : selectedGrade}
          period={selectedPeriod}
          onClose={() => setShowRankingTable(false)}
        />
      )}

      {reviewing && getReportTemplate(reviewing.grade) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => sendSubmissionToTeachers(reviewing)}
                disabled={sendingKey === reviewing.key}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Send size={13} /> {sendingKey === reviewing.key ? 'កំពុងផ្ញើ…' : 'ផ្ញើទៅគ្រុបគ្រូ (រូបភាព)'}
              </button>
            </div>
            <div id="submitted-report-view">
              <ClassReport
                template={getReportTemplate(reviewing.grade)!}
                students={students}
                grade={reviewing.grade}
                period={reviewing.period}
                teacherName={reviewing.teacher}
                onClose={() => setReviewing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
