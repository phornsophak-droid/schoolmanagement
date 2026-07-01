/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { syncUpsertSetting, syncDeleteSetting } from '../lib/supabase';
import { getCachedSetting, setCachedSetting, cachedKeysWithPrefix, subscribeSettings } from '../lib/settingsCache';
import { downscaleImageFile } from '../utils/image';
import { AVAILABLE_USERS } from './LoginPortal';
import { isEnglishClass, isHealthClass, isDrawingClass, isComputerClass, isSportsClass, afterHoursSubject } from '../types';

// An after-hours teacher's account grade is the generic subject ("ថ្នាក់ភាសាអង់គ្លេស")
// while their students' grade carries the group ("ថ្នាក់ភាសាអង់គ្លេស 3"). Match by
// shared subject so the right teacher's name still resolves for those classes.
const sameExtraSubject = (a: string, b: string) =>
  (isEnglishClass(a) && isEnglishClass(b)) ||
  (isHealthClass(a) && isHealthClass(b)) ||
  (isDrawingClass(a) && isDrawingClass(b)) ||
  (isComputerClass(a) && isComputerClass(b)) ||
  (isSportsClass(a) && isSportsClass(b));

// After-hours subjects span several class groups (e.g. PE groups, English 3/4/5),
// and each student's grade may carry the group — so a per-grade signature key
// fragments into many and "doesn't stick" across the subject. Collapse every
// after-hours grade of a subject to ONE canonical key so the teacher uploads the
// signature once and it shows on every group's report. General classes are keyed
// by their exact grade (unchanged).
const canonicalSigGrade = (grade: string): string => {
  if (isEnglishClass(grade)) return 'ភាសាអង់គ្លេស';
  if (isHealthClass(grade)) return 'អប់រំសុខភាព';
  if (isDrawingClass(grade)) return 'គំនូរ';
  if (isComputerClass(grade)) return 'កុំព្យូទ័រ';
  if (isSportsClass(grade)) return 'កីឡា និងអប់រំកាយ';
  return grade;
};

// Per-class homeroom-teacher signature, uploaded once per class and reused on
// every report/table for that class. Stored locally and mirrored to the cloud
// (school_settings, one key per class) so it appears on all devices and parents'
// cards. The teacher's name is taken from their account. See App.tsx restore.
export const teacherSigKey = (grade: string) => `school_teacher_signature::${canonicalSigGrade(grade)}`;
export const TEACHER_SIG_PREFIX = 'school_teacher_signature::';
// Drop the honorific prefix so only the teacher's name shows (e.g. ស៊ុំ សំណាង).
const stripTitle = (n: string) => n.replace(/^(លោកគ្រូ|អ្នកគ្រូ|លោកស្រី|អ្នកស្រី|លោក|អ្នក)\s+/, '').trim();
export const teacherNameForGrade = (grade: string): string => {
  const teachers = AVAILABLE_USERS.filter(x => x.role === 'teacher');
  const u = teachers.find(x => x.grade === grade)
    || teachers.find(x => sameExtraSubject(x.grade, grade));
  return u ? stripTitle(u.name) : '';
};

// Read one setting value, memory cache first (quota-free) then localStorage.
const readSetting = (k: string): string => {
  const cached = getCachedSetting(k);
  if (cached) return cached;
  try { return localStorage.getItem(k) || ''; } catch { return ''; }
};

// Resolve a class's stored signature, tolerating historical key drift: signatures
// were saved under the canonical subject key ("::គំនូរ") AND under raw grade keys
// ("::ថ្នាក់គំនូរ", "::ថ្នាក់ភាសាអង់គ្លេស 3", "::ថ្នាក់កីឡា និងអប់រកាយ") at different
// times. Try the canonical key, then the raw grade, then ANY key of the same
// after-hours subject — so every group/spelling variant still resolves.
export const resolveTeacherSig = (grade: string): string => {
  const direct = readSetting(teacherSigKey(grade));
  if (direct) return direct;
  const raw = readSetting(TEACHER_SIG_PREFIX + grade);
  if (raw) return raw;
  const subj = afterHoursSubject(grade);
  if (!subj) return '';
  const keys = new Set<string>(cachedKeysWithPrefix(TEACHER_SIG_PREFIX));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TEACHER_SIG_PREFIX)) keys.add(k);
    }
  } catch { /* localStorage unavailable */ }
  for (const k of keys) {
    if (afterHoursSubject(k.slice(TEACHER_SIG_PREFIX.length)) !== subj) continue;
    const v = readSetting(k);
    if (v) return v;
  }
  return '';
};

