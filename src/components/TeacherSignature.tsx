/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { syncUpsertSetting, syncDeleteSetting } from '../lib/supabase';
import { downscaleImageFile } from '../utils/image';
import { AVAILABLE_USERS } from './LoginPortal';

// Per-class homeroom-teacher signature, uploaded once per class and reused on
// every report/table for that class. Stored locally and mirrored to the cloud
// (school_settings, one key per class) so it appears on all devices and parents'
// cards. The teacher's name is taken from their account. See App.tsx restore.
export const teacherSigKey = (grade: string) => `school_teacher_signature::${grade}`;
export const TEACHER_SIG_PREFIX = 'school_teacher_signature::';
// Drop the honorific prefix so only the teacher's name shows (e.g. ស៊ុំ សំណាង).
const stripTitle = (n: string) => n.replace(/^(លោកគ្រូ|អ្នកគ្រូ|លោកស្រី|អ្នកស្រី|លោក|អ្នក)\s+/, '').trim();
export const teacherNameForGrade = (grade: string): string => {
  const u = AVAILABLE_USERS.find(x => x.role === 'teacher' && x.grade === grade);
  return u ? stripTitle(u.name) : '';
};

export default function TeacherSignature({ grade, height = 60 }: { grade: string; height?: number | string }) {
  const key = teacherSigKey(grade);
  const [sig, setSig] = useState<string>(() => {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  });
  const ref = useRef<HTMLInputElement>(null);
  const name = teacherNameForGrade(grade);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      // Downscale so the data URL is small enough to store + sync (a raw phone
      // photo can exceed the cloud request limit → the save silently fails).
      const url = await downscaleImageFile(f);
      setSig(url);
      try { localStorage.setItem(key, url); } catch { /* ignore */ }
      syncUpsertSetting(key, url).catch(() => { /* offline — saved locally */ });
    } catch { alert('មិនអាចអានរូបភាពហត្ថលេខាបានទេ។'); }
  };
  const removeSig = () => {
    setSig('');
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    syncDeleteSetting(key).catch(() => { /* offline — cleared locally */ });
  };

  return (
    <div className="flex flex-col items-center">
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {sig ? (
        <>
        {/* See PrincipalSignature: brightness+contrast whiten a photographed
            signature's grey paper so multiply leaves no box; saturate keeps a
            coloured stamp/ink vivid. */}
        <img
          src={sig}
          alt="ហត្ថលេខាគ្រូ"
          onClick={() => ref.current?.click()}
          title="ចុចលើហត្ថលេខាដើម្បីប្តូរ"
          style={{ height, objectFit: 'contain', cursor: 'pointer', mixBlendMode: 'multiply', filter: 'brightness(1.18) contrast(1.9) saturate(1.3)' }}
        />
        <button onClick={removeSig} title="លុបហត្ថលេខា" className="rc-no-print text-[10px] text-transparent hover:text-rose-500 hover:underline transition-colors">លុបហត្ថលេខា</button>
        </>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="rc-no-print text-[10px] text-blue-500 hover:underline"
          style={{ marginTop: typeof height === 'number' ? Math.round(height * 0.5) : '2cqw' }}
        >
          បញ្ចូលហត្ថលេខាគ្រូ
        </button>
      )}
      {name
        ? <p className="font-bold">{name}</p>
        : <p className="text-slate-300">..............................</p>}
    </div>
  );
}
