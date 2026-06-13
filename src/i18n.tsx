/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight bilingual (Khmer / English) helper. Wrap the app in <LangProvider>,
 * read text with const { t } = useT(); t('some.key'), and toggle with <LanguageToggle/>.
 * The chosen language is kept in localStorage. Add new strings to TRANSLATIONS below —
 * a missing key falls back to the key string so nothing crashes.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type Lang = 'km' | 'en';

// key -> { km, en }. Grow this map as more of the UI is translated.
export const TRANSLATIONS: Record<string, { km: string; en: string }> = {
  // Main navigation
  'nav.dashboard': { km: 'គ្រប់គ្រងព័ត៌មានទូទៅ', en: 'Dashboard' },
  'nav.gradebook': { km: 'គ្រប់គ្រងពិន្ទុសិស្ស', en: 'Student Scores' },
  'nav.attendance': { km: 'គ្រប់គ្រងវត្តមាន', en: 'Attendance' },
  'nav.classMgmt': { km: 'គ្រប់គ្រងថ្នាក់ និងសិស្ស', en: 'Classes & Students' },
  'nav.reports': { km: 'គ្រប់គ្រងរបាយការណ៍', en: 'Reports' },
  'nav.mobile': { km: 'ទិដ្ឋភាពទូរស័ព្ទ VIP (Mobile UI)', en: 'Mobile View (VIP)' },
  // Common
  'common.school': { km: 'សាលាសហគមន៍ច្បារច្រុះ', en: 'Chbar Chros Community School' },
  'lang.toggle': { km: 'English', en: 'ខ្មែរ' },
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<LangCtx>({ lang: 'km', setLang: () => {}, t: (k) => k });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('app_lang') as Lang) === 'en' ? 'en' : 'km'; } catch { return 'km'; }
  });
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('app_lang', l); } catch { /* ignore */ }
  }, []);
  const t = useCallback((key: string) => {
    const e = TRANSLATIONS[key];
    return e ? e[lang] : key;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

// A small pill button that flips between Khmer and English.
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'km' ? 'en' : 'km')}
      title="Change language / ប្តូរភាសា"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${className}`}
    >
      <span>🌐</span>
      <span>{lang === 'km' ? 'EN' : 'ខ្មែរ'}</span>
    </button>
  );
}
