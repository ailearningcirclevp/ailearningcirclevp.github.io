-- Lets the admin page list every member and change free/paid access.
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1. Keep each member's email on their row so the admin page can show it.
alter table public.members add column if not exists email text;
update public.members m set email = u.email from auth.users u where u.id = m.id and m.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (id, email, full_name, headline, location, company, area_of_interest,
                              website_url, bio, show_in_directory, role)
  values (
    new.id,
    new.email,
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

-- 2. Admin check that avoids policy recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid() and role = 'admin');
$$;

-- 3. Admin can read and update every member row (role changes are still
--    guarded by the protect_member_role trigger).
drop policy if exists "admin reads all members" on public.members;
create policy "admin reads all members" on public.members for select using (public.is_admin());

drop policy if exists "admin updates all members" on public.members;
create policy "admin updates all members" on public.members for update using (public.is_admin());
