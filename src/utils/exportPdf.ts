/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
// html2canvas-pro (maintained fork) supports modern CSS colour functions like
// oklch(), which Tailwind v4 emits. The original html2canvas 1.x throws on oklch
// → every report-card / certificate PDF export failed.
import html2canvas from 'html2canvas-pro';

// Fixed render width for the monthly WORK reports so the PDF looks the same on
// every device. Without it the capture uses the element's on-screen width, so a
// report submitted from a phone came out narrow and cramped while a desktop one
// was wide. Pinning to this width makes kindergarten match the general classes.
export const REPORT_PDF_WIDTH = 850;

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
  // Canvas-Y positions where a new PDF page must start — measured in the clone
  // (see onclone) from elements marked `.rc-page-break`. buildMultipagePdf honours
  // them so a section can be forced onto a fresh page.
  const breaks: number[] = [];
  // Canvas-Y ranges of blocks that must NOT be split across a page (a question +
  // its answer options), measured from `.rc-keep` elements. buildMultipagePdf pulls
  // a page cut up to a block's top rather than slicing through it.
  const keeps: { top: number; bottom: number }[] = [];
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
      // Open up every SCROLLABLE ancestor of the export root. On mobile the shell
      // mounts panels inside a capped scroll box (e.g. max-h-[620px] overflow-y-auto),
      // and capturing through it clipped the output to the visible slice — the
      // phone's "send to Telegram" came out cut/blank. Same idea as the @media print
      // rule, but applied in the clone so it also covers html2canvas.
      if (el.id) {
        const root = doc.getElementById(el.id);
        let p = root?.parentElement;
        for (let i = 0; p && i < 12; i++, p = p.parentElement) {
          p.style.maxHeight = 'none';
          p.style.height = 'auto';
          p.style.overflow = 'visible';
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

      // Replace <input>/<textarea> with a styled <div> holding the same value.
      // html2canvas draws form controls through a simplified text path that does
      // NOT shape Khmer complex script — subscripts/coeng are dropped and vowels
      // reorder, so a filled report (e.g. the health report) came out with "half
      // the letters missing". Static <div>s render through the normal, correctly
      // shaped text path. Original and clone field order match (structural copy),
      // so we read each live value by index.
      try {
        const cloneRoot = (el.id && doc.getElementById(el.id)) || doc.body;
        const orig = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
        const clones = cloneRoot.querySelectorAll<HTMLElement>('input, textarea');
        clones.forEach((cf, i) => {
          const of = orig[i];
          if (!of) return;
          const cs = window.getComputedStyle(of);
          const isArea = of.tagName === 'TEXTAREA';
          const box = doc.createElement('div');
          box.textContent = of.value || '';
          box.style.fontFamily = cs.fontFamily;
          box.style.fontSize = cs.fontSize;
          box.style.fontWeight = cs.fontWeight;
          box.style.lineHeight = cs.lineHeight;
          box.style.color = cs.color;
          box.style.textAlign = cs.textAlign;
          box.style.padding = cs.padding;
          box.style.boxSizing = 'border-box';
          box.style.maxWidth = '100%';
          if (isArea) {
            box.style.display = 'block';
            box.style.width = cs.width;
            box.style.minHeight = cs.height;
            box.style.border = cs.border;
            box.style.borderRadius = cs.borderRadius;
            box.style.whiteSpace = 'pre-wrap';
            box.style.wordBreak = 'break-word';
          } else if (of.closest('td, th')) {
            // A field that fills a TABLE CELL: let it WRAP within the column. With
            // nowrap a long value forced the column (and the whole table) wider than
            // the page, so text overflowed and the last column fell off. No
            // min-width here so the column keeps its natural share.
            box.style.display = 'block';
            box.style.width = '100%';
            box.style.whiteSpace = 'pre-wrap';
            box.style.wordBreak = 'break-word';
            box.style.borderBottom = cs.borderBottom;
          } else {
            // Inline fill-in-the-blank: keep the underline width, but WRAP (not
            // nowrap) so a long value never pushes the layout wider than the page.
            box.style.display = 'inline-block';
            box.style.minWidth = cs.width;
            box.style.borderBottom = cs.borderBottom;
            box.style.whiteSpace = 'normal';
            box.style.wordBreak = 'break-word';
            box.style.verticalAlign = 'baseline';
          }
          cf.parentNode?.replaceChild(box, cf);
        });
      } catch { /* fall back to native field rendering */ }

      // Measure forced page-break positions (AFTER the field swaps above, so the
      // layout is final). Each `.rc-page-break` element's top → canvas Y = its
      // offset from the export root × scale.
      try {
        const root = el.id ? doc.getElementById(el.id) : null;
        if (root) {
          const rootTop = root.getBoundingClientRect().top;
          root.querySelectorAll<HTMLElement>('.rc-page-break').forEach(n => {
            const y = (n.getBoundingClientRect().top - rootTop) * scale;
            if (y > 1) breaks.push(y);
          });
          // Keep-together blocks (a question + its options must stay on one page).
          root.querySelectorAll<HTMLElement>('.rc-keep').forEach(n => {
            const r = n.getBoundingClientRect();
            const top = (r.top - rootTop) * scale;
            const bottom = (r.bottom - rootTop) * scale;
            if (bottom > top) keeps.push({ top, bottom });
          });
        }
      } catch { /* no forced breaks — whitespace slicing still applies */ }
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
  breaks.length = 0; keeps.length = 0; // discard warm-up measurements; keep the real render's
  const canvas = await html2canvas(el, options);
  (canvas as any).__pageBreaks = breaks.slice();
  (canvas as any).__keepBlocks = keeps.slice();
  return canvas;
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

// Render a full self-contained HTML document string to a PNG data URL — used to
// turn the SAME polished report HTML we print to PDF into an image (so a Telegram
// photo matches the PDF exactly). Rendered inside an off-screen iframe so the
// report's global CSS (bare table/th/td/body selectors) can't leak into the app.
export async function renderHtmlToPngDataUrl(html: string, width = 820): Promise<string> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:10px;border:0;background:#fff;`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    try { await (doc as any).fonts?.ready; } catch { /* fonts API absent */ }
    // Wait for images (e.g. the school logo) so they aren't blank in the capture.
    await new Promise<void>(resolve => {
      const imgs = Array.from(doc.images || []);
      if (imgs.length === 0) { resolve(); return; }
      let pending = imgs.length;
      const done = () => { if (--pending <= 0) resolve(); };
      imgs.forEach(im => { if (im.complete) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); } });
      setTimeout(resolve, 4000); // safety net
    });
    await new Promise(r => setTimeout(r, 80));
    const body = doc.body;
    const height = Math.max(body.scrollHeight, doc.documentElement.scrollHeight);
    iframe.style.height = `${height}px`;
    const canvas = await html2canvas(body, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
      width, windowWidth: width, height, windowHeight: height,
    });
    return canvas.toDataURL('image/png');
  } finally {
    iframe.remove();
  }
}

