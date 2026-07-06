import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Search, 
  Check, 
  X, 
  Clock, 
  BookOpen, 
  CheckCircle, 
  AlertTriangle, 
  UserCheck, 
  Plus, 
  ArrowLeft, 
  ArrowRight,
  ClipboardList,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Users2,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentScore, SchoolUser, afterHoursSubject } from '../types';
import { useT } from '../i18n';
import { AVAILABLE_USERS } from './LoginPortal';
import MonthlyAttendanceRegister from './MonthlyAttendanceRegister';
import {
  getSupabaseClient,
  syncUpsertStudentAttendance,
  syncUpsertStudentAttendanceBulk,
  syncUpsertTeacherAttendance,
  syncDeleteStudentAttendance,
  syncDeleteStudentAttendanceByGrade
} from '../lib/supabase';
import { persistAttendance, loadAttendance } from '../utils/attendanceStore';

// Class-category split: "extra" (after-hours skill classes) vs "general" (មត្តេយ្យ–ទី៦).
// 'គ្លេស' (the English-language root) catches spelling variants like អង់គ្លេស / អ់គ្លេស.
const EXTRA_CLASS_KEYWORDS = ['GRADE','គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
// The subject keyword inside an after-hours class name, used to group its sections (3A, 3B...).
const getSubjectKey = (grade: string) => EXTRA_CLASS_KEYWORDS.find(k => (grade || '').includes(k)) || '';

// Morning / afternoon session split — applies to general (non-extra) classes only.
type Session = 'morning' | 'afternoon';
const SESSIONS: { key: Session; km: string; icon: string }[] = [
  { key: 'morning', km: 'វេនព្រឹក', icon: '🌅' },
  { key: 'afternoon', km: 'វេនរសៀល', icon: '🌇' },
];
// Session is encoded in the record id so the two shifts stay separate records
// without needing a Supabase schema change: `att-<session>-<date>-<grade>`.
// Extra (after-hours) classes keep the single-session id `att-<date>-<grade>`.
const makeAttendanceId = (date: string, grade: string, session: Session) =>
  isExtraClass(grade) ? `att-${date}-${grade}` : `att-${session}-${date}-${grade}`;
// Recover the session from a record (explicit field first, else parsed from the id).
const recordSession = (r: { id?: string; session?: string }): Session | undefined => {
  if (r.session === 'morning' || r.session === 'afternoon') return r.session;
  const p = (r.id || '').split('-');
  return p[1] === 'morning' || p[1] === 'afternoon' ? (p[1] as Session) : undefined;
};

// Structured absence / lateness reasons (5 categories + free-text "Other").
const ABSENCE_REASON_GROUPS: { label: string; options: string[] }[] = [
  { label: '១. បញ្ហាសុខភាព', options: [
    'ឈឺធម្មតា (ផ្តាសាយ គ្រុនក្តៅ ឈឺពោះ។ល។)',
    'ជួបគ្រោះថ្នាក់ ឬរបួស',
    'ទៅពិនិត្យសុខភាព ឬព្យាបាលជំងឺ',
  ] },
  { label: '២. កត្តាគ្រួសារ', options: [
    'ជួយការងារផ្ទះ ឬមើលថែប្អូន',
    'ជួយការងារឪពុកម្តាយ (ស្រែចម្ការ លក់ដូរ។ល។)',
    'ចូលរួមពិធីបុណ្យ ឬកម្មវិធីគ្រួសារ',
    'ធ្វើដំណើរជាមួយគ្រួសារ',
    'បញ្ហាសេដ្ឋកិច្ចគ្រួសារ',
  ] },
  { label: '៣. កត្តាធ្វើដំណើរ', options: [
    'គ្មានអ្នកជូនមកសាលា',
    'ខូចមធ្យោបាយធ្វើដំណើរ',
    'ភ្លៀងខ្លាំង ទឹកជំនន់ ឬផ្លូវពិបាកធ្វើដំណើរ',
  ] },
  { label: '៤. កត្តាសាលារៀន និងការសិក្សា', options: [
    'មិនទាន់បានធ្វើកិច្ចការផ្ទះ',
    'បាត់សម្ភារៈសិក្សា',
    'រៀនអត់ចេះ',
  ] },
  { label: '៥. កត្តាផ្ទាល់ខ្លួន', options: [
    'ក្រោកពីគេងយឺត',
    'មិនចង់មកសាលា (ខ្ជិល)',
    'ខ្លាចគ្រូ/មិត្តភក្តិ',
    'មានជម្លោះជាមួយមិត្តភក្តិ',
    'ច្រឡំថ្ងៃ ឬវេនរៀន',
  ] },
];
// Flat list of all predefined reason values (plus '' for the empty default).
const PREDEFINED_REASONS: string[] = ['', ...ABSENCE_REASON_GROUPS.flatMap(g => g.options)];

interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
  session?: Session; // morning/afternoon for general classes; undefined for extra
  presentCount: number;
  lateCount?: number;
  permissionCount: number;
  absentCount: number;
  studentStates: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' };
}

interface TeacherAttendanceRecord {
  id: string;
  date: string;
  presentCount: number;
  lateCount?: number;
  permissionCount: number;
  absentCount: number;
  teacherStates: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' };
}

interface DailyAttendanceProps {
  students: StudentScore[];
  currentUser: SchoolUser | null;
  grades: string[];
}

