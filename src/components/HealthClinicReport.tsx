/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';

interface HealthClinicReportProps {
  grade: string;
  period: string;
  teacherName?: string;
  onClose: () => void;
}

const WEEKS = ['សប្តាហ៍ទី ១', 'សប្តាហ៍ទី ២', 'សប្តាហ៍ទី ៣', 'សប្តាហ៍ទី ៤', 'សប្តាហ៍ទី ៥ (បើមាន)'];

// Module-level helpers — defined outside the component so their identity is
// stable across renders (otherwise text inputs would remount and lose focus
// after every keystroke).
const boxBase = 'w-3.5 h-3.5 inline-flex items-center justify-center border rounded-sm text-[10px] leading-none align-middle';

function CheckBox({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 mr-4 align-middle">
      <span className={`${boxBase} ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-500 text-transparent'}`}>✓</span>
      <span>{label}</span>
    </button>
  );
}

function LineInput({ value, onChange, w = 'w-32' }: { value: string; onChange: (v: string) => void; w?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`border-b border-slate-400 outline-none focus:border-blue-500 bg-transparent px-1 text-center ${w}`}
    />
  );
}

function TextBox({ value, onChange, rows = 2 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full text-[13px] border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 resize-y leading-relaxed mb-2"
    />
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-[14px] font-bold text-slate-800 mt-6 mb-2 border-l-4 border-blue-600 pl-2">{title}</h2>;
}

export default function HealthClinicReport({ grade, period, teacherName, onClose }: HealthClinicReportProps) {
  const storeKey = `healthreport::${grade}::${period}`;
  const [f, setF] = useState<Record<string, string>>({});

  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); setF(s ? JSON.parse(s) : {}); } catch { setF({}); }
  }, [storeKey]);

  const set = (key: string, value: string) => {
    setF(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const toggle = (key: string) => set(key, f[key] ? '' : '1');
  const v = (k: string) => f[k] || '';

  const colSum = (suffix: string) => {
    let n = 0;
    for (let w = 1; w <= 5; w++) n += parseFloat(f[`wk${w}${suffix}`] || '') || 0;
    return n || '';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar (hidden in print) */}
      <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-800">📄 របាយការណ៍ប្រចាំខែ គិលានុបដ្ឋាក/យិកា (CamKids Clinic)</h3>
          <p className="text-xs text-slate-400 mt-0.5">{grade} • {period} — បំពេញដោយផ្ទាល់ (រក្សាទុកស្វ័យប្រវត្តិ)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors">
            <Printer size={13} /> បោះពុម្ព / PDF
          </button>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors">
            <X size={13} /> បិទ
          </button>
        </div>
      </div>

      {/* Printable sheet */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 print:p-0 print:border-0 print:shadow-none text-slate-800 text-[13px] leading-relaxed">

        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-5">
          <h1 className="text-lg font-extrabold tracking-wide">គ្លីនិក CamKids Clinic</h1>
          <p className="text-sm text-slate-600 mt-0.5">របាយការណ៍ប្រចាំខែរបស់គិលានុបដ្ឋាក/យិកា</p>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex gap-2 items-center"><span className="font-bold whitespace-nowrap">ខែធ្វើរបាយការណ៍៖</span><span>{period}</span></div>
          <div className="flex gap-2 items-center"><span className="font-bold whitespace-nowrap">ឈ្មោះគិលានុបដ្ឋាក/យិកា៖</span><span>{teacherName || '________________'}</span></div>
          <div className="flex gap-2 items-center"><span className="font-bold whitespace-nowrap">កាលបរិច្ឆេទប្រគល់៖</span><LineInput value={v('submitDate')} onChange={x => set('submitDate', x)} w="w-40" /></div>
        </div>

        {/* 1. Schedule */}
        <SectionTitle title="១. កាលវិភាគ និងការបើកគ្លីនិក" />
        <p className="mb-2">• ចំនួនថ្ងៃត្រូវបើកក្នុងខែ៖ <LineInput value={v('daysToOpen')} onChange={x => set('daysToOpen', x)} w="w-20" /> ថ្ងៃ　|　ចំនួនថ្ងៃបើកជាក់ស្តែង៖ <LineInput value={v('daysActual')} onChange={x => set('daysActual', x)} w="w-20" /> ថ្ងៃ</p>
        <p className="mb-1">• មានការកែសម្រួលកាលវិភាគដែរឬទេ?</p>
        <div className="pl-4 mb-1"><CheckBox checked={f.adjust === 'no'} onClick={() => set('adjust', 'no')} label="ទេ" /></div>
        <div className="pl-4 mb-2">
          <CheckBox checked={f.adjust === 'yes'} onClick={() => set('adjust', 'yes')} label="មាន" />
          <span>(ចំនួន៖ <LineInput value={v('adjustDays')} onChange={x => set('adjustDays', x)} w="w-16" /> ថ្ងៃ) → មូលហេតុ៖ <LineInput value={v('adjustReason')} onChange={x => set('adjustReason', x)} w="w-56" /></span>
        </div>

        {/* 2. Patient statistics table */}
        <SectionTitle title="២. តារាងស្ថិតិអ្នកជំងឺមកទទួលការព្យាបាល" />
        <p className="text-[12px] text-slate-500 mb-2">*សូមបំពេញចំនួនអ្នកជំងឺសរុបប្រចាំសប្តាហ៍នីមួយៗក្នុងខែនេះ៖</p>
        <table className="w-full border-collapse text-[12px] mb-4">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="border border-slate-300 px-2 py-2">សប្តាហ៍</th>
              <th className="border border-slate-300 px-2 py-2">ចំនួនសិស្ស (នាក់)</th>
              <th className="border border-slate-300 px-2 py-2">ចំនួនអ្នកភ្ញៀវ (នាក់)</th>
              <th className="border border-slate-300 px-2 py-2">ករណីសង្គ្រោះបន្ទាន់ (ដង)</th>
              <th className="border border-slate-300 px-2 py-2">កត់សម្គាល់</th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((wk, i) => {
              const w = i + 1;
              return (
                <tr key={w}>
                  <td className="border border-slate-300 px-2 py-1.5 font-semibold whitespace-nowrap">{wk}</td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center"><LineInput value={v(`wk${w}Students`)} onChange={x => set(`wk${w}Students`, x)} w="w-full" /></td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center"><LineInput value={v(`wk${w}Visitors`)} onChange={x => set(`wk${w}Visitors`, x)} w="w-full" /></td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center"><LineInput value={v(`wk${w}Emergency`)} onChange={x => set(`wk${w}Emergency`, x)} w="w-full" /></td>
                  <td className="border border-slate-300 px-1 py-1.5 text-center"><LineInput value={v(`wk${w}Notes`)} onChange={x => set(`wk${w}Notes`, x)} w="w-full" /></td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-bold">
              <td className="border border-slate-300 px-2 py-1.5">សរុបប្រចាំខែ</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center">{colSum('Students') || '—'}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center">{colSum('Visitors') || '—'}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center">{colSum('Emergency') || '—'}</td>
              <td className="border border-slate-300 px-2 py-1.5"></td>
            </tr>
          </tbody>
        </table>

        {/* 3. Health education & teeth brushing */}
        <SectionTitle title="៣. ការអប់រំសុខភាព និងការដុសធ្មេញ (ថ្នាក់ទី ១-៦)" />
        <p className="mb-2">• ការអប់រំសុខភាព៖ <CheckBox checked={f.healthEdu === 'all'} onClick={() => set('healthEdu', 'all')} label="បានគ្រប់ថ្នាក់" /> <CheckBox checked={f.healthEdu === 'incomplete'} onClick={() => set('healthEdu', 'incomplete')} label="មិនគ្រប់" /> (ខកខានថ្នាក់៖ <LineInput value={v('healthEduMissed')} onChange={x => set('healthEduMissed', x)} w="w-32" />)</p>
        <p className="mb-2">• ប្រធានបទបានបង្រៀនតាមថ្នាក់៖ <LineInput value={v('topicsTaught')} onChange={x => set('topicsTaught', x)} w="w-80" /></p>
        <p className="mb-2">• ការតាមដានដុសធ្មេញប្រចាំថ្ងៃ៖ <CheckBox checked={f.teethDaily === 'regular'} onClick={() => set('teethDaily', 'regular')} label="បានតាមដានទៀងទាត់" /> <CheckBox checked={f.teethDaily === 'no'} onClick={() => set('teethDaily', 'no')} label="មិនបានតាមដាន" /></p>
        <p className="mb-2">• ថ្នាំ និងគ្រឿងសម្ភារៈដុសធ្មេញ៖ <CheckBox checked={f.teethSupplies === 'enough'} onClick={() => set('teethSupplies', 'enough')} label="គ្រប់គ្រាន់" /> <CheckBox checked={f.teethSupplies === 'short'} onClick={() => set('teethSupplies', 'short')} label="ខ្វះខាត" /> (ខ្វះអ្វី៖ <LineInput value={v('teethShort')} onChange={x => set('teethShort', x)} w="w-48" />)</p>
        <p className="mb-1">• បញ្ហាប្រឈម ឬតម្រូវការបន្ថែមលើការងារដុសធ្មេញ៖</p>
        <TextBox value={v('teethChallenges')} onChange={x => set('teethChallenges', x)} rows={2} />

        {/* 4. Community outreach */}
        <SectionTitle title="៤. ការផ្សព្វផ្សាយដល់សហគមន៍" />
        <p className="mb-2">• វិធីផ្សព្វផ្សាយទៅអ្នកភ្ញៀវ៖ <CheckBox checked={!!f.outPhone} onClick={() => toggle('outPhone')} label="ទូរស័ព្ទ" /> <CheckBox checked={!!f.outStudent} onClick={() => toggle('outStudent')} label="ប្រាប់តាមសិស្ស" /> <CheckBox checked={!!f.outVillage} onClick={() => toggle('outVillage')} label="តាមរយៈមេភូមិ" /> <CheckBox checked={!!f.outOther} onClick={() => toggle('outOther')} label="ផ្សេងៗ" /></p>
        <p className="mb-1">• យោបល់៖</p>
        <TextBox value={v('outreachComments')} onChange={x => set('outreachComments', x)} rows={2} />

        {/* 5. Coordination with medical teams */}
        <SectionTitle title="៥. ការសម្របសម្រួលជាមួយក្រុមគ្រូពេទ្យឯកទេស" />
        <p className="mb-1">• តើមានក្រុមគ្រូពេទ្យទូទៅចុះមកខែនេះទេ? <CheckBox checked={f.genTeam === 'no'} onClick={() => set('genTeam', 'no')} label="គ្មាន" /> <CheckBox checked={f.genTeam === 'yes'} onClick={() => set('genTeam', 'yes')} label="មាន" /></p>
        <p className="pl-4 mb-2">បើមាន ការសហការគឺ៖ <CheckBox checked={f.genCoop === 'smooth'} onClick={() => set('genCoop', 'smooth')} label="រលូនល្អ" /> <CheckBox checked={f.genCoop === 'issues'} onClick={() => set('genCoop', 'issues')} label="មានបញ្ហាខ្លះ" /> (កំណត់ចំណាំ៖ <LineInput value={v('genNote')} onChange={x => set('genNote', x)} w="w-48" />)</p>
        <p className="mb-1">• តើមានក្រុមគ្រូពេទ្យឯកទេសចុះមកខែនេះទេ? <CheckBox checked={f.specTeam === 'no'} onClick={() => set('specTeam', 'no')} label="គ្មាន" /> <CheckBox checked={f.specTeam === 'yes'} onClick={() => set('specTeam', 'yes')} label="មាន" /></p>
        <p className="pl-4 mb-2">បើមាន ការសហការគឺ៖ <CheckBox checked={f.specCoop === 'smooth'} onClick={() => set('specCoop', 'smooth')} label="រលូនល្អ" /> <CheckBox checked={f.specCoop === 'issues'} onClick={() => set('specCoop', 'issues')} label="មានបញ្ហាខ្លះ" /> (កំណត់ចំណាំ៖ <LineInput value={v('specNote')} onChange={x => set('specNote', x)} w="w-48" />)</p>
        <p className="mb-1">• យោបល់៖</p>
        <TextBox value={v('coordComments')} onChange={x => set('coordComments', x)} rows={2} />

        {/* 6. Opinions & requests */}
        <SectionTitle title="៦. មតិយោបល់ និងសំណូមពរ" />
        <p className="mb-1">• តម្រូវការថ្នាំសង្គ្រោះ ឬសម្ភារៈវេជ្ជសាស្ត្រសម្រាប់ខែក្រោយ៖</p>
        <TextBox value={v('medNeeds')} onChange={x => set('medNeeds', x)} rows={2} />
        <p className="mb-1">• បញ្ហាប្រឈមផ្សេងៗ៖</p>
        <TextBox value={v('otherChallenges')} onChange={x => set('otherChallenges', x)} rows={2} />

        {/* Signature */}
        <div className="flex justify-end mt-12 text-center">
          <div className="space-y-1">
            <p className="font-bold">ហត្ថលេខាគិលានុបដ្ឋាក/យិកា</p>
            <p className="text-slate-400 pt-12">..............................</p>
            <p className="pt-2">កាលបរិច្ឆេទ៖ ...... / ...... / ......</p>
          </div>
        </div>
      </div>
    </div>
  );
}
