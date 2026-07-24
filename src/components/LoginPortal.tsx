import React, { useState } from 'react';
import { SchoolUser } from '../types';
import { useT, LanguageToggle } from '../i18n';
import { getPinForUser, setPinForUser } from '../utils/auth';
import { syncUpsertSetting, syncGradesBulk } from '../lib/supabase';
import { SchoolLogo } from './SchoolLogo';
import { 
  KeyRound, 
  ShieldAlert, 
  Users, 
  GraduationCap, 
  Lock, 
  ChevronRight,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

interface LoginPortalProps {
  onLoginSuccess: (user: SchoolUser) => void;
  onParentAccess?: () => void;
  // Student online-test portal (no login) — opens the join-code screen.
  onStudentTest?: () => void;
}

export const AVAILABLE_USERS: SchoolUser[] = [
  {
    id: 'principal',
    name: 'លោកនាយក ផន សុភាក់',
    role: 'principal',
    grade: 'ទាំងអស់',
    photoCode: 'ផស',
    avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-500'
  },
  {
    id: 'teacher_preschool1',
    name: 'អ្នកគ្រូ យាប់ សុខ',
    role: 'teacher',
    grade: 'មត្តេយ្យ ១',
    photoCode: 'យស',
    avatarBg: 'bg-gradient-to-tr from-violet-600 to-pink-500'
  },
  {
    id: 'teacher_preschool2',
    name: 'អ្នកគ្រូ ច្រឹល កែវ',
    role: 'teacher',
    grade: 'មត្តេយ្យ ២',
    photoCode: 'ចក',
    avatarBg: 'bg-gradient-to-tr from-pink-600 to-rose-500'
  },
  {
    id: 'teacher_g1a',
    name: 'លោកគ្រូ ជឹម អ៊ន',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ១ក',
    photoCode: 'ជអ',
    avatarBg: 'bg-gradient-to-tr from-blue-600 to-sky-500'
  },
  {
    id: 'teacher_g1b',
    name: 'អ្នកគ្រូ រ៉ន គឹមលៀង',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ១ខ',
    photoCode: 'រក',
    avatarBg: 'bg-gradient-to-tr from-purple-600 to-pink-500'
  },
  {
    id: 'teacher_g2a',
    name: 'លោកគ្រូ ហុង ហ៊ីម',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ២ក',
    photoCode: 'ហហ',
    avatarBg: 'bg-gradient-to-tr from-rose-600 to-orange-500'
  },
  {
    id: 'teacher_g2b',
    name: 'លោកគ្រូ ហុង ហ៊ីម',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ២ខ',
    photoCode: 'ហហ',
    avatarBg: 'bg-gradient-to-tr from-rose-600 to-orange-500'
  },
  {
    id: 'teacher_g3a',
    name: 'លោកគ្រូ ឆន ក្រឹម',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៣ក',
    photoCode: 'ឆក',
    avatarBg: 'bg-gradient-to-tr from-amber-600 to-yellow-500'
  },
  {
    id: 'teacher_g3b',
    name: 'លោកគ្រូ ឆន ក្រឹម',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៣ខ',
    photoCode: 'ឆក',
    avatarBg: 'bg-gradient-to-tr from-amber-600 to-yellow-500'
  },
  {
    id: 'teacher_g4a',
    name: 'លោកគ្រូ សាត គ្រី',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៤ក',
    photoCode: 'សគ',
    avatarBg: 'bg-gradient-to-tr from-teal-600 to-emerald-500'
  },
  {
    id: 'teacher_g4b',
    name: 'លោកគ្រូ ថាវ សុផាត',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៤ខ',
    photoCode: 'ថស',
    avatarBg: 'bg-gradient-to-tr from-sky-600 to-indigo-500'
  },
  {
    id: 'teacher_g5a',
    name: 'លោកគ្រូ គឺ អ៊ុនតាក់',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៥ក',
    photoCode: 'គអ',
    avatarBg: 'bg-gradient-to-tr from-violet-600 to-indigo-500'
  },
  {
    id: 'teacher_g5b',
    name: 'លោកគ្រូ ចែម ណាក់',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៥ខ',
    photoCode: 'ចណ',
    avatarBg: 'bg-gradient-to-tr from-pink-600 to-red-500'
  },
  {
    id: 'teacher_g6',
    name: 'លោកគ្រូ ស៊ុំ សំណាង',
    role: 'teacher',
    grade: 'ថ្នាក់ទី ៦',
    photoCode: 'សស',
    avatarBg: 'bg-gradient-to-tr from-pink-600 to-red-500'
  },
  {
    id: 'teacher_english',
    name: 'លោកគ្រូ យ៉ន យ៉ាវ',
    role: 'teacher',
    grade: 'ថ្នាក់ភាសាអង់គ្លេស',
    photoCode: 'យយ',
    avatarBg: 'bg-gradient-to-tr from-cyan-600 to-teal-500'
  },
  {
    id: 'teacher_drawing',
    name: 'អ្នកគ្រូ នី ចន្ទី',
    role: 'teacher',
    grade: 'ថ្នាក់គំនូរ',
    photoCode: 'នជ',
    avatarBg: 'bg-gradient-to-tr from-fuchsia-600 to-pink-500'
  },
  {
    id: 'teacher_sports',
    name: 'លោកគ្រូ គឺ អ៊ុនតាក់',
    role: 'teacher',
    grade: 'ថ្នាក់កីឡា និងអប់រំកាយ',
    photoCode: 'គអ',
    avatarBg: 'bg-gradient-to-tr from-emerald-600 to-emerald-400'
  },
  {
    id: 'teacher_health',
    name: 'អ្នកគ្រូ ហេង គីមឡាង',
    role: 'teacher',
    grade: 'ថ្នាក់អប់រំសុខភាព',
    photoCode: 'ហគ',
    avatarBg: 'bg-gradient-to-tr from-sky-600 to-sky-300'
  },
  {
    id: 'librarian',
    name: 'បណ្ណារក្ស',
    role: 'teacher',
    grade: 'បណ្ណាល័យ',
    photoCode: 'បណ',
    avatarBg: 'bg-gradient-to-tr from-cyan-600 to-blue-500'
  }
];

// Load any dynamically added custom users
try {
  const customUsersStr = localStorage.getItem('school_custom_users');
  if (customUsersStr) {
    const customUsers = JSON.parse(customUsersStr);
    if (Array.isArray(customUsers)) {
      AVAILABLE_USERS.push(...customUsers);
    }
  }
} catch (e) {
  console.error('Failed to load custom users', e);
}

export default function LoginPortal({ onLoginSuccess, onParentAccess, onStudentTest }: LoginPortalProps) {
  const { t } = useT();
  const [selectedUser, setSelectedUser] = useState<SchoolUser | null>(null);
  const [pinCode, setPinCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newPinCode, setNewPinCode] = useState('1234');
  // Category for the new class: 'general' (មត្តេយ្យ–ទី៦) or 'extra' (after-hours skill classes).
  const [newClassCategory, setNewClassCategory] = useState<'general' | 'extra'>('general');
  // Group within an after-hours subject (e.g. ភាសាអង់គ្លេស 3A, 3B, 4A ...).
  const [newClassGroup, setNewClassGroup] = useState('1A');
  // Known after-hours subjects — chosen from a list so the name always classifies as "extra".
  const EXTRA_CLASS_OPTIONS = ['ថ្នាក់ភាសាអង់គ្លេស', 'ថ្នាក់គំនូរ', 'ថ្នាក់កុំព្យូទ័រ', 'ថ្នាក់កីឡា និងអប់រំកាយ', 'ថ្នាក់អប់រំសុខភាព'];
  // Group options (grades 1–6, sections A & B) for after-hours classes.
  const EXTRA_GROUP_OPTIONS = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];

  const handleSelectUser = (user: SchoolUser) => {
    setSelectedUser(user);
    setPinCode('');
    setErrorMsg('');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const correctPin = getPinForUser(selectedUser.id, selectedUser.role);

    if (pinCode === correctPin) {
      onLoginSuccess(selectedUser);
    } else {
      setErrorMsg(t('login.wrongPin'));
    }
  };

  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For extra classes, the final class name combines the subject + the group (e.g. "ថ្នាក់ភាសាអង់គ្លេស 3A").
    const cleanClass = (newClassCategory === 'extra' && newClassGroup)
      ? `${newClassName.trim()} ${newClassGroup}`.trim()
      : newClassName.trim();
    const cleanTeacher = newTeacherName.trim();
    if (!cleanClass || !cleanTeacher) return;

    const newId = 'teacher_custom_' + Date.now();
    
    // Generate initials for photoCode
    const code = cleanTeacher.split(' ').map(w => w[0]).join('').substring(0, 2) || 'គព';

    const newUser: SchoolUser = {
      id: newId,
      name: cleanTeacher,
      role: 'teacher',
      grade: cleanClass,
      photoCode: code,
      avatarBg: 'bg-gradient-to-tr from-indigo-500 to-purple-500' // Default purple gradient
    };

    // Add to current session
    AVAILABLE_USERS.push(newUser);

    // Persist to localStorage
    const savedStr = localStorage.getItem('school_custom_users');
    let savedUsers = savedStr ? JSON.parse(savedStr) : [];
    if (!Array.isArray(savedUsers)) savedUsers = [];
    savedUsers.push(newUser);
    localStorage.setItem('school_custom_users', JSON.stringify(savedUsers));
    syncUpsertSetting('school_custom_users', savedUsers).catch(console.error);

    // Also register the new class in the global grades list so it shows up across
    // every page (Dashboard, scores, attendance, reports, class management).
    try {
      const gradesStr = localStorage.getItem('school_grades_v2');
      let gradesArr = gradesStr ? JSON.parse(gradesStr) : [];
      if (!Array.isArray(gradesArr)) gradesArr = [];
      if (!gradesArr.includes(cleanClass)) {
        gradesArr.push(cleanClass);
        localStorage.setItem('school_grades_v2', JSON.stringify(gradesArr));
        syncGradesBulk(gradesArr).catch(console.error);
      }
    } catch (err) {
      console.error('Failed to register new class grade', err);
    }

    // Save custom PIN if provided
    if (newPinCode && newPinCode !== '1234') {
        setPinForUser(newId, newPinCode);
    }

    // Reset and close
    setIsAddClassOpen(false);
    setNewClassName('');
    setNewTeacherName('');
    setNewPinCode('1234');
    setNewClassCategory('general');
    setNewClassGroup('1A');
  };

  const handleDeleteCustomUser = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("តើលោកអ្នកពិតជាចង់លុបគណនីគ្រូនេះមែនទេ? (គណនីដែលបានលុប នឹងមិនអាចត្រឡប់វិញបានទេ)")) return;
    
    // Remove from AVAILABLE_USERS array
    const index = AVAILABLE_USERS.findIndex(u => u.id === id);
    if (index > -1) {
      AVAILABLE_USERS.splice(index, 1);
    }
    
    // Remove from localStorage and Cloud
    const savedStr = localStorage.getItem('school_custom_users');
    if (savedStr) {
      let savedUsers = JSON.parse(savedStr);
      if (Array.isArray(savedUsers)) {
        savedUsers = savedUsers.filter((u: any) => u.id !== id);
        localStorage.setItem('school_custom_users', JSON.stringify(savedUsers));
        syncUpsertSetting('school_custom_users', savedUsers).catch(console.error);
      }
    }
    
    forceUpdate();
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex items-center justify-center p-4 md:p-8 w-full">
      {/* Container Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* Left Aspect: Majestic Greeting & Instruction Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-8 flex flex-col justify-between text-white relative">
          
          {/* Slogan details of Kingdom of Cambodia with visual crest decoration */}
          <div className="space-y-4">
            <div className="w-28 h-28 rounded-2xl bg-white shadow-lg flex items-center justify-center overflow-hidden">
              <SchoolLogo className="w-full h-full p-1.5" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🇰🇭</span>
              <div>
                <h4 className="text-xs font-bold tracking-widest text-blue-400 uppercase">{t('login.kingdom')}</h4>
                <p className="text-[9px] font-semibold text-slate-400 tracking-wider">{t('login.motto')}</p>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-850">
              <h1 className="text-lg font-bold font-serif leading-snug">{t('common.school')}</h1>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                {t('login.welcome')}
              </p>
            </div>
          </div>

          <div className="space-y-4 mt-8 md:mt-0 p-4 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={12} />
              {t('login.sampleAccounts')}
            </h5>
            <div className="text-[10px] text-slate-350 space-y-2 leading-relaxed">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>{t('login.principalAccount')}</span>
                <span className="font-bold text-white font-mono bg-amber-500/25 px-1.5 py-0.2 rounded">PIN: 1111</span>
              </div>
              <div className="flex justify-between">
                <span>{t('login.teacherAccount')}</span>
                <span className="font-bold text-white font-mono bg-blue-500/25 px-1.5 py-0.2 rounded">PIN: 1234</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] italic mt-1 font-medium">
                {t('login.accountNote')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Aspect: User Profile selection state / login step */}
        <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center bg-slate-50 relative">
          <LanguageToggle className="absolute top-3 right-3 border-slate-200 text-slate-600 bg-white hover:bg-slate-100" />

          {!selectedUser ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="text-blue-600" size={20} />
                  {t('login.selectAccount')}
                </h2>
                <p className="text-xs text-slate-500 mt-1">{t('login.selectHint')}</p>
              </div>

              {/* Scrollable list of available profiles to switch between */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                
                {/* Principal user element */}
                <button
                  onClick={() => handleSelectUser(AVAILABLE_USERS[0])}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm text-left transition-all duration-150 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                      {AVAILABLE_USERS[0].photoCode}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">{t('login.principalBadge')}</span>
                      <h3 className="text-xs font-bold text-slate-800 mt-1 truncate group-hover:text-amber-700">{AVAILABLE_USERS[0].name}</h3>
                    </div>
                  </div>
                </button>

                {/* Teacher elements */}
                {AVAILABLE_USERS.slice(1).map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => handleSelectUser(teacher)}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs text-left transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {teacher.photoCode}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">{teacher.grade}</span>
                        <h3 className="text-xs font-semibold text-slate-800 mt-1 truncate group-hover:text-blue-600">{teacher.name}</h3>
                      </div>
                      
                      {/* Delete button for custom users */}
                      {teacher.id.startsWith('teacher_custom_') && (
                        <button
                          onClick={(e) => handleDeleteCustomUser(teacher.id, e)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title={t('login.deleteAccount')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </button>
                ))}

              </div>
              
              {/* Add New Class Button */}
              <div className="pt-2 border-t border-slate-200/60 flex justify-center">
                <button
                  onClick={() => setIsAddClassOpen(true)}
                  className="px-4 py-2 border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <span>+</span>
                  <span>{t('login.addClass')}</span>
                </button>
              </div>

              {/* Parent access — view/download a child's report card (no login) */}
              {onParentAccess && (
                <div className="pt-3 mt-1 border-t border-slate-200/60 flex justify-center gap-2 flex-wrap">
                  <button
                    onClick={onParentAccess}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
                  >
                    <Users size={15} />
                    <span>{t('login.parentAccess')}</span>
                  </button>
                  {onStudentTest && (
                    <button
                      onClick={onStudentTest}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md"
                    >
                      <span>📝</span>
                      <span>{t('login.studentTest')}</span>
                    </button>
                  )}
                </div>
              )}

            </div>
          ) : (
            // Back to selection and dynamic security token check
            <div className="space-y-6 max-w-sm mx-auto w-full">
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 hover:underline transition-colors mb-2"
              >
                {t('login.backToSelect')}
              </button>

              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-center relative overflow-hidden">
                <div className={`w-14 h-14 rounded-full mx-auto ${selectedUser.avatarBg} flex items-center justify-center text-white text-sm font-bold shadow-md mb-3`}>
                  {selectedUser.photoCode}
                </div>
                <h3 className="text-sm font-bold text-slate-805 leading-tight">{selectedUser.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedUser.role === 'principal' ? t('login.principalRole') : `${t('login.teacherRole')} ${selectedUser.grade}`}
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex justify-between">
                    <span>{t('login.enterPin')}</span>
                    <span className="text-slate-400 text-[10px] font-medium font-mono">
                      ({selectedUser.role === 'principal' ? 'PIN: 1111' : 'PIN: 1234'})
                    </span>
                  </label>
                  
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => {
                        setPinCode(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="• • • •"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-mono text-center tracking-[0.75em] text-lg font-bold outline-none focus:border-blue-500 transition-all text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2 text-[11px] text-rose-700 font-medium">
                    <ShieldAlert size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1 group"
                >
                  <Lock size={12} className="group-hover:scale-95 transition-transform" />
                  {t('login.verify')}
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </form>
            </div>
          )}

        </div>

      </div>

      {/* Add Custom Class Modal */}
      {isAddClassOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                {t('login.addClassModal')}
              </h3>
              <button 
                onClick={() => setIsAddClassOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddClassSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('login.classType')}</label>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setNewClassCategory('general'); setNewClassName(''); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${newClassCategory === 'general' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    {t('login.catGeneral')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewClassCategory('extra'); setNewClassName(EXTRA_CLASS_OPTIONS[0]); setNewClassGroup('1A'); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${newClassCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    {t('login.catExtra')}
                  </button>
                </div>
              </div>
              {newClassCategory === 'extra' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('login.subjectGroup')}</label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={newClassName}
                      onChange={e => setNewClassName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      {EXTRA_CLASS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <select
                      required
                      value={newClassGroup}
                      onChange={e => setNewClassGroup(e.target.value)}
                      className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                    >
                      {EXTRA_GROUP_OPTIONS.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('login.classNameLabel')} <span className="font-bold text-indigo-600">{newClassName} {newClassGroup}</span>
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('login.classNameField')}</label>
                  <input
                    type="text"
                    placeholder={t('login.classNamePlaceholder')}
                    required
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('login.teacherNameField')}</label>
                <input
                  type="text"
                  placeholder={t('login.teacherNamePlaceholder')}
                  required
                  value={newTeacherName}
                  onChange={e => setNewTeacherName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('login.setPin')}</label>
                <input
                  type="text"
                  placeholder="1234"
                  value={newPinCode}
                  onChange={e => setNewPinCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t('login.pinDefault')}</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors"
                >
                  {t('login.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  {t('login.addClassModal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
