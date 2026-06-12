/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Single source of truth for the school's official semester / annual averages,
// shared by the report cards and the reports panel so the two never disagree.
//   • មធ្យមភាគឆមាស  = (មធ្យមភាគប្រឡងឆមាស + មធ្យមភាគប្រចាំខែ) ÷ 2
//   • មធ្យមភាគប្រចាំឆ្នាំ = [(ឆមាស១ + ឆមាស២) ÷ 2] × 80% + បំណិន×10% + ចរិយា×10%
// The exam average is the unweighted mean of the 14 report-card subjects.

import { StudentScore } from '../types';

export const SEM1_MONTHS = ['ធ្នូ', 'មករា', 'កុម្ភៈ', 'មីនា'];
export const SEM2_MONTHS = ['ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា'];
const EXAM_MONTH: Record<1 | 2, string> = { 1: 'ប្រឡងឆមាសទី១', 2: 'ប្រឡងឆមាសទី២' };

// The 14 exam subjects, each derived from an exam record's fields (equal weight).
export const SEM_SUBJECTS: { km: string; get: (s: StudentScore) => number | null | undefined }[] = [
  { km: 'អំណាន', get: s => s.khmer?.reading },
  { km: 'ស្តាប់ និងនិយាយ', get: s => s.khmer?.listening },
  { km: 'សរសេរតាមអាន', get: s => s.khmer?.writing },
  { km: 'តែងសេចក្តី', get: s => s.khmer?.speaking },
  { km: 'គណិតវិទ្យា', get: s => s.mathAvg },
  { km: 'វិទ្យាសាស្ត្រ', get: s => s.science },
  { km: 'សីលធម៌-ពលរដ្ឋវិទ្យា', get: s => s.socialScores?.morality },
  { km: 'ភូមិវិទ្យា', get: s => s.socialScores?.geography },
  { km: 'ប្រវត្តិវិទ្យា', get: s => s.socialScores?.history },
  { km: 'គេហៈវិទ្យា-អប់រំសិល្បៈ', get: s => s.socialScores?.home },
  { km: 'អប់រំកាយ-កីឡា', get: s => s.physicalEducation },
  { km: 'សុខភាព-អនាម័យ', get: s => s.health },
  { km: 'បំណិនជីវិត', get: s => s.lifeSkills },
  { km: 'ភាសាបរទេស', get: s => s.foreignLanguage },
];

const mean = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// Exam average = unweighted mean of the 14 subject scores on the semester-exam record.
export function examAvgOf(records: StudentScore[], sem: 1 | 2): number | null {
  const exam = records.find(s => s.month === EXAM_MONTH[sem]);
  if (!exam) return null;
  const vals = SEM_SUBJECTS.map(sub => sub.get(exam)).filter((v): v is number => v !== null && v !== undefined && v > 0);
  return mean(vals);
}

// Mean of the monthly overall averages for the semester's months.
export function monthlyAvgOf(records: StudentScore[], sem: 1 | 2): number | null {
  const monthsList = sem === 1 ? SEM1_MONTHS : SEM2_MONTHS;
  const vals = monthsList
    .map(m => records.find(s => s.month === m)?.overallAvg)
    .filter((v): v is number => v !== null && v !== undefined);
  return mean(vals);
}

// មធ្យមភាគឆមាស = (exam avg + monthly avg) / 2 (whichever exists if only one).
export function semesterAvgOf(records: StudentScore[], sem: 1 | 2): number | null {
  const e = examAvgOf(records, sem);
  const m = monthlyAvgOf(records, sem);
  if (e !== null && m !== null) return (e + m) / 2;
  return e ?? m;
}

// Raw academic annual = (semester1 + semester2) / 2 (before the 80% weight).
export function annualAcademicRaw(records: StudentScore[]): number | null {
  const sems = [semesterAvgOf(records, 1), semesterAvgOf(records, 2)].filter((v): v is number => v !== null && v !== undefined);
  return mean(sems);
}

// Teacher-entered annual skills (បំណិន) & conduct (ចរិយា), persisted per student.
export const extraKey = (grade: string, name: string) => `annualextra::${grade}::${name}`;
export function readAnnualExtra(grade: string, name: string): { skills: number; conduct: number } {
  try {
    const e = JSON.parse(localStorage.getItem(extraKey(grade, name)) || '{}');
    return { skills: Number(e.skills) || 0, conduct: Number(e.conduct) || 0 };
  } catch {
    return { skills: 0, conduct: 0 };
  }
}

// មធ្យមភាគប្រចាំឆ្នាំ = academicRaw×80% + skills×10% + conduct×10%.
export function annualFinalOf(records: StudentScore[], grade: string, name: string): number | null {
  const raw = annualAcademicRaw(records);
  if (raw === null) return null;
  const { skills, conduct } = readAnnualExtra(grade, name.trim());
  return raw * 0.8 + 0.1 * skills + 0.1 * conduct;
}
