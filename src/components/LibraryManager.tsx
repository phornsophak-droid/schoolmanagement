/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// គ្រប់គ្រងបណ្ណាល័យ — the school library: the book catalogue, the borrow/return
// ledger and the daily log of pupils who came in to read.
//
// The principal and anyone they name as a librarian can edit; everyone else sees
// the same screens read-only, so a teacher can still look a book up.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Plus, Trash2, Search, Check, X, Users, Library, Undo2, Upload, Download, AlertTriangle, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SchoolUser, StudentScore, afterHoursSubject } from '../types';
import {
  Book, Loan, Visit, LibrarySettings,
  loadBooks, loadLoans, loadVisits, loadLibrarySettings, refreshLibraryFromCloud,
  saveBooks, saveLoans, saveVisits, saveLibrarySettings,
  availableCount, outCount, canManageLibrary, visitMinutes, newId, todayISO,
} from '../lib/library';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// Match a spreadsheet column by any of its names, so a sheet typed by hand still
// imports. Same helper the question bank's import uses.
const colIndex = (header: string[], aliases: string[]): number =>
  header.findIndex(h => aliases.some(a => (h || '').toString().trim().toLowerCase().includes(a)));

// Khmer numerals back to Latin, so "២០" in a copies column still reads as 20.
const khToNum = (s: string): number => {
  const latin = (s || '').replace(/[០-៩]/g, d => String('០១២៣៤៥៦៧៨៩'.indexOf(d)));
  const n = parseInt(latin.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// "2026-07-22" → "២២/០៧/២០២៦"
const khDate = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? toKh(`${d}/${m}/${y}`) : toKh(iso);
};

// An ISO instant as "០១:៣០ ល្ងាច" — Khmer 12-hour clock.
const khTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  let h = d.getHours();
  const suffix = h < 12 ? 'ព្រឹក' : 'ល្ងាច';
  h = h % 12 || 12;
  return `${toKh(String(h).padStart(2, '0'))}:${toKh(String(d.getMinutes()).padStart(2, '0'))} ${suffix}`;
};

type Tab = 'books' | 'loans' | 'visits' | 'summary';

interface Props {
  students?: StudentScore[];
  grades?: string[];
  currentUser?: SchoolUser | null;
  onClose?: () => void;
}

