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

// Helper to safely clean/format any arbitrary string ID format for table keys
export function toUUID(id: string): string {
  if (!id) return '';
  return String(id).trim().replace(/^["']|["']$/g, '').trim();
}

// 3. Score Mapper functions
export function mapScoreToDB(score: StudentScore) {
  return {
    id: toUUID(score.id),
    name: score.name,
    gender: score.gender,
    grade: score.grade,
    month: score.month,
    khmer_listening: score.khmer.listening !== null && score.khmer.listening !== undefined ? score.khmer.listening : null,
    khmer_writing: score.khmer.writing !== null && score.khmer.writing !== undefined ? score.khmer.writing : null,
    khmer_reading: score.khmer.reading !== null && score.khmer.reading !== undefined ? score.khmer.reading : null,
    khmer_speaking: score.khmer.speaking !== null && score.khmer.speaking !== undefined ? score.khmer.speaking : null,
    math_numbers: score.math.numbers !== null && score.math.numbers !== undefined ? score.math.numbers : null,
    math_measurement: score.math.measurement !== null && score.math.measurement !== undefined ? score.math.measurement : null,
    math_geometry: score.math.geometry !== null && score.math.geometry !== undefined ? score.math.geometry : null,
    math_algebra: score.math.algebra !== null && score.math.algebra !== undefined ? score.math.algebra : null,
    math_statistics: score.math.statistics !== null && score.math.statistics !== undefined ? score.math.statistics : null,
    science: score.science !== null && score.science !== undefined ? score.science : null,
    social_studies: score.socialStudies !== null && score.socialStudies !== undefined ? score.socialStudies : null,
    physical_education: score.physicalEducation !== null && score.physicalEducation !== undefined ? score.physicalEducation : null,
    health: score.health !== null && score.health !== undefined ? score.health : null,
    life_skills: score.lifeSkills !== null && score.lifeSkills !== undefined ? score.lifeSkills : null,
    foreign_language: score.foreignLanguage !== null && score.foreignLanguage !== undefined ? score.foreignLanguage : null,
    khmer_avg: score.khmerAvg !== null && score.khmerAvg !== undefined ? score.khmerAvg : null,
    math_avg: score.mathAvg !== null && score.mathAvg !== undefined ? score.mathAvg : null,
    overall_avg: score.overallAvg !== null && score.overallAvg !== undefined ? score.overallAvg : null,
    grade_letter: score.gradeLetter || 'F',
    status: score.status || 'ធម្មតា',
    result: score.result || 'ធ្លាក់',
    ranking: score.ranking ?? null,
    // Fields without their own column live here so they survive a cloud sync:
    // group, note, official ID, and the custom/sub-subject score maps.
    extra_data: {
      group: score.group ?? null,
      note: score.note ?? null,
      remark: score.remark ?? null,
      studentId: score.studentId ?? null,
      dob: score.dob ?? null,
      englishScores: score.englishScores ?? null,
      scienceScores: score.scienceScores ?? null,
      socialScores: score.socialScores ?? null,
    },
    updated_at: new Date().toISOString()
  };
}

function parseDbNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export function mapDBToScore(db: any): StudentScore {
  return {
    id: db.id,
    name: db.name,
    gender: db.gender,
    grade: db.grade,
    month: db.month,
    khmer: {
      listening: parseDbNum(db.khmer_listening),
      writing: parseDbNum(db.khmer_writing),
      reading: parseDbNum(db.khmer_reading),
      speaking: parseDbNum(db.khmer_speaking)
    },
    math: {
      numbers: parseDbNum(db.math_numbers),
      measurement: parseDbNum(db.math_measurement),
      geometry: parseDbNum(db.math_geometry),
      algebra: parseDbNum(db.math_algebra),
      statistics: parseDbNum(db.math_statistics)
    },
    science: parseDbNum(db.science),
    socialStudies: parseDbNum(db.social_studies),
    physicalEducation: parseDbNum(db.physical_education),
    health: parseDbNum(db.health),
    lifeSkills: parseDbNum(db.life_skills),
    foreignLanguage: parseDbNum(db.foreign_language),
    khmerAvg: parseDbNum(db.khmer_avg),
    mathAvg: parseDbNum(db.math_avg),
    overallAvg: parseDbNum(db.overall_avg),
    gradeLetter: db.grade_letter ?? 'F',
    result: db.result ?? 'ធ្លាក់',
    status: db.status ?? 'ធម្មតា',
    ranking: db.ranking !== null && db.ranking !== undefined ? Number(db.ranking) : undefined,
    // Restore the fields stored in the extra_data JSON column.
    group: db.extra_data?.group ?? undefined,
    note: db.extra_data?.note ?? undefined,
    remark: db.extra_data?.remark ?? undefined,
    studentId: db.extra_data?.studentId ?? undefined,
    dob: db.extra_data?.dob ?? undefined,
    englishScores: db.extra_data?.englishScores ?? undefined,
    scienceScores: db.extra_data?.scienceScores ?? undefined,
    socialScores: db.extra_data?.socialScores ?? undefined,
  };
}

// 4. Report Mapper functions
export function mapReportToDB(report: SchoolReport) {
  return {
    id: toUUID(report.id),
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
    createdAt: dbReport.createdAt
  };
}

// 4.5. Attendance Mapper functions
export function mapStudentAttendanceToDB(r: any) {
  return {
    id: r.id,
    date: r.date,
    grade: r.grade,
    present_count: r.presentCount,
    late_count: r.lateCount ?? 0,
    permission_count: r.permissionCount,
    absent_count: r.absentCount,
    student_states: r.studentStates,
    created_at: new Date().toISOString()
  };
}

export function mapDBToStudentAttendance(db: any): any {
  // Morning/afternoon session is encoded in the id (`att-<session>-<date>-<grade>`).
  const idParts = String(db.id || '').split('-');
  const session = idParts[1] === 'morning' || idParts[1] === 'afternoon' ? idParts[1] : undefined;
  return {
    id: db.id,
    date: db.date,
    grade: db.grade,
    session,
    presentCount: Number(db.present_count ?? 0),
    lateCount: Number(db.late_count ?? 0),
    permissionCount: Number(db.permission_count ?? 0),
    absentCount: Number(db.absent_count ?? 0),
    studentStates: db.student_states || {}
  };
}

export function mapTeacherAttendanceToDB(r: any) {
  return {
    id: r.id,
    date: r.date,
    present_count: r.presentCount,
    late_count: r.lateCount ?? 0,
    permission_count: r.permissionCount,
    absent_count: r.absentCount,
    teacher_states: r.teacherStates,
    created_at: new Date().toISOString()
  };
}

export function mapDBToTeacherAttendance(db: any): any {
  return {
    id: db.id,
    date: db.date,
    presentCount: Number(db.present_count ?? 0),
    lateCount: Number(db.late_count ?? 0),
    permissionCount: Number(db.permission_count ?? 0),
    absentCount: Number(db.absent_count ?? 0),
    teacherStates: db.teacher_states || {}
  };
}

// Fetch every row of a table, paging past PostgREST's 1000-row response cap.
// Without this, tables with more than 1000 rows return only the first page,
// so students beyond row 1000 silently vanish and re-saved data "reverts".
async function fetchAllRows(supabase: SupabaseClient, table: string) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// 5. Database Interaction Module API
export async function syncFetchAll() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured');

  // Fetch student scores (paginated — there can be far more than 1000 rows)
  const rawScores = await fetchAllRows(supabase, 'student_scores');

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

  // Fetch settings
  const { data: rawSettings } = await supabase
    .from('school_settings')
    .select('*');

  let fetchedSettings: any = {};
  if (rawSettings) {
    rawSettings.forEach((row: any) => {
      fetchedSettings[row.setting_key] = row.setting_value;
    });
  }

  // Fetch student attendance safely
  let rawStudentAtt: any[] | null = null;
  try {
    const { data } = await supabase.from('student_attendance').select('*');
    rawStudentAtt = data;
  } catch (err) {
    console.warn("Could not fetch student_attendance", err);
  }

  // Fetch teacher attendance safely
  let rawTeacherAtt: any[] | null = null;
  try {
    const { data } = await supabase.from('teacher_attendance').select('*');
    rawTeacherAtt = data;
  } catch (err) {
    console.warn("Could not fetch teacher_attendance", err);
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
    grades: fetchedGrades,
    settings: fetchedSettings,
    studentAttendance: (rawStudentAtt || []).map(mapDBToStudentAttendance),
    teacherAttendance: (rawTeacherAtt || []).map(mapDBToTeacherAttendance)
  };
}

// 5.5. Attendance Sync Functions
export async function syncUpsertStudentAttendance(record: any) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const row = mapStudentAttendanceToDB(record);
  const { error } = await supabase
    .from('student_attendance')
    .upsert(row);
  if (error) {
    console.error(`Failed to upsert student attendance ${record.id} to Supabase`, error);
    throw error;
  }
}

