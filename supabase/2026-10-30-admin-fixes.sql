-- Irányítóközpont fixes (2026-10-30), from the owner's fault list (sections 4 and 5):
--  5.8  every account count comes from admin_real_users (no own, deleted or store-reviewer accounts)
--  5.9  GSC: no "fresh" date when gsc_daily / gsc_totals are empty; the self-check then says "nincs bekötve"
--  5.10 an unconnected source (no account / no key) is "nincs bekötve", not an error: not in the error lists, the
--       system alerts, the phone's "sync_bad", and a run whose only failures are missing keys is not a failed run
--  5.11 InkAge page: saved previews without the deleted ones, own / test / reviewer accounts left out
--  5.12 usage page: downloaded files, re-requests with reasons, reminders from push_reminders
--  5.13 artist_pdf is a download, not a share; opening a shared preview (share_view) is a visit from sharing
--  5.15 events_real: every website button is cta_click (register / login / guest), auth_ok mapped; the web funnel
--       gets a "button, then app" step so no later step is bigger than an earlier one
--  5.16 style step: the design picker's design_added, plus library / existing-tattoo / AI designs (generate_start)
--  5.19 quiz answers without the "@front:x,y|" body-map coordinates
--  5.21 alert rules: "errors" counts server_error and generate_error; a credits / billing server_error alerts at once;
--       a warning when the server-measured response time is above 2 s
--  4.M4 log_event: sane names only, server-only names need the server secret, max 120 events / minute per visitor
--  5.7  push: how many devices each sent notification could reach

-- ---------- helpers ----------
-- "not connected": a missing key / account. The Pinterest public profile with an empty PINTEREST_USERNAME answers
-- 404 "API method not found" (the run summary has no "(@)" in it, hence the last pattern).
create or replace function public.admin_not_connected(p_msg text) returns boolean
language sql immutable set search_path to '' as $$
  select coalesce(p_msg, '') ~* '(nincs bekötve|nincs beállítva|nincs [a-z_]*(key|json|token|secret)\M|nincs kulcs|nincs MI-kulcs|kulcs nélkül|nyilvános profil \(@\)|PINTEREST_USERNAME|nincs Telegram|^pinterest: (hiba: )?404 .*API method not found)'
$$;

-- ---------- 5.8 accounts: admin_real_users everywhere ----------
create or replace function public.admin_signups_matched(a timestamp with time zone, b timestamp with time zone)
 RETURNS TABLE(user_id uuid, created_at timestamp with time zone, lang text, provider text, session text, ch text, pf text, code text, src jsonb, slang text)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select u.id, u.created_at, nullif(u.raw_user_meta_data->>'lang', ''), u.raw_app_meta_data->>'provider', s.session,
    case when s.session is null then null else public.admin_channel(m.src, m.ia) end,
    case when s.session is null then null else public.admin_pf_guess(m.src, m.pf) end,
    m.src->>'ux', m.src, m.lang
  from public.admin_real_users u
  left join lateral (
    select e.session from public.events_real e
    where e.session is not null and e.created_at between u.created_at - interval '45 minutes' and u.created_at + interval '10 minutes'
      and (nullif(u.raw_user_meta_data->>'lang', '') is null or e.lang is null or left(e.lang, 2) = left(u.raw_user_meta_data->>'lang', 2))
    order by abs(extract(epoch from e.created_at - u.created_at)) limit 1) s on true
  left join lateral (
    select (array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1] src,
      (array_agg(e.props->>'ia' order by e.created_at) filter (where e.props ? 'ia'))[1] ia,
      (array_agg(e.props->>'pf' order by e.created_at) filter (where e.props ? 'pf'))[1] pf,
      (array_agg(e.lang order by e.created_at desc) filter (where e.lang is not null))[1] lang
    from public.events_real e where e.session = s.session) m on s.session is not null
  where u.created_at >= a and u.created_at < b
$function$;

create or replace function public.admin_grand_total() returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('scored', public.admin_total('scored'), 'sessions', public.admin_total('sessions'),
    'users', (select count(*) from public.admin_real_users));
end $function$;

