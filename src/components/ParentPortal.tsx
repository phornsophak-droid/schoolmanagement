/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, FileText, Loader2, GraduationCap, Award, ExternalLink, Monitor } from 'lucide-react';
import { CURATED_ELIBRARY, fetchELinksFromCloud, ELink } from '../lib/library';
import { useT, LanguageToggle } from '../i18n';
import { StudentScore } from '../types';
import { fetchClassStudents, fetchSetting, fetchStudentDobByName } from '../lib/supabase';
import { semesterAvgOf, readAnnualExtra } from '../utils/scoring';
import SchoolLogo from './SchoolLogo';
import { PRINCIPAL_SIG_KEY } from './PrincipalSignature';
import { teacherSigKey } from './TeacherSignature';
import StudentReportCard from './StudentReportCard';
import SemesterReportCard from './SemesterReportCard';
import MeritCertificate from './MeritCertificate';
import TimetableView from './TimetableView';
import { Timetable, emptyTimetable, loadTimetable, isTimetableEmpty } from '../lib/timetable';
import LearningGames from './LearningGames';
import KhmerCalendar from './KhmerCalendar';
import ParentLogin from './ParentLogin';
import { ParentSession, loadSession, clearSession, changeParentPassword, normParentName } from '../lib/parentAuth';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
// Merit certificate is awarded for និទ្ទេស A (≥9) or B (≥8) only.
const meritLetterOf = (v: number | null | undefined): '' | 'A' | 'B' =>
  (v == null || v <= 0) ? '' : v >= 9 ? 'A' : v >= 8 ? 'B' : '';

interface ParentPortalProps {
  grades: string[];
  onBack: () => void;
  // Opens the online standardized-test portal (StudentQuiz) — students/parents
  // reach the test from here too, not only from the login page.
  onStudentTest?: () => void;
}