export default function LibraryManager({ students = [], grades = [], currentUser, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('books');
  const [books, setBooks] = useState<Book[]>(loadBooks);
  const [loans, setLoans] = useState<Loan[]>(loadLoans);
  const [visits, setVisits] = useState<Visit[]>(loadVisits);
  const [settings, setSettings] = useState<LibrarySettings>(loadLibrarySettings);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Pull the shared library so every device shows the same shelves.
  useEffect(() => {
    refreshLibraryFromCloud().then(() => {
      setBooks(loadBooks()); setLoans(loadLoans());
      setVisits(loadVisits()); setSettings(loadLibrarySettings());
    });
  }, []);

  const canEdit = canManageLibrary(currentUser, settings);
  const isPrincipal = currentUser?.role === 'principal';

  // Reading is tracked for general classes only, so the visit form offers those.
  const generalGrades = useMemo(() => grades.filter(g => afterHoursSubject(g) === ''), [grades]);

  // Distinct pupil names for the lend form suggestions — general classes only, so
  // the after-hours duplicates a pupil carries (their name tagged (A), (E), (PE)…)
  // don't clutter the list.
  const studentNames = useMemo(
    () => [...new Set(
      students.filter(s => afterHoursSubject(s.grade) === '').map(s => s.name.trim()).filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, 'km')),
    [students],
  );

  // Pupils in each general class, so the reading form can offer the class's roster
  // once a class is chosen.
  const namesByGrade = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of students) {
      if (afterHoursSubject(s.grade) !== '') continue;
      const name = s.name.trim();
      if (!name) continue;
      const list = m.get(s.grade) || m.set(s.grade, []).get(s.grade)!;
      if (!list.includes(name)) list.push(name);
    }
    for (const list of m.values()) list.sort((a, b) => a.localeCompare(b, 'km'));
    return m;
  }, [students]);

  // ---- books ----
  const [bDraft, setBDraft] = useState({ code: '', title: '', author: '', category: '', total: '' });
  const addBook = async () => {
    const title = bDraft.title.trim();
    if (!title) { flash('សូមបញ្ចូលចំណងជើងសៀវភៅ'); return; }
    const total = Number(bDraft.total) || 1;
    const next = [{
      id: newId(), code: bDraft.code.trim(), title, author: bDraft.author.trim(),
      category: bDraft.category.trim(), total, createdAt: new Date().toISOString(),
    }, ...books];
    setBooks(next); await saveBooks(next);
    setBDraft({ code: '', title: '', author: '', category: '', total: '' });
    flash('បន្ថែមសៀវភៅរួចរាល់ ✓');
  };
  // Import a book list from Excel/CSV. A row whose លេខកូដ already exists UPDATES that
  // book rather than adding a second copy of the same title, so re-importing a
  // corrected sheet is safe. Rows without a title are skipped, not guessed at.
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const importBooks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      // A UTF-8 CSV must be read as TEXT — reading it as bytes makes XLSX decode
      // Khmer as Latin-1 (mojibake). Binary .xlsx reads fine as an array.
      const isCsv = /\.csv$/i.test(f.name) || (f.type || '').includes('csv') || (f.type || '').startsWith('text/');
      const wb = isCsv
        ? XLSX.read(await f.text(), { type: 'string' })
        : XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: false });
      if (rows.length < 2) { flash('ឯកសារទទេ ឬគ្មានទិន្នន័យ'); return; }
      const header = (rows[0] as any[]).map(x => (x ?? '').toString());
      const ci = {
        code: colIndex(header, ['លេខកូដ', 'code']),
        title: colIndex(header, ['ចំណងជើង', 'title']),
        author: colIndex(header, ['អ្នកនិពន្ធ', 'author']),
        category: colIndex(header, ['ប្រភេទ', 'category']),
        total: colIndex(header, ['ចំនួន', 'total', 'qty']),
      };
      if (ci.title < 0) { flash('រកមិនឃើញជួរ «ចំណងជើង» — សូមប្រើគំរូ'); return; }
      const cell = (row: any[], i: number) => (i >= 0 ? (row?.[i] ?? '').toString().trim() : '');

      const next = [...books];
      let added = 0, updated = 0, skipped = 0;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] as any[];
        const title = cell(row, ci.title);
        if (!title) { skipped++; continue; }
        const code = cell(row, ci.code);
        const total = Math.max(1, khToNum(cell(row, ci.total)) || 1);
        const fields = { code, title, author: cell(row, ci.author), category: cell(row, ci.category), total };
        const at = code ? next.findIndex(b => b.code && b.code === code) : -1;
        if (at >= 0) { next[at] = { ...next[at], ...fields }; updated++; }
        else { next.unshift({ id: newId(), ...fields, createdAt: new Date().toISOString() }); added++; }
      }
      if (added === 0 && updated === 0) { flash('គ្មានជួរណាដែលនាំចូលបានទេ'); return; }
      setBooks(next); await saveBooks(next);
      flash(`នាំចូល៖ ថ្មី ${toKh(added)} · កែ ${toKh(updated)}${skipped ? ` · រំលង ${toKh(skipped)}` : ''} ✓`);
    } catch (err: any) {
      flash(err?.message || 'អានឯកសារ Excel/CSV មិនបាន');
    } finally { setBusy(false); }
  };

  // A filled-in template so the columns are never in doubt.
  const downloadTemplate = () => {
    const header = ['លេខកូដ', 'ចំណងជើង', 'អ្នកនិពន្ធ', 'ប្រភេទ', 'ចំនួនច្បាប់'];
    const example = ['B-001', 'រឿងព្រេងខ្មែរ', 'ក្រសួងអប់រំ', 'អក្សរសាស្ត្រ', '2'];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'បញ្ជីសៀវភៅ');
    XLSX.writeFile(wb, 'template_បញ្ជីសៀវភៅ.xlsx');
  };

  const removeBook = async (id: string) => {
    if (outCount(id, loans) > 0) { flash('សៀវភៅនេះកំពុងខ្ចី — មិនអាចលុបបានទេ'); return; }
    if (!confirm('លុបសៀវភៅនេះ?')) return;
    const next = books.filter(b => b.id !== id);
    setBooks(next); await saveBooks(next);
  };

  // ---- loans ----
  const [lDraft, setLDraft] = useState({ bookSearch: '', student: '', gender: '', grade: '', dueAt: '', days: '' });
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dStr = e.target.value;
    if (!dStr) {
      setLDraft({ ...lDraft, days: dStr, dueAt: '' });
      return;
    }
    const days = parseInt(dStr, 10) || 0;
    const date = new Date();
    date.setDate(date.getDate() + days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setLDraft({ ...lDraft, days: dStr, dueAt: `${y}-${m}-${d}` });
  };

  const handleDueAtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLDraft({ ...lDraft, dueAt: e.target.value, days: '' });
  };

  const lend = async () => {
    const search = lDraft.bookSearch.trim().toLowerCase();
    const book = books.find(b => {
      const l1 = (b.code ? `${b.code} - ${b.title}` : b.title).toLowerCase();
      return search === l1 || search === `${l1} (អស់សៀវភៅ)` || (b.code && b.code.toLowerCase() === search) || b.title.toLowerCase() === search;
    });
    const student = lDraft.student.trim();
    if (!book) { flash('សូមវាយបញ្ចូលលេខកូដ ឬចំណងជើងសៀវភៅឱ្យបានត្រឹមត្រូវ'); return; }
    if (!student) { flash('សូមបញ្ចូលឈ្មោះសិស្ស'); return; }
    
    // allow saving edit even if book has 0 available if they didn't change the book
    const originalLoan = editingLoanId ? loans.find(l => l.id === editingLoanId) : null;
    const isSameBook = originalLoan && originalLoan.bookId === book.id;
    if (!isSameBook && availableCount(book, loans) <= 0) { flash('សៀវភៅនេះអស់ហើយ'); return; }
    
    let next;
    if (editingLoanId) {
      next = loans.map(l => l.id === editingLoanId ? {
        ...l, bookId: book.id, bookTitle: book.title, student, gender: lDraft.gender, grade: lDraft.grade, dueAt: lDraft.dueAt || undefined
      } : l);
      flash('កែប្រែការខ្ចីរួចរាល់ ✓');
    } else {
      next = [{
        id: newId(), bookId: book.id, bookTitle: book.title, student, gender: lDraft.gender, grade: lDraft.grade,
        borrowedAt: todayISO(), dueAt: lDraft.dueAt || undefined,
      }, ...loans];
      flash('កត់ត្រាការខ្ចីរួចរាល់ ✓');
    }
    
    setLoans(next); await saveLoans(next);
    setLDraft({ bookSearch: '', student: '', gender: '', grade: '', dueAt: '', days: '' });
    setEditingLoanId(null);
  };

  const deleteLoan = async (id: string) => {
    if (!confirm('លុបកំណត់ត្រាខ្ចីនេះ?')) return;
    const next = loans.filter(l => l.id !== id);
    setLoans(next); await saveLoans(next);
  };

  const editLoan = (l: Loan) => {
    const book = books.find(b => b.id === l.bookId);
    const bookSearch = book ? (book.code ? `${book.code} - ${book.title}` : book.title) : l.bookTitle;
    let days = '';
    if (l.dueAt) {
       const diff = Math.round((new Date(l.dueAt).getTime() - new Date(l.borrowedAt).getTime()) / (1000 * 60 * 60 * 24));
       days = diff > 0 ? diff.toString() : '';
    }
    setLDraft({ bookSearch, student: l.student, gender: l.gender || '', grade: l.grade || '', dueAt: l.dueAt || '', days });
    setEditingLoanId(l.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const giveBack = async (id: string) => {
    const next = loans.map(l => (l.id === id ? { ...l, returnedAt: todayISO() } : l));
    setLoans(next); await saveLoans(next);
    flash('កត់ត្រាការសងរួចរាល់ ✓');
  };
  const undoReturn = async (id: string) => {
    const next = loans.map(l => (l.id === id ? { ...l, returnedAt: undefined } : l));
    setLoans(next); await saveLoans(next);
  };

  const openLoans = loans.filter(l => !l.returnedAt);
  const closedLoans = loans.filter(l => l.returnedAt);
  const overdue = (l: Loan) => !!l.dueAt && !l.returnedAt && l.dueAt < todayISO();

  // ---- daily reading visits ----
  // Check-in is one tap: it stamps the arrival time. The pupil's reading minutes
  // are worked out on check-out, so the librarian never types a time.
  const [vDraft, setVDraft] = useState({ student: '', grade: '', purpose: '' });
  const checkIn = async () => {
    if (!vDraft.grade) { flash('សូមជ្រើសថ្នាក់សិន'); return; }
    const student = vDraft.student.trim();
    if (!student) { flash('សូមជ្រើសសិស្ស'); return; }
    const now = new Date();
    const next = [{
      id: newId(), student, grade: vDraft.grade, purpose: vDraft.purpose.trim(),
      date: todayISO(), inAt: now.toISOString(), createdAt: now.toISOString(),
    }, ...visits];
    setVisits(next); await saveVisits(next);
    setVDraft({ student: '', grade: '', purpose: '' });
    flash('កត់ត្រាចូលអានរួចរាល់ ✓');
  };
  const checkOut = async (id: string) => {
    const next = visits.map(v => (v.id === id ? { ...v, outAt: new Date().toISOString() } : v));
    setVisits(next); await saveVisits(next);
    flash('កត់ត្រាម៉ោងចេញរួចរាល់ ✓');
  };
  const undoCheckOut = async (id: string) => {
    const next = visits.map(v => (v.id === id ? { ...v, outAt: undefined } : v));
    setVisits(next); await saveVisits(next);
  };
  const removeVisit = async (id: string) => {
    const next = visits.filter(v => v.id !== id);
    setVisits(next); await saveVisits(next);
  };
  const [visitDay, setVisitDay] = useState(todayISO());
  const dayVisits = visits.filter(v => v.date === visitDay);

  // Reading totals for the WHOLE class roster, over an optional month and class
  // filter. Every enrolled pupil is listed — a pupil who never came to read shows
  // ០ នាទី rather than being left out, so the table doubles as the class name list.
  // Only checked-out visits carry minutes; a still-open one adds a count but no time.
  const [summaryMonth, setSummaryMonth] = useState(''); // '' = all time, else 'YYYY-MM'
  const [summaryGrade, setSummaryGrade] = useState(''); // '' = every general class
  const summary = useMemo(() => {
    const inMonth = summaryMonth ? visits.filter(v => v.date.slice(0, 7) === summaryMonth) : visits;
    // Total reading minutes and sessions per pupil name (general-class visits only).
    const stats = new Map<string, { minutes: number; sessions: number }>();
    for (const v of inMonth) {
      if (v.grade && afterHoursSubject(v.grade) !== '') continue;
      const key = v.student.trim();
      if (!key) continue;
      const cur = stats.get(key) || { minutes: 0, sessions: 0 };
      cur.minutes += visitMinutes(v) || 0;
      cur.sessions += 1;
      stats.set(key, cur);
    }
    // The classes to show, in the order they were configured. Include 'ផ្សេងៗ' if there are visits.
    const gradesToShow = (summaryGrade ? [summaryGrade] : [...generalGrades, 'ផ្សេងៗ'])
      .filter(g => namesByGrade.has(g) || inMonth.some(v => v.grade === g));

    return gradesToShow.map(grade => {
      // Every enrolled pupil, plus anyone who read under this class but isn't on the
      // roster (a hand-typed name), so no reading time goes unaccounted for.
      const roster = new Set<string>(namesByGrade.get(grade) || []);
      for (const v of inMonth) if (v.grade === grade && v.student.trim()) roster.add(v.student.trim());
      const rows = [...roster].map(student => ({
        student,
        minutes: stats.get(student)?.minutes || 0,
        sessions: stats.get(student)?.sessions || 0,
      })).sort((a, b) => b.minutes - a.minutes || a.student.localeCompare(b.student, 'km'));
      return { grade, rows, totalMinutes: rows.reduce((s, r) => s + r.minutes, 0) };
    });
  }, [visits, summaryMonth, summaryGrade, generalGrades, namesByGrade]);

  // Months that actually have visits, for the filter dropdown.
  const visitMonths = useMemo(
    () => [...new Set(visits.map(v => v.date.slice(0, 7)))].sort().reverse(),
    [visits],
  );
  const khMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const names = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    return `${names[Number(m) - 1] || m} ${toKh(y)}`;
  };

  // ---- librarians (principal only) ----
  const [libDraft, setLibDraft] = useState('');
  const addLibrarian = async () => {
    const n = libDraft.trim();
    if (!n || settings.librarians.includes(n)) { setLibDraft(''); return; }
    const s = { ...settings, librarians: [...settings.librarians, n] };
    setSettings(s); await saveLibrarySettings(s); setLibDraft('');
  };
  const removeLibrarian = async (n: string) => {
    const s = { ...settings, librarians: settings.librarians.filter(x => x !== n) };
    setSettings(s); await saveLibrarySettings(s);
  };

  const input = 'px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 text-slate-700';
  const filtered = books.filter(b => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [b.title, b.author, b.code, b.category].some(x => (x || '').toLowerCase().includes(s));
  });

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Library size={16} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-700">គ្រប់គ្រងបណ្ណាល័យ</h2>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && <span className="text-[11px] font-bold text-slate-400">អានតែប៉ុណ្ណោះ</span>}
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <X size={13} /> បិទ
            </button>
          )}
        </div>
      </div>

      {/* stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <BookMarked size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">ចំនួនសៀវភៅសរុប</p>
            <p className="text-lg font-black text-slate-700 leading-none mt-1">{toKh(books.length)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Library size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">ចំនួនសៀវភៅកំពុងខ្ចី</p>
            <p className="text-lg font-black text-slate-700 leading-none mt-1">{toKh(openLoans.length)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">សិស្សចូលអានថ្ងៃនេះ</p>
            <p className="text-lg font-black text-slate-700 leading-none mt-1">{toKh(visits.filter(v => v.date === todayISO()).length)}</p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl px-3 py-2">{toast}</div>
      )}

      {canEdit && openLoans.some(overdue) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-rose-600" /> មានសៀវភៅចំនួន {toKh(openLoans.filter(overdue).length)} ក្បាល ដែលដល់ថ្ងៃកំណត់សង ឬហួសកំណត់ហើយ!
          </span>
          {tab !== 'loans' && (
            <button onClick={() => setTab('loans')} className="px-2 py-1 bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-800 transition-colors">
              ពិនិត្យមើល
            </button>
          )}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([['books', 'បញ្ជីសៀវភៅ'], ['loans', 'ខ្ចី / សង'], ['visits', 'ចូលអានប្រចាំថ្ងៃ'], ['summary', 'សរុបនាទីតាមថ្នាក់']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              tab === id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---------------- books ---------------- */}
      {tab === 'books' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-bold text-slate-500">បន្ថែមសៀវភៅថ្មី</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={downloadTemplate} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
                    <Download size={12} /> គំរូ
                  </button>
                  <button onClick={() => fileRef.current?.click()} disabled={busy}
                    className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-blue-600 border border-blue-200 flex items-center gap-1.5">
                    <Upload size={12} /> {busy ? 'កំពុងនាំចូល…' : 'នាំចូល Excel'}
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importBooks} className="hidden" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input className={input} placeholder="លេខកូដ" value={bDraft.code} onChange={e => setBDraft({ ...bDraft, code: e.target.value })} />
                <input className={`${input} lg:col-span-2`} placeholder="ចំណងជើង *" value={bDraft.title} onChange={e => setBDraft({ ...bDraft, title: e.target.value })} />
                <input className={input} placeholder="អ្នកនិពន្ធ" value={bDraft.author} onChange={e => setBDraft({ ...bDraft, author: e.target.value })} />
                <input className={input} placeholder="ប្រភេទ" value={bDraft.category} onChange={e => setBDraft({ ...bDraft, category: e.target.value })} />
                <input className={input} placeholder="ចំនួនច្បាប់" inputMode="numeric" value={bDraft.total} onChange={e => setBDraft({ ...bDraft, total: e.target.value })} />
                <button onClick={addBook} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5">
                  <Plus size={13} /> បន្ថែម
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400" />
              <input className={`${input} flex-1`} placeholder="ស្វែងរក ចំណងជើង / អ្នកនិពន្ធ / លេខកូដ" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-bold">លេខកូដ</th>
                    <th className="py-2 pr-2 font-bold">ចំណងជើង</th>
                    <th className="py-2 pr-2 font-bold">អ្នកនិពន្ធ</th>
                    <th className="py-2 pr-2 font-bold">ប្រភេទ</th>
                    <th className="py-2 pr-2 font-bold text-center">នៅសល់</th>
                    {canEdit && <th className="py-2 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const free = availableCount(b, loans);
                    return (
                      <tr key={b.id} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{b.code}</td>
                        <td className="py-2 pr-2 font-bold text-slate-700">{b.title}</td>
                        <td className="py-2 pr-2 text-slate-500">{b.author}</td>
                        <td className="py-2 pr-2 text-slate-500">{b.category}</td>
                        <td className={`py-2 pr-2 text-center font-bold ${free > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {toKh(free)}/{toKh(b.total)}
                        </td>
                        {canEdit && (
                          <td className="py-2 text-right">
                            <button onClick={() => removeBook(b.id)} title="លុប" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-slate-400 font-semibold">មិនទាន់មានសៀវភៅ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- loans ---------------- */}
      {tab === 'loans' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-500">កត់ត្រាការខ្ចី</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <input 
                  className={`${input} lg:col-span-2`} 
                  list="lib-books" 
                  placeholder="លេខកូដ ឬចំណងជើងសៀវភៅ *" 
                  value={lDraft.bookSearch} 
                  onChange={e => setLDraft({ ...lDraft, bookSearch: e.target.value })} 
                />
                <datalist id="lib-books">
                  {books.map(b => (
                    <option key={b.id} value={b.code ? `${b.code} - ${b.title}` : b.title}>
                      {availableCount(b, loans) <= 0 ? '(អស់សៀវភៅ)' : ''}
                    </option>
                  ))}
                </datalist>
                <input className={input} list="lib-students" placeholder="ឈ្មោះសិស្ស *" value={lDraft.student} onChange={e => setLDraft({ ...lDraft, student: e.target.value })} />
                <select className={input} value={lDraft.gender} onChange={e => setLDraft({ ...lDraft, gender: e.target.value })}>
                  <option value="">— ភេទ —</option>
                  <option value="ប្រុស">ប្រុស (M)</option>
                  <option value="ស្រី">ស្រី (F)</option>
                </select>
                <select className={input} value={lDraft.grade} onChange={e => setLDraft({ ...lDraft, grade: e.target.value })}>
                  <option value="">— ថ្នាក់ —</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <div className="flex gap-1 relative">
                  <input className={`w-16 ${input} px-1.5`} type="number" min="1" placeholder="ថ្ងៃ" title="ចំនួនថ្ងៃខ្ចី" value={lDraft.days} onChange={handleDaysChange} />
                  <input className={`flex-1 ${input} px-1.5`} type="date" title="ថ្ងៃត្រូវសង" value={lDraft.dueAt} onChange={handleDueAtChange} />
                </div>
                <div className="flex gap-2 lg:col-span-6">
                  <button onClick={lend} className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5">
                    {editingLoanId ? <Check size={13} /> : <Plus size={13} />} {editingLoanId ? 'រក្សាទុក' : 'ខ្ចី'}
                  </button>
                  {editingLoanId && (
                    <button onClick={() => { setLDraft({ bookSearch: '', student: '', gender: '', grade: '', dueAt: '', days: '' }); setEditingLoanId(null); }} className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center gap-1.5">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500">កំពុងខ្ចី ({toKh(openLoans.length)})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-bold">ល.រ</th>
                    <th className="py-2 pr-2 font-bold">ឈ្មោះសិស្សខ្ចីសៀវភៅ</th>
                    <th className="py-2 pr-2 font-bold">ភេទ</th>
                    <th className="py-2 pr-2 font-bold">ថ្នាក់</th>
                    <th className="py-2 pr-2 font-bold">ចំណងជើងសៀវភៅ</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">កាលបរិច្ឆេទខ្ចី</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">រយៈពេល</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">កាលបរិច្ឆេទត្រូវសង</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">សារជូនដំណឹង</th>
                    {canEdit && <th className="py-2 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {openLoans.map((l, i) => (
                    <tr key={l.id} className={`border-b border-slate-50 ${overdue(l) ? 'bg-rose-50/50' : ''}`}>
                      <td className="py-2 pr-2 text-slate-400">{toKh(i + 1)}</td>
                      <td className="py-2 pr-2 font-bold text-slate-700">{l.student}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{l.gender || '—'}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{l.grade}</td>
                      <td className="py-2 pr-2 text-slate-600">{l.bookTitle}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{khDate(l.borrowedAt)}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">
                        {l.dueAt ? toKh(Math.max(0, Math.round((new Date(l.dueAt).getTime() - new Date(l.borrowedAt).getTime()) / (1000 * 60 * 60 * 24)))) + ' ថ្ងៃ' : '—'}
                      </td>
                      <td className={`py-2 pr-2 whitespace-nowrap font-bold ${overdue(l) ? 'text-rose-600' : 'text-slate-500'}`}>
                        {khDate(l.dueAt)}
                      </td>
                      <td className="py-2 pr-2">
                        {overdue(l) && (
                          <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1 bg-rose-100/50 w-fit px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> ត្រូវតាមដានសង
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => editLoan(l)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="កែប្រែ">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => deleteLoan(l.id)} className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 mr-2" title="លុប">
                              <Trash2 size={13} />
                            </button>
                            <button onClick={() => giveBack(l.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1">
                              <Check size={12} /> សង
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {openLoans.length === 0 && (
                    <tr><td colSpan={canEdit ? 10 : 9} className="py-6 text-center text-slate-400 font-semibold">គ្មានសៀវភៅកំពុងខ្ចីទេ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {closedLoans.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-500">សងរួច ({toKh(closedLoans.length)})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {closedLoans.slice(0, 50).map(l => (
                      <tr key={l.id} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-600">{l.bookTitle}</td>
                        <td className="py-2 pr-2 text-slate-500">{l.student}</td>
                        <td className="py-2 pr-2 text-slate-400 whitespace-nowrap">សង {khDate(l.returnedAt)}</td>
                        {canEdit && (
                          <td className="py-2 text-right">
                            <button onClick={() => undoReturn(l.id)} title="ត្រឡប់ជាកំពុងខ្ចី" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                              <Undo2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- daily reading visits ---------------- */}
      {tab === 'visits' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-500">កត់ត្រាសិស្សចូលអាន — ជ្រើសថ្នាក់សិន រួចជ្រើសសិស្ស</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select className={input} value={vDraft.grade} onChange={e => setVDraft({ ...vDraft, grade: e.target.value, student: '' })}>
                  <option value="">— ជ្រើសថ្នាក់ * —</option>
                  {generalGrades.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="ផ្សេងៗ">ផ្សេងៗ (ក្រៅបញ្ជី)</option>
                </select>
                {vDraft.grade === 'ផ្សេងៗ' ? (
                  <input className={input} placeholder="ឈ្មោះសិស្ស *" value={vDraft.student} onChange={e => setVDraft({ ...vDraft, student: e.target.value })} />
                ) : (
                  <select className={input} value={vDraft.student} disabled={!vDraft.grade}
                    onChange={e => setVDraft({ ...vDraft, student: e.target.value })}>
                    <option value="">{vDraft.grade ? '— ជ្រើសសិស្ស * —' : '— ជ្រើសថ្នាក់សិន —'}</option>
                    {(namesByGrade.get(vDraft.grade) || []).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                <input className={input} placeholder="គោលបំណង (អាន / ស្រាវជ្រាវ)" value={vDraft.purpose} onChange={e => setVDraft({ ...vDraft, purpose: e.target.value })} />
                <button onClick={checkIn} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5">
                  <Plus size={13} /> ចូល
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Users size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">សិស្សចូលអាន</span>
              <input className={input} type="date" value={visitDay} onChange={e => setVisitDay(e.target.value)} />
              <span className="text-[11px] font-bold text-emerald-600">
                សរុប {toKh(dayVisits.length)} នាក់
                {(() => { const m = dayVisits.reduce((a, v) => a + (visitMinutes(v) || 0), 0); return m > 0 ? ` · ${toKh(m)} នាទី` : ''; })()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-bold">ល.រ</th>
                    <th className="py-2 pr-2 font-bold">ឈ្មោះសិស្ស</th>
                    <th className="py-2 pr-2 font-bold">ថ្នាក់</th>
                    <th className="py-2 pr-2 font-bold">គោលបំណង</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">ម៉ោងចូល</th>
                    <th className="py-2 pr-2 font-bold whitespace-nowrap">ម៉ោងចេញ</th>
                    <th className="py-2 pr-2 font-bold text-center whitespace-nowrap">នាទី</th>
                    {canEdit && <th className="py-2 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {dayVisits.map((v, i) => {
                    const mins = visitMinutes(v);
                    return (
                      <tr key={v.id} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-400">{toKh(i + 1)}</td>
                        <td className="py-2 pr-2 font-bold text-slate-700">{v.student}</td>
                        <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{v.grade}</td>
                        <td className="py-2 pr-2 text-slate-500">{v.purpose}</td>
                        <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{khTime(v.inAt)}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {v.outAt
                            ? <span className="text-slate-500">{khTime(v.outAt)}</span>
                            : <span className="text-emerald-600 font-bold">កំពុងអាន</span>}
                        </td>
                        <td className="py-2 pr-2 text-center font-bold text-slate-700">{mins === null ? '—' : toKh(mins)}</td>
                        {canEdit && (
                          <td className="py-2 text-right whitespace-nowrap">
                            {!v.outAt ? (
                              <button onClick={() => checkOut(v.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 inline-flex items-center gap-1">
                                <Check size={12} /> ចេញ
                              </button>
                            ) : (
                              <button onClick={() => undoCheckOut(v.id)} title="ត្រឡប់ជាកំពុងអាន" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                                <Undo2 size={13} />
                              </button>
                            )}
                            <button onClick={() => removeVisit(v.id)} title="លុប" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 ml-0.5">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {dayVisits.length === 0 && (
                    <tr><td colSpan={canEdit ? 8 : 7} className="py-6 text-center text-slate-400 font-semibold">គ្មានកំណត់ត្រាថ្ងៃនេះទេ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- reading minutes per pupil, by class ---------------- */}
      {tab === 'summary' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
            <Users size={14} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">បញ្ជីឈ្មោះសិស្ស និងនាទីអានសរុប</span>
            <select className={input} value={summaryGrade} onChange={e => setSummaryGrade(e.target.value)}>
              <option value="">គ្រប់ថ្នាក់</option>
              {generalGrades.map(g => <option key={g} value={g}>{g}</option>)}
              <option value="ផ្សេងៗ">ផ្សេងៗ</option>
            </select>
            <select className={input} value={summaryMonth} onChange={e => setSummaryMonth(e.target.value)}>
              <option value="">គ្រប់ខែ</option>
              {visitMonths.map(m => <option key={m} value={m}>{khMonthLabel(m)}</option>)}
            </select>
          </div>

          {summary.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-400 font-semibold text-xs">
              គ្មានបញ្ជីឈ្មោះសិស្សថ្នាក់ទូទៅទេ
            </div>
          )}

          {summary.map(group => (
            <div key={group.grade} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-emerald-700">{group.grade}</p>
                <p className="text-[11px] font-bold text-slate-400">សរុប {toKh(group.totalMinutes)} នាទី</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="py-2 pr-2 font-bold">ល.រ</th>
                      <th className="py-2 pr-2 font-bold">ឈ្មោះសិស្ស</th>
                      <th className="py-2 pr-2 font-bold text-center whitespace-nowrap">ចំនួនដង</th>
                      <th className="py-2 pr-2 font-bold text-center whitespace-nowrap">នាទីសរុប</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r, i) => (
                      <tr key={r.student} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-400">{toKh(i + 1)}</td>
                        <td className="py-2 pr-2 font-bold text-slate-700">{r.student}</td>
                        <td className="py-2 pr-2 text-center text-slate-500">{toKh(r.sessions)}</td>
                        <td className="py-2 pr-2 text-center font-bold text-emerald-700">{toKh(r.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* librarians — only the principal decides who may edit */}
      {isPrincipal && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            <BookMarked size={13} className="text-slate-400" /> បណ្ណារក្ស — អ្នកដែលអាចកែបាន
          </p>
          <div className="flex flex-wrap gap-1.5">
            {settings.librarians.map(n => (
              <span key={n} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                {n}
                <button onClick={() => removeLibrarian(n)} className="text-slate-400 hover:text-rose-500"><X size={11} /></button>
              </span>
            ))}
            {settings.librarians.length === 0 && <span className="text-[11px] text-slate-400 font-semibold">មានតែនាយកសាលាប៉ុណ្ណោះ</span>}
          </div>
          <div className="flex gap-2">
            <input className={`${input} flex-1`} placeholder="ឈ្មោះគ្រូបណ្ណារក្ស" value={libDraft}
              onChange={e => setLibDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLibrarian(); }} />
            <button onClick={addLibrarian} className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1.5">
              <Plus size={13} /> បន្ថែម
            </button>
          </div>
        </div>
      )}

      {/* name suggestions shared by the lend and visit forms */}
      <datalist id="lib-students">
        {studentNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
}
