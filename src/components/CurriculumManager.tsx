/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, Save, X, BookOpen, Upload, Loader2, FileText } from 'lucide-react';
import { SchoolUser } from '../types';
import { SUBJECTS } from '../lib/worksheets';
import {
  Curriculum, CurriculumLesson, loadCurriculum, refreshCurriculumFromCloud,
  saveSubject, removeSubject, saveLesson, removeLesson, curriculumSubjects, lessonsFor,
} from '../lib/curriculum';
import { extractTextFromFile } from '../lib/extractText';

// Curriculum Manager — editable subjects + per grade/subject lessons with learning
// objectives. Feeds the worksheet generator and question-bank dropdowns.

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
}

type LessonDraft = { id: string | null; grade: string; subject: string; title: string; objectives: string[]; material: string };

export default function CurriculumManager({ grades, onClose }: Props) {
  const gradeList = grades.length ? grades : ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣'];

  const [, setCur] = useState<Curriculum>(() => loadCurriculum());
  const [subjects, setSubjects] = useState<string[]>(() => curriculumSubjects());
  const [newSubject, setNewSubject] = useState('');
  const [gradeSel, setGradeSel] = useState(gradeList[0]);
  const [subjectSel, setSubjectSel] = useState(subjects[0] || SUBJECTS[0]);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [tick, setTick] = useState(0); // re-render after lesson list changes
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const onUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !draft) return;
    setExtracting(true);
    try {
      const text = await extractTextFromFile(f);
      if (!text) { flash('មិនរកឃើញអត្ថបទក្នុងឯកសារ (ស្កេន/រូបភាព)។ ប្រើ Word/PDF ដែលមានអក្សរ។', false); return; }
      setDraft(d => d ? { ...d, title: d.title || f.name.replace(/\.[^.]+$/, ''), material: (d.material ? d.material + '\n\n' : '') + text } : d);
      flash(`បានស្រង់អត្ថបទពី «${f.name}» ✓`);
    } catch (err: any) {
      flash(err?.message || 'អានឯកសារមិនបាន', false);
    } finally { setExtracting(false); }
  };

  useEffect(() => { refreshCurriculumFromCloud().then(c => { setCur(c); setSubjects(curriculumSubjects()); setTick(t => t + 1); }); }, []);

  const lessons = useMemo(() => lessonsFor(gradeSel, subjectSel), [gradeSel, subjectSel, tick]);

  const addSubject = async () => {
    const n = newSubject.trim();
    if (!n) return;
    const c = await saveSubject(n);
    setCur(c); setSubjects(curriculumSubjects()); setNewSubject('');
    flash('បានបន្ថែមមុខវិជ្ជា ✓');
  };
  const delSubject = async (s: string) => {
    if (!window.confirm(`ដកមុខវិជ្ជា «${s}» ចេញ?`)) return;
    const c = await removeSubject(s);
    setCur(c); setSubjects(curriculumSubjects());
    if (subjectSel === s) setSubjectSel(curriculumSubjects()[0] || SUBJECTS[0]);
  };

  const startNewLesson = () => setDraft({ id: null, grade: gradeSel, subject: subjectSel, title: '', objectives: [''], material: '' });
  const startEditLesson = (l: CurriculumLesson) => setDraft({ id: l.id, grade: l.grade, subject: l.subject, title: l.title, objectives: l.objectives.length ? [...l.objectives] : [''], material: l.material || '' });

  const saveLessonDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { flash('សូមដាក់ចំណងជើងមេរៀន', false); return; }
    const c = await saveLesson({ id: draft.id || '', grade: draft.grade, subject: draft.subject, title: draft.title, objectives: draft.objectives, material: draft.material });
    setCur(c); setTick(t => t + 1); setDraft(null);
    flash('បានរក្សាទុកមេរៀន ✓');
  };
  const delLesson = async (id: string) => {
    if (!window.confirm('លុបមេរៀននេះ?')) return;
    const c = await removeLesson(id);
    setCur(c); setTick(t => t + 1);
    flash('បានលុប ✓');
  };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><GraduationCap size={16} className="text-emerald-500" /> កម្មវិធីសិក្សា (Curriculum Manager)</h3>
        <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
      </div>

      {toast && <div className={`text-center text-xs font-bold px-3 py-2 rounded-xl ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{toast.msg}</div>}

      {/* Subjects */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មុខវិជ្ជា</span>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {s}
              <button onClick={() => delSubject(s)} className="text-slate-400 hover:text-rose-600"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSubject(); }} placeholder="មុខវិជ្ជាថ្មី…" className={fieldCls} />
          <button onClick={addSubject} className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm shrink-0"><Plus size={13} /> បន្ថែម</button>
        </div>
      </div>

      {/* Lessons & objectives */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 font-mono uppercase flex items-center gap-1"><BookOpen size={12} /> មេរៀន និងគោលបំណងសិក្សា</span>
          <div className="flex items-center gap-2">
            <select value={gradeSel} onChange={e => setGradeSel(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold outline-none">{gradeList.map(g => <option key={g} value={g}>{g}</option>)}</select>
            <select value={subjectSel} onChange={e => setSubjectSel(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold outline-none">{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select>
            {!draft && <button onClick={startNewLesson} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"><Plus size={12} /> មេរៀន</button>}
          </div>
        </div>

        {draft && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ចំណងជើងមេរៀន — {draft.grade} · {draft.subject}</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="ឧ. មេរៀនទី ៣ — ប្រភេទនៃរុក្ខជាតិ" className={fieldCls} /></label>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">គោលបំណងសិក្សា</span>
              {draft.objectives.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o} onChange={e => { const objectives = [...draft.objectives]; objectives[i] = e.target.value; setDraft({ ...draft, objectives }); }} placeholder={`គោលបំណង ${i + 1}`} className={fieldCls} />
                  <button onClick={() => setDraft({ ...draft, objectives: draft.objectives.filter((_, j) => j !== i) })} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => setDraft({ ...draft, objectives: [...draft.objectives, ''] })} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"><Plus size={11} /> បន្ថែមគោលបំណង</button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">អត្ថបទមេរៀន (ស្រេចចិត្ត — AI ប្រើបង្កើតសំណួរ)</span>
                <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.docx" onChange={onUploadMaterial} className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={extracting} title="ស្រង់អត្ថបទពីឯកសារ (.pdf/.docx/.txt)" className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-60 flex items-center gap-1.5">
                  {extracting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {extracting ? 'កំពុងស្រង់…' : 'Upload ឯកសារ'}
                </button>
              </div>
              <textarea value={draft.material} onChange={e => setDraft({ ...draft, material: e.target.value })} rows={4} placeholder="Upload ឯកសារ (.pdf/.docx/.txt) ខាងលើ — ឬ ចម្លងអត្ថបទមេរៀនបិទភ្ជាប់ទីនេះ។ ពេលបង្កើតលំហាត់ដោយជ្រើសមេរៀននេះ AI នឹងប្រើអត្ថបទនេះ។" className={`${fieldCls} resize-y leading-relaxed`} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDraft(null)} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200">បោះបង់</button>
              <button onClick={saveLessonDraft} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Save size={13} /> រក្សាទុក</button>
            </div>
          </div>
        )}

        {lessons.length === 0 && !draft ? (
          <p className="text-[12px] text-slate-400 text-center py-4">មិនទាន់មានមេរៀនសម្រាប់ {gradeSel} · {subjectSel}។ ចុច «មេរៀន» ដើម្បីបន្ថែម។</p>
        ) : (
          <div className="space-y-2">
            {lessons.map(l => (
              <div key={l.id} className="rounded-xl border border-slate-100 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">{l.title}{l.material && <span title="មានអត្ថបទមេរៀន" className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><FileText size={10} /> អត្ថបទ</span>}</div>
                  {l.objectives.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {l.objectives.map((o, i) => <li key={i} className="text-[12px] text-slate-500">• {o}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => startEditLesson(l)} title="កែ" className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"><Pencil size={13} /></button>
                  <button onClick={() => delLesson(l.id)} title="លុប" className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