export default function DailyAttendance({ students, currentUser, grades }: DailyAttendanceProps) {
  const { t } = useT();
  // Navigation Tab inside attendance view: 'student' | 'teacher'
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');

  // Date and Grade tracking
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [selectedGrade, setSelectedGrade] = useState(() => {
    if (currentUser?.grade && currentUser.grade !== 'ទាំងអស់') {
      return currentUser.grade;
    }
    // Non-teachers start on the first general class so the general panel shows first.
    return grades.find(g => !isExtraClass(g)) || grades[0] || 'ថ្នាក់ទី ១ក';
  });

  // Morning/afternoon shift for general classes — defaults to the current half-day.
  const [selectedSession, setSelectedSession] = useState<Session>(() => new Date().getHours() < 12 ? 'morning' : 'afternoon');

  // Group filter for after-hours classes split into groups ('ទាំងអស់' = all).
  const [selectedAttGroup, setSelectedAttGroup] = useState<string>('ទាំងអស់');

  // Class category (general / extra). Teachers follow their own class; everyone
  // else always starts on the general panel.
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>(() => {
    if (currentUser?.grade && currentUser.grade !== 'ទាំងអស់') {
      return isExtraClass(currentUser.grade) ? 'extra' : 'general';
    }
    return 'general';
  });
  const inCat = (grade: string) => (classCategory === 'extra' ? isExtraClass(grade) : !isExtraClass(grade));

  // An after-hours teacher (e.g. English) teaches several groups (3A, 3B...) within one subject.
  const isTeacher = currentUser?.role === 'teacher';
  const isExtraTeacher = isTeacher && isExtraClass(currentUser!.grade || '');
  const isGeneralTeacher = isTeacher && !isExtraTeacher; // locked to their single class
  // Grade options for the class dropdown:
  //  - general teacher → locked to their own class
  //  - extra teacher   → only their own subject's groups
  //  - admin           → every class in the selected category
  const gradeOptions = isExtraTeacher
    ? grades.filter(g => afterHoursSubject(g) === afterHoursSubject(currentUser!.grade))
    : isGeneralTeacher
      ? [currentUser!.grade]
      : grades.filter(g => inCat(g));

  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [monthlyRegisterOpen, setMonthlyRegisterOpen] = useState(false);

  // Merge imported monthly-register day-marks into the daily attendance records.
  // The cloud sync MUST be reliable: a large import (many months × classes) used to
  // fire hundreds of parallel single-row upserts fire-and-forget, so many silently
  // failed → the records were saved only locally, then the next full reconcile
  // replaced the local copy with the cloud's incomplete one and they "disappeared".
  // Push them in awaited bulk chunks and tell the user if the cloud write failed.
  const handleMonthlyImport = async (updated: AttendanceRecord[]) => {
    const ids = new Set(updated.map(r => r.id));
    const merged = [...updated, ...records.filter(r => !ids.has(r.id))];
    setRecords(merged);
    persistAttendance(merged);
    const client = getSupabaseClient();
    if (!client) { triggerToast('បានរក្សាក្នុងម៉ាស៊ីន (មិនបានភ្ជាប់ Cloud)', 'info'); return; }
    try {
      await syncUpsertStudentAttendanceBulk(updated);
      triggerToast(`បានរក្សាទុក និងភ្ជាប់ Cloud ✓ (${updated.length} កំណត់ត្រា)`, 'success');
    } catch (err) {
      console.warn('Supabase monthly import sync failed', err);
      triggerToast('⚠️ បានរក្សាក្នុងម៉ាស៊ីន តែការភ្ជាប់ Cloud បរាជ័យ — សូមនាំចូលឡើងវិញ ឬពិនិត្យ Cloud (ទិន្នន័យអាចបាត់ពេល Sync)', 'error');
    }
  };

  // Wipe a class+month's attendance records (used before a clean re-import) — local
  // store, cloud and live state, so re-import starts from a blank month instead of
  // merging onto stale marks.
  const handleMonthlyClear = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    const drop = new Set(idsToRemove);
    const remaining = records.filter(r => !drop.has(r.id));
    setRecords(remaining);
    persistAttendance(remaining);
    const client = getSupabaseClient();
    if (client) {
      idsToRemove.forEach(id => syncDeleteStudentAttendance(id).catch(err => console.warn('Supabase clear sync failed', err)));
    }
  };

  // Wipe ALL attendance for a class (every month) locally + in the cloud, so a
  // re-import starts clean. A record is removed if its grade matches OR any of its
  // studentStates entries belongs to one of this class's students — this catches
  // records saved under a drifted grade spelling that the cumulative still counts.
  const handleClearGradeAll = async (gradeToClear: string) => {
    const classPersons = new Set(students.filter(s => s.grade === gradeToClear).map(s => personKeyOf(s)));
    const idToPerson = new Map<string, string>();
    students.forEach(s => idToPerson.set((s as any).id, personKeyOf(s)));
    const belongs = (r: AttendanceRecord) =>
      r.grade === gradeToClear ||
      Object.keys(r.studentStates || {}).some(k => !k.endsWith('_reason') && classPersons.has(idToPerson.get(k) || ''));

    const toRemove = records.filter(belongs);
    const remaining = records.filter(r => !belongs(r));
    setRecords(remaining);
    persistAttendance(remaining);

    const client = getSupabaseClient();
    if (client) {
      try {
        await syncDeleteStudentAttendanceByGrade(gradeToClear);
        for (const r of toRemove) { try { await syncDeleteStudentAttendance(r.id); } catch { /* keep going */ } }
        triggerToast(`បានសម្អាតវត្តមានទាំងអស់របស់ «${gradeToClear}» (${toRemove.length} ថ្ងៃ, Cloud ផង) ✓`, 'success');
      } catch (err) {
        console.warn('Supabase clear-all sync failed', err);
        triggerToast('បានសម្អាតក្នុងម៉ាស៊ីន — ភ្ជាប់ Cloud បរាជ័យ', 'error');
      }
    } else {
      triggerToast('បានសម្អាតក្នុងម៉ាស៊ីន (មិនបានភ្ជាប់ Cloud)', 'info');
    }
  };

  // Load persistence records for students
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = loadAttendance() as AttendanceRecord[];
    if (saved.length > 0) return saved;
    return [
      {
        id: 'att-mock-1',
        date: '2026-06-02',
        grade: grades[0] || 'ថ្នាក់ទី ១ក',
        presentCount: 22,
        lateCount: 0,
        permissionCount: 1,
        absentCount: 1,
        studentStates: {}
      }
    ];
  });

  // Load persistence records for teachers
  const [teacherRecords, setTeacherRecords] = useState<TeacherAttendanceRecord[]>(() => {
    const saved = localStorage.getItem('school_teachers_daily_attendance');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved teacher attendance records', e);
      }
    }
    return [
      {
        id: 't-att-mock-1',
        date: '2026-06-02',
        presentCount: 12,
        lateCount: 0,
        permissionCount: 0,
        absentCount: 0,
        teacherStates: {}
      }
    ];
  });

  // Track the current student-level state mapping
  const [activeAttendanceMap, setActiveAttendanceMap] = useState<{ [studentId: string]: 'present' | 'late' | 'permission' | 'absent' }>({});
  const [studentReasonsMap, setStudentReasonsMap] = useState<{ [studentId: string]: string }>({});

  // Track the current teacher-level state mapping
  const [teacherAttendanceMap, setTeacherAttendanceMap] = useState<{ [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' }>({});
  const [teacherReasonsMap, setTeacherReasonsMap] = useState<{ [teacherId: string]: string }>({});

  // Compile list of teachers from AVAILABLE_USERS
  const teachersList = useMemo(() => {
    const list = AVAILABLE_USERS.filter(u => u.role === 'teacher');
    if (currentUser?.role === 'principal') {
      const principalUser = AVAILABLE_USERS.find(u => u.role === 'principal');
      if (principalUser && !list.some(u => u.id === principalUser.id)) {
        return [principalUser, ...list];
      }
    }
    return list;
  }, [currentUser]);

  // Compute cumulative teacher attendance statistics based on historical records + current active mappings
  const teacherStatsMap = useMemo(() => {
    const stats: { [teacherId: string]: { late: number; permission: number; absent: number; totalAbsence: number } } = {};
    
    // Initialize stats for each teacher to prevent undefined references
    teachersList.forEach(t => {
      stats[t.id] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
    });

    // Populate using saved records, excluding the current draft's date so we don't double count it
    teacherRecords.forEach(r => {
      if (r.date === selectedDate) {
        return; // Exclude current date because we will merge teacherAttendanceMap live!
      }
      if (r.teacherStates) {
        Object.entries(r.teacherStates).forEach(([teacherId, status]) => {
          if (teacherId.endsWith('_reason')) return;
          
          if (!stats[teacherId]) {
            stats[teacherId] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
          }
          
          if (status === 'late') {
            stats[teacherId].late += 1;
          } else if (status === 'permission') {
            stats[teacherId].permission += 1;
            stats[teacherId].totalAbsence += 1;
          } else if (status === 'absent') {
            stats[teacherId].absent += 1;
            stats[teacherId].totalAbsence += 1;
          }
        });
      }
    });

    // Merge the live draft state so changes reflect instantly in real-time
    Object.entries(teacherAttendanceMap).forEach(([teacherId, status]) => {
      if (!stats[teacherId]) {
        stats[teacherId] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
      }
      if (status === 'late') {
        stats[teacherId].late += 1;
      } else if (status === 'permission') {
        stats[teacherId].permission += 1;
        stats[teacherId].totalAbsence += 1;
      } else if (status === 'absent') {
        stats[teacherId].absent += 1;
        stats[teacherId].totalAbsence += 1;
      }
    });

    return stats;
  }, [teacherRecords, teachersList, selectedDate, teacherAttendanceMap]);

  // Create a unique list of student profiles so that multiple monthly scores don't show as duplicate students in Attendance
  const uniqueStudentsList = useMemo(() => {
    const list: StudentScore[] = [];
    const seen = new Set<string>();
    
    students.forEach(s => {
      const key = `${s.name.trim().toLowerCase()}_${s.grade}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(s);
      }
    });
    
    // Sort alphabetically by name
    return list.sort((a, b) => a.name.localeCompare(b.name, 'km'));
  }, [students]);

  // The school-issued ID (អត្តលេខ) for each person, resolved once and inherited
  // across all of a student's month-records (some rows may lack it). This is the
  // stable, school-provided identity used for both the displayed ID and attendance
  // matching, so totals are identical on every device.
  const schoolIdByName = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach(s => {
      const nk = `${s.name.trim().toLowerCase()}_${s.grade}`;
      const sid = ((s as any).studentId || '').trim();
      if (sid && !m.has(nk)) m.set(nk, sid);
    });
    return m;
  }, [students]);

  // A stable per-PERSON key. Attendance is stored keyed by a student record's id,
  // but a student has one record per month (each a different id) and different
  // devices may pick a different record as the roster representative — so matching
  // by exact id made the same cloud data show different totals per device.
  // Key by the school ID (អត្តលេខ) when known, else name+grade, so the count is
  // identical everywhere.
  const personKeyOf = (s: { name: string; grade: string; studentId?: string }) => {
    const nk = `${s.name.trim().toLowerCase()}_${s.grade}`;
    const sid = schoolIdByName.get(nk) || (s.studentId || '').trim();
    return sid ? `id:${sid}` : `nm:${nk}`;
  };
  // The school ID to display for a student ("—" if none has been assigned yet).
  const schoolIdOf = (s: { name: string; grade: string; studentId?: string }) =>
    schoolIdByName.get(`${s.name.trim().toLowerCase()}_${s.grade}`) || (s.studentId || '').trim() || '—';

  // Compute cumulative student attendance statistics based on historical records + current active mappings
  const studentStatsMap = useMemo(() => {
    const stats: { [personKey: string]: { late: number; permission: number; absent: number; totalAbsence: number } } = {};

    // Map EVERY student record id (any month) -> its person key, so an attendance
    // entry keyed by any of a student's month-record ids resolves to that person.
    const idToPerson = new Map<string, string>();
    students.forEach(s => idToPerson.set((s as any).id, personKeyOf(s)));

    // Initialize stats for each student to prevent undefined references
    uniqueStudentsList.forEach(s => {
      stats[personKeyOf(s)] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
    });

    // Count at most ONE status per person per DAY — a student absent in both the
    // morning and afternoon session is one absence, not two (matches the monthly
    // register). Collapse to the worst status of the day first, then tally.
    const rank: Record<string, number> = { present: 0, late: 1, permission: 2, absent: 3 };
    const perDay = new Map<string, string>(); // `${personKey}|${date}` -> worst status
    const consider = (pk: string | undefined, date: string, status: string) => {
      if (!pk || rank[status] === undefined) return;
      const key = `${pk}|${date}`;
      const prev = perDay.get(key);
      if (prev === undefined || rank[status] > rank[prev]) perDay.set(key, status);
    };

    // Count ONLY the attendance of the class being viewed — otherwise a student
    // linked across classes (general + English + PE) pulls other classes' absences
    // into this list (e.g. ថ្នាក់ទី៦ showed 43 even though it has no attendance rows).
    records.forEach(r => {
      if (r.grade !== selectedGrade) return;
      if (r.date === selectedDate) return; // current day merged live below
      if (r.studentStates) {
        Object.entries(r.studentStates).forEach(([studentId, status]) => {
          if (studentId.endsWith('_reason')) return;
          consider(idToPerson.get(studentId), r.date, status as string);
        });
      }
    });
    // Live draft for the current day.
    Object.entries(activeAttendanceMap).forEach(([studentId, status]) => {
      consider(idToPerson.get(studentId), selectedDate, status as string);
    });

    // Tally one entry per person-day.
    perDay.forEach((status, key) => {
      const pk = key.slice(0, key.indexOf('|'));
      if (!stats[pk]) stats[pk] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
      if (status === 'late') stats[pk].late += 1;
      else if (status === 'permission') { stats[pk].permission += 1; stats[pk].totalAbsence += 1; }
      else if (status === 'absent') { stats[pk].absent += 1; stats[pk].totalAbsence += 1; }
    });

    return stats;
  }, [records, students, uniqueStudentsList, selectedDate, selectedGrade, activeAttendanceMap]);

  // Export an attendance report (day / month / year) for the selected class to Excel.
  const exportAttendanceReport = (period: 'day' | 'month' | 'year') => {
    const grade = selectedGrade;
    const gradeStudents = uniqueStudentsList.filter(s => s.grade === grade);
    if (gradeStudents.length === 0) { triggerToast('⚠️ គ្មានសិស្សក្នុងថ្នាក់នេះទេ', 'error'); return; }
    const ym = selectedDate.slice(0, 7);
    const yr = selectedDate.slice(0, 4);
    const match = (d: string) => period === 'day' ? d === selectedDate : period === 'month' ? d.slice(0, 7) === ym : d.slice(0, 4) === yr;
    const relevant = records.filter(r => r.grade === grade && match(r.date));
    const periodLabel = period === 'day' ? `ប្រចាំថ្ងៃ ${selectedDate}` : period === 'month' ? `ប្រចាំខែ ${ym}` : `ប្រចាំឆ្នាំ ${yr}`;
    const header = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ', 'វត្តមាន', 'យឺត', 'ច្បាប់', 'អត់ច្បាប់', 'សរុបអវត្តមាន'];
    // Aggregate by person key (not the month-specific record id) so the totals
    // match the on-screen list and are identical on every device. See studentStatsMap.
    const idToPerson = new Map<string, string>();
    students.forEach(s => idToPerson.set((s as any).id, personKeyOf(s)));
    // Collapse to one status per person per DAY (worst wins) so morning+afternoon
    // sessions of a full-day absence count once, matching the on-screen totals.
    const rank: Record<string, number> = { present: 0, late: 1, permission: 2, absent: 3 };
    const perDay = new Map<string, { pk: string; status: string }>(); // key: pk@@date
    relevant.forEach(r => {
      Object.entries(r.studentStates || {}).forEach(([sid, st]) => {
        if (sid.endsWith('_reason') || rank[st as string] === undefined) return;
        const pk = idToPerson.get(sid);
        if (!pk) return;
        const key = `${pk}@@${r.date}`;
        const prev = perDay.get(key);
        if (prev === undefined || rank[st as string] > rank[prev.status]) perDay.set(key, { pk, status: st as string });
      });
    });
    const acc: Record<string, { present: number; late: number; perm: number; abs: number }> = {};
    perDay.forEach(({ pk, status }) => {
      if (!acc[pk]) acc[pk] = { present: 0, late: 0, perm: 0, abs: 0 };
      if (status === 'present') acc[pk].present++;
      else if (status === 'late') acc[pk].late++;
      else if (status === 'permission') acc[pk].perm++;
      else if (status === 'absent') acc[pk].abs++;
    });
    const body = gradeStudents.map((s, i) => {
      const a = acc[personKeyOf(s)] || { present: 0, late: 0, perm: 0, abs: 0 };
      return [i + 1, s.studentId || '', s.name, s.gender, a.present, a.late, a.perm, a.abs, a.perm + a.abs];
    });
    const sheet = [
      [`របាយការណ៍ចុះវត្តមានសិស្ស — ${grade}`],
      [periodLabel],
      [],
      header,
      ...body,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'វត្តមាន');
    const tag = period === 'day' ? `ប្រចាំថ្ងៃ_${selectedDate}` : period === 'month' ? `ប្រចាំខែ_${ym}` : `ប្រចាំឆ្នាំ_${yr}`;
    XLSX.writeFile(wb, `របាយការណ៍វត្តមាន_${tag}_${grade}.xlsx`);
    triggerToast(`📥 ទាញយករបាយការណ៍ ${periodLabel} (${grade}) ✓`, 'success');
  };

  // Sync student state mapping when date, grade, session, or records modify
  useEffect(() => {
    const extraSel = isExtraClass(selectedGrade);
    const existing = records.find(r => r.date === selectedDate && r.grade === selectedGrade && (extraSel || recordSession(r) === selectedSession));
    const gradeStudents = uniqueStudentsList.filter(s => s.grade === selectedGrade);
    
    if (existing && existing.studentStates && Object.keys(existing.studentStates).length > 0) {
      // Re-hydrate existing states, but ensure new students get designated as present
      const map: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      const reasons: { [studentId: string]: string } = {};
      gradeStudents.forEach(s => {
        map[s.id] = existing.studentStates[s.id] || 'present';
        reasons[s.id] = (existing.studentStates as any)[s.id + '_reason'] || '';
      });
      setActiveAttendanceMap(map);
      setStudentReasonsMap(reasons);
    } else {
      // Setup default (every student present)
      const map: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      const reasons: { [studentId: string]: string } = {};
      gradeStudents.forEach(s => {
        map[s.id] = 'present';
        reasons[s.id] = '';
      });
      setActiveAttendanceMap(map);
      setStudentReasonsMap(reasons);
    }
  }, [selectedDate, selectedGrade, selectedSession, records, uniqueStudentsList]);

  // Sync teacher state mapping when date or teacherRecords modify
  useEffect(() => {
    const existing = teacherRecords.find(r => r.date === selectedDate);
    
    if (existing && existing.teacherStates && Object.keys(existing.teacherStates).length > 0) {
      const map: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      const reasons: { [teacherId: string]: string } = {};
      teachersList.forEach(t => {
        map[t.id] = existing.teacherStates[t.id] || 'present';
        reasons[t.id] = (existing.teacherStates as any)[t.id + '_reason'] || '';
      });
      setTeacherAttendanceMap(map);
      setTeacherReasonsMap(reasons);
    } else {
      const map: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      const reasons: { [teacherId: string]: string } = {};
      teachersList.forEach(t => {
        map[t.id] = 'present';
        reasons[t.id] = '';
      });
      setTeacherAttendanceMap(map);
      setTeacherReasonsMap(reasons);
    }
  }, [selectedDate, teacherRecords, teachersList]);

  // Utility to display lightweight feedback notifications
  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Switch relative days (e.g. going back or forward in calendar)
  const shiftDay = (direction: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Distinct groups within the selected class (drives the group filter for extra classes).
  const availableAttGroups = Array.from(
    new Set<string>(uniqueStudentsList.filter(s => s.grade === selectedGrade && s.group).map(s => s.group as string))
  ).sort((a, b) => a.localeCompare(b, 'km'));

  // Filter students matching grade, group and query
  const displayStudents = uniqueStudentsList
    .filter(s => s.grade === selectedGrade)
    .filter(s => selectedAttGroup === 'ទាំងអស់' || (s.group || '') === selectedAttGroup)
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalInGrade = uniqueStudentsList.filter(s => s.grade === selectedGrade).length;

  // Mass manipulation utilities
  const markAllStatus = (status: 'present' | 'late' | 'permission' | 'absent') => {
    const gradeStudents = uniqueStudentsList.filter(s => s.grade === selectedGrade);
    const newMap = { ...activeAttendanceMap };
    gradeStudents.forEach(s => {
      newMap[s.id] = status;
    });
    setActiveAttendanceMap(newMap);
    triggerToast(
      status === 'present' 
        ? '✅ បានសម្គាល់សិស្សទាំងអស់ជា «វត្តមាន»' 
        : status === 'late'
          ? '🕒 បានសម្គាល់សិស្សទាំងអស់ជា «យឺត»'
          : status === 'permission'
            ? '⚠️ បានសម្គាល់សិស្សទាំងអស់ជា «ច្បាប់»'
            : '🚨 បានសម្គាល់សិស្សទាំងអស់ជា «អត់ច្បាប់»',
      status === 'present' || status === 'late' ? 'success' : 'info'
    );
  };

  // Attendance metrics calculation
  const presentCount = displayStudents.filter(s => (activeAttendanceMap[s.id] || 'present') === 'present').length;
  const lateCount = displayStudents.filter(s => activeAttendanceMap[s.id] === 'late').length;
  const permissionCount = displayStudents.filter(s => activeAttendanceMap[s.id] === 'permission').length;
  const absentCount = displayStudents.filter(s => activeAttendanceMap[s.id] === 'absent').length;

  const rate = totalInGrade > 0 ? Math.round(((presentCount + lateCount) / totalInGrade) * 100) : 100;

  // Persist the current daily snapshot
  const handleSaveAttendance = () => {
    const gradeStudents = uniqueStudentsList.filter(s => s.grade === selectedGrade);
    if (gradeStudents.length === 0) {
      triggerToast('⚠️ គ្មានឈ្មោះសិស្សនៅក្នុងថ្នាក់ដែលបានជ្រើសរើសឡើយ។', 'error');
      return;
    }

    // Validate that if a student is not 'present', a reason must be selected/provided.
    // If they choose 'ផ្សេងៗ' (Other), they must write down the actual reason in the text box.
    let validationFailed = false;
    let failedStudentName = "";
    let validationErrorMsg = "";

    for (const s of gradeStudents) {
      const status = activeAttendanceMap[s.id] || 'present';
      if (status !== 'present') {
        const reason = (studentReasonsMap[s.id] || '').trim();
        if (!reason) {
          validationFailed = true;
          failedStudentName = s.name;
          validationErrorMsg = `⚠️ សូមជ្រើសរើស ឬសរសេរបំពេញមូលហេតុជាក់ស្តែងសម្រាប់ការអវត្តមាន/យឺតយ៉ាវរបស់សិស្ស «${s.name}»`;
          break;
        } else if (reason === 'ផ្សេងៗ') {
          validationFailed = true;
          failedStudentName = s.name;
          validationErrorMsg = `⚠️ សម្រាប់ជម្រើស «ផ្សេងៗ» សូមសរសេរបញ្ជាក់ពីមូលហេតុជាក់ស្តែងដែលសិស្ស «${s.name}» អវត្តមាន`;
          break;
        }
      }
    }

    if (validationFailed) {
      triggerToast(validationErrorMsg, 'error');
      return;
    }

    let p = 0;
    let y = 0;
    let l = 0;
    let a = 0;

    const finalStates: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
    gradeStudents.forEach(s => {
      const status = activeAttendanceMap[s.id] || 'present';
      finalStates[s.id] = status;
      if (status !== 'present' && studentReasonsMap[s.id]) {
        (finalStates as any)[s.id + '_reason'] = studentReasonsMap[s.id];
      }
      if (status === 'present') p++;
      else if (status === 'late') y++;
      else if (status === 'permission') l++;
      else if (status === 'absent') a++;
    });

    const extraSel = isExtraClass(selectedGrade);
    const recordId = makeAttendanceId(selectedDate, selectedGrade, selectedSession);
    const newRecord: AttendanceRecord = {
      id: recordId,
      date: selectedDate,
      grade: selectedGrade,
      session: extraSel ? undefined : selectedSession,
      presentCount: p,
      lateCount: y,
      permissionCount: l,
      absentCount: a,
      studentStates: finalStates
    };

    const updated = [
      newRecord,
      ...records.filter(r => !(r.date === selectedDate && r.grade === selectedGrade && (extraSel || recordSession(r) === selectedSession)))
    ];

    setRecords(updated);

    // Cloud sync FIRST — Supabase is the authoritative store, so a full local
    // cache must never block the save (that previously threw and lost the record).
    const client = getSupabaseClient();
    if (client) {
      syncUpsertStudentAttendance(newRecord)
        .then(() => {
          // Instant Telegram notify to parents of today's absent students. Fires
          // only for TODAY and when there IS an absence/permission; the endpoint
          // dedups so each student gets at most one message per day (re-saves and
          // the daily cron won't repeat it).
          const todayICT = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (selectedDate === todayICT && (a + l) > 0) {
            fetch(`/api/telegram-notify?date=${selectedDate}`, { method: 'POST' })
              .catch(err => console.warn('telegram-notify trigger failed', err));
          }
        })
        .catch(err => {
          console.warn('Supabase student attendance save failed', err);
          triggerToast('⚠️ ភ្ជាប់ Cloud បរាជ័យ — សូមពិនិត្យអ៊ីនធឺណិត', 'error');
        });
    }

    // Local cache — prunes the oldest records if the browser quota is exceeded
    // (the cloud keeps full history); never throws.
    const { ok, evicted } = persistAttendance(updated);
    if (evicted > 0) console.warn(`Attendance cache trimmed ${evicted} old local record(s); full history stays in Supabase.`);
    if (!ok) {
      triggerToast('⚠️ ឧបករណ៍ផ្ទុកក្នុងម៉ាស៊ីនពេញ! ត្រូវការ Cloud ភ្ជាប់ ដើម្បីកុំឱ្យបាត់ទិន្នន័យ', 'error');
    } else {
      triggerToast(`💾 រក្សាទុកវត្តមានជោគជ័យ៖ សរុប ${p} នាក់វត្តមាន | ${y} នាក់យឺត | ${l} នាក់ច្បាប់ | ${a} នាក់អត់ច្បាប់${client ? ' ☁️ ភ្ជាប់ Supabase ✓' : ' (មិនបានភ្ជាប់ Cloud)'}`, 'success');
    }
  };

  // Filter teachers matching search query and role-based access
  const displayTeachers = useMemo(() => {
    let list = teachersList;
    if (currentUser?.role === 'teacher') {
      list = teachersList.filter(t => t.id === currentUser.id || t.name === currentUser.name);
    }
    return list.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.grade.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teachersList, currentUser, searchQuery]);

  const totalTeachersCount = displayTeachers.length;
  const teacherPresentCount = displayTeachers.filter(t => (teacherAttendanceMap[t.id] || 'present') === 'present').length;
  const teacherLateCount = displayTeachers.filter(t => teacherAttendanceMap[t.id] === 'late').length;
  const teacherPermissionCount = displayTeachers.filter(t => teacherAttendanceMap[t.id] === 'permission').length;
  const teacherAbsentCount = displayTeachers.filter(t => teacherAttendanceMap[t.id] === 'absent').length;

  const teacherRate = totalTeachersCount > 0 ? Math.round(((teacherPresentCount + teacherLateCount) / totalTeachersCount) * 100) : 100;

  const markAllTeachersStatus = (status: 'present' | 'late' | 'permission' | 'absent') => {
    const newMap = { ...teacherAttendanceMap };
    teachersList.forEach(t => {
      newMap[t.id] = status;
    });
    setTeacherAttendanceMap(newMap);
    triggerToast(
      status === 'present' 
        ? '✅ បានសម្គាល់គ្រូបង្រៀនទាំងអស់ជា «វត្តមាន»' 
        : status === 'late'
          ? '🕒 បានសម្គាល់គ្រូបង្រៀនទាំងអស់ជា «យឺត»'
          : status === 'permission'
            ? '⚠️ បានសម្គាល់គ្រូបង្រៀនទាំងអស់ជា «ច្បាប់»'
            : '🚨 បានសម្គាល់គ្រូបង្រៀនទាំងអស់ជា «អត់ច្បាប់»',
      status === 'present' || status === 'late' ? 'success' : 'info'
    );
  };

  const handleSaveTeacherAttendance = () => {
    // Validate we have a written reason if not present
    let validationFailed = false;
    let failedTeacherName = "";
    let validationErrorMsg = "";

    for (const t of displayTeachers) {
      const status = teacherAttendanceMap[t.id] || 'present';
      if (status !== 'present') {
        const reason = (teacherReasonsMap[t.id] || '').trim();
        if (!reason) {
          validationFailed = true;
          failedTeacherName = t.name;
          validationErrorMsg = `⚠️ សូមសរសេរបញ្ជាក់ពីមូលហេតុជាក់ស្តែងសម្រាប់ការអវត្តមាន/យឺតយ៉ាវរបស់គ្រូ «${t.name}»`;
          break;
        }
      }
    }

    if (validationFailed) {
      triggerToast(validationErrorMsg, 'error');
      return;
    }

    let p = 0;
    let y = 0;
    let l = 0;
    let a = 0;

    const finalStates: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
    teachersList.forEach(t => {
      const status = teacherAttendanceMap[t.id] || 'present';
      finalStates[t.id] = status;
      if (status !== 'present' && teacherReasonsMap[t.id]) {
        (finalStates as any)[t.id + '_reason'] = teacherReasonsMap[t.id];
      }
      if (status === 'present') p++;
      else if (status === 'late') y++;
      else if (status === 'permission') l++;
      else if (status === 'absent') a++;
    });

    const recordId = `t-att-${selectedDate}`;
    const newRecord: TeacherAttendanceRecord = {
      id: recordId,
      date: selectedDate,
      presentCount: p,
      lateCount: y,
      permissionCount: l,
      absentCount: a,
      teacherStates: finalStates
    };

    const updated = [
      newRecord,
      ...teacherRecords.filter(r => r.date !== selectedDate)
    ];

    setTeacherRecords(updated);
    localStorage.setItem('school_teachers_daily_attendance', JSON.stringify(updated));

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      syncUpsertTeacherAttendance(newRecord).catch(err => {
        console.warn('Supabase teacher attendance save failed', err);
        triggerToast('⚠️ រក្សាទុកក្នុងម៉ាស៊ីន — ភ្ជាប់ Cloud បរាជ័យ', 'error');
      });
    }

    triggerToast(`💾 រក្សាទុកវត្តមានគ្រូជោគជ័យ៖ សរុប ${p} នាក់វត្តមាន | ${y} នាក់យឺត | ${l} នាក់ច្បាប់ | ${a} នាក់អត់ច្បាប់${client ? ' ☁️ ភ្ជាប់ Supabase ✓' : ' (មិនបានភ្ជាប់ Cloud)'}`, 'success');
  };

  const handleAttendancePaste = (e: React.ClipboardEvent<HTMLTableSectionElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    
    const target = e.target as HTMLElement;
    let tr = target.closest('tr');
    
    e.preventDefault();
    
    let startRow = 0;
    if (tr && tr.parentElement) {
      startRow = Array.from(tr.parentElement.children).indexOf(tr);
      if (startRow === -1) startRow = 0;
    }
    
    const rows = text.split(/\r?\n/).filter(r => r.trim() !== '');
    const newMap = { ...activeAttendanceMap };
    let changed = false;

    rows.forEach((rowText, rOffset) => {
      const val = rowText.split('\t')[0].trim().toLowerCase();
      const targetRowIdx = startRow + rOffset;
      if (targetRowIdx >= displayStudents.length) return;
      const stTarget = displayStudents[targetRowIdx];
      
      let status: 'present' | 'late' | 'permission' | 'absent' | null = null;
      if (['p', 'វ', '1', 'v', 'present', 'វត្តមាន', 'មក'].includes(val)) status = 'present';
      else if (['l', 'យ', 'y', 'late', 'យឺត'].includes(val)) status = 'late';
      else if (['c', 'ច', 'permission', 'ច្បាប់', 'សុំច្បាប់'].includes(val)) status = 'permission';
      else if (['a', 'អ', '0', 'absent', 'អវត្តមាន', 'អត់ច្បាប់'].includes(val)) status = 'absent';
      
      if (status) {
        newMap[stTarget.id] = status;
        changed = true;
      }
    });
    
    if (changed) {
      setActiveAttendanceMap(newMap);
      triggerToast('✅ បាន Paste ទិន្នន័យវត្តមានពី Excel រួចរាល់!', 'success');
    } else {
      triggerToast('⚠️ មិនមានទិន្នន័យត្រឹមត្រូវសម្រាប់ Paste ទេ! សូមពិនិត្យទិន្នន័យរបស់អ្នកឡើងវិញ។', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert overlay */}
      {toast && (
        <div className="fixed top-20 right-8 z-50 animate-bounce">
          <div className={`p-4 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs font-bold font-sans ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : toast.type === 'error'
                ? 'bg-rose-50 text-rose-805 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <span>🔔</span>
            <p className="font-semibold">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Class-category selector (general / extra) at the very top — students only,
          hidden for teachers who are locked to their own class. */}
      {activeTab === 'student' && currentUser?.role !== 'teacher' && (
        <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl shadow-3xs border border-slate-200 w-full">
          <button
            onClick={() => {
              setClassCategory('general');
              const f = grades.find(g => !isExtraClass(g));
              if (f) setSelectedGrade(f);
              setSearchQuery('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${classCategory === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            📘 ថ្នាក់ចំណេះទូទៅ
          </button>
          <button
            onClick={() => {
              setClassCategory('extra');
              const f = grades.find(g => isExtraClass(g));
              if (f) setSelectedGrade(f);
              setSearchQuery('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            🎨 ថ្នាក់ក្រៅម៉ោង
          </button>
        </div>
      )}

      {/* Main Banner Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-blue-600 font-bold mb-1.5">
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-bold">{t('att.sms')}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 font-serif">កត់វត្តមានប្រចាំថ្ងៃ</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            គ្រប់គ្រង និងតាមដានវត្តមានរបស់សិស្សានុសិស្ស និងគ្រូបង្រៀនប្រចាំថ្ងៃ រក្សាទុកទិន្នន័យច្បាស់លាស់។
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 self-start md:self-auto">
        {/* Morning / afternoon shift selector — general classes only */}
        {activeTab === 'student' && !isExtraClass(selectedGrade) && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {SESSIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedSession(s.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${selectedSession === s.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s.icon} {s.km}
              </button>
            ))}
          </div>
        )}

        {/* Quick Date Control widget */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
          <button
            onClick={() => shiftDay(-1)}
            className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
            title={t('att.tt.prevDay')}
          >
            <ArrowLeft size={14} />
          </button>
          
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-500" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-800 cursor-pointer text-xs"
            />
          </div>

          <button 
            onClick={() => shiftDay(1)}
            className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
            title={t('att.tt.nextDay')}
          >
            <ArrowRight size={14} />
          </button>
        </div>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-96 border border-slate-300/30 gap-1.5 shadow-3xs">
        <button
          onClick={() => {
            setActiveTab('student');
            setSearchQuery('');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
            activeTab === 'student'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <UserCheck size={14} />
          <span>{t('att.studentTab')}</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('teacher');
            setSearchQuery('');
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
            activeTab === 'teacher'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Users2 size={14} className="text-blue-500" />
          <span>{t('att.teacherTab')}</span>
        </button>
      </div>

      {/* Top statistics summary modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Registered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
            {activeTab === 'student' ? <UserCheck className="w-6 h-6" /> : <Users2 className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {activeTab === 'student' ? 'សិស្សសកម្មក្នុងថ្នាក់' : 'គ្រូបង្រៀនសរុប'}
            </p>
            <h3 className="text-xl font-black text-slate-800 mt-1">
              {activeTab === 'student' ? `${totalInGrade} នាក់` : `${totalTeachersCount} នាក់`}
            </h3>
          </div>
        </div>

        {/* Metric 2: Present */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] border border-emerald-100 flex items-center justify-center text-[#137333]">
            <span className="text-sm font-black">{t('att.abbr.present')}</span>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {activeTab === 'student' ? 'សិស្សមានវត្តមាន' : 'គ្រូបង្រៀនវត្តមាន'}
            </p>
            <h3 className="text-xl font-black text-emerald-700 mt-1">
              {activeTab === 'student' 
                ? `${totalInGrade > 0 ? presentCount : 0} នាក់` 
                : `${teacherPresentCount} នាក់`}
            </h3>
          </div>
        </div>

        {/* Metric 3: Late */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#E8F0FE] border border-blue-100 flex items-center justify-center text-[#1a73e8]">
            <span className="text-sm font-black">{t('att.abbr.late')}</span>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {activeTab === 'student' ? 'សិស្សមកយឺត' : 'គ្រូបង្រៀនមកយឺត'}
            </p>
            <h3 className="text-xl font-black text-blue-600 mt-1">
              {activeTab === 'student' 
                ? `${totalInGrade > 0 ? lateCount : 0} នាក់` 
                : `${teacherLateCount} នាក់`}
            </h3>
          </div>
        </div>

        {/* Metric 4: Permission */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF7E0] border border-amber-100 flex items-center justify-center text-[#B06000]">
            <span className="text-sm font-black">{t('att.abbr.permission')}</span>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {activeTab === 'student' ? 'សិស្សមានច្បាប់' : 'គ្រូបង្រៀនច្បាប់'}
            </p>
            <h3 className="text-xl font-black text-amber-600 mt-1">
              {activeTab === 'student' 
                ? `${totalInGrade > 0 ? permissionCount : 0} នាក់` 
                : `${teacherPermissionCount} នាក់`}
            </h3>
          </div>
        </div>

        {/* Metric 5: Absent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FCE8E6] border border-rose-100 flex items-center justify-center text-[#C5221F]">
            <span className="text-sm font-black">{t('att.abbr.absent')}</span>
          </div>
          <div>
            <p className="text-[#EA4335] text-[10px] font-bold uppercase tracking-wider">
              {activeTab === 'student' ? 'សិស្សអត់ច្បាប់' : 'គ្រូបង្រៀនអត់ច្បាប់'}
            </p>
            <h3 className="text-xl font-black text-rose-600 mt-1">
              {activeTab === 'student' 
                ? `${totalInGrade > 0 ? absentCount : 0} នាក់` 
                : `${teacherAbsentCount} នាក់`}
            </h3>
          </div>
        </div>
      </div>

      {/* Primary configuration controls with attendance details layout */}
      <div className="flex flex-col gap-6 items-start w-full">
        {/* Top Controls: Filters */}
        <div className="w-full">
          {activeTab === 'student' ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-wrap md:flex-row gap-6 items-center lg:justify-between w-full">
              <div className="flex flex-col md:flex-row items-center gap-6 grow w-full lg:w-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xl">⚙️</span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">ការជ្រើសរើស<br className="hidden lg:block "/>{t('common.classroom')}</h3>
                </div>
                
                {/* Grade filter */}
                <div className="space-y-1.5 flex-1 w-full min-w-[200px]">
                  <label className="block text-[10.5px] text-slate-500 font-bold">
                    ជ្រើសរើសតម្រងថ្នាក់{isGeneralTeacher && ' 🔒'}
                  </label>
                  <select
                    value={selectedGrade}
                    disabled={isGeneralTeacher}
                    onChange={(e) => {
                      setSelectedGrade(e.target.value);
                      setSearchQuery('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-3xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    {gradeOptions.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Quick Filter Search Input */}
                <div className="space-y-1.5 flex-1 w-full min-w-[200px]">
                  <label className="block text-[10.5px] text-slate-500 font-bold">{t('att.searchStudent')}</label>
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-3xs transition-all w-full">
                    <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="វាយឈ្មោះសិស្សស្វែងរក..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-slate-800 w-full outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance rate gauge */}
              <div className="pt-2 w-full lg:w-64 shrink-0 mt-2 lg:mt-0">
                <div className="flex justify-between text-[10.5px] font-bold mb-1.5">
                  <span className="text-slate-500">{t('att.dailyRateStudent')}</span>
                  <span className={rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-500' : 'text-rose-500'}>{rate}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100/50">
                  <div 
                    className={`h-full transition-all duration-550 rounded-full ${
                      rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex flex-wrap md:flex-row gap-6 items-center lg:justify-between w-full">
              <div className="flex flex-col md:flex-row items-center gap-6 grow w-full lg:w-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xl">⚙️</span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">តម្រងស្វែងរក<br className="hidden lg:block"/>{t('att.teachers')}</h3>
                </div>
                
                {/* Quick Filter Search Input */}
                <div className="space-y-1.5 flex-[2] w-full min-w-[250px]">
                  <label className="block text-[10.5px] text-slate-500 font-bold">{t('att.searchTeacher')}</label>
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-3xs transition-all w-full">
                    <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="វាយឈ្មោះ ឬថ្នាក់របស់គ្រូស្វែងរក..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-slate-800 w-full outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance rate gauge */}
              <div className="pt-2 w-full lg:w-64 shrink-0 mt-2 lg:mt-0">
                <div className="flex justify-between text-[10.5px] font-bold mb-1.5">
                  <span className="text-slate-500">{t('att.dailyRateTeacher')}</span>
                  <span className={teacherRate >= 90 ? 'text-emerald-600' : teacherRate >= 75 ? 'text-amber-500' : 'text-rose-500'}>{teacherRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100/50">
                  <div 
                    className={`h-full transition-all duration-550 rounded-full ${
                      teacherRate >= 90 ? 'bg-emerald-500' : teacherRate >= 75 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${teacherRate}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Area: Attendance Sheet Table Full Width */}
        <div className="w-full">
          {activeTab === 'student' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2.5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📋 បញ្ជីឈ្មោះសិស្ស និងការចុះវត្តមាន ({selectedGrade})</h3>
                </div>
                <div className="flex items-center gap-2">
                  {/* Group filter — take attendance one group at a time. */}
                  {isExtraClass(selectedGrade) && availableAttGroups.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500">{t('cls.groupLabel')}</span>
                      <select
                        value={selectedAttGroup}
                        onChange={(e) => setSelectedAttGroup(e.target.value)}
                        className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-indigo-700 font-bold outline-none focus:border-blue-500"
                      >
                        <option value="ទាំងអស់">{t('cls.allGroups')}</option>
                        {availableAttGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Download attendance reports */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 hidden sm:inline">ទាញយក៖</span>
                    <button
                      onClick={() => exportAttendanceReport('day')}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="ទាញយករបាយការណ៍វត្តមានប្រចាំថ្ងៃ (Excel)"
                    >
                      <Download size={12} /> ប្រចាំថ្ងៃ
                    </button>
                    <button
                      onClick={() => exportAttendanceReport('month')}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="ទាញយករបាយការណ៍វត្តមានប្រចាំខែ (Excel)"
                    >
                      <Download size={12} /> ប្រចាំខែ
                    </button>
                    <button
                      onClick={() => exportAttendanceReport('year')}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="ទាញយករបាយការណ៍វត្តមានប្រចាំឆ្នាំ (Excel)"
                    >
                      <Download size={12} /> ប្រចាំឆ្នាំ
                    </button>
                    <button
                      onClick={() => setMonthlyRegisterOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                      title="តារាងតាមដានអវត្តមានប្រចាំខែ (មើល / នាំចូល / ទាញយក Excel)"
                    >
                      <ClipboardList size={12} /> តារាងអវត្តមានប្រចាំខែ
                    </button>
                  </div>
                  <span className="text-[10.5px] text-slate-500 font-bold bg-white px-2.5 py-1 border border-slate-200 rounded-lg">
                    សរុប៖ <b>{displayStudents.length}</b> នាក់
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-slate-700 text-xs font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left font-bold select-none text-[10px] uppercase tracking-wider">
                      <th className="px-5 py-3 w-12 text-center">{t('common.no')}</th>
                      <th className="px-5 py-3 sticky left-0 z-10 bg-slate-50 border-r border-slate-200/60 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{t('common.studentName')}</th>
                      <th className="px-5 py-3 hidden sm:table-cell">{t('common.gender')}</th>
                      <th className="px-3 py-3 text-center text-blue-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totLate')}</th>
                      <th className="px-3 py-3 text-center text-amber-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totPerm')}</th>
                      <th className="px-3 py-3 text-center text-rose-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totUnexcused')}</th>
                      <th className="px-3 py-3 text-center text-red-700 font-black whitespace-nowrap text-[10.5px] bg-red-50/50 rounded-lg">{t('att.totAbsence')}</th>
                      <th className="px-5 py-3 text-center w-52">{t('att.setStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" onPaste={handleAttendancePaste}>
                    {displayStudents.length > 0 ? (
                      displayStudents.map((std, idx) => {
                        const currentStatus = activeAttendanceMap[std.id] || 'present';
                        const stats = studentStatsMap[personKeyOf(std)] || { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
                        return (
                          <tr key={std.id} className="hover:bg-slate-50/70 transition-all group">
                            {/* Number Index */}
                            <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px] group-hover:bg-slate-50/70">{idx + 1}</td>
                            
                            {/* Profile & Name */}
                            <td className="px-5 py-3.5 sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 transition-all border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                              <div className="flex items-center gap-2.5">
                                <div>
                                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                                    {std.name}
                                    {std.group && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">ក្រុម {std.group}</span>}
                                  </p>
                                  <p className="text-[9.5px] text-slate-400 font-medium">ភេទ៖ {std.gender} | អត្តលេខ៖ {schoolIdOf(std)}</p>
                                </div>
                              </div>
                            </td>

                            {/* Gender */}
                            <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500">{std.gender}</td>

                            {/* Cumulative Late (យឺត) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shadow-3xs" title={t('att.tt.totLate')}>
                                {stats.late}
                              </span>
                            </td>

                            {/* Cumulative Permission (ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-3xs" title={t('att.tt.totPerm')}>
                                {stats.permission}
                              </span>
                            </td>

                            {/* Cumulative Absent without permission (អត់ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-rose-50 text-rose-700 border border-rose-250 shadow-3xs" title={t('att.tt.totUnexcused')}>
                                {stats.absent}
                              </span>
                            </td>

                            {/* Cumulative Total Absences (អវត្តមានសរុប = ច្បាប់ + អត់ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center bg-red-50/20">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-red-100 text-red-800 border border-red-300 shadow-2xs" title={t('att.tt.totAbsence')}>
                                {stats.totalAbsence}
                              </span>
                            </td>

                            {/* P, L, A Radio Selectors */}
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                  <button
                                    onClick={() => {
                                      setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'present' }));
                                      setStudentReasonsMap(prev => ({ ...prev, [std.id]: '' }));
                                    }}
                                    title={t('att.tt.present')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'present' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.present')}</span>
                                  </button>

                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'late' }))}
                                    title={t('att.tt.late')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'late'
                                        ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'late' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.late')}</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'permission' }))}
                                    title={t('att.tt.permission')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'permission'
                                        ? 'bg-amber-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'permission' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.permission')}</span>
                                  </button>

                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'absent' }))}
                                    title={t('att.tt.absent')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'absent'
                                        ? 'bg-rose-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'absent' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.absent')}</span>
                                  </button>
                                </div>

                                {/* Reason Selector if not present */}
                                {currentStatus !== 'present' && (
                                  <div className="w-full max-w-[190px] flex flex-col gap-1 items-start">
                                    <select
                                      value={PREDEFINED_REASONS.includes(studentReasonsMap[std.id] || '') ? (studentReasonsMap[std.id] || '') : 'ផ្សេងៗ'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStudentReasonsMap(prev => ({ ...prev, [std.id]: val }));
                                      }}
                                      className="w-full bg-slate-55 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-sans text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    >
                                      <option value="">{t('att.selectReason')}</option>
                                      {ABSENCE_REASON_GROUPS.map(group => (
                                        <optgroup key={group.label} label={group.label}>
                                          {group.options.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </optgroup>
                                      ))}
                                      <option value="ផ្សេងៗ">៦. ផ្សេងៗ (សរសេរ)..........</option>
                                    </select>
                                    
                                    {!PREDEFINED_REASONS.includes(studentReasonsMap[std.id] || '') && (
                                      <div className="w-full flex flex-col gap-1">
                                        <input
                                          type="text"
                                          placeholder="សរសេរមូលហេតុជាក់ស្តែង..."
                                          value={studentReasonsMap[std.id] === 'ផ្សេងៗ' ? '' : (studentReasonsMap[std.id] || '')}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setStudentReasonsMap(prev => ({ ...prev, [std.id]: val }));
                                          }}
                                          className={`w-full border rounded-md px-2.5 py-1 text-[10.5px] font-sans text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none ${
                                            studentReasonsMap[std.id] === 'ផ្សេងៗ' || !studentReasonsMap[std.id]
                                              ? 'bg-red-50 border-red-300'
                                              : 'bg-slate-50 border-slate-200'
                                          }`}
                                        />
                                        {(studentReasonsMap[std.id] === 'ផ្សេងៗ' || !studentReasonsMap[std.id]) && (
                                          <span className="text-[9px] text-red-500 font-bold font-sans self-start ml-1 animate-pulse">
                                            * ត្រូវសរសេរបញ្ជាក់ពីមូលហេតុជាក់ស្តែង
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-400 text-xs text-bold">
                          <p className="text-xl mb-1">📭</p>
                          <p className="font-bold">{t('att.noStudents')}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Save Buttons Panel at footer of list */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => {
                    const map: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
                    const reasons: { [studentId: string]: string } = {};
                    uniqueStudentsList.filter(s => s.grade === selectedGrade).forEach(s => {
                      map[s.id] = 'present';
                      reasons[s.id] = '';
                    });
                    setActiveAttendanceMap(map);
                    setStudentReasonsMap(reasons);
                    triggerToast('🔄 បានធ្វើឱ្យវត្តមានត្រលប់មកដើមវិញ (វត្តមានទាំងអស់)', 'info');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-605 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{t('common.reset')}</span>
                </button>

                <button
                  onClick={handleSaveAttendance}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                >
                  <CheckCircle size={13} />
                  <span>{t('att.saveAllStudent')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TEACHER LIST TAB CONTENT */}
          {activeTab === 'teacher' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Settings / Top Bar */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-blue-50 text-blue-700 font-black font-sans text-xs rounded-lg border border-blue-200/50 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    ថ្ងៃនេះទី៖ {selectedDate}
                  </div>
                </div>
                
                <div className="text-xs text-slate-500 font-medium">
                  សរុប៖ <b>{displayTeachers.length}</b> នាក់
                </div>
              </div>

              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left font-bold select-none text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 w-12 text-center">{t('common.no')}</th>
                      <th className="px-5 py-3 sticky left-0 z-10 bg-slate-50 border-r border-slate-200/60 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{t('att.teacherName')}</th>
                      <th className="px-5 py-3 hidden sm:table-cell">{t('att.teacherClass')}</th>
                      <th className="px-3 py-3 text-center text-blue-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totLate')}</th>
                      <th className="px-3 py-3 text-center text-amber-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totPerm')}</th>
                      <th className="px-3 py-3 text-center text-rose-600 font-black whitespace-nowrap text-[10.5px]">{t('att.totUnexcused')}</th>
                      <th className="px-3 py-3 text-center text-red-700 font-black whitespace-nowrap text-[10.5px] bg-red-50/50 rounded-lg">{t('att.totAbsence')}</th>
                      <th className="px-5 py-3 text-center w-52">{t('att.setStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayTeachers.length > 0 ? (
                      displayTeachers.map((tc, idx) => {
                        const currentStatus = teacherAttendanceMap[tc.id] || 'present';
                        const tcStats = teacherStatsMap[tc.id] || { present: 0, late: 0, permission: 0, absent: 0 };
                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/70 transition-all group">
                            {/* Index */}
                            <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px] group-hover:bg-slate-50/70">{idx + 1}</td>
                            
                            {/* Profile Info */}
                            <td className="px-5 py-3.5 sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 transition-all border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs select-none shadow-3xs ${tc.avatarBg}`}>
                                  {tc.photoCode || 'គ្រូ'}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{tc.name}</p>
                                  <p className="text-[9.5px] text-slate-400 font-medium">ID: {tc.id} | តួនាទី៖ គ្រូបង្រៀន</p>
                                </div>
                              </div>
                            </td>

                            {/* Specialty / Grade */}
                            <td className="px-5 py-3.5 hidden sm:table-cell">
                              <span className="inline-block px-2.5 py-1 bg-blue-50/40 text-blue-700 border border-blue-200/40 rounded-lg text-[10px] font-bold">
                                {tc.grade}
                              </span>
                            </td>

                            {/* Cumulative Late (យ) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shadow-3xs" title={t('att.tt.totLate')}>
                                {tcStats.late}
                              </span>
                            </td>

                            {/* Cumulative Permission (ច្ប) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-3xs" title={t('att.tt.totPerm')}>
                                {tcStats.permission}
                              </span>
                            </td>

                            {/* Cumulative Absent (អច្ប) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-rose-50 text-rose-700 border border-rose-250 shadow-3xs" title={t('att.tt.totUnexcused')}>
                                {tcStats.absent}
                              </span>
                            </td>

                            {/* Cumulative Total Absences (អវត្តមានសរុប = ច្បាប់ + អត់ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center bg-red-50/20">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-red-100 text-red-800 border border-red-300 shadow-2xs" title="សរុបអវត្តមាន">
                                {tcStats.totalAbsence}
                              </span>
                            </td>

                            {/* P, L, A Picker buttons + Reason text input */}
                            <td className="px-5 py-3.5 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                  <button
                                    onClick={() => {
                                      setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'present' }));
                                      setTeacherReasonsMap(prev => ({ ...prev, [tc.id]: '' }));
                                    }}
                                    title={t('att.tt.present')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'present' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.present')}</span>
                                  </button>

                                  <button
                                    onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'late' }))}
                                    title={t('att.tt.late')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'late'
                                        ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'late' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.late')}</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'permission' }))}
                                    title={t('att.tt.permission')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'permission'
                                        ? 'bg-amber-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'permission' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.permission')}</span>
                                  </button>

                                  <button
                                    onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'absent' }))}
                                    title={t('att.tt.absent')}
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'absent'
                                        ? 'bg-rose-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'absent' && <Check size={10} strokeWidth={3} />}
                                    <span>{t('att.abbr.absent')}</span>
                                  </button>
                                </div>

                                {/* Reason input if not present */}
                                {currentStatus !== 'present' && (
                                  <div className="w-full max-w-[190px] flex flex-col gap-1 items-start">
                                    <select
                                      value={['', 'បញ្ហាសុខភាព', 'មានធុរៈក្នុងគ្រួសារ', 'ជាប់បេសកកម្ម'].includes(teacherReasonsMap[tc.id] || '') ? (teacherReasonsMap[tc.id] || '') : 'ផ្សេងៗ'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTeacherReasonsMap(prev => ({ ...prev, [tc.id]: val }));
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-sans text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    >
                                      <option value="">{t('att.selectReason')}</option>
                                      <option value="បញ្ហាសុខភាព">១. បញ្ហាសុខភាព</option>
                                      <option value="មានធុរៈក្នុងគ្រួសារ">២. មានធុរៈក្នុងគ្រួសារ</option>
                                      <option value="ជាប់បេសកកម្ម">៣. ជាប់បេសកកម្ម</option>
                                      <option value="ផ្សេងៗ">៤. ផ្សេងៗ (សរសេរ)..........</option>
                                    </select>
                                    
                                    {!['', 'បញ្ហាសុខភាព', 'មានធុរៈក្នុងគ្រួសារ', 'ជាប់បេសកកម្ម'].includes(teacherReasonsMap[tc.id] || '') && (
                                      <div className="w-full flex flex-col gap-1">
                                        <input
                                          type="text"
                                          placeholder="សរសេរមូលហេតុជាក់ស្តែង..."
                                          value={teacherReasonsMap[tc.id] === 'ផ្សេងៗ' ? '' : (teacherReasonsMap[tc.id] || '')}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setTeacherReasonsMap(prev => ({ ...prev, [tc.id]: val }));
                                          }}
                                          className={`w-full border rounded-md px-2.5 py-1 text-[10.5px] font-sans text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none ${
                                            teacherReasonsMap[tc.id] === 'ផ្សេងៗ' || !teacherReasonsMap[tc.id]
                                              ? 'bg-red-50 border-red-300'
                                              : 'bg-slate-50 border-slate-200'
                                          }`}
                                        />
                                        {(teacherReasonsMap[tc.id] === 'ផ្សេងៗ' || !teacherReasonsMap[tc.id]) && (
                                          <span className="text-[9px] text-red-500 font-bold font-sans self-start ml-1 animate-pulse">
                                            * ត្រូវសរសេរបញ្ជាក់ពីមូលហេតុជាក់ស្តែង
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-slate-400 text-xs font-bold">
                          <p className="text-xl mb-1">📭</p>
                          <p>{t('att.noTeachers')}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Save buttons section for Teachers */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => {
                    const map: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
                    const reasons: { [teacherId: string]: string } = {};
                    teachersList.forEach(t => {
                      map[t.id] = 'present';
                      reasons[t.id] = '';
                    });
                    setTeacherAttendanceMap(map);
                    setTeacherReasonsMap(reasons);
                    triggerToast('🔄 បានធ្វើឱ្យវត្តមានគ្រូត្រលប់មកដើមវិញ (វត្តមានទាំងអស់)', 'info');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-605 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{t('common.reset')}</span>
                </button>

                <button
                  onClick={handleSaveTeacherAttendance}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                >
                  <CheckCircle size={13} />
                  <span>{t('att.saveTeacher')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {monthlyRegisterOpen && (
        <MonthlyAttendanceRegister
          students={uniqueStudentsList}
          allStudents={students}
          grade={selectedGrade}
          year={parseInt(selectedDate.slice(0, 4), 10)}
          month={parseInt(selectedDate.slice(5, 7), 10)}
          records={records}
          onClose={() => setMonthlyRegisterOpen(false)}
          onImport={handleMonthlyImport}
          onClear={handleMonthlyClear}
          onClearAll={handleClearGradeAll}
        />
      )}
    </div>
  );
}
