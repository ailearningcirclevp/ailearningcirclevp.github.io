-- Free tier + paid membership + AI tips.
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- Roles: 'free' (default on signup), 'member' (PAID), 'admin', 'pending'.

alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('free', 'member', 'admin', 'pending'));
alter table public.members alter column role set default 'free';

-- New signups become free users (paid access is granted by you).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (id, full_name, headline, location, company, area_of_interest,
                              website_url, bio, show_in_directory, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'headline',
    new.raw_user_meta_data->>'location',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'area_of_interest',
    new.raw_user_meta_data->>'website_url',
    new.raw_user_meta_data->>'bio',
    coalesce((new.raw_user_meta_data->>'show_in_directory')::boolean, false),
    'free'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Free AI tips you post from the Admin page; any logged-in user can read.
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.tips enable row level security;
drop policy if exists "tips readable by signed-in users" on public.tips;
create policy "tips readable by signed-in users" on public.tips for select
  using (auth.uid() is not null);
drop policy if exists "admin manages tips" on public.tips;
create policy "admin manages tips" on public.tips for all
  using (exists (select 1 from public.members where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.members where id = auth.uid() and role = 'admin'));

-- Saved feature is removed.
drop table if exists public.saved_items;

-- To make someone a PAID member (after they pay on WhatsApp):
--   update public.members set role = 'member' where id = (select id from auth.users where email = 'their@email.com');
