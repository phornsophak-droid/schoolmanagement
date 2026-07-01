/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Printer, X, Camera, Download, Loader2 } from 'lucide-react';
import SchoolLogo from './SchoolLogo';
import PrincipalSignature from './PrincipalSignature';
import TeacherSignature from './TeacherSignature';
import { khmerLunarFull, khmerMonthEnd } from '../utils/khmerDate';
import { niddesColor } from '../utils/scoring';
import { exportElementToPdf } from '../utils/exportPdf';

const HONOR_KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហา', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

export interface HonorEntry { rank: number; name: string; score?: number | null; }

// និទ្ទេស letter from a 0–10 score (same bands as the report cards).
const gradeLetter = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v <= 0) return '';
  if (v >= 9) return 'A';
  if (v >= 8) return 'B';
  if (v >= 7) return 'C';
  if (v >= 6) return 'D';
  if (v >= 5) return 'E';
  return 'F';
};

interface HonorRollProps {
  subtitle: string;      // e.g. "ប្រចាំខែ កុម្ភៈ" / "ប្រចាំ ឆមាសទី ១" / "ប្រចាំឆ្នាំ"
  grade: string;
  entries: HonorEntry[]; // top students, already ranked
  onClose: () => void;
}

const toKh = (n: number) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

// Medal colours per rank — gold, silver, bronze, then blue.
const medalStyle = (rank: number) => {
  if (rank === 1) return 'from-amber-400 to-yellow-600';
  if (rank === 2) return 'from-slate-300 to-slate-500';
  if (rank === 3) return 'from-orange-400 to-amber-700';
  return 'from-rose-500 to-red-700';
};
const frameStyle = (rank: number) => {
  if (rank === 1) return 'from-amber-300 via-yellow-400 to-amber-600';
  if (rank === 2) return 'from-slate-300 via-slate-400 to-slate-500';
  if (rank === 3) return 'from-orange-300 via-amber-400 to-amber-600';
  return 'from-sky-300 via-blue-400 to-indigo-500';
};

// One honor photo frame: medal badge, decorative photo frame, name ribbon.
function HonorFrame({ rank, name, photo, letter, onPick, big = false }: { rank: number; name: string; photo: string; letter: string; onPick: () => void; big?: boolean }) {
  const photoW = big ? 'w-40' : 'w-32';
  const photoH = big ? 'h-48' : 'h-40';
  return (
    <div className="relative flex flex-col items-center">
      {/* Medal */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
        <div className={`rounded-full bg-gradient-to-b ${medalStyle(rank)} text-white font-extrabold flex items-center justify-center shadow-lg border-[3px] border-white ${big ? 'w-12 h-12 text-2xl' : 'w-9 h-9 text-lg'}`}>
          {toKh(rank)}
        </div>
      </div>

      {/* Decorative photo frame */}
      <div className={`relative p-[3px] rounded-2xl bg-gradient-to-b ${frameStyle(rank)} shadow-xl mt-2`}>
        <div className={`${photoW} ${photoH} rounded-xl overflow-hidden bg-slate-50 border border-white`}>
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <button onClick={onPick} className="rc-no-print w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:bg-slate-100 transition-colors">
              <Camera size={big ? 26 : 20} />
              <span className="text-[10px] font-bold">បញ្ចូលរូបថត</span>
            </button>
          )}
        </div>
      </div>

      {/* Name ribbon — និទ្ទេស letter sits after the name */}
      <div className={`-mt-3 z-10 ${big ? 'min-w-[10rem]' : 'min-w-[8rem]'} max-w-[90%]`}>
        <div className={`bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-md px-4 ${big ? 'py-1.5 text-base' : 'py-1 text-sm'} font-bold border-2 border-white whitespace-nowrap flex items-center justify-center gap-2`}>
          <span>{name || '—'}</span>
          {letter && (
            <span className={`text-white font-extrabold rounded-full flex items-center justify-center shadow border border-white shrink-0 ${big ? 'w-6 h-6 text-sm' : 'w-5 h-5 text-xs'}`} style={{ backgroundColor: niddesColor(letter) || '#64748b' }}>
              {letter}
            </span>
          )}
        </div>
      </div>

      {/* Change photo (screen only) */}
      {photo && (
        <button onClick={onPick} className="rc-no-print mt-1 text-[10px] text-blue-500 hover:underline">ប្តូររូប</button>
      )}
    </div>
  );
}

