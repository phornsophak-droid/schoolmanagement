/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
// html2canvas-pro (maintained fork) supports modern CSS colour functions like
// oklch(), which Tailwind v4 emits. The original html2canvas 1.x throws on oklch
// → every report-card / certificate PDF export failed.
import html2canvas from 'html2canvas-pro';

// iPhone, iPod, and iPadOS (which reports itself as "MacIntel" but has touch).
const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Deliver a finished blob to the user.
//
// IMPORTANT: we render FIRST and deliver afterwards (see exports below). We must
// NOT open the result tab before rendering — on iOS opening a tab backgrounds
// this page, and iOS pauses background JS, so html2canvas never finishes and the
// export hangs on "កំពុងបង្កើត PDF...".
//
//   • Desktop / Android: <a download> saves the file directly.
//   • iOS Safari & in-app browsers (Telegram, Messenger…): <a download> and
//     gesture-expired popups are unreliable. Try a new tab; if that's blocked,
//     navigate THIS tab to the blob — that always renders the file, and the user
//     saves it via the Share sheet ("Save to Files" / "Save Image").
const deliverBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  if (isIOS()) {
    const w = window.open(url, '_blank');
    if (!w) window.location.href = url; // popup blocked → open in place
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Rasterize a DOM element to a canvas. Because it's a snapshot it looks
// pixel-identical on every device (no reflow) and embeds whatever is on screen
// — including the principal/teacher signatures. Normalized to ~1500px wide so
// quality is the same on phone or PC.
async function renderElementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Wait for the Khmer web fonts (incl. the BOLD weight used in the table headers)
  // to finish loading. If we capture before bold Khmer is ready html2canvas can't
  // measure the glyphs and the <th> header text comes out blank on some browsers
  // (e.g. desktop Chrome). Then settle briefly so metrics are final.
  try { await (document as any).fonts?.ready; } catch { /* fonts API absent — proceed */ }
  await new Promise(resolve => setTimeout(resolve, 50));

  // Render at a fixed virtual width, and derive the scale FROM THAT width (not the
  // on-screen offsetWidth). On a narrow phone offsetWidth is ~350px, which made the
  // old `1500/offsetWidth` scale jump to 4 while the render width was forced to 800
  // → a ~3200px canvas that froze weak mobile CPUs ("Page Unresponsive"). Capping
  // the output to ~1500px keeps it fast on every device.
  const renderWidth = Math.max(el.scrollWidth, el.offsetWidth, 800);
  const scale = Math.min(2.5, Math.max(1.5, 1500 / renderWidth));
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    windowWidth: renderWidth,
    // On phones the report cards sit inside a FitToWidth transform:scale()
    // wrapper. html2canvas renders text at natural size but positions it with
    // the scaled coordinates → garbled overlap. Neutralise the wrapper in the
    // (sandboxed) clone so the card is captured at its full, un-scaled size.
    onclone: (doc: Document) => {
      doc.querySelectorAll<HTMLElement>('.rc-fit-outer, .rc-fit-frame').forEach(n => {
        n.style.transform = 'none';
        n.style.width = 'auto';
        n.style.maxWidth = 'none';
        n.style.height = 'auto';
        n.style.overflow = 'visible';
        n.style.margin = '0';
      });
      // Keep the inner's design width (e.g. 768px) — only undo the scale. Setting
      // width:auto here lets the card collapse to the phone's narrow viewport, so
      // the capture comes out cramped with overlapping text.
      doc.querySelectorAll<HTMLElement>('.rc-fit-inner').forEach(n => {
        n.style.transform = 'none';
        n.style.height = 'auto';
        n.style.overflow = 'visible';
        n.style.margin = '0';
      });
      // html2canvas ignores @media print, so screen-only chrome (the
      // "លុបហត្ថលេខា" / "ប្តូររូប" links, the empty photo-upload placeholder)
      // would otherwise show in the PDF/image. Hide it to match print output —
      // an actually-uploaded photo is not .rc-no-print, so it still appears.
      doc.querySelectorAll<HTMLElement>('.rc-no-print').forEach(n => { n.style.display = 'none'; });
    },
  });
}

// Render an element to a single-image PDF page (landscape if the snapshot is
// wider than tall). Rendering runs while this page is in the foreground; only
// after the file is ready do we hand it off (so iOS never pauses the render).
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderElementToCanvas(el);
  const imgW = canvas.width;
  const imgH = canvas.height;
  const orientation = imgW >= imgH ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Fit the snapshot within the page, centered, preserving aspect ratio.
  const ratio = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * ratio;
  const h = imgH * ratio;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST');
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  deliverBlob(pdf.output('blob'), name);
}

// Render an element to a downloadable PNG image (lossless — keeps Khmer text and
// the certificate frame crisp).
export async function exportElementToImage(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderElementToCanvas(el);
  const name = filename.endsWith('.png') ? filename : `${filename}.png`;
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  deliverBlob(blob, name);
}
