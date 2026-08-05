/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Download, X, Share, MoreVertical, PlusSquare, Loader2 } from 'lucide-react';

const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// In-app browsers (Telegram, Messenger, Facebook, Line…) can't install a PWA and
// never fire `beforeinstallprompt`, so the native dialog is impossible there — the
// parent must reopen the link in Chrome first. The school shares the Parent Portal
// link via Telegram, so this is the most common reason "install" isn't automatic.
const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp|Twitter|Snapchat|TikTok|Telegram/i.test(ua)
    || /;\s*wv\b|\bwv\)/.test(ua); // generic Android WebView (covers most in-app browsers)
};

// If the PWA is ALREADY installed, Chrome (Android) never fires beforeinstallprompt
// and its menu has no "Install app" — so both the native dialog AND the manual steps
// silently fail, which looks like "install is broken". getInstalledRelatedApps()
// (enabled by the manifest's related_applications self-reference) reports this so we
// can tell the parent the app is already on their phone instead of looping them.
const detectInstalled = async (): Promise<boolean> => {
  try {
    const fn = (navigator as any).getInstalledRelatedApps;
    if (typeof fn !== 'function') return false;
    const apps = await fn.call(navigator);
    return Array.isArray(apps) && apps.length > 0;
  } catch { return false; }
};

// An "Install app" button that ALWAYS shows (until the app is already installed).
// If the browser offers a native install prompt (Android/desktop Chrome) it fires
// that; otherwise — iOS, or Chrome not currently offering it — it shows step-by-step
// "Add to Home Screen" instructions, so the button is never a dead end.
// Chrome fires `beforeinstallprompt` a beat AFTER load, so a fast tap can arrive
// before it's captured. Poll `window.__deferredInstallPrompt` (and listen for the
// stash event) for a short window so the native dialog still opens automatically
// instead of jumping to the manual steps. Resolves null only if it never fires
// (in-app browser, already installed, or criteria unmet).
const waitForInstallPrompt = (ms: number): Promise<any> =>
  new Promise(resolve => {
    const existing = (window as any).__deferredInstallPrompt;
    if (existing) { resolve(existing); return; }
    let done = false;
    const finish = (v: any) => { if (done) return; done = true; window.removeEventListener('pwa-install-available', onAvail); resolve(v); };
    const onAvail = () => finish((window as any).__deferredInstallPrompt || null);
    window.addEventListener('pwa-install-available', onAvail);
    const start = Date.now();
    const tick = () => {
      if (done) return;
      const p = (window as any).__deferredInstallPrompt;
      if (p) return finish(p);
      if (Date.now() - start >= ms) return finish(null);
      setTimeout(tick, 150);
    };
    tick();
  });

export default function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  useEffect(() => {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }
    // Opened in a browser tab, but the app may still be installed — hide the button
    // if so (best effort; Chrome Android only) so we don't offer a dead install.
    detectInstalled().then(v => { if (v) setInstalled(true); });
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
    // Prefer a prompt we already have; otherwise wait briefly for it to fire so the
    // native dialog opens automatically (Chrome can dispatch it just after load).
    let prompt = deferred || (window as any).__deferredInstallPrompt;
    if (!prompt) {
      setWaiting(true);
      prompt = await waitForInstallPrompt(3000);
      setWaiting(false);
    }
    if (prompt) {
      try { await prompt.prompt(); await prompt.userChoice; } catch { /* dismissed */ }
      (window as any).__deferredInstallPrompt = null;
      setDeferred(null);
    } else {
      // No native prompt. Either it's already installed (tell them to open it) or the
      // steps must be done by hand (in-app browser / prompt cooldown).
      const inst = await detectInstalled();
      setAlreadyInstalled(inst);
      setShowHelp(true);
    }
  };

  const ios = isIOS();

  return (
    <>
      <button
        onClick={onClick}
        disabled={waiting}
        className={className || 'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-bold shadow-lg shadow-emerald-600/25'}
      >
        {waiting
          ? <><Loader2 size={16} className="animate-spin" /> កំពុងរៀបចំ...</>
          : <><Download size={16} /> ដំឡើងកម្មវិធី លើទូរស័ព្ទ</>}
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-3 text-left" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800">📲 ដំឡើងកម្មវិធីលើទូរស័ព្ទ</h3>
              <button onClick={() => setShowHelp(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {alreadyInstalled ? (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px] text-emerald-800 leading-relaxed">
                  <b>✅ កម្មវិធីត្រូវបានដំឡើងរួចហើយ</b> នៅលើទូរស័ព្ទរបស់អ្នក។ មិនចាំបាច់ដំឡើងម្ដងទៀតទេ។
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  សូម<b>បិទ browser នេះ</b> រួចបើកកម្មវិធីពី <b>home screen</b> (រករូបសាលា 🏫)។ បើចង់ដំឡើងឡើងវិញ សូមលុប (uninstall) កម្មវិធីចាស់ជាមុនសិន។
                </p>
              </div>
            ) : (<>
            {isInAppBrowser() && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800 leading-relaxed">
                <b>⚠️ សូមបើកក្នុង {ios ? 'Safari' : 'Chrome'} ជាមុនសិន។</b> អ្នកកំពុងបើកតំណនេះក្នុងកម្មវិធីផ្សេង (Telegram/Messenger…) ដែល<b>មិនអាចដំឡើងកម្មវិធីបានទេ</b>។ ចុច <b>Menu (⋮)</b> ខាងលើ រួចជ្រើស <b>«បើកក្នុង {ios ? 'Safari' : 'Chrome'} / Open in browser»</b> រួចសាកចុច «ដំឡើង» ម្តងទៀត។
              </div>
            )}
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
                <p className="text-[11px] text-slate-400 leading-relaxed">បើមិនឃើញ «Install app» — ប្រហែលកម្មវិធីដំឡើងរួចហើយ (បើកពី home screen) ឬសម្អាត cache រួចសាកម្តងទៀត។</p>
              </>
            )}
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
