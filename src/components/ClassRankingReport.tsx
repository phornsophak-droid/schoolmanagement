/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import { khmerLunarFull, khmerMonthEnd } from '../utils/khmerDate';

export interface RankingRow {
  name: string;
  gender: 'ប្រុស' | 'ស្រី';
  overallAvg: number | null;
}

interface ClassRankingReportProps {
  roster: RankingRow[];   // students for the selected class & period
  grade: string;          // e.g. "ថ្នាក់ទី ៦" / "ទាំងអស់"
  period: string;         // month name, "ប្រឡងឆមាសទី១/២", or "ប្រចាំឆ្នាំ"
  onClose: () => void;
}

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

const KHMER_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

// និទ្ទេស band — same thresholds as the report cards.
const niddesOf = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v <= 0) return '';
  if (v >= 9) return 'ល្អប្រសើរ';
  if (v >= 8) return 'ល្អណាស់';
  if (v >= 7) return 'ល្អ';
  if (v >= 6) return 'ល្អបង្គួរ';
  if (v >= 5) return 'មធ្យម';
  return 'ខ្សោយ';
};
const NIDDES_BANDS = ['ល្អប្រសើរ', 'ល្អណាស់', 'ល្អ', 'ល្អបង្គួរ', 'មធ្យម', 'ខ្សោយ'];

const genderShort = (g: string) => (g === 'ស្រី' ? 'ស' : 'ប');

