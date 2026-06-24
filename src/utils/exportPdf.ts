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

// iOS Safari ignores <a download> and drops the user gesture across the async
// render, so a normal save silently fails. Open a tab synchronously during the
// tap (so it isn't blocked) and, once the file is ready, point it at the blob;
// iOS shows it with a Share → "Save to Files" / "Save Image" action.
const openIosTab = (kind: string): Window | null => {
  if (!isIOS()) return null;
  const tab = window.open('', '_blank');
  if (tab) {
    try { tab.document.write(`<!doctype html><meta name="viewport" content="width=device-width"><title>${kind}</title><body style="font-family:sans-serif;margin:2rem;color:#475569">កំពុងបង្កើត${kind}...</body>`); }
    catch { /* ignore — about:blank may already be cross-origin-guarded */ }
  }
  return tab;
};

// Deliver a finished blob: navigate the pre-opened iOS tab to it, or trigger a
// normal download on desktop/Android (where <a download> works).
const deliverBlob = (blob: Blob, filename: string, iosTab: Window | null): void => {
  const url = URL.createObjectURL(blob);
  if (iosTab) {
    iosTab.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// Rasterize a DOM element to a canvas. Because it's a snapshot it looks
// pixel-identical on every device (no reflow) and embeds whatever is on screen
// — including the principal/teacher signatures. Normalized to ~1500px wide so
// quality is the same on phone or PC.
async function renderElementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const scale = Math.min(4, Math.max(2, 1500 / (el.offsetWidth || 1000)));
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: el.scrollWidth,
    // On phones the report cards sit inside a FitToWidth transform:scale()
    // wrapper. html2canvas renders text at natural size but positions it with
    // the scaled coordinates → garbled overlap. Neutralise the wrapper in the
    // (sandboxed) clone so the card is captured at its full, un-scaled size.
    onclone: (doc: Document) => {
      doc.querySelectorAll<HTMLElement>('.rc-fit-outer, .rc-fit-frame, .rc-fit-inner').forEach(n => {
        n.style.transform = 'none';
        n.style.width = 'auto';
        n.style.height = 'auto';
        n.style.overflow = 'visible';
        n.style.margin = '0';
      });
    },
  });
}

// Render an element to a single-image PDF page (landscape if the snapshot is
// wider than tall). Call synchronously from the click handler (before any other
// await) so the iOS tab stays inside the user gesture.
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const iosTab = openIosTab(' PDF');
  try {
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

    if (iosTab) {
      const url = URL.createObjectURL(pdf.output('blob'));
      iosTab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      pdf.save(name);
    }
  } catch (e) {
    if (iosTab) iosTab.close();
    throw e;
  }
}

// Render an element to a downloadable PNG image (lossless — keeps Khmer text and
// the certificate frame crisp). Same iOS-tab handling as the PDF export. Call
// synchronously from the click handler.
export async function exportElementToImage(el: HTMLElement, filename: string): Promise<void> {
  const iosTab = openIosTab('រូបភាព');
  try {
    const canvas = await renderElementToCanvas(el);
    const name = filename.endsWith('.png') ? filename : `${filename}.png`;
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('toBlob returned null');
    deliverBlob(blob, name, iosTab);
  } catch (e) {
    if (iosTab) iosTab.close();
    throw e;
  }
}
