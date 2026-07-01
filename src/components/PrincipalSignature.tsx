/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { syncUpsertSetting, syncDeleteSetting } from '../lib/supabase';
import { downscaleImageFile } from '../utils/image';

// One shared principal signature, uploaded once and reused on every report/table.
// Stored locally and mirrored to the cloud (school_settings) so it appears on all
// devices — and on parents' report cards. See App.tsx settings-restore.
export const PRINCIPAL_SIG_KEY = 'school_principal_signature_v1';
export const PRINCIPAL_NAME = 'ផន សុភាក់';

export default function PrincipalSignature({ height = 88 }: { height?: number | string }) {
  const [sig, setSig] = useState<string>(() => {
    try { return localStorage.getItem(PRINCIPAL_SIG_KEY) || ''; } catch { return ''; }
  });
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      // Downscale so the data URL is small enough to store + sync (a raw phone
      // photo can exceed the cloud request limit → the save silently fails).
      const url = await downscaleImageFile(f);
      setSig(url);
      try { localStorage.setItem(PRINCIPAL_SIG_KEY, url); } catch { /* ignore */ }
      // Await the cloud save and surface a failure — a silently-dropped write
      // leaves the signature local-only and it never reaches parents' devices.
      setSaving(true);
      try {
        await syncUpsertSetting(PRINCIPAL_SIG_KEY, url);
      } catch (err: any) {
        const reason = err?.message || err?.error_description || err?.details || String(err);
        alert('ហត្ថលេខាត្រូវបានរក្សាទុកក្នុងឧបករណ៍នេះ ប៉ុន្តែមិនអាចរក្សាទុកក្នុង Cloud បានទេ។\n\nមូលហេតុ៖ ' + reason + '\n\nសូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត រួចផ្ទុករូបហត្ថលេខាឡើងវិញ។');
      } finally { setSaving(false); }
    } catch { alert('មិនអាចអានរូបភាពហត្ថលេខាបានទេ។'); }
  };
  const removeSig = () => {
    setSig('');
    try { localStorage.removeItem(PRINCIPAL_SIG_KEY); } catch { /* ignore */ }
    syncDeleteSetting(PRINCIPAL_SIG_KEY).catch(() => { /* offline — cleared locally */ });
  };

  return (
    <div className="flex flex-col items-center">
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {sig ? (
        <div className="relative flex flex-col items-center group">
        {/* mix-blend-multiply drops a WHITE background into the paper; brightness+
            contrast first knock a phone-photographed signature's dim grey paper up
            to white so no grey box shows on the certificate's parchment. */}
        <img
          src={sig}
          alt="ហត្ថលេខានាយក"
          onClick={() => ref.current?.click()}
          title="ចុចលើហត្ថលេខាដើម្បីប្តូរ"
          style={{ height, objectFit: 'contain', cursor: 'pointer', mixBlendMode: 'multiply', filter: 'brightness(1.18) contrast(1.9)' }}
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
          បញ្ចូលហត្ថលេខានាយក
        </button>
      )}
      {saving && <p className="rc-no-print text-[9px] text-emerald-600">កំពុងរក្សាទុកក្នុង Cloud...</p>}
      <p className="font-bold">{PRINCIPAL_NAME}</p>
    </div>
  );
}
