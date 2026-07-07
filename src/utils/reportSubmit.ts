/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Submission of the monthly work reports. The report itself is delivered to the
// principal as a PDF in Telegram — it is NOT stored in the cloud. All we keep is a
// LOCAL, lightweight log ('report_submissions' in localStorage) marking that a
// report was sent, so the teacher's device can show "បានបញ្ជូន ✓". The submit
// time becomes the report's printed date.

import { syncUpsertSetting, fetchSetting } from '../lib/supabase';
import { renderElementToPdfDataUrl } from './exportPdf';
import { khmerLunarFull } from './khmerDate';

const STORE = 'report_submissions';
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

export interface ReportSubmission {
  key: string;        // the report's localStorage storeKey — unique per grade+period+type
  grade: string;
  period: string;     // month
  type: string;       // 'general' | 'english' | 'health' | 'sports' | 'art' | …
  title: string;
  teacher: string;
  submittedAt: string; // ISO timestamp (= the report's printed date)
  data?: any;          // filled report blob — NO LONGER stored (report goes to Telegram)
}

export function loadSubmissions(): ReportSubmission[] {
  try {
    const arr = JSON.parse(localStorage.getItem(STORE) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getSubmission(key: string): ReportSubmission | undefined {
  return loadSubmissions().find(s => s.key === key);
}

export function submitReport(entry: Omit<ReportSubmission, 'submittedAt'>): ReportSubmission {
  const full: ReportSubmission = { ...entry, submittedAt: new Date().toISOString() };
  // The report is delivered to Telegram — nothing report-related is saved to the
  // cloud. We keep only a LOCAL, lightweight submission LOG (no `data` blob) so the
  // teacher's device can show "បានបញ្ជូន ✓". Deliberately no cloud sync here.
  const { data, ...meta } = full;
  const next: ReportSubmission[] = [meta, ...loadSubmissions().filter(s => s.key !== entry.key)];
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  return full; // caller still gets `data` for immediate rendering/printing
}

// One-time cleanup: strip heavy report blobs already sitting in the stored
// submissions (reclaims localStorage). Reports live in Telegram; the log is local
// only. Returns true if anything was pruned.
export function pruneSubmissionBlobs(): boolean {
  const subs = loadSubmissions();
  if (!subs.some(s => s.data !== undefined)) return false;
  const light: ReportSubmission[] = subs.map(({ data, ...m }) => m);
  try { localStorage.setItem(STORE, JSON.stringify(light)); } catch { /* ignore */ }
  return true;
}

// Resolve the ANNOUNCE_SECRET that gates the Telegram endpoint. A teacher on a
// fresh device won't have typed it, so try, in order: this device's cache → the
// cloud setting (set once by anyone) → prompt. A prompted value is persisted to
// BOTH so every other teacher's submit is then fully automatic.
const SECRET_KEY = 'telegram_announce_secret';
async function resolveAnnounceSecret(): Promise<string> {
  let secret = '';
  try { secret = localStorage.getItem(SECRET_KEY) || ''; } catch { /* ignore */ }
  if (secret) return secret;
  try { const cloud = await fetchSetting(SECRET_KEY); if (typeof cloud === 'string' && cloud) secret = cloud; } catch { /* offline */ }
  if (secret) { try { localStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ } return secret; }
  secret = (window.prompt('ពាក្យសម្ងាត់ផ្ញើ Telegram (ANNOUNCE_SECRET) — បញ្ចូលម្ដងគត់៖') || '').trim();
  if (!secret) return '';
  try { localStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ }
  Promise.resolve(syncUpsertSetting(SECRET_KEY, secret)).catch(() => { /* stays local */ });
  return secret;
}

// Render a submitted report's on-screen sheet to a multi-page PDF and post it to
// the TEACHERS' Telegram group via the CCC bot. Called straight from the teacher's
// "បញ្ជូនរបាយការណ៍" button so submitting auto-delivers the PDF (no separate step).
export async function sendSubmissionToTelegram(el: HTMLElement, sub: ReportSubmission): Promise<{ ok: boolean; error?: string }> {
  const secret = await resolveAnnounceSecret();
  if (!secret) return { ok: false, error: 'no-secret' };
  const d = submissionDate(sub.submittedAt);
  const caption = `${sub.title} — ${sub.grade} · ${sub.period} · គ្រូ ${sub.teacher || ''} · បញ្ជូន ${d.day} ${d.month} ${d.year}`;
  // ASCII filename — Khmer filenames can break download/open on Windows; the full
  // Khmer details are in the caption. e.g. CCC-Report-health-2026-07-06
  const dt = new Date(sub.submittedAt);
  const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const filename = `CCC-Report-${sub.type || 'report'}-${stamp}`;
  try {
    const pdf = await renderElementToPdfDataUrl(el);
    const res = await fetch('/api/telegram-announce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'teacher', caption, filename, secret, pdf }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    // A wrong cached secret would fail every send — clear it so the next try re-asks.
    if (data.error === 'unauthorized') { try { localStorage.removeItem(SECRET_KEY); } catch { /* ignore */ } }
    return { ok: false, error: data.error || String(res.status) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' };
  }
}

// Khmer date parts for a submission timestamp — the lunar line + Gregorian d/m/y.
export function submissionDate(iso: string): { lunar: string; day: string; month: string; year: string } {
  const d = new Date(iso);
  return {
    lunar: khmerLunarFull(d),
    day: toKh(d.getDate()),
    month: KH_MONTHS[d.getMonth()],
    year: toKh(d.getFullYear()),
  };
}
