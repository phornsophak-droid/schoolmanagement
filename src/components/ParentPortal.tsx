/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, FileText, Loader2, GraduationCap } from 'lucide-react';
import { StudentScore } from '../types';
import { fetchClassStudents, fetchSetting } from '../lib/supabase';
import SchoolLogo from './SchoolLogo';
import { PRINCIPAL_SIG_KEY } from './PrincipalSignature';
import { teacherSigKey } from './TeacherSignature';
import StudentReportCard from './StudentReportCard';
import SemesterReportCard from './SemesterReportCard';

interface ParentPortalProps {
  grades: string[];
  onBack: () => void;
}

const EXTRA_CLASS_KEYWORDS = ['គ្លេស', 'ភាសាអង់គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
const isExtraClass = (grade: string) => EXTRA_CLASS_KEYWORDS.some(k => (grade || '').includes(k));

// Khmer school-year month order, for sorting the months a child has records in.
const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

export default function ParentPortal({ grades, onBack }: ParentPortalProps) {
  const [classCategory, setClassCategory] = useState<'general' | 'extra'>('general');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classStudents, setClassStudents] = useState<StudentScore[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [childName, setChildName] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameMatches, setNameMatches] = useState<string[]>([]);

  // Open-card state
  const [monthlyRec, setMonthlyRec] = useState<StudentScore | null>(null);
  const [semCard, setSemCard] = useState<{ student: StudentScore; period: 1 | 2 | 'year' } | null>(null);

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
    if (!g) return;
    // Pull this class's teacher signature so it shows on the report cards.
    fetchSetting(teacherSigKey(g))
      .then(v => { if (v) { try { localStorage.setItem(teacherSigKey(g), v); } catch { /* ignore */ } } })
      .catch(() => { /* offline */ });
    setLoading(true);
    try {
      const rows = await fetchClassStudents(g);
      setClassStudents(rows);
      if (rows.length === 0) setError('រកមិនឃើញទិន្នន័យសិស្សសម្រាប់ថ្នាក់នេះនៅឡើយទេ។');
    } catch {
      setError('មិនអាចទាញទិន្នន័យបានទេ — សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត រួចព្យាយាមម្ដងទៀត។');
    } finally {
      setLoading(false);
    }
  };

  // Distinct child names in the class (one student may have many monthly rows).
  const childNames = useMemo(
    () => Array.from(new Set<string>(classStudents.map(s => s.name.trim()))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'km')),
    [classStudents]
  );
  // Parents type their child's name themselves (the class roster is never shown,
  // for privacy). Match the typed name against the class: exact first, then a
  // loose contains; show the few candidates only when several match.
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const confirmName = (typed?: string) => {
    const q = normalize(typed ?? nameQuery);
    setNameError('');
    setNameMatches([]);
    setChildName('');
    if (!q) return;
    let result = childNames.filter(n => normalize(n) === q);
    if (result.length === 0) result = childNames.filter(n => normalize(n).includes(q));
    if (result.length === 0) {
      setNameError('រកមិនឃើញឈ្មោះនេះក្នុងថ្នាក់ — សូមពិនិត្យអក្ខរាវិរុទ្ធ រួចព្យាយាមម្ដងទៀត។');
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

  // Months this child has a (non-exam) report card for, in school-year order.
  const monthsAvailable = useMemo(() => {
    const months = Array.from(new Set<string>(childRecords.map(r => r.month)))
      .filter(m => m && !m.startsWith('ប្រឡង'));
    return months.sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
  }, [childRecords]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/40 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <SchoolLogo size={40} />
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">សាលាសហគមន៍ច្បារច្រុះ</h1>
              <p className="text-[11px] text-emerald-700 font-semibold">ព្រឹត្តបត្រពិន្ទុសម្រាប់មាតាបិតា</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-5 space-y-4">
          {/* Step 1 — pick class */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <GraduationCap size={14} className="text-emerald-600" /> ១. ជ្រើសរើសថ្នាក់រៀនរបស់កូន
            </label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-3">
              <button
                onClick={() => handleCategoryChange('general')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${classCategory === 'general' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                📘 ថ្នាក់ចំណេះទូទៅ
              </button>
              <button
                onClick={() => handleCategoryChange('extra')}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${classCategory === 'extra' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                🎨 ថ្នាក់ក្រៅម៉ោង
              </button>
            </div>
            <select
              value={grade}
              onChange={e => loadClass(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">— ជ្រើសរើសថ្នាក់ —</option>
              {filteredGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
              <Loader2 size={18} className="animate-spin" /> កំពុងទាញទិន្នន័យ...
            </div>
          )}
          {error && !loading && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Step 2 — parent types the child's name themselves (no roster shown) */}
          {!loading && classStudents.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Search size={14} className="text-emerald-600" /> ២. វាយឈ្មោះកូនរបស់អ្នក
              </label>
              <div className="flex items-center gap-2">
                <input
                  value={nameQuery}
                  onChange={e => { setNameQuery(e.target.value); setNameError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
                  placeholder="ឧ. ស៊ុំ សំណាង"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-slate-400"
                />
                <button
                  onClick={() => confirmName()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  ស្វែងរក
                </button>
              </div>
              {nameError && <p className="text-xs text-rose-600 mt-2">{nameError}</p>}
              {/* When several students match what was typed, let the parent pick */}
              {nameMatches.length > 1 && (
                <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-50">
                  <p className="text-[11px] text-slate-500 px-3 py-1.5">មានឈ្មោះស្រដៀងគ្នាច្រើន — សូមជ្រើសរើស៖</p>
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
                <p className="text-xs text-emerald-700 font-bold mt-2">✓ បានជ្រើសរើស៖ {childName}</p>
              )}
            </div>
          )}

          {/* Step 3 — choose a report card */}
          {childName && anyRec && (
            <div className="pt-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                <FileText size={14} className="text-emerald-600" /> ៣. ជ្រើសរើសព្រឹត្តបត្រដើម្បីមើល / ទាញយក PDF
              </label>

              {/* Monthly */}
              {monthsAvailable.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-slate-500 font-semibold mb-1.5">ប្រចាំខែ</p>
                  <div className="flex flex-wrap gap-1.5">
                    {monthsAvailable.map(m => (
                      <button
                        key={m}
                        onClick={() => setMonthlyRec(childRecords.find(r => r.month === m) || null)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        ខែ{m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Semester & annual */}
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5">ឆមាស / ប្រចាំឆ្នាំ</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setSemCard({ student: anyRec, period: 1 })} className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-semibold transition-colors">ឆមាសទី ១</button>
                <button onClick={() => setSemCard({ student: anyRec, period: 2 })} className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-semibold transition-colors">ឆមាសទី ២</button>
                <button onClick={() => setSemCard({ student: anyRec, period: 'year' })} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors">ប្រចាំឆ្នាំ</button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          ផ្ទាំងនេះសម្រាប់មាតាបិតាមើល និងទាញយកព្រឹត្តបត្រពិន្ទុរបស់កូនជា PDF តែប៉ុណ្ណោះ។
        </p>
      </div>

      {/* Report card overlays — each has its own Print / PDF + Close */}
      {monthlyRec && (
        <StudentReportCard
          student={monthlyRec}
          students={classStudents}
          onClose={() => setMonthlyRec(null)}
        />
      )}
      {semCard && (
        <SemesterReportCard
          student={semCard.student}
          students={classStudents}
          period={semCard.period}
          onClose={() => setSemCard(null)}
        />
      )}
    </div>
  );
}
