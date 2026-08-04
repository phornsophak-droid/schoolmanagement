/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Download, X, Share, MoreVertical, PlusSquare } from 'lucide-react';

const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// An "Install app" button that ALWAYS shows (until the app is already installed).
// If the browser offers a native install prompt (Android/desktop Chrome) it fires
// that; otherwise — iOS, or Chrome not currently offering it — it shows step-by-step
// "Add to Home Screen" instructions, so the button is never a dead end.
export default function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }
    const stashed = (window as any).__deferredInstallPrompt;
    if (stashed) setDeferred(stashed);
    const onAvailable = () => setDeferred((window as any).__deferredInstallPrompt || null);
    const onPrompt = (e: Event) => { e.preventDefault(); (window as any).__deferredInstallPrompt = e; setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setShowHelp(false); };
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

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      try { await deferred.prompt(); await deferred.userChoice; } catch { /* dismissed */ }
      (window as any).__deferredInstallPrompt = null;
      setDeferred(null);
    } else {
      setShowHelp(true); // no native prompt available → show manual steps
    }
  };

  const ios = isIOS();

  return (
    <>
      <button
        onClick={onClick}
        className={className || 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/25'}
      >
        <Download size={16} /> ដំឡើងកម្មវិធី លើទូរស័ព្ទ
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-3 text-left" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800">📲 ដំឡើងកម្មវិធីលើទូរស័ព្ទ</h3>
              <button onClick={() => setShowHelp(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {ios ? (
              <>
                <p className="text-xs text-slate-500">នៅលើ iPhone/iPad សូមប្រើ <b>Safari</b>៖</p>
                <ol className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><Share size={18} className="text-sky-600 shrink-0 mt-0.5" /> <span>ចុចប៊ូតុង <b>Share (ចែករំលែក)</b> ខាងក្រោម</span></li>
                  <li className="flex items-start gap-2"><PlusSquare size={18} className="text-emerald-600 shrink-0 mt-0.5" /> <span>រំកិលចុះ រួចចុច <b>«Add to Home Screen»</b></span></li>
                  <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span> <span>ចុច <b>«Add»</b> → រូបសាលានឹងបង្ហាញលើ home screen</span></li>
                </ol>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">នៅលើ Android សូមប្រើ <b>Chrome</b>៖</p>
                <ol className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><MoreVertical size={18} className="text-slate-600 shrink-0 mt-0.5" /> <span>ចុច <b>Menu (⋮)</b> ជ្រុងខាងលើស្តាំ</span></li>
                  <li className="flex items-start gap-2"><PlusSquare size={18} className="text-emerald-600 shrink-0 mt-0.5" /> <span>ចុច <b>«Install app»</b> ឬ <b>«Add to Home screen»</b></span></li>
                  <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold shrink-0">✓</span> <span>បញ្ជាក់ → រូបសាលានឹងបង្ហាញលើ home screen</span></li>
                </ol>
                <p className="text-[11px] text-slate-400 leading-relaxed">បើមិនឃើញ «Install app» — សូមចេញ App ចាស់ (uninstall) សិន ឬសម្អាត cache រួចសាកម្តងទៀត។</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
