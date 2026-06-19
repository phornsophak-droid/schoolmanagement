/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { X, Download, Upload, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentScore } from '../types';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import { khmerLunarFull } from '../utils/khmerDate';

type State = 'present' | 'late' | 'permission' | 'absent';

export interface AttRecord {
  id: string;
  date: string;          // yyyy-mm-dd
  grade: string;
  session?: 'morning' | 'afternoon';
  presentCount: number;
  lateCount?: number;
  permissionCount: number;
  absentCount: number;
  studentStates: { [studentId: string]: State | string };
}

interface Props {
  students: StudentScore[];   // deduped roster (one row per student)
  grade: string;
  year: number;
  month: number;              // 1-12
  records: AttRecord[];       // all student attendance records
  onClose: () => void;
  onImport: (updated: AttRecord[]) => void;  // persist imported day-marks
}

const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
// Single-letter Khmer weekday, Sun..Sat (matches the printed register).
const KH_DOW = ['អ', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'];
const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const pad2 = (n: number) => String(n).padStart(2, '0');

// Marks shown in the grid (matches the school's Excel).
const MARK_PERM = 'ច្ប';   // ច្បាប់ — excused
const MARK_ABS = 'អច្ប';   // អត់ច្បាប់ — unexcused
const MARK_LATE = 'យ';     // យឺត — late
const genderShort = (g: string) => (g === 'ស្រី' ? 'ស' : 'ប');

// Click-cycle order for marking a cell: blank → late → excused → unexcused → blank.
const STATE_CYCLE: ('' | State)[] = ['', 'late', 'permission', 'absent'];
// After-hours classes store a single session record (no morning/afternoon split).
const EXTRA_CLASS_KEYWORDS = ['គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];

// Academic-year months in order, each with its calendar year (Nov 2025 – Oct 2026).
const ACADEMIC_MONTHS: { m: number; y: number }[] = [
  { m: 11, y: 2025 }, { m: 12, y: 2025 },
  { m: 1, y: 2026 }, { m: 2, y: 2026 }, { m: 3, y: 2026 }, { m: 4, y: 2026 },
  { m: 5, y: 2026 }, { m: 6, y: 2026 }, { m: 7, y: 2026 }, { m: 8, y: 2026 },
  { m: 9, y: 2026 }, { m: 10, y: 2026 },
];

export default function MonthlyAttendanceRegister({ students, grade, year: initYear, month: initMonth, records, onClose, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState('');
  // Month/year are selectable so a parent can view/import any month, not just the
  // one open in the daily panel.
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const mm = pad2(month);

  const roster = useMemo(
    () => students.filter(s => s.grade === grade).sort((a, b) => a.name.localeCompare(b.name, 'km')),
    [students, grade]
  );

  // This month's records for this class, indexed by day for fast lookup.
  const recordsByDay = useMemo(() => {
    const map: { [day: number]: AttRecord[] } = {};
    records.forEach(r => {
      if (r.grade !== grade) return;
      if (!r.date || !r.date.startsWith(`${year}-${mm}-`)) return;
      const day = parseInt(r.date.slice(8, 10), 10);
      (map[day] = map[day] || []).push(r);
    });
    return map;
  }, [records, grade, year, mm]);

  // A student's raw state for one day (absent > permission > late > none).
  const stateOf = (studentId: string, day: number): '' | State => {
    const recs = recordsByDay[day];
    if (!recs) return '';
    let perm = false, late = false;
    for (const r of recs) {
      const st = r.studentStates?.[studentId];
      if (st === 'absent') return 'absent';
      if (st === 'permission') perm = true;
      if (st === 'late') late = true;
    }
    return perm ? 'permission' : late ? 'late' : '';
  };
  const markOf = (studentId: string, day: number): string => {
    const s = stateOf(studentId, day);
    return s === 'absent' ? MARK_ABS : s === 'permission' ? MARK_PERM : s === 'late' ? MARK_LATE : '';
  };

  // Click a cell to cycle its mark and save it straight into daily attendance.
  const isExtra = EXTRA_CLASS_KEYWORDS.some(k => grade.includes(k));
  const cycleMark = (studentId: string, day: number) => {
    const cur = stateOf(studentId, day);
    const next = STATE_CYCLE[(STATE_CYCLE.indexOf(cur) + 1) % STATE_CYCLE.length];
    const date = `${year}-${mm}-${pad2(day)}`;
    const id = isExtra ? `att-${date}-${grade}` : `att-morning-${date}-${grade}`;
    const existing = records.find(r => r.id === id);
    const rec: AttRecord = existing
      ? { ...existing, studentStates: { ...existing.studentStates } }
      : { id, date, grade, session: isExtra ? undefined : 'morning', presentCount: 0, lateCount: 0, permissionCount: 0, absentCount: 0, studentStates: {} };
    if (next) rec.studentStates[studentId] = next; else delete rec.studentStates[studentId];
    let l = 0, pe = 0, a = 0;
    Object.entries(rec.studentStates).forEach(([k, st]) => {
      if (k.endsWith('_reason')) return;
      if (st === 'late') l++; else if (st === 'permission') pe++; else if (st === 'absent') a++;
    });
    rec.lateCount = l; rec.permissionCount = pe; rec.absentCount = a;
    rec.presentCount = Math.max(0, roster.length - (l + pe + a));
    onImport([rec]);
  };

  // Per-student excused / unexcused / late counts (total = absence days only).
  const rowTotals = (studentId: string) => {
    let perm = 0, abs = 0, late = 0;
    for (const d of days) {
      const m = markOf(studentId, d);
      if (m === MARK_PERM) perm++;
      else if (m === MARK_ABS) abs++;
      else if (m === MARK_LATE) late++;
    }
    return { perm, abs, late, total: perm + abs };
  };

  const operatedDays = useMemo(() => Object.keys(recordsByDay).length, [recordsByDay]);
  const girls = roster.filter(s => s.gender === 'ស្រី').length;

  const grandTotals = useMemo(() => {
    let perm = 0, abs = 0, late = 0;
    roster.forEach(s => { const t = rowTotals((s as any).id); perm += t.perm; abs += t.abs; late += t.late; });
    return { perm, abs, late, total: perm + abs };
  }, [roster, recordsByDay, days]);

  const denom = roster.length * (operatedDays || 0);
  const ratePct = denom > 0 ? (grandTotals.total * 100 / denom) : 0;
  const monthName = KH_MONTHS[month - 1];

  // ---- Excel export (.xlsx) — same layout as the printed register ----
  const handleExport = () => {
    const dowRow = ['', '', '', ''].concat(days.map(d => KH_DOW[new Date(year, month - 1, d).getDay()])).concat(['', '', '', '', '']);
    const numRow = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ'].concat(days.map(d => toKh(d))).concat(['យឺត', 'ច្ប', 'អ ច្ប', 'សរុប', 'ផ្សេងៗ']);
    const body = roster.map((s, i) => {
      const id = (s as any).id;
      const t = rowTotals(id);
      return [toKh(i + 1), (s as any).studentId || '', s.name, genderShort(s.gender)]
        .concat(days.map(d => markOf(id, d)))
        .concat([t.late ? toKh(t.late) : '', t.perm ? toKh(t.perm) : '', t.abs ? toKh(t.abs) : '', t.total ? toKh(t.total) : '']);
    });
    const totalRow = ['', '', 'សរុប', ''].concat(days.map(d => {
      const c = roster.filter(s => markOf((s as any).id, d)).length;
      return c ? toKh(c) : '';
    })).concat([toKh(grandTotals.late), toKh(grandTotals.perm), toKh(grandTotals.abs), toKh(grandTotals.total)]);

    const title = [`តារាងតាមដានអវត្តមានសិស្ស ${grade} ប្រចាំខែ${monthName} ឆ្នាំសិក្សា ២០២៥-២០២៦`];
    const aoa = [title, [], dowRow, numRow, ...body, totalRow, [],
      [`ចំនួនសិស្សក្នុងបញ្ជី៖ ${toKh(roster.length)} នាក់ (ស្រី ${toKh(girls)})`,],
      [`ចំនួនថ្ងៃសិក្សា៖ ${toKh(operatedDays)} ថ្ងៃ`,],
      [`អវត្តមានសរុប៖ ${toKh(grandTotals.total)} (ច្បាប់ ${toKh(grandTotals.perm)} / អត់ច្បាប់ ${toKh(grandTotals.abs)})`,],
      [`យឺតសរុប៖ ${toKh(grandTotals.late)} ដង`,],
      [`ភាគរយអវត្តមាន៖ ${ratePct.toFixed(2)}%`,],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 4 }, { wch: 7 }, { wch: 22 }, { wch: 4 }, ...days.map(() => ({ wch: 3 })), { wch: 4 }, { wch: 4 }, { wch: 5 }, { wch: 5 }, { wch: 8 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: numRow.length - 1 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `អវត្តមាន ${monthName}`);
    XLSX.writeFile(wb, `អវត្តមាន_${grade}_${monthName}_${year}.xlsx`);
  };

  // ---- Excel import — read the same template back into daily attendance ----
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        // Locate the header row (has 'អត្តលេខ' and a name column).
        const hdrIdx = rows.findIndex(r => r.some(c => String(c).includes('អត្តលេខ')) && r.some(c => String(c).includes('នាម')));
        if (hdrIdx < 0) { setToast('រកមិនឃើញក្បាលតារាង (អត្តលេខ / គោត្តនាម)'); return; }
        const hdr = rows[hdrIdx].map((c: any) => String(c).trim());
        const idCol = hdr.findIndex(c => c.includes('អត្តលេខ'));
        const nameCol = hdr.findIndex(c => c.includes('នាម'));
        const genderCol = hdr.findIndex(c => c === 'ភេទ');
        // Day columns: the numeric headers right after gender.
        const dayCols: { col: number; day: number }[] = [];
        hdr.forEach((c, idx) => {
          if (idx <= genderCol) return;
          const n = parseInt(String(c).replace(/[០-៩]/g, d => String('០១២៣៤៥៦៧៨៩'.indexOf(d))), 10);
          if (!isNaN(n) && n >= 1 && n <= 31) dayCols.push({ col: idx, day: n });
        });
        if (dayCols.length === 0) { setToast('រកមិនឃើញជួរថ្ងៃ (១–៣១)'); return; }

        const byName = new Map(roster.map(s => [s.name.replace(/\s+/g, ' ').trim(), s]));
        const touched = new Map<string, AttRecord>();
        const getRec = (day: number): AttRecord => {
          const date = `${year}-${mm}-${pad2(day)}`;
          const id = `att-morning-${date}-${grade}`;
          if (touched.has(id)) return touched.get(id)!;
          const existing = records.find(r => r.id === id);
          const rec: AttRecord = existing
            ? { ...existing, studentStates: { ...existing.studentStates } }
            : { id, date, grade, session: 'morning', presentCount: 0, lateCount: 0, permissionCount: 0, absentCount: 0, studentStates: {} };
          touched.set(id, rec);
          return rec;
        };

        let marks = 0, unmatched = 0;
        for (let i = hdrIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const nm = String(row[nameCol] ?? '').replace(/\s+/g, ' ').trim();
          if (!nm || nm === 'សរុប' || nm.includes('សរុបស្រី')) continue;
          let stu = byName.get(nm);
          if (!stu && idCol >= 0) {
            const sid = String(row[idCol] ?? '').trim();
            stu = roster.find(s => ((s as any).studentId || '').trim() === sid && sid);
          }
          if (!stu) { unmatched++; continue; }
          const sid = (stu as any).id;
          for (const { col, day } of dayCols) {
            const v = String(row[col] ?? '').replace(/\s+/g, '').trim();
            if (!v) continue;
            const rec = getRec(day);
            if (v.includes('អ')) { rec.studentStates[sid] = 'absent'; marks++; }
            else if (v.includes('ច្ប') || v.includes('ច')) { rec.studentStates[sid] = 'permission'; marks++; }
            else if (v.includes('យ')) { rec.studentStates[sid] = 'late'; marks++; }
          }
        }
        // Recount each touched record's aggregate counts.
        const updated = Array.from(touched.values()).map(rec => {
          let p = 0, l = 0, pe = 0, a = 0;
          Object.entries(rec.studentStates).forEach(([k, st]) => {
            if (k.endsWith('_reason')) return;
            if (st === 'late') l++; else if (st === 'permission') pe++; else if (st === 'absent') a++; else p++;
          });
          return { ...rec, presentCount: p, lateCount: l, permissionCount: pe, absentCount: a };
        });
        onImport(updated);
        setToast(`បាននាំចូល ${toKh(marks)} សញ្ញាអវត្តមាន${unmatched ? ` (រកមិនឃើញ ${toKh(unmatched)} ឈ្មោះ)` : ''} ✓`);
      } catch (err) {
        console.error('Monthly attendance import failed', err);
        setToast('មានបញ្ហាក្នុងការអានឯកសារ! សូមប្រើគំរូដែលបាននាំចេញ។');
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const sigDate = khmerLunarFull(new Date(year, month, 0));

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #att-register-print, #att-register-print * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #att-register-print { position: absolute; left: 0; top: 0; width: 100%; }
    #att-register-print .overflow-auto { overflow: visible !important; }
    .rc-no-print { display: none !important; }
    @page { size: A4 landscape; margin: 8mm; }
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-3 flex justify-center items-start">
      <style>{printCss}</style>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
      <div className="w-full max-w-[1280px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100 sticky top-0 z-10">
          <h3 className="text-sm font-bold text-slate-800">តារាងអវត្តមានប្រចាំខែ — {grade} • ខែ{monthName} {toKh(year)}</h3>
          <div className="flex items-center gap-2">
            <select
              value={`${year}-${month}`}
              onChange={e => { const [y, m] = e.target.value.split('-').map(Number); setYear(y); setMonth(m); }}
              className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:border-indigo-500 focus:outline-none transition-colors"
              title="ជ្រើសរើសខែ"
            >
              {ACADEMIC_MONTHS.map(({ m, y }) => (
                <option key={`${y}-${m}`} value={`${y}-${m}`}>ខែ{KH_MONTHS[m - 1]} {toKh(y)}</option>
              ))}
            </select>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors">
              <Upload size={13} /> នាំចូល Excel
            </button>
            <button onClick={handleExport} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors">
              <Download size={13} /> ទាញយក Excel
            </button>
            <button onClick={() => window.print()} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors">
              <Printer size={13} /> ទាញយក PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        <div id="att-register-print" className="bg-white rounded-b-2xl shadow-xl p-4 text-slate-800">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <SchoolLogo size={48} />
            <div className="text-center">
              <div className="text-sm font-extrabold">តារាងតាមដានអវត្តមានសិស្ស</div>
              <div className="text-xs font-bold">{grade} • ប្រចាំខែ{monthName} • ឆ្នាំសិក្សា ២០២៥-២០២៦</div>
            </div>
          </div>

          {/* Edit hint / legend */}
          <div className="rc-no-print flex items-center justify-center gap-3 mb-2 text-[10.5px] text-slate-500">
            <span className="font-bold text-slate-600">ចុចលើប្រអប់ថ្ងៃ ដើម្បីកំណត់៖</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">យ = យឺត</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">ច្ប = ច្បាប់</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">អច្ប = អត់ច្បាប់</span>
            <span className="text-slate-400">(ចុចម្ដងទៀតដើម្បីលុប)</span>
          </div>

          {/* Grid */}
          <div className="overflow-auto border border-slate-300">
            <table className="border-collapse text-[10px] whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-slate-300 px-1 sticky left-0 bg-slate-100">ល.រ</th>
                  <th className="border border-slate-300 px-1">អត្តលេខ</th>
                  <th className="border border-slate-300 px-1 text-left">គោត្តនាម និងនាម</th>
                  <th className="border border-slate-300 px-1">ភេទ</th>
                  {days.map(d => (
                    <th key={d} className="border border-slate-300 w-5">{KH_DOW[new Date(year, month - 1, d).getDay()]}</th>
                  ))}
                  <th className="border border-slate-300 px-1 bg-amber-50">យឺត</th>
                  <th className="border border-slate-300 px-1 bg-blue-50">ច្ប</th>
                  <th className="border border-slate-300 px-1 bg-rose-50">អ ច្ប</th>
                  <th className="border border-slate-300 px-1">សរុប</th>
                </tr>
                <tr className="bg-slate-50 text-center text-slate-500">
                  <th className="border border-slate-300 sticky left-0 bg-slate-50" colSpan={4}></th>
                  {days.map(d => <th key={d} className="border border-slate-300 w-5 font-normal">{toKh(d)}</th>)}
                  <th className="border border-slate-300" colSpan={4}></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s, i) => {
                  const id = (s as any).id;
                  const t = rowTotals(id);
                  return (
                    <tr key={id} className="text-center h-5">
                      <td className="border border-slate-300 sticky left-0 bg-white">{toKh(i + 1)}</td>
                      <td className="border border-slate-300 px-1 font-mono text-[9px]">{(s as any).studentId || ''}</td>
                      <td className="border border-slate-300 px-1 text-left">{s.name}</td>
                      <td className="border border-slate-300">{genderShort(s.gender)}</td>
                      {days.map(d => {
                        const m = markOf(id, d);
                        return <td key={d} onClick={() => cycleMark(id, d)} title="ចុចដើម្បីប្តូរ៖ ទទេ → យឺត → ច្ប → អច្ប" className={`border border-slate-300 text-[8px] font-bold cursor-pointer select-none hover:ring-1 hover:ring-indigo-400 hover:ring-inset ${m === MARK_ABS ? 'text-rose-600 bg-rose-50' : m === MARK_PERM ? 'text-blue-600 bg-blue-50' : m === MARK_LATE ? 'text-amber-600 bg-amber-50' : 'hover:bg-slate-100'}`}>{m}</td>;
                      })}
                      <td className="border border-slate-300 bg-amber-50 font-bold text-amber-700">{t.late ? toKh(t.late) : ''}</td>
                      <td className="border border-slate-300 bg-blue-50 font-bold">{t.perm ? toKh(t.perm) : ''}</td>
                      <td className="border border-slate-300 bg-rose-50 font-bold">{t.abs ? toKh(t.abs) : ''}</td>
                      <td className="border border-slate-300 font-bold">{t.total ? toKh(t.total) : ''}</td>
                    </tr>
                  );
                })}
                {/* Column totals */}
                <tr className="text-center font-bold bg-slate-100 h-5">
                  <td className="border border-slate-300 sticky left-0 bg-slate-100" colSpan={4}>សរុប</td>
                  {days.map(d => {
                    const c = roster.filter(s => markOf((s as any).id, d)).length;
                    return <td key={d} className="border border-slate-300 text-[8px]">{c ? toKh(c) : ''}</td>;
                  })}
                  <td className="border border-slate-300 bg-amber-50 text-amber-700">{toKh(grandTotals.late)}</td>
                  <td className="border border-slate-300 bg-blue-50">{toKh(grandTotals.perm)}</td>
                  <td className="border border-slate-300 bg-rose-50">{toKh(grandTotals.abs)}</td>
                  <td className="border border-slate-300">{toKh(grandTotals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-[11px]">
            <div className="bg-slate-50 rounded-lg px-3 py-2">សិស្សក្នុងបញ្ជី៖ <b>{toKh(roster.length)}</b> នាក់ (ស្រី {toKh(girls)})</div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">ថ្ងៃសិក្សា៖ <b>{toKh(operatedDays)}</b> ថ្ងៃ</div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">អវត្តមានសរុប៖ <b>{toKh(grandTotals.total)}</b> (ច្បាប់ {toKh(grandTotals.perm)} / អត់ច្បាប់ {toKh(grandTotals.abs)})</div>
            <div className="bg-amber-50 rounded-lg px-3 py-2">យឺតសរុប៖ <b>{toKh(grandTotals.late)}</b> ដង</div>
            <div className="bg-amber-50 rounded-lg px-3 py-2">ភាគរយអវត្តមាន៖ <b>{ratePct.toFixed(2)}%</b></div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-6 text-[11px] text-center">
            <div>
              <p className="font-bold">បានឃើញ និងឯកភាព</p>
              <p className="font-bold">នាយកសាលា</p>
              <PrincipalSignature />

            </div>
            <div>
              <p>{sigDate}</p>
              <p>ច្បារច្រុះ ថ្ងៃទី......... ខែ{monthName} ឆ្នាំ{toKh(year)}</p>
              <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
              <p className="text-slate-300 pt-6">..............................</p>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}
