-- Anonymous participant feedback shown as a ticker under completed sessions.
-- Run once in Supabase -> SQL Editor. Safe to re-run.
create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,          -- matches the session "id" in assets/sessions.js
  comment text not null,             -- plain text, anonymous
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists session_feedback_session_idx on public.session_feedback (session_id, sort_order);
alter table public.session_feedback enable row level security;

-- Anyone visiting the public homepage can read the comments.
drop policy if exists "feedback readable by everyone" on public.session_feedback;
create policy "feedback readable by everyone" on public.session_feedback for select using (true);

-- Only the admin can add, edit, reorder or delete.
drop policy if exists "admin manages feedback" on public.session_feedback;
create policy "admin manages feedback" on public.session_feedback for all
  using (exists (select 1 from public.members where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.members where id = auth.uid() and role = 'admin'));
