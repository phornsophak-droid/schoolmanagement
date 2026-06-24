/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentScore } from '../types';

// Whole-school academic summary for one month — computed locally from the
// scores already in memory (no network, no data leaves the app). The optional
// AI step (see lib/gemini) only polishes the wording from these same numbers.

const EXTRA_KEYWORDS = ['គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
export const isExtraClass = (grade: string) => EXTRA_KEYWORDS.some(k => (grade || '').includes(k));

// School-year month order, for picking the latest month with data.
export const MONTH_ORDER = ['កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];

export const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const band = (v: number): string => v >= 9 ? 'A' : v >= 8 ? 'B' : v >= 7 ? 'C' : v >= 6 ? 'D' : v >= 5 ? 'E' : 'F';
const mean = (a: number[]): number | null => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r2 = (v: number | null) => v === null ? null : Math.round(v * 100) / 100;

export interface ClassSummary {
  grade: string;
  count: number;
  avg: number | null;
  passRate: number;        // % with overallAvg >= 5
}
export interface SubjectAvg { km: string; avg: number }
export interface WeakStudent { name: string; grade: string; avg: number; letter: string }

export interface ClassAbsence { grade: string; permission: number; absent: number; total: number }
export interface StudentAbsence { name: string; grade: string; permission: number; absent: number; total: number }
export interface MonthAbsences {
  hasData: boolean;
  permission: number;   // excused (ច្បាប់) session-count
  absent: number;       // unexcused (អត់ច្បាប់) session-count
  late: number;
  total: number;        // permission + absent
  attendanceRate: number; // % present of all marks
  perClass: ClassAbsence[];
  topStudents: StudentAbsence[];
}

export interface SchoolSummary {
  month: string;
  totalStudents: number;
  schoolAvg: number | null;
  dist: Record<string, number>;       // A..F head-counts
  passRate: number;                   // % of students with overallAvg >= 5
  classes: ClassSummary[];
  weakClasses: ClassSummary[];
  topClasses: ClassSummary[];
  weakSubjects: SubjectAvg[];         // lowest school-wide subject averages
  weakStudents: WeakStudent[];        // niddes E/F, worst first
  absences: MonthAbsences;            // monthly absence analysis
}

// Calendar-index Khmer months → "YYYY-MM" key (school year Sep 2025 – Aug 2026),
// matching utils/attendance.ts so the date filter lines up with the records.
const KH_MONTHS_CAL = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const monthDateKey = (month: string): string => {
  const idx = KH_MONTHS_CAL.indexOf((month || '').trim());
  if (idx < 0) return '';
  const year = idx >= 8 ? 2025 : 2026;
  return `${year}-${String(idx + 1).padStart(2, '0')}`;
};

// Whole-school absence analysis for the month, from the saved daily-attendance
// records (localStorage). General classes only, to match the rest of the summary.
// Counts are in sessions (a full-day general-class absence = 2), as elsewhere.
export function computeMonthAbsences(students: StudentScore[], month: string): MonthAbsences {
  const empty: MonthAbsences = { hasData: false, permission: 0, absent: 0, late: 0, total: 0, attendanceRate: 0, perClass: [], topStudents: [] };
  const key = monthDateKey(month);
  if (!key) return empty;
  let records: { date?: string; grade?: string; studentStates?: Record<string, string> }[] = [];
  try { records = JSON.parse(localStorage.getItem('school_daily_attendance') || '[]'); } catch { return empty; }
  if (!Array.isArray(records) || records.length === 0) return empty;

  const idMap = new Map<string, { name: string; grade: string }>();
  students.forEach(s => idMap.set(s.id, { name: s.name, grade: s.grade }));

  let permission = 0, absent = 0, late = 0, present = 0, any = false;
  const perClass = new Map<string, ClassAbsence>();
  const perStudent = new Map<string, StudentAbsence>();

  for (const r of records) {
    if ((r.date || '').slice(0, 7) !== key) continue;
    const grade = r.grade || '';
    if (isExtraClass(grade)) continue;
    const states = r.studentStates || {};
    const ids = Object.keys(states);
    if (ids.length === 0) continue;
    any = true;
    const pc = perClass.get(grade) || { grade, permission: 0, absent: 0, total: 0 };
    for (const id of ids) {
      const st = states[id];
      if (st === 'present') { present++; continue; }
      if (st === 'late') { late++; continue; }
      if (st !== 'permission' && st !== 'absent') continue;
      if (st === 'permission') { permission++; pc.permission++; } else { absent++; pc.absent++; }
      pc.total++;
      const info = idMap.get(id);
      if (info?.name) {
        const pkey = `${info.name}::${info.grade}`;
        const ps = perStudent.get(pkey) || { name: info.name, grade: info.grade, permission: 0, absent: 0, total: 0 };
        if (st === 'permission') ps.permission++; else ps.absent++;
        ps.total++;
        perStudent.set(pkey, ps);
      }
    }
    perClass.set(grade, pc);
  }
  if (!any) return empty;
  const total = permission + absent;
  const marks = present + late + permission + absent;
  return {
    hasData: true,
    permission, absent, late, total,
    attendanceRate: marks ? Math.round((present / marks) * 100) : 0,
    perClass: Array.from(perClass.values()).filter(c => c.total > 0).sort((a, b) => b.total - a.total),
    topStudents: Array.from(perStudent.values()).sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

// Per-student main-subject averages (general class), for school-wide weak-subject ranking.
const subjectAverages = (s: StudentScore): { km: string; v: number | null }[] => {
  const km = mean([s.khmer?.listening, s.khmer?.speaking, s.khmer?.reading, s.khmer?.writing].filter((x): x is number => x != null && x > 0));
  const ma = mean([s.math?.numbers, s.math?.measurement, s.math?.geometry, s.math?.algebra, s.math?.statistics].filter((x): x is number => x != null && x > 0));
  return [
    { km: 'ភាសាខ្មែរ', v: km },
    { km: 'គណិតវិទ្យា', v: ma },
    { km: 'វិទ្យាសាស្ត្រ', v: s.science ?? null },
    { km: 'សិក្សាសង្គម', v: s.socialStudies ?? null },
    { km: 'អប់រំកាយ-កីឡា', v: s.physicalEducation ?? null },
    { km: 'សុខភាព', v: s.health ?? null },
    { km: 'បំណិនជីវិត', v: s.lifeSkills ?? null },
    { km: 'ភាសាបរទេស', v: s.foreignLanguage ?? null },
  ];
};

// Months (school-year order) that have at least one scored general-class record.
export function monthsWithData(students: StudentScore[]): string[] {
  const set = new Set<string>();
  students.forEach(s => {
    if (!isExtraClass(s.grade) && !s.month?.startsWith('ប្រឡង') && s.overallAvg != null) set.add(s.month);
  });
  return Array.from(set).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
}

export function computeSchoolSummary(students: StudentScore[], month: string): SchoolSummary {
  const rows = students.filter(s => !isExtraClass(s.grade) && s.month === month && s.overallAvg != null);
  const avgs = rows.map(s => s.overallAvg as number);

  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  avgs.forEach(v => { dist[band(v)]++; });
  const passRate = avgs.length ? Math.round((avgs.filter(v => v >= 5).length / avgs.length) * 100) : 0;

  // Per general class.
  const byGrade = new Map<string, number[]>();
  rows.forEach(s => {
    const arr = byGrade.get(s.grade) || [];
    arr.push(s.overallAvg as number);
    byGrade.set(s.grade, arr);
  });
  const classes: ClassSummary[] = Array.from(byGrade.entries()).map(([grade, vals]) => ({
    grade,
    count: vals.length,
    avg: r2(mean(vals)),
    passRate: Math.round((vals.filter(v => v >= 5).length / vals.length) * 100),
  })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  // School-wide subject averages → weakest first.
  const subjBuckets: Record<string, number[]> = {};
  rows.forEach(s => subjectAverages(s).forEach(({ km, v }) => {
    if (v != null && v > 0) (subjBuckets[km] = subjBuckets[km] || []).push(v);
  }));
  const weakSubjects: SubjectAvg[] = Object.entries(subjBuckets)
    .map(([km, vals]) => ({ km, avg: r2(mean(vals)) as number }))
    .filter(s => s.avg != null)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  // Students needing help (niddes E/F), worst first.
  const weakStudents: WeakStudent[] = rows
    .filter(s => (s.overallAvg as number) < 6)
    .map(s => ({ name: s.name, grade: s.grade, avg: r2(s.overallAvg as number) as number, letter: band(s.overallAvg as number) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 12);

  return {
    month,
    totalStudents: rows.length,
    schoolAvg: r2(mean(avgs)),
    dist,
    passRate,
    classes,
    weakClasses: [...classes].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0)).slice(0, 3),
    topClasses: classes.slice(0, 3),
    weakSubjects,
    weakStudents,
    absences: computeMonthAbsences(students, month),
  };
}

// Plain-Khmer report + next-month improvement points, computed from the numbers
// (no AI). This is what shows by default and the fallback when AI is unavailable.
export function summaryToKhmerText(s: SchoolSummary): string {
  if (s.totalStudents === 0) return `គ្មានទិន្នន័យពិន្ទុសម្រាប់ខែ${s.month} នៅឡើយទេ។`;
  const L: string[] = [];
  L.push(`📊 សេចក្ដីសង្ខេបលទ្ធផលសិក្សារួមសាលា ប្រចាំខែ${s.month}`);
  L.push('');
  L.push(`• សិស្សដែលមានពិន្ទុសរុប៖ ${toKh(s.totalStudents)} នាក់`);
  L.push(`• មធ្យមភាគរួមសាលា៖ ${s.schoolAvg != null ? toKh(s.schoolAvg.toFixed(2)) : '-'} (និទ្ទេស ${s.schoolAvg != null ? band(s.schoolAvg) : '-'})`);
  L.push(`• អត្រាជាប់ (≥៥)៖ ${toKh(s.passRate)}%`);
  L.push(`• ការបែងចែកនិទ្ទេស៖ A:${toKh(s.dist.A)} B:${toKh(s.dist.B)} C:${toKh(s.dist.C)} D:${toKh(s.dist.D)} E:${toKh(s.dist.E)} F:${toKh(s.dist.F)}`);
  L.push('');
  if (s.topClasses.length) {
    L.push('🏆 ថ្នាក់ឆ្នើម៖');
    s.topClasses.forEach(c => L.push(`   - ${c.grade}៖ មធ្យមភាគ ${toKh((c.avg ?? 0).toFixed(2))} (${toKh(c.count)} នាក់)`));
  }
  if (s.weakClasses.length) {
    L.push('⚠️ ថ្នាក់គួរយកចិត្តទុកដាក់៖');
    s.weakClasses.forEach(c => L.push(`   - ${c.grade}៖ មធ្យមភាគ ${toKh((c.avg ?? 0).toFixed(2))} | ជាប់ ${toKh(c.passRate)}%`));
  }
  if (s.weakSubjects.length) {
    L.push('');
    L.push('📉 មុខវិជ្ជាដែលនៅខ្សោយ (មធ្យមភាគទាបជាងគេ)៖');
    s.weakSubjects.forEach(sub => L.push(`   - ${sub.km}៖ ${toKh(sub.avg.toFixed(2))}`));
  }
  if (s.weakStudents.length) {
    L.push('');
    L.push(`🧑‍🎓 សិស្សគួរជួយបន្ថែម (មធ្យមភាគក្រោម ៦.០ — ${toKh(s.weakStudents.length)} នាក់)៖`);
    s.weakStudents.slice(0, 8).forEach(w => L.push(`   - ${w.name} (${w.grade})៖ ${toKh(w.avg.toFixed(2))} [${w.letter}]`));
  }
  const a = s.absences;
  if (a.hasData) {
    L.push('');
    L.push(`📅 ការវិភាគអវត្តមាន ប្រចាំខែ${s.month}៖`);
    L.push(`   • អវត្តមានសរុប៖ ${toKh(a.total)} លើក (ច្បាប់ ${toKh(a.permission)} | អត់ច្បាប់ ${toKh(a.absent)})`);
    L.push(`   • អត្រាវត្តមាន៖ ${toKh(a.attendanceRate)}%${a.late ? ` | យឺត ${toKh(a.late)} លើក` : ''}`);
    if (a.perClass.length) {
      L.push('   • ថ្នាក់អវត្តមានច្រើនជាងគេ៖');
      a.perClass.slice(0, 3).forEach(c => L.push(`     - ${c.grade}៖ ${toKh(c.total)} លើក (អត់ច្បាប់ ${toKh(c.absent)})`));
    }
    if (a.topStudents.length) {
      L.push('   • សិស្សអវត្តមានច្រើន៖');
      a.topStudents.slice(0, 5).forEach(w => L.push(`     - ${w.name} (${w.grade})៖ ${toKh(w.total)} លើក (អត់ច្បាប់ ${toKh(w.absent)})`));
    }
  }

  // Improvement points — built as a list so the numbering stays correct.
  const tips: string[] = [];
  if (s.weakSubjects[0]) tips.push(`ផ្ដោតលើការបង្រៀន «${s.weakSubjects[0].km}» ដែលនៅខ្សោយជាងគេ បន្ថែមលំហាត់ និងការតាមដាន។`);
  if (s.weakClasses[0]) tips.push(`ជួយ​ថ្នាក់ «${s.weakClasses[0].grade}» ដែលមានមធ្យមភាគទាប — រៀបចំ​មេរៀន​បំប៉ន។`);
  if (s.weakStudents.length) tips.push(`រៀបចំ​ការ​ជួយ​បន្ថែម​ដល់​សិស្ស​និទ្ទេស​ខ្សោយ ${toKh(s.weakStudents.length)} នាក់ និងជូនដំណឹងអាណាព្យាបាល។`);
  if (a.hasData && a.absent > 0) tips.push(`តាមដាន​អវត្តមាន​អត់​ច្បាប់ (${toKh(a.absent)} លើក)${a.topStudents[0] ? ` ពិសេស​សិស្ស «${a.topStudents[0].name}»` : ''} និង​ទាក់ទង​អាណាព្យាបាល​ឱ្យ​ទាន់​ពេល។`);
  tips.push('លើកទឹកចិត្ត​ថ្នាក់​ឆ្នើម និងចែករំលែក​បទពិសោធន៍​បង្រៀន​ល្អ​ៗ ដល់​គ្រូ​ដទៃ។');
  L.push('');
  L.push('🎯 ចំណុចគួរកែលម្អសម្រាប់ខែបន្ទាប់៖');
  tips.forEach((t, i) => L.push(`   ${toKh(i + 1)}. ${t}`));
  return L.join('\n');
}

// Compact JSON-ish digest handed to the AI so it polishes wording from real data.
export function summaryForPrompt(s: SchoolSummary): string {
  return JSON.stringify({
    month: s.month,
    totalStudents: s.totalStudents,
    schoolAverage: s.schoolAvg,
    passRatePercent: s.passRate,
    gradeDistribution: s.dist,
    topClasses: s.topClasses.map(c => ({ class: c.grade, avg: c.avg, students: c.count })),
    weakClasses: s.weakClasses.map(c => ({ class: c.grade, avg: c.avg, passRate: c.passRate })),
    weakestSubjects: s.weakSubjects,
    studentsNeedingHelp: s.weakStudents.map(w => ({ name: w.name, class: w.grade, avg: w.avg, niddes: w.letter })),
    absences: s.absences.hasData ? {
      totalSessions: s.absences.total,
      excused: s.absences.permission,
      unexcused: s.absences.absent,
      attendanceRatePercent: s.absences.attendanceRate,
      byClass: s.absences.perClass.map(c => ({ class: c.grade, total: c.total, unexcused: c.absent })),
      mostAbsentStudents: s.absences.topStudents.map(w => ({ name: w.name, class: w.grade, total: w.total, unexcused: w.absent })),
    } : 'no attendance data',
  }, null, 2);
}
