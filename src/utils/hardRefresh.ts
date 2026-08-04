/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Force the very latest version: clear the PWA caches, unregister the service
// worker, then reload with a cache-busting param. On installed / PWA phones a
// stale cached build otherwise keeps hiding new deploys (a recurring problem),
// so a one-tap "hard refresh" fixes it without the user digging through browser
// settings. The current URL params (e.g. ?parent) are preserved.
export async function hardRefresh(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch { /* ignore */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch { /* ignore */ }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now())); // bust the HTTP cache
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}