-- admin_people: the own accounts stay listable (filter "own"); deleted and store-reviewer accounts leave every count
select public._admin_patch('public.admin_people(text,text,integer,integer,text,text,text,text,integer,timestamptz,timestamptz)', array[
  $a$with f0 as (select * from public.admin_user_facts()),$a$,
  $a$with f0 as (select x.* from public.admin_user_facts() x where x.own or exists (select 1 from public.admin_real_users ru where ru.id = x.id)),$a$])
where pg_get_functiondef('public.admin_people(text,text,integer,integer,text,text,text,text,integer,timestamptz,timestamptz)'::regprocedure) like '%with f0 as (select * from public.admin_user_facts()),%';

-- ---------- 5.11 InkAge page ----------
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path to 'public' as $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or not public.admin_email_ok(em) then
    raise exception 'forbidden';
  end if;
  /* only real accounts (no own, test, deleted or store-reviewer accounts); guests (no account) stay in */
  return (with g as (select x.* from public.generations x where x.user_id is null or exists (select 1 from public.admin_real_users r where r.id = x.user_id)),
    pv as (select x.* from public.previews x where x.deleted_at is null and (x.user_id is null or exists (select 1 from public.admin_real_users r where r.id = x.user_id)))
  select json_build_object(
    'users', (select count(*) from public.admin_real_users),
    'gen_today', (select count(*) from g where created_at > now() - interval '24 hours'),
    'gen_7d', (select count(*) from g where created_at > now() - interval '7 days'),
    'guest_today', (select count(*) from g where user_id is null and created_at > now() - interval '24 hours'),
    'aging_today', (select coalesce(sum(aged),0) from g where created_at > now() - interval '24 hours'),
    'saved', (select count(*) from pv),
    'shares', (select count(*) from pv where share_id is not null),
    'votes', (select count(*) from public.votes v where exists (select 1 from pv where pv.share_id = v.share_id)),
    'paid', (select count(*) from public.profiles p where p.plan <> 'free' and exists (select 1 from public.admin_real_users r where r.id = p.id)),
    'events_today', (select coalesce(json_object_agg(name, c), '{}'::json) from (select name, count(*) c from public.events where created_at > now() - interval '24 hours' group by name) e),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (select date_trunc('day', created_at)::date as day, count(*) as previews, coalesce(sum(aged),0) as aging from g where created_at > now() - interval '14 days' group by 1) d)
  ));
end $function$;

create or replace function public.admin_extra() returns json
language plpgsql security definer set search_path to 'public' as $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or not public.admin_email_ok(em) then
    raise exception 'forbidden';
  end if;
  return (with g as (select x.* from public.generations x where x.user_id is null or exists (select 1 from public.admin_real_users r where r.id = x.user_id))
  select json_build_object(
    'errors', (select coalesce(json_agg(e order by e.created_at desc), '[]'::json) from (
        select name, props, created_at from public.events
        where name in ('client_error', 'server_error', 'server_error_unverified', 'generate_error') and created_at > now() - interval '7 days'
        order by created_at desc limit 40) e),
    'errors_today', (select count(*) from public.events where name in ('client_error', 'server_error', 'server_error_unverified', 'generate_error') and created_at > now() - interval '24 hours'),
    'helpers_today', (select count(*) from g where kind = 'helper' and created_at > now() - interval '24 hours'),
    'previews_today', (select count(*) from g where kind = 'preview' and created_at > now() - interval '24 hours'),
    'waitlist', (select count(*) from public.waitlist),
    'recovered_today', (select count(*) from public.events_real where props->>'ev' = 'job_recovered' and created_at > now() - interval '24 hours'),
    'redo', (select coalesce(json_object_agg(k, n), '{}'::json) from (
        select x as k, count(*) as n from public.events_real, unnest(string_to_array(coalesce(nullif(props->>'why', ''), 'other'), ',')) x
        where props->>'ev' = 'redo' and created_at > now() - interval '30 days' group by x) r)
  ));
end $function$;

