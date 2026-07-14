/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Extract plain text from an uploaded lesson file (.txt / .docx / .pdf) so it can
// be stored in the Lesson Library and used as the AI worksheet source. Parsers are
// dynamically imported, so they only load when a teacher actually uploads a file
// (no main-bundle bloat). Scanned/image-only PDFs have no text layer → return ''.

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer });
  return (res.value || '').trim();
}

// Convert a .docx to HTML, PRESERVING structure (paragraphs, tables, bold, lists)
// so an imported exam keeps its original layout — only its header gets swapped.
export async function extractDocxHtml(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const res = await mammoth.convertToHtml({ arrayBuffer });
  return (res.value || '').trim();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  // @ts-ignore - Vite resolves the worker to a URL string
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Reconstruct visual LINES: group items by their baseline Y (transform[5]),
    // then order each line left→right by X. Without this every page collapsed onto
    // one line and question numbers (which the parser keys on) were lost.
    const rows: { y: number; items: { x: number; s: string }[] }[] = [];
    for (const it of content.items as any[]) {
      const s = it.str;
      if (!s) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) <= 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, s });
    }
    rows.sort((a, b) => b.y - a.y); // PDF Y grows upward → top line first
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      const line = r.items.map(it => it.s).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
    lines.push(''); // blank line between pages
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Returns the extracted text. Throws a Khmer-readable error for unsupported files.
export async function extractTextFromFile(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.csv') || file.type.startsWith('text/')) {
    return (await file.text()).trim();
  }
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.doc')) {
    throw new Error('ឯកសារ .doc ចាស់មិនទ្រទ្រង់ — សូមរក្សាទុកជា .docx ឬ .pdf សិន។');
  }
  throw new Error('ប្រភេទឯកសារមិនទ្រទ្រង់ — សូមប្រើ .pdf, .docx, ឬ .txt។');
}
