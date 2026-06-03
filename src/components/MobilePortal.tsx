/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  ClipboardList, 
  CalendarDays, 
  Clock, 
  Megaphone, 
  Award, 
  Image as ImageIcon, 
  Receipt, 
  User, 
  LogOut, 
  ChevronLeft, 
  Menu, 
  Bell, 
  MoreVertical, 
  Send, 
  Plus, 
  CheckCircle, 
  Calendar,
  X,
  Share2,
  Lock,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { StudentScore, SchoolUser } from '../types';

interface MobilePortalProps {
  students: StudentScore[];
  currentUser: SchoolUser | null;
  onLogoutClick?: () => void;
  grades?: string[];
}

export default function MobilePortal({
  students,
  currentUser,
  onLogoutClick,
  grades = []
}: MobilePortalProps) {
  // Simulator Navigation & States
  const [phoneScreen, setPhoneScreen] = useState<'login' | 'dashboard' | 'report' | 'attendance' | 'timetable' | 'messages' | 'assignments' | 'announcements' | 'gallery' | 'fees'>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  
  // Login fields mockup
  const [username, setUsername] = useState('parent_demo');
  const [password, setPassword] = useState('••••••••');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Chat/Messages State Mockup
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'teacher', text: 'សួស្តីអាណាព្យាបាលសិស្ស! ថ្ងៃនេះប្អូនរៀនបានល្អណាស់ និងជួយមិត្តភក្តិសំអាតថ្នាក់ទៀតផង។', time: '11:20 AM' },
    { sender: 'parent', text: 'បាទអរគុណច្រើនលោកគ្រូ! តើការប្រឡងខែនេះ កូនខ្ញុំធ្វើបានល្អទេបាទ?', time: '11:30 AM' },
    { sender: 'teacher', text: 'ពិន្ទុខែនេះកូនរបស់លោកអ្នកទទួលបាន ៨.៥/១០ លើមុខវិជ្ជាគណិតវិទ្យា។ ពូកែណាស់បាទ!', time: '11:32 AM' }
  ]);

  // Daily Dairy state
  const [dairyEntries, setDairyEntries] = useState([
    { id: '1', date: '២០២៦-០៦-០៣', title: 'សកម្មភាពអប់រំកាយ', desc: 'ចូលរួមលេងកីឡាបាល់ទាត់ដោយស្វាហាប់ និងមានវិន័យខ្ពស់។', category: 'កីឡា/សុខភាព', rating: 'ល្អណាស់' },
    { id: '2', date: '២០២៦-០៦-០២', title: 'ការអានភាសាខ្មែរ', desc: 'បានអានអត្ថបទរឿងខ្លីដាច់បានល្អ និងយល់ន័យច្រើន។', category: 'ការសិក្សា', rating: 'ល្អ' },
    { id: '3', date: '២០២៦-០៦-០១', title: 'អនាម័យក្នុងថ្នាក់', desc: 'ជួយជូតក្តារខៀន និងរៀបចំតុគ្រូបង្រៀនដោយស្ម័គ្រចិត្ត។', category: 'សីលធម៌', rating: 'ល្អណាស់' }
  ]);
  const [newDairyTitle, setNewDairyTitle] = useState('');
  const [newDairyDesc, setNewDairyDesc] = useState('');

  // Assignments State Mockup
  const [assignments, setAssignments] = useState([
    { id: '1', subject: 'ភាសាខ្មែរ', task: 'សរសេររឿងខ្លីស្តីពី «មិត្តល្អ» ចំនួន ២ទំព័រ', dueDate: 'ថ្ងៃត្រង់ ថ្ងៃសុក្រ', isDone: false },
    { id: '2', subject: 'គណិតវិទ្យា', task: 'ធ្វើលំហាត់លេខ ៤ និង លេខ ៥ ទំព័រទី ៤២', dueDate: 'ថ្ងៃស្អែក', isDone: true },
    { id: '3', subject: 'វិទ្យាសាស្ត្រ', task: 'គូររូបភាពសរីរាង្គដកដង្ហើមរបស់សត្វ', dueDate: 'សប្តាហ៍ក្រោយ', isDone: false }
  ]);

  // Announcements Mockup
  const [announcements] = useState([
    { id: '1', date: '២ ឧសភា', title: 'ការប្រឡងឆមាសទី២ ថ្នាក់បឋមសិក្សា', desc: 'សូមអាណាព្យាបាលជួយជម្រុញការរៀនសូត្របន្ថែមនៅផ្ទះត្រៀមការប្រឡងឆមាសខាងមុខ។', badge: 'សំខាន់' },
    { id: '2', date: '២៦ ឧសភា', title: 'ពិធីអបអរទិវាកុមារអន្តរជាតិ ១មិថុនា', desc: 'សាលានឹងរៀបចំកម្មវិធីកម្សាន្ត និងចែកសៀវភៅរង្វាន់លើកទឹកចិត្តដល់សិស្សពូកែ។', badge: 'ព្រឹត្តិការណ៍' },
    { id: '3', date: '១៥ ឧសភា', title: 'អនាម័យជុំវិញបរិវេណសាលា', desc: 'សហការជាមួយសហគមន៍ចុះសំអាត និងដាំកូនឈើបន្ថែមក្នុងសាលារៀន។', badge: 'សហគមន៍' }
  ]);

  // Attendance Custom Data
  const [attendanceMonth, setAttendanceMonth] = useState('មិថុនា');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Interactive Daily Attendance Grid State
  const [attendanceGrid, setAttendanceGrid] = useState<{ [day: number]: 'present' | 'absent' | 'holiday' }>({
    1: 'present', 2: 'present', 3: 'present', 4: 'present', 5: 'holiday', 6: 'holiday',
    7: 'present', 8: 'absent', 9: 'present', 10: 'present', 11: 'present', 12: 'holiday', 13: 'holiday',
    14: 'present', 15: 'present', 16: 'present', 17: 'absent', 18: 'present', 19: 'holiday', 20: 'holiday',
    21: 'present', 22: 'present', 23: 'present', 24: 'present', 25: 'present', 26: 'holiday', 27: 'holiday',
    28: 'present', 29: 'present', 30: 'present', 31: 'present'
  });

  // Calculate Attendance Stats
  const attendanceStats = useMemo(() => {
    let presents = 0;
    let absents = 0;
    let holidays = 0;
    Object.values(attendanceGrid).forEach(status => {
      if (status === 'present') presents++;
      else if (status === 'absent') absents++;
      else if (status === 'holiday') holidays++;
    });
    return { presents, absents, holidays };
  }, [attendanceGrid]);

  // Handle Attendance Change (interactive)
  const toggleDayStatus = (day: number) => {
    setAttendanceGrid(prev => {
      const current = prev[day];
      let next: 'present' | 'absent' | 'holiday' = 'present';
      if (current === 'present') next = 'absent';
      else if (current === 'absent') next = 'holiday';
      else next = 'present';
      return { ...prev, [day]: next };
    });
  };

  // Find Student Details for selected student
  const activeStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || students[0] || {
      id: 'demo_1',
      name: 'សុខ ម៉ារីណា',
      gender: 'ស្រី',
      grade: 'ថ្នាក់ទី ៦ក',
      month: 'មិថុនា',
      khmerAvg: 8.5,
      mathAvg: 8.0,
      overallAvg: 8.4,
      gradeLetter: 'B',
      result: 'ជាប់',
      khmer: { listening: 8, writing: 9, reading: 8, speaking: 9 },
      math: { numbers: 8, measurement: 8, geometry: 7, algebra: 9, statistics: 8 },
      science: 9,
      socialStudies: 8,
      physicalEducation: 9,
      health: 8,
      lifeSkills: 9,
      foreignLanguage: 8
    };
  }, [students, selectedStudentId]);

  // Toggle drawer menu options
  const handleMenuClick = (screen: typeof phoneScreen) => {
    setPhoneScreen(screen);
    setIsDrawerOpen(false);
  };

  // Chat message sender
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      { sender: 'parent', text: chatInput, time: '11:34 AM' }
    ]);
    const messageText = chatInput;
    setChatInput('');

    // Simulate auto-respond teacher
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { 
          sender: 'teacher', 
          text: `បាទអាណាព្យាបាលសិស្ស! ខ្ញុំទទួលបានសារ "${messageText}" នេះហើយ។ ខ្ញុំនឹងពិនិត្យមើលសកម្មភាពសិក្សាបន្ថែម ហើយផ្ដល់ដំណឹងជូនឡើងវិញ។`, 
          time: '11:35 AM' 
        }
      ]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Title & Theme Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 drop-shadow-2xl translate-x-12 translate-y-[-16px]">
          <Smartphone size={160} />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full border border-blue-400/30 text-xs font-bold font-sans tracking-wide mb-3">
            <Sparkles size={12} className="text-blue-300" />
            <span>VIP PHONE UTILITY</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-serif">
            ផ្ទាំងទូរស័ព្ទដៃស្អាត និងទាន់សម័យ (Premium Mobile Portal Drawer)
          </h2>
          <p className="text-slate-200 text-sm mt-3 leading-relaxed max-w-2xl">
            សូមសាកល្បង <strong className="text-blue-300">ឧបករណ៍បញ្ជាក់ទូរស័ព្ទដៃ (Interactive Phone Bezel Emulator)</strong> ដូចគំរូរចនាដែលអ្នកបានជ្រើសរើស។ អ្នកអាចចុចបញ្ជា អូសមឺនុយ បើកកាលវិភាគ ឆាតសាកល្បង ឬកែវត្តមានដោយសេរី!
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button 
              onClick={() => handleMenuClick('dashboard')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl text-xs transition duration-200 shadow-md"
            >
              📱 ផ្ទាំងគ្រប់គ្រង Dashboard (ជាមួយមឺនុយរង្វង់)
            </button>
            <button 
              onClick={() => handleMenuClick('attendance')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs transition duration-200 shadow-md"
            >
              📅 ក្រឡាវត្តមាន Calendar (ប្ដូរពណ៌ស្អាត)
            </button>
            <button 
              onClick={() => handleMenuClick('report')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-xs transition duration-200 shadow-md"
            >
              📊 សន្លឹកពិន្ទុ Report Card (គណនីគ្រូ និងមាតាបិតា)
            </button>
          </div>
        </div>
      </div>

      {/* Main Dual View Area (Options Controls on Left, Realistic Interactive Phone Mockup on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Option Controls and Settings */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
              <span className="w-1.5 h-3.5 bg-blue-600 rounded-full inline-block"></span>
              ការកំណត់ និងព័ត៌មានលម្អិត
            </h3>
            <p className="text-xs text-slate-500 leading-normal mb-4">
              អ្នកអាចជ្រើសរើសសិស្សជាក់លាក់ណាម្នាក់ ដើម្បីឱ្យមឺនុយ Report Card ក្នុងទូរស័ព្ទ បង្ហាញពិន្ទុពិតប្រាកដរបស់កូនពួកគេតាមទិន្នន័យប្រព័ន្ធ។
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ជ្រើសរើសសិស្សដើម្បីតេស្ត៖</label>
                {students.length > 0 ? (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-blue-500"
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.grade} - {s.gender})</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200/50">
                    មិនទាន់មានសិស្សក្នុងប្រព័ន្ធទេ។ សូមបញ្ចូលសិស្សក្នុង Gradebook ជាមុនសិន។
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">គណនីឧបករណ៍ជម្រើស៖</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium text-slate-500">អ្នកប្រើប្រាស់បច្ចុប្បន្ន៖</span>
                    <span className="font-bold underline text-blue-600">{currentUser?.name || 'អាណាព្យាបាលសិស្ស'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium text-slate-500">តួនាទី៖</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold text-[10px]">
                      {currentUser?.role === 'principal' ? 'នាយកសាលា' : 'គ្រូបន្ទុកថ្នាក់'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-amber-500 rounded-full inline-block"></span>
              របៀបប្រើប្រាស់ Interactive Emulator
            </h3>
            
            <ul className="space-y-2.5 text-xs text-slate-600 list-disc pl-4 leading-normal">
              <li>ចុចលើ <strong className="text-slate-800">ប៊ូតុងរង្វង់ពណ៌</strong> នៅលើអេក្រង់ទូរស័ព្ទដើម្បីចូលទំព័រនីមួយៗ។</li>
              <li>ចុចលើ <strong className="text-slate-800">ប៊ូតុងឆ្នូតបី (Header Menu)</strong> ដើម្បីអូសមឺនុយចំហៀង (Drawer View)។</li>
              <li>ចុចលើ <strong className="text-slate-800">ក្រឡាកាលបរិច្ឆេទ</strong> វត្តមាន ដើម្បីផ្លាស់ប្តូរស្ថានភាព (វត្តមាន/អវត្តមាន/ឈប់សម្រាក)។</li>
              <li>សាកល្បង <strong className="text-slate-800">ផ្ញើសារ</strong> ទៅកាន់គ្រូបន្ទុកថ្នាក់ ដើម្បីមើលការឆ្លើយតបស្វ័យប្រវត្តពី AI។</li>
              <li>ចុចប៊ូតុង <strong className="text-slate-800">Home (រង្វង់ខ្សែកោងខាងក្រោមគេ)</strong> ដើម្បីត្រឡប់មកអេក្រង់ដើមវិញ។</li>
            </ul>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 justify-center text-[10px] text-slate-400 font-mono">
              <span>DESIGN VERSION: 2.15 (PREMIUM EDITION)</span>
            </div>
          </div>
        </div>

        {/* Right Side: Realistic Phone Mockup (60% width) */}
        <div className="lg:col-span-8 flex justify-center py-4">
          
          {/* Outer Phone Shell Case / Bezel (With standard premium UI design) */}
          <div className="relative w-full max-w-[390px] h-[780px] bg-slate-900 rounded-[55px] p-3.5 shadow-2xl border-4 border-slate-800 flex flex-col justify-between overflow-hidden">
            
            {/* Phone Front Camera & Speaker Notch Area */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-slate-800 rounded-full"></div>
              <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
            </div>

            {/* Inner Scren Glass Display */}
            <div className="relative flex-1 w-full bg-slate-50 rounded-[42px] flex flex-col overflow-hidden select-none">
              
              {/* Phone Status Top Margin Bar (WiFi, Time, Battery) */}
              <div className="h-9 bg-blue-700/90 text-white text-[10.5px] font-bold px-6 flex items-center justify-between shrink-0 z-30 font-sans">
                <span className="tracking-wide">11:47 AM</span>
                <div className="flex items-center gap-1.5">
                  <span>📶</span>
                  <span>📶</span>
                  <span>🔋 68%</span>
                </div>
              </div>

              {/* SLIDE-OUT DRAWER OVERLAY (Screen #2) */}
              {isDrawerOpen && (
                <div className="absolute inset-0 z-40 flex">
                  {/* Backdrop shadow */}
                  <div 
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex-1 bg-black/40 backdrop-blur-3xs"
                  />
                  {/* Real Drawer panel */}
                  <div className="w-[280px] bg-blue-900 text-white flex flex-col justify-between shadow-2xl relative animate-slide-right">
                    
                    {/* Drawer Profile Header with gold strip accent */}
                    <div className="p-5 pt-8 bg-blue-950 border-b border-blue-800 relative">
                      <button 
                        onClick={() => setIsDrawerOpen(false)}
                        className="absolute top-4 right-4 text-white/75 hover:text-white p-1"
                      >
                        <X size={18} />
                      </button>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-white shadow-md flex items-center justify-center font-bold text-blue-950 text-base">
                          {activeStudent.gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓'}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold font-sans tracking-wide text-amber-400 uppercase">
                            {activeStudent.name}
                          </h4>
                          <p className="text-[10px] text-slate-300 mt-0.5">
                            {activeStudent.grade}
                          </p>
                          <span className="text-[9px] px-1.5 py-0.5 bg-blue-800 text-slate-200 rounded font-serif mt-1 inline-block">
                            ID: #{activeStudent.id?.substring(0, 5) || '8837'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Navigation list items exactly as depicted in Screen #2 */}
                    <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                      {[
                        { id: 'diary', icon: <BookOpen size={14} />, label: 'កំណត់ត្រាប្រចាំថ្ងៃ', desc: 'Daily Diary' },
                        { id: 'messages', icon: <MessageSquare size={14} />, label: 'ប្រអប់សារសន្ទនា', badge: '12', desc: 'Messages' },
                        { id: 'assignments', icon: <ClipboardList size={14} />, label: 'កិច្ចការផ្ទះសាលា', desc: 'Assignments' },
                        { id: 'attendance', icon: <CalendarDays size={14} />, label: 'វត្តមានសិស្សានុសិស្ស', desc: 'Attendance' },
                        { id: 'timetable', icon: <Clock size={14} />, label: 'កាលវិភាគសិក្សា', desc: 'Time Table' },
                        { id: 'announcements', icon: <Megaphone size={14} />, label: 'សេចក្តីជូនដំណឹង', badge: '16', desc: 'Announcements' },
                        { id: 'report', icon: <Award size={14} />, label: 'សន្លឹកពិន្ទុ និងរបាយការណ៍', desc: 'Report Card' },
                        { id: 'gallery', icon: <ImageIcon size={14} />, label: 'វិចិត្រសាលរូបភាព', desc: 'Photo Gallery' },
                        { id: 'fees', icon: <Receipt size={14} />, label: 'ព័ត៌មានបង់ថ្លៃសិក្សា', desc: 'Fee Details' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleMenuClick(item.id as any)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg text-[11px] font-sans font-medium transition-all ${
                            phoneScreen === item.id 
                              ? 'bg-amber-400 text-slate-900 font-bold' 
                              : 'text-slate-100 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={phoneScreen === item.id ? 'text-slate-900' : 'text-amber-400'}>{item.icon}</span>
                            <div>
                              <span>{item.label}</span>
                              <span className="block text-[8px] text-slate-400/90 font-mono italic leading-none">{item.desc}</span>
                            </div>
                          </div>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-bold">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Footer drawer login trigger/logout */}
                    <div className="p-4 border-t border-blue-800 bg-blue-950 flex items-center justify-between text-xs text-slate-300">
                      <button 
                        onClick={() => handleMenuClick('login')}
                        className="flex items-center gap-1.5 text-rose-400 hover:text-white"
                      >
                        <LogOut size={12} />
                        <span>ឡុកអោត Logout</span>
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono">MD v2.0</span>
                    </div>

                  </div>
                </div>
              )}

              {/* SCREENS CONTAINER AND APP NAVIGATION HEADER */}
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Standard App Header inside phone Screen */}
                {phoneScreen !== 'login' && (
                  <div className="h-11 bg-blue-700/95 text-white flex items-center justify-between px-3 shrink-0 shadow-sm z-20">
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setIsDrawerOpen(true)}
                        className="p-1.5 hover:bg-white/10 rounded-lg"
                        title="បើកម៉ឺនុយ"
                      >
                        <Menu size={16} />
                      </button>
                      <span className="font-bold text-xs tracking-wide">
                        {phoneScreen === 'dashboard' && 'Mount Litera Zee School'}
                        {phoneScreen === 'report' && 'Report Card (សន្លឹកពិន្ទុ)'}
                        {phoneScreen === 'attendance' && 'Attendance (កត់វត្តមាន)'}
                        {phoneScreen === 'timetable' && 'Time Table (កាលវិភាគ)'}
                        {phoneScreen === 'messages' && 'Messages (ប្រអប់សារ)'}
                        {phoneScreen === 'assignments' && 'Assignments (កិច្ចការ)'}
                        {phoneScreen === 'announcements' && 'Announcements (សេចក្តីជូនដំណឹង)'}
                        {phoneScreen === 'gallery' && 'Student Photo Gallery'}
                        {phoneScreen === 'fees' && 'Student Fee Details'}
                      </span>
                    </div>

                    {/* Right utilities icons */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setPhoneScreen('dashboard')} 
                        className="p-1 hover:bg-white/10 rounded"
                        title="អេក្រង់ដើម"
                      >
                        🔔
                      </button>
                      <button 
                        onClick={() => setIsDrawerOpen(true)} 
                        className="p-1 hover:bg-white/10 rounded text-amber-300"
                        title="គណនី"
                      >
                        👤
                      </button>
                    </div>
                  </div>
                )}

                {/* ACTIVE PHONE DISPLAY PORTAL SCREEN WRAPPER */}
                <div className="flex-1 overflow-y-auto bg-slate-50 relative">

                  {/* 1. LOGIN SCREEN (Screen #3) */}
                  {phoneScreen === 'login' && (
                    <div className="absolute inset-0 bg-blue-900 text-white flex flex-col justify-between py-8 px-6 text-center z-10 font-sans">
                      
                      <div className="space-y-3 mt-10">
                        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg border-2 border-amber-400">
                          <span className="text-3xl">🏫</span>
                        </div>
                        <h1 className="text-xl font-extrabold font-serif text-amber-400 tracking-wide uppercase leading-tight">
                          Mount Litera
                        </h1>
                        <p className="text-xs font-semibold text-white/90">Zee School</p>
                        <p className="text-[9.5px] tracking-wide text-slate-300 italic uppercase">Great School. Great Future - Cambodia</p>
                      </div>

                      {/* Login fields inputs */}
                      <div className="space-y-4 max-w-xs mx-auto w-full my-auto">
                        <div className="text-left">
                          <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">User Name</label>
                          <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="text-left">
                          <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">Password</label>
                          <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full text-xs px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:border-amber-400"
                          />
                        </div>

                        <button
                          onClick={() => setPhoneScreen('dashboard')}
                          className="w-full py-2.5 bg-white text-blue-900 hover:bg-slate-100 font-bold rounded-xl text-xs uppercase shadow-lg tracking-wider transition-all duration-200 mt-2"
                        >
                          L O G I N
                        </button>

                        <button 
                          onClick={() => alert('Forgot Password: Support desk can unlock via custom school console.')}
                          className="text-[10px] text-amber-400 hover:underline inline-block mt-2 font-semibold"
                        >
                          FORGOT PASSWORD ?
                        </button>
                      </div>

                      <div className="text-[9px] text-slate-400">
                        <p>© Kandukuri Group - Education System Cambodia</p>
                        <p className="mt-0.5">App Version 2.15 (Stable Build)</p>
                      </div>

                    </div>
                  )}

                  {/* 2. MAIN COMPASS DASHBOARD (Screen #4 of the Mockup) */}
                  {phoneScreen === 'dashboard' && (
                    <div className="p-4 space-y-4 font-sans ring-1 ring-black/5 animate-fade-in">
                      
                      {/* Interactive Announcement slider */}
                      <div className="bg-gradient-to-tr from-blue-700 to-indigo-800 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 opacity-15 translate-x-2 translate-y-2">
                          <BookOpen size={90} />
                        </div>
                        <p className="text-[10px] font-bold text-amber-300 uppercase">សកម្មភាពសិក្សា - Academic Center</p>
                        <h4 className="text-sm font-bold mt-1 max-w-[85%]">{activeStudent.name}</h4>
                        <p className="text-[10.5px] text-slate-200/90 mt-1">ថ្នាក់រៀន៖ {activeStudent.grade} | មធ្យមភាគ៖ {activeStudent.overallAvg}/១០</p>
                        
                        <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/10 rounded text-[9.5px] font-mono">
                          <span>លទ្ធផល៖</span>
                          <span className={`font-bold ${activeStudent.result === 'ជាប់' ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {activeStudent.result === 'ជាប់' ? '🏆 ជាប់ (Pass)' : '❌ ធ្លាក់ (Fail)'}
                          </span>
                        </div>
                      </div>

                      {/* Six Circular/Centered Icons Dashboard Grid exactly matching style of Screen #4 */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        {[
                          { id: 'diary', label: 'កំណត់ត្រាប្រចាំថ្ងៃ', sub: 'Daily Dairy', bg: 'bg-[#0EA5E9]', icon: '📓', colorClass: 'text-sky-500' },
                          { id: 'messages', label: 'ប្រអប់សារសន្ទនា', sub: 'Messages', bg: 'bg-[#10B981]', icon: '✉️', badge: '12', colorClass: 'text-emerald-500' },
                          { id: 'assignments', label: 'កិច្ចការសាលា', sub: 'Assignments', bg: 'bg-[#EF4444]', icon: '📝', colorClass: 'text-rose-500' },
                          { id: 'attendance', label: 'វត្តមានប្រចាំខែ', sub: 'Attendance', bg: 'bg-[#F59E0B]', icon: '👨‍🏫', colorClass: 'text-amber-500' },
                          { id: 'timetable', label: 'កាលវិភាគសិក្សា', sub: 'Time Table', bg: 'bg-[#6366F1]', icon: '📅', colorClass: 'text-indigo-500' },
                          { id: 'announcements', label: 'សេចក្តីជូនដំណឹង', sub: 'Announcement', bg: 'bg-[#EC4899]', icon: '📢', badge: '5', colorClass: 'text-pink-500' }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => setPhoneScreen(btn.id as any)}
                            className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer relative"
                          >
                            {/* Colorful Circle for the icon exactly like Screen #4 */}
                            <div className={`w-14 h-14 ${btn.bg} rounded-full flex items-center justify-center text-2xl text-white shadow-sm ring-4 ring-slate-100 mb-2.5`}>
                              <span>{btn.icon}</span>
                            </div>
                            
                            <span className="text-[11px] font-extrabold text-slate-800 leading-tight block">
                              {btn.label}
                            </span>
                            <span className="text-[8.5px] text-slate-400 font-mono italic block leading-tight mt-0.5">
                              {btn.sub}
                            </span>

                            {btn.badge && (
                              <span className="absolute top-2.5 right-6 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[8.5px] font-bold">
                                {btn.badge}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Photo Gallery & Fee teaser block */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-3xs cursor-pointer" onClick={() => setPhoneScreen('gallery')}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📸</span>
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">វិចិត្រសាលរូបភាពសិស្ស</span>
                            <span className="text-[8px] text-slate-400 block font-mono">Student Photo Gallery</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-300">❯</span>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-3xs cursor-pointer" onClick={() => setPhoneScreen('fees')}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💳</span>
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">ព័ត៌មានបង់ថ្លៃសិក្សា</span>
                            <span className="text-[8px] text-slate-400 block font-mono">Receipts and Billing details</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-bold text-[8.5px]">រួចរាល់ (Paid)</span>
                      </div>

                    </div>
                  )}

                  {/* 3. REPORT CARD DETAILS VIEW (Screen #1 of the Mockup) */}
                  {phoneScreen === 'report' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      {/* Quarterly Banner Headers */}
                      <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200/55 uppercase font-bold text-[10px] tracking-wide text-center">
                        Quartly Examination Result 2017 - 2018
                      </div>

                      {/* Student Fast Fact Box */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-3xs flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400">សិស្ស / Candidate</p>
                          <h4 className="font-bold text-slate-800 text-xs">{activeStudent.name}</h4>
                          <span className="text-[9px] text-slate-500">{activeStudent.grade}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">កាលបរិច្ឆេទ / Month</p>
                          <span className="font-bold text-blue-700 text-xs">{activeStudent.month}</span>
                        </div>
                      </div>

                      {/* Subject Mark Sheet Panel modeled exactly after Screen #1 */}
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                        <table className="w-full text-left font-sans text-[10.5px]">
                          <thead>
                            <tr className="bg-blue-700/90 text-white font-bold text-[9px] uppercase border-b border-blue-800">
                              <th className="py-2 px-3">Subject (វិជ្ជា)</th>
                              <th className="py-2 px-2 text-center">Marks (ពិន្ទុ)</th>
                              <th className="py-2 px-2 text-center">Grade</th>
                              <th className="py-2 px-3 text-center">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            
                            <tr>
                              <td className="py-2 px-3 font-bold">First Language (ខ្មែរ)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.khmerAvg * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">{activeStudent.gradeLetter}</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-bold">Mathematics (គណិត)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.mathAvg * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">{activeStudent.gradeLetter}</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">English (ភាសាបរទេស)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.foreignLanguage * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">B</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">Physics/Science (វិទ្យាសាស្ត្រ)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.science * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">A</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">Social Studies (សិក្សាសង្គម)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.socialStudies * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">B</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">Health Education (សុខភាព)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.health * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">A</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">Biology/Life Skills (បំណិនជីវិត)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.lifeSkills * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">A+</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3">Practical Sports (កីឡា)</td>
                              <td className="py-2 px-2 text-center font-mono">{(activeStudent.physicalEducation * 10).toFixed(0)} / 100</td>
                              <td className="py-2 px-2 text-center font-bold text-blue-600">B</td>
                              <td className="py-2 px-3 text-center"><span className="text-emerald-600 font-bold">Pass</span></td>
                            </tr>

                            {/* Overall row */}
                            <tr className="bg-slate-50 font-bold select-none text-slate-800">
                              <td className="py-2.5 px-3">Overall Grade</td>
                              <td className="py-2.5 px-2 text-center font-mono">{(activeStudent.overallAvg * 10).toFixed(1)} %</td>
                              <td className="py-2.5 px-2 text-center text-emerald-600">{activeStudent.gradeLetter}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-600 uppercase">PASS</td>
                            </tr>

                            <tr className="bg-slate-100 font-extrabold text-blue-900 border-t-2 border-slate-200">
                              <td className="py-2.5 px-3 uppercase">Total Marks</td>
                              <td colSpan={3} className="py-2.5 px-3 text-right font-mono">
                                {(activeStudent.overallAvg * 80).toFixed(0)} / 800
                              </td>
                            </tr>

                          </tbody>
                        </table>
                      </div>

                      <button
                        onClick={() => alert('ពាក្យស្នើសុំទាញយក PDF សរុបសម្រាប់បោះពុម្ព')}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] text-center shadow-xs"
                      >
                        📥 ទាញយកសន្លឹកពិន្ទុ PDF (Download Report Card)
                      </button>

                    </div>
                  )}

                  {/* 4. ATTENDANCE CALENDAR (Screen #5 of the Mockup) */}
                  {phoneScreen === 'attendance' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      {/* Month Selection Bar in Screen #5 */}
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-3xs flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-600">ខែ៖</span>
                          <select 
                            value={attendanceMonth} 
                            onChange={(e) => setAttendanceMonth(e.target.value)}
                            className="bg-slate-100 border border-slate-200 rounded px-1 text-xs py-0.5 text-blue-800 font-bold"
                          >
                            <option value="មករា">January</option>
                            <option value="កុម្ភៈ">February</option>
                            <option value="មីនា">March</option>
                            <option value="មេសា">April</option>
                            <option value="ឧសភា">May</option>
                            <option value="មិថុនា">June</option>
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-600">ឆ្នាំ៖</span>
                          <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-slate-100 border border-slate-200 rounded px-1 text-xs py-0.5 text-blue-800 font-bold"
                          >
                            <option value="2026">2026</option>
                            <option value="2018">2018 (Mock)</option>
                          </select>
                        </div>
                      </div>

                      {/* Header Calendar weekdays */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                        <div className="grid grid-cols-7 gap-1.5 text-center font-extrabold text-[10px] text-blue-900 border-b border-slate-100 pb-2 mb-2">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <span key={i} className={i === 0 || i === 6 ? 'text-amber-500' : 'text-blue-900'}>{day}</span>
                          ))}
                        </div>

                        {/* Interactive Grid of days exactly as depicted in Screen #5 */}
                        <div className="grid grid-cols-7 gap-2.5 text-center items-center">
                          {/* Empty days padding */}
                          {Array.from({ length: 1 }).map((_, i) => (
                            <span key={`empty-${i}`} className="text-slate-300"></span>
                          ))}
                          
                          {/* Calendar Days from 1 to 30 */}
                          {Array.from({ length: 30 }).map((_, i) => {
                            const dayNum = i + 1;
                            const status = attendanceGrid[dayNum] || 'present';
                            
                            // Colors based on mockup standard Screen #5:
                            // Presents = Default white with standard bold text, or circle green background
                            // Absents = Solid red circle background
                            // Holidays = Solid yellow circle background
                            let cellStyle = "text-slate-700 font-bold hover:bg-slate-100 cursor-pointer w-7 h-7 flex items-center justify-center rounded-full text-[10px] mx-auto";
                            
                            if (status === 'present') {
                              cellStyle = "bg-emerald-50 text-emerald-700 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold mx-auto hover:bg-emerald-100 cursor-pointer";
                            } else if (status === 'absent') {
                              cellStyle = "bg-[#EF4444] text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold mx-auto cursor-pointer shadow-3xs";
                            } else if (status === 'holiday') {
                              cellStyle = "bg-[#F59E0B] text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold mx-auto cursor-pointer shadow-3xs";
                            }

                            return (
                              <div 
                                key={dayNum} 
                                onClick={() => toggleDayStatus(dayNum)}
                                className={cellStyle}
                                title="ចុចប្តូរពិន្ទុវត្តមាន"
                              >
                                {dayNum}
                              </div>
                            );
                          })}
                        </div>

                        <p className="text-[8.5px] text-slate-400 font-medium italic text-center mt-3 tracking-wide">
                          *ចុចលើប្រអប់ថ្ងៃនីមួយៗ ដើម្បីផ្លាស់ប្តូរវត្តមានរវាង៖ វត្តមាន ⇨ អវត្តមាន ⇨ ថ្ងៃឈប់សម្រាក។
                        </p>
                      </div>

                      {/* Info Panel Summary exactly matching Screen #5 indicators and color counters */}
                      <div className="space-y-2 pt-1 font-semibold">
                        
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-800 rounded-lg flex items-center justify-between border border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
                            <span>វត្តមាន (Presents)</span>
                          </div>
                          <span className="font-mono text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
                            {attendanceStats.presents} ថ្ងៃ (Days)
                          </span>
                        </div>

                        <div className="p-2.5 bg-rose-500/10 text-rose-800 rounded-lg flex items-center justify-between border border-rose-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
                            <span>អវត្តមាន (Absents)</span>
                          </div>
                          <span className="font-mono text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
                            {attendanceStats.absents} ថ្ងៃ (Days)
                          </span>
                        </div>

                        <div className="p-2.5 bg-amber-500/10 text-amber-800 rounded-lg flex items-center justify-between border border-amber-500/20">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full inline-block"></span>
                            <span>ថ្ងៃឈប់សម្រាក (Holidays)</span>
                          </div>
                          <span className="font-mono text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
                            {attendanceStats.holidays} ថ្ងៃ (Days)
                          </span>
                        </div>

                      </div>

                    </div>
                  )}

                  {/* 5. INDIVIDUAL DAILY DAIRY */}
                  {phoneScreen === 'diary' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      {/* Active Diary Input Form for Demo */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-3xs space-y-2.5">
                        <p className="font-bold text-slate-800 text-[11px] uppercase text-blue-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                          <span>📓</span> បញ្ចូលកំណត់ត្រាថ្ងៃនេះ (Daily Notes)
                        </p>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <input 
                            type="text" 
                            placeholder="ចំណងជើងសកម្មភាព..." 
                            value={newDairyTitle}
                            onChange={(e) => setNewDairyTitle(e.target.value)}
                            className="w-full text-xs px-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 focus:border-blue-500"
                          />
                          <textarea 
                            placeholder="ការសង្កេតឥរិយាបថសិស្ស..." 
                            rows={2}
                            value={newDairyDesc}
                            onChange={(e) => setNewDairyDesc(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 focus:border-blue-500 resize-none"
                          />
                        </div>

                        <button
                          onClick={() => {
                            if (!newDairyTitle || !newDairyDesc) return alert('សូមបំពេញគ្រប់ប្រអប់សិន!');
                            setDairyEntries(prev => [
                              {
                                id: Date.now().toString(),
                                date: '២០២៦-០៦-០៣',
                                title: newDairyTitle,
                                desc: newDairyDesc,
                                category: 'ការសង្កេត',
                                rating: 'ល្អណាស់'
                              },
                              ...prev
                            ]);
                            setNewDairyTitle('');
                            setNewDairyDesc('');
                          }}
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg text-center"
                        >
                          ➕ បញ្ចូលសកម្មភាពសិស្ស
                        </button>
                      </div>

                      {/* Display Dairy list */}
                      <div className="space-y-2.5">
                        {dairyEntries.map(entry => (
                          <div key={entry.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-3xs hover:border-blue-100 transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[8.5px] border border-blue-150">
                                {entry.category}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono font-bold">{entry.date}</span>
                            </div>
                            <h4 className="font-extrabold text-slate-800 text-[11px]">{entry.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{entry.desc}</p>
                            
                            <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between">
                              <span className="text-[9.5px] text-slate-400 font-medium">វាយតម្លៃ៖</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px]">
                                ⭐ {entry.rating}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* 6. MESSAGES LIST VIEW WITH DETAILED CHAT SCROLLER */}
                  {phoneScreen === 'messages' && (
                    <div className="flex flex-col h-full bg-slate-50 font-sans text-xs">
                      
                      {/* Active Chat Profile Header */}
                      <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            👨🏫
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-[11px]">គ្រូបន្ទុកថ្នាក់ សុខ តារា</h4>
                            <span className="text-[8.5px] text-emerald-600 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse online-dot block"></span>
                              សកម្មឥឡូវនេះ (Online)
                            </span>
                          </div>
                        </div>

                        <span className="text-[9px] font-bold text-slate-400">ថ្នាក់ទី ៦ក</span>
                      </div>

                      {/* Chat Messages Body */}
                      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[290px]">
                        {chatMessages.map((msg, index) => (
                          <div 
                            key={index} 
                            className={`flex flex-col max-w-[80%] ${
                              msg.sender === 'parent' ? 'ms-auto items-end animate-fade-in' : 'items-start animate-fade-in'
                            }`}
                          >
                            <div 
                              className={`p-2.5 rounded-2xl text-[10.5px] leading-relaxed shadow-3xs ${
                                msg.sender === 'parent' 
                                  ? 'bg-blue-600 text-white rounded-tr-none' 
                                  : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none'
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-slate-400 mt-1 font-mono tracking-wide">
                              {msg.time}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Messaging write box */}
                      <div className="p-2 border-t border-slate-200 bg-white shrink-0 flex items-center gap-1.5">
                        <input 
                          type="text" 
                          placeholder="វាយសាររបស់អ្នកទៅកាន់គ្រូ..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-800 font-medium"
                        />
                        <button 
                          onClick={handleSendMessage}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer shrink-0"
                          title="ផ្ញើសារ"
                        >
                          <Send size={14} />
                        </button>
                      </div>

                    </div>
                  )}

                  {/* 7. ASSIGNMENTS HOMEWORK */}
                  {phoneScreen === 'assignments' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl flex items-start gap-2">
                        <span className="text-base">💡</span>
                        <p className="text-[9.5px] leading-normal font-semibold">
                          គ្រូបន្ទុកថ្នាក់ប្រគល់កិច្ចការទាំងនេះ។ សិស្សត្រូវតែបំពេញ ហើយបញ្ជូនតាមកាលកំណត់។
                        </p>
                      </div>

                      <div className="space-y-3">
                        {assignments.map(item => (
                          <div 
                            key={item.id}
                            className={`bg-white border rounded-xl p-3 shadow-3xs hover:border-slate-300 transition-colors ${
                              item.isDone ? 'border-emerald-200/50 bg-emerald-50/10' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-150 text-rose-700 font-extrabold text-[8.5px] rounded">
                                {item.subject}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8.5px] text-slate-400 font-mono tracking-wide-tight">ឈានកំណត់៖ {item.dueDate}</span>
                              </div>
                            </div>

                            <p className="font-bold text-slate-800 text-[10.5px] leading-relaxed">
                              {item.task}
                            </p>

                            <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                              <span className="text-[9.5px] text-slate-400">ស្ថានភាព៖</span>
                              <button
                                onClick={() => {
                                  setAssignments(prev => prev.map(a => a.id === item.id ? { ...a, isDone: !a.isDone } : a));
                                }}
                                className={`px-2 py-0.5 rounded font-bold text-[9px] flex items-center gap-1 ${
                                  item.isDone 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                }`}
                              >
                                {item.isDone ? '✔ បានធ្វើរួច (Done)' : '⏳ កំពុងធ្វើ (Pending)'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* 8. PUBLIC ANNOUNCEMENTS */}
                  {phoneScreen === 'announcements' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                        <span className="font-extrabold text-slate-700 text-xs flex items-center gap-1">
                          📂 ព្រឹត្តិការណ៍ និងការជូនដំណឹងពីសាលា
                        </span>
                        <span className="px-2 py-0.5 bg-rose-500 text-white font-bold rounded text-[8.5px]">សរុប ៣</span>
                      </div>

                      <div className="space-y-3">
                        {announcements.map(ann => (
                          <div key={ann.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs hover:border-blue-100 transition-all">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1.5 mb-2">
                              <span className="font-mono text-[9px] font-extrabold text-[#1E293B] bg-slate-100 py-0.5 px-2 rounded-full border border-slate-150">
                                📅 {ann.date}
                              </span>
                              <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-150 text-rose-700 rounded text-[8.5px] font-extrabold">
                                {ann.badge}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-[11px] text-slate-800 leading-snug">
                              {ann.title}
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5">
                              {ann.desc}
                            </p>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* 9. TIMETABLE VIEW */}
                  {phoneScreen === 'timetable' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs">
                      
                      <div className="bg-slate-100 rounded-xl p-2.5 text-slate-700 text-center font-bold text-[10px] uppercase border border-slate-200">
                        កាលវិភាគថ្នាក់រៀនប្រចាំសប្តាហ៍ / WEEKLY TIMETABLE
                      </div>

                      <div className="space-y-2.5">
                        {[
                          { period: 'ម៉ោង ១ (7:30 - 8:30)', subject: 'ភាសាខ្មែរ (អក្សរសិល្ប៍)', teacher: 'គ្រូ សុខ តារា', color: 'border-l-4 border-l-sky-500' },
                          { period: 'ម៉ោង ២ (8:30 - 9:30)', subject: 'គណិតវិទ្យា (ប្រភាគ/ភាគរយ)', teacher: 'គ្រូ សុខ តារា', color: 'border-l-4 border-l-blue-500' },
                          { period: 'សម្រាក (9:30 - 10:00)', subject: 'ម៉ោងលេងកម្សាន្ត - Break Time', teacher: 'ទូទៅ', color: 'border-l-4 border-l-amber-500 bg-amber-50/10' },
                          { period: 'ម៉ោង ៣ (10:00 - 11:00)', subject: 'វិទ្យាសាស្ត្រ (ហ្វូស៊ីល/កោសិកា)', teacher: 'គ្រូ សំបូរ រត្ន', color: 'border-l-4 border-l-emerald-500' },
                          { period: 'ម៉ោង ៤ (11:00 - 12:00)', subject: 'ភាសាអង់គ្លេស', teacher: 'Teacher John', color: 'border-l-4 border-l-indigo-500' }
                        ].map((item, index) => (
                          <div key={index} className={`bg-white border border-slate-200 rounded-xl p-3 shadow-3xs flex justify-between items-center ${item.color}`}>
                            <div>
                              <p className="text-[10px] text-slate-400 font-mono font-bold leading-tight">{item.period}</p>
                              <h4 className="font-extrabold text-slate-800 text-[11px] leading-relaxed mt-1">{item.subject}</h4>
                            </div>
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-150 rounded text-[9px] font-bold">
                              {item.teacher}
                            </span>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* 10. PHOTO GALLERY */}
                  {phoneScreen === 'gallery' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs text-center">
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
                        <span className="text-3xl block mb-2">📸</span>
                        <h4 className="font-bold text-slate-800 text-xs">វិចិត្រសាលរូបភាពសកម្មភាពសិស្ស</h4>
                        <p className="text-[10px] text-slate-450 mt-1 lines-normal leading-relaxed text-slate-400">
                          រូបថតសកម្មភាពសិស្សសិក្សាជាក្រុម ធ្វើលំហាត់ឡើងក្តារខៀន និងចូលរួមលេងកីឡានានាក្នុងថ្នាក់។
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { emoji: '🎒', label: 'ចូលរួមសិក្សាដំបូង' },
                          { emoji: '🎨', label: 'ម៉ោងគំនូរ និងសិល្បៈ' },
                          { emoji: '🧪', label: 'ពិសោធន៍វិទ្យាសាស្ត្រ' },
                          { emoji: '⚽', label: 'លេងកីឡាក្នុងសាលា' }
                        ].map((pic, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs text-center">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full mx-auto flex items-center justify-center text-xl mb-2.5">
                              <span>{pic.emoji}</span>
                            </div>
                            <span className="font-bold text-slate-700 text-[10px] block truncate">{pic.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 11. FEES AND RECEIPT */}
                  {phoneScreen === 'fees' && (
                    <div className="p-3 space-y-3 font-sans animate-fade-in text-xs space-y-3">
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-[#1E293B]">
                          <span>ថ្លៃសិក្សាប្រចាំឆមាសទី១</span>
                          <span className="text-emerald-600 font-mono font-extrabold">$150.00</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>កាលបរិច្ឆេទបង់ប្រាក់៖</span>
                          <span className="font-mono">១៥ ឧសភា ២០២៦</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>លេខវិក្កយបត្រ៖</span>
                          <span className="font-mono">#INV-88A928</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9.5px] text-slate-500 font-bold">ស្ថានភាព៖</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-extrabold">
                            ✔ បានបង់រួចរាល់ (Paid)
                          </span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-[#1E293B]">
                          <span>សៀវភៅ និងឯកសណ្ឋានសាលា</span>
                          <span className="text-emerald-600 font-mono font-extrabold">$35.00</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>កាលបរិច្ឆេទបង់ប្រាក់៖</span>
                          <span className="font-mono">១៨ ឧសភា ២០២៦</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9.5px] text-slate-500 font-bold">ស្ថានភាព៖</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-extrabold">
                            ✔ បានបង់រួចរាល់ (Paid)
                          </span>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

                {/* Simulated Phone Hardware Navigation Footer (With Home Button/Indicator) */}
                <div className="h-14 bg-slate-100 flex items-center justify-center shrink-0 border-t border-slate-200/60 z-30 relative rounded-b-[40px]">
                  <button 
                    onClick={() => {
                      setPhoneScreen('dashboard');
                      setIsDrawerOpen(false);
                    }} 
                    className="w-11 h-11 bg-white border border-slate-300 rounded-full flex items-center justify-center shadow-xs text-xl hover:bg-slate-50 active:scale-95 transition-all duration-200 cursor-pointer"
                    title="ចុចត្រឡប់មកអេក្រង់ដើមវិញ"
                  >
                    🔵
                  </button>
                  <p className="absolute bottom-1.5 inset-x-0 text-center text-[7.5px] text-slate-400 font-mono tracking-wide pointer-events-none">
                    KHMER SMS v2.15 • TOUCH EMULATOR
                  </p>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