-- ---------- 5.9 GSC ----------
create or replace function public.admin_gsc_last() returns date
language sql stable security definer set search_path to '' as $function$
  select case when (select max(day) from public.gsc_daily) is null and (select max(day) from public.gsc_totals where type = 'web') is null then null
    else least(greatest((select max(day) from public.gsc_daily), (select max(day) from public.gsc_totals where type = 'web')), public.admin_today() - 1) end
$function$;

select public._admin_patch('public.admin_selfcheck()', array[
  $a$'found', public.admin_gsc_last(),
    'ok', coalesce(public.admin_gsc_last() >= today - 4, false), 'note', 'a Google 2–3 nap késéssel véglegesít');$a$,
  $a$'found', coalesce(public.admin_gsc_last()::text, 'nincs bekötve'),
    'ok', case when public.admin_gsc_last() is null then null else public.admin_gsc_last() >= today - 4 end,
    'note', case when public.admin_gsc_last() is null then 'még egy napi adat sincs: a Search Console bekötése a Kapcsolatok oldalon (GSC_SERVICE_ACCOUNT_JSON)' else 'a Google 2–3 nap késéssel véglegesít' end);$a$])
where pg_get_functiondef('public.admin_selfcheck()'::regprocedure) not like '%nincs bekötve%';

-- ---------- 5.10 unconnected sources ----------
create or replace function public.admin_w_log(p_token text, p_source text, p_ok boolean, p_rows integer, p_message text) returns void
language plpgsql security definer set search_path to '' as $function$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.sync_log (source, ok, rows, message) values (left(p_source, 40), p_ok, p_rows,
    left(case when not p_ok and public.admin_not_connected(p_message) and coalesce(p_message, '') not like 'nincs bekötve%'
      then 'nincs bekötve: ' || coalesce(p_message, '') else coalesce(p_message, '') end, 500));
end $function$;

-- a run whose every failing part is only a missing key / account is not a failed run (the routes say so too)
create or replace function public.admin_w_run_end(p_token text, p_id bigint, p_ok boolean, p_message text default null) returns void
language plpgsql security definer set search_path to '' as $function$
declare msg text := coalesce(p_message, ''); good boolean := p_ok; parts text[];
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not p_ok and msg like 'részben hibás: %' then
    parts := string_to_array(regexp_replace(msg, '^részben hibás: ', ''), ' · ');
    if not exists (select 1 from unnest(parts) x where not public.admin_not_connected(x)) then
      good := true;
      msg := 'nincs bekötve: ' || regexp_replace(regexp_replace(msg, '^részben hibás: ', ''), ': hiba: ', ': ', 'g');
    end if;
  end if;
  update public.admin_runs set finished_at = now(), ok = good, message = left(msg, 500) where id = p_id;
end $function$;

select public._admin_patch('public.admin_monitor()', array[
  $a$(array_agg(ok order by at desc))[1] last_state,$a$,
  $a$(array_agg(ok order by at desc))[1] last_state, (array_agg(public.admin_not_connected(message) order by at desc))[1] unconnected,$a$,
  $a$from public.sync_log where not ok and at > now() - interval '14 days' group by 1, 2$a$,
  $a$from public.sync_log where not ok and not public.admin_not_connected(message) and at > now() - interval '14 days' group by 1, 2$a$])
where pg_get_functiondef('public.admin_monitor()'::regprocedure) not like '%admin_not_connected%';

select public._admin_patch('public.admin_platform_alerts()', array[
  $a$from public.sync_log where not ok and at > now() - interval '24 hours' group by 1 loop$a$,
  $a$from public.sync_log where not ok and not public.admin_not_connected(message) and at > now() - interval '24 hours' group by 1 loop$a$])
where pg_get_functiondef('public.admin_platform_alerts()'::regprocedure) not like '%admin_not_connected%';

select public._admin_patch('public.admin_r_push_system(text)', array[
  $a$where not ok and at > now() - interval '3 hours' and source <> 'ai'), '[]'),$a$,
  $a$where not ok and not public.admin_not_connected(message) and at > now() - interval '3 hours' and source <> 'ai'), '[]'),$a$])
where pg_get_functiondef('public.admin_r_push_system(text)'::regprocedure) not like '%admin_not_connected%';

