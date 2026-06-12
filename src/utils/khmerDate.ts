/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Khmer lunar (ច័ន្ទគតិ) date helpers, computed automatically from a Gregorian
// date via the vendored Chhankitek algorithm (src/utils/momentkh.js).

import { fromDate } from './momentkh';

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// Full lunar date with weekday, e.g.
// "ថ្ងៃអង្គារ ១រោច ខែបឋមាសាឍ ឆ្នាំមមី អដ្ឋស័ក ពុទ្ធសករាជ ២៥៧០".
export function khmerLunarFull(date: Date): string {
  const k = fromDate(date).khmer;
  return `ថ្ងៃ${k.dayOfWeekName} ${toKh(k.day)}${k.moonPhaseName} ខែ${k.monthName} ឆ្នាំ${k.animalYearName} ${k.sakName} ពុទ្ធសករាជ ${toKh(k.beYear)}`;
}

const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// End-of-month date for a Khmer month name, dated per the school year
// (Sep–Dec 2025, Jan–Aug 2026). Returns Khmer-numeral day/year plus the full
// auto lunar date. Unknown month → blank day, today's lunar date.
export function khmerMonthEnd(monthName: string): { day: string; year: string; lunar: string } {
  const idx = KH_MONTHS.indexOf((monthName || '').trim());
  if (idx < 0) return { day: '.........', year: '២០២៦', lunar: khmerLunarFull(new Date()) };
  const yearNum = idx >= 8 ? 2025 : 2026; // កញ្ញា–ធ្នូ → 2025, else 2026
  const date = new Date(yearNum, idx, MONTH_LAST_DAY[idx]);
  return { day: toKh(MONTH_LAST_DAY[idx]), year: toKh(yearNum), lunar: khmerLunarFull(date) };
}
