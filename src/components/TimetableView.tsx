/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Timetable } from '../lib/timetable';

// Read-only weekly timetable table — used in the Parent Portal (and anywhere a
// non-editable view is needed).
export default function TimetableView({ tt }: { tt: Timetable }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full text-[11px] min-w-[520px]">
        <thead>
          <tr>
            <th className="border border-slate-300 px-1.5 py-1 bg-slate-100 text-slate-600 w-24">ម៉ោង / ថ្ងៃ</th>
            {tt.days.map((d, di) => <th key={di} className="border border-slate-300 px-1.5 py-1 bg-slate-100 text-slate-700">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {tt.periods.map((p, pi) => (
            <tr key={pi}>
              <td className="border border-slate-300 px-1.5 py-1 bg-slate-50 font-semibold text-slate-600">{p}</td>
              {tt.days.map((_, di) => (
                <td key={di} className="border border-slate-300 px-1.5 py-1 text-center text-slate-700">{tt.grid[pi]?.[di] || ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