select public._admin_patch('public.admin_connections()', array[
  $a$(array_agg(ok order by at desc))[1] last_ok$a$,
  $a$(array_agg(ok order by at desc))[1] last_ok, (array_agg(public.admin_not_connected(message) order by at desc))[1] unconnected$a$,
  $a$'last_ok', last_ok)$a$, $a$'last_ok', last_ok, 'unconnected', unconnected)$a$])
where pg_get_functiondef('public.admin_connections()'::regprocedure) not like '%admin_not_connected%';

select public._admin_patch('public.admin_data_quality(integer)', array[
  $a$and not l.ok and l.at >= now() - make_interval(days => d)) fails$a$,
  $a$and not l.ok and not public.admin_not_connected(l.message) and l.at >= now() - make_interval(days => d)) fails$a$])
where pg_get_functiondef('public.admin_data_quality(integer)'::regprocedure) not like '%admin_not_connected%';

-- ---------- 5.21 alert rules and response time ----------
select public._admin_patch('public.admin_r_rules(text)', array[
  $a$declare out jsonb := '[]'; r record; v numeric;$a$,
  $a$declare out jsonb := '[]'; r record; v numeric; bill record;$a$,
  $a$name in ('client_error', 'signin_failed', 'auth_error') and created_at > now() - make_interval(mins => r.window_min))$a$,
  $a$name in ('client_error', 'signin_failed', 'auth_error', 'server_error', 'generate_error') and created_at > now() - make_interval(mins => r.window_min))$a$,
  $a$  return out;$a$,
  $a$  /* one server_error about AI credits / billing is enough: it alerts at once, not after the "errors" threshold
     (the rules run every 5 minutes; the phone keeps one such alert per hour) */
  select count(*) n, (array_agg(left(coalesce(e.props->>'msg', ''), 160) order by e.created_at desc))[1] msg into bill
    from public.events e where e.name in ('server_error', 'server_error_unverified') and e.created_at > now() - interval '6 minutes'
     and coalesce(e.props->>'msg', '') ~* '(credit|billing|prepay|depleted)';
  if bill.n > 0 then
    out := out || jsonb_build_object('id', 0, 'metric', 'MI-kredit / számlázás elfogyott (szerverhiba: ' || coalesce(bill.msg, '') || ')', 'op', '>', 'threshold', 0,
      'window_min', 5, 'value', bill.n, 'channels', coalesce((select to_jsonb(x.channels) from public.alert_rules x where x.metric = 'errors' and x.on_ limit 1), '["push"]'::jsonb));
  end if;
  return out;$a$])
where pg_get_functiondef('public.admin_r_rules(text)'::regprocedure) not like '%bill record%';

select public._admin_patch('public.admin_system_alerts()', array[
  $a$  return out;$a$,
  $a$  /* the server-measured response time: above 2 s on average in the last 30 minutes is a warning */
  for r in select target, round(avg(ms)) avg_ms, count(*) n from public.uptime_checks
           where via = 'server' and done and ok and ms is not null and at > now() - interval '30 minutes' group by 1 having avg(ms) > 2000 and count(*) >= 3 loop
    out := out || jsonb_build_object('k', 'slow:' || r.target, 'c', 'warn', 't', 'Lassú válasz: ' || regexp_replace(r.target, '^https?://', ''),
      's', 'Átlagosan ' || r.avg_ms || ' ms az elmúlt 30 percben (2000 ms fölött lassúnak számít).', 'to', 'monitor');
  end loop;
  return out;$a$])
where pg_get_functiondef('public.admin_system_alerts()'::regprocedure) not like '%slow:%';

-- ---------- 5.7 push: devices per sent notification ----------
create or replace function public.admin_push_status() returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  /* "devices": the subscriptions that existed when it was sent (0 = it reached nobody) */
  return jsonb_build_object('devices', (select count(*) from public.admin_push_subs),
    'sent', coalesce((select jsonb_agg(s order by s.at desc) from (select x.kind, x.title, x.body, x.url, x.at,
        (select count(*) from public.admin_push_subs p where p.created_at <= x.at) devices
      from public.admin_push_sent x order by x.at desc limit 20) s), '[]'));
