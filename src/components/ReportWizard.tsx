/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  Star, 
  TrendingUp, 
  ClipboardList, 
  AlertOctagon, 
  RefreshCw 
} from 'lucide-react';
import { 
  SchoolReport, 
  GeneralInfo, 
  StudentStats, 
  SubjectEvalItem, 
  PlanActivity, 
  StrugglingStudent, 
  ChallengeItem, 
  StudentScore,
  SchoolUser,
  isEnglishClass
} from '../types';
import { generateUniqueId } from '../mockData';
import EnglishClassReport from './EnglishClassReport';

interface ReportWizardProps {
  onSaveReport: (report: SchoolReport) => void;
  onCancel: () => void;
  students: StudentScore[]; // used for auto-extraction if selected
  reportToEdit?: SchoolReport | null;
  grades?: string[];
  currentUser?: SchoolUser | null;
}

const STEP_LABELS = [
  'ព័ត៌មានទូទៅ',
  'ស្ថិតិសិស្ស',
  'វាយតម្លៃមុខវិជ្ជា',
  'សកម្មភាព & ផែនការ',
  'សិស្សរៀនយឺត/អវត្តមាន',
  'បញ្ហាប្រឈម & ដំណោះស្រាយ'
];

const KHMER_NUMBERS = ['១', '២', '៣', '៤', '៥', '៦'];

const SUBJECTS_FOR_EVAL = [
  'ភាសាខ្មែរ',
  'គណិតវិទ្យា',
  'វិទ្យាសាស្ត្រ',
  'សិក្សាសង្គម',
  'ភាសាបរទេស',
  'កាយ-កីឡា',
  'សុខភាព',
  'បំណិនជីវិត'
];

// Khmer month order → numeric month, used to match the report month against
// the YYYY-MM-DD dates in the daily-attendance records.
const KHMER_MONTHS_ORDER = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

