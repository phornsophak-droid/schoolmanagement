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
  Users2
} from 'lucide-react';
import { StudentScore, SchoolUser } from '../types';
import { AVAILABLE_USERS } from './LoginPortal';
import { 
  getSupabaseClient, 
  syncUpsertStudentAttendance, 
  syncUpsertTeacherAttendance 
} from '../lib/supabase';

interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
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
    return grades[0] || 'ថ្នាក់ទី ១ក';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Load persistence records for students
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('school_daily_attendance');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved attendance records', e);
      }
    }
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

  // Compile list of teachers from AVAILABLE_USERS
  const teachersList = AVAILABLE_USERS.filter(u => u.role === 'teacher');

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

  // Compute cumulative student attendance statistics based on historical records + current active mappings
  const studentStatsMap = useMemo(() => {
    const stats: { [studentId: string]: { late: number; permission: number; absent: number; totalAbsence: number } } = {};
    
    // Initialize stats for each student to prevent undefined references
    uniqueStudentsList.forEach(s => {
      stats[s.id] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
    });

    // Populate using saved records, excluding the current draft's date & grade so we don't double count it
    records.forEach(r => {
      if (r.date === selectedDate && r.grade === selectedGrade) {
        return; // Exclude current date because we will merge activeAttendanceMap live!
      }
      if (r.studentStates) {
        Object.entries(r.studentStates).forEach(([studentId, status]) => {
          if (studentId.endsWith('_reason')) return;
          
          if (!stats[studentId]) {
            stats[studentId] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
          }
          
          if (status === 'late') {
            stats[studentId].late += 1;
          } else if (status === 'permission') {
            stats[studentId].permission += 1;
            stats[studentId].totalAbsence += 1;
          } else if (status === 'absent') {
            stats[studentId].absent += 1;
            stats[studentId].totalAbsence += 1;
          }
        });
      }
    });

    // Merge the live draft state so changes reflect instantly in real-time
    Object.entries(activeAttendanceMap).forEach(([studentId, status]) => {
      if (!stats[studentId]) {
        stats[studentId] = { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
      }
      if (status === 'late') {
        stats[studentId].late += 1;
      } else if (status === 'permission') {
        stats[studentId].permission += 1;
        stats[studentId].totalAbsence += 1;
      } else if (status === 'absent') {
        stats[studentId].absent += 1;
        stats[studentId].totalAbsence += 1;
      }
    });

    return stats;
  }, [records, uniqueStudentsList, selectedDate, selectedGrade, activeAttendanceMap]);

  // Sync student state mapping when date, grade, or records modify
  useEffect(() => {
    const existing = records.find(r => r.date === selectedDate && r.grade === selectedGrade);
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
  }, [selectedDate, selectedGrade, records, uniqueStudentsList]);

  // Sync teacher state mapping when date or teacherRecords modify
  useEffect(() => {
    const existing = teacherRecords.find(r => r.date === selectedDate);
    
    if (existing && existing.teacherStates && Object.keys(existing.teacherStates).length > 0) {
      const map: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      teachersList.forEach(t => {
        map[t.id] = existing.teacherStates[t.id] || 'present';
      });
      setTeacherAttendanceMap(map);
    } else {
      const map: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      teachersList.forEach(t => {
        map[t.id] = 'present';
      });
      setTeacherAttendanceMap(map);
    }
  }, [selectedDate, teacherRecords]);

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

  // Filter students matching grade and query
  const displayStudents = uniqueStudentsList
    .filter(s => s.grade === selectedGrade)
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

    const recordId = `att-${selectedDate}-${selectedGrade}`;
    const newRecord: AttendanceRecord = {
      id: recordId,
      date: selectedDate,
      grade: selectedGrade,
      presentCount: p,
      lateCount: y,
      permissionCount: l,
      absentCount: a,
      studentStates: finalStates
    };

    const updated = [
      newRecord,
      ...records.filter(r => !(r.date === selectedDate && r.grade === selectedGrade))
    ];

    setRecords(updated);
    localStorage.setItem('school_daily_attendance', JSON.stringify(updated));

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      syncUpsertStudentAttendance(newRecord).catch(err => {
        console.warn('Supabase student attendance save failed', err);
      });
    }

    triggerToast(`💾 រក្សាទុកវត្តមានជោគជ័យ៖ សរុប ${p} នាក់វត្តមាន | ${y} នាក់យឺត | ${l} នាក់ច្បាប់ | ${a} នាក់អត់ច្បាប់`, 'success');
  };

  // Filter teachers matching search query
  const displayTeachers = teachersList.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTeachersCount = teachersList.length;
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
    let p = 0;
    let y = 0;
    let l = 0;
    let a = 0;

    const finalStates: { [teacherId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
    teachersList.forEach(t => {
      const status = teacherAttendanceMap[t.id] || 'present';
      finalStates[t.id] = status;
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
      });
    }

    triggerToast(`💾 រក្សាទុកវត្តមានគ្រូជោគជ័យ៖ សរុប ${p} នាក់វត្តមាន | ${y} នាក់យឺត | ${l} នាក់ច្បាប់ | ${a} នាក់អត់ច្បាប់`, 'success');
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

      {/* Main Banner Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-blue-600 font-bold mb-1.5">
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-bold">ប្រព័ន្ធគ្រប់គ្រងសាលា SMS v2.0</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 font-serif">កត់វត្តមានប្រចាំថ្ងៃ</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            គ្រប់គ្រង និងតាមដានវត្តមានរបស់សិស្សានុសិស្ស និងគ្រូបង្រៀនប្រចាំថ្ងៃ រក្សាទុកទិន្នន័យច្បាស់លាស់។
          </p>
        </div>

        {/* Quick Date Control widget */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl shrink-0 self-start md:self-auto">
          <button 
            onClick={() => shiftDay(-1)}
            className="p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-300 text-slate-600 transition-all cursor-pointer"
            title="ថ្ងៃមុន"
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
            title="ថ្ងៃបន្ទាប់"
          >
            <ArrowRight size={14} />
          </button>
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
          <span>វត្តមានសិស្សានុសិស្ស</span>
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
          <span>វត្តមានគ្រូបង្រៀន</span>
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
            <span className="text-sm font-black">វ</span>
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
            <span className="text-sm font-black">យ</span>
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
            <span className="text-sm font-black">ច្ប</span>
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
            <span className="text-sm font-black">អច្ប</span>
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

      {/* Primary configuration controls with attendance details layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Controls and Mass Actions */}
        <div className="space-y-4 lg:col-span-1">
          {activeTab === 'student' ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 uppercase tracking-wider">⚙️ ការជ្រើសរើសថ្នាក់រៀន</h3>
              
              {/* Grade filter */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] text-slate-500 font-bold">ជ្រើសរើសតម្រងថ្នាក់</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setSearchQuery('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-3xs"
                >
                  {grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Quick Filter Search Input */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] text-slate-500 font-bold">ស្វែងរកតាមឈ្មោះសិស្ស</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-3xs transition-all">
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

              {/* Attendance rate gauge */}
              <div className="pt-2">
                <div className="flex justify-between text-[10.5px] font-bold mb-1.5">
                  <span className="text-slate-500">អត្រាវត្តមានសរុបប្រចាំថ្ងៃ៖</span>
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
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 uppercase tracking-wider">⚙️ តម្រងស្វែងរកគ្រូបង្រៀន</h3>
              
              {/* Quick Filter Search Input */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] text-slate-500 font-bold">ស្វែងរកតាមឈ្មោះ ឬថ្នាក់ទទួលបន្ទុក</label>
                <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-3xs transition-all">
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

              {/* Attendance rate gauge */}
              <div className="pt-2">
                <div className="flex justify-between text-[10.5px] font-bold mb-1.5">
                  <span className="text-slate-500">អត្រាវត្តមានគ្រូប្រចាំថ្ងៃ៖</span>
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

          {/* Mass Actions */}
          {activeTab === 'student' ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-3.5">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 uppercase tracking-wider">⚡ សកម្មភាពរហ័ស</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                ចុចប៊ូតុងខាងក្រោមដើម្បីសម្គាល់ស្ថានភាពវត្តមានដូចគ្នាសម្រាប់សិស្សទាំងអស់ក្នុងថ្នាក់ {selectedGrade} ក្នុងពេលតែមួយ។
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={() => markAllStatus('present')}
                  className="py-2.5 bg-[#E6F4EA] hover:bg-[#d2ebd9] border border-emerald-250 text-emerald-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>✔️ សម្គាល់វត្តមានទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllStatus('late')}
                  className="py-2.5 bg-[#E8F0FE] hover:bg-[#d6e4fd] border border-blue-250 text-blue-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>🕒 សម្គាល់យឺតទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllStatus('permission')}
                  className="py-2.5 bg-[#FEF7E0] hover:bg-[#faecc3] border border-amber-250 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>⚠️ សម្គាល់មានច្បាប់ទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllStatus('absent')}
                  className="py-2.5 bg-[#FCE8E6] hover:bg-[#fad0cd] border border-rose-250 text-rose-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>❌ សម្គាល់អត់ច្បាប់ទាំងអស់</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-3.5">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 uppercase tracking-wider">⚡ សកម្មភាពរហ័ស</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                ចុចប៊ូតុងខាងក្រោមដើម្បីសម្គាល់ស្ថានភាពវត្តមានដូចគ្នាសម្រាប់គ្រូបង្រៀនទាំងអស់ក្នុងពេលតែមួយ។
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  onClick={() => markAllTeachersStatus('present')}
                  className="py-2.5 bg-[#E6F4EA] hover:bg-[#d2ebd9] border border-emerald-250 text-emerald-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>✔️ សម្គាល់វត្តមានគ្រូទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllTeachersStatus('late')}
                  className="py-2.5 bg-[#E8F0FE] hover:bg-[#d6e4fd] border border-blue-250 text-blue-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>🕒 សម្គាល់យឺតគ្រូទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllTeachersStatus('permission')}
                  className="py-2.5 bg-[#FEF7E0] hover:bg-[#faecc3] border border-amber-250 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>⚠️ សម្គាល់មានច្បាប់គ្រូទាំងអស់</span>
                </button>
                <button
                  onClick={() => markAllTeachersStatus('absent')}
                  className="py-2.5 bg-[#FCE8E6] hover:bg-[#fad0cd] border border-rose-250 text-rose-805 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
                >
                  <span>❌ សម្គាល់អត់ច្បាប់គ្រូទាំងអស់</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Attendance Sheet Table */}
        <div className="space-y-4 lg:col-span-2">
          {activeTab === 'student' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2.5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">📋 បញ្ជីឈ្មោះសិស្ស និងការចុះវត្តមាន ({selectedGrade})</h3>
                </div>
                <span className="text-[10.5px] text-slate-500 font-bold bg-white px-2.5 py-1 border border-slate-200 rounded-lg">
                  សរុប៖ <b>{displayStudents.length}</b> នាក់
                </span>
              </div>

              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-slate-700 text-xs font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left font-bold select-none text-[10px] uppercase tracking-wider">
                      <th className="px-5 py-3 w-12 text-center">ល.រ</th>
                      <th className="px-5 py-3">ឈ្មោះសិស្ស</th>
                      <th className="px-5 py-3 hidden sm:table-cell">ភេទ</th>
                      <th className="px-3 py-3 text-center text-blue-600 font-black whitespace-nowrap text-[10.5px]">សរុបយឺត (យ)</th>
                      <th className="px-3 py-3 text-center text-amber-600 font-black whitespace-nowrap text-[10.5px]">សរុបច្បាប់ (ច្ប)</th>
                      <th className="px-3 py-3 text-center text-rose-600 font-black whitespace-nowrap text-[10.5px]">សរុបអត់ច្បាប់ (អច្ប)</th>
                      <th className="px-3 py-3 text-center text-red-700 font-black whitespace-nowrap text-[10.5px] bg-red-50/50 rounded-lg">សរុបអវត្តមាន</th>
                      <th className="px-5 py-3 text-center w-52">ជ្រើសរើសវត្តមាន</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayStudents.length > 0 ? (
                      displayStudents.map((std, idx) => {
                        const currentStatus = activeAttendanceMap[std.id] || 'present';
                        const stats = studentStatsMap[std.id] || { late: 0, permission: 0, absent: 0, totalAbsence: 0 };
                        return (
                          <tr key={std.id} className="hover:bg-slate-50/70 transition-all">
                            {/* Number Index */}
                            <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            
                            {/* Profile & Name */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div>
                                  <p className="font-bold text-slate-800">{std.name}</p>
                                  <p className="text-[9.5px] text-slate-400 font-medium">ភេទ៖ {std.gender} | ID: {std.id.substring(0, 5)}</p>
                                </div>
                              </div>
                            </td>

                            {/* Gender */}
                            <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500">{std.gender}</td>

                            {/* Cumulative Late (យឺត) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shadow-3xs" title="សរុបយឺត">
                                {stats.late}
                              </span>
                            </td>

                            {/* Cumulative Permission (ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-3xs" title="សរុបច្បាប់">
                                {stats.permission}
                              </span>
                            </td>

                            {/* Cumulative Absent without permission (អត់ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-rose-50 text-rose-700 border border-rose-250 shadow-3xs" title="សរុបអត់ច្បាប់">
                                {stats.absent}
                              </span>
                            </td>

                            {/* Cumulative Total Absences (អវត្តមានសរុប = ច្បាប់ + អត់ច្បាប់) */}
                            <td className="px-3 py-3.5 text-center bg-red-50/20">
                              <span className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 text-[11px] font-black font-sans rounded-xl bg-red-100 text-red-800 border border-red-300 shadow-2xs" title="សរុបអវត្តមានសរុប (ច្បាប់ + អត់ច្បាប់)">
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
                                    title="វត្តមាន (វ)"
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'present' && <Check size={10} strokeWidth={3} />}
                                    <span>វ</span>
                                  </button>

                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'late' }))}
                                    title="យឺត (យ)"
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'late'
                                        ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'late' && <Check size={10} strokeWidth={3} />}
                                    <span>យ</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'permission' }))}
                                    title="ច្បាប់ (ច្ប)"
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'permission'
                                        ? 'bg-amber-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'permission' && <Check size={10} strokeWidth={3} />}
                                    <span>ច្ប</span>
                                  </button>

                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'absent' }))}
                                    title="អត់ច្បាប់ (អច្ប)"
                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                      currentStatus === 'absent'
                                        ? 'bg-rose-500 text-white shadow-sm font-bold scale-[1.03]'
                                        : 'text-slate-400 hover:text-slate-705'
                                    }`}
                                  >
                                    {currentStatus === 'absent' && <Check size={10} strokeWidth={3} />}
                                    <span>អច្ប</span>
                                  </button>
                                </div>

                                {/* Reason Selector if not present */}
                                {currentStatus !== 'present' && (
                                  <div className="w-full max-w-[190px] flex flex-col gap-1 items-start">
                                    <select
                                      value={['', 'បញ្ហាសុខភាព', 'មានធុរៈក្នុងគ្រួសារ', 'ខ្ជិល'].includes(studentReasonsMap[std.id] || '') ? (studentReasonsMap[std.id] || '') : 'ផ្សេងៗ'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStudentReasonsMap(prev => ({ ...prev, [std.id]: val }));
                                      }}
                                      className="w-full bg-slate-55 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-sans text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    >
                                      <option value="">-- ជ្រើសរើសមូលហេតុ --</option>
                                      <option value="បញ្ហាសុខភាព">១. បញ្ហាសុខភាព</option>
                                      <option value="មានធុរៈក្នុងគ្រួសារ">២. មានធុរៈក្នុងគ្រួសារ</option>
                                      <option value="ខ្ជិល">៣. ខ្ជិល</option>
                                      <option value="ផ្សេងៗ">៤. ផ្សេងៗ (សរសេរ)..........</option>
                                    </select>
                                    
                                    {!['', 'បញ្ហាសុខភាព', 'មានធុរៈក្នុងគ្រួសារ', 'ខ្ជិល'].includes(studentReasonsMap[std.id] || '') && (
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
                        <td colSpan={8} className="py-20 text-center text-slate-400 text-xs">
                          <p className="text-xl mb-1">📭</p>
                          <p className="font-bold">ពុំមានគណនីសិស្សនៅក្នុងថ្នាក់ត្រូវបានរកឃើញទេ ឬមិនត្រូវនឹងការស្វែងរករបស់អ្នកឡើយ។</p>
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
                  <span>កំណត់ឡើងវិញ</span>
                </button>

                <button
                  onClick={handleSaveAttendance}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                >
                  <CheckCircle size={13} />
                  <span>រក្សាទុកវត្តមាន</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2.5 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">👨‍🏫 បញ្ជីឈ្មោះគ្រូបង្រៀន និងការចុះវត្តមាន</h3>
                </div>
                <span className="text-[10.5px] text-slate-500 font-bold bg-white px-2.5 py-1 border border-slate-200 rounded-lg">
                  សរុប៖ <b>{displayTeachers.length}</b> នាក់
                </span>
              </div>

              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-slate-700 text-xs font-medium">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left font-bold select-none text-[10px] uppercase tracking-wider">
                      <th className="px-5 py-3 w-12 text-center">ល.រ</th>
                      <th className="px-5 py-3">ឈ្មោះគ្រូបង្រៀន</th>
                      <th className="px-5 py-3 hidden sm:table-cell">បង្រៀនថ្នាក់រៀន/ជំនាញ</th>
                      <th className="px-5 py-3 text-center w-52">ជ្រើសរើសវត្តមាន</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayTeachers.length > 0 ? (
                      displayTeachers.map((tc, idx) => {
                        const currentStatus = teacherAttendanceMap[tc.id] || 'present';
                        return (
                          <tr key={tc.id} className="hover:bg-slate-50/70 transition-all">
                            {/* Index */}
                            <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            
                            {/* Profile Info */}
                            <td className="px-5 py-3.5">
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

                            {/* P, L, A Picker buttons */}
                            <td className="px-5 py-3.5 text-center">
                              <div className="inline-flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                  onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'present' }))}
                                  title="វត្តមាន (វ)"
                                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                    currentStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-sm font-bold scale-[1.03]'
                                      : 'text-slate-400 hover:text-slate-705'
                                  }`}
                                >
                                  {currentStatus === 'present' && <Check size={10} strokeWidth={3} />}
                                  <span>វ</span>
                                </button>

                                <button
                                  onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'late' }))}
                                  title="យឺត (យ)"
                                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                    currentStatus === 'late'
                                      ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.03]'
                                      : 'text-slate-400 hover:text-slate-705'
                                  }`}
                                >
                                  {currentStatus === 'late' && <Check size={10} strokeWidth={3} />}
                                  <span>យ</span>
                                </button>
                                
                                <button
                                  onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'permission' }))}
                                  title="ច្បាប់ (ច្ប)"
                                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                    currentStatus === 'permission'
                                      ? 'bg-amber-500 text-white shadow-sm font-bold scale-[1.03]'
                                      : 'text-slate-400 hover:text-slate-705'
                                  }`}
                                >
                                  {currentStatus === 'permission' && <Check size={10} strokeWidth={3} />}
                                  <span>ច្ប</span>
                                </button>

                                <button
                                  onClick={() => setTeacherAttendanceMap(prev => ({ ...prev, [tc.id]: 'absent' }))}
                                  title="អត់ច្បាប់ (អច្ប)"
                                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                    currentStatus === 'absent'
                                      ? 'bg-rose-500 text-white shadow-sm font-bold scale-[1.03]'
                                      : 'text-slate-400 hover:text-slate-705'
                                  }`}
                                >
                                  {currentStatus === 'absent' && <Check size={10} strokeWidth={3} />}
                                  <span>អច្ប</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-400 text-xs">
                          <p className="text-xl mb-1">📭</p>
                          <p className="font-bold">ពុំមានគណនីគ្រូបង្រៀនត្រូវបានរកឃើញឡើយ ឬមិនត្រូវនឹងការស្វែងរករបស់អ្នក។</p>
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
                    teachersList.forEach(t => {
                      map[t.id] = 'present';
                    });
                    setTeacherAttendanceMap(map);
                    triggerToast('🔄 បានធ្វើឱ្យវត្តមានគ្រូត្រលប់មកដើមវិញ (វត្តមានទាំងអស់)', 'info');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-605 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>កំណត់ឡើងវិញ</span>
                </button>

                <button
                  onClick={handleSaveTeacherAttendance}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                >
                  <CheckCircle size={13} />
                  <span>រក្សាទុកវត្តមានគ្រូ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
