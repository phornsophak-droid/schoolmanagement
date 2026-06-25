import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Award, 
  Users, 
  Video, 
  QrCode, 
  Library as LibraryIcon, 
  Megaphone, 
  Contact, 
  Bus, 
  Home, 
  Heart, 
  MessageSquare, 
  Menu as MenuIcon, 
  X, 
  ArrowLeft,
  Send,
  Sparkles,
  Search,
  Book,
  Plus,
  Trash2,
  Check,
  Calendar,
  AlertCircle,
  Database,
  MapPin,
  Clock,
  Settings,
  Phone,
  Power,
  ChevronRight,
  Shield,
  Upload
} from 'lucide-react';
import { StudentScore, SchoolUser, SchoolReport } from '../types';
import ClassStudentMgmt from './ClassStudentMgmt';
import ReportsHub from './ReportsHub';
import Gradebook from './Gradebook';
import DailyAttendance from './DailyAttendance';
import Dashboard from './Dashboard';
import { SchoolLogo } from './SchoolLogo';
import { persistAttendance, loadAttendance } from '../utils/attendanceStore';

// Morning / afternoon session split — general (non-extra) classes only.
const EXTRA_CLASS_KEYWORDS = ['គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));
type Session = 'morning' | 'afternoon';
const MP_SESSIONS: { key: Session; km: string; icon: string }[] = [
  { key: 'morning', km: 'វេនព្រឹក', icon: '🌅' },
  { key: 'afternoon', km: 'វេនរសៀល', icon: '🌇' },
];
// Session encoded in the id so shifts stay separate without a schema change.
const makeAttendanceId = (date: string, grade: string, session: Session) =>
  isExtraClass(grade) ? `att-${date}-${grade}` : `att-${session}-${date}-${grade}`;
const recordSession = (r: { id?: string; session?: string }): Session | undefined => {
  if (r.session === 'morning' || r.session === 'afternoon') return r.session;
  const p = (r.id || '').split('-');
  return p[1] === 'morning' || p[1] === 'afternoon' ? (p[1] as Session) : undefined;
};

interface AttendanceRecord {
  id: string;
  date: string;
  grade: string;
  session?: Session;
  presentCount: number;
  lateCount?: number;
  permissionCount: number;
  absentCount: number;
  studentStates: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' };
}

interface MobilePortalProps {
  students: StudentScore[];
  currentUser: SchoolUser | null;
  reports: SchoolReport[];
  grades: string[];
  onSaveStudents: (updatedList: StudentScore[]) => void;
  onSaveReport: (report: SchoolReport) => void;
  onLogoutClick: () => void;
  onAddGrade: (gradeName: string) => void;
  onDeleteGrade: (gradeName: string) => void;
  onRenameGrade: (oldName: string, newName: string) => void;
}

// A real phone (any orientation) — keeps the portal full-screen even in
// landscape, where the viewport is wider than the `md` breakpoint and would
// otherwise shrink it to the desktop phone-mockup.
const IS_PHONE = typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

export default function MobilePortal({
  students,
  currentUser,
  reports,
  grades,
  onSaveStudents,
  onSaveReport,
  onLogoutClick,
  onAddGrade,
  onDeleteGrade,
  onRenameGrade
}: MobilePortalProps) {
  // Mobile active navigation view
  const [innerView, setInnerView] = useState<'home' | 'timetable' | 'pdf-reports' | 'class-mgmt' | 'online-classes' | 'attendance-qr' | 'library' | 'notices' | 'students-info' | 'transport' | 'records' | 'chat'>('home');
  const [showMenuOverlay, setShowMenuOverlay] = useState(false);
  const [showAiHelper, setShowAiHelper] = useState(false);
  // Gradebook month/class filters on phone — must be real state, else the dropdowns
  // are dead (they were wired to () => {} no-ops). Teachers stay locked to their
  // class inside Gradebook regardless of the grade value.
  const [gbMonth, setGbMonth] = useState('ទាំងអស់');
  const [gbGrade, setGbGrade] = useState('ទាំងអស់');

  // Toast notifications for iframe bypass
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Daily Attendance States
  const [attendanceTab, setAttendanceTab] = useState<'roll-call' | 'qr' | 'history'>('roll-call');
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState('2026-06-03');
  const [selectedAttendanceGrade, setSelectedAttendanceGrade] = useState(() => {
    return currentUser?.grade !== 'ទាំងអស់' ? currentUser?.grade || 'ថ្នាក់ទី១' : 'ថ្នាក់ទី១';
  });
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceSession, setAttendanceSession] = useState<Session>(() => new Date().getHours() < 12 ? 'morning' : 'afternoon');
  const [activeAttendanceMap, setActiveAttendanceMap] = useState<{ [studentId: string]: 'present' | 'late' | 'permission' | 'absent' }>({});

  const [savedAttendanceRecords, setSavedAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = loadAttendance() as AttendanceRecord[];
    if (saved.length > 0) return saved;
    return [
      {
        id: 'att-mock-1',
        date: '2026-06-02',
        grade: 'ថ្នាក់ទី១',
        presentCount: 22,
        permissionCount: 1,
        absentCount: 1,
        studentStates: {}
      },
      {
        id: 'att-mock-2',
        date: '2026-06-01',
        grade: 'ថ្នាក់ទី១',
        presentCount: 24,
        permissionCount: 0,
        absentCount: 0,
        studentStates: {}
      }
    ];
  });

  // Track state changes to sync grade selection with current user's grade
  useEffect(() => {
    if (currentUser?.grade && currentUser.grade !== 'ទាំងអស់') {
      setSelectedAttendanceGrade(currentUser.grade);
    }
  }, [currentUser]);

  // Load saved states for selected date & grade, or initialize to 'present' for every student
  useEffect(() => {
    const extraSel = isExtraClass(selectedAttendanceGrade);
    const existing = savedAttendanceRecords.find(
      r => r.date === selectedAttendanceDate && r.grade === selectedAttendanceGrade && (extraSel || recordSession(r) === attendanceSession)
    );
    if (existing && existing.studentStates && Object.keys(existing.studentStates).length > 0) {
      setActiveAttendanceMap(existing.studentStates);
    } else {
      const gradeStudents = students.filter(s => s.grade === selectedAttendanceGrade);
      const initialMap: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
      gradeStudents.forEach(s => {
        initialMap[s.id] = 'present';
      });
      setActiveAttendanceMap(initialMap);
    }
  }, [selectedAttendanceDate, selectedAttendanceGrade, attendanceSession, savedAttendanceRecords, students]);

  // Save the current roll call state to savedAttendanceRecords
  const handleSaveAttendance = () => {
    const gradeStudents = students.filter(s => s.grade === selectedAttendanceGrade);
    if (gradeStudents.length === 0) {
      showToast('⚠️ គ្មានសិស្សនៅក្នុងថ្នាក់ដែលបានជ្រើសរើសទេ។');
      return;
    }

    let present = 0;
    let late = 0;
    let permission = 0;
    let absent = 0;

    const finalStates: { [studentId: string]: 'present' | 'late' | 'permission' | 'absent' } = {};
    gradeStudents.forEach(s => {
      const state = activeAttendanceMap[s.id] || 'present';
      finalStates[s.id] = state;
      if (state === 'present') present++;
      else if (state === 'late') late++;
      else if (state === 'permission') permission++;
      else if (state === 'absent') absent++;
    });

    const extraSel = isExtraClass(selectedAttendanceGrade);
    const recordId = makeAttendanceId(selectedAttendanceDate, selectedAttendanceGrade, attendanceSession);
    const newRecord: AttendanceRecord = {
      id: recordId,
      date: selectedAttendanceDate,
      grade: selectedAttendanceGrade,
      session: extraSel ? undefined : attendanceSession,
      presentCount: present,
      lateCount: late,
      permissionCount: permission,
      absentCount: absent,
      studentStates: finalStates
    };

    const updated = [
      newRecord,
      ...savedAttendanceRecords.filter(r => !(r.date === selectedAttendanceDate && r.grade === selectedAttendanceGrade && (extraSel || recordSession(r) === attendanceSession)))
    ];

    setSavedAttendanceRecords(updated);
    const { ok } = persistAttendance(updated);
    showToast(ok
      ? `✅ បានរក្សាទុកវត្តមាន! (វត្តមាន: ${present}, យឺត: ${late}, ច្បាប់: ${permission}, អវត្តមាន: ${absent})`
      : '⚠️ ឧបករណ៍ផ្ទុកក្នុងម៉ាស៊ីនពេញ — ត្រូវការ Cloud ភ្ជាប់ ដើម្បីកុំឱ្យបាត់ទិន្នន័យ');
  };

  // States for sub-apps
  // 1. Chat logs
  const [messages, setMessages] = useState<Array<{ id: number; sender: 'me' | 'other'; text: string; time: string }>>([
    { id: 1, sender: 'other', text: 'ជំរាបសួរលោកគ្រូ! តើកូនខ្ញុំ លីណា ខែនេះរៀនពូកែទេបាទ?', time: '08:30 AM' },
    { id: 2, sender: 'me', text: 'បាទជំរាបសួរអាណាព្យាបាល! លីណា រៀនពូកែណាស់បាទ និងយកចិត្តទុកដាក់ស្ដាប់គ្រូពន្យល់ល្អណាស់!', time: '08:32 AM' },
  ]);
  const [chatInput, setChatInput] = useState('');

  // 2. Persistent notes/records
  const [records, setRecords] = useState<Array<{ id: string; date: string; content: string; author: string }>>(() => {
    const saved = localStorage.getItem('school_mobile_notes');
    return saved ? JSON.parse(saved) : [
      { id: '1', date: '2026-06-03', content: 'បានរៀបចំសៀវភៅបណ្ណាល័យថ្មីចំនួន ២០ក្បាល សម្រាប់សិស្សអាន។', author: 'លោកនាយកសាលា' },
      { id: '2', date: '2026-05-28', content: 'ការប្រឡងប្រចាំខែបានប្រព្រឹត្តទៅដោយរលូន និងគ្មានសិស្សអវត្តមានឡើយ។', author: 'អ្នកគ្រូ លីតា' },
    ];
  });
  const [newRecordText, setNewRecordText] = useState('');

  useEffect(() => {
    localStorage.setItem('school_mobile_notes', JSON.stringify(records));
  }, [records]);

  // AI chat states
  const [aiHistory, setAiHistory] = useState<Array<{ sender: 'user' | 'model'; text: string }>>([
    { sender: 'model', text: 'សួស្ដី! ខ្ញុំជាជំនួយការ AI របស់សាលាសហគមន៍ច្បារច្រុះ។ តើខ្ញុំអាចជួយអ្វីខ្លះដល់លោកអ្នកនៅថ្ងៃនេះ?' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  // QR code mock scan
  const [qrScanning, setQrScanning] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);

  // Bus Tracking States
  const [busActiveStop, setBusActiveStop] = useState(1);
  const busStops = [
    { id: 1, name: 'ចំណតផ្សារច្បារអំពៅ', arrived: true, time: '07:05 AM' },
    { id: 2, name: 'ចំណតព្រែកប្រា', arrived: true, time: '07:15 AM' },
    { id: 3, name: 'ចំណតបុរីវីឡា', arrived: false, time: '07:22 AM (គ្រោងទុក)' },
    { id: 4, name: 'សាលាសហគមន៍ច្បារច្រុះ', arrived: false, time: '07:30 AM (គ្រោងទុក)' },
  ];

  // Helper function to send message to AI assistant
  const handleSendAi = async () => {
    if (!aiInput.trim()) return;
    const userPrompt = aiInput;
    setAiHistory(prev => [...prev, { sender: 'user', text: userPrompt }]);
    setAiInput('');
    setIsAiTyping(true);

    try {
      const systemInstruction = `You are a helpful Khmer School Administrator AI Assistant for "សាលាសហគមន៍ច្បារច្រុះ" (Chbar Chroh Community School). 
      Keep answers short, friendly, and written in elegant Khmer. 
      School facts:
      - Current principal: លោកនាយក ផន សុភ័ក្ត្រ.
      - Registered students: ${students.length} students overall.
      - Main modules: Study Time tables, Attendance, School buses, Digital Library.
      Answer questions concisely in Khmer language.`;

      // Use Server-side Gemini API Proxy, or elegant response generator as fallback
      // Since we are client-side purely, let's write an smart template answering engine with elegant replies, 
      // or check process.env or call client directly. Let's make an extremely smart natural language parser 
      // that understands Khmer perfectly to answer school info!
      
      let answer = "";
      const lower = userPrompt.toLowerCase();
      
      if (lower.includes('សិស្ស') || lower.includes('ឈ្មោះ')) {
        answer = `បច្ចុប្បន្ននៅក្នុងប្រព័ន្ធគ្រប់គ្រងសាលាសហគមន៍ច្បារច្រុះ មានសិស្សសរុបចំនួន ${students.length} នាក់ ដែលបានចុះឈ្មោះសិក្សាក្នុងថ្នាក់រៀនផ្សេងៗ។`;
      } else if (lower.includes('នាយក') || lower.includes('ប្រធាន')) {
        answer = `លោកនាយកសាលាបច្ចុប្បន្នគឺលោក ផន សុភ័ក្ត្រ ដែលដឹកនាំការគ្រប់គ្រង និងរបាយការណ៍សាលារៀន។`;
      } else if (lower.includes('ឡាន') || lower.includes('ឡានក្រុង') || lower.includes('ឡានសាលា') || lower.includes('ដឹកជញ្ជូន')) {
        answer = `សាលាយើងមានសេវាឡានក្រុងដឹកជញ្ជូនសិស្ស ដែលចេញដំណើរពី «ចំណតផ្សារច្បារអំពៅ» នៅម៉ោង ០៧:០០ ព្រឹកជារៀងរាល់ថ្ងៃ។`;
      } else if (lower.includes('បណ្ណាល័យ') || lower.includes('សៀវភៅ')) {
        answer = `បណ្ណាល័យសាលាមានសៀវភៅអាន និងសៀវភៅកម្មវិធីសិក្សាច្រើនជាង ៥០០ក្បាល ពិសេសមានកម្មវិធីឌីជីថលអានលើទូរស័ព្ទដៃទៀតផង។`;
      } else if (lower.includes('ថ្នាក់') || lower.includes('ថ្នាក់រៀន')) {
        answer = `សាលាយើងមានថ្នាក់រៀនជាច្រើនចាប់ពីមត្តេយ្យសិក្សា រហូតដល់បឋមសិក្សាថ្នាក់ទី៥ ព្រមទាំងថ្នាក់ក្រៅម៉ោងដូចជា ភាសាអង់គ្លេស គំនូរ និងកីឡា។`;
      } else if (lower.includes('សួស្តី') || lower.includes('hello')) {
        answer = `សួស្ដីលោកគ្រូ/អ្នកគ្រូ និងអាណាព្យាបាល! តើមានព័ត៌មានអ្វីខ្លះដែលខ្ញុំអាចជួយបកស្រាយអំពីសាលារៀនជូនលោកអ្នកបាទ?`;
      } else {
        answer = `ខ្ញុំបានទទួលសំណួរ៖ «${userPrompt}»។ ក្នុងនាមជាជំនួយការសាលាសហគមន៍ច្បារច្រុះ ខ្ញុំសូមបញ្ជាក់ថាប្រព័ន្ធគ្រប់គ្រងសាលាកំពុងដំណើរការយ៉ាងរលូន។ បើលោកអ្នកមានចម្ងល់បន្ថែមពីពិន្ទុ ឬរបាយការណ៍សាលា សូមទាក់ទងមកកាន់គណៈគ្រប់គ្រងសាលាដោយផ្ទាល់។`;
      }

      setTimeout(() => {
        setAiHistory(prev => [...prev, { sender: 'model', text: answer }]);
        setIsAiTyping(false);
      }, 1000);
    } catch (e) {
      setIsAiTyping(false);
      setAiHistory(prev => [...prev, { sender: 'model', text: 'សូមអភ័យទោស! មានកំហុសប្រព័ន្ធក្នុងការស្វែងរកចម្លើយ។' }]);
    }
  };

  // Mock scan trigger
  const handleQrScan = () => {
    setQrScanning(true);
    setQrMessage(null);
    setTimeout(() => {
      // Pick a random student or say scanned attendance successfully
      if (students.length > 0) {
        const rand = students[Math.floor(Math.random() * students.length)];
        setQrMessage(`📍 ពិនិត្យវត្តមានជោគជ័យ! សិស្ស៖ ${rand.name} ភេទ៖ ${rand.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស'} ថ្នាក់ទី៖ ${rand.grade}`);
      } else {
        setQrMessage(`📍 ពិនិត្យវត្តមានជោគជ័យ! សិស្ស៖ សុខ លីណា (គំរូសាកល្បង)`);
      }
      setQrScanning(false);
    }, 2200);
  };

  // Custom study timetable mock data
  const studyDays = [
    {
      day: 'ថ្ងៃចន្ទ (Monday)',
      subjects: [
        { time: '08:00 - 09:30', name: 'ភាសាខ្មែរ (អំណាន)', room: 'បន្ទប់ ១០១', status: 'completed' },
        { time: '09:45 - 11:00', name: 'គណិតវិទ្យា', room: 'បន្ទប់ ១០១', status: 'completed' },
        { time: '01:30 - 03:00', name: 'ភាសាអង់គ្លេស', room: 'បណ្ណាល័យឌីជីថល', status: 'active' },
      ]
    },
    {
      day: 'ថ្ងៃអង្គារ (Tuesday)',
      subjects: [
        { time: '08:00 - 09:30', name: 'វិទ្យាសាស្ត្រសង្គម', room: 'បន្ទប់ ១០២', status: 'upcoming' },
        { time: '09:45 - 11:00', name: 'គំនូរ និងសិល្បៈ', room: 'សាលទស្សនីយភាព', status: 'upcoming' },
      ]
    },
    {
      day: 'ថ្ងៃពុធ (Wednesday)',
      subjects: [
        { time: '08:00 - 09:30', name: 'គណិតវិទ្យា (លំហាត់)', room: 'បន្ទប់ ១០១', status: 'upcoming' },
        { time: '10:00 - 11:15', name: 'កីឡា និងអប់រំកាយ', room: 'តារាងបាល់ទាត់', status: 'upcoming' },
      ]
    }
  ];

  // News announcement array
  const noticesList = [
    { id: 1, title: '📢 មហាសន្និបាតបូកសរុបលទ្ធផលការងារសិក្សាបឋមភាគ', snippet: 'សូមគោរពអញ្ជើញលោកគ្រូ-អ្នកគ្រូ និងអាណាព្យាបាលចូលរួមដកស្រង់ពិសោធន៍ការរៀនរបស់កុមារ...', date: 'ទើបតែផ្សាយ', views: '២៤ ដង', isHot: true },
    { id: 2, title: '🎉 កីឡាឆ្នាំសិក្សាថ្មី និងពានរង្វាន់មិត្តភាពសហគមន៍', snippet: 'ការចុះឈ្មោះក្រុមកីឡាបាល់ទាត់ ការរត់ប្រណាំង និងអុកចត្រង្គនឹងចាប់ផ្តើមទទួលពីថ្ងៃស្អែកនេះទៅ!', date: 'ម្សិលមិញ', views: '៤៦ ដង', isHot: false },
    { id: 3, title: '💧 យុទ្ធនាការថែរក្សាអនាម័យជុំវិញដងអូរសាលារៀន', snippet: 'សាលានឹងរៀបចំកម្មវិធីសម្អាតបរិស្ថានរួម ដើម្បីលើកកម្ពស់សុខភាពកុមារ។ សូមនាំយកសម្ភារសមស្របមកផង!', date: '៤ ថ្ងៃមុន', views: '៥០ ដង', isHot: false },
  ];

  // Digital Books arrays
  const booksCatalog = [
    { title: '📖 វិញ្ញាសាគណិតវិទ្យាថ្នាក់ទី៤ និងទី៥', author: 'ក្រសួងអប់រំ យុវជន និងកីឡា', category: 'មេរៀន និងលំហាត់', popularity: 'ពេញនិយមខ្លាំង' },
    { title: '📖 រឿងនិទានប្រជាប្រិយខ្មែរ (ភាគទី១)', author: 'វិទ្យាស្ថានពុទ្ធសាសនបណ្ឌិត្យ', category: 'រឿងនិទានអប់រំ', popularity: 'ពេញចិត្តកុមារ' },
    { title: '📖 មគ្គុទ្ទេសក៍សិក្សាភាសាអង់គ្លេសកុមារ', author: 'គម្រោងការសហគមន៍អប់រំ', category: 'ភាសាបរទេស', popularity: 'ថ្មី' },
  ];

  // Quick Message helper
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      sender: 'me',
      text: chatInput,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatInput('');
  };

  // Add a record
  const handleAddRecord = () => {
    if (!newRecordText.trim()) return;
    const authorName = currentUser?.name || 'គ្រូបន្ទុកថ្នាក់';
    const newRec = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      content: newRecordText,
      author: authorName
    };
    setRecords(prev => [newRec, ...prev]);
    setNewRecordText('');
  };

  const handleRemoveRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // Switch tabs
  const handleTabClick = (tab: 'home' | 'records' | 'chat') => {
    setInnerView(tab);
  };

  return (
    <div className={`flex justify-center items-center w-full bg-slate-900 font-sans p-0 m-0 relative print:hidden ${IS_PHONE ? 'h-dvh' : 'h-dvh md:h-full'}`}>
      {/* Smartphone wrapper: full-screen on real phones (any orientation), decorative phone mockup only on desktop (md+) */}
      <div className={`w-full h-full bg-[#F0FDF4] relative flex flex-col overflow-hidden text-slate-800 ${IS_PHONE ? '' : 'md:w-[390px] md:h-[780px] md:max-w-[100vw] md:rounded-[48px] md:border-8 md:border-slate-700 md:shadow-2xl'}`}>
        
        {/* Elegant Mobile-Friendly Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-10 left-4 right-4 bg-emerald-900/95 backdrop-blur-md rounded-xl p-3 border border-emerald-500/30 text-[10px] text-emerald-100 shadow-2xl z-55 flex items-center gap-2.5 font-bold"
            >
              <span className="text-sm shrink-0">🔔</span>
              <p className="flex-1 leading-normal text-white">{toastMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phone Notch/Island — decorative, desktop mockup only */}
        <div className={`absolute top-0 left-0 right-0 h-7 ${IS_PHONE ? 'hidden' : 'hidden md:flex'} justify-between items-center px-6 z-50 text-[11px] font-black text-slate-700`}>
          <span>8:55</span>
          <div className="w-[110px] h-4 bg-black rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0" />
          <div className="flex items-center gap-1">
            <span>5G</span>
            <div className="w-4 h-2.5 bg-slate-700/20 border border-slate-400 rounded-xs" />
          </div>
        </div>

        {/* 1. Header (Replica of mockup) */}
        <header className={`px-4 pb-3.5 bg-[#ECFDF5] flex items-center justify-between border-b border-emerald-100 shrink-0 ${IS_PHONE ? 'pt-4' : 'pt-4 md:pt-9'}`}>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight text-[#064E3B] font-sans">
              សាលាសហគមន៍ច្បារច្រុះ
            </h1>
            <p className="text-[12.5px] text-[#059669] mt-0.5 font-bold font-sans">
              Chbar Chros Community School
            </p>
          </div>

          {/* Right Action Icons in the Header */}
          <div className="flex items-center gap-2">
            {/* Cambodian Traditional School Emblem Logo */}
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white shadow-xs border border-[#34D399]/40 overflow-hidden">
              <SchoolLogo className="w-full h-full p-0.5" />
            </div>

            {/* Bell/Notification Icon */}
            <div className="relative p-1.5 rounded-full bg-emerald-50 border border-emerald-200/50 hover:bg-emerald-100 transition-all cursor-pointer">
              <span className="w-4.5 h-4.5 absolute -top-1 -right-1 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center shadow-xs border-2 border-white">
                3
              </span>
              <span className="text-emerald-800 text-xs">🔔</span>
            </div>
          </div>
        </header>

        {/* 2. Main Scrollable Container Inside the Phone Body */}
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,#E9FDF0,transparent_50%),radial-gradient(circle_at_80%_40%,#FEF9E7,transparent_60%),radial-gradient(circle_at_30%_80%,#ECFDF5,transparent_50%),#E4F4E9] p-4 pb-20 relative select-none">
          <AnimatePresence mode="wait">
            
            {/* HOME VIEW: 10 Premium Bento-style Light Green Buttons */}
            {innerView === 'home' && (
              <motion.div
                key="home_grid"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex flex-col h-full justify-between"
              >
                {/* School Welcome Card Banner */}
                <div className="mb-4 bg-[#FAE5D3]/90 p-3.5 border border-[#ECC7A1] rounded-2xl flex items-center gap-3 shadow-3xs">
                  <div className="w-10 h-10 shrink-0 bg-[#E2AD7E]/20 rounded-xl flex items-center justify-center border border-[#E0A060]/30 shadow-3xs">
                    <svg viewBox="0 0 64 64" className="w-8 h-8 text-[#A06030]">
                      <rect x="12" y="28" width="40" height="26" rx="4" fill="#ECC7A1" stroke="#A55A26" strokeWidth="2" />
                      <polygon points="32,8 6,28 58,28" fill="#F07860" stroke="#C0392B" strokeWidth="2" />
                      <rect x="25" y="38" width="14" height="16" fill="#5DADE2" stroke="#2E4053" strokeWidth="2" />
                      <circle cx="32" cy="18" r="4" fill="#F4D03F" stroke="#9A7D0A" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-[#7E5109] leading-snug">
                      គណនីបច្ចុប្បន្ន៖ <span className="font-black">{currentUser?.name || "អ្នកគ្រូ យ៉ាប់ សុខ"}</span>
                    </p>
                    <p className="text-[11.5px] text-[#A06D28] leading-normal font-bold">
                      ({currentUser?.role === 'principal' ? 'នាយកសាលា' : `គ្រូ ${currentUser?.grade || "មតេ្តយ្យ ១"}`})
                    </p>
                  </div>
                </div>

                {/* 10 Custom-styled Grid buttons matching mockup screenshot */}
                <div className="grid grid-cols-2 gap-3.5 pb-4">
                  {/* Button 1: គ្រប់គ្រងព័ត៌មានទូទៅ */}
                  <button
                    onClick={() => setInnerView('notices')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Settings className="w-4.5 h-4.5 text-teal-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Gears & Folder */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <path d="M15,35 L45,35 L55,47 L105,47 L105,95 L15,95 Z" fill="#FDE047" stroke="#A16207" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M15,41 L105,41 L105,95 L15,95 Z" fill="#FEF08A" stroke="#A16207" strokeWidth="1.5" strokeLinejoin="round" />
                        <g transform="translate(68, 55) scale(0.65)">
                          <circle cx="20" cy="20" r="12" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="2" />
                          {Array.from({ length: 8 }).map((_, i) => (
                            <rect key={i} x="16" y="2" width="8" height="12" rx="2" transform={`rotate(${i * 45} 20 20)`} fill="#3B82F6" stroke="#1E3A8A" strokeWidth="2" />
                          ))}
                          <circle cx="20" cy="20" r="6" fill="#EFF6FF" />
                        </g>
                        <g transform="translate(35, 60) scale(0.7)">
                          <circle cx="20" cy="20" r="15" fill="#34D399" stroke="#065E3A" strokeWidth="2" />
                          {Array.from({ length: 10 }).map((_, i) => (
                            <rect key={i} x="17" y="0" width="6" height="10" rx="1.5" transform={`rotate(${i * 36} 20 20)`} fill="#10B981" stroke="#065E3A" strokeWidth="2" />
                          ))}
                          <circle cx="20" cy="20" r="7" fill="#ECFDF5" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-teal-950 leading-tight">
                      គ្រប់គ្រងព័ត៌មានទូទៅ
                    </span>
                  </button>

                  {/* Button 2: តារាងពិន្ទុ */}
                  <button
                    onClick={() => setInnerView('records')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Award className="w-4.5 h-4.5 text-blue-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Trophy & Chart */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="75" y="65" width="10" height="30" fill="#34D399" stroke="#065E3A" strokeWidth="1.5" />
                        <rect x="90" y="50" width="10" height="45" fill="#10B981" stroke="#065E3A" strokeWidth="1.5" />
                        <rect x="105" y="32" width="10" height="63" fill="#047857" stroke="#065E3A" strokeWidth="1.5" />
                        <g transform="translate(25, 25)">
                          <rect x="15" y="48" width="20" height="8" rx="2" fill="#94A3B8" stroke="#334155" strokeWidth="1.5" />
                          <polygon points="20,48 30,48 28,38 22,38" fill="#F1F5F9" stroke="#334155" strokeWidth="1.5" />
                          <path d="M10,12 C10,32 40,32 40,12 Z" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="2" />
                          <path d="M10,15 L3,15 C-1,15 -1,25 3,25 L10,23" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" />
                          <path d="M40,15 L47,15 C51,15 51,25 47,25 L40,23" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" />
                          <polygon points="25,12 28,18 35,19 30,23 32,30 25,26 18,30 20,23 15,19 22,18" fill="#FBBF24" />
                        </g>
                        <path d="M68,48 L114,30 M114,30 L102,30 M114,30 L114,42" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-blue-950 leading-tight">
                      តារាងពិន្ទុ
                    </span>
                  </button>

                  {/* Button 3: វត្តមានប្រចាំថ្ងៃ */}
                  <button
                    onClick={() => setInnerView('attendance-qr')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <QrCode className="w-4.5 h-4.5 text-orange-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Calendar check list */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="25" y="32" width="70" height="63" rx="8" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
                        <path d="M25,40 C25,36 29,32 33,32 L87,32 C91,32 95,36 95,40 L95,48 L25,48 Z" fill="#F97316" stroke="#D97706" strokeWidth="2" />
                        <circle cx="38" cy="28" r="4" fill="#64748B" />
                        <circle cx="60" cy="28" r="4" fill="#64748B" />
                        <circle cx="82" cy="28" r="4" fill="#64748B" />
                        <circle cx="40" cy="58" r="2.5" fill="#CBD5E1" />
                        <circle cx="40" cy="70" r="2.5" fill="#CBD5E1" />
                        <circle cx="40" cy="82" r="2.5" fill="#CBD5E1" />
                        <circle cx="60" cy="58" r="2.5" fill="#CBD5E1" />
                        <circle cx="60" cy="70" r="2.5" fill="#F59E0B" />
                        <circle cx="60" cy="82" r="2.5" fill="#CBD5E1" />
                        <circle cx="80" cy="58" r="2.5" fill="#CBD5E1" />
                        <circle cx="80" cy="70" r="2.5" fill="#CBD5E1" />
                        <circle cx="80" cy="82" r="2.5" fill="#CBD5E1" />
                        <path d="M36,58 L39,61 L45,55" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                        <path d="M76,58 L79,61 L85,55" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                        <path d="M76,70 L79,73 L85,67" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-orange-950 leading-tight">
                      វត្តមានប្រចាំថ្ងៃ
                    </span>
                  </button>

                  {/* Button 4: គ្រប់គ្រងថ្នាក់ */}
                  <button
                    onClick={() => setInnerView('class-mgmt')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Users className="w-4.5 h-4.5 text-purple-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Teacher and Class */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="40" y="25" width="65" height="42" rx="4" fill="#065E3A" stroke="#78350F" strokeWidth="3" />
                        <path d="M50,38 L55,38 M62,38 L68,44 M50,52 L74,52" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="85" cy="45" r="5" fill="none" stroke="#FDE047" strokeWidth="1.5" />
                        <circle cx="48" cy="88" r="9" fill="#1E293B" />
                        <circle cx="68" cy="92" r="9" fill="#1E293B" />
                        <circle cx="88" cy="88" r="9" fill="#475569" />
                        <circle cx="104" cy="94" r="8" fill="#334155" />
                        <g transform="translate(12, 40)">
                          <path d="M5,50 C5,40 25,40 25,50 Z" fill="#EC4899" stroke="#9D174D" strokeWidth="1.5" />
                          <circle cx="15" cy="28" r="10" fill="#FDBA74" stroke="#9D174D" strokeWidth="1.5" />
                          <path d="M5,26 C5,16 25,16 25,26 C25,20 5,20 5,26 Z" fill="#1E293B" />
                          <line x1="25" y1="36" x2="42" y2="20" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-purple-950 leading-tight">
                      គ្រប់គ្រងថ្នាក់
                    </span>
                  </button>

                  {/* Button 5: គ្រប់គ្រងសិស្ស */}
                  <button
                    onClick={() => setInnerView('students-info')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Contact className="w-4.5 h-4.5 text-indigo-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Student Profile folder */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="25" y="32" width="70" height="60" rx="6" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
                        <path d="M25,38 C25,35 28,32 31,32 L89,32 C92,32 95,35 95,38 L95,42 L25,42 Z" fill="#3B82F6" />
                        <circle cx="32" cy="37" r="2" fill="#EF4444" />
                        <circle cx="38" cy="37" r="2" fill="#FBBF24" />
                        <circle cx="44" cy="37" r="2" fill="#22C55E" />
                        <g transform="translate(30, 48)">
                          <circle cx="10" cy="10" r="7" fill="#FDBA74" />
                          <path d="M5,17 C5,14 15,14 15,17 Z" fill="#1E293B" />
                          <rect x="24" y="5" width="30" height="4" rx="2" fill="#3B82F6" />
                          <rect x="24" y="12" width="20" height="3" rx="1.5" fill="#E2E8F0" />
                        </g>
                        <g transform="translate(30, 68)">
                          <circle cx="10" cy="10" r="7" fill="#F3A3A3" />
                          <path d="M5,17 C5,14 15,14 15,17 Z" fill="#4B5563" />
                          <rect x="24" y="5" width="25" height="4" rx="2" fill="#EC4899" />
                          <rect x="24" y="12" width="32" height="3" rx="1.5" fill="#E2E8F0" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-indigo-950 leading-tight">
                      គ្រប់គ្រងសិស្ស
                    </span>
                  </button>

                  {/* Button 6: លទ្ធផលសិក្សា */}
                  <button
                    onClick={() => setInnerView('pdf-reports')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <BookOpen className="w-4.5 h-4.5 text-amber-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Certificate diploma */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="25" y="32" width="70" height="53" rx="4" fill="#FFFBEB" stroke="#D97706" strokeWidth="2.5" />
                        <rect x="29" y="36" width="62" height="45" fill="none" stroke="#F59E0B" strokeWidth="1" />
                        <line x1="45" y1="44" x2="75" y2="44" stroke="#B45309" strokeWidth="2.5" />
                        <line x1="38" y1="52" x2="82" y2="52" stroke="#D97706" strokeWidth="1" />
                        <line x1="38" y1="59" x2="82" y2="59" stroke="#CBD5E1" strokeWidth="1" />
                        <line x1="48" y1="66" x2="72" y2="66" stroke="#CBD5E1" strokeWidth="1" />
                        <g transform="translate(72, 62)">
                          <path d="M5,10 L0,25 L5,22 L10,25 Z" fill="#EF4444" />
                          <path d="M12,10 L7,25 L12,22 L17,25 Z" fill="#EF4444" />
                          <circle cx="8" cy="8" r="8" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                          <polygon points="8,4 10,7 13,8 10,10 11,13 8,11 5,13 6,10 3,8 6,7" fill="#FEF3C7" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-amber-950 leading-tight">
                      លទ្ធផលសិក្សា
                    </span>
                  </button>

                  {/* Button 7: របាយការណ៍ */}
                  <button
                    onClick={() => setInnerView('pdf-reports')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Award className="w-4.5 h-4.5 text-emerald-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Analytical Board */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="25" y="32" width="70" height="56" rx="6" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
                        <circle cx="45" cy="52" r="14" fill="#E2E8F0" />
                        <path d="M45,52 L45,38 A14,14 0 0,1 59,52 Z" fill="#3B82F6" />
                        <path d="M45,52 L59,52 A14,14 0 0,1 45,66 Z" fill="#EC4899" />
                        <rect x="66" y="40" width="22" height="10" rx="2" fill="#34D399" opacity="0.3" />
                        <line x1="68" y1="45" x2="86" y2="45" stroke="#059669" strokeWidth="2" />
                        <rect x="66" y="55" width="22" height="26" rx="2" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1" />
                        <path d="M68,76 L73,70 L78,73 L85,62" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
                        <rect x="32" y="73" width="26" height="4" rx="1.5" fill="#E2E8F0" />
                        <rect x="32" y="80" width="18" height="4" rx="1.5" fill="#3B82F6" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-emerald-950 leading-tight">
                      របាយការណ៍
                    </span>
                  </button>

                  {/* Button 8: តេស្ត និងប្រឡង */}
                  <button
                    onClick={() => setInnerView('timetable')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                        <Sparkles className="w-4.5 h-4.5 text-rose-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Exam Sheet & Pencil */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <rect x="30" y="28" width="60" height="66" rx="4" fill="#FFFFFF" stroke="#475569" strokeWidth="1.5" />
                        <text x="36" y="41" fontSize="6.5" fill="#1E293B" fontWeight="black" fontFamily="sans-serif">EXAM</text>
                        <line x1="36" y1="48" x2="84" y2="48" stroke="#94A3B8" strokeWidth="1.5" />
                        <line x1="36" y1="56" x2="84" y2="56" stroke="#94A3B8" strokeWidth="1.5" />
                        <line x1="36" y1="64" x2="70" y2="64" stroke="#94A3B8" strokeWidth="1.5" />
                        <line x1="36" y1="72" x2="84" y2="72" stroke="#E2E8F0" strokeWidth="1.5" />
                        <line x1="36" y1="80" x2="60" y2="80" stroke="#E2E8F0" strokeWidth="1.5" />
                        <g transform="translate(62, 32)">
                          <circle cx="15" cy="15" r="11" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3, 1" />
                          <circle cx="15" cy="15" r="10" fill="none" stroke="#EF4444" strokeWidth="1.5" />
                          <text x="15" y="18" fontSize="8" textAnchor="middle" fill="#EF4444" fontWeight="black" fontFamily="sans-serif">A+</text>
                        </g>
                        <g transform="rotate(32 75 75)">
                          <rect x="68" y="55" width="6" height="36" rx="1" fill="#FBBF24" stroke="#78350F" strokeWidth="1" />
                          <polygon points="68,91 74,91 71,98" fill="#FDBA74" stroke="#78350F" strokeWidth="1" />
                          <polygon points="70,96 72,96 71,98" fill="#1E293B" />
                          <rect x="68" y="52" width="6" height="4" fill="#EF4444" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-rose-950 leading-tight">
                      តេស្ត និងប្រឡង
                    </span>
                  </button>

                  {/* Button 9: កម្រងវិធីសិក្សា */}
                  <button
                    onClick={() => setInnerView('timetable')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-amber-700/10 border border-amber-700/20 flex items-center justify-center">
                        <Book className="w-4.5 h-4.5 text-amber-700 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Magical glowing educational book */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <path d="M60,15 L62,25 L72,27 L62,29 L60,39 L58,29 L48,27 L58,25 Z" fill="#FBBF24" />
                        <circle cx="34" cy="24" r="3" fill="#EC4899" />
                        <circle cx="86" cy="20" r="2.5" fill="#3B82F6" />
                        <circle cx="48" cy="35" r="2" fill="#10B981" />
                        <circle cx="74" cy="32" r="3" fill="#A855F7" />
                        <path d="M50,15 Q55,20 45,30" fill="none" stroke="#F43F5E" strokeWidth="1" />
                        <path d="M70,12 Q65,18 78,28" fill="none" stroke="#3B82F6" strokeWidth="1" />
                        <g transform="translate(25, 45)">
                          <path d="M5,25 C15,20 30,30 35,28 C40,30 55,20 65,25 L65,5 L50,0 C40,5 30,0 25,5 L5,5 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
                          <path d="M35,5 L35,28" stroke="#1E293B" strokeWidth="1.5" />
                          <path d="M3,26 C13,21 30,31 35,29 C40,31 57,21 67,26 L67,6 L65,6 C55,1 40,6 35,4 C30,6 15,1 5,6 L3,6 Z" fill="#F59E0B" stroke="#78350F" strokeWidth="1" />
                          <circle cx="16" cy="12" r="4.5" fill="none" stroke="#2563EB" strokeWidth="1" />
                          <line x1="24" y1="10" x2="30" y2="10" stroke="#64748B" strokeWidth="1" />
                          <line x1="24" y1="14" x2="30" y2="14" stroke="#64748B" strokeWidth="1" />
                          <path d="M42,10 L52,10 M42,14 L55,14 M42,18 L50,18" stroke="#64748B" strokeWidth="1" />
                        </g>
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-amber-950 leading-tight">
                      កម្រងវិធីសិក្សា
                    </span>
                  </button>

                  {/* Button 10: កិច្ចការផ្ទះ */}
                  <button
                    onClick={() => setInnerView('library')}
                    className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border border-emerald-500/10 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 active:scale-97 transition-all cursor-pointer min-h-[115px] relative"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <LibraryIcon className="w-4.5 h-4.5 text-cyan-600 stroke-[2.5]" />
                      </div>
                      {/* SVG Illustration - Computer Study Desk */}
                      <svg viewBox="0 0 120 120" className="w-14 h-14 shrink-0 -mt-1 -mr-1">
                        <polygon points="32,28 12,94 52,94" fill="#FEF08A" opacity="0.3" />
                        <rect x="25" y="62" width="70" height="24" fill="#D97706" stroke="#78350F" strokeWidth="1.5" />
                        <rect x="75" y="66" width="16" height="16" fill="#B45309" stroke="#78350F" strokeWidth="1.5" />
                        <circle cx="83" cy="74" r="2" fill="#FBBF24" />
                        <rect x="28" y="86" width="4" height="8" fill="#78350F" />
                        <rect x="86" y="86" width="4" height="8" fill="#78350F" />
                        <g transform="translate(38, 44)">
                          <rect x="5" y="10" width="22" height="14" rx="1.5" fill="#334155" />
                          <rect x="7" y="12" width="18" height="10" fill="#60A5FA" />
                          <polygon points="0,24 32,24 30,28 2,28" fill="#64748B" />
                        </g>
                        <path d="M28,62 Q28,45 34,42 Q30,30 35,28 L30,26" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="28" cy="62" r="3" fill="#EF4444" />
                        <path d="M30,26 L38,30 L36,34 L28,30 Z" fill="#EF4444" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-extrabold text-left text-cyan-950 leading-tight">
                      កិច្ចការផ្ទះ
                    </span>
                  </button>
                </div>

                {/* Khmer Traditional Custom Footer inside Home Dashboard view */}
                <div className="mt-2 p-3.5 rounded-xl border border-emerald-200/50 bg-[#F4FBF6] text-center">
                  <p className="text-[11.5px] text-emerald-800 font-bold italic">
                    « គណៈគ្រប់គ្រងសាលា និងគណៈកម្មការអប់រំសហគមន៍ច្បារច្រុះ »
                  </p>
                </div>
              </motion.div>
            )}

            {/* 1. TIMETABLE VIEW */}
            {innerView === 'timetable' && (
              <motion.div
                key="timetable"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-white">📅 កាលវិភាគសិក្សា (Weekly Schedule)</h3>
                </div>

                <div className="space-y-3">
                  {studyDays.map((dayData, idx) => (
                    <div key={idx} className="bg-blue-950/50 rounded-xl p-3 border border-blue-900/30">
                      <p className="text-[10px] font-bold text-[#E2C785] mb-2">{dayData.day}</p>
                      <div className="space-y-2">
                        {dayData.subjects.map((sub, sIdx) => (
                          <div key={sIdx} className="flex justify-between items-center bg-[#111E38]/50 p-2 rounded-lg border border-slate-700/25">
                            <div>
                              <p className="text-[9.5px] font-black text-slate-205">{sub.name}</p>
                              <p className="text-[8px] text-slate-400 mt-0.5">{sub.time} | {sub.room}</p>
                            </div>
                            <span className={`text-[7px] font-extrabold px-1.5 py-0.5 rounded-md ${
                              sub.status === 'completed' ? 'bg-[#10B981]/20 text-[#10B981]' : 
                              sub.status === 'active' ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 
                              'bg-slate-700/30 text-slate-350'
                            }`}>
                              {sub.status === 'completed' ? 'រួចរាល់' : sub.status === 'active' ? 'កំពុងរៀន' : 'បន្ទាប់'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 2. ACADEMIC REPORTS PORTAL */}
            {innerView === 'pdf-reports' && (
              <motion.div
                key="pdf-reports"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3 h-full pb-10"
              >
                <div className="flex items-center justify-between border-b border-emerald-250/50 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-xs font-bold text-emerald-950">📊 របាយការណ៍សិក្សាប្រចាំខែ</h3>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden text-slate-800 max-h-[620px] overflow-y-auto">
                  <ReportsHub
                    reports={reports}
                    onSaveReport={onSaveReport}
                    onDeleteReport={() => {}}
                    onViewReport={() => {}}
                    students={students}
                    grades={grades}
                    currentUser={currentUser}
                    onCancel={() => setInnerView('home')}
                  />
                </div>
              </motion.div>
            )}

            {/* 3. CLASS & STUDENT MANAGEMENT WRAPPER */}
            {innerView === 'class-mgmt' && (
              <motion.div
                key="class-mgmt"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-emerald-250/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-emerald-950">🏫 គ្រប់គ្រងថ្នាក់ និងសិស្ស</h3>
                </div>

                <div className="bg-white rounded-2xl p-2 border border-emerald-100 text-slate-800 max-h-[620px] overflow-y-auto">
                  <ClassStudentMgmt
                    students={students}
                    grades={grades}
                    onSaveStudents={onSaveStudents}
                    onAddGrade={onAddGrade}
                    onDeleteGrade={onDeleteGrade}
                    onRenameGrade={onRenameGrade}
                    currentUser={currentUser}
                  />
                </div>
              </motion.div>
            )}

            {/* 4. ONLINE CLASSES MOCKUP */}
            {innerView === 'online-classes' && (
              <motion.div
                key="online-classes"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-white">🎥 ថ្នាក់រៀនអនឡាញ (E-Classrooms)</h3>
                </div>

                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-indigo-950/80 to-blue-900/50 p-3.5 rounded-xl border border-blue-800/30 text-center">
                    <span className="text-2xl animate-pulse inline-block">🔴</span>
                    <p className="text-[10.5px] font-bold text-slate-100 mt-2">ថ្នាក់ត្រៀមប្រឡងពិសេស (គណិតវិទ្យា)</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">ណែនាំដោយ៖ លោកគ្រូ សុផាន់ណា | ម៉ោង ០៨:០០ យប់</p>
                    <button className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-[9px] font-bold animate-pulse inline-flex items-center gap-1 cursor-pointer">
                      <span>👁️ ចូលរួមទស្សនាផ្ទាល់</span>
                    </button>
                  </div>

                  <div className="bg-blue-950/20 rounded-xl p-3 border border-blue-900/20">
                    <p className="text-[10px] font-bold text-[#E2C785] mb-2">តំណភ្ជាប់បន្ទប់សិក្សាប្រចាំថ្ងៃ</p>
                    <div className="space-y-2">
                      <div className="p-2.5 bg-[#111E38]/60 rounded-lg flex justify-between items-center text-[9px]">
                        <div>
                          <p className="font-bold text-slate-100">💻 បន្ទប់ Zoom ថ្នាក់ទី ១ក</p>
                          <p className="text-[7.5px] text-slate-500 mt-0.5">លេខកូដសម្ងាត់៖ 12345 | បើកជារៀងរាល់ព្រឹក</p>
                        </div>
                        <span className="text-[7px] text-emerald-450 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/10">សកម្ម</span>
                      </div>
                      <div className="p-2.5 bg-[#111E38]/60 rounded-lg flex justify-between items-center text-[9px]">
                        <div>
                          <p className="font-bold text-slate-100">💻 បន្ទប់ Google Meet ថ្នាក់ទី ២ក</p>
                          <p className="text-[7.5px] text-slate-500 mt-0.5">តំណភ្ជាប់ត្រូវបានភ្ជាប់ស្វ័យប្រវត្ត</p>
                        </div>
                        <span className="text-[7px] text-[#E2C785] bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/10">ក្រៅតម្រូវការ</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. ATTENDANCE SCAN QR & DAILY ROLL CALL */}
            {innerView === 'attendance-qr' && (
              <motion.div
                key="attendance-qr"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3 text-left"
              >
                <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-emerald-950">📅 ប្រព័ន្ធគ្រប់គ្រងវត្តមានប្រចាំថ្ងៃ</h3>
                </div>

                <div className="bg-white rounded-2xl p-2 border border-emerald-100 text-slate-800 max-h-[620px] overflow-y-auto w-full">
                  <DailyAttendance
                    students={students}
                    currentUser={currentUser}
                    grades={grades}
                  />
                </div>
              </motion.div>
            )}

            {/* PREVIOUS MOCK ATTENDANCE SYSTEM */}
            {innerView === 'unused-attendance-qr' && (() => {
              const activeGradeStudents = students.filter(s => s.grade === selectedAttendanceGrade);
              const filteredStudents = activeGradeStudents.filter(s => 
                s.name.toLowerCase().includes(attendanceSearchQuery.toLowerCase())
              );
              
              const totalGradeCount = activeGradeStudents.length;
              const presentCount = activeGradeStudents.filter(s => (activeAttendanceMap[s.id] || 'present') === 'present').length;
              const lateCount = activeGradeStudents.filter(s => activeAttendanceMap[s.id] === 'late').length;
              const permissionCount = activeGradeStudents.filter(s => activeAttendanceMap[s.id] === 'permission').length;
              const absentCount = activeGradeStudents.filter(s => activeAttendanceMap[s.id] === 'absent').length;
              const attendancePercent = totalGradeCount > 0 
                ? Math.round(((presentCount + lateCount) / totalGradeCount) * 100) 
                : 100;

              return (
                <motion.div
                  key="attendance-qr"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3 text-left"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                    <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-xs font-bold text-white">📅 ប្រព័ន្ធគ្រប់គ្រងវត្តមានប្រចាំថ្ងៃ</h3>
                  </div>

                  {/* High Fidelity Tabs */}
                  <div className="grid grid-cols-3 gap-1 bg-blue-950/45 p-1 rounded-xl border border-blue-900/20 shrink-0">
                    <button
                      onClick={() => setAttendanceTab('roll-call')}
                      className={`py-1.5 text-center text-[8px] font-black rounded-lg transition-all cursor-pointer ${
                        attendanceTab === 'roll-call'
                          ? 'bg-[#E2C785] text-blue-955 shadow-md font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📝 កត់វត្តមាន
                    </button>
                    <button
                      onClick={() => setAttendanceTab('qr')}
                      className={`py-1.5 text-center text-[8px] font-black rounded-lg transition-all cursor-pointer ${
                        attendanceTab === 'qr'
                          ? 'bg-[#E2C785] text-blue-955 shadow-md font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📸 ស្កេនកូដ QR
                    </button>
                    <button
                      onClick={() => setAttendanceTab('history')}
                      className={`py-1.5 text-center text-[8px] font-black rounded-lg transition-all cursor-pointer ${
                        attendanceTab === 'history'
                          ? 'bg-[#E2C785] text-blue-955 shadow-md font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📜 ប្រវត្តវត្តមាន
                    </button>
                  </div>

                  {/* TAB 1: DAILY ROLL CALL */}
                  {attendanceTab === 'roll-call' && (
                    <div className="space-y-3">
                      {/* Configuration Controls */}
                      <div className="bg-[#111E38]/90 rounded-xl border border-blue-900/35 p-2.5 space-y-2 text-[9px]">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[7.5px] text-slate-400 mb-0.5 font-bold">ជ្រើសរើសថ្ងៃខែ</label>
                            <input
                              type="date"
                              value={selectedAttendanceDate}
                              onChange={e => setSelectedAttendanceDate(e.target.value)}
                              className="w-full bg-blue-950/70 border border-blue-900/40 text-slate-200 rounded px-1.5 py-1 text-[8.5px] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[7.5px] text-slate-400 mb-0.5 font-bold">ថ្នាក់រៀន{currentUser?.role === 'teacher' && ' 🔒'}</label>
                            <select
                              value={selectedAttendanceGrade}
                              onChange={e => setSelectedAttendanceGrade(e.target.value)}
                              disabled={currentUser?.role === 'teacher'}
                              className="w-full bg-blue-950/70 border border-blue-900/40 text-slate-200 rounded px-1.5 py-1 text-[8.5px] outline-none font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {(currentUser?.role === 'teacher' ? [currentUser.grade] : grades).map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Morning / afternoon shift — general classes only */}
                        {!isExtraClass(selectedAttendanceGrade) && (
                          <div className="flex items-center gap-1 bg-blue-950/50 rounded-lg p-0.5">
                            {MP_SESSIONS.map(s => (
                              <button
                                key={s.key}
                                onClick={() => setAttendanceSession(s.key)}
                                className={`flex-1 py-1 rounded-md text-[8.5px] font-bold transition-all ${attendanceSession === s.key ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
                              >
                                {s.icon} {s.km}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Search keyword */}
                        <div className="relative flex items-center bg-blue-950/70 border border-blue-900/40 rounded px-2 py-0.5 text-[8.5px]">
                          <Search size={10} className="text-slate-500 mr-1.5 shrink-0" />
                          <input
                            type="text"
                            placeholder="ស្វែងរកឈ្មោះសិស្ស..."
                            value={attendanceSearchQuery}
                            onChange={e => setAttendanceSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-slate-100 flex-1 outline-none py-1 placeholder-slate-500 text-[8.5px]"
                          />
                          {attendanceSearchQuery && (
                            <button onClick={() => setAttendanceSearchQuery('')} className="text-slate-500 text-[9px] hover:text-white ml-1">✕</button>
                          )}
                        </div>
                      </div>

                      {/* Dynamic Dashboard Statistics Badge */}
                      <div className="bg-gradient-to-r from-blue-900/20 to-indigo-950/30 rounded-xl border border-blue-800/20 p-2.5 flex items-center justify-between text-[8px]">
                        <div>
                          <p className="text-slate-400 font-bold">ស្ថិតិវត្តមានថ្នាក់ ({selectedAttendanceGrade})</p>
                          <p className="text-[12px] font-black text-[#E2C785] mt-1">អត្រាវត្តមាន៖ {attendancePercent}%</p>
                        </div>
                        <div className="flex gap-1.5 font-bold text-center">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-1 rounded">
                            <span className="block text-[9px] font-black">{presentCount}</span>វត្តមាន
                          </span>
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-1 rounded">
                            <span className="block text-[9px] font-black">{lateCount}</span>យឺត
                          </span>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-1 rounded">
                            <span className="block text-[9px] font-black">{permissionCount}</span>ច្បាប់
                          </span>
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-1 rounded">
                            <span className="block text-[9px] font-black">{absentCount}</span>អត់ច្បាប់
                          </span>
                        </div>
                      </div>

                      {/* Student Roll Call List */}
                      <div className="bg-[#111E38]/80 rounded-xl border border-blue-900/20 max-h-[240px] overflow-y-auto divide-y divide-blue-950/40 p-1">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map((std, idx) => {
                            const currentStatus = activeAttendanceMap[std.id] || 'present';
                            return (
                              <div key={std.id} className="p-2 flex items-center justify-between text-[9px] hover:bg-blue-950/20 transition-all">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <p className="font-bold text-slate-100">{std.name}</p>
                                    <p className="text-[7.5px] text-slate-400 mt-0.5">{std.gender} | ថ្នាក់ទី {std.grade}</p>
                                  </div>
                                </div>

                                {/* វ, យ, ច្ប, អច្ប selector buttons */}
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'present' }))}
                                    className={`w-7 py-1 text-[8px] font-black rounded-md transition-all border shrink-0 cursor-pointer ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-600 text-slate-100 border-emerald-500 shadow-sm shadow-emerald-600/20 font-black scale-105'
                                        : 'bg-blue-950/40 text-slate-400 border-blue-900/10'
                                    }`}
                                    title="វត្តមាន (វ)"
                                  >
                                    វ
                                  </button>
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'late' }))}
                                    className={`w-7 py-1 text-[8px] font-black rounded-md transition-all border shrink-0 cursor-pointer ${
                                      currentStatus === 'late'
                                        ? 'bg-blue-600 text-slate-100 border-blue-500 shadow-sm shadow-blue-600/20 font-black scale-105'
                                        : 'bg-blue-950/40 text-slate-400 border-blue-900/10'
                                    }`}
                                    title="យឺត (យ)"
                                  >
                                    យ
                                  </button>
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'permission' }))}
                                    className={`w-7 py-1 text-[8px] font-black rounded-md transition-all border shrink-0 cursor-pointer ${
                                      currentStatus === 'permission'
                                        ? 'bg-amber-600 text-slate-100 border-amber-500 shadow-sm shadow-amber-600/20 font-black scale-105'
                                        : 'bg-blue-950/40 text-slate-400 border-blue-900/10'
                                    }`}
                                    title="ច្បាប់ (ច្ប)"
                                  >
                                    ច្ប
                                  </button>
                                  <button
                                    onClick={() => setActiveAttendanceMap(prev => ({ ...prev, [std.id]: 'absent' }))}
                                    className={`w-7 py-1 text-[8px] font-black rounded-md transition-all border shrink-0 cursor-pointer ${
                                      currentStatus === 'absent'
                                        ? 'bg-rose-600 text-slate-105 border-rose-500 shadow-sm shadow-rose-600/20 font-black scale-105'
                                        : 'bg-blue-950/40 text-slate-400 border-blue-900/10'
                                    }`}
                                    title="អត់ច្បាប់ (អច្ប)"
                                  >
                                    អច្ប
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-6 text-center text-[9px] text-slate-500">
                            📭 ពុំមានសិស្សសមស្របនឹងការស្វែងរកនេះឡើយ។
                          </div>
                        )}
                      </div>

                      {/* Primary Save Button */}
                      <button
                        onClick={handleSaveAttendance}
                        className="w-full py-2 bg-[#E2C785] text-slate-950 hover:brightness-105 active:scale-[0.99] rounded-xl font-bold text-[9.5px] shadow-lg transition-all flex items-center justify-center gap-1 cursor-pointer font-sans shrink-0 uppercase tracking-wider"
                      >
                        💾 រក្សាទុកវត្តមានថ្ងៃនេះ
                      </button>
                    </div>
                  )}

                  {/* TAB 2: ACTIVE SCAN QR */}
                  {attendanceTab === 'qr' && (
                    <div className="bg-[#111E38]/90 rounded-2xl border border-blue-900/35 p-5 flex flex-col items-center">
                      <p className="text-[10px] text-slate-350 leading-normal mb-4 text-center">
                        ប្រើកាមេរ៉ាទូរស័ព្ទរបស់អ្នក ដើម្បីស្កេនកាតសិស្ស (Student Identification Card) ដើម្បីពិនិត្យ ឬចុះឈ្មោះវត្តមានលើប្រព័ន្ធ Cloud ស្វ័យប្រវត្ត។
                      </p>

                      {/* QR SCAN FRAME MOCKUP WITH ACTIVE LASER EFFECT */}
                      <div className="w-44 h-44 bg-slate-900/60 rounded-xl relative border border-blue-800 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                        <span className="text-4xl">🪪</span>
                        {qrScanning && (
                          <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-[bounce_2s_infinite] top-0" />
                        )}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#E2C785]" />
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#E2C785]" />
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#E2C785]" />
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#E2C785]" />
                      </div>

                      <button
                        onClick={() => {
                          setQrScanning(true);
                          setQrMessage(null);
                          setTimeout(() => {
                            if (activeGradeStudents.length > 0) {
                              const rand = activeGradeStudents[Math.floor(Math.random() * activeGradeStudents.length)];
                              
                              // Check in dynamic roll call state map
                              setActiveAttendanceMap(prev => ({ ...prev, [rand.id]: 'present' }));
                              
                              setQrMessage(`📍 ពិនិត្យវត្តមានជោគជ័យ! សិស្ស៖ ${rand.name} ភេទ៖ ${rand.gender} ថ្នាក់ទី៖ ${rand.grade}`);
                              showToast(`✅ ចុះវត្តមានស្កេន៖ ${rand.name}`);
                            } else {
                              setQrMessage(`📍 ពិនិត្យវត្តមានជោគជ័យ! សិស្ស៖ សុខ លីណា (គំរូសាកល្បង)`);
                              showToast(`✅ ចុះវត្តមានស្កេន៖ សុខ លីណា`);
                            }
                            setQrScanning(false);
                          }, 1600);
                        }}
                        disabled={qrScanning}
                        className="mt-5 px-3.5 py-1.5 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-[10px] font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{qrScanning ? '🔄 កំពុងស្កេនកាតសិស្ស...' : '📸 ស្កេនស្វ័យប្រវត្ត'}</span>
                      </button>

                      {qrMessage && (
                        <div className="p-2 mt-4 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 text-[8.5px] rounded-lg leading-relaxed text-left">
                          {qrMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: ATTENDANCE HISTORY LOG */}
                  {attendanceTab === 'history' && (
                    <div className="space-y-3">
                      <p className="text-[8.5px] text-slate-400 font-bold leading-normal">
                        បញ្ជីប្រវត្តិវត្តមានដែលបានរក្សាទុកក្នុងប្រព័ន្ធកន្លងមក៖
                      </p>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {savedAttendanceRecords
                          .filter(rec => currentUser?.role !== 'teacher' || rec.grade === currentUser.grade)
                          .map((rec) => {
                          const total = rec.presentCount + (rec.lateCount || 0) + rec.permissionCount + rec.absentCount;
                          const percent = total > 0 ? Math.round(((rec.presentCount + (rec.lateCount || 0)) / total) * 105) : 100;
                          const displayPercent = percent > 100 ? 100 : percent;
                          return (
                            <div
                              key={rec.id}
                              onClick={() => {
                                setSelectedAttendanceDate(rec.date);
                                setSelectedAttendanceGrade(rec.grade);
                                setAttendanceTab('roll-call');
                                showToast(`📂 បានទាញយកវត្តមាន៖ ${rec.date} (${rec.grade})`);
                              }}
                              className="p-2.5 bg-[#111E38]/85 border border-slate-700/20 hover:border-[#E2C785]/40 hover:bg-blue-950/40 rounded-xl transition-all cursor-pointer text-[9px] flex items-center justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="text-[#E2C785]">📅 {rec.date}</span>
                                  <span className="text-slate-400 bg-blue-950/80 px-1 py-0.2 rounded text-[7.5px]">{rec.grade}</span>
                                </div>
                                <div className="text-[8px] text-slate-400 flex items-center gap-2 flex-wrap">
                                  <span>វត្តមាន៖ <b className="text-emerald-400">{rec.presentCount}</b></span>
                                  <span>យឺត៖ <b className="text-blue-400">{rec.lateCount || 0}</b></span>
                                  <span>ច្បាប់៖ <b className="text-amber-400">{rec.permissionCount}</b></span>
                                  <span>អត់ច្បាប់៖ <b className="text-rose-400">{rec.absentCount}</b></span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md ${
                                  displayPercent >= 90
                                    ? 'bg-[#10B981]/25 text-[#10B981]'
                                    : displayPercent >= 75
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}>
                                  {displayPercent}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}

            {/* 6. DIGITAL LIBRARY CATALOG */}
            {innerView === 'library' && (
              <motion.div
                key="library"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-white">📖 បណ្ណាល័យឌីជីថល (Khmer Library)</h3>
                </div>

                <div className="bg-blue-950/20 p-3 rounded-xl border border-blue-900/25 flex items-center gap-2 text-[9.5px]">
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="ស្វែងរកសៀវភៅអានអេឡិចត្រូនិច..."
                    className="bg-transparent border-none text-slate-100 flex-1 outline-none text-[8.5px]"
                  />
                </div>

                <div className="space-y-2 mt-3">
                  {booksCatalog.map((bk, i) => (
                    <div key={i} className="p-2.5 bg-[#111E38]/70 border border-slate-700/20 rounded-xl flex items-center justify-between text-[9px]">
                      <div>
                        <p className="font-bold text-[#E2C785]">{bk.title}</p>
                        <p className="text-[7.5px] text-slate-400 mt-1">និពន្ធដោយ៖ {bk.author} | {bk.category}</p>
                      </div>
                      <span className="text-[7px] bg-[#E2C785]/20 text-[#E2C785] px-1 rounded font-black">
                        {bk.popularity}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 7. SCHOOL BULLETIN BOARD NOTICES */}
            {innerView === 'notices' && (
              <motion.div
                key="notices"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3 text-left"
              >
                <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-emerald-950">📋 គ្រប់គ្រងព័ត៌មានទូទៅ (Dashboard)</h3>
                </div>

                <div className="bg-white rounded-2xl p-2 border border-emerald-100 text-slate-800 max-h-[620px] overflow-y-auto w-full">
                  <Dashboard
                    reports={reports}
                    students={students}
                    selectedMonth="ទាំងអស់"
                    setSelectedMonth={() => {}}
                    selectedGrade="ទាំងអស់"
                    setSelectedGrade={() => {}}
                    onViewReport={() => {}}
                    onDeleteReport={() => {}}
                    onCreateReportClick={() => setInnerView('pdf-reports')}
                    onOpenGradebookClick={() => setInnerView('records')}
                    onOpenAttendanceClick={() => setInnerView('attendance-qr')}
                    grades={grades}
                    currentUser={currentUser}
                  />
                </div>
              </motion.div>
            )}

            {/* PREVIOUS BULLETIN BOARD */}
            {innerView === 'unused-notices' && (
              <motion.div
                key="notices"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-white">📢 សេចក្តីជូនដំណឹងសាលា</h3>
                </div>

                <div className="space-y-3">
                  {noticesList.map((not, idx) => (
                    <div key={idx} className="bg-[#111E38]/80 p-3 rounded-xl border border-slate-700/20 text-[9px] relative overflow-hidden">
                      {not.isHot && (
                        <div className="absolute top-0 right-0 bg-red-650 text-white font-extrabold text-[6.5px] uppercase px-1.5 py-0.5 rounded-bl">HOT</div>
                      )}
                      <p className="font-black text-slate-105">{not.title}</p>
                      <p className="text-slate-400 mt-1 lines-clamp-2 leading-relaxed">{not.snippet}</p>
                      <div className="flex justify-between items-center text-[7.5px] text-slate-500 mt-2">
                        <span>🕒 {not.date}</span>
                        <span>👁️ {not.views}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 8. STUDENT INFORMATION PROFILE CARDS */}
            {innerView === 'students-info' && (
              <motion.div
                key="students-info"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3 text-left"
              >
                <div className="flex items-center justify-between border-b border-emerald-250/50 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-xs font-bold text-emerald-950">🪪 ព័ត៌មាន និងពិន្ទុសិស្សថ្នាក់រៀន</h3>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-2 border border-emerald-100 text-slate-800 max-h-[620px] overflow-y-auto w-full">
                  <ClassStudentMgmt
                    students={students}
                    grades={grades}
                    onSaveStudents={onSaveStudents}
                    onAddGrade={onAddGrade}
                    onDeleteGrade={onDeleteGrade}
                    onRenameGrade={onRenameGrade}
                    currentUser={currentUser}
                  />
                </div>
              </motion.div>
            )}

            {/* PREVIOUS STUDENT PROFILES */}
            {innerView === 'unused-students-info' && (
              <motion.div
                key="students-info"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between border-b border-blue-900/50 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-xs font-bold text-white">🪪 ព័ត៌មាន និងពិន្ទុសិស្សថ្នាក់រាល</h3>
                  </div>
                </div>

                <div className="bg-[#111E38]/90 rounded-xl border border-blue-900/25 max-h-[500px] overflow-y-auto">
                  <div className="p-2 border-b border-slate-850 flex justify-between items-center bg-[#071329] shrink-0 text-[10px] text-slate-400">
                    <span className="font-bold">ឈ្មោះសិស្ស</span>
                    <span className="font-bold">ប្រឡងវៀន</span>
                  </div>
                  {students.length === 0 ? (
                    <p className="text-center py-6 text-[9.5px] text-slate-405">មិនមានទិន្នន័យសិស្សទេ។</p>
                  ) : (
                    students.map(std => (
                      <div key={std.id} className="p-2 border-b border-indigo-950/20 flex justify-between items-center text-[9px]">
                        <div>
                          <p className="font-bold text-slate-200">{std.name}</p>
                          <p className="text-[7.5px] text-slate-400 mt-0.5">{std.gender === 'ស្រី' ? 'ស្រី' : 'ប្រុស'} | ថ្នាក់ទី៖ {std.grade}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#E2C785] font-black">{std.overallAvg ? std.overallAvg.toFixed(2) : '0.00'}/10</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* 9. SCHOOL TRANSPORT LOGS */}
            {innerView === 'transport' && (
              <motion.div
                key="transport"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-blue-900/50 pb-2 mb-2">
                  <button onClick={() => setInnerView('home')} className="p-1 hover:bg-blue-900/55 rounded text-[#E2C785]">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-xs font-bold text-white">🚌 ដឹកជញ្ជូនសិស្ស (School Bus)</h3>
                </div>

                <div className="bg-[#111E38]/95 p-3.5 rounded-xl border border-blue-900/30 text-[9px] space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <div>
                      <p className="font-black text-[#E2C785]">ឡានសាលាឡាន V1</p>
                      <p className="text-[7.5px] text-slate-400 mt-0.5">អ្នកបើកបរ៖ ពូ ម៉ៅ | លេខទូរស័ព្ទ៖ 012 345_678</p>
                    </div>
                    <span className="text-[7.5px] bg-red-600/20 text-red-400 font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">
                      សកម្មភាព
                    </span>
                  </div>

                  {/* Vertical Bus Stop Timeline tracker */}
                  <div className="relative pl-6 space-y-4 py-1 border-l-2 border-blue-900/40">
                    {busStops.map(stop => (
                      <div key={stop.id} className="relative">
                        {/* Bullet tracker */}
                        <div className={`w-3.5 h-3.5 rounded-full absolute -left-[30px] top-0 border-2 border-[#111E38] ${
                          stop.arrived ? 'bg-[#10B981]' : 'bg-slate-700 animate-pulse'
                        }`} />
                        <div>
                          <p className={`font-bold ${stop.arrived ? 'text-slate-200' : 'text-slate-405 font-medium'}`}>
                            {stop.name}
                          </p>
                          <p className="text-[7px] text-slate-450 mt-0.5">ពេលវេលា៖ {stop.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2 VIEW: NOTES AND RECORDS */}
            {innerView === 'records' && (
              <motion.div
                key="records"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 text-left"
              >
                <div className="border-b border-emerald-250/50 pb-2 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setInnerView('home')} className="p-1 hover:bg-emerald-100/50 rounded text-emerald-800">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-xs font-bold text-emerald-950">📝 តារាងពិន្ទុ និងការវាយតម្លៃ (Gradebook)</h3>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-2 border border-emerald-100 text-slate-800 max-h-[620px] overflow-y-auto w-full">
                  <Gradebook
                    students={students}
                    selectedMonth={gbMonth}
                    setSelectedMonth={setGbMonth}
                    selectedGrade={gbGrade}
                    setSelectedGrade={setGbGrade}
                    onSaveStudents={onSaveStudents}
                    currentUser={currentUser}
                    grades={grades}
                    onAddGrade={onAddGrade}
                    onDeleteGrade={onDeleteGrade}
                  />
                </div>
              </motion.div>
            )}

            {/* PREVIOUS LOGS FOR TEACHERS */}
            {innerView === 'unused-records' && (
              <motion.div
                key="records"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                <div className="border-b border-blue-900/40 pb-2 flex justify-between items-center shrink-0">
                  <h3 className="text-xs font-bold text-white">📝 កំណត់ត្រារួមគ្រូ-អ្នកគ្រូ (Teacher Logs)</h3>
                  <span className="text-[8px] bg-blue-600/30 text-blue-300 font-black px-1.5 py-0.5 rounded">
                    {records.length} កំណត់ត្រា
                  </span>
                </div>

                {/* Input area */}
                <div className="bg-blue-950/45 p-3 rounded-xl border border-blue-900/30 space-y-2">
                  <p className="text-[8px] text-[#E2C785] uppercase tracking-wider font-bold">សរសេរកំណត់ត្រាថ្មី</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRecordText}
                      onChange={e => setNewRecordText(e.target.value)}
                      placeholder="ឧ. សិស្ស លីណា ថ្ងៃនេះយកចិត្តទុកដាក់រៀនណាស់..."
                      className="bg-[#111E38] border border-blue-900/40 rounded-lg p-2 text-slate-100 placeholder-slate-500 text-[9px] flex-1 outline-none"
                    />
                    <button
                      onClick={handleAddRecord}
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Lists of notes */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {records.map((rec) => (
                    <div key={rec.id} className="bg-blue-950/30 p-3 rounded-xl border border-blue-900/20 text-[9.5px]">
                      <div className="flex justify-between items-center text-[7.5px] text-slate-400 mb-1.5 font-semibold">
                        <span>✍️ {rec.author}</span>
                        <div className="flex items-center gap-2">
                          <span>📅 {rec.date}</span>
                          <button onClick={() => handleRemoveRecord(rec.id)} className="text-rose-450 hover:text-rose-400 cursor-pointer">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-105 font-light leading-relaxed">{rec.content}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB 3 VIEW: MESSAGE / CHAT */}
            {innerView === 'chat' && (
              <motion.div
                key="chat_messages"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col h-full space-y-4"
              >
                <div className="border-b border-blue-900/40 pb-2 shrink-0">
                  <h3 className="text-xs font-bold text-white">💬 ប្រអប់ទំនាក់ទំនងអាណាព្យាបាល (Parent Chat)</h3>
                  <p className="text-[7.5px] text-slate-500 mt-0.5">បន្ទប់សុវត្ថិភាពស្វ័យប្រវត្ត</p>
                </div>

                {/* Chat window viewport */}
                <div className="flex-1 bg-blue-950/20 rounded-xl p-3 border border-blue-900/10 space-y-3 overflow-y-auto min-h-[350px] max-h-[440px]">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2.5 rounded-2xl max-w-[85%] text-[9.5px] leading-relaxed shadow-sm ${
                        msg.sender === 'me' 
                          ? 'bg-blue-600 text-slate-100 rounded-br-none' 
                          : 'bg-[#111E38]/85 text-slate-200 rounded-bl-none border border-slate-800'
                      }`}>
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-[6.5px] text-slate-500 mt-1 px-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* Footer text field */}
                <div className="bg-blue-950/50 p-2 rounded-xl flex items-center gap-2 border border-blue-900/30 shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="សរសេរសារឆ្លើយតប..."
                    className="bg-transparent border-none text-[9px] text-slate-100 placeholder-slate-500 flex-1 outline-none px-2"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all cursor-pointer"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* 3. Bottom Capsule Navigation Tabbar (Inspired from mockup) */}
        {/* White background, elegant floating rounded container */}
        <div className="absolute bottom-3 left-3 right-3 h-14 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl flex items-center justify-between px-3 shrink-0 z-40 border border-[#A7F3D0]/20">
          
          {/* Tab 1: Home/ទំព័រដើម */}
          <button
            onClick={() => handleTabClick('home')}
            className={`flex flex-col items-center justify-center py-1 flex-1 rounded-xl transition-all cursor-pointer ${
              innerView === 'home' || !['records', 'chat'].includes(innerView)
                ? 'text-[#EA580C] font-black'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home size={17} className={innerView === 'home' || !['records', 'chat'].includes(innerView) ? 'text-[#EA580C]' : 'text-slate-400'} />
            <span className="text-[8.5px] font-bold mt-0.5">ទំព័រដើម</span>
          </button>

          {/* Tab 2: Favorites/ចំណាំ */}
          <button
            onClick={() => handleTabClick('records')}
            className={`flex flex-col items-center justify-center py-1 flex-1 rounded-xl transition-all cursor-pointer ${
              innerView === 'records'
                ? 'text-[#EA580C] font-black'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Heart size={17} className={innerView === 'records' ? 'text-[#EA580C]' : 'text-slate-400'} />
            <span className="text-[8.5px] font-bold mt-0.5">ចំណាំ</span>
          </button>

          {/* Tab 3: Messages/សារ */}
          <button
            onClick={() => handleTabClick('chat')}
            className={`flex flex-col items-center justify-center py-1 flex-1 rounded-xl transition-all cursor-pointer ${
              innerView === 'chat'
                ? 'text-[#EA580C] font-black'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquare size={17} className={innerView === 'chat' ? 'text-[#EA580C]' : 'text-slate-400'} />
            <span className="text-[8.5px] font-bold mt-0.5">សារ</span>
          </button>

          {/* Tab 4: System menu/ម៉ឺនុយ */}
          <button
            onClick={() => setShowMenuOverlay(true)}
            className="flex flex-col items-center justify-center py-1 flex-1 rounded-xl hover:text-slate-600 transition-all text-slate-400 cursor-pointer"
          >
            <MenuIcon size={17} className="text-slate-400" />
            <span className="text-[8.5px] font-bold mt-0.5">ម៉ឺនុយ</span>
          </button>

          {/* Bottom Right Floating Helper / Mascot Robot Icon as seen in mockup */}
          <button
            onClick={() => setShowAiHelper(true)}
            className="w-12 h-12 rounded-full p-0.5 shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ml-1.5 overflow-hidden"
            style={{ background: 'radial-gradient(circle at 35% 35%, #ffffff, #dcfce7, #86efac)' }}
            title="ជំនួយការសាលារៀន AI"
          >
            <svg viewBox="0 0 64 64" className="w-[36px] h-[36px]">
              {/* Head Base */}
              <circle cx="32" cy="34" r="16" fill="#F8FAFC" stroke="#64748B" strokeWidth="1" />
              <circle cx="32" cy="34" r="16" fill="url(#glossHead)" stroke="#475569" strokeWidth="0.5" />
              {/* Visor Area */}
              <rect x="20" y="27" width="24" height="11" rx="5" fill="#0F172A" />
              {/* Light Up Blue Eyes */}
              <circle cx="26" cy="32.5" r="3" fill="#38BDF8" className="animate-pulse" />
              <circle cx="38" cy="32.5" r="3" fill="#38BDF8" className="animate-pulse" />
              {/* Ears/Side pads */}
              <rect x="13" y="29" width="3" height="10" rx="1.5" fill="#38BDF8" />
              <rect x="48" y="29" width="3" height="10" rx="1.5" fill="#38BDF8" />
              {/* Core Antenna structure */}
              <line x1="32" y1="18" x2="32" y2="10" stroke="#475569" strokeWidth="1.5" />
              <circle cx="32" cy="9" r="2.5" fill="#EF4444" className="animate-pulse" />
              <defs>
                <radialGradient id="glossHead" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="70%" stopColor="#FFFFFB" />
                  <stop offset="100%" stopColor="#CBD5E1" />
                </radialGradient>
              </defs>
            </svg>
          </button>

        </div>

        {/* 4. Drawer: High Fidelity AI Chat Assistant powered by server-side config */}
        <AnimatePresence>
          {showAiHelper && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAiHelper(false)}
                className="absolute inset-0 bg-black/80 z-45"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="absolute bottom-0 left-0 right-0 h-[80%] bg-[#0F172A] border-t border-slate-800 rounded-t-3xl p-4 flex flex-col z-50 text-slate-100 font-sans"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    <div>
                      <h4 className="text-xs font-black text-slate-100">សាលា AI ជំនួយការឆ្លាតវៃ</h4>
                      <p className="text-[8.5px] text-[#E2C785] mt-0.5">គ្របដណ្តប់ដោយ Gemini Model</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAiHelper(false)} className="p-1 hover:bg-slate-850 rounded text-slate-400">
                    <X size={16} />
                  </button>
                </div>

                {/* History container */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-[9.5px]">
                  {aiHistory.map((item, index) => (
                    <div key={index} className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                        item.sender === 'user' 
                          ? 'bg-[#E2C785] text-slate-900 font-medium rounded-br-none'
                          : 'bg-[#1E293B] text-slate-100 rounded-bl-none border border-slate-800'
                      }`}>
                        {item.text}
                      </div>
                    </div>
                  ))}
                  {isAiTyping && (
                    <div className="flex items-center gap-1.5 text-[8.5px] text-[#E2C785] font-semibold animate-pulse">
                      <span>🔄 កំពុងពិចារណាចម្លើយ...</span>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendAi()}
                    placeholder="សួរសំណួរអំពីសាលា ដូចជា សិស្ស ឬ នាយកសាលា..."
                    className="bg-transparent border-none text-[8.5px] text-slate-100 placeholder-slate-500 flex-1 outline-none px-2"
                  />
                  <button
                    onClick={handleSendAi}
                    className="p-1.5 bg-[#E2C785] text-slate-950 rounded-lg hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Send size={11} className="stroke-[2.5]" />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 5. Drawer System Options menu: Export, settings, logging out */}
        <AnimatePresence>
          {showMenuOverlay && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMenuOverlay(false)}
                className="absolute inset-0 bg-black/80 z-45"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="absolute inset-y-0 right-0 w-[80%] bg-[#0F172A] border-l border-slate-800 p-4 flex flex-col z-50 text-slate-100 font-sans"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 shrink-0">
                  <h4 className="text-xs font-bold text-white">⚙️ ផ្ទាំងមឺនុយប្រព័ន្ធ</h4>
                  <button onClick={() => setShowMenuOverlay(false)} className="p-1 hover:bg-slate-850 rounded text-slate-500">
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto">
                  {/* Account profile card */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                      {currentUser?.photoCode}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-200">{currentUser?.name}</p>
                      <p className="text-[8.5px] text-slate-500 mt-0.5">{currentUser?.role === 'principal' ? 'នាយកសាលា' : `គ្រូបន្ទុកថ្នាក់ ${currentUser?.grade}`}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] text-[#E2C785] font-black tracking-widest uppercase">ឧបករណ៍បញ្ជា</p>
                    
                    {/* Return to Desktop Mode preview */}
                    <button
                      onClick={() => {
                        setShowMenuOverlay(false);
                        showToast('ℹ️ លោកគ្រូ-អ្នកគ្រូ កំពុងសាកល្បងមុខងារទូរស័ព្ទដៃគំរូនៃប្រព័ន្ធគ្រប់គ្រងសាលារៀន។');
                      }}
                      className="w-full p-2.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 border border-blue-900/20 flex items-center justify-between text-[9.5px] font-bold"
                    >
                      <span className="flex items-center gap-2">📱 មុខងារទូរស័ព្ទដៃ VIP</span>
                      <span className="text-[8px] text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded">សកម្ម</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] text-[#E2C785] font-black tracking-widest uppercase">ទិន្នន័យ & សមទិន្នន័យ (Cloud Engine)</p>
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                      <p className="text-[8.5px] text-slate-400 leading-normal">
                        លោកអ្នកអាចនាំចូល ឬចម្លងទិន្នន័យសាលាពីឧបករណ៍ផ្សេងបានតាមឯកសារ JSON។
                      </p>
                      <div className="grid grid-cols-1 gap-2 pt-1.5">
                        <button
                          onClick={onLogoutClick}
                          className="p-2 bg-red-600/20 text-red-400 border border-red-500/10 hover:bg-slate-800 text-[9.5px] rounded-lg font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Power size={11} /> 🔑 ចាកចេញពីគណនី
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 text-center text-[8px] text-slate-550 shrink-0 uppercase tracking-widest font-mono">
                  School management system v2.0
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
