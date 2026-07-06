/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Convert a DOM element to an EDITABLE Word (.doc) file. Word (and Google Docs)
// opens HTML documents saved with a .doc extension; we clone the on-screen report
// and inline its computed styles so the tables / fonts / colours carry over
// reasonably well — unlike the PDF, the teacher can then edit it.

const STYLE_PROPS = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color',
  'text-align', 'vertical-align', 'border-collapse',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'width', 'line-height', 'white-space',
];

// Copy each source node's computed style onto the matching clone node as inline
// CSS (Word has no access to the app's Tailwind stylesheet).
function inlineStyles(src: Element, dst: Element): void {
  const cs = window.getComputedStyle(src as HTMLElement);
  let style = '';
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') style += `${p}:${v};`;
  }
  if (style) (dst as HTMLElement).setAttribute('style', style);
  const sc = src.children, dc = dst.children;
  for (let i = 0; i < sc.length && i < dc.length; i++) inlineStyles(sc[i], dc[i]);
}

// UTF-8-safe base64 (Khmer text) for a browser.
const b64utf8 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export function elementToWordDataUrl(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  // Screen-only chrome (buttons, etc.) shouldn't appear in the document.
  clone.querySelectorAll('.rc-no-print').forEach(n => n.remove());
  try { inlineStyles(el, clone); } catch { /* best effort — unstyled still opens */ }
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8">' +
    '<style>body{font-family:"Khmer OS","Kantumruy Pro",sans-serif;} table{border-collapse:collapse;} td,th{border:1px solid #444;}</style>' +
    '</head><body>' + clone.outerHTML + '</body></html>';
  return 'data:application/msword;base64,' + b64utf8(html);
}
