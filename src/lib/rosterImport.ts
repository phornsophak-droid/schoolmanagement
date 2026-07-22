/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Import the school's official roster workbook ("បញ្ជីឈ្មោះសិស្ស ឆ្នាំសិក្សា …xlsx")
// and ENRICH the students already in the app with the details it carries that the
// app has no other source for — ទីកន្លែងកំណើត and the parents' occupations — plus
// any blank ថ្ងៃកំណើត / ឪពុក / ម្ដាយ / អាសយដ្ឋាន / អត្តលេខ.
//
// Deliberately non-destructive: it never creates or removes students and never
// overwrites a value that is already filled in, so a re-run is safe.
//
// Workbook shape (one sheet per class, verified against the real file):
//   r0 school · r1 year · r2 class · r3 teacher · r4 header · r5-6 sub-header
//   cols: 1 អត្តលេខ · 2 គោត្តនាម · 3 នាម · 6 ភេទ · 7 ថ្ងៃកំណើត
//         9-12 ទីកន្លែងកំណើត (ភូមិ/ឃុំ/ស្រុក/ខេត្ត)
//         13 ឪពុក · 14 មុខរបរ · 15 ម្ដាយ · 16 មុខរបរ · 17-20 អាសយដ្ឋាន

import { StudentScore } from '../types';

const C = {
  sid: 1, fam: 2, giv: 3, sex: 6, dob: 7,
  bpVillage: 9, bpCommune: 10, bpDistrict: 11, bpProvince: 12,
  dad: 13, dadJob: 14, mum: 15, mumJob: 16,
  adVillage: 17, adCommune: 18, adDistrict: 19, adProvince: 20,
};

export interface RosterRow {
  studentId: string;
  name: string;
  dob: string;
  birthPlace: string;
  fatherName: string;
  fatherJob: string;
  motherName: string;
  motherJob: string;
  address: string;
  sheet: string;
}

const cell = (r: any[], i: number) => (r?.[i] ?? '').toString().trim();
const join = (parts: string[]) => parts.filter(Boolean).join(' ');

// The sheet writes dates as dd-mm-yyyy; the app stores dd/mm/yyyy. Anything else
// (a stray "12-Dec-24", an already-correct value) is passed through untouched.
export function normalizeDob(raw: string): string {
  const s = (raw || '').trim();
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return s;
  return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
}

// Pull every student row out of the parsed workbook.
export function parseRosterRows(sheets: { name: string; rows: any[][] }[]): RosterRow[] {
  const out: RosterRow[] = [];
  for (const { name: sheet, rows } of sheets) {
    for (const r of rows) {
      const sid = cell(r, C.sid);
      // A real student row is the only kind with a numeric អត្តលេខ — this skips the
      // title/header/sub-header lines and any footer totals.
      if (!/^\d{2,}$/.test(sid)) continue;
      const name = join([cell(r, C.fam), cell(r, C.giv)]);
      if (!name) continue;
      out.push({
        sheet,
        studentId: sid,
        name,
        dob: normalizeDob(cell(r, C.dob)),
        birthPlace: join([cell(r, C.bpVillage), cell(r, C.bpCommune), cell(r, C.bpDistrict), cell(r, C.bpProvince)]),
        fatherName: cell(r, C.dad),
        fatherJob: cell(r, C.dadJob),
        motherName: cell(r, C.mum),
        motherJob: cell(r, C.mumJob),
        address: join([cell(r, C.adVillage), cell(r, C.adCommune), cell(r, C.adDistrict), cell(r, C.adProvince)]),
      });
    }
  }
  return out;
}

// Names are compared loosely: the workbook and the app disagree on spacing and
// zero-width marks, and Khmer rosters often carry a "ៈ"-family colon.
export const nameKey = (s: string) =>
  (s || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[៖ៈ:：]/g, '')
    .replace(/\s+/g, '')
    .trim();

export interface MergeResult {
  students: StudentScore[];
  matchedStudents: number;   // distinct people matched
  updatedRecords: number;    // score rows actually changed
  fieldsFilled: number;
  unmatched: string[];       // roster names with nobody to attach to
}

// Fold the roster into the app's students. A person has one score row per month,
// so every row for that person is updated — otherwise the handbook would show the
// details only for whichever month happened to be picked.
export function mergeRoster(students: StudentScore[], rows: RosterRow[]): MergeResult {
  // The real workbook has an អត្តលេខ used by two different students. Matching on a
  // duplicated ID would copy one child's parents onto the other, so those rows fall
  // back to name matching instead.
  const idCount = new Map<string, number>();
  for (const r of rows) idCount.set(r.studentId, (idCount.get(r.studentId) || 0) + 1);
  const ambiguousIds = new Set([...idCount].filter(([, n]) => n > 1).map(([id]) => id));

  const byId = new Map<string, StudentScore[]>();
  const byName = new Map<string, StudentScore[]>();
  for (const s of students) {
    if (s.studentId) {
      const k = s.studentId.trim();
      (byId.get(k) || byId.set(k, []).get(k)!).push(s);
    }
    const nk = nameKey(s.name);
    (byName.get(nk) || byName.set(nk, []).get(nk)!).push(s);
  }

  let matchedStudents = 0, fieldsFilled = 0;
  const touched = new Set<StudentScore>();
  const unmatched: string[] = [];

  for (const row of rows) {
    // Prefer the official ID; fall back to the name (and always use the name when
    // that ID is ambiguous in the workbook).
    const targets = (!ambiguousIds.has(row.studentId) && byId.get(row.studentId)) || byName.get(nameKey(row.name));
    if (!targets || targets.length === 0) { unmatched.push(`${row.name} (${row.sheet})`); continue; }
    matchedStudents++;
    for (const s of targets) {
      const set = (key: keyof StudentScore, val: string) => {
        if (!val) return;
        if ((s[key] as string | undefined)?.trim()) return; // never clobber existing data
        (s as any)[key] = val;
        fieldsFilled++;
        touched.add(s);
      };
      set('studentId', row.studentId);
      set('dob', row.dob);
      set('birthPlace', row.birthPlace);
      set('fatherName', row.fatherName);
      set('fatherJob', row.fatherJob);
      set('motherName', row.motherName);
      set('motherJob', row.motherJob);
      set('address', row.address);
    }
  }
  return { students, matchedStudents, updatedRecords: touched.size, fieldsFilled, unmatched };
}
