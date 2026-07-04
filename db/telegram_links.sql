-- Telegram parent ↔ student links. One row per (parent chat, child). A parent can
-- link several children; a child can have several parents. Written by the bot
-- webhook when a parent sends /start and their child's name/ID.
--
-- SECURITY: this table holds parents' Telegram chat_ids — it must NEVER be readable
-- by the browser anon client. RLS is enabled with NO anon policy, so only the
-- serverless functions (service_role key, which bypasses RLS) can touch it.

create table if not exists public.telegram_links (
  id           uuid primary key default gen_random_uuid(),
  chat_id      text not null,               -- parent's Telegram chat id
  student_name text not null,               -- child's name (matches student_scores.name)
  grade        text not null,               -- child's class
  student_id   text,                        -- អត្តលេខ, if known (extra_data.studentId)
  created_at   timestamptz default now(),
  unique (chat_id, student_name, grade)
);

create index if not exists telegram_links_student_idx
  on public.telegram_links (student_name, grade);

alter table public.telegram_links enable row level security;
-- (Intentionally no policies → anon/authenticated get nothing; service_role bypasses RLS.)
