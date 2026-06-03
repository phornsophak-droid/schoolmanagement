import React, { useState } from 'react';
import { SchoolUser } from '../types';
import { 
  KeyRound, 
  ShieldAlert, 
  Users, 
  GraduationCap, 
  Lock, 
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginPortalProps {
  onLoginSuccess: (user: SchoolUser) => void;
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
  }
];

export default function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [selectedUser, setSelectedUser] = useState<SchoolUser | null>(null);
  const [pinCode, setPinCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);

  const handleSelectUser = (user: SchoolUser) => {
    setSelectedUser(user);
    setPinCode('');
    setErrorMsg('');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Security Rules: Principal has code '1111', Teachers have code '1234'
    const correctPin = selectedUser.role === 'principal' ? '1111' : '1234';

    if (pinCode === correctPin) {
      onLoginSuccess(selectedUser);
    } else {
      setErrorMsg('លេខកូដសម្ងាត់មិនត្រឹមត្រូវទេ! (នាយក: 1111, លោកគ្រូ-អ្នកគ្រូ: 1234)');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex items-center justify-center p-4 md:p-8 w-full">
      {/* Container Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* Left Aspect: Majestic Greeting & Instruction Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-8 flex flex-col justify-between text-white relative">
          
          {/* Slogan details of Kingdom of Cambodia with visual crest decoration */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🇰🇭</span>
              <div>
                <h4 className="text-xs font-bold tracking-widest text-blue-400 uppercase">ព្រះរាជាណាចក្រកម្ពុជា</h4>
                <p className="text-[9px] font-semibold text-slate-400 tracking-wider">ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-850">
              <h1 className="text-lg font-bold font-serif leading-snug">សាលាសហគមន៍ច្បារច្រុះ</h1>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស និងរបាយការណ៍សាលារៀនប្រចាំខែ។
              </p>
            </div>
          </div>

          <div className="space-y-4 mt-8 md:mt-0 p-4 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={12} />
              ព័ត៌មានគណនីគំរូសាកល្បង៖
            </h5>
            <div className="text-[10px] text-slate-350 space-y-2 leading-relaxed">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>🔑 គណនីនាយកសាលា៖</span>
                <span className="font-bold text-white font-mono bg-amber-500/25 px-1.5 py-0.2 rounded">PIN: 1111</span>
              </div>
              <div className="flex justify-between">
                <span>🔑 គណនីគ្រូបង្រៀន (ថ្នាក់១-៦)៖</span>
                <span className="font-bold text-white font-mono bg-blue-500/25 px-1.5 py-0.2 rounded">PIN: 1234</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] italic mt-1 font-medium">
                *លោកគ្រូ-អ្នកគ្រូនីមួយៗមានគណនីដាច់ដោយឡែក។ របាយការណ៍សរុបមានតែនាយកសាលាដែលមានសិទ្ធចូលមើល និងកំណត់។
              </p>
            </div>
          </div>
        </div>

        {/* Right Aspect: User Profile selection state / login step */}
        <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center bg-slate-50">
          
          {!selectedUser ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="text-blue-600" size={20} />
                  ជ្រើសរើសគណនីដើម្បីចូលប្រព័ន្ធ
                </h2>
                <p className="text-xs text-slate-500 mt-1">សូមជ្រើសរើសតួនាទី ឬថ្នាក់របស់អ្នកបង្រៀនខាងក្រោម ដើម្បីបន្ត៖</p>
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
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">នាយកសាលា</span>
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
                    </div>
                  </button>
                ))}

              </div>
            </div>
          ) : (
            // Back to selection and dynamic security token check
            <div className="space-y-6 max-w-sm mx-auto w-full">
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 hover:underline transition-colors mb-2"
              >
                ← ចាកចេញ ទៅជ្រើសរើសគណនីឡើងវិញ
              </button>

              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-center relative overflow-hidden">
                <div className={`w-14 h-14 rounded-full mx-auto ${selectedUser.avatarBg} flex items-center justify-center text-white text-sm font-bold shadow-md mb-3`}>
                  {selectedUser.photoCode}
                </div>
                <h3 className="text-sm font-bold text-slate-805 leading-tight">{selectedUser.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedUser.role === 'principal' ? 'នាយកសាលាសហគមន៍' : `គ្រូបន្ទុកថ្នាក់ ${selectedUser.grade}`}
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex justify-between">
                    <span>បញ្ចូលលេខកូដសម្ងាត់ (PIN)</span>
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
                  ផ្ទៀងផ្ទាត់ និងចូលគណនី
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