export default function TeacherSignature({ grade, height = 60 }: { grade: string; height?: number | string }) {
  const key = teacherSigKey(grade);
  const [sig, setSig] = useState<string>(() => resolveTeacherSig(grade));
  // Re-resolve when the grade changes or the cloud sync populates the cache — the
  // signature may arrive AFTER this component first mounts.
  useEffect(() => {
    const update = () => setSig(resolveTeacherSig(grade));
    update();
    return subscribeSettings(update);
  }, [grade]);
  const ref = useRef<HTMLInputElement>(null);
  const name = teacherNameForGrade(grade);

  const [saving, setSaving] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      // Downscale so the data URL is small enough to store + sync (a raw phone
      // photo can exceed the cloud request limit → the save silently fails).
      const url = await downscaleImageFile(f);
      setSig(url);
      setCachedSetting(key, url); // memory cache — survives reload even if localStorage is full
      try { localStorage.setItem(key, url); } catch { /* quota — served from memory cache + cloud */ }
      // The signature MUST reach the cloud — otherwise parents and other devices
      // never see it (it stays local-only). Await the save and tell the user if
      // it couldn't be stored, so they can retry when back online instead of the
      // failure passing silently.
      setSaving(true);
      try {
        await syncUpsertSetting(key, url);
      } catch (err: any) {
        const reason = err?.message || err?.error_description || err?.details || String(err);
        alert('ហត្ថលេខាត្រូវបានរក្សាទុកក្នុងឧបករណ៍នេះ ប៉ុន្តែមិនអាចរក្សាទុកក្នុង Cloud បានទេ។\n\nមូលហេតុ៖ ' + reason + '\n\nសូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត រួចផ្ទុករូបហត្ថលេខាឡើងវិញ ដើម្បីឱ្យមាតាបិតាមើលឃើញ។');
      } finally { setSaving(false); }
    } catch { alert('មិនអាចអានរូបភាពហត្ថលេខាបានទេ។'); }
  };
  const removeSig = () => {
    setSig('');
    // Clear every key resolveTeacherSig() might fall back to (canonical, raw grade,
    // and any same-subject variant) from cache + localStorage + cloud — otherwise
    // the signature would reappear from a historical key.
    const subj = afterHoursSubject(grade);
    const keys = new Set<string>([key, TEACHER_SIG_PREFIX + grade]);
    cachedKeysWithPrefix(TEACHER_SIG_PREFIX).forEach(k => keys.add(k));
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(TEACHER_SIG_PREFIX)) keys.add(k);
      }
    } catch { /* localStorage unavailable */ }
    keys.forEach(k => {
      const g = k.slice(TEACHER_SIG_PREFIX.length);
      const match = k === key || (subj ? afterHoursSubject(g) === subj : g === grade);
      if (!match) return;
      setCachedSetting(k, '');
      try { localStorage.removeItem(k); } catch { /* ignore */ }
      syncDeleteSetting(k).catch(() => { /* offline — cleared locally */ });
    });
  };

  return (
    <div className="flex flex-col items-center">
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {sig ? (
        <div className="relative flex flex-col items-center group">
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
        {/* Absolutely positioned so the (hidden) delete link adds NO vertical flow
            space — in flow it pushed the name down onto the certificate frame on
            screen. Shown + clickable only on hover. */}
        <button onClick={removeSig} title="លុបហត្ថលេខា" className="rc-no-print absolute inset-x-0 bottom-0 text-[10px] text-rose-500 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">លុបហត្ថលេខា</button>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="rc-no-print text-[10px] text-blue-500 hover:underline"
          style={{ marginTop: typeof height === 'number' ? Math.round(height * 0.5) : '2cqw' }}
        >
          បញ្ចូលហត្ថលេខាគ្រូ
        </button>
      )}
      {saving && <p className="rc-no-print text-[9px] text-emerald-600">កំពុងរក្សាទុកក្នុង Cloud...</p>}
      {name
        ? <p className="font-bold">{name}</p>
        : <p className="text-slate-300">..............................</p>}
    </div>
  );
}
