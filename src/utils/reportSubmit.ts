/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Submission of the monthly work reports. The report CONTENT (filled fields / PDF)
// is delivered to the principal in Telegram and is NEVER stored in the cloud. Only
// a tiny NOTICE (title, class, month, teacher, time — no report data) syncs to the
// cloud, so the PRINCIPAL's account can show an in-app alert that a teacher
// submitted. On the teacher's own device the same notice drives "បានបញ្ជូន ✓". The
// submit time becomes the report's printed date.

import { syncUpsertSetting, fetchSetting } from '../lib/supabase';
import { renderElementToPdfDataUrl, REPORT_PDF_WIDTH } from './exportPdf';
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
  status?: 'sent' | 'failed'; // did the Telegram delivery succeed? (so the teacher knows)
  error?: string;      // failure reason when status === 'failed'
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

export function submitReport(entry: Omit<ReportSubmission, 'submittedAt'> & { submittedAt?: string }): ReportSubmission {
  const full: ReportSubmission = { ...entry, submittedAt: entry.submittedAt || new Date().toISOString() };
  // Keep only the lightweight NOTICE (drop the heavy `data` blob — the report goes
  // to Telegram). Store locally, then sync the notice to the cloud so the principal
  // gets an in-app alert on their device. The notice carries no report content.
  const { data, ...meta } = full;
  const next: ReportSubmission[] = [meta, ...loadSubmissions().filter(s => s.key !== entry.key)];
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  Promise.resolve(syncUpsertSetting(STORE, next)).catch(() => { /* stays local */ });
  return full; // caller still gets `data` for immediate rendering/printing
}

// ── Principal alert: which submissions the principal hasn't looked at yet ──────
// A device-local watermark (last time the list was viewed). Anything newer counts
// as an unseen alert. Stored per device so each principal device tracks its own.
const SEEN_KEY = 'report_submissions_seen_at';

export function unseenSubmissions(): ReportSubmission[] {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
  return loadSubmissions().filter(s => (s.submittedAt || '') > seen);
}

