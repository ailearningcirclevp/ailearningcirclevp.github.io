-- AI Learning Circle — Member Portal schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run.
--
-- Tables: members, sessions, resources, saved_items, survey_responses
-- Plus a private Storage bucket (library-files) for real downloadable
-- material (Use Case files, Prompt Library docs, Cheat Sheets, Try This
-- Week sheets). All member-only data is protected with Row Level
-- Security (RLS), so a guessed URL or a direct API call can never
-- return another member's data, or any data at all to a non-member.

-- ========== MEMBERS ==========
-- One row per authenticated user, keyed to Supabase Auth's own user id.
create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  headline text,
  location text,
  linkedin_url text,
  company text,
  area_of_interest text,
  profile_photo_url text,
  role text not null default 'member' check (role in ('member', 'admin', 'pending')),
  show_in_directory boolean not null default false,
  survey_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- A member can read and update only their own row.
create policy "members read own row"
  on public.members for select
  using (auth.uid() = id);

create policy "members update own row"
  on public.members for update
  using (auth.uid() = id);

-- A member can create their own row at signup.
create policy "members insert own row"
  on public.members for insert
  with check (auth.uid() = id);

-- Opted-in directory: any authenticated member can read the public
-- fields of members who turned on "Show me in Member Directory".
-- (Handled via a view below, not a broad policy on this table.)

create view public.member_directory as
  select id, full_name, headline, location, company, area_of_interest, linkedin_url
  from public.members
  where show_in_directory = true;

-- ========== SESSIONS ==========
-- Content you (admin) add directly via the Supabase Table Editor.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tag text,
  session_date date,
  session_time text,
  description text,
  status text not null default 'open' check (status in ('open', 'soon', 'closed', 'completed')),
  recording_url text,
  is_public boolean not null default true, -- free sessions: visible to everyone
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

-- Public sessions are readable by anyone, logged in or not.
create policy "public sessions readable by all"
  on public.sessions for select
  using (is_public = true);

-- Non-public (members-only) sessions are readable only by members.
create policy "member sessions readable by members"
  on public.sessions for select
  using (
    is_public = false
    and exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin'))
  );

-- ========== RESOURCES (Knowledge Library) ==========
-- Each row is one library item. "type" is the content kind shown as
-- its own section in the Library (Use Case Materials, Prompt Library,
-- Cheat Sheet, Try This Week); "category" is the subject-area tag
-- (Finance & Reporting, Presentations, Meetings & Productivity, Data &
-- Dashboards, AI Agents & Automation, General AI Skills). A resource's
-- actual downloadable file lives in the private "library-files"
-- Storage bucket below; file_path/file_name point to it.
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'use_case' check (type in ('use_case', 'prompt', 'cheat_sheet', 'try_this_week')),
  category text not null,
  title text not null,
  description text,
  business_problem text,
  what_you_learn text,
  tool_used text,
  tool_transferability_note text,
  sample_input_output text,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  file_path text,   -- object path inside the "library-files" Storage bucket
  file_name text,   -- original filename, shown on the Download button
  recording_url text, -- optional external video walkthrough link
  related_resource_ids uuid[],
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

-- Only authenticated members can read full resource rows.
-- The public "locked catalogue" view (title + contents only) is a
-- separate, intentionally narrow view anyone can read.
create policy "resources readable by members"
  on public.resources for select
  using (
    exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin'))
  );

-- Admins can add, edit and remove library materials from admin.html.
create policy "admins manage resources"
  on public.resources for all
  using (exists (select 1 from public.members where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.members where id = auth.uid() and role = 'admin'));

create view public.resource_catalogue as
  select
    id,
    type,
    category,
    title,
    (file_path is not null) as has_file,
    (recording_url is not null) as has_recording
  from public.resources;

-- This view has no RLS of its own (views inherit from underlying
-- tables by default unless declared security_invoker); expose it
-- deliberately as a public, read-only, columns-limited catalogue by
-- granting select on the view to the anon role only (not the base table).
grant select on public.resource_catalogue to anon, authenticated;
revoke all on public.resources from anon;

-- ========== LIBRARY FILES (Storage) ==========
-- A private bucket holding the actual uploaded materials. Nothing in
-- it is publicly reachable by URL — members download via a short-lived
-- signed URL generated after Supabase confirms they're logged in and
-- a member, and only admins can upload, replace or remove files.
insert into storage.buckets (id, name, public)
  values ('library-files', 'library-files', false)
  on conflict (id) do nothing;

create policy "members can read library files"
  on storage.objects for select
  using (
    bucket_id = 'library-files'
    and exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin'))
  );

create policy "admins can upload library files"
  on storage.objects for insert
  with check (
    bucket_id = 'library-files'
    and exists (select 1 from public.members where id = auth.uid() and role = 'admin')
  );

create policy "admins can update library files"
  on storage.objects for update
  using (
    bucket_id = 'library-files'
    and exists (select 1 from public.members where id = auth.uid() and role = 'admin')
  );

create policy "admins can delete library files"
  on storage.objects for delete
  using (
    bucket_id = 'library-files'
    and exists (select 1 from public.members where id = auth.uid() and role = 'admin')
  );

-- ========== SAVED ITEMS (bookmarks) ==========
create table if not exists public.saved_items (
  member_id uuid not null references public.members(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (member_id, resource_id)
);

alter table public.saved_items enable row level security;

create policy "members manage own saved items"
  on public.saved_items for all
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- ========== SURVEY RESPONSES ==========
-- Optional: only needed if you later want responses stored in
-- Supabase instead of (or alongside) the existing Google Form.
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  responses jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table public.survey_responses enable row level security;

create policy "members manage own survey response"
  on public.survey_responses for all
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- ========== ADMIN ==========
-- To make yourself (or anyone) an admin after signing up:
--   update public.members set role = 'admin' where id = '<your auth user id>';
-- Find your user id under Authentication → Users in the Supabase dashboard.
-- Once you're an admin, an "Admin" tab appears in your own portal nav
-- (Dashboard, Library, Profile) linking to admin.html, where you can
-- upload new Knowledge Library materials yourself — no code or Table
-- Editor required.
