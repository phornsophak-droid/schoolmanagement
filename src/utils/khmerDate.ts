/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Khmer lunar-year designation (ឆ្នាំសត្វ + ស័ក + ព.ស), computed automatically
// from a Gregorian date.
//   • The animal year and ស័ក roll over at Khmer New Year (~14 April).
//   • The Buddhist Era (ព.ស) rolls over at Visakha Bochea (~May).
// The lunar day / month (ថ្ងៃ…កើត / រោច, ខែ…) need a full lunar almanac, so they
// are left blank on the documents — only the auto year line is filled in.

const ANIMALS = ['ជូត', 'ឆ្លូវ', 'ខាល', 'ថោះ', 'រោង', 'ម្សាញ់', 'មមី', 'មមែ', 'វក', 'រកា', 'ច', 'កុរ'];
// Indexed by ចុល្លសករាជ % 10 (0 → សំរឹទ្ធិស័ក).
const SAKS = ['សំរឹទ្ធិស័ក', 'ឯកស័ក', 'ទោស័ក', 'ត្រីស័ក', 'ចត្វាស័ក', 'បញ្ចស័ក', 'ឆស័ក', 'សប្តស័ក', 'អដ្ឋស័ក', 'នព្វស័ក'];

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// e.g. khmerLunarYear(new Date(2026, 4, 31)) → "ឆ្នាំមមី អដ្ឋស័ក ព.ស ២៥៧០"
export function khmerLunarYear(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-based
  const d = date.getDate();

  // Before ~14 April the year still belongs to the previous animal / ស័ក cycle.
  const afterNewYear = m > 3 || (m === 3 && d >= 14);
  const cycleYear = afterNewYear ? y : y - 1;

  const animal = ANIMALS[((cycleYear - 2020) % 12 + 12) % 12];
  const cs = cycleYear - 638; // ចុល្លសករាជ
  const sak = SAKS[((cs % 10) + 10) % 10];
  const be = m >= 4 ? y + 544 : y + 543; // ព.ស rolls over at Visakha (~May)

  return `ឆ្នាំ${animal} ${sak} ព.ស ${toKh(be)}`;
}

const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const MONTH_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// End-of-month date for a Khmer month name, dated per the school year
// (Sep–Dec 2025, Jan–Aug 2026). Returns Khmer-numeral day/year plus the auto
// lunar-year line. Unknown month → blank day, today's lunar year.
export function khmerMonthEnd(monthName: string): { day: string; year: string; lunar: string } {
  const idx = KH_MONTHS.indexOf((monthName || '').trim());
  if (idx < 0) return { day: '.........', year: '២០២៦', lunar: khmerLunarYear(new Date()) };
  const yearNum = idx >= 8 ? 2025 : 2026; // កញ្ញា–ធ្នូ → 2025, else 2026
  const date = new Date(yearNum, idx, MONTH_LAST_DAY[idx]);
  return { day: toKh(MONTH_LAST_DAY[idx]), year: toKh(yearNum), lunar: khmerLunarYear(date) };
}