end $function$;

-- ---------- 5.13, 5.15, 5.16, 5.19 events_real ----------
create or replace view public.events_real as
 WITH e AS (
         SELECT e.id, e.created_at, e.name, e.anon_id, e.user_id, e.props, e.session, e.path, e.lang
           FROM public.events e
          WHERE (NOT ((COALESCE(((e.props -> 'src'::text) ->> 'us'::text), ''::text) ~~* '%test%'::text) OR (COALESCE(((e.props -> 'src'::text) ->> 'uc'::text), ''::text) = ANY (ARRAY['qa'::text, 'qa2'::text, 'scoretest'::text, 'rec'::text, 'test'::text]))))
            AND (NOT (EXISTS ( SELECT 1 FROM public.admin_own_sessions o WHERE (o.session = e.session))))
            AND (NOT (EXISTS ( SELECT 1 FROM public.admin_bot_sessions b WHERE (b.session = e.session))))
            AND ((e.user_id IS NULL) OR (NOT (EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = e.user_id) AND COALESCE(p.reviewer, false))))))
        )
 SELECT e.id, e.created_at,
        CASE
            WHEN e.name IN ('photo_pick_open', 'design_pick_open', 'design_added', 'generate_done') THEN 'flow_step'::text
            WHEN e.name = 'photo_added' THEN 'signature_captured'
            WHEN e.name = 'generate_start' THEN 'analysis_start'
            WHEN e.name = 'onboarding_start' THEN 'quiz_start'
            WHEN e.name = 'stage_y50' THEN 'reveal_shown'
            WHEN e.name = 'preview_saved' THEN 'detail_open'
            WHEN e.name = 'share_link' THEN 'reveal_share'
            WHEN e.name = 'invite_share' THEN 'share_open'
            -- downloads, not shares (5.12, 5.13)
            WHEN e.name IN ('artist_pdf', 'video_made', 'save_image', 'aftercare_ics') THEN 'pro_file'
            -- "Nem jó?" → asked for a new preview, with its reasons in props.why
            WHEN e.name = 'redo' THEN 'more_designs'
            WHEN e.name = 'page_view' THEN 'landing_view'
            WHEN e.name = 'auth_signup' THEN 'signup'
            WHEN e.name = 'auth_ok' THEN CASE WHEN e.props->>'mode' = 'signup' THEN 'signup_confirmed' ELSE 'signin' END
            WHEN e.name = 'paywall' THEN 'paywall_shown'
            WHEN e.name IN ('nav_cta', 'landing_cta_app', 'tab_cta', 'nav_signup', 'nav_signin', 'drawer_signin', 'cta_signin', 'landing_usecase_cta',
                            'landing_cta_bottom', 'footer_signup', 'cta_signup', 'ctabar_click', 'landing_compare_cta', 'share_cta', 'landing_photo') THEN 'cta_click'
            ELSE e.name
        END AS name,
    ((COALESCE(e.props, '{}'::jsonb) || jsonb_build_object('ev', e.name)) ||
        CASE
            WHEN e.name = 'photo_pick_open' THEN jsonb_build_object('step', 'name')
            WHEN e.name = 'design_pick_open' THEN jsonb_build_object('step', 'sign')
            WHEN e.name = 'design_added' THEN jsonb_build_object('step', 'style', 'value', COALESCE((e.props ->> 'dsrc'::text),
                CASE WHEN (jsonb_typeof((e.props -> 'src'::text)) = 'string'::text) THEN (e.props ->> 'src'::text) ELSE NULL::text END, 'upload'::text))
            WHEN e.name = 'generate_done' THEN jsonb_build_object('step', 'score')
            WHEN e.name = 'artist_pdf' THEN jsonb_build_object('k', 'pdf')
            WHEN e.name = 'video_made' THEN jsonb_build_object('k', 'video')
            WHEN e.name = 'save_image' THEN jsonb_build_object('k', 'image')
            WHEN e.name = 'aftercare_ics' THEN jsonb_build_object('k', 'ics')
            WHEN e.name IN ('nav_signup', 'footer_signup', 'cta_signup', 'ctabar_click', 'share_cta') THEN jsonb_build_object('cta', 'register', 'btn', e.name)
            WHEN e.name IN ('nav_signin', 'drawer_signin', 'cta_signin') THEN jsonb_build_object('cta', 'login', 'btn', e.name)
            WHEN e.name IN ('nav_cta', 'landing_cta_app', 'tab_cta', 'landing_usecase_cta', 'landing_cta_bottom', 'landing_compare_cta', 'landing_photo') THEN jsonb_build_object('cta', 'guest', 'btn', e.name)
            ELSE '{}'::jsonb
        END) AS props,
    e.session, e.path, e.lang, e.user_id
   FROM e
  WHERE (e.name <> 'onboarding_done'::text)
