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

const isMobile = (): boolean =>
  isIOS() || /Android|Mobile/i.test(navigator.userAgent) ||
  (typeof window !== 'undefined' && 'ontouchstart' in window && navigator.maxTouchPoints > 0);

// Show a rendered image full-screen IN the app so the user can long-press →
// "Save Image" (mobile) or use the download button. This sidesteps the phone
// problems that broke "ទាញយករូបភាព": after the async html2canvas render the tap
// gesture has expired, so window.open()/navigator.share()/<a download> are
// blocked by mobile browsers. Showing it in-place needs no gesture and no
// download permission — it always works.
const showImageOverlay = (dataUrl: string, filename: string): void => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px;overflow:auto;font-family:system-ui,sans-serif;';
  const hint = document.createElement('div');
  hint.style.cssText = 'color:#fff;font-size:15px;font-weight:700;text-align:center;max-width:92%;line-height:1.5;';
  hint.textContent = '📲 ចុចលើរូបឱ្យយូរ រួចជ្រើស «Save Image / រក្សាទុករូបភាព»';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = filename;
  img.style.cssText = 'max-width:100%;max-height:74vh;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.5);background:#fff;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
  const dl = document.createElement('a');
  dl.href = dataUrl; dl.download = filename; dl.textContent = '⬇ ទាញយក';
  dl.style.cssText = 'background:#0ea5e9;color:#fff;padding:9px 18px;border-radius:10px;font-weight:700;text-decoration:none;';
  const close = document.createElement('button');
  close.textContent = '✕ បិទ';
  close.style.cssText = 'background:#e2e8f0;color:#334155;padding:9px 18px;border-radius:10px;font-weight:700;border:0;cursor:pointer;';
  close.onclick = () => overlay.remove();
  row.appendChild(dl); row.appendChild(close);
  overlay.append(hint, img, row);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

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
// `fixedWidth` forces the captured element to that pixel width in the clone. The
// merit certificate is laid out entirely in container-query units (cqw), which
// html2canvas-pro 2.2 does NOT support: in its sandboxed clone the cqw container
// collapses to the narrow phone viewport, so the whole cert renders cramped into
// a strip. Pinning the element to a fixed wide px size makes cqw resolve to the
// full design size on every device, so the snapshot matches the on-screen cert.
let _h2cWarmed = false;
async function renderElementToCanvas(el: HTMLElement, fixedWidth?: number): Promise<HTMLCanvasElement> {
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
  const renderWidth = fixedWidth ?? Math.max(el.scrollWidth, el.offsetWidth, 800);
  const scale = Math.min(2.5, Math.max(1.5, 1500 / renderWidth));
  const options = {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    windowWidth: renderWidth,
    ...(fixedWidth ? { width: fixedWidth, windowWidth: fixedWidth } : {}),
    // On phones the report cards sit inside a FitToWidth transform:scale()
    // wrapper. html2canvas renders text at natural size but positions it with
    // the scaled coordinates → garbled overlap. Neutralise the wrapper in the
    // (sandboxed) clone so the card is captured at its full, un-scaled size.
    onclone: (doc: Document) => {
      // Pin the export root (and clear any maxWidth clamp above it) to the fixed
      // width so the cqw container resolves to full size — see note above.
      if (fixedWidth && el.id) {
        const root = doc.getElementById(el.id);
        if (root) {
          root.style.width = `${fixedWidth}px`;
          root.style.maxWidth = 'none';
          let p = root.parentElement;
          for (let i = 0; p && i < 5; i++, p = p.parentElement) { p.style.maxWidth = 'none'; }
        }
      }
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
  };

  // The FIRST capture after the page loads can come out mis-rendered: the Khmer
  // web fonts aren't yet present in html2canvas's sandboxed clone (and layout may
  // not have fully settled), so a freshly-opened card/cert exports wrong while a
  // SECOND attempt is correct. Prime it ONCE with a throwaway low-res render so the
  // first real export is already effectively a warmed "second" render.
  if (!_h2cWarmed) {
    _h2cWarmed = true;
    try { await html2canvas(el, { ...options, scale: 0.5 }); } catch { /* warm-up only */ }
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  return html2canvas(el, options);
}

// Render an element to a single-image PDF page (landscape if the snapshot is
// wider than tall). Rendering runs while this page is in the foreground; only
// after the file is ready do we hand it off (so iOS never pauses the render).
export async function exportElementToPdf(el: HTMLElement, filename: string, fixedWidth?: number): Promise<void> {
  const canvas = await renderElementToCanvas(el, fixedWidth);
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

// Render an element to a PNG data URL (base64) WITHOUT downloading it — used to
// hand a snapshot to the server (e.g. posting a timetable image to Telegram).
export async function renderElementToPngDataUrl(el: HTMLElement, fixedWidth?: number): Promise<string> {
  const canvas = await renderElementToCanvas(el, fixedWidth);
  return canvas.toDataURL('image/png');
}

// Build a MULTI-PAGE A4 PDF from a canvas (fit to page width, spilling onto more
// pages when tall).
function buildMultipagePdf(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width; // scaled height at full width
  const img = canvas.toDataURL('image/jpeg', 0.92);

  let heightLeft = imgH;
  let position = margin;
  pdf.addImage(img, 'JPEG', margin, position, imgW, imgH, undefined, 'FAST');
  heightLeft -= (pageH - margin * 2);
  while (heightLeft > 0) {
    position = margin - (imgH - heightLeft); // shift the tall image up on each page
    pdf.addPage();
    pdf.addImage(img, 'JPEG', margin, position, imgW, imgH, undefined, 'FAST');
    heightLeft -= (pageH - margin * 2);
  }
  return pdf;
}

// Render an element to a MULTI-PAGE A4 PDF and return it as a base64 data URL
// WITHOUT downloading — used to post a long report to the server (Telegram).
export async function renderElementToPdfDataUrl(el: HTMLElement, fixedWidth?: number): Promise<string> {
  return buildMultipagePdf(await renderElementToCanvas(el, fixedWidth)).output('datauristring');
}

// Render an element to a MULTI-PAGE A4 PDF and DOWNLOAD/open it — a reliable
// replacement for window.print() (which the app's fixed-height shell clips to one
// page). Rendering runs in the foreground, then the file is delivered.
export async function exportElementToMultipagePdf(el: HTMLElement, filename: string, fixedWidth?: number): Promise<void> {
  const pdf = buildMultipagePdf(await renderElementToCanvas(el, fixedWidth));
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  deliverBlob(pdf.output('blob'), name);
}

// Render an element to a downloadable PNG image (lossless — keeps Khmer text and
// the certificate frame crisp).
export async function exportElementToImage(el: HTMLElement, filename: string, fixedWidth?: number): Promise<void> {
  const canvas = await renderElementToCanvas(el, fixedWidth);
  const name = filename.endsWith('.png') ? filename : `${filename}.png`;
  // Phones: show the image in-app (long-press → Save Image). After the async
  // render the tap gesture is gone, so window.open()/<a download> are blocked.
  if (isMobile()) {
    showImageOverlay(canvas.toDataURL('image/png'), name);
    return;
  }
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('toBlob returned null');
  deliverBlob(blob, name);
}
