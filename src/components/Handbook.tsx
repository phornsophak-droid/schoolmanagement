/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// សៀវភៅសិក្ខាគារិក — the official MoEYS student record book, shown read-only for
// reference. The .docx is converted to HTML once at build time (handbook.html,
// imported raw) and rendered here; a button exports it as a multi-page A4 PDF.

import React, { useState } from 'react';
import { BookOpen, Download, Loader2, X } from 'lucide-react';
import handbookHtml from '../assets/handbook.html?raw';
import { exportElementToMultipagePdf } from '../utils/exportPdf';
import FitToWidth from './FitToWidth';

// A4 landscape at 96dpi — 297mm wide. The sheets are laid out at this exact size
// (matching the .docx page setup) and scaled down on screen by FitToWidth.
const SHEET_W = Math.round((297 / 25.4) * 96); // 1123px

interface Props { onClose?: () => void; }

export default function Handbook({ onClose }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = async () => {
    const el = document.getElementById('handbook-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToMultipagePdf(el, 'សៀវភៅសិក្ខាគារិក', SHEET_W); }
    catch { /* ignore — user can retry */ }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <style>{`
        /* Mirrors the .docx page setup exactly: A4 landscape, 1cm margins, two
           columns 1.27cm apart (w:pgSz 16840x11907 landscape, w:pgMar 567,
           w:cols num=2 space=720). Each sheet = one landscape page holding two
           book-pages side by side, all in the document's blue (#0000FF). */
        .handbook-body { color: #0000FF; font-size: 10.5pt; line-height: 1.55; }
        /* Fixed A4-landscape box — the whole point is 3 sheets, so the content is
           tuned to fit 210mm rather than being allowed to spill onto a 4th page. */
        .handbook-body .sheet {
          width: 297mm; height: 210mm; padding: 10mm; margin: 0 auto 14px;
          display: flex; gap: 12.7mm; background: #fff; box-sizing: border-box; overflow: hidden;
        }
        .handbook-body .panel { flex: 1 1 0; min-width: 0; border: 2.5px double #0000FF; padding: 4mm 5mm; box-sizing: border-box; overflow: hidden; }
        .handbook-body .panel.blank { border: none; }
        .handbook-body p { margin: 3px 0; overflow-wrap: anywhere; }
        .handbook-body .ctr { text-align: center; }
        .handbook-body .big { font-size: 13pt; font-weight: 700; }
        .handbook-body .title { font-size: 22pt; font-weight: 800; margin: 12mm 0 8mm; letter-spacing: .5px; }
        .handbook-body .title2 { font-size: 14pt; font-weight: 800; margin: 2mm 0; }
        .handbook-body .uline { text-decoration: underline; text-underline-offset: 4px; }
        .handbook-body .deco { letter-spacing: 2px; }
        .handbook-body .mt { margin-top: 8mm; } .handbook-body .mt2 { margin-top: 10mm; } .handbook-body .mt3 { margin-top: 5mm; }
        .handbook-body .fields { margin-top: 12mm; } .handbook-body .fields p { margin: 2.5mm 0; }
        .handbook-body .fields2 p { margin: 2.5mm 0; }
        .handbook-body .btm { margin-top: 8mm; }
        .handbook-body .ind { text-indent: 8mm; margin: 2mm 0; }
        .handbook-body .item { margin: 1.8mm 0; text-align: justify; }
        /* The instructions run long; give that panel a tighter scale so all seven
           points fit its half-sheet instead of being clipped. */
        .handbook-body .panel.instr { font-size: 9pt; line-height: 1.4; }
        .handbook-body .panel.instr .item { margin: 1.2mm 0; }
        .handbook-body .panel.instr .sub, .handbook-body .panel.instr .sub2 { margin-top: 1mm; margin-bottom: 1mm; }
        .handbook-body .panel.instr .title2 { font-size: 13pt; }
        .handbook-body .sub { margin: 1.5mm 0 1.5mm 6mm; }
        .handbook-body .sub2 { margin: 0 0 1.5mm 10mm; }
        .handbook-body .note { margin-top: 3mm; } .handbook-body .note2 { margin-left: 22mm; }
        /* "average" fraction — a numerator over a rule, as in the original */
        .handbook-body .frac { display: inline-block; text-align: center; vertical-align: middle; }
        .handbook-body .frac .num { display: block; border-bottom: 1.5px solid #0000FF; padding: 0 2mm; }
        .handbook-body .frac .den { display: block; }
        /* Identity panel: photo box on the LEFT, title beside it. */
        .handbook-body .idhead { display: flex; flex-direction: row-reverse; align-items: flex-start; gap: 4mm; }
        .handbook-body .idtitle { flex: 1; }
        .handbook-body .photo { width: 26mm; height: 34mm; border: 1.5px solid #0000FF; display: flex; flex-direction: column;
          align-items: center; justify-content: center; font-size: 10pt; shrink: 0; }
        .handbook-body .hdr { margin-bottom: 2mm; font-size: 9.5pt; }
        .handbook-body .sig { text-align: center; margin-top: 4mm; font-size: 9.5pt; }
        .handbook-body .sig .who { font-weight: 700; margin-top: 8mm; }
        .handbook-body .two { display: flex; gap: 4mm; } .handbook-body .two > * { flex: 1; text-align: center; }
        /* Tables — fixed layout so wide grids never push the sheet wider. */
        .handbook-body table.grid { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8pt; line-height: 1.25; }
        .handbook-body table.grid td { border: 1px solid #0000FF; padding: 0.6mm 1.2mm; vertical-align: middle; word-wrap: break-word; }
        .handbook-body table.grid td.sec { text-align: center; font-weight: 800; font-size: 10pt; }
        .handbook-body table.grid td.hd { text-align: center; font-weight: 700; }
        .handbook-body table.grid td.lbl { text-align: left; }
        .handbook-body table.grid td.dot, .handbook-body table.grid td.pad { vertical-align: top; height: auto; padding: 2mm; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .handbook-body .sheet { margin: 0; page-break-after: always; break-after: page; box-shadow: none; }
          .handbook-body .sheet:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="rc-no-print flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <BookOpen size={16} className="text-emerald-600" /> សៀវភៅសិក្ខាគារិក
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center gap-1.5 shadow-sm"
          >
            {pdfBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ទាញយក PDF
          </button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <X size={13} /> បិទ
            </button>
          )}
        </div>
      </div>

      {/* Document — fixed at the real A4-landscape width and scaled down to fit the
          screen without reflowing (print/PDF still use the full size). */}
      <div className="bg-slate-100 rounded-2xl border border-slate-200 p-3 overflow-hidden">
        <FitToWidth designWidth={SHEET_W} fitHeight={false}>
          <div id="handbook-print" className="handbook-body" style={{ width: SHEET_W }} dangerouslySetInnerHTML={{ __html: handbookHtml }} />
        </FitToWidth>
      </div>
    </div>
  );
}
