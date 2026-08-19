-- ============================================================================
-- SECURITY PHASE 3 · STEP 2 — Lock anon WRITES on student_scores
-- ============================================================================
-- After step 1 the anon key can no longer READ student_scores, but it can still
-- INSERT / UPDATE / DELETE (kept temporarily so no write path broke). This step
-- removes those anon write policies, so ONLY authenticated staff (is_staff(),
-- via the ss_staff_all policy from step 1) can change student data. service_role
-- (the Vercel proxies) bypasses RLS and is unaffected.
--
-- Closes the INTEGRITY hole: with the anon key alone, no one can add fake scores,
-- alter grades, or delete students.
--
-- PREREQUISITES:
--   • Step 1 (security_phase3_lock_student_scores.sql) has been run — ss_staff_all
--     already grants authenticated staff full read + write.
--   • All real writes come from staff signed in by EMAIL. Anyone on the emergency
--     PIN has no session and can no longer write to the cloud (local cache only) —
--     acceptable for break-glass; do daily work signed in by email.
--
-- SAFE + REVERSIBLE. No data is deleted. To undo, run the ROLLBACK block below.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- ============================================================================

drop policy if exists ss_anon_insert on public.student_scores;
drop policy if exists ss_anon_update on public.student_scores;
drop policy if exists ss_anon_delete on public.student_scores;

-- After this, student_scores has ONE policy: ss_staff_all (authenticated staff,
-- full access). anon has no policy → no read and no write.

-- ============================================================================
-- VERIFY (optional):
--   • With the anon key, an INSERT into student_scores is now REJECTED
--     ("new row violates row-level security policy").
--   • Signed in as a staff email, saving/importing/deleting scores still works.
-- ============================================================================

-- ============================================================================
-- ROLLBACK — restore anon writes if a legitimate write path turns out to break:
-- ----------------------------------------------------------------------------
-- create policy ss_anon_insert on public.student_scores for insert to anon with check (true);
-- create policy ss_anon_update on public.student_scores for update to anon using (true) with check (true);
-- create policy ss_anon_delete on public.student_scores for delete to anon using (true);
-- ============================================================================
