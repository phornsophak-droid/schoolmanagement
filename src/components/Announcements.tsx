/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The 🔔 ជូនដំណឹង panel, shared by the desktop shell and the Mobile Portal so both
// stay in sync. It holds three things:
//   • principal → writes a school announcement (KV, cloud-synced) and optionally
//     broadcasts it to the parent Telegram Group + every linked parent's bot chat.
//   • class teacher → sends a PRIVATE notice to their OWN class's parents via the
//     bot only (never the school-wide group).
//   • everyone → the read-only announcement feed.

import React, { useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { SchoolUser } from '../types';
import {
  Announcement, loadAnnouncements, refreshAnnouncementsFromCloud,
  saveAnnouncement, deleteAnnouncement, relativeKhmerDate,
} from '../lib/announcements';
import { sendAnnouncementToTelegram, sendClassNoticeToTelegram, fetchLinkedParentStats } from '../utils/reportSubmit';
import { toKh } from '../utils/schoolSummary';

interface Props {
  currentUser?: SchoolUser | null;
  // Lets a host (e.g. the bell badge) track the live count.
  onCountChange?: (n: number) => void;
}

export default function Announcements({ currentUser, onCountChange }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => loadAnnouncements());
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annHot, setAnnHot] = useState(false);
  const [annToTelegram, setAnnToTelegram] = useState(true);
  const [annBusy, setAnnBusy] = useState(false);
  const [annStatus, setAnnStatus] = useState<string | null>(null);

  useEffect(() => { refreshAnnouncementsFromCloud().then(setAnnouncements); }, []);
  useEffect(() => { onCountChange?.(announcements.length); }, [announcements.length]);

  const isPrincipal = currentUser?.role === 'principal';
  const isClassTeacher = currentUser?.role === 'teacher' && !!currentUser?.grade && currentUser.grade !== 'ទាំងអស់';

  // How many parents have linked the bot — so a sender knows the reach BEFORE
  // sending, instead of finding out afterwards that nobody was linked.
  const [linkStats, setLinkStats] = useState<{ total: number; byGrade: Record<string, number> } | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  useEffect(() => {
    if (!isPrincipal && !isClassTeacher) return;
    fetchLinkedParentStats().then(r => {
      if (r.ok) setLinkStats({ total: r.total || 0, byGrade: r.byGrade || {} });
      else setLinkErr(r.error || 'failed');
    });
  }, [isPrincipal, isClassTeacher]);
  const myClassLinked = linkStats && currentUser?.grade ? (linkStats.byGrade[currentUser.grade] || 0) : 0;

  // ---- Class notice (teacher → their OWN class's parents, bot only) ----
  const [noticeText, setNoticeText] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [noticeStatus, setNoticeStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const sendClassNotice = async () => {
    const msg = noticeText.trim();
    if (!msg || noticeBusy || !currentUser?.grade) return;
    setNoticeBusy(true); setNoticeStatus(null);
    try {
      const r = await sendClassNoticeToTelegram(msg, [currentUser.grade]);
      if (r.ok) {
        setNoticeStatus({ msg: `បានផ្ញើទៅមាតាបិតា ${toKh(r.sent ?? 0)} នាក់ ✓`, ok: true });
        setNoticeText('');
      } else {
        setNoticeStatus({
          msg: r.error === 'no-linked-parents' ? 'គ្មានមាតាបិតាណាភ្ជាប់ Bot ក្នុងថ្នាក់នេះទេ។'
            : r.error === 'no-secret' ? 'ផ្ញើមិនបាន — គ្មានពាក្យសម្ងាត់ Telegram។'
            : `ផ្ញើមិនបាន៖ ${r.error || ''}`,
          ok: false,
        });
      }
    } finally { setNoticeBusy(false); }
  };

  const publishAnnouncement = async () => {
    if (annBusy) return;
    if (!annTitle.trim() && !annBody.trim()) return;
    setAnnBusy(true); setAnnStatus(null);
    try {
      const title = annTitle.trim() || '📢 ជូនដំណឹង';
      const body = annBody.trim();
      const a: Announcement = {
        id: (crypto as any).randomUUID ? crypto.randomUUID() : `ann-${Date.now()}`,
        title, body, isHot: annHot,
        createdBy: currentUser?.name,
        createdAt: new Date().toISOString(),
      };
      setAnnouncements(await saveAnnouncement(a));
      let tg = '';
      if (annToTelegram) {
        const r = await sendAnnouncementToTelegram(`${title}${body ? `\n\n${body}` : ''}`);
        tg = r.ok ? ' · ផ្ញើ Telegram (Group + Bot) ✓'
          : r.error === 'no-secret' ? ' · Telegram មិនផ្ញើ (គ្មានពាក្យសម្ងាត់)'
          : ` · Telegram មិនផ្ញើ (${r.error || 'error'})`;
      }
      setAnnStatus(`បានផ្សាយ ✓${tg}`);
      setAnnTitle(''); setAnnBody(''); setAnnHot(false);
      setTimeout(() => setAnnStatus(null), 5000);
    } finally { setAnnBusy(false); }
  };

  const removeAnnouncement = async (id: string) => {
    if (!window.confirm('លុបជូនដំណឹងនេះ?')) return;
    setAnnouncements(await deleteAnnouncement(id));
  };

  return (
    <div className="space-y-3 text-left">
      {/* Class-teacher composer — private message to THIS class's parents via the bot. */}
      {isClassTeacher && (
        <div className="bg-white rounded-2xl p-3 border border-blue-100 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] font-bold text-blue-700 flex items-center gap-1.5">
              <Send size={11} /> ជូនដំណឹងដល់មាតាបិតា — {currentUser?.grade}
            </p>
            {linkStats && (
              <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${myClassLinked > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {myClassLinked > 0 ? `📩 ភ្ជាប់ Bot ${toKh(myClassLinked)} នាក់` : '⚠️ គ្មានមាតាបិតាភ្ជាប់ Bot'}
              </span>
            )}
          </div>
          <textarea
            value={noticeText}
            onChange={e => setNoticeText(e.target.value)}
            rows={3}
            placeholder="សរសេរសារជូនមាតាបិតាថ្នាក់របស់អ្នក…"
            className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-400 resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-slate-400">📩 ផ្ញើតាម Chat Bot ឯកជន (មិនចូល Group)</span>
            <button
              onClick={sendClassNotice}
              disabled={noticeBusy || !noticeText.trim()}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-1.5"
            >
              <Send size={12} /> {noticeBusy ? 'កំពុងផ្ញើ…' : 'ផ្ញើ'}
            </button>
          </div>
          {noticeStatus && <p className={`text-[9.5px] font-bold pt-0.5 ${noticeStatus.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{noticeStatus.msg}</p>}
        </div>
      )}

      {/* Principal composer — publish to every device (+ optional Telegram). */}
      {isPrincipal && (
        <div className="bg-white rounded-2xl p-3 border border-emerald-100 space-y-2">
          {/* Reach: how many parents will receive the Telegram broadcast. */}
          {linkStats && (
            <details className="text-[10px]">
              <summary className="cursor-pointer font-bold text-slate-500 list-none flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded border ${linkStats.total > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  📩 មាតាបិតាភ្ជាប់ Bot៖ {toKh(linkStats.total)} នាក់
                </span>
                <span className="text-slate-400 font-semibold">(មើលតាមថ្នាក់)</span>
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(Object.entries(linkStats.byGrade) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([g, n]) => (
                  <span key={g} className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
                    {g} <b className="text-slate-800">{toKh(n)}</b>
                  </span>
                ))}
              </div>
            </details>
          )}
          {linkErr === 'no-secret' && (
            <p className="text-[9.5px] font-bold text-slate-400">ចំនួនមាតាបិតាភ្ជាប់ Bot — មិនអាចទាញបាន (គ្មានពាក្យសម្ងាត់ Telegram)។</p>
          )}
          <input
            value={annTitle}
            onChange={e => setAnnTitle(e.target.value)}
            placeholder="ចំណងជើង (ឧ. 📢 ប្រកាសពីសាលា)"
            className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none focus:border-emerald-400"
          />
          <textarea
            value={annBody}
            onChange={e => setAnnBody(e.target.value)}
            rows={3}
            placeholder="សរសេរខ្លឹមសារជូនដំណឹង…"
            className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-400 resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
                <input type="checkbox" checked={annHot} onChange={e => setAnnHot(e.target.checked)} className="accent-red-500" />
                🔥 សំខាន់
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
                <input type="checkbox" checked={annToTelegram} onChange={e => setAnnToTelegram(e.target.checked)} className="accent-blue-500" />
                ✈️ Telegram (Group + Bot)
              </label>
            </div>
            <button
              onClick={publishAnnouncement}
              disabled={annBusy || (!annTitle.trim() && !annBody.trim())}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5"
            >
              <Send size={12} /> {annBusy ? 'កំពុងផ្សាយ…' : 'ផ្សាយ'}
            </button>
          </div>
          {annStatus && <p className="text-[9.5px] font-bold text-emerald-600 pt-0.5">{annStatus}</p>}
        </div>
      )}

      {/* Announcement feed */}
      <div className="space-y-2.5">
        {announcements.length === 0 ? (
          <div className="bg-white/70 rounded-2xl p-6 border border-dashed border-emerald-200 text-center text-[10px] text-slate-400">
            មិនទាន់មានជូនដំណឹងនៅឡើយ។{isPrincipal ? ' សរសេរខាងលើ ដើម្បីផ្សាយ។' : ''}
          </div>
        ) : announcements.map(a => (
          <div key={a.id} className="bg-white p-3 rounded-xl border border-emerald-100 text-[10px] relative overflow-hidden">
            {a.isHot && (
              <div className="absolute top-0 right-0 bg-red-500 text-white font-extrabold text-[6.5px] uppercase px-1.5 py-0.5 rounded-bl">HOT</div>
            )}
            <p className="font-black text-slate-800 pr-8 leading-snug">{a.title}</p>
            {a.body && <p className="text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{a.body}</p>}
            <div className="flex justify-between items-center text-[8px] text-slate-400 mt-2">
              <span>🕒 {relativeKhmerDate(a.createdAt)}{a.createdBy ? ` · ${a.createdBy}` : ''}</span>
              {isPrincipal && (
                <button onClick={() => removeAnnouncement(a.id)} className="text-rose-500 hover:text-rose-600 flex items-center gap-0.5 font-bold">
                  <Trash2 size={11} /> លុប
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
