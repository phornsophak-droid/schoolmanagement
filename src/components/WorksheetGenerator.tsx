/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Printer, X, Download, Loader2, Sparkles, Save, KeyRound, FileText, Trash2, BookMarked, ChevronDown, HelpCircle, ClipboardList } from 'lucide-react';
import { SchoolUser } from '../types';
import SchoolLogo from './SchoolLogo';
import logoPng from '../assets/logo.png';
import FitToWidth from './FitToWidth';
import { exportElementToMultipagePdf } from '../utils/exportPdf';
import { extractTextFromFile, extractDocxHtml } from '../lib/extractText';
import {
  WorksheetParams, WorksheetType, Difficulty, WSLanguage, WSQuestion, Worksheet,
  TYPE_LABELS, DIFFICULTY_LABELS, LANGUAGE_LABELS, SUBJECTS,
  saveWorksheet, generateFromBank, parsePastedQuestions,
  ExamPeriod, ExamSection, EXAM_PERIOD_LABELS, generateExam,
} from '../lib/worksheets';
import { bulkAddQuestions } from '../lib/questionBank';
import { curriculumSubjects, lessonsFor, lessonMaterial, refreshCurriculumFromCloud } from '../lib/curriculum';
import { hasGemini } from '../lib/gemini';
import { getOllamaModel, ollamaReachable } from '../lib/ollama';
import { LessonSource, loadLessons, refreshLessonsFromCloud, saveLesson, deleteLesson } from '../lib/lessons';

// Turn a raw AI error into a short Khmer message. The Gemini free tier is only
// ~20 requests/day per model, so a 429 / RESOURCE_EXHAUSTED is the common case.
const friendlyAiError = (e: any, fallback: string): string => {
  const msg = String(e?.message || e || '');
  if (/RESOURCE_EXHAUSTED|["']?code["']?\s*:\s*429|\bquota\b|rate.?limit/i.test(msg)) {
    return 'AI (Gemini free) បានប្រើអស់កូតាថ្ងៃនេះ (~២០ដង/ថ្ងៃ)។ សូមព្យាយាមម្ដងទៀតនៅថ្ងៃស្អែក ឬប្ដូរគំរូ/ដាក់ key ផ្សេង។ (ការបង្កើតពីធនាគារវិញ្ញាសានៅដំណើរការធម្មតា)';
  }
  return msg || fallback;
};

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
  // When true, render inline as a page (for the sidebar menu) instead of a
  // full-screen modal overlay.
  embedded?: boolean;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
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

// A labelled form-field wrapper. MUST stay at module scope: defining it inside the
// component re-created the component type on every render, so React remounted the
// inputs and focus was lost after a single keystroke ("វាយអក្សរអត់បាន").
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">{label}</span>
    {children}
  </label>
);

// When importing an exam (.docx → HTML), the file carries its OWN header (national
// header, office hierarchy, name/class fields). Drop everything before the FIRST
// section list (<ol>) or the FIRST numbered question <p>, so only the questions
// remain — we prepend the school header instead.
const stripImportedHeader = (html: string): string => {
  const olIdx = html.search(/<ol[\s>]/i);
  let pIdx = -1;
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const txt = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/^[១-៩0-9]{1,3}\s*[.)．៖:]/.test(txt)) { pIdx = m.index; break; }
  }
  const candidates = [olIdx, pIdx].filter(i => i >= 0).sort((a, b) => a - b);
  return candidates.length ? html.slice(candidates[0]) : html;
};

// Sum the section-heading point markers "(N ពិន្ទុ)" inside <li> elements so the
// imported exam's total shows in the points badge (0 → badge shows a blank line).
const detectTotalPoints = (html: string): number => {
  const khToNum = (s: string) => Number(s.replace(/[០-៩]/g, d => String('០១២៣៤៥៦៧៨៩'.indexOf(d))));
  let total = 0;
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html))) {
    const pm = m[1].replace(/<[^>]+>/g, '').match(/([\d០-៩]+(?:[.។][\d០-៩]+)?)\s*ពិន្ទុ/);
    if (pm) total += khToNum(pm[1].replace('។', '.')) || 0;
  }
  return Math.round(total);
};

// Guess the exam period from the imported header text (ឆមាស / ចុងឆ្នាំ / else month).
const detectExamPeriod = (html: string): ExamPeriod => {
  const t = html.replace(/<[^>]+>/g, '');
  if (/ឆមាស/.test(t)) return 'semester';
  if (/ប្រចាំឆ្នាំ|ចុងឆ្នាំ|ប្រឡងឆ្នាំ/.test(t)) return 'year';
  return 'month';
};

