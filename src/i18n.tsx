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
  'common.month': { km: 'ខែ', en: 'Month' },
  'common.class': { km: 'ថ្នាក់', en: 'Class' },
  'common.classroom': { km: 'ថ្នាក់រៀន', en: 'Class' },
  'common.persons': { km: 'នាក់', en: 'students' },
  'common.personDays': { km: 'នាក់-ដង', en: 'student-days' },
  'common.female': { km: 'ស្រី', en: 'Female' },
  'common.male': { km: 'ប្រុស', en: 'Male' },
  'common.total': { km: 'សរុប', en: 'Total' },
  'common.day': { km: 'ថ្ងៃ', en: 'Day' },
  'common.year': { km: 'ឆ្នាំ', en: 'Year' },
  'common.daily': { km: 'ប្រចាំថ្ងៃ', en: 'Daily' },
  'common.monthly': { km: 'ប្រចាំខែ', en: 'Monthly' },
  'common.yearly': { km: 'ប្រចាំឆ្នាំ', en: 'Yearly' },
  'common.action': { km: 'សកម្មភាព', en: 'Action' },
  'common.gender': { km: 'ភេទ', en: 'Gender' },
  'common.studentName': { km: 'ឈ្មោះសិស្ស', en: 'Student Name' },
  'common.reason': { km: 'មូលហេតុ', en: 'Reason' },
  'common.latest': { km: 'ថ្មីបំផុត', en: 'Latest' },
  'common.copies': { km: 'ច្បាប់', en: 'copies' },
  'common.classesUnit': { km: 'ថ្នាក់', en: 'classes' },

  // Dashboard
  'dash.cat.general': { km: '📘 ថ្នាក់ចំណេះទូទៅ', en: '📘 General Classes' },
  'dash.cat.generalHint': { km: '(មត្តេយ្យ–ទី៦)', en: '(KG–Grade 6)' },
  'dash.cat.extra': { km: '🎨 ថ្នាក់ក្រៅម៉ោង', en: '🎨 After-hours Classes' },
  'dash.cat.extraHint': { km: '(ភាសា/គំនូរ/កុំព្យូទ័រ...)', en: '(Language/Art/Computer...)' },
  'dash.title': { km: 'ផ្ទាំងគ្រប់គ្រងទិន្នន័យទូទៅ', en: 'Overview Dashboard' },
  'dash.subtitle': { km: 'សូមជ្រើសរើស ខែ ឬ ថ្នាក់សិក្សា ដើម្បីពិនិត្យស្ថិតិលម្អិត', en: 'Choose a month or class to view detailed statistics' },
  'dash.toGradebook': { km: 'ទំព័រពិន្ទុសិស្ស', en: 'Student Scores' },
  'dash.createReport': { km: 'បង្កើតរបាយការណ៍ថ្មី', en: 'New Report' },
  'dash.kpi.reports': { km: 'របាយការណ៍សរុប', en: 'Total Reports' },
  'dash.kpi.reportsSub': { km: 'ដែលបានរក្សាទុកក្នុងប្រព័ន្ធ', en: 'Saved in the system' },
  'dash.kpi.students': { km: 'សិស្សសរុបរួម', en: 'Total Students' },
  'dash.att.summary': { km: 'របាយការណ៍សង្ខេបវត្តមាន', en: 'Attendance Summary' },
  'dash.att.studentAtt': { km: 'វត្តមានសិស្ស', en: 'Student Attendance' },
  'dash.att.downloadPdf': { km: 'ទាញយករបាយការណ៍ (PDF)', en: 'Download Report (PDF)' },
  'dash.att.manageNow': { km: 'គ្រប់គ្រងវត្តមានឥឡូវនេះ', en: 'Manage Attendance Now' },
  'dash.att.rate': { km: 'អត្រាវត្តមានសរុប', en: 'Overall Attendance Rate' },
  'dash.att.present': { km: 'សិស្សមានវត្តមាន', en: 'Present' },
  'dash.att.permission': { km: 'សិស្សមានច្បាប់', en: 'Excused' },
  'dash.att.absent': { km: 'អវត្តមានគ្មានច្បាប់', en: 'Unexcused Absent' },
  'dash.att.recordsByClass': { km: '📜 កំណត់ត្រាវត្តមានតាមថ្នាក់', en: '📜 Attendance Records by Class' },
  'dash.att.present2': { km: 'មានវត្តមាន', en: 'Present' },
  'dash.att.permission2': { km: 'ច្បាប់', en: 'Excused' },
  'dash.att.absent2': { km: 'អវត្តមាន', en: 'Absent' },
  'dash.att.rate2': { km: 'អត្រាវត្តមាន', en: 'Att. Rate' },
  'dash.att.review': { km: 'ពិនិត្យឡើងវិញ', en: 'Review' },
  'dash.att.dataForPeriod': { km: 'ទិន្នន័យសម្រាប់រយៈពេលដែលបានជ្រើស', en: 'Data for the selected period' },
  'dash.att.morning': { km: '🌅 ព្រឹក', en: '🌅 AM' },
  'dash.att.afternoon': { km: '🌇 រសៀល', en: '🌇 PM' },
  'dash.att.allday': { km: '📅 ប្រចាំថ្ងៃ', en: '📅 All day' },
  'dash.absent.title': { km: 'តារាងសិស្សអវត្តមានប្រចាំថ្ងៃ', en: 'Daily Absentee List' },
  'dash.absent.tag': { km: 'បញ្ជីសិស្សអវត្តមាន', en: 'Absentee List' },
  'dash.absent.downloadDaily': { km: 'ទាញយករបាយការណ៍ប្រចាំថ្ងៃ (PDF)', en: 'Download Daily Report (PDF)' },
  'dash.absent.lateTotal': { km: 'យឺតសរុប', en: 'Total Late' },
  'dash.absent.permTotal': { km: 'ច្បាប់សរុប', en: 'Total Excused' },
  'dash.absent.absTotal': { km: 'អត់ច្បាប់សរុប', en: 'Total Unexcused' },
  'dash.absent.totalAbs': { km: 'អវត្តមានសរុប', en: 'Total Absences' },
  'dash.reasons.tag': { km: 'ស្ថិតិមូលហេតុ', en: 'Reason Statistics' },
  'dash.reasons.title': { km: 'មូលហេតុនៃការអវត្តមានសិស្ស', en: 'Reasons for Student Absence' },
  'dash.reports.saved': { km: 'បញ្ជីរបាយការណ៍ដែលបានរក្សាទុក', en: 'Saved Reports' },
  'dash.reports.savedSub': { km: 'របាយការណ៍ប្រចាំខែផ្លូវការរបស់គ្រូបន្ទុកថ្នាក់', en: 'Official monthly reports by class teachers' },
  'common.no': { km: 'ល.រ', en: 'No.' },
  'common.details': { km: 'ព័ត៌មានលម្អិត', en: 'Details' },
  'dash.absent.hLate': { km: 'សរុបយឺត', en: 'Total Late' },
  'dash.absent.hPerm': { km: 'សរុបច្បាប់', en: 'Total Excused' },
  'dash.absent.hAbs': { km: 'សរុបអត់ច្បាប់', en: 'Total Unexcused' },
  'dash.absent.hTotAbs': { km: 'សរុបអវត្តមាន', en: 'Total Absences' },
  'dash.absent.hToday': { km: 'ស្ថានភាពថ្ងៃនេះ', en: "Today's Status" },
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
