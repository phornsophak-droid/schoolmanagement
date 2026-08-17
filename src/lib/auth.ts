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

// School staff sign-in emails. The principal has their own account; ALL teachers
// currently share ONE account — a teacher signs in by picking their class name +
// this shared password. (Per-teacher accounts can come later; the self-register
// flow is still available for that.) School-specific config — change for another
// school, or later move to a school setting for white-labelling.
export const PRINCIPAL_EMAIL = 'sophak.camkids@gmail.com';
export const TEACHER_EMAIL = 'phornsophak@gmail.com';

/** The Supabase Auth sign-in email for a given app account. */
export function emailForAccount(user: { id: string; role: string }): string {
  return user.role === 'principal' ? PRINCIPAL_EMAIL : TEACHER_EMAIL;
}

export interface StaffProfile {
  id: string;
  username: string;
  full_name: string;
  role: 'principal' | 'teacher';
  active: boolean;
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
export async function signInStaff(email: string, password: string): Promise<SignInResult> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'គ្មានការតភ្ជាប់ទៅ Supabase' };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
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

// ---------------------------------------------------------------------------
// Teacher self-registration (principal-approved).
// A teacher signs up with their own email/password and picks their class; this
// creates a PENDING (active=false) staff row. is_staff() checks active, and
// signInStaff() rejects inactive accounts, so they cannot access anything until
// the principal approves. Requires the staff_self_register RLS policy and email
// confirmation turned OFF (so sign-up establishes a session to insert the row).
// ---------------------------------------------------------------------------
export interface RegisterResult { ok: boolean; error?: string }

export async function registerTeacher(
  classId: string, fullName: string, email: string, password: string,
): Promise<RegisterResult> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'គ្មានការតភ្ជាប់ទៅ Supabase' };

  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error || !data?.user) {
    return { ok: false, error: error?.message || 'ចុះឈ្មោះមិនបានសម្រេច' };
  }
  if (!data.session) {
    // Email confirmation is ON — we can't create the staff row yet.
    return { ok: false, error: 'សូមបិទ Confirm email នៅ Supabase រួចសាកម្ដងទៀត' };
  }

  const { error: insErr } = await sb.from('staff').insert({
    id: data.user.id, username: classId, full_name: fullName, role: 'teacher', active: false,
  });
  await sb.auth.signOut(); // must wait for approval before using the account
  if (insErr) {
    return { ok: false, error: insErr.message.includes('duplicate') ? 'ថ្នាក់នេះមានគណនីរួចហើយ' : insErr.message };
  }
  return { ok: true };
}

/** Principal: list teacher accounts awaiting approval. */
export async function listPendingStaff(): Promise<StaffProfile[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data } = await sb.from('staff')
    .select('id, username, full_name, role, active')
    .eq('active', false).eq('role', 'teacher');
  return (data as StaffProfile[]) || [];
}

/** Principal: approve (activate) or suspend a staff account. */
export async function setStaffActive(id: string, active: boolean): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { error } = await sb.from('staff').update({ active }).eq('id', id);
  return !error;
}

/** Principal: reject/remove a staff row (does not delete the auth user). */
export async function removeStaff(id: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { error } = await sb.from('staff').delete().eq('id', id);
  return !error;
}