export default function ReportWizard({
  onSaveReport,
  onCancel,
  students,
  reportToEdit,
  grades,
  currentUser
}: ReportWizardProps) {
  const gradesList = grades || [
    'មត្តេយ្យ ១',
    'មត្តេយ្យ ២',
    'ថ្នាក់ទី ១ក',
    'ថ្នាក់ទី ១ខ',
    'ថ្នាក់ទី ២ក',
    'ថ្នាក់ទី ២ខ',
    'ថ្នាក់ទី ៣ក',
    'ថ្នាក់ទី ៣ខ',
    'ថ្នាក់ទី ៤ក',
    'ថ្នាក់ទី ៤ខ',
    'ថ្នាក់ទី ៥ក',
    'ថ្នាក់ទី ៥ខ',
    'ថ្នាក់ទី ៦',
    'ថ្នាក់ភាសាអង់គ្លេស',
    'ថ្នាក់គំនូរ',
    'ថ្នាក់កីឡា និងអប់រំកាយ',
    'ថ្នាក់អប់រំសុខភាព'
  ];
  const [currentStep, setCurrentStep] = useState(1);

  // --- Step 1: General Info states ---
  const [teacherName, setTeacherName] = useState(
    currentUser?.role === 'teacher' ? (currentUser.name || '') : ''
  );
  const [grade, setGrade] = useState(
    currentUser?.role === 'teacher' ? (currentUser.grade || gradesList[0] || 'ថ្នាក់ទី៦') : (gradesList[0] || 'ថ្នាក់ទី៦')
  );
  const [month, setMonth] = useState('មេសា');
  const [academicYear, setAcademicYear] = useState('២០២៥-២០២៦');

  useEffect(() => {
    if (gradesList.length > 0 && !reportToEdit) {
      if (currentUser?.role === 'teacher') {
        setGrade(currentUser.grade);
      } else {
        setGrade(gradesList[0]);
      }
    }
  }, [gradesList, reportToEdit, currentUser]);

  // --- Step 2: Student Stats states ---
  const [startYearTotal, setStartYearTotal] = useState(30);
  const [startYearFemale, setStartYearFemale] = useState(15);
  const [currentTotal, setCurrentTotal] = useState(30);
  const [currentFemale, setCurrentFemale] = useState(15);
  const [dropoutTotal, setDropoutTotal] = useState(0);
  const [dropoutFemale, setDropoutFemale] = useState(0);
  const [absentTotal, setAbsentTotal] = useState(10);
  const [absentFemale, setAbsentFemale] = useState(4);
  const [passedTotal, setPassedTotal] = useState(28);
  const [passedFemale, setPassedFemale] = useState(14);
  const [slowLearnerTotal, setSlowLearnerTotal] = useState(2);
  const [slowLearnerFemale, setSlowLearnerFemale] = useState(1);

  // --- Step 3: Subject Evaluations states ---
  const [subjectEvals, setSubjectEvals] = useState<SubjectEvalItem[]>(
    SUBJECTS_FOR_EVAL.map(sub => ({
      subjectName: sub,
      excellentCount: 0,
      goodCount: 0,
      fairCount: 0,
      averageCount: 0,
      poorCount: 0
    }))
  );
  const [teacherComment, setTeacherComment] = useState('');

  // --- Step 4: Activities and Plans states ---
  const [currentActivities, setCurrentActivities] = useState<PlanActivity[]>([
    { id: generateUniqueId() + 'c1', lessonTitle: 'មេរៀនភាសាខ្មែរ៖ ការសរសេរក្រមសីលធម៌', percentageCompleted: 90 },
    { id: generateUniqueId() + 'c2', lessonTitle: 'មេរៀនគណិតវិទ្យា៖ ធរណីមាត្រក្រឡាផ្ទៃ', percentageCompleted: 85 }
  ]);
  const [nextPlans, setNextPlans] = useState<PlanActivity[]>([
    { id: generateUniqueId() + 'n1', lessonTitle: 'មេរៀនវិទ្យាសាស្ត្រ៖ ចរន្តអគ្គិសនីសាមញ្ញ', percentageCompleted: 0 }
  ]);

  // inputs for adding activities
  const [newCurrentTitle, setNewCurrentTitle] = useState('');
  const [newCurrentPercent, setNewCurrentPercent] = useState(0);
  const [newPlanTitle, setNewPlanTitle] = useState('');

  // --- Step 5: Special Struggling list states ---
  const [strugglingList, setStrugglingList] = useState<StrugglingStudent[]>([
    { id: generateUniqueId() + 's1', name: 'ហេង សុខា', gender: 'ប្រុស', issue: 'ជួបការលំបាកក្នុងការអានអក្សរផ្សំ និងការបូកដកលេខធំៗ', actionTaken: 'ផ្តល់ម៉ោងរៀនបន្ថែមមុនចូលរៀន និងបង្កើតមិត្តជួយមិត្ត' }
  ]);
  const [newStrugglingName, setNewStrugglingName] = useState('');
  const [newStrugglingGender, setNewStrugglingGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [newStrugglingIssue, setNewStrugglingIssue] = useState('');
  const [newStrugglingAction, setNewStrugglingAction] = useState('');

  // --- Step 6: Challenges states ---
  const [challenges, setChallenges] = useState<ChallengeItem[]>([
    { id: generateUniqueId() + 'ch1', challenge: 'សិស្សខ្លះខ្វះខាតសៀវភៅសិក្សានៅផ្ទះ', solution: 'ខ្ចីសៀវភៅបណ្ណាល័យសាលា និងចម្លងសេចក្តីសង្ខេបមេរៀនជូន' }
  ]);
  const [newChallengeText, setNewChallengeText] = useState('');
  const [newChallengeSolution, setNewChallengeSolution] = useState('');

  // --- Prepopulate edit mode ---
  useEffect(() => {
    if (reportToEdit) {
      setTeacherName(reportToEdit.generalInfo.teacherName);
      setGrade(reportToEdit.generalInfo.grade);
      setMonth(reportToEdit.generalInfo.month);
      setAcademicYear(reportToEdit.generalInfo.academicYear);

      const stats = reportToEdit.studentStats;
      setStartYearTotal(stats.startYearTotal);
      setStartYearFemale(stats.startYearFemale);
      setCurrentTotal(stats.currentTotal);
      setCurrentFemale(stats.currentFemale);
      setDropoutTotal(stats.dropoutTotal);
      setDropoutFemale(stats.dropoutFemale);
      setAbsentTotal(stats.absentTotal);
      setAbsentFemale(stats.absentFemale);
      setPassedTotal(stats.passedTotal);
      setPassedFemale(stats.passedFemale);
      setSlowLearnerTotal(stats.slowLearnerTotal);
      setSlowLearnerFemale(stats.slowLearnerFemale);

      setSubjectEvals(reportToEdit.subjectEvaluation.evaluations);
      setTeacherComment(reportToEdit.subjectEvaluation.teacherComment);

      setCurrentActivities(reportToEdit.activities.currentMonthActivities);
      setNextPlans(reportToEdit.activities.nextMonthPlan);

      setStrugglingList(reportToEdit.specialStudents.strugglingList);
      setChallenges(reportToEdit.challenges);
    }
  }, [reportToEdit]);

  // Pull statistics straight from each class's real data — gradebook scores for
  // pass/slow/subject stats, and the recorded daily attendance for absences.
  // `silent` is used by the auto-fill effect (no alert / no failure popup).
  const handleAutoFillStats = (silent = false) => {
    const list = students.filter(s => s.grade === grade && s.month === month);
    if (list.length === 0) {
      if (!silent) alert(`មិនឃើញមានទិន្នន័យពិន្ទុសិស្សថ្នាក់ «${grade}» សម្រាប់ខែ «${month}» នៅក្នុងសៀវភៅពិន្ទុឡើយ។ សូមបញ្ចូលពិន្ទុសិស្សជាមុន ឬបំពេញវាដោយដៃ។`);
      return;
    }

    const currentTotalVal = list.length;
    const currentFemaleVal = list.filter(s => s.gender === 'ស្រី').length;
    const passedTotalVal = list.filter(s => s.result === 'ជាប់').length;
    const passedFemaleVal = list.filter(s => s.gender === 'ស្រី' && s.result === 'ជាប់').length;
    const slowLearners = list.filter(s => s.result === 'ធ្លាក់');
    const slowTotalVal = slowLearners.length;
    const slowFemaleVal = slowLearners.filter(s => s.gender === 'ស្រី').length;

    // Start-of-year defaults to the current enrolment (the teacher can adjust it).
    setStartYearTotal(currentTotalVal);
    setStartYearFemale(currentFemaleVal);
    setCurrentTotal(currentTotalVal);
    setCurrentFemale(currentFemaleVal);
    setPassedTotal(passedTotalVal);
    setPassedFemale(passedFemaleVal);
    setSlowLearnerTotal(slowTotalVal);
    setSlowLearnerFemale(slowFemaleVal);

    // Total absences (permission + unexcused) for this class during the month,
    // counted from the recorded daily attendance.
    try {
      const raw = localStorage.getItem('school_daily_attendance');
      const recs: any[] = raw ? JSON.parse(raw) : [];
      const mIdx = KHMER_MONTHS_ORDER.indexOf(month);
      const mm = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '';
      const genderById = new Map(students.map(s => [s.id, s.gender]));
      let absTotal = 0;
      let absFemale = 0;
      recs.forEach(r => {
        if (r.grade !== grade) return;
        if (mm && String(r.date || '').slice(5, 7) !== mm) return;
        Object.entries(r.studentStates || {}).forEach(([sid, status]) => {
          if (sid.endsWith('_reason')) return;
          if (status === 'absent' || status === 'permission') {
            absTotal++;
            if (genderById.get(sid) === 'ស្រី') absFemale++;
          }
        });
      });
      setAbsentTotal(absTotal);
      setAbsentFemale(absFemale);
    } catch (e) {
      // keep existing absence values if attendance data can't be read
    }

    // Also auto-generate Step 5 list if slow learners are found!
    if (slowLearners.length > 0) {
      const slowStudentStruggles: StrugglingStudent[] = slowLearners.map(sl => ({
        id: generateUniqueId() + `_auto_${sl.id}`,
        name: sl.name,
        gender: sl.gender,
        issue: `ពិន្ទុមធ្យមភាគប្រចាំខែទាបជាង ៥.០០ (មធ្យមភាគបច្ចុប្បន្ន៖ ${sl.overallAvg})`,
        actionTaken: 'រៀបចំការបង្រៀនបំប៉នបន្ថែម និងតាមដានរាល់ការធ្វើលំហាត់ក្នុងថ្នាក់'
      }));
      setStrugglingList(slowStudentStruggles);
    }

    // Auto calculate excellent/good/fair/avg/poor counts for step 3 based on subject scores
    const calculatedEvals = SUBJECTS_FOR_EVAL.map(subj => {
      let excellent = 0;
      let good = 0;
      let fair = 0;
      let average = 0;
      let poor = 0;

      list.forEach(st => {
        let score: number | null = null;
        if (subj === 'ភាសាខ្មែរ') score = st.khmerAvg;
        else if (subj === 'គណិតវិទ្យា') score = st.mathAvg;
        else if (subj === 'វិទ្យាសាស្ត្រ') score = st.science;
        else if (subj === 'សិក្សាសង្គម') score = st.socialStudies;
        else if (subj === 'ភាសាបរទេស') score = st.foreignLanguage;
        else if (subj === 'កាយ-កីឡា') score = st.physicalEducation;
        else if (subj === 'សុខភាព') score = st.health;
        else if (subj === 'បំណិនជីវិត') score = st.lifeSkills;

        if (score !== null && score !== undefined) {
          if (score >= 9.0) excellent++;
          else if (score >= 8.0) good++;
          else if (score >= 6.5) fair++;
          else if (score >= 5.0) average++;
          else poor++;
        }
      });

      return {
        subjectName: subj,
        excellentCount: excellent,
        goodCount: good,
        fairCount: fair,
        averageCount: average,
        poorCount: poor
      };
    });

    setSubjectEvals(calculatedEvals);

    if (!silent) alert(`បានទាញយកទិន្នន័យសិស្ស ${currentTotalVal} នាក់ ដំឡើងស្ថិតិជំហានទី២ និងទី៣ រួចរាល់ដោយស្វ័យប្រវត្ត!`);
  };

  // Auto-fetch each class's stats whenever the class or month changes (not in edit
  // mode, where the saved report's figures must be preserved).
  useEffect(() => {
    if (reportToEdit) return;
    if (grade && month) handleAutoFillStats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, month, students, reportToEdit]);

  const handleNext = () => {
    if (currentStep === 1 && !teacherName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះលោកគ្រូ/អ្នកគ្រូ!');
      return;
    }
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Step 4 inner actions
  const handleAddCurrentActivity = () => {
    if (!newCurrentTitle.trim()) return;
    const item: PlanActivity = {
      id: generateUniqueId(),
      lessonTitle: newCurrentTitle.trim(),
      percentageCompleted: Math.min(100, Math.max(0, newCurrentPercent))
    };
    setCurrentActivities([...currentActivities, item]);
    setNewCurrentTitle('');
    setNewCurrentPercent(0);
  };

  const handleDeleteCurrentActivity = (id: string) => {
    setCurrentActivities(prev => prev.filter(a => a.id !== id));
  };

  const handleAddPlan = () => {
    if (!newPlanTitle.trim()) return;
    const item: PlanActivity = {
      id: generateUniqueId(),
      lessonTitle: newPlanTitle.trim(),
      percentageCompleted: 0
    };
    setNextPlans([...nextPlans, item]);
    setNewPlanTitle('');
  };

  const handleDeleteNextPlan = (id: string) => {
    setNextPlans(prev => prev.filter(p => p.id !== id));
  };

  // Step 5 inner actions
  const handleAddStruggling = () => {
    if (!newStrugglingName.trim() || !newStrugglingIssue.trim()) return;
    const item: StrugglingStudent = {
      id: generateUniqueId(),
      name: newStrugglingName.trim(),
      gender: newStrugglingGender,
      issue: newStrugglingIssue.trim(),
      actionTaken: newStrugglingAction.trim() || 'តាមដានជាប្រចាំ'
    };
    setStrugglingList([...strugglingList, item]);
    setNewStrugglingName('');
    setNewStrugglingIssue('');
    setNewStrugglingAction('');
  };

  const handleDeleteStruggling = (id: string) => {
    setStrugglingList(prev => prev.filter(s => s.id !== id));
  };

  // Step 6 inner actions
  const handleAddChallenge = () => {
    if (!newChallengeText.trim()) return;
    const item: ChallengeItem = {
      id: generateUniqueId(),
      challenge: newChallengeText.trim(),
      solution: newChallengeSolution.trim() || 'រង់ចាំដំណោះស្រាយបន្ថែម'
    };
    setChallenges([...challenges, item]);
    setNewChallengeText('');
    setNewChallengeSolution('');
  };

  const handleDeleteChallenge = (id: string) => {
    setChallenges(prev => prev.filter(c => c.id !== id));
  };

  // Final Action: Save report
  const handleSaveAllAndSubmit = () => {
    const report: SchoolReport = {
      id: reportToEdit?.id || generateUniqueId(),
      generalInfo: {
        teacherName,
        grade,
        month,
        academicYear
      },
      studentStats: {
        startYearTotal,
        startYearFemale,
        currentTotal,
        currentFemale,
        dropoutTotal,
        dropoutFemale,
        absentTotal,
        absentFemale,
        passedTotal,
        passedFemale,
        slowLearnerTotal,
        slowLearnerFemale
      },
      subjectEvaluation: {
        evaluations: subjectEvals,
        teacherComment
      },
      activities: {
        currentMonthActivities: currentActivities,
        nextMonthPlan: nextPlans
      },
      specialStudents: {
        strugglingList
      },
      challenges,
      createdAt: reportToEdit?.createdAt || new Date().toISOString()
    };

    onSaveReport(report);
  };

  const updateSubjectEvalField = (subjIndex: number, field: keyof SubjectEvalItem, val: string) => {
    const parsed = parseInt(val) || 0;
    const updated = [...subjectEvals];
    updated[subjIndex] = {
      ...updated[subjIndex],
      [field]: parsed < 0 ? 0 : parsed
    };
    setSubjectEvals(updated);
  };

  // English classes use the dedicated English Class Report template instead of
  // the generic 6-step monthly-report wizard.
  if (isEnglishClass(grade)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">ថ្នាក់សិក្សា</label>
              <select
                disabled={currentUser?.role === 'teacher'}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {gradesList.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">សម្រាប់ខែ</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700"
              >
                {KHMER_MONTHS_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold whitespace-nowrap"
          >
            បោះបង់
          </button>
        </div>
        <div className="p-6">
          <EnglishClassReport
            students={students}
            grade={grade}
            period={month}
            teacherName={teacherName || currentUser?.name || ''}
            onClose={onCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Wizard Step Progression Header */}
      <div className="bg-slate-50/50 p-6 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 tracking-tight">សរសេររបាយការណ៍ប្រចាំខែ</h3>
            <p className="text-xs text-slate-400 mt-1">បំពេញទម្រង់តាមលំដាប់លំដោយដើម្បីបង្កើតរបាយការណ៍ស្វ័យប្រវត្ត</p>
          </div>
          <button 
            type="button" 
            onClick={onCancel}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold"
          >
            បោះបង់ជំហាននេះ
          </button>
        </div>

        {/* Horizontal Navigation Circles */}
        <div className="flex flex-wrap items-center justify-between mt-8 gap-3 max-w-4xl mx-auto">
          {STEP_LABELS.map((label, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < currentStep;
            const isActive = stepNum === currentStep;

            return (
              <div key={label} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={stepNum > currentStep}
                  onClick={() => setCurrentStep(stepNum)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/10' 
                      : isActive 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                        : 'bg-white text-slate-400 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {KHMER_NUMBERS[index]}
                </button>
                <span className={`text-[10px] sm:text-xs font-medium ${isActive ? 'text-indigo-600 font-bold' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                  {label}
                </span>
                {index < STEP_LABELS.length - 1 && (
                  <div className="hidden md:block w-8 h-[1px] bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Contents */}
      <div id="step_wizard_body" className="p-8 max-w-4xl mx-auto min-h-[400px]">
        {/* STEP 1: General Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="text-indigo-600" size={18} />
                ជំហានទី ១៖ ព័ត៌មានទូទៅនៃសាលា និងថ្នាក់រៀន
              </h4>
              {/* Auto fillers based on student DB */}
              <button 
                type="button" 
                onClick={handleAutoFillStats}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors"
                title="ទាញស្ថិតិពីសៀវភៅពិន្ទុសិស្ស"
              >
                <RefreshCw size={13} />
                ទាញទិន្នន័យពី Gradebook
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">គរុ​នាម / ឈ្មោះគ្រូបន្ទុកថ្នាក់</label>
                <input
                  type="text"
                  required
                  disabled={currentUser?.role === 'teacher'}
                  placeholder="ឧ. សៅរ៍ កុសល"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">ថ្នាក់សិក្សា</label>
                <select
                  disabled={currentUser?.role === 'teacher'}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {gradesList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">សម្រាប់ខែ</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-slate-700"
                >
                  <option value="មករា">មករា</option>
                  <option value="កុម្ភៈ">កុម្ភៈ</option>
                  <option value="មីនា">មីនា</option>
                  <option value="មេសា">មេសា</option>
                  <option value="ឧសភា">ឧសភា</option>
                  <option value="មិថុនា">មិថុនា</option>
                  <option value="កក្កដា">កក្កដា</option>
                  <option value="សីហា">សីហា</option>
                  <option value="កញ្ញា">កញ្ញា</option>
                  <option value="តុលា">តុលា</option>
                  <option value="វិច្ឆិកា">វិច្ឆិកា</option>
                  <option value="ធ្នូ">ធ្នូ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">ឆ្នាំសិក្សា</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="ឧ. ២០២៥-២០២៦"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Student Stats */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600" size={18} />
                ជំហានទី ២៖ ស្ថិតិសិស្សទូទៅរបស់ថ្នាក់រៀន
              </h4>
              <button
                type="button"
                onClick={() => handleAutoFillStats(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors"
              >
                <RefreshCw size={13} />
                ទាញពីសៀវភៅពិន្ទុ និងវត្តមានឡើងវិញ
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs font-medium text-slate-600">
              {/* Card stats blocks */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">សិស្សដើមឆ្នាំ</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (នាក់)</label>
                    <input
                      type="number"
                      value={startYearTotal}
                      onChange={(e) => setStartYearTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (នាក់)</label>
                    <input
                      type="number"
                      value={startYearFemale}
                      onChange={(e) => setStartYearFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">សិស្សបច្ចុប្បន្នជាក់ស្តែង</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (នាក់)</label>
                    <input
                      type="number"
                      value={currentTotal}
                      onChange={(e) => setCurrentTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (នាក់)</label>
                    <input
                      type="number"
                      value={currentFemale}
                      onChange={(e) => setCurrentFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">សិស្សបោះបង់សិក្សា</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (នាក់)</label>
                    <input
                      type="number"
                      value={dropoutTotal}
                      onChange={(e) => setDropoutTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (នាក់)</label>
                    <input
                      type="number"
                      value={dropoutFemale}
                      onChange={(e) => setDropoutFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">អវត្តមានសរុបទាំងខែ</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (ដង)</label>
                    <input
                      type="number"
                      value={absentTotal}
                      onChange={(e) => setAbsentTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (ដង)</label>
                    <input
                      type="number"
                      value={absentFemale}
                      onChange={(e) => setAbsentFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">សិស្សប្រលងជាប់ប្រចាំខែ</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (នាក់)</label>
                    <input
                      type="number"
                      value={passedTotal}
                      onChange={(e) => setPassedTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (នាក់)</label>
                    <input
                      type="number"
                      value={passedFemale}
                      onChange={(e) => setPassedFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <span className="text-indigo-600 font-bold block">សិស្សរៀនយឺត / មិនទាន់សម្រេចបាន</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">សរុប (នាក់)</label>
                    <input
                      type="number"
                      value={slowLearnerTotal}
                      onChange={(e) => setSlowLearnerTotal(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ស្រី (នាក់)</label>
                    <input
                      type="number"
                      value={slowLearnerFemale}
                      onChange={(e) => setSlowLearnerFemale(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Subject Evaluations */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Star className="text-indigo-600" size={18} />
              ជំហានទី ៣៖ ការវាយតម្លៃតាមកម្រិតនៃមុខវិជ្ជា និងមតិគ្រូ
            </h4>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">មុខវិជ្ជាសិក្សា</th>
                    <th className="px-3 py-2">ល្អណាស់ (៩-១០)</th>
                    <th className="px-3 py-2 font-medium">ល្អ (៨-៨.៩)</th>
                    <th className="px-3 py-2 font-medium">ល្អបង្គួរ (៦.៥-៧.៩)</th>
                    <th className="px-3 py-2 font-medium">មធ្យម (៥-៦.៤)</th>
                    <th className="px-3 py-2 font-medium text-rose-500">ខ្សោយ (&lt; ៥)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {subjectEvals.map((item, idx) => (
                    <tr key={item.subjectName} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 text-left font-bold text-slate-700">{item.subjectName}</td>
                      <td className="px-3 py-1">
                        <input
                          type="number"
                          value={item.excellentCount}
                          onChange={(e) => updateSubjectEvalField(idx, 'excellentCount', e.target.value)}
                          className="w-14 px-1 py-1 border border-slate-200 rounded text-center font-mono font-bold"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="number"
                          value={item.goodCount}
                          onChange={(e) => updateSubjectEvalField(idx, 'goodCount', e.target.value)}
                          className="w-14 px-1 py-1 border border-slate-200 rounded text-center font-mono"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="number"
                          value={item.fairCount}
                          onChange={(e) => updateSubjectEvalField(idx, 'fairCount', e.target.value)}
                          className="w-14 px-1 py-1 border border-slate-200 rounded text-center font-mono"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="number"
                          value={item.averageCount}
                          onChange={(e) => updateSubjectEvalField(idx, 'averageCount', e.target.value)}
                          className="w-14 px-1 py-1 border border-slate-200 rounded text-center font-mono hover:border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="number"
                          value={item.poorCount}
                          onChange={(e) => updateSubjectEvalField(idx, 'poorCount', e.target.value)}
                          className="w-14 px-1 py-1 border border-slate-200 rounded text-center font-mono text-rose-600 bg-rose-50/20"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 pt-3">
              <label className="block text-xs font-semibold text-slate-500">មតិយោបល់ទូទៅរបស់គ្រូថ្នាក់រង</label>
              <textarea
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                rows={3}
                placeholder="សរសេរការសង្កេតទូទៅលើកម្រិតសិក្សា សីលធម៌ និងការចូលរួមរបស់សិស្ស..."
                className="w-full px-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Real and Next planning */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={18} />
              ជំហានទី ៤៖ សកម្មភាពបង្រៀនជាក់ស្តែង និងផែនការសិក្សា
            </h4>

            {/* Split layout: Actual Progress vs Next Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Part 1: Current month progress */}
              <div className="space-y-4 p-4 border border-slate-100 rounded-xl bg-slate-50/40">
                <span className="text-xs font-bold text-slate-700 block">សកម្មភាពសិក្សាក្នុងខែនេះ</span>
                
                {/* Add block info */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                  <span className="text-[10px] font-bold text-indigo-600 block">បន្ថែមសកម្មភាព</span>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">ឈ្មោះមេរៀន/សកម្មភាព</label>
                    <input
                      type="text"
                      placeholder="ឧ. គណិត៖ មេរៀនទី៩ លំហាត់ប្រាទ"
                      value={newCurrentTitle}
                      onChange={(e) => setNewCurrentTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-[9px] text-slate-400 block mb-0.5">% សម្រេចបាន (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newCurrentPercent}
                        onChange={(e) => setNewCurrentPercent(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 font-mono text-xs border border-slate-200 rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCurrentActivity}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs px-3 font-semibold h-[30px]"
                    >
                      <Plus size={14} className="inline mr-0.5" /> បន្ថែម
                    </button>
                  </div>
                </div>

                {/* List results */}
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {currentActivities.map(act => (
                    <div key={act.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-lg text-[11px]">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{act.lessonTitle}</p>
                        <p className="text-[10px] text-emerald-600 font-mono mt-0.5 font-bold">ល្បឿនសម្រេចបាន៖ {act.percentageCompleted}%</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCurrentActivity(act.id)}
                        className="text-rose-500 p-1 hover:bg-rose-50 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 2: Next plans */}
              <div className="space-y-4 p-4 border border-slate-100 rounded-xl bg-slate-50/40">
                <span className="text-xs font-bold text-slate-700 block">ផែនការបង្រៀនខែបន្ទាប់</span>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2.5">
                  <span className="text-[10px] font-bold text-indigo-600 block">បន្ថែមផែនការ</span>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">មេរៀន/ផែនការការងារ</label>
                    <input
                      type="text"
                      placeholder="ឧ. សិក្សាសង្គម៖ ប្រវត្តិសាស្ត្រ ..."
                      value={newPlanTitle}
                      onChange={(e) => setNewPlanTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded outline-none"
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleAddPlan}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs px-3 font-semibold h-[30px]"
                    >
                      <Plus size={14} className="inline mr-0.5" /> បន្ថែមផែនការ
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {nextPlans.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-lg text-[11px]">
                      <div className="truncate pr-2 font-medium text-slate-800 flex-1">{p.lessonTitle}</div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNextPlan(p.id)}
                        className="text-rose-500 p-1 hover:bg-rose-50 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Struggling & Absent List */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList className="text-indigo-600" size={18} />
              ជំហានទី ៥៖ បញ្ជីឈ្មោះសិស្សរៀនយឺត និងសិស្សអវត្តមានច្រើន (៣ដងឡើង)
            </h4>

            {/* Quick entry form block */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">ឈ្មោះសិស្ស</label>
                <input
                  type="text"
                  placeholder="ឧ. ហេង សុខា"
                  value={newStrugglingName}
                  onChange={(e) => setNewStrugglingName(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">ភេទ</label>
                <select
                  value={newStrugglingGender}
                  onChange={(e) => setNewStrugglingGender(e.target.value as 'ប្រុស' | 'ស្រី')}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded"
                >
                  <option value="ប្រុស">ប្រុស</option>
                  <option value="ស្រី">ស្រី</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">បញ្ហា/អវត្តមាន</label>
                <input
                  type="text"
                  placeholder="ឧ. អានពាក្យគន្លឹះមិនរួច"
                  value={newStrugglingIssue}
                  onChange={(e) => setNewStrugglingIssue(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">សកម្មភាពដោះស្រាយ</label>
                  <input
                    type="text"
                    placeholder="ឧ. បំប៉នបន្ថែម"
                    value={newStrugglingAction}
                    onChange={(e) => setNewStrugglingAction(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddStruggling}
                  className="p-1 px-3 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 h-[30px]"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold">
                    <th className="px-3 py-2">ល.រ</th>
                    <th className="px-3 py-2">ឈ្មោះសិស្ស</th>
                    <th className="px-3 py-2 text-center">ភេទ</th>
                    <th className="px-3 py-2">បញ្ហា/មូលហេតុដែលខ្សោយ ឬខកខាន</th>
                    <th className="px-3 py-2">វិធានការដោះស្រាយរបស់គ្រូ</th>
                    <th className="px-3 py-2 text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {strugglingList.length > 0 ? (
                    strugglingList.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 font-mono text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-700">{item.name}</td>
                        <td className="px-3 py-2.5 text-center">{item.gender}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{item.issue}</td>
                        <td className="px-3 py-2.5 text-indigo-700 bg-indigo-50/10 font-mono text-[11.5px]">{item.actionTaken}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteStruggling(item.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-400 font-medium">
                        ពុំមានសិស្សណាម្នាក់ដែលជួបបញ្ហារៀនយឺត ឬអវត្តមានច្រើនក្នុងខែនេះទេ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 6: Challenges & Solutions */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <h4 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <AlertOctagon className="text-indigo-600" size={18} />
              ជំហានទី ៦៖ បញ្ហាប្រឈមរួម និងគម្រោងដោះស្រាយរបស់សាលា/គ្រូ
            </h4>

            {/* Quick entry */}
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-xs items-end">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">បញ្ហាប្រឈម</label>
                <textarea
                  rows={2}
                  placeholder="ឧ. អសន្តិសុខខ្លះៗនៅក្បែរដងអូរសាលា..."
                  value={newChallengeText}
                  onChange={(e) => setNewChallengeText(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded outline-none"
                />
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-400 mb-1">សំណើ ឬដំណោះស្រាយ</label>
                  <textarea
                    rows={2}
                    placeholder="ឧ. សហការជាមួយនគរបាលប៉ុស្តិ៍ ..."
                    value={newChallengeSolution}
                    onChange={(e) => setNewChallengeSolution(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddChallenge}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded h-[50px] inline-flex items-center"
				>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* list section */}
            <div className="space-y-3">
              {challenges.length > 0 ? (
                challenges.map((item, index) => (
                  <div key={item.id} className="p-3 bg-white border border-slate-150 rounded-xl shadow-xs flex items-start justify-between gap-4">
                    <div className="flex-1 text-xs">
                      <p className="font-bold text-slate-800">បញ្ហា {KHMER_NUMBERS[index]}៖ <span className="font-medium text-slate-600">{item.challenge}</span></p>
                      <p className="mt-1.5 text-blue-700 font-medium">ដំណោះស្រាយ៖ <span className="font-normal text-slate-600">{item.solution}</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteChallenge(item.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  មិនទាន់មានបញ្ចូលបញ្ហាប្រឈមក្នុងរបាយការណ៍នេះនៅឡើយទេ
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Button Wizard Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          disabled={currentStep === 1}
          onClick={handlePrev}
          className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-semibold select-none transition-colors ${
            currentStep === 1 
              ? 'border-slate-200 text-slate-350 bg-slate-100/50 cursor-not-allowed' 
              : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
          }`}
        >
          <ArrowLeft size={14} />
          ថយក្រោយ
        </button>

        {currentStep < 6 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/10 transition-colors"
          >
            បន្ទាប់
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            id="btn_submit_report"
            onClick={handleSaveAllAndSubmit}
            className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/15 transition-all"
          >
            <Save size={14} />
            រក្សាទុករបាយការណ៍សរុប
          </button>
        )}
      </div>
    </div>
  );
}
