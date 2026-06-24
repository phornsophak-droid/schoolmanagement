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

// Render a DOM element to a single-image PDF page. Because the page is a
// rasterized snapshot, it looks pixel-identical on every device (no reflow) and
// embeds whatever is on screen — including the principal/teacher signatures.
// Output is normalized to ~1500px wide so quality is the same on phone or PC.
//
// Call this synchronously from the click handler (before any other await): on
// iOS we open the target tab now so it stays inside the user gesture.
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  // iOS Safari ignores <a download> and drops the user gesture across the async
  // render, so the normal save silently fails. Open the tab synchronously here
  // (still within the tap) and point it at the finished PDF; iOS then shows the
  // PDF with a Share → "Save to Files" action.
  const iosTab = isIOS() ? window.open('', '_blank') : null;
  if (iosTab) {
    try { iosTab.document.write('<!doctype html><meta name="viewport" content="width=device-width"><title>PDF</title><body style="font-family:sans-serif;margin:2rem;color:#475569">កំពុងបង្កើត PDF...</body>'); }
    catch { /* ignore — about:blank may already be cross-origin-guarded */ }
  }

  try {
    const scale = Math.min(4, Math.max(2, 1500 / (el.offsetWidth || 1000)));
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: el.scrollWidth,
    });

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