export async function syncUpsertTeacherAttendance(record: any) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const row = mapTeacherAttendanceToDB(record);
  const { error } = await supabase
    .from('teacher_attendance')
    .upsert(row);
  if (error) {
    console.error(`Failed to upsert teacher attendance ${record.id} to Supabase`, error);
    throw error;
  }
}

export async function syncUpsertStudentAttendanceBulk(records: any[]) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (records.length === 0) return;

  const chunks = [];
  const chunkSize = 50;
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    const rows = chunk.map(mapStudentAttendanceToDB);
    const { error } = await supabase
      .from('student_attendance')
      .upsert(rows);
    if (error) {
      console.error('Failed to upsert student attendance bulk to Supabase', error);
      throw error;
    }
  }
}

export async function syncUpsertTeacherAttendanceBulk(records: any[]) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (records.length === 0) return;

  const chunks = [];
  const chunkSize = 50;
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    const rows = chunk.map(mapTeacherAttendanceToDB);
    const { error } = await supabase
      .from('teacher_attendance')
      .upsert(rows);
    if (error) {
      console.error('Failed to upsert teacher attendance bulk to Supabase', error);
      throw error;
    }
  }
}

export async function syncDeleteStudentAttendance(id: string) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('student_attendance')
    .delete()
    .eq('id', id);
  if (error) {
    console.error(`Failed to delete student attendance ${id} from Supabase`, error);
    throw error;
  }
}

