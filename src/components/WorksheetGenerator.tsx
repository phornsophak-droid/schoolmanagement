/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Printer, X, Download, Loader2, Sparkles, Save, KeyRound, FileText, Trash2, BookMarked, ChevronDown, HelpCircle } from 'lucide-react';
import { SchoolUser } from '../types';
import SchoolLogo from './SchoolLogo';
import FitToWidth from './FitToWidth';
import { exportElementToPdf } from '../utils/exportPdf';
import {
  WorksheetParams, WorksheetType, Difficulty, WSLanguage, WSQuestion, Worksheet,
  TYPE_LABELS, DIFFICULTY_LABELS, LANGUAGE_LABELS, SUBJECTS,
  saveWorksheet, generateFromBank,
  ExamPeriod, ExamSection, EXAM_PERIOD_LABELS, generateExam,
} from '../lib/worksheets';
import { bulkAddQuestions } from '../lib/questionBank';
import { curriculumSubjects, lessonsFor, lessonMaterial, refreshCurriculumFromCloud } from '../lib/curriculum';
import { hasGemini } from '../lib/gemini';
import { getOllamaModel, ollamaReachable } from '../lib/ollama';
import { LessonSource, loadLessons, refreshLessonsFromCloud, saveLesson, deleteLesson } from '../lib/lessons';

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
  // When true, render inline as a page (for the sidebar menu) instead of a
  // full-screen modal overlay.
  embedded?: boolean;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const A4_WIDTH = 794; // px @96dpi — pinned width for a crisp, consistent PDF/print
const OPT_LETTERS = ['ក', 'ខ', 'គ', 'ឃ', 'ង'];

// ---------------------------------------------------------------------------
// Word (.doc) export — build clean, EDITABLE Word HTML from the worksheet data
// (not by scraping the Tailwind DOM, whose utility classes carry no styling into
// Word). The teacher opens it in Microsoft Word, edits freely, then prints.
// ---------------------------------------------------------------------------
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const wordBlankLines = (n: number) =>
  Array.from({ length: n }, () => `<div style="border-bottom:1px solid #000;height:15pt">&nbsp;</div>`).join('');

// One question rendered as a two-column table row: number | body.
const qToWord = (q: WSQuestion, type: WorksheetType, num: number, showAns: boolean): string => {
  const n = toKh(num);
  if (q.pairs) {
    const lefts = q.pairs.map((p, j) => `<div>${n}.${toKh(j + 1)} ${esc(p.left)} ........</div>`).join('');
    const rights = [...q.pairs].map(p => p.right).sort(() => Math.random() - 0.5).map((r, j) => `<div>${OPT_LETTERS[j] || '•'}. ${esc(r)}</div>`).join('');
    return `<tr><td valign="top" style="width:24pt"><b>${n}.</b></td><td><table width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="50%">${lefts}</td><td valign="top" width="50%">${rights}</td></tr></table></td></tr>`;
  }
  let inner = `<div style="font-weight:600">${esc(q.prompt)}</div>`;
  if (q.options) {
    const cells = q.options.map((o, j) => `${OPT_LETTERS[j]}. ${esc(o)}`);
    let rows = '';
    for (let i = 0; i < cells.length; i += 2) rows += `<tr><td width="50%">${cells[i] || ''}</td><td width="50%">${cells[i + 1] || ''}</td></tr>`;
    inner += `<table width="100%" cellspacing="0" cellpadding="2" style="margin-top:3pt">${rows}</table>`;
  } else if (type === 'true_false') {
    inner += `<div style="margin-top:3pt">◯ ត្រូវ &nbsp;&nbsp;&nbsp;&nbsp; ◯ ខុស</div>`;
  } else {
    const lines = type === 'essay' || type === 'writing' || type === 'reading' ? 5 : type === 'short_answer' ? 2 : 1;
    inner += `<div style="margin-top:4pt">${wordBlankLines(lines)}</div>`;
  }
  if (showAns && q.answer) inner += `<div style="margin-top:3pt;color:#047857;font-weight:bold">✔ ចម្លើយ៖ ${esc(q.answer)}</div>`;
  return `<tr><td valign="top" style="width:24pt"><b>${n}.</b></td><td>${inner}</td></tr>`;
};

const qListTable = (rows: string) => `<table width="100%" cellspacing="0" cellpadding="4" style="margin-top:6pt">${rows}</table>`;

interface WordDocInput {
  heading: string; instructions: string; params: WorksheetParams; teacherName: string;
  questions: WSQuestion[]; examSections: ExamSection[] | null; examPeriod: ExamPeriod | null; showAnswers: boolean;
}

