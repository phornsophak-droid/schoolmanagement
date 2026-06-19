/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, FileText, Loader2, GraduationCap } from 'lucide-react';
import { StudentScore } from '../types';
import { fetchClassStudents } from '../lib/supabase';
import SchoolLogo from './SchoolLogo';
import StudentReportCard from './StudentReportCard';
import SemesterReportCard from './SemesterReportCard';

interface ParentPortalProps {
  grades: string[];
  onBack: () => void;
}

// Khmer school-year month order, for sorting the months a child has records in.
const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

export default function ParentPortal({ grades, onBack }: ParentPortalProps) {
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classStudents, setClassStudents] = useState<StudentScore[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [childName, setChildName] = useState('');

  // Open-card state
  const [monthlyRec, setMonthlyRec] = useState<StudentScore | null>(null);
  const [semCard, setSemCard] = useState<{ student: StudentScore; period: 1 | 2 | 'year' } | null>(null);

  // Fetch ONLY the selected class (low egress) when a parent picks it.
  const loadClass = async (g: string) => {
    setGrade(g);
    setChildName('');
    setNameQuery('');
    setError('');
    setClassStudents([]);
    if (!g) return;
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
  const filteredNames = useMemo(() => {
    const q = nameQuery.trim();
    return q ? childNames.filter(n => n.includes(q)) : childNames;
  }, [childNames, nameQuery]);

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
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <GraduationCap size={14} className="text-emerald-600" /> ១. ជ្រើសរើសថ្នាក់រៀនរបស់កូន
            </label>
            <select
              value={grade}
              onChange={e => loadClass(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none transition-colors"
            >
              <option value="">— ជ្រើសរើសថ្នាក់ —</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
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

          {/* Step 2 — pick child by name */}
          {!loading && classStudents.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Search size={14} className="text-emerald-600" /> ២. វាយ ឬជ្រើសរើសឈ្មោះកូន
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-2">
                <Search size={14} className="text-slate-400" />
                <input
                  value={nameQuery}
                  onChange={e => setNameQuery(e.target.value)}
                  placeholder="វាយឈ្មោះកូនស្វែងរក..."
                  className="bg-transparent border-none outline-none text-sm text-slate-800 flex-1 placeholder:text-slate-400"
                />
              </div>
              <div className="max-h-52 overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                {filteredNames.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">រកមិនឃើញឈ្មោះនេះទេ</p>
                ) : filteredNames.map(n => (
                  <button
                    key={n}
                    onClick={() => setChildName(n)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${childName === n ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
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