export async function syncDeleteTeacherAttendance(id: string) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('teacher_attendance')
    .delete()
    .eq('id', id);
  if (error) {
    console.error(`Failed to delete teacher attendance ${id} from Supabase`, error);
    throw error;
  }
}

// Timestamp of this device's last cloud WRITE — lets the realtime listener ignore
// the echo of our own change instead of re-downloading every table (saves egress).
let _lastCloudWriteAt = 0;
export const noteCloudWrite = () => { _lastCloudWriteAt = Date.now(); };
export const msSinceCloudWrite = () => Date.now() - _lastCloudWriteAt;

// Upsert score rows, retrying without extra_data if that column doesn't exist
// (database not yet migrated) so the core score data still saves.
async function upsertScoreRows(supabase: SupabaseClient, rows: any[]) {
  noteCloudWrite();
  let { error } = await supabase.from('student_scores').upsert(rows);
  if (error && /extra_data/i.test(error.message || '')) {
    const stripped = rows.map(({ extra_data, ...rest }: any) => rest);
    ({ error } = await supabase.from('student_scores').upsert(stripped));
  }
  return error;
}

// 6. Push single student score directly
export async function syncUpsertStudent(student: StudentScore) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const error = await upsertScoreRows(supabase, [mapScoreToDB(student)]);
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
    const error = await upsertScoreRows(supabase, chunk.map(mapScoreToDB));
    if (error) {
      console.error('Failed to upsert students batch to Supabase', error);
      throw error;
    }
  }
}

// Delete student
export async function syncDeleteStudent(id: string) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('student_scores')
    .delete()
    .eq('id', toUUID(id));
  if (error) {
    console.error(`Failed to delete student score ${id} from Supabase`, error);
    throw error;
  }
}

// 7. Push single school report directly (re-insert all sub-items for consistency)
export async function syncUpsertReport(report: SchoolReport) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const reportIdUuid = toUUID(report.id);

  // 1. Upsert General and Stats inside `school_reports` table
  const rowReport = mapReportToDB(report);
  const { error: repErr } = await supabase
    .from('school_reports')
    .upsert(rowReport);
  if (repErr) throw repErr;

  // 2. Clean out old sub-items
  await supabase.from('report_activities').delete().eq('report_id', reportIdUuid);
  await supabase.from('struggling_students').delete().eq('report_id', reportIdUuid);
  await supabase.from('challenges_solutions').delete().eq('report_id', reportIdUuid);

  // 3. Insert current month activities
  const batchActivities = [
    ...report.activities.currentMonthActivities.map(act => ({
      report_id: reportIdUuid,
      lesson_title: act.lessonTitle,
      percentage_completed: act.percentageCompleted,
      activity_type: 'current_month'
    })),
    ...report.activities.nextMonthPlan.map(act => ({
      report_id: reportIdUuid,
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
    report_id: reportIdUuid,
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
    report_id: reportIdUuid,
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
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('school_reports')
    .delete()
    .eq('id', toUUID(id));
  if (error) {
    console.error(`Failed to delete report ${id} from Supabase`, error);
    throw error;
  }
}

// 8. Push grades bulk
export async function syncGradesBulk(grades: string[]) {
  noteCloudWrite();
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
  noteCloudWrite();
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

// 9. Push setting
export async function syncUpsertSetting(key: string, value: any) {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('school_settings')
    .upsert({ setting_key: key, setting_value: value });
  if (error) {
    console.error(`Failed to upsert setting ${key} to Supabase`, error);
  }
}

// 10. Factory reset — delete all student/score/attendance/report DATA from the
// cloud. Class list (school_grades) and settings (teacher accounts) are kept.
export async function syncClearAllData() {
  noteCloudWrite();
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const tables = [
    'report_activities',
    'struggling_students',
    'challenges_solutions',
    'school_reports',
    'student_attendance',
    'teacher_attendance',
    'student_scores',
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().not('id', 'is', null);
    if (error) console.warn(`Failed to clear table ${t}`, error);
  }
}

