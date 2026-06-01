/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Printer, ArrowLeft, Calendar, User, BookOpen, AlertTriangle } from 'lucide-react';
import { SchoolReport } from '../types';

interface ReportDetailProps {
  report: SchoolReport;
  onBack: () => void;
}

const KHMER_NUMS = ['១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩', '១០'];

export default function ReportDetail({ report, onBack }: ReportDetailProps) {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Detail Toolbar Controls - Hidden during print */}
      <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={14} />
          ត្រឡប់ទៅផ្ទាំងដើម
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
            សន្លឹករបាយការណ៍ផ្លូវការ
          </span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-600/10"
          >
            <Printer size={14} />
            បោះពុម្ពរបាយការណ៍ (Print / PDF)
          </button>
        </div>
      </div>

      {/* Official A4 Hardcopy Document Canvas */}
      <div 
        id="printable_report_document"
        className="bg-white p-10 md:p-14 rounded-2xl border border-slate-100 shadow-sm space-y-8 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none"
      >
        {/* Kingdom of Cambodia National Header */}
        <div className="text-center space-y-1.5 relative">
          {/* Top National Slogan */}
          <h3 className="font-bold text-slate-800 text-base tracking-wide">ព្រះរាជាណាចក្រកម្ពុជា</h3>
          <h4 className="font-bold text-slate-700 text-sm tracking-widest">ជាតិ សាសនា ព្រះមហាក្សត្រ</h4>
          {/* Centered wavy line in text */}
          <div className="text-xs text-slate-400 font-serif leading-none mt-1">~ ~ ~ ~ ~ ~ ~ ~ ~</div>
          
          {/* Department / School Left Block */}
          <div className="absolute left-0 top-0 text-left text-xs space-y-1 font-medium text-slate-600">
            <p>ក្រសួងអប់រំ យុវជន និងកីឡា</p>
            <p>ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុក/ខណ្ឌ</p>
            <p className="font-bold text-slate-800">សាលាសហគមន៍ច្បារច្រុះ</p>
            <p className="font-mono text-[10px] text-slate-400">ឆ្នាំសិក្សា៖ {report.generalInfo.academicYear}</p>
          </div>
        </div>

        {/* Space Spacer */}
        <div className="pt-8 text-center space-y-2">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">របាយការណ៍បូកសរុបលទ្ធផលការងារប្រចាំខែ</h2>
          <p className="text-xs text-slate-500 font-medium font-serif">
            ថ្នាក់រៀន៖ <span className="font-bold text-slate-800">{report.generalInfo.grade}</span> | 
            គ្រូបន្ទុកថ្នាក់៖ <span className="font-bold text-slate-800">{report.generalInfo.teacherName}</span> | 
            ប្រចាំខែ៖ <span className="font-bold text-blue-700">{report.generalInfo.month}</span>
          </p>
        </div>

        {/* SECTION 1: Class Student Statistics */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-blue-600 rounded-xs inline-block" />
            ១. ស្ថានភាពស្ថិតិសិស្សានុសិស្ស
          </h4>
          
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-center border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 font-serif">
                  <th className="px-3 py-2 border-r border-slate-200">សន្ទស្សន៍ស្ថិតិ</th>
                  <th className="px-3 py-2 border-r border-slate-200">សិស្សដើមឆ្នាំ</th>
                  <th className="px-3 py-2 border-r border-slate-200">សិស្សបច្ចុប្បន្ន</th>
                  <th className="px-3 py-2 border-r border-slate-200">សិស្សបោះបង់</th>
                  <th className="px-3 py-2 border-r border-slate-200">អវត្តមានសរុប</th>
                  <th className="px-3 py-2 border-r border-slate-200">សិស្សប្រលងជាប់</th>
                  <th className="px-3 py-2">សិស្សរៀនយឺត</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-150 font-medium">
                  <td className="px-3 py-2.5 text-left font-bold bg-slate-50 border-r border-slate-200 text-slate-600">សរុប (នាក់ / ដង)</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-800">{report.studentStats.startYearTotal}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-800">{report.studentStats.currentTotal}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-800">{report.studentStats.dropoutTotal}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-800">{report.studentStats.absentTotal}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-emerald-600">{report.studentStats.passedTotal}</td>
                  <td className="px-3 py-2.5 font-mono text-rose-600">{report.studentStats.slowLearnerTotal}</td>
                </tr>
                <tr className="font-medium bg-slate-50/10">
                  <td className="px-3 py-2.5 text-left font-bold bg-slate-50 border-r border-slate-200 text-slate-500">ស្រី (នាក់ / ដង)</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-600">{report.studentStats.startYearFemale}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-600">{report.studentStats.currentFemale}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-600">{report.studentStats.dropoutFemale}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-slate-600">{report.studentStats.absentFemale}</td>
                  <td className="px-3 py-2.5 border-r border-slate-150 font-mono text-emerald-600">{report.studentStats.passedFemale}</td>
                  <td className="px-3 py-2.5 font-mono text-rose-600">{report.studentStats.slowLearnerFemale}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: Subject Evaluations */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-blue-600 rounded-xs inline-block" />
            ២. លទ្ធផលសិក្សាតាមមុខវិជ្ជា
          </h4>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-center border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500">
                  <th className="px-3 py-2 text-left border-r border-slate-200">មុខវិជ្ជា</th>
                  <th className="px-3 py-2 border-r border-slate-200">ល្អណាស់ (៩-១០)</th>
                  <th className="px-3 py-2 border-r border-slate-200">ល្អ (៨-៨.៩)</th>
                  <th className="px-3 py-2 border-r border-slate-200">ល្អបង្គួរ (៦.៥-៧.៩)</th>
                  <th className="px-3 py-2 border-r border-slate-200">មធ្យម (៥-៦.៤)</th>
                  <th className="px-3 py-2 text-rose-500">ខ្សោយ (&lt; ៥)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {report.subjectEvaluation.evaluations.map((item) => (
                  <tr key={item.subjectName} className="hover:bg-slate-50/10">
                    <td className="px-3 py-2 text-left font-bold border-r border-slate-200 text-slate-850 bg-slate-50/40">{item.subjectName}</td>
                    <td className="px-3 py-2 border-r border-slate-150 font-mono">{item.excellentCount}</td>
                    <td className="px-3 py-2 border-r border-slate-150 font-mono">{item.goodCount}</td>
                    <td className="px-3 py-2 border-r border-slate-150 font-mono">{item.fairCount}</td>
                    <td className="px-3 py-2 border-r border-slate-150 font-mono">{item.averageCount}</td>
                    <td className="px-3 py-2 font-mono text-rose-600 font-bold">{item.poorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teacher Comment Summary */}
          {report.subjectEvaluation.teacherComment && (
            <div className="p-3 bg-slate-50/80 border border-slate-200/60 rounded-lg text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-slate-700 block mb-1">មតិសង្ខេបរបស់គ្រូថ្នាក់រង៖</span>
              « {report.subjectEvaluation.teacherComment} »
            </div>
          )}
        </div>

        {/* SECTION 3: Current Month Progress and Next Month Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Block left: Current Done */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ៣.១ សកម្មភាពសិក្សាសម្រេចបាន
            </h5>
            
            <div className="border border-slate-150 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
              {report.activities.currentMonthActivities.length > 0 ? (
                report.activities.currentMonthActivities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between p-2.5 bg-white text-slate-700">
                    <span className="font-medium truncate pr-2">{act.lessonTitle}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono text-[10px] font-bold">
                      {act.percentageCompleted}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400">គ្មានទិន្នន័យ</div>
              )}
            </div>
          </div>

          {/* Block right: Next Plan */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              ៣.២ ផែនការសិក្សាខែបន្ទាប់
            </h5>

            <div className="border border-slate-150 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
              {report.activities.nextMonthPlan.length > 0 ? (
                report.activities.nextMonthPlan.map((plan) => (
                  <div key={plan.id} className="p-2.5 bg-white text-slate-700 font-medium">
                    {plan.lessonTitle}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400">គ្មានទិន្នន័យ</div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: remedial / slow learners list */}
        {report.specialStudents.strugglingList.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-blue-600 rounded-xs inline-block" />
              ៤. បញ្ជីឈ្មោះសិស្សយឺត និងវិធានការបំប៉នគ្រូ
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 font-serif">
                    <th className="px-3 py-2 w-10 text-center border-r border-slate-200">ល.រ</th>
                    <th className="px-3 py-2 border-r border-slate-200">ឈ្មោះសិស្ស</th>
                    <th className="px-3 py-2 text-center border-r border-slate-200">ភេទ</th>
                    <th className="px-3 py-2 border-r border-slate-200">បញ្ហាជួបប្រទះជាក់ស្តែង</th>
                    <th className="px-3 py-2">វិធានការដោះស្រាយរបស់គ្រូ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-[11.5px]">
                  {report.specialStudents.strugglingList.map((st, idx) => (
                    <tr key={st.id} className="hover:bg-slate-50/10">
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400 border-r border-slate-150">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800 border-r border-slate-150">{st.name}</td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-150">{st.gender}</td>
                      <td className="px-3 py-2.5 text-slate-600 border-r border-slate-150 leading-normal">{st.issue}</td>
                      <td className="px-3 py-2.5 text-blue-700 font-medium leading-normal">{st.actionTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 5: Challenges */}
        {report.challenges.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-blue-600 rounded-xs inline-block" />
              ៥. បញ្ហាប្រឈម និងដំណោះស្រាយសំណើ
            </h4>

            <div className="space-y-2">
              {report.challenges.map((ch, idx) => (
                <div key={ch.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-700">
                  <p className="font-bold text-slate-850">
                    បញ្ហា {KHMER_NUMS[idx]}៖ <span className="font-medium">{ch.challenge}</span>
                  </p>
                  <p className="mt-1 font-semibold text-blue-700">
                    ដំណោះស្រាយសំណើ៖ <span className="font-normal text-slate-650">{ch.solution}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signatures Area placeholder */}
        <div className="pt-10 grid grid-cols-2 gap-12 font-medium text-xs text-slate-600">
          {/* Left: School authorization approval */}
          <div className="text-center space-y-1">
            <p className="font-bold text-slate-800">បានឃើញ និងឯកភាព</p>
            <p className="text-[10px] text-slate-400">គណៈគ្រប់គ្រងសាលា / នាយកសាលា</p>
            <div className="h-24" /> {/* blank signature spacing */}
            <p className="font-semibold text-slate-700">............................................</p>
          </div>

          {/* Right: Teacher self assertion */}
          <div className="text-center space-y-1">
            <p>ថ្ងៃទី........ ខែ........ ឆ្នាំ២០២៦</p>
            <p className="font-bold text-slate-800">គ្រូបន្ទុកថ្នាក់</p>
            <div className="h-24" /> {/* blank signature spacing */}
            <p className="font-bold text-blue-700">{report.generalInfo.teacherName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
