/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// តេស្តស្តង់ដា — the teacher/principal side of the online exam engine.
// Two tabs: (1) manage tests — create from the standardized-test question bank,
// open with a join code, watch results; (2) the question bank itself.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, HelpCircle, Plus, Trash2, X, Save, PlayCircle, StopCircle,
  BarChart3, RefreshCw, Copy, Loader2, Clock, Users, KeyRound, AlertTriangle, CheckCircle2, Download,
} from 'lucide-react';
import { SchoolUser } from '../types';
import { standardTestBank, BankQuestion, BANK_MONTHS, EXAM_TYPES } from '../lib/questionBank';
import { TYPE_LABELS } from '../lib/worksheets';
import { niddesColor } from '../utils/scoring';
import { exportElementToMultipagePdf } from '../utils/exportPdf';
import { curriculumSubjects, refreshCurriculumFromCloud } from '../lib/curriculum';
import {
  StandardTest, TestSubmission, uuid,
  loadTests, refreshTestsFromCloud, saveTest, deleteTest, openTest, closeTest, fetchSubmissionsFor,
} from '../lib/standardTests';
import QuestionBank from './QuestionBank';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
}

const STATUS_UI: Record<StandardTest['status'], { label: string; cls: string }> = {
  draft: { label: 'ព្រាង', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  open: { label: 'កំពុងបើក', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  closed: { label: 'បានបិទ', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
};

// Used when the (blank-able) រយៈពេល field is left empty.
const DEFAULT_DURATION_MIN = 10;

// Official niddes scale (A≥9 … F<5 on /10) — the score is a fraction of maxScore,
// so scale it to /10 first. Mirrors the bands used by the report cards/rankings.
const NIDDES_BAND: Record<string, string> = { A: 'ល្អប្រសើរ', B: 'ល្អណាស់', C: 'ល្អ', D: 'ល្អបង្គួរ', E: 'មធ្យម', F: 'ខ្សោយ' };
const letterOfPct = (pct: number): string => {
  const v = pct / 10; // percent → /10 scale
  if (v >= 9) return 'A';
  if (v >= 8) return 'B';
  if (v >= 7) return 'C';
  if (v >= 6) return 'D';
  if (v >= 5) return 'E';
  return 'F';
};

export default function StandardTests({ grades, currentUser, onClose }: Props) {
  const [tab, setTab] = useState<'tests' | 'bank'>('tests');
  const [tests, setTests] = useState<StandardTest[]>(() => loadTests());
  const [subjects, setSubjects] = useState<string[]>(() => curriculumSubjects());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    refreshTestsFromCloud().then(setTests);
    refreshCurriculumFromCloud().then(() => setSubjects(curriculumSubjects()));
  }, []);

  // ---- Create/edit draft ----
  type Draft = {
    id: string | null; title: string; subject: string; grades: string[];
    // Kept as a STRING so the field can be left blank while typing (a number would
    // coerce '' back to a value). Falls back to DEFAULT_DURATION_MIN on save.
    durationMin: string; shuffleQuestions: boolean; shuffleOptions: boolean;
    antiCheat: boolean; pointsPerQuestion: number; questionIds: string[];
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const bankQuestions = useMemo(() => standardTestBank.loadQuestions(), [tab, draft?.id]);

  const startNew = () => setDraft({
    id: null, title: '', subject: subjects[0] || 'ភាសាខ្មែរ', grades: [],
    // Questions stay in the imported exam's original numbering by default; the
    // teacher can still turn «ច្របល់សំណួរ» on. Option shuffling stays on.
    durationMin: '', shuffleQuestions: false, shuffleOptions: true,
    antiCheat: true, pointsPerQuestion: 1, questionIds: [],
  });
  const startEdit = (t: StandardTest) => setDraft({
    id: t.id, title: t.title, subject: t.subject, grades: [...t.grades],
    durationMin: String(Math.round(t.durationSec / 60)), shuffleQuestions: t.shuffleQuestions,
    shuffleOptions: t.shuffleOptions, antiCheat: t.antiCheat,
    pointsPerQuestion: t.pointsPerQuestion, questionIds: [...t.questionIds],
  });

  // Only bank questions usable by the online engine (MCQ / fill-blank / matching)
  // in the draft's subject+classes are offered; month/exam-type tags (set when an
  // exam was imported) narrow the list further so picking a whole exam is one click.
  const [pickMonth, setPickMonth] = useState('');
  const [pickExamType, setPickExamType] = useState('');
  const pickable = useMemo(() => {
    if (!draft) return [] as BankQuestion[];
    return bankQuestions.filter(q =>
      ['multiple_choice', 'fill_blank', 'matching'].includes(q.type) &&
      q.subject === draft.subject &&
      (!draft.grades.length || draft.grades.includes(q.grade)) &&
      (!pickMonth || q.month === pickMonth) &&
      (!pickExamType || q.examType === pickExamType));
  }, [bankQuestions, draft?.subject, draft?.grades, pickMonth, pickExamType]);

  // One click selects/deselects everything the pick filters currently show.
  const allPicked = !!draft && pickable.length > 0 && pickable.every(q => draft.questionIds.includes(q.id));
  const toggleAllPickable = () => {
    if (!draft) return;
    const ids = new Set(draft.questionIds);
    if (allPicked) pickable.forEach(q => ids.delete(q.id));
    else pickable.forEach(q => ids.add(q.id));
    setDraft({ ...draft, questionIds: [...ids] });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { flash('សូមបញ្ចូលចំណងជើងតេស្ត', false); return; }
    if (!draft.grades.length) { flash('សូមជ្រើសថ្នាក់យ៉ាងតិចមួយ', false); return; }
    if (!draft.questionIds.length) { flash('សូមជ្រើសសំណួរយ៉ាងតិចមួយ', false); return; }
    // Keep the questions in the BANK's order (= the order the exam was imported in),
    // not the order the teacher happened to tick the boxes.
    const bankOrder = new Map<string, number>(bankQuestions.map((q, i) => [q.id, i] as [string, number]));
    const orderedIds = [...draft.questionIds].sort(
      (a, b) => (bankOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (bankOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    );
    const existing = draft.id ? tests.find(t => t.id === draft.id) : null;
    const t: StandardTest = {
      id: draft.id || uuid(),
      code: existing?.code || '',
      title: draft.title.trim(),
      grades: draft.grades,
      subject: draft.subject,
      durationSec: Math.max(1, Math.min(180, Number(draft.durationMin) || DEFAULT_DURATION_MIN)) * 60,
      status: existing?.status || 'draft',
      questionIds: orderedIds,
      questions: existing?.questions,
      shuffleQuestions: draft.shuffleQuestions,
      shuffleOptions: draft.shuffleOptions,
      pointsPerQuestion: Math.max(1, draft.pointsPerQuestion),
      antiCheat: draft.antiCheat,
      createdBy: existing?.createdBy || currentUser?.name || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      openedAt: existing?.openedAt, closedAt: existing?.closedAt,
    };
    setTests(await saveTest(t));
    setDraft(null);
    flash('បានរក្សាទុកតេស្ត ✓');
  };

  const onOpen = async (id: string) => {
    setBusy(true);
    try {
      const t = await openTest(id);
      setTests(loadTests());
      if (t) flash(`តេស្តបើកហើយ! កូដ៖ ${t.code}`);
    } catch (e: any) { flash(e?.message || 'បើកតេស្តមិនបាន', false); }
    finally { setBusy(false); }
  };
  const onCloseTest = async (id: string) => {
    if (!window.confirm('បិទតេស្តនេះ? សិស្សនឹងមិនអាចចូលទៀតបានទេ។')) return;
    setTests(await closeTest(id));
    flash('បានបិទតេស្ត ✓');
  };
  const onDelete = async (id: string) => {
    if (!window.confirm('លុបតេស្តនេះ? (លទ្ធផលដែលបានប្រគល់រួច នៅរក្សាទុកក្នុងតារាងលទ្ធផល)')) return;
    setTests(await deleteTest(id));
    flash('បានលុប ✓');
  };

  // ---- Results ----
  const [resultsFor, setResultsFor] = useState<StandardTest | null>(null);
  const [subs, setSubs] = useState<TestSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const loadSubs = async (t: StandardTest) => {
    setResultsFor(t); setLoadingSubs(true);
    try { setSubs(await fetchSubmissionsFor(t.id)); }
    catch { flash('ទាញលទ្ធផលមិនបាន', false); }
    finally { setLoadingSubs(false); }
  };

  // A submission's percent → the school's /10 មធ្យមភាគ, which is what the niddes
  // letter is banded on (A>=9 … F<5), so the two always agree.
  const pctOf = (s: TestSubmission) => (s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0);
  const resultSummary = useMemo(() => {
    if (!subs.length) return null;
    const avgPct = subs.reduce((sum, s) => sum + pctOf(s), 0) / subs.length;
    // How many students landed in each niddes band, and what share of the class.
    const dist = (Object.keys(NIDDES_BAND) as string[]).map(letter => {
      const count = subs.filter(s => letterOfPct(pctOf(s)) === letter).length;
      return { letter, count, pct: Math.round((count / subs.length) * 100) };
    });
    return { avgPct: Math.round(avgPct), avg10: (avgPct / 10).toFixed(2), letter: letterOfPct(avgPct), dist };
  }, [subs]);

  const [resultsPdfBusy, setResultsPdfBusy] = useState(false);
  const downloadResults = async () => {
    const el = document.getElementById('standardtest-results-print');
    if (!el || !resultsFor) return;
    setResultsPdfBusy(true);
    try {
      await exportElementToMultipagePdf(el, `លទ្ធផល_${resultsFor.subject}_${resultsFor.title}`.replace(/\s+/g, '_'), 900);
    } catch { flash('ទាញយករបាយការណ៍មិនបាន', false); }
    finally { setResultsPdfBusy(false); }
  };

  const copyJoin = (t: StandardTest) => {
    const url = `${window.location.origin}/?join=${t.code}`;
    navigator.clipboard?.writeText(url).then(() => flash('បានចម្លងតំណភ្ជាប់ ✓')).catch(() => flash(url));
  };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none';
  const chip = (on: boolean) => `px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer select-none ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`;

  if (tab === 'bank') {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-3">
        <Tabs tab={tab} setTab={setTab} />
        <QuestionBank bank={standardTestBank} title="ធនាគារសំណួរ តេស្តស្តង់ដា" grades={grades} currentUser={currentUser} onClose={onClose} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <Tabs tab={tab} setTab={setTab} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <ClipboardCheck size={16} className="text-blue-500" /> តេស្តស្តង់ដា Online
          <span className="text-[11px] font-semibold text-slate-400">· {tests.length} តេស្ត</span>
        </h3>
        <div className="flex items-center gap-2">
          {!draft && <button onClick={startNew} className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"><Plus size={13} /> តេស្តថ្មី</button>}
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>
      </div>

      {toast && <div className={`text-center text-xs font-bold px-3 py-2 rounded-xl ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{toast.msg}</div>}

      {/* Draft form. Editing an OPEN test only exposes title + classes — the
          question snapshot, duration, and join code must stay frozen mid-test. */}
      {draft && (() => { const editingOpen = !!(draft.id && tests.find(x => x.id === draft.id)?.status === 'open'); return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          {editingOpen && (
            <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              តេស្តនេះកំពុងបើក — អាចកែបានតែ ចំណងជើង និងថ្នាក់ ប៉ុណ្ណោះ (សំណួរ រយៈពេល និងកូដ នៅដដែល)។
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2 block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ចំណងជើងតេស្ត</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="ឧ. តេស្តស្តង់ដាអំណាន ឆមាសទី២" className={fieldCls} /></label>
            {!editingOpen && <>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មុខវិជ្ជា</span><select value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} className={fieldCls}>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">រយៈពេល (នាទី)</span><input type="number" min={1} max={180} value={draft.durationMin} placeholder={`ឧ. ${DEFAULT_DURATION_MIN}`} onChange={e => setDraft({ ...draft, durationMin: e.target.value })} className={fieldCls} /></label>
            </>}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ថ្នាក់ដែលធ្វើតេស្តនេះ</span>
            <div className="flex flex-wrap gap-1.5">
              {grades.map(g => (
                <span key={g} onClick={() => setDraft({ ...draft, grades: draft.grades.includes(g) ? draft.grades.filter(x => x !== g) : [...draft.grades, g] })} className={chip(draft.grades.includes(g))}>{g}</span>
              ))}
            </div>
          </div>

          {!editingOpen && <div className="flex flex-wrap gap-1.5">
            <span onClick={() => setDraft({ ...draft, shuffleQuestions: !draft.shuffleQuestions })} className={chip(draft.shuffleQuestions)}>ច្របល់សំណួរ</span>
            <span onClick={() => setDraft({ ...draft, shuffleOptions: !draft.shuffleOptions })} className={chip(draft.shuffleOptions)}>ច្របល់ជម្រើស</span>
            <span onClick={() => setDraft({ ...draft, antiCheat: !draft.antiCheat })} className={chip(draft.antiCheat)}>កត់ត្រាការចាកចេញពី Tab</span>
          </div>}

          {!editingOpen && <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ជ្រើសសំណួរ ({toKh(draft.questionIds.length)} បានជ្រើស · MCQ / បំពេញចន្លោះ / ផ្គូផ្គង)</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={pickMonth} onChange={e => setPickMonth(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold outline-none"><option value="">ខែទាំងអស់</option>{BANK_MONTHS.map(m => <option key={m} value={m}>ខែ{m}</option>)}</select>
              <select value={pickExamType} onChange={e => setPickExamType(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold outline-none"><option value="">ប្រភេទតេស្តទាំងអស់</option>{EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              {pickable.length > 0 && (
                <button onClick={toggleAllPickable} className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border ${allPicked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>
                  {allPicked ? `ដកទាំង ${pickable.length}` : `ជ្រើសទាំង ${pickable.length}`}
                </button>
              )}
            </div>
            {pickable.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3">
                គ្មានសំណួរក្នុងធនាគារ សម្រាប់មុខវិជ្ជា/ថ្នាក់នេះទេ — បន្ថែមក្នុងផ្ទាំង «ធនាគារសំណួរ» សិន។
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 rounded-xl p-2">
                {pickable.map(q => {
                  const on = draft.questionIds.includes(q.id);
                  return (
                    <label key={q.id} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer border ${on ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                      <input type="checkbox" checked={on} onChange={() => setDraft({ ...draft, questionIds: on ? draft.questionIds.filter(x => x !== q.id) : [...draft.questionIds, q.id] })} className="mt-1" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-700 truncate">{q.type === 'matching' ? `ផ្គូផ្គង (${q.pairs?.length || 0} គូ)` : q.prompt}</span>
                        <span className="block text-[10px] text-slate-400">{q.grade} · {TYPE_LABELS[q.type]}{q.month ? ` · ខែ${q.month}` : ''}{q.examType ? ` · ${q.examType}` : ''}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>}

          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200">បោះបង់</button>
            <button onClick={saveDraft} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Save size={13} /> រក្សាទុក</button>
          </div>
        </div>
      ); })()}

      {/* Results panel */}
      {resultsFor && !draft && (
        <div id="standardtest-results-print" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><BarChart3 size={14} className="text-blue-500" /> លទ្ធផល — {resultsFor.title}</span>
              {/* The subject + class average are constant for the test, so they head
                  the panel instead of repeating on every row. */}
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap">
                <span>មុខវិជ្ជា <b className="text-slate-600">{resultsFor.subject}</b></span>
                <span className="text-slate-300">·</span>
                <span>{resultsFor.grades.join(', ')}</span>
                <span className="text-slate-300">·</span>
                <span>សិស្ស <b className="text-slate-600">{toKh(subs.length)}</b> នាក់</span>
                {resultSummary && <>
                  <span className="text-slate-300">·</span>
                  <span>មធ្យមភាគ <b className="text-slate-700">{toKh(resultSummary.avg10)}</b>/១០</span>
                  <span className="text-slate-300">·</span>
                  <span>{toKh(resultSummary.avgPct)}%</span>
                  <span className="text-slate-300">·</span>
                  <span>និទ្ទេស <b style={{ color: niddesColor(resultSummary.letter) }}>{resultSummary.letter}</b></span>
                </>}
              </p>
              {/* Niddes distribution — how many students in each band, and its share. */}
              {resultSummary && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {resultSummary.dist.map(d => (
                    <span
                      key={d.letter}
                      title={`និទ្ទេស ${d.letter} (${NIDDES_BAND[d.letter]}) — ${d.count} នាក់`}
                      className={`inline-flex items-baseline gap-1 px-2 py-1 rounded-lg border text-[10.5px] font-bold ${d.count ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-45'}`}
                    >
                      <b style={{ color: niddesColor(d.letter) }}>{d.letter}</b>
                      <span className="text-slate-700">{toKh(d.count)}</span>
                      <span className="text-slate-400 font-semibold">({toKh(d.pct)}%)</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rc-no-print flex items-center gap-2 shrink-0">
              <button onClick={downloadResults} disabled={resultsPdfBusy || !subs.length} title="ទាញយករបាយការណ៍លទ្ធផល (PDF)" className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1">
                {resultsPdfBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} ទាញយករបាយការណ៍
              </button>
              <button onClick={() => loadSubs(resultsFor)} disabled={loadingSubs} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700"><RefreshCw size={13} className={loadingSubs ? 'animate-spin' : ''} /></button>
              <button onClick={() => setResultsFor(null)} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700"><X size={13} /></button>
            </div>
          </div>
          {loadingSubs ? <div className="py-6 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div>
            : subs.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">មិនទាន់មានសិស្សប្រគល់ចម្លើយទេ។</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="py-1.5 pr-2">ឈ្មោះ</th><th className="py-1.5 pr-2">ថ្នាក់</th>
                      <th className="py-1.5 pr-2 text-right">ពិន្ទុ</th>
                      <th className="py-1.5 pr-2 text-right">ភាគរយ</th>
                      <th className="py-1.5 pr-2 text-right">មធ្យមភាគ</th>
                      <th className="py-1.5 pr-2 text-center">និទ្ទេស</th>
                      <th className="py-1.5 pr-2 text-right">រយៈពេល</th>
                      <th className="py-1.5 pr-2 text-center" title="ចំនួនដងចាកចេញពី Tab">⚠ Tab</th><th className="py-1.5 text-center">ស្ថានភាព</th>
                    </tr></thead>
                    <tbody>
                      {subs.map(s => {
                        const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
                        const letter = letterOfPct(pct);
                        return (
                        <tr key={s.id} className="border-b border-slate-50">
                          <td className="py-2 pr-2 font-semibold text-slate-700">{s.studentName}</td>
                          <td className="py-2 pr-2 text-slate-500">{s.grade}</td>
                          <td className="py-2 pr-2 text-right font-bold text-slate-800">{toKh(s.score)}/{toKh(s.maxScore)}</td>
                          <td className="py-2 pr-2 text-right font-bold text-slate-600">{toKh(pct)}%</td>
                          <td className="py-2 pr-2 text-right font-bold text-slate-700">{toKh((pct / 10).toFixed(2))}</td>
                          <td className="py-2 pr-2 text-center">
                            <span className="font-black" style={{ color: niddesColor(letter) }}>{letter}</span>
                            <span className="text-[10px] text-slate-400 ml-1">{NIDDES_BAND[letter]}</span>
                          </td>
                          <td className="py-2 pr-2 text-right text-slate-500">{toKh(Math.floor(s.durationUsedSec / 60))}:{toKh(String(s.durationUsedSec % 60).padStart(2, '0'))}</td>
                          <td className={`py-2 pr-2 text-center font-bold ${s.tabSwitches > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{toKh(s.tabSwitches)}</td>
                          <td className="py-2 text-center">{s.autoSubmitted
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">អស់ម៉ោង</span>
                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">បានប្រគល់</span>}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
        </div>
      )}

      {/* Test list */}
      {!draft && tests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
          <ClipboardCheck size={28} className="opacity-50" />
          <p className="text-sm font-medium">មិនទាន់មានតេស្តទេ។ ចុច «តេស្តថ្មី» — សំណួរយកពីធនាគារសំណួរតេស្តស្តង់ដា។</p>
        </div>
      ) : !draft && (
        <div className="space-y-2">
          {tests.map(t => {
            const st = STATUS_UI[t.status];
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{t.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{t.subject}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {t.grades.join(', ')}</span>
                      <span className="flex items-center gap-1"><HelpCircle size={11} /> {toKh(t.status === 'draft' ? t.questionIds.length : (t.questions?.length || t.questionIds.length))} សំណួរ</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {toKh(Math.round(t.durationSec / 60))} នាទី</span>
                      {t.antiCheat && <span className="flex items-center gap-1"><AlertTriangle size={11} /> Anti-cheat</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.status === 'draft' && <>
                      <button onClick={() => startEdit(t)} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100">កែ</button>
                      <button onClick={() => onOpen(t.id)} disabled={busy} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"><PlayCircle size={12} /> បើក</button>
                    </>}
                    {t.status === 'open' && <>
                      {/* An OPEN test may still change its title/classes (e.g. let ២ខ
                          join ២ក's test) — questions/duration/code stay frozen. */}
                      <button onClick={() => startEdit(t)} title="កែចំណងជើង/ថ្នាក់ (សំណួរ និងកូដនៅដដែល)" className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100">កែ</button>
                      <button onClick={() => onCloseTest(t.id)} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1"><StopCircle size={12} /> បិទ</button>
                    </>}
                    {t.status !== 'draft' && <button onClick={() => loadSubs(t)} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1"><BarChart3 size={12} /> លទ្ធផល</button>}
                    <button onClick={() => onDelete(t.id)} title="លុប" className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"><Trash2 size={12} /></button>
                  </div>
                </div>
                {t.status === 'open' && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1"><KeyRound size={12} /> កូដតេស្ត</span>
                    <span className="font-mono text-2xl font-extrabold tracking-[0.35em] text-emerald-800">{t.code}</span>
                    <button onClick={() => copyJoin(t)} className="ml-auto px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1"><Copy size={11} /> ចម្លងតំណ</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
        <CheckCircle2 size={11} /> សិស្សចូលតាម {window.location.origin}/?join=កូដ ឬប៊ូតុង «សិស្ស — ចូលធ្វើតេស្ត» នៅទំព័រ Login
      </p>
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: 'tests' | 'bank'; setTab: (t: 'tests' | 'bank') => void }) {
  const cls = (on: boolean) => `flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 ${on ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`;
  return (
    <div className="flex gap-1 p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button onClick={() => setTab('tests')} className={cls(tab === 'tests')}><ClipboardCheck size={14} /> តេស្ត Online</button>
      <button onClick={() => setTab('bank')} className={cls(tab === 'bank')}><HelpCircle size={14} /> ធនាគារសំណួរ</button>
    </div>
  );
}
