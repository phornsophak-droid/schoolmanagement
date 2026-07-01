/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { HelpCircle, Plus, Pencil, Trash2, Save, X, FileText, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { SchoolUser } from '../types';
import { WorksheetType, Difficulty, TYPE_LABELS, DIFFICULTY_LABELS } from '../lib/worksheets';
import {
  BankQuestion, loadQuestions, refreshQuestionsFromCloud, saveQuestion, deleteQuestion,
  approveQuestion, unapproveQuestion,
} from '../lib/questionBank';
import { curriculumSubjects, lessonsFor } from '../lib/curriculum';

// Question Bank — store, edit, and (principal-only) approve reusable questions.
// Approved questions are pulled by the worksheet generator before it calls the AI.

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
}

type Draft = {
  id: string | null;
  grade: string; subject: string; lesson: string;
  type: WorksheetType; difficulty: Difficulty;
  prompt: string; options: string[]; pairs: { left: string; right: string }[]; answer: string;
};

const uuid = (): string => ((crypto as any).randomUUID ? crypto.randomUUID() : `q-${Date.now()}`);

export default function QuestionBank({ grades, currentUser, onClose }: Props) {
  const isPrincipal = currentUser?.role === 'principal';
  const teacherName = currentUser?.name || '';
  const gradeList = grades.length ? grades : ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣'];
  const subjects = useMemo(() => curriculumSubjects(), []);

  const [items, setItems] = useState<BankQuestion[]>(() => loadQuestions());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // Filters
  const [fGrade, setFGrade] = useState('');
  const [fSubject, setFSubject] = useState('');
  const [fType, setFType] = useState<WorksheetType | ''>('');
  const [fStatus, setFStatus] = useState<'all' | 'approved' | 'draft'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { refreshQuestionsFromCloud().then(setItems); }, []);

  const filtered = items.filter(q =>
    (!fGrade || q.grade === fGrade) &&
    (!fSubject || q.subject === fSubject) &&
    (!fType || q.type === fType) &&
    (fStatus === 'all' || q.status === fStatus) &&
    (!search || (q.prompt || '').toLowerCase().includes(search.toLowerCase()) || (q.answer || '').toLowerCase().includes(search.toLowerCase()))
  );
  const approvedCount = items.filter(q => q.status === 'approved').length;

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
      status: existing?.status || 'draft',
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
  const approve = async (id: string) => { setItems(await approveQuestion(id)); flash('បានអនុម័ត ✓'); };
  const unapprove = async (id: string) => { setItems(await unapproveQuestion(id)); flash('បានដកការអនុម័ត'); };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none';
  const smallCls = 'px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold outline-none';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <HelpCircle size={16} className="text-rose-500" /> ធនាគារសំណួរ (Question Bank)
          <span className="text-[11px] font-semibold text-slate-400">· អនុម័ត {approvedCount}/{items.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          {!draft && <button onClick={startNew} className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm"><Plus size={13} /> សំណួរថ្មី</button>}
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>
      </div>

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
          <select value={fStatus} onChange={e => setFStatus(e.target.value as any)} className={smallCls}><option value="all">ស្ថានភាពទាំងអស់</option><option value="approved">អនុម័ត</option><option value="draft">ព្រាង</option></select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ស្វែងរក…" className={`${smallCls} flex-1 min-w-[120px]`} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 && !draft ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
          <FileText size={28} className="opacity-50" />
          <p className="text-sm font-medium">មិនទាន់មានសំណួរ។ ចុច «សំណួរថ្មី» ដើម្បីបញ្ចូល ឬបង្កើតលំហាត់ដោយ AI (សំណួរនឹងចូលធនាគារជាព្រាង)។</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {q.status === 'approved'
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 size={10} /> អនុម័ត</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Clock size={10} /> ព្រាង (រង់ចាំអនុម័ត)</span>}
                  {q.source === 'ai' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">AI</span>}
                </div>
                <div className="font-semibold text-slate-800 text-sm truncate">{q.type === 'matching' ? `ផ្គូផ្គង (${q.pairs?.length || 0} គូ)` : q.prompt}</div>
                <div className="text-[11px] text-slate-400 font-semibold">{q.subject} · {q.grade} · {TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}{q.lesson ? ` · ${q.lesson}` : ''}</div>
                {q.answer && q.type !== 'matching' && <p className="text-[12px] text-emerald-700 mt-0.5">✔ {q.answer}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isPrincipal ? (
                  q.status === 'approved'
                    ? <button onClick={() => unapprove(q.id)} title="ដកការអនុម័ត" className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"><Clock size={13} /></button>
                    : <button onClick={() => approve(q.id)} title="អនុម័ត" className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"><ShieldCheck size={13} /></button>
                ) : q.status !== 'approved' && (
                  <span className="text-[10px] text-slate-400 font-semibold px-1">រង់ចាំអនុម័ត</span>
                )}
                <button onClick={() => startEdit(q)} title="កែ" className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"><Pencil size={13} /></button>
                <button onClick={() => remove(q.id)} title="លុប" className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center">
        {isPrincipal ? 'ចុច 🛡 ដើម្បីអនុម័តសំណួរ។ ' : 'តែនាយកសាលាទេ ដែលអាចអនុម័តសំណួរ។ '}
        សំណួរដែលបានអនុម័ត ត្រូវបានយកមកប្រើក្នុង «បង្កើតសន្លឹកលំហាត់» មុននឹងហៅ AI។
      </p>
    </div>
  );
}