export default function ClassRankingReport({ roster, grade, period, onClose }: ClassRankingReportProps) {
  // Rank with ties among scored students (competition ranking); unscored get no rank.
  const scored = roster.filter(r => r.overallAvg !== null && r.overallAvg !== undefined && r.overallAvg > 0);
  const sorted = [...roster].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
  const rankOf = (v: number | null | undefined): string => {
    if (v === null || v === undefined || v <= 0) return '';
    return toKh(1 + scored.filter(r => (r.overallAvg as number) > v).length);
  };

  // Two columns: fill the left first (classes ≤ 30 stay in one column, matching the
  // printed form), larger classes split across both.
  const perCol = Math.max(Math.ceil(sorted.length / 2), Math.min(sorted.length, 30)) || 1;
  const leftRows = Array.from({ length: perCol }, (_, i) => sorted[i] || null);
  const rightRows = Array.from({ length: perCol }, (_, i) => sorted[perCol + i] || null);

  // Title + auto date per the selected period.
  const isMonth = KHMER_MONTHS.includes(period);
  const periodLabel = isMonth
    ? `ប្រចាំខែ ${period}`
    : period === 'ប្រឡងឆមាសទី១' ? 'ប្រឡងឆមាសទី ១'
    : period === 'ប្រឡងឆមាសទី២' ? 'ប្រឡងឆមាសទី ២'
    : 'ប្រចាំឆ្នាំ';
  const dateInfo = isMonth
    ? khmerMonthEnd(period)
    : { day: '.........', year: '២០២៦', lunar: khmerLunarFull(new Date()) };

  // Footer statistics: counts per និទ្ទេស band + scored / unscored, each with girls.
  const fem = (rows: RankingRow[]) => rows.filter(r => r.gender === 'ស្រី').length;
  const bandStats = NIDDES_BANDS.map(b => {
    const rows = roster.filter(r => niddesOf(r.overallAvg) === b);
    return { band: b, total: rows.length, female: fem(rows) };
  });
  const unranked = roster.filter(r => !(r.overallAvg && r.overallAvg > 0));
  const totalFemale = fem(roster);
  const scoredFemale = fem(scored);

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #class-ranking, #class-ranking * { visibility: visible !important; }
    #class-ranking { position: absolute; left: 0; top: 0; width: 100%; }
    .rc-no-print { display: none !important; }
    @page { size: A4 portrait; margin: 10mm; }
  }`;

  const HeadCells = () => (
    <>
      <th className="border border-slate-400 px-1 py-0.5 w-7">ល.រ</th>
      <th className="border border-slate-400 px-1 py-0.5 text-left">គោត្តនាម និងនាម</th>
      <th className="border border-slate-400 px-1 py-0.5 w-7">ភេទ</th>
      <th className="border border-slate-400 px-1 py-0.5 w-12">ម.ភាគ</th>
      <th className="border border-slate-400 px-1 py-0.5 w-10">ចំ.ថ្នាក់</th>
      <th className="border border-slate-400 px-1 py-0.5 w-16">និទ្ទេស</th>
    </>
  );
  const Row: React.FC<{ r: RankingRow | null; n: number }> = ({ r, n }) => (
    <tr className="text-center h-[18px]">
      <td className="border border-slate-400 px-1 py-0.5">{r ? toKh(n) : ''}</td>
      <td className="border border-slate-400 px-1 py-0.5 text-left whitespace-nowrap">{r ? r.name : ''}</td>
      <td className="border border-slate-400 px-1 py-0.5">{r ? genderShort(r.gender) : ''}</td>
      <td className="border border-slate-400 px-1 py-0.5 font-mono">{r ? (r.overallAvg ?? 0).toFixed(2) : ''}</td>
      <td className="border border-slate-400 px-1 py-0.5">{r ? rankOf(r.overallAvg) : ''}</td>
      <td className="border border-slate-400 px-1 py-0.5">{r ? (niddesOf(r.overallAvg) || 'គ្មានចំណាត់ថ្នាក់') : ''}</td>
    </tr>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <div className="w-full max-w-4xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">តារាងចំណាត់ថ្នាក់ — {grade} • {periodLabel}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              <Printer size={13} /> បោះពុម្ព / PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        <div id="class-ranking" className="bg-white rounded-b-2xl shadow-xl p-6 text-slate-800 text-[11px]">
          {/* Header */}
          <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col items-center font-semibold text-emerald-700">
              <SchoolLogo size={84} />
              <div className="mt-1 text-sm font-bold">សាលាសហគមន៍ច្បារច្រុះ</div>
            </div>
            <div className="text-center text-[11px]">
              <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-2">
            <h1 className="text-base font-extrabold text-slate-900">តារាងចំណាត់ថ្នាក់សរុប{periodLabel}</h1>
          </div>
          <div className="flex justify-between items-end mb-2 px-1 font-bold">
            <span>{grade === 'ទាំងអស់' ? 'គ្រប់ថ្នាក់' : grade}</span>
            <span>ឆ្នាំសិក្សា ២០២៥ - ២០២៦</span>
          </div>

          {/* Two-column ranking table */}
          <div className="grid grid-cols-2 gap-2">
            {[leftRows, rightRows].map((col, ci) => (
              <table key={ci} className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold"><HeadCells /></tr>
                </thead>
                <tbody>
                  {col.map((r, i) => <Row key={i} r={r} n={ci * perCol + i + 1} />)}
                </tbody>
              </table>
            ))}
          </div>

          {/* Footer statistics */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 mt-3 text-[10.5px]">
            {bandStats.map(s => (
              <div key={s.band} className="flex justify-between border-b border-dotted border-slate-200">
                <span>និទ្ទេស {s.band}៖ <b>{toKh(s.total)}</b> នាក់</span>
                <span>ស្រី {toKh(s.female)} នាក់</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-dotted border-slate-300 font-bold">
              <span>សិស្សមានចំណាត់ថ្នាក់៖ {toKh(scored.length)} នាក់</span>
              <span>ស្រី {toKh(scoredFemale)} នាក់</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-slate-300 font-bold">
              <span>សិស្សគ្មានចំណាត់ថ្នាក់៖ {toKh(unranked.length)} នាក់</span>
              <span>ស្រី {toKh(fem(unranked))} នាក់</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-slate-400 font-bold text-blue-700 col-span-2">
              <span>សិស្សសរុប៖ {toKh(roster.length)} នាក់</span>
              <span>ស្រី {toKh(totalFemale)} នាក់</span>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-6 text-[11px] text-center">
            <div>
              <p className="font-bold">បានឃើញ និងឯកភាព</p>
              <p className="font-bold">នាយកសាលា</p>
              <PrincipalSignature />
            </div>
            <div>
              <p>{dateInfo.lunar}</p>
              <p>ច្បារច្រុះ ថ្ងៃទី{dateInfo.day} {isMonth ? `ខែ${period}` : 'ខែ............'} ឆ្នាំ{dateInfo.year}</p>
              <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
              <p className="text-slate-300 pt-6">..............................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
