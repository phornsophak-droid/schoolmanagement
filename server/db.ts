/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Server-side Supabase client for the Telegram serverless functions. Uses the
// SERVICE ROLE key (a secret Vercel env var) so it can read student data and the
// locked-down telegram_links table (which the browser anon client must NOT read —
// it holds parents' chat_ids). Never import this from src/ (browser) code.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// Today's date (YYYY-MM-DD) in Cambodia time (ICT, UTC+7, no DST) — matches the
// device-local date DailyAttendance.tsx writes, so the cron picks the right day
// even though Vercel runs the function in UTC.
export function todayICT(): string {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return ict.toISOString().slice(0, 10);
}
