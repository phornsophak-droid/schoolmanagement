/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Cambodian public holidays (ថ្ងៃឈប់សម្រាក) for the calendar. Two kinds:
//   • Fixed Gregorian dates (same MM-DD every year).
//   • Movable lunar festivals — matched by their moon signature (lunar day + phase +
//     month) via the Chhankitek engine, so they land correctly in any year without
//     hardcoding per-year dates.
// Note: the government announces the official list yearly and it can shift by a day;
// treat this as a guide, not a legal source.

import { fromDate } from './momentkh';

// MM-DD → holiday name. The stable annual public holidays.
const FIXED: Record<string, string> = {
  '01-01': 'ទិវាចូលឆ្នាំសាកល',
  '01-07': 'ទិវាជ័យជម្នះ ៧ មករា',
  '03-08': 'ទិវាអន្តរជាតិនារី',
  '04-14': 'ចូលឆ្នាំខ្មែរ',
  '04-15': 'ចូលឆ្នាំខ្មែរ',
  '04-16': 'ចូលឆ្នាំខ្មែរ',
  '05-01': 'ទិវាពលកម្មអន្តរជាតិ',
  '05-14': 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះមហាក្សត្រ',
  '05-20': 'ទិវាជាតិនៃការចងចាំ',
  '06-18': 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះមហាក្សត្រី',
  '09-24': 'ទិវាប្រកាសរដ្ឋធម្មនុញ្ញ',
  '10-15': 'ទិវាប្រារព្ធពិធីគោរពព្រះវិញ្ញាណក្ខន្ធ ព្រះបរមរតនកោដ្ឋ',
  '10-29': 'ព្រះរាជពិធីគ្រងព្រះបរមរាជសម្បត្តិ',
  '11-09': 'ទិវាឯករាជ្យជាតិ',
};

// Lunar festival = its moon signature. day (1–15) + phase (កើត/រោច) + lunar month.
interface LunarSig { day: number; phase: 'កើត' | 'រោច'; month: string; name: string; }
const LUNAR: LunarSig[] = [
  { day: 15, phase: 'កើត', month: 'មាឃ', name: 'បុណ្យមាឃបូជា' },
  { day: 4, phase: 'រោច', month: 'ពិសាខ', name: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល' },
  { day: 15, phase: 'កើត', month: 'ពិសាខ', name: 'បុណ្យវិសាខបូជា' },
  // ភ្ជុំបិណ្ឌ — 3 days spanning the dark moon of ភទ្របទ into អស្សុជ
  { day: 14, phase: 'រោច', month: 'ភទ្របទ', name: 'បុណ្យភ្ជុំបិណ្ឌ' },
  { day: 15, phase: 'រោច', month: 'ភទ្របទ', name: 'បុណ្យភ្ជុំបិណ្ឌ' },
  { day: 1, phase: 'កើត', month: 'អស្សុជ', name: 'បុណ្យភ្ជុំបិណ្ឌ' },
  // បុណ្យអុំទូក — 3 days around the full moon of កត្ដិក
  { day: 14, phase: 'កើត', month: 'កត្ដិក', name: 'បុណ្យអុំទូក បណ្តែតប្រទីប' },
  { day: 15, phase: 'កើត', month: 'កត្ដិក', name: 'បុណ្យអុំទូក បណ្តែតប្រទីប' },
  { day: 1, phase: 'រោច', month: 'កត្ដិក', name: 'បុណ្យអុំទូក បណ្តែតប្រទីប' },
];

// The holiday on a given date, or null. Fixed dates win; otherwise a lunar match.
export function holidayName(date: Date): string | null {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (FIXED[mmdd]) return FIXED[mmdd];
  try {
    const k = fromDate(date).khmer as { day: number; moonPhaseName: string; monthName: string };
    const hit = LUNAR.find(s => s.day === k.day && s.phase === k.moonPhaseName && s.month === k.monthName);
    return hit ? hit.name : null;
  } catch {
    return null;
  }
}

export const isHoliday = (date: Date): boolean => holidayName(date) !== null;