const PrintHeader = ({ params, heading, totalPoints, examPeriod, teacherName, duration, month }: { params: WorksheetParams; heading: string; totalPoints: number; examPeriod: ExamPeriod | null; teacherName: string; duration?: string; month?: string }) => {
  const dotted = 'inline-block border-b border-dotted border-slate-500 align-bottom';
  // Shared centered school identity block (logo + Khmer/English name + motto).
  const Identity = () => (
    <>
      <div className="flex items-center justify-center gap-4 text-center">
        <SchoolLogo size={74} />
        <div className="leading-tight">
          <div className="text-[18pt] font-bold text-[#1e3a8a]" style={{ fontFamily: "'Moul', serif" }}>សាលាសហគមន៍ច្បារច្រុះ</div>
          <div className="text-[12pt] font-bold tracking-wide text-slate-800 font-sans">CHBAR CHROS COMMUNITY SCHOOL</div>
          <div className="text-[10pt] italic text-slate-500">“វិជ្ជាសម្បទា បំណិនសម្បទា ចរិយាសម្បទា”</div>
        </div>
      </div>
      <div className="border-t-2 border-slate-800 mt-3" />
    </>
  );

  // WORKSHEET template — WORKSHEET label row, dotted-line fields, points badge.
  if (!examPeriod) {
    return (
      <>
        <Identity />
        <div className="flex justify-between items-center font-bold text-[13pt] py-2.5">
          <div>📖 សន្លឹកកិច្ចការ{month ? ` ប្រចាំខែ${month}` : ''}</div>
          <div>ឆ្នាំសិក្សា ២០២៥-២០២៦</div>
        </div>
        <div className="text-[12pt] leading-[2.4]">
          <div className="flex gap-8">
            <span className="whitespace-nowrap">មុខវិជ្ជា៖ <span className={`${dotted} min-w-[130px] px-2 text-center`}>{params.subject}</span></span>
            <span className="whitespace-nowrap">ថ្នាក់៖ <span className={`${dotted} min-w-[110px] px-2 text-center`}>{params.grade}</span></span>
            <span className="whitespace-nowrap flex-1">លេខ៖ <span className={`${dotted} flex-1`} style={{ minWidth: '90px' }}>&nbsp;</span></span>
          </div>
          <div>ឈ្មោះសិស្ស៖ <span className={dotted} style={{ width: '76%' }}>&nbsp;</span></div>
          <div className="flex gap-8">
            <span className="whitespace-nowrap flex-1">គ្រូបង្រៀន៖ <span className={`${dotted} px-2`} style={{ minWidth: '220px' }}>{teacherName || ' '}</span></span>
            <span className="whitespace-nowrap">កាលបរិច្ឆេទ៖ ____ /____ /______</span>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl px-5 py-2 text-[12pt] font-bold text-slate-700">
            ⭐ ពិន្ទុ៖ <span className={dotted} style={{ width: '90px' }}>&nbsp;</span> / {totalPoints ? toKh(totalPoints) : <span className={dotted} style={{ width: '40px' }}>&nbsp;</span>}
          </div>
        </div>
        <div className="border-t-2 border-slate-800 mt-3" />
        <h1 className="text-center text-[14pt] font-extrabold my-3">{heading}</h1>
      </>
    );
  }

  // EXAM template — same identity, an EXAM label row, an exam subtitle, then the
  // official exam fields (room/desk/candidate/duration) and a points badge.
  return (
    <>
      <Identity />
      <div className="flex justify-between items-center font-bold text-[13pt] py-2.5">
        <div>📝 វិញ្ញាសាប្រឡង</div>
        <div>ឆ្នាំសិក្សា ២០២៥-២០២៦</div>
      </div>
      <div className="text-center font-bold text-[13pt] leading-[1.9] mb-1">
        <div>{month ? `ប្រឡងប្រចាំខែ${month}` : `ប្រឡង${EXAM_PERIOD_LABELS[examPeriod]}`}</div>
        <div>មុខវិជ្ជា {params.subject}</div>
        <div className="text-[11pt] font-normal">រយៈពេល {duration ? `${toKh(duration)} ` : '..................... '}នាទី</div>
      </div>
      <div className="text-[12pt] leading-[2.4]">
        <div className="flex gap-8">
          <span className="whitespace-nowrap">លេខបន្ទប់៖ <span className={`${dotted} min-w-[90px]`}>&nbsp;</span></span>
          <span className="whitespace-nowrap">លេខតុ៖ <span className={`${dotted} min-w-[90px]`}>&nbsp;</span></span>
          <span className="whitespace-nowrap flex-1">ថ្នាក់៖ <span className={`${dotted} flex-1`} style={{ minWidth: '110px' }}>&nbsp;</span></span>
        </div>
        <div>នាមត្រកូល និងនាមខ្លួន៖ <span className={dotted} style={{ width: '68%' }}>&nbsp;</span></div>
        <div className="flex gap-8">
          <span className="whitespace-nowrap flex-1">ថ្ងៃខែឆ្នាំកំណើត៖ ____ /____ /______</span>
          <span className="whitespace-nowrap">ហត្ថលេខាបេក្ខជន៖ <span className={`${dotted} min-w-[150px]`}>&nbsp;</span></span>
        </div>
        <div>កាលបរិច្ឆេទប្រឡង៖ ____ /____ /______</div>
      </div>
      <div className="flex justify-end mt-3">
        <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl px-5 py-2 text-[12pt] font-bold text-slate-700">
          ⭐ ពិន្ទុ៖ <span className={dotted} style={{ width: '90px' }}>&nbsp;</span> / {totalPoints ? toKh(totalPoints) : <span className={dotted} style={{ width: '40px' }}>&nbsp;</span>}
        </div>
      </div>
      <div className="border-t-2 border-slate-800 mt-3" />
      <h1 className="text-center text-[14pt] font-extrabold my-3">{heading}</h1>
    </>
  );
};

