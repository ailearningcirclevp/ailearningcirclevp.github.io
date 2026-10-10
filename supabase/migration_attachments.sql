-- Allows several extra attachments (files or links) per library item.
-- Run once in Supabase -> SQL Editor.
alter table public.resources
  add column if not exists attachments jsonb not null default '[]'::jsonb;
