/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ប្រតិទិនចន្ទគតិ — an in-app Khmer lunar calendar (the external site didn't work on
// phones). A month grid where every day shows its Gregorian date and its lunar day
// (day + moon phase, e.g. ៥កើត), computed from the vendored Chhankitek engine
// (utils/momentkh). Full-moon (១៥កើត) and dark-moon (១៥រោច) days are marked.

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { fromDate } from '../utils/momentkh';

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
            const fullMoon = lunar?.day === 15 && lunar?.moonPhaseName === 'កើត';
            const darkMoon = lunar?.day === 15 && lunar?.moonPhaseName === 'រោច';
            return (
              <div
                key={date.toISOString()}
                className={`aspect-square rounded-xl border p-1 sm:p-1.5 flex flex-col items-center justify-center gap-0.5 overflow-hidden ${
                  isToday ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className={`text-sm sm:text-base font-bold leading-none ${isToday ? 'text-rose-600' : isSunday ? 'text-rose-500' : 'text-slate-700'}`}>
                  {toKh(date.getDate())}
                </span>
                {lunar && (
                  <span className={`text-[8px] sm:text-[10px] font-semibold leading-none text-center ${
                    fullMoon ? 'text-amber-600' : darkMoon ? 'text-slate-500' : 'text-emerald-600'
                  }`}>
                    {fullMoon ? '🌕 ' : darkMoon ? '🌑 ' : ''}{toKh(lunar.day)}{lunar.moonPhaseName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1"><span className="text-emerald-600">៥កើត</span> ថ្ងៃខ្នើត</span>
        <span className="flex items-center gap-1">🌕 <span className="text-amber-600">១៥កើត</span> ថ្ងៃពេញបូណ៌មី</span>
        <span className="flex items-center gap-1">🌑 <span className="text-slate-500">១៥រោច</span> ថ្ងៃដាច់</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" /> ថ្ងៃនេះ</span>
      </div>
    </div>
  );
}
