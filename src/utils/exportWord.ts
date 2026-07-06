/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Build an editable-container Word (.doc) file that PRESERVES the report's exact
// layout by embedding a rendered snapshot as a full-width image. Word (and Google
// Docs) opens HTML documents saved with a .doc extension and supports inline
// base64 images — so the on-screen design carries over pixel-for-pixel, unlike an
// HTML/CSS conversion which Word mangles into boxes.

// UTF-8-safe base64 (the wrapper is ASCII, but keep it consistent/robust).
const b64utf8 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export function imageToWordDataUrl(pngDataUrl: string): string {
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8">' +
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
    '<style>@page{size:A4 portrait;margin:1cm;} body{margin:0;}</style></head>' +
    `<body><img src="${pngDataUrl}" style="width:100%;height:auto;display:block;"/></body></html>`;
  return 'data:application/msword;base64,' + b64utf8(html);
}
