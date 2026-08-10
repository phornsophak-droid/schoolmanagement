import React, { useMemo, useState } from 'react';
import { X, ArrowRightLeft, ShieldAlert, CheckSquare, Square, Users, ArrowRight } from 'lucide-react';
import { StudentScore, SchoolUser } from '../types';
import { calculateStudentFields, generateUniqueId } from '../mockData';
import { baseStudentName } from '../utils/studentKey';

// "Promote / move students into a new class" — the principal/teacher-driven way to
// set up the new school year's roster. Pick a source class, tick the students, pick
// the destination class → each student gets a FRESH record in the new class with
// their identity carried over (name, gender, dob, អត្តលេខ, parents, address…) and
// EMPTY marks. New-class records have a different grade, so their id differs from the
// old ones — no collision with the archived year's data. By default it leaves the
// old-class records untouched (additive/safe); the principal can opt to remove them
// once the year is archived.

interface Props {
  open: boolean;
  onClose: () => void;
  students: StudentScore[];
  grades: string[];
  onSaveStudents: (list: StudentScore[]) => void;
  currentUser?: SchoolUser | null;
  canManage: (grade: string) => boolean;
}

const emptyRecordFrom = (s: StudentScore, destGrade: string): StudentScore => calculateStudentFields({
  id: generateUniqueId(),
  name: s.name,
  englishName: s.englishName,
  gender: s.gender,
  grade: destGrade,
  status: s.status || 'ធម្មតា',
  studentId: s.studentId,
  dob: s.dob,
  fatherName: s.fatherName, fatherJob: s.fatherJob,
  motherName: s.motherName, motherJob: s.motherJob,
  birthPlace: s.birthPlace, address: s.address, phone: s.phone,
  month: 'កញ្ញា', // first month of the school year
  khmer: { listening: null, writing: null, reading: null, speaking: null },
  math: { numbers: null, measurement: null, geometry: null, algebra: null, statistics: null },
  science: null, socialStudies: null, physicalEducation: null, health: null, lifeSkills: null, foreignLanguage: null,
} as any);

