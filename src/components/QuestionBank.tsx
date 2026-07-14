/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Plus, Pencil, Trash2, Save, X, FileText, CheckCircle2, Clock, ShieldCheck, Upload, Loader2, Sparkles, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SchoolUser } from '../types';
import { WorksheetType, Difficulty, TYPE_LABELS, DIFFICULTY_LABELS, generateQuestions } from '../lib/worksheets';
import { BankQuestion, BankApi, questionBank } from '../lib/questionBank';
import { curriculumSubjects, lessonsFor, refreshCurriculumFromCloud } from '../lib/curriculum';
import { extractTextFromFile } from '../lib/extractText';

type NewQ = Omit<BankQuestion, 'id' | 'createdAt' | 'updatedAt'>;

// Resolve a free-text type/difficulty cell to a canonical key (accepts the key
// itself or its Khmer label).
const resolveType = (v: string): WorksheetType => {
  const s = (v || '').trim().toLowerCase();
  const keys = Object.keys(TYPE_LABELS) as WorksheetType[];
  return keys.find(k => k === s) || keys.find(k => TYPE_LABELS[k].toLowerCase().includes(s) && s.length > 1) || 'multiple_choice';
};
const resolveDiff = (v: string): Difficulty => {
  const s = (v || '').trim().toLowerCase();
  const keys = Object.keys(DIFFICULTY_LABELS) as Difficulty[];
  return keys.find(k => k === s) || keys.find(k => DIFFICULTY_LABELS[k] === (v || '').trim()) || 'medium';
};

// Header aliases → find the column index for each logical field.
const colIndex = (header: string[], aliases: string[]): number =>
  header.findIndex(h => aliases.some(a => (h || '').toString().trim().toLowerCase().includes(a)));

// Question Bank — store, edit, and (principal-only) approve reusable questions.
// Approved questions are pulled by the worksheet generator before it calls the AI.

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
  // Which bank to back this UI. Defaults to the worksheet/exam bank; pass
  // standardTestBank for the SEPARATE standardized-test bank.
  bank?: BankApi;
  title?: string;
}

type Draft = {
  id: string | null;
  grade: string; subject: string; lesson: string;
  type: WorksheetType; difficulty: Difficulty;
  prompt: string; options: string[]; pairs: { left: string; right: string }[]; answer: string;
};

const uuid = (): string => ((crypto as any).randomUUID ? crypto.randomUUID() : `q-${Date.now()}`);

