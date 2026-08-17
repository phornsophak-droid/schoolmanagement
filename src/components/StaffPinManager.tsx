import React, { useMemo, useState } from 'react';
import { X, Eye, EyeOff, KeyRound, ShieldAlert, RotateCcw, CheckCircle, Search } from 'lucide-react';
import { AVAILABLE_USERS } from './LoginPortal';
import { getPinForUser, setPinForUser, getEmergencyPin, setEmergencyPin } from '../utils/auth';

// Principal-only view of every staff account's login password. Passwords are kept
// readable BY DESIGN (same model as the SOF app member passwords) so the principal
// can help a teacher who forgot theirs — teachers can still change their own from
// the in-app "ផ្លាស់ប្តូរលេខកូដ" button. This screen is gated to role==='principal'
// by the caller. It never appears on the public login screen.
const defaultPin = (role: string) => (role === 'principal' ? '1111' : '1234');

export default function StaffPinManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reveal, setReveal] = useState(false);
  const [query, setQuery] = useState('');
  // Local editable copy keyed by user id, seeded from the stored pins.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string>('');
  // Emergency principal PIN (break-glass).
  const storedEm = useMemo(() => getEmergencyPin(), [open]);
  const [emDraft, setEmDraft] = useState<string | null>(null);
  const [emSaved, setEmSaved] = useState(false);
  const emValue = emDraft ?? storedEm;
  // Re-read stored pins whenever the modal (re)opens.
  const stored = useMemo(() => {
    const m: Record<string, string> = {};
    AVAILABLE_USERS.forEach(u => { m[u.id] = getPinForUser(u.id, u.role); });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveEmergency = () => {
    const v = (emValue || '').trim();
    if (v && v.length < 4) { alert('លេខសង្គ្រោះត្រូវមានយ៉ាងតិច ៤ ខ្ទង់'); return; }
    setEmergencyPin(v);
    setEmDraft(null);
    setEmSaved(true);
    setTimeout(() => setEmSaved(false), 1500);
  };

  if (!open) return null;

  const valueFor = (id: string) => (id in draft ? draft[id] : stored[id]) || '';
  const dirty = (id: string) => id in draft && draft[id] !== stored[id];

  const flashSaved = (id: string) => { setSavedId(id); setTimeout(() => setSavedId(s => (s === id ? '' : s)), 1500); };

  const save = (id: string) => {
    const v = (draft[id] ?? '').trim();
    if (v.length < 4) { alert('លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៤ ខ្ទង់'); return; }
    setPinForUser(id, v);
    stored[id] = v;               // reflect immediately
    setDraft(d => { const n = { ...d }; delete n[id]; return n; });
    flashSaved(id);
  };

  const reset = (u: { id: string; role: string }) => {
    const d = defaultPin(u.role);
    setPinForUser(u.id, d);
    stored[u.id] = d;
    setDraft(dd => { const n = { ...dd }; delete n[u.id]; return n; });
    flashSaved(u.id);
  };

  const q = query.trim().toLowerCase();
  const list = AVAILABLE_USERS.filter(u =>
    !q || u.name.toLowerCase().includes(q) || (u.grade || '').toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <KeyRound size={16} className="text-amber-500" />
            គ្រប់គ្រងលេខសម្ងាត់គ្រូ
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setReveal(r => !r)}
              className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              title={reveal ? 'លាក់លេខសម្ងាត់' : 'បង្ហាញលេខសម្ងាត់'}
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              {reveal ? 'លាក់' : 'បង្ហាញ'}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-slate-100 bg-amber-50/60 shrink-0">
          <p className="text-[11px] text-amber-800 flex items-start gap-1.5 font-medium leading-relaxed">
            <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
            សម្រាប់នាយកសាលាតែប៉ុណ្ណោះ។ ព័ត៌មាននេះជាការសម្ងាត់ — កុំបង្ហាញអ្នកដទៃ។ គ្រូអាចប្តូរលេខសម្ងាត់ខ្លួនឯងបាន ក្នុងកម្មវិធី។
          </p>
        </div>

        <div className="p-3 border-b border-slate-100 shrink-0 bg-rose-50/50">
          <label className="block text-[11px] font-bold text-rose-800 mb-1.5 flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-rose-500" />
            លេខសម្ងាត់សង្គ្រោះនាយក (ចូលពេលភ្លេច password ឬ អ៊ីនធឺណិតដាច់)
          </label>
          <div className="flex gap-2">
            <input
              type={reveal ? 'text' : 'password'}
              value={emValue}
              maxLength={12}
              onChange={e => setEmDraft(e.target.value)}
              placeholder="កំណត់លេខ ៦ ខ្ទង់"
              className="flex-1 px-3 py-2 border border-rose-200 rounded-lg font-mono text-center text-sm font-bold text-slate-800 focus:outline-none focus:border-rose-500 bg-white"
            />
            <button
              onClick={saveEmergency}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
            >
              {emSaved ? <><CheckCircle size={13} /> រួច</> : 'រក្សាទុក'}
            </button>
          </div>
          <p className="text-[10px] text-rose-700/80 mt-1">សម្ងាត់ខ្លាំង។ ទុកទទេ = បិទ។</p>
        </div>

        <div className="p-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះ ឬ ថ្នាក់..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-3 space-y-2">
          {list.map(u => (
            <div key={u.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-150 bg-white">
              <div className={`w-9 h-9 rounded-lg ${u.avatarBg} flex items-center justify-center text-white text-[11px] font-bold shrink-0`}>
                {u.photoCode}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {u.role === 'principal' ? 'នាយកសាលា' : u.grade}
                </p>
              </div>
              <input
                type={reveal ? 'text' : 'password'}
                value={valueFor(u.id)}
                maxLength={12}
                onChange={e => setDraft(d => ({ ...d, [u.id]: e.target.value }))}
                className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg font-mono text-center text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
              {dirty(u.id) ? (
                <button
                  onClick={() => save(u.id)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  title="រក្សាទុក"
                >
                  <CheckCircle size={13} /> រក្សាទុក
                </button>
              ) : savedId === u.id ? (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 shrink-0 w-[62px] justify-center">
                  <CheckCircle size={13} /> រួច
                </span>
              ) : (
                <button
                  onClick={() => reset(u)}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors shrink-0 w-[62px] flex items-center justify-center gap-1 text-[10px] font-bold"
                  title="កំណត់ជាលេខសម្ងាត់ដើមឡើងវិញ"
                >
                  <RotateCcw size={13} /> ដើម
                </button>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">រកមិនឃើញគណនី។</p>
          )}
        </div>
      </div>
    </div>
  );
}
