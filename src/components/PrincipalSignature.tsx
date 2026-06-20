/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { syncUpsertSetting } from '../lib/supabase';

// One shared principal signature, uploaded once and reused on every report/table.
// Stored locally and mirrored to the cloud (school_settings) so it appears on all
// devices — and on parents' report cards. See App.tsx settings-restore.
export const PRINCIPAL_SIG_KEY = 'school_principal_signature_v1';
export const PRINCIPAL_NAME = 'ផន សុភាក់';

export default function PrincipalSignature({ height = 88 }: { height?: number }) {
  const [sig, setSig] = useState<string>(() => {
    try { return localStorage.getItem(PRINCIPAL_SIG_KEY) || ''; } catch { return ''; }
  });
  const ref = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      setSig(url);
      try { localStorage.setItem(PRINCIPAL_SIG_KEY, url); } catch { /* ignore */ }
      syncUpsertSetting(PRINCIPAL_SIG_KEY, url).catch(() => { /* offline — saved locally */ });
    };
    r.readAsDataURL(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center">
      <input ref={ref} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {sig ? (
        <img
          src={sig}
          alt="ហត្ថលេខានាយក"
          onClick={() => ref.current?.click()}
          title="ចុចលើហត្ថលេខាដើម្បីប្តូរ"
          style={{ height, objectFit: 'contain', cursor: 'pointer' }}
        />
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="rc-no-print text-[10px] text-blue-500 hover:underline"
          style={{ marginTop: Math.round(height * 0.5) }}
        >
          បញ្ចូលហត្ថលេខានាយក
        </button>
      )}
      <p className="font-bold">{PRINCIPAL_NAME}</p>
    </div>
  );
}
