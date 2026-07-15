/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Student quiz (តេស្តស្តង់ដា online) — the no-login student side of the exam
// engine. Flow: enter join code → pick class (if the test spans several) → pick
// own name from the roster → countdown test → auto-graded result.
//
// Resilience: startedAt + answers + tab-switch count are mirrored to
// localStorage per submission id, so an accidental refresh resumes the SAME
// timer and answers instead of restarting the test.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, Send, ChevronLeft, ChevronRight, Loader2, KeyRound, Users, PlayCircle } from 'lucide-react';
import {
  StandardTest, TestAnswers, GradedResult, TestQuestion,
  findOpenTestByCode, fetchPriorSubmission, submitTest, submissionId,
  presentQuestions, matchingRightOptions, studentKeyOf,
} from '../lib/standardTests';
import { fetchClassStudents } from '../lib/supabase';
import SchoolLogo from './SchoolLogo';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const fmtClock = (sec: number) => `${toKh(String(Math.floor(sec / 60)).padStart(2, '0'))}:${toKh(String(sec % 60).padStart(2, '0'))}`;

// The printed exam lays short choices out in two columns. Follow it only when
// EVERY option is short, so nothing wraps mid-answer.
const twoColumnOptions = (options?: string[]): boolean =>
  !!options && options.length >= 3 && options.every(o => (o || '').length <= 24);

// Render a prompt with dot/underscore blank runs ("……………" / "____") as a clean
// styled gap instead of a ragged string of dots.
const renderPrompt = (s: string): React.ReactNode[] =>
  (s || '').split(/([…._]{4,})/g).map((part, i) =>
    /^[…._]{4,}$/.test(part)
      ? <span key={i} className="inline-block min-w-[80px] mx-1 border-b-2 border-dotted border-indigo-400 align-baseline">&nbsp;</span>
      : <React.Fragment key={i}>{part}</React.Fragment>);

// The module enforces a dedicated Khmer reading font for students.
const KH_FONT = { fontFamily: "'Battambang', 'Kantumruy Pro', 'Hanuman', sans-serif" } as const;

interface Props {
  initialCode?: string;
  onBack: () => void;
}

type Step = 'code' | 'name' | 'ready' | 'quiz' | 'done';

