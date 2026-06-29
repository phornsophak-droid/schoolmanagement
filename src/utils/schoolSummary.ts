/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentScore } from '../types';
import { loadAttendance } from './attendanceStore';
import { SEM1_MONTHS, SEM2_MONTHS, semesterAvgOf, annualFinalOf } from './scoring';
import { distinctStudentKey } from './studentKey';

// The summary can cover one month, a semester, or the whole year.
export type SummaryPeriod =
  | { kind: 'month'; month: string }
  | { kind: 'semester'; sem: 1 | 2 }
  | { kind: 'year' };

// The calendar months a period spans (used for attendance + subject aggregation).
export function periodMonths(p: SummaryPeriod): string[] {
  if (p.kind === 'month') return [p.month];
  if (p.kind === 'semester') return p.sem === 1 ? SEM1_MONTHS : SEM2_MONTHS;
  return [...SEM1_MONTHS, ...SEM2_MONTHS];
}
export function periodLabel(p: SummaryPeriod): string {
  if (p.kind === 'month') return `ប្រចាំខែ${p.month}`;
  if (p.kind === 'semester') return `ប្រចាំឆមាសទី ${toKh(p.sem)}`;
  return 'ប្រចាំឆ្នាំ';
}

// Whole-school academic summary for one month — computed locally from the
// scores already in memory (no network, no data leaves the app). The optional
// AI step (see lib/gemini) only polishes the wording from these same numbers.

const EXTRA_KEYWORDS = ['GRADE','គ្លេស', 'អង់គ្លេស', 'គំនូរ', 'កុំព្យូទ័រ', 'កីឡា', 'អប់រំកាយ', 'អប់រំសុខភាព'];
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
export interface ReasonCount { reason: string; count: number }
export interface MonthAbsences {
  hasData: boolean;
  permission: number;   // excused (ច្បាប់) session-count
  absent: number;       // unexcused (អត់ច្បាប់) session-count
  late: number;
  total: number;        // permission + absent
  attendanceRate: number; // % present of all marks
  perClass: ClassAbsence[];
  topStudents: StudentAbsence[];
  reasons: ReasonCount[];   // why students were away (from the per-student reason field)
}

