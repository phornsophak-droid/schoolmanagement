/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  FileText, 
  LayoutDashboard, 
  Clock, 
  BookOpen, 
  Sparkles,
  HelpCircle,
  Menu,
  X,
  Smartphone,
  Lock,
  LogOut,
  Users,
  Database,
  Wifi,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

import { StudentScore, SchoolReport, SchoolUser } from './types';
import { initialStudents, initialReports } from './mockData';
import { 
  getSupabaseConfig, 
  getSupabaseClient, 
  syncFetchAll, 
  syncUpsertStudent, 
  syncUpsertStudentsBulk, 
  syncDeleteStudent, 
  syncUpsertReport, 
  syncUpsertReportsBulk, 
  syncDeleteReport, 
  syncGradesBulk, 
  syncDeleteGrade,
  CUSTOM_URL_KEY,
  CUSTOM_ANON_KEY
} from './lib/supabase';
import Dashboard from './components/Dashboard';
import Gradebook from './components/Gradebook';
import ReportWizard from './components/ReportWizard';
import ReportDetail from './components/ReportDetail';
import ReportsHub from './components/ReportsHub';
import LoginPortal from './components/LoginPortal';
import ClassStudentMgmt from './components/ClassStudentMgmt';


export default function App() {
  // Navigation states
  const [activeView, setActiveView] = useState<'dashboard' | 'gradebook' | 'wizard' | 'detail' | 'class-mgmt'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Supabase connection panel active states
  const [isSupabasePanelExpanded, setIsSupabasePanelExpanded] = useState(true);

  // User session state
  const [currentUser, setCurrentUser] = useState<SchoolUser | null>(null);

  // Shared Global Filter states
  const [selectedMonth, setSelectedMonth] = useState<string>('ទាំងអស់');
  const [selectedGrade, setSelectedGrade] = useState<string>('ទាំងអស់');

  // Data Persistence states
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [grades, setGrades] = useState<string[]>([
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
    'ថ្នាក់ភាសាអង់គ្លេស',
    'ថ្នាក់គំនូរ',
    'ថ្នាក់កីឡា និងអប់រំកាយ',
    'ថ្នាក់អប់រំសុខភាព'
  ]);
  
  // Specific Report details/edit state
  const [selectedReport, setSelectedReport] = useState<SchoolReport | null>(null);
  const [reportToEdit, setReportToEdit] = useState<SchoolReport | null>(null);

  // Database Backup Import reference
  const databaseImportRef = React.useRef<HTMLInputElement>(null);

  // Clock ticks
  const [currentTime, setCurrentTime] = useState(new Date());

  // Supabase Sync states
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'syncing' | 'error' | 'unconfigured'>('unconfigured');
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string>('');
  const [isSupabaseConfigOpen, setIsSupabaseConfigOpen] = useState<boolean>(false);
  const [customSupaUrl, setCustomSupaUrl] = useState<string>(localStorage.getItem(CUSTOM_URL_KEY) || '');
  const [customSupaAnon, setCustomSupaAnon] = useState<string>(localStorage.getItem(CUSTOM_ANON_KEY) || '');

  // 1. Initial State Hydration with safety fallback (LocalStorage)
  useEffect(() => {
    // Session Hydration
    const cachedUser = localStorage.getItem('school_current_user_v2');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setCurrentUser(parsed);
        if (parsed.role === 'teacher') {
          setActiveView('gradebook');
          setSelectedGrade(parsed.grade);
        }
      } catch (e) {
        console.error('Failed to parse cached user', e);
      }
    }

    // Grades Hydration
    const cachedGrades = localStorage.getItem('school_grades_v2');
    const defaultGradesList = [
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
      'ថ្នាក់ភាសាអង់គ្លេស',
      'ថ្នាក់គំនូរ',
      'ថ្នាក់កីឡា និងអប់រំកាយ',
      'ថ្នាក់អប់រំសុខភាព'
    ];
    if (cachedGrades) {
      try {
        const parsed = JSON.parse(cachedGrades);
        if (!parsed.includes('មត្តេយ្យ ១')) {
          setGrades(defaultGradesList);
          localStorage.setItem('school_grades_v2', JSON.stringify(defaultGradesList));
        } else {
          setGrades(parsed);
        }
      } catch (e) {
        console.error('Failed to parse grades', e);
        setGrades(defaultGradesList);
      }
    } else {
      setGrades(defaultGradesList);
      localStorage.setItem('school_grades_v2', JSON.stringify(defaultGradesList));
    }

    // Student Scores Hydration
    const cachedScores = localStorage.getItem('school_student_scores_v2');
    if (cachedScores) {
      try {
        const parsed = JSON.parse(cachedScores);
        const hasOldGrades = parsed.some((s: any) => s.grade === 'ថ្នាក់ទី៦');
        if (hasOldGrades) {
          setStudents(initialStudents);
          localStorage.setItem('school_student_scores_v2', JSON.stringify(initialStudents));
        } else {
          setStudents(parsed);
        }
      } catch (e) {
        console.error('Failed to parse students list', e);
        setStudents(initialStudents);
      }
    } else {
      setStudents(initialStudents);
      localStorage.setItem('school_student_scores_v2', JSON.stringify(initialStudents));
    }

    // Reports Hydration
    const cachedReports = localStorage.getItem('school_reports_v2');
    if (cachedReports) {
      try {
        const parsed = JSON.parse(cachedReports);
        const hasOldGrades = parsed.some((r: any) => r.generalInfo?.grade === 'ថ្នាក់ទី៦');
        if (hasOldGrades) {
          setReports(initialReports);
          localStorage.setItem('school_reports_v2', JSON.stringify(initialReports));
        } else {
          setReports(parsed);
        }
      } catch (e) {
        console.error('Failed to parse reports list', e);
        setReports(initialReports);
      }
    } else {
      setReports(initialReports);
      localStorage.setItem('school_reports_v2', JSON.stringify(initialReports));
    }

    // Auto-sync from Supabase cloud database if connection keys are active
    setTimeout(() => {
      const client = getSupabaseClient();
      if (client) {
        setSupabaseStatus('syncing');
        syncFetchAll()
          .then(data => {
            if (data.students && data.students.length > 0) {
              setStudents(data.students);
              localStorage.setItem('school_student_scores_v2', JSON.stringify(data.students));
            }
            if (data.reports && data.reports.length > 0) {
              setReports(data.reports);
              localStorage.setItem('school_reports_v2', JSON.stringify(data.reports));
            }
            if (data.grades && data.grades.length > 0) {
              setGrades(data.grades);
              localStorage.setItem('school_grades_v2', JSON.stringify(data.grades));
            }
            setSupabaseStatus('connected');
            setSupabaseErrorMsg('');
          })
          .catch(err => {
            console.error('Initial Supabase fetch failed', err);
            setSupabaseStatus('error');
            setSupabaseErrorMsg(err?.message || 'Error fetching data');
          });
      } else {
        setSupabaseStatus('unconfigured');
      }
    }, 150);
  }, []);


  // 1b. Supabase Interactive Actions
  const pullFromSupabase = async (quiet = false) => {
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatus('unconfigured');
      if (!quiet) alert('សូមកំណត់អាសយដ្ឋាន URL និង Anon Key របស់ Supabase ជាមុនសិន!');
      return false;
    }

    try {
      setSupabaseStatus('syncing');
      const data = await syncFetchAll();
      
      let msg = 'ទាញទិន្នន័យពី Supabase បានជោគជ័យ!';
      let parts = [];

      if (data.students) {
        setStudents(data.students);
        localStorage.setItem('school_student_scores_v2', JSON.stringify(data.students));
        parts.push(`${data.students.length} សិស្ស`);
      }
      if (data.reports) {
        setReports(data.reports);
        localStorage.setItem('school_reports_v2', JSON.stringify(data.reports));
        parts.push(`${data.reports.length} របាយការណ៍`);
      }
      if (data.grades && data.grades.length > 0) {
        setGrades(data.grades);
        localStorage.setItem('school_grades_v2', JSON.stringify(data.grades));
      }

      setSupabaseStatus('connected');
      setSupabaseErrorMsg('');
      if (!quiet) {
        alert(`${msg} (${parts.join(', ')})`);
      }
      return true;
    } catch (err: any) {
      console.error('Supabase manual pull failed', err);
      setSupabaseStatus('error');
      setSupabaseErrorMsg(err?.message || 'Error loading records');
      if (!quiet) {
        alert('បរាជ័យក្នុងការទាញទិន្នន័យ៖ ' + (err?.message || 'សូមពិនិត្យមើល URL and Anon key របស់អ្នកឡើងវិញ!'));
      }
      return false;
    }
  };

  const pushToSupabase = async () => {
    const client = getSupabaseClient();
    if (!client) {
      alert('សូមកំណត់អាសយដ្ឋាន URL និង Anon Key របស់ Supabase ជាមុនសិន!');
      return;
    }

    if (!window.confirm('តើអ្នកពិតជាចង់សរសេរជាន់លើទិន្នន័យលើ Cloud មែនទេ? ទិន្នន័យចាស់ៗលើ Supabase នឹងត្រូវជំនួសដោយទិន្នន័យបច្ចុប្បន្នលើឧបករណ៍នេះ។')) {
      return;
    }

    try {
      setSupabaseStatus('syncing');

      // 1. Bulk push grades
      if (grades.length > 0) {
        await syncGradesBulk(grades);
      }

      // 2. Bulk push students
      if (students.length > 0) {
        await syncUpsertStudentsBulk(students);
      }

      // 3. Bulk push reports
      if (reports.length > 0) {
        await syncUpsertReportsBulk(reports);
      }

      setSupabaseStatus('connected');
      alert('បានបញ្ជូន និងរក្សាទុកទិន្នន័យទៅកាន់ Supabase Consolidated Database ដោយជោគជ័យ!');
    } catch (err: any) {
      console.error('Supabase write all failed', err);
      setSupabaseStatus('error');
      setSupabaseErrorMsg(err?.message || 'Error saving records');
      alert('បរាជ័យក្នុងការបញ្ជូនទិន្នន័យ៖ ' + (err?.message || 'សូមពិនិត្យការកំណត់ ឬសិទ្ធិរបស់ RLS របស់អ្នកឡើងវិញ!'));
    }
  };

  // 3. User Session Management Handlers
  const handleLoginSuccess = (user: SchoolUser) => {
    setCurrentUser(user);
    localStorage.setItem('school_current_user_v2', JSON.stringify(user));
    
    // Auto-routes based on role
    if (user.role === 'teacher') {
      setActiveView('gradebook');
      setSelectedGrade(user.grade);
    } else {
      setActiveView('dashboard');
      setSelectedGrade('ទាំងអស់');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('school_current_user_v2');
  };

  // 4. Sync Mutated States to LocalStorage & Supabase Cloud
  const handleSaveStudents = async (updatedList: StudentScore[]) => {
    setStudents(updatedList);
    localStorage.setItem('school_student_scores_v2', JSON.stringify(updatedList));

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      try {
        await syncUpsertStudentsBulk(updatedList);
      } catch (err) {
        console.warn('Supabase students backup sync failed', err);
      }
    }
  };

  const handleAddGrade = async (newGrade: string) => {
    const trimmed = newGrade.trim();
    if (!trimmed) return;
    if (grades.includes(trimmed)) {
      alert('ថ្នាក់នេះមានរួចរាល់ហើយ!');
      return;
    }
    const updatedGrades = [...grades, trimmed];
    setGrades(updatedGrades);
    localStorage.setItem('school_grades_v2', JSON.stringify(updatedGrades));

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      try {
        await syncGradesBulk(updatedGrades);
      } catch (err) {
        console.warn('Supabase grade add sync failed', err);
      }
    }
  };

  const handleDeleteGrade = async (gradeToDelete: string) => {
    if (window.confirm(`តើអ្នកពិតជាចង់លុប «${gradeToDelete}» ឬទេ?`)) {
      const hasStudents = students.some(s => s.grade === gradeToDelete);
      const hasReports = reports.some(r => r.generalInfo.grade === gradeToDelete);
      if (hasStudents || hasReports) {
        if (!window.confirm(`ការព្រមាន៖ មានសិស្ស ឬរបាយការណ៍ដែលកំពុងប្រើប្រាស់ ${gradeToDelete} នេះរួចហើយ។ តើអ្នកប្រាកដជាចង់លុបថ្នាក់នេះមែនទេ? (ទិន្នន័យសិស្សចាស់នឹងមិនរងការបាត់បង់ឡើយប៉ុន្តែអាចនឹងគ្មានថ្នាក់សំរាប់ច្បោះ)`)) {
          return;
        }
      }
      const updatedGrades = grades.filter(g => g !== gradeToDelete);
      setGrades(updatedGrades);
      localStorage.setItem('school_grades_v2', JSON.stringify(updatedGrades));
      if (selectedGrade === gradeToDelete) {
        setSelectedGrade('ទាំងអស់');
      }

      // Live background cloud sync
      const client = getSupabaseClient();
      if (client) {
        try {
          await syncDeleteGrade(gradeToDelete);
        } catch (err) {
          console.warn('Supabase grade delete sync failed', err);
        }
      }
    }
  };

  const handleRenameGrade = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    // 1. Rename inside grades list
    const updatedGrades = grades.map(g => g === oldName ? trimmed : g);
    setGrades(updatedGrades);
    localStorage.setItem('school_grades_v2', JSON.stringify(updatedGrades));

    // 2. Rename inside student list
    const updatedStudents = students.map(s => {
      if (s.grade === oldName) {
        return { ...s, grade: trimmed };
      }
      return s;
    });
    setStudents(updatedStudents);
    localStorage.setItem('school_student_scores_v2', JSON.stringify(updatedStudents));

    // 3. Rename inside reports list
    const updatedReports = reports.map(r => {
      if (r.generalInfo.grade === oldName) {
        return {
          ...r,
          generalInfo: { ...r.generalInfo, grade: trimmed }
        };
      }
      return r;
    });
    setReports(updatedReports);
    localStorage.setItem('school_reports_v2', JSON.stringify(updatedReports));

    if (selectedGrade === oldName) {
      setSelectedGrade(trimmed);
    }
    if (currentUser && currentUser.grade === oldName) {
      const updatedUser = { ...currentUser, grade: trimmed };
      setCurrentUser(updatedUser);
      localStorage.setItem('school_current_user_v2', JSON.stringify(updatedUser));
    }

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      try {
        await syncDeleteGrade(oldName);
        await syncGradesBulk(updatedGrades);
        await syncUpsertStudentsBulk(updatedStudents);
        for (const rep of updatedReports) {
          if (rep.generalInfo.grade === trimmed) {
            await syncUpsertReport(rep);
          }
        }
      } catch (err) {
        console.warn('Supabase grade rename sync failed', err);
      }
    }
  };

  const handleSaveReport = async (report: SchoolReport) => {
    let updatedReportsList: SchoolReport[];
    const isEditing = reports.some(r => r.id === report.id);

    if (isEditing) {
      // Edit mode
      updatedReportsList = reports.map(r => r.id === report.id ? report : r);
    } else {
      // Append mode
      updatedReportsList = [...reports, report];
    }

    setReports(updatedReportsList);
    localStorage.setItem('school_reports_v2', JSON.stringify(updatedReportsList));
    setReportToEdit(null);
    setActiveView('dashboard');

    // Live background cloud sync
    const client = getSupabaseClient();
    if (client) {
      try {
        await syncUpsertReport(report);
      } catch (err) {
        console.warn('Supabase report save sync failed', err);
      }
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបចោលរបាយការណ៍នេះជាផ្លូវការឬទេ?')) {
      const updatedList = reports.filter(r => r.id !== id);
      setReports(updatedList);
      localStorage.setItem('school_reports_v2', JSON.stringify(updatedList));

      // Live background cloud sync
      const client = getSupabaseClient();
      if (client) {
        try {
          await syncDeleteReport(id);
        } catch (err) {
          console.warn('Supabase report delete sync failed', err);
        }
      }
    }
  };

  const handleViewReportDetails = (report: SchoolReport) => {
    setSelectedReport(report);
    setActiveView('detail');
  };

  const handleCreateReportInit = () => {
    setReportToEdit(null);
    setActiveView('wizard');
  };

  // Systems Database Backup / Portability Module
  const handleExportDatabase = () => {
    const customTeachersSaved = localStorage.getItem('school_custom_teachers_v2');
    let parsedTeachers = {};
    if (customTeachersSaved) {
      try {
        parsedTeachers = JSON.parse(customTeachersSaved);
      } catch (err) {
        console.error('Failed to parse teachers for backup', err);
      }
    }

    const backupData = {
      version: "v2",
      exportedAt: new Date().toISOString(),
      students: students,
      reports: reports,
      grades: grades,
      customTeachers: parsedTeachers
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    
    // Khmer local date format for backup name
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    link.download = `ថតចម្លង_ទិន្នន័យសាលា_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTriggerImportDatabase = () => {
    if (databaseImportRef.current) {
      databaseImportRef.current.click();
    }
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const backupData = JSON.parse(content);

        if (!backupData || backupData.version !== "v2" || !Array.isArray(backupData.students)) {
          alert("ឯកសារចម្លងមិនត្រឹមត្រូវទេ! សូមជ្រើសរើសឯកសារចម្លង (.json) ដែលបានទាញយកពីប្រព័ន្ធនេះ។");
          return;
        }

        if (window.confirm("តើលោកអ្នកពិតជាចង់នាំចូលទិន្នន័យពីឯកសារចម្លងនេះមែនទេ? ទិន្នន័យបច្ចុប្បន្នទាំងអស់នៅលើឧបករណ៍បច្ចុប្បន្ននេះនឹងត្រូវលុបជំនួសដោយទិន្នន័យចម្លងថ្មីវិញទាំងស្រុង!")) {
          if (backupData.students) {
            setStudents(backupData.students);
            localStorage.setItem('school_student_scores_v2', JSON.stringify(backupData.students));
          }
          if (backupData.reports) {
            setReports(backupData.reports);
            localStorage.setItem('school_reports_v2', JSON.stringify(backupData.reports));
          }
          if (backupData.grades) {
            setGrades(backupData.grades);
            localStorage.setItem('school_grades_v2', JSON.stringify(backupData.grades));
          }
          if (backupData.customTeachers) {
            localStorage.setItem('school_custom_teachers_v2', JSON.stringify(backupData.customTeachers));
          }

          alert("បាននាំចូលទិន្នន័យចម្លង និងធ្វើសមទិន្នន័យប្រព័ន្ធដោយជោគជ័យ! ទំព័រនឹងដំណើរការឡើងវិញឥឡូវនេះ។");
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to parse school data backup", err);
        alert("មានបញ្ហាក្នុងការអានឯកសារចម្លងនេះ។ សូមប្រាកដថាវាជាឯកសារ .json ត្រឹមត្រូវ។");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Clock format parameters
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour12: false });
  const formattedDate = currentTime.toLocaleDateString('kh-KH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!currentUser) {
    return <LoginPortal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-800 font-sans flex selection:bg-blue-105 selection:text-blue-900 overflow-hidden w-full">
      
      {/* 1. Desktop Sidebar (Hidden on mobile and in print) */}
      <aside className="w-64 md:w-72 bg-[#1E293B] text-white flex flex-col shrink-0 hidden md:flex border-r border-slate-800/80 print:hidden h-full">
        {/* Sidebar Brand Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-lg shadow-md font-bold">
              🇰🇭
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 leading-tight">ប្រព័ន្ធគ្រប់គ្រងសាលា</h1>
              <p className="text-[10px] text-slate-400 font-bold font-mono tracking-widest mt-0.5 uppercase">School Admin v2.0</p>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-3 tracking-wide bg-slate-900/40 py-1 px-2 text-center rounded border border-slate-800/10 font-medium">សាលាសហគមន៍ច្បារច្រុះ</p>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
              activeView === 'dashboard'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={16} className={activeView === 'dashboard' ? 'text-blue-400' : 'text-slate-400'} />
              <span>ផ្ទាំងគ្រប់គ្រងព័ត៌មាន</span>
            </div>
            {currentUser?.role === 'teacher' && <Lock size={12} className="text-slate-500" />}
          </button>

          <button
            id="nav_gradebook_tab"
            onClick={() => setActiveView('gradebook')}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
              activeView === 'gradebook'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <GraduationCap size={16} className={activeView === 'gradebook' ? 'text-blue-400' : 'text-slate-400'} />
              <span>តារាងពិន្ទុសិស្ស (Gradebook)</span>
            </div>
          </button>

          <button
            id="nav_class_mgmt_tab"
            onClick={() => setActiveView('class-mgmt')}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
              activeView === 'class-mgmt'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users size={16} className={activeView === 'class-mgmt' ? 'text-blue-400' : 'text-slate-400'} />
              <span>គ្រប់គ្រងថ្នាក់ និងសិស្ស</span>
            </div>
          </button>

          <button
            id="nav_report_wizard_tab"
            onClick={currentUser?.role === 'teacher' ? () => setActiveView('wizard') : handleCreateReportInit}
            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all text-xs font-semibold ${
              activeView === 'wizard'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText size={16} className={activeView === 'wizard' ? 'text-blue-400' : 'text-slate-400'} />
              <span>ផ្ទាំងរបាយការណ៍សាលា</span>
            </div>
            {currentUser?.role === 'teacher' && <Lock size={12} className="text-slate-500" />}
          </button>
        </nav>

        {/* Info Box */}
        <div className="p-4 mx-4 mb-2 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-[10px] text-slate-400 leading-relaxed font-medium">
          <HelpCircle size={14} className="mx-auto text-slate-500 mb-1" />
          <span>ទិន្នន័យរក្សាទុកក្នុងទូរស័ព្ទ / កុំព្យូទ័ររបស់អ្នកដោយផ្ទាល់ (LocalStorage)</span>
        </div>

        {/* Database Transfer & Portability Box */}
        <div className="mx-4 mb-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-bold">
            <Smartphone size={13} className="text-blue-400 animate-pulse" />
            <span>ផ្ទេរទិន្នន័យទៅឧបករណ៍ផ្សេង (ទូរស័ព្ទ)</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-normal font-sans">
            ដើម្បីបើកទិន្នន័យនេះលើទូរស័ព្ទដៃ ឬឧបករណ៍ផ្សេងទៀត៖
          </p>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <button
              onClick={handleExportDatabase}
              className="px-2 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/10 rounded-lg text-[9.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
              title="ទាញយកឯកសារចម្លងស្វ័យប្រវត្ត"
            >
              📥 នាំចេញទិន្នន័យ
            </button>
            <button
              onClick={handleTriggerImportDatabase}
              className="px-2 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/10 rounded-lg text-[9.5px] font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
              title="នាំចូលទិន្នន័យពីទូរស័ព្ទ ឬម៉ាស៊ីនផ្សេង"
            >
              📤 នាំចូលទិន្នន័យ
            </button>
          </div>
          <input
            type="file"
            id="database_import_file"
            ref={databaseImportRef}
            onChange={handleImportDatabase}
            accept=".json"
            className="hidden"
          />
        </div>

        {/* Sidebar Footer (Active Profile Box & Logout Trigger) */}
        <div className="p-4 border-t border-slate-700/50 bg-[#151D2A] shrink-0">
          <div className="flex items-center justify-between gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg ${currentUser?.avatarBg} flex-shrink-0 flex items-center justify-center font-bold text-white text-xs`}>
                {currentUser?.photoCode}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-100 truncate leading-tight">{currentUser?.name}</p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5 font-medium">
                  {currentUser?.role === 'principal' ? 'នាយកសាលា' : `${currentUser?.grade}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-slate-800 hover:text-rose-450 text-slate-400 hover:text-rose-400 rounded-lg transition-colors flex-shrink-0"
              title="ប្តូរគណនី / ចាកចេញ"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Slideout Mobile Drawer Backdrop & Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-30 md:hidden print:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-64 bg-[#1E293B] text-white flex flex-col z-45 md:hidden print:hidden h-full"
            >
              <div className="p-6 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-lg shadow-md font-bold">
                    🇰🇭
                  </div>
                  <div>
                    <h1 className="text-xs font-bold text-slate-100">ប្រព័ន្ធគ្រប់គ្រងសាលា</h1>
                    <p className="text-[9px] text-slate-400 font-bold font-mono uppercase">School Admin v2.0</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors ms-auto"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1 mt-2 overflow-y-auto">
                <button
                  onClick={() => {
                    setActiveView('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between text-xs font-medium ${
                    activeView === 'dashboard'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard size={16} />
                    <span>ផ្ទាំងគ្រប់គ្រងព័ត៌មាន</span>
                  </div>
                  {currentUser?.role === 'teacher' && <Lock size={12} className="text-slate-500" />}
                </button>

                <button
                  onClick={() => {
                    setActiveView('gradebook');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between text-xs font-medium ${
                    activeView === 'gradebook'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap size={16} />
                    <span>តារាងពិន្ទុសិស្ស</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveView('class-mgmt');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between text-xs font-medium ${
                    activeView === 'class-mgmt'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={16} />
                    <span>គ្រប់គ្រងថ្នាក់ និងសិស្ស</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (currentUser?.role === 'teacher') {
                      setActiveView('wizard');
                    } else {
                      handleCreateReportInit();
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between text-xs font-medium ${
                    activeView === 'wizard'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={16} />
                    <span>ផ្ទាំងរបាយការណ៍សាលា</span>
                  </div>
                  {currentUser?.role === 'teacher' && <Lock size={12} className="text-slate-500" />}
                </button>
              </nav>

              {/* Mobile Backup / Restore Transfer widget */}
              <div className="px-4 py-3 border-t border-slate-700/50 bg-[#151D2E]/50 shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 mb-1.5">
                  <Smartphone size={12} className="text-blue-400" />
                  <span>ការផ្ទេរ និងរក្សាទុកទិន្នន័យចម្លង</span>
                </div>
                <p className="text-[8.5px] text-slate-400 leading-normal mb-2">
                  ទាញយកឯកសារចម្លងពីកុំព្យូទ័រ រួចយកមក «នាំចូល» ក្នុងទូរស័ព្ទនេះ។
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportDatabase}
                    className="px-2 py-1.5 bg-blue-600/25 text-blue-400 hover:bg-blue-600/35 border border-blue-500/10 rounded-lg text-[9.5px] font-bold text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    📥 នាំចេញ
                  </button>
                  <button
                    onClick={handleTriggerImportDatabase}
                    className="px-2 py-1.5 bg-emerald-600/25 text-emerald-400 hover:bg-emerald-600/35 border border-emerald-500/10 rounded-lg text-[9.5px] font-bold text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    📤 នាំចូល
                  </button>
                </div>
              </div>

              <div className="p-4 border-t border-slate-700/50 bg-[#151D2A] shrink-0">
                <div className="flex items-center justify-between gap-2 p-1">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{currentUser?.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {currentUser?.role === 'principal' ? 'នាយកសាលា' : `${currentUser?.grade}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-1 px-2.5 bg-slate-800/80 rounded border border-slate-700 hover:text-rose-400 text-slate-400 text-[10px] font-medium transition-colors flex items-center gap-1"
                  >
                    <LogOut size={10} /> ចាកចេញ
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. Main Outer Body Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* National Decorative Top Border */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-[#E52B50] to-blue-700 print:hidden shrink-0 z-20" />

        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200px px-4 md:px-8 flex items-center justify-between shrink-0 print:hidden z-10 shadow-2xs">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="font-bold text-xs text-slate-700 font-serif">SMS v2.0</span>
          </div>

          {/* Majestic Royal Slogan - Perfectly Centered */}
          <div className="text-center flex-1 pr-16 max-w-full truncate md:block hidden">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none">ព្រះរាជាណាចក្រកម្ពុជា</h2>
            <p className="text-[10px] font-semibold text-slate-500 tracking-widest mt-1.5">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
          </div>

          <div className="text-center md:hidden flex-1 max-w-xs truncate px-2">
            <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider leading-none">សាលាសហគមន៍ច្បារច្រុះ</h2>
          </div>

          {/* Clock Info Area */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[#1E293B] font-medium shadow-3xs">
              <Clock size={12} className="text-slate-400" />
              <span className="font-mono font-bold text-blue-600">{formattedTime}</span>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] text-slate-500 font-medium">{formattedDate}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#10B981]/10 text-emerald-700 rounded-lg border border-[#10B981]/20 font-bold text-[10px]">
              <Sparkles size={11} className="text-emerald-600 animate-pulse" />
              <span className="hidden xs:inline">ម៉ាស៊ីនដំណើរការស្រួល</span>
              <span className="xs:hidden">សកម្ម</span>
            </div>
          </div>
        </header>

        {/* 4. Scrollable Component Canvas Container */}
        <main className="flex-1 overflow-y-auto bg-[#F4F7FA] p-4 md:p-8 print:p-0 print:m-0 print:overflow-visible print:bg-white min-h-0">
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
            <AnimatePresence mode="wait">
              <>
                {activeView === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Dashboard
                      reports={reports}
                      students={students}
                      selectedMonth={selectedMonth}
                      setSelectedMonth={setSelectedMonth}
                      selectedGrade={selectedGrade}
                      setSelectedGrade={setSelectedGrade}
                      onViewReport={handleViewReportDetails}
                      onDeleteReport={handleDeleteReport}
                      onCreateReportClick={handleCreateReportInit}
                      onOpenGradebookClick={() => setActiveView('gradebook')}
                      grades={grades}
                      currentUser={currentUser}
                    />
                  </motion.div>
                )}

                {activeView === 'gradebook' && (
                  <motion.div
                    key="gradebook"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Gradebook
                      students={students}
                      selectedMonth={selectedMonth}
                      setSelectedMonth={setSelectedMonth}
                      selectedGrade={selectedGrade}
                      setSelectedGrade={setSelectedGrade}
                      onSaveStudents={handleSaveStudents}
                      currentUser={currentUser}
                      grades={grades}
                      onAddGrade={handleAddGrade}
                      onDeleteGrade={handleDeleteGrade}
                    />
                  </motion.div>
                )}

                {activeView === 'wizard' && (
                  <motion.div
                    key="wizard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ReportsHub
                      reports={reports}
                      onSaveReport={handleSaveReport}
                      onDeleteReport={handleDeleteReport}
                      onViewReport={handleViewReportDetails}
                      students={students}
                      grades={grades}
                      currentUser={currentUser}
                      onCancel={() => setActiveView('dashboard')}
                    />
                  </motion.div>
                )}

                {activeView === 'detail' && selectedReport && (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ReportDetail
                      report={selectedReport}
                      onBack={() => {
                        setSelectedReport(null);
                        setActiveView('dashboard');
                      }}
                    />
                  </motion.div>
                )}

                {activeView === 'class-mgmt' && (
                  <motion.div
                    key="class-mgmt"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ClassStudentMgmt
                      students={students}
                      grades={grades}
                      onSaveStudents={handleSaveStudents}
                      onAddGrade={handleAddGrade}
                      onDeleteGrade={handleDeleteGrade}
                      onRenameGrade={handleRenameGrade}
                      currentUser={currentUser}
                    />
                  </motion.div>
                )}
              </>
            </AnimatePresence>

            {/* Recent Live Activity Ticker widget matching HTML spec exactly */}
            {activeView === 'dashboard' && (
              <div className="bg-[#1E293B] rounded-2xl flex flex-col md:flex-row items-start md:items-center py-4 px-6 gap-3 md:gap-6 text-white text-xs font-semibold shadow-md border border-slate-800/40 print:hidden mt-2 shrink-0">
                <div className="flex items-center gap-2 text-blue-400 shrink-0 font-bold">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
                  <span>សកម្មភាពចុងក្រោយ៖</span>
                </div>
                <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:gap-6 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">10:45 AM</span> 
                    <span className="truncate">បានបញ្ចូលពិន្ទុសិស្ស៖ សុខ លីណា</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">09:30 AM</span> 
                    <span className="truncate">បានរក្សាទុកសេចក្តីព្រាងរបាយការណ៍ប្រចាំខែ</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono italic shrink-0">
                  ប្រព័ន្ធត្រូវបានការពារដោយសុវត្ថិភាព
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[11px] text-slate-400 print:hidden shrink-0 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 font-medium">
            <p>© ២០២៦ សាលាសហគមន៍ច្បារច្រុះ។ រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ លោកគ្រូ-អ្នកគ្រូ។</p>
            <p className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-3xs">
              ប្រព័ន្ធផ្សារភ្ជាប់ទិន្នន័យ (LocalStorage Engine V2)
            </p>
          </div>
        </footer>

      </div>

      {/* 5. Supabase Connection Status Panel / Toggler */}
      <div id="supabase_status_panel" className="fixed bottom-4 right-4 z-50 print:hidden font-sans">
        <AnimatePresence mode="wait">
          {!isSupabasePanelExpanded ? (
            <motion.button
              key="collapsed_supabase"
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              onClick={() => setIsSupabasePanelExpanded(true)}
              className="px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] border border-slate-700/60 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold text-slate-100 transition-all group cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                {supabaseStatus === 'connected' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                )}
                {supabaseStatus === 'syncing' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </>
                )}
                {supabaseStatus === 'error' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </>
                )}
                {supabaseStatus === 'unconfigured' && (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500 animate-pulse"></span>
                )}
              </span>
              <Database size={13} className={`${supabaseStatus === 'syncing' ? 'animate-spin' : ''} text-[#3ECF8E]`} />
              <span>
                {supabaseStatus === 'connected' && 'ទិន្នន័យ៖ Supabase រួចរាល់'}
                {supabaseStatus === 'syncing' && 'កំពុងធ្វើសមកាលកម្ម...'}
                {supabaseStatus === 'error' && 'បញ្ហាតភ្ជាប់ Supabase'}
                {supabaseStatus === 'unconfigured' && 'មិនទាន់តភ្ជាប់ Supabase'}
              </span>
              <ChevronUp size={14} className="text-slate-400" />
            </motion.button>
          ) : (
            <motion.div
              key="expanded_supabase"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="w-80 bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {supabaseStatus === 'connected' && (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </>
                    )}
                    {supabaseStatus === 'syncing' && (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                      </>
                    )}
                    {supabaseStatus === 'error' && (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </>
                    )}
                    {supabaseStatus === 'unconfigured' && (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500 animate-pulse"></span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Database size={15} className="text-[#3ECF8E]" />
                    <span className="text-[11px] font-bold tracking-wide text-slate-200 font-serif">ស្ថានភាពទិន្នន័យ Supabase</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsSupabaseConfigOpen(true)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 hover:text-[#3ECF8E] text-slate-300 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    title="ការកំណត់គ្រាប់ចុចសម្ងាត់"
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    onClick={() => setIsSupabasePanelExpanded(false)}
                    className="hover:bg-slate-800 bg-slate-800/60 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-0.5 text-[9px] font-bold px-2 py-1.5 cursor-pointer"
                    title="លាក់ផ្ទាំងនេះ"
                  >
                    <ChevronDown size={12} />
                    <span>លាក់</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-[10px] font-medium text-slate-300">
                <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-400 font-medium font-serif">ស្ថានភាពម៉ាស៊ីនបម្រើ៖</span>
                  <span className="font-semibold flex items-center gap-1">
                    {supabaseStatus === 'connected' && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi size={11} /> រួចរាល់ (កំពុងភ្ជាប់)
                      </span>
                    )}
                    {supabaseStatus === 'syncing' && (
                      <span className="text-blue-400 flex items-center gap-1">
                        <RefreshCw size={11} className="animate-spin" /> កំពុងតភ្ជាប់...
                      </span>
                    )}
                    {supabaseStatus === 'error' && (
                      <span className="text-rose-400 flex items-center gap-1" title={supabaseErrorMsg}>
                        <AlertTriangle size={11} /> ភ្ជាប់បរាជ័យ
                      </span>
                    )}
                    {supabaseStatus === 'unconfigured' && (
                      <span className="text-slate-400">មិនទាន់កំណត់</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-400 font-medium font-serif">ការធ្វើសមកាលកម្ម៖</span>
                  <span className="text-blue-400 font-semibold flex items-center gap-1">
                    <ArrowRightLeft size={10} className="text-blue-400 animate-pulse" /> ស្វ័យប្រវត្តក្នុងទូរស័ព្ទ & PC
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-400 font-medium font-serif font-sans">តារាងទិន្នន័យ Supabase៖</span>
                  <span className="font-mono text-slate-400 text-[8.5px]">scores, reports, grades</span>
                </div>
              </div>

              {/* Status Specific Prompt Cards */}
              {supabaseStatus === 'unconfigured' && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] leading-relaxed text-amber-300">
                  <p className="font-bold mb-0.5 flex items-center gap-1">
                    <span>⚠️ មិនទាន់តភ្ជាប់ Cloud ទេ៖</span>
                  </p>
                  <span>
                    សូមចុចប៊ូតុង <strong>⚙️ ការកំណត់</strong> ដើម្បីបំពេញ Supabase URL & Anon Key ដើម្បីអាចបញ្ចូលពិន្ទុ និងមើលរបាយការណ៍រួមគ្នាពីទូរស័ព្ទដៃ និងកុំព្យូទ័របាន។
                  </span>
                </div>
              )}

              {supabaseStatus === 'error' && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-[9.5px] text-rose-300">
                  <p className="font-bold mb-0.5 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    <span>បញ្ហាតភ្ជាប់៖</span>
                  </p>
                  <p className="text-[9px] text-slate-300 mb-1.5 leading-snug break-words">
                    {supabaseErrorMsg || 'ព័ត៌មាន Keys មិនត្រឹមត្រូវ ឬគ្មានប្រព័ន្ធអ៊ីនធឺណិត។'}
                  </p>
                  <button
                    onClick={() => pullFromSupabase(false)}
                    className="w-full py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-md text-[9px] transition-all cursor-pointer"
                  >
                    🔄 ព្យាយាមតភ្ជាប់ម្តងទៀត
                  </button>
                </div>
              )}

              {supabaseStatus === 'connected' && (
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <button
                    onClick={() => pullFromSupabase(false)}
                    className="py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 active:scale-95 text-blue-400 font-bold rounded-xl text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="ទាញទិន្នន័យថ្មីៗមកជំនួស"
                  >
                    <RefreshCw size={11} className="animate-spin-slow" />
                    <span>📥 ទាញទិន្នន័យ (Pull)</span>
                  </button>
                  <button
                    onClick={pushToSupabase}
                    className="py-2 bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/20 active:scale-95 text-emerald-400 font-bold rounded-xl text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="រុញទិន្នន័យជំនួសលើ Cloud"
                  >
                    <span>📤 បញ្ជូនឡើង (Push)</span>
                  </button>
                </div>
              )}

              {/* Helpful explanation explaining how to sync with mobile */}
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-2.5 text-[9px] leading-relaxed text-slate-300 shrink-0">
                <p className="font-bold text-blue-400 mb-0.5 flex items-center gap-1">
                  <span>💡 របៀបប្រើប្រាស់ជាមួយទូរស័ព្ទដៃ៖</span>
                </p>
                <span>
                  នៅពេលអ្នកកំណត់ Supabase ដូចគ្នាលើទាំងកុំព្យូទ័រ និងទូរស័ព្ទរបស់គ្រូៗ នោះរាល់ការបញ្ចូលពិន្ទុ និងរបាយការណ៍នឹងរក្សាទុករួមគ្នាដោយស្វ័យប្រវត្តិ។
                </span>
              </div>

              <div className="text-[9.5px] text-slate-500 text-center leading-normal pt-1 flex items-center justify-center gap-1 border-t border-slate-800">
                <span>⚡ SSL PostgreSQL Secure Database Connection</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Supabase Dynamic Configuration Modal */}
      <AnimatePresence>
        {isSupabaseConfigOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 text-slate-100 relative"
            >
              <button
                onClick={() => setIsSupabaseConfigOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 text-slate-200 border-b border-slate-800 pb-3 mb-4">
                <Settings className="text-[#3ECF8E]" size={20} />
                <h3 className="font-bold text-sm tracking-wide font-serif">ការកំណត់ទិន្នន័យចម្លង Supabase Cloud</h3>
              </div>

              <p className="text-[10px] text-slate-300 leading-relaxed mb-4 text-left">
                សូមបំពេញ URL និង API Key (Anon Key) របស់គម្រោង Supabase របស់អ្នក ដើម្បីបើកដំណើរការការបញ្ចូលទិន្នន័យសិស្ស និងសមទិន្នន័យភ្លាមៗជាមួយទូរស័ព្ទដៃ និងឧបករណ៍នានារបស់លោកគ្រូអ្នកគ្រូ។
              </p>

              <div className="space-y-4 text-left font-medium text-slate-300 text-xs">
                {/* Supabase URL */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 text-[10px] font-bold">SUPABASE URL</label>
                  <input
                    type="text"
                    value={customSupaUrl}
                    onChange={(e) => setCustomSupaUrl(e.target.value)}
                    placeholder="https://your-project-ref.supabase.co"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:border-[#3ECF8E] focus:outline-none placeholder:text-slate-600 font-mono text-[11px] text-slate-100 transition-colors"
                  />
                </div>

                {/* Supabase Anon Key */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 text-[10px] font-bold">SUPABASE SERVICE ANON KEY</label>
                  <textarea
                    rows={4}
                    value={customSupaAnon}
                    onChange={(e) => setCustomSupaAnon(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:border-[#3ECF8E] focus:outline-none placeholder:text-slate-600 font-mono text-[10px] text-slate-100 leading-normal transition-colors"
                  />
                </div>
              </div>

              {/* Help tip */}
              <div className="mt-4 p-2.5 bg-slate-900/60 border border-slate-800/60 rounded-xl text-[9px] text-slate-400 leading-relaxed flex flex-col gap-1 text-left font-sans">
                <span className="font-bold text-slate-300">💡 របៀបស្វែងរក Keys ទាំងនេះ៖</span>
                <span>១. ចូលទៅកាន់តំបន់គ្រប់គ្រង Supabase Dashboard (supabase.com)</span>
                <span>២. ចូលទៅកាន់ <strong className="text-slate-300">Project Settings</strong> → <strong className="text-slate-300">API Documentation</strong></span>
                <span>៣. ចម្លងយក URL និង Keys ដែលមានឈ្មោះថា <strong className="text-[#3ECF8E]">anon public key</strong> មកបំពេញខាងលើ។</span>
              </div>

              {/* Actions button */}
              <div className="grid grid-cols-3 gap-2 mt-5">
                <button
                  onClick={async () => {
                    localStorage.removeItem(CUSTOM_URL_KEY);
                    localStorage.removeItem(CUSTOM_ANON_KEY);
                    setCustomSupaUrl('');
                    setCustomSupaAnon('');
                    setIsSupabaseConfigOpen(false);
                    // trigger status config reload
                    setSupabaseStatus('unconfigured');
                    alert('បានជម្រះសោសម្ងាត់ផ្ទាល់ខ្លួនរួចរាល់! ប្រព័ន្ធនឹងត្រលប់មកប្រើប្រាស់ LocalStorage ជំនួសវិញ។');
                  }}
                  className="py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  ជម្រះ / លុបចេញ
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupabaseConfigOpen(false)}
                  className="py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer text-center"
                >
                  បោះបង់
                </button>
                <button
                  onClick={async () => {
                    const trimmedUrl = customSupaUrl.trim();
                    const trimmedKey = customSupaAnon.trim();

                    if (!trimmedUrl || !trimmedKey) {
                      alert('សូមបំពេញ URL និង API Key ឱ្យពេញលេញជាមុនសិន!');
                      return;
                    }

                    try {
                      setSupabaseStatus('syncing');
                      // Set temporarily to verify connection
                      localStorage.setItem(CUSTOM_URL_KEY, trimmedUrl);
                      localStorage.setItem(CUSTOM_ANON_KEY, trimmedKey);

                      const success = await pullFromSupabase(true);
                      if (success) {
                        setIsSupabaseConfigOpen(false);
                        alert('ការតភ្ជាប់តេស្តបានជោគជ័យ! ទិន្នន័យ Supabase Cloud ត្រូវបានមកបញ្ចូលស្វ័យប្រវត្ត។');
                      } else {
                        // clear state on failure
                        localStorage.removeItem(CUSTOM_URL_KEY);
                        localStorage.removeItem(CUSTOM_ANON_KEY);
                        setSupabaseStatus('error');
                        setSupabaseErrorMsg('ព័ត៌មាន Keys មិនត្រឹមត្រូវ។ មិនអាចទាក់ទងទិន្នន័យតេស្តបានទេ។');
                        alert('ការតភ្ជាប់តេស្តបានបរាជ័យ៖ សូមពិនិត្យមើល URL និង API Key ម្តងទៀត!');
                      }
                    } catch (err: any) {
                      localStorage.removeItem(CUSTOM_URL_KEY);
                      localStorage.removeItem(CUSTOM_ANON_KEY);
                      setSupabaseStatus('error');
                      setSupabaseErrorMsg(err?.message || 'Error occurred');
                      alert('បរាជ័យក្នុងការតភ្ជាប់៖ ' + (err?.message || 'សូមផ្ទៀងផ្ទាត់ Keys ម្តងទៀត!'));
                    }
                  }}
                  className="py-2.5 bg-[#3ECF8E] hover:bg-[#34b279] text-slate-950 font-bold rounded-xl text-[10px] transition-all shadow-md cursor-pointer text-center"
                >
                  រក្សាទុក & ភ្ជាប់
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