const buildWordHtml = (d: WordDocInput): string => {
  const { heading, instructions, params, teacherName, questions, examSections, examPeriod, showAnswers } = d;
  const totalPoints = examSections ? examSections.reduce((n, s) => n + s.points, 0) : questions.length;
  const header = `
    <table width="100%" cellspacing="0" cellpadding="0" style="border-bottom:2px solid #000;padding-bottom:4pt">
      <tr>
        <td valign="top"><b style="font-size:15pt">សាលាសហគមន៍ច្បារច្រុះ</b><br/><span style="font-size:10pt;color:#555">Chbar Chros Community School</span></td>
        <td valign="top" align="right" style="font-size:11pt">
          <div><b>មុខវិជ្ជា៖</b> ${esc(params.subject)}</div>
          <div><b>ថ្នាក់៖</b> ${esc(params.grade)}</div>
          ${params.lesson ? `<div><b>មេរៀន៖</b> ${esc(params.lesson)}</div>` : ''}
        </td>
      </tr>
    </table>`;
  const titleBlock = `
    <h1 style="text-align:center;font-size:17pt;margin:8pt 0 2pt">${esc(heading)}</h1>
    ${examPeriod ? `<p style="text-align:center;font-size:11pt;color:#555;margin:0 0 6pt">វិញ្ញាសាប្រឡង${esc(EXAM_PERIOD_LABELS[examPeriod])} • ឆ្នាំសិក្សា ២០២៥-២០២៦</p>` : ''}`;
  const infoLine = `
    <table width="100%" cellspacing="0" cellpadding="0" style="border-bottom:1px solid #999;padding-bottom:4pt;font-size:11pt">
      <tr>
        <td>ឈ្មោះសិស្ស៖ ..............................</td>
        <td align="center">ថ្ងៃទី៖ ......../......../........</td>
        <td align="right">ពិន្ទុ៖ ......... / ${toKh(totalPoints)}${teacherName && !examSections ? ` &nbsp; គ្រូ៖ ${esc(teacherName)}` : ''}</td>
      </tr>
    </table>`;
  const instr = instructions ? `<p style="font-style:italic;font-size:11.5pt;margin:6pt 0">សេចក្ដីណែនាំ៖ ${esc(instructions)}</p>` : '';

  let body = '';
  if (examSections) {
    body = examSections.map((sec, si) => {
      const rows = sec.questions.map((q, i) => qToWord(q, sec.type, i + 1, showAnswers)).join('');
      return `
        <h2 style="font-size:13pt;background:#eef2f7;padding:3pt 6pt;margin:12pt 0 0">ផ្នែកទី ${toKh(si + 1)}៖ ${esc(sec.label)} <span style="font-weight:normal;font-size:10pt;color:#666">(${toKh(sec.points)} ពិន្ទុ)</span></h2>
        ${qListTable(rows)}`;
    }).join('');
  } else {
    body = qListTable(questions.map((q, i) => qToWord(q, params.type, i + 1, showAnswers)).join(''));
  }

  let answerKey = '';
  if (showAnswers) {
    const keyList = (qs: WSQuestion[]) => `<table width="100%" cellspacing="0" cellpadding="2" style="font-size:11.5pt"><tr><td valign="top" width="50%">${qs.filter((_, i) => i % 2 === 0).map((q, i) => `<div><b>${toKh(i * 2 + 1)}.</b> ${q.pairs ? esc(q.pairs.map(p => `${p.left}→${p.right}`).join('; ')) : esc(q.answer || '—')}</div>`).join('')}</td><td valign="top" width="50%">${qs.filter((_, i) => i % 2 === 1).map((q, i) => `<div><b>${toKh(i * 2 + 2)}.</b> ${q.pairs ? esc(q.pairs.map(p => `${p.left}→${p.right}`).join('; ')) : esc(q.answer || '—')}</div>`).join('')}</td></tr></table>`;
    const inner = examSections
      ? examSections.map((sec, si) => `<div style="font-weight:bold;font-size:11.5pt;margin-top:6pt">ផ្នែកទី ${toKh(si + 1)}៖ ${esc(sec.label)}</div>${keyList(sec.questions)}`).join('')
      : keyList(questions);
    answerKey = `<div style="margin-top:16pt;border-top:2px dashed #888;padding-top:8pt"><h2 style="font-size:14pt;margin:0 0 4pt">🔑 កូនសោចម្លើយ (Answer Key)</h2>${inner}</div>`;
  }

  const style = `@page{size:A4;margin:1.6cm} body{font-family:'Khmer OS Battambang','Battambang',serif;font-size:13pt;color:#000;line-height:1.5} h1,h2{font-family:'Khmer OS Battambang','Battambang',serif} table{border-collapse:collapse}`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(heading)}</title><style>${style}</style></head><body>${header}${titleBlock}${infoLine}${instr}${body}${answerKey}</body></html>`;
};

// Blank writing lines for hand-written answers (printer-friendly underlines).
const Lines: React.FC<{ n: number }> = ({ n }) => (
  <div className="space-y-3 mt-2">
    {Array.from({ length: n }, (_, i) => <div key={i} className="border-b border-slate-400 h-0" />)}
  </div>
);

// One printable question row — shared by the worksheet body and each exam section.
const QRow: React.FC<{ q: WSQuestion; type: WorksheetType; num: number; showAns: boolean }> = ({ q, type, num, showAns }) => (
  <li className="break-inside-avoid flex gap-2">
    <span className="font-bold shrink-0">{toKh(num)}.</span>
    <div className="flex-1 min-w-0">
      {q.pairs ? (
        <div className="grid grid-cols-2 gap-x-8">
          <div className="space-y-2">{q.pairs.map((p, j) => <div key={j}>{toKh(num)}.{toKh(j + 1)} {p.left} ........</div>)}</div>
          <div className="space-y-2">{[...q.pairs].map(p => p.right).sort(() => Math.random() - 0.5).map((r, j) => <div key={j}>{OPT_LETTERS[j] || '•'}. {r}</div>)}</div>
        </div>
      ) : (
        <>
          <div className="font-medium">{q.prompt}</div>
          {q.options ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1 pl-1">
              {q.options.map((o, j) => <div key={j} className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 border border-slate-500 rounded-full text-[9pt] text-center leading-4">{OPT_LETTERS[j]}</span> {o}</div>)}
            </div>
          ) : type === 'true_false' ? (
            <div className="flex gap-6 mt-1 pl-1"><span>◯ ត្រូវ</span><span>◯ ខុស</span></div>
          ) : (
            <Lines n={type === 'essay' || type === 'writing' || type === 'reading' ? 5 : type === 'short_answer' ? 2 : 1} />
          )}
          {showAns && q.answer && <div className="ws-no-print mt-1 text-[10pt] font-bold text-emerald-700">✔ ចម្លើយ៖ {q.answer}</div>}
        </>
      )}
    </div>
  </li>
);

export default function WorksheetGenerator({ grades, currentUser, onClose, embedded }: Props) {
  const teacherName = currentUser?.name || '';
  const generalGrades = useMemo(() => (grades.length ? grades : ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣']), [grades]);
  // Subjects come from the Curriculum Manager (falls back to the built-in SUBJECTS).
  // Loaded via state so an IndexedDB-backed curriculum shows once hydrated.
  const [subjectList, setSubjectList] = useState<string[]>(() => curriculumSubjects());
  useEffect(() => { refreshCurriculumFromCloud().then(() => setSubjectList(curriculumSubjects())); }, []);

  // ---- Generation parameters ----
  const [params, setParams] = useState<WorksheetParams>({
    grade: generalGrades[0] || 'ថ្នាក់ទី១',
    subject: subjectList[0] || SUBJECTS[0],
    lesson: '',
    topic: '',
    language: 'km',
    difficulty: 'easy',
    count: 10,
    type: 'multiple_choice',
    types: ['multiple_choice'],
    source: '',
  });
  const set = <K extends keyof WorksheetParams>(k: K, v: WorksheetParams[K]) => setParams(p => ({ ...p, [k]: v }));

  // ---- Worksheet header / content ----
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<WSQuestion[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  // Exam-paper mode (វិញ្ញាសាប្រឡង ប្រចាំខែ/ឆមាស/ឆ្នាំ) — mixed-type sections.
  const [examSections, setExamSections] = useState<ExamSection[] | null>(null);
  const [examPeriod, setExamPeriod] = useState<ExamPeriod | null>(null);

  // ---- Status ----
  const [loading, setLoading] = useState(false);
  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const toggleType = (t: WorksheetType) => {
    const current = params.types || [params.type];
    let next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
    if (next.length === 0) next = [t]; // enforce at least one
    setParams(p => ({
      ...p,
      types: next,
      type: next.length > 1 ? 'mixed' : next[0],
    }));
  };

  const typeLabel = (params.types?.length || 1) > 1 ? `ចម្រុះ (${params.types?.length || 0})` : TYPE_LABELS[params.type].split('(')[0].trim();

  const [pdfBusy, setPdfBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  // Which engine a generation will use right now (for the status hint). Local
  // Ollama is still tried automatically when reachable (config via localStorage);
  // the in-app Ollama settings UI was removed to keep the page simple.
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'off'>('checking');
  useEffect(() => { ollamaReachable().then(ok => setOllamaStatus(ok ? 'ok' : 'off')); }, []);
  const activeEngine = ollamaStatus === 'ok' ? 'ollama' : hasGemini() ? 'gemini' : 'local';

  // ---- Lesson Library (saved source texts, cloud-synced, tiny) ----
  const [lessons, setLessons] = useState<LessonSource[]>(() => loadLessons());
  const [selectedLessonId, setSelectedLessonId] = useState('');
  useEffect(() => { refreshLessonsFromCloud().then(setLessons); }, []);

  const pickLesson = (id: string) => {
    setSelectedLessonId(id);
    const ls = lessons.find(l => l.id === id);
    if (ls) {
      set('source', ls.content);
      if (ls.subject) set('subject', ls.subject);
      if (ls.grade && generalGrades.includes(ls.grade)) set('grade', ls.grade);
    }
  };

  const saveCurrentLesson = async () => {
    const content = (params.source || '').trim();
    if (!content) { flash('ប្រអប់ «មាតិកាមេរៀន» ទទេ — សូមបិទភ្ជាប់អត្ថបទជាមុនសិន', false); return; }
    const def = params.lesson || params.topic || `${params.subject} — ${params.grade}`;
    const titleIn = window.prompt('ដាក់ឈ្មោះមេរៀននេះ៖', def);
    if (titleIn === null) return;
    const ls: LessonSource = {
      id: (crypto as any).randomUUID ? crypto.randomUUID() : `ls-${Date.now()}`,
      title: titleIn.trim() || def,
      subject: params.subject, grade: params.grade, content,
      createdBy: teacherName, createdAt: new Date().toISOString(),
    };
    const next = await saveLesson(ls);
    setLessons(next);
    setSelectedLessonId(ls.id);
    flash('បានរក្សាទុកមេរៀនក្នុងបណ្ណាល័យ ✓');
  };

  const removeSelectedLesson = async () => {
    if (!selectedLessonId) return;
    if (!window.confirm('លុបមេរៀននេះចេញពីបណ្ណាល័យ?')) return;
    const next = await deleteLesson(selectedLessonId);
    setLessons(next);
    setSelectedLessonId('');
    flash('បានលុបមេរៀន ✓');
  };

  const heading = title || `សន្លឹកលំហាត់ ${params.subject} — ${params.grade}`;

  // Fall back to the picked curriculum lesson's material as the AI source when the
  // teacher hasn't pasted their own source text.
  const effectiveParams = (): WorksheetParams => {
    if (!(params.source || '').trim() && params.lesson) {
      const mat = lessonMaterial(params.grade, params.subject, params.lesson);
      if (mat) return { ...params, source: mat };
    }
    return params;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setShowAnswers(false);
    setExamSections(null); setExamPeriod(null);
    try {
      const { questions: qs, fromBank, fromAI } = await generateFromBank(effectiveParams());
      setQuestions(qs);
      if (!title) setTitle(`សន្លឹកលំហាត់ ${params.subject}${params.topic ? ` — ${params.topic}` : ''}`);
      flash(`បានបង្កើតលំហាត់ ${toKh(qs.length)} ✓ (ធនាគារ ${toKh(fromBank)} + AI ${toKh(fromAI)})`);
    } catch (e: any) {
      console.error('Worksheet generation failed', e);
      flash(e?.message || 'បង្កើតលំហាត់មិនបានសម្រេច — សូមព្យាយាមម្ដងទៀត។', false);
    } finally {
      setLoading(false);
    }
  };

  // Build a full exam paper (វិញ្ញាសាប្រឡង) for a period — mixed sections.
  const handleGenerateExam = async (period: ExamPeriod) => {
    setLoading(true);
    setShowAnswers(false);
    setQuestions([]);
    try {
      const sections = await generateExam(effectiveParams(), period);
      setExamSections(sections);
      setExamPeriod(period);
      setTitle(`វិញ្ញាសាប្រឡង${EXAM_PERIOD_LABELS[period]} មុខវិជ្ជា${params.subject}`);
      const total = sections.reduce((n, s) => n + s.questions.length, 0);
      flash(`បានបង្កើតវិញ្ញាសា (${toKh(sections.length)} ផ្នែក, ${toKh(total)} សំណួរ) ✓`);
    } catch (e: any) {
      console.error('Exam generation failed', e);
      flash(e?.message || 'បង្កើតវិញ្ញាសាមិនបានសម្រេច — សូមព្យាយាមម្ដងទៀត។', false);
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async () => {
    const el = document.getElementById('worksheet-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToPdf(el, `សន្លឹកលំហាត់_${params.subject}_${params.grade}`, A4_WIDTH); }
    catch (e) { console.error(e); flash('មិនអាចបង្កើត PDF បានទេ', false); }
    finally { setPdfBusy(false); }
  };

  // Export to an editable Word document (.doc). Teacher edits in Word, then prints.
  const handleWord = () => {
    if (!examSections && !questions.length) { flash('សូមបង្កើតជាមុនសិន', false); return; }
    const html = buildWordHtml({ heading, instructions, params, teacherName, questions, examSections, examPeriod, showAnswers });
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${heading}.doc`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    flash('បាននាំចេញ Word ✓ (កែក្នុង Word រួចព្រីន)');
  };

  // Push the current questions into the Question Bank as manual drafts (for a
  // principal to approve). De-duped by bulkAddQuestions, so it's idempotent even
  // though AI questions were already auto-added.
  const handleSaveToBank = async () => {
    const payload = examSections
      ? examSections.flatMap(s => s.questions.map(q => ({ q, type: s.type })))
      : questions.map(q => ({ q, type: params.type }));
    if (!payload.length) { flash('សូមបង្កើតជាមុនសិន', false); return; }
    const added = await bulkAddQuestions(payload.map(({ q, type }) => ({
      prompt: q.prompt, options: q.options, pairs: q.pairs, answer: q.answer,
      grade: params.grade, subject: params.subject, lesson: params.lesson || undefined,
      type, difficulty: params.difficulty,
      status: 'draft' as const, source: 'manual' as const, createdBy: teacherName,
    })));
    flash(added ? `បានរក្សាទុក ${toKh(added)} សំណួរចូលធនាគារ (ព្រាង) ✓` : 'សំណួរទាំងនេះមានក្នុងធនាគាររួចហើយ');
  };

  const handleSave = async () => {
    const flat = examSections ? examSections.flatMap(s => s.questions) : questions;
    if (!flat.length) { flash('សូមបង្កើតជាមុនសិន', false); return; }
    const ws: Worksheet = {
      id: (crypto as any).randomUUID ? crypto.randomUUID() : `ws-${Date.now()}`,
      title: heading, instructions, params, questions: flat,
      createdBy: teacherName, createdAt: new Date().toISOString(),
    };
    const ok = await saveWorksheet(ws);
    flash(ok ? 'បានរក្សាទុកក្នុង Cloud ✓' : 'រក្សាទុកមិនបាន (មិនបានភ្ជាប់ Cloud ឬតារាងមិនទាន់បង្កើត)', ok);
  };

  // Reusable styled controls (match the app's slate/indigo form style).
  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:border-indigo-500 outline-none transition-colors';
  const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">{label}</span>
      {children}
    </label>
  );

  const printCss = `@media print {
    @page { size: A4 portrait; margin: 12mm; }
    body * { visibility: hidden !important; }
    #worksheet-print, #worksheet-print * { visibility: visible !important; }
    #worksheet-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
    .rc-fit-outer, .rc-fit-frame, .rc-fit-inner { width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; transform: none !important; }
    .ws-no-print { display: none !important; }
  }`;

  return (
    <div className={embedded ? 'w-full' : 'fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start'}>
      <style>{printCss}</style>
      <div className="w-full max-w-3xl mx-auto space-y-3">
        {/* Toolbar */}
        <div className="ws-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Sparkles size={15} className="text-indigo-500" /> ម៉ាស៊ីនបង្កើតសន្លឹកលំហាត់ (AI Worksheet)</h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <a href="https://gemini.google.com/gem/1kp1UXGuq_Zli7s5gY3NUpeko2wVZseyb?usp=sharing" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center gap-1.5 transition-colors border border-purple-200 shadow-sm">✨ Gemini</a>
            <a href="https://notebooklm.google.com/notebook/68210444-9d69-4e1f-bc7d-528d392678cd/preview" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center gap-1.5 transition-colors border border-teal-200 shadow-sm">✨ NotebookLM</a>
            {(questions.length > 0 || examSections) && <>
              <button onClick={() => setShowAnswers(s => !s)} className={`px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 border transition-colors ${showAnswers ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'}`}>
                <KeyRound size={13} /> {showAnswers ? 'លាក់ចម្លើយ' : 'កូនសោចម្លើយ'}
              </button>
              <button onClick={handlePdf} disabled={pdfBusy} className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 shadow-sm">
                {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
              </button>
              <button onClick={handleWord} title="នាំចេញជា Word ដែលកែបានមុនព្រីន" className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"><FileText size={13} /> Word</button>
              <button onClick={() => window.print()} className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1.5 shadow-sm"><Printer size={13} /> បោះពុម្ព</button>
              <button onClick={handleSaveToBank} title="រក្សាទុកសំណួរទាំងនេះចូលធនាគារសំណួរ (ជាព្រាង)" className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm"><HelpCircle size={13} /> ចូលធនាគារ</button>
              <button onClick={handleSave} className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Save size={13} /> រក្សាទុក</button>
            </>}
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
          </div>
        </div>

        {/* Generation form */}
        <div className="ws-no-print bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="ថ្នាក់"><select value={params.grade} onChange={e => set('grade', e.target.value)} className={fieldCls}>{generalGrades.map(g => <option key={g} value={g}>{g}</option>)}</select></Field>
            <Field label="មុខវិជ្ជា"><select value={params.subject} onChange={e => set('subject', e.target.value)} className={fieldCls}>{subjectList.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
            <Field label="ប្រភេទលំហាត់">
              <div className="relative">
                <div onClick={() => setTypeOpen(!typeOpen)} className={`${fieldCls} cursor-pointer flex justify-between items-center bg-white`}>
                  <span className="truncate">{typeLabel}</span>
                  <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${typeOpen ? 'rotate-180' : ''}`} />
                </div>
                {typeOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] bg-white border border-slate-200 shadow-xl rounded-xl z-20 py-1.5 max-h-[400px] overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 font-mono uppercase border-b border-slate-100 mb-1">ជ្រើសរើសប្រភេទ (ច្រើនបាន)</div>
                      {(Object.keys(TYPE_LABELS) as WorksheetType[]).filter(t => t !== 'mixed').map(t => (
                        <label key={t} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-[12px] font-medium text-slate-700 transition-colors">
                          <input type="checkbox" checked={(params.types || [params.type]).includes(t)} onChange={() => toggleType(t)} className="accent-indigo-600 w-4 h-4 rounded-sm border-slate-300" />
                          <span className="truncate">{TYPE_LABELS[t]}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Field>
            <Field label="កម្រិត"><select value={params.difficulty} onChange={e => set('difficulty', e.target.value as Difficulty)} className={fieldCls}>{(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</select></Field>
            <Field label="ភាសា"><select value={params.language} onChange={e => set('language', e.target.value as WSLanguage)} className={fieldCls}>{(Object.keys(LANGUAGE_LABELS) as WSLanguage[]).map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}</select></Field>
            <Field label="ចំនួនសំណួរ"><input type="number" min={1} max={50} value={params.count} onChange={e => set('count', Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className={fieldCls} /></Field>
            <Field label="មេរៀន"><input list="wsg-lessons" value={params.lesson} onChange={e => set('lesson', e.target.value)} placeholder="ឧ. មេរៀនទី ៣" className={fieldCls} /><datalist id="wsg-lessons">{lessonsFor(params.grade, params.subject).map(l => <option key={l.id} value={l.title} />)}</datalist></Field>
            <Field label="ប្រធានបទ"><input value={params.topic} onChange={e => set('topic', e.target.value)} placeholder="ឧ. បូក, អំណាន…" className={fieldCls} /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ចំណងជើង (ស្រេចចិត្ត)"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={heading} className={fieldCls} /></Field>
            <Field label="សេចក្ដីណែនាំ (ស្រេចចិត្ត)"><input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="ឧ. ចូរឆ្លើយសំណួរខាងក្រោម…" className={fieldCls} /></Field>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មាតិកាមេរៀន / វិញ្ញាសារ (ស្រេចចិត្ត)</span>
              <div className="flex items-center gap-1.5">
                <select value={selectedLessonId} onChange={e => pickLesson(e.target.value)} className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold outline-none max-w-[180px]">
                  <option value="">📚 បណ្ណាល័យមេរៀន…</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
                {selectedLessonId && (
                  <button onClick={removeSelectedLesson} title="លុបមេរៀននេះ" className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 size={12} /></button>
                )}
                <button onClick={saveCurrentLesson} title="រក្សាទុកអត្ថបទនេះក្នុងបណ្ណាល័យមេរៀន" className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1"><BookMarked size={12} /> រក្សាទុក</button>
              </div>
            </div>
            <textarea
              value={params.source || ''}
              onChange={e => { set('source', e.target.value); setSelectedLessonId(''); }}
              rows={4}
              placeholder="ជ្រើស «បណ្ណាល័យមេរៀន» ខាងលើ ឬ ចម្លងអត្ថបទមេរៀន/វិញ្ញាសារ (ពីបណ្ណាល័យឯកសារ) បិទភ្ជាប់ទីនេះ។ AI នឹងបង្កើតសំណួរផ្អែកលើអត្ថបទនេះ; ចុច «រក្សាទុក» ដើម្បីប្រើឡើងវិញ។"
              className={`${fieldCls} resize-y leading-relaxed`}
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-slate-400">
              {activeEngine === 'ollama' ? `⚡ កំពុងប្រើ Ollama ក្នុងស្រុក (${getOllamaModel()}) — ឥតគិតថ្លៃ និងឯកជន។`
                : activeEngine === 'gemini' ? '⚡ ប្រើ AI (Gemini free)។ គណិតវិទ្យាដំណើរការដោយឥតគិតថ្លៃផងដែរ។'
                : 'ℹ️ គ្មាន AI — គណិតវិទ្យាដំណើរការដោយឥតគិតថ្លៃ; មុខវិជ្ជាផ្សេងត្រូវការ Ollama ឬ Gemini key។'}
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={handleGenerate} disabled={loading} className="px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-60 text-white flex items-center gap-2 shadow-md">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} បង្កើតលំហាត់
              </button>
              {/* Exam paper — period (ខែ/ឆមាស/ឆ្នាំ) picked from this button's dropdown. */}
              <div className="relative">
                <button onClick={() => setExamMenuOpen(o => !o)} disabled={loading} className="px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:opacity-60 text-white flex items-center gap-2 shadow-md">
                  <FileText size={16} /> បង្កើតវិញ្ញាសាប្រឡង <ChevronDown size={14} className={`transition-transform ${examMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {examMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setExamMenuOpen(false)} />
                    <div className="absolute right-0 bottom-full mb-2 z-20 min-w-[190px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 overflow-hidden">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 font-mono uppercase">📄 វិញ្ញាសាប្រឡង</div>
                      {(['month', 'semester', 'year'] as ExamPeriod[]).map(p => (
                        <button key={p} onClick={() => { setExamMenuOpen(false); handleGenerateExam(p); }} disabled={loading} className="w-full text-left px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60 flex items-center gap-2">
                          <FileText size={13} /> {EXAM_PERIOD_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {toast &&<div className={`ws-no-print text-center text-xs font-bold px-3 py-2 rounded-xl ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{toast.msg}</div>}

        {/* Printable exam paper (វិញ្ញាសា) — mixed sections */}
        {examSections ? (
          <FitToWidth designWidth={A4_WIDTH}>
            <div id="worksheet-print" className="bg-white rounded-2xl shadow-xl text-slate-900 p-10 leading-relaxed" style={{ fontFamily: "'Khmer OS Siemreap','Siemreap',serif", fontSize: '11pt' }}>
              <div className="flex items-center justify-between gap-3 border-b-2 border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <SchoolLogo size={56} />
                  <div className="leading-tight">
                    <div className="font-bold text-[14pt]">សាលាសហគមន៍ច្បារច្រុះ</div>
                    <div className="text-[10pt] text-slate-500">Chbar Chros Community School</div>
                  </div>
                </div>
                <div className="text-right text-[10pt] space-y-0.5">
                  <div><span className="font-semibold">មុខវិជ្ជា៖</span> {params.subject}</div>
                  <div><span className="font-semibold">ថ្នាក់៖</span> {params.grade}</div>
                </div>
              </div>
              <h1 className="text-center text-[14pt] font-extrabold my-2">{heading}</h1>
              {examPeriod && <p className="text-center text-[10pt] text-slate-600 mb-3">វិញ្ញាសាប្រឡង{EXAM_PERIOD_LABELS[examPeriod]} • ឆ្នាំសិក្សា ២០២៥-២០២៦</p>}
              <div className="flex flex-wrap justify-between text-[11pt] gap-x-6 gap-y-1 border-b border-slate-300 pb-2 mb-2">
                <span>ឈ្មោះសិស្ស៖ ......................................</span>
                <span>ថ្ងៃទី៖ ............ /............ /............</span>
                <span>ពិន្ទុ៖ ............ / {toKh(examSections.reduce((n, s) => n + s.points, 0))}</span>
              </div>
              {instructions && <p className="text-[11pt] italic text-slate-700 my-2">សេចក្ដីណែនាំ៖ {instructions}</p>}
              {examSections.map((sec, si) => (
                <div key={si} className="mt-4">
                  <h2 className="font-extrabold text-[12pt] bg-slate-100 px-2 py-1 rounded">ផ្នែកទី {toKh(si + 1)}៖ {sec.label} <span className="font-normal text-[10pt] text-slate-500">({toKh(sec.points)} ពិន្ទុ)</span></h2>
                  <ol className="mt-3 space-y-3">
                    {sec.questions.map((q, i) => <QRow key={i} q={q} type={sec.type} num={i + 1} showAns={showAnswers} />)}
                  </ol>
                </div>
              ))}
              {showAnswers && (
                <div className="mt-6 pt-3 border-t-2 border-dashed border-slate-400">
                  <h2 className="font-extrabold text-[13pt] mb-2">🔑 កូនសោចម្លើយ (Answer Key)</h2>
                  {examSections.map((sec, si) => (
                    <div key={si} className="mb-2">
                      <div className="font-bold text-[11pt]">ផ្នែកទី {toKh(si + 1)}៖ {sec.label}</div>
                      <ol className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10pt]">
                        {sec.questions.map((q, i) => <li key={i}><span className="font-bold">{toKh(i + 1)}.</span> {q.pairs ? q.pairs.map(p => `${p.left}→${p.right}`).join('; ') : q.answer || '—'}</li>)}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FitToWidth>
        ) : questions.length === 0 ? (
          <div className="ws-no-print bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
            <FileText size={28} className="opacity-50" />
            <p className="text-sm font-medium">ជ្រើសរើសលក្ខណៈ រួចចុច «បង្កើតលំហាត់» ដើម្បីបង្ហាញសន្លឹកលំហាត់នៅទីនេះ។</p>
          </div>
        ) : (
          <FitToWidth designWidth={A4_WIDTH}>
            <div id="worksheet-print" className="bg-white rounded-2xl shadow-xl text-slate-900 p-10 leading-relaxed" style={{ fontFamily: "'Khmer OS Siemreap','Siemreap',serif", fontSize: '11pt' }}>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b-2 border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <SchoolLogo size={56} />
                  <div className="leading-tight">
                    <div className="font-bold text-[13pt]">សាលាសហគមន៍ច្បារច្រុះ</div>
                    <div className="text-[9pt] text-slate-500">Chbar Chros Community School</div>
                  </div>
                </div>
                <div className="text-right text-[10pt] space-y-0.5">
                  <div><span className="font-semibold">មុខវិជ្ជា៖</span> {params.subject}</div>
                  <div><span className="font-semibold">ថ្នាក់៖</span> {params.grade}</div>
                  {params.lesson && <div><span className="font-semibold">មេរៀន៖</span> {params.lesson}</div>}
                </div>
              </div>

              <h1 className="text-center text-[18px] font-extrabold my-3">{heading}</h1>

              <div className="flex flex-wrap justify-between text-[12px] gap-x-6 gap-y-1 border-b border-slate-300 pb-2 mb-1">
                <span>ឈ្មោះសិស្ស៖ ......................................</span>
                <span>ថ្ងៃទី៖ ............ /............ /............</span>
                <span>ពិន្ទុ៖ ............ / {toKh(questions.length)}</span>
                <span>គ្រូ៖ {teacherName || '....................'}</span>
              </div>
              {instructions && <p className="text-[12.5px] italic text-slate-700 my-2">សេចក្ដីណែនាំ៖ {instructions}</p>}

              {/* Body */}
              <ol className="mt-3 space-y-4 text-[13.5px]">
                {questions.map((q, i) => <QRow key={i} q={q} type={params.type} num={i + 1} showAns={showAnswers} />)}
              </ol>

              {/* Answer key page (when toggled) — clean list for the teacher */}
              {showAnswers && (
                <div className="mt-6 pt-3 border-t-2 border-dashed border-slate-400">
                  <h2 className="font-extrabold text-[15px] mb-2">🔑 កូនសោចម្លើយ (Answer Key)</h2>
                  <ol className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12.5px]">
                    {questions.map((q, i) => (
                      <li key={i}><span className="font-bold">{toKh(i + 1)}.</span> {q.pairs ? q.pairs.map(p => `${p.left}→${p.right}`).join('; ') : q.answer || '—'}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </FitToWidth>
        )}
      </div>
    </div>
  );
}
