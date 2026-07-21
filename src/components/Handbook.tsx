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

interface Props { onClose?: () => void; }

export default function Handbook({ onClose }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = async () => {
    const el = document.getElementById('handbook-print');
    if (!el) return;
    setPdfBusy(true);
    try { await exportElementToMultipagePdf(el, 'សៀវភៅសិក្ខាគារិក', 850); }
    catch { /* ignore — user can retry */ }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <style>{`
        .handbook-body { font-size: 12pt; line-height: 1.7; color: #1e293b; }
        /* The form's long dotted fill-in runs ("......") are one unbreakable token —
           allow them to wrap so they don't stretch the page. */
        .handbook-body p { margin: 6px 0; overflow-wrap: anywhere; }
        .handbook-body h1, .handbook-body h2, .handbook-body h3 { font-weight: 800; margin: 14px 0 6px; }
        .handbook-body ol { margin: 6px 0; padding-left: 1.6em; }
        .handbook-body li { margin: 4px 0; }
        /* Some record tables are far wider than a phone. Let each scroll INSIDE its
           own box (table-layout:fixed + wrapper) so the page itself never scrolls
           sideways and the PDF capture keeps the full width. */
        .handbook-body table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 10px 0; font-size: 11pt; }
        .handbook-body td, .handbook-body th { border: 1px solid #94a3b8; padding: 5px 7px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
        .handbook-body table tr:first-child td { background: #f1f5f9; font-weight: 700; text-align: center; }
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

      {/* Document */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-10">
        <div id="handbook-print" className="handbook-body" dangerouslySetInnerHTML={{ __html: handbookHtml }} />
      </div>
    </div>
  );
}
