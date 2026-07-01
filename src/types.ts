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
// English after-hours classes may be named with the Khmer subject ("អង់គ្លេស")
// OR with the Latin word "GRADE" (e.g. "GRADE 3", "GRADE LEAVERS"). Use uppercase
// "GRADE" — general classes are named in Khmer ("ថ្នាក់ទី…") so it never collides.
export const isEnglishClass = (grade: string) => (grade || '').includes('អង់គ្លេស') || (grade || '').includes('GRADE');

// The 5 scoring criteria for the after-hours Health-education class (each 0-10).
export const HEALTH_SUBJECTS: { key: string; km: string }[] = [
  { key: 'bodyHygiene', km: 'អនាម័យរាង្គកាយ' },
  { key: 'brushTeeth', km: 'ដុសធ្មេញ' },
  { key: 'nutrition', km: 'ចំណីអាហារ' },
  { key: 'uniform', km: 'ឯកសណ្ឋាន' },
  { key: 'participation', km: 'ការចូលរួម' },
];
// True when a class name belongs to the Health-education after-hours subject.
export const isHealthClass = (grade: string) => (grade || '').includes('អប់រំសុខភាព');

// The 4 scoring criteria for the after-hours Drawing class (each 0-10).
export const DRAWING_SUBJECTS: { key: string; km: string }[] = [
  { key: 'classActivity', km: 'សកម្មភាពក្នុងថ្នាក់' },
  { key: 'homework', km: 'កិច្ចការផ្ទះ' },
  { key: 'attendance', km: 'វត្តមាន' },
  { key: 'exam', km: 'ការប្រឡង' },
];
// True when a class name belongs to the Drawing after-hours subject.
export const isDrawingClass = (grade: string) => (grade || '').includes('គំនូរ');

// The 4 scoring criteria for the after-hours Computer class (each 0-10).
export const COMPUTER_SUBJECTS: { key: string; km: string }[] = [
  { key: 'practicalSkills', km: 'ជំនាញអនុវត្ត' },
  { key: 'homework', km: 'កិច្ចការផ្ទះ' },
  { key: 'discipline', km: 'វិន័យ' },
  { key: 'attendance', km: 'វត្តមាន' },
];
// True when a class name belongs to the Computer after-hours subject.
export const isComputerClass = (grade: string) => (grade || '').includes('កុំព្យូទ័រ');

// The 5 scoring criteria for the after-hours PE & Sports class (each 0-10).
export const SPORTS_SUBJECTS: { key: string; km: string }[] = [
  { key: 'practicalSkills', km: 'ជំនាញអនុវត្ត' },
  { key: 'cooperation', km: 'សហការ' },
  { key: 'knowledge', km: 'ចំណេះដឹង' },
  { key: 'discipline', km: 'ឥរិយាបថ (វិន័យ)' },
  { key: 'attendance', km: 'វត្តមាន' },
];
// True when a class name belongs to the PE & Sports after-hours subject.
export const isSportsClass = (grade: string) => (grade || '').includes('កីឡា') || (grade || '').includes('អប់រំកាយ');

// Classes that score on their own custom criteria instead of the general subjects.
// The scores are stored in StudentScore.englishScores (a generic key→score map) and
// the overall average is the mean of the entered criteria.
export const getCustomSubjects = (grade: string): { key: string; km: string }[] | null => {
  if (isEnglishClass(grade)) return ENGLISH_SUBJECTS.map(s => ({ key: s.key, km: s.km }));
  if (isHealthClass(grade)) return HEALTH_SUBJECTS;
  if (isDrawingClass(grade)) return DRAWING_SUBJECTS;
  if (isComputerClass(grade)) return COMPUTER_SUBJECTS;
  if (isSportsClass(grade)) return SPORTS_SUBJECTS;
  return null;
};

// Canonical after-hours subject id for a class name, so differently-named sections
// of the same subject group together for the teacher view — e.g. a teacher whose
// class is "ថ្នាក់ភាសាអង់គ្លេស" and the renamed sections "GRADE 3" / "GRADE LEAVERS"
// are all 'english'. Returns '' for general (non after-hours) classes.
export const afterHoursSubject = (grade: string): string =>
  isEnglishClass(grade) ? 'english'
    : isHealthClass(grade) ? 'health'
    : isDrawingClass(grade) ? 'drawing'
    : isComputerClass(grade) ? 'computer'
    : isSportsClass(grade) ? 'sports' : '';

// Sub-subjects of វិទ្យាសាស្ត្រ (Science), each 0-10.
export const SCIENCE_SUBJECTS: { key: string; km: string }[] = [
  { key: 'physics', km: 'រូបវិទ្យា' },
  { key: 'chemistry', km: 'គីមីវិទ្យា' },
  { key: 'biology', km: 'ជីវវិទ្យា' },
  { key: 'earth', km: 'ផែនដី និងបរិស្ថានវិទ្យា' },
];

// Sub-subjects of សិក្សាសង្គម (Social Studies), each 0-10.
export const SOCIAL_SUBJECTS: { key: string; km: string }[] = [
  { key: 'morality', km: 'សីលធម៌-ពលរដ្ឋ' },
  { key: 'geography', km: 'ភូមិវិទ្យា' },
  { key: 'history', km: 'ប្រវត្តិវិទ្យា' },
  { key: 'home', km: 'គេហៈវិទ្យា-អប់រំសិល្បៈ' },
];

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
  group?: string; // ក្រុម — used by after-hours classes split into groups
  month: string; // ខែ (មករា, កុម្ភៈ, ...)
  studentId?: string;  // អត្តលេខ (official student ID, optional)
  dob?: string;        // ថ្ងៃខែឆ្នាំកំណើត (date of birth, dd/mm/yyyy)
  khmer: KhmerScore;
  math: MathScore;
  science: number | null;        // វិទ្យាសាស្ត្រ (average of scienceScores, 0-10)
  socialStudies: number | null;  // សិក្សាសង្គម (average of socialScores, 0-10)
  scienceScores?: Record<string, number | null>; // sub-subjects of Science (SCIENCE_SUBJECTS)
  socialScores?: Record<string, number | null>;  // sub-subjects of Social Studies (SOCIAL_SUBJECTS)
  note?: string;  // ផ្សេងៗ (free-text notes)
  remark?: string;  // មូលវិចារគ្រូបន្ទុកថ្នាក់ (class-teacher remark shown on the report card)
  fatherName?: string;  // ឈ្មោះឪពុក
  motherName?: string;  // ឈ្មោះម្តាយ
  address?: string;     // អាសយដ្ឋាន
  phone?: string;       // លេខទំនាក់ទំនង (parent/guardian contact)
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