export default function HonorRoll({ subtitle, grade, entries, onClose }: HonorRollProps) {
  const byRank = (r: number): HonorEntry => entries.find(e => e.rank === r) || entries[r - 1] || { rank: r, name: '' };
  const ranks = [1, 2, 3, 4, 5].map(byRank);

  // Auto date for the signature block — use the report's month if the subtitle
  // names one (e.g. "ប្រចាំខែ កុម្ភៈ"), else today.
  const subMonth = HONOR_KH_MONTHS.find(m => subtitle.includes(m));
  const honorDate = subMonth
    ? khmerMonthEnd(subMonth)
    : { day: '.........', year: '២០២៦', lunar: khmerLunarFull(new Date()) };

  const photoKey = (name: string) => `honorphoto::${grade}::${subtitle}::${name.trim()}`;
  const [photos, setPhotos] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    ranks.forEach(e => { if (e.name) { try { m[e.name] = localStorage.getItem(photoKey(e.name)) || ''; } catch { /* ignore */ } } });
    return m;
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingName = useRef<string>('');
  const pickFor = (name: string) => { pendingName.current = name; fileRef.current?.click(); };

  // Download the honor roll as a PDF. The board is tall, so exportElementToPdf
  // renders it portrait and scales it to fit an A4 page.
  const [pdfBusy, setPdfBusy] = useState(false);
  const handleDownloadPdf = async () => {
    const el = document.getElementById('honor-roll');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToPdf(el, `តារាងកិត្តិយស_${grade.replace(/\s+/g, '_')}`); }
    catch (e) { console.error('PDF export failed', e); alert('មិនអាចបង្កើត PDF បានទេ — សូមព្យាយាមម្ដងទៀត។'); }
    finally { setPdfBusy(false); }
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const name = pendingName.current;
    if (!file || !name) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPhotos(p => ({ ...p, [name]: url }));
      try { localStorage.setItem(photoKey(name), url); } catch { /* ignore — photos are local only */ }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Keep the decorative colours (gradients, medals, ribbons) when printing, and
  // force a single fit-to-page A4 PORTRAIT sheet. `zoom` (set by handlePrint) scales
  // the actual layout box — unlike transform:scale — so the tall board shrinks onto
  // one page instead of overflowing/cutting.
  const printCss = `@media print {
    @page { size: A4 portrait; margin: 8mm; }
    body * { visibility: hidden !important; }
    #honor-roll, #honor-roll * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #honor-roll { position: absolute; left: 0; top: 0; }
    .rc-no-print { display: none !important; }
  }`;

  // Print: scale the board with `zoom` so the whole thing fits one A4 portrait page.
  const handlePrint = () => {
    const el = document.getElementById('honor-roll');
    if (!el) { window.print(); return; }
    const prevZoom = el.style.zoom;
    // A4 portrait usable area at ~96dpi minus the 8mm @page margin.
    const availW = 794 - 60, availH = 1123 - 60;
    const r = el.getBoundingClientRect();
    const z = Math.min(availW / r.width, availH / r.height);
    (el.style as any).zoom = String(z);
    const done = () => { (el.style as any).zoom = prevZoom; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
    setTimeout(done, 2000); // fallback reset if afterprint doesn't fire
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 overflow-auto p-4 flex justify-center items-start">
      <style>{printCss}</style>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="w-full max-w-2xl">
        {/* Toolbar */}
        <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-t-2xl border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">តារាងកិត្តិយស — {grade} • {subtitle}</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPdf} disabled={pdfBusy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ទាញយក PDF
            </button>
            <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
              <Printer size={13} /> បោះពុម្ព / PDF
            </button>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
              <X size={13} /> បិទ
            </button>
          </div>
        </div>

        {/* Ornate outer frame */}
        <div id="honor-roll" className="rounded-b-2xl p-2 bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-700 shadow-2xl">
          <div className="relative rounded-xl border-2 border-blue-200 bg-white px-8 py-6 overflow-hidden">
            {/* Soft decorative background */}
            <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 50% 38%, rgba(99,102,241,0.10), transparent 55%)' }} />
            {/* Corner flourishes */}
            <span className="pointer-events-none absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <span className="pointer-events-none absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <span className="pointer-events-none absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <span className="pointer-events-none absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            <div className="relative">
              {/* Kingdom header */}
              <div className="text-center text-[12px]">
                <div className="font-bold">ព្រះរាជាណាចក្រកម្ពុជា</div>
                <div className="font-semibold">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                <div className="text-slate-400">~ ~ ~ ~ ~ ~</div>
              </div>

              <div className="flex flex-col items-center text-emerald-700 font-semibold mt-1 mb-1">
                <SchoolLogo size={88} />
                <div className="text-sm font-bold">សាលាសហគមន៍ច្បារច្រុះ</div>
              </div>

              {/* Title */}
              <div className="text-center my-3">
                <h1 className="text-4xl font-extrabold text-blue-600 tracking-wide drop-shadow-sm" style={{ WebkitTextStroke: '1.2px #1e3a8a' }}>តារាងកិត្តិយស</h1>
                <p className="text-lg font-bold text-rose-600 mt-1">{subtitle}</p>
              </div>

              {/* Rank 1 */}
              <div className="flex justify-center mt-7 mb-7">
                <HonorFrame rank={1} name={ranks[0].name} photo={photos[ranks[0].name] || ''} letter={gradeLetter(ranks[0].score)} onPick={() => pickFor(ranks[0].name)} big />
              </div>

              {/* Ranks 2 & 3 */}
              <div className="grid grid-cols-2 gap-6 mb-7 max-w-md mx-auto">
                <HonorFrame rank={2} name={ranks[1].name} photo={photos[ranks[1].name] || ''} letter={gradeLetter(ranks[1].score)} onPick={() => pickFor(ranks[1].name)} />
                <HonorFrame rank={3} name={ranks[2].name} photo={photos[ranks[2].name] || ''} letter={gradeLetter(ranks[2].score)} onPick={() => pickFor(ranks[2].name)} />
              </div>

              {/* Ranks 4 & 5 */}
              <div className="grid grid-cols-2 gap-6 mb-4 max-w-md mx-auto">
                <HonorFrame rank={4} name={ranks[3].name} photo={photos[ranks[3].name] || ''} letter={gradeLetter(ranks[3].score)} onPick={() => pickFor(ranks[3].name)} />
                <HonorFrame rank={5} name={ranks[4].name} photo={photos[ranks[4].name] || ''} letter={gradeLetter(ranks[4].score)} onPick={() => pickFor(ranks[4].name)} />
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 mt-8 text-[11px] text-center">
                <div>
                  <p className="font-bold">បានឃើញ និងឯកភាព</p>
                  <p className="font-bold">នាយកសាលា</p>
                  <PrincipalSignature />
                </div>
                <div>
                  <p>{honorDate.lunar}</p>
                  <p>ច្បារច្រុះ ថ្ងៃទី{honorDate.day} {subMonth ? `ខែ${subMonth}` : 'ខែ.........'} ឆ្នាំ{honorDate.year}</p>
                  <p className="font-bold pt-1">គ្រូបន្ទុកថ្នាក់</p>
                  <TeacherSignature grade={grade} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
