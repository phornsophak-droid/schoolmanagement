import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StudentScore, SchoolReport, PlanActivity, StrugglingStudent, ChallengeItem } from '../types';

// Constants for local storage keys
export const CUSTOM_URL_KEY = 'school_supabase_custom_url';
export const CUSTOM_ANON_KEY = 'school_supabase_custom_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
}

// 1. Retrieve the best available Supabase credentials
export function getSupabaseConfig(): SupabaseConfig | null {
  const customUrl = localStorage.getItem(CUSTOM_URL_KEY);
  const customKey = localStorage.getItem(CUSTOM_ANON_KEY);

  if (customUrl && customKey) {
    return {
      url: customUrl.trim(),
      anonKey: customKey.trim(),
      isCustom: true
    };
  }

  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envUrl !== "undefined" && envKey && envKey !== "undefined") {
    return {
      url: envUrl.trim(),
      anonKey: envKey.trim(),
      isCustom: false
    };
  }

  return null;
}

// 2. Initialize dynamic client
let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }

  const configKey = `${config.url}:${config.anonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    cachedConfigKey = configKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    return null;
  }
}

// 3. Score Mapper functions
export function mapScoreToDB(score: StudentScore) {
  return {
    id: score.id,
    name: score.name,
    gender: score.gender,
    grade: score.grade,
    month: score.month,
    khmer_listening: score.khmer.listening || 0,
    khmer_writing: score.khmer.writing || 0,
    khmer_reading: score.khmer.reading || 0,
    khmer_speaking: score.khmer.speaking || 0,
    math_numbers: score.math.numbers || 0,
    math_measurement: score.math.measurement || 0,
    math_geometry: score.math.geometry || 0,
    math_algebra: score.math.algebra || 0,
    math_statistics: score.math.statistics || 0,
    science: score.science || 0,
    social_studies: score.socialStudies || 0,
    physical_education: score.physicalEducation || 0,
    health: score.health || 0,
    life_skills: score.lifeSkills || 0,
    foreign_language: score.foreignLanguage || 0,
    khmer_avg: score.khmerAvg || 0,
    math_avg: score.mathAvg || 0,
    overall_avg: score.overallAvg || 0,
    grade_letter: score.gradeLetter || 'F',
    status: score.status || 'ធម្មតា',
    result: score.result || 'ធ្លាក់',
    ranking: score.ranking ?? null,
    updated_at: new Date().toISOString()
  };
}

export function mapDBToScore(db: any): StudentScore {
  return {
    id: db.id,
    name: db.name,
    gender: db.gender,
    grade: db.grade,
    month: db.month,
    khmer: {
      listening: Number(db.khmer_listening ?? 0),
      writing: Number(db.khmer_writing ?? 0),
      reading: Number(db.khmer_reading ?? 0),
      speaking: Number(db.khmer_speaking ?? 0)
    },
    math: {
      numbers: Number(db.math_numbers ?? 0),
      measurement: Number(db.math_measurement ?? 0),
      geometry: Number(db.math_geometry ?? 0),
      algebra: Number(db.math_algebra ?? 0),
      statistics: Number(db.math_statistics ?? 0)
    },
    science: Number(db.science ?? 0),
    socialStudies: Number(db.social_studies ?? 0),
    physicalEducation: Number(db.physical_education ?? 0),
    health: Number(db.health ?? 0),
    lifeSkills: Number(db.life_skills ?? 0),
    foreignLanguage: Number(db.foreign_language ?? 0),
    khmerAvg: Number(db.khmer_avg ?? 0),
    mathAvg: Number(db.math_avg ?? 0),
    overallAvg: Number(db.overall_avg ?? 0),
    gradeLetter: db.grade_letter ?? 'F',
    result: db.result ?? 'ធ្លាក់',
    status: db.status ?? 'ធម្មតា',
    ranking: db.ranking !== null && db.ranking !== undefined ? Number(db.ranking) : undefined
  };
}

// 4. Report Mapper functions
export function mapReportToDB(report: SchoolReport) {
  return {
    id: report.id,
    teacher_name: report.generalInfo.teacherName,
    grade: report.generalInfo.grade,
    month: report.generalInfo.month,
    academic_year: report.generalInfo.academicYear,
    start_year_total: report.studentStats.startYearTotal,
    start_year_female: report.studentStats.startYearFemale,
    current_total: report.studentStats.currentTotal,
    current_female: report.studentStats.currentFemale,
    dropout_total: report.studentStats.dropoutTotal,
    dropout_female: report.studentStats.dropoutFemale,
    absent_total: report.studentStats.absentTotal,
    absent_female: report.studentStats.absentFemale,
    passed_total: report.studentStats.passedTotal,
    passed_female: report.studentStats.passedFemale,
    slow_learner_total: report.studentStats.slowLearnerTotal,
    slow_learner_female: report.studentStats.slowLearnerFemale,
    subject_evaluations: {
      evaluations: report.subjectEvaluation.evaluations,
      teacherComment: report.subjectEvaluation.teacherComment
    },
    created_at: report.createdAt || new Date().toISOString()
  };
}

export function mapDBToReport(
  dbReport: any,
  dbActivities: any[] = [],
  dbStruggling: any[] = [],
  dbChallenges: any[] = []
): SchoolReport {
  return {
    id: dbReport.id,
    generalInfo: {
      teacherName: dbReport.teacher_name,
      grade: dbReport.grade,
      month: dbReport.month,
      academicYear: dbReport.academic_year
    },
    studentStats: {
      startYearTotal: Number(dbReport.start_year_total ?? 0),
      startYearFemale: Number(dbReport.start_year_female ?? 0),
      currentTotal: Number(dbReport.current_total ?? 0),
      currentFemale: Number(dbReport.current_female ?? 0),
      dropoutTotal: Number(dbReport.dropout_total ?? 0),
      dropoutFemale: Number(dbReport.dropout_female ?? 0),
      absentTotal: Number(dbReport.absent_total ?? 0),
      absentFemale: Number(dbReport.absent_female ?? 0),
      passedTotal: Number(dbReport.passed_total ?? 0),
      passedFemale: Number(dbReport.passed_female ?? 0),
      slowLearnerTotal: Number(dbReport.slow_learner_total ?? 0),
      slowLearnerFemale: Number(dbReport.slow_learner_female ?? 0)
    },
    subjectEvaluation: {
      evaluations: dbReport.subject_evaluations?.evaluations || [],
      teacherComment: dbReport.subject_evaluations?.teacherComment || ""
    },
    activities: {
      currentMonthActivities: dbActivities
        .filter(act => act.activity_type === 'current_month')
        .map(act => ({
          id: act.id,
          lessonTitle: act.lesson_title,
          percentageCompleted: Number(act.percentage_completed)
        })),
      nextMonthPlan: dbActivities
        .filter(act => act.activity_type === 'next_month')
        .map(act => ({
          id: act.id,
          lessonTitle: act.lesson_title,
          percentageCompleted: Number(act.percentage_completed)
        }))
    },
    specialStudents: {
      strugglingList: dbStruggling.map(st => ({
        id: st.id,
        name: st.name,
        gender: st.gender as 'ប្រុស' | 'ស្រី',
        issue: st.issue,
        actionTaken: st.action_taken
      }))
    },
    challenges: dbChallenges.map(ch => ({
      id: ch.id,
      challenge: ch.challenge,
      solution: ch.solution
    })),
    createdAt: dbReport.created_at
  };
}

// 5. Database Interaction Module API
export async function syncFetchAll() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured');

  // Fetch student scores
  const { data: rawScores, error: scoresErr } = await supabase
    .from('student_scores')
    .select('*');
  if (scoresErr) throw scoresErr;

  // Fetch school reports
  const { data: rawReports, error: reportsErr } = await supabase
    .from('school_reports')
    .select('*');
  if (reportsErr) throw reportsErr;

  // Fetch sub tables for joined school reports
  const { data: rawActivities, error: actErr } = await supabase
    .from('report_activities')
    .select('*');
  if (actErr) throw actErr;

  const { data: rawStruggling, error: stErr } = await supabase
    .from('struggling_students')
    .select('*');
  if (stErr) throw stErr;

  const { data: rawChallenges, error: chErr } = await supabase
    .from('challenges_solutions')
    .select('*');
  if (chErr) throw chErr;

  // Fetch school grades
  const { data: rawGrades, error: gradesErr } = await supabase
    .from('school_grades')
    .select('*');
  
  let fetchedGrades: string[] = [];
  if (!gradesErr && rawGrades) {
    fetchedGrades = rawGrades.map((g: any) => g.name);
  }

  // Combine and map
  const mappedScores = (rawScores || []).map(mapDBToScore);
  
  const mappedReports = (rawReports || []).map(dbRep => {
    const reportActs = (rawActivities || []).filter(act => act.report_id === dbRep.id);
    const reportStruggling = (rawStruggling || []).filter(st => st.report_id === dbRep.id);
    const reportChallenges = (rawChallenges || []).filter(ch => ch.report_id === dbRep.id);
    return mapDBToReport(dbRep, reportActs, reportStruggling, reportChallenges);
  });

  return {
    students: mappedScores,
    reports: mappedReports,
    grades: fetchedGrades
  };
}

// 6. Push single student score directly
export async function syncUpsertStudent(student: StudentScore) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const row = mapScoreToDB(student);
  const { error } = await supabase
    .from('student_scores')
    .upsert(row);
  if (error) {
    console.error(`Failed to upsert student score ${student.name} to Supabase`, error);
    throw error;
  }
}

// Bulk sync students
export async function syncUpsertStudentsBulk(students: StudentScore[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const chunks = [];
  const chunkSize = 50;
  for (let i = 0; i < students.length; i += chunkSize) {
    chunks.push(students.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    const rows = chunk.map(mapScoreToDB);
    const { error } = await supabase
      .from('student_scores')
      .upsert(rows);
    if (error) {
      console.error('Failed to upsert students batch to Supabase', error);
      throw error;
    }
  }
}

// Delete student
export async function syncDeleteStudent(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('student_scores')
    .delete()
    .eq('id', id);
  if (error) {
    console.error(`Failed to delete student score ${id} from Supabase`, error);
    throw error;
  }
}

// 7. Push single school report directly (re-insert all sub-items for consistency)
export async function syncUpsertReport(report: SchoolReport) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // 1. Upsert General and Stats inside `school_reports` table
  const rowReport = mapReportToDB(report);
  const { error: repErr } = await supabase
    .from('school_reports')
    .upsert(rowReport);
  if (repErr) throw repErr;

  // 2. Clean out old sub-items
  await supabase.from('report_activities').delete().eq('report_id', report.id);
  await supabase.from('struggling_students').delete().eq('report_id', report.id);
  await supabase.from('challenges_solutions').delete().eq('report_id', report.id);

  // 3. Insert current month activities
  const batchActivities = [
    ...report.activities.currentMonthActivities.map(act => ({
      report_id: report.id,
      lesson_title: act.lessonTitle,
      percentage_completed: act.percentageCompleted,
      activity_type: 'current_month'
    })),
    ...report.activities.nextMonthPlan.map(act => ({
      report_id: report.id,
      lesson_title: act.lessonTitle,
      percentage_completed: act.percentageCompleted,
      activity_type: 'next_month'
    }))
  ];

  if (batchActivities.length > 0) {
    const { error: actErr } = await supabase
      .from('report_activities')
      .insert(batchActivities);
    if (actErr) console.error('Failed to insert activities in sync', actErr);
  }

  // 4. Insert struggling list
  const batchStruggling = report.specialStudents.strugglingList.map(st => ({
    report_id: report.id,
    name: st.name,
    gender: st.gender,
    issue: st.issue,
    action_taken: st.actionTaken
  }));

  if (batchStruggling.length > 0) {
    const { error: stErr } = await supabase
      .from('struggling_students')
      .insert(batchStruggling);
    if (stErr) console.error('Failed to insert struggling students in sync', stErr);
  }

  // 5. Insert challenges list
  const batchChallenges = report.challenges.map(ch => ({
    report_id: report.id,
    challenge: ch.challenge,
    solution: ch.solution
  }));

  if (batchChallenges.length > 0) {
    const { error: chErr } = await supabase
      .from('challenges_solutions')
      .insert(batchChallenges);
    if (chErr) console.error('Failed to insert challenges in sync', chErr);
  }
}

// Bulk sync reports
export async function syncUpsertReportsBulk(reports: SchoolReport[]) {
  for (const report of reports) {
    await syncUpsertReport(report);
  }
}

// Delete report
export async function syncDeleteReport(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('school_reports')
    .delete()
    .eq('id', id);
  if (error) {
    console.error(`Failed to delete report ${id} from Supabase`, error);
    throw error;
  }
}

// 8. Push grades bulk
export async function syncGradesBulk(grades: string[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (grades.length === 0) return;

  const rows = grades.map(g => ({ name: g }));
  const { error } = await supabase
    .from('school_grades')
    .upsert(rows);
  if (error) {
    console.error('Failed to upsert grades list to Supabase', error);
  }
}

export async function syncDeleteGrade(gradeName: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('school_grades')
    .delete()
    .eq('name', gradeName);
  if (error) {
    console.error(`Failed to delete grade ${gradeName} from Supabase`, error);
  }
}