export function markSubmissionsSeen(): void {
  const latest = loadSubmissions().reduce((m, s) => (s.submittedAt > m ? s.submittedAt : m), '');
  try { localStorage.setItem(SEEN_KEY, latest || new Date().toISOString()); } catch { /* ignore */ }
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
// Baked into the build from the Vercel env var VITE_ANNOUNCE_SECRET. When set,
// EVERY device sends automatically with no prompt — the truly "auto all devices"
// path. (This ships the secret in the client bundle, same posture as the Supabase
// anon key the app already exposes.) Falls back to cache/cloud/prompt when unset.
const BUILD_SECRET = ((import.meta as any).env?.VITE_ANNOUNCE_SECRET as string) || '';
async function resolveAnnounceSecret(): Promise<string> {
  if (BUILD_SECRET) return BUILD_SECRET;
  let secret = '';
  try { secret = localStorage.getItem(SECRET_KEY) || ''; } catch { /* ignore */ }
  if (secret) return secret;
  try { const cloud = await fetchSetting(SECRET_KEY); if (typeof cloud === 'string' && cloud) secret = cloud; } catch { /* offline */ }
  if (secret) { try { localStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ } return secret; }
  // Last resort: ask. MUST be guarded — several mobile browsers and in-app
  // webviews either throw ("prompt() is not supported") or silently suppress
  // prompt(), and by now the tap gesture has expired anyway (we already awaited a
  // render + a cloud read). An unguarded throw here killed the whole send and
  // surfaced as "the button does nothing" on phones. Fall through to '' instead so
  // the caller reports a clean no-secret and tells the user what to do.
  try {
    secret = (window.prompt('ពាក្យសម្ងាត់ផ្ញើ Telegram (ANNOUNCE_SECRET) — បញ្ចូលម្ដងគត់៖') || '').trim();
  } catch { return ''; }
  if (!secret) return '';
  try { localStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ }
  // Share it so OTHER devices (phones, where prompt() can't run) pick it up from
  // the cloud instead of needing to ask.
  Promise.resolve(syncUpsertSetting(SECRET_KEY, secret)).catch(() => { /* stays local */ });
  return secret;
}

// Post a TEXT announcement to the parent Telegram GROUP and — because these are
// general notices — fan it out to each linked parent's private bot chat too
// (alsoPrivate). Reuses the same secret resolution as report submission.
export async function sendAnnouncementToTelegram(message: string): Promise<{ ok: boolean; error?: string }> {
  const secret = await resolveAnnounceSecret();
  if (!secret) return { ok: false, error: 'no-secret' };
  try {
    const res = await fetch('/api/telegram-announce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'parent', message, secret, alsoPrivate: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    if (data.error === 'unauthorized') {
      try { localStorage.removeItem(SECRET_KEY); } catch { /* ignore */ }
      Promise.resolve(syncUpsertSetting(SECRET_KEY, '')).catch(() => { /* offline */ });
    }
    return { ok: false, error: data.error || String(res.status) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' };
  }
}

export interface LinkedStudent { name: string; grade: string; parents: number }

// Which students' parents have linked the bot. Counted/listed server-side (the raw
// links and the parents' chat ids never reach the browser). `grades` scopes the
// result to those classes — a class teacher only ever sees their own.
export async function fetchLinkedParentStats(grades?: string[]): Promise<{
  ok: boolean; total?: number; byGrade?: Record<string, number>; students?: LinkedStudent[]; error?: string;
}> {
  const secret = await resolveAnnounceSecret();
  if (!secret) return { ok: false, error: 'no-secret' };
  try {
    const res = await fetch('/api/telegram-link-stats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, ...(grades?.length ? { grades } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true, total: data.total, byGrade: data.byGrade, students: data.students };
    return { ok: false, error: data.error || String(res.status) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' };
  }
}

// A CLASS notice: a teacher messaging only their OWN class's parents. It reaches
// those parents' private bot chats and never the school-wide group. `grades` scopes
// the fan-out server-side (parents whose linked child is in one of those classes).
export async function sendClassNoticeToTelegram(message: string, grades: string[]): Promise<{ ok: boolean; error?: string; sent?: number }> {
  if (!grades.length) return { ok: false, error: 'no-grades' };
  const secret = await resolveAnnounceSecret();
  if (!secret) return { ok: false, error: 'no-secret' };
  try {
    const res = await fetch('/api/telegram-announce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'parent', message, secret, privateOnly: true, grades }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true, sent: data.privateSent };
    if (data.error === 'unauthorized') {
      try { localStorage.removeItem(SECRET_KEY); } catch { /* ignore */ }
      Promise.resolve(syncUpsertSetting(SECRET_KEY, '')).catch(() => { /* offline */ });
    }
    return { ok: false, error: data.error || String(res.status) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' };
  }
}

// Post a ready-made PNG data URL (e.g. a rendered on-screen panel) to a Telegram
// group as a photo, so it keeps the exact on-screen look. Reuses the same secret
// resolution as report submission.
export async function sendImageToTelegram(
  imageDataUrl: string,
  caption: string,
  target: 'teacher' | 'parent' = 'teacher',
): Promise<{ ok: boolean; error?: string }> {
  const secret = await resolveAnnounceSecret();
  if (!secret) return { ok: false, error: 'no-secret' };
  try {
    const res = await fetch('/api/telegram-announce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, image: imageDataUrl, caption, secret }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    if (data.error === 'unauthorized') {
      try { localStorage.removeItem(SECRET_KEY); } catch { /* ignore */ }
      Promise.resolve(syncUpsertSetting(SECRET_KEY, '')).catch(() => { /* offline */ });
    }
    return { ok: false, error: data.error || String(res.status) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' };
  }
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
    const pdf = await renderElementToPdfDataUrl(el, REPORT_PDF_WIDTH);
    const res = await fetch('/api/telegram-announce', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'teacher', caption, filename, secret, pdf }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    // A wrong secret fails every send. Clear it from BOTH localStorage AND the
    // cloud setting — otherwise the bad cloud value keeps re-poisoning every
    // device (resolveAnnounceSecret falls back to it). Next try prompts fresh.
    if (data.error === 'unauthorized') {
      try { localStorage.removeItem(SECRET_KEY); } catch { /* ignore */ }
      Promise.resolve(syncUpsertSetting(SECRET_KEY, '')).catch(() => { /* offline */ });
    }
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
