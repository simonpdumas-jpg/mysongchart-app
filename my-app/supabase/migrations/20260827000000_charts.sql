-- Save/load feature: one row per saved chart, owned by a Clerk user.
--
-- user_id is text, not uuid: Clerk user IDs look like "user_2abc...", not
-- UUIDs, so they can't live in a uuid column or be compared via auth.uid()
-- (which expects a UUID and returns NULL/throws on a Clerk id). Every policy
-- below compares against auth.jwt() ->> 'sub' instead, which is the raw
-- Clerk user id carried in the session token once the Supabase integration
-- is active in Clerk.
--
-- chart_data is one JSONB blob holding the same shape the app already
-- auto-saves to localStorage and to exported .json files (songTitle, artist,
-- composer, songKey, capo, transpose, inputText, chordMap, customPalette,
-- pdfTheme, displayFormat, chordAccentColor) - so the save/load code can
-- write/read that existing object directly with no reshaping. title and
-- artist are pulled out as their own columns purely so the "My Charts" list
-- view can query/sort them without downloading and unpacking chart_data for
-- every row; they're intentionally duplicated inside chart_data too, since
-- that blob is still the single source of truth loaded back into the editor.

create table if not exists public.charts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled Chart',
  artist text not null default '',
  chart_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists charts_user_id_idx on public.charts (user_id);

-- Keep updated_at current on every edit, without the client having to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists charts_set_updated_at on public.charts;
create trigger charts_set_updated_at
  before update on public.charts
  for each row
  execute function public.set_updated_at();

alter table public.charts enable row level security;

-- One policy per operation (rather than a single ALL policy) so each
-- permission is explicit and auditable on its own.

create policy "Users can view their own charts"
  on public.charts
  for select
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can insert their own charts"
  on public.charts
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can update their own charts"
  on public.charts
  for update
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id)
  with check ((auth.jwt() ->> 'sub') = user_id);

create policy "Users can delete their own charts"
  on public.charts
  for delete
  to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
