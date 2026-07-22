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

// A date of birth as "០១ កក្កដា ២០២៦" (Khmer day · month name · year). Accepts
// dd/mm/yyyy, dd-mm-yyyy or yyyy-mm-dd in Khmer or Arabic digits; text it can't
// parse is returned unchanged, so an odd roster entry still shows something.
export function formatDobKh(raw: string): string {
  if (!raw) return '';
  const s = raw.trim().replace(/[០-៩]/g, d => String('០១២៣៤៥៦៧៨៩'.indexOf(d))); // Khmer → Arabic
  let d = 0, mo = 0, y = 0;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/); // dd/mm/yyyy
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else { m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/); if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } } // yyyy-mm-dd
  if (!d || !mo || !y || mo < 1 || mo > 12) return raw; // unrecognised — leave as-is
  return `${toKh(String(d).padStart(2, '0'))} ${KH_MONTHS[mo - 1]} ${toKh(y)}`;
}