export default function StudentQuiz({ initialCode, onBack }: Props) {
  const [step, setStep] = useState<Step>('code');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [code, setCode] = useState(initialCode || '');
  const [test, setTest] = useState<StandardTest | null>(null);

  const [cls, setCls] = useState('');
  const [roster, setRoster] = useState<string[]>([]);
  const [nameFilter, setNameFilter] = useState('');
  const [studentName, setStudentName] = useState('');

  const [result, setResult] = useState<GradedResult | null>(null);
  const [priorMsg, setPriorMsg] = useState('');

  // ---- Step 1: join code ----
  const joinByCode = async (c?: string) => {
    const q = (c ?? code).trim().toUpperCase();
    if (q.length < 4) { setError('សូមបញ្ចូលកូដ ៤ តួ'); return; }
    setBusy(true); setError('');
    try {
      const t = await findOpenTestByCode(q);
      if (!t) { setError('រកមិនឃើញតេស្តដែលបើកជាមួយកូដនេះទេ — សូមពិនិត្យកូដម្តងទៀត។'); return; }
      setTest(t);
      const single = t.grades.length === 1 ? t.grades[0] : '';
      setCls(single);
      if (single) await loadRoster(single);
      setStep('name');
    } catch {
      setError('មិនអាចភ្ជាប់ទៅ Server បានទេ — សូមពិនិត្យ Internet។');
    } finally { setBusy(false); }
  };
  // A join link (?join=CODE) skips the typing.
  useEffect(() => { if (initialCode) joinByCode(initialCode); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ---- Step 2: class + name ----
  const loadRoster = async (g: string) => {
    setBusy(true); setError('');
    try {
      const rows = await fetchClassStudents(g);
      const names = [...new Set(rows.map(r => (r.name || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'km'));
      setRoster(names);
      if (!names.length) setError('ថ្នាក់នេះមិនទាន់មានបញ្ជីឈ្មោះសិស្សទេ។');
    } catch {
      setError('មិនអាចទាញបញ្ជីឈ្មោះសិស្សបានទេ។');
    } finally { setBusy(false); }
  };

  const pickName = async (name: string) => {
    if (!test) return;
    setBusy(true); setError(''); setPriorMsg('');
    try {
      const prior = await fetchPriorSubmission(test.id, cls, name);
      if (prior) {
        setStudentName(name);
        setResult({ score: prior.score, maxScore: prior.maxScore, detail: prior.detail });
        setPriorMsg('អ្នកបានធ្វើតេស្តនេះរួចហើយ — ពិន្ទុរបស់អ្នកគឺ៖');
        setStep('done');
        return;
      }
      setStudentName(name);
      setStep('ready');
    } catch {
      setError('មិនអាចពិនិត្យទិន្នន័យបានទេ — សូមព្យាយាមម្តងទៀត។');
    } finally { setBusy(false); }
  };

  // ---- Steps 3–4: the quiz itself + result ----
  if (step === 'quiz' && test && studentName) {
    return (
      <QuizRunner
        test={test} cls={cls} studentName={studentName}
        onDone={(r, auto) => { setResult(r); setPriorMsg(auto ? 'អស់ម៉ោង! ប្រព័ន្ធបានប្រគល់ចម្លើយដោយស្វ័យប្រវត្តិ។' : ''); setStep('done'); }}
      />
    );
  }

  const card = 'w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-6 space-y-4';

  return (
    <div style={KH_FONT} className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 flex flex-col items-center justify-center p-4">
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-white shadow-md border border-slate-100 overflow-hidden flex items-center justify-center"><SchoolLogo className="w-full h-full p-1" /></div>
        <h1 className="text-lg font-bold text-slate-800">តេស្តស្តង់ដា Online</h1>
      </div>

      {step === 'code' && (
        <div className={card}>
          <p className="text-sm text-slate-500 text-center flex items-center justify-center gap-1.5"><KeyRound size={15} className="text-indigo-500" /> បញ្ចូលកូដតេស្តដែលគ្រូប្រាប់</p>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') joinByCode(); }}
            placeholder="ABCD"
            autoFocus
            className="w-full text-center text-4xl font-mono font-bold tracking-[0.5em] py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 focus:border-indigo-500 outline-none uppercase"
          />
          {error && <p className="text-xs text-rose-600 text-center font-semibold">{error}</p>}
          <button onClick={() => joinByCode()} disabled={busy || code.length < 4}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <PlayCircle size={17} />} ចូលធ្វើតេស្ត
          </button>
          <button onClick={onBack} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"><ArrowLeft size={12} /> ត្រឡប់</button>
        </div>
      )}

      {step === 'name' && test && (
        <div className={card}>
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-slate-800">{test.title}</p>
            <p className="text-xs text-slate-400">{test.subject} · {toKh(test.questions?.length || 0)} សំណួរ · {toKh(Math.round(test.durationSec / 60))} នាទី</p>
          </div>
          {test.grades.length > 1 && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">ជ្រើសថ្នាក់របស់អ្នក</span>
              <div className="grid grid-cols-2 gap-2">
                {test.grades.map(g => (
                  <button key={g} onClick={() => { setCls(g); setRoster([]); setStudentName(''); loadRoster(g); }}
                    className={`py-2.5 rounded-xl text-sm font-bold border ${cls === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{g}</button>
                ))}
              </div>
            </div>
          )}
          {cls && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><Users size={12} /> ជ្រើសឈ្មោះរបស់អ្នក — {cls}</span>
              <input value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="ស្វែងរកឈ្មោះ…"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
              {busy ? <div className="py-6 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div> : (
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {roster.filter(n => !nameFilter || n.includes(nameFilter)).map(n => (
                    <button key={n} onClick={() => pickName(n)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 text-sm font-semibold text-slate-700">{n}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-xs text-rose-600 text-center font-semibold">{error}</p>}
          <button onClick={() => { setStep('code'); setTest(null); setCls(''); setRoster([]); }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"><ArrowLeft size={12} /> ប្តូរកូដ</button>
        </div>
      )}

      {step === 'ready' && test && (
        <div className={card}>
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-slate-800">{test.title}</p>
            <p className="text-sm font-semibold text-indigo-600">{studentName} · {cls}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-[13px] text-amber-800">
            <p className="flex items-start gap-2"><Clock size={15} className="shrink-0 mt-0.5" /> មានពេល {toKh(Math.round(test.durationSec / 60))} នាទី។ ពេលអស់ម៉ោង ចម្លើយនឹងត្រូវប្រគល់ដោយស្វ័យប្រវត្តិ។</p>
            {test.antiCheat && <p className="flex items-start gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> កុំចាកចេញពីទំព័រតេស្ត — ការចាកចេញត្រូវបានកត់ត្រា ហើយគ្រូនឹងឃើញ។</p>}
            <p className="flex items-start gap-2"><CheckCircle2 size={15} className="shrink-0 mt-0.5" /> ធ្វើបានតែម្តងគត់ — សូមពិនិត្យចម្លើយឱ្យបានច្បាស់មុនប្រគល់។</p>
          </div>
          <button onClick={() => setStep('quiz')} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2">
            <PlayCircle size={17} /> ចាប់ផ្តើមតេស្ត
          </button>
          <button onClick={() => setStep('name')} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"><ArrowLeft size={12} /> ប្តូរឈ្មោះ</button>
        </div>
      )}

      {step === 'done' && result && (
        <div className={card}>
          {priorMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center font-semibold">{priorMsg}</p>}
          <div className="text-center space-y-2 py-2">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">{studentName}</p>
            <p className="text-4xl font-extrabold text-slate-800">{toKh(result.score)} <span className="text-lg text-slate-400 font-bold">/ {toKh(result.maxScore)}</span></p>
            <p className="text-xs text-slate-400">{test?.title}</p>
          </div>
          <button onClick={onBack} className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center justify-center gap-2"><ArrowLeft size={15} /> បញ្ចប់</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- QuizRunner ----

interface RunnerProps {
  test: StandardTest;
  cls: string;
  studentName: string;
  onDone: (r: GradedResult, autoSubmitted: boolean) => void;
}

function QuizRunner({ test, cls, studentName, onDone }: RunnerProps) {
  const subId = submissionId(test.id, cls, studentName);
  const LS_START = `st_start_${subId}`, LS_ANS = `st_ans_${subId}`, LS_TABS = `st_tabs_${subId}`;

  // Same seed every mount → the shuffled order survives a refresh.
  const questions = useMemo(() => presentQuestions(test, studentKeyOf(studentName) + cls), [test, studentName, cls]);

  // startedAt persists so a refresh RESUMES the countdown instead of resetting it.
  const startedAt = useMemo(() => {
    const saved = localStorage.getItem(LS_START);
    if (saved) return saved;
    const now = new Date().toISOString();
    try { localStorage.setItem(LS_START, now); } catch { /* ignore */ }
    return now;
  }, [LS_START]);

  const [answers, setAnswers] = useState<TestAnswers>(() => {
    try { return JSON.parse(localStorage.getItem(LS_ANS) || '{}'); } catch { return {}; }
  });
  const setAnswer = (qid: string, v: string | Record<string, string>) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: v };
      try { localStorage.setItem(LS_ANS, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, test.durationSec - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
  const [tabSwitches, setTabSwitches] = useState(() => Number(localStorage.getItem(LS_TABS) || 0));
  const [cheatFlash, setCheatFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = async (auto: boolean) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const durationUsedSec = Math.min(test.durationSec, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    try {
      const graded = await submitTest(test, cls, studentName, answers, {
        startedAt, durationUsedSec, autoSubmitted: auto,
        tabSwitches: Number(localStorage.getItem(LS_TABS) || 0),
      });
      [LS_START, LS_ANS, LS_TABS].forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
      onDone(graded, auto);
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      alert('ប្រគល់ចម្លើយមិនបាន — សូមពិនិត្យ Internet រួចចុចប្រគល់ម្តងទៀត។ ចម្លើយរបស់អ្នកនៅរក្សាទុកក្នុងឧបករណ៍។');
    }
  };
  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // Countdown → auto-submit at zero.
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, test.durationSec - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      setRemaining(left);
      if (left <= 0) { clearInterval(t); doSubmitRef.current(true); }
    }, 1000);
    return () => clearInterval(t);
  }, [test.durationSec, startedAt]);

  // Anti-cheat: count every switch away from the tab and flash a warning.
  useEffect(() => {
    if (!test.antiCheat) return;
    const onVis = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const n = prev + 1;
          try { localStorage.setItem(LS_TABS, String(n)); } catch { /* ignore */ }
          return n;
        });
      } else {
        setCheatFlash(true);
        setTimeout(() => setCheatFlash(false), 4000);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [test.antiCheat, LS_TABS]);

  const q = questions[idx];
  const answeredCount = questions.filter(x => {
    const a = answers[x.id];
    if (x.type === 'matching') return a && typeof a === 'object' && Object.values(a).some(Boolean);
    return typeof a === 'string' && a.trim() !== '';
  }).length;

  const askSubmit = () => {
    const missing = questions.length - answeredCount;
    if (missing > 0 && !window.confirm(`នៅសល់ ${toKh(missing)} សំណួរមិនទាន់ឆ្លើយ។ ប្រគល់ចម្លើយមែនទេ?`)) return;
    if (missing === 0 && !window.confirm('ប្រគល់ចម្លើយមែនទេ?')) return;
    doSubmit(false);
  };

  return (
    <div style={KH_FONT} className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky header: timer + progress */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-800 truncate">{test.title}</p>
          <p className="text-[11px] text-slate-400 truncate">{studentName} · {cls}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono font-extrabold text-lg tabular-nums ${remaining <= 60 ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
          <Clock size={16} /> {fmtClock(remaining)}
        </div>
      </div>

      {cheatFlash && (
        <div className="bg-rose-600 text-white text-center text-[13px] font-bold px-4 py-2.5 flex items-center justify-center gap-2">
          <AlertTriangle size={15} /> កុំចាកចេញពីតេស្ត! ការចាកចេញត្រូវបានកត់ត្រា ({toKh(tabSwitches)} ដង)
        </div>
      )}

      {/* Question palette */}
      <div className="px-4 py-2.5 flex flex-wrap gap-1.5 justify-center">
        {questions.map((x, i) => {
          const a = answers[x.id];
          const done = x.type === 'matching'
            ? !!(a && typeof a === 'object' && Object.values(a).some(Boolean))
            : typeof a === 'string' && a.trim() !== '';
          return (
            <button key={x.id} onClick={() => setIdx(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border ${i === idx ? 'bg-indigo-600 text-white border-indigo-600' : done ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-400 border-slate-200'}`}>
              {toKh(i + 1)}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      <div className="flex-1 px-4 pb-28 max-w-2xl mx-auto w-full">
        {q && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
            {q.context && <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-[15px] leading-8 text-slate-700 whitespace-pre-wrap">{q.context}</div>}
            <div className="flex items-start gap-2.5">
              <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-600 text-white text-sm font-extrabold flex items-center justify-center shadow-sm">{toKh(idx + 1)}</span>
              <p className="text-[16px] leading-8 font-bold text-slate-800 pt-0.5">{renderPrompt(q.prompt)}</p>
            </div>

            {q.type === 'multiple_choice' && (
              // Mirror the printed exam: short answers (15 g / 1500 g) sit in TWO
              // columns — ក ខ on the first row, គ ឃ on the second. Long options
              // would be cramped side by side, so those stay full width.
              <div className={`grid gap-2.5 ${twoColumnOptions(q.options) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {(q.options || []).map((o, i) => {
                  const chosen = answers[q.id] === o;
                  return (
                    <button key={i} onClick={() => setAnswer(q.id, o)}
                      className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 text-[15px] font-semibold flex items-center gap-3 transition-all active:scale-[0.99] ${chosen ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-md' : 'bg-white border-slate-150 text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50/40'}`}>
                      <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${chosen ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-300 text-slate-500'}`}>{'កខគឃងចឆជ'[i] || toKh(i + 1)}</span>
                      <span className="flex-1">{o}</span>
                      {chosen && <CheckCircle2 size={18} className="shrink-0 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'fill_blank' && (
              <input
                value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                placeholder="សរសេរចម្លើយនៅទីនេះ…"
                className="w-full px-4 py-3.5 text-[16px] bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                style={KH_FONT}
              />
            )}

            {q.type === 'matching' && (
              <div className="space-y-2.5">
                {(q.pairs || []).map(p => {
                  const cur = (answers[q.id] && typeof answers[q.id] === 'object') ? (answers[q.id] as Record<string, string>)[p.left] || '' : '';
                  return (
                    <div key={p.left} className="flex items-center gap-3">
                      <span className="flex-1 px-3.5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[15px] font-semibold text-slate-700">{p.left}</span>
                      <span className="text-slate-300 font-bold">→</span>
                      <select value={cur}
                        onChange={e => {
                          const prev = (answers[q.id] && typeof answers[q.id] === 'object') ? { ...(answers[q.id] as Record<string, string>) } : {};
                          prev[p.left] = e.target.value;
                          setAnswer(q.id, prev);
                        }}
                        className={`flex-1 px-3 py-3 rounded-2xl border-2 text-[15px] font-semibold outline-none ${cur ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-500'}`}
                        style={KH_FONT}>
                        <option value="">— ជ្រើសរើស —</option>
                        {matchingRightOptions(q, studentKeyOf(studentName)).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold disabled:opacity-40 flex items-center gap-1"><ChevronLeft size={16} /> មុន</button>
          <div className="flex-1 text-center text-[11px] text-slate-400 font-semibold">ឆ្លើយរួច {toKh(answeredCount)}/{toKh(questions.length)}</div>
          {idx < questions.length - 1 ? (
            <button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
              className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1">បន្ទាប់ <ChevronRight size={16} /></button>
          ) : (
            <button onClick={askSubmit} disabled={submitting}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold flex items-center gap-1.5">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} ប្រគល់ចម្លើយ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