interface WordDocInput {
  heading: string; instructions: string; params: WorksheetParams; teacherName: string;
  questions: WSQuestion[]; examSections: ExamSection[] | null; examPeriod: ExamPeriod | null; showAnswers: boolean;
  month: string; duration: string; logo: string;
  importedBody?: string; importedPoints?: number;
}

const buildWordHtml = (d: WordDocInput): string => {
  const { heading, instructions, params, teacherName, questions, examSections, examPeriod, showAnswers, month, duration, logo, importedBody } = d;
  const totalPoints = importedBody ? (d.importedPoints || 0) : examSections ? examSections.reduce((n, s) => n + s.points, 0) : questions.length;
  const dots = '........................................';
  const rule = '<div style="border-top:2px solid #1f2937;margin:8pt 0"></div>';
  const logoImg = logo ? `<img src="${logo}" width="72" height="72" style="width:72px;height:72px" />` : '';

  // ── Header — mirrors the on-screen / PDF exam & worksheet header ──────────────
  const identity = `
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      <td width="15%" align="center" valign="middle">${logoImg}</td>
      <td align="center" valign="middle">
        <div style="font-weight:bold;font-size:19pt;line-height:1.7;color:#1e3a8a;font-family:'Khmer OS Moul Light','Moul',serif">សាលាសហគមន៍ច្បារច្រុះ</div>
        <div style="font-weight:bold;font-size:11pt;line-height:1.5;letter-spacing:1px;color:#1f2937">CHBAR CHROS COMMUNITY SCHOOL</div>
        <div style="font-style:italic;font-size:9pt;line-height:1.6;color:#64748b">“វិជ្ជាសម្បទា បំណិនសម្បទា ចរិយាសម្បទា”</div>
      </td>
      <td width="15%"></td>
    </tr></table>
    ${rule}
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:4pt"><tr>
      <td style="font-weight:bold;font-size:13pt">${examPeriod ? '📝 វិញ្ញាសាប្រឡង' : '📖 សន្លឹកកិច្ចការ'}</td>
      <td align="right" style="font-weight:bold;font-size:13pt">ឆ្នាំសិក្សា ២០២៥-២០២៦</td>
    </tr></table>`;

  const subtitle = `
    <div style="text-align:center;font-size:13pt;font-weight:bold;line-height:1.7;margin:6pt 0 10pt">
      ${examPeriod
        ? `<div>${month ? `ប្រឡងប្រចាំខែ${esc(month)}` : `ប្រឡង${esc(EXAM_PERIOD_LABELS[examPeriod])}`}</div>
           <div>មុខវិជ្ជា ${esc(params.subject)}</div>
           <div style="font-weight:normal;font-size:11pt">រយៈពេល ${duration ? `${esc(toKh(duration))} ` : '.................... '}នាទី</div>`
        : `<div>${month ? `សន្លឹកកិច្ចការប្រចាំខែ${esc(month)}` : 'សន្លឹកកិច្ចការ'}</div>
           <div>មុខវិជ្ជា ${esc(params.subject)}</div>`}
    </div>`;

  const fields = examPeriod
    ? `<table width="100%" cellspacing="0" cellpadding="2" style="font-size:12pt;line-height:2.2"><tr>
         <td width="33%">លេខបន្ទប់៖ ..................</td>
         <td width="30%">លេខតុ៖ ..................</td>
         <td width="37%">ថ្នាក់៖ ..................</td>
       </tr></table>
       <div style="font-size:12pt;line-height:2.4">នាមត្រកូល និងនាមខ្លួន៖ ${dots}${dots}</div>
       <table width="100%" cellspacing="0" cellpadding="2" style="font-size:12pt;line-height:2.2"><tr>
         <td width="55%">ថ្ងៃខែឆ្នាំកំណើត៖ ......../......../..........</td>
         <td width="45%">ហត្ថលេខាបេក្ខជន៖ ..................</td>
       </tr></table>
       <div style="font-size:12pt;line-height:2.2">កាលបរិច្ឆេទប្រឡង៖ ......../......../..........</div>`
    : `<table width="100%" cellspacing="0" cellpadding="2" style="font-size:12pt;line-height:2.2"><tr>
         <td width="40%">មុខវិជ្ជា៖ <b>${esc(params.subject)}</b></td>
         <td width="35%">ថ្នាក់៖ <b>${esc(params.grade)}</b></td>
         <td width="25%">លេខ៖ ..............</td>
       </tr></table>
       <div style="font-size:12pt;line-height:2.4">ឈ្មោះសិស្ស៖ ${dots}${dots}</div>
       <table width="100%" cellspacing="0" cellpadding="2" style="font-size:12pt;line-height:2.2"><tr>
         <td width="60%">គ្រូបង្រៀន៖ ${esc(teacherName) || dots}</td>
         <td width="40%">កាលបរិច្ឆេទ៖ ....../....../......</td>
       </tr></table>`;

  const points = `
    <table width="100%" cellspacing="0" cellpadding="0" style="margin:8pt 0"><tr><td align="right">
      <span style="border:1.5px solid #f59e0b;background:#fffbeb;padding:5pt 14pt;font-weight:bold;font-size:12pt;color:#334155">⭐ ពិន្ទុ៖ ................. / ${totalPoints ? toKh(totalPoints) : '............'}</span>
    </td></tr></table>`;

  const header = `${identity}${subtitle}${fields}${points}${rule}
    <h1 style="text-align:center;font-size:14pt;margin:6pt 0 12pt">${esc(heading)}</h1>`;
  const instr = instructions ? `<p style="font-style:italic;font-size:11.5pt;margin:6pt 0">សេចក្ដីណែនាំ៖ ${esc(instructions)}</p>` : '';

  let body = '';
  if (importedBody) {
    // Imported exam — keep the original .docx body exactly as converted.
    body = `<div style="font-size:12pt">${importedBody}</div>`;
  } else if (examSections) {
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
  if (showAnswers && !importedBody) {
    const keyList = (qs: WSQuestion[]) => `<table width="100%" cellspacing="0" cellpadding="2" style="font-size:11.5pt"><tr><td valign="top" width="50%">${qs.filter((_, i) => i % 2 === 0).map((q, i) => `<div><b>${toKh(i * 2 + 1)}.</b> ${q.pairs ? esc(q.pairs.map(p => `${p.left}→${p.right}`).join('; ')) : esc(q.answer || '—')}</div>`).join('')}</td><td valign="top" width="50%">${qs.filter((_, i) => i % 2 === 1).map((q, i) => `<div><b>${toKh(i * 2 + 2)}.</b> ${q.pairs ? esc(q.pairs.map(p => `${p.left}→${p.right}`).join('; ')) : esc(q.answer || '—')}</div>`).join('')}</td></tr></table>`;
    const inner = examSections
      ? examSections.map((sec, si) => `<div style="font-weight:bold;font-size:11.5pt;margin-top:6pt">ផ្នែកទី ${toKh(si + 1)}៖ ${esc(sec.label)}</div>${keyList(sec.questions)}`).join('')
      : keyList(questions);
    answerKey = `<div style="margin-top:16pt;border-top:2px dashed #888;padding-top:8pt"><h2 style="font-size:14pt;margin:0 0 4pt">🔑 កូនសោចម្លើយ (Answer Key)</h2>${inner}</div>`;
  }

  const style = `@page{size:A4;margin:1.6cm} body{font-family:'Khmer OS Siemreap','Siemreap',serif;font-size:11pt;color:#000;line-height:1.5} h1,h2{font-family:'Khmer OS Siemreap','Siemreap',serif} table{border-collapse:collapse}`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(heading)}</title><style>${style}</style></head><body>${header}${instr}${body}${answerKey}</body></html>`;
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
    difficulty: 'mixed',
    count: 10,
    type: 'multiple_choice',
    types: ['multiple_choice'],
    source: '',
  });
  const set = <K extends keyof WorksheetParams>(k: K, v: WorksheetParams[K]) => setParams(p => ({ ...p, [k]: v }));

  // ---- Worksheet header / content ----
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  // The count field shows BLANK by default (easier to type into); params.count keeps
  // a fallback so AI generation still has a number if the teacher leaves it empty.
  const [countStr, setCountStr] = useState('');
  const [duration, setDuration] = useState(''); // exam duration in minutes (រយៈពេល)
  const [month, setMonth] = useState(''); // selected Khmer month (ខែ) for the header
  const [questions, setQuestions] = useState<WSQuestion[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  // Exam-paper mode (វិញ្ញាសាប្រឡង ប្រចាំខែ/ឆមាស/ឆ្នាំ) — mixed-type sections.
  const [examSections, setExamSections] = useState<ExamSection[] | null>(null);
  const [examPeriod, setExamPeriod] = useState<ExamPeriod | null>(null);
  // Imported exam body (original .docx formatting preserved as HTML); when set, the
  // preview renders this verbatim under the school header instead of a question list.
  const [importedHtml, setImportedHtml] = useState<string | null>(null);

  // ---- Status ----
  const [loading, setLoading] = useState(false);
  const [examMenuOpen, setExamMenuOpen] = useState(false);
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const toggleType = (t: WorksheetType) => {
    let next = [...(params.types || [params.type])];
    
    if (t === 'mixed') {
      next = ['mixed']; // Checking 'mixed' overrides all others.
    } else {
      next = next.filter(x => x !== 'mixed'); // Uncheck 'mixed' if picking a specific type.
      if (next.includes(t)) {
        next = next.filter(x => x !== t);
      } else {
        next.push(t);
      }
    }
    
    if (next.length === 0) next = ['multiple_choice']; // Enforce at least one
    
    setParams(p => ({
      ...p,
      types: next,
      type: next.length > 1 ? 'mixed' : next[0],
    }));
  };

  const typeLabel = (params.types?.length || 1) > 1 ? `ចម្រុះ (${params.types?.length || 0})` : TYPE_LABELS[params.type].split('(')[0].trim();

  const [pdfBusy, setPdfBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);
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

  // The printed title: the user's custom title if they typed one, otherwise an
  // auto title derived from the CURRENT settings (worksheet vs exam). We never write
  // the auto value back into `title`, so it stays a live default and the user's own
  // title always takes effect.
  const heading = title.trim() || (examPeriod
    ? `វិញ្ញាសា${month ? `ប្រឡងប្រចាំខែ${month}` : `ប្រឡង${EXAM_PERIOD_LABELS[examPeriod]}`} មុខវិជ្ជា${params.subject}`
    : `សន្លឹកលំហាត់ ${params.subject}${params.topic ? ` — ${params.topic}` : ` — ${params.grade}`}`);

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
    setImportedHtml(null);
    setExamSections(null); setExamPeriod(null);
    try {
      const { questions: qs, fromBank, fromAI } = await generateFromBank(effectiveParams());
      setQuestions(qs);
      flash(`បានបង្កើតលំហាត់ ${toKh(qs.length)} ✓ (ធនាគារ ${toKh(fromBank)} + AI ${toKh(fromAI)})`);
    } catch (e: any) {
      console.error('Worksheet generation failed', e);
      flash(friendlyAiError(e, 'បង្កើតលំហាត់មិនបានសម្រេច — សូមព្យាយាមម្ដងទៀត។'), false);
    } finally {
      setLoading(false);
    }
  };

  // "រក្សាសំណួរដើម" — the teacher already has a question list; parse what they
  // pasted into the source box VERBATIM (no AI) and lay it out. `mode` picks the
  // page style: 'worksheet' (សន្លឹកកិច្ចការ) or an exam PERIOD ('month'|'semester'|
  // 'year' → វិញ្ញាសាប្រចាំខែ/ឆមាស/ឆ្នាំ, with the exam header). Both render the same
  // flat question list; only the header differs (driven by examPeriod).
  // Parse `src` verbatim and render it with the school header (exam period or
  // worksheet). Shared by the paste button and the file-import button. Returns
  // false if no questions were found. `quiet` skips the success toast (the caller
  // shows its own, e.g. after an import).
  const applyParsed = (src: string, mode: 'worksheet' | ExamPeriod, quiet = false): boolean => {
    const parsed = parsePastedQuestions(src);
    if (!parsed.questions.length) return false;
    const isExam = mode !== 'worksheet';
    setImportedHtml(null);
    setExamSections(null);
    setExamPeriod(isExam ? mode : null);
    setShowAnswers(false);
    setQuestions(parsed.questions);
    if (parsed.instructions) setInstructions(parsed.instructions);
    set('type', parsed.multipleChoice ? 'multiple_choice' : 'short_answer');
    set('types', parsed.multipleChoice ? ['multiple_choice'] : ['short_answer']);
    if (!quiet) flash(`បានរៀបចំ${isExam ? `វិញ្ញាសា${EXAM_PERIOD_LABELS[mode]}` : 'សន្លឹកកិច្ចការ'} ${toKh(parsed.questions.length)} សំណួរ (រក្សាដដែល — គ្មាន AI) ✓`);
    return true;
  };

  const handleUsePasted = (mode: 'worksheet' | ExamPeriod) => {
    const src = (params.source || '').trim();
    if (!src) { flash('ប្រអប់ «មាតិកា/វិញ្ញាសា» ទទេ — សូមបិទភ្ជាប់សំណួររបស់អ្នកជាមុនសិន', false); return; }
    if (!applyParsed(src, mode)) flash('រកសំណួរមិនឃើញ — ត្រូវឱ្យបន្ទាត់នីមួយៗចាប់ផ្ដើមដោយលេខ (១. ២. ៣. …)', false);
  };

  // Import an existing exam FILE. For .docx we KEEP the original body formatting
  // (tables, section headings, option layout) via mammoth→HTML and only swap the
  // header for the school's. For .pdf/.txt (no reliable structure) we fall back to
  // parsing the questions verbatim. Header type is auto-detected (ឆមាស/ឆ្នាំ/ខែ);
  // switch it any time via «រក្សាសំណួរដើម».
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    setImporting(true);
    try {
      if ((file.name || '').toLowerCase().endsWith('.docx')) {
        const rawHtml = await extractDocxHtml(file);
        if (!rawHtml.trim()) { flash('រកមាតិកាក្នុងឯកសារ .docx មិនឃើញ។', false); return; }
        const period = detectExamPeriod(rawHtml);
        const body = stripImportedHeader(rawHtml);
        setQuestions([]); setExamSections(null);
        setExamPeriod(period);
        setShowAnswers(false);
        setImportedHtml(body);
        flash(`បាននាំចូលវិញ្ញាសា${EXAM_PERIOD_LABELS[period]} — ក្បាលប្តូរជារបស់សាលា · រក្សាទម្រង់ដើម ✓`);
        return;
      }
      // .pdf / .txt → verbatim parse (no reliable original layout to keep).
      const text = await extractTextFromFile(file);
      if (!text.trim()) { flash('រកអត្ថបទក្នុងឯកសារមិនឃើញ — PDF ស្កេនមិនមានស្រទាប់អក្សរ។', false); return; }
      set('source', text);
      setSelectedLessonId('');
      setImportedHtml(null);
      if (applyParsed(text, examPeriod || 'month', true)) {
        flash('បាននាំចូលវិញ្ញាសា — ក្បាលប្តូរជារបស់សាលា ✓ (ប្តូរប្រភេទបាននៅ «រក្សាសំណួរដើម»)');
      } else {
        flash('បាននាំចូលអត្ថបទ — សូមចុច «រក្សាសំណួរដើម» ដើម្បីរៀបចំ', true);
      }
    } catch (err: any) {
      flash(err?.message || 'នាំចូលឯកសារមិនបាន', false);
    } finally {
      setImporting(false);
    }
  };

  // Build a full exam paper (វិញ្ញាសាប្រឡង) for a period — mixed sections.
  const handleGenerateExam = async (period: ExamPeriod) => {
    setLoading(true);
    setShowAnswers(false);
    setImportedHtml(null);
    setQuestions([]);
    try {
      const sections = await generateExam(effectiveParams(), period);
      setExamSections(sections);
      setExamPeriod(period);
      const total = sections.reduce((n, s) => n + s.questions.length, 0);
      flash(`បានបង្កើតវិញ្ញាសា (${toKh(sections.length)} ផ្នែក, ${toKh(total)} សំណួរ) ✓`);
    } catch (e: any) {
      console.error('Exam generation failed', e);
      flash(friendlyAiError(e, 'បង្កើតវិញ្ញាសាមិនបានសម្រេច — សូមព្យាយាមម្ដងទៀត។'), false);
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async () => {
    const el = document.getElementById('worksheet-print');
    if (!el) return;
    setPdfBusy(true);
    // Multi-page A4: flow the worksheet onto as many pages as the questions need,
    // cutting at blank rows so no question/line is sliced at a page boundary.
    try { await exportElementToMultipagePdf(el, `សន្លឹកលំហាត់_${params.subject}_${params.grade}`, A4_WIDTH); }
    catch (e) { console.error(e); flash('មិនអាចបង្កើត PDF បានទេ', false); }
    finally { setPdfBusy(false); }
  };

  // Export to an editable Word document (.doc). Teacher edits in Word, then prints.
  const handleWord = async () => {
    if (!examSections && !questions.length && !importedHtml) { flash('សូមបង្កើតជាមុនសិន', false); return; }
    // Embed the school logo as base64 so the .doc shows it offline (a bare asset URL
    // wouldn't resolve inside Word), giving the same polished header as the PDF.
    let logo = '';
    try { const r = await fetch(logoPng); const b = await r.blob(); logo = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => res(''); fr.readAsDataURL(b); }); } catch { /* logo optional */ }
    const html = buildWordHtml({ heading, instructions, params, teacherName, questions, examSections, examPeriod, showAnswers, month, duration, logo, importedBody: importedHtml || undefined, importedPoints: importedHtml ? detectTotalPoints(importedHtml) : undefined });
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

  // Reusable styled control class (match the app's slate/indigo form style).
  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:border-indigo-500 outline-none transition-colors';

  const printCss = `@media print {
    @page { size: A4 portrait; margin: 12mm; }
    body * { visibility: hidden !important; }
    #worksheet-print, #worksheet-print * { visibility: visible !important; }
    #worksheet-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
    .rc-fit-outer, .rc-fit-frame, .rc-fit-inner { width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; transform: none !important; }
    .ws-no-print { display: none !important; }
  }
  /* Imported-exam body: polish the look while keeping mammoth's structure intact. */
  .ws-imported { counter-reset: wssec; }
  .ws-imported p { margin: 5px 0; line-height: 1.85; }
  /* Section headings (each mammoth <ol><li>) → a numbered indigo banner. */
  .ws-imported ol { list-style: none; margin: 16px 0 8px; padding: 0; }
  .ws-imported ol li {
    counter-increment: wssec;
    background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 6px;
    padding: 7px 12px; margin: 0; font-weight: 700; font-size: 12pt; color: #1e293b;
  }
  .ws-imported ol li::before { content: counter(wssec, khmer) "៖ "; color: #4f46e5; font-weight: 800; }
  /* Matching / answer tables — clean grid with a shaded header row. */
  .ws-imported table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11pt; }
  .ws-imported td, .ws-imported th { border: 1px solid #cbd5e1; padding: 6px 9px; vertical-align: top; }
  .ws-imported table tr:first-child td { background: #f1f5f9; font-weight: 700; text-align: center; color: #334155; }`;

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
            <a href="https://aistudio.google.com/prompts/1uzbJjDjt2mdhj5Ltfi_ZtiYSRdnjMEhb" target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1.5 transition-colors border border-blue-200 shadow-sm">✨ AI Studio</a>
            {(questions.length > 0 || examSections || importedHtml) && <>
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
                      {(Object.keys(TYPE_LABELS) as WorksheetType[]).map(t => (
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
            <Field label="ភាសា"><select value={params.language} onChange={e => set('language', e.target.value as WSLanguage)} className={fieldCls}>{(Object.keys(LANGUAGE_LABELS) as WSLanguage[]).map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}</select></Field>
            <Field label="ចំនួនសំណួរ"><input type="number" min={1} max={50} value={countStr} placeholder="ឧ. ១០" onChange={e => { const v = e.target.value; setCountStr(v); const n = Number(v); if (n >= 1) set('count', Math.max(1, Math.min(50, n))); }} className={fieldCls} /></Field>
            <Field label="មេរៀន"><input list="wsg-lessons" value={params.lesson} onChange={e => set('lesson', e.target.value)} placeholder="ឧ. មេរៀនទី ៣" className={fieldCls} /><datalist id="wsg-lessons">{lessonsFor(params.grade, params.subject).map(l => <option key={l.id} value={l.title} />)}</datalist></Field>
            <Field label="ប្រធានបទ"><input value={params.topic} onChange={e => set('topic', e.target.value)} placeholder="ឧ. បូក, អំណាន…" className={fieldCls} /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ចំណងជើង (ស្រេចចិត្ត)"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={heading} className={fieldCls} /></Field>
            <Field label="សេចក្ដីណែនាំ (ស្រេចចិត្ត)"><input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="ឧ. ចូរឆ្លើយសំណួរខាងក្រោម…" className={fieldCls} /></Field>
            <Field label="រយៈពេល — នាទី (វិញ្ញាសា)"><input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} placeholder="ឧ. ៦០" className={fieldCls} /></Field>
            <Field label="ខែ (ស្រេចចិត្ត)"><select value={month} onChange={e => setMonth(e.target.value)} className={fieldCls}><option value="">— ជ្រើសរើសខែ —</option>{KH_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></Field>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មាតិកាមេរៀន / វិញ្ញាសារ (ស្រេចចិត្ត)</span>
              <div className="flex items-center gap-1.5">
                {/* Import an existing exam file (.docx/.pdf/.txt) → extract text → lay
                    out with the school header, keeping the questions verbatim. */}
                <input ref={importInputRef} type="file" accept=".docx,.pdf,.txt" className="hidden" onChange={handleImportFile} />
                <button onClick={() => importInputRef.current?.click()} disabled={importing} title="នាំចូលវិញ្ញាសាពី Word (.docx) ឬ PDF — ក្បាលប្តូរជារបស់សាលា ហើយរក្សាសំណួរដើម" className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 disabled:opacity-60">
                  {importing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} className="rotate-180" />} នាំចូល Word/PDF
                </button>
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
              placeholder="ជ្រើស «បណ្ណាល័យមេរៀន» ខាងលើ ឬ ចម្លងអត្ថបទមេរៀន/វិញ្ញាសារ បិទភ្ជាប់ទីនេះ។&#10;• AI នឹងបង្កើតសំណួរផ្អែកលើអត្ថបទនេះ (ចុច «បង្កើតសន្លឹកកិច្ចការ»)។&#10;• បើអ្នកមានបញ្ជីសំណួររួចហើយ (១. ២. ៣. …) បិទភ្ជាប់ ហើយចុច «រក្សាសំណួរដើម» ដើម្បីរៀបចំដោយមិនកែ។"
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
              {/* Keep the teacher's OWN questions verbatim — parse the pasted list, no
                  AI — then lay it out as a worksheet OR an exam paper (their choice). */}
              <div className="relative">
                <button onClick={() => setPasteMenuOpen(o => !o)} disabled={loading} title="យកសំណួរដែលអ្នកបានបិទភ្ជាប់មករៀបចំឱ្យស្អាត ដោយមិនកែ (គ្មាន AI)" className="px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-700 border border-emerald-200 flex items-center gap-2 shadow-sm">
                  <ClipboardList size={16} /> រក្សាសំណួរដើម <ChevronDown size={14} className={`transition-transform ${pasteMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {pasteMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPasteMenuOpen(false)} />
                    <div className="absolute right-0 bottom-full mb-2 z-20 min-w-[210px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 overflow-hidden">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 font-mono uppercase">📋 រៀបចំសំណួរដើម ជា</div>
                      {(['month', 'semester', 'year'] as ExamPeriod[]).map(p => (
                        <button key={p} onClick={() => { setPasteMenuOpen(false); handleUsePasted(p); }} disabled={loading} className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 flex items-center gap-2">
                          <FileText size={13} /> វិញ្ញាសា{EXAM_PERIOD_LABELS[p]}
                        </button>
                      ))}
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { setPasteMenuOpen(false); handleUsePasted('worksheet'); }} disabled={loading} className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 flex items-center gap-2">
                        <BookMarked size={13} /> សន្លឹកកិច្ចការ
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={handleGenerate} disabled={loading} className="px-5 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-60 text-white flex items-center gap-2 shadow-md">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} បង្កើតសន្លឹកកិច្ចការ
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

        {/* Imported exam — school header + the ORIGINAL .docx body, kept verbatim. */}
        {importedHtml ? (
          <FitToWidth designWidth={A4_WIDTH} fitHeight={false}>
            <div id="worksheet-print" className="bg-white rounded-2xl shadow-xl text-slate-900 p-10 leading-relaxed" style={{ fontFamily: "'Khmer OS Siemreap','Siemreap',serif", fontSize: '11pt' }}>
              <PrintHeader params={params} heading={heading} totalPoints={detectTotalPoints(importedHtml)} examPeriod={examPeriod} teacherName={teacherName} duration={duration} month={month} />
              <div className="ws-imported mt-3 text-[11pt] leading-relaxed" dangerouslySetInnerHTML={{ __html: importedHtml }} />
            </div>
          </FitToWidth>
        ) : examSections ? (
          <FitToWidth designWidth={A4_WIDTH} fitHeight={false}>
            <div id="worksheet-print" className="bg-white rounded-2xl shadow-xl text-slate-900 p-10 leading-relaxed" style={{ fontFamily: "'Khmer OS Siemreap','Siemreap',serif", fontSize: '11pt' }}>
              <PrintHeader params={params} heading={heading} totalPoints={examSections.reduce((n, s) => n + s.points, 0)} examPeriod={examPeriod} teacherName={teacherName} duration={duration} month={month} />
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
          <FitToWidth designWidth={A4_WIDTH} fitHeight={false}>
            <div id="worksheet-print" className="bg-white rounded-2xl shadow-xl text-slate-900 p-10 leading-relaxed" style={{ fontFamily: "'Khmer OS Siemreap','Siemreap',serif", fontSize: '11pt' }}>
              <PrintHeader params={params} heading={heading} totalPoints={questions.length} examPeriod={examPeriod} teacherName={teacherName} duration={duration} month={month} />
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
