/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Users, 
  Award, 
  AlertCircle, 
  Calendar, 
  FolderOpen, 
  Plus, 
  Trash2, 
  Eye, 
  GraduationCap,
  ClipboardCheck,
  ArrowRight,
  UserCheck,
  CheckCircle,
  Clock
} from 'lucide-react';
import { SchoolReport, StudentScore, SchoolUser } from '../types';
import schoolLogo from '../assets/logo.png';
import { useT } from '../i18n';

// Class-category split: "extra" (after-hours skill classes) vs "general" (មត្តេយ្យ–ទី៦).
const EXTRA_CLASS_KEYWORDS = ['គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));

interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
  session?: 'morning' | 'afternoon';
  presentCount: number;
  lateCount?: number;
  permissionCount: number;
  absentCount: number;
  studentStates: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' };
}

interface DashboardProps {
  reports: SchoolReport[];
  students: StudentScore[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedGrade: string;
  setSelectedGrade: (grade: string) => void;
  onViewReport: (report: SchoolReport) => void;
  onDeleteReport: (id: string) => void;
  onCreateReportClick: () => void;
  onOpenGradebookClick: () => void;
  onOpenAttendanceClick?: () => void;
  grades?: string[];
  currentUser?: SchoolUser | null;
}

export const KHMER_MONTHS = [
  'ទាំងអស់',
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

export const KHMER_GRADES = [
  'ទាំងអស់',
  'ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣', 'ថ្នាក់ទី៤', 'ថ្នាក់ទី៥', 'ថ្នាក់ទី៦'
];

export default function Dashboard({
  reports,
  students,
  selectedMonth,
  setSelectedMonth,
  selectedGrade,
  setSelectedGrade,
  onViewReport,
  onDeleteReport,
  onCreateReportClick,
  onOpenGradebookClick,
  onOpenAttendanceClick,
  grades,
  currentUser
}: DashboardProps) {

  const { t } = useT();
  // Selected class category (general = មត្តេយ្យ–ទី៦; extra = after-hours skill classes).
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>('general');
  const inCat = (grade: string) => (classCategory === 'extra' ? isExtraClass(grade) : !isExtraClass(grade));

  // Teacher accounts are hard-locked to their own class — they must never see or
  // select another class. Principals/admins are unrestricted.
  const isTeacher = currentUser?.role === 'teacher';
  const teacherGrade = isTeacher ? (currentUser?.grade || '') : '';
  const teacherLocked = isTeacher && teacherGrade !== '' && teacherGrade !== 'ទាំងអស់';
  useEffect(() => {
    if (teacherLocked) {
      setClassCategory(isExtraClass(teacherGrade) ? 'extra' : 'general');
      setSelectedGrade(teacherGrade);
    }
  }, [teacherLocked, teacherGrade]);

  // Morning/afternoon shift — only meaningful for general classes (extra classes
  // are single-session and always pass the filter). Reports stay separate per shift.
  const [selectedDashSession, setSelectedDashSession] = useState<'morning' | 'afternoon' | 'all'>(() => new Date().getHours() < 12 ? 'morning' : 'afternoon');
  const recSession = (r: AttendanceRecord): 'morning' | 'afternoon' => {
    if (r.session === 'morning' || r.session === 'afternoon') return r.session;
    const p = String(r.id || '').split('-');
    return p[1] === 'afternoon' ? 'afternoon' : 'morning'; // legacy / no-session → morning
  };
  // 'all' = both shifts combined for the whole day.
  const inSession = (r: AttendanceRecord) => classCategory !== 'general' || selectedDashSession === 'all' ? true : recSession(r) === selectedDashSession;
  // Restrict attendance records to the selected class (teachers see only their own).
  const inGradeScope = (grade: string) => selectedGrade === 'ទាំងអស់' || selectedGrade === 'boldsymbol' || grade === selectedGrade;
  // Khmer shift label, shown only for general classes (extra classes are single-session).
  const sessionKm = classCategory !== 'general' ? ''
    : selectedDashSession === 'morning' ? 'វេនព្រឹក'
    : selectedDashSession === 'afternoon' ? 'វេនរសៀល'
    : 'ប្រចាំថ្ងៃ (ទាំងពីរវេន)';

  const gradesList = useMemo(() => {
    const all = grades || ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣', 'ថ្នាក់ទី៤', 'ថ្នាក់ទី៥', 'ថ្នាក់ទី៦'];
    return ['ទាំងអស់', ...all.filter(g => inCat(g))];
  }, [grades, classCategory]);

  // Load Saved Attendance Records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [reasonChartMode, setReasonChartMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  // Attendance summary period + the picked value for each (null = follow the latest).
  const [reportPeriod, setReportPeriod] = useState<'day' | 'month' | 'year'>('day');
  const [selectedAttDate, setSelectedAttDate] = useState<string | null>(null);   // YYYY-MM-DD
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null); // daily-absent & reasons date picker
  const [selectedAttMonth, setSelectedAttMonth] = useState<string | null>(null); // YYYY-MM
  const [selectedAttYear, setSelectedAttYear] = useState<string | null>(null);   // YYYY

  useEffect(() => {
    const saved = localStorage.getItem('school_daily_attendance');
    if (saved) {
      try {
        setAttendanceRecords(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load attendance records in Dashboard', e);
      }
    }
  }, []);

  const filteredAttendance = useMemo(() => {
    return attendanceRecords.filter(rec => {
      if (!inCat(rec.grade)) return false;
      if (!inSession(rec)) return false;
      const matchGrade = selectedGrade === 'boldsymbol' || selectedGrade === 'ទាំងអស់' ? true : rec.grade === selectedGrade;
      return matchGrade;
    });
  }, [attendanceRecords, selectedGrade, classCategory, selectedDashSession]);

  // Recorded days / months / years for the current class filter, newest first.
  const availableDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(new Set<string>(filteredAttendance.map(r => r.date)))
      .filter(d => d && d <= today)   // never offer a future-dated record as "latest"
      .sort((a, b) => b.localeCompare(a));
  }, [filteredAttendance]);
  const availableMonths = useMemo(() => {
    return Array.from(new Set<string>(filteredAttendance.map(r => r.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
  }, [filteredAttendance]);
  const availableYears = useMemo(() => {
    return Array.from(new Set<string>(filteredAttendance.map(r => r.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  }, [filteredAttendance]);

  // The picked value per period, falling back to the latest recorded one.
  const effectiveAttDate = selectedAttDate || availableDates[0] || null;
  const effectiveAttMonth = selectedAttMonth || availableMonths[0] || null;
  const effectiveAttYear = selectedAttYear || availableYears[0] || null;

  // A human label + the matcher for the period currently being viewed.
  const periodLabel = reportPeriod === 'day' ? (effectiveAttDate || '—')
    : reportPeriod === 'month' ? (effectiveAttMonth || '—')
    : (effectiveAttYear || '—');

  // Whether the viewed period is the latest recorded one (controls the reset chip).
  const isLatestPeriod = reportPeriod === 'day' ? (!selectedAttDate || selectedAttDate === availableDates[0])
    : reportPeriod === 'month' ? (!selectedAttMonth || selectedAttMonth === availableMonths[0])
    : (!selectedAttYear || selectedAttYear === availableYears[0]);
  const resetPeriodPick = () => { setSelectedAttDate(null); setSelectedAttMonth(null); setSelectedAttYear(null); };

  // Reset picks back to the latest when the class filter changes, so the summary
  // doesn't get stuck on a period that belongs to a different class category.
  useEffect(() => {
    setSelectedAttDate(null);
    setSelectedAttMonth(null);
    setSelectedAttYear(null);
  }, [classCategory, selectedGrade]);

  // Records inside the selected period (day / month / year).
  const periodRecords = useMemo(() => {
    if (reportPeriod === 'day') return effectiveAttDate ? filteredAttendance.filter(r => r.date === effectiveAttDate) : [];
    if (reportPeriod === 'month') return effectiveAttMonth ? filteredAttendance.filter(r => r.date.slice(0, 7) === effectiveAttMonth) : [];
    return effectiveAttYear ? filteredAttendance.filter(r => r.date.slice(0, 4) === effectiveAttYear) : [];
  }, [filteredAttendance, reportPeriod, effectiveAttDate, effectiveAttMonth, effectiveAttYear]);

  // Records for the period pass through un-merged here; the per-student shift merge
  // (so a student absent in both shifts counts once) happens in derivedAbsence below,
  // which is the source of truth for permission/absent. Present is based on the
  // 459-student roster (present = enrolled − excused − absent).
  const periodRecordsMerged = periodRecords;

  // Enrolled (unique) students per general class — the roster used so that
  // unrecorded students/classes count as present (present = enrolled − absent).
  const enrolledByClass = useMemo(() => {
    const sets = new Map<string, Set<string>>();
    students.forEach(s => {
      if (isExtraClass(s.grade)) return;
      const set = sets.get(s.grade) || new Set<string>();
      set.add(s.name.trim());
      sets.set(s.grade, set);
    });
    const out = new Map<string, number>();
    sets.forEach((set, g) => out.set(g, set.size));
    return out;
  }, [students]);

  // General classes in the current scope (all, or just the selected one).
  const scopeClasses = useMemo(() => {
    const all = Array.from(enrolledByClass.keys()) as string[];
    const sel = (selectedGrade === 'ទាំងអស់' || selectedGrade === 'boldsymbol') ? all : all.filter(g => g === selectedGrade);
    return sel.sort((a, b) => a.localeCompare(b, 'km'));
  }, [enrolledByClass, selectedGrade]);
  const scopeEnrolled = useMemo(() => scopeClasses.reduce((sum, g) => sum + (enrolledByClass.get(g) || 0), 0), [scopeClasses, enrolledByClass]);

  // Permission / absent per class & total, derived from studentStates (the source of
  // truth) so the summary always matches the detailed absent list. The stored
  // presentCount/absentCount aggregate fields can be stale (e.g. after an import),
  // so we never trust them here. Morning + afternoon shifts are merged per student
  // per day — best status wins (present > late > permission > absent) — exactly like
  // the daily-absent panel below.
  const derivedAbsence = useMemo(() => {
    const rank: Record<string, number> = { present: 0, late: 1, permission: 2, absent: 3 };
    const perKey = new Map<string, { status: string; grade: string }>(); // key: date|studentId
    periodRecordsMerged.forEach(rec => {
      const ss = rec.studentStates as Record<string, string> | undefined;
      if (!ss) return;
      Object.entries(ss).forEach(([sId, status]) => {
        if (sId.endsWith('_reason') || rank[status] === undefined) return;
        const key = `${rec.date}|${sId}`;
        const prev = perKey.get(key);
        if (!prev || rank[status] < rank[prev.status]) perKey.set(key, { status, grade: rec.grade });
      });
    });
    const byGrade = new Map<string, { permission: number; absent: number }>();
    let permission = 0, absent = 0;
    perKey.forEach(({ status, grade }) => {
      const g = byGrade.get(grade) || { permission: 0, absent: 0 };
      if (status === 'permission') { g.permission++; permission++; }
      else if (status === 'absent') { g.absent++; absent++; }
      byGrade.set(grade, g);
    });
    return { byGrade, permission, absent };
  }, [periodRecordsMerged]);

  // Distinct recorded ("operated") days within the period.
  const periodDaysCount = useMemo(() => new Set(periodRecordsMerged.map(r => r.date)).size, [periodRecordsMerged]);

  // Per-class roll-up for the period. For GENERAL classes every scoped class is
  // listed and unrecorded ones count fully present (present = enrolled × operated
  // days − recorded absences). EXTRA classes keep the recorded headcount only.
  const periodByClass = useMemo(() => {
    const operatedDays = periodDaysCount;
    const rec = new Map<string, { present: number; late: number; permission: number; absent: number; days: Set<string> }>();
    periodRecordsMerged.forEach(r => {
      const g = rec.get(r.grade) || { present: 0, late: 0, permission: 0, absent: 0, days: new Set<string>() };
      g.present += r.presentCount;
      g.late += r.lateCount || 0;
      g.permission += r.permissionCount;
      g.absent += r.absentCount;
      g.days.add(r.date);
      rec.set(r.grade, g);
    });

    if (classCategory === 'general') {
      if (operatedDays === 0) return [];
      return scopeClasses.map(grade => {
        const enrolled = enrolledByClass.get(grade) || 0;
        const d = derivedAbsence.byGrade.get(grade);
        const permission = d?.permission || 0;
        const absent = d?.absent || 0;
        const denom = enrolled * operatedDays;
        const present_total = Math.max(0, denom - permission - absent);
        const rate = denom > 0 ? Math.round((present_total / denom) * 100) : 100;
        return { grade, present_total, permission, absent, daysCount: operatedDays, rate };
      });
    }

    return Array.from(rec.entries())
      .map(([grade, g]) => {
        const tracked = g.present + g.late + g.permission + g.absent;
        const rate = tracked > 0 ? Math.round(((g.present + g.late) / tracked) * 100) : 100;
        return { grade, present_total: g.present + g.late, permission: g.permission, absent: g.absent, daysCount: g.days.size, rate };
      })
      .sort((a, b) => a.grade.localeCompare(b.grade, 'km'));
  }, [periodRecordsMerged, periodDaysCount, classCategory, scopeClasses, enrolledByClass, derivedAbsence]);

  const attendanceAggregates = useMemo(() => {
    const operatedDays = periodDaysCount;
    let recPresent = 0, recLate = 0, totalPermission = 0, totalAbsent = 0;
    periodRecordsMerged.forEach(rec => {
      recPresent += rec.presentCount;
      recLate += rec.lateCount || 0;
      totalPermission += rec.permissionCount;
      totalAbsent += rec.absentCount;
    });

    let totalPresent: number;
    let overallRate: number;
    if (classCategory === 'general') {
      // Unrecorded students/classes count as present: present = enrolled × operated
      // days − recorded absences (excused + unexcused). Late students are present.
      // Absences come from studentStates (derivedAbsence), not the stale count fields.
      totalPermission = derivedAbsence.permission;
      totalAbsent = derivedAbsence.absent;
      const denom = scopeEnrolled * operatedDays;
      totalPresent = Math.max(0, denom - totalPermission - totalAbsent);
      overallRate = denom > 0 ? Math.round((totalPresent / denom) * 100) : 0;
    } else {
      // Extra classes: recorded headcount only (present = arrived = on-time + late).
      totalPresent = recPresent + recLate;
      const scheduled = totalPresent + totalPermission + totalAbsent;
      overallRate = scheduled > 0 ? Math.round((totalPresent / scheduled) * 100) : 0;
    }

    return {
      totalPresent,
      totalPermission,
      totalAbsent,
      overallRate,
      latestDate: periodLabel,
      activeDaysCount: operatedDays
    };
  }, [periodRecordsMerged, periodDaysCount, classCategory, scopeEnrolled, periodLabel, derivedAbsence]);

  // Filter students based on selection
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      if (!inCat(student.grade)) return false;
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : student.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : student.grade === selectedGrade;
      return matchMonth && matchGrade;
    });
  }, [students, selectedMonth, selectedGrade, classCategory]);

  // Filter reports based on selection
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (!inCat(report.generalInfo.grade)) return false;
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : report.generalInfo.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : report.generalInfo.grade === selectedGrade;
      return matchMonth && matchGrade;
    });
  }, [reports, selectedMonth, selectedGrade, classCategory]);

  // Calculate statistics. Enrolment counts (total/female/male) are independent of
  // the selected month — a student is enrolled whether or not they have a score
  // this month. Score metrics (average/pass/fail) use the month-filtered set.
  const stats = useMemo(() => {
    // Enrolment: unique students by name+grade in scope, across all months.
    const enrolledMap = new Map<string, StudentScore>();
    students.forEach(s => {
      if (!inCat(s.grade)) return;
      if (selectedGrade !== 'ទាំងអស់' && selectedGrade !== 'boldsymbol' && s.grade !== selectedGrade) return;
      const key = `${s.name.trim()}_${s.grade}`;
      if (!enrolledMap.has(key)) enrolledMap.set(key, s);
    });
    const enrolled = Array.from(enrolledMap.values());
    const totalCount = enrolled.length;
    const femaleCount = enrolled.filter(s => s.gender === 'ស្រី').length;
    const maleCount = totalCount - femaleCount;

    // Score metrics: this month's results only.
    const uniqueStudentsMap = new Map<string, StudentScore>();
    filteredStudents.forEach(s => {
      const key = `${s.name.trim()}_${s.grade}`;
      if (!uniqueStudentsMap.has(key)) uniqueStudentsMap.set(key, s);
    });
    const uniqueProfiles = Array.from(uniqueStudentsMap.values());
    let totalScoreSum = 0;
    let failCount = 0;
    uniqueProfiles.forEach(s => {
      totalScoreSum += s.overallAvg || 0;
      if (s.result === 'ធ្លាក់') failCount++;
    });
    const averageScore = uniqueProfiles.length > 0 ? parseFloat((totalScoreSum / uniqueProfiles.length).toFixed(2)) : 0;
    const passCount = uniqueProfiles.length - failCount;

    return {
      totalCount,
      femaleCount,
      maleCount,
      averageScore,
      failCount,
      passCount,
      totalRecordCount: uniqueProfiles.length
    };
  }, [students, filteredStudents, selectedGrade, classCategory]);

  // Find the latest attendance date within the selected class category + session.
  // Never show a future date — cap at today so a stray future-dated record can't
  // hijack the "today" view; fall back to today when nothing has been recorded.
  const latestAttendanceDate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const catRecords = attendanceRecords.filter(r => inCat(r.grade) && inSession(r) && inGradeScope(r.grade));
    const dates = catRecords.map(r => r.date).filter(d => d && d <= today).sort();
    if (dates.length === 0) return today;
    return dates[dates.length - 1];
  }, [attendanceRecords, classCategory, selectedDashSession, selectedGrade]);

  // The day shown in the daily-absent table & reasons chart — user-picked, else latest.
  const effectiveDailyDate = selectedDailyDate || latestAttendanceDate;
  const todayStr = new Date().toISOString().split('T')[0];

  // Generate Daily Absent Report Data
  const dailyAbsentReport = useMemo(() => {
    // Cumulative stats
    const cumulativeStats: Record<string, { late: number, permission: number, absent: number }> = {};
    attendanceRecords.forEach(rec => {
      if (!inCat(rec.grade) || !inSession(rec) || !inGradeScope(rec.grade)) return; // category + session + class scope
      if (rec.studentStates) {
        Object.entries(rec.studentStates).forEach(([sId, status]) => {
          if (sId.endsWith('_reason')) return;
          if (!cumulativeStats[sId]) {
            cumulativeStats[sId] = { late: 0, permission: 0, absent: 0 };
          }
          if (status === 'late') cumulativeStats[sId].late += 1;
          else if (status === 'permission') cumulativeStats[sId].permission += 1;
          else if (status === 'absent') cumulativeStats[sId].absent += 1;
        });
      }
    });

    const uniqueStudentsMap = new Map<string, StudentScore>();
    students.forEach(s => {
      if (!uniqueStudentsMap.has(s.id)) {
        uniqueStudentsMap.set(s.id, s);
      }
    });

    // Today's records (All classes, no grade filter)
    const todayRecords = attendanceRecords.filter(r => r.date === effectiveDailyDate && inCat(r.grade) && inSession(r) && inGradeScope(r.grade));
    
    let todayLateCount = 0;
    let todayPermissionCount = 0;
    let todayAbsentCount = 0;

    const list: any[] = [];

    // Merge a student's morning + afternoon records into one daily status (best
    // across shifts: present > late > permission > absent), so a student absent in
    // both shifts is counted once — matching the summary panel above.
    const statusRank: Record<string, number> = { present: 0, late: 1, permission: 2, absent: 3 };
    const byStudent = new Map<string, { status: string; grade: string; reason: string }>();
    todayRecords.forEach(rec => {
      if (!rec.studentStates) return;
      Object.entries(rec.studentStates as Record<string, string>).forEach(([sId, status]) => {
        if (sId.endsWith('_reason')) return;
        const reason = (rec.studentStates as any)[sId + '_reason'] || '';
        const prev = byStudent.get(sId);
        if (!prev) {
          byStudent.set(sId, { status, grade: rec.grade, reason });
        } else {
          const keepStatus = statusRank[status] < statusRank[prev.status] ? status : prev.status;
          byStudent.set(sId, { status: keepStatus, grade: prev.grade, reason: prev.reason || reason });
        }
      });
    });

    byStudent.forEach(({ status, grade, reason }, sId) => {
      if (status === 'late' || status === 'permission' || status === 'absent') {
        const stu = uniqueStudentsMap.get(sId);
        const stats = cumulativeStats[sId] || { late: 0, permission: 0, absent: 0 };
        list.push({
          id: sId,
          name: stu ? stu.name : 'មិនស្គាល់ឈ្មោះ',
          grade,
          gender: stu ? stu.gender : 'Unknown',
          cumulativeLate: stats.late,
          cumulativePermission: stats.permission,
          cumulativeAbsent: stats.absent,
          todayStatus: status,
          reason
        });
      }
    });

    // Merge duplicate profiles of the same person (same name + class but different
    // internal IDs — e.g. from re-imports) into one row so a student isn't listed
    // several times. Cumulative counts are summed; worst status / first reason wins.
    const statusW: Record<string, number> = { late: 1, permission: 2, absent: 3 };
    const mergedMap = new Map<string, any>();
    list.forEach(item => {
      const key = `${item.name.replace(/\s+/g, ' ').trim().toLowerCase()}|${item.grade}`;
      const ex = mergedMap.get(key);
      if (!ex) { mergedMap.set(key, { ...item }); return; }
      ex.cumulativeLate += item.cumulativeLate;
      ex.cumulativePermission += item.cumulativePermission;
      ex.cumulativeAbsent += item.cumulativeAbsent;
      if ((statusW[item.todayStatus] || 0) > (statusW[ex.todayStatus] || 0)) ex.todayStatus = item.todayStatus;
      if (!ex.reason && item.reason) ex.reason = item.reason;
    });
    const mergedList = Array.from(mergedMap.values());

    // Tally the day's totals from the merged rows so duplicates don't inflate them.
    mergedList.forEach(it => {
      if (it.todayStatus === 'late') todayLateCount++;
      else if (it.todayStatus === 'permission') todayPermissionCount++;
      else if (it.todayStatus === 'absent') todayAbsentCount++;
    });

    mergedList.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'km');
      return a.name.localeCompare(b.name, 'km');
    });

    return {
      date: effectiveDailyDate,
      lateCount: todayLateCount,
      permissionCount: todayPermissionCount,
      absentCount: todayAbsentCount,
      totalAbsences: todayPermissionCount + todayAbsentCount,
      list: mergedList
    };
  }, [attendanceRecords, students, effectiveDailyDate, selectedGrade, classCategory, selectedDashSession]);

  // Aggregate absence/lateness reasons for the chart, scoped to the latest
  // recorded day / month / year depending on the chosen mode.
  const absenceReasonStats = useMemo(() => {
    const monthKey = (effectiveDailyDate || '').slice(0, 7); // YYYY-MM
    const yearKey = (effectiveDailyDate || '').slice(0, 4);  // YYYY
    const inScope = (d: string) => reasonChartMode === 'daily' ? d === effectiveDailyDate
      : reasonChartMode === 'monthly' ? d.slice(0, 7) === monthKey
      : d.slice(0, 4) === yearKey;
    const scopeLabel = reasonChartMode === 'daily' ? (effectiveDailyDate || '—')
      : reasonChartMode === 'monthly' ? monthKey : yearKey;
    const counts: Record<string, number> = {};
    let total = 0;
    attendanceRecords.forEach(rec => {
      if (!rec.studentStates || !inScope(rec.date) || !inCat(rec.grade) || !inSession(rec) || !inGradeScope(rec.grade)) return;
      Object.entries(rec.studentStates).forEach(([sId, status]) => {
        if (sId.endsWith('_reason')) return;
        if (status !== 'late' && status !== 'permission' && status !== 'absent') return;
        const reason = (((rec.studentStates as any)[sId + '_reason'] as string) || '').trim() || 'មិនបានបញ្ជាក់មូលហេតុ';
        counts[reason] = (counts[reason] || 0) + 1;
        total++;
      });
    });
    const rows = Object.entries(counts).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return { rows, total, max, monthKey, scopeLabel };
  }, [attendanceRecords, effectiveDailyDate, reasonChartMode, classCategory, selectedDashSession, selectedGrade]);

  // Generate a clean, branded printable daily-absentee report (Save as PDF) via a hidden iframe.
  // Render branded report HTML to a hidden iframe and trigger the print/Save-as-PDF
  // dialog, waiting for the logo image so it appears in the output.
  const printReportHtml = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();

    let printed = false;
    const finishAndPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Report print failed', err);
      }
      setTimeout(() => iframe.remove(), 1000);
    };
    const logoImg = doc.querySelector('img');
    if (logoImg && !logoImg.complete) {
      logoImg.addEventListener('load', () => setTimeout(finishAndPrint, 200));
      logoImg.addEventListener('error', () => setTimeout(finishAndPrint, 200));
      setTimeout(finishAndPrint, 2000); // safety fallback
    } else {
      setTimeout(finishAndPrint, 400);
    }
  };

  const handleDownloadDailyPdf = () => {
    const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const { date, lateCount, permissionCount, absentCount, totalAbsences, list } = dailyAbsentReport;
    const baseScope = currentUser?.role === 'teacher' ? `ថ្នាក់៖ ${currentUser?.grade || ''}` : 'គ្រប់ថ្នាក់ទាំងអស់';
    const scopeLabel = sessionKm ? `${baseScope} • ${sessionKm}` : baseScope;

    const rowsHtml = list.length > 0
      ? list.map((r: any, i: number) => {
          const label = r.todayStatus === 'absent' ? 'អត់ច្បាប់' : r.todayStatus === 'permission' ? 'មានច្បាប់' : 'ចូលរៀនយឺត';
          const bg = r.todayStatus === 'absent' ? '#ffe4e6' : r.todayStatus === 'permission' ? '#dbeafe' : '#fef3c7';
          const fg = r.todayStatus === 'absent' ? '#be123c' : r.todayStatus === 'permission' ? '#1d4ed8' : '#b45309';
          const totAbs = (r.cumulativePermission || 0) + (r.cumulativeAbsent || 0);
          return `<tr><td style="text-align:center;color:#94a3b8">${i + 1}</td><td style="font-weight:bold">${esc(r.name)}</td><td>${esc(r.grade)}</td><td>${esc(r.gender)}</td><td style="text-align:center;color:#d97706;font-weight:bold">${r.cumulativeLate || 0}</td><td style="text-align:center;color:#2563eb;font-weight:bold">${r.cumulativePermission || 0}</td><td style="text-align:center;color:#e11d48;font-weight:bold">${r.cumulativeAbsent || 0}</td><td style="text-align:center;font-weight:bold;color:#0f172a">${totAbs}</td><td style="text-align:center"><span class="pill" style="background:${bg};color:${fg}">${label}</span></td><td>${esc(r.reason) || '—'}</td></tr>`;
        }).join('')
      : `<tr><td colspan="10" style="text-align:center;padding:22px;color:#16a34a">មិនមានសិស្សអវត្តមានទេនៅថ្ងៃនេះ! 🎉</td></tr>`;

    const html = `<!doctype html><html lang="km"><head><meta charset="utf-8">
      <title>របាយការណ៍អវត្តមាន ${date || ''}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap" rel="stylesheet">
      <style>
        *{font-family:'Noto Sans Khmer','Khmer OS',sans-serif;box-sizing:border-box}
        html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{margin:24px;color:#1e293b;font-size:11px}
        .header{display:flex;flex-direction:column;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:9px;margin-bottom:4px}
        .logo{width:60px;height:60px;margin-bottom:4px}
        h1{font-size:16px;margin:0;text-align:center;color:#1e3a8a;font-weight:bold}
        .sub{text-align:center;color:#475569;font-size:11px;margin:2px 0 0}
        .meta{display:flex;justify-content:space-between;font-size:11px;margin:12px 0 9px;font-weight:bold;color:#334155}
        .meta .date{color:#1d4ed8}
        .totals{display:flex;gap:8px;margin:0 0 12px}
        .box{flex:1;border:1px solid;border-radius:8px;padding:7px 8px;text-align:center;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        .box .n{font-size:17px;font-weight:bold;line-height:1}
        .box .l{font-size:9px;margin-top:2px;font-weight:bold}
        .b-late{background:#fffbeb;border-color:#fde68a}.b-late .n,.b-late .l{color:#b45309}
        .b-perm{background:#eff6ff;border-color:#bfdbfe}.b-perm .n,.b-perm .l{color:#1d4ed8}
        .b-abs{background:#fff1f2;border-color:#fecdd3}.b-abs .n,.b-abs .l{color:#be123c}
        .b-tot{background:#eef2ff;border-color:#c7d2fe}.b-tot .n,.b-tot .l{color:#4338ca}
        table{width:100%;border-collapse:collapse;font-size:9.5px;border:1px solid #e2e8f0}
        th{background:#1e3a8a;color:#fff;padding:5px 7px;text-align:left;font-size:9px;font-weight:bold;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        td{border-top:1px solid #e2e8f0;padding:4px 7px;text-align:left}
        tbody tr:nth-child(even){background:#f8fafc}
        .pill{padding:2px 7px;border-radius:999px;font-weight:bold;font-size:9px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        .foot{margin-top:16px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:7px}
        .foot b{color:#f59e0b}
        @page{margin:12mm}
      </style></head>
      <body>
        <div class="header">
          <div class="logo"><img src="${schoolLogo}" alt="logo" style="width:60px;height:60px;object-fit:contain"/></div>
          <h1>សាលាសហគមន៍ច្បារច្រុះ</h1>
          <div class="sub">របាយការណ៍សិស្សអវត្តមានប្រចាំថ្ងៃ</div>
        </div>
        <div class="meta"><span>${scopeLabel}</span><span class="date">កាលបរិច្ឆេទ៖ ${date || '—'}</span></div>
        <div class="totals">
          <div class="box b-late"><div class="n">${lateCount}</div><div class="l">យឺតសរុប</div></div>
          <div class="box b-perm"><div class="n">${permissionCount}</div><div class="l">ច្បាប់សរុប</div></div>
          <div class="box b-abs"><div class="n">${absentCount}</div><div class="l">អត់ច្បាប់សរុប</div></div>
          <div class="box b-tot"><div class="n">${totalAbsences}</div><div class="l">អវត្តមានសរុប</div></div>
        </div>
        <table>
          <thead><tr><th style="width:30px;text-align:center">ល.រ</th><th>ឈ្មោះសិស្ស</th><th>ថ្នាក់រៀន</th><th>ភេទ</th><th style="text-align:center">សរុបយឺត</th><th style="text-align:center">សរុបច្បាប់</th><th style="text-align:center">សរុបអត់ច្បាប់</th><th style="text-align:center">សរុបអវត្តមាន</th><th>ស្ថានភាព</th><th>មូលហេតុ</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="foot">បង្កើតដោយ<b>ប្រព័ន្ធគ្រប់គ្រងសាលា</b> • ${new Date().toLocaleString('en-GB')}</div>
      </body></html>`;

    printReportHtml(html);
  };

  // Attendance SUMMARY report (per-class headcount) for the selected day/month/year.
  const handleDownloadSummaryPdf = () => {
    const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const A = attendanceAggregates;
    const periodName = reportPeriod === 'day' ? 'ប្រចាំថ្ងៃ' : reportPeriod === 'month' ? 'ប្រចាំខែ' : 'ប្រចាំឆ្នាំ';
    const dateLabel = `${periodName} ៖ ${periodLabel}${reportPeriod !== 'day' ? ` (${periodDaysCount} ថ្ងៃ)` : ''}`;
    const baseScope = currentUser?.role === 'teacher' ? `ថ្នាក់៖ ${currentUser?.grade || ''}` : 'គ្រប់ថ្នាក់ទាំងអស់';
    const scopeLabel = sessionKm ? `${baseScope} • ${sessionKm}` : baseScope;
    const unit = reportPeriod === 'day' ? '' : ' (នាក់-ដង)';

    const rowsHtml = periodByClass.length > 0
      ? periodByClass.map((g, i) => {
          return `<tr><td style="text-align:center;color:#94a3b8">${i + 1}</td><td style="font-weight:bold">${esc(g.grade)}</td><td style="text-align:center;color:#16a34a;font-weight:bold">${g.present_total}</td><td style="text-align:center;color:#2563eb;font-weight:bold">${g.permission}</td><td style="text-align:center;color:#e11d48;font-weight:bold">${g.absent}</td><td style="text-align:center;font-weight:bold;color:#0f172a">${g.rate}%</td></tr>`;
        }).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:22px;color:#94a3b8">មិនមានទិន្នន័យវត្តមាននៅរយៈពេលនេះទេ</td></tr>`;

    const html = `<!doctype html><html lang="km"><head><meta charset="utf-8">
      <title>របាយការណ៍សង្ខេបវត្តមាន ${dateLabel}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;700&display=swap" rel="stylesheet">
      <style>
        *{font-family:'Noto Sans Khmer','Khmer OS',sans-serif;box-sizing:border-box}
        html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        body{margin:24px;color:#1e293b;font-size:11px}
        .header{display:flex;flex-direction:column;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:9px;margin-bottom:4px}
        .logo{width:60px;height:60px;margin-bottom:4px}
        h1{font-size:16px;margin:0;text-align:center;color:#1e3a8a;font-weight:bold}
        .sub{text-align:center;color:#475569;font-size:11px;margin:2px 0 0}
        .meta{display:flex;justify-content:space-between;font-size:11px;margin:12px 0 9px;font-weight:bold;color:#334155}
        .meta .date{color:#1d4ed8}
        .totals{display:flex;gap:8px;margin:0 0 12px}
        .box{flex:1;border:1px solid;border-radius:8px;padding:7px 8px;text-align:center;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        .box .n{font-size:17px;font-weight:bold;line-height:1}
        .box .l{font-size:9px;margin-top:2px;font-weight:bold}
        .b-rate{background:#eff6ff;border-color:#bfdbfe}.b-rate .n,.b-rate .l{color:#1d4ed8}
        .b-pres{background:#ecfdf5;border-color:#a7f3d0}.b-pres .n,.b-pres .l{color:#047857}
        .b-perm{background:#fffbeb;border-color:#fde68a}.b-perm .n,.b-perm .l{color:#b45309}
        .b-abs{background:#fff1f2;border-color:#fecdd3}.b-abs .n,.b-abs .l{color:#be123c}
        table{width:100%;border-collapse:collapse;font-size:9.5px;border:1px solid #e2e8f0}
        th{background:#1e3a8a;color:#fff;padding:5px 7px;text-align:left;font-size:9px;font-weight:bold;print-color-adjust:exact;-webkit-print-color-adjust:exact}
        td{border-top:1px solid #e2e8f0;padding:4px 7px;text-align:left}
        tbody tr:nth-child(even){background:#f8fafc}
        .foot{margin-top:16px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:7px}
        .foot b{color:#f59e0b}
        @page{margin:12mm}
      </style></head>
      <body>
        <div class="header">
          <div class="logo"><img src="${schoolLogo}" alt="logo" style="width:60px;height:60px;object-fit:contain"/></div>
          <h1>សាលាសហគមន៍ច្បារច្រុះ</h1>
          <div class="sub">របាយការណ៍សង្ខេបវត្តមានសិស្ស${periodName}</div>
        </div>
        <div class="meta"><span>${scopeLabel}</span><span class="date">${dateLabel}</span></div>
        <div class="totals">
          <div class="box b-rate"><div class="n">${A.overallRate}%</div><div class="l">អត្រាវត្តមាន</div></div>
          <div class="box b-pres"><div class="n">${A.totalPresent}</div><div class="l">មានវត្តមាន${unit}</div></div>
          <div class="box b-perm"><div class="n">${A.totalPermission}</div><div class="l">មានច្បាប់${unit}</div></div>
          <div class="box b-abs"><div class="n">${A.totalAbsent}</div><div class="l">អត់ច្បាប់${unit}</div></div>
        </div>
        <table>
          <thead><tr><th style="width:30px;text-align:center">ល.រ</th><th>ថ្នាក់រៀន</th><th style="text-align:center">មានវត្តមាន${unit}</th><th style="text-align:center">មានច្បាប់</th><th style="text-align:center">អត់ច្បាប់</th><th style="text-align:center">អត្រាវត្តមាន</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="foot">បង្កើតដោយ<b>ប្រព័ន្ធគ្រប់គ្រងសាលា</b> • ${new Date().toLocaleString('en-GB')}</div>
      </body></html>`;

    printReportHtml(html);
  };

  return (
    <div className="space-y-8">
      {/* Class category tabs: General (មត្តេយ្យ–ទី៦) vs Extra (after-hours skill classes) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100 w-full">
        <button
          disabled={teacherLocked}
          onClick={() => { setClassCategory('general'); setSelectedGrade('ទាំងអស់'); }}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${classCategory === 'general' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          {t('dash.cat.general')}
          <span className="hidden sm:inline text-[11px] font-medium opacity-80">{t('dash.cat.generalHint')}</span>
        </button>
        <button
          disabled={teacherLocked}
          onClick={() => { setClassCategory('extra'); setSelectedGrade('ទាំងអស់'); }}
          className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          {t('dash.cat.extra')}
          <span className="hidden sm:inline text-[11px] font-medium opacity-80">{t('dash.cat.extraHint')}</span>
        </button>
      </div>

      {/* Upper Filter & Navigation Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{t('dash.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('dash.subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 font-mono">{t('common.month')}៖</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 transition-colors"
            >
              {KHMER_MONTHS.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 font-mono">{t('common.class')}៖{teacherLocked && ' 🔒'}</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              disabled={teacherLocked}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {(teacherLocked ? [teacherGrade] : gradesList).map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <button 
            id="btn_to_gradebook"
            onClick={onOpenGradebookClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition duration-200 shadow-3xs border border-blue-200/50"
          >
            <GraduationCap size={15} />
            {t('dash.toGradebook')}
          </button>

          <button 
            id="btn_create_report"
            onClick={onCreateReportClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold transition duration-200 shadow-md shadow-blue-600/10"
          >
            <Plus size={15} />
            {t('dash.createReport')}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* KPI 1: Reports Count */}
        <div id="kpi_reports" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">{t('dash.kpi.reports')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">{filteredReports.length} <span className="text-sm font-normal text-slate-500">{t('common.copies')}</span></h3>
            <p className="text-[10px] text-slate-400 mt-1.5">{t('dash.kpi.reportsSub')}</p>
          </div>
        </div>

        {/* KPI 2: Total Students */}
        <div id="kpi_students" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">{t('dash.kpi.students')}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">{stats.totalCount} <span className="text-sm font-normal text-slate-500">{t('common.persons')}</span></h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500">{t('common.female')}៖ <span className="font-bold text-rose-500">{stats.femaleCount}</span> {t('common.persons')}</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">{t('common.male')}៖ <span className="font-bold text-blue-600">{stats.maleCount}</span> {t('common.persons')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Layout */}
      <div className="flex flex-col gap-8">
        {/* Daily Attendance Summary Executive Report Panel */}
      <div id="panel_attendance_summary" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
              <ClipboardCheck className="w-5 h-5 text-blue-500" />
              <span className="text-xs uppercase tracking-wider font-bold">{t('dash.att.summary')}</span>
            </div>
            <h3 className="font-bold text-slate-800 text-base font-serif">
              {t('dash.att.studentAtt')} {reportPeriod === 'day' ? t('common.daily') : reportPeriod === 'month' ? t('common.monthly') : t('common.yearly')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('dash.att.dataForPeriod')}
              {attendanceAggregates.latestDate ? <span className="font-bold text-slate-500"> ៖ {attendanceAggregates.latestDate}</span> : ''}
              {reportPeriod !== 'day' && periodDaysCount > 0 ? <span className="text-slate-400"> ({periodDaysCount} ថ្ងៃ)</span> : ''}
              {sessionKm ? <span className="font-bold text-blue-500"> • {sessionKm}</span> : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Morning / afternoon shift — general classes only (separate reports) */}
            {classCategory === 'general' && (
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                {([['morning', t('dash.att.morning')], ['afternoon', t('dash.att.afternoon')], ['all', t('dash.att.allday')]] as const).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => setSelectedDashSession(s)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap ${selectedDashSession === s ? 'bg-white text-blue-700 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Period mode: day / month / year */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              {([['day', t('common.day')], ['month', t('common.month')], ['year', t('common.year')]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setReportPeriod(mode)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors ${reportPeriod === mode ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Period value picker (calendar / month / year) */}
            <div className="flex items-center gap-1.5">
              <Calendar size={15} className="text-slate-400" />
              {reportPeriod === 'day' && (
                <input
                  type="date"
                  value={effectiveAttDate || ''}
                  max={availableDates[0]}
                  onChange={(e) => setSelectedAttDate(e.target.value || null)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-pointer focus:border-blue-500 outline-none transition-colors"
                  title="ជ្រើសរើសថ្ងៃ"
                />
              )}
              {reportPeriod === 'month' && (
                <input
                  type="month"
                  value={effectiveAttMonth || ''}
                  max={availableMonths[0]}
                  onChange={(e) => setSelectedAttMonth(e.target.value || null)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-pointer focus:border-blue-500 outline-none transition-colors"
                  title="ជ្រើសរើសខែ"
                />
              )}
              {reportPeriod === 'year' && (
                <select
                  value={effectiveAttYear || ''}
                  onChange={(e) => setSelectedAttYear(e.target.value || null)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-pointer focus:border-blue-500 outline-none transition-colors"
                  title="ជ្រើសរើសឆ្នាំ"
                >
                  {availableYears.length === 0 && <option value="">—</option>}
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {isLatestPeriod ? (
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap">{t('common.latest')}</span>
              ) : (
                <button
                  onClick={resetPeriodPick}
                  className="text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap transition-colors"
                  title="ត្រឡប់ទៅរយៈពេលថ្មីបំផុត"
                >
                  ↺ {t('common.latest')}
                </button>
              )}
            </div>

            <button
              onClick={handleDownloadSummaryPdf}
              disabled={periodRecords.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-3xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="ទាញយករបាយការណ៍សង្ខេបវត្តមាន"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {t('dash.att.downloadPdf')}
            </button>

            {onOpenAttendanceClick && (
              <button
                onClick={onOpenAttendanceClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition duration-250 cursor-pointer border border-blue-200/40 shadow-3xs"
              >
                <span>{t('dash.att.manageNow')}</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Aggregated Indicators and Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dash.att.rate')}</p>
              <h4 className="text-xl font-black text-slate-800 mt-1 font-mono">
                {attendanceAggregates.activeDaysCount > 0 ? `${attendanceAggregates.overallRate}%` : '0%'}
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold font-mono text-sm">
              %
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dash.att.present')}</p>
              <h4 className="text-xl font-black text-emerald-600 mt-1 font-mono">
                {attendanceAggregates.totalPresent} <span className="text-xs font-normal text-slate-500">{reportPeriod === 'day' ? t('common.persons') : t('common.personDays')}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold font-mono text-xs">
              P
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('dash.att.permission')}</p>
              <h4 className="text-xl font-black text-amber-600 mt-1 font-mono">
                {attendanceAggregates.totalPermission} <span className="text-xs font-normal text-slate-500">{reportPeriod === 'day' ? t('common.persons') : t('common.personDays')}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold font-mono text-xs">
              L
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#EA4335] font-bold uppercase tracking-wider">{t('dash.att.absent')}</p>
              <h4 className="text-xl font-black text-rose-600 mt-1 font-mono">
                {attendanceAggregates.totalAbsent} <span className="text-xs font-normal text-slate-500">{reportPeriod === 'day' ? t('common.persons') : t('common.personDays')}</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-bold font-mono text-xs">
              A
            </div>
          </div>
        </div>

        {/* Detailed Records Tracker */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">{t('dash.att.recordsByClass')} {reportPeriod === 'day' ? t('common.daily') : reportPeriod === 'month' ? t('common.monthly') : t('common.yearly')}</span>
            <span className="text-[10.5px] text-slate-400 font-bold font-mono">{t('common.total')} {periodByClass.length} {t('common.classesUnit')}</span>
          </div>

          {periodByClass.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-150 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-4 py-2.5">{t('common.classroom')}</th>
                    <th className="px-4 py-2.5 text-center">{t('dash.att.present2')}{reportPeriod !== 'day' ? ` (${t('common.personDays')})` : ''}</th>
                    <th className="px-4 py-2.5 text-center">{t('dash.att.permission2')}</th>
                    <th className="px-4 py-2.5 text-center">{t('dash.att.absent2')}</th>
                    <th className="px-4 py-2.5 text-center">{t('dash.att.rate2')}</th>
                    <th className="px-4 py-2.5 text-right">{t('common.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodByClass.map((g) => (
                    <tr key={g.grade} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {g.grade}
                        {reportPeriod !== 'day' && <span className="ml-2 text-[10px] font-normal text-slate-400 font-mono">({g.daysCount} ថ្ងៃ)</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-bold font-mono">{g.present_total}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-bold font-mono">{g.permission}</td>
                      <td className="px-4 py-3 text-center text-rose-600 font-bold font-mono">{g.absent}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            g.rate >= 90 ? 'bg-emerald-50 text-emerald-700' : g.rate >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {g.rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={onOpenAttendanceClick}
                          className="text-blue-600 hover:text-blue-800 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>{t('dash.att.review')}</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ClipboardCheck size={36} className="text-slate-350 mb-2" />
              <p className="font-semibold text-slate-605">មិនមានទិន្នន័យវត្តមានសម្រាប់រយៈពេលដែលបានជ្រើសនោះទេ</p>
              {onOpenAttendanceClick && (
                <button
                  onClick={onOpenAttendanceClick}
                  className="mt-3.5 px-4.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-[10.5px] transition duration-200 cursor-pointer shadow-3xs"
                >
                  ➕ ចុចទីនេះដើម្បីចាប់ផ្តើមកត់វត្តមានដំបូង
                </button>
              )}
            </div>
          )}
        </div>
      </div>

        {/* Absence Reasons Chart (principal only) */}
        {currentUser?.role !== 'teacher' && (
        <div id="panel_absence_reasons" className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex flex-shrink-0 items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-indigo-600 font-bold text-sm uppercase tracking-wider mb-1">{t('dash.reasons.tag')}</p>
                <h3 className="font-bold text-[#1e293b] text-2xl font-serif">{t('dash.reasons.title')}</h3>
                <p className="text-xs text-slate-400 mt-2">
                  {reasonChartMode === 'daily' ? 'ប្រចាំថ្ងៃ' : reasonChartMode === 'monthly' ? 'ប្រចាំខែ' : 'ប្រចាំឆ្នាំ'}
                  {' '}• <span className="font-bold text-slate-500">{absenceReasonStats.scopeLabel}</span>
                  {' '}• សរុប <span className="font-bold text-indigo-600">{absenceReasonStats.total}</span> ករណី
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
            {reasonChartMode === 'daily' && (
              <input
                type="date"
                value={effectiveDailyDate || ''}
                max={todayStr}
                onChange={e => setSelectedDailyDate(e.target.value || null)}
                className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-pointer focus:border-indigo-500 outline-none transition-colors"
                title="ជ្រើសរើសថ្ងៃ"
              />
            )}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setReasonChartMode('daily')}
                className={`px-4 py-2 rounded-lg transition-all ${reasonChartMode === 'daily' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >📅 ប្រចាំថ្ងៃ</button>
              <button
                onClick={() => setReasonChartMode('monthly')}
                className={`px-4 py-2 rounded-lg transition-all ${reasonChartMode === 'monthly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >🗓️ ប្រចាំខែ</button>
              <button
                onClick={() => setReasonChartMode('yearly')}
                className={`px-4 py-2 rounded-lg transition-all ${reasonChartMode === 'yearly' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >📆 ប្រចាំឆ្នាំ</button>
            </div>
            </div>
          </div>

          {absenceReasonStats.rows.length > 0 ? (
            <div className="space-y-3">
              {absenceReasonStats.rows.map((row, idx) => {
                const palette = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];
                const color = palette[idx % palette.length];
                const pct = absenceReasonStats.max > 0 ? (row.count / absenceReasonStats.max) * 100 : 0;
                const pctTotal = absenceReasonStats.total > 0 ? Math.round((row.count / absenceReasonStats.total) * 100) : 0;
                return (
                  <div key={row.reason} className="flex items-center gap-3">
                    <div className="w-[44%] md:w-[34%] shrink-0 text-[11.5px] font-semibold text-slate-700 text-right truncate" title={row.reason}>{row.reason}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end px-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 9)}%`, background: color }}
                      >
                        <span className="text-[11px] font-black text-white">{row.count}</span>
                      </div>
                    </div>
                    <div className="w-10 shrink-0 text-[11px] font-bold text-slate-500 text-right">{pctTotal}%</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <CheckCircle size={36} className="text-emerald-300 mb-2" />
              <p className="font-semibold text-slate-500">គ្មានសិស្សអវត្តមាន{reasonChartMode === 'daily' ? 'នៅថ្ងៃនេះ' : reasonChartMode === 'monthly' ? 'ក្នុងខែនេះ' : 'ក្នុងឆ្នាំនេះ'}ទេ! 🎉</p>
            </div>
          )}
        </div>
        )}

        {/* Daily Absent Students Report Panel (Restored) */}
      <div id="panel_daily_absent" className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex flex-shrink-0 items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-rose-600 font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                {t('dash.absent.tag')}
              </p>
              <h3 className="font-bold text-[#1e293b] text-2xl font-serif">{t('dash.absent.title')}</h3>
              <p className="text-xs text-slate-400 mt-2">
                បញ្ជីសិស្សអវត្តមានទាំងអស់គ្រប់ថ្នាក់ • ថ្ងៃទី <span className="font-bold text-slate-500">{dailyAbsentReport.date}</span>
                {sessionKm ? <span className="font-bold text-blue-500"> • {sessionKm}</span> : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={effectiveDailyDate || ''}
              max={todayStr}
              onChange={e => setSelectedDailyDate(e.target.value || null)}
              className="px-2.5 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-700 cursor-pointer focus:border-rose-400 outline-none transition-colors"
              title="ជ្រើសរើសថ្ងៃ"
            />
            <button
              onClick={handleDownloadDailyPdf}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-xl text-sm font-bold transition duration-200 cursor-pointer shadow-md shadow-rose-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              {t('dash.absent.downloadDaily')}
            </button>
          </div>
        </div>

        {/* 4 Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#FFFDF7] py-6 px-4 rounded-xl border border-amber-200 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(251,191,36,0.05)]">
            <h4 className="text-4xl font-black text-amber-500 font-mono leading-none">{dailyAbsentReport.lateCount}</h4>
            <p className="text-xs text-amber-600 font-black mt-3.5 uppercase tracking-wider">{t('dash.absent.lateTotal')}</p>
          </div>
          <div className="bg-[#F0F5FF] py-6 px-4 rounded-xl border border-blue-200 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.05)]">
            <h4 className="text-4xl font-black text-blue-600 font-mono leading-none">{dailyAbsentReport.permissionCount}</h4>
            <p className="text-xs text-blue-600 font-black mt-3.5 uppercase tracking-wider">{t('dash.absent.permTotal')}</p>
          </div>
          <div className="bg-[#FFF5F5] py-6 px-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(244,63,94,0.05)]">
            <h4 className="text-4xl font-black text-rose-500 font-mono leading-none">{dailyAbsentReport.absentCount}</h4>
            <p className="text-xs text-rose-500 font-black mt-3.5 uppercase tracking-wider">{t('dash.absent.absTotal')}</p>
          </div>
          <div className="bg-white py-6 px-4 rounded-xl border border-[#334155] flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
            <h4 className="text-4xl font-black text-[#334155] font-mono leading-none">{dailyAbsentReport.totalAbsences}</h4>
            <p className="text-xs text-[#64748b] font-black mt-3.5 uppercase tracking-wider">{t('dash.absent.totalAbs')}</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#334155]">
              <thead className="border-b border-slate-200 text-[#64748b] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4 text-center w-12 font-bold">{t('common.no')}</th>
                  <th className="px-5 py-4 font-bold sticky left-0 z-10 bg-white shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap">{t('common.studentName')}</th>
                  <th className="px-5 py-4 font-bold">{t('common.classroom')}</th>
                  <th className="px-5 py-4 font-bold">{t('common.gender')}</th>
                  <th className="px-4 py-4 text-center font-bold">{t('dash.absent.hLate')}</th>
                  <th className="px-4 py-4 text-center font-bold">{t('dash.absent.hPerm')}</th>
                  <th className="px-4 py-4 text-center text-rose-600 font-bold">{t('dash.absent.hAbs')}</th>
                  <th className="px-4 py-4 text-center text-slate-700 font-bold">{t('dash.absent.hTotAbs')}</th>
                  <th className="px-5 py-4 text-center font-bold">{t('dash.absent.hToday')}</th>
                  <th className="px-5 py-4 font-bold">{t('common.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyAbsentReport.list.length > 0 ? (
                  dailyAbsentReport.list.map((student, idx) => {
                    const totalAbsent = student.cumulativePermission + student.cumulativeAbsent;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-all font-medium">
                        <td className="px-5 py-5 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-5 py-5 sticky left-0 z-10 bg-white shadow-[3px_0_5px_-2px_rgba(0,0,0,0.08)]">
                          <p className="text-sm font-black text-[#1e293b]">{student.name}</p>
                          <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase">ID: {student.id.substring(0, 5)}</p>
                        </td>
                        <td className="px-5 py-5 font-black text-[#475569]">{student.grade}</td>
                        <td className="px-5 py-5 text-[#475569]">{student.gender}</td>
                        <td className="px-4 py-5 text-center text-amber-500 font-black font-mono">{student.cumulativeLate}</td>
                        <td className="px-4 py-5 text-center text-blue-600 font-black font-mono">{student.cumulativePermission}</td>
                        <td className="px-4 py-5 text-center text-rose-600 font-black font-mono">{student.cumulativeAbsent}</td>
                        <td className="px-4 py-5 text-center font-black text-[#0f172a] font-mono">{totalAbsent}</td>
                        <td className="px-5 py-5 text-center">
                          {student.todayStatus === 'late' && (
                            <span className="text-[11px] font-black tracking-wide text-amber-500">ចូលរៀនយឺត</span>
                          )}
                          {student.todayStatus === 'permission' && (
                            <span className="text-[11px] font-black tracking-wide text-blue-600">មានច្បាប់</span>
                          )}
                          {student.todayStatus === 'absent' && (
                            <span className="text-[11px] font-black tracking-wide text-rose-600">អត់ច្បាប់</span>
                          )}
                        </td>
                        <td className="px-5 py-5 text-[#64748b] text-[12px]">
                          {student.reason || 'ខ្ជិល'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-400 font-medium bg-slate-50 border-b border-slate-100">
                      មិនមានសិស្សអវត្តមានទេនៅថ្ងៃនេះ! រីករាយណាស់! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Reports Registry Listing */}
        <div id="panel_report_list" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-base">{t('dash.reports.saved')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('dash.reports.savedSub')}</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-full font-mono text-xs border border-slate-100">
              សរុប {filteredReports.length}
            </span>
          </div>

          {filteredReports.length > 0 ? (
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-2.5">
              {filteredReports.map((report) => (
                <div 
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h4 className="text-slate-800 font-medium text-sm">
                        របាយការណ៍ {report.generalInfo.month} - {report.generalInfo.grade}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        គ្រូ៖ {report.generalInfo.teacherName} | ឆ្នាំសិក្សា៖ {report.generalInfo.academicYear}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewReport(report)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      title="មើលលម្អិត និងបោះពុម្ព"
                    >
                      <Eye size={13} />
                      {t('common.details')}
                    </button>
                    {currentUser?.role !== 'teacher' && (
                      <button
                        onClick={() => onDeleteReport(report.id)}
                        className="p-1.5 bg-white border border-rose-100 rounded-md text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                        title="លុបរបាយការណ៍"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <FolderOpen size={40} className="text-slate-300 mb-2" />
              <p className="text-sm">មិនទាន់មានរបាយការណ៍ដែលត្រូវនឹងការស្វែងរករបស់អ្នកនៅឡើយទេ</p>
              <button 
                onClick={onCreateReportClick}
                className="mt-4 px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-semibold hover:bg-blue-100/50 transition-colors"
              >
                ចុចទីនេះដើម្បីសរសេររបាយការណ៍ឥឡូវនេះ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
