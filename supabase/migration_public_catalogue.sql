-- Public "shop window" for the Knowledge Library.
-- Lets anyone (not logged in) see what each library item is about, while
-- the actual files and recordings stay locked to members.
-- Run once in the Supabase SQL editor. Safe to re-run.
create or replace view public.resource_catalogue as
  select
    id,
    type,
    category,
    title,
    (file_path is not null) as has_file,
    (cheat_sheet_path is not null) as has_cheat_sheet,
    (starter_kit_path is not null) as has_starter_kit,
    (recording_url is not null) as has_recording,
    description,
    business_problem,
    what_you_learn,
    tool_used,
    level,
    created_at
  from public.resources;

grant select on public.resource_catalogue to anon, authenticated;
-- The base table stays private: only this limited view is public.
revoke all on public.resources from anon;
