-- Welcome e-mail safety net. /api/welcome sends it when a signed-in person opens the app; whoever that misses
-- (closed the tab right after sign-up, a failed request) is picked up by /api/mail-cron (every 10 minutes):
-- accounts created 10 min – 14 days ago with no profiles.welcomed_at. The route claims each one with welcome_once
-- (the same atomic mark the app uses), so the two paths never both send; a failed send is undone with welcome_undo.
create or replace function public.welcome_due(p_secret text) returns json
 language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select u.id::text id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang, u.raw_user_meta_data meta,
      coalesce(u.raw_app_meta_data->>'provider', 'email') provider, u.created_at, pr.signup_source source
    from auth.users u left join public.profiles pr on pr.id = u.id
    where u.created_at between now() - interval '14 days' and now() - interval '10 minutes'
      and u.email is not null and u.email !~~ 'erased+%@inkage.invalid'
      and pr.welcomed_at is null
    order by u.created_at limit 40) x);
end $function$;
revoke all on function public.welcome_due(text) from public;
grant execute on function public.welcome_due(text) to anon, authenticated;
