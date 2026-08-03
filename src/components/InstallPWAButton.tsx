/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// A self-contained "Install app" button. On Android/desktop Chrome it captures the
// `beforeinstallprompt` event and, when tapped, shows the native install dialog —
// so users don't have to hunt through Chrome's menu (which hides the option for a
// while after an uninstall). Renders nothing on iOS (no programmatic install there)
// or when the app is already installed/running standalone.
export default function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
    if (standalone) { setHidden(true); return; }
    // The event may have fired (and been stashed by index.html) before this mounted.
    const stashed = (window as any).__deferredInstallPrompt;
    if (stashed) setDeferred(stashed);
    const onAvailable = () => setDeferred((window as any).__deferredInstallPrompt || null);
    const onPrompt = (e: Event) => { e.preventDefault(); (window as any).__deferredInstallPrompt = e; setDeferred(e); };
    const onInstalled = () => { setHidden(true); setDeferred(null); };
    window.addEventListener('pwa-install-available', onAvailable);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', onAvailable);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    try { await deferred.prompt(); await deferred.userChoice; } catch { /* dismissed */ }
    (window as any).__deferredInstallPrompt = null;
    setDeferred(null);
  };

  return (
    <button
      onClick={install}
      className={className || 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/25'}
    >
      <Download size={16} /> ដំឡើងកម្មវិធី លើទូរស័ព្ទ
    </button>
  );
}
