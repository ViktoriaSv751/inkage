-- Irányítóközpont: the numbers InkAge's data needs (2026-10-29)
--  1. Funnel: the "Elkezdte" step looked for Calligra's quiz_answer/name; InkAge's start is flow_step/name (the photo
--     picker), so every later step showed 0. The intro questions step needed a /app path InkAge's event has not.
--  2. Active days came from sign-ups, sign-ins and background token refreshes (and the Play robots' accounts looked active every day);
--     now only real use counts: events, previews made, previews saved. Filled every hour, not only when
--     Megtartás is opened.
--  3. Articles: InkAge's knowledge base lives at /tudastar/, not /knowledge/.
--  4. The owner's own and test accounts leave the numbers (they can be put back on Rendszer → Saját fiókok).

do $fix$
declare f regprocedure; sig text;
begin
  for f, sig in select p.oid::regprocedure f, format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('admin_dashboard', 'admin_sess') loop
    perform public._admin_patch(sig, array[
      $a$name = 'quiz_answer' and props->>'step' = 'name'$a$, $a$name = 'flow_step' and props->>'step' = 'name'$a$]
      ) where pg_get_functiondef(f) like $a$%name = 'quiz_answer' and props->>'step' = 'name'%$a$;
    perform public._admin_patch(sig, array[
      $a$e.name = 'quiz_answer' and e.props->>'step' = 'name'$a$, $a$e.name = 'flow_step' and e.props->>'step' = 'name'$a$]
      ) where pg_get_functiondef(f) like $a$%e.name = 'quiz_answer' and e.props->>'step' = 'name'%$a$;
    perform public._admin_patch(sig, array[
      $a$name = 'quiz_start' and (props ? 'gift' or coalesce(path, '') like '/app%')$a$, $a$name = 'quiz_start'$a$]
      ) where pg_get_functiondef(f) like $a$%name = 'quiz_start' and (props ? 'gift'%$a$;
    perform public._admin_patch(sig, array[
      $a$e.name = 'quiz_start' and (e.props ? 'gift' or coalesce(e.path, '') like '/app%')$a$, $a$e.name = 'quiz_start'$a$]
      ) where pg_get_functiondef(f) like $a$%e.name = 'quiz_start' and (e.props ? 'gift'%$a$;
  end loop;

  for f, sig in select p.oid::regprocedure f, format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('admin_collect_days', 'admin_collect_days_t') loop
    perform public._admin_patch(sig, array[
      $a$  select id, (created_at at time zone 'Europe/Budapest')::date from auth.users
  union select id, (last_sign_in_at at time zone 'Europe/Budapest')::date from auth.users where last_sign_in_at is not null
  union select user_id::uuid, (created_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$'
  union select user_id::uuid, (updated_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$' and updated_at is not null$a$,
      $a$  select user_id, (created_at at time zone 'Europe/Budapest')::date from public.events where user_id is not null
  union select user_id, (created_at at time zone 'Europe/Budapest')::date from public.generations where user_id is not null
  union select user_id, (created_at at time zone 'Europe/Budapest')::date from public.previews where user_id is not null$a$]);
  end loop;

  for f, sig in select p.oid::regprocedure f, format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'admin_articles' loop
    perform public._admin_patch(sig, array[
      $a$'^/knowledge/([^/?#]+).*$'$a$, $a$'^/(?:tudastar|learn)/([^/?#]+).*$'$a$,
      $a$'^https?://[^/]+/(?:[a-z]{2}/)?knowledge/([^/?#]+).*$'$a$, $a$'^https?://[^/]+/(?:[a-z]{2}/)?(?:tudastar|learn)/([^/?#]+).*$'$a$,
      $a$'^https?://[^/]+/([a-z]{2})/knowledge/'$a$, $a$'^https?://[^/]+/([a-z]{2})/(?:tudastar|learn)/'$a$,
      $a$page ~ '/knowledge/[^/?#]+'$a$, $a$page ~ '/(tudastar|learn)/[^/?#]+'$a$]);
  end loop;
  for f, sig in select p.oid::regprocedure f, format('public.%I(%s)', p.proname, oidvectortypes(p.proargtypes)) sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'admin_r_cwv_urls' loop
    perform public._admin_patch(sig, array[$a$'https://inkage.app/knowledge/%'$a$, $a$'https://inkage.app/tudastar/%'$a$]);
  end loop;
end $fix$;

-- active days: only real use (the token-based rows go), then refilled
truncate public.admin_user_days;
insert into public.admin_user_days (user_id, day)
select user_id, (created_at at time zone 'Europe/Budapest')::date from public.events where user_id is not null
union select user_id, (created_at at time zone 'Europe/Budapest')::date from public.generations where user_id is not null
union select user_id, (created_at at time zone 'Europe/Budapest')::date from public.previews where user_id is not null
on conflict do nothing;
select cron.schedule('admin-collect-days', '7 * * * *', $$select public.admin_collect_days_t((select v from public.admin_secrets where k = 'cron'))$$);

-- the owner's own and test accounts (and every visit they made) leave the numbers
insert into public.admin_own_accounts (email)
select e from unnest(array['viktoriasoti@yahoo.com', 'qa@inkage.test', 'citymaxapartments@gmail.com', 'review@inkage.app']) e
on conflict do nothing;
insert into public.admin_own_sessions (session)
select distinct left(ev.session, 80) from public.events ev join auth.users u on u.id = ev.user_id
where ev.session is not null and (lower(u.email) in (select email from public.admin_own_accounts) or lower(u.email) in (select email from public.admin_emails)
  or u.email like 'erased+%@inkage.invalid')
on conflict do nothing;
select public.admin_sess_attr_rebuild(null);
select public.admin_rollup(date '2026-10-01');