// Build a MULTI-PAGE A4 PDF from a canvas (fit to page width, spilling onto more
// pages when tall). Each page is a freshly-cropped slice of the source canvas, and
// the cut line is nudged UP to a blank (whitespace) row so a line of text is never
// sliced in half at the page boundary ("អក្សរនៅជាកន្លែងខណ្ឌទំព័រ"). Falls back to a
// plain fixed-height slice if the pixels can't be read.
function buildMultipagePdf(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const imgW = pageW - margin * 2;
  const cw = canvas.width;
  const ch = canvas.height;
  const ptPerPx = imgW / cw;
  const pageContentPx = Math.max(1, Math.floor((pageH - margin * 2) / ptPerPx)); // canvas px per page

  // Single readback of the pixels so we can look for whitespace cut lines.
  let pixels: Uint8ClampedArray | null = null;
  try { pixels = canvas.getContext('2d')!.getImageData(0, 0, cw, ch).data; } catch { pixels = null; }
  // Fraction of "ink" (non-white) pixels in a row. A blank gap ≈ 0; a table cell's
  // interior is tiny (just the vertical borders); a line of text is high. We cut at
  // the emptiest row so text/rows are never sliced — crucially this also works for
  // TABLES, whose every row has vertical borders and so is never fully blank.
  const rowInk = (y: number): number => {
    if (!pixels) return 0;
    const step = Math.max(2, Math.floor(cw / 400)); // ~400 samples across the row
    let ink = 0, samples = 0;
    for (let x = 0; x < cw; x += step) {
      samples++;
      const i = (y * cw + x) * 4;
      if (pixels[i + 3] < 8) continue; // transparent
      if (pixels[i] < 210 || pixels[i + 1] < 210 || pixels[i + 2] < 210) ink++; // ink
    }
    return samples ? ink / samples : 0;
  };

  // Forced page breaks (canvas Y) from `.rc-page-break` elements — a section that
  // must start on a fresh page. Ignore any within the top 8% of a page (already
  // near the top, so no break needed).
  const forced = (((canvas as any).__pageBreaks as number[]) || []).filter(b => b > 0 && b < ch).sort((a, b) => a - b);
  // Keep-together blocks (question + its options) — never slice through one.
  const keeps = (((canvas as any).__keepBlocks as { top: number; bottom: number }[]) || []);

  const tmp = document.createElement('canvas');
  const tctx = tmp.getContext('2d')!;
  let sy = 0;
  let first = true;
  let guard = 0;
  while (sy < ch && guard++ < 400) {
    let sliceH = Math.min(pageContentPx, ch - sy);
    // A forced break inside this page wins: cut there so that section starts the
    // next page. (Skip breaks in the top 8% — the section already sits near the top.)
    const fb = forced.find(b => b > sy + pageContentPx * 0.08 && b <= sy + sliceH);
    if (fb !== undefined) {
      sliceH = fb - sy;
    } else if (sy + sliceH < ch && pixels) {
      // Otherwise back the cut up to the EMPTIEST row in the lower half of the page
      // (keep >= 50%), so a line of text / table row is never sliced through.
      const minH = Math.floor(sliceH * 0.5);
      let bestY = sy + sliceH, bestInk = Infinity;
      for (let y = sy + sliceH; y > sy + minH; y--) {
        const ink = rowInk(y);
        if (ink < bestInk) { bestInk = ink; bestY = y; if (ink === 0) break; }
      }
      sliceH = bestY - sy;
    }
    // If the chosen cut would slice THROUGH a keep-together block (a question and
    // its options), pull the cut up to that block's top so the whole block moves to
    // the next page. Skip if that would leave a nearly-empty page (block taller than
    // a page → unavoidable split).
    if (sy + sliceH < ch) {
      // Cut a little ABOVE the block's top so the next page starts with a small
      // blank strip — Khmer upper vowels/diacritics render slightly above the box
      // top and would otherwise be clipped ("អក្សរដាច់សក់") at the page start.
      const pad = Math.round(pageContentPx * 0.02);
      let cut = sy + sliceH;
      for (const k of keeps) {
        if (k.top > sy + 2 && k.top < cut && k.bottom > cut) cut = Math.min(cut, k.top - pad);
      }
      const newH = cut - sy;
      if (newH > 0 && newH < sliceH && newH > pageContentPx * 0.15) sliceH = newH;
    }
    tmp.width = cw;
    tmp.height = sliceH;
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, cw, sliceH);
    tctx.drawImage(canvas, 0, sy, cw, sliceH, 0, 0, cw, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceH * ptPerPx, undefined, 'FAST');
    first = false;
    sy += sliceH;
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
