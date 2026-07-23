/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// បណ្ណាល័យសាលា — the book catalogue, the borrow/return ledger and the daily
// reading-visit log. All three live as JSON arrays in the generic school_settings
// KV (no new table, cloud-synced) mirrored to localStorage for instant reads —
// the same storage pattern as [[project-announcements]] announcements.ts.
//
// Sizes stay tiny: a school library is hundreds of rows of short text, so egress
// is negligible.

import { syncUpsertSetting, fetchSetting } from './supabase';
import { kvReadSync, kvWrite, kvHydrate } from './kvStore';

export interface Book {
  id: string;
  code: string;        // លេខកូដ — the spine/accession number
  title: string;       // ចំណងជើង
  author?: string;     // អ្នកនិពន្ធ
  category?: string;   // ប្រភេទ
  total: number;       // ចំនួនច្បាប់ដែលសាលាមាន
  note?: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;   // kept on the row so the ledger still reads if a book is removed
  student: string;     // ឈ្មោះសិស្ស
  gender?: string;     // ភេទ
  grade?: string;      // ថ្នាក់
  borrowedAt: string;  // ISO date
  dueAt?: string;      // ថ្ងៃត្រូវសង
  returnedAt?: string; // set when returned — absent means still out
}

export interface Visit {
  id: string;
  student: string;
  grade?: string;
  date: string;        // YYYY-MM-DD
  purpose?: string;    // អានសៀវភៅ / ស្រាវជ្រាវ …
  inAt: string;        // ISO — set on check-in (one tap)
  outAt?: string;      // ISO — set on check-out; absent means still reading
  createdAt: string;
}

// Minutes between check-in and check-out. Null while the pupil is still in, and
// never negative in case the clock was wound back between the two taps.
export const visitMinutes = (v: Visit): number | null => {
  if (!v.outAt) return null;
  return Math.max(0, Math.round((new Date(v.outAt).getTime() - new Date(v.inAt).getTime()) / 60000));
};

// Free digital-reading resources with Khmer content, shown as quick links that are
// always available for pupils to read — in the library panel and the Parent Portal.
// All are established free platforms (Asia Foundation, Room to Read, Pratham, SIL,
// GDL, MoEYS) active for Khmer readers. Each URL was checked to resolve.
export const CURATED_ELIBRARY: { title: string; url: string; category: string }[] = [
  { title: "Let's Read Asia — សៀវភៅកុមារខ្មែរ", url: 'https://www.letsreadasia.org', category: 'សៀវភៅកុមារ' },
  { title: 'ថ្នាលបឋម PLP (ក្រសួងអប់រំ)', url: 'https://plp.moeys.gov.kh', category: 'គេហទំព័រអប់រំ' },
  { title: 'Room to Read — Literacy Cloud', url: 'https://literacycloud.org', category: 'សៀវភៅកុមារ' },
  { title: 'StoryWeaver (Pratham Books)', url: 'https://storyweaver.org.in', category: 'រឿងនិទាន' },
  { title: 'Global Digital Library', url: 'https://digitallibrary.io', category: 'សៀវភៅ' },
  { title: 'Bloom Library', url: 'https://bloomlibrary.org', category: 'សៀវភៅ' },
];

// An entry in the electronic library (បណ្ណាល័យអេឡិចត្រូនិច) — a link to a digital
// reading resource or e-book that opens in a new tab. The school curates its own.
export interface ELink {
  id: string;
  title: string;      // ចំណងជើង
  url: string;
  category?: string;  // ប្រភេទ ( សៀវភៅ / វីដេអូ / គេហទំព័រ …)
  createdAt: string;
}

// Who may edit besides the principal: the librarians, named by user name.
export interface LibrarySettings {
  librarians: string[];
}

const BOOKS_KEY = 'school_library_books';
const LOANS_KEY = 'school_library_loans';
const VISITS_KEY = 'school_library_visits';
const ELINKS_KEY = 'school_library_elinks';
const SETTINGS_KEY = 'school_library_settings';

[BOOKS_KEY, LOANS_KEY, VISITS_KEY, ELINKS_KEY, SETTINGS_KEY].forEach(k => { kvHydrate(k); });

const readList = <T,>(key: string): T[] => {
  const v = kvReadSync<T[]>(key, []);
  return Array.isArray(v) ? v : [];
};

// Save locally first so the screen updates even offline, then mirror to the cloud
// (fire-and-forget — a sync failure must never lose the local write).
const writeList = async <T,>(key: string, list: T[]): Promise<T[]> => {
  await kvWrite(key, list);
  try { await syncUpsertSetting(key, list); } catch { /* offline — kept locally */ }
  return list;
};

export const loadBooks = () => readList<Book>(BOOKS_KEY);
export const loadLoans = () => readList<Loan>(LOANS_KEY);
export const loadVisits = () => readList<Visit>(VISITS_KEY);
export const loadELinks = () => readList<ELink>(ELINKS_KEY);

export function loadLibrarySettings(): LibrarySettings {
  const v = kvReadSync<LibrarySettings>(SETTINGS_KEY, { librarians: [] });
  return { librarians: Array.isArray(v?.librarians) ? v.librarians : [] };
}

// Pull everything from the cloud so every device shows the same library.
export async function refreshLibraryFromCloud(): Promise<void> {
  await Promise.all([BOOKS_KEY, LOANS_KEY, VISITS_KEY, ELINKS_KEY, SETTINGS_KEY].map(k => kvHydrate(k)));
  await Promise.all([BOOKS_KEY, LOANS_KEY, VISITS_KEY, ELINKS_KEY, SETTINGS_KEY].map(async k => {
    try {
      const v = await fetchSetting(k);
      if (v !== null && v !== undefined) await kvWrite(k, v);
    } catch { /* offline — keep local */ }
  }));
}

export const saveBooks = (list: Book[]) => writeList(BOOKS_KEY, list);
export const saveLoans = (list: Loan[]) => writeList(LOANS_KEY, list);
export const saveVisits = (list: Visit[]) => writeList(VISITS_KEY, list);
export const saveELinks = (list: ELink[]) => writeList(ELINKS_KEY, list);

export async function saveLibrarySettings(s: LibrarySettings): Promise<LibrarySettings> {
  await kvWrite(SETTINGS_KEY, s);
  try { await syncUpsertSetting(SETTINGS_KEY, s); } catch { /* offline — kept locally */ }
  return s;
}

// How many copies of a book are out right now.
export const outCount = (bookId: string, loans: Loan[]): number =>
  loans.filter(l => l.bookId === bookId && !l.returnedAt).length;

// Copies free to lend. Never negative, even if the ledger and the catalogue
// disagree (a copy could be lent and then the total lowered).
export const availableCount = (book: Book, loans: Loan[]): number =>
  Math.max(0, (book.total || 0) - outCount(book.id, loans));

// The principal always may; a librarian is anyone the principal has named.
export const canManageLibrary = (
  user: { name?: string; role?: string } | null | undefined,
  settings: LibrarySettings,
): boolean => {
  if (!user) return false;
  if (user.role === 'principal') return true;
  const me = (user.name || '').trim();
  return !!me && settings.librarians.some(n => n.trim() === me);
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const todayISO = () => new Date().toISOString().slice(0, 10);
