// ============================================================================
// Staff authentication via Supabase Auth (Security Phase 1).
// ----------------------------------------------------------------------------
// Teachers/principal sign in with a simple USERNAME + password. Supabase Auth
// only understands emails, so we map the username to a fixed internal domain
// (Visal's suggestion) — no real email address is needed.
//
// This module is self-contained and NOT yet wired into the app's login screen.
// It can be imported and tested alongside the existing PIN login without
// changing any current behaviour. The RLS lock-down that makes this mandatory
// is a separate, later step.
// ============================================================================
import { getSupabaseClient } from './supabase';

export const STAFF_EMAIL_DOMAIN = 'staff.ccc.local';

export interface StaffProfile {
  id: string;
  username: string;
  full_name: string;
  role: 'principal' | 'teacher';
  active: boolean;
}

/** Map a typed username to the internal Supabase Auth email. */
export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${STAFF_EMAIL_DOMAIN}`;
}

/** Look up the signed-in user's staff row (null if not signed in / not staff). */
export async function fetchStaffProfile(): Promise<StaffProfile | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await sb
    .from('staff')
    .select('id, username, full_name, role, active')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return data as StaffProfile;
}

export interface SignInResult {
  ok: boolean;
  error?: string;
  staff?: StaffProfile;
}

/** Sign a staff member in with username + password. */
export async function signInStaff(username: string, password: string): Promise<SignInResult> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'គ្មានការតភ្ជាប់ទៅ Supabase' };

  const { data, error } = await sb.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error || !data?.user) {
    return { ok: false, error: 'ឈ្មោះ ឬ លេខសម្ងាត់ មិនត្រឹមត្រូវ' };
  }

  const staff = await fetchStaffProfile();
  if (!staff || !staff.active) {
    await sb.auth.signOut();
    return { ok: false, error: 'គណនីនេះមិនមានសិទ្ធិចូលប្រើ' };
  }
  return { ok: true, staff };
}

/** Sign the current staff member out. */
export async function signOutStaff(): Promise<void> {
  const sb = getSupabaseClient();
  await sb?.auth.signOut();
}

/** Current staff profile if a session exists, else null. */
export async function getStaffSession(): Promise<StaffProfile | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data?.session) return null;
  return fetchStaffProfile();
}

/** Subscribe to sign-in/out changes. Returns an unsubscribe function. */
export function onStaffAuthChange(cb: (staff: StaffProfile | null) => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange(async () => {
    cb(await fetchStaffProfile());
  });
  return () => data.subscription.unsubscribe();
}
