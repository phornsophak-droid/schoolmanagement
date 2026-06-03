/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentScore, SchoolReport } from './types';

// Helper to safely clamp score between 0 and 10
export function clampScore(val: number): number {
  if (isNaN(val)) return 0;
  return Math.min(10, Math.max(0, parseFloat(val.toFixed(2))));
}

// Generates Unique ID to avoid key collisions (standard UUID v4 format)
export function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Safe general browser/server fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Calculate nested average and other properties for student scores
export function calculateStudentFields(
  student: Omit<StudentScore, 'khmerAvg' | 'mathAvg' | 'overallAvg' | 'gradeLetter' | 'result'>
): StudentScore {
  const khmerAvg = clampScore(
    (student.khmer.listening + student.khmer.writing + student.khmer.reading + student.khmer.speaking) / 4
  );
  
  const mathAvg = clampScore(
    (student.math.numbers + student.math.measurement + student.math.geometry + student.math.algebra + student.math.statistics) / 5
  );

  const subjects = [
    khmerAvg,
    mathAvg,
    student.science,
    student.socialStudies,
    student.physicalEducation,
    student.health,
    student.lifeSkills,
    student.foreignLanguage
  ];

  const overallAvg = clampScore(subjects.reduce((sum, s) => sum + s, 0) / subjects.length);

  let gradeLetter = 'F';
  if (overallAvg >= 9.0) gradeLetter = 'A';
  else if (overallAvg >= 8.0) gradeLetter = 'B';
  else if (overallAvg >= 7.0) gradeLetter = 'C';
  else if (overallAvg >= 6.0) gradeLetter = 'D';
  else if (overallAvg >= 5.0) gradeLetter = 'E';

  const result = overallAvg >= 5.0 ? 'ជាប់' : 'ធ្លាក់';

  return {
    ...student,
    khmerAvg,
    mathAvg,
    overallAvg,
    gradeLetter,
    result
  };
}

// Compute ranking for a list of students
export function rankStudents(students: StudentScore[]): StudentScore[] {
  // We rank students globally or filtered. Usually, it's globally in that class/month.
  // Group by grade and month to rank properly, or just rank the provided array
  const sorted = [...students].sort((a, b) => b.overallAvg - a.overallAvg);
  return sorted.map((student, index) => ({
    ...student,
    ranking: index + 1
  }));
}

export const initialStudents: StudentScore[] = [
  calculateStudentFields({
    id: 'student-1',
    name: 'សុខ វិបុល',
    gender: 'ប្រុស',
    grade: 'ថ្នាក់ទី ១ក',
    month: 'មេសា',
    khmer: { listening: 8.5, writing: 7.0, reading: 9.0, speaking: 8.0 },
    math: { numbers: 9.0, measurement: 8.0, geometry: 7.5, algebra: 8.5, statistics: 8.0 },
    science: 8.5,
    socialStudies: 8.0,
    physicalEducation: 9.0,
    health: 9.0,
    lifeSkills: 8.5,
    foreignLanguage: 7.5
  }),
  calculateStudentFields({
    id: 'student-2',
    name: 'គឹម ស្រីនីន',
    gender: 'ស្រី',
    grade: 'ថ្នាក់ទី ១ក',
    month: 'មេសា',
    khmer: { listening: 9.0, writing: 9.5, reading: 9.2, speaking: 9.0 },
    math: { numbers: 9.5, measurement: 9.0, geometry: 9.0, algebra: 9.5, statistics: 9.0 },
    science: 9.5,
    socialStudies: 9.2,
    physicalEducation: 8.5,
    health: 9.5,
    lifeSkills: 9.0,
    foreignLanguage: 8.8
  }),
  calculateStudentFields({
    id: 'student-3',
    name: 'ចាន់ ដារ៉ា',
    gender: 'ប្រុស',
    grade: 'ថ្នាក់ទី ១ក',
    month: 'មេសា',
    khmer: { listening: 6.0, writing: 5.5, reading: 7.0, speaking: 6.5 },
    math: { numbers: 7.5, measurement: 6.0, geometry: 6.5, algebra: 7.0, statistics: 6.0 },
    science: 7.0,
    socialStudies: 6.5,
    physicalEducation: 8.0,
    health: 8.0,
    lifeSkills: 7.5,
    foreignLanguage: 6.0
  }),
  calculateStudentFields({
    id: 'student-4',
    name: 'លី ម៉ារីណា',
    gender: 'ស្រី',
    grade: 'ថ្នាក់ទី ១ក',
    month: 'មេសា',
    khmer: { listening: 7.2, writing: 6.5, reading: 8.0, speaking: 7.5 },
    math: { numbers: 5.0, measurement: 4.8, geometry: 5.5, algebra: 4.5, statistics: 5.2 },
    science: 6.2,
    socialStudies: 6.8,
    physicalEducation: 7.5,
    health: 7.0,
    lifeSkills: 8.0,
    foreignLanguage: 6.5
  }),
  calculateStudentFields({
    id: 'student-5',
    name: 'ហេង សុខា',
    gender: 'ប្រុស',
    grade: 'ថ្នាក់ទី ១ក',
    month: 'មេសា',
    khmer: { listening: 4.5, writing: 4.0, reading: 4.8, speaking: 5.0 },
    math: { numbers: 3.5, measurement: 4.0, geometry: 3.8, algebra: 4.2, statistics: 3.5 },
    science: 4.5,
    socialStudies: 4.0,
    physicalEducation: 6.5,
    health: 5.5,
    lifeSkills: 5.0,
    foreignLanguage: 4.0
  })
];