UNION ALL
 -- the intro questions: one answer per question, the body map's "@front:x,y|" coordinates left out
 SELECT e.id, e.created_at, 'quiz_answer'::text AS name,
    jsonb_build_object('ev', e.name, 'step', a.key, 'value', nullif(trim(regexp_replace(a.value, '^@[a-z]+:[0-9.,-]*\|', '')), '')) AS props,
    e.session, e.path, e.lang, e.user_id
   FROM (e CROSS JOIN LATERAL jsonb_each_text(COALESCE(e.props, '{}'::jsonb)) a(key, value))
  WHERE ((e.name = 'onboarding_done'::text) AND (a.key = ANY (ARRAY['goal'::text, 'style'::text, 'placement'::text])))
UNION ALL
 -- the style step without a design_added event: a library design, an AI design, or an existing tattoo on the photo
 SELECT e.id, e.created_at, 'flow_step'::text AS name,
    jsonb_build_object('ev', e.name, 'step', 'style', 'value', CASE WHEN e.name = 'ai_design' THEN 'ai'
      WHEN nullif(e.props->>'lib', '') IS NOT NULL THEN 'library' ELSE coalesce(e.props->>'mode', 'existing') END, 'derived', true) AS props,
    e.session, e.path, e.lang, e.user_id
   FROM e
  WHERE e.name = 'ai_design' OR (e.name = 'generate_start' AND (nullif(e.props->>'lib', '') IS NOT NULL OR e.props->>'mode' IN ('existing', 'removal')));

-- ---------- 5.13 sharing ----------
select public._admin_patch('public.admin_viral(timestamptz,timestamptz,text,text)', array[
  $a$bool_or(name = 'flow_step' and props->>'step' = 'score') scored,
      bool_or(name = 'share_open' or name = 'reveal_share') opened,$a$,
  $a$bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'share_view') sv,
      bool_or(name = 'share_open' or name = 'reveal_share') opened,$a$,
  $a$else coalesce(src->>'ref', '?') end kind,$a$,
  $a$when src ? 'ref' then coalesce(src->>'ref', '?') else 'preview' end kind,$a$,
  $a$from s where lower(coalesce(src->>'us', '')) = 'share' or src ? 'ref'$a$,
  $a$from s where lower(coalesce(src->>'us', '')) = 'share' or src ? 'ref' or sv$a$])
where pg_get_functiondef('public.admin_viral(timestamptz,timestamptz,text,text)'::regprocedure) not like '% sv,%';

-- ---------- 5.15 the web funnel: "clicked a button, then opened the app" ----------
select public._admin_patch('public.admin_funnel(integer,timestamptz,timestamptz,text,text)', array[
  $a$'land_app', count(*) filter (where land and app),$a$,
  $a$'land_app', count(*) filter (where land and app), 'cta_app', count(*) filter (where land and cta and app),$a$])
where pg_get_functiondef('public.admin_funnel(integer,timestamptz,timestamptz,text,text)'::regprocedure) not like '%cta_app%';

