-- ============================================================================
-- SECURITY PHASE 1 · STEP 1 — Staff accounts & roles
-- ============================================================================
-- ✅ SAFE TO RUN NOW. This ONLY adds two new tables (staff, teacher_classes)
--    and two helper functions. It does NOT change access to any existing data,
--    so the app keeps working exactly as before.
--
-- The RLS lock-down of student data is a SEPARATE later step (step 2), applied
-- only AFTER staff sign-in is live and tested — see security_phase1_lockdown.sql
-- (not written yet). Do them in order.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste all → Run.
-- Prerequisite: enable the Email auth provider (Authentication → Providers).
-- ============================================================================

-- 1. Staff directory: one row per principal/teacher, linked to a Supabase Auth user.
create table if not exists public.staff (
    id         uuid primary key references auth.users(id) on delete cascade,
    username   text unique not null,
    full_name  text not null,
    role       text not null check (role in ('principal','teacher')),
    active     boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

-- 2. Which grades/classes a teacher owns (used later to scope a teacher to their own classes).
create table if not exists public.teacher_classes (
    staff_id uuid not null references public.staff(id) on delete cascade,
    grade    text not null,
    primary key (staff_id, grade)
);

-- 3. Helper functions (SECURITY DEFINER so they can read staff without RLS recursion).
create or replace function public.is_staff() returns boolean
    language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.staff s where s.id = auth.uid() and s.active);
$$;

create or replace function public.is_principal() returns boolean
    language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.staff s
                   where s.id = auth.uid() and s.active and s.role = 'principal');
$$;

-- 4. RLS on the new tables themselves.
alter table public.staff enable row level security;
alter table public.teacher_classes enable row level security;

drop policy if exists staff_self_or_principal_read on public.staff;
create policy staff_self_or_principal_read on public.staff
    for select to authenticated
    using (id = auth.uid() or public.is_principal());

drop policy if exists staff_principal_manage on public.staff;
create policy staff_principal_manage on public.staff
    for all to authenticated
    using (public.is_principal()) with check (public.is_principal());

drop policy if exists tc_self_or_principal_read on public.teacher_classes;
create policy tc_self_or_principal_read on public.teacher_classes
    for select to authenticated
    using (staff_id = auth.uid() or public.is_principal());

drop policy if exists tc_principal_manage on public.teacher_classes;
create policy tc_principal_manage on public.teacher_classes
    for all to authenticated
    using (public.is_principal()) with check (public.is_principal());

-- ============================================================================
-- CREATE THE FIRST PRINCIPAL (do this once, in the dashboard)
-- ============================================================================
-- a) Authentication → Users → "Add user" → create with:
--       email:    <username>@staff.ccc.local   (e.g. sophak@staff.ccc.local)
--       password: <a strong password>
--    Copy the new user's UID.
-- b) Then run (replace the UID and name):
--
--    insert into public.staff (id, username, full_name, role)
--    values ('PASTE-USER-UID-HERE', 'sophak', 'ផន សុភាព', 'principal');
--
-- The SQL editor runs as service_role, so it bypasses RLS for this first insert.
-- After that, the principal can add teachers from inside the app.
-- ============================================================================

-- ROLLBACK (undo this step):
--   drop table if exists public.teacher_classes;
--   drop table if exists public.staff;
--   drop function if exists public.is_staff();
--   drop function if exists public.is_principal();
