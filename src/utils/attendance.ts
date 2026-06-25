/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Tally a student's absences from the saved daily-attendance records
// (localStorage 'school_daily_attendance', written by DailyAttendance.tsx).
//   • permission ('ច្បាប់')  = excused absence
//   • absent     ('អត់ច្បាប់') = unexcused absence
//   • total = permission + absent  (late is NOT counted, matching the attendance UI)
// Each saved record is one session (morning/afternoon), so a full-day absence in a
// general class counts as 2 — the same convention the attendance module displays.

import { loadAttendance } from './attendanceStore';

const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

interface AttRecord { date?: string; grade?: string; studentStates?: Record<string, string>; }

export interface AbsenceTally { permission: number; absent: number; total: number; }

export function tallyAbsences(
  studentName: string,
  grade: string,
  monthNames: string[],
  allStudents: { id: string; name: string; grade: string }[],
): AbsenceTally {
  const empty: AbsenceTally = { permission: 0, absent: 0, total: 0 };

  const records = loadAttendance() as AttRecord[];
  if (records.length === 0) return empty;

  // The same person has one score row per month (each with its own id), but
  // attendance is keyed by whichever id was first seen. Match the whole set.
  const name = (studentName || '').trim();
  const personIds = new Set(
    allStudents.filter(s => s.name.trim() === name && s.grade === grade).map(s => s.id)
  );
  if (personIds.size === 0) return empty;

  // "YYYY-MM" keys for the requested Khmer months (school year Sep 2025 – Aug 2026).
  const periodKeys = new Set(
    monthNames.map(m => {
      const idx = KH_MONTHS.indexOf((m || '').trim());
      if (idx < 0) return '';
      const year = idx >= 8 ? 2025 : 2026; // កញ្ញា–ធ្នូ → 2025, else 2026
      return `${year}-${String(idx + 1).padStart(2, '0')}`;
    }).filter(Boolean)
  );
  if (periodKeys.size === 0) return empty;

  let permission = 0;
  let absent = 0;
  for (const r of records) {
    if (r.grade !== grade) continue;
    if (!periodKeys.has((r.date || '').slice(0, 7))) continue;
    const states = r.studentStates || {};
    for (const id of personIds) {
      if (states[id] === 'permission') permission++;
      else if (states[id] === 'absent') absent++;
    }
  }
  return { permission, absent, total: permission + absent };
}