export const initialReports: SchoolReport[] = [
  {
    id: 'report-1',
    generalInfo: {
      teacherName: 'សៅរ៍ កុសល',
      grade: 'ថ្នាក់ទី ១ក',
      month: 'មេសា',
      academicYear: '២០២៥-២០២៦'
    },
    studentStats: {
      startYearTotal: 32,
      startYearFemale: 15,
      currentTotal: 30,
      currentFemale: 14,
      dropoutTotal: 2,
      dropoutFemale: 1,
      absentTotal: 18,
      absentFemale: 6,
      passedTotal: 26,
      passedFemale: 13,
      slowLearnerTotal: 4,
      slowLearnerFemale: 1
    },
    subjectEvaluation: {
      evaluations: [
        { subjectName: 'ភាសាខ្មែរ', excellentCount: 8, goodCount: 12, fairCount: 6, averageCount: 3, poorCount: 1 },
        { subjectName: 'គណិតវិទ្យា', excellentCount: 6, goodCount: 10, fairCount: 8, averageCount: 4, poorCount: 2 },
        { subjectName: 'វិទ្យាសាស្ត្រ', excellentCount: 10, goodCount: 12, fairCount: 5, averageCount: 3, poorCount: 0 },
        { subjectName: 'សិក្សាសង្គម', excellentCount: 7, goodCount: 15, fairCount: 6, averageCount: 2, poorCount: 0 }
      ],
      teacherComment: 'សិស្សានុសិស្សភាគច្រើនយកចិត្តទុកដាក់ខ្ពស់ក្នុងការរៀនសូត្រ ជាពិសេសលើមុខវិជ្ជាវិទ្យាសាស្ត្រ។ ប៉ុន្តែក៏មានសិស្ស ២-៣ នាក់ដែលត្រូវការជំនួយបន្ថែមលើគណិតវិទ្យា។'
    },
    activities: {
      currentMonthActivities: [
        { id: generateUniqueId() + '1', lessonTitle: 'គណិតវិទ្យា៖ មេរៀនទី៨ ប្រភាគ និងទសភាគ', percentageCompleted: 95 },
        { id: generateUniqueId() + '2', lessonTitle: 'ភាសាខ្មែរ៖ តែងសេចក្តីពណ៌នាអំពីទេសភាព', percentageCompleted: 90 },
        { id: generateUniqueId() + '3', lessonTitle: 'វិទ្យាសាស្ត្រ៖ ប្រព័ន្ធរំលាយអាហារ', percentageCompleted: 100 }
      ],
      nextMonthPlan: [
        { id: generateUniqueId() + '4', lessonTitle: 'គណិតវិទ្យា៖ ធរណីមាត្រ មុំ និងការគណនាផ្ទៃក្រឡា', percentageCompleted: 0 },
        { id: generateUniqueId() + '5', lessonTitle: 'សិក្សាសង្គម៖ ប្រវត្តិសាស្ត្រសម័យអង្គរ', percentageCompleted: 0 }
      ]
    },
    specialStudents: {
      strugglingList: [
        { id: 'struggle-1', name: 'ហេង សុខា', gender: 'ប្រុស', issue: 'ខ្សោយការគណនាលេខ និងងាយភ្លេចមេរៀន', actionTaken: 'បង្រៀនបំប៉នបន្ថែម ១ម៉ោងក្រោយសាលា' },
        { id: 'struggle-2', name: 'ម៉ៅ ពិសី', gender: 'ស្រី', issue: 'អវត្តមាន ៤ដងគ្មានច្បាប់ដោយសារជួយការងារផ្ទះ', actionTaken: 'ជួបលោកគ្រូអ្នកគ្រូ និងប្រជុំជាមួយអាណាព្យាបាលសិស្ស' }
      ]
    },
    challenges: [
      { id: 'challenge-1', challenge: 'សាលារៀនខ្វះខាតសម្ភារៈពិសោធន៍វិទ្យាសាស្ត្រជាក់ស្តែង', solution: 'ប្រើប្រាស់សម្ភារៈច្នៃប្រឌិត និងវីដេអូបង្រៀនជំនួស' },
      { id: 'challenge-2', challenge: 'អាកាសធាតុក្តៅខ្លាំងនៅពេលរសៀល ធ្វើឱ្យសិស្សពិបាកប្រុងស្មារតីសូត្រធម៌ និងរៀនសូត្រ', solution: 'រៀបចំកង្ហារបន្ថែម និងផ្លាស់ប្តូរម៉ោងសិក្សាដែលធូរស្រាលនៅពេលថ្ងៃត្រង់' }
    ],
    createdAt: new Date().toISOString()
  }
];
