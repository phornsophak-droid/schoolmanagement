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

  const gradesList = useMemo(() => {
    return ['ទាំងអស់', ...(grades || ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣', 'ថ្នាក់ទី៤', 'ថ្នាក់ទី៥', 'ថ្នាក់ទី៦'])];
  }, [grades]);

  // Load Saved Attendance Records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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
      const matchGrade = selectedGrade === 'boldsymbol' || selectedGrade === 'ទាំងអស់' ? true : rec.grade === selectedGrade;
      return matchGrade;
    });
  }, [attendanceRecords, selectedGrade]);

  const attendanceAggregates = useMemo(() => {
    let totalPresent = 0;
    let totalLate = 0;
    let totalPermission = 0;
    let totalAbsent = 0;

    filteredAttendance.forEach(rec => {
      totalPresent += rec.presentCount;
      totalLate += rec.lateCount || 0;
      totalPermission += rec.permissionCount;
      totalAbsent += rec.absentCount;
    });

    const totalStudentsScheduled = totalPresent + totalLate + totalPermission + totalAbsent;
    const overallRate = totalStudentsScheduled > 0 
      ? Math.round(((totalPresent + totalLate) / totalStudentsScheduled) * 100) 
      : 0;

    return {
      totalPresent: totalPresent + totalLate,
      totalPermission,
      totalAbsent,
      overallRate,
      activeDaysCount: filteredAttendance.length > 0 ? filteredAttendance.length : 0
    };
  }, [filteredAttendance]);

  // Filter students based on selection
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : student.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : student.grade === selectedGrade;
      return matchMonth && matchGrade;
    });
  }, [students, selectedMonth, selectedGrade]);

  // Filter reports based on selection
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchMonth = selectedMonth === 'ទាំងអស់' ? true : report.generalInfo.month === selectedMonth;
      const matchGrade = selectedGrade === 'ទាំងអស់' ? true : report.generalInfo.grade === selectedGrade;
      return matchMonth && matchGrade;
    });
  }, [reports, selectedMonth, selectedGrade]);

  // Calculate statistics based on filtered students
  const stats = useMemo(() => {
    const uniqueStudentsMap = new Map<string, StudentScore>();
    
    filteredStudents.forEach(s => {
      // Group by name and grade to ensure we don't count a student multiple times across months
      const key = `${s.name.trim()}_${s.grade}`;
      // For averages/results, we might need a more complex aggregate if 'ទាំងអស់' is selected, 
      // but to keep it simple and accurate for "total counts", we just take the latest or any record.
      if (!uniqueStudentsMap.has(key)) {
        uniqueStudentsMap.set(key, s);
      }
    });

    const uniqueProfiles = Array.from(uniqueStudentsMap.values());
    const totalCount = uniqueProfiles.length;
    const femaleCount = uniqueProfiles.filter(s => s.gender === 'ស្រី').length;
    
    let totalScoreSum = 0;
    let failCount = 0;
    
    // We will use uniqueProfiles for all metrics to ensure Total = Pass + Fail
    uniqueProfiles.forEach(s => {
      totalScoreSum += s.overallAvg;
      if (s.result === 'ធ្លាក់') {
        failCount++;
      }
    });

    const averageScore = uniqueProfiles.length > 0 ? parseFloat((totalScoreSum / uniqueProfiles.length).toFixed(2)) : 0;
    const passCount = uniqueProfiles.length - failCount;

    return {
      totalCount,
      femaleCount,
      averageScore,
      failCount,
      passCount,
      totalRecordCount: uniqueProfiles.length
    };
  }, [filteredStudents]);

  // Donut chart calculations
  const donutData = useMemo(() => {
    const total = stats.totalRecordCount;
    if (total === 0) return null;

    const r = 50;
    const circumference = 2 * Math.PI * r;
    const passPercent = (stats.passCount / total) * 100;
    const failPercent = (stats.failCount / total) * 100;

    const passStroke = (passPercent / 100) * circumference;
    const failStroke = (failPercent / 100) * circumference;

    return {
      r,
      circumference,
      passPercent,
      failPercent,
      passStroke,
      failStroke
    };
  }, [stats]);

  // Find the latest attendance date
  const latestAttendanceDate = useMemo(() => {
    if (attendanceRecords.length === 0) return new Date().toISOString().split('T')[0];
    const dates = attendanceRecords.map(r => r.date).sort();
    return dates[dates.length - 1];
  }, [attendanceRecords]);

  // Generate Daily Absent Report Data
  const dailyAbsentReport = useMemo(() => {
    // Cumulative stats
    const cumulativeStats: Record<string, { late: number, permission: number, absent: number }> = {};
    attendanceRecords.forEach(rec => {
      // Don't filter grade for cumulative overall stats
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
    const todayRecords = attendanceRecords.filter(r => r.date === latestAttendanceDate);
    
    let todayLateCount = 0;
    let todayPermissionCount = 0;
    let todayAbsentCount = 0;

    const list: any[] = [];
    
    todayRecords.forEach(rec => {
      if (rec.studentStates) {
        Object.entries(rec.studentStates).forEach(([sId, status]) => {
          if (sId.endsWith('_reason')) return;
          
          if (status === 'late') todayLateCount++;
          else if (status === 'permission') todayPermissionCount++;
          else if (status === 'absent') todayAbsentCount++;

          if (status === 'late' || status === 'permission' || status === 'absent') {
            const stu = uniqueStudentsMap.get(sId);
            const stats = cumulativeStats[sId] || { late: 0, permission: 0, absent: 0 };
            const reason = (rec.studentStates as any)[sId + '_reason'] || '';
            
            list.push({
              id: sId,
              name: stu ? stu.name : 'មិនស្គាល់ឈ្មោះ',
              grade: rec.grade,
              gender: stu ? stu.gender : 'Unknown',
              cumulativeLate: stats.late,
              cumulativePermission: stats.permission,
              cumulativeAbsent: stats.absent,
              todayStatus: status,
              reason: reason
            });
          }
        });
      }
    });

    // sort list by grade then name
    list.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'km');
      return a.name.localeCompare(b.name, 'km');
    });

    return {
      date: latestAttendanceDate,
      lateCount: todayLateCount,
      permissionCount: todayPermissionCount,
      absentCount: todayAbsentCount,
      totalAbsences: todayPermissionCount + todayAbsentCount,
      list
    };
  }, [attendanceRecords, students, latestAttendanceDate, selectedGrade]);

  return (
    <div className="space-y-8">
      {/* Upper Filter & Navigation Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">ផ្ទាំងគ្រប់គ្រងទិន្នន័យទូទៅ</h2>
          <p className="text-sm text-slate-500 mt-1">សូមជ្រើសរើស ខែ ឬ ថ្នាក់សិក្សា ដើម្បីពិនិត្យស្ថិតិលម្អិត</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 font-mono">ខែ៖</span>
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
            <span className="text-xs font-medium text-slate-400 font-mono">ថ្នាក់៖</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 transition-colors"
            >
              {gradesList.map(grade => (
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
            ទំព័រពិន្ទុសិស្ស
          </button>

          <button 
            id="btn_create_report"
            onClick={onCreateReportClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold transition duration-200 shadow-md shadow-blue-600/10"
          >
            <Plus size={15} />
            បង្កើតរបាយការណ៍ថ្មី
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Reports Count */}
        <div id="kpi_reports" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">របាយការណ៍សរុប</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">{filteredReports.length} <span className="text-sm font-normal text-slate-500">ច្បាប់</span></h3>
            <p className="text-[10px] text-slate-400 mt-1.5">ដែលបានរក្សាទុកក្នុងប្រព័ន្ធ</p>
          </div>
        </div>

        {/* KPI 2: Total Students */}
        <div id="kpi_students" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">សិស្សសរុបរួម</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1 font-mono">{stats.totalCount} <span className="text-sm font-normal text-slate-500">នាក់</span></h3>
            <p className="text-xs text-slate-500 mt-1">ស្រី៖ <span className="font-bold text-emerald-600">{stats.femaleCount}</span> នាក់</p>
          </div>
        </div>

        {/* KPI 3: Global Average */}
        <div id="kpi_gpa" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">សិស្សជាប់មធ្យមភាគ</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1 font-mono">
              {stats.passCount} <span className="text-sm font-normal text-slate-500">នាក់</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1.5">ផ្អែកលើការវាយតម្លៃគ្រប់មុខវិជ្ជា</p>
          </div>
        </div>

        {/* KPI 4: Failed Students */}
        <div id="kpi_failing" className="relative overflow-hidden bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">សិស្សធ្លាក់ (មធ្យមភាគ &lt; ៥)</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1 font-mono">{stats.failCount} <span className="text-sm font-normal text-slate-500">នាក់</span></h3>
            <p className="text-[10px] text-rose-500/80 mt-1.5">ត្រូវការយកចិត្តទុកដាក់ខ្ពស់</p>
          </div>
        </div>
      </div>

      {/* Main Analytics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pass/Fail Proportion Pie/Donut Chart */}
        <div id="panel_pie_chart" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">សមាមាត្រសិស្ស ជាប់ និងធ្លាក់</h3>
            <p className="text-xs text-slate-400 mt-1">គិតជាភាគរយនៃសិស្សទាំងអស់ដែលបានចម្រោះរួច</p>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            {donutData ? (
              <div className="relative w-44 h-44">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Background Track circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={donutData.r}
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
                  {/* Passed Slice */}
                  {stats.passCount > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={donutData.r}
                      fill="transparent"
                      stroke="#10b981" // emerald-500
                      strokeWidth="12"
                      strokeDasharray={`${donutData.passStroke} ${donutData.circumference}`}
                    />
                  )}
                  {/* Failed Slice */}
                  {stats.failCount > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r={donutData.r}
                      fill="transparent"
                      stroke="#f43f5e" // rose-500
                      strokeWidth="12"
                      strokeDasharray={`${donutData.failStroke} ${donutData.circumference}`}
                      strokeDashoffset={-donutData.passStroke}
                    />
                  )}
                </svg>
                {/* Donut Center texts */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-medium text-slate-400">ជាប់</span>
                  <span className="text-xl font-bold text-emerald-600 font-mono">
                    {donutData.passPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                <FolderOpen className="mx-auto text-slate-300 mb-2" size={32} />
                គ្មានទិន្នន័យសម្រាប់គូរក្រាហ្វិកទេ
              </div>
            )}
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-slate-400 text-[10px]">សិស្សជាប់</p>
                <p className="font-semibold text-slate-800 mt-0.5">{stats.passCount} នាក់</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <div>
                <p className="text-slate-400 text-[10px]">សិស្សធ្លាក់</p>
                <p className="font-semibold text-slate-800 mt-0.5">{stats.failCount} នាក់</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reports Registry Listing */}
        <div id="panel_report_list" className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-base">បញ្ជីរបាយការណ៍ដែលបានរក្សាទុក</h3>
              <p className="text-xs text-slate-400 mt-1">របាយការណ៍ប្រចាំខែផ្លូវការរបស់គ្រូបន្ទុកថ្នាក់</p>
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
                      ព័ត៌មានលម្អិត
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

      {/* Daily Absent Students Report Panel (Restored) */}
      <div id="panel_daily_absent" className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex flex-shrink-0 items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-rose-600 font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                បញ្ជីសិស្សអវត្តមាន
              </p>
              <h3 className="font-bold text-[#1e293b] text-2xl font-serif">តារាងសិស្សអវត្តមានប្រចាំថ្ងៃ</h3>
              <p className="text-xs text-slate-400 mt-2">
                បញ្ជីសិស្សអវត្តមានទាំងអស់គ្រប់ថ្នាក់ • ថ្ងៃទី <span className="font-bold text-slate-500">{dailyAbsentReport.date}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-xl text-sm font-bold transition duration-200 cursor-pointer shadow-md shadow-rose-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            ទាញយករបាយការណ៍ប្រចាំថ្ងៃ (PDF)
          </button>
        </div>

        {/* 4 Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#FFFDF7] py-6 px-4 rounded-xl border border-amber-200 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(251,191,36,0.05)]">
            <h4 className="text-4xl font-black text-amber-500 font-mono leading-none">{dailyAbsentReport.lateCount}</h4>
            <p className="text-xs text-amber-600 font-black mt-3.5 uppercase tracking-wider">យឺតសរុប</p>
          </div>
          <div className="bg-[#F0F5FF] py-6 px-4 rounded-xl border border-blue-200 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.05)]">
            <h4 className="text-4xl font-black text-blue-600 font-mono leading-none">{dailyAbsentReport.permissionCount}</h4>
            <p className="text-xs text-blue-600 font-black mt-3.5 uppercase tracking-wider">ច្បាប់សរុប</p>
          </div>
          <div className="bg-[#FFF5F5] py-6 px-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(244,63,94,0.05)]">
            <h4 className="text-4xl font-black text-rose-500 font-mono leading-none">{dailyAbsentReport.absentCount}</h4>
            <p className="text-xs text-rose-500 font-black mt-3.5 uppercase tracking-wider">អត់ច្បាប់សរុប</p>
          </div>
          <div className="bg-white py-6 px-4 rounded-xl border border-[#334155] flex flex-col items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
            <h4 className="text-4xl font-black text-[#334155] font-mono leading-none">{dailyAbsentReport.totalAbsences}</h4>
            <p className="text-xs text-[#64748b] font-black mt-3.5 uppercase tracking-wider">អវត្តមានសរុប</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#334155]">
              <thead className="border-b border-slate-200 text-[#64748b] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4 text-center w-12 font-bold">ល.រ</th>
                  <th className="px-5 py-4 font-bold">ឈ្មោះសិស្ស</th>
                  <th className="px-5 py-4 font-bold">ថ្នាក់រៀន</th>
                  <th className="px-5 py-4 font-bold">ភេទ</th>
                  <th className="px-4 py-4 text-center font-bold">សរុបយឺត</th>
                  <th className="px-4 py-4 text-center font-bold">សរុបច្បាប់</th>
                  <th className="px-4 py-4 text-center text-rose-600 font-bold">សរុបអត់ច្បាប់</th>
                  <th className="px-4 py-4 text-center text-slate-700 font-bold">សរុបអវត្តមាន</th>
                  <th className="px-5 py-4 text-center font-bold">ស្ថានភាពថ្ងៃនេះ</th>
                  <th className="px-5 py-4 font-bold">មូលហេតុ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyAbsentReport.list.length > 0 ? (
                  dailyAbsentReport.list.map((student, idx) => {
                    const totalAbsent = student.cumulativePermission + student.cumulativeAbsent;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-all font-medium">
                        <td className="px-5 py-5 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-5 py-5">
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

      {/* Daily Attendance Summary Executive Report Panel */}
      <div id="panel_attendance_summary" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold mb-1">
              <ClipboardCheck className="w-5 h-5 text-blue-500" />
              <span className="text-xs uppercase tracking-wider font-bold">របាយការណ៍សង្ខេបវត្តមាន</span>
            </div>
            <h3 className="font-bold text-slate-800 text-base font-serif">វត្តមានសិស្សប្រចាំថ្ងៃសរុប</h3>
            <p className="text-xs text-slate-400 mt-1">ផ្អែកលើទិន្នន័យដែលបានកត់ត្រា និងរក្សាទុកក្នុងប្រព័ន្ធ</p>
          </div>

          {onOpenAttendanceClick && (
            <button
              onClick={onOpenAttendanceClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition duration-250 cursor-pointer border border-blue-200/40 shadow-3xs"
            >
              <span>គ្រប់គ្រងវត្តមានឥឡូវនេះ</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* Aggregated Indicators and Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">អត្រាវត្តមានសរុប</p>
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
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">សិស្សមានវត្តមានសរុប</p>
              <h4 className="text-xl font-black text-emerald-600 mt-1 font-mono">
                {attendanceAggregates.totalPresent} <span className="text-xs font-normal text-slate-500">នាក់-ដង</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold font-mono text-xs">
              P
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">សិស្សមានច្បាប់សរុប</p>
              <h4 className="text-xl font-black text-amber-600 mt-1 font-mono">
                {attendanceAggregates.totalPermission} <span className="text-xs font-normal text-slate-500">នាក់-ដង</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold font-mono text-xs">
              L
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#EA4335] font-bold uppercase tracking-wider">អវត្តមានគ្មានច្បាប់</p>
              <h4 className="text-xl font-black text-rose-600 mt-1 font-mono">
                {attendanceAggregates.totalAbsent} <span className="text-xs font-normal text-slate-500">នាក់-ដង</span>
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
            <span className="text-xs font-bold text-slate-700">📜 កំណត់ត្រាវត្តមានចុងក្រោយសិក្សា</span>
            <span className="text-[10.5px] text-slate-400 font-bold font-mono">សរុប {filteredAttendance.length} ថ្ងៃ</span>
          </div>

          {filteredAttendance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-150 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-4 py-2.5">កាលបរិច្ឆេទ</th>
                    <th className="px-4 py-2.5">ថ្នាក់រៀន</th>
                    <th className="px-4 py-2.5 text-center">វត្តមាន</th>
                    <th className="px-4 py-2.5 text-center">ច្បាប់</th>
                    <th className="px-4 py-2.5 text-center">អវត្តមាន</th>
                    <th className="px-4 py-2.5 text-center">អត្រាវត្តមាន</th>
                    <th className="px-4 py-2.5 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendance.slice(0, 8).map((rec) => {
                    const totalTracked = rec.presentCount + (rec.lateCount || 0) + rec.permissionCount + rec.absentCount;
                    const r = totalTracked > 0 ? Math.round(((rec.presentCount + (rec.lateCount || 0)) / totalTracked) * 100) : 100;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-4 py-3 font-semibold text-slate-705">
                          <div className="flex items-center gap-1.5 font-mono text-slate-600">
                            <Clock size={12} className="text-slate-400" />
                            {rec.date}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{rec.grade}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-bold font-mono">{rec.presentCount}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-bold font-mono">{rec.permissionCount}</td>
                        <td className="px-4 py-3 text-center text-rose-600 font-bold font-mono">{rec.absentCount}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              r >= 90 ? 'bg-emerald-50 text-emerald-700' : r >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {r}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={onOpenAttendanceClick}
                            className="text-blue-600 hover:text-blue-800 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>ពិនិត្យឡើងវិញ</span>
                            <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ClipboardCheck size={36} className="text-slate-350 mb-2" />
              <p className="font-semibold text-slate-605">មិនទាន់មានទិន្នន័យវត្តមានប្រចាំថ្ងៃត្រូវបានកត់ត្រានៅឡើយទេ</p>
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
    </div>
  );
}
