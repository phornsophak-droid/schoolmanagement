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
  Smartphone
} from 'lucide-react';

import { StudentScore, SchoolReport } from './types';
import { initialStudents, initialReports } from './mockData';
import Dashboard from './components/Dashboard';
import Gradebook from './components/Gradebook';
import ReportWizard from './components/ReportWizard';
import ReportDetail from './components/ReportDetail';
import AcledaMobile from './components/AcledaMobile';

export default function App() {
  // Navigation states
  const [activeView, setActiveView] = useState<'dashboard' | 'gradebook' | 'wizard' | 'detail' | 'acleda'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Shared Global Filter states
  const [selectedMonth, setSelectedMonth] = useState<string>('ទាំងអស់');
  const [selectedGrade, setSelectedGrade] = useState<string>('ទាំងអស់');

  // Data Persistence states
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  
  // Specific Report details/edit state
  const [selectedReport, setSelectedReport] = useState<SchoolReport | null>(null);
  const [reportToEdit, setReportToEdit] = useState<SchoolReport | null>(null);

  // Clock ticks
  const [currentTime, setCurrentTime] = useState(new Date());

  // 1. Initial State Hydration with safety fallback (LocalStorage)
  useEffect(() => {
    // Student Scores Hydration
    const cachedScores = localStorage.getItem('school_student_scores_v2');
    if (cachedScores) {
      try {
        setStudents(JSON.parse(cachedScores));
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
        setReports(JSON.parse(cachedReports));
      } catch (e) {
        console.error('Failed to parse reports list', e);
        setReports(initialReports);
      }
    } else {
      setReports(initialReports);
      localStorage.setItem('school_reports_v2', JSON.stringify(initialReports));
    }
  }, []);

  // 2. Real-time Ticking Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Sync Mutated States to LocalStorage
  const handleSaveStudents = (updatedList: StudentScore[]) => {
    setStudents(updatedList);
    localStorage.setItem('school_student_scores_v2', JSON.stringify(updatedList));
  };

  const handleSaveReport = (report: SchoolReport) => {
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
  };

  const handleDeleteReport = (id: string) => {
    if (window.confirm('តើអ្នកពិតជាចង់លុបចោលរបាយការណ៍នេះជាផ្លូវការឬទេ?')) {
      const updatedList = reports.filter(r => r.id !== id);
      setReports(updatedList);
      localStorage.setItem('school_reports_v2', JSON.stringify(updatedList));
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

  // Clock format parameters
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour12: false });
  const formattedDate = currentTime.toLocaleDateString('kh-KH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

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
          <p className="text-[9px] text-slate-400 mt-3 text-center uppercase tracking-wider bg-slate-900/30 py-1.5 rounded-lg border border-slate-800/20 font-semibold">សាលាសហគមន៍ច្បារច្រុះ</p>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all text-xs font-semibold ${
              activeView === 'dashboard'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={16} className={activeView === 'dashboard' ? 'text-blue-400' : 'text-slate-400'} />
            <span>ផ្ទាំងគ្រប់គ្រងព័ត៌មាន</span>
          </button>

          <button
            id="nav_gradebook_tab"
            onClick={() => setActiveView('gradebook')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all text-xs font-semibold ${
              activeView === 'gradebook'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <GraduationCap size={16} className={activeView === 'gradebook' ? 'text-blue-400' : 'text-slate-400'} />
            <span>តារាងពិន្ទុសិស្ស (Gradebook)</span>
          </button>

          <button
            id="nav_report_wizard_tab"
            onClick={handleCreateReportInit}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all text-xs font-semibold ${
              activeView === 'wizard'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <FileText size={16} className={activeView === 'wizard' ? 'text-blue-400' : 'text-slate-400'} />
            <span>របាយការណ៍ប្រចាំខែ</span>
          </button>

          <button
            id="nav_acleda_tab"
            onClick={() => setActiveView('acleda')}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all text-xs font-semibold ${
              activeView === 'acleda'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Smartphone size={16} className={activeView === 'acleda' ? 'text-blue-400' : 'text-slate-400'} />
            <span>គំរូទូរស័ព្ទ ACLEDA UI</span>
          </button>
        </nav>

        {/* Info Box */}
        <div className="p-4 mx-4 mb-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center text-[10px] text-slate-450 leading-relaxed font-medium">
          <HelpCircle size={14} className="mx-auto text-slate-500 mb-1" />
          <span>ទិន្នន័យត្រូវបានរក្សាសុវត្ថិភាពស្វ័យប្រវត្តក្នុង LocalStorage</span>
        </div>

        {/* Sidebar Footer (Teacher Profile Box) */}
        <div className="p-4 border-t border-slate-700/50 bg-[#151D2A] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs">
              សវ
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">លោកគ្រូ សុខ វិបុល</p>
              <p className="text-[10px] text-slate-400 truncate">គ្រូបន្ទុកថ្នាក់ទី ៦អា (6A)</p>
            </div>
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
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-xs font-medium ${
                    activeView === 'dashboard'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  <span>ផ្ទាំងគ្រប់គ្រងព័ត៌មាន</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('gradebook');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-xs font-medium ${
                    activeView === 'gradebook'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <GraduationCap size={16} />
                  <span>តារាងពិន្ទុសិស្ស</span>
                </button>

                <button
                  onClick={() => {
                    handleCreateReportInit();
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-xs font-medium ${
                    activeView === 'wizard'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <FileText size={16} />
                  <span>របាយការណ៍ប្រចាំខែ</span>
                </button>

                <button
                  onClick={() => {
                    setActiveView('acleda');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 text-xs font-medium ${
                    activeView === 'acleda'
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/10'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={16} />
                  <span>គំរូទូរស័ព្ទ ACLEDA UI</span>
                </button>
              </nav>

              <div className="p-4 border-t border-slate-700/50 bg-[#151D2A] shrink-0">
                <p className="text-xs font-semibold text-slate-200">លោកគ្រូ សុខ វិបុល</p>
                <p className="text-[10px] text-slate-400 mt-0.5">គ្រូបន្ទុកថ្នាក់ទី ៦អា (6A)</p>
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
                  <ReportWizard
                    onSaveReport={handleSaveReport}
                    onCancel={() => setActiveView('dashboard')}
                    students={students}
                    reportToEdit={reportToEdit}
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

              {activeView === 'acleda' && (
                <motion.div
                  key="acleda"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.15 }}
                  className="w-full font-sans text-slate-800"
                >
                  <AcledaMobile />
                </motion.div>
              )}
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

    </div>
  );
}
