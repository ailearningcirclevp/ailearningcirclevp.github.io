-- AI Feed: short articles, pictures, PDFs and links that paid members can read.
-- Run once in Supabase -> SQL Editor.
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  kind text not null default 'article' check (kind in ('article', 'image', 'pdf', 'file', 'link')),
  link_url text,
  file_path text,   -- file in the private "library-files" bucket (folder feed/)
  file_name text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.feed_posts enable row level security;

drop policy if exists "members read feed" on public.feed_posts;
create policy "members read feed"
  on public.feed_posts for select
  using (exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin')));

drop policy if exists "admins manage feed" on public.feed_posts;
create policy "admins manage feed"
  on public.feed_posts for all
  using (exists (select 1 from public.members where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.members where id = auth.uid() and role = 'admin'));
