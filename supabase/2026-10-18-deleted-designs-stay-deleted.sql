-- Applied to the live database on 2026-10-18.
-- A design the user deleted must never come back on its own.
-- 1) automatic "recover missing designs" switched off
create or replace function public.my_recoverable_jobs()
 returns json language sql stable security definer set search_path to 'public'
as $$ select '[]'::json $$;
-- 2) restore_from_job never revives a hidden / deleted design (see live definition)
-- 3) add_preview_paths does nothing on a deleted design
create or replace function public.add_preview_paths(p_id uuid, p_paths jsonb)
 returns void language sql security definer set search_path to 'public'
as $$
  update public.previews set paths = coalesce(paths, '{}'::jsonb) || coalesce(p_paths, '{}'::jsonb)
  where id = p_id and user_id = auth.uid() and deleted_at is null and not (hidden and paths = '{}'::jsonb);
$$;
-- 4) designs the automatic recovery had brought back were moved to "Recently deleted"
-- 5) "Delete all" in Recently deleted: images removed for good, the row stays as an empty hidden tombstone
--    so no automatic recovery can bring it back (restore_preview refuses rows without paths)
create or replace function public.purge_trash(p_ids uuid[] default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare out jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  with gone as (
    select id, paths from public.previews
    where user_id = auth.uid() and deleted_at is not null and paths <> '{}'::jsonb
      and (p_ids is null or id = any(p_ids))
    for update
  ), upd as (
    update public.previews p set paths = '{}'::jsonb, hidden = true, report = null, notes = null
    from gone where p.id = gone.id
    returning p.id
  )
  select coalesce(jsonb_agg(v), '[]'::jsonb) into out
  from gone, jsonb_each_text(gone.paths) as e(k, v)
  where v not like 'job:%';
  return out;
end $$;
revoke all on function public.purge_trash(uuid[]) from public, anon;
grant execute on function public.purge_trash(uuid[]) to authenticated;
