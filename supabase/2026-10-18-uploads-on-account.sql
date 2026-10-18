-- Applied to the live database on 2026-10-18 (the uploads table and its policies).
-- The erase_my_account() change at the bottom is NOT applied yet: run it in the SQL editor.
-- Pictures the user adds (body photos and designs) belong to the account, not to the device:
-- the file goes to the private "previews" bucket under <uid>/uploads/, the row lists it for every device.
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('photo', 'design')),
  path text not null check (char_length(path) <= 200),
  w integer,
  h integer
);
create index if not exists uploads_user_time on public.uploads (user_id, created_at desc);
alter table public.uploads enable row level security;
drop policy if exists "uploads select own" on public.uploads;
drop policy if exists "uploads insert own" on public.uploads;
drop policy if exists "uploads delete own" on public.uploads;
create policy "uploads select own" on public.uploads for select to authenticated using (user_id = (select auth.uid()));
-- the file must sit in the user's own folder of the bucket
create policy "uploads insert own" on public.uploads for insert to authenticated
  with check (user_id = (select auth.uid()) and split_part(path, '/', 1) = (select auth.uid())::text);
create policy "uploads delete own" on public.uploads for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.uploads from anon;
grant select, insert, delete on public.uploads to authenticated;

-- erasing the account removes the uploads list too (the files are removed by the app, see profile/page.tsx)
CREATE OR REPLACE FUNCTION public.erase_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.community_posts set status = 'withdrawn', reviewed_at = now()
   where share_id in (select share_id from public.previews where user_id = me and share_id is not null)
      or share_id in (select share_id from public.guest_shares where user_id = me);
  update public.guest_shares set hidden = true, fresh = null, y50 = null, fresh_b = null, y50_b = null where user_id = me;
  update public.previews set hidden = true, share_id = null, share_paths = null, notes = null, paths = '{}'::jsonb where user_id = me;
  update public.polls set hidden = true where user_id = me;
  -- the photos and designs the user added
  delete from public.uploads where user_id = me;
  -- generated images kept for recovery go too
  update public.jobs set data = '{}'::jsonb where owner = me::text;
  update public.profiles set onboarding = null, lang = null where id = me;
  -- unlink Google / Apple, so the same login can start a fresh account later
  update auth.identities set provider_id = 'erased-' || id::text, identity_data = '{}'::jsonb where user_id = me;
  -- a real date: the auth server cannot read 'infinity'
  update auth.users set email = 'erased+' || me::text || '@inkage.invalid', raw_user_meta_data = '{}'::jsonb,
    banned_until = '2999-12-31 00:00:00+00'::timestamptz where id = me;
end $function$;
