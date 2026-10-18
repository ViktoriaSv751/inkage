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
