/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Downscale an uploaded image to a compact JPEG data URL. Phone-photographed
// signatures are often 1–3 MB; stored raw they bloat localStorage and can exceed
// the cloud request-size limit, so the save fails and the change "doesn't stick".
// Signatures are shown with mix-blend-multiply (white background drops out), so a
// white-backed JPEG is fine and far smaller than the original.
export function downscaleImageFile(file: File, maxDim = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image decode failed'));
      img.onload = () => {
        const longest = Math.max(img.width, img.height) || 1;
        const scale = Math.min(1, maxDim / longest);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(String(reader.result)); return; } // fall back to the raw data URL
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