const EXTRA_CLASS_KEYWORDS = ['GRADE','គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));

// Khmer school-year month order, for sorting the months a child has records in.
const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

// Inline "change my password" box shown after login (parent sets a personal one).
function ChangePasswordBox({ session, onDone }: { session: ParentSession; onDone: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (p1.length < 4) { setMsg('លេខសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួ។'); return; }
    if (p1 !== p2) { setMsg('លេខសម្ងាត់មិនដូចគ្នា។'); return; }
    setBusy(true);
    try { await changeParentPassword({ name: session.name, grade: session.grade, studentId: session.studentId }, p1); setMsg('រក្សាទុករួច ✓'); setTimeout(onDone, 800); }
    catch { setMsg('បរាជ័យ។ សូមព្យាយាមម្ដងទៀត។'); }
    finally { setBusy(false); }
  };
  return (
    <div className="mb-3 p-3 rounded-2xl bg-white border border-emerald-100 shadow-sm space-y-2">
      <input type="password" value={p1} onChange={e => { setP1(e.target.value); setMsg(''); }} placeholder="លេខសម្ងាត់ថ្មី" className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
      <input type="password" value={p2} onChange={e => { setP2(e.target.value); setMsg(''); }} placeholder="បញ្ជាក់លេខសម្ងាត់ថ្មី" className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
      {msg && <p className="text-[11px] font-semibold text-slate-500">{msg}</p>}
      <button onClick={save} disabled={busy} className="w-full py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl disabled:opacity-60">រក្សាទុក</button>
    </div>
  );
}

export default function ParentPortal({ grades, onBack, onStudentTest }: ParentPortalProps) {
  const { t, lang } = useT();
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>('general');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classStudents, setClassStudents] = useState<StudentScore[]>([]);
  const [timetable, setTimetable] = useState<Timetable>(emptyTimetable());
  // Mobile-Portal style: nothing is expanded until a tile is tapped.
  const [activePanel, setActivePanel] = useState<'results' | 'elibrary' | 'learning-games' | 'calendar' | null>(null);
  // Parent login: the whole portal is gated. Once logged in, the view is scoped
  // to this one child (their general class), so no class/name picker is shown.
  const [session, setSession] = useState<ParentSession | null>(loadSession);
  const [showChangePass, setShowChangePass] = useState(false);
  const [schoolElinks, setSchoolElinks] = useState<ELink[]>([]);
  useEffect(() => { fetchELinksFromCloud().then(setSchoolElinks).catch(() => {}); }, []);
  const [nameQuery, setNameQuery] = useState('');
  const [childName, setChildName] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameMatches, setNameMatches] = useState<string[]>([]);

  // Open-card state
  const [monthlyRec, setMonthlyRec] = useState<StudentScore | null>(null);
  const [semCard, setSemCard] = useState<{ student: StudentScore; period: 1 | 2 | 'year' } | null>(null);
  const [meritCard, setMeritCard] = useState<{ student: StudentScore; score: number | null; phrase: string } | null>(null);

  // Pull the principal signature once so it shows on the report cards parents open.
  useEffect(() => {
    fetchSetting(PRINCIPAL_SIG_KEY)
      .then(v => { if (v) { try { localStorage.setItem(PRINCIPAL_SIG_KEY, v); } catch { /* ignore */ } } })
      .catch(() => { /* offline */ });
  }, []);

  // Fetch ONLY the selected class (low egress) when a parent picks it.
  const loadClass = async (g: string) => {
    setGrade(g);
    setChildName('');
    setNameQuery('');
    setNameError('');
    setNameMatches([]);
    setError('');
    setClassStudents([]);
    setTimetable(emptyTimetable());
    if (!g) return;
    // Class timetable (shared per class) — shown read-only to parents.
    loadTimetable(g).then(setTimetable).catch(() => setTimetable(emptyTimetable()));
    // Pull this class's teacher signature so it shows on the report cards.
    fetchSetting(teacherSigKey(g))
      .then(v => { if (v) { try { localStorage.setItem(teacherSigKey(g), v); } catch { /* ignore */ } } })
      .catch(() => { /* offline */ });
    setLoading(true);
    try {
      const rows = await fetchClassStudents(g);
      setClassStudents(rows);
      if (rows.length === 0) setError(t('parent.err.noClassData'));
    } catch {
      setError(t('parent.err.fetch'));
    } finally {
      setLoading(false);
    }
  };

  // Distinct child names in the class (one student may have many monthly rows).
  const childNames = useMemo(
    () => Array.from(new Set<string>(classStudents.map(s => s.name.trim()))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'km')),
    [classStudents]
  );

  // Logged-in scoping: load the child's class and open the results panel.
  useEffect(() => {
    if (session) { setActivePanel('results'); loadClass(session.grade); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.grade, session?.name]);
  // Once the class is loaded, lock the child name to the logged-in child.
  useEffect(() => {
    if (session && classStudents.length && !childName) {
      const m = classStudents.find(s => normParentName(s.name) === normParentName(session.name));
      if (m) setChildName(m.name.trim());
    }
  }, [session, classStudents, childName]);
  // Parents type their child's name themselves (the class roster is never shown,
  // for privacy). Match the typed name against the class: exact first, then a
  // loose contains; show the few candidates only when several match.
  // Strip zero-width / bidi characters (Khmer text pasted from other apps often
  // carries them), collapse spaces, lowercase — so an invisible char or spacing
  // difference can't hide a real match.
  const normalize = (s: string) => (s || '')
    .replace(/[​‌‍‎‏⁠﻿]/g, '')
    // Colon-like signs parents type interchangeably — the Khmer yuukaleapintu
    // ៈ (U+17C8), camnuc-pii-kuuh ៖ (U+17D6), ASCII ":" and fullwidth "：" all
    // look alike, so drop them entirely to compare on the letters alone.
    .replace(/[ៈ៖:：]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const confirmName = (typed?: string) => {
    const q = normalize(typed ?? nameQuery);
    setNameError('');
    setNameMatches([]);
    setChildName('');
    if (!q) return;
    let result = childNames.filter(n => normalize(n) === q);
    if (result.length === 0) result = childNames.filter(n => normalize(n).includes(q));
    if (result.length === 0) {
      // Token match — every typed word must appear in the name (order/spacing
      // independent), so "វិៈបុត្រ ឡាំ" or a partial name still finds the child.
      const toks = q.split(' ').filter(t => t.length >= 2);
      if (toks.length) result = childNames.filter(n => { const nn = normalize(n); return toks.every(t => nn.includes(t)); });
    }
    if (result.length === 0) {
      // Last resort — drop the Khmer signs parents often type inconsistently
      // (ៈ U+17C8, ៉/៊ register shifters) so e.g. "វិៈបុត្រ" matches "វិបុត្រ".
      const strip = (s: string) => normalize(s).replace(/[ៈ៉៊]/g, '');
      const sq = strip(q);
      if (sq.length >= 2) {
        const toks = sq.split(' ').filter(t => t.length >= 2);
        result = childNames.filter(n => { const nn = strip(n); return nn.includes(sq) || (toks.length > 0 && toks.every(t => nn.includes(t))); });
      }
    }
    if (result.length === 0) {
      // Subsequence (both directions) — the typed text and the stored name share
      // their letters in order, tolerating one side having an EXTRA or MISSING
      // letter (e.g. parent types "វិរៈបុត្រ" but it's stored "វិៈបុត្រ", or vice
      // versa). Bidirectional so it works whichever spelling is longer.
      const nq = normalize(q).replace(/\s/g, '');
      const isSubseq = (a: string, b: string) => { let i = 0; for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++; return i === a.length; };
      if (nq.length >= 3) result = childNames.filter(n => { const nn = normalize(n).replace(/\s/g, ''); return nn.length >= 3 && (isSubseq(nq, nn) || isSubseq(nn, nq)); });
    }
    if (result.length === 0) {
      setNameError(t('parent.err.noName'));
      return;
    }
    if (result.length === 1) { setChildName(result[0]); return; }
    setNameMatches(result);
  };

  const childRecords = useMemo(
    () => classStudents.filter(s => s.name.trim() === childName),
    [classStudents, childName]
  );
  const anyRec = childRecords[0];

  // After-hours classes load only their own rows, but the date of birth lives on
  // the child's general-class row. Fetch it by name so the merit certificate and
  // report cards still show it (general classes already carry the dob locally).
  const [childDob, setChildDob] = useState('');
  useEffect(() => {
    setChildDob('');
    if (!childName || childRecords.some(r => r.dob)) return;
    let cancelled = false;
    fetchStudentDobByName(childName)
      .then(dob => { if (!cancelled && dob) setChildDob(dob); })
      .catch(() => { /* offline — dob just stays blank */ });
    return () => { cancelled = true; };
  }, [childName, childRecords]);

  // The dob resolves via a matching name in the students list passed to the cards,
  // so inject a lightweight row carrying the fetched dob when it isn't already present.
  const studentsForCards = useMemo(
    () => (childDob && anyRec ? [...classStudents, { ...anyRec, dob: childDob }] : classStudents),
    [classStudents, childDob, anyRec]
  );

  // Months this child has a (non-exam) report card for, in school-year order.
  const monthsAvailable = useMemo(() => {
    const months = Array.from(new Set<string>(childRecords.map(r => r.month)))
      .filter(m => m && !m.startsWith('ប្រឡង'));
    return months.sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
  }, [childRecords]);

  // Periods this child earned និទ្ទេស A or B in → a ប័ណ្ណសរសើរ (merit certificate)
  // can be issued for each. Scores mirror the report cards: monthly overallAvg,
  // semester = (exam + monthly)/2, year = 80% academic + skills + conduct.
  const meritOptions = useMemo(() => {
    if (!childName || !anyRec) return [] as { key: string; label: string; student: StudentScore; score: number; phrase: string }[];
    const opts: { key: string; label: string; student: StudentScore; score: number; phrase: string }[] = [];
    monthsAvailable.forEach(m => {
      const rec = childRecords.find(r => r.month === m);
      const score = rec?.overallAvg ?? null;
      const l = meritLetterOf(score);
      if (rec && l) opts.push({ key: `m-${m}`, label: `${t('parent.monthPrefix')}${t('month.' + m)} (${l})`, student: rec, score: score!, phrase: `ប្រចាំខែ${m} ឆ្នាំសិក្សា ២០២៥-២០២៦` });
    });
    ([1, 2] as const).forEach(sem => {
      const score = semesterAvgOf(childRecords, sem);
      const l = meritLetterOf(score);
      if (l) opts.push({ key: `s-${sem}`, label: `${t('parent.sem' + sem)} (${l})`, student: anyRec, score: score!, phrase: `ប្រចាំ​ឆមាសទី ${toKh(sem)} ឆ្នាំសិក្សា ២០២៥-២០២៦` });
    });
    const semAvgs = [semesterAvgOf(childRecords, 1), semesterAvgOf(childRecords, 2)].filter((v): v is number => v !== null && v !== undefined);
    const annualRaw = semAvgs.length ? semAvgs.reduce((a, b) => a + b, 0) / semAvgs.length : null;
    const ex = readAnnualExtra(anyRec.grade, childName);
    const yearScore = annualRaw !== null ? annualRaw * 0.8 + 0.1 * ex.skills + 0.1 * ex.conduct : null;
    const yl = meritLetterOf(yearScore);
    if (yl) opts.push({ key: 'year', label: `${t('parent.annual')} (${yl})`, student: anyRec, score: yearScore!, phrase: `ប្រចាំឆ្នាំសិក្សា ២០២៥-២០២៦` });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childName, anyRec, childRecords, monthsAvailable, lang]);

  const filteredGrades = useMemo(() => grades.filter(g => classCategory === 'extra' ? isExtraClass(g) : !isExtraClass(g)), [grades, classCategory]);

  const handleCategoryChange = (cat: 'general' | 'extra') => {
    setClassCategory(cat);
    setGrade('');
    setChildName('');
    setNameQuery('');
    setNameError('');
    setNameMatches([]);
    setError('');
    setClassStudents([]);
  };

  // Gate the whole portal behind login.
  if (!session) {
    return <ParentLogin onBack={onBack} onLogin={(child) => setSession({ name: child.name, grade: child.grade, studentId: child.studentId })} />;
  }

  const logout = () => {
    clearSession(); setSession(null); setActivePanel(null); setShowChangePass(false);
    setGrade(''); setChildName(''); setNameQuery(''); setNameError(''); setNameMatches([]); setError(''); setClassStudents([]);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#E9FDF0,transparent_45%),radial-gradient(circle_at_80%_35%,#FEF9E7,transparent_55%),radial-gradient(circle_at_30%_85%,#ECFDF5,transparent_50%),#E4F4E9] flex flex-col items-center px-4 py-5">
      <div className="w-full max-w-md">
        {/* App-style header bar */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-3xl bg-gradient-to-br from-emerald-600 to-green-600 shadow-lg shadow-emerald-600/20">
          <button
            onClick={onBack}
            aria-label="ត្រឡប់ក្រោយ"
            className="p-2 rounded-2xl bg-white/15 text-white hover:bg-white/25 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
            <SchoolLogo size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-extrabold text-white leading-tight">{t('common.school')}</h1>
            {/* The school's three competencies, shown under the name. */}
            <p className="text-[11px] font-bold text-white/85 leading-tight mt-0.5">
              {t('parent.motto')}
            </p>
          </div>
          <LanguageToggle className="border-white/25 text-white bg-white/15 hover:bg-white/25 shrink-0" />
        </div>

        {/* Logged-in bar: which child, change password, and log out. */}
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-2xl bg-white border border-emerald-100 shadow-sm">
          <span className="text-xs font-bold text-slate-700 truncate">👦 {session.name.replace(/\s*\([^)]*\)\s*$/, '')} <span className="text-slate-400 font-semibold">· {session.grade}</span></span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowChangePass(v => !v)} className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">ប្តូរលេខសម្ងាត់</button>
            <button onClick={logout} className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200">ចេញ</button>
          </div>
        </div>
        {showChangePass && <ChangePasswordBox session={session} onDone={() => setShowChangePass(false)} />}

        {/* Mobile-Portal-style tiles — tapping one reveals its options below. */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActivePanel(v => v === 'results' ? null : 'results')}
            className={`flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] ${activePanel === 'results' ? 'border-emerald-300 bg-emerald-50/40' : 'border-emerald-500/10 hover:bg-emerald-50/50 hover:border-emerald-200'}`}
          >
            <div className="flex justify-between items-start w-full">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <GraduationCap className="w-4.5 h-4.5 text-emerald-600 stroke-[2.5]" />
              </div>
              <span className="text-2xl leading-none">🎓</span>
            </div>
            <span className="text-[13px] font-extrabold text-left text-emerald-950 leading-tight">
              {t('parent.tile.results')} <span className="text-[10px] text-emerald-400">{activePanel === 'results' ? '▲' : '▼'}</span>
            </span>
          </button>

          {onStudentTest && (
            <button
              onClick={onStudentTest}
              className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] border-indigo-500/10 hover:bg-indigo-50/50 hover:border-indigo-200"
            >
              <div className="flex justify-between items-start w-full">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5 text-indigo-600 stroke-[2.5]" />
                </div>
                <span className="text-2xl leading-none">📝</span>
              </div>
              <span className="text-[13px] font-extrabold text-left text-indigo-950 leading-tight">{t('parent.tile.test')}</span>
            </button>
          )}

          <a
            href="https://plp.moeys.gov.kh/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] border-sky-500/10 hover:bg-sky-50/50 hover:border-sky-200 no-underline"
          >
            <div className="flex justify-between items-start w-full">
              <div className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <ExternalLink className="w-4.5 h-4.5 text-sky-600 stroke-[2.5]" />
              </div>
              <span className="text-2xl leading-none">📚</span>
            </div>
            <span className="text-[13px] font-extrabold text-left text-sky-950 leading-tight">{t('parent.tile.plp')}</span>
          </a>

          <button
            onClick={() => setActivePanel(v => v === 'elibrary' ? null : 'elibrary')}
            className={`flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] ${activePanel === 'elibrary' ? 'border-violet-300 bg-violet-50/40' : 'border-violet-500/10 hover:bg-violet-50/50 hover:border-violet-200'}`}
          >
            <div className="flex justify-between items-start w-full">
              <div className="w-9 h-9 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Monitor className="w-4.5 h-4.5 text-violet-600 stroke-[2.5]" />
              </div>
              <span className="text-2xl leading-none">📖</span>
            </div>
            <span className="text-[13px] font-extrabold text-left text-violet-950 leading-tight">
              {t('parent.tile.elibrary')} <span className="text-[10px] text-violet-400">{activePanel === 'elibrary' ? '▲' : '▼'}</span>
            </span>
          </button>

          <button
            onClick={() => setActivePanel(v => v === 'learning-games' ? null : 'learning-games')}
            className={`flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] ${activePanel === 'learning-games' ? 'border-rose-300 bg-rose-50/40' : 'border-rose-500/10 hover:bg-rose-50/50 hover:border-rose-200'}`}
          >
            <div className="flex justify-between items-start w-full">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <span className="text-xl">🎮</span>
              </div>
              <span className="text-2xl leading-none">🧩</span>
            </div>
            <span className="text-[13px] font-extrabold text-left text-rose-950 leading-tight">
              មជ្ឈមណ្ឌលល្បែងសិក្សា <span className="text-[10px] text-rose-400">{activePanel === 'learning-games' ? '▲' : '▼'}</span>
            </span>
          </button>

          <button
            onClick={() => setActivePanel(v => v === 'calendar' ? null : 'calendar')}
            className={`flex flex-col items-stretch justify-between p-3 bg-white rounded-3xl border shadow-sm active:scale-97 transition-all min-h-[112px] ${activePanel === 'calendar' ? 'border-amber-300 bg-amber-50/40' : 'border-amber-500/10 hover:bg-amber-50/50 hover:border-amber-200'}`}
          >
            <div className="flex justify-between items-start w-full">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
              <span className="text-2xl leading-none">🌕</span>
            </div>
            <span className="text-[13px] font-extrabold text-left text-amber-950 leading-tight">
              ប្រតិទិនចន្ទគតិ <span className="text-[10px] text-amber-400">{activePanel === 'calendar' ? '▲' : '▼'}</span>
            </span>
          </button>
        </div>

        {activePanel === 'results' && (
          <div className="mt-3 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-5 space-y-4">
          {/* Step 1 — pick class (hidden when scoped to the logged-in child) */}
          {!session && <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <GraduationCap size={14} className="text-emerald-600" /> {t('parent.selectClass')}
            </label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-3">
              <button
                onClick={() => handleCategoryChange('general')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${classCategory === 'general' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                {t('login.catGeneral')}
              </button>
              <button
                onClick={() => handleCategoryChange('extra')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                {t('login.catExtra')}
              </button>
            </div>
            <select
              value={grade}
              onChange={e => loadClass(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">{t('parent.selectClassOpt')}</option>
              {filteredGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
              <Loader2 size={18} className="animate-spin" /> {t('parent.loading')}
            </div>
          )}
          {error && !loading && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Step 2 — parent types the child's name (hidden when scoped to the logged-in child) */}
          {!session && !loading && classStudents.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Search size={14} className="text-emerald-600" /> {t('parent.typeName')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={nameQuery}
                  onChange={e => { setNameQuery(e.target.value); setNameError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
                  placeholder={t('parent.namePlaceholder')}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-slate-400"
                />
                <button
                  onClick={() => confirmName()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  {t('parent.search')}
                </button>
              </div>
              {nameError && <p className="text-xs text-rose-600 mt-2">{nameError}</p>}
              {/* When several students match what was typed, let the parent pick */}
              {nameMatches.length > 1 && (
                <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-50">
                  <p className="text-[11px] text-slate-500 px-3 py-1.5">{t('parent.manyMatches')}</p>
                  {nameMatches.map(n => (
                    <button
                      key={n}
                      onClick={() => { setChildName(n); setNameMatches([]); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {childName && (
                <p className="text-xs text-emerald-700 font-bold mt-2">✓ {t('parent.selected')} {childName}</p>
              )}
            </div>
          )}

          {/* Step 3 — choose a report card */}
          {childName && anyRec && (
            <div className="pt-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <FileText size={14} className="text-emerald-600" /> {t('parent.pickReport')}
              </label>

              {/* Monthly */}
              {monthsAvailable.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-slate-500 font-semibold mb-1.5">{t('parent.monthly')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {monthsAvailable.map(m => (
                      <button
                        key={m}
                        onClick={() => setMonthlyRec(childRecords.find(r => r.month === m) || null)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        {t('parent.monthPrefix')}{t('month.' + m)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Semester & annual */}
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5">{t('parent.semAnnual')}</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setSemCard({ student: anyRec, period: 1 })} className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-semibold transition-colors">{t('parent.sem1')}</button>
                <button onClick={() => setSemCard({ student: anyRec, period: 2 })} className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-semibold transition-colors">{t('parent.sem2')}</button>
                <button onClick={() => setSemCard({ student: anyRec, period: 'year' })} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors">{t('parent.annual')}</button>
              </div>

              {/* Merit certificate — only for periods the child earned និទ្ទេស A/B */}
              {meritOptions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Award size={14} className="text-amber-500" /> {t('parent.merit')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {meritOptions.map(o => (
                      <button
                        key={o.key}
                        onClick={() => setMeritCard({ student: o.student, score: o.score, phrase: o.phrase })}
                        className="px-3 py-1.5 bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-800 hover:from-amber-200 hover:to-yellow-200 border border-amber-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        🏅 {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Weekly timetable for the selected class (read-only) */}
        {grade && !isTimetableEmpty(timetable) && (
          <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-lg p-4">
            <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-3">
              🗓️ {(timetable.title && timetable.title.trim()) || t('parent.weeklyTimetable')} — {grade}
            </h2>
            <TimetableView tt={timetable} />
          </div>
        )}
          </div>
        )}

        {activePanel === 'elibrary' && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...CURATED_ELIBRARY.map(e => ({ title: e.title, url: e.url, category: e.category })),
              ...schoolElinks.map(e => ({ title: e.title, url: e.url, category: e.category || t('parent.schoolBooks') }))]
              .map(e => (
                <a
                  key={e.url + e.title}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm transition-all no-underline"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Monitor size={15} className="text-violet-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{e.title}</p>
                    <p className="text-[10px] text-slate-400 font-semibold truncate">{e.category}</p>
                  </div>
                  <ExternalLink size={12} className="text-slate-300 group-hover:text-violet-500 shrink-0" />
                </a>
              ))}
          </div>
        )}

        {activePanel === 'learning-games' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 relative bg-white/60 p-4 border rounded-3xl mt-4 overflow-hidden shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">មជ្ឈមណ្ឌលល្បែងសិក្សា</h2>
            <div className="bg-white/50 -mx-2 -mb-2 rounded-2xl overflow-hidden relative" style={{ minHeight: '600px' }}>
              <div className="absolute inset-0 overflow-y-auto">
                <LearningGames onBack={() => setActivePanel(null)} />
              </div>
            </div>
          </div>
        )}

        {activePanel === 'calendar' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 mt-4">
            {/* Read-only for parents: they see holidays + the school's notes, no editing. */}
            <KhmerCalendar readOnly />
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          {t('parent.footnote')}
        </p>
      </div>

      {/* Report card overlays — each has its own Print / PDF + Close */}
      {monthlyRec && (
        <StudentReportCard
          student={monthlyRec}
          students={studentsForCards}
          onClose={() => setMonthlyRec(null)}
        />
      )}
      {semCard && (
        <SemesterReportCard
          student={semCard.student}
          students={studentsForCards}
          period={semCard.period}
          onClose={() => setSemCard(null)}
        />
      )}
      {meritCard && (
        <MeritCertificate
          student={meritCard.student}
          students={studentsForCards}
          scoreOverride={meritCard.score}
          periodPhrase={meritCard.phrase}
          onClose={() => setMeritCard(null)}
        />
      )}
    </div>
  );
}
