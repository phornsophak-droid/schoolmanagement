import React, { useEffect, useMemo, useState } from 'react';
import { X, Archive, Download, Cloud, CheckCircle, Loader2, ShieldCheck, Clock, Eye, Search, ArrowLeft } from 'lucide-react';
import { loadScores } from '../utils/scoresStore';
import { loadAttendance } from '../utils/attendanceStore';
import { getAcademicYear, getStartYear } from '../lib/schoolYear';
import { syncUpsertSetting, fetchSetting } from '../lib/supabase';
import { getCachedSetting, setCachedSetting } from '../lib/settingsCache';
import type { StudentScore } from '../types';

// niddes letter for a 0–10 average (same bands as the report cards).
const niddes = (v: number | null | undefined): string =>
  (v == null || v <= 0) ? '' : v >= 9 ? 'A' : v >= 8 ? 'B' : v >= 7 ? 'C' : v >= 6 ? 'D' : v >= 5 ? 'E' : 'F';
const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

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
  // Read-only in-app viewer for a saved archive.
  const [viewing, setViewing] = useState<{ year: string; scores: StudentScore[] } | null>(null);
  const [viewBusy, setViewBusy] = useState('');
  const [viewGrade, setViewGrade] = useState('ទាំងអស់');
  const [viewSearch, setViewSearch] = useState('');

  useEffect(() => { if (open) { setIndex(readIndex()); setDownloaded(false); setCloudDone(false); setViewing(null); } }, [open]);

  const viewGrades = useMemo(() => viewing ? Array.from(new Set(viewing.scores.map(s => s.grade))).sort() : [], [viewing]);
  const viewRows = useMemo(() => {
    if (!viewing) return [];
    const q = viewSearch.trim().toLowerCase();
    return viewing.scores.filter(s =>
      (viewGrade === 'ទាំងអស់' || s.grade === viewGrade) &&
      (!q || (s.name || '').toLowerCase().includes(q) || (s.grade || '').toLowerCase().includes(q))
    );
  }, [viewing, viewGrade, viewSearch]);

  if (!open) return null;

  // Read-only table of an opened archive — the easy "view a past year" screen.
  if (viewing) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 gap-2">
            <button onClick={() => setViewing(null)} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 shrink-0"><ArrowLeft size={14} /> ត្រឡប់</button>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 min-w-0 truncate"><Eye size={15} className="text-indigo-500 shrink-0" /> ឆ្នាំ <span className="font-mono">{viewing.year}</span></h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg shrink-0"><X size={16} /></button>
          </div>
          <div className="p-3 border-b border-slate-100 flex gap-2 shrink-0">
            <select value={viewGrade} onChange={e => setViewGrade(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 max-w-[45%]">
              <option>ទាំងអស់</option>
              {viewGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={viewSearch} onChange={e => setViewSearch(e.target.value)} placeholder="ស្វែងរកឈ្មោះ..." className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700" />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-slate-500 font-bold">
                  <th className="px-3 py-2 w-10">ល.រ</th><th className="px-3 py-2">ឈ្មោះ</th><th className="px-3 py-2">ថ្នាក់</th>
                  <th className="px-3 py-2 text-center">ខែ</th><th className="px-3 py-2 text-center">មធ្យមភាគ</th><th className="px-3 py-2 text-center">និទ្ទេស</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {viewRows.slice(0, 1000).map((s, i) => (
                  <tr key={(s.id || '') + i} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-800 whitespace-nowrap">{s.name}</td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{s.grade}</td>
                    <td className="px-3 py-1.5 text-center text-slate-600 whitespace-nowrap">{s.month}</td>
                    <td className="px-3 py-1.5 text-center font-mono">{s.overallAvg != null ? toKh(s.overallAvg.toFixed(2)) : '-'}</td>
                    <td className="px-3 py-1.5 text-center font-bold">{niddes(s.overallAvg) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewRows.length === 0 && <p className="text-center text-xs text-slate-400 py-8">គ្មានទិន្នន័យ។</p>}
            {viewRows.length > 1000 && <p className="text-center text-[10px] text-slate-400 py-2">បង្ហាញ ១០០០ ដំបូង — សូមប្រើ filter ថ្នាក់ ឬស្វែងរក។</p>}
          </div>
          <div className="p-2 border-t border-slate-100 text-center text-[10px] text-slate-400 shrink-0">{toKh(viewRows.length)} កំណត់ត្រា · មើលតែប៉ុណ្ណោះ (read-only)</div>
        </div>
      </div>
    );
  }

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
      const jsonStr = JSON.stringify(snap);
      const meta: ArchiveMeta = { year, savedAt: snap.savedAt, scores: snap.scores.length, attendance: snap.attendance.length };
      const next = [meta, ...readIndex().filter(m => m.year !== year)];
      const idxStr = JSON.stringify(next);
      // Local-first: cache the blob + index so it's viewable right away and survives
      // an offline/failed cloud. The index is small enough to keep in localStorage;
      // the (large) blob stays in the memory cache only.
      setCachedSetting(archiveKey(year), jsonStr);
      setCachedSetting(INDEX_KEY, idxStr);
      try { localStorage.setItem(INDEX_KEY, idxStr); } catch { /* ignore */ }
      setIndex(next);
      setCloudDone(true);
      // Best-effort cloud sync so it's viewable from other devices.
      try {
        await syncUpsertSetting(archiveKey(year), jsonStr);
        await syncUpsertSetting(INDEX_KEY, idxStr);
      } catch (e: any) {
        alert('រក្សាទុកក្នុងឧបករណ៍នេះរួច ✓ ប៉ុន្តែ Cloud sync បរាជ័យ — សូម «ទាញយក Backup» ដើម្បីសុវត្ថិភាព។\n\n' + String(e?.message || e));
      }
    } finally { setCloudBusy(false); }
  };

  // Open a saved archive read-only in the app (the easy per-year view).
  const readArchive = async (yr: string): Promise<string> => {
    const cached = getCachedSetting(archiveKey(yr));
    if (cached) return cached;
    try { return (await fetchSetting(archiveKey(yr))) || ''; } catch { return ''; }
  };

  const doView = async (m: ArchiveMeta) => {
    setViewBusy(m.year);
    try {
      const raw = await readArchive(m.year);
      if (!raw) { alert('រកមិនឃើញទិន្នន័យ archive នេះ (សូមបើកលើឧបករណ៍ដែលបានរក្សាទុក ឬពិនិត្យ Cloud)។'); return; }
      const snap = JSON.parse(raw);
      setViewing({ year: m.year, scores: Array.isArray(snap.scores) ? snap.scores : [] });
      setViewGrade('ទាំងអស់'); setViewSearch('');
    } catch (e: any) {
      alert('មិនអាចបើកបានទេ៖ ' + String(e?.message || e));
    } finally { setViewBusy(''); }
  };

  const downloadCloudArchive = async (m: ArchiveMeta) => {
    setBusyYear(m.year);
    try {
      const raw = await readArchive(m.year);
      if (!raw) { alert('រកមិនឃើញទិន្នន័យ archive នេះ។'); return; }
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
                      onClick={() => doView(m)}
                      disabled={viewBusy === m.year}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shrink-0 disabled:opacity-60"
                    >
                      {viewBusy === m.year ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} មើល
                    </button>
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
