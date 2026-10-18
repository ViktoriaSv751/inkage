-- Applied to the live database on 2026-10-18.
-- Tattoo ideas: pictures saved for later (from the photo library or a link) live in uploads with kind 'idea',
-- with the link they came from and a short note the owner can edit.
alter table public.uploads drop constraint uploads_kind_check, add constraint uploads_kind_check check (kind in ('photo', 'design', 'idea'));
alter table public.uploads add column if not exists source_url text check (source_url is null or char_length(source_url) <= 1000),
  add column if not exists note text check (note is null or char_length(note) <= 300);
grant update (note) on public.uploads to authenticated;
create policy "uploads update own" on public.uploads for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
