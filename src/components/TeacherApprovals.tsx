import React, { useEffect, useState } from 'react';
import { listPendingStaff, setStaffActive, removeStaff, StaffProfile } from '../lib/auth';
import { AVAILABLE_USERS } from './LoginPortal';
import { UserCheck, X, Check, Trash2 } from 'lucide-react';

// The staff row's `username` is the app account id (e.g. teacher_g6); map it to
// the readable class label so the principal knows which class registered.
const gradeFor = (username: string) =>
  AVAILABLE_USERS.find(u => u.id === username)?.grade || username;

interface Props { open: boolean; onClose: () => void; }

export default function TeacherApprovals({ open, onClose }: Props) {
  const [pending, setPending] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setPending(await listPendingStaff());
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);

  if (!open) return null;

  const approve = async (id: string) => {
    setBusy(id);
    if (await setStaffActive(id, true)) await load();
    else alert('អនុម័តមិនបានសម្រេច (សូមប្រាកដថាអ្នកចូលជានាយកតាម Email)');
    setBusy(null);
  };
  const reject = async (id: string) => {
    if (!window.confirm('បដិសេធ និងលុបការចុះឈ្មោះនេះ?')) return;
    setBusy(id);
    if (await removeStaff(id)) await load();
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-600" /> គ្រូរង់ចាំការអនុម័ត
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-1"><X size={18} /></button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-center text-slate-400 text-sm py-8">កំពុងផ្ទុក...</p>
          ) : pending.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">គ្មានគ្រូរង់ចាំការអនុម័តទេ</p>
          ) : (
            <div className="space-y-2">
              {pending.map(s => (
                <div key={s.id} className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 truncate">{s.full_name}</div>
                    <div className="text-xs text-slate-500">{gradeFor(s.username)}</div>
                  </div>
                  <button
                    disabled={busy === s.id}
                    onClick={() => approve(s.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Check size={13} /> អនុម័ត
                  </button>
                  <button
                    disabled={busy === s.id}
                    onClick={() => reject(s.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50 shrink-0"
                    title="បដិសេធ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
            គ្រូដែលអនុម័តរួច អាចចូលបានភ្លាម (តាមប៊ូតុង «ចូលដោយ Email»)។ ការអនុម័តត្រូវការនាយកចូលតាម Email ជាមុន។
          </p>
        </div>
      </div>
    </div>
  );
}
