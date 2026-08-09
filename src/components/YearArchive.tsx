import React, { useEffect, useState } from 'react';
import { X, Archive, Download, Cloud, CheckCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { loadScores } from '../utils/scoresStore';
import { loadAttendance } from '../utils/attendanceStore';
import { getAcademicYear, getStartYear } from '../lib/schoolYear';
import { syncUpsertSetting, fetchSetting } from '../lib/supabase';
import { getCachedSetting, setCachedSetting } from '../lib/settingsCache';

// Year-End Archive (Option A). Saves a COMPLETE, read-only snapshot of a school
// year's data (scores + that year's attendance + the class list) so it is never
// lost when a new year begins. Scores are stored keyed only by month name — they
// have no year — so without archiving, next year's marks would overwrite this
// year's. This tool is PURELY additive: it copies the data out, it never deletes
// or changes the live data. Starting/clearing the new year is a separate,
// deliberately-not-automated step.

const INDEX_KEY = 'year_archive_index';           // small: list of saved years
const archiveKey = (year: string) => `year_archive::${year}`;

interface ArchiveMeta { year: string; savedAt: string; scores: number; attendance: number }

function buildSnapshot() {
  const schoolYear = getAcademicYear();
  const scores = loadScores();
  const start = getStartYear();
  // This year's attendance = dates within Sep(start) … Aug(start+1). Attendance
  // records carry a real date, so they're already year-separated; we scope the
  // archive to this year. If the date format doesn't match, keep them all.
  const from = `${start}-09-01`, to = `${start + 1}-08-31`;
  const all = loadAttendance();
  let attendance = all.filter(r => { const d = String(r.date || ''); return d >= from && d <= to; });
  if (attendance.length === 0 && all.length > 0) attendance = all;
  return { schoolYear, savedAt: new Date().toISOString(), scores, attendance };
}

const downloadJson = (obj: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const readIndex = (): ArchiveMeta[] => {
  try { return JSON.parse(getCachedSetting(INDEX_KEY) || localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; }
};

export default function YearArchive({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [downloaded, setDownloaded] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudDone, setCloudDone] = useState(false);
  const [index, setIndex] = useState<ArchiveMeta[]>([]);
  const [busyYear, setBusyYear] = useState('');

  useEffect(() => { if (open) { setIndex(readIndex()); setDownloaded(false); setCloudDone(false); } }, [open]);
  if (!open) return null;

  const year = getAcademicYear();
  const scoreCount = loadScores().length;
  const attCount = loadAttendance().length;

  const doDownload = () => {
    const snap = buildSnapshot();
    downloadJson(snap, `Archive_${year}.json`);
    setDownloaded(true);
  };

  const doCloud = async () => {
    setCloudBusy(true);
    try {
      const snap = buildSnapshot();
      await syncUpsertSetting(archiveKey(year), JSON.stringify(snap));
      const meta: ArchiveMeta = { year, savedAt: snap.savedAt, scores: snap.scores.length, attendance: snap.attendance.length };
      const next = [meta, ...readIndex().filter(m => m.year !== year)];
      const idxStr = JSON.stringify(next);
      setCachedSetting(INDEX_KEY, idxStr);
      try { localStorage.setItem(INDEX_KEY, idxStr); } catch { /* ignore */ }
      await syncUpsertSetting(INDEX_KEY, idxStr);
      setIndex(next);
      setCloudDone(true);
    } catch (e: any) {
      alert('មិនអាចរក្សាទុកទៅ Cloud បានទេ។ សូមប្រើ «ទាញយក Backup» ជំនួស។\n\n' + String(e?.message || e));
    } finally { setCloudBusy(false); }
  };

  const downloadCloudArchive = async (m: ArchiveMeta) => {
    setBusyYear(m.year);
    try {
      const raw = await fetchSetting(archiveKey(m.year));
      if (!raw) { alert('រកមិនឃើញទិន្នន័យ archive នេះក្នុង Cloud ទេ។'); return; }
      downloadJson(JSON.parse(raw), `Archive_${m.year}.json`);
    } catch (e: any) {
      alert('មិនអាចទាញយកបានទេ៖ ' + String(e?.message || e));
    } finally { setBusyYear(''); }
  };

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleString('en-GB'); } catch { return iso; } };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Archive size={16} className="text-indigo-500" /> រក្សាទុកទិន្នន័យឆ្នាំសិក្សា
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-[12px] text-emerald-800 leading-relaxed">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            រក្សាទុកទិន្នន័យឆ្នាំបច្ចុប្បន្នទុកមុនចូលឆ្នាំថ្មី។ <b>មិនលុប ឬប្តូរទិន្នន័យបច្ចុប្បន្នទេ</b> — គ្រាន់តែចម្លងទុក។
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="text-xl font-black text-slate-800 font-mono">{year}</div>
              <div className="text-[11px] text-slate-500 mt-1">ពិន្ទុ <b>{scoreCount.toLocaleString()}</b> · វត្តមាន <b>{attCount.toLocaleString()}</b> កំណត់ត្រា</div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={doDownload}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {downloaded ? <CheckCircle size={15} /> : <Download size={15} />} {downloaded ? 'ទាញយករួច' : 'ទាញយក Backup'}
              </button>
              <button
                onClick={doCloud}
                disabled={cloudBusy}
                className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {cloudBusy ? <Loader2 size={15} className="animate-spin" /> : cloudDone ? <CheckCircle size={15} /> : <Cloud size={15} />} {cloudDone ? 'រក្សាទុករួច' : 'ទៅ Cloud'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">«ទាញយក Backup» = ឯកសារ (.json) ទុកក្នុងទូរស័ព្ទ/កុំព្យូទ័រ។ «ទៅ Cloud» = មើលបានគ្រប់ឧបករណ៍។</p>
          </div>

          {index.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock size={12} /> Archive ដែលបានរក្សាទុក (Cloud)</h4>
              <div className="space-y-2">
                {index.map(m => (
                  <div key={m.year} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-150 bg-slate-50/60">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 font-mono">{m.year}</div>
                      <div className="text-[10px] text-slate-500">{fmt(m.savedAt)} · ពិន្ទុ {m.scores.toLocaleString()} · វត្តមាន {m.attendance.toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => downloadCloudArchive(m)}
                      disabled={busyYear === m.year}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0 disabled:opacity-60"
                    >
                      {busyYear === m.year ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} ទាញយក
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