export default function PromoteStudents({ open, onClose, students, grades, onSaveStudents, canManage }: Props) {
  const manageable = useMemo(() => grades.filter(canManage), [grades, canManage]);
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [removeOld, setRemoveOld] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Unique students in the source class (one per name).
  const sourceStudents = useMemo(() => {
    if (!source) return [] as StudentScore[];
    const map = new Map<string, StudentScore>();
    students.filter(s => s.grade === source).forEach(s => { const k = s.name.trim(); if (!map.has(k)) map.set(k, s); });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'km'));
  }, [students, source]);

  // Names already present in the destination class (skip to avoid duplicates).
  const destNames = useMemo(() => new Set(students.filter(s => s.grade === dest).map(s => s.name.trim())), [students, dest]);

  if (!open) return null;

  const toggle = (name: string) => setPicked(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const allChecked = sourceStudents.length > 0 && sourceStudents.every(s => picked.has(s.name.trim()));
  const toggleAll = () => setPicked(allChecked ? new Set() : new Set(sourceStudents.map(s => s.name.trim())));

  const selected = sourceStudents.filter(s => picked.has(s.name.trim()));
  const toAdd = selected.filter(s => !destNames.has(s.name.trim()));
  const skipped = selected.length - toAdd.length;

  const doPromote = () => {
    if (!source || !dest) { alert('សូមជ្រើសថ្នាក់ចាស់ និងថ្នាក់ថ្មី។'); return; }
    if (source === dest) { alert('ថ្នាក់ចាស់ និងថ្នាក់ថ្មី ដូចគ្នា។'); return; }
    if (toAdd.length === 0) { alert('គ្មានសិស្សថ្មីត្រូវផ្លាស់ (ប្រហែលមានក្នុងថ្នាក់ថ្មីរួចហើយ)។'); return; }
    const msg = `ផ្លាស់សិស្ស ${toAdd.length} នាក់ ពី «${source}» ទៅ «${dest}» (ពិន្ទុទទេ សម្រាប់ឆ្នាំថ្មី)`
      + (removeOld ? `\n\n⚠️ នឹង​ដក​សិស្សទាំងនេះ​ចេញ​ពី​ថ្នាក់​ចាស់​ផង។ សូមប្រាកដថាបាន Archive ឆ្នាំចាស់រួច!` : '')
      + `\n\nបន្តទេ?`;
    if (!window.confirm(msg)) return;

    const newRecords = toAdd.map(s => emptyRecordFrom(s, dest));
    let updated = [...students, ...newRecords];
    if (removeOld) {
      const names = new Set(toAdd.map(s => s.name.trim()));
      updated = updated.filter(s => !(s.grade === source && names.has(s.name.trim())));
    }
    onSaveStudents(updated);
    alert(`បានផ្លាស់សិស្ស ${toAdd.length} នាក់ ទៅ «${dest}» ដោយជោគជ័យ!` + (skipped ? `\n(${skipped} នាក់រំលង — មានក្នុងថ្នាក់ថ្មីរួច)` : ''));
    setPicked(new Set());
    setSource(''); setDest('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-emerald-600" /> ផ្លាស់សិស្សចូលថ្នាក់ថ្មី
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-3 border-b border-slate-100 bg-amber-50/70 shrink-0">
          <p className="text-[11px] text-amber-800 flex items-start gap-1.5 font-medium leading-relaxed">
            <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
            សូម <b>Archive ឆ្នាំចាស់ជាមុនសិន</b>។ សិស្សដែលផ្លាស់ ទទួលបានពិន្ទុទទេ (ព័ត៌មានផ្ទាល់ខ្លួននៅដដែល)។
          </p>
        </div>

        <div className="p-4 space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ពីថ្នាក់ (ចាស់)</label>
              <select value={source} onChange={e => { setSource(e.target.value); setPicked(new Set()); }} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700">
                <option value="">— ជ្រើស —</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <ArrowRight size={18} className="text-slate-300 mt-5 shrink-0" />
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ទៅថ្នាក់ (ថ្មី)</label>
              <select value={dest} onChange={e => setDest(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700">
                <option value="">— ជ្រើស —</option>
                {(manageable.length ? grades : grades).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          {source && (
            <button onClick={toggleAll} className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1.5">
              {allChecked ? <CheckSquare size={14} /> : <Square size={14} />} ជ្រើសទាំងអស់ ({sourceStudents.length})
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-2">
          {source ? (
            sourceStudents.length ? (
              <div className="space-y-1">
                {sourceStudents.map(s => {
                  const inDest = destNames.has(s.name.trim());
                  const on = picked.has(s.name.trim());
                  return (
                    <label key={s.name} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer ${inDest ? 'opacity-50' : ''} ${on ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-150 bg-white'}`}>
                      <input type="checkbox" checked={on} disabled={inDest} onChange={() => toggle(s.name.trim())} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-800 flex-1 truncate">{s.name}</span>
                      {inDest && <span className="text-[10px] text-slate-400">មានក្នុងថ្នាក់ថ្មីរួច</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.gender === 'ស្រី' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{s.gender}</span>
                    </label>
                  );
                })}
              </div>
            ) : <p className="text-center text-xs text-slate-400 py-8">គ្មានសិស្សក្នុងថ្នាក់នេះ។</p>
          ) : (
            <p className="text-center text-xs text-slate-400 py-8 flex flex-col items-center gap-2"><Users size={24} className="text-slate-300" /> ជ្រើសថ្នាក់ចាស់ ដើម្បីមើលសិស្ស។</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0 space-y-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={removeOld} onChange={e => setRemoveOld(e.target.checked)} className="accent-rose-500" />
            ដកសិស្សចេញពីថ្នាក់ចាស់ផង <span className="text-slate-400">(ធីកតែពេល Archive រួច)</span>
          </label>
          <button
            onClick={doPromote}
            disabled={!source || !dest || toAdd.length === 0}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRightLeft size={16} /> ផ្លាស់សិស្ស {toAdd.length ? `(${toAdd.length} នាក់)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
