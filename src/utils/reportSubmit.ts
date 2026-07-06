/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Submission of the monthly work reports. The filled report blob (already kept in
// localStorage by each report component) is bundled with metadata under one
// `school_settings` key ('report_submissions') so it reaches the cloud and the
// principal can review it. The submit time becomes the report's printed date.

import { syncUpsertSetting } from '../lib/supabase';
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
  // The report itself is delivered to Telegram, so we keep only a lightweight
  // submission LOG here (no heavy `data` blob). Storing every blob bloated
  // localStorage (quota errors) and the report_submissions cloud setting.
  const { data, ...meta } = full;
  const next: ReportSubmission[] = [meta, ...loadSubmissions().filter(s => s.key !== entry.key)];
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  // Fire-and-forget cloud sync (no-op when Supabase isn't configured).
  Promise.resolve(syncUpsertSetting(STORE, next)).catch(() => { /* stays local */ });
  return full; // caller still gets `data` for immediate rendering/printing
}

// One-time cleanup: strip heavy report blobs already sitting in the stored
// submissions (reclaims localStorage + shrinks the cloud setting). Reports now
// live in Telegram. Returns true if anything was pruned.
export function pruneSubmissionBlobs(): boolean {
  const subs = loadSubmissions();
  if (!subs.some(s => s.data !== undefined)) return false;
  const light: ReportSubmission[] = subs.map(({ data, ...m }) => m);
  try { localStorage.setItem(STORE, JSON.stringify(light)); } catch { /* ignore */ }
  Promise.resolve(syncUpsertSetting(STORE, light)).catch(() => { /* stays local */ });
  return true;
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
