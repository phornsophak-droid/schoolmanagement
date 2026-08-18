/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, Lock, User, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { hardRefresh } from '../utils/hardRefresh';
import { ChildRow, parentLogin, changeParentPassword, saveSession } from '../lib/parentAuth';
import InstallPWAButton from './InstallPWAButton';

interface Props {
  onBack: () => void;
  onLogin: (child: ChildRow) => void;
}

// Login gate for the Parent Portal: child's name + password. First time uses the
// school's shared passcode; then the parent may set a personal password.
export default function ParentLogin({ onBack, onLogin }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<ChildRow[]>([]);

  // First-login "set your own password" step.
  const [child, setChild] = useState<ChildRow | null>(null);
  // Signed session token from the secure server proxy (Phase 2), stashed at login
  // so it's carried into the session after the optional set-password step.
  const [token, setToken] = useState<string | undefined>(undefined);
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');

  const errText = (e?: string) => {
    switch (e) {
      case 'noName': return 'រកមិនឃើញឈ្មោះកូននេះទេ។ សូមពិនិត្យអក្ខរាវិរុទ្ធ ឬទាក់ទងសាលា។';
      case 'ambiguous': return 'មានកូនច្រើននាក់ឈ្មោះស្រដៀងគ្នា។ សូមវាយឈ្មោះឱ្យពេញលេញ។';
      case 'wrongPass': return 'លេខសម្ងាត់មិនត្រឹមត្រូវ។';
      case 'noPasscode': return 'សាលាមិនទាន់កំណត់លេខសម្ងាត់រួមទេ។ សូមទាក់ទងសាលា។';
      default: return 'មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត។';
    }
  };

  const submit = async () => {
    if (!name.trim() || !password) { setError('សូមបំពេញឈ្មោះកូន និងលេខសម្ងាត់។'); return; }
    setBusy(true); setError(''); setMatches([]);
    try {
      const r = await parentLogin(name, password);
      if (r.ok && r.child) {
        setToken(r.token);
        if (r.firstTime) { setChild(r.child); } // offer to set a personal password
        else { saveSession({ ...r.child, token: r.token }); onLogin(r.child); }
      } else {
        setError(errText(r.error));
        if (r.matches) setMatches(r.matches);
      }
    } catch {
      setError('ការតភ្ជាប់មានបញ្ហា។ សូមព្យាយាមម្ដងទៀត។');
    } finally {
      setBusy(false);
    }
  };

  const finishFirstLogin = async (setNew: boolean) => {
    if (!child) return;
    if (setNew) {
      if (newPass.length < 4) { setError('លេខសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៤ តួ។'); return; }
      if (newPass !== newPass2) { setError('លេខសម្ងាត់ថ្មីមិនដូចគ្នា។'); return; }
      setBusy(true);
      try { await changeParentPassword(child, newPass); } catch { /* saved locally */ }
      setBusy(false);
    }
    saveSession({ ...child, token });
    onLogin(child);
  };

  // ── first-login: set a personal password ───────────────────────────────────
  if (child) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">🔐</div>
            <h2 className="text-lg font-black text-slate-800">ស្វាគមន៍!</h2>
            <p className="text-sm text-slate-500 mt-1">ចូលជាមួយ <b className="text-emerald-700">{child.name.replace(/\s*\([^)]*\)\s*$/, '')}</b> បានជោគជ័យ។</p>
            <p className="text-xs text-slate-400 mt-2">សូមកំណត់លេខសម្ងាត់ផ្ទាល់ខ្លួន (ជំនួសលេខសម្ងាត់រួម) ដើម្បីសុវត្ថិភាព។</p>
          </div>
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="លេខសម្ងាត់ថ្មី" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
          <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="បញ្ជាក់លេខសម្ងាត់ថ្មី" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
          {error && <p className="text-xs text-rose-500 font-semibold text-center">{error}</p>}
          <button onClick={() => finishFirstLogin(true)} disabled={busy} className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2 disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} កំណត់លេខសម្ងាត់ថ្មី
          </button>
          <button onClick={() => finishFirstLogin(false)} disabled={busy} className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">រំលង (ប្រើលេខសម្ងាត់រួមសិន)</button>
        </div>
      </div>
    );
  }

  // ── main login ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col p-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-emerald-100 text-slate-600 flex items-center gap-1 text-sm font-semibold">
          <ArrowLeft size={18} /> ត្រឡប់ក្រោយ
        </button>
        <button onClick={hardRefresh} title="ធ្វើឱ្យទាន់សម័យ (សម្អាត cache)" className="p-2 rounded-full hover:bg-emerald-100 text-slate-500 flex items-center gap-1 text-xs font-semibold">
          <RefreshCw size={15} /> ធ្វើឱ្យទាន់សម័យ
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><Lock className="text-emerald-600" size={28} /></div>
            <h2 className="text-lg font-black text-slate-800">ចូល Parent Portal</h2>
            <p className="text-xs text-slate-500 mt-1">សម្រាប់មាតាបិតាសិស្ស — មើលព្រឹត្តបត្រកូនរបស់អ្នក</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><User size={13} className="text-emerald-600" /> ឈ្មោះកូន</label>
            <input value={name} onChange={e => { setName(e.target.value); setError(''); setMatches([]); }} placeholder="ឧ. គ ចិត្រា" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><KeyRound size={13} className="text-emerald-600" /> លេខសម្ងាត់</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="លេខសម្ងាត់រួម (លើកដំបូង)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-slate-700" />
          </div>

          {error && <p className="text-xs text-rose-500 font-semibold text-center">{error}</p>}
          {matches.length > 1 && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2 space-y-0.5">
              {matches.slice(0, 6).map((m, i) => <div key={i}>• {m.name.replace(/\s*\([^)]*\)\s*$/, '')} ({m.grade})</div>)}
            </div>
          )}

          <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-60">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />} ចូល
          </button>
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">លើកដំបូង សូមប្រើ <b>លេខសម្ងាត់រួម</b>ដែលសាលាផ្ដល់ឱ្យ រួចអ្នកអាចប្ដូរលេខសម្ងាត់ផ្ទាល់ខ្លួន។</p>
        </div>
        {/* Android/Chrome: one-tap install with the school logo (no menu hunting). */}
        <InstallPWAButton className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/25" />
      </div>
    </div>
  );
}
