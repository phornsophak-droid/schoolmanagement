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
import { BookMarked, Plus, Trash2, Search, Check, X, Users, Library, Undo2, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SchoolUser, StudentScore } from '../types';
import {
  Book, Loan, Visit, LibrarySettings,
  loadBooks, loadLoans, loadVisits, loadLibrarySettings, refreshLibraryFromCloud,
  saveBooks, saveLoans, saveVisits, saveLibrarySettings,
  availableCount, outCount, canManageLibrary, newId, todayISO,
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

type Tab = 'books' | 'loans' | 'visits';

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

  // Distinct pupil names, for the name suggestions on the lend/visit forms.
  const studentNames = useMemo(
    () => [...new Set(students.map(s => s.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'km')),
    [students],
  );

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
  const [lDraft, setLDraft] = useState({ bookId: '', student: '', grade: '', dueAt: '' });
  const lend = async () => {
    const book = books.find(b => b.id === lDraft.bookId);
    const student = lDraft.student.trim();
    if (!book) { flash('សូមជ្រើសសៀវភៅ'); return; }
    if (!student) { flash('សូមបញ្ចូលឈ្មោះសិស្ស'); return; }
    if (availableCount(book, loans) <= 0) { flash('សៀវភៅនេះអស់ហើយ'); return; }
    const next = [{
      id: newId(), bookId: book.id, bookTitle: book.title, student, grade: lDraft.grade,
      borrowedAt: todayISO(), dueAt: lDraft.dueAt || undefined,
    }, ...loans];
    setLoans(next); await saveLoans(next);
    setLDraft({ bookId: '', student: '', grade: '', dueAt: '' });
    flash('កត់ត្រាការខ្ចីរួចរាល់ ✓');
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
  const [vDraft, setVDraft] = useState({ student: '', grade: '', purpose: '', date: todayISO() });
  const addVisit = async () => {
    const student = vDraft.student.trim();
    if (!student) { flash('សូមបញ្ចូលឈ្មោះសិស្ស'); return; }
    const next = [{
      id: newId(), student, grade: vDraft.grade, purpose: vDraft.purpose.trim(),
      date: vDraft.date || todayISO(), createdAt: new Date().toISOString(),
    }, ...visits];
    setVisits(next); await saveVisits(next);
    setVDraft({ student: '', grade: '', purpose: '', date: vDraft.date });
    flash('កត់ត្រាចូលអានរួចរាល់ ✓');
  };
  const removeVisit = async (id: string) => {
    const next = visits.filter(v => v.id !== id);
    setVisits(next); await saveVisits(next);
  };
  const [visitDay, setVisitDay] = useState(todayISO());
  const dayVisits = visits.filter(v => v.date === visitDay);

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
          <div>
            <h2 className="text-sm font-bold text-slate-700">គ្រប់គ្រងបណ្ណាល័យ</h2>
            <p className="text-[11px] text-slate-400 font-semibold">
              សៀវភៅ {toKh(books.length)} · កំពុងខ្ចី {toKh(openLoans.length)} · ចូលអានថ្ងៃនេះ {toKh(visits.filter(v => v.date === todayISO()).length)}
            </p>
          </div>
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

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl px-3 py-2">{toast}</div>
      )}

      {/* tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([['books', 'បញ្ជីសៀវភៅ'], ['loans', 'ខ្ចី / សង'], ['visits', 'ចូលអានប្រចាំថ្ងៃ']] as [Tab, string][]).map(([id, label]) => (
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <select className={`${input} lg:col-span-2`} value={lDraft.bookId} onChange={e => setLDraft({ ...lDraft, bookId: e.target.value })}>
                  <option value="">— ជ្រើសសៀវភៅ —</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id} disabled={availableCount(b, loans) <= 0}>
                      {b.title}{availableCount(b, loans) <= 0 ? ' (អស់)' : ` (${availableCount(b, loans)})`}
                    </option>
                  ))}
                </select>
                <input className={input} list="lib-students" placeholder="ឈ្មោះសិស្ស *" value={lDraft.student} onChange={e => setLDraft({ ...lDraft, student: e.target.value })} />
                <select className={input} value={lDraft.grade} onChange={e => setLDraft({ ...lDraft, grade: e.target.value })}>
                  <option value="">— ថ្នាក់ —</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input className={input} type="date" title="ថ្ងៃត្រូវសង" value={lDraft.dueAt} onChange={e => setLDraft({ ...lDraft, dueAt: e.target.value })} />
                <button onClick={lend} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5">
                  <Plus size={13} /> ខ្ចី
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500">កំពុងខ្ចី ({toKh(openLoans.length)})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-bold">សៀវភៅ</th>
                    <th className="py-2 pr-2 font-bold">សិស្ស</th>
                    <th className="py-2 pr-2 font-bold">ថ្នាក់</th>
                    <th className="py-2 pr-2 font-bold">ថ្ងៃខ្ចី</th>
                    <th className="py-2 pr-2 font-bold">ត្រូវសង</th>
                    {canEdit && <th className="py-2 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {openLoans.map(l => (
                    <tr key={l.id} className={`border-b border-slate-50 ${overdue(l) ? 'bg-rose-50/50' : ''}`}>
                      <td className="py-2 pr-2 font-bold text-slate-700">{l.bookTitle}</td>
                      <td className="py-2 pr-2 text-slate-600">{l.student}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{l.grade}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{khDate(l.borrowedAt)}</td>
                      <td className={`py-2 pr-2 whitespace-nowrap font-bold ${overdue(l) ? 'text-rose-600' : 'text-slate-500'}`}>
                        {khDate(l.dueAt)}{overdue(l) ? ' ⚠' : ''}
                      </td>
                      {canEdit && (
                        <td className="py-2 text-right">
                          <button onClick={() => giveBack(l.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1 ml-auto">
                            <Check size={12} /> សង
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {openLoans.length === 0 && (
                    <tr><td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-slate-400 font-semibold">គ្មានសៀវភៅកំពុងខ្ចីទេ</td></tr>
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
              <p className="text-[11px] font-bold text-slate-500">កត់ត្រាសិស្សចូលអាន</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input className={input} list="lib-students" placeholder="ឈ្មោះសិស្ស *" value={vDraft.student} onChange={e => setVDraft({ ...vDraft, student: e.target.value })} />
                <select className={input} value={vDraft.grade} onChange={e => setVDraft({ ...vDraft, grade: e.target.value })}>
                  <option value="">— ថ្នាក់ —</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input className={input} placeholder="គោលបំណង (អាន / ស្រាវជ្រាវ)" value={vDraft.purpose} onChange={e => setVDraft({ ...vDraft, purpose: e.target.value })} />
                <input className={input} type="date" value={vDraft.date} onChange={e => setVDraft({ ...vDraft, date: e.target.value })} />
                <button onClick={addVisit} className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5">
                  <Plus size={13} /> កត់ត្រា
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Users size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">សិស្សចូលអាន</span>
              <input className={input} type="date" value={visitDay} onChange={e => setVisitDay(e.target.value)} />
              <span className="text-[11px] font-bold text-emerald-600">សរុប {toKh(dayVisits.length)} នាក់</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-2 font-bold">ល.រ</th>
                    <th className="py-2 pr-2 font-bold">ឈ្មោះសិស្ស</th>
                    <th className="py-2 pr-2 font-bold">ថ្នាក់</th>
                    <th className="py-2 pr-2 font-bold">គោលបំណង</th>
                    {canEdit && <th className="py-2 font-bold" />}
                  </tr>
                </thead>
                <tbody>
                  {dayVisits.map((v, i) => (
                    <tr key={v.id} className="border-b border-slate-50">
                      <td className="py-2 pr-2 text-slate-400">{toKh(i + 1)}</td>
                      <td className="py-2 pr-2 font-bold text-slate-700">{v.student}</td>
                      <td className="py-2 pr-2 text-slate-500 whitespace-nowrap">{v.grade}</td>
                      <td className="py-2 pr-2 text-slate-500">{v.purpose}</td>
                      {canEdit && (
                        <td className="py-2 text-right">
                          <button onClick={() => removeVisit(v.id)} title="លុប" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {dayVisits.length === 0 && (
                    <tr><td colSpan={canEdit ? 5 : 4} className="py-6 text-center text-slate-400 font-semibold">គ្មានកំណត់ត្រាថ្ងៃនេះទេ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
