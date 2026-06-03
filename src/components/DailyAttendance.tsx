import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { StudentScore, SchoolUser } from '../types';

interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
  presentCount: number;
  permissionCount: number;
  absentCount: number;
  studentStates: { [studentId: string]: 'present' | 'permission' | 'absent' };
}

interface DailyAttendanceProps {
  students: StudentScore[];
  currentUser: SchoolUser | null;
  grades: string[];
}

export default function DailyAttendance({ students, currentUser, grades }: DailyAttendanceProps) {
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

  // Load persistence records
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
        permissionCount: 1,
        absentCount: 1,
        studentStates: {}
      }
    ];
  });

  // Track the current student-level state mapping
  const [activeAttendanceMap, setActiveAttendanceMap] = useState<{ [studentId: string]: 'present' | 'permission' | 'absent' }>({});

  // Sync state mapping when date, grade, or records modify
  useEffect(() => {
    const existing = records.find(r => r.date === selectedDate && r.grade === selectedGrade);
    const gradeStudents = students.filter(s => s.grade === selectedGrade);
    
    if (existing && existing.studentStates && Object.keys(existing.studentStates).length > 0) {
      // Re-hydrate existing states, but ensure new students get designated as present
      const map: { [studentId: string]: 'present' | 'permission' | 'absent' } = {};
      gradeStudents.forEach(s => {
        map[s.id] = existing.studentStates[s.id] || 'present';
      });
      setActiveAttendanceMap(map);
    } else {
      // Setup default (every student present)
      const map: { [studentId: string]: 'present' | 'permission' | 'absent' } = {};
      gradeStudents.forEach(s => {
        map[s.id] = 'present';
      });
      setActiveAttendanceMap(map);
    }
  }, [selectedDate, selectedGrade, records, students]);

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
  const displayStudents = students
    .filter(s => s.grade === selectedGrade)
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalInGrade = students.filter(s => s.grade === selectedGrade).length;

  // Mass manipulation utilities
  const markAllStatus = (status: 'present' | 'permission' | 'absent') => {
    const gradeStudents = students.filter(s => s.grade === selectedGrade);
    const newMap = { ...activeAttendanceMap };
    gradeStudents.forEach(s => {
      newMap[s.id] = status;
    });
    setActiveAttendanceMap(newMap);
    triggerToast(
      status === 'present' 
        ? '✅ បានសម្គាល់សិស្សទាំងអស់ជា «វត្តមាន»' 
        : status === 'permission'
          ? '⚠️ បានសម្គាល់សិស្សទាំងអស់ជា «ច្បាប់»'
          : '🚨 បានសម្គាល់សិស្សទាំងអស់ជា «អវត្តមាន»',
      status === 'present' ? 'success' : 'info'
    );
  };

  // Attendance metrics calculation
  const presentCount = displayStudents.filter(s => (activeAttendanceMap[s.id] || 'present') === 'present').length;
  const permissionCount = displayStudents.filter(s => activeAttendanceMap[s.id] === 'permission').length;
  const absentCount = displayStudents.filter(s => activeAttendanceMap[s.id] === 'absent').length;

  const rate = totalInGrade > 0 ? Math.round((presentCount / totalInGrade) * 100) : 100;

  // Persist the current daily snapshot
  const handleSaveAttendance = () => {
    const gradeStudents = students.filter(s => s.grade === selectedGrade);
    if (gradeStudents.length === 0) {
      triggerToast('⚠️ គ្មានឈ្មោះសិស្សនៅក្នុងថ្នាក់ដែលបានជ្រើសរើសឡើយ។', 'error');
      return;
    }

    let p = 0;
    let l = 0;
    let a = 0;

    const finalStates: { [studentId: string]: 'present' | 'permission' | 'absent' } = {};
    gradeStudents.forEach(s => {
      const status = activeAttendanceMap[s.id] || 'present';
      finalStates[s.id] = status;
      if (status === 'present') p++;
      else if (status === 'permission') l++;
      else if (status === 'absent') a++;
    });

    const recordId = `att-${selectedDate}-${selectedGrade}`;
    const newRecord: AttendanceRecord = {
      id: recordId,
      date: selectedDate,
      grade: selectedGrade,
      presentCount: p,
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
    triggerToast(`💾 រក្សាទុកវត្តមានជោគជ័យ៖ សរុប ${p} នាក់វត្តមាន | ${l} នាក់ច្បាប់ | ${a} នាក់អវត្តមាន`, 'success');
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
          <h1 className="text-xl font-bold text-slate-800 font-serif">កត់វត្តមានប្រចាំថ្ងៃ (Daily Attendance Tracking)</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            គ្រប់គ្រង និងតាមដានវត្តមានរបស់សិស្សានុសិស្សប្រចាំថ្ងៃ តាមថ្នាក់រៀននីមួយៗ និងរក្សាទុកទិន្នន័យច្បាស់លាស់។
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

      {/* Top statistics summary modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metirc 1: Total Registered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-105 flex items-center justify-center text-blue-500">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">សិស្សសកម្មក្នុងថ្នាក់</p>
            <h3 className="text-xl font-black text-slate-800 mt-1">{totalInGrade} នាក់</h3>
          </div>
        </div>

        {/* Metric 2: Present */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] border border-emerald-100 flex items-center justify-center text-[#137333]">
            <span className="text-lg font-black">P</span>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">សិស្សមានវត្តមាន (Present)</p>
            <h3 className="text-xl font-black text-emerald-700 mt-1">{totalInGrade > 0 ? presentCount : 0} នាក់</h3>
          </div>
        </div>

        {/* Metric 3: Permission */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF7E0] border border-amber-100 flex items-center justify-center text-[#B06000]">
            <span className="text-lg font-black">L</span>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">សិស្សមានច្បាប់ (Excused)</p>
            <h3 className="text-xl font-black text-amber-600 mt-1">{totalInGrade > 0 ? permissionCount : 0} នាក់</h3>
          </div>
        </div>

        {/* Metric 4: Absent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FCE8E6] border border-rose-100 flex items-center justify-center text-[#C5221F]">
            <span className="text-lg font-black">A</span>
          </div>
          <div>
            <p className="text-[#EA4335] text-[10px] font-bold uppercase tracking-wider">អវត្តមានគ្មានច្បាប់ (Absent)</p>
            <h3 className="text-xl font-black text-rose-600 mt-1">{totalInGrade > 0 ? absentCount : 0} នាក់</h3>
          </div>
        </div>
      </div>

      {/* Primary configuration controls with attendance details layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Controls and Mass Actions */}
        <div className="space-y-4 lg:col-span-1">
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

          {/* Mass Actions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-3.5">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5 uppercase tracking-wider">⚡ សកម្មភាពរហ័ស (Mass Actions)</h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              ចុចប៊ូតុងខាងក្រោមដើម្បីសម្គាល់ស្ថានភាពវត្តមានដូចគ្នាសម្រាប់សិស្សទាំងអស់ក្នុងថ្នាក់ {selectedGrade} ក្នុងពេលតែមួយ។
            </p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={() => markAllStatus('present')}
                className="py-2.5 bg-[#E6F4EA] hover:bg-[#d2ebd9] border border-emerald-250 text-emerald-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <span>✔️ សម្គាល់វត្តមានទាំងអស់ (P)</span>
              </button>
              <button
                onClick={() => markAllStatus('permission')}
                className="py-2.5 bg-[#FEF7E0] hover:bg-[#faecc3] border border-amber-250 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <span>⚠️ សម្គាល់មានច្បាប់ទាំងអស់ (L)</span>
              </button>
              <button
                onClick={() => markAllStatus('absent')}
                className="py-2.5 bg-[#FCE8E6] hover:bg-[#fad0cd] border border-rose-250 text-rose-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <span>❌ សម្គាល់អវត្តមានទាំងអស់ (A)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Sheet Table */}
        <div className="space-y-4 lg:col-span-2">
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
                    <th className="px-5 py-3 text-center w-52">ជ្រើសរើសវត្តមាន</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayStudents.length > 0 ? (
                    displayStudents.map((std, idx) => {
                      const currentStatus = activeAttendanceMap[std.id] || 'present';
                      return (
                        <tr key={std.id} className="hover:bg-slate-50/70 transition-all">
                          {/* Number Index */}
                          <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          
                          {/* Profile & Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {std.name.charAt(std.name.startsWith('ស') ? 3 : 0) || 'ស'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{std.name}</p>
                                <p className="text-[9.5px] text-slate-400 font-medium">ភេទ៖ {std.gender} | ID: {std.id.substring(0, 5)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Gender */}
                          <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500">{std.gender}</td>

                          {/* P, L, A Radio Selectors */}
                          <td className="px-5 py-3.5 text-center">
                            <div className="inline-flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                              <button
                                onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'present' }))}
                                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-sm font-bold scale-[1.03]'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                {currentStatus === 'present' && <Check size={10} strokeWidth={3} />}
                                <span>P</span>
                              </button>
                              
                              <button
                                onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'permission' }))}
                                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                  currentStatus === 'permission'
                                    ? 'bg-amber-500 text-white shadow-sm font-bold scale-[1.03]'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                {currentStatus === 'permission' && <Check size={10} strokeWidth={3} />}
                                <span>L</span>
                              </button>

                              <button
                                onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'absent' }))}
                                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none ${
                                  currentStatus === 'absent'
                                    ? 'bg-rose-500 text-white shadow-sm font-bold scale-[1.03]'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                {currentStatus === 'absent' && <Check size={10} strokeWidth={3} />}
                                <span>A</span>
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
                  const map: { [studentId: string]: 'present' | 'permission' | 'absent' } = {};
                  students.filter(s => s.grade === selectedGrade).forEach(s => {
                    map[s.id] = 'present';
                  });
                  setActiveAttendanceMap(map);
                  triggerToast('🔄 បានធ្វើឱ្យវត្តមានត្រលប់មកដើមវិញ (វត្តមានទាំងអស់)', 'info');
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
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
        </div>
      </div>
    </div>
  );
}
