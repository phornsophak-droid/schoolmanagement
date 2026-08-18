-- ============================================================================
-- SECURITY PHASE 3 · STEP 1 — Lock anon READ on student_scores
-- ============================================================================
-- Today two permissive policies let the public `anon` key both READ and WRITE
-- every student row. This migration removes anon's ability to READ, while
-- keeping everything working:
--
--   • Authenticated STAFF (is_staff()) keep full read + write.
--   • The `anon` key keeps INSERT/UPDATE/DELETE (so no write path breaks) but
--     can no longer SELECT — closing the confidentiality hole.
--   • service_role (the Vercel proxies: parent-portal, test-roster, telegram)
--     bypasses RLS entirely, so those keep working.
--
-- PREREQUISITES (must already be true):
--   1. security_phase1_staff.sql has been run → is_staff() exists and the
--      principal + teachers have active staff rows.
--   2. The app is deployed with: the parent-portal proxy, the test-roster proxy,
--      and the post-login re-sync (so staff pull scores after email login).
--   3. Staff sign in by EMAIL. Anyone on the emergency PIN has no session and
--      will read from their local cache only (acceptable for break-glass).
--
-- SAFE + REVERSIBLE. No data is deleted; only READ permission changes. To undo,
-- run the ROLLBACK block at the bottom.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- ============================================================================

-- 1. Remove the blanket policies (the "Allow modify" FOR ALL also granted SELECT).
drop policy if exists "Allow read to student_scores"   on public.student_scores;
drop policy if exists "Allow modify to student_scores" on public.student_scores;

-- 2. Authenticated STAFF: full read + write (is_staff() checks an active staff row).
drop policy if exists ss_staff_all on public.student_scores;
create policy ss_staff_all on public.student_scores
    for all to authenticated
    using (public.is_staff()) with check (public.is_staff());

-- 3. anon: keep WRITES (unchanged behaviour) but NO read policy → cannot SELECT.
drop policy if exists ss_anon_insert on public.student_scores;
create policy ss_anon_insert on public.student_scores
    for insert to anon with check (true);

drop policy if exists ss_anon_update on public.student_scores;
create policy ss_anon_update on public.student_scores
    for update to anon using (true) with check (true);

drop policy if exists ss_anon_delete on public.student_scores;
create policy ss_anon_delete on public.student_scores
    for delete to anon using (true);

-- ============================================================================
-- VERIFY (optional):
--   • With the anon key (e.g. the app before login) a SELECT now returns 0 rows.
--   • Signed in as a staff email, the app shows all students as before.
--   • The Parent Portal and the online test roster still work (service_role).
-- ============================================================================

-- ============================================================================
-- ROLLBACK — restore the previous open behaviour if anything misbehaves:
-- ----------------------------------------------------------------------------
-- drop policy if exists ss_staff_all    on public.student_scores;
-- drop policy if exists ss_anon_insert  on public.student_scores;
-- drop policy if exists ss_anon_update  on public.student_scores;
-- drop policy if exists ss_anon_delete  on public.student_scores;
-- create policy "Allow read to student_scores"   on public.student_scores for select using (true);
-- create policy "Allow modify to student_scores" on public.student_scores for all using (true) with check (true);
-- ============================================================================
