/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ប្រតិទិនចន្ទគតិ — an in-app Khmer lunar calendar (the external site didn't work on
// phones). A month grid where every day shows its Gregorian date and its lunar day
// (day + moon phase, e.g. ៥កើត), computed from the vendored Chhankitek engine
// (utils/momentkh). Full-moon (១៥កើត) and dark-moon (១៥រោច) days are marked.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X, Pencil, Trash2 } from 'lucide-react';
import { fromDate } from '../utils/momentkh';
import { holidayName } from '../utils/khmerHolidays';
import { CalNotes, dateKey, loadCalNotes, refreshCalNotesFromCloud, setCalNote } from '../lib/calendarNotes';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const GREG_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const WEEKDAYS = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

interface LunarInfo {
  day: number;              // 1–15
  moonPhaseName: string;    // កើត / រោច
  monthName: string;
  animalYearName: string;
  sakName: string;
  beYear: number;
  dayOfWeekName: string;
}

const lunarOf = (date: Date): LunarInfo | null => {
  try { return fromDate(date).khmer as LunarInfo; } catch { return null; }
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface Props {
  onClose?: () => void;
}

export default function KhmerCalendar({ onClose }: Props) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Per-day notes (កំណត់សំគាល់), shared across devices.
  const [notes, setNotes] = useState<CalNotes>(loadCalNotes);
  const [editKey, setEditKey] = useState<string | null>(null); // date being edited
  const [draft, setDraft] = useState('');
  useEffect(() => { refreshCalNotesFromCloud().then(setNotes).catch(() => {}); }, []);
  const openEditor = (date: Date) => { const k = dateKey(date); setEditKey(k); setDraft(notes[k] || ''); };
  const saveNote = async () => {
    if (!editKey) return;
    setNotes(await setCalNote(editKey, draft));
    setEditKey(null);
  };
  const deleteNote = async () => {
    if (!editKey) return;
    setNotes(await setCalNote(editKey, ''));
    setEditKey(null);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Build the 6-week grid: leading blanks for the first weekday, then each day.
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay(); // 0 = Sunday
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  // Lunar context for the header: the lunar month/animal-year at mid-month.
  const midLunar = useMemo(() => lunarOf(new Date(year, month, 15)), [year, month]);

  // Public holidays falling in this month, for the list below the grid. Consecutive
  // days of the same holiday (e.g. Khmer New Year) are merged into one range row.
  const monthHolidays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows: { from: number; to: number; name: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const name = holidayName(new Date(year, month, d));
      if (!name) continue;
      const last = rows[rows.length - 1];
      if (last && last.name === name && last.to === d - 1) last.to = d;
      else rows.push({ from: d, to: d, name });
    }
    return rows;
  }, [year, month]);

  const step = (delta: number) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays size={16} className="text-rose-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-700">ប្រតិទិនចន្ទគតិ</h2>
            {midLunar && (
              <p className="text-[11px] text-slate-400 font-semibold truncate">
                ខែ{midLunar.monthName} · ឆ្នាំ{midLunar.animalYearName} {midLunar.sakName} · ព.ស. {toKh(midLunar.beYear)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => step(-1)} title="ខែមុន" className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"><ChevronLeft size={16} /></button>
          <span className="px-2 text-sm font-bold text-slate-700 whitespace-nowrap">{GREG_MONTHS[month]} {toKh(year)}</span>
          <button onClick={() => step(1)} title="ខែបន្ទាប់" className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"><ChevronRight size={16} /></button>
          <button onClick={goToday} className="px-2.5 py-2 text-xs font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200">ថ្ងៃនេះ</button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5">
              <X size={13} /> បិទ
            </button>
          )}
        </div>
      </div>

      {/* grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`text-center text-[10px] sm:text-xs font-bold py-1.5 ${i === 0 ? 'text-rose-500' : 'text-slate-400'}`}>{w}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} className="aspect-square" />;
            const lunar = lunarOf(date);
            const isToday = sameDay(date, today);
            const isSunday = date.getDay() === 0;
            const holiday = holidayName(date);
            const k = dateKey(date);
            const note = notes[k];
            const selected = editKey === k;
            const fullMoon = lunar?.day === 15 && lunar?.moonPhaseName === 'កើត';
            const darkMoon = lunar?.day === 15 && lunar?.moonPhaseName === 'រោច';
            return (
              <button
                key={date.toISOString()}
                onClick={() => openEditor(date)}
                title={[holiday, note].filter(Boolean).join(' · ') || 'បន្ថែមកំណត់សំគាល់'}
                className={`aspect-square rounded-xl border p-1 sm:p-1.5 flex flex-col items-center justify-center gap-0.5 overflow-hidden transition-colors hover:border-blue-300 ${
                  selected ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                    : isToday ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                    : holiday ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className={`text-sm sm:text-base font-bold leading-none ${isToday ? 'text-emerald-700' : (holiday || isSunday) ? 'text-rose-500' : 'text-slate-700'}`}>
                  {toKh(date.getDate())}
                </span>
                {lunar && (
                  <span className={`text-[8px] sm:text-[10px] font-semibold leading-none text-center ${
                    fullMoon ? 'text-amber-600' : darkMoon ? 'text-slate-500' : 'text-emerald-600'
                  }`}>
                    {fullMoon ? '🌕 ' : darkMoon ? '🌑 ' : ''}{toKh(lunar.day)}{lunar.moonPhaseName}
                  </span>
                )}
                {note && (
                  <span className="mt-0.5 w-full text-[7px] sm:text-[9px] leading-tight font-bold text-blue-600 text-center line-clamp-2 px-0.5" title={note}>
                    📌 {note}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* note editor for the tapped day */}
      {editKey && (() => {
        const [y, m, d] = editKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const lunar = lunarOf(date);
        const holiday = holidayName(date);
        return (
          <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Pencil size={13} className="text-blue-500" />
                {toKh(d)} {GREG_MONTHS[m - 1]} {toKh(y)}
                {lunar && <span className="text-[11px] font-semibold text-emerald-600">({toKh(lunar.day)}{lunar.moonPhaseName} ខែ{lunar.monthName})</span>}
              </p>
              <button onClick={() => setEditKey(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={14} /></button>
            </div>
            {holiday && <p className="text-[11px] font-bold text-rose-500">🎉 {holiday}</p>}
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={2}
              autoFocus
              placeholder="កំណត់សំគាល់ (ឧ. ប្រឡងឆមាស, ប្រជុំគ្រូ, ព្រឹត្តិការណ៍…)"
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700"
            />
            <div className="flex items-center justify-end gap-2">
              {notes[editKey] && (
                <button onClick={deleteNote} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5">
                  <Trash2 size={12} /> លុប
                </button>
              )}
              <button onClick={saveNote} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white">រក្សាទុក</button>
            </div>
          </div>
        );
      })()}

      {/* notes this month */}
      {(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const rows: { day: number; note: string }[] = [];
        for (let d = 1; d <= daysInMonth; d++) { const n = notes[dateKey(new Date(year, month, d))]; if (n) rows.push({ day: d, note: n }); }
        if (rows.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-blue-700">📌 កំណត់សំគាល់ក្នុងខែនេះ</p>
            <div className="space-y-1">
              {rows.map(r => (
                <button key={r.day} onClick={() => openEditor(new Date(year, month, r.day))} className="w-full text-left flex items-start gap-2 text-xs hover:bg-slate-50 rounded-lg px-1 py-0.5">
                  <span className="font-bold text-blue-600 whitespace-nowrap w-16 shrink-0">{toKh(r.day)} {GREG_MONTHS[month]}</span>
                  <span className="text-slate-600 font-semibold">{r.note}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* holidays this month */}
      {monthHolidays.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-amber-700">🎉 ថ្ងៃឈប់សម្រាកក្នុងខែនេះ</p>
          <div className="space-y-1">
            {monthHolidays.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-bold text-rose-500 whitespace-nowrap w-16 shrink-0">
                  {h.from === h.to ? toKh(h.from) : `${toKh(h.from)}–${toKh(h.to)}`} {GREG_MONTHS[month]}
                </span>
                <span className="text-slate-600 font-semibold">{h.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1"><span className="text-emerald-600">៥កើត</span> ថ្ងៃខ្នើត</span>
        <span className="flex items-center gap-1">🌕 <span className="text-amber-600">១៥កើត</span> ថ្ងៃពេញបូណ៌មី</span>
        <span className="flex items-center gap-1">🌑 <span className="text-slate-500">១៥រោច</span> ថ្ងៃដាច់</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> ថ្ងៃឈប់សម្រាក</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> កំណត់សំគាល់</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" /> ថ្ងៃនេះ</span>
      </div>
    </div>
  );
}
