-- Applied to the live database on 2026-10-18.
-- The name a person sets in the app is kept in profiles.display_name: a Google / Apple sign-in rewrites
-- auth user_metadata.full_name on every sign-in, so a name saved there came back as the provider's name.
alter table public.profiles add column if not exists display_name text check (display_name is null or char_length(display_name) <= 60);
create or replace function public.set_display_name(p_name text) returns text
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); n text := nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 60), '');
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  update public.profiles set display_name = n where id = uid;
  return n;
end $$;
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
