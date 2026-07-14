/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, Plus, Pencil, Trash2, Save, X, FileText, Upload, Loader2 } from 'lucide-react';
import { SchoolUser } from '../types';
import { SUBJECTS } from '../lib/worksheets';
import { LessonSource, loadLessons, refreshLessonsFromCloud, saveLesson, deleteLesson } from '../lib/lessons';
import { extractTextFromFile } from '../lib/extractText';

// Dedicated Lesson Library — manage small lesson/worksheet TEXTS that the AI
// worksheet generator uses as source material. Cloud-synced (school_settings KV),
// tiny → negligible egress. The generator reads the same library via a dropdown.

interface Props {
  grades: string[];
  currentUser?: SchoolUser | null;
  onClose: () => void;
}

type Draft = { id: string | null; title: string; subject: string; grade: string; content: string };
const emptyDraft = (subject: string, grade: string): Draft => ({ id: null, title: '', subject, grade, content: '' });

export default function LessonLibrary({ grades, currentUser, onClose }: Props) {
  const teacherName = currentUser?.name || '';
  const gradeList = grades.length ? grades : ['ថ្នាក់ទី១', 'ថ្នាក់ទី២', 'ថ្នាក់ទី៣'];

  const [lessons, setLessons] = useState<LessonSource[]>(() => loadLessons());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { refreshLessonsFromCloud().then(setLessons); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !draft) return;
    setExtracting(true);
    try {
      const text = await extractTextFromFile(f);
      if (!text) { flash('មិនរកឃើញអត្ថបទក្នុងឯកសារ (ឯកសារស្កេន/រូបភាពគ្មានអក្សរ)។ សូមប្រើ Word/PDF ដែលមានអក្សរ។', false); return; }
      // Append to any existing content; default the title to the file name.
      const base = f.name.replace(/\.[^.]+$/, '');
      setDraft(d => d ? { ...d, title: d.title || base, content: (d.content ? d.content + '\n\n' : '') + text } : d);
      flash(`បានស្រង់អត្ថបទពី «${f.name}» ✓`);
    } catch (err: any) {
      flash(err?.message || 'អានឯកសារមិនបាន — សូមព្យាយាមម្ដងទៀត។', false);
    } finally {
      setExtracting(false);
    }
  };

  const startNew = () => setDraft(emptyDraft(SUBJECTS[0], gradeList[0]));
  const startEdit = (l: LessonSource) => setDraft({ id: l.id, title: l.title, subject: l.subject || SUBJECTS[0], grade: l.grade || gradeList[0], content: l.content });

  const save = async () => {
    if (!draft) return;
    const content = draft.content.trim();
    const title = draft.title.trim();
    if (!title) { flash('សូមដាក់ឈ្មោះមេរៀន', false); return; }
    if (!content) { flash('សូមបញ្ចូលអត្ថបទមេរៀន', false); return; }
    const ls: LessonSource = {
      id: draft.id || ((crypto as any).randomUUID ? crypto.randomUUID() : `ls-${Date.now()}`),
      title, subject: draft.subject, grade: draft.grade, content,
      createdBy: teacherName, createdAt: new Date().toISOString(),
    };
    const next = await saveLesson(ls);
    setLessons(next);
    setDraft(null);
    flash('បានរក្សាទុក ✓');
  };

  const remove = async (id: string) => {
    if (!window.confirm('លុបមេរៀននេះចេញពីបណ្ណាល័យ?')) return;
    const next = await deleteLesson(id);
    setLessons(next);
    flash('បានលុប ✓');
  };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:border-indigo-500 outline-none';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <BookMarked size={16} className="text-indigo-500" /> បណ្ណាល័យមេរៀន (Lesson Library)
        </h3>
        <div className="flex items-center gap-2">
          {!draft && (
            <button onClick={startNew} className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Plus size={13} /> មេរៀនថ្មី</button>
          )}
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5"><X size={13} /> បិទ</button>
        </div>
      </div>

      {toast && <div className={`text-center text-xs font-bold px-3 py-2 rounded-xl ${toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{toast.msg}</div>}

      {/* Add / edit form */}
      {draft && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1 sm:col-span-3"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ឈ្មោះមេរៀន</span><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="ឧ. មេរៀនទី ៣ — ប្រភេទនៃរុក្ខជាតិ" className={fieldCls} /></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">មុខវិជ្ជា</span><select value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} className={fieldCls}>{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 font-mono uppercase">ថ្នាក់</span><select value={draft.grade} onChange={e => setDraft({ ...draft, grade: e.target.value })} className={fieldCls}>{gradeList.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">អត្ថបទមេរៀន / វិញ្ញាសារ</span>
              <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.docx" onChange={onUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={extracting} title="ស្រង់អត្ថបទពីឯកសារ (.pdf, .docx, .txt)" className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-60 flex items-center gap-1.5">
                {extracting ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {extracting ? 'កំពុងស្រង់…' : 'Upload ឯកសារ'}
              </button>
            </div>
            <textarea value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} rows={8} placeholder="Upload ឯកសារ (.pdf/.docx/.txt) ខាងលើ — ឬ ចម្លងអត្ថបទមេរៀន/វិញ្ញាសារ បិទភ្ជាប់ទីនេះ។ AI នឹងបង្កើតសំណួរផ្អែកលើអត្ថបទនេះ។" className={`${fieldCls} resize-y leading-relaxed`} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setDraft(null)} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200">បោះបង់</button>
            <button onClick={save} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"><Save size={13} /> រក្សាទុក</button>
          </div>
        </div>
      )}

      {/* Lesson list */}
      {lessons.length === 0 && !draft ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 flex flex-col items-center gap-2">
          <FileText size={28} className="opacity-50" />
          <p className="text-sm font-medium">មិនទាន់មានមេរៀន។ ចុច «មេរៀនថ្មី» ដើម្បីបញ្ចូលអត្ថបទមេរៀន សម្រាប់ឱ្យ AI បង្កើតលំហាត់។</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map(l => (
            <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-sm truncate">{l.title}</div>
                <div className="text-[11px] text-slate-400 font-semibold">{l.subject} · {l.grade}{l.createdBy ? ` · ${l.createdBy}` : ''}</div>
                <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{l.content.slice(0, 160)}{l.content.length > 160 ? '…' : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => startEdit(l)} title="កែ" className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"><Pencil size={13} /></button>
                <button onClick={() => remove(l.id)} title="លុប" className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center">មេរៀនទាំងនេះបង្ហាញក្នុង «គ្រប់គ្រងវិញ្ញាសា និងសន្លឹកកិច្ចការ» → ប្រអប់ «បណ្ណាល័យមេរៀន» ដើម្បីឱ្យ AI ប្រើបង្កើតលំហាត់។</p>
    </div>
  );
}