export default function QuestionBank({ grades, currentUser, onClose, bank = questionBank, title }: Props) {
  const { loadQuestions, refreshFromCloud, saveQuestion, deleteQuestion, bulkAddQuestions } = bank;
  const isPrincipal = currentUser?.role === 'principal';
  const teacherName = currentUser?.name || '';
  const gradeList = grades.length ? grades : ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣'];
  const [subjects, setSubjects] = useState<string[]>(() => curriculumSubjects());
  useEffect(() => { refreshCurriculumFromCloud().then(() => setSubjects(curriculumSubjects())); }, []);

  const [items, setItems] = useState<BankQuestion[]>(() => loadQuestions());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  // ---- Import (A: document→AI, B: Excel/CSV) ----
  const [aiPanel, setAiPanel] = useState(false);
  const [aiCfg, setAiCfg] = useState({ grade: gradeList[0], subject: subjects[0], type: 'multiple_choice' as WorksheetType, difficulty: 'medium' as Difficulty, count: 10 });
  const [busy, setBusy] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const xlsxFileRef = useRef<HTMLInputElement>(null);

  // A) Upload a lesson/exam document → AI extracts questions → saved as drafts.
  const onAiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const text = await extractTextFromFile(f);
      if (!text) { flash('មិនរកឃើញអត្ថបទក្នុងឯកសារ (ស្កេន/រូបភាព)។ ប្រើ Word/PDF ដែលមានអក្សរ។', false); return; }
      const qs = await generateQuestions({
        grade: aiCfg.grade, subject: aiCfg.subject, type: aiCfg.type, difficulty: aiCfg.difficulty,
        count: aiCfg.count, language: 'km', lesson: '', topic: '', source: text,
      });
      const added = await bulkAddQuestions(qs.map(q => ({
        prompt: q.prompt, options: q.options, pairs: q.pairs, answer: q.answer,
        grade: aiCfg.grade, subject: aiCfg.subject, type: aiCfg.type, difficulty: aiCfg.difficulty,
        source: 'ai' as const, createdBy: teacherName,
      })));
      setItems(loadQuestions());
      setAiPanel(false);
      flash(`បានស្រង់ ${qs.length} សំណួរពី «${f.name}» → បន្ថែម ${added} ចូលធនាគារ (ព្រាង) ✓`);
    } catch (err: any) {
      flash(err?.message || 'ស្រង់សំណួរមិនបាន — ត្រូវការ AI (Gemini/Ollama) សម្រាប់មុខវិជ្ជានេះ។', false);
    } finally { setBusy(false); }
  };

  // B) Import questions directly from an Excel/CSV file (no AI).
  const onXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      // CSV must be read as UTF-8 TEXT — reading a UTF-8 CSV as a byte array makes
      // XLSX decode Khmer as Latin-1 (mojibake). Binary .xlsx reads fine as array.
      const isCsv = /\.csv$/i.test(f.name) || (f.type || '').includes('csv') || (f.type || '').startsWith('text/');
      const wb = isCsv
        ? XLSX.read(await f.text(), { type: 'string' })
        : XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: false });
      if (rows.length < 2) { flash('ឯកសារទទេ ឬគ្មានទិន្នន័យ។', false); return; }
      const header = (rows[0] as any[]).map(x => (x ?? '').toString());
      const ci = {
        grade: colIndex(header, ['ថ្នាក់', 'grade']),
        subject: colIndex(header, ['មុខវិជ្ជា', 'subject']),
        type: colIndex(header, ['ប្រភេទ', 'type']),
        difficulty: colIndex(header, ['កម្រិត', 'difficult']),
        lesson: colIndex(header, ['មេរៀន', 'lesson']),
        objective: colIndex(header, ['គោលបំណង', 'objective']),
        prompt: colIndex(header, ['សំណួរ', 'prompt', 'question']),
        answer: colIndex(header, ['ចម្លើយ', 'answer']),
      };
      const optCols = header.map((h, i) => ({ h: h.toString().toLowerCase(), i })).filter(x => /ជម្រើស|option/.test(x.h)).map(x => x.i);
      if (ci.prompt < 0) { flash('រកមិនឃើញជួរ «សំណួរ» — សូមប្រើ Template។', false); return; }
      const news: NewQ[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] as any[];
        const g = (row[ci.prompt] ?? '').toString().trim();
        if (!g) continue;
        const type = ci.type >= 0 ? resolveType((row[ci.type] ?? '').toString()) : 'multiple_choice';
        const options = type === 'multiple_choice' ? optCols.map(i => (row[i] ?? '').toString().trim()).filter(Boolean) : undefined;
        news.push({
          prompt: g,
          options,
          answer: ci.answer >= 0 ? (row[ci.answer] ?? '').toString().trim() : '',
          grade: ci.grade >= 0 && (row[ci.grade] ?? '').toString().trim() ? (row[ci.grade]).toString().trim() : gradeList[0],
          subject: ci.subject >= 0 && (row[ci.subject] ?? '').toString().trim() ? (row[ci.subject]).toString().trim() : subjects[0],
          lesson: ci.lesson >= 0 ? (row[ci.lesson] ?? '').toString().trim() || undefined : undefined,
          objective: ci.objective >= 0 ? (row[ci.objective] ?? '').toString().trim() || undefined : undefined,
          type,
          difficulty: ci.difficulty >= 0 ? resolveDiff((row[ci.difficulty] ?? '').toString()) : 'medium',
          source: 'manual', createdBy: teacherName,
        });
      }
      const added = await bulkAddQuestions(news);
      setItems(loadQuestions());
      flash(added ? `បាននាំចូល ${added} សំណួរ (ព្រាង) ✓` : 'សំណួរទាំងនេះមានក្នុងធនាគាររួចហើយ ឬឯកសារគ្មានទិន្នន័យ។');
    } catch (err: any) {
      flash(err?.message || 'អានឯកសារ Excel/CSV មិនបាន។', false);
    } finally { setBusy(false); }
  };

  // Download a filled-in Excel template so teachers know the column format.
  const downloadTemplate = () => {
    const header = ['ថ្នាក់', 'មុខវិជ្ជា', 'ប្រភេទ', 'កម្រិត', 'មេរៀន', 'គោលបំណង', 'សំណួរ', 'ជម្រើសក', 'ជម្រើសខ', 'ជម្រើសគ', 'ជម្រើសឃ', 'ចម្លើយ'];
    const example = [gradeList[0], subjects[0], 'multiple_choice', 'easy', 'មេរៀនទី ១', 'ស្គាល់ការបូក', '២ + ២ = ?', '៤', '៣', '៥', '៦', '៤'];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'សំណួរ');
    XLSX.writeFile(wb, 'template_ធនាគារសំណួរ.xlsx');
  };

  // Filters
  const [fGrade, setFGrade] = useState('');
  const [fSubject, setFSubject] = useState('');
  const [fType, setFType] = useState<WorksheetType | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => { refreshFromCloud().then(setItems); }, [bank]);

  const filtered = items.filter(q =>
    (!fGrade || q.grade === fGrade) &&
    (!fSubject || q.subject === fSubject) &&
    (!fType || q.type === fType) &&
    (!search || (q.prompt || '').toLowerCase().includes(search.toLowerCase()) || (q.answer || '').toLowerCase().includes(search.toLowerCase()))
  );

  const emptyDraft = (): Draft => ({
    id: null, grade: gradeList[0], subject: subjects[0], lesson: '',
    type: 'multiple_choice', difficulty: 'easy',
    prompt: '', options: ['', '', '', ''], pairs: [{ left: '', right: '' }], answer: '',
  });
  const startNew = () => setDraft(emptyDraft());
  const startEdit = (q: BankQuestion) => setDraft({
    id: q.id, grade: q.grade, subject: q.subject, lesson: q.lesson || '',
    type: q.type, difficulty: q.difficulty,
    prompt: q.prompt || '',
    options: q.options && q.options.length ? [...q.options] : ['', '', '', ''],
    pairs: q.pairs && q.pairs.length ? q.pairs.map(p => ({ ...p })) : [{ left: '', right: '' }],
    answer: q.answer || '',
  });

  const save = async () => {
    if (!draft) return;
    const isMatching = draft.type === 'matching';
    if (!isMatching && !draft.prompt.trim()) { flash('សូមបញ្ចូលសំណួរ', false); return; }
    const existing = draft.id ? items.find(q => q.id === draft.id) : null;
    const q: BankQuestion = {
      id: draft.id || uuid(),
      grade: draft.grade, subject: draft.subject, lesson: draft.lesson.trim() || undefined,
      type: draft.type, difficulty: draft.difficulty,
      prompt: isMatching ? 'ផ្គូផ្គង' : draft.prompt.trim(),
      options: draft.type === 'multiple_choice' ? draft.options.map(o => o.trim()).filter(Boolean) : undefined,
      pairs: isMatching ? draft.pairs.filter(p => p.left.trim() || p.right.trim()).map(p => ({ left: p.left.trim(), right: p.right.trim() })) : undefined,
      answer: draft.answer.trim(),
      source: existing?.source || 'manual',
      createdBy: existing?.createdBy || teacherName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = await saveQuestion(q);
    setItems(next);
    setDraft(null);
    flash('បានរក្សាទុក ✓');
  };

  const remove = async (id: string) => {
    if (!window.confirm('លុបសំណួរនេះចេញពីធនាគារ?')) return;
    setItems(await deleteQuestion(id));
    flash('បានលុប ✓');
  };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none';
  const smallCls = 'px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold outline-none';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle size={16} className="text-rose-500" /> {title || 'ធនាគារសំណួរ (Question Bank)'}
          <span className="text-[11px] font-semibold text-slate-400">· {items.length} សំណួរ</span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input ref={aiFileRef} type="file" accept=".txt,.csv,.pdf,.docx" onChange={onAiFile} className="hidden" />
          <input ref={xlsxFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onXlsxFile} className="hidden" />
          {!draft && <>
            <button onClick={startNew} className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm"><Plus size={13} /> សំណួរថ្មី</button>
            <button onClick={() => setAiPanel(p => !p)} disabled={busy} title="Upload ឯកសារ → AI ស្រង់សំណួរ" className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center gap-1.5 shadow-sm">{busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI ពីឯកសារ</button>
            <button onClick={() => xlsxFileRef.current?.click()} disabled={busy} title="នាំចូលពី Excel/CSV" className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 shadow-sm"><Upload size={13} /> Excel/CSV</button>
          </>}
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>
      </div>

      {/* AI-from-document panel */}
      {aiPanel && !draft && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 flex items-center gap-1.5"><Sparkles size={14} /> ស្រង់សំណួរពីឯកសារ (Word / PDF / TXT) ដោយ AI</span>
            <button onClick={() => setAiPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <select value={aiCfg.grade} onChange={e => setAiCfg({ ...aiCfg, grade: e.target.value })} className={smallCls}>{gradeList.map(g => <option key={g} value={g}>{g}</option>)}</select>
            <select value={aiCfg.subject} onChange={e => setAiCfg({ ...aiCfg, subject: e.target.value })} className={smallCls}>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={aiCfg.type} onChange={e => setAiCfg({ ...aiCfg, type: e.target.value as WorksheetType })} className={smallCls}>{(Object.keys(TYPE_LABELS) as WorksheetType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
            <select value={aiCfg.difficulty} onChange={e => setAiCfg({ ...aiCfg, difficulty: e.target.value as Difficulty })} className={smallCls}>{(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</select>
            <input type="number" min={1} max={50} value={aiCfg.count} onChange={e => setAiCfg({ ...aiCfg, count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} className={smallCls} />
          </div>
          <button onClick={() => aiFileRef.current?.click()} disabled={busy} className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center justify-center gap-2 shadow-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {busy ? 'កំពុងស្រង់…' : 'ជ្រើសឯកសារ រួចស្រង់សំណួរ'}</button>
        </div>
      )}

      {toast && <div className={`text-center text-xs font-bold px-3 py-2 rounded-xl ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{toast.msg}</div>}

      {/* Add / edit form */}
      {draft && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ថ្នាក់</span><select value={draft.grade} onChange={e => setDraft({ ...draft, grade: e.target.value })} className={fieldCls}>{gradeList.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មុខវិជ្ជា</span><select value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} className={fieldCls}>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ប្រភេទ</span><select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as WorksheetType })} className={fieldCls}>{(Object.keys(TYPE_LABELS) as WorksheetType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">កម្រិត</span><select value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value as Difficulty })} className={fieldCls}>{(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}</select></label>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មេរៀន (ស្រេចចិត្ត)</span>
            <input list="qb-lessons" value={draft.lesson} onChange={e => setDraft({ ...draft, lesson: e.target.value })} placeholder="ឧ. មេរៀនទី ៣" className={fieldCls} />
            <datalist id="qb-lessons">{lessonsFor(draft.grade, draft.subject).map(l => <option key={l.id} value={l.title} />)}</datalist>
          </label>

          {draft.type !== 'matching' && (
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">សំណួរ</span><textarea value={draft.prompt} onChange={e => setDraft({ ...draft, prompt: e.target.value })} rows={2} className={`${fieldCls} resize-y`} /></label>
          )}

          {draft.type === 'multiple_choice' ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ជម្រើស (គូសយកចម្លើយត្រឹមត្រូវ)</span>
              {draft.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="qb-ans" checked={!!o && draft.answer === o} onChange={() => setDraft({ ...draft, answer: o })} title="ចម្លើយត្រឹមត្រូវ" />
                  <input value={o} onChange={e => { const options = [...draft.options]; const prev = options[i]; options[i] = e.target.value; setDraft({ ...draft, options, answer: draft.answer === prev ? e.target.value : draft.answer }); }} placeholder={`ជម្រើស ${i + 1}`} className={fieldCls} />
                </div>
              ))}
            </div>
          ) : draft.type === 'matching' ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">គូផ្គូផ្គង (ឆ្វេង → ស្ដាំ)</span>
              {draft.pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p.left} onChange={e => { const pairs = [...draft.pairs]; pairs[i] = { ...pairs[i], left: e.target.value }; setDraft({ ...draft, pairs }); }} placeholder="ឆ្វេង" className={fieldCls} />
                  <span className="text-slate-400">→</span>
                  <input value={p.right} onChange={e => { const pairs = [...draft.pairs]; pairs[i] = { ...pairs[i], right: e.target.value }; setDraft({ ...draft, pairs }); }} placeholder="ស្ដាំ" className={fieldCls} />
                  <button onClick={() => setDraft({ ...draft, pairs: draft.pairs.filter((_, j) => j !== i) })} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => setDraft({ ...draft, pairs: [...draft.pairs, { left: '', right: '' }] })} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"><Plus size={11} /> បន្ថែមគូ</button>
            </div>
          ) : (
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ចម្លើយ</span><input value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })} className={fieldCls} /></label>
          )}

          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200">បោះបង់</button>
            <button onClick={save} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Save size={13} /> រក្សាទុក</button>
          </div>
        </div>
      )}

      {/* Filters */}
      {!draft && (
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5">
          <select value={fGrade} onChange={e => setFGrade(e.target.value)} className={smallCls}><option value="">ថ្នាក់ទាំងអស់</option>{gradeList.map(g => <option key={g} value={g}>{g}</option>)}</select>
          <select value={fSubject} onChange={e => setFSubject(e.target.value)} className={smallCls}><option value="">មុខវិជ្ជាទាំងអស់</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <select value={fType} onChange={e => setFType(e.target.value as WorksheetType | '')} className={smallCls}><option value="">ប្រភេទទាំងអស់</option>{(Object.keys(TYPE_LABELS) as WorksheetType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ស្វែងរក…" className={`${smallCls} flex-1 min-w-[120px]`} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 && !draft ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
          <FileText size={28} className="opacity-50" />
          <p className="text-sm font-medium">មិនទាន់មានសំណួរ។ ចុច «សំណួរថ្មី» ដើម្បីបញ្ចូល ឬបង្កើតលំហាត់ដោយ AI។</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {q.source === 'ai' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">AI</span>}
                </div>
                <div className="font-semibold text-slate-800 text-sm truncate">{q.type === 'matching' ? `ផ្គូផ្គង (${q.pairs?.length || 0} គូ)` : q.prompt}</div>
                <div className="text-[11px] text-slate-400 font-semibold">{q.subject} · {q.grade} · {TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}{q.lesson ? ` · ${q.lesson}` : ''}</div>
                {q.answer && q.type !== 'matching' && <p className="text-[12px] text-emerald-700 mt-0.5">✔ {q.answer}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(q)} title="កែ" className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"><Pencil size={13} /></button>
                <button onClick={() => remove(q.id)} title="លុប" className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        សំណួរទាំងអស់ ត្រូវបានយកមកប្រើក្នុង «បង្កើតសន្លឹកលំហាត់» មុននឹងហៅ AI។
        {' '}<button onClick={downloadTemplate} className="text-indigo-500 hover:underline font-semibold inline-flex items-center gap-1"><Download size={11} /> ទាញយក Template Excel</button>
      </p>
    </div>
  );
}
