-- Aging a saved preview from the gallery: its images count on one generation row per preview,
-- so bump_age's limit of 8 applies however often it is started. Not a preview: the monthly allowance doesn't change.
alter table public.generations add column if not exists preview_id uuid references public.previews(id) on delete set null;
create unique index if not exists generations_preview_id_key on public.generations(preview_id) where preview_id is not null;

create or replace function public.start_saved_aging(p_preview uuid)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare gid bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.previews where id = p_preview and user_id = auth.uid() and deleted_at is null) then
    return null;
  end if;
  insert into public.generations(user_id, placement, kind, preview_id)
  values (auth.uid(), 'saved aging', 'saved_aging', p_preview)
  on conflict (preview_id) where preview_id is not null do nothing;
  select id into gid from public.generations where preview_id = p_preview and user_id = auth.uid();
  return gid;
end $function$;

revoke all on function public.start_saved_aging(uuid) from public, anon;
grant execute on function public.start_saved_aging(uuid) to authenticated;
