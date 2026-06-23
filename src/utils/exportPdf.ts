/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Render a DOM element to a single-image PDF page. Because the page is a
// rasterized snapshot, it looks pixel-identical on every device (no reflow) and
// embeds whatever is on screen — including the principal/teacher signatures.
// Output is normalized to ~1500px wide so quality is the same on phone or PC.
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
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
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
