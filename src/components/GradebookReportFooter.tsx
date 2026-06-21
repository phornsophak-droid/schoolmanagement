/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature from './TeacherSignature';
import { khmerLunarFull } from '../utils/khmerDate';

interface Row { name: string; gender: 'ប្រុស' | 'ស្រី'; overallAvg: number | null; }

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
// និទ្ទេស bands — official scale A≥9 B≥8 C≥7 D≥6 E≥5 F<5.
const BANDS = [
  { km: 'ល្អប្រសើរ', en: 'A' }, { km: 'ល្អណាស់', en: 'B' }, { km: 'ល្អ', en: 'C' },
  { km: 'ល្អបង្គួរ', en: 'D' }, { km: 'មធ្យម', en: 'E' }, { km: 'ខ្សោយ', en: 'F' },
];
const bandIdx = (v: number | null): number => (v == null || v <= 0) ? -1 : v >= 9 ? 0 : v >= 8 ? 1 : v >= 7 ? 2 : v >= 6 ? 3 : v >= 5 ? 4 : 5;

// Stats (និទ្ទេស distribution) + auto-dated principal/teacher signatures, shown
// below the gradebook score table and included in its PDF.
export default function GradebookReportFooter({ roster, grade }: { roster: Row[]; grade: string }) {
  const total = roster.length;
  const stats = BANDS.map((b, i) => {
    const rows = roster.filter(r => bandIdx(r.overallAvg) === i);
    return { ...b, total: rows.length, female: rows.filter(r => r.gender === 'ស្រី').length, pct: total ? Math.round(rows.length / total * 100) : 0 };
  });
  const today = new Date();

  return (
    <div className="mt-4 px-4 text-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 text-[11px]">
        {stats.map(s => (
          <div key={s.en} className="flex items-center justify-between border-b border-dotted border-slate-200 py-0.5">
            <span>និទ្ទេស {s.km} ({s.en})</span>
            <span className="text-slate-600">សរុប <b>{toKh(s.total)}</b> នាក់ /ស្រី {toKh(s.female)} នាក់</span>
            <span className="font-bold w-12 text-right">{s.pct}%</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8 mt-6 mb-2 text-[11px] text-center">
        <div>
          <p className="font-bold">បានឃើញ និងឯកភាព</p>
          <p className="font-bold">នាយកសាលា</p>
          <PrincipalSignature />
        </div>
        <div>
          <p>{khmerLunarFull(today)}</p>
          <p>ច្បារច្រុះ ថ្ងៃទី{toKh(today.getDate())} ខែ{KH_MONTHS[today.getMonth()]} ឆ្នាំ{toKh(today.getFullYear())}</p>
          <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
          <TeacherSignature grade={grade} />
        </div>
      </div>
    </div>
  );
}
