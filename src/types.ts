/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The 8 scoring categories for the after-hours English class (each 0-10).
export const ENGLISH_SUBJECTS: { key: string; en: string; km: string }[] = [
  { key: 'listening', en: 'Listening', km: 'ស្តាប់' },
  { key: 'speaking', en: 'Speaking', km: 'និយាយ' },
  { key: 'reading', en: 'Reading', km: 'អាន' },
  { key: 'writing', en: 'Writing', km: 'សរសេរ' },
  { key: 'vocabulary', en: 'Vocabulary', km: 'វាក្យសព្ទ' },
  { key: 'grammar', en: 'Grammar', km: 'វេយ្យាករណ៍' },
  { key: 'participation', en: 'Class Participation', km: 'ការចូលរួម' },
  { key: 'homework', en: 'Homework & Projects', km: 'កិច្ចការផ្ទះ' },
];

// True when a class name belongs to the English after-hours subject.
export const isEnglishClass = (grade: string) => (grade || '').includes('អង់គ្លេស');

export interface KhmerScore {
  listening: number | null; // ស្ដាប់ (0-10)
  writing: number | null;   // សរសេរ (0-10)
  reading: number | null;   // អាន (0-10)
  speaking: number | null;  // និយាយ (0-10)
}

export interface MathScore {
  numbers: number | null;     // ចំនូន (0-10)
  measurement: number | null; // រង្វាស់រង្វាល់ (0-10)
  geometry: number | null;    // ធរណីមាត្រ (0-10)
  algebra: number | null;     // ពិជគណិត (0-10)
  statistics: number | null;  // ស្ថិតិ (0-10)
}

export interface StudentScore {
  id: string;
  name: string;
  gender: 'ប្រុស' | 'ស្រី';
  grade: string; // ថ្នាក់ទី១ ដល់ ថ្នាក់ទី៦
  month: string; // ខែ (មករា, កុម្ភៈ, ...)
  khmer: KhmerScore;
  math: MathScore;
  science: number | null;        // វិទ្យាសាស្ត្រ (0-10)
  socialStudies: number | null;  // សិក្សាសង្គម (0-10)
  physicalEducation: number | null; // កាយ-កីឡា (0-10)
  health: number | null;         // សុខភាព (0-10)
  lifeSkills: number | null;     // បំណិនជីវិត (0-10)
  foreignLanguage: number | null; // ភាសាបរទេស (0-10)

  // After-hours English class scores (Listening, Speaking, Reading, Writing,
  // Vocabulary, Grammar, Class Participation, Homework). Each 0-10. Present only
  // for English classes; when set, the overall average is computed from these.
  englishScores?: Record<string, number | null>;

  // Computed values
  khmerAvg: number | null;
  mathAvg: number | null;
  overallAvg: number | null;
  totalScore?: number;
  gradeLetter: string; // A - F
  result: 'ជាប់' | 'ធ្លាក់' | '-';
  ranking?: number;
  status?: 'ធម្មតា' | 'រៀនយឺត' | 'បោះបង់';
}

// ជំហានទី ១: ព័ត៌មានទូទៅ
export interface GeneralInfo {
  teacherName: string;
  grade: string;
  month: string;
  academicYear: string;
}

// ជំហានទី ២: ស្ថិតិសិស្សទូទៅ
export interface StudentStats {
  startYearTotal: number;
  startYearFemale: number;
  currentTotal: number;
  currentFemale: number;
  dropoutTotal: number;
  dropoutFemale: number;
  absentTotal: number;
  absentFemale: number;
  passedTotal: number;
  passedFemale: number;
  slowLearnerTotal: number;
  slowLearnerFemale: number;
}

// ជំហានទី ៣: ការវាយតម្លៃតាមមុខវិជ្ជា និងមតិយោបល់
export interface SubjectEvalItem {
  subjectName: string;
  excellentCount: number; // ល្អណាស់
  goodCount: number;      // ល្អ
  fairCount: number;      // ល្អបង្គួរ
  averageCount: number;   // មធ្យម
  poorCount: number;      // ខ្សោយ
}

export interface SubjectEvaluation {
  evaluations: SubjectEvalItem[];
  teacherComment: string;
}

// ជំហានទី ៤: សកម្មភាពបង្រៀនជាក់ស្តែង និងផែនការ
export interface PlanActivity {
  id: string;
  lessonTitle: string;
  percentageCompleted: number; // 0-100
}

export interface Step4Activities {
  currentMonthActivities: PlanActivity[];
  nextMonthPlan: PlanActivity[];
}

// ជំហានទី ៥: បញ្ជីឈ្មោះសិស្សរៀនយឺត និងសិស្សអវត្តមានច្រើន
export interface StrugglingStudent {
  id: string;
  name: string;
  gender: 'ប្រុស' | 'ស្រី';
  issue: string; // ឧ. អានមិនដាច់ ឬ អវត្តមាន ៥ដងគ្មានច្បាប់
  actionTaken: string; // វិធានការដោះស្រាយ
}

export interface Step5SpecialStudents {
  strugglingList: StrugglingStudent[];
}

// ជំហានទី ៦: បញ្ហាប្រឈម និងដំណោះស្រាយ
export interface ChallengeItem {
  id: string;
  challenge: string;
  solution: string;
}

export interface SchoolReport {
  id: string;
  generalInfo: GeneralInfo;
  studentStats: StudentStats;
  subjectEvaluation: SubjectEvaluation;
  activities: Step4Activities;
  specialStudents: Step5SpecialStudents;
  challenges: ChallengeItem[];
  createdAt: string;
}

export interface SchoolUser {
  id: string;
  name: string;
  role: 'principal' | 'teacher';
  grade: string; // 'ថ្នាក់ទី១' ... 'ថ្នាក់ទី៦', or 'ទាំងអស់'
  photoCode: string;
  avatarBg: string;
}