export interface SchoolSummary {
  periodLabel: string;
  scope: string;                      // '' = whole school; otherwise the class name
  totalStudents: number;
  schoolAvg: number | null;
  dist: Record<string, number>;       // A..F head-counts
  passRate: number;                   // % of students with overallAvg >= 5
  classes: ClassSummary[];
  weakClasses: ClassSummary[];
  topClasses: ClassSummary[];
  subjects: SubjectAvg[];             // ALL school-wide subject averages, weakest first
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
export function computePeriodAbsences(students: StudentScore[], months: string[], scopeGrade?: string): MonthAbsences {
  const empty: MonthAbsences = { hasData: false, permission: 0, absent: 0, late: 0, total: 0, attendanceRate: 0, perClass: [], topStudents: [], reasons: [] };
  const keys = new Set(months.map(monthDateKey).filter(Boolean));
  if (keys.size === 0) return empty;
  const records = loadAttendance() as { date?: string; grade?: string; studentStates?: Record<string, string> }[];
  if (records.length === 0) return empty;

  const idMap = new Map<string, { name: string; grade: string }>();
  students.forEach(s => idMap.set(s.id, { name: s.name, grade: s.grade }));

  let permission = 0, absent = 0, late = 0, present = 0, any = false;
  const perClass = new Map<string, ClassAbsence>();
  const perStudent = new Map<string, StudentAbsence>();
  const reasonCounts = new Map<string, number>();
  // The per-student reason is stored alongside the state as "<id>_reason".
  const tallyReason = (states: Record<string, string>, id: string) => {
    const reason = (states[`${id}_reason`] || '').trim();
    if (reason && reason !== 'ផ្សេងៗ') reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  };

  for (const r of records) {
    if (!keys.has((r.date || '').slice(0, 7))) continue;
    const grade = r.grade || '';
    if (scopeGrade ? grade !== scopeGrade : isExtraClass(grade)) continue;
    const states = r.studentStates || {};
    const ids = Object.keys(states);
    if (ids.length === 0) continue;
    any = true;
    const pc = perClass.get(grade) || { grade, permission: 0, absent: 0, total: 0 };
    for (const id of ids) {
      if (id.endsWith('_reason')) continue; // skip the paired reason entries
      const st = states[id];
      if (st === 'present') { present++; continue; }
      if (st === 'late') { late++; tallyReason(states, id); continue; }
      if (st !== 'permission' && st !== 'absent') continue;
      if (st === 'permission') { permission++; pc.permission++; } else { absent++; pc.absent++; }
      tallyReason(states, id);
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
    reasons: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
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

interface StudentGroup { name: string; grade: string; gender: 'ប្រុស' | 'ស្រី'; records: StudentScore[]; }

// One entry per distinct student (whitespace-insensitive identity), gathering all
// of their score rows so semester/annual figures can be computed. By default only
// general classes are included; when scopeGrade is set (a teacher viewing their own
// class) it includes ONLY that grade — even if it's an after-hours class.
function groupGeneralStudents(students: StudentScore[], scopeGrade?: string): StudentGroup[] {
  const map = new Map<string, StudentGroup>();
  students.forEach(s => {
    if (scopeGrade ? s.grade !== scopeGrade : isExtraClass(s.grade)) return;
    const key = distinctStudentKey(s.name, s.grade);
    let g = map.get(key);
    if (!g) { g = { name: s.name.trim(), grade: s.grade, gender: s.gender, records: [] }; map.set(key, g); }
    g.records.push(s);
  });
  return Array.from(map.values());
}

// A student's single figure for the chosen period: monthly overallAvg, the
// semester average (exam + monthly)/2, or the annual final (80% + skills + conduct).
function periodScore(g: StudentGroup, p: SummaryPeriod): number | null {
  if (p.kind === 'month') return g.records.find(r => r.month === p.month)?.overallAvg ?? null;
  if (p.kind === 'semester') return semesterAvgOf(g.records, p.sem);
  return annualFinalOf(g.records, g.grade, g.name);
}

export function computeSchoolSummary(students: StudentScore[], period: SummaryPeriod, scopeGrade?: string): SchoolSummary {
  const months = periodMonths(period);
  const scored = groupGeneralStudents(students, scopeGrade)
    .map(g => ({ g, score: periodScore(g, period) }))
    .filter((x): x is { g: StudentGroup; score: number } => x.score != null && x.score > 0);

  const avgs = scored.map(x => x.score);
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  avgs.forEach(v => { dist[band(v)]++; });
  const passRate = avgs.length ? Math.round((avgs.filter(v => v >= 5).length / avgs.length) * 100) : 0;

  // Per general class.
  const byGrade = new Map<string, number[]>();
  scored.forEach(({ g, score }) => { const a = byGrade.get(g.grade) || []; a.push(score); byGrade.set(g.grade, a); });
  const classes: ClassSummary[] = Array.from(byGrade.entries()).map(([grade, vals]) => ({
    grade,
    count: vals.length,
    avg: r2(mean(vals)),
    passRate: Math.round((vals.filter(v => v >= 5).length / vals.length) * 100),
  })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));

  // School-wide subject averages (over the period's months) → weakest first.
  const subjBuckets: Record<string, number[]> = {};
  scored.forEach(({ g }) => g.records.filter(r => months.includes(r.month)).forEach(r =>
    subjectAverages(r).forEach(({ km, v }) => { if (v != null && v > 0) (subjBuckets[km] = subjBuckets[km] || []).push(v); })
  ));
  const subjects: SubjectAvg[] = Object.entries(subjBuckets)
    .map(([km, vals]) => ({ km, avg: r2(mean(vals)) as number }))
    .filter(s => s.avg != null)
    .sort((a, b) => a.avg - b.avg);
  const weakSubjects = subjects.slice(0, 3);

  // Students needing help (below niddes D), worst first.
  const weakStudents: WeakStudent[] = scored
    .filter(x => x.score < 6)
    .map(({ g, score }) => ({ name: g.name, grade: g.grade, avg: r2(score) as number, letter: band(score) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 12);

  return {
    periodLabel: periodLabel(period),
    scope: scopeGrade || '',
    totalStudents: scored.length,
    schoolAvg: r2(mean(avgs)),
    dist,
    passRate,
    classes,
    weakClasses: [...classes].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0)).slice(0, 3),
    topClasses: classes.slice(0, 3),
    subjects,
    weakSubjects,
    weakStudents,
    absences: computePeriodAbsences(students, months, scopeGrade),
  };
}

// A structured Khmer analysis report computed from the numbers (no AI). Sections:
// results · subjects · absences · students needing support · challenges · next
// actions for teachers & the school. Shown by default and as the AI fallback.
export function summaryToKhmerText(s: SchoolSummary): string {
  if (s.totalStudents === 0) return `គ្មានទិន្នន័យពិន្ទុសម្រាប់${s.periodLabel} នៅឡើយទេ។`;
  const a = s.absences;
  const fx = (v: number) => toKh(v.toFixed(2));
  const where = s.scope ? `ថ្នាក់ ${s.scope}` : 'រួមសាលា';
  const L: string[] = [];
  L.push(`📊 របាយការណ៍សង្ខេបលទ្ធផលសិក្សា${where} ${s.periodLabel}`);

  // 1. Academic results
  L.push('');
  L.push('① លទ្ធផលសិក្សារួម៖');
  L.push(`   • សិស្សសរុប៖ ${toKh(s.totalStudents)} នាក់ | មធ្យមភាគ៖ ${s.schoolAvg != null ? fx(s.schoolAvg) : '-'} (និទ្ទេស ${s.schoolAvg != null ? band(s.schoolAvg) : '-'}) | អត្រាជាប់៖ ${toKh(s.passRate)}%`);
  L.push(`   • ការបែងចែកនិទ្ទេស៖ A:${toKh(s.dist.A)} B:${toKh(s.dist.B)} C:${toKh(s.dist.C)} D:${toKh(s.dist.D)} E:${toKh(s.dist.E)} F:${toKh(s.dist.F)}`);
  if (s.topClasses.length) L.push(`   • ថ្នាក់ឆ្នើម៖ ${s.topClasses.map(c => `${c.grade} (${fx(c.avg ?? 0)})`).join(', ')}`);
  if (s.weakClasses.length) L.push(`   • ថ្នាក់គួរយកចិត្តទុកដាក់៖ ${s.weakClasses.map(c => `${c.grade} (${fx(c.avg ?? 0)}, ជាប់ ${toKh(c.passRate)}%)`).join(', ')}`);

  // 2. Subjects
  if (s.subjects.length) {
    const strong = [...s.subjects].slice(-3).reverse();
    L.push('');
    L.push('② ការវិភាគតាមមុខវិជ្ជា៖');
    L.push(`   • មុខវិជ្ជាខ្លាំង៖ ${strong.map(x => `${x.km} ${fx(x.avg)}`).join(', ')}`);
    L.push(`   • មុខវិជ្ជាខ្សោយ៖ ${s.weakSubjects.map(x => `${x.km} ${fx(x.avg)}`).join(', ')}`);
  }

  // 3. Absences
  if (a.hasData) {
    L.push('');
    L.push('③ ការវិភាគអវត្តមាន៖');
    L.push(`   • អវត្តមានសរុប៖ ${toKh(a.total)} លើក (ច្បាប់ ${toKh(a.permission)} | អត់ច្បាប់ ${toKh(a.absent)}) | អត្រាវត្តមាន៖ ${toKh(a.attendanceRate)}%`);
    if (a.perClass.length) L.push(`   • ថ្នាក់អវត្តមានច្រើន៖ ${a.perClass.slice(0, 3).map(c => `${c.grade} (${toKh(c.total)})`).join(', ')}`);
    if (a.reasons.length) L.push(`   • មូលហេតុចម្បង៖ ${a.reasons.slice(0, 4).map(r => `${r.reason} (${toKh(r.count)})`).join(', ')}`);
  }

  // 4. Students needing support (teacher + parent)
  const absentByName = new Map(a.topStudents.map(w => [`${w.name}::${w.grade}`, w]));
  const needContact = a.topStudents.filter(w => w.absent >= 2);
  if (s.weakStudents.length || needContact.length) {
    L.push('');
    L.push('④ សិស្សត្រូវការការគាំទ្រ (គ្រូ + មាតាបិតា)៖');
    if (s.weakStudents.length) {
      L.push(`   • ខ្សោយផ្នែកសិក្សា (${toKh(s.weakStudents.length)} នាក់)៖`);
      s.weakStudents.slice(0, 8).forEach(w => {
        const ab = absentByName.get(`${w.name}::${w.grade}`);
        L.push(`     - ${w.name} (${w.grade})៖ ${fx(w.avg)} [${w.letter}]${ab ? ` + អវត្តមាន ${toKh(ab.total)} លើក` : ''}`);
      });
    }
    if (needContact.length) {
      L.push(`   • គួរទាក់ទងមាតាបិតា (អវត្តមានញឹកញាប់)៖ ${needContact.slice(0, 6).map(w => `${w.name} (${w.grade}, អត់ច្បាប់ ${toKh(w.absent)})`).join(', ')}`);
    }
  }

  // 5. Challenges (synthesised)
  const challenges: string[] = [];
  if (s.passRate < 85) challenges.push(`អត្រាជាប់នៅ ${toKh(s.passRate)}% — សិស្ស ${toKh(s.weakStudents.length)} នាក់ មាននិទ្ទេសក្រោម D។`);
  const lowSubjects = s.subjects.filter(x => x.avg < 6.5);
  if (lowSubjects.length) challenges.push(`មុខវិជ្ជាដែលលទ្ធផលនៅទាប៖ ${lowSubjects.map(x => x.km).join(', ')}។`);
  const strugglingClasses = s.weakClasses.filter(c => (c.avg ?? 10) < 6);
  if (strugglingClasses.length) challenges.push(`ថ្នាក់ដែលមធ្យមភាគទាប៖ ${strugglingClasses.map(c => c.grade).join(', ')}។`);
  if (a.hasData && a.attendanceRate < 90) challenges.push(`អត្រាវត្តមានទាប (${toKh(a.attendanceRate)}%) — អវត្តមានអត់ច្បាប់ ${toKh(a.absent)} លើក។`);
  if (a.hasData && a.reasons[0]) challenges.push(`មូលហេតុអវត្តមានចម្បង៖ ${a.reasons[0].reason}។`);
  if (challenges.length) {
    L.push('');
    L.push('⑤ បញ្ហាប្រឈម៖');
    challenges.forEach((c, i) => L.push(`   ${toKh(i + 1)}. ${c}`));
  }

  // 6. Next actions — teachers & school
  const teacherActions: string[] = [];
  if (s.weakSubjects[0]) teacherActions.push(`ពង្រឹងការបង្រៀន «${s.weakSubjects[0].km}» បន្ថែមលំហាត់ និងតេស្តតាមដានវឌ្ឍនភាព។`);
  if (s.weakStudents.length) teacherActions.push(`រៀបចំការបង្រៀនបំប៉ន (remedial) ដល់សិស្សខ្សោយ ${toKh(s.weakStudents.length)} នាក់។`);
  if (needContact.length) teacherActions.push(`ទាក់ទងមាតាបិតាសិស្សអវត្តមានញឹកញាប់ និងកត់ត្រាការតាមដាន។`);
  teacherActions.push('ចែករំលែកវិធីសាស្ត្របង្រៀនល្អៗ ក្នុងក្រុមមុខវិជ្ជា។');

  const schoolActions: string[] = [];
  if (strugglingClasses.length) schoolActions.push(`រៀបចំកម្មវិធីបំប៉នសម្រាប់ថ្នាក់ខ្សោយ (${strugglingClasses.map(c => c.grade).join(', ')})។`);
  if (lowSubjects.length) schoolActions.push(`ផ្ដល់ធនធាន/សិក្ខាសាលាខ្លី សម្រាប់មុខវិជ្ជាដែលលទ្ធផលនៅទាប។`);
  if (a.hasData && a.absent > 0) schoolActions.push(`ពង្រឹងការតាមដានវត្តមាន និងកិច្ចសហការជាមួយមាតាបិតា (កិច្ចប្រជុំ/សារ)។`);
  schoolActions.push('លើកទឹកចិត្ត និងផ្ដល់រង្វាន់ដល់ថ្នាក់ និងសិស្សឆ្នើម។');

  L.push('');
  L.push('⑥ ចំណុចគ្រូ និងសាលាត្រូវធ្វើបន្ទាប់៖');
  L.push('   ▸ សម្រាប់គ្រូបង្រៀន៖');
  teacherActions.forEach((t, i) => L.push(`     ${toKh(i + 1)}. ${t}`));
  L.push('   ▸ សម្រាប់សាលា / គណៈគ្រប់គ្រង៖');
  schoolActions.forEach((t, i) => L.push(`     ${toKh(i + 1)}. ${t}`));
  return L.join('\n');
}

// Compact JSON-ish digest handed to the AI so it polishes wording from real data.
// PRIVACY: this leaves the app to a third-party AI (Google Gemini), so it carries
// NO individual student names — only counts and class/subject-level aggregates.
// The in-app report (summaryToKhmerText) still shows names locally.
export function summaryForPrompt(s: SchoolSummary): string {
  const weakByClass: Record<string, number> = {};
  s.weakStudents.forEach(w => { weakByClass[w.grade] = (weakByClass[w.grade] || 0) + 1; });
  return JSON.stringify({
    period: s.periodLabel,
    scope: s.scope ? `ថ្នាក់ ${s.scope}` : 'រួមសាលា',
    totalStudents: s.totalStudents,
    schoolAverage: s.schoolAvg,
    passRatePercent: s.passRate,
    gradeDistribution: s.dist,
    topClasses: s.topClasses.map(c => ({ class: c.grade, avg: c.avg, students: c.count })),
    weakClasses: s.weakClasses.map(c => ({ class: c.grade, avg: c.avg, passRate: c.passRate })),
    subjectAverages: s.subjects,
    weakestSubjects: s.weakSubjects,
    studentsNeedingHelp: { count: s.weakStudents.length, byClass: weakByClass },
    absences: s.absences.hasData ? {
      totalSessions: s.absences.total,
      excused: s.absences.permission,
      unexcused: s.absences.absent,
      attendanceRatePercent: s.absences.attendanceRate,
      byClass: s.absences.perClass.map(c => ({ class: c.grade, total: c.total, unexcused: c.absent })),
      frequentlyAbsentCount: s.absences.topStudents.length,
      reasons: s.absences.reasons.map(r => ({ reason: r.reason, count: r.count })),
    } : 'no attendance data',
  }, null, 2);
}
