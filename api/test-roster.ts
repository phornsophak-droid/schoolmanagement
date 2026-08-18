/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// TEST ROSTER — server-side proxy (Security Phase 3 support).
// ----------------------------------------------------------------------------
// The online test portal (StudentQuiz) has no login: a student joins with a
// code, then picks their name from the class roster. That roster used to be an
// anon read of student_scores. Once anon read is locked down, this endpoint
// serves the roster instead — via the service_role key, and ONLY the plain
// NAMES for a class that currently has an OPEN test matching the join code. So
// it is not an open "list every student" API: no valid open code, no roster.
//
// Self-contained (see telegram-webhook.ts note): only npm modules imported.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const config = { maxDuration: 20 };

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: any };
type Res = { status: (n: number) => Res; json: (b: any) => void };

let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

const TESTS_KEY = 'standard_tests'; // school_settings row holding the test list

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }
  let body: any = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const code = String(body?.code || '').trim().toUpperCase();
  const grade = String(body?.grade || '').trim();
  if (!code || !grade) { res.status(200).json({ ok: false, error: 'missing' }); return; }

  try {
    const db = getAdmin();

    // 1. Confirm the code maps to an OPEN test that includes this grade — the gate
    //    that stops this from being a public "list any class" endpoint.
    const { data: settingRows } = await db.from('school_settings')
      .select('setting_value').eq('setting_key', TESTS_KEY).limit(1);
    const tests = (settingRows && settingRows.length ? settingRows[0].setting_value : null) as any[] | null;
    const test = Array.isArray(tests)
      ? tests.find((t: any) => t && t.status === 'open' && String(t.code || '').toUpperCase() === code)
      : null;
    if (!test) { res.status(200).json({ ok: false, error: 'noTest' }); return; }
    const grades: string[] = Array.isArray(test.grades) ? test.grades : [];
    if (!grades.includes(grade)) { res.status(200).json({ ok: false, error: 'gradeNotInTest' }); return; }

    // 2. Return only the distinct student NAMES for that class (no scores/PII).
    const { data } = await db.from('student_scores').select('name').eq('grade', grade).limit(2000);
    const names = [...new Set((data || []).map((r: any) => String(r.name || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'km'));
    res.status(200).json({ ok: true, names });
  } catch (e: any) {
    console.error('test-roster error', e?.message || e);
    res.status(500).json({ ok: false, error: 'server' });
  }
}
