/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { KeyRound, RotateCcw, Users, Check } from 'lucide-react';
import { ParentAccount, ParentAccounts, getPasscode, setPasscode, refreshAccounts, resetAccount } from '../lib/parentAuth';

// Principal-only admin for the Parent Portal login: set the shared passcode and
// view/reset each family's saved password. Self-contained (loads and saves its own
// state via the parentAuth KV helpers). Rendered inside the dark settings modal.
export default function ParentPortalAdmin() {
  const [code, setCode] = useState('');
  const [accts, setAccts] = useState<ParentAccounts>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    getPasscode().then(setCode).catch(() => {});
    refreshAccounts().then(setAccts).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try { await setPasscode(code); setSaved(true); setTimeout(() => setSaved(false), 1500); }
    finally { setBusy(false); }
  };
  const reset = async (key: string) => {
    if (!confirm('លុបលេខសម្ងាត់ផ្ទាល់ខ្លួនរបស់គ្រួសារនេះ? ពួកគេនឹងត្រូវប្រើលេខសម្ងាត់រួមម្ដងទៀត។')) return;
    setAccts(await resetAccount(key));
  };

  const entries = Object.entries(accts) as [string, ParentAccount][];

  return (
    <div className="mt-3 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-left space-y-3">
      <div className="flex items-center gap-2 text-emerald-300 text-[11px] font-bold">
        <KeyRound size={14} /> Parent Portal — ការចូលរបស់មាតាបិតា
      </div>
      <p className="text-[9.5px] text-slate-400 leading-relaxed">
        មាតាបិតាចូលលើកដំបូងដោយ <b className="text-slate-300">ឈ្មោះកូន + លេខសម្ងាត់រួម</b>នេះ រួចអាចប្ដូរលេខសម្ងាត់ផ្ទាល់ខ្លួន។ គ្មានលេខសម្ងាត់រួម = មាតាបិតាចូលមិនបាន។
      </p>

      <div className="space-y-1.5">
        <label className="block text-slate-400 text-[10px] font-bold">លេខសម្ងាត់រួម (SHARED PASSCODE)</label>
        <div className="flex items-center gap-2">
          <input
            type={reveal ? 'text' : 'password'}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="ឧ. ccc2026"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:border-[#3ECF8E] focus:outline-none placeholder:text-slate-600 font-mono text-[11px] text-slate-100 transition-colors"
          />
          <button onClick={() => setReveal(r => !r)} className="px-2 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl">{reveal ? 'លាក់' : 'បង្ហាញ'}</button>
          <button onClick={save} disabled={busy} className="px-3 py-2 text-[11px] font-bold text-slate-900 bg-[#3ECF8E] hover:brightness-95 rounded-xl disabled:opacity-60 flex items-center gap-1">
            {saved ? <><Check size={13} /> រួច</> : 'រក្សាទុក'}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-slate-400 text-[10px] font-bold flex items-center gap-1"><Users size={12} /> គណនីមាតាបិតា ({entries.length})</label>
        </div>
        {entries.length === 0 ? (
          <p className="text-[9.5px] text-slate-500">មិនទាន់មានមាតាបិតាចូលនៅឡើយ។</p>
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
            {entries.map(([key, a]) => (
              <div key={key} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-200 font-semibold truncate">{a.name.replace(/\s*\([^)]*\)\s*$/, '')}</p>
                  <p className="text-[9px] text-slate-500 truncate">{a.grade}{a.studentId ? ` · ${a.studentId}` : ''} · {reveal ? a.password : '••••'}</p>
                </div>
                <button onClick={() => reset(key)} title="Reset ទៅលេខសម្ងាត់រួម" className="shrink-0 px-2 py-1 text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-1">
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
