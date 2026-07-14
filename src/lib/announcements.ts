/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// School announcements (ជូនដំណឹង) shown in the mobile portal's notifications panel.
// The principal writes them; they persist as a single JSON array in the generic
// school_settings KV (no new table, cloud-synced) and mirror to localStorage for
// instant reads. Announcements are tiny text → negligible egress. Same storage
// pattern as the Lesson Library ([[project-question-bank]] lessons.ts).

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  isHot?: boolean;       // pinned/urgent → red "HOT" tag
  createdBy?: string;    // author name (principal)
  createdAt: string;     // ISO timestamp
}

const KEY = 'school_announcements';

kvHydrate(KEY);

const toKh = (n: number | string) => String(n).replace(/[0-9]/g, d => '០១២៣៤៥៦៧៨៩'[+d]);

export function loadAnnouncements(): Announcement[] {
  const a = kvReadSync<Announcement[]>(KEY, []);
  return Array.isArray(a) ? a : [];
}

// Pull the shared list from the cloud so every device sees the same announcements.
export async function refreshAnnouncementsFromCloud(): Promise<Announcement[]> {
  await kvHydrate(KEY);
  try {
    const v = await fetchSetting(KEY);
    if (Array.isArray(v)) { await kvWrite(KEY, v); return v; }
  } catch { /* offline — keep local */ }
  return loadAnnouncements();
}

// Insert/replace by id (newest first), persist locally, then mirror to the cloud
// (fire-and-forget — never throws to the UI).
export async function saveAnnouncement(a: Announcement): Promise<Announcement[]> {
  const list = loadAnnouncements();
  const idx = list.findIndex(x => x.id === a.id);
  if (idx >= 0) list[idx] = a; else list.unshift(a);
  await kvWrite(KEY, list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — saved locally */ }
  return list;
}

export async function deleteAnnouncement(id: string): Promise<Announcement[]> {
  const list = loadAnnouncements().filter(x => x.id !== id);
  await kvWrite(KEY, list);
  try { await syncUpsertSetting(KEY, list); } catch { /* offline — removed locally */ }
  return list;
}

// Human-friendly Khmer relative date for the card ("ទើបតែផ្សាយ", "ម្សិលមិញ", "N ថ្ងៃមុន").
export function relativeKhmerDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'ទើបតែផ្សាយ';
  if (days === 1) return 'ម្សិលមិញ';
  return `${toKh(days)} ថ្ងៃមុន`;
}
