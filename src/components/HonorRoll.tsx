/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import SchoolLogo from './SchoolLogo';

export interface HonorEntry { rank: number; name: string; }

interface HonorRollProps {
  subtitle: string;      // e.g. "ប្រចាំខែ កុម្ភៈ" / "ប្រចាំ ឆមាសទី ១" / "ប្រចាំឆ្នាំ"
  grade: string;
  entries: HonorEntry[]; // top students, already ranked
  onClose: () => void;
}

const toKh = (n: number) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// One decorative honor banner: a red-bordered card with a medal number on top.
function Banner({ rank, name, big = false }: { rank: number; name: string; big?: boolean }) {
  return (
    <div className="relative w-full">
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
        <div className={`rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white font-extrabold flex items-center justify-center shadow-lg border-[3px] border-white ${big ? 'w-12 h-12 text-2xl' : 'w-10 h-10 text-xl'}`}>
          {toKh(rank)}
        </div>
      </div>
      <div className={`rounded-xl bg-white text-center shadow-md border-[3px] border-red-500 outline outline-2 outline-offset-2 outline-red-300 ${big ? 'px-8 py-7 pt-9' : 'px-5 py-5 pt-7'}`}>
        <span className={`font-bold text-slate-800 ${big ? 'text-2xl' : 'text-lg'}`}>{name || '—'}</span>
      </div>
    </div>
  );
}

export default function HonorRoll({ subtitle, grade, entries, onClose }: HonorRollProps) {
  const byRank = (r: number) => entries.find(e => e.rank === r) || entries[r - 1] || { rank: r, name: '' };
  const top1 = byRank(1), top2 = byRank(2), top3 = byRank(3), top4 = byRank(4), top5 = byRank(5);

  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #honor-roll, #honor-roll * { visibility: visible !important; }
    #honor-roll { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: 0; }
    .rc-no-print { display: none !important; }
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <div className="w-full max-w-2xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">តារាងកិត្តិយស — {grade} • {subtitle}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              <Printer size={13} /> បោះពុម្ព / PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        {/* Printable board */}
        <div id="honor-roll" className="bg-white rounded-b-2xl shadow-xl p-8 text-slate-800 border-[6px] border-blue-400/70">
          {/* Kingdom header */}
          <div className="text-center text-[12px]">
            <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
          </div>

          <div className="flex flex-col items-center text-emerald-700 font-semibold mt-2 mb-1">
            <SchoolLogo size={70} />
            <div className="text-sm font-bold">សាលាសហគមន៍ច្បារច្រុះ</div>
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h1 className="text-4xl font-extrabold text-blue-600 tracking-wide drop-shadow-sm" style={{ WebkitTextStroke: '1px #1e3a8a' }}>តារាងកិត្តិយស</h1>
            <p className="text-lg font-bold text-rose-600 mt-1">{subtitle}</p>
          </div>

          {/* Rank 1 */}
          <div className="max-w-sm mx-auto mt-8 mb-8">
            <Banner rank={1} name={top1.name} big />
          </div>

          {/* Ranks 2 & 3 */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <Banner rank={2} name={top2.name} />
            <Banner rank={3} name={top3.name} />
          </div>

          {/* Ranks 4 & 5 */}
          <div className="grid grid-cols-2 gap-6 mb-4">
            <Banner rank={4} name={top4.name} />
            <Banner rank={5} name={top5.name} />
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-10 text-[11px] text-center">
            <div>
              <p className="font-bold">បានឃើញ និងឯកភាព</p>
              <p className="font-bold">នាយកសាលា</p>
              <p className="text-slate-300 pt-10">..............................</p>
            </div>
            <div>
              <p>ច្បារច្រុះ ថ្ងៃទី......... ខែ......... ឆ្នាំ២០២៦</p>
              <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
              <p className="text-slate-300 pt-8">..............................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