-- ---------- 5.12 usage page ----------
select public._admin_patch('public.admin_product(integer,timestamptz,timestamptz,text,text)', array[
  $a$    'scores', coalesce($a$,
  $a$    /* InkAge: the downloaded files (PDF, video, image, aftercare calendar), the "Nem jó?" re-requests with their reasons,
       and the reminders from push_reminders (own and test accounts left out) */
    'files', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(props->>'k', '?') k, count(*) n from ev where name = 'pro_file' group by 1) x), '[]'),
    'redo', jsonb_build_object('n', (select count(*) from ev where props->>'ev' = 'redo'), 'prev', (select count(*) from pev where props->>'ev' = 'redo'),
      'why', coalesce((select jsonb_agg(x order by x.n desc) from (select w k, count(*) n from ev, unnest(string_to_array(coalesce(nullif(props->>'why', ''), 'other'), ',')) w
        where props->>'ev' = 'redo' group by 1) x), '[]')),
    'reminders', (select jsonb_build_object('set', count(*) filter (where pr.created_at >= r.a and pr.created_at < r.b),
        'sent', count(*) filter (where pr.sent_at >= r.a and pr.sent_at < r.b),
        'cancelled', count(*) filter (where pr.cancelled and pr.created_at >= r.a and pr.created_at < r.b),
        'waiting', count(*) filter (where pr.sent_at is null and not coalesce(pr.cancelled, false) and pr.send_at > now()),
        'kinds', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(q.kind, '?') k, count(*) n from public.push_reminders q
          where q.created_at >= r.a and q.created_at < r.b and (q.user_id is null or exists (select 1 from public.admin_real_users ru where ru.id = q.user_id)) group by 1) x), '[]'))
      from public.push_reminders pr where pr.user_id is null or exists (select 1 from public.admin_real_users ru where ru.id = pr.user_id)),
    'scores', coalesce($a$])
where pg_get_functiondef('public.admin_product(integer,timestamptz,timestamptz,text,text)'::regprocedure) not like '%push_reminders%';

-- ---------- 4.M4 log_event ----------
create or replace function public.log_event(p_name text, p_anon text, p_props jsonb) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare nm text := lower(trim(coalesce(p_name, ''))); pr jsonb := coalesce(p_props, '{}'::jsonb); trusted boolean; n int; an text := left(p_anon, 64);
begin
  /* a sane event name only */
  if nm !~ '^[a-z0-9_]{1,40}$' then raise exception 'bad event name' using errcode = '22023'; end if;
  if jsonb_typeof(pr) <> 'object' then pr := jsonb_build_object('value', pr); end if;
  /* the server proves itself with the shared server secret in props._sk (appSecret('db') = private.config webhook_secret) */
  trusted := coalesce(pr->>'_sk' = (select value from private.config where key = 'webhook_secret'), false);
  pr := pr - '_sk';
  if length(pr::text) > 4000 then pr := jsonb_build_object('truncated', true); end if;
  /* server-only names from anyone else are kept apart, so a forged one never counts as a real server error */
  if nm in ('server_error') and not trusted then nm := 'server_error_unverified'; end if;
  /* at most 120 events a minute from one visitor (600 without a visitor id); more are dropped quietly */
  if not trusted then
    if an is not null then
      select count(*) into n from public.events where created_at > now() - interval '1 minute' and anon_id = an;
      if n >= 120 then return; end if;
    else
      select count(*) into n from public.events where created_at > now() - interval '1 minute' and anon_id is null;
      if n >= 600 then return; end if;
    end if;
  end if;
  insert into public.events(name, anon_id, user_id, props) values (nm, an, auth.uid(), pr);
end $function$;

-- ---------- 5.20 a visit's "last step" is the furthest step it reached (not the screen it happened to reopen last) ----------
select public._admin_patch('public.admin_visit(text)', array[
  $a$'last_step', (array_agg(e.props->>'step' order by e.created_at desc) filter (where e.name = 'flow_step'))[1],$a$,
  $a$'last_step', (array_agg(e.props->>'step' order by case e.props->>'step' when 'score' then 4 when 'style' then 3 when 'sign' then 2 when 'name' then 1 else 0 end desc, e.created_at desc) filter (where e.name = 'flow_step'))[1],$a$])
where pg_get_functiondef('public.admin_visit(text)'::regprocedure) not like '%when ''score'' then 4%';
