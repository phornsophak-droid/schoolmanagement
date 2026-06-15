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

  // Class & Student Management
  'cls.stat.classes': { km: 'ថ្នាក់រៀនសរុប', en: 'Total Classes' },
  'cls.stat.students': { km: 'សិស្សសរុប', en: 'Total Students' },
  'cls.stat.female': { km: 'សិស្សស្រី', en: 'Female Students' },
  'cls.stat.male': { km: 'សិស្សប្រុស', en: 'Male Students' },
  'cls.tab.students': { km: '👤 បញ្ជីឈ្មោះ និងគ្រប់គ្រងសិស្ស', en: '👤 Student Roster' },
  'cls.tab.classes': { km: '📚 គ្រប់គ្រងថ្នាក់រៀន', en: '📚 Manage Classes' },
  'cls.form.newClass': { km: 'បង្កើតថ្នាក់រៀនថ្មី', en: 'Create New Class' },
  'cls.form.className': { km: 'ឈ្មោះថ្នាក់រៀន', en: 'Class Name' },
  'cls.form.addClass': { km: 'បន្ថែមថ្នាក់រៀន', en: 'Add Class' },
  'cls.currentClasses': { km: 'បញ្ជីថ្នាក់រៀនបច្ចុប្បន្ន', en: 'Current Classes' },
  'cls.io.title': { km: 'ការទាញយក និង បញ្ចូលបញ្ជីឈ្មោះសិស្ស (Excel .csv)', en: 'Export & Import Student List (Excel .csv)' },
  'cls.io.downloadList': { km: 'ទាញយកតារាងឈ្មោះ', en: 'Download List' },
  'cls.io.import': { km: 'នាំចូលពីកុំព្យូទ័រ', en: 'Import from Computer' },
  'cls.io.downloadTemplate': { km: 'ទាញយកគំរូ Excel (.csv)', en: 'Download Template (.csv)' },
  'cls.addSample': { km: '💡 បន្ថែមសិស្សគំរូ', en: '💡 Add Sample Students' },
  'cls.search': { km: 'ស្វែងរកតាមឈ្មោះ...', en: 'Search by name...' },
  'cls.teacherInfo': { km: 'ព័ត៌មានគ្រូ ឬ គ្រូបន្ទុកថ្នាក់', en: 'Teacher / Class Teacher Info' },
  'cls.classStats': { km: 'ស្ថិតិ និង ព័ត៌មានថ្នាក់រៀន', en: 'Class Statistics & Info' },
  'cls.col.class': { km: 'ថ្នាក់សិក្សា', en: 'Class' },
  'cls.col.status': { km: 'ស្ថានភាព', en: 'Status' },
  'cls.col.group': { km: 'ក្រុម', en: 'Group' },
  'cls.status.normal': { km: 'ធម្មតា', en: 'Normal' },
  'cls.status.slow': { km: 'រៀនយឺត', en: 'Slow learner' },
  'cls.status.dropout': { km: 'បោះបង់', en: 'Dropped out' },
  'cls.form.group': { km: 'ក្រុម (Group)', en: 'Group' },
  'cls.totalStudents': { km: 'ចំនួនសិស្សសរុប៖', en: 'Total Students:' },
  'cls.allClasses': { km: 'គ្រប់ថ្នាក់ទាំងអស់', en: 'All Classes' },
  'cls.groupLabel': { km: 'ក្រុម៖', en: 'Group:' },
  'cls.allGroups': { km: 'គ្រប់ក្រុម', en: 'All Groups' },
  'cls.footFemale': { km: 'ស្រី (F)', en: 'Female (F)' },
  'cls.footMale': { km: 'ប្រុស (M)', en: 'Male (M)' },
  'cls.readonly.title': { km: 'សិទ្ធិមើលបញ្ជីឈ្មោះតែប៉ុណ្ណោះ (Read-Only Mode)', en: 'View-only access (Read-Only Mode)' },
  'cls.classTeacher': { km: '«គ្រូបន្ទុកថ្នាក់»', en: '"Class Teacher"' },
  'cls.principal': { km: '«នាយកសាលា»', en: '"Principal"' },
  'cls.allowed': { km: '💡 អនុញ្ញាត៖', en: '💡 Allowed:' },
  'cls.readonly.desc': { km: 'លោកអ្នកអាចចូលទៅកាន់ផ្ចាំ «សៀវភៅពិន្ទុ» ដើម្បីបំពេញពិន្ទុសិស្ស ឬ «របាយការណ៍វេទមន្ត» ដើម្បីបញ្ចូលនិងកែសម្រួលរបាយការណ៍សិក្សា។', en: 'You can open "Gradebook" to enter student scores, or "Report Wizard" to add and edit study reports.' },
  'cls.classNameHelp': { km: 'ឈ្មោះថ្នាក់ដែលបង្កើតរួច នឹងអាចជ្រើសរើសបាននៅគ្រប់ផ្នែកទាំងអស់នៃកម្មវិធី រួមមានសៀវភៅពិន្ទុ និងរបាយការណ៍សាលា។', en: 'Created class names become selectable everywhere in the app, including the gradebook and school reports.' },
  'cls.classroomMode': { km: 'សិទ្ធិគ្រប់គ្រងសិស្សថ្នាក់រៀនផ្ទាល់ខ្លួន (Classroom Management Mode)', en: 'Manage your own classroom students (Classroom Management Mode)' },
  'cls.importHint': { km: '💡 គន្លឹះ៖ ដើម្បីនាំចូលបានត្រឹមត្រូវ សូមប្រាកដថាជួរឈរមានទម្រង់ (ល.រ, ឈ្មោះសិស្ស, ភេទ, ថ្នាក់, ស្ថានភាព)។', en: '💡 Tip: For a correct import, ensure the columns follow the format (No., Student Name, Gender, Class, Status).' },
  'cls.academicYear': { km: 'ឆ្នាំសិក្សា / Academic Year:', en: 'Academic Year:' },
  'cls.org': { km: 'អង្គការ / ស្ថាប័ន៖', en: 'Organization:' },
  'cls.orgName': { km: 'អង្គការមូលនិធិដើម្បីកុមារកម្ពុជា (ខេមឃីត)', en: "Cambodian Children's Charity (CamKids)" },
  'cls.teacherNameLabel': { km: 'ឈ្មោះគ្រូបន្ទុកថ្នាក់', en: 'Class Teacher Name' },
  'cls.bioLabel': { km: 'ជីវប្រវត្តិសង្ខេប / ព័ត៌មានលម្អិត', en: 'Short Bio / Details' },
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
