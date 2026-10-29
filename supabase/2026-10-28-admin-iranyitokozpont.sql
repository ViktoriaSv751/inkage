-- InkAge Irányítóközpont (/admin): the owner's private dashboard, the same system as Calligra's (calligra.me/admin),
-- built on InkAge's own data. Generated from Calligra's admin schema; the InkAge-specific parts are marked "InkAge:".
--
-- No service-role key: every admin function lets in only the signed-in owner (public.is_admin(): an e-mail in
-- public.admin_emails, confirmed) or the scheduled run, which pg_cron starts with a token the database keeps for
-- itself (public.admin_secrets). Platform keys (Search Console, stores, social) are pasted by the owner on the
-- dashboard's Bekötések page and kept in Vault ("inkage_admin.*").
--
-- InkAge: events. InkAge's events carry an anonymous device id (anon_id) and put the page and language in props;
-- the dashboard counts visits (session), pages (path) and languages (lang) like Calligra's events. The columns
-- are filled on insert from what the tracker sends (props.sid / path / lang), or, for older app versions and the
-- history, from the device and the day (one visit per device per day).

set check_function_bodies = false;

alter table public.events add column if not exists session text, add column if not exists path text, add column if not exists lang text;

create or replace function public.events_ink_fill() returns trigger
language plpgsql set search_path to '' as $$
begin
  new.session := coalesce(new.session, nullif(left(new.props->>'sid', 64), ''),
    case when coalesce(new.anon_id, 'na') <> 'na' then left(new.anon_id, 40) || '.' || to_char(new.created_at at time zone 'Europe/Budapest', 'YYMMDD') end);
  new.path := coalesce(new.path, nullif(left(new.props->>'path', 200), ''));
  new.lang := coalesce(new.lang, nullif(left(new.props->>'lang', 8), ''));
  if new.props ? 'sid' then new.props := new.props - 'sid'; end if;
  return new;
end $$;
drop trigger if exists events_ink_fill on public.events;
create trigger events_ink_fill before insert on public.events for each row execute function public.events_ink_fill();

update public.events e set
  session = coalesce(e.session, case when coalesce(e.anon_id, 'na') <> 'na' then left(e.anon_id, 40) || '.' || to_char(e.created_at at time zone 'Europe/Budapest', 'YYMMDD') end),
  path = coalesce(e.path, nullif(left(e.props->>'path', 200), ''), case when e.name in ('landing_view', 'landing_faq', 'landing_usecase', 'landing_compare') then '/' end),
  lang = coalesce(e.lang, (select left(p.lang, 8) from public.profiles p where p.id = e.user_id))
where e.session is null or e.path is null or e.lang is null;

create index if not exists events_session on public.events (session);


CREATE OR REPLACE FUNCTION "public"."_admin_patch"("p_sig" "text", "p_pairs" "text"[]) RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare d text; i int; n int;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    n := (length(d) - length(replace(d, p_pairs[2*i-1], ''))) / greatest(length(p_pairs[2*i-1]), 1);
    if n = 0 then raise exception 'patch %: pair % not found: %', p_sig, i, left(p_pairs[2*i-1], 80); end if;
    d := replace(d, p_pairs[2*i-1], p_pairs[2*i]);
  end loop;
  execute d;
  return p_sig || ' ok';
end $$;

ALTER FUNCTION "public"."_admin_patch"("p_sig" "text", "p_pairs" "text"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_activation"("p_days" integer DEFAULT 0, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; a timestamptz := '-infinity'; b timestamptz := 'infinity';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_days, 0) <> 0 or p_from is not null then select * into r from public.admin_range(p_days, p_from, p_to); a := r.a; b := r.b; end if;
  return (with f as (select * from public.admin_user_facts() where not own and created_at >= a and created_at < b),
    h as (select extract(epoch from first_unlock_at - created_at) / 3600 hrs from f where first_unlock_at is not null)
    select jsonb_build_object(
      'accounts', (select count(*) from f), 'activated', (select count(*) from f where unl_all > 0 or gift),
      'median_hours', (select percentile_cont(.5) within group (order by hrs) from h),
      'buckets', jsonb_build_object('h1', (select count(*) from h where hrs < 1), 'd1', (select count(*) from h where hrs >= 1 and hrs < 24),
        'w1', (select count(*) from h where hrs >= 24 and hrs < 168), 'later', (select count(*) from h where hrs >= 168), 'never', (select count(*) from f where first_unlock_at is null)),
      'gaps', (select jsonb_agg(jsonb_build_object('k', g.k, 'have', g.have, 'missing', g.missing, 'who', g.who)) from (
        select k.k,
          count(*) filter (where k.done) have, count(*) filter (where not k.done) missing,
          coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'email', k.email, 'score', k.score) order by k.score desc) filter (where not k.done), '[]') who
        from (select x.*, v.k, case v.k when 'confirm' then x.confirmed when 'unlock' then x.unl_all > 0 when 'gift' then x.gift when 'cal' then x.cal when 'design' then x.design
            when 'second' then x.unl_all >= 2 end done
          from public.admin_user_facts() x cross join (values ('confirm'), ('unlock'), ('gift'), ('second'), ('cal'), ('design')) v(k)
          where not x.own and x.last_active_at > now() - interval '30 days') k
        group by k.k) g)));
end $$;

ALTER FUNCTION "public"."admin_activation"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_alert_mark"("p_k" "text", "p_state" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_alert_state (k) values (left(p_k, 200)) on conflict (k) do nothing;
  update public.admin_alert_state set
    done_at = case p_state when 'done' then now() when 'open' then null else done_at end,
    later_until = case p_state when 'later' then (now() at time zone 'Europe/Budapest')::date + 1 when 'open' then null else later_until end
  where k = left(p_k, 200);
end $$;

ALTER FUNCTION "public"."admin_alert_mark"("p_k" "text", "p_state" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_alerts_sync"("p_list" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare x jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_list, '[]')) loop
    continue when coalesce(x->>'k', '') = '';
    insert into public.admin_alert_state (k, c, title) values (left(x->>'k', 200), left(x->>'c', 8), left(x->>'t', 200))
    on conflict (k) do update set c = excluded.c, title = excluded.title, /* one more sighting only after 6 hours away, not on every page load */
      seen_n = public.admin_alert_state.seen_n + case when public.admin_alert_state.last_seen < now() - interval '6 hours' then 1 else 0 end,
      /* gone for a day and back: a new occurrence (it starts again, and a "done" no longer hides it); a done older than 14 days opens again too */
      first_seen = case when public.admin_alert_state.last_seen < now() - interval '36 hours' then now() else public.admin_alert_state.first_seen end,
      done_at = case when public.admin_alert_state.last_seen < now() - interval '36 hours' or public.admin_alert_state.done_at < now() - interval '14 days' then null else public.admin_alert_state.done_at end,
      last_seen = now();
  end loop;
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.last_seen desc) from (select * from public.admin_alert_state order by last_seen desc limit 120) s), '[]');
end $$;

ALTER FUNCTION "public"."admin_alerts_sync"("p_list" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_announce_delete"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.admin_announcements where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_announce_delete"("p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_announce_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('live', a.on_ and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())) order by a.created_at desc) from public.admin_announcements a), '[]');
end $$;

ALTER FUNCTION "public"."admin_announce_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_announce_save"("p" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p->>'title', ''))) = 0 then raise exception 'Adj meg címet.'; end if;
  if (p->>'starts_at') is not null and (p->>'ends_at') is not null and (p->>'ends_at')::timestamptz <= (p->>'starts_at')::timestamptz then raise exception 'A vége a kezdete után legyen.'; end if;
  if coalesce(p->>'link', '') <> '' and (p->>'link') !~ '^(/|https://)' then raise exception 'A link /-rel vagy https://-sel kezdődjön.'; end if;
  if (p->>'id') is null then
    insert into public.admin_announcements (title, body, kind, lang, platform, starts_at, ends_at, on_, link)
    values (left(p->>'title', 120), left(coalesce(p->>'body', ''), 500), coalesce(p->>'kind', 'info'), nullif(p->>'lang', ''), coalesce(nullif(p->>'platform', ''), 'all'),
      (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz, coalesce((p->>'on_')::boolean, true), nullif(p->>'link', '')) returning id into v;
  else
    update public.admin_announcements set title = left(p->>'title', 120), body = left(coalesce(p->>'body', ''), 500), kind = coalesce(p->>'kind', 'info'), lang = nullif(p->>'lang', ''),
      platform = coalesce(nullif(p->>'platform', ''), 'all'), starts_at = (p->>'starts_at')::timestamptz, ends_at = (p->>'ends_at')::timestamptz,
      on_ = coalesce((p->>'on_')::boolean, on_), link = nullif(p->>'link', ''), updated_at = now() where id = (p->>'id')::bigint returning id into v;
  end if;
  return v;
end $$;

ALTER FUNCTION "public"."admin_announce_save"("p" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_articles"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare k integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650)); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with v as (
    select regexp_replace(coalesce(props->>'page', path), '^/knowledge/([^/?#]+).*$', '\1') slug,
      left(coalesce(substring(coalesce(props->>'page', '') from '[?&]lang=([a-z]{2})'), lang, '?'), 2) lg, session
    from public.events_real
    where name = 'landing_view' and created_at >= now() - make_interval(days => k) and coalesce(props->>'page', path) like '/tudastar/%'
  ), app as (
    select distinct session from public.events_real where name = 'app_open' and created_at >= now() - make_interval(days => k)
  ), gs as (
    select regexp_replace(page, '^https?://[^/]+/(?:[a-z]{2}/)?knowledge/([^/?#]+).*$', '\1') slug,
      coalesce(substring(page from '[?&]lang=([a-z]{2})'), substring(page from '^https?://[^/]+/([a-z]{2})/knowledge/'), 'hu') lg, sum(clicks) clicks, sum(impressions) impressions
    from public.gsc_daily where page ~ '/knowledge/[^/?#]+' and day > public.admin_today() - k group by 1, 2
  )
  select jsonb_build_object(
    'cells', coalesce((select jsonb_agg(x) from (select slug, lg, count(*) n, count(distinct session) sessions from v group by 1, 2) x), '[]'),
    'articles', coalesce((select jsonb_agg(x order by x.n desc, x.clicks desc) from (
      select a.slug, coalesce(vv.n, 0) n, coalesce(vv.sessions, 0) sessions, coalesce(vv.to_app, 0) to_app, coalesce(gg.clicks, 0) clicks, coalesce(gg.impressions, 0) impressions
      from (select slug from v union select slug from gs) a
      left join (select v.slug, count(*) n, count(distinct v.session) sessions, count(distinct v.session) filter (where ap.session is not null) to_app from v left join app ap on ap.session = v.session group by 1) vv on vv.slug = a.slug
      left join (select slug, sum(clicks) clicks, sum(impressions) impressions from gs group by 1) gg on gg.slug = a.slug
      where a.slug !~ '[/:?]') x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (select lg k, count(*) n from v group by 1) x), '[]'),
    'gsc', coalesce((select jsonb_agg(x) from (select slug, lg, clicks, impressions from gs where slug !~ '[/:?]') x), '[]')
  ) into res;
  return res;
end $_$;

ALTER FUNCTION "public"."admin_articles"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_audience"("p_days" integer DEFAULT 120) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(7, least(coalesce(nullif(p_days, 0), 3650), 3650));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', d,
    'demo', coalesce((select jsonb_agg(to_jsonb(a) order by a.platform, a.breakdown, a.n desc) from public.social_audience a), '[]'),
    'followers', coalesce((select jsonb_agg(x order by x.day) from (select platform, day, followers, gained, lost from public.social_account_daily where day >= public.admin_today() - d) x), '[]'),
    'posts', coalesce((select jsonb_agg(x order by x.created_at) from (
        select platform, post_id, created_at, left(title, 80) title, views, likes, comments, shares, saves, follows from public.social_posts where created_at >= now() - make_interval(days => d)) x), '[]'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from (
        select * from public.social_stories where created_at >= now() - make_interval(days => d) order by created_at desc limit 200) s), '[]'));
end $$;

ALTER FUNCTION "public"."admin_audience"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_audit_add"("p_action" "text", "p_target" "text", "p_detail" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.admin_audit (actor, action, target, detail)
  values (coalesce((select u.email from auth.users u where u.id = auth.uid()), case when auth.uid() is null then 'időzített futás' end), left(p_action, 60), left(p_target, 200), coalesce(p_detail, '{}'));
end $$;

ALTER FUNCTION "public"."admin_audit_add"("p_action" "text", "p_target" "text", "p_detail" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_audit_list"("p_kind" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0, "p_target" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.admin_audit a where (p_kind is null or a.action like p_kind || '%') and (p_target is null or a.target = p_target)),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (
      select a.* from public.admin_audit a where (p_kind is null or a.action like p_kind || '%') and (p_target is null or a.target = p_target)
      order by a.at desc limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset)) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_audit_list"("p_kind" "text", "p_limit" integer, "p_offset" integer, "p_target" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_audit_note"("p_action" "text", "p_target" "text", "p_detail" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action !~ '^(fiok|uzenet|export|kozlemeny|valasz)\.[a-z_]+$' then raise exception 'bad action'; end if;
  perform public.admin_audit_add(p_action, p_target, p_detail);
end $_$;

ALTER FUNCTION "public"."admin_audit_note"("p_action" "text", "p_target" "text", "p_detail" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_audit_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r jsonb := to_jsonb(coalesce(new, old)); act text := tg_argv[0] || '.' || lower(tg_op);
begin
  perform public.admin_audit_add(act, coalesce(r->>'id', r->>'code', r->>'url', r->>'title'),
    case tg_argv[0]
      when 'terv' then jsonb_build_object('cím', r->>'title', 'nap', r->>'day', 'platformok', r->'platforms', 'közzététel', r->'publish', 'állapot', r->>'status')
      when 'link' then jsonb_build_object('cél', r->>'target', 'forrás', r->>'source')
      when 'szabaly' then jsonb_build_object('mérőszám', r->>'metric', 'küszöb', r->'threshold', 'be', r->'on_')
      when 'kozlemeny' then jsonb_build_object('cím', r->>'title', 'be', r->'on_', 'nyelv', r->>'lang')
      when 'figyeles' then jsonb_build_object('cím', r->>'url', 'be', r->'on_')
      else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

ALTER FUNCTION "public"."admin_audit_trg"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'errors_open', (select count(*) from (
      select e.fp, max(e.created_at) last from (select md5(name || '|' || coalesce(props->>'provider', props->>'where', '') || '|' || left(regexp_replace(coalesce(props->>'why', props->>'msg', ''), '[0-9a-f]{6,}|\d+', '#', 'g'), 120)) fp, created_at
        from public.events_real where name in ('client_error', 'storage_full', 'signin_failed', 'auth_error') and created_at > now() - interval '14 days') e group by e.fp) g
      left join public.error_groups s on s.fp = g.fp
      where s.fp is null or s.state = 'open' or (s.state = 'resolved' and g.last > s.resolved_at)),
    /* every unanswered, not closed review: the same count as the Postafiók page */
    'inbox_open', (select count(*) from public.inbox_items where not done) + (select count(*) from public.store_reviews where reply is null and not done),
    'connect_bad', (select count(*) from public.social_accounts where last_error is not null or least(refresh_expires_at, case when platform in ('linkedin', 'instagram') then token_expires_at end) < now() + interval '7 days'),
    /* an outage counts only when the server's own check failed too (the same rule as the 'down' alert) */
    'monitor_bad', (select count(*) from public.uptime_checks u where u.done and not u.ok and u.via = 'pg_net' and u.at > now() - interval '15 minutes'
        and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes'))
      + jsonb_array_length(public.admin_jobs_failing())
      + (select count(*) from public.cert_status where valid_to < now() + interval '14 days' or domain_expires < now() + interval '30 days'));
end $$;

ALTER FUNCTION "public"."admin_badges"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_bots_tick"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer; d0 date;
begin
  k := public.admin_mark_bots(now() - interval '2 days', now() - interval '30 minutes');
  if k > 0 then
    select min((x.t0 at time zone 'Europe/Budapest')::date) into d0
    from (select min(e.created_at) t0 from public.events e join public.admin_bot_sessions b on b.session = e.session where b.marked_at = now() group by e.session) x;
    if d0 is not null then perform public.admin_rollup(d0); end if;
  end if;
  return k;
end $$;

ALTER FUNCTION "public"."admin_bots_tick"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_brand"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mentions', coalesce((select jsonb_agg(x order by x.at desc nulls last) from (select * from public.brand_mentions order by at desc nulls last limit 120) x), '[]'),
    'unseen', (select count(*) from public.brand_mentions where not seen),
    'ai', coalesce((select jsonb_agg(x order by x.day desc, x.question) from (select * from public.ai_visibility where day > public.admin_today() - 70) x), '[]'),
    'competitors', coalesce((select jsonb_agg(jsonb_build_object('platform', c.platform, 'handle', c.handle,
        'days', coalesce((select jsonb_agg(d order by d.day) from public.social_competitor_daily d where d.platform = c.platform and d.handle = c.handle and d.day > public.admin_today() - 120), '[]'))) from public.social_competitors c), '[]'),
    'own', coalesce((select jsonb_agg(x) from (select distinct on (platform) platform, followers, posts from public.social_account_daily where followers is not null order by platform, day desc) x), '[]'),
    'own_days', coalesce((select jsonb_agg(x order by x.day) from (
        select platform, day, followers from public.social_account_daily where followers is not null and day > public.admin_today() - 120) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_brand"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_brand_seen"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.brand_mentions set seen = true where not seen;
end $$;

ALTER FUNCTION "public"."admin_brand_seen"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_breadcrumbs"("p_session" "text", "p_before" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (select created_at, name, coalesce(props->>'step', props->>'page', props->>'k', props->>'why', '') detail, path, lang
      from public.events_real where session = p_session and created_at <= p_before + interval '2 seconds' order by created_at desc limit 12) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_breadcrumbs"("p_session" "text", "p_before" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_channel"("src" "jsonb", "ia" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  with x as (select lower(trim(coalesce(src->>'us', ''))) us, lower(coalesce(src->>'um', '')) um, lower(coalesce(src->>'from', '')) h)
  select coalesce(
    case when x.us = '' then null
      when x.us ~ '^(ig|insta)' or x.us like '%instagram%' then 'instagram'
      when x.us ~ '^(tt|tiktok)' or x.us like '%tiktok%' then 'tiktok'
      when x.us like '%messenger%' then 'messenger'
      when x.us ~ '^(fb|facebook)' or x.us like '%facebook%' then 'facebook'
      when x.us ~ '^(yt|youtube)' or x.us like '%youtube%' then 'youtube'
      when x.us ~ '^(pin|pinterest)' then 'pinterest'
      when x.us ~ '^(li|lnkd)([-_. ]|$)' or x.us like '%linkedin%' then 'linkedin'
      when x.us ~ '^(x|tw|twitter)([-_. ]|$)' or x.us like '%twitter%' then 'x'
      when x.us like '%threads%' then 'threads'
      when x.us like '%reddit%' then 'reddit'
      when x.us ~ '^(wa|whatsapp)([-_. ]|$)' or x.us like '%whatsapp%' then 'whatsapp'
      when x.us ~ '^(tg)([-_. ]|$)' or x.us like '%telegram%' then 'telegram'
      when x.us like '%snap%' then 'snapchat'
      when x.us ~ '(e-?mail|newsletter|hirlevel|hírlevél)' or x.us ~ '^mail' then 'email'
      when x.us ~ '(chatgpt|openai|perplexity|gemini|copilot|claude)' then 'ai'
      when x.us like '%google%' and x.um in ('cpc', 'ppc', 'paid', 'paidsearch', 'display') then 'ads'
      when x.us like '%google%' then 'google'
      when x.us like '%bing%' then 'bing'
      else x.us end,
    case when x.h = '' then null
      when x.h ~ '(^|\.)mail\.google\.' or x.h like 'com.google.android.gm%' or x.h ~ '(outlook|hotmail|live)\.(com|hu)$' or x.h ~ '^mail\.' or x.h ~ '(freemail|citromail)\.hu$' or x.h like '%mail.yahoo%' then 'email'
      when x.h like '%play.google%' then 'play'
      when x.h ~ '(googleads|doubleclick|googlesyndication|googleadservices)' then 'ads'
      when x.h like '%tiktok%' then 'tiktok'
      when x.h like '%instagram%' then 'instagram'
      when x.h like '%messenger%' or x.h = 'm.me' then 'messenger'
      when x.h like '%facebook%' or x.h like '%fb.%' then 'facebook'
      when x.h like '%pinterest%' or x.h like '%pin.it%' then 'pinterest'
      when x.h like '%linkedin%' or x.h like '%lnkd.in%' then 'linkedin'
      when x.h = 't.co' or x.h like '%twitter%' or x.h = 'x.com' or x.h like '%.x.com' then 'x'
      when x.h like '%threads.net%' or x.h like '%threads.com%' then 'threads'
      when x.h like '%reddit%' then 'reddit'
      when x.h like '%whatsapp%' or x.h = 'wa.me' then 'whatsapp'
      when x.h like '%telegram%' or x.h = 't.me' then 'telegram'
      when x.h like '%snapchat%' then 'snapchat'
      when x.h like '%youtube%' then 'youtube'
      when x.h ~ '(chatgpt|openai|perplexity|gemini|copilot|claude\.ai)' then 'ai'
      when x.h like '%google%' or x.h like '%googlequicksearchbox%' then 'google'
      when x.h like '%bing%' then 'bing'
      when x.h ~ '(duckduckgo|yahoo|yandex|ecosia|brave|startpage|qwant|seznam)' then 'kereső'
      else 'hivatkozás' end,
    nullif(ia, ''),
    case when src->>'ret' = '1' then 'visszatérő' end,
    'közvetlen')
  from x
$_$;

ALTER FUNCTION "public"."admin_channel"("src" "jsonb", "ia" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_channel_detail"("p_ch" "text", "p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; res jsonb; tz constant text := 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with s as (select * from public.admin_sess(r.a, r.b, p_ch, p_lang)),
  ps as (select * from public.admin_sess(r.pa, r.a, p_ch, p_lang)),
  su as (select m.* from public.admin_signups_matched(r.a, r.b) m where m.ch = any(string_to_array(p_ch, ',')) and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
  psu as (select m.* from public.admin_signups_matched(r.pa, r.a) m where m.ch = any(string_to_array(p_ch, ',')) and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
  bk as (select g::date t from generate_series((r.a at time zone tz)::date, (r.b at time zone tz)::date, interval '1 day') g)
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(x order by x.t) from (
      select bk.t, count(s.session) sessions, count(s.session) filter (where s.scored) scored,
        (select count(*) from su where (su.created_at at time zone tz)::date = bk.t) signups
      from bk left join s on (s.t0 at time zone tz)::date = bk.t group by bk.t) x), '[]'),
    'landing', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.src->>'land', '/') k, count(*) n, count(*) filter (where s.scored) scored, count(distinct su.user_id) signups
      from s left join su on su.session = s.session group by 1 order by 2 desc limit 12) x), '[]'),
    'campaigns', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.src->>'ux', s.src->>'uc') k, count(*) n, count(*) filter (where s.scored) scored, count(distinct su.user_id) signups, min(s.t0) first, max(s.t0) last
      from s left join su on su.session = s.session where s.src ? 'ux' or s.src ? 'uc' group by 1 order by 2 desc limit 15) x), '[]'),
    'referrers', coalesce((select jsonb_agg(x order by x.n desc) from (
      select s.src->>'from' k, count(*) n, count(*) filter (where s.scored) scored from s where s.src ? 'from' group by 1 order by 2 desc limit 10) x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.lang, '?') k, count(*) n, count(*) filter (where s.scored) scored, count(distinct su.user_id) signups
      from s left join su on su.session = s.session group by 1 order by 2 desc limit 10) x), '[]'),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select s.pf k, count(*) n from s group by 1) x), '[]'),
    'totals', (select jsonb_build_object('sessions', count(*), 'scored', count(*) filter (where scored), 'revealed', count(*) filter (where revealed), 'signups', (select count(*) from su)) from s),
    'prev', (select jsonb_build_object('sessions', count(*), 'scored', count(*) filter (where scored), 'signups', (select count(*) from psu)) from ps),
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (
      select y.*, (select count(*) from s where s.src->>'ux' = y.code) sessions, (select count(*) from s where s.src->>'ux' = y.code and s.scored) scored
      from (select q.title, q.url, q.views, q.created_at, coalesce(q.code, (select l.code from public.short_links l where l.post_platform = q.platform and l.post_id = q.post_id limit 1)) code
            from public.social_posts q where q.platform = any(string_to_array(p_ch, ',')) order by q.created_at desc nulls last limit 12) y) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_channel_detail"("p_ch" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cohorts_source"("p_days" integer DEFAULT 90, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; t date := public.admin_today();
  a timestamptz := case when coalesce(p_days, 0) = 0 then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((with m as (select * from public.admin_signups_matched(a, now() + interval '1 minute')),
    u as (select u.id, (u.created_at at time zone tz)::date d0, coalesce(m.ch, 'ismeretlen') ch from public.admin_real_users u left join m on m.user_id = u.id where u.created_at >= a
      /* the page's filters: a channel keeps its own row, a language keeps the accounts that signed up in it */
      and (p_ch is null or coalesce(m.ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
      and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
    x as (select u.ch, u.d0,
        exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.day = u.d0 + 1) r1,
        exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.day between u.d0 + 1 and u.d0 + 7) r7,
        exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.day between u.d0 + 8 and u.d0 + 30) r30,
        exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.day > t - 7) a7
      from u)
    select jsonb_agg(jsonb_build_object('ch', ch, 'n', n, 'e1', e1, 'r1', r1, 'e7', e7, 'r7', r7, 'e30', e30, 'r30', r30, 'a7', a7) order by n desc) from (
      select ch, count(*) n, count(*) filter (where d0 <= t - 1) e1, count(*) filter (where d0 <= t - 1 and r1) r1,
        count(*) filter (where d0 <= t - 7) e7, count(*) filter (where d0 <= t - 7 and r7) r7,
        count(*) filter (where d0 <= t - 30) e30, count(*) filter (where d0 <= t - 30 and r30) r30, count(*) filter (where a7) a7
      from x group by ch) y), '[]');
end $$;

ALTER FUNCTION "public"."admin_cohorts_source"("p_days" integer, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_collect_days"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare k integer;
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_user_days (user_id, day)
  select id, (created_at at time zone 'Europe/Budapest')::date from auth.users
  union select id, (last_sign_in_at at time zone 'Europe/Budapest')::date from auth.users where last_sign_in_at is not null
  union select user_id::uuid, (created_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$'
  union select user_id::uuid, (updated_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$' and updated_at is not null
  on conflict do nothing;
  get diagnostics k = row_count;
  return k;
end $_$;

ALTER FUNCTION "public"."admin_collect_days"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_collect_days_t"("p_token" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_user_days (user_id, day)
  select id, (created_at at time zone 'Europe/Budapest')::date from auth.users
  union select id, (last_sign_in_at at time zone 'Europe/Budapest')::date from auth.users where last_sign_in_at is not null
  union select user_id::uuid, (created_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$'
  union select user_id::uuid, (updated_at at time zone 'Europe/Budapest')::date from auth.refresh_tokens where user_id ~ '^[0-9a-f-]{36}$' and updated_at is not null
  on conflict do nothing;
  get diagnostics k = row_count;
  return k;
end $_$;

ALTER FUNCTION "public"."admin_collect_days_t"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_competitor_delete"("p_app_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.competitors where app_id = p_app_id;
end $$;

ALTER FUNCTION "public"."admin_competitor_delete"("p_app_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_competitors"("p_country" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare cc text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  cc := coalesce(nullif(lower(p_country), ''), (select country from public.competitor_daily group by 1 order by count(*) desc limit 1), 'hu');
  return jsonb_build_object('country', cc,
    'countries', coalesce((select jsonb_agg(distinct country) from public.competitor_daily), '[]'),
    'apps', coalesce((select jsonb_agg(x order by x.mine desc, x.ratings desc nulls last) from (
      select c.app_id, c.name, c.developer, c.icon, c.url, c.mine, l.rating, l.ratings, l.version, l.price, l.day,
        (select w.ratings from public.competitor_daily w where w.app_id = c.app_id and w.country = cc and w.day <= public.admin_today() - 7 order by w.day desc limit 1) ratings_week_ago,
        (select w.rating from public.competitor_daily w where w.app_id = c.app_id and w.country = cc and w.day <= public.admin_today() - 30 order by w.day desc limit 1) rating_month_ago,
        coalesce((select jsonb_agg(jsonb_build_object('t', d.day, 'v', d.ratings, 'r', d.rating) order by d.day) from public.competitor_daily d where d.app_id = c.app_id and d.country = cc and d.day > public.admin_today() - 90), '[]') series,
        coalesce((select jsonb_agg(jsonb_build_object('day', z.day, 'version', z.version, 'prev', z.prev) order by z.day desc) from (
          select d.day, d.version, lag(d.version) over (order by d.day) prev from public.competitor_daily d where d.app_id = c.app_id and d.country = cc) z
          where z.prev is not null and z.prev is distinct from z.version), '[]') versions
      from public.competitors c
      left join lateral (select * from public.competitor_daily d where d.app_id = c.app_id and d.country = cc order by d.day desc limit 1) l on true) x), '[]'),
    'aso', coalesce((select jsonb_agg(x order by x.term, x.pos nulls last) from (
      select a.term, a.app_id, a.pos, a.day,
        (select b.pos from public.competitor_aso b where b.country = cc and b.term = a.term and b.app_id = a.app_id and b.day <= a.day - 7 order by b.day desc limit 1) pos_week_ago
      from public.competitor_aso a where a.country = cc and a.day = (select max(day) from public.competitor_aso where country = cc)) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_competitors"("p_country" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_connections"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', a.platform, 'username', a.username, 'display_name', a.display_name, 'connected_at', a.connected_at,
        'last_sync_at', a.last_sync_at, 'last_error', a.last_error, 'token_expires_at', a.token_expires_at, 'refresh_expires_at', a.refresh_expires_at, 'scopes', a.scopes,
        'posts', (select count(*) from public.social_posts p where p.platform = a.platform))) from public.social_accounts a), '[]'),
    'sync', coalesce((select jsonb_object_agg(source, jsonb_build_object('ok_at', ok_at, 'err_at', err_at, 'err', err, 'last_ok', last_ok)) from (
      select source, max(at) filter (where ok) ok_at, max(at) filter (where not ok) err_at, (array_agg(message order by at desc) filter (where not ok))[1] err, (array_agg(ok order by at desc))[1] last_ok
      from public.sync_log where at > now() - interval '30 days' and source <> 'ai' group by source) s), '{}'),
    'tests', coalesce((select jsonb_object_agg(substr(k, 6), v) from public.admin_settings where k like 'test:%'), '{}'),
    'approvals', coalesce((select v from public.admin_settings where k = 'approvals'), '{}'));
end $$;

ALTER FUNCTION "public"."admin_connections"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_call_long"("p_path" "text") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select public.admin_cron_call(p_path) $$;

ALTER FUNCTION "public"."admin_cron_call_long"("p_path" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_ok"("p_token" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p_token is not null and length(p_token) = 64 and p_token = (select v from public.admin_secrets where k = 'cron')
$$;

ALTER FUNCTION "public"."admin_cron_ok"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_run"("p_job" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare c text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select command into c from cron.job where jobname = p_job and jobname like 'admin-%';
  if c is null then raise exception 'Nincs ilyen feladat: %', p_job; end if;
  execute c;
  update public.admin_cron_calls set via = 'admin' where at = now() and via = 'cron';
end $$;

ALTER FUNCTION "public"."admin_cron_run"("p_job" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_toggle"("p_job" "text", "p_on" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare jid bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jobid into jid from cron.job where jobname = p_job and jobname like 'admin-%';
  if jid is null then raise exception 'Nincs ilyen feladat: %', p_job; end if;
  perform cron.alter_job(jid, active := p_on);
end $$;

ALTER FUNCTION "public"."admin_cron_toggle"("p_job" "text", "p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_token_rotate"() RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_secrets set v = encode(extensions.gen_random_bytes(32), 'hex'), created_at = now() where k = 'cron';
  perform public.admin_audit_add('biztonsag.cron_token_csere', null, '{}');
  return now();
end $$;

ALTER FUNCTION "public"."admin_cron_token_rotate"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cron_token_rotate_job"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.admin_secrets set v = encode(extensions.gen_random_bytes(32), 'hex'), created_at = now() where k = 'cron';
end $$;

ALTER FUNCTION "public"."admin_cron_token_rotate_job"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cse_ranks"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.day) from (select * from public.cse_ranks where day > public.admin_today() - 90) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_cse_ranks"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_cwv_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'latest', coalesce((select jsonb_agg(x order by x.url, x.form) from (select distinct on (url, form) * from public.admin_cwv
      where day >= (select max(day) from public.admin_cwv) - 3 order by url, form, day desc) x), '[]'),
    'trend', coalesce((select jsonb_agg(x order by x.day) from (select day, url, form, perf, lcp, fcp, ttfb, cls, inp from public.admin_cwv where day >= public.admin_today() - 60) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_cwv_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_dashboard"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  tz constant text := 'Europe/Budapest';
  d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  b timestamptz := now();
  a timestamptz := now() - make_interval(days => d);
  pa timestamptz := now() - make_interval(days => 2 * d);
  first_ev timestamptz := public.admin_first(p_ch, p_lang);
  bucket text := case when d <= 2 then 'hour' else 'day' end;
  res jsonb;
  pay jsonb := jsonb_build_object('table', false);
  live boolean := false;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_days, 0) = 0 then
    a := coalesce(least(first_ev, (select min(created_at) from public.admin_real_users)), now() - interval '1 day');
    d := greatest(1, ceil(extract(epoch from b - a) / 86400)::int);
    pa := a - make_interval(days => d);
    bucket := case when d <= 2 then 'hour' else 'day' end;
  end if;
  if p_from is not null then
    a := p_from; b := least(coalesce(p_to, now()), now());
    d := greatest(1, ceil(extract(epoch from b - a) / 86400)::int);
    pa := a - (b - a);
    bucket := case when d <= 2 then 'hour' else 'day' end;
  end if;

  if to_regclass('public.purchases') is not null then
    execute $q$
      select jsonb_build_object('table', true,
        'count', (select count(*) from public.purchases where created_at >= $1),
        'count_prev', (select count(*) from public.purchases where created_at >= $2 and created_at < $1),
        'count_all', (select count(*) from public.purchases),
        'buyers_all', (select count(distinct user_id) from public.purchases),
        'revenue', coalesce((select jsonb_agg(x order by x.amount desc) from (select upper(coalesce(currency,'?')) currency, sum(amount) amount, count(*) n from public.purchases where created_at >= $1 group by 1) x), '[]'),
        'revenue_prev', coalesce((select jsonb_agg(x) from (select upper(coalesce(currency,'?')) currency, sum(amount) amount from public.purchases where created_at >= $2 and created_at < $1 group by 1) x), '[]'),
        'revenue_all', coalesce((select jsonb_agg(x) from (select upper(coalesce(currency,'?')) currency, sum(amount) amount, count(*) n from public.purchases group by 1) x), '[]'),
        'by_plan', coalesce((select jsonb_agg(x order by x.n desc) from (select plan k, count(*) n, sum(amount) amount from public.purchases where created_at >= $1 group by 1) x), '[]'),
        'by_store', coalesce((select jsonb_agg(x order by x.n desc) from (select store k, count(*) n, sum(amount) amount from public.purchases where created_at >= $1 group by 1) x), '[]'),
        'daily', coalesce((select jsonb_agg(x order by x.t) from (select date_trunc('day', created_at at time zone 'Europe/Budapest') t, count(*) n, sum(amount) amount from public.purchases where created_at >= $1 group by 1) x), '[]'),
        'recent', coalesce((select jsonb_agg(x) from (select p.created_at, p.plan, p.store, p.amount, upper(p.currency) currency, u.email from public.purchases p left join auth.users u on u.id = p.user_id order by p.created_at desc limit 25) x), '[]'))
    $q$ into pay using a, pa;
  end if;
  if to_regclass('public.settings') is not null then
    execute $q$ select coalesce((select (value)::text::boolean from public.settings where key = 'payments_live'), false) $q$ into live;
  end if;

  with ev as (select * from public.admin_events(p_ch, p_lang) where created_at >= a and created_at < b),
  s as (
    select session, min(created_at) t0, max(created_at) t1, count(*) n,
      (array_agg(props->'src' order by created_at) filter (where props ? 'src'))[1] src,
      (array_agg(lang order by created_at desc) filter (where lang is not null))[1] lang,
      (array_agg(props->>'pf' order by created_at) filter (where props ? 'pf'))[1] pf,
      (array_agg(props->>'dev' order by created_at) filter (where props ? 'dev'))[1] dev,
      (array_agg(props->>'ia' order by created_at) filter (where props ? 'ia'))[1] ia,
      bool_or(name = 'landing_view') land, bool_or(name = 'cta_click') cta, bool_or(name = 'app_open') app,
      bool_or(name = 'quiz_answer' and props->>'step' = 'name') named,
      bool_or(name = 'signature_captured' or (name = 'quiz_answer' and props->>'step' = 'sign' and coalesce(props->>'value', '') <> 'skipped')) captured,
      bool_or(name = 'capture_skipped' or (name = 'quiz_answer' and props->>'step' = 'sign' and props->>'value' = 'skipped')) skipped,
      bool_or(name = 'flow_step' and props->>'step' = 'score') scored,
      bool_or(name = 'quiz_start' and (props ? 'gift' or coalesce(path, '') like '/app%')) quiz, bool_or(name = 'reveal_shown') revealed,
      bool_or(name = 'detail_open') detail, bool_or(name = 'paywall_shown') paywall,
      bool_or(name = 'purchase') bought, bool_or(name = 'celebrate') celebrated,
      bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared
    from ev where session is not null group by session
  ),
  ss as (
    select s.*, public.admin_channel(src, ia) channel from s
  ),
  ps as (
    select session, min(created_at) t0, bool_or(name = 'app_open') app,
      bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'reveal_shown') revealed,
      bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared, bool_or(name = 'purchase') bought
    from public.admin_events(p_ch, p_lang) where created_at >= pa and created_at < a and session is not null group by session
  ),
  bk2 as (
    select g t from generate_series(date_trunc(bucket, pa at time zone tz), date_trunc(bucket, a at time zone tz), ('1 ' || bucket)::interval) g
  ),
  bk as (
    select g t from generate_series(date_trunc(bucket, a at time zone tz), date_trunc(bucket, b at time zone tz), ('1 ' || bucket)::interval) g
  )
  select jsonb_build_object(
    'generated_at', now(), 'days', d, 'from', a, 'to', b, 'filter', jsonb_build_object('ch', p_ch, 'lang', p_lang, 'from', p_from, 'to', p_to), 'bucket', bucket, 'first_event', first_ev, 'payments_live', live,
    'payments_migration', to_regclass('public.purchases') is not null,
    'prev_partial', first_ev is null or first_ev > pa,
    'now', public.admin_period(a, b, p_ch, p_lang), 'prev', public.admin_period(pa, a, p_ch, p_lang),
    'today', public.admin_period(date_trunc('day', now() at time zone tz) at time zone tz, now(), p_ch, p_lang),
    'all', jsonb_build_object(
      'users', (select count(*) from public.admin_real_users),
      'confirmed', (select count(*) from public.admin_real_users where email_confirmed_at is not null or raw_app_meta_data->>'provider' <> 'email'),
      'events', public.admin_total('events', p_ch, p_lang),
      'sessions', public.admin_total('sessions', p_ch, p_lang),
      'scored', public.admin_total('scored', p_ch, p_lang),
      'revealed', public.admin_total('revealed', p_ch, p_lang),
      'shared', public.admin_total('shared', p_ch, p_lang),
      'unlocks', (select count(*) from public.admin_real_unlocks),
      'unlocks_pro', (select count(*) from public.admin_real_unlocks where calligrapher),
      'users_with_unlock', (select count(distinct user_id) from public.admin_real_unlocks),
      'credits_open', (select coalesce(sum(credits), 0) from public.admin_real_profiles),
      'gift_claimed', (select count(*) from public.admin_real_profiles where gift_claimed),
      'admins', (select count(*) from public.admins)
    ),
    'trend', (select coalesce(jsonb_agg(x order by x.t), '[]') from (
      select bk.t, coalesce(v.sessions, 0) sessions, coalesce(v.app, 0) app, coalesce(v.scored, 0) scored, coalesce(v.revealed, 0) revealed,
        coalesce(v.shared, 0) shared, coalesce(v.bought, 0) bought, coalesce(su.n, 0) signups, coalesce(er.n, 0) errors, (bk.t < (a at time zone tz) or bk.t + ('1 ' || bucket)::interval > (b at time zone tz)) partial
      from bk
      left join (select date_trunc(bucket, t0 at time zone tz) t, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored,
        count(*) filter (where revealed) revealed, count(*) filter (where shared) shared, count(*) filter (where bought) bought from ss group by 1) v on v.t = bk.t
      left join (select date_trunc(bucket, created_at at time zone tz) t, count(*) n from public.admin_real_users u where u.created_at >= a and u.created_at < b and p_ch is null and p_lang is null group by 1) su on su.t = bk.t
      left join (select date_trunc(bucket, created_at at time zone tz) t, count(*) n from ev where name in ('client_error','storage_full','signin_failed','auth_error') group by 1) er on er.t = bk.t) x),
    'prev_trend', (select coalesce(jsonb_agg(x order by x.t), '[]') from (
      select bk2.t, coalesce(v.sessions, 0) sessions, coalesce(v.app, 0) app, coalesce(v.scored, 0) scored, coalesce(v.revealed, 0) revealed,
        coalesce(v.shared, 0) shared, coalesce(v.bought, 0) bought, coalesce(su.n, 0) signups
      from bk2
      left join (select date_trunc(bucket, t0 at time zone tz) t, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored,
        count(*) filter (where revealed) revealed, count(*) filter (where shared) shared, count(*) filter (where bought) bought from ps group by 1) v on v.t = bk2.t
      left join (select date_trunc(bucket, created_at at time zone tz) t, count(*) n from public.admin_real_users u where u.created_at >= pa and u.created_at < a and p_ch is null and p_lang is null group by 1) su on su.t = bk2.t) x),
    'hours', (select coalesce(jsonb_agg(x order by x.h), '[]') from (
      select extract(hour from t0 at time zone tz)::int h, count(*) n from ss group by 1) x),
    'weekdays', (select coalesce(jsonb_agg(x order by x.w), '[]') from (
      select extract(isodow from t0 at time zone tz)::int w, count(*) n from ss group by 1) x),
    'funnel', jsonb_build_array(
      jsonb_build_object('k','sessions','n',(select count(*) from ss)),
      jsonb_build_object('k','land','n',(select count(*) from ss where land)),
      jsonb_build_object('k','cta','n',(select count(*) from ss where land and cta)),
      jsonb_build_object('k','app','n',(select count(*) from ss where app)),
      jsonb_build_object('k','named','n',(select count(*) from ss where app and named)),
      jsonb_build_object('k','captured','n',(select count(*) from ss where app and named and captured)),
      jsonb_build_object('k','scored','n',(select count(*) from ss where app and named and captured and scored)),
      jsonb_build_object('k','quiz','n',(select count(*) from ss where app and named and captured and scored and quiz)),
      jsonb_build_object('k','revealed','n',(select count(*) from ss where app and named and captured and scored and quiz and revealed)),
      jsonb_build_object('k','detail','n',(select count(*) from ss where app and named and captured and scored and quiz and revealed and detail)),
      jsonb_build_object('k','paywall','n',(select count(*) from ss where paywall)),
      jsonb_build_object('k','bought','n',(select count(*) from ss where bought)),
      jsonb_build_object('k','shared','n',(select count(*) from ss where app and named and captured and scored and quiz and revealed and shared)),
      jsonb_build_object('k','skipped','n',(select count(*) from ss where app and named and skipped and not captured))),
    'funnel_any', jsonb_build_object('captured', (select count(*) from ss where captured), 'scored', (select count(*) from ss where scored), 'quiz', (select count(*) from ss where quiz),
      'revealed', (select count(*) from ss where revealed), 'detail', (select count(*) from ss where detail), 'shared', (select count(*) from ss where shared),
      'skipped', (select count(*) from ss where skipped and not captured)),
    'steps', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select props->>'step' k, count(distinct session) n from ev where name = 'flow_step' group by 1) x),
    'channels', (select coalesce(jsonb_agg(x order by x.sessions desc), '[]') from (
      select channel k, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored,
        count(*) filter (where revealed) revealed, count(*) filter (where shared) shared, count(*) filter (where bought) bought
      from ss group by 1) x),
    /* the period before, per channel (the weekly review's "fewer visitors from …") */
    'channels_prev', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(sa.ch, 'közvetlen') k, count(*) n from ps left join public.admin_sess_attr sa on sa.session = ps.session group by 1) x),
    'campaigns', (select coalesce(jsonb_agg(x order by x.sessions desc), '[]') from (
      select coalesce(nullif(src->>'us',''),'–') source, coalesce(nullif(src->>'um',''),'–') medium, coalesce(nullif(src->>'uc',''),'–') campaign, coalesce(nullif(src->>'ux',''),'–') content,
        count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where revealed) revealed, count(*) filter (where shared) shared, count(*) filter (where bought) bought
      from ss where src ? 'us' or src ? 'uc' or src ? 'ux' group by 1,2,3,4 order by 5 desc limit 40) x),
    'referrers', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select src->>'from' k, count(*) n, count(*) filter (where scored) scored from ss where src ? 'from' group by 1 order by 2 desc limit 25) x),
    'refs', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select src->>'ref' k, count(*) n, count(*) filter (where scored) scored from ss where src ? 'ref' group by 1 order by 2 desc limit 25) x),
    'landings', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(src->>'land', '?') k, count(*) n, count(*) filter (where app) app, count(*) filter (where scored) scored from ss group by 1 order by 2 desc limit 25) x),
    'pages', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'page', path) k, count(*) n, count(distinct session) sessions from ev where name = 'landing_view' group by 1 order by 2 desc limit 40) x),
    'ctas', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select props->>'cta' k, count(*) n from ev where name = 'cta_click' group by 1) x),
    'langs', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(lang, '?') k, count(*) n, count(*) filter (where scored) scored, count(*) filter (where bought) bought from ss group by 1) x),
    'platforms', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select public.admin_pf_guess(src, coalesce(pf, case when ia = 'androidapp' then 'android' end)) k, count(*) n from ss group by 1) x),
    'devices', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(dev, '?') k, count(*) n, count(*) filter (where scored) scored from ss group by 1) x),
    'inapp', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(ia, 'normál böngésző') k, count(*) n, count(*) filter (where scored) scored from ss where (pf is null or pf = 'web') and coalesce(ia, '') <> 'androidapp' group by 1) x),
    'session_len', (select jsonb_build_object(
      'median_sec', percentile_cont(.5) within group (order by extract(epoch from t1 - t0)),
      'p75_sec', percentile_cont(.75) within group (order by extract(epoch from t1 - t0)),
      'median_events', percentile_cont(.5) within group (order by n)) from ss where n > 1),
    'time_to_score', (select jsonb_build_object('median_sec', percentile_cont(.5) within group (order by sec), 'n', count(*)) from (
      select extract(epoch from min(created_at) filter (where name = 'flow_step' and props->>'step' = 'score') - min(created_at) filter (where name = 'app_open')) sec
      from ev group by session) x where sec > 0 and sec < 3600),
    'time_to_reveal', (select jsonb_build_object('median_sec', percentile_cont(.5) within group (order by sec), 'n', count(*)) from (
      select extract(epoch from min(created_at) filter (where name = 'reveal_shown') - min(created_at) filter (where name = 'app_open')) sec
      from ev group by session) x where sec > 0 and sec < 3600)
  ) || jsonb_build_object(
    'heat', (select coalesce(jsonb_agg(x), '[]') from (
      select extract(isodow from t0 at time zone tz)::int w, extract(hour from t0 at time zone tz)::int h, count(*) n from ss group by 1, 2) x),
    'channel_trend', (select coalesce(jsonb_agg(x order by x.t), '[]') from (
      select date_trunc(bucket, t0 at time zone tz) t, channel k, count(*) n, count(*) filter (where scored) scored from ss group by 1, 2) x),
    'signin_fail', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'provider', '?') provider, left(coalesce(props->>'why', props->>'code', ''), 140) why, count(*) n, count(distinct session) sessions, max(created_at) last
      from ev where name in ('signin_failed','auth_error') group by 1, 2 order by 3 desc limit 10) x),
    'scores', (select coalesce(jsonb_agg(x order by x.k), '[]') from (
      select (props->>'band')::int k, count(*) n from ev where name = 'score_shown' and props->>'band' ~ '^\d+$' group by 1) x),
    'capture', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'value', '?') k, count(*) n from ev where name = 'quiz_answer' and props->>'step' = 'sign' group by 1) x),
    'quiz', (select coalesce(jsonb_agg(x order by x.step, x.n desc), '[]') from (
      select props->>'step' step, coalesce(props->>'value', '') v, count(*) n from ev where name = 'quiz_answer' group by 1,2) x),
    'backs', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'step', '?') k, count(*) n from ev where name = 'step_back' group by 1) x),
    'counts', (select coalesce(jsonb_object_agg(name, n), '{}') from (select name, count(*) n from ev group by 1) x),
    'counts_prev', (select coalesce(jsonb_object_agg(name, n), '{}') from (select name, count(*) n from public.admin_events(p_ch, p_lang) where created_at >= pa and created_at < a group by 1) x),
    'shares', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select name ev, coalesce(props->>'kind', '') kind, coalesce(props->>'fmt', '') fmt, count(*) n from ev where name in ('share_open','share_save','share_video','reveal_share') group by 1,2,3) x),
    'plans', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select name ev, coalesce(props->>'plan', '?') plan, coalesce(props->>'via', props->>'tier', '') via, count(*) n from ev where name in ('plan_pick','purchase') group by 1,2,3) x),
    'pro_files', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'k', '?') k, count(*) n from ev where name = 'pro_file' group by 1) x),
    'reminders', (select coalesce(jsonb_agg(x), '[]') from (
      select coalesce(props->>'on', '?') k, count(*) n from ev where name = 'reminder' group by 1) x),
    'legibility', (select coalesce(jsonb_agg(x order by x.k), '[]') from (
      select coalesce(props->>'to', '?') k, count(*) n from ev where name = 'legibility_change' group by 1) x),
    'more_rounds', (select coalesce(jsonb_agg(x order by x.k), '[]') from (
      select coalesce(props->>'round', '?') k, count(*) n from ev where name = 'more_designs' group by 1) x),
    'ai_reports', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(props->>'lang', '?') k, count(*) n from ev where name = 'ai_note_report' group by 1) x),
    'errors', (select coalesce(jsonb_agg(x), '[]') from (
      select created_at, name, coalesce(props->>'where', props->>'provider') "where", coalesce(props->>'msg', props->>'why') msg, path, lang, props->>'pf' pf, props->>'ia' ia
      from ev where name in ('client_error','storage_full','signin_failed','auth_error') order by created_at desc limit 50) x),
    'error_groups', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select name, coalesce(props->>'where', props->>'provider', '') "where", coalesce(left(coalesce(props->>'msg', props->>'why'), 80), '') msg, count(*) n, max(created_at) last
      from ev where name in ('client_error','storage_full','signin_failed','auth_error') group by 1,2,3 order by 4 desc limit 20) x),
    'live', (select coalesce(jsonb_agg(x), '[]') from (
      select created_at, name, props - 'src' props, props->'src' src, path, lang, right(session, 6) s
      from public.admin_events(p_ch, p_lang) order by created_at desc limit 80) x),
    'live_now', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '5 minutes'),
    'live_hour', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '1 hour'),
    'users', jsonb_build_object(
      'providers', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select coalesce(raw_app_meta_data->>'provider', '?') k, count(*) n, count(*) filter (where created_at >= a and created_at < b) n_period from public.admin_real_users group by 1) x),
      'langs', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select coalesce(raw_user_meta_data->>'lang', '?') k, count(*) n from public.admin_real_users group by 1) x),
      'sources', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select coalesce(raw_user_meta_data->'src'->>'us', raw_user_meta_data->'src'->>'from', '?') k, count(*) n from public.admin_real_users where created_at >= a and created_at < b group by 1) x),
      'unconfirmed', (select count(*) from public.admin_real_users where email_confirmed_at is null and raw_app_meta_data->>'provider' = 'email'),
      'confirm_median_min', (select percentile_cont(.5) within group (order by extract(epoch from email_confirmed_at - created_at) / 60) from public.admin_real_users where email_confirmed_at is not null and raw_app_meta_data->>'provider' = 'email'),
      'welcome_sent', (select count(*) from public.admin_real_users where raw_user_meta_data ? 'welcome_sent_at'),
      'active_1', (select count(*) from public.admin_real_users where last_sign_in_at >= date_trunc('day', now() at time zone tz) at time zone tz),
      'active_7', (select count(*) from public.admin_real_users where last_sign_in_at >= now() - interval '7 days'),
      'active_30', (select count(*) from public.admin_real_users where last_sign_in_at >= now() - interval '30 days'),
      'returned_1d', (select count(*) from public.admin_real_users where last_sign_in_at >= created_at + interval '1 day'),
      'returned_7d', (select count(*) from public.admin_real_users where last_sign_in_at >= created_at + interval '7 days'),
      'returned_30d', (select count(*) from public.admin_real_users where last_sign_in_at >= created_at + interval '30 days'),
      'eligible_1d', (select count(*) from public.admin_real_users where created_at <= now() - interval '1 day'),
      'eligible_7d', (select count(*) from public.admin_real_users where created_at <= now() - interval '7 days'),
      'eligible_30d', (select count(*) from public.admin_real_users where created_at <= now() - interval '30 days'),
      'cohorts', (select coalesce(jsonb_agg(x order by x.w desc), '[]') from (
        select date_trunc('week', ru.created_at at time zone tz) w, count(*) n,
          count(*) filter (where ru.last_sign_in_at >= ru.created_at + interval '1 day') r1,
          count(*) filter (where ru.last_sign_in_at >= ru.created_at + interval '7 days') r7,
          count(*) filter (where ru.last_sign_in_at >= ru.created_at + interval '30 days') r30,
          count(*) filter (where exists (select 1 from public.admin_real_unlocks un where un.user_id = ru.id)) unlocked
        from public.admin_real_users ru group by 1 order by 1 desc limit 12) x),
      'recent', (select coalesce(jsonb_agg(x), '[]') from (
        select u.created_at, u.email, nullif(u.raw_user_meta_data->>'display_name', '') name, u.raw_app_meta_data->>'provider' provider,
          u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider' <> 'email' confirmed, u.raw_user_meta_data->>'lang' lang, u.last_sign_in_at
        from public.admin_real_users u order by u.created_at desc limit 12) x)
    ),
    'unlocks', jsonb_build_object(
      'daily', (select coalesce(jsonb_agg(x order by x.t), '[]') from (
        select date_trunc('day', created_at at time zone tz) t, count(*) n, count(*) filter (where calligrapher) pro from public.admin_real_unlocks where created_at >= a and created_at < b group by 1) x),
      'per_user', (select coalesce(jsonb_agg(x order by x.k), '[]') from (
        select least(c, 5) k, count(*) n from (select user_id, count(*) c from public.admin_real_unlocks group by 1) z group by 1) x),
      'with_design', (select count(*) from public.admin_real_unlocks where design is not null)
    ),
    'payments', pay
  ) into res;
  return res;
end $_$;

ALTER FUNCTION "public"."admin_dashboard"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_data_quality"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare t date := public.admin_today(); d integer := greatest(7, least(coalesce(p_days, 30), 90)); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with days as (select generate_series(t - (d - 1), t, interval '1 day')::date as day),
  src as (select distinct source from public.sync_log where at >= now() - make_interval(days => d)),
  ok as (select source, (at at time zone 'Europe/Budapest')::date as day from public.sync_log where ok and at >= now() - make_interval(days => d) group by 1, 2),
  per as (
    select s.source,
      (select count(*) from ok where ok.source = s.source) ok_days,
      (select coalesce(jsonb_agg(x.day order by x.day), '[]') from days x where not exists (select 1 from ok where ok.source = s.source and ok.day = x.day)
         and x.day >= (select min((l.at at time zone 'Europe/Budapest')::date) from public.sync_log l where l.source = s.source)) gaps,
      (select max(at) from public.sync_log l where l.source = s.source and l.ok) last_ok,
      (select max(at) from public.sync_log l where l.source = s.source and not l.ok) last_fail,
      (select count(*) from public.sync_log l where l.source = s.source and not l.ok and l.at >= now() - make_interval(days => d)) fails
    from src s
  ), ev as (select session, min(created_at) t0 from public.events where created_at >= now() - make_interval(days => d) and session is not null group by 1)
  select jsonb_build_object(
    'days', d,
    'sources', coalesce((select jsonb_agg(to_jsonb(p) order by p.source) from per p), '[]'),
    'sessions_all', (select count(*) from ev),
    'sessions_real', (select count(distinct session) from public.events_real where created_at >= now() - make_interval(days => d) and session is not null),
    'bots', (select count(*) from ev join public.admin_bot_sessions b on b.session = ev.session),
    'bot_reasons', coalesce((select jsonb_object_agg(reason, n) from (select b.reason, count(*) n from ev join public.admin_bot_sessions b on b.session = ev.session group by 1) x), '{}'),
    'own', (select count(*) from ev join public.admin_own_sessions o on o.session = ev.session)
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_data_quality"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_day_replay"("p_day" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare a timestamptz := (p_day::timestamp at time zone 'Europe/Budapest'); b timestamptz := ((p_day + 1)::timestamp at time zone 'Europe/Budapest'); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with s as (
    select session, min(created_at) t0, public.admin_channel(props->'src', props->>'ia') ch,
      bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'signup') signed, bool_or(name in ('share_open', 'share_save', 'share_video', 'reveal_share')) shared
    from public.events_real where created_at >= a and created_at < b and session is not null group by session, 3
  )
  select jsonb_build_object(
    'day', p_day,
    'steps', coalesce((select jsonb_agg(x order by x.m) from (
        select floor(extract(epoch from (t0 - a)) / 600)::int * 10 m, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where signed) signups, count(*) filter (where shared) shared
        from s group by 1) x), '[]'),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('k', ch, 'm', floor(extract(epoch from (t0 - a)) / 60)::int)) from s), '[]'),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('platform', p.platform, 'title', left(p.title, 80), 'm', floor(extract(epoch from (p.created_at - a)) / 60)::int, 'views', p.views)) from public.social_posts p where p.created_at >= a and p.created_at < b), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_day_replay"("p_day" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_digest"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_digest_data();
end $$;

ALTER FUNCTION "public"."admin_digest"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_digest_data"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest';
  t1 timestamptz := now();
  t0 timestamptz := t1 - interval '24 hours';
  tp timestamptz := t0 - interval '24 hours';
  d1 date := (t1 at time zone tz)::date;
  gl date := least(public.admin_gsc_last(), public.admin_today() - 1);
begin
  return jsonb_build_object(
    'day', ((t1 - interval '1 day') at time zone tz)::date, 'win_from', t0, 'win_to', t1,
    'y', public.admin_period(t0, t1), 'p', public.admin_period(tp, t0),
    'w', public.admin_period(t1 - interval '7 days', t1), 'pw', public.admin_period(t1 - interval '14 days', t1 - interval '7 days'),
    'all_scored', (select count(distinct session) from public.events_real where name = 'flow_step' and props->>'step' = 'score'),
    'users', (select count(*) from public.admin_real_users),
    'channels', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(a.ch, 'közvetlen') k, count(*) n from (select distinct session
        from public.events_real where created_at >= t0 and created_at < t1 and session is not null) s left join public.admin_sess_attr a on a.session = s.session group by 1 order by 2 desc limit 5) x), '[]'),
    'signin_fail', (select count(*) from public.events_real where name in ('signin_failed', 'auth_error') and created_at >= t0 and created_at < t1),
    'best_post', (select to_jsonb(x) from (select p.platform, p.title, p.url, p.views, d.views - coalesce(d0.views, 0) gained
      from public.social_posts p join public.social_post_daily d on d.platform = p.platform and d.post_id = p.post_id and d.day = d1
      left join public.social_post_daily d0 on d0.platform = p.platform and d0.post_id = p.post_id and d0.day = d1 - 1
      order by gained desc nulls last limit 1) x),
    'gsc', (select jsonb_build_object('clicks', coalesce(sum(g.clicks), 0), 'impressions', coalesce(sum(g.impressions), 0), 'day', gl, 'exact', bool_and(g.exact)) from public.admin_gsc_days(gl, gl) g),
    'goals', public.admin_goals_list_internal(),
    'to', coalesce((select jsonb_agg(email) from public.admin_emails), '[]'));
end $$;

ALTER FUNCTION "public"."admin_digest_data"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_digest_errors"("a" timestamp with time zone, "b" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
    select name, props->>'provider' provider, left(coalesce(props->>'why', props->>'message', ''), 160) why, count(*) n, max(created_at) last
    from public.admin_events(null, null) where created_at >= a and created_at < b and name in ('client_error', 'storage_full', 'signin_failed', 'auth_error')
    group by 1, 2, 3 order by 4 desc limit 6) x
$$;

ALTER FUNCTION "public"."admin_digest_errors"("a" timestamp with time zone, "b" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_digest_t"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_digest_data();
end $$;

ALTER FUNCTION "public"."admin_digest_t"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_disconnect"("p_platform" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.social_accounts where platform = p_platform;
  perform public.admin_audit_add('kapcsolat.lecsatlakozas', p_platform, '{}');
end $$;

ALTER FUNCTION "public"."admin_disconnect"("p_platform" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_dropout_sessions"("p_days" integer, "p_at" "text", "p_last" "text" DEFAULT NULL::"text", "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text", "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer := greatest(1, least(coalesce(nullif(p_days, 0), 365), 365)); r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(k, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.t0 desc) from (
    with st as (select session, t0, t1, channel, lang, pf, last_ev, case
        when land and not app then 'web'
        when app and not named then 'app'
        when app and named and skipped and not revealed then 'skipped'
        when app and named and not captured and not skipped then 'named'
        when app and named and captured and not scored then 'captured'
        when app and named and captured and scored and not revealed then 'scored'
        when revealed and not detail then 'revealed' end at_step
      from public.admin_sess(r.a, r.b, p_ch, p_lang))
    select right(st.session, 6) s, st.t0, round(extract(epoch from st.t1 - st.t0)) secs, st.channel ch, st.lang, st.pf,
      (select jsonb_agg(e.name || coalesce(':' || coalesce(e.props->>'step', e.props->>'k', e.props->>'cta'), '') order by e.created_at)
       from (select * from public.events_real e2 where e2.session = st.session order by e2.created_at limit 40) e) trail
    from st where st.at_step = p_at and (p_last is null or st.last_ev = p_last) order by st.t0 desc limit 25) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_dropout_sessions"("p_days" integer, "p_at" "text", "p_last" "text", "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_dropouts"("p_days" integer DEFAULT 30, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text", "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer := greatest(1, least(coalesce(nullif(p_days, 0), 365), 365)); r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(k, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.at_step, x.n desc) from (
    with st as (select last_ev, extract(epoch from t1 - t0) secs, case
        when land and not app then 'web'
        when app and not named then 'app'
        when app and named and skipped and not revealed then 'skipped'
        when app and named and not captured and not skipped then 'named'
        when app and named and captured and not scored then 'captured'
        when app and named and captured and scored and not revealed then 'scored'
        when revealed and not detail then 'revealed' end at_step
      from public.admin_sess(r.a, r.b, p_ch, p_lang))
    select at_step, last_ev, count(*) n, round(avg(secs)) secs from st where at_step is not null group by 1, 2) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_dropouts"("p_days" integer, "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_email_hook"("p_id" "text", "p_ts" "text", "p_sig" "text", "p_body" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare sec text; want text; j jsonb; ok boolean := false; s text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'inkage_admin.RESEND_WEBHOOK_SECRET';
  if sec is null or p_id is null or p_ts is null or p_sig is null then return false; end if;
  if abs(extract(epoch from now()) - p_ts::bigint) > 600 then return false; end if;
  want := encode(extensions.hmac(convert_to(p_id || '.' || p_ts || '.' || p_body, 'UTF8'), decode(regexp_replace(sec, '^whsec_', ''), 'base64'), 'sha256'), 'base64');
  foreach s in array string_to_array(p_sig, ' ') loop
    if split_part(s, ',', 2) = want then ok := true; end if;
  end loop;
  if not ok then return false; end if;
  j := p_body::jsonb;
  /* the Resend account also sends Calligra's, Mirrify's and BOLTOM's mail: only InkAge's (sent from @inkage.app) is kept */
  if coalesce(j->'data'->>'from', '') !~* '@inkage\.app>?\s*$' then return true; end if;
  insert into public.email_events (id, type, at, subject, domain)
  values (coalesce(j->'data'->>'email_id', p_id) || ':' || (j->>'type'), j->>'type', coalesce((j->>'created_at')::timestamptz, now()), left(j->'data'->>'subject', 200),
    split_part(coalesce(j->'data'->'to'->>0, ''), '@', 2))
  on conflict (id) do nothing;
  return true;
end $_$;

ALTER FUNCTION "public"."admin_email_hook"("p_id" "text", "p_ts" "text", "p_sig" "text", "p_body" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_email_ok"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.admin_emails where email = lower(trim(coalesce(p_email, ''))))
$$;

ALTER FUNCTION "public"."admin_email_ok"("p_email" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_error_ai"("p_fp" "text", "p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.error_groups (fp, ai, ai_at) values (p_fp, left(p_text, 4000), now())
  on conflict (fp) do update set ai = excluded.ai, ai_at = now(), updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_error_ai"("p_fp" "text", "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_error_state"("p_fp" "text", "p_state" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_state not in ('open', 'resolved', 'ignored') then raise exception 'bad state'; end if;
  insert into public.error_groups (fp, state, resolved_at, note) values (p_fp, p_state, case when p_state = 'resolved' then now() end, left(p_note, 1000))
  on conflict (fp) do update set state = excluded.state, resolved_at = case when excluded.state = 'resolved' then now() else public.error_groups.resolved_at end,
    note = coalesce(left(p_note, 1000), public.error_groups.note), updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_error_state"("p_fp" "text", "p_state" "text", "p_note" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_bot_sessions" (
    "session" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "marked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_bot_sessions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_own_sessions" (
    "session" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_own_sessions" OWNER TO "postgres";

-- InkAge: the events the dashboard counts, in the steps the dashboard knows (the same names as Calligra's), so every
-- page reads InkAge's journey: photo → design → preview → 50 years → saved → shared. The InkAge name stays in props.ev.
--   photo_pick_open  → flow_step 'name'      (started: opened the photo step)
--   photo_added      → signature_captured    (a photo of the skin is in)
--   design_pick_open → flow_step 'sign'      (opened the design step)
--   design_added     → flow_step 'style'     (a design is chosen; value = where it came from)
--   generate_start   → analysis_start        (the preview is being made)
--   generate_done    → flow_step 'score'     (the preview is ready: "scored")
--   onboarding_start → quiz_start, onboarding_done → quiz_answer × goal / style / placement
--   stage_y50        → reveal_shown          (looked at the tattoo at 50 years: "revealed")
--   preview_saved    → detail_open           (saved the preview)
--   share_link / video_made / artist_pdf / invite_share → reveal_share / share_video / share_save / share_open
--   auth_signup → signup, the sign-in / start buttons → cta_click, paywall → paywall_shown (hidden: the app is free)
-- Tests (utm with "test"), the owner's own visits and robots are left out, as on Calligra's dashboard.
CREATE OR REPLACE VIEW "public"."events_real" AS
 with e as (
  select e.* from public.events e
  where not (coalesce(e.props->'src'->>'us', '') ilike '%test%' or coalesce(e.props->'src'->>'uc', '') = any (array['qa', 'qa2', 'scoretest', 'rec', 'test']))
    and not exists (select 1 from public.admin_own_sessions o where o.session = e.session)
    and not exists (select 1 from public.admin_bot_sessions b where b.session = e.session)
    and (e.user_id is null or not exists (select 1 from public.profiles p where p.id = e.user_id and coalesce(p.reviewer, false)))
 )
 select e.id, e.created_at,
   case e.name
     when 'photo_pick_open' then 'flow_step' when 'design_pick_open' then 'flow_step' when 'design_added' then 'flow_step' when 'generate_done' then 'flow_step'
     when 'photo_added' then 'signature_captured' when 'generate_start' then 'analysis_start' when 'onboarding_start' then 'quiz_start'
     when 'stage_y50' then 'reveal_shown' when 'preview_saved' then 'detail_open'
     when 'share_link' then 'reveal_share' when 'video_made' then 'share_video' when 'artist_pdf' then 'share_save' when 'invite_share' then 'share_open'
     when 'auth_signup' then 'signup' when 'paywall' then 'paywall_shown'
     when 'nav_cta' then 'cta_click' when 'landing_cta_app' then 'cta_click' when 'tab_cta' then 'cta_click' when 'nav_signup' then 'cta_click'
     when 'nav_signin' then 'cta_click' when 'drawer_signin' then 'cta_click' when 'cta_signin' then 'cta_click' when 'landing_usecase_cta' then 'cta_click'
     else e.name end as name,
   coalesce(e.props, '{}'::jsonb) || jsonb_build_object('ev', e.name) || case e.name
     when 'photo_pick_open' then jsonb_build_object('step', 'name')
     when 'design_pick_open' then jsonb_build_object('step', 'sign')
     when 'design_added' then jsonb_build_object('step', 'style', 'value', coalesce(e.props->>'dsrc', case when jsonb_typeof(e.props->'src') = 'string' then e.props->>'src' end, 'upload'))
     when 'generate_done' then jsonb_build_object('step', 'score')
     when 'nav_cta' then jsonb_build_object('cta', e.name) when 'landing_cta_app' then jsonb_build_object('cta', e.name) when 'tab_cta' then jsonb_build_object('cta', e.name)
     when 'nav_signup' then jsonb_build_object('cta', e.name) when 'nav_signin' then jsonb_build_object('cta', e.name) when 'drawer_signin' then jsonb_build_object('cta', e.name)
     when 'cta_signin' then jsonb_build_object('cta', e.name) when 'landing_usecase_cta' then jsonb_build_object('cta', e.name)
     else '{}'::jsonb end as props,
   e.session, e.path, e.lang, e.user_id
 from e where e.name <> 'onboarding_done'
 union all
 select e.id, e.created_at, 'quiz_answer', jsonb_build_object('ev', e.name, 'step', a.key, 'value', a.value), e.session, e.path, e.lang, e.user_id
 from e cross join lateral jsonb_each_text(coalesce(e.props, '{}'::jsonb)) a
 where e.name = 'onboarding_done' and a.key in ('goal', 'style', 'placement');
ALTER VIEW "public"."events_real" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_events"("p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."events_real"
    LANGUAGE "sql" STABLE
    AS $$
  select e.* from public.events_real e
  where (p_ch is null and p_lang is null)
    or (e.session is not null and exists (
          select 1 from public.admin_sess_attr s where s.session = e.session
            and (p_ch is null or s.ch = any(string_to_array(p_ch, ',')))
            and (p_lang is null or s.lg = left(p_lang, 2))))
    or (e.session is null
        and (p_ch is null or public.admin_channel(e.props->'src', e.props->>'ia') = any(string_to_array(p_ch, ',')))
        and (p_lang is null or left(coalesce(e.lang, ''), 2) = left(p_lang, 2)))
$$;

ALTER FUNCTION "public"."admin_events"("p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_exp_sum"("p_metric" "text", "p_ch" "text", "p_lg" "text", "p_d0" "date", "p_d1" "date") RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; v numeric := 0;
begin
  if p_d1 < p_d0 then return 0; end if;
  if p_metric in ('sessions', 'scored', 'shared', 'app', 'revealed') then
    select coalesce(sum(case p_metric when 'sessions' then sessions when 'shared' then shared when 'app' then app when 'revealed' then revealed else scored end), 0) into v
    from public.admin_daily where ch = any(coalesce(string_to_array(p_ch, ','), array['*'])) and lg = coalesce(left(p_lg, 2), '*') and day between p_d0 and p_d1;
  elsif p_metric = 'signups' then
    select count(*) into v from public.admin_real_users u where (u.created_at at time zone tz)::date between p_d0 and p_d1;
  elsif p_metric in ('gsc_clicks', 'gsc_impressions') then
    select coalesce(sum(case when p_metric = 'gsc_clicks' then g.clicks else g.impressions end), 0) into v from public.admin_gsc_days(p_d0, p_d1) g;
  else
    v := public.admin_goal_value(p_metric, p_d0::timestamp at time zone tz, (p_d1 + 1)::timestamp at time zone tz);
  end if;
  return v;
end $$;

ALTER FUNCTION "public"."admin_exp_sum"("p_metric" "text", "p_ch" "text", "p_lg" "text", "p_d0" "date", "p_d1" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_experiment_delete"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.admin_experiments where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_experiment_delete"("p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_experiment_save"("p" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (p->>'id') is not null then
    update public.admin_experiments set title = coalesce(nullif(left(p->>'title', 200), ''), title), note = case when p ? 'note' then left(p->>'note', 500) else note end,
      days = case when p ? 'days' then greatest(1, least(coalesce((p->>'days')::int, days), 60)) else days end where id = (p->>'id')::bigint;
    return;
  end if;
  insert into public.admin_experiments (title, start_day, metric, days, note, ch, lg)
  values (left(p->>'title', 200), coalesce((p->>'start_day')::date, public.admin_today()), coalesce(nullif(p->>'metric', ''), 'scored'), greatest(1, least(coalesce((p->>'days')::int, 7), 60)),
    left(p->>'note', 500), nullif(left(p->>'ch', 40), ''), nullif(left(p->>'lg', 2), ''));
end $$;

ALTER FUNCTION "public"."admin_experiment_save"("p" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_experiments_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare today date := (now() at time zone 'Europe/Budapest')::date; gmax date := (select max(day) from public.gsc_daily);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.start_day desc) from (
    select y.*, (y.gone >= y.days) done,
      /* the whole "before" window, as before */
      public.admin_exp_sum(y.metric, y.ch, y.lg, y.start_day - y.days, y.start_day - 1) v_before,
      /* the finished days after the start (today is never counted: half a day would look like a collapse) */
      public.admin_exp_sum(y.metric, y.ch, y.lg, y.start_day, y.start_day + y.gone - 1) v_after,
      /* the same weekdays before: the after-days shifted back by whole weeks */
      public.admin_exp_sum(y.metric, y.ch, y.lg, y.start_day - y.k7, y.start_day - y.k7 + y.gone - 1) v_before_dow
    from (
      select e.*, greatest(0, least(e.days, (case when e.metric like 'gsc\_%' then coalesce(gmax + 1, today) else today end) - e.start_day)) gone,
        (ceil(e.days / 7.0) * 7)::int k7
      from public.admin_experiments e) y) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_experiments_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_first"("p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (select min(first_at) from public.admin_daily where ch = any(coalesce(string_to_array(p_ch, ','), array['*'])) and lg = coalesce(left(p_lang, 2), '*')),
    (select min(created_at) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '2 days'))
$$;

ALTER FUNCTION "public"."admin_first"("p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_fresh"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'platforms', coalesce((select jsonb_object_agg(platform, jsonb_build_object('at', last_sync_at, 'error', last_error is not null)) from public.social_accounts), '{}'),
    'gsc', jsonb_build_object('at', (select max(at) from public.sync_log where source = 'gsc' and ok), 'day', public.admin_gsc_last(),
      'error', coalesce((select not ok from public.sync_log where source = 'gsc' order by at desc limit 1), false)),
    'apple', (select max(at) from public.sync_log where source = 'apple' and ok),
    'google', (select max(at) from public.sync_log where source = 'google' and ok),
    'index', (select max(checked_at) from public.gsc_index),
    'events', (select max(created_at) from public.events),
    'rollup', (select max(first_at) from public.admin_daily),
    -- the daily and weekly runs: when each last succeeded, and whether its last attempt failed
    'src', coalesce((select jsonb_object_agg(source, jsonb_build_object('at', ok_at, 'error', coalesce(last_bad, false), 'empty', coalesce(last_empty, false), 'note', last_note)) from (
      /* a run that worked but brought nothing ("üres:"), skipped a part ("kihagyva") or missed a source ("részben:") is not "fresh" */
      select source, max(at) filter (where ok) ok_at, (array_agg(ok order by at desc))[1] = false last_bad,
        (array_agg(coalesce(message, '') ~* '(^|[:·;] *)(üres:|részben:|kihagyva)' order by at desc) filter (where ok))[1] last_empty,
        (array_agg(left(message, 120) order by at desc) filter (where ok))[1] last_note from public.sync_log
      where source in ('bing', 'seo', 'watch', 'aivis', 'cwv', 'competitors', 'kw_ideas', 'gsc_index', 'cse') and at > now() - interval '60 days' group by source) s), '{}'),
    'mentions', (select max(at) from public.brand_mentions));
end $$;

ALTER FUNCTION "public"."admin_fresh"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_funnel"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with s as (select * from public.admin_sess(r.a, r.b, p_ch, p_lang)),
  ps as (select * from public.admin_sess(r.pa, r.a, p_ch, p_lang))
  select jsonb_build_object('days', r.d, 'from', r.a, 'to', r.b,
    'now', (select jsonb_build_object('sessions', count(*), 'app', count(*) filter (where app), 'named', count(*) filter (where app and named),
      'captured', count(*) filter (where app and named and captured), 'scored', count(*) filter (where app and named and captured and scored),
      'quiz', count(*) filter (where app and named and captured and scored and quiz), 'revealed', count(*) filter (where app and named and captured and scored and quiz and revealed),
      'detail', count(*) filter (where app and named and captured and scored and quiz and revealed and detail),
      'shared', count(*) filter (where app and named and captured and scored and quiz and revealed and shared),
      'skipped', count(*) filter (where app and named and skipped), 'skip_quiz', count(*) filter (where app and named and skipped and quiz),
      'skip_revealed', count(*) filter (where app and named and skipped and quiz and revealed),
      'land', count(*) filter (where land), 'cta', count(*) filter (where land and cta), 'cta_reg', count(*) filter (where land and cta_reg),
      'cta_login', count(*) filter (where land and cta_login), 'cta_guest', count(*) filter (where land and cta_guest), 'land_app', count(*) filter (where land and app),
      'direct_app', count(*) filter (where app and not land),
      'any_scored', count(*) filter (where scored), 'any_revealed', count(*) filter (where revealed), 'any_shared', count(*) filter (where shared)) from s),
    'prev', (select jsonb_build_object('sessions', count(*), 'app', count(*) filter (where app), 'named', count(*) filter (where app and named),
      'captured', count(*) filter (where app and named and captured), 'scored', count(*) filter (where app and named and captured and scored),
      'quiz', count(*) filter (where app and named and captured and scored and quiz), 'revealed', count(*) filter (where app and named and captured and scored and quiz and revealed),
      'detail', count(*) filter (where app and named and captured and scored and quiz and revealed and detail),
      'shared', count(*) filter (where app and named and captured and scored and quiz and revealed and shared),
      'skipped', count(*) filter (where app and named and skipped), 'land', count(*) filter (where land), 'land_app', count(*) filter (where land and app),
      'any_scored', count(*) filter (where scored), 'any_revealed', count(*) filter (where revealed)) from ps),
    -- the quiz answers: a question without a value is counted as answered; "a+b" (several picked) counts each
    'quiz', coalesce((select jsonb_agg(x order by x.step, x.n desc) from (
      select e.props->>'step' step, coalesce(u.v, '') v, count(*) n
      from public.admin_events(p_ch, p_lang) e left join lateral unnest(string_to_array(nullif(e.props->>'value', ''), '+')) u(v) on true
      where e.name = 'quiz_answer' and e.created_at >= r.a and e.created_at < r.b and e.props->>'step' not in ('name', 'sign') group by 1, 2) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_funnel"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_funnel_weeks"("p_weeks" integer DEFAULT 12, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; v_a timestamptz := date_trunc('week', now() at time zone tz) at time zone tz - make_interval(weeks => greatest(1, least(coalesce(p_weeks, 12), 52)) - 1);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.w) from (
    select date_trunc('week', t0 at time zone tz)::date w, count(*) sessions, count(*) filter (where app) app, count(*) filter (where app and named) named,
      count(*) filter (where app and named and captured) captured, count(*) filter (where app and named and captured and scored) scored,
      count(*) filter (where app and named and captured and scored and quiz) quiz,
      count(*) filter (where app and named and captured and scored and quiz and revealed) revealed,
      count(*) filter (where app and named and captured and scored and quiz and revealed and shared) shared,
      count(*) filter (where app and named and skipped) skipped
    from public.admin_sess(v_a, now(), p_ch, p_lang) group by 1) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_funnel_weeks"("p_weeks" integer, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_gate"("p_token" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_admin() or coalesce(auth.role(), '') = 'service_role'
    or (p_token is not null and length(p_token) = 64 and p_token = (select v from public.admin_secrets where k = 'cron'))
$$;

ALTER FUNCTION "public"."admin_gate"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_goal_save"("p_metric" "text", "p_period" "text", "p_target" integer, "p_start" "date" DEFAULT NULL::"date", "p_end" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  /* 0 deletes (the page sends it only from the "Törlés" button; an empty field no longer does) */
  if coalesce(p_target, 0) <= 0 then delete from public.admin_goals where metric = p_metric and period = p_period; return; end if;
  insert into public.admin_goals (metric, period, target, start_day, end_day) values (p_metric, p_period, p_target, case when p_period = 'custom' then p_start end, case when p_period = 'custom' then p_end end)
  on conflict (metric, period) do update set target = excluded.target, start_day = excluded.start_day, end_day = excluded.end_day, updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_goal_save"("p_metric" "text", "p_period" "text", "p_target" integer, "p_start" "date", "p_end" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_goal_value"("p_metric" "text", "p_t0" timestamp with time zone, "p_t1" timestamp with time zone) RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest';
  d0 date := (p_t0 at time zone tz)::date;
  e1 date := case when p_t1 >= now() then (now() at time zone tz)::date else ((p_t1 at time zone tz) - interval '1 microsecond')::date end;
  pf text; mx date; glag int := 0; v bigint := 0;
begin
  if p_metric in ('gsc_clicks', 'gsc_impressions') then
    /* Google gives its numbers 2–3 days late: the same number of days, ending on the last day Google already has */
    mx := public.admin_gsc_last();
    if mx is not null and e1 > mx then glag := e1 - mx; end if;
    select coalesce(sum(case when p_metric = 'gsc_clicks' then g.clicks else g.impressions end), 0) into v from public.admin_gsc_days(d0 - glag, e1 - glag) g;
  elsif p_metric = 'bing_clicks' then
    select max(day) into mx from public.bing_daily;
    if mx is not null and e1 > mx then glag := e1 - mx; end if;
    select coalesce(sum(clicks), 0) into v from public.bing_daily where day between d0 - glag and e1 - glag;
  elsif p_metric = 'downloads' then
    select coalesce(sum(downloads), 0) into v from public.store_daily where day between d0 and e1;
  elsif p_metric = 'reviews' then
    select count(*) into v from public.store_reviews where created_at >= p_t0 and created_at < p_t1;
  elsif p_metric = 'followers' or p_metric like 'followers\_%' then
    pf := nullif(substr(p_metric, 11), '');
    select coalesce(sum(case when b.f is null then 0 else b.f - coalesce(a.f, c.f, b.f) end), 0) into v
    from (select distinct platform from public.social_account_daily where pf is null or platform = pf) p
    left join lateral (select followers f from public.social_account_daily x where x.platform = p.platform and x.day <= e1 and x.followers is not null order by x.day desc limit 1) b on true
    left join lateral (select followers f from public.social_account_daily x where x.platform = p.platform and x.day < d0 and x.followers is not null order by x.day desc limit 1) a on true
    left join lateral (select followers f from public.social_account_daily x where x.platform = p.platform and x.day between d0 and e1 and x.followers is not null order by x.day asc limit 1) c on true;
  elsif p_metric = 'views_pinterest' then
    select coalesce(sum(impressions), 0) into v from public.social_account_daily where platform = 'pinterest' and day between d0 and e1;
  elsif p_metric like 'views\_%' then
    select coalesce(sum(greatest(0, v1 - coalesce(v0, 0))), 0) into v from (
      select post_id, max(views) filter (where day between d0 and e1) v1, max(views) filter (where day < d0) v0
      from public.social_post_daily where platform = substr(p_metric, 7) and day <= e1 group by post_id) z where v1 is not null;
  elsif p_metric like 'visits\_%' then
    select coalesce(sum(sessions), 0) into v from public.admin_daily where ch = substr(p_metric, 8) and lg = '*' and day between d0 and e1;
  else
    v := coalesce((public.admin_period(p_t0, least(p_t1, now())) ->> p_metric)::bigint, 0);
  end if;
  return v;
end $$;

ALTER FUNCTION "public"."admin_goal_value"("p_metric" "text", "p_t0" timestamp with time zone, "p_t1" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_goals_compute"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with g as (
    select gl.*, case when gl.period = 'custom' then gl.start_day::timestamp
        else date_trunc(case gl.period when 'week' then 'week' when 'month' then 'month' when 'quarter' then 'quarter' else 'year' end, now() at time zone 'Europe/Budapest') end l0,
      case gl.period when 'week' then interval '7 days' when 'month' then interval '1 month' when 'quarter' then interval '3 months' when 'year' then interval '1 year' end step
    from public.admin_goals gl
  ), w as (
    select g.*, g.l0 at time zone 'Europe/Budapest' t0, coalesce((g.end_day + 1)::timestamp, g.l0 + g.step) at time zone 'Europe/Budapest' t1 from g
  )
  select coalesce(jsonb_agg(jsonb_build_object('metric', w.metric, 'period', w.period, 'target', w.target, 't0', w.t0, 't1', w.t1, 'start_day', w.start_day, 'end_day', w.end_day,
      'value', public.admin_goal_value(w.metric, w.t0, least(w.t1, now())),
      'gsc_last', case when w.metric like 'gsc\_%' then (select max(day) from public.gsc_daily) end,
      'hist', case when w.step is null then '[]'::jsonb else (select jsonb_agg(jsonb_build_object('t0', (w.l0 - k * w.step) at time zone 'Europe/Budapest',
          'value', public.admin_goal_value(w.metric, (w.l0 - k * w.step) at time zone 'Europe/Budapest', (w.l0 - (k - 1) * w.step) at time zone 'Europe/Budapest')) order by k desc)
        from generate_series(1, 6) k) end) order by w.metric, w.period), '[]')
  from w
$$;

ALTER FUNCTION "public"."admin_goals_compute"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_goals_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_goals_compute();
end $$;

ALTER FUNCTION "public"."admin_goals_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_goals_list_internal"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with g as (
    select gl.*, case when gl.period = 'custom' then gl.start_day::timestamp
        else date_trunc(case gl.period when 'week' then 'week' when 'month' then 'month' when 'quarter' then 'quarter' else 'year' end, now() at time zone 'Europe/Budapest') end l0,
      case gl.period when 'week' then interval '7 days' when 'month' then interval '1 month' when 'quarter' then interval '3 months' when 'year' then interval '1 year' end step
    from public.admin_goals gl
  ), w as (
    select g.*, g.l0 at time zone 'Europe/Budapest' t0, coalesce((g.end_day + 1)::timestamp, g.l0 + g.step) at time zone 'Europe/Budapest' t1 from g
  )
  select coalesce(jsonb_agg(jsonb_build_object('metric', w.metric, 'period', w.period, 'target', w.target::bigint,
      'value', public.admin_goal_value(w.metric, w.t0, least(w.t1, now()))::bigint) order by w.metric, w.period), '[]')
  from w where w.period <> 'custom' or w.t1 > now()
$$;

ALTER FUNCTION "public"."admin_goals_list_internal"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_grand_total"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('scored', public.admin_total('scored'), 'sessions', public.admin_total('sessions'),
    'users', (select count(*) from auth.users u where not public.admin_own_uid(u.id)));
end $$;

ALTER FUNCTION "public"."admin_grand_total"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_gsc_days"("p_d0" "date", "p_d1" "date") RETURNS TABLE("day" "date", "clicks" bigint, "impressions" bigint, "exact" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select g::date, coalesce(t.clicks, d.clicks)::bigint, coalesce(t.impressions, d.impressions)::bigint, t.day is not null
  from generate_series(p_d0, p_d1, interval '1 day') g
  left join public.gsc_totals t on t.type = 'web' and t.day = g::date
  left join (select x.day, sum(x.clicks) clicks, sum(x.impressions) impressions from public.gsc_daily x where x.day between p_d0 and p_d1 group by 1) d on d.day = g::date
  where p_d0 is not null and p_d1 is not null
$$;

ALTER FUNCTION "public"."admin_gsc_days"("p_d0" "date", "p_d1" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_gsc_index"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(g) - 'mobile' order by (g.verdict = 'PASS'), g.url) from public.gsc_index g), '[]'),
    'pass', (select count(*) from public.gsc_index where verdict = 'PASS'),
    'all', (select count(*) from public.gsc_index),
    'checked', (select max(checked_at) from public.gsc_index),
    'dropped', coalesce((select jsonb_agg(x order by x.changed_at desc) from (select url, coverage, prev_verdict, changed_at from public.gsc_index where prev_verdict = 'PASS' and verdict is distinct from 'PASS') x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(substring(url from '[?&]lang=([a-z]{2})'), 'hu') k, count(*) n, count(*) filter (where verdict = 'PASS') pass
      from public.gsc_index group by 1) x), '[]'),
    'sitemaps', coalesce((select jsonb_agg(to_jsonb(s)) from public.gsc_sitemaps s), '[]'));
end $$;

ALTER FUNCTION "public"."admin_gsc_index"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_gsc_last"() RETURNS "date"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select least(greatest((select max(day) from public.gsc_daily), (select max(day) from public.gsc_totals where type = 'web')), public.admin_today() - 1)
$$;

ALTER FUNCTION "public"."admin_gsc_last"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_gsc_page"("p_page" "text", "p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare last date := (select max(day) from public.gsc_daily); v_a date; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_a := coalesce(last, public.admin_today()) - greatest(1, least(coalesce(nullif(p_days, 0), 480), 3650)) + 1;
  select jsonb_build_object(
    'page', p_page, 'from', v_a, 'last_day', last,
    'trend', coalesce((select jsonb_agg(x order by x.t) from (select day t, sum(clicks) clicks, sum(impressions) impressions, sum(position * impressions) / nullif(sum(impressions), 0) pos
      from public.gsc_daily where page = p_page and day >= v_a group by day) x), '[]'),
    'queries', coalesce((select jsonb_agg(x) from (select query, sum(clicks) clicks, sum(impressions) impressions, sum(position * impressions) / nullif(sum(impressions), 0) pos
      from public.gsc_daily where page = p_page and day >= v_a group by query order by 2 desc, 3 desc limit 50) x), '[]'),
    'countries', coalesce((select jsonb_agg(x) from (select country k, sum(clicks) clicks, sum(impressions) impressions, round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) pos
      from public.gsc_daily where page = p_page and day >= v_a group by 1 order by 3 desc limit 12) x), '[]'),
    'devices', coalesce((select jsonb_agg(x) from (select device k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where page = p_page and day >= v_a group by 1 order by 3 desc) x), '[]'),
    'views', (select count(*) from public.events_real where name = 'landing_view' and (props->>'page' = regexp_replace(p_page, '^https?://[^/]+', '') or path = regexp_replace(p_page, '^https?://[^/]+', '')) and created_at >= v_a)
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_gsc_page"("p_page" "text", "p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_heat_ch"("p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(7, least(coalesce(nullif(p_days, 0), 365), 365));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    select ch, extract(isodow from t at time zone 'Europe/Budapest')::int w, extract(hour from t at time zone 'Europe/Budapest')::int h, count(*) n
    from (select session, min(created_at) t, public.admin_channel((array_agg(props->'src' order by created_at))[1], (array_agg(props->>'ia' order by created_at))[1]) ch
          from public.events_real where created_at >= now() - make_interval(days => d) and session is not null group by session) s
    group by 1, 2, 3) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_heat_ch"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_home_extra"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest';
  today date := public.admin_today();
  d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  a date := today - d + 1;
  gmax date := public.admin_gsc_last();
  glag int := greatest(0, today - coalesce(gmax, today));
  smax date := (select max(day) from public.store_daily);
  slag int := greatest(0, today - coalesce(smax, today));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', d,
    'downloads', (select coalesce(sum(downloads), 0) from public.store_daily where day between a - slag and today - slag),
    'downloads_prev', (select coalesce(sum(downloads), 0) from public.store_daily where day between a - slag - d and a - slag - 1),
    'stores_last', smax, 'stores_lag', slag,
    'stores_on', exists (select 1 from public.store_daily) or exists (select 1 from public.store_reviews),
    'followers_gain', public.admin_goal_value('followers', a::timestamp at time zone tz, now()),
    'followers_gain_prev', case when exists (select 1 from public.social_account_daily where day < a and followers is not null)
      then public.admin_goal_value('followers', (a - d)::timestamp at time zone tz, a::timestamp at time zone tz) end,
    'followers_on', exists (select 1 from public.social_account_daily),
    'followers_since', (select min(day) from public.social_account_daily where followers is not null),
    'gsc', jsonb_build_object('last', gmax, 'lag', glag,
      'clicks', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(a - glag, today - glag) g),
      'impressions', (select coalesce(sum(g.impressions), 0) from public.admin_gsc_days(a - glag, today - glag) g),
      'prev', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(a - glag - d, a - glag - 1) g),
      'prev_known', (select min(x.day) from public.admin_gsc_days(a - glag - d, a - glag - 1) x where x.clicks is not null) = a - glag - d,
      'countries', coalesce((select jsonb_agg(x) from (select country k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where day between a - glag and today - glag group by 1 order by 2 desc, 3 desc limit 6) x), '[]')),
    'store_countries', coalesce((select jsonb_agg(x) from (select country k, sum(downloads) n from public.store_daily where day between a - slag and today - slag and country <> '' group by 1 order by 2 desc limit 6) x), '[]'),
    'series', coalesce((select jsonb_agg(x order by x.t) from (
      select g::date t,
        (select sum(z.f) from (select distinct on (s.platform) s.followers f from public.social_account_daily s where s.day <= g::date and s.followers is not null order by s.platform, s.day desc) z) followers,
        public.admin_post_gains_day(g::date) views,
        gd.clicks gsc_clicks
      from generate_series(greatest(a, today - 400), today, interval '1 day') g
      left join public.admin_gsc_days(greatest(a, today - 400), today) gd on gd.day = g::date) x), '[]'),
    'articles', coalesce((select jsonb_agg(x order by x.n desc) from (
      select e2.pg k, count(*) n, count(distinct e2.session) sessions,
        (select coalesce(sum(g.clicks), 0) from public.gsc_daily g where g.page like '%' || e2.pg and g.day between a - glag and today - glag) gsc_clicks
      from (select coalesce(e.props->>'page', e.path) pg, e.session from public.events_real e where e.name = 'landing_view' and e.created_at >= a::timestamp at time zone tz) e2
      where e2.pg like '/tudastar/%' group by e2.pg order by 2 desc limit 60) x), '[]'),
    'days_all', coalesce((select jsonb_agg(x order by x.t) from (select day t, sessions, scored from public.admin_daily where ch = '*' and lg = '*' and day >= today - 120) x), '[]'),
    'latest_review', (select to_jsonb(r) from (select store, rating, author, left(body, 140) body, created_at from public.store_reviews where created_at > now() - interval '3 days' order by created_at desc limit 1) r),
    'bing', (select max(at) from public.sync_log where source = 'bing' and ok));
end $$;

ALTER FUNCTION "public"."admin_home_extra"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_import_posts"("p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.social_posts p set
    watch_avg = coalesce((r->>'watch_avg')::numeric, p.watch_avg), watch_total = coalesce((r->>'watch_total')::numeric::bigint, p.watch_total),
    completion = coalesce((r->>'completion')::numeric, p.completion), saves = coalesce((r->>'saves')::numeric::bigint, p.saves),
    reach = coalesce((r->>'reach')::numeric::bigint, p.reach), follows = coalesce((r->>'follows')::numeric::bigint, p.follows),
    impressions = coalesce((r->>'impressions')::numeric::bigint, p.impressions), shares = coalesce((r->>'shares')::numeric::bigint, p.shares),
    clicks = coalesce((r->>'clicks')::numeric::bigint, p.clicks), profile_visits = coalesce((r->>'profile_visits')::numeric::bigint, p.profile_visits),
    traffic = coalesce(r->'traffic', p.traffic)
  from jsonb_array_elements(p_rows) r
  where p.platform = r->>'platform' and p.post_id = r->>'post_id';
  get diagnostics k = row_count;
  /* a YouTube Studio export's thumbnail click-through rate goes with the day of the import */
  insert into public.social_post_day (platform, post_id, day, ctr)
  select r->>'platform', r->>'post_id', public.admin_today(), (r->>'ctr')::numeric from jsonb_array_elements(p_rows) r
  where r ? 'ctr' and exists (select 1 from public.social_posts p where p.platform = r->>'platform' and p.post_id = r->>'post_id')
  on conflict (platform, post_id, day) do update set ctr = excluded.ctr;
  return k;
end $$;

ALTER FUNCTION "public"."admin_import_posts"("p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_impressions"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(1, least(coalesce(nullif(p_days, 0), 480), 480)); today date := public.admin_today();
  lg date := least(coalesce(public.admin_gsc_last(), public.admin_today() - 1), public.admin_today() - 1);
  lb date := coalesce((select max(day) from public.bing_daily), public.admin_today() - 1);
  la date := coalesce((select max(day) from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = ''), public.admin_today() - 1);
  lp date := coalesce((select max(day) from public.store_metrics where store = 'google' and metric = 'page_views' and dim = ''), public.admin_today() - 1);
  ga date := lg - d + 1; first date := least(lg, lb, la, lp, today) - 2 * d + 1; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with acc as (
    select platform, day, impressions v from public.social_account_daily
    where platform in ('instagram', 'facebook', 'pinterest', 'linkedin', 'youtube') and impressions is not null and day >= first
  ), accp as (select distinct platform from acc),
  g as (select * from public.admin_post_gains(first)),
  social as (
    select platform, day, v from acc
    union all select platform, day, sum(gain) from g where platform not in (select platform from accp) group by 1, 2
  ), src0 as (
    select 'google' k, x.day, x.impressions::numeric v from public.admin_gsc_days(first, lg) x where x.impressions is not null
    union all select platform, day, v from social
    union all select 'appstore', day, sum(n) from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = '' and day >= first group by 2
    union all select 'googleplay', day, sum(n) from public.store_metrics where store = 'google' and metric = 'page_views' and dim = '' and day >= first group by 2
    union all select 'bing', day, sum(impressions)::numeric from public.bing_daily where day >= first group by 2
  ), w as (
    select k, e - d + 1 a, e b, e - 2 * d + 1 pa from (values ('google', lg), ('bing', lb), ('appstore', la), ('googleplay', lp),
      ('tiktok', today), ('instagram', today), ('facebook', today), ('pinterest', today), ('linkedin', today), ('youtube', today)) v(k, e)
  ), cur as (select s.* from src0 s join w on w.k = s.k where s.day between w.a and w.b),
  prv as (select s.* from src0 s join w on w.k = s.k where s.day between w.pa and w.a - 1),
  isv as (select k from w where k = 'tiktok' or (k = 'youtube' and k not in (select platform from accp))),
  ses as materialized (
    /* visits by source; each source's visits are counted over that source's own window, so "every Nth appearance became a visit"
       compares the same days (Google's appearances end 1–3 days before today) */
    select sa.session, (sa.first_at at time zone 'Europe/Budapest')::date dy, case sa.ch when 'kereső' then 'bing' else sa.ch end k
    from public.admin_sess_attr sa
    where sa.first_at >= (first::timestamp at time zone 'Europe/Budapest') and exists (select 1 from public.events_real e where e.session = sa.session)
  )
  select jsonb_build_object(
    'days', d,
    'gsc_last', lg,
    'gsc_exact_from', (select min(day) from public.gsc_totals where type = 'web'),
    'bing_last', (select max(day) from public.bing_daily),
    'windows', (select jsonb_object_agg(k, jsonb_build_object('from', a, 'to', b)) from w),
    'method', coalesce((select jsonb_object_agg(k, m) from (
        select p k, case when p in (select platform from accp) then 'account' else 'posts' end m
        from unnest(array['tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube']) p) x), '{}'),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (select day, jsonb_object_agg(k, v) v from cur where k not in (select k from isv) group by day) x), '[]'),
    'totals', coalesce((select jsonb_object_agg(k, v) from (select k, sum(v) v from cur where k not in (select k from isv) group by k) x), '{}'),
    'prev', coalesce((select jsonb_object_agg(k, v) from (select k, sum(v) v from prv where k not in (select k from isv) group by k) x), '{}'),
    'views', coalesce((select jsonb_object_agg(k, v) from (select k, sum(v) v from cur where k in (select k from isv) group by k) x), '{}'),
    'views_prev', coalesce((select jsonb_object_agg(k, v) from (select k, sum(v) v from prv where k in (select k from isv) group by k) x), '{}'),
    'views_since', coalesce((select jsonb_object_agg(platform, d0) from (select platform, min(day) d0 from public.social_post_daily group by 1) x), '{}'),
    'queries', coalesce((select jsonb_agg(x) from (select query, sum(impressions) impressions, sum(clicks) clicks, round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) pos,
        (array_agg(page order by impressions desc))[1] page from public.gsc_daily where day between ga and lg group by 1 order by 2 desc limit 40) x), '[]'),
    'pages', coalesce((select jsonb_agg(x) from (select page, sum(impressions) impressions, sum(clicks) clicks, count(distinct query) queries from public.gsc_daily where day between ga and lg group by 1 order by 2 desc limit 20) x), '[]'),
    'countries', coalesce((select jsonb_agg(x) from (select country k, sum(impressions) n from public.gsc_daily where day between ga and lg group by 1 order by 2 desc limit 12) x), '[]'),
    'devices', coalesce((select jsonb_agg(x) from (select device k, sum(impressions) n from public.gsc_daily where day between ga and lg group by 1 order by 2 desc) x), '[]'),
    'rows_impressions', (select coalesce(sum(impressions), 0) from public.gsc_daily where day between ga and lg),
    'posts', coalesce((select jsonb_agg(x) from (select g.platform, g.post_id, max(p.title) title, max(p.url) url, max(p.thumb) thumb, sum(g.gain) n
        from g join public.social_posts p on p.platform = g.platform and p.post_id = g.post_id where g.day >= today - d + 1 group by 1, 2 having sum(g.gain) > 0 order by 6 desc limit 20) x), '[]'),
    'store_sources', coalesce((select jsonb_agg(x) from (select k, sum(n) n from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = 'source' and day between la - d + 1 and la group by 1 order by 2 desc) x), '[]'),
    'visits_by', coalesce((select jsonb_object_agg(k, n) from (select s.k, count(*) n from ses s left join w on w.k = s.k
        where s.dy between coalesce(w.a, today - d + 1) and coalesce(w.b, today) group by 1) x), '{}'),
    'visits', (select count(*) from ses where dy between today - d + 1 and today)
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_impressions"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox"("p_all" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(x order by x.done, (x.kind = 'review' and coalesce(x.rating, 5) <= 2) desc, (x.tag = 'hiba') desc, x.created_at desc nulls last) from (select * from (
      select y.*, coalesce(nullif(y.tag_manual, 'nincs'), case when y.tag_manual = 'nincs' then null else public.admin_inbox_tag(y.body, y.rating, y.kind) end) tag from (
        select source, item_id, kind, post_id, post_title, post_url, post_thumb, author, body, rating, lang, created_at, reply, replied_at, done, hidden, liked, null::text territory, null::text version, email, seen_at, tag_manual
        from public.inbox_items
        union all
        select store, review_id, 'review', null, coalesce(title, ''), null, null, author, body, rating, lang, created_at, reply, replied_at, (reply is not null or done), false, false, territory, version, null::text, null::timestamptz, null::text
          from public.store_reviews) y
      ) x0 where p_all or not x0.done or x0.created_at > now() - interval '3 days' order by x0.done, x0.created_at desc nulls last limit 600) x), '[]'),
    /* a store review is open until it is answered or closed: it no longer waits forever */
    'unread', (select count(*) from public.inbox_items where source = 'support' and not done and seen_at is null),
    'open', (select count(*) from public.inbox_items where not done) + coalesce((select count(*) from public.store_reviews where reply is null and not done), 0),
    'sources', coalesce((select jsonb_agg(s) from (
      select source k, count(*) filter (where not done) open, count(*) n from public.inbox_items group by 1
      union all select store, count(*) filter (where reply is null and not done), count(*) from public.store_reviews group by 1) s), '[]'),
    'bugs', coalesce((select jsonb_agg(b order by b.created_at desc) from (
      select source, item_id, author, body, created_at, post_title from public.inbox_items where public.admin_inbox_tag(body, rating, kind) = 'hiba' and created_at > now() - interval '30 days'
      union all select store, review_id, author, body, created_at, title from public.store_reviews where public.admin_inbox_tag(body, rating, 'review') = 'hiba' and created_at > now() - interval '30 days'
      order by 5 desc limit 30) b), '[]'),
    'authors', coalesce((select jsonb_agg(a order by a.n desc) from (
      select author, source, count(*) n, max(created_at) last from public.inbox_items where author is not null and author !~* 'inkage' group by 1, 2 order by 3 desc limit 12) a), '[]'),
    'stars', coalesce((select jsonb_agg(s order by s.t) from (
      select date_trunc('week', created_at at time zone 'Europe/Budapest')::date t, store, round(avg(rating)::numeric, 2) avg, count(*) n
      from public.store_reviews where created_at > now() - interval '120 days' and rating is not null group by 1, 2) s), '[]'));
end $$;

ALTER FUNCTION "public"."admin_inbox"("p_all" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_done"("p_source" "text", "p_item" "text", "p_done" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_source in ('apple', 'google') then
    update public.store_reviews set done = p_done, done_at = case when p_done then now() end where store = p_source and review_id = p_item;
  else
    update public.inbox_items set done = p_done, updated_at = now() where source = p_source and item_id = p_item;
  end if;
end $$;

ALTER FUNCTION "public"."admin_inbox_done"("p_source" "text", "p_item" "text", "p_done" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_done_many"("p_items" "jsonb", "p_done" boolean DEFAULT true) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare x jsonb; k integer := 0;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    perform public.admin_inbox_done(x->>'source', x->>'item_id', p_done); k := k + 1;
  end loop;
  return k;
end $$;

ALTER FUNCTION "public"."admin_inbox_done_many"("p_items" "jsonb", "p_done" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_replied"("p_source" "text", "p_item" "text", "p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_source in ('apple', 'google') then
    update public.store_reviews set reply = coalesce(reply, left(p_text, 6000)), replied_at = coalesce(replied_at, now()), done = true, done_at = now() where store = p_source and review_id = p_item;
  else
    update public.inbox_items set reply = coalesce(reply, left(p_text, 6000)), replied_at = coalesce(replied_at, now()), done = true, updated_at = now() where source = p_source and item_id = p_item;
  end if;
  perform public.admin_audit_add('valasz.elkuldve', p_source || ':' || p_item, jsonb_build_object('hossz', length(p_text)));
end $$;

ALTER FUNCTION "public"."admin_inbox_replied"("p_source" "text", "p_item" "text", "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_seen"("p_source" "text", "p_item" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.inbox_items set seen_at = coalesce(seen_at, now()) where source = p_source and item_id = p_item;
end $$;

ALTER FUNCTION "public"."admin_inbox_seen"("p_source" "text", "p_item" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_tag"("body" "text", "rating" integer, "kind" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case
    when kind = 'review' and rating <= 2 then 'panasz'
    when body ~* '(nem működik|nem megy|nem tölt|lefagy|összeomlik|kilép|hiba|bug|crash|error|doesn.?t work|not working|broken|freez|won.?t (load|open)|can.?t (log|sign|save|open)|nem tudok|nem enged)' then 'hiba'
    when body ~ '\?' then 'kérdés'
    when body ~* '(rossz|csalódás|utál|unalmas|drága|reklám|bad|worst|hate|terrible|awful|disappoint|scam|useless)' or (kind = 'review' and rating = 3) then 'panasz'
    when body ~* '(szuper|imád|gyönyörű|csodá|köszön|szép|tetszik|zseniális|love|amazing|beautiful|great|awesome|perfect|thank|nice|cool|❤|😍|🔥|👏)' or (kind = 'review' and rating >= 4) then 'dicséret'
    else null end
$$;

ALTER FUNCTION "public"."admin_inbox_tag"("body" "text", "rating" integer, "kind" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_inbox_tag_set"("p_source" "text", "p_item" "text", "p_tag" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tag is not null and p_tag not in ('hiba', 'kérdés', 'ötlet', 'dicséret', 'panasz', 'nincs') then raise exception 'bad tag'; end if;
  update public.inbox_items set tag_manual = p_tag, updated_at = now() where source = p_source and item_id = p_item;
end $$;

ALTER FUNCTION "public"."admin_inbox_tag_set"("p_source" "text", "p_item" "text", "p_tag" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_jobs_failing"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  /* only scheduled runs count: a run started by hand (dashboard button or a test) never turns a job red */
  select coalesce(jsonb_agg(x.jobname order by x.jobname), '[]') from (
    select j.jobname, y.path, y.h,
      (select r from public.admin_runs r where r.job = y.path
         and (case when (y.h).id is not null then r.started_at >= (y.h).at - interval '1 minute'
           else exists (select 1 from cron.job_run_details d where d.jobid = j.jobid and r.started_at between d.start_time - interval '1 minute' and d.start_time + interval '10 minutes') end)
       order by r.started_at desc limit 1) r,
      (select d from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) l,
      case j.jobname when 'admin-rollup-week' then (select at from public.admin_rollup_state where k = 'week')
        when 'admin-rollup' then (select at from public.admin_rollup_state where k = 'recent')
        when 'admin-uptime' then (select max(at) from public.uptime_checks where via = 'pg_net') end done_at
    from cron.job j
    cross join lateral (select substring(j.command from 'admin_cron_call\(''([^'']+)''\)') path) p0
    cross join lateral (select p0.path, (select c from public.admin_cron_calls c where c.path = p0.path and coalesce(c.via, 'cron') = 'cron' order by c.at desc limit 1) h) y
    where j.jobname like 'admin-%' and j.active) x
  where case when x.path is not null and ((x.h).id is not null or (x.r).id is not null) then
      not ((x.r).id is not null and (x.r).finished_at is null)
      and (case when (x.h).id is not null and not (x.h).done and (x.r).finished_at is not null and (x.r).started_at >= (x.h).at - interval '1 minute' then (x.r).ok = false
        when (x.h).id is not null and not (x.h).done then false
        when (x.h).id is not null and ((x.h).timed_out or (x.h).status is null or (x.h).status not between 200 and 299) then true
        else coalesce((x.r).ok = false, false) end)
    else (x.l).status is not null and (x.l).status <> 'succeeded' and (x.done_at is null or x.done_at < (x.l).start_time) end
$$;

ALTER FUNCTION "public"."admin_jobs_failing"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_key_ok"("p_name" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select p_name = any (array['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET',
    'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_BOARD_ID', 'LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET',
    'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_API_KEY', 'YOUTUBE_OAUTH_PUBLISHED', 'PSI_API_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'BING_WMT_KEY', 'GOOGLE_CSE_KEY', 'GOOGLE_CSE_ID',
    'RESEND_WEBHOOK_SECRET', 'RESEND_API_KEY', 'RESEND_FROM', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'ADMIN_AI_MODEL', 'ADMIN_AIVIS_MODEL', 'OPENAI_MODEL', 'PERPLEXITY_MODEL',
    'COMPETITOR_COUNTRY', 'VERCEL_API_TOKEN', 'VERCEL_PROJECT',
    'GSC_SERVICE_ACCOUNT_JSON', 'GSC_SITE_URL', 'ASC_ISSUER_ID', 'ASC_KEY_ID', 'ASC_PRIVATE_KEY', 'ASC_APP_ID', 'ASC_VENDOR_NUMBER',
    'PLAY_SERVICE_ACCOUNT_JSON', 'PLAY_PACKAGE', 'PLAY_REPORTS_BUCKET', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'])
$$;

ALTER FUNCTION "public"."admin_key_ok"("p_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_key_set"("p_name" "text", "p_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare sid uuid; v text := trim(coalesce(p_value, ''));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.admin_key_ok(p_name) then raise exception 'unknown key: %', p_name; end if;
  if length(v) > 20000 then raise exception 'too long'; end if;
  select id into sid from vault.secrets where name = 'inkage_admin.' || p_name;
  if v = '' then
    if sid is not null then delete from vault.secrets where id = sid; end if;
  elsif sid is null then
    perform vault.create_secret(v, 'inkage_admin.' || p_name, 'InkAge Irányítóközpont');
  else
    perform vault.update_secret(sid, v);
  end if;
  /* the key's name only, never its value */
  perform public.admin_audit_add('kulcs.mentes', p_name, '{}');
end $$;

ALTER FUNCTION "public"."admin_key_set"("p_name" "text", "p_value" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_key_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(substr(name, 14), updated_at) from vault.secrets where name like 'inkage_admin.%'), '{}');
end $$;

ALTER FUNCTION "public"."admin_key_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_leads"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select m.created_at at, coalesce(m.lang, m.slang) lang, m.ch, m.pf, m.code, m.provider, m.session is not null matched,
      coalesce(p.platform, l.post_platform, l.source) post_platform, p.title post_title, p.url post_url,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'flow_step' and e.props->>'step' = 'score') scored,
      exists (select 1 from public.events_real e where e.session = m.session and e.name in ('share_open', 'share_save', 'share_video', 'reveal_share')) shared,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'signature_captured') captured,
      (select min(e.created_at) from public.events_real e where e.session = m.session) first_at,
      (select extract(epoch from max(e.created_at) - min(e.created_at))::int from public.events_real e where e.session = m.session) secs,
      (select count(*) from public.generations c where c.user_id = m.user_id) celeb,
      (select sum((e.props->>'secs')::int) from public.events_real e where e.session = m.session and e.name = 'screen_time' and e.props->>'scr' in ('rev', 'picks', 'det') and e.props->>'secs' ~ '^[0-9]+$') result_secs,
      (select count(*) from public.events_real e where e.session = m.session and e.name = 'screenshot_key') shots
    from public.admin_signups_matched(r.a, least(r.b, now()) + interval '1 minute') m
    left join public.short_links l on l.code = m.code
    left join lateral (select q.platform, q.title, q.url from public.social_posts q where q.code = m.code or (q.platform = l.post_platform and q.post_id = l.post_id) limit 1) p on true
    limit 500) x), '[]');
end $_$;

ALTER FUNCTION "public"."admin_leads"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_link_delete"("p_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.short_links where code = lower(trim(p_code));
end $$;

ALTER FUNCTION "public"."admin_link_delete"("p_code" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_link_for_post"("p_platform" "text", "p_post_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare c text; t text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)), p.title into c, t
  from public.social_posts p where p.platform = p_platform and p.post_id = p_post_id;
  if c is not null and exists (select 1 from public.short_links where code = c) then
    update public.short_links set post_platform = p_platform, post_id = p_post_id where code = c and post_id is null;
    return c;
  end if;
  c := coalesce(c, (select (coalesce(max(code::bigint), 0) + 1)::text from public.short_links where code ~ '^\d{1,15}$'));
  insert into public.short_links (code, source, medium, note, post_platform, post_id)
  values (c, p_platform, 'social', nullif(left(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'), 60), ''), p_platform, p_post_id)
  on conflict (code) do update set post_platform = excluded.post_platform, post_id = excluded.post_id;
  return c;
end $_$;

ALTER FUNCTION "public"."admin_link_for_post"("p_platform" "text", "p_post_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_link_save"("p_code" "text", "p_target" "text" DEFAULT '/app?guest=1'::"text", "p_source" "text" DEFAULT NULL::"text", "p_medium" "text" DEFAULT NULL::"text", "p_campaign" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text", "p_post_platform" "text" DEFAULT NULL::"text", "p_post_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.short_links (code, target, source, medium, campaign, note, post_platform, post_id)
  values (lower(trim(p_code)), coalesce(nullif(trim(p_target), ''), '/app?guest=1'), nullif(lower(trim(p_source)), ''), nullif(lower(trim(p_medium)), ''),
    nullif(lower(trim(p_campaign)), ''), nullif(trim(p_note), ''), nullif(p_post_platform, ''), nullif(p_post_id, ''))
  on conflict (code) do update set target = excluded.target, source = excluded.source, medium = excluded.medium, campaign = excluded.campaign,
    note = excluded.note, post_platform = excluded.post_platform, post_id = excluded.post_id;
end $$;

ALTER FUNCTION "public"."admin_link_save"("p_code" "text", "p_target" "text", "p_source" "text", "p_medium" "text", "p_campaign" "text", "p_note" "text", "p_post_platform" "text", "p_post_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_links"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with v as (
    select props->'src'->>'ux' code, count(distinct session) sessions,
      count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') scored,
      count(distinct session) filter (where name = 'signup') signups,
      count(distinct session) filter (where name in ('share_open','share_save','share_video','reveal_share')) shared
    from public.events_real where props->'src' ? 'ux' and session is not null group by 1
  ), c as (
    select code, count(*) clicks, count(*) filter (where at >= now() - interval '7 days') clicks_7d, max(at) last_click,
      count(*) filter (where kind = 'tiktok') from_tiktok, count(*) filter (where kind = 'instagram') from_instagram
    from public.link_clicks group by code
  )
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into res from (
    select l.*, coalesce(c.clicks, 0) clicks, coalesce(c.clicks_7d, 0) clicks_7d, c.last_click, coalesce(c.from_tiktok, 0) from_tiktok,
      coalesce(c.from_instagram, 0) from_instagram, coalesce(v.sessions, 0) sessions, coalesce(v.scored, 0) scored, coalesce(v.signups, 0) signups, coalesce(v.shared, 0) shared,
      (select p.title from public.social_posts p where (p.platform = l.post_platform and p.post_id = l.post_id) or p.code = l.code limit 1) post_title
    from public.short_links l left join c on c.code = l.code left join v on v.code = l.code
  ) x;
  return res;
end $$;

ALTER FUNCTION "public"."admin_links"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_links_detail"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650)); a timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', d,
    'per', coalesce((select jsonb_object_agg(code, to_jsonb(x) - 'code') from (
        select l.code, (select count(*) from public.link_clicks c where c.code = l.code and c.at >= a) clicks,
          (select count(distinct session) from public.events_real e where e.props->'src'->>'ux' = l.code and e.created_at >= a and e.session is not null) sessions,
          (select count(distinct session) from public.events_real e where e.props->'src'->>'ux' = l.code and e.created_at >= a and e.name = 'flow_step' and e.props->>'step' = 'score') scored
        from public.short_links l) x), '{}'),
    'daily', coalesce((select jsonb_agg(x order by x.t) from (
        select date_trunc('day', at at time zone 'Europe/Budapest') t, code, count(*) n from public.link_clicks where at >= a group by 1, 2) x), '[]'),
    'dims', coalesce((select jsonb_agg(x) from (
        select code, 'country' dim, coalesce(country, '?') k, count(*) n from public.link_clicks where at >= a group by 1, 3
        union all select code, 'device', coalesce(device, '?'), count(*) from public.link_clicks where at >= a group by 1, 3
        union all select code, 'kind', coalesce(kind, '?'), count(*) from public.link_clicks where at >= a group by 1, 3) x), '[]'),
    /* the posts a link can be tied to: the newest of each platform */
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (
        select platform, post_id, created_at, left(title, 90) title, code from (
          select p.*, row_number() over (partition by platform order by created_at desc nulls last) rn from public.social_posts p) y where rn <= 60) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_links_detail"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_live"("p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'live', (select coalesce(jsonb_agg(x), '[]') from (
      select created_at, name, props - 'src' props, props->'src' src, path, lang, right(session, 6) s, right(session, 12) sid
      from public.admin_events(p_ch, p_lang) order by created_at desc limit 80) x),
    'live_now', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '5 minutes'),
    'live_hour', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '1 hour'),
    'per_min', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by g.m), '[]') from generate_series(0, 29) g(m)
      left join (select floor(extract(epoch from now() - created_at) / 60)::int m, count(*) n from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '30 minutes' group by 1) c on c.m = 29 - g.m),
    'today', public.admin_period(date_trunc('day', now() at time zone tz) at time zone tz, now(), p_ch, p_lang),
    'clicks', coalesce((select jsonb_agg(x) from (select c.code, c.at, c.country, c.device, l.source, l.note,
        (select p.title from public.social_posts p where (p.platform = l.post_platform and p.post_id = l.post_id) or p.code = c.code limit 1) title
      from public.link_clicks c join public.short_links l on l.code = c.code where c.at > now() - interval '60 minutes' order by c.at desc limit 30) x), '[]'),
    'clicks_today', (select count(*) from public.link_clicks where at >= date_trunc('day', now() at time zone tz) at time zone tz),
    'codes', coalesce((select jsonb_object_agg(k.code, jsonb_build_object('platform', coalesce(p.platform, l.post_platform, l.source), 'title', coalesce(p.title, l.note)))
      from (select distinct props->'src'->>'ux' code from public.admin_events(p_ch, p_lang) where created_at > now() - interval '3 hours' and props->'src' ? 'ux') k
      join public.short_links l on l.code = k.code
      left join lateral (select platform, title from public.social_posts p where (p.platform = l.post_platform and p.post_id = l.post_id) or p.code = l.code limit 1) p on true), '{}'),
    'bots', coalesce((select jsonb_agg(right(b.session, 6)) from public.admin_bot_sessions b where b.marked_at > now() - interval '2 days'), '[]'),
    'generated_at', now());
end $$;

ALTER FUNCTION "public"."admin_live"("p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_live_posts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.gain_h desc nulls last, x.views desc nulls last) from (
    select p.platform, p.post_id, p.title, p.url, p.thumb, p.views, p.likes, p.comments, p.created_at, p.updated_at,
      p.views - (select h.views from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.at <= now() - interval '1 hour' order by h.at desc limit 1) gain_h,
      p.views - (select h.views from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.at <= now() - interval '24 hours' order by h.at desc limit 1) gain_d,
      (select jsonb_agg(h.views order by h.at) from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.at > now() - interval '24 hours') hourly
    from public.social_posts p
    where p.created_at > now() - interval '30 days' or exists (select 1 from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.at > now() - interval '6 hours')
    order by p.created_at desc nulls last limit 120) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_live_posts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_mark_bots"("p_from" timestamp with time zone, "p_to" timestamp with time zone DEFAULT ("now"() - '00:30:00'::interval)) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  with s as (
    select e.session, min(e.created_at) t0, max(e.created_at) t1, count(*) n,
      (array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1] src,
      (array_agg(e.path order by e.created_at))[1] p0, (array_agg(e.lang order by e.created_at))[1] lg,
      bool_and(e.name = 'landing_view') only_land, bool_and(e.name in ('app_open', 'flow_step')) only_app,
      bool_or(e.name = 'app_open') app, bool_or(e.name = 'flow_step') step,
      bool_and(e.path in ('/privacy', '/terms', '/fiok-torlese', '/adatbiztonsag', '/jog', '/suti')) legal,
      bool_and(e.path in ('/belepes', '/regisztracio', '/elfelejtett-jelszo')) auth,
      md5(string_agg(distinct e.name || coalesce(':' || (e.props->>'step'), ''), ',')) bag
    from public.events e
    where e.session is not null and e.created_at >= p_from - interval '1 day'
      and not exists (select 1 from public.admin_bot_sessions b where b.session = e.session)
      and not exists (select 1 from public.admin_own_sessions o where o.session = e.session)
    group by e.session
    having min(e.created_at) >= p_from and max(e.created_at) < p_to
      and not exists (select 1 from public.events o where o.session = e.session and o.created_at < p_from - interval '1 day')),
  pairs as (
    select a.session from s a join s b on a.session <> b.session and a.n = 1 and b.n = 1 and a.only_land and b.only_land
      and public.admin_nosrc(a.src) and public.admin_nosrc(b.src) and a.p0 = b.p0 and coalesce(a.p0, '') <> '/app'
      and coalesce(a.lg, '') = coalesce(b.lg, '') and abs(extract(epoch from a.t0 - b.t0)) < 60),
  bursts as (
    select session from (select session, count(*) over (partition by date_trunc('minute', t0)) c from s where n = 1 and only_land and public.admin_nosrc(src)) x where c >= 4),
  scripted as (
    select session from s where n between 31 and 33 and public.admin_nosrc(src) and t1 - t0 < interval '200 seconds'
      and bag in ('f83a49e507a372f2e58bf6b91e2d61eb', 'c3a6bad7bcbdaa6ade5c0c2680450514')),
  flashes as (
    select session from s where only_app and app and step and n = 2 and t1 - t0 <= interval '1 second' and public.admin_nosrc(src)),
  legal as (
    select session, t0 from s where n <= 2 and only_land and legal and public.admin_nosrc(src)),
  review as (
    select x.session from s x where x.n <= 2 and not x.legal and public.admin_nosrc(x.src)
      and (exists (select 1 from legal l where abs(extract(epoch from x.t0 - l.t0)) < 180)
        or exists (select 1 from public.admin_bot_sessions b join public.events e on e.session = b.session
          where b.reason = 'legal check' and e.created_at between x.t0 - interval '3 minutes' and x.t0 + interval '3 minutes'))),
  authc as (
    select session from s where only_land and auth and n >= 2 and t1 - t0 < interval '3 seconds' and public.admin_nosrc(src))
  insert into public.admin_bot_sessions (session, reason)
  select session, 'crawler pair' from pairs
  union select session, 'speed test burst' from bursts
  union select session, 'scripted run' from scripted
  union select session, 'app flash' from flashes
  union select session, 'legal check' from legal
  union select session, 'store review' from review
  union select session, 'auth crawl' from authc
  on conflict (session) do nothing;
  get diagnostics k = row_count;
  return k;
end $$;

ALTER FUNCTION "public"."admin_mark_bots"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_mark_own"("p_session" "text", "p_on" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d0 date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false); end if;
  if p_on then insert into public.admin_own_sessions (session) values (left(p_session, 80)) on conflict do nothing;
  else delete from public.admin_own_sessions where session = p_session; end if;
  select (min(created_at) at time zone 'Europe/Budapest')::date into d0 from public.events where session = p_session;
  if d0 is not null then perform public.admin_rollup(d0); end if;
  return jsonb_build_object('ok', true, 'count', (select count(*) from public.admin_own_sessions));
end $$;

ALTER FUNCTION "public"."admin_mark_own"("p_session" "text", "p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_mark_own_short"("p_short" "text", "p_on" boolean DEFAULT true, "p_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare s text; k int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_short, '')) < 6 then return jsonb_build_object('ok', false); end if;
  select count(distinct session) into k from public.events where right(session, length(p_short)) = p_short and created_at > now() - interval '30 days';
  if k > 1 and p_at is null then return jsonb_build_object('ok', false, 'ambiguous', true); end if;
  /* with several, the visit that has an event closest to the moment shown */
  select session into s from public.events where right(session, length(p_short)) = p_short and created_at > now() - interval '30 days'
    order by case when p_at is null then 0 else abs(extract(epoch from created_at - p_at)) end, created_at desc limit 1;
  if s is null then return jsonb_build_object('ok', false); end if;
  return public.admin_mark_own(s, p_on);
end $$;

ALTER FUNCTION "public"."admin_mark_own_short"("p_short" "text", "p_on" boolean, "p_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_markets"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_days integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  last date := (select max(day) from public.gsc_daily);
  /* each store source ends on its own last reported day (they come 1–3 days late), as Google does above */
  a_dl date := coalesce((select max(day) from public.store_daily where store = 'apple'), public.admin_today()) - v_days;
  a_play date := coalesce((select max(day) from public.store_metrics where store = 'google' and metric = 'installs' and dim = 'country'), public.admin_today()) - v_days;
  a_imp date := coalesce((select max(day) from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = 'territory'), public.admin_today()) - v_days;
  a_pv date := coalesce((select max(day) from public.store_metrics where store = 'apple' and metric = 'page_views' and dim = 'territory'), public.admin_today()) - v_days;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('days', v_days,
    'acc_langs', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(left(coalesce(m.lang, m.slang), 2), '?') k, count(*) n from public.admin_signups_matched(now() - make_interval(days => v_days), now() + interval '1 minute') m group by 1) x), '[]'),
    'gsc', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select country k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where day > coalesce(last, public.admin_today()) - v_days group by 1) x), '[]'),
    'apple_dl', coalesce((select jsonb_agg(x order by x.n desc) from (
      select country k, sum(downloads) n from public.store_daily where store = 'apple' and day > a_dl and country <> '' group by 1) x), '[]'),
    'play_dl', coalesce((select jsonb_agg(x order by x.n desc) from (
      select k, sum(n) n from public.store_metrics where store = 'google' and metric = 'installs' and dim = 'country' and day > a_play group by 1) x), '[]'),
    'apple_imp', coalesce((select jsonb_agg(x order by x.n desc) from (
      select k, sum(n) n from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = 'territory' and day > a_imp group by 1) x), '[]'),
    'apple_pv', coalesce((select jsonb_agg(x order by x.n desc) from (
      select k, sum(n) n from public.store_metrics where store = 'apple' and metric = 'page_views' and dim = 'territory' and day > a_pv group by 1) x), '[]'),
    'audience', coalesce((select jsonb_agg(x order by x.platform, x.n desc) from (
      select distinct on (platform, k) platform, k, n from public.social_audience where breakdown = 'country' order by platform, k, updated_at desc) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_markets"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_monitor"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'uptime', coalesce((select jsonb_agg(x order by x.target) from (
      select u.target, (select label from public.uptime_targets t where t.url = u.target) label, coalesce((select on_ from public.uptime_targets t where t.url = u.target), false) on_,
        st.since,
        count(*) filter (where u.done and u.at >= st.since) n, /* a failed probe counts as up when the server's own check reached the address within 3 minutes (the 'down' alert's rule) */
        count(*) filter (where u.done and u.at >= st.since and (u.ok or exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes'))) up,
        (select round(avg(s.ms))::int from public.uptime_checks s where s.target = u.target and s.via = 'server' and s.ok and s.at > now() - interval '30 days') avg_ms,
        (select round((percentile_cont(0.95) within group (order by s.ms))::numeric)::int from public.uptime_checks s where s.target = u.target and s.via = 'server' and s.ok and s.at > now() - interval '30 days') p95_ms,
        (select count(*) from public.uptime_checks s where s.target = u.target and s.via = 'server' and s.at > now() - interval '30 days') ms_n,
        (select jsonb_build_object('at', at, 'ok', ok or exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u2.target and s.at between u2.at - interval '3 minutes' and u2.at + interval '3 minutes'), 'status', status, 'ms', (select s.ms from public.uptime_checks s where s.target = u.target and s.via = 'server' order by s.at desc limit 1))
          from public.uptime_checks u2 where u2.target = u.target and u2.done and u2.via = 'pg_net' order by at desc limit 1) last,
        (select max(at) from public.uptime_checks u3 where u3.target = u.target and u3.done and not u3.ok and u3.via = 'pg_net' and u3.at >= st.since
          and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u3.target and s.at between u3.at - interval '3 minutes' and u3.at + interval '3 minutes')) last_down,
        coalesce((select jsonb_agg(jsonb_build_object('from', s.a, 'to', s.b, 'n', s.k) order by s.a desc) from (
          select min(at) a, max(at) b, count(*) k from (select at, ok, sum(case when ok then 1 else 0 end) over (order by at) grp from (select u5.at, u5.target, u5.done, u5.via, (u5.ok or exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u5.target and s.at between u5.at - interval '3 minutes' and u5.at + interval '3 minutes')) ok
              from public.uptime_checks u5) u4
            where u4.target = u.target and u4.done and u4.via = 'pg_net' and u4.at >= st.since) z where not ok group by grp order by 1 desc limit 20) s), '[]') downs
      from public.uptime_checks u
      join lateral (select greatest(now() - interval '30 days', coalesce((select min(f.at) from public.uptime_checks f where f.target = u.target and f.via = 'pg_net' and f.ok), now())) since) st on true
      where u.at > now() - interval '30 days' and u.via = 'pg_net' group by u.target, st.since) x), '[]'),
    'uptime_since', (select min(f.at) from public.uptime_checks f where f.via = 'pg_net' and f.ok and f.at > now() - interval '30 days'),
    'targets', coalesce((select jsonb_agg(to_jsonb(t) order by t.url) from public.uptime_targets t), '[]'),
    'heartbeat', (select max(at) from public.uptime_checks where via = 'pg_net'),
    'uptime_days', coalesce((select jsonb_agg(x order by x.day) from (select (at at time zone 'Europe/Budapest')::date as day, count(*) filter (where done and via = 'pg_net') n,
        count(*) filter (where done and via = 'pg_net' and (ok or exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = uc.target and s.at between uc.at - interval '3 minutes' and uc.at + interval '3 minutes'))) up,
        round(avg(ms) filter (where ok and via = 'server'))::int ms
        from public.uptime_checks uc where at > now() - interval '30 days' group by 1) x), '[]'),
    'failing', public.admin_jobs_failing(),
    'cron', coalesce((select jsonb_agg(x order by x.jobname) from (
      select j.jobname, j.schedule, j.active, substring(j.command from 'admin_cron_call\(''([^'']+)''\)') path,
        (select jsonb_build_object('status', d.status, 'start', d.start_time, 'end', d.end_time, 'msg', left(d.return_message, 160)) from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) last,
        (select jsonb_build_object('at', c.at, 'status', c.status, 'timed_out', c.timed_out, 'error', c.error, 'done', c.done, 'via', c.via) from public.admin_cron_calls c
          where c.path = substring(j.command from 'admin_cron_call\(''([^'']+)''\)') order by c.at desc limit 1) http,
        (select jsonb_build_object('started_at', r.started_at, 'finished_at', r.finished_at, 'ok', r.ok, 'message', r.message, 'via', r.via) from public.admin_runs r
          where r.job = substring(j.command from 'admin_cron_call\(''([^'']+)''\)') order by r.started_at desc limit 1) run,
        case j.jobname when 'admin-rollup-week' then (select at from public.admin_rollup_state where k = 'week')
          when 'admin-rollup' then (select at from public.admin_rollup_state where k = 'recent')
          when 'admin-uptime' then (select max(at) from public.uptime_checks where via = 'pg_net') end done_at,
        (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status <> 'succeeded' and d.start_time > now() - interval '7 days')
          + (select count(*) from public.admin_cron_calls c where c.path = substring(j.command from 'admin_cron_call\(''([^'']+)''\)') and c.done and c.at > now() - interval '7 days'
               and (c.timed_out or c.status is null or c.status not between 200 and 299))
          + (select count(*) from public.admin_runs r where r.job = substring(j.command from 'admin_cron_call\(''([^'']+)''\)') and r.via = 'cron' and r.ok = false and r.started_at > now() - interval '7 days') fails_7d,
        (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '7 days') runs_7d
      from cron.job j where j.jobname like 'admin-%') x), '[]'),
    'runs', coalesce((select jsonb_agg(x order by x.started_at desc) from (select r.id, r.job,
        case when r.via = 'cron' and exists (select 1 from public.admin_cron_calls c where c.via = 'admin' and c.path = r.job and r.started_at between c.at and c.at + interval '3 minutes') then 'admin' else r.via end via,
        r.started_at, r.finished_at, r.ok, left(r.message, 300) message from public.admin_runs r
        where r.job not like '%only=rules%' or r.ok = false order by r.started_at desc limit 60) x), '[]'),
    'syncs', coalesce((select jsonb_agg(x order by x.source) from (
      select source, max(at) filter (where ok) last_ok, max(at) filter (where not ok) last_err,
        (array_agg(message order by at desc) filter (where not ok))[1] err_msg, (array_agg(ok order by at desc))[1] last_state,
        count(*) filter (where ok and at > now() - interval '7 days') ok_7d, count(*) filter (where not ok and at > now() - interval '7 days') err_7d,
        (array_agg(rows order by at desc) filter (where ok))[1] last_rows
      from public.sync_log where at > now() - interval '30 days' and source <> 'ai' group by source) x), '[]'),
    'server_errors', coalesce((select jsonb_agg(x order by x.last desc) from (
      select source, left(message, 300) msg, count(*) n, max(at) last, min(at) first from public.sync_log where not ok and at > now() - interval '14 days' group by 1, 2
      union all
      select 'futás: ' || job, left(message, 300), count(*), max(started_at), min(started_at) from public.admin_runs where ok = false and started_at > now() - interval '14 days' group by 1, 2) x), '[]'),
    'quota', jsonb_build_object(
      'cse_today', (select count(*) from public.cse_ranks where day = public.admin_today()),
      'youtube_syncs_today', (select count(*) from public.sync_log where source = 'youtube' and at > date_trunc('day', now())),
      'ai_tokens_30d', (select coalesce(sum(rows), 0) from public.sync_log where source = 'ai' and ok and at > now() - interval '30 days'),
      'ai_in_30d', (select coalesce(sum((substring(message from 'in:(\d+)'))::bigint), 0) from public.sync_log where source = 'ai' and ok and at > now() - interval '30 days'),
      'ai_today', (select count(*) from public.sync_log where source = 'ai' and at > date_trunc('day', now()))),
    'push', jsonb_build_object(
      'devices', coalesce((select jsonb_agg(jsonb_build_object('ua', left(ua, 80), 'last_ok', last_ok, 'fails', fails, 'created_at', created_at)) from public.admin_push_subs), '[]'),
      'sent_7d', (select count(*) from public.admin_push_sent where at > now() - interval '7 days')),
    'certs', coalesce((select jsonb_agg(to_jsonb(c)) from public.cert_status c), '[]'),
    'errors', coalesce((select jsonb_agg(x order by x.last desc) from (
      select fp, max(name) name, max(msg) msg, max(where_) where_, count(*) n, count(distinct session) people, min(created_at) first, max(created_at) last,
        coalesce((select g.state from public.error_groups g where g.fp = e.fp), 'open') state, (select g.resolved_at from public.error_groups g where g.fp = e.fp) resolved_at,
        (select g.note from public.error_groups g where g.fp = e.fp) note, (select g.ai from public.error_groups g where g.fp = e.fp) ai, (select g.ai_at from public.error_groups g where g.fp = e.fp) ai_at,
        exists (select 1 from public.error_groups g where g.fp = e.fp and g.state = 'resolved' and max(e.created_at) > g.resolved_at) regressed,
        (array_agg(session order by created_at desc))[1] last_session, max(path) path,
        to_jsonb((array_agg(session order by created_at desc))[1:8]) sessions, to_jsonb((array_agg(created_at order by created_at desc))[1:8]) times,
        jsonb_agg(distinct coalesce(ua, '?')) uas
      from (select md5(name || '|' || coalesce(props->>'provider', props->>'where', '') || '|' || left(regexp_replace(coalesce(props->>'why', props->>'msg', ''), '[0-9a-f]{6,}|\d+', '#', 'g'), 120)) fp,
              name, left(coalesce(props->>'why', props->>'msg', ''), 300) msg, coalesce(props->>'provider', props->>'where', '') where_, session, created_at, path, props->>'ua' ua
            from public.events_real where name in ('client_error', 'storage_full', 'signin_failed', 'auth_error') and created_at > now() - interval '60 days') e
      group by fp) x), '[]'),
    'releases', coalesce((select jsonb_agg(x order by x.at desc) from (select * from public.admin_releases order by at desc limit 20) x), '[]'),
    'slow', coalesce((select jsonb_agg(x) from (select left(regexp_replace(query, '\s+', ' ', 'g'), 180) q, calls, round(mean_exec_time::numeric, 1) mean_ms, round(total_exec_time::numeric) total_ms
        from extensions.pg_stat_statements where query not ilike '%pg_stat_statements%' order by mean_exec_time desc limit 12) x), '[]'),
    'tables', coalesce((select jsonb_agg(x) from (select relname t, pg_total_relation_size(c.oid) bytes, reltuples::bigint rows from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 2 desc limit 12) x), '[]'),
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'ai_calls_30d', (select count(*) from public.sync_log where source = 'ai' and at > now() - interval '30 days'),
    'email', coalesce((select jsonb_agg(x) from (select type, count(*) n, max(at) last from public.email_events where at > now() - interval '30 days' group by 1 order by 2 desc) x), '[]'),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.alert_rules r), '[]'));
end $$;

ALTER FUNCTION "public"."admin_monitor"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_norm_post_url"("u" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select regexp_replace(public.admin_norm_url(u), '^instagram\.com/(?:[^/]+/)?(?:p|reel|reels|tv)/', 'instagram.com/p/')
$$;

ALTER FUNCTION "public"."admin_norm_post_url"("u" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_norm_url"("u" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  select nullif(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(u, '')), '^https?://(www\.|m\.)?', ''), '[?#].*$', ''), '/+$', ''), '')
$_$;

ALTER FUNCTION "public"."admin_norm_url"("u" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_nosrc"("src" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select src is null or (src - 'land') = '{}'::jsonb
$$;

ALTER FUNCTION "public"."admin_nosrc"("src" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_delete"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.admin_notes where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_note_delete"("p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_save"("p_day" "date", "p_kind" "text", "p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_notes (day, kind, text) values (p_day, coalesce(nullif(p_kind, ''), 'egyeb'), left(trim(p_text), 200));
end $$;

ALTER FUNCTION "public"."admin_note_save"("p_day" "date", "p_kind" "text", "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_update"("p_id" bigint, "p_day" "date", "p_kind" "text", "p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_notes set day = coalesce(p_day, day), kind = coalesce(nullif(p_kind, ''), kind), text = coalesce(nullif(left(trim(p_text), 200), ''), text) where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_note_update"("p_id" bigint, "p_day" "date", "p_kind" "text", "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_user_delete"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare u text := (select user_id::text from public.admin_user_notes where id = p_id);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.admin_user_notes where id = p_id;
  perform public.admin_audit_add('jegyzet.torles', u, '{}');
end $$;

ALTER FUNCTION "public"."admin_note_user_delete"("p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_user_done"("p_id" bigint, "p_done" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_user_notes set done_at = case when p_done then now() end, updated_at = now() where id = p_id;
  perform public.admin_audit_add(case when p_done then 'jegyzet.kesz' else 'jegyzet.ujranyitas' end, (select user_id::text from public.admin_user_notes where id = p_id), '{}');
end $$;

ALTER FUNCTION "public"."admin_note_user_done"("p_id" bigint, "p_done" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_note_user_save"("p_user" "uuid", "p_body" "text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_follow" "date" DEFAULT NULL::"date", "p_id" bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v bigint; t text[] := (select coalesce(array_agg(distinct lower(regexp_replace(x, '^#', ''))) filter (where trim(x) <> ''), '{}') from unnest(coalesce(p_tags, '{}')) x);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(coalesce(p_body, '')) > 1000 then raise exception 'A jegyzet legfeljebb 1000 karakter.'; end if;
  if p_id is null then
    insert into public.admin_user_notes (user_id, body, tags, follow_up) values (p_user, coalesce(p_body, ''), t, p_follow) returning id into v;
  else
    update public.admin_user_notes set body = coalesce(p_body, ''), tags = t, follow_up = p_follow, updated_at = now() where id = p_id returning id into v;
  end if;
  perform public.admin_audit_add(case when p_id is null then 'jegyzet.uj' else 'jegyzet.modositas' end, p_user::text, jsonb_build_object('címkék', t, 'visszakeresés', p_follow));
  return v;
end $$;

ALTER FUNCTION "public"."admin_note_user_save"("p_user" "uuid", "p_body" "text", "p_tags" "text"[], "p_follow" "date", "p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_notes_list"("p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.day desc, x.id desc) from (
    select id, day, kind, text, created_at from public.admin_notes
    where (p_from is null or day >= p_from) and (p_to is null or day <= p_to) order by day desc limit 300) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_notes_list"("p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_own_account_set"("p_email" "text", "p_on" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare e text := lower(trim(coalesce(p_email, ''))); d0 date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid e-mail'; end if;
  if p_on then
    insert into public.admin_own_accounts (email) values (e) on conflict do nothing;
    insert into public.admin_own_sessions (session)
      select distinct left(ev.session, 80) from public.events ev join auth.users u on u.id = ev.user_id where lower(u.email) = e and ev.session is not null on conflict do nothing;
  else
    delete from public.admin_own_accounts where email = e;
    /* the sessions this account marked, unless another of her accounts was signed in on them too */
    delete from public.admin_own_sessions o where o.session in (
      select left(ev.session, 80) from public.events ev join auth.users u on u.id = ev.user_id where lower(u.email) = e and ev.session is not null)
      and not exists (select 1 from public.events ev2 where left(ev2.session, 80) = o.session and ev2.user_id is not null and public.admin_own_uid(ev2.user_id));
  end if;
  select (min(ev.created_at) at time zone 'Europe/Budapest')::date into d0 from public.events ev join auth.users u on u.id = ev.user_id where lower(u.email) = e;
  if d0 is not null then perform public.admin_rollup(d0); end if;
end $_$;

ALTER FUNCTION "public"."admin_own_account_set"("p_email" "text", "p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_own_accounts_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('admin', coalesce((select jsonb_agg(email) from public.admin_emails), '[]'),
    'extra', coalesce((select jsonb_agg(email order by created_at) from public.admin_own_accounts), '[]'));
end $$;

ALTER FUNCTION "public"."admin_own_accounts_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_own_events_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.user_id is not null and new.session is not null and public.admin_own_uid(new.user_id) then
    insert into public.admin_own_sessions (session) values (left(new.session, 80)) on conflict do nothing;
  end if;
  return new;
end $$;

ALTER FUNCTION "public"."admin_own_events_trg"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_own_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('s', right(o.session, 6), 'at', o.at,
      'events', (select count(*) from public.events e where e.session = o.session),
      'first', (select min(created_at) from public.events e where e.session = o.session)) order by o.at desc)
    from public.admin_own_sessions o), '[]');
end $$;

ALTER FUNCTION "public"."admin_own_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_own_uid"("p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p_uid is not null and (exists (select 1 from public.admins where user_id = p_uid)
    or exists (select 1 from auth.users u where u.id = p_uid and (lower(u.email) in (select email from public.admin_emails) or lower(u.email) in (select email from public.admin_own_accounts))))
$$;

ALTER FUNCTION "public"."admin_own_uid"("p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_partners"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.sessions desc) from (
    with l as (select code, coalesce(nullif(campaign, ''), note, code) partner from public.short_links where medium = 'partner'),
    s as (select l.partner, e.session, bool_or(e.name = 'flow_step' and e.props->>'step' = 'score') scored, bool_or(e.name = 'signup') signed
          from public.events_real e join l on l.code = e.props->'src'->>'ux' where e.session is not null group by 1, 2)
    select l.partner, count(distinct l.code) links,
      (select count(*) from public.link_clicks c where c.code in (select l2.code from l l2 where l2.partner = l.partner)) clicks,
      (select count(*) from s where s.partner = l.partner) sessions, (select count(*) from s where s.partner = l.partner and s.scored) scored,
      (select count(*) from s where s.partner = l.partner and s.signed) signups
    from l group by l.partner) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_partners"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_people"("p_q" "text" DEFAULT ''::"text", "p_filter" "text" DEFAULT 'all'::"text", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0, "p_lang" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT NULL::"text", "p_ch" "text" DEFAULT NULL::"text", "p_sort" "text" DEFAULT 'created'::"text", "p_days" integer DEFAULT NULL::integer, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%'; res jsonb; r record; ranged boolean := p_days is not null or p_from is not null;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(coalesce(p_days, 0), p_from, p_to);
  with f0 as (select * from public.admin_user_facts()),
  fp as (select * from f0 where not ranged or (created_at >= r.a and created_at < r.b)),
  f as (
    select * from fp where (own = (p_filter = 'own'))
      and (lower(coalesce(email, '')) like q or lower(coalesce(name, '')) like q or id::text like q)
      and case when p_filter like 'tag:%' then substr(p_filter, 5) = any(tags)
        when p_filter in ('uj', 'probalgatja', 'aktiv', 'veszelyben', 'alvo') then stage = p_filter
        when p_filter = 'churn' then churn
        when p_filter = 'stuck' then stuck
        when p_filter = 'followup' then follow_up is not null and follow_up <= public.admin_today()
        when p_filter = 'online' then online
        when p_filter = 'unconfirmed' then not confirmed
        when p_filter = 'unlocked' then unl_all > 0
        when p_filter = 'banned' then banned
        else true end
      and (p_lang is null or left(coalesce(lang, ''), 2) = left(p_lang, 2))
      and (p_provider is null or provider = p_provider)
      and (p_ch is null or coalesce(ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
  ),
  pg as (select * from f order by case p_sort when 'score' then -score when 'active' then -extract(epoch from last_active_at) else -extract(epoch from created_at) end
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'own', (select count(*) from fp where own),
    'counts', (select jsonb_build_object('uj', count(*) filter (where stage = 'uj'), 'probalgatja', count(*) filter (where stage = 'probalgatja'),
        'aktiv', count(*) filter (where stage = 'aktiv'), 'veszelyben', count(*) filter (where stage = 'veszelyben'), 'alvo', count(*) filter (where stage = 'alvo'),
        'churn', count(*) filter (where churn), 'stuck', count(*) filter (where stuck), 'online', count(*) filter (where online),
        'followup', count(*) filter (where follow_up is not null and follow_up <= public.admin_today()), 'banned', count(*) filter (where banned),
        'avg_score', round(avg(score))) from fp where not own),
    'tags', coalesce((select jsonb_agg(x order by x.n desc) from (select t k, count(*) n from fp, unnest(fp.tags) t where not fp.own group by 1) x), '[]'),
    'rows', coalesce((select jsonb_agg(to_jsonb(pg) || jsonb_build_object(
        'visit', public.admin_visit((select m.session from public.admin_signups_matched(pg.created_at, pg.created_at + interval '1 microsecond') m where m.user_id = pg.id limit 1)),
        'celeb', public.admin_celeb_use(pg.id))
      order by case p_sort when 'score' then -pg.score when 'active' then -extract(epoch from pg.last_active_at) else -extract(epoch from pg.created_at) end) from pg), '[]'))
  into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_people"("p_q" "text", "p_filter" "text", "p_limit" integer, "p_offset" integer, "p_lang" "text", "p_provider" "text", "p_ch" "text", "p_sort" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_people_today"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.prio, x.score desc) from (
    select f.id, f.email, f.name, f.lang, f.score, f.stage, f.last_active_at, f.created_at, f.unl_all, f.tags, f.follow_up,
      case when f.follow_up is not null and f.follow_up <= public.admin_today() then 'followup' when f.churn then 'churn' else 'stuck' end why,
      case when f.follow_up is not null and f.follow_up <= public.admin_today() then 1 when f.churn then 2 else 3 end prio
    from public.admin_user_facts() f
    where not f.own and not f.banned and ((f.follow_up is not null and f.follow_up <= public.admin_today()) or f.churn or f.stuck)
    limit 30) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_people_today"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_period"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with s as (
    select session,
      bool_or(name = 'landing_view') land, bool_or(name = 'app_open') app,
      bool_or(name = 'signature_captured' or (name = 'quiz_answer' and props->>'step' = 'sign' and coalesce(props->>'value', '') <> 'skipped')) captured,
      bool_or(name = 'flow_step' and props->>'step' = 'score') scored,
      bool_or(name = 'reveal_shown') revealed, bool_or(name = 'paywall_shown') paywall,
      bool_or(name = 'purchase') bought,
      bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared
    from public.admin_events(p_ch, p_lang) where created_at >= a and created_at < b and session is not null group by session
  )
  select jsonb_build_object(
    'sessions', (select count(*) from s),
    'landing', (select count(*) from s where land),
    'app', (select count(*) from s where app),
    'captured', (select count(*) from s where captured),
    'scored', (select count(*) from s where scored),
    'revealed', (select count(*) from s where revealed),
    'paywall', (select count(*) from s where paywall),
    'bought', (select count(*) from s where bought),
    'shared', (select count(*) from s where shared),
    'scored_shared', (select count(*) from s where scored and shared),
    'events', (select count(*) from public.admin_events(p_ch, p_lang) where created_at >= a and created_at < b),
    'errors', (select count(*) from public.admin_events(p_ch, p_lang) where created_at >= a and created_at < b and name in ('client_error','storage_full','signin_failed','auth_error')),
    /* an account keeps no channel or language: in a filtered view the number is unknown, not the unfiltered total */
    'signups', case when p_ch is null and p_lang is null then (select count(*) from public.admin_real_users u where u.created_at >= a and u.created_at < b) end,
    'confirmed', case when p_ch is null and p_lang is null then (select count(*) from public.admin_real_users u where u.created_at >= a and u.created_at < b and (u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider' <> 'email')) end,
    'active_users', case when p_ch is null and p_lang is null then (select count(*) from public.admin_real_users u where u.last_sign_in_at >= a and u.last_sign_in_at < b) end,
    'unlocks', case when p_ch is null and p_lang is null then (select count(*) from public.admin_real_unlocks where created_at >= a and created_at < b) end
  )
$$;

ALTER FUNCTION "public"."admin_period"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_pf_guess"("src" "jsonb", "pf" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select coalesce(nullif(pf, ''), case when coalesce(src->>'land', '') like '/app%' and not (coalesce(src, '{}'::jsonb) ?| array['from', 'us', 'ref', 'uc', 'ux']) then 'android' else 'web' end)
$$;

ALTER FUNCTION "public"."admin_pf_guess"("src" "jsonb", "pf" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_delete"("p_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.content_plans where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_plan_delete"("p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_media_clear"("p_ids" bigint[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.content_plans set media_url = null, media_path = null, updated_at = now() where id = any (p_ids);
end $$;

ALTER FUNCTION "public"."admin_plan_media_clear"("p_ids" bigint[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_media_old"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'path', media_path)) from public.content_plans
    where media_path is not null and ((published_at is not null and published_at < now() - interval '7 days') or (status = 'kint' and day < public.admin_today() - 7))), '[]');
end $$;

ALTER FUNCTION "public"."admin_plan_media_old"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_move"("p_id" bigint, "p_day" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.content_plans set day = p_day, updated_at = now() where id = p_id and published_at is null;
end $$;

ALTER FUNCTION "public"."admin_plan_move"("p_id" bigint, "p_day" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_posts"("p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'posts', coalesce((select jsonb_agg(x order by x.created_at) from (
      select p.platform, p.post_id, p.created_at, p.kind, p.title, p.url, p.thumb, p.views, p.likes, p.comments, p.saves, p.shares,
        coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) code
      from public.social_posts p
      where p.created_at >= p_from::timestamp at time zone 'Europe/Budapest' and p.created_at < (p_to + 1)::timestamp at time zone 'Europe/Budapest'
      order by p.created_at limit 3000) x), '[]'),
    'competitor', coalesce((select jsonb_agg(x) from (select domain, title, url, first_seen from public.competitor_pages where title is not null and first_seen > public.admin_today() - 30 order by first_seen desc limit 12) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_plan_posts"("p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plan_save"("p" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare r public.content_plans; c text := nullif(left(p->>'code', 40), ''); cs jsonb := coalesce(p->'codes', '{}'); pf text; nx int;
  st text := coalesce(nullif(p->>'status', ''), 'terv');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(cs) <> 'object' then cs := '{}'; end if;
  /* an idea gets no link yet; a plan gets one per platform (the next free numbers), so every visitor lands on the
     platform that brought them. A link typed by hand stays one link for all. */
  if cs <> '{}'::jsonb or (c is null and st not in ('otlet', 'forgatokonyv', 'felvetel', 'vagas') and coalesce((p->>'autolink')::boolean, false)) then
    if st not in ('otlet', 'forgatokonyv', 'felvetel', 'vagas') then
      for pf in select jsonb_array_elements_text(coalesce(p->'platforms', '[]')) loop
        continue when cs ? pf;
        nx := (select coalesce(max(code::int), 0) + 1 from public.short_links where code ~ '^\d{1,9}$');
        insert into public.short_links (code, target, source, medium, campaign, note) values (nx::text, '/app?guest=1', pf, 'social', 'terv', left(p->>'title', 120)) on conflict (code) do nothing;
        cs := cs || jsonb_build_object(pf, nx::text);
      end loop;
    end if;
    c := coalesce(cs->>(p->'platforms'->>0), c);
  else cs := '{}';
  end if;
  if (p->>'id') is not null then
    update public.content_plans set day = (p->>'day')::date, at = nullif(p->>'at', '')::time, platforms = coalesce(array(select jsonb_array_elements_text(p->'platforms')), '{}'),
      title = left(p->>'title', 200), caption = left(p->>'caption', 3000), code = c, codes = cs, status = st, note = left(p->>'note', 1000),
      texts = coalesce(case when jsonb_typeof(p->'texts') = 'object' then p->'texts' end, '{}'), opts = coalesce(case when jsonb_typeof(p->'opts') = 'object' then p->'opts' end, '{}'),
      media_url = nullif(p->>'media_url', ''), media_path = nullif(p->>'media_path', ''), media_kind = nullif(p->>'media_kind', ''), publish = coalesce((p->>'publish')::boolean, false), updated_at = now()
    where id = (p->>'id')::bigint returning * into r;
  else
    insert into public.content_plans (day, at, platforms, title, caption, code, codes, status, note, texts, opts, media_url, media_path, media_kind, publish)
    values ((p->>'day')::date, nullif(p->>'at', '')::time, coalesce(array(select jsonb_array_elements_text(p->'platforms')), '{}'), left(p->>'title', 200), left(p->>'caption', 3000),
      c, cs, st, left(p->>'note', 1000), coalesce(case when jsonb_typeof(p->'texts') = 'object' then p->'texts' end, '{}'), coalesce(case when jsonb_typeof(p->'opts') = 'object' then p->'opts' end, '{}'),
      nullif(p->>'media_url', ''), nullif(p->>'media_path', ''), nullif(p->>'media_kind', ''), coalesce((p->>'publish')::boolean, false)) returning * into r;
  end if;
  return to_jsonb(r);
end $_$;

ALTER FUNCTION "public"."admin_plan_save"("p" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_plans"("p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(p) order by p.day, p.at nulls last) from public.content_plans p where p.day between p_from and p_to), '[]');
end $$;

ALTER FUNCTION "public"."admin_plans"("p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_platform_alerts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest'; today date := (now() at time zone tz)::date;
  out jsonb := '[]'; r record; nm text; v1 numeric; v0 numeric; k int; gd date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select * from public.social_accounts loop
    nm := case r.platform when 'tiktok' then 'TikTok' when 'instagram' then 'Instagram' when 'facebook' then 'Facebook' when 'pinterest' then 'Pinterest' when 'linkedin' then 'LinkedIn' when 'youtube' then 'YouTube' else r.platform end;
    if r.last_error is not null then
      out := out || jsonb_build_object('k', 'pf-error:' || r.platform, 'c', 'bad', 't', nm || ': az adatlehúzás hibára fut', 's', left(r.last_error, 140), 'to', 'connect', 'since', r.last_sync_at);
    elsif r.last_sync_at < now() - interval '6 hours' then
      out := out || jsonb_build_object('k', 'pf-stale:' || r.platform, 'c', 'warn', 't', nm || ': régóta nem frissült', 's', 'Az utolsó sikeres lehúzás ' || to_char(r.last_sync_at at time zone tz, 'MM.DD. HH24:MI') || '.', 'to', 'connect', 'since', r.last_sync_at);
    end if;
    if r.refresh_expires_at is not null and r.refresh_expires_at < now() + interval '14 days' then
      out := out || jsonb_build_object('k', 'pf-expire:' || r.platform, 'c', 'warn', 't', nm || ': a kapcsolat hamarosan lejár', 's', 'Lejár: ' || to_char(r.refresh_expires_at at time zone tz, 'MM.DD.') || '. Kösd be újra a Kapcsolatok oldalon.', 'to', 'connect');
    elsif r.platform in ('linkedin') and r.token_expires_at is not null and r.token_expires_at < now() + interval '7 days' then
      out := out || jsonb_build_object('k', 'pf-expire:' || r.platform, 'c', 'warn', 't', nm || ': a kapcsolat hamarosan lejár', 's', 'Lejár: ' || to_char(r.token_expires_at at time zone tz, 'MM.DD.') || '.', 'to', 'connect');
    end if;
    /* follower loss: a week's drop of at least 2% (and 5 people) */
    select f into v1 from (select followers f from public.social_account_daily where platform = r.platform and followers is not null order by day desc limit 1) z;
    select f into v0 from (select followers f from public.social_account_daily where platform = r.platform and followers is not null and day <= today - 7 order by day desc limit 1) z;
    if v1 is not null and v0 is not null and v0 - v1 >= greatest(5, v0 * 0.02) then
      out := out || jsonb_build_object('k', 'pf-loss:' || r.platform, 'c', 'warn', 't', nm || ': fogynak a követők', 's', '−' || (v0 - v1)::bigint || ' követő 7 nap alatt (' || v0::bigint || ' → ' || v1::bigint || '). Nézd meg, melyik poszt után kezdődött.', 'to', 'audience');
    end if;
  end loop;
  for r in select url, changed_at from public.gsc_index where verdict is distinct from 'PASS' and prev_verdict = 'PASS' and changed_at > now() - interval '7 days' loop
    out := out || jsonb_build_object('k', 'index:' || r.url, 'c', 'bad', 't', 'Kiesett a Google-ből: ' || replace(r.url, 'https://inkage.app', ''), 's', 'Tegnap még indexelve volt. Nézd meg az oldalt, és kérj újraindexelést a Search Console-ban.', 'to', 'search', 'since', r.changed_at);
  end loop;
  select count(*) into k from public.store_reviews where rating <= 2 and reply is null and not done and created_at > now() - interval '14 days';
  if k > 0 then
    out := out || jsonb_build_object('k', 'store-neg', 'c', 'warn', 't', k || ' negatív vélemény vár válaszra', 's', 'Az áruházban mindenki látja: egy kedves válasz sokat számít.', 'to', 'inbox');
  end if;
  /* the stores' average: the last 30 days against the 90 before (at least 3 reviews in each) */
  for r in select store, avg(rating) filter (where created_at > now() - interval '30 days') a1, count(*) filter (where created_at > now() - interval '30 days') n1,
                  avg(rating) filter (where created_at <= now() - interval '30 days') a0, count(*) filter (where created_at <= now() - interval '30 days') n0
           from public.store_reviews where created_at > now() - interval '120 days' and rating is not null group by store loop
    if r.n1 >= 3 and r.n0 >= 3 and r.a0 - r.a1 >= 0.5 then
      out := out || jsonb_build_object('k', 'store-avg:' || r.store, 'c', 'warn', 't', (case r.store when 'apple' then 'App Store' else 'Google Play' end) || ': romlott az értékelés', 's', 'Az elmúlt 30 nap átlaga ' || round(r.a1, 1) || ' csillag, előtte ' || round(r.a0, 1) || '.', 'to', 'stores');
    end if;
  end loop;
  for r in select store, day, n, (select avg(b.n) from public.store_metrics b where b.store = m.store and b.metric = 'crashes' and b.dim = '' and b.day between m.day - 7 and m.day - 1) base
           from public.store_metrics m where metric = 'crashes' and dim = '' and day >= public.admin_today() - 2 loop
    if r.n >= 3 and r.n > 2 * coalesce(r.base, 0) then
      out := out || jsonb_build_object('k', 'crash:' || r.store, 'c', 'bad', 't', 'Összeomlás-hullám: ' || case r.store when 'apple' then 'iOS' else 'Android' end, 's', r.n || ' összeomlás ' || to_char(r.day, 'MM.DD.') || '-n, a szokásos ' || round(coalesce(r.base, 0), 1) || ' helyett.', 'to', 'stores', 'since', r.day);
    end if;
  end loop;
  /* Google clicks: Google's last 7 days against the 7 before */
  gd := (select max(day) from public.gsc_daily);
  if gd is not null then
    select coalesce(sum(clicks) filter (where day > gd - 7), 0), coalesce(sum(clicks) filter (where day <= gd - 7), 0) into v1, v0 from public.gsc_daily where day > gd - 14;
    if v0 >= 20 and v1 < 0.6 * v0 then
      out := out || jsonb_build_object('k', 'gsc-drop', 'c', 'warn', 't', 'Kevesebb Google-kattintás', 's', v1::bigint || ' kattintás a Google utolsó 7 napján, előtte ' || v0::bigint || '. Nézd meg, melyik keresés esett vissza.', 'to', 'search');
    end if;
  end if;
  gd := (select max(day) from public.bing_daily);
  if gd is not null then
    select coalesce(sum(clicks) filter (where day > gd - 7), 0), coalesce(sum(clicks) filter (where day <= gd - 7), 0) into v1, v0 from public.bing_daily where day > gd - 14;
    if v0 >= 10 and v1 < 0.6 * v0 then
      out := out || jsonb_build_object('k', 'bing-drop', 'c', 'warn', 't', 'Kevesebb Bing-kattintás', 's', v1::bigint || ' kattintás az utolsó 7 napon, előtte ' || v0::bigint || '.', 'to', 'seo');
    end if;
  end if;
  for r in select source, max(at) as last_at from public.sync_log where not ok and at > now() - interval '24 hours' group by 1 loop
    if not exists (select 1 from public.sync_log s where s.source = r.source and s.ok and s.at > r.last_at) and r.source not in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') then
      out := out || jsonb_build_object('k', 'sync:' || r.source, 'c', 'warn', 't', case r.source when 'gsc' then 'Google Search Console' when 'gsc_index' then 'Google-indexelés' when 'apple' then 'App Store' when 'google' then 'Google Play' when 'bing' then 'Bing' else r.source end || ': hiba az utolsó lehúzáskor', 's', 'Részletek a Rendszer oldalon.', 'to', case when r.source = 'bing' then 'seo' else 'system' end, 'since', r.last_at);
    end if;
  end loop;
  select count(*) into k from public.inbox_items where not done and created_at < now() - interval '2 days';
  if k > 0 then
    out := out || jsonb_build_object('k', 'inbox-old', 'c', 'info', 't', k || ' komment 2 napnál régebben vár', 's', 'A gyors válasz a platformon is többet mutat a posztból.', 'to', 'inbox');
  end if;
  /* bug reports among the comments and reviews */
  select (select count(*) from public.inbox_items where not done and public.admin_inbox_tag(body, rating, kind) = 'hiba')
       + (select count(*) from public.store_reviews where reply is null and not done and public.admin_inbox_tag(body, rating, 'review') = 'hiba') into k;
  if k > 0 then
    out := out || jsonb_build_object('k', 'inbox-bug', 'c', 'warn', 't', k || ' hibajelzés a kommentekben és véleményekben', 's', 'Valaki azt írja, valami nem működik. Nézd meg, és válaszolj.', 'to', 'inbox');
  end if;
  /* goals: past 30% of the period, the pace points below 70% */
  for r in select x->>'metric' metric, x->>'period' period, (x->>'target')::numeric target, (x->>'value')::numeric val, (x->>'t0')::timestamptz t0, (x->>'t1')::timestamptz t1
           from jsonb_array_elements(public.admin_goals_compute()) x loop
    continue when r.t1 <= now() or r.target <= 0;
    v1 := extract(epoch from now() - r.t0) / nullif(extract(epoch from r.t1 - r.t0), 0);
    if v1 >= 0.3 and r.val / v1 < 0.7 * r.target and r.val < r.target then
      out := out || jsonb_build_object('k', 'goal:' || r.metric || ':' || r.period, 'c', 'warn',
        't', 'Lemaradás a ' || case r.period when 'week' then 'heti' when 'month' then 'havi' when 'quarter' then 'negyedéves' when 'year' then 'éves' else 'egyedi' end || ' céltól: ' ||
          case when r.metric = 'scored' then 'elemzés' when r.metric = 'sessions' then 'látogatás' when r.metric = 'signups' then 'regisztráció' when r.metric = 'shared' then 'megosztás'
            when r.metric = 'gsc_clicks' then 'Google-kattintás' when r.metric = 'gsc_impressions' then 'Google-megjelenés' when r.metric = 'bing_clicks' then 'Bing-kattintás'
            when r.metric = 'downloads' then 'letöltés' when r.metric = 'reviews' then 'értékelés' when r.metric = 'followers' then 'új követő'
            else replace(replace(replace(r.metric, 'followers_', 'új követő, '), 'views_', 'megtekintés, '), 'visits_', 'látogató, ') end,
        's', 'Eddig ' || r.val::bigint || ' / ' || r.target::bigint || '; ebben az ütemben kb. ' || round(r.val / v1) || ' lesz a végére.', 'to', 'goals');
    end if;
  end loop;
  /* plans: a planned post whose day passed and did not go out; a failed or stuck publication */
  select count(*) into k from public.content_plans where day < today and day >= today - 14 and status in ('terv', 'kesz');
  if k > 0 then
    out := out || jsonb_build_object('k', 'plan-missed', 'c', 'info', 't', k || ' tervezett poszt nem ment ki', 's', 'A napja elmúlt, és nincs „Kint van” állapotban. Tedd át egy új napra, vagy jelöld késznek.', 'to', 'planner');
  end if;
  for r in select id, title, updated_at, results from public.content_plans where updated_at > now() - interval '3 days'
           and exists (select 1 from jsonb_each(results) e where e.value ? 'error' and not coalesce((e.value->>'ok')::boolean, false)) loop
    out := out || jsonb_build_object('k', 'publish-error:' || r.id, 'c', 'bad', 't', 'Nem ment ki: ' || left(r.title, 60), 's',
      (select string_agg(e.key || ': ' || left(e.value->>'error', 80), ' · ') from jsonb_each(r.results) e where e.value ? 'error' and not coalesce((e.value->>'ok')::boolean, false)), 'to', 'planner', 'since', r.updated_at);
  end loop;
  for r in select id, title, updated_at from public.content_plans where results->'instagram' ? 'pending' and not coalesce((results->'instagram'->>'ok')::boolean, false) and updated_at < now() - interval '1 hour' and updated_at > now() - interval '7 days' loop
    out := out || jsonb_build_object('k', 'ig-stuck:' || r.id, 'c', 'warn', 't', 'Beragadt Instagram-feltöltés: ' || left(r.title, 50), 's', 'Az Instagram egy órája dolgozza fel a fájlt. Próbáld újra a Tervezőben, vagy tölts fel kisebb videót.', 'to', 'planner', 'since', r.updated_at);
  end loop;
  return out;
end $$;

ALTER FUNCTION "public"."admin_platform_alerts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_platform_today"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; t0 timestamptz := ((now() at time zone tz)::date)::timestamp at time zone tz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.platform) from (
    select a.platform, a.last_sync_at, coalesce(a.last_sync_at >= t0, false) synced_today, f.day followers_day, f.followers,
      (select d.followers from public.social_account_daily d where d.platform = a.platform and d.day < f.day and d.followers is not null order by d.day desc limit 1) followers_prev,
      /* a pin's count is a 90-day rolling sum: its daily difference is not "new views"; the account's impressions today are */
      case when a.platform = 'pinterest' then null else
        public.admin_post_gains_day(public.admin_today(), a.platform) end views_today,
      case when a.platform = 'pinterest' then (select d.impressions from public.social_account_daily d where d.platform = 'pinterest' and d.day = public.admin_today()) end impressions_today,
      (select count(distinct session) from public.events_real e where e.created_at >= t0 and public.admin_channel(e.props->'src', e.props->>'ia') = a.platform) visits_today
    from public.social_accounts a
    left join lateral (select d.day, d.followers from public.social_account_daily d where d.platform = a.platform and d.followers is not null order by d.day desc limit 1) f on true) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_platform_today"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post"("p_platform" "text", "p_post_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare res jsonb; c text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) into c
  from public.social_posts p where p.platform = p_platform and p.post_id = p_post_id;
  with s as (
    select session, min(created_at) min_t, bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'signup') signed, bool_or(name like 'share%') shared
    from public.events_real where c is not null and props->'src'->>'ux' = c and session is not null group by session
  ), peers as (
    select views from public.social_posts where platform = p_platform and post_id <> p_post_id and views > 0 order by created_at desc nulls last limit 300
  )
  select jsonb_build_object(
    'post', (select to_jsonb(p) - 'updated_at' from public.social_posts p where p.platform = p_platform and p.post_id = p_post_id),
    'code', c,
    'peers', (select jsonb_build_object('n', count(*), 'median', percentile_cont(0.5) within group (order by views), 'avg', avg(views)) from peers),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (select dd.day, dd.views, dd.likes, dd.comments, dd.shares, dd.saves, dd.reach, dd.impressions, dd.clicks,
        pd.impressions day_impressions, pd.clicks day_clicks, pd.pin_clicks, pd.ctr
        from public.social_post_daily dd left join public.social_post_day pd on pd.platform = dd.platform and pd.post_id = dd.post_id and pd.day = dd.day
        where dd.platform = p_platform and dd.post_id = p_post_id) x), '[]'),
    'days', coalesce((select jsonb_agg(x order by x.day) from (select day, impressions, saves, clicks, pin_clicks, ctr from public.social_post_day where platform = p_platform and post_id = p_post_id) x), '[]'),
    'hourly', coalesce((select jsonb_agg(x order by x.at) from (select at, views, likes, comments, shares, saves from public.social_post_hourly where platform = p_platform and post_id = p_post_id) x), '[]'),
    'retention', coalesce((select jsonb_agg(x order by x.x) from (select x, ratio from public.social_retention where platform = p_platform and post_id = p_post_id) x), '[]'),
    'visits', coalesce((select jsonb_agg(x order by x.t) from (select date_trunc('day', min_t at time zone 'Europe/Budapest') t, count(*) sessions, count(*) filter (where scored) scored from s group by 1) x), '[]'),
    'clicks', coalesce((select jsonb_agg(x order by x.t) from (
      select date_trunc('day', at at time zone 'Europe/Budapest') t, count(*) n from public.link_clicks where c is not null and code = c group by 1) x), '[]'),
    'comments', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (
      select source, item_id, author, body, created_at, reply, replied_at, done from public.inbox_items where source = p_platform and post_id = p_post_id order by created_at desc nulls last limit 60) x), '[]'),
    'chain', jsonb_build_object('clicks', (select count(*) from public.link_clicks where c is not null and code = c),
      'sessions', (select count(*) from s), 'scored', (select count(*) from s where scored), 'signups', (select count(*) from s where signed), 'shared', (select count(*) from s where shared))
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_post"("p_platform" "text", "p_post_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_gains"("p_from" "date") RETURNS TABLE("platform" "text", "post_id" "text", "day" "date", "gain" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  /* Views gained per post and day. A day without a number is skipped (it never turns the next day into the whole lifetime),
     each day is compared with the highest number seen before it (a platform correcting downward and growing back is not
     counted twice), and the first number a post ever has goes to the day it was posted. Pinterest's exact per-day numbers
     (social_post_day) replace the snapshot differences when they exist, since they arrive 1–2 days late. */
  with pd as (
    select d.platform, d.post_id, d.day, coalesce(d.impressions, d.views)::numeric g from public.social_post_day d
    where coalesce(d.impressions, d.views) is not null
  ), o as (
    select s.platform, s.post_id, s.day, coalesce(s.impressions, s.views)::numeric v,
      max(coalesce(s.impressions, s.views)::numeric) over (partition by s.platform, s.post_id order by s.day rows between unbounded preceding and 1 preceding) pv
    from public.social_post_daily s
    where coalesce(s.impressions, s.views) is not null
      and not exists (select 1 from pd where pd.platform = s.platform and pd.post_id = s.post_id)
  ), x as (
    select o.platform, o.post_id,
      case when o.pv is null then least(o.day, coalesce((p.created_at at time zone 'Europe/Budapest')::date, o.day)) else o.day end d,
      case when o.pv is null then o.v else greatest(0, o.v - o.pv) end g
    from o join public.social_posts p on p.platform = o.platform and p.post_id = o.post_id
    union all select pd.platform, pd.post_id, pd.day, pd.g from pd
  )
  select x.platform, x.post_id, x.d, sum(x.g) from x where x.d >= p_from group by 1, 2, 3
$$;

ALTER FUNCTION "public"."admin_post_gains"("p_from" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_gains_day"("p_day" "date", "p_platform" "text" DEFAULT NULL::"text") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  /* the same rule as admin_post_gains, for one day */
  select coalesce(sum(g.gain), 0) from public.admin_post_gains(p_day) g
  where g.day = p_day and (case when p_platform is null then g.platform not in ('pinterest', 'linkedin') else g.platform = p_platform end)
$$;

ALTER FUNCTION "public"."admin_post_gains_day"("p_day" "date", "p_platform" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_group_set"("p_platform" "text", "p_post_id" "text", "p_grp" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if nullif(trim(coalesce(p_grp, '')), '') is null then delete from public.social_post_groups where platform = p_platform and post_id = p_post_id;
  else insert into public.social_post_groups (platform, post_id, grp) values (p_platform, p_post_id, left(trim(p_grp), 80)) on conflict (platform, post_id) do update set grp = excluded.grp; end if;
end $$;

ALTER FUNCTION "public"."admin_post_group_set"("p_platform" "text", "p_post_id" "text", "p_grp" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_id_of"("p_platform" "text", "u" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select case p_platform
    when 'tiktok' then substring(u from '/video/(\d+)')
    when 'youtube' then coalesce(substring(u from '/shorts/([A-Za-z0-9_-]{11})'), substring(u from '[?&]v=([A-Za-z0-9_-]{11})'), substring(u from 'youtu\.be/([A-Za-z0-9_-]{11})'))
    when 'pinterest' then substring(u from '/pin/(\d+)')
    when 'instagram' then substring(u from '/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)')
    when 'linkedin' then substring(u from '(?:activity|share|ugcPost)[:-](\d+)')
  end
$$;

ALTER FUNCTION "public"."admin_post_id_of"("p_platform" "text", "u" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_manual_delete"("p_platform" "text", "p_post_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_post_id not like 'm:%' then raise exception 'Csak kézzel felvett poszt törölhető.'; end if;
  update public.short_links set post_platform = null, post_id = null where post_platform = p_platform and post_id = p_post_id;
  delete from public.social_post_groups where platform = p_platform and post_id = p_post_id;
  delete from public.social_post_daily where platform = p_platform and post_id = p_post_id;
  delete from public.social_post_hourly where platform = p_platform and post_id = p_post_id;
  delete from public.social_posts where platform = p_platform and post_id = p_post_id;
  return found;
end $$;

ALTER FUNCTION "public"."admin_post_manual_delete"("p_platform" "text", "p_post_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_manual_save"("p_platform" "text", "p_url" "text", "p_created_at" timestamp with time zone, "p_title" "text" DEFAULT NULL::"text", "p_kind" "text" DEFAULT NULL::"text", "p_views" bigint DEFAULT NULL::bigint, "p_likes" bigint DEFAULT NULL::bigint, "p_comments" bigint DEFAULT NULL::bigint, "p_shares" bigint DEFAULT NULL::bigint, "p_saves" bigint DEFAULT NULL::bigint, "p_impressions" bigint DEFAULT NULL::bigint, "p_post_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare id text; u text := nullif(trim(coalesce(p_url, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_platform not in ('tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube') then raise exception 'Ismeretlen platform.'; end if;
  if u is null or u !~* '^https?://' then raise exception 'Adj meg egy teljes linket (https://…).'; end if;
  if exists (select 1 from public.social_posts p where p.platform = p_platform and p.post_id not like 'm:%'
      and (public.admin_norm_post_url(p.url) = public.admin_norm_post_url(u) or p.post_id = public.admin_post_id_of(p_platform, u))) then
    raise exception 'Ez a poszt már bent van (a platform lehúzásából).';
  end if;
  id := coalesce(nullif(p_post_id, ''), 'm:' || coalesce(public.admin_post_id_of(p_platform, u), left(md5(public.admin_norm_post_url(u)), 16)));
  if id not like 'm:%' then raise exception 'Csak kézzel felvett poszt módosítható itt.'; end if;
  insert into public.social_posts as s (platform, post_id, created_at, kind, title, url, views, likes, comments, shares, saves, impressions, updated_at)
    values (p_platform, id, coalesce(p_created_at, now()), nullif(p_kind, ''), nullif(trim(coalesce(p_title, '')), ''), u, p_views, p_likes, p_comments, p_shares, p_saves, p_impressions, now())
    on conflict (platform, post_id) do update set created_at = excluded.created_at, kind = excluded.kind, title = excluded.title, url = excluded.url,
      views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares, saves = excluded.saves, impressions = excluded.impressions, updated_at = now();
  if coalesce(p_views, p_likes, p_comments, p_shares, p_saves, p_impressions) is not null then
    insert into public.social_post_daily (platform, post_id, day, views, likes, comments, shares, saves, impressions)
      values (p_platform, id, public.admin_today(), p_views, p_likes, p_comments, p_shares, p_saves, p_impressions)
      on conflict (platform, post_id, day) do update set views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares, saves = excluded.saves, impressions = excluded.impressions;
  end if;
  return jsonb_build_object('platform', p_platform, 'post_id', id);
end $$;

ALTER FUNCTION "public"."admin_post_manual_save"("p_platform" "text", "p_url" "text", "p_created_at" timestamp with time zone, "p_title" "text", "p_kind" "text", "p_views" bigint, "p_likes" bigint, "p_comments" bigint, "p_shares" bigint, "p_saves" bigint, "p_impressions" bigint, "p_post_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_post_views_at"("p_platform" "text", "p_post_id" "text", "p_created" timestamp with time zone, "p_cur" bigint, "p_day" "date") RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select case
    when p_day > public.admin_today() then p_cur
    when p_created >= (p_day::timestamp at time zone 'Europe/Budapest') then 0
    else (select s.views from (
        select h.views, h.at t from public.social_post_hourly h where h.platform = p_platform and h.post_id = p_post_id and h.views is not null and h.at <= (p_day::timestamp at time zone 'Europe/Budapest')
        union all
        select d.views, ((d.day + 1)::timestamp at time zone 'Europe/Budapest') from public.social_post_daily d where d.platform = p_platform and d.post_id = p_post_id and d.views is not null and d.day < p_day
      ) s order by s.t desc limit 1)
  end
$$;

ALTER FUNCTION "public"."admin_post_views_at"("p_platform" "text", "p_post_id" "text", "p_created" timestamp with time zone, "p_cur" bigint, "p_day" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_product"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare r record; res jsonb; tz constant text := 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with ev as (select * from public.admin_events(p_ch, p_lang) e where e.created_at >= r.a and e.created_at < r.b),
  pev as (select * from public.admin_events(p_ch, p_lang) e where e.created_at >= r.pa and e.created_at < r.a),
  sx as (select session, (min(created_at) >= r.a) cur, bool_or(name = 'app_open') app,
      bool_or(name = 'analysis_start' or (name = 'flow_step' and props->>'step' = 'score')) analysis, bool_or(name = 'flow_step' and props->>'step' = 'score') scored,
      bool_or(name = 'reveal_shown') revealed, bool_or(name = 'detail_open') detail, bool_or(name = 'more_designs') more,
      bool_or(name in ('share_open', 'share_save', 'share_video', 'reveal_share')) shared,
      bool_or(name = 'signature_captured' or (name = 'quiz_answer' and props->>'step' = 'sign' and coalesce(props->>'value', '') <> 'skipped')) captured,
      bool_or(name = 'capture_skipped' or (name = 'quiz_answer' and props->>'step' = 'sign' and props->>'value' = 'skipped')) skipped,
      bool_or(name = 'pro_file') files, bool_or(name = 'celebrate') celebrate
    from (select * from ev union all select * from pev) z where session is not null group by session),
  agg as (select cur, jsonb_build_object('sessions', count(*), 'app', count(*) filter (where app), 'analysis', count(*) filter (where analysis), 'scored', count(*) filter (where scored),
      'revealed', count(*) filter (where revealed), 'detail', count(*) filter (where detail), 'more', count(*) filter (where more), 'shared', count(*) filter (where shared),
      'captured', count(*) filter (where captured), 'skipped', count(*) filter (where skipped and not captured), 'files', count(*) filter (where files), 'celebrate', count(*) filter (where celebrate)) j
    from sx group by cur)
  select jsonb_build_object('days', r.d,
    'now', coalesce((select j from agg where cur), '{}'),
    'prev', coalesce((select j from agg where not cur), '{}'),
    'styles', coalesce((select jsonb_agg(x order by x.n desc) from (select props->>'value' k, count(*) n from ev where name = 'quiz_answer' and props->>'step' = 'style' and props ? 'value' group by 1) x), '[]'),
    'variants', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(props->>'v', '?') k, count(*) n from ev where name = 'pro_variant' group by 1) x), '[]'),
    'share_fmt', coalesce((select jsonb_agg(x order by x.n desc) from (select name ev, coalesce(nullif(props->>'kind', ''), '–') kind, coalesce(nullif(props->>'fmt', ''), '–') fmt, count(*) n
      from ev where name in ('share_open', 'share_save', 'share_video', 'reveal_share') group by 1, 2, 3) x), '[]'),
    'ai_reports', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(props->>'lang', '?') k, count(*) n from ev where name = 'ai_note_report' group by 1) x), '[]'),
    'unlocks', jsonb_build_object('n', (select count(*) from public.admin_real_unlocks u where u.created_at >= r.a and u.created_at < r.b),
      'pro', (select count(*) from public.admin_real_unlocks u where u.created_at >= r.a and u.created_at < r.b and u.calligrapher),
      'design', (select count(*) from public.admin_real_unlocks u where u.created_at >= r.a and u.created_at < r.b and u.design is not null),
      'users', (select count(distinct u.user_id) from public.admin_real_unlocks u where u.created_at >= r.a and u.created_at < r.b),
      'prev', (select count(*) from public.admin_real_unlocks u where u.created_at >= r.pa and u.created_at < r.a),
      'daily', coalesce((select jsonb_agg(x order by x.t) from (select (u.created_at at time zone tz)::date t, count(*) n from public.admin_real_unlocks u where u.created_at >= r.a and u.created_at < r.b group by 1) x), '[]')),
    'scores', coalesce((select jsonb_agg(x order by x.k) from (select least(100, greatest(0, ((props->>'band')::int / 10) * 10)) k, count(*) n
      from ev where name = 'score_shown' and props->>'band' ~ '^\d+$' group by 1) x), '[]')
  ) into res;
  return res;
end $_$;

ALTER FUNCTION "public"."admin_product"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_delete"("p_endpoint" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.admin_push_subs where endpoint = p_endpoint;
end $$;

ALTER FUNCTION "public"."admin_push_delete"("p_endpoint" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_latest"("p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(s order by s.at desc) from (select kind, key, title, body, url, at from public.admin_push_sent
       where at > coalesce(p_since, now() - interval '1 day') order by at desc limit 20) s), '[]'),
    'more', greatest(0, (select count(*) from public.admin_push_sent where at > coalesce(p_since, now() - interval '1 day')) - 20),
    'now', now());
end $$;

ALTER FUNCTION "public"."admin_push_latest"("p_since" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_prefs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select v from public.admin_settings where k = 'push'), '{}');
end $$;

ALTER FUNCTION "public"."admin_push_prefs"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_prefs_save"("p" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p) <> 'object' or length(p::text) > 2000 then raise exception 'bad prefs'; end if;
  insert into public.admin_settings (k, v) values ('push', p) on conflict (k) do update set v = excluded.v, updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_push_prefs_save"("p" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_save"("p_sub" "jsonb", "p_ua" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_push_subs (endpoint, p256dh, auth, ua) values (p_sub->>'endpoint', p_sub->'keys'->>'p256dh', p_sub->'keys'->>'auth', left(p_ua, 200))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fails = 0;
end $$;

ALTER FUNCTION "public"."admin_push_save"("p_sub" "jsonb", "p_ua" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_push_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('devices', (select count(*) from public.admin_push_subs),
    'sent', coalesce((select jsonb_agg(s order by s.at desc) from (select kind, title, body, url, at from public.admin_push_sent order by at desc limit 20) s), '[]'));
end $$;

ALTER FUNCTION "public"."admin_push_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_accounts"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (select 1 from public.admin_secrets where k = 'server_lock' and v = 'on') then
    if p_token is null or length(p_token) <> 64 or p_token not in (select v from public.admin_secrets where k in ('server', 'cron')) then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'account_id', account_id, 'access_token', access_token, 'refresh_token', refresh_token,
    'token_expires_at', token_expires_at, 'last_sync_at', last_sync_at, 'scopes', scopes)) from public.social_accounts), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_accounts"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_appearance_has"("p_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return exists (select 1 from public.gsc_appearance);
end $$;

ALTER FUNCTION "public"."admin_r_appearance_has"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(app_id) from public.competitors), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_cwv_urls"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(page) from (select page from public.gsc_daily where day > public.admin_today() - 28 and page like 'https://inkage.app/knowledge/%' group by 1 order by sum(clicks) desc, sum(impressions) desc limit 3) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_cwv_urls"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_digest_extra"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; w0 timestamptz := (date_trunc('week', now() at time zone tz) at time zone tz); today date := public.admin_today();
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'inbox_open', (select count(*) from public.inbox_items where not done) + coalesce((select count(*) from public.store_reviews where reply is null and not done), 0),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'at', at, 'platforms', platforms)) from public.content_plans where day = today and status not in ('kint', 'otlet')), '[]'),
    'week_plan', (select items from public.admin_week_plans where week = (date_trunc('week', now() at time zone tz))::date),
    'week', public.admin_period(now() - interval '7 days', now()), 'prev_week', public.admin_period(now() - interval '14 days', now() - interval '7 days'),
    'top_posts', coalesce((select jsonb_agg(x) from (select platform, title, url, views from public.social_posts where created_at > now() - interval '7 days' order by views desc nulls last limit 3) x), '[]'),
    'gsc_week', (select jsonb_build_object('clicks', coalesce(sum(g.clicks), 0), 'impressions', coalesce(sum(g.impressions), 0)) from public.admin_gsc_days(today - 8, today - 2) g),
    'followers', coalesce((select jsonb_agg(x order by x.platform) from (
      select platform, (array_agg(followers order by day desc))[1] followers,
        (array_agg(followers order by day desc))[1] - (array_agg(followers order by day))[1] gained, min(day) since
      from public.social_account_daily where followers is not null and day >= today - 7 group by platform) x), '[]'),
    'errors_day', public.admin_digest_errors(now() - interval '24 hours', now()),
    'errors_week', public.admin_digest_errors(now() - interval '7 days', now()),
    'w0', w0);
end $$;

ALTER FUNCTION "public"."admin_r_digest_extra"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_digest_slot"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz text := coalesce((select v #>> '{}' from public.admin_settings where k = 'digest_tz'), 'Europe/Budapest');
  loc timestamp := now() at time zone tz;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('tz', tz, 'local', loc,
    'due', extract(hour from loc) = 6 and (select v #>> '{}' from public.admin_settings where k = 'digest_sent') is distinct from loc::date::text);
end $$;

ALTER FUNCTION "public"."admin_r_digest_slot"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_due_plans"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(p)) from public.content_plans p
    where p.publish and p.published_at is null and p.status in ('terv', 'kesz')
      and (p.publishing_at is null or p.publishing_at < now() - interval '5 minutes')
      and (p.day + coalesce(p.at, time '09:00'))::timestamp at time zone 'Europe/Budapest' <= now()
      and (p.day + coalesce(p.at, time '09:00'))::timestamp at time zone 'Europe/Budapest' > now() - interval '3 days'), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_due_plans"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_evening"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare t0 timestamptz := (public.admin_today()::timestamp at time zone 'Europe/Budapest');
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'day', public.admin_today(),
    'sessions', (select count(distinct session) from public.events_real where created_at >= t0 and session is not null),
    'scored', (select count(distinct session) from public.events_real where created_at >= t0 and name = 'flow_step' and props->>'step' = 'score'),
    'signups', (select count(*) from public.admin_real_users where created_at >= t0),
    'views', (select sum(greatest(0, p.views - b.v)) from public.social_posts p
              cross join lateral (select public.admin_post_views_at(p.platform, p.post_id, p.created_at, p.views, public.admin_today()) v) b
              where p.platform not in ('pinterest', 'linkedin') and p.views is not null and b.v is not null),
    'top', (select jsonb_build_object('platform', p.platform, 'title', left(p.title, 80), 'views', p.views) from public.social_posts p where p.created_at >= t0 order by p.views desc nulls last limit 1));
end $$;

ALTER FUNCTION "public"."admin_r_evening"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_gsc_has"("p_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return exists (select 1 from public.gsc_daily);
end $$;

ALTER FUNCTION "public"."admin_r_gsc_has"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_health"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare out jsonb := '[]'; n int; m int;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_array_length(public.admin_jobs_failing()) > 0 then
    out := out || jsonb_build_object('k', 'jobs', 't', 'Hibás időzített feladat: ' || (select string_agg(replace(x, 'admin-', ''), ', ') from jsonb_array_elements_text(public.admin_jobs_failing()) x));
  end if;
  if (select max(at) from public.uptime_checks) < now() - interval '20 minutes' then out := out || jsonb_build_object('k', 'heartbeat', 't', 'Az 5 perces mérés 20 perce nem futott: a Supabase időzítője áll.'); end if;
  select count(*) into n from public.uptime_checks u where u.done and not u.ok and u.via = 'pg_net' and u.at > now() - interval '24 hours'
    and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes');
  if n > 0 then out := out || jsonb_build_object('k', 'down', 't', n || ' megerősített kiesés az elmúlt 24 órában (Monitoring → Elérhetőség).'); end if;
  select count(distinct session) filter (where name = 'app_open'), count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') into n, m
    from public.events_real where created_at > now() - interval '24 hours';
  if n >= 15 and m = 0 then out := out || jsonb_build_object('k', 'canary', 't', n || ' appmegnyitás az elmúlt 24 órában, de egyik sem jutott el a pontszámig: lehet, hogy az elemzés nem működik.'); end if;
  select count(*), count(distinct session) into n, m from public.events_real where name in ('client_error', 'storage_full', 'signin_failed', 'auth_error') and created_at > now() - interval '24 hours';
  if (n >= 25 and m >= 3) or n >= 300 then out := out || jsonb_build_object('k', 'errors', 't', n || ' hiba ' || m || ' látogatásban az elmúlt 24 órában (Rendszer → Hibák).'); end if;
  if exists (select 1 from public.social_accounts where last_sync_at < now() - interval '3 hours' or last_error is not null) then
    out := out || jsonb_build_object('k', 'social', 't', 'Közösségi fiók nem frissült 3 órája, vagy hibával: ' || (select string_agg(platform, ', ') from public.social_accounts where last_sync_at < now() - interval '3 hours' or last_error is not null));
  end if;
  if exists (select 1 from public.sync_log where source = 'gsc') and coalesce((select max(at) from public.sync_log where source = 'gsc' and ok), '-infinity') < now() - interval '30 hours' then
    out := out || jsonb_build_object('k', 'gsc', 't', 'A Google Search Console 30 órája nem frissült.');
  end if;
  if exists (select 1 from public.social_accounts where least(refresh_expires_at, case when platform in ('linkedin', 'instagram') then token_expires_at end) < now() + interval '3 days') then
    out := out || jsonb_build_object('k', 'expiry', 't', 'Lejár egy platform-kapcsolat 3 napon belül (Kapcsolatok).');
  end if;
  if exists (select 1 from public.cert_status where valid_to < now() + interval '14 days' or domain_expires < now() + interval '30 days') then
    out := out || jsonb_build_object('k', 'cert', 't', 'Lejár a tanúsítvány vagy a domain (Monitoring).');
  end if;
  return jsonb_build_object('problems', out, 'at', now(),
    'stats', jsonb_build_object('sessions', (select count(distinct session) from public.events_real where created_at > now() - interval '24 hours'),
      'scored', (select count(distinct session) from public.events_real where name = 'flow_step' and props->>'step' = 'score' and created_at > now() - interval '24 hours'),
      'signups', (select count(*) from public.admin_real_users where created_at > now() - interval '24 hours')));
end $$;

ALTER FUNCTION "public"."admin_r_health"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_inbox_item"("p_token" "text", "p_source" "text", "p_item" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select to_jsonb(i) from public.inbox_items i where source = p_source and item_id = p_item);
end $$;

ALTER FUNCTION "public"."admin_r_inbox_item"("p_token" "text", "p_source" "text", "p_item" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_index_queue"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('url', url, 'checked_at', checked_at)) from public.gsc_index), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_index_queue"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_keys"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (select 1 from public.admin_secrets where k = 'server_lock' and v = 'on') then
    if p_token is null or length(p_token) <> 64 or p_token not in (select v from public.admin_secrets where k in ('server', 'cron')) then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(substr(name, 14), decrypted_secret) from vault.decrypted_secrets where name like 'inkage_admin.%'), '{}');
end $$;

ALTER FUNCTION "public"."admin_r_keys"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select count(*) from public.sync_log where source = p_source and at >= p_since);
end $$;

ALTER FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select to_jsonb(p) from public.content_plans p where p.id::text = p_id);
end $$;

ALTER FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_push_news"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'inbox', coalesce((select jsonb_agg(x) from (select source, item_id, author, left(body, 120) body, rating, kind from public.inbox_items where not done and created_at > now() - interval '6 hours'
       union all select store, review_id, author, left(body, 120), rating, 'review' from public.store_reviews where reply is null and created_at > now() - interval '2 days') x), '[]'),
    'errors', (select count(*) from public.events_real where name in ('client_error', 'signin_failed', 'auth_error') and created_at > now() - interval '1 hour'),
    /* how many different visits had them: 5 errors of one visitor are one problem, not five */
    'errors_people', (select count(distinct session) from public.events_real where name in ('client_error', 'signin_failed', 'auth_error') and created_at > now() - interval '1 hour'),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'last_error', last_error, 'token_expires_at', token_expires_at)) from public.social_accounts), '[]'),
    'index_drop', coalesce((select jsonb_agg(url) from public.gsc_index where verdict is distinct from 'PASS' and prev_verdict = 'PASS' and changed_at > now() - interval '2 days'), '[]'),
    'posts', coalesce((select jsonb_agg(x) from (select platform, post_id, title, url, views, created_at from public.social_posts where created_at > now() - interval '60 days') x), '[]'),
    'yesterday', (select jsonb_build_object('day', day, 'scored', scored, 'best', (select max(b.scored) from public.admin_daily b where b.ch = '*' and b.lg = '*' and b.day < a.day))
       from public.admin_daily a where ch = '*' and lg = '*' and day = (now() at time zone 'Europe/Budapest')::date - 1));
end $$;

ALTER FUNCTION "public"."admin_r_push_news"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_push_prefs"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select v from public.admin_settings where k = 'push'), '{}');
end $$;

ALTER FUNCTION "public"."admin_r_push_prefs"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_push_subs"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('endpoint', endpoint)) from public.admin_push_subs), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_push_subs"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_push_system"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; dday date := (now() at time zone tz)::date;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'expiring', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'at', least(refresh_expires_at, case when platform in ('linkedin', 'instagram') then token_expires_at end)))
       from public.social_accounts where least(refresh_expires_at, case when platform in ('linkedin', 'instagram') then token_expires_at end) < now() + interval '7 days'), '[]'),
    'certs', coalesce((select jsonb_agg(jsonb_build_object('host', host, 'valid_to', valid_to, 'domain_expires', domain_expires)) from public.cert_status
       where valid_to < now() + interval '14 days' or domain_expires < now() + interval '30 days'), '[]'),
    'failed', coalesce((select jsonb_agg(jsonb_build_object('job', job, 'at', started_at, 'message', left(message, 160))) from public.admin_runs
       where ok = false and started_at > now() - interval '3 hours' and job not like '%only=rules%'), '[]'),
    /* a call whose run already reported its own failure is not reported a second time */
    'calls_bad', coalesce((select jsonb_agg(jsonb_build_object('path', c.path, 'at', c.at, 'status', c.status, 'error', c.error)) from public.admin_cron_calls c
       where c.done and c.at > now() - interval '3 hours' and (c.timed_out or c.status is null or c.status not between 200 and 299) and c.path not like '%only=rules%'
         and not exists (select 1 from public.admin_runs r where r.job = c.path and r.ok = false and r.started_at between c.at - interval '1 minute' and c.at + interval '10 minutes')), '[]'),
    'sync_bad', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'at', at, 'message', left(message, 160))) from public.sync_log
       where not ok and at > now() - interval '3 hours' and source <> 'ai'), '[]'),
    /* the digest is due at 07:00 UTC of the Budapest day; by 08:00 UTC it should have finished. Both the due time and the
       day it belongs to are those of the Budapest day, so the alarm can't fire (and use up its key) at Budapest midnight. */
    'digest_missing', now() > ((dday + time '08:00') at time zone 'UTC')
       and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and started_at > ((dday + time '06:00') at time zone 'UTC')),
    'digest_day', dday,
    'heartbeat', (select max(at) from public.uptime_checks),
    'last_sent', (select max(at) from public.admin_push_sent));
end $$;

ALTER FUNCTION "public"."admin_r_push_system"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_push_wake"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare l timestamptz;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  select max(last_ok) into l from public.admin_push_subs;
  return jsonb_build_object('last', l, 'pending', (select count(*) from public.admin_push_sent where kind <> 'test' and (l is null or at > l)));
end $$;

ALTER FUNCTION "public"."admin_r_push_wake"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_recipients"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(e.email order by e.email) from public.admin_emails e), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_recipients"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_rules"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare out jsonb := '[]'; r record; v numeric;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select * from public.alert_rules where on_ and (last_fired is null or last_fired < now() - interval '1 hour') loop
    v := case
      when r.metric = 'errors' then (select count(*) from public.events_real where name in ('client_error', 'signin_failed', 'auth_error') and created_at > now() - make_interval(mins => r.window_min))
      when r.metric = 'sessions' then (select count(distinct session) from public.events_real where created_at > now() - make_interval(mins => r.window_min))
      when r.metric = 'scored' then (select count(distinct session) from public.events_real where name = 'flow_step' and props->>'step' = 'score' and created_at > now() - make_interval(mins => r.window_min))
      when r.metric = 'score_rate' then (select 100.0 * count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') / nullif(count(distinct session) filter (where name = 'app_open'), 0)
                               from public.events_real where created_at > now() - make_interval(mins => r.window_min))
      when r.metric = 'down' then (select count(*) from public.uptime_checks u where u.done and not u.ok and u.via = 'pg_net' and u.at > now() - make_interval(mins => r.window_min)
        and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes'))
      when r.metric = 'latency' then (select avg(ms) from public.uptime_checks where done and ok and via = 'server' and at > now() - make_interval(mins => r.window_min))
      when r.metric = 'signups' then (select count(*) from public.admin_real_users where created_at > now() - make_interval(mins => r.window_min))
      when r.metric ~ '^pf_(views|visits|followers):(tiktok|instagram|facebook|pinterest|linkedin|youtube)$' then public.admin_rule_value(r.metric, r.window_min)
      else null end;
    if v is not null and ((r.op = '>' and v > r.threshold) or (r.op = '<' and v < r.threshold)) then
      out := out || jsonb_build_object('id', r.id, 'metric', r.metric, 'op', r.op, 'threshold', r.threshold, 'window_min', r.window_min, 'value', round(v, 1), 'channels', to_jsonb(r.channels));
      update public.alert_rules set last_fired = now() where id = r.id;
    end if;
  end loop;
  return out;
end $_$;

ALTER FUNCTION "public"."admin_r_rules"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_social_state"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select v from public.admin_settings where k = 'sync:social'), '{}');
end $$;

ALTER FUNCTION "public"."admin_r_social_state"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_store_has"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('apple', exists (select 1 from public.store_daily where store = 'apple'), 'google', exists (select 1 from public.store_daily where store = 'google'));
end $$;

ALTER FUNCTION "public"."admin_r_store_has"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object('email', email, 'body', body, 'lang', lang, 'author', author, 'created_at', created_at) from public.inbox_items where source = 'support' and item_id = p_item);
end $$;

ALTER FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_uptime_targets"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('url', url, 'ok_max', coalesce(ok_max, 399)) order by url) from public.uptime_targets where on_), '[]');
end $$;

ALTER FUNCTION "public"."admin_r_uptime_targets"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_r_watch"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('sites', coalesce((select jsonb_agg(to_jsonb(c)) from public.competitor_sites c), '[]'),
    'social', coalesce((select jsonb_agg(to_jsonb(c)) from public.social_competitors c), '[]'),
    'known_pages', coalesce((select jsonb_agg(domain || ' ' || url) from public.competitor_pages), '[]'),
    'tracked', coalesce((select jsonb_agg(query) from public.admin_tracked_queries), '[]'),
    'top_queries', coalesce((select jsonb_agg(query) from (select query from public.gsc_daily where day > public.admin_today() - 60 group by 1 order by sum(impressions) desc limit 40) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_r_watch"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_range"("p_days" integer, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("a" timestamp with time zone, "b" timestamp with time zone, "pa" timestamp with time zone, "d" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare x timestamptz; y timestamptz := now(); k integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
begin
  x := y - make_interval(days => k);
  if coalesce(p_days, 0) = 0 then
    x := coalesce(least((select min(e.created_at) from public.events_real e), (select min(u.created_at) from public.admin_real_users u)), y - interval '1 day');
  end if;
  if p_from is not null then x := p_from; y := least(coalesce(p_to, now()), now()); end if;
  k := greatest(1, ceil(extract(epoch from y - x) / 86400)::int);
  return query select x, y, x - (y - x), k;
end $$;

ALTER FUNCTION "public"."admin_range"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_ranks"("p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer := greatest(7, least(coalesce(nullif(p_days, 0), 480), 480));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'tracked', coalesce((select jsonb_agg(jsonb_build_object('query', q.query,
        'days', (select coalesce(jsonb_agg(x order by x.day), '[]') from (select g.day, sum(g.clicks) clicks, sum(g.impressions) impressions,
            round((sum(g.position * g.impressions) / nullif(sum(g.impressions), 0))::numeric, 1) pos from public.gsc_daily g where g.query = q.query and g.day >= public.admin_today() - k group by 1) x),
        'countries', (select coalesce(jsonb_agg(x order by x.impressions desc), '[]') from (select g.country k, sum(g.impressions) impressions, sum(g.clicks) clicks,
            round((sum(g.position * g.impressions) / nullif(sum(g.impressions), 0))::numeric, 1) pos from public.gsc_daily g where g.query = q.query and g.day >= public.admin_today() - 28 group by 1 order by 2 desc limit 4) x),
        'clicks28', (select coalesce(sum(g.clicks), 0) from public.gsc_daily g where g.query = q.query and g.day >= public.admin_today() - 28),
        'impressions28', (select coalesce(sum(g.impressions), 0) from public.gsc_daily g where g.query = q.query and g.day >= public.admin_today() - 28),
        'page', (select g.page from public.gsc_daily g where g.query = q.query and g.day >= public.admin_today() - 28 group by g.page order by sum(g.clicks) desc, sum(g.impressions) desc limit 1),
        'bing_pos', (select round(avg(b.pos)::numeric, 1) from public.bing_daily b where lower(b.query) = lower(q.query) and b.day >= public.admin_today() - 28),
        'bing_impressions', (select sum(b.impressions) from public.bing_daily b where lower(b.query) = lower(q.query) and b.day >= public.admin_today() - 28)
      ) order by q.created_at) from public.admin_tracked_queries q), '[]'),
    'suggest', coalesce((select jsonb_agg(x) from (select g.query, sum(g.impressions) impressions, round((sum(g.position * g.impressions) / nullif(sum(g.impressions), 0))::numeric, 1) pos
        from public.gsc_daily g where g.day >= public.admin_today() - 28 and not exists (select 1 from public.admin_tracked_queries t where t.query = g.query)
        group by 1 order by 2 desc limit 12) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_ranks"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_report"("p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest';
  v_f date := least(p_from, p_to); v_t date := greatest(p_from, p_to);
  v_len int := greatest(p_from, p_to) - least(p_from, p_to) + 1;
  v_glag int := greatest(0, greatest(p_from, p_to) - coalesce(public.admin_gsc_last(), greatest(p_from, p_to)));
  v_blag int := greatest(0, greatest(p_from, p_to) - coalesce((select max(day) from public.bing_daily), greatest(p_from, p_to)));
  v_t0 timestamptz := least(p_from, p_to)::timestamp at time zone 'Europe/Budapest';
  v_t1 timestamptz := (greatest(p_from, p_to) + 1)::timestamp at time zone 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'from', v_f, 'to', v_t, 'days', v_len,
    'followers', coalesce((select jsonb_agg(x) from (
      select pl.platform, fb.fv followers, coalesce(fa.fv, fc.fv) start from (select distinct platform from public.social_account_daily) pl
      left join lateral (select sd.followers fv from public.social_account_daily sd where sd.platform = pl.platform and sd.day <= v_t and sd.followers is not null order by sd.day desc limit 1) fb on true
      left join lateral (select sd.followers fv from public.social_account_daily sd where sd.platform = pl.platform and sd.day < v_f and sd.followers is not null order by sd.day desc limit 1) fa on true
      left join lateral (select sd.followers fv from public.social_account_daily sd where sd.platform = pl.platform and sd.day between v_f and v_t and sd.followers is not null order by sd.day asc limit 1) fc on true) x), '[]'),
    'downloads', jsonb_build_object('apple', (select coalesce(sum(downloads), 0) from public.store_daily where store = 'apple' and day between v_f and v_t),
      'google', (select coalesce(sum(downloads), 0) from public.store_daily where store = 'google' and day between v_f and v_t),
      'prev', (select coalesce(sum(downloads), 0) from public.store_daily where day between v_f - v_len and v_f - 1)),
    'gsc', jsonb_build_object('from', v_f - v_glag, 'to', v_t - v_glag,
      'clicks', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(v_f - v_glag, v_t - v_glag) g),
      'impressions', (select coalesce(sum(g.impressions), 0) from public.admin_gsc_days(v_f - v_glag, v_t - v_glag) g),
      'prev_clicks', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(v_f - v_glag - v_len, v_f - v_glag - 1) g),
      'prev_impressions', (select coalesce(sum(g.impressions), 0) from public.admin_gsc_days(v_f - v_glag - v_len, v_f - v_glag - 1) g)),
    'bing', jsonb_build_object('from', v_f - v_blag, 'to', v_t - v_blag,
      'clicks', (select coalesce(sum(clicks), 0) from public.bing_daily where day between v_f - v_blag and v_t - v_blag),
      'impressions', (select coalesce(sum(impressions), 0) from public.bing_daily where day between v_f - v_blag and v_t - v_blag),
      'prev_clicks', (select coalesce(sum(clicks), 0) from public.bing_daily where day between v_f - v_blag - v_len and v_f - v_blag - 1)),
    'appstore_impressions', (select coalesce(sum(n), 0) from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = '' and day between v_f and v_t),
    'social_impressions', coalesce((select jsonb_object_agg(x.platform, x.v) from (
      select platform, sum(impressions) v from public.social_account_daily where day between v_f and v_t and impressions is not null group by 1) x), '{}'),
    'yt_watch_hours', (select round(coalesce(sum(watch_total), 0) / 3600.0, 1) from public.social_posts where platform = 'youtube' and created_at >= v_t0 and created_at < v_t1),
    'inbox', jsonb_build_object(
      'new', (select count(*) from public.inbox_items where created_at >= v_t0 and created_at < v_t1) + (select count(*) from public.store_reviews where created_at >= v_t0 and created_at < v_t1),
      'replied', (select count(*) from public.inbox_items where replied_at >= v_t0 and replied_at < v_t1) + (select count(*) from public.store_reviews where replied_at >= v_t0 and replied_at < v_t1),
      'open', (select count(*) from public.inbox_items where not done) + (select count(*) from public.store_reviews where reply is null and not done)),
    'posts', coalesce((
      with gp as (
        select sp.platform, sp.post_id, max(po.title) title, max(po.url) url, max(po.thumb) thumb, max(po.views) views, max(po.created_at) created_at,
          greatest(0, max(sp.views) filter (where sp.day <= v_t)
            - coalesce(max(sp.views) filter (where sp.day < v_f), case when max(po.created_at) >= v_t0 then 0 end, min(sp.views) filter (where sp.day between v_f and v_t), 0))::numeric gain
        from public.social_post_daily sp join public.social_posts po on po.platform = sp.platform and po.post_id = sp.post_id
        where sp.day <= v_t and sp.platform <> 'pinterest' group by 1, 2),
      md as (select platform, percentile_cont(0.5) within group (order by gain) med from gp where gain > 0 group by 1)
      select jsonb_agg(x order by x.ratio desc nulls last, x.gain desc) from (
        select gp.*, round((gp.gain / nullif(md.med, 0))::numeric, 2) ratio from gp join md on md.platform = gp.platform where gp.gain > 0 order by gp.gain desc limit 30) x), '[]'),
    'cum', coalesce((select jsonb_agg(x order by x.dd) from (
      select ad.day dd, sum(ad.scored) over (order by ad.day) v, sum(ad.sessions) over (order by ad.day) s from public.admin_daily ad where ad.ch = '*' and ad.lg = '*' and ad.day <= v_t) x where x.dd >= v_f), '[]'),
    'months', coalesce((select jsonb_agg(x order by x.dd) from (
      select date_trunc('month', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared from public.admin_daily ad where ad.ch = '*' and ad.lg = '*' and ad.day > v_t - 400 and ad.day <= v_t group by 1) x), '[]'),
    'weeks', coalesce((select jsonb_agg(x order by x.dd) from (
      select date_trunc('week', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared from public.admin_daily ad where ad.ch = '*' and ad.lg = '*' and ad.day > v_t - 70 and ad.day <= v_t group by 1) x), '[]'),
    'notes', coalesce((select jsonb_agg(x order by x.day) from (select day, kind, text from public.admin_notes where day between v_f and v_t) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_report"("p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_retention"("p_days" integer DEFAULT 0, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; res jsonb; today date := public.admin_today();
  v_a timestamptz := case when coalesce(p_days, 0) = 0 then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;
  v_pa timestamptz := case when coalesce(p_days, 0) = 0 then '-infinity'::timestamptz else now() - make_interval(days => 2 * p_days) end;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.admin_collect_days();
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  uall as (select u.id, u.email, u.created_at, (u.created_at at time zone tz)::date d0, date_trunc('week', u.created_at at time zone tz)::date w,
      coalesce(m.ch, 'ismeretlen') ch, coalesce(left(coalesce(m.lang, m.slang), 2), '?') lg, coalesce(m.pf, 'ismeretlen') pf, coalesce(u.raw_app_meta_data->>'provider', '?') prov
    from public.admin_real_users u left join m on m.user_id = u.id
    where (p_ch is null or m.ch = any(string_to_array(p_ch, ','))) and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
  u as (select * from uall where created_at >= v_a),
  pu as (select * from uall where created_at >= v_pa and created_at < v_a),
  act as (select ud.user_id, ud.day, x.d0, x.w, (ud.day - x.d0) / 7 wk from public.admin_user_days ud join u x on x.id = ud.user_id),
  last_act as (select ud.user_id, max(ud.day) as day from public.admin_user_days ud group by 1),
  days as (select gs::date as day from generate_series(today - 59, today, interval '1 day') gs)
  select jsonb_build_object(
    'accounts', (select count(*) from u), 'accounts_all', (select count(*) from uall), 'days', coalesce(p_days, 0),
    'cohorts', coalesce((select jsonb_agg(x order by x.w desc) from (
      select c.w, count(*) n,
        (select jsonb_agg(jsonb_build_object('k', k, 'n', (select count(distinct ac.user_id) from act ac where ac.w = c.w and ac.wk = k and ac.day > ac.d0),
          'open', (max(c.d0) + ((k + 1) * 7)) <= today, 'partial', (min(c.d0) + (k * 7)) <= today and (max(c.d0) + ((k + 1) * 7)) > today) order by k) from generate_series(0, 8) k) weeks
      from u c group by c.w order by c.w desc limit 12) x), '[]'),
    'active', coalesce((select jsonb_agg(x order by x.day) from (
      select dd.day,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.day = dd.day) dau,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.day > dd.day - 7 and ud.day <= dd.day) wau,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.day > dd.day - 30 and ud.day <= dd.day) mau,
        /* the same without the day of sign-up: accounts that came back */
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.day > dd.day - 30 and ud.day <= dd.day and ud.day > z.d0) mau_back,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.day > dd.day - 7 and ud.day <= dd.day and ud.day > z.d0) wau_back
      from days dd) x), '[]'),
    'curve', coalesce((select jsonb_agg(x order by x.k) from (
      select k, count(*) filter (where exists (select 1 from public.admin_user_days ud where ud.user_id = c.id and ud.day >= c.d0 + k)) back, count(*) eligible
      from u c cross join (values (1), (3), (7), (14), (30), (60), (90)) v(k) where c.d0 + k <= today group by k) x), '[]'),
    'curve_prev', coalesce((select jsonb_agg(x order by x.k) from (
      select k, count(*) filter (where exists (select 1 from public.admin_user_days ud where ud.user_id = c.id and ud.day >= c.d0 + k)) back, count(*) eligible
      from pu c cross join (values (1), (3), (7), (14), (30), (60), (90)) v(k) where c.d0 + k <= today group by k) x), '[]'),
    'by', coalesce((select jsonb_agg(x order by x.dim, x.users desc) from (
      select z.dim, z.k, count(*) users,
        count(*) filter (where z.d0 + 7 <= today) d7_n,
        count(*) filter (where z.d0 + 7 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = z.id and ud.day between z.d0 + 1 and z.d0 + 7)) d7,
        count(*) filter (where z.d0 + 30 <= today) d30_n,
        count(*) filter (where z.d0 + 30 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = z.id and ud.day between z.d0 + 8 and z.d0 + 30)) d30
      from (select id, d0, 'ch' dim, ch k from u union all select id, d0, 'lang', lg from u union all select id, d0, 'pf', pf from u union all select id, d0, 'prov', prov from u) z
      group by 1, 2) x), '[]'),
    'days_per_user', coalesce((select jsonb_agg(x order by x.k) from (
      select least(c, 10) k, count(*) n from (select ud.user_id, count(*) c from public.admin_user_days ud join u x on x.id = ud.user_id group by 1) z group by 1) x), '[]'),
    'dormant', (select count(*) from u x join last_act l on l.user_id = x.id where l.day < today - 30),
    'dormant_list', coalesce((select jsonb_agg(x order by x.last_day desc) from (
      select x.id, x.email, x.created_at, l.day last_day, x.lg lang from u x join last_act l on l.user_id = x.id where l.day < today - 30 order by l.day desc limit 25) x), '[]'),
    'since', (select min(day) from public.admin_user_days),
    'store', jsonb_build_object(
      'google', coalesce((select jsonb_object_agg(metric, n) from (select metric, sum(n) n from public.store_metrics where store = 'google' and dim = '' and day > today - 60
        and metric in ('downloads_src', 'retained_d1', 'retained_d7', 'retained_d15', 'retained_d30') group by 1) x), '{}'),
      'apple', coalesce((select jsonb_object_agg(metric, n) from (select metric, case when metric = 'active_devices' then max(n) else sum(n) end n from public.store_metrics where store = 'apple' and dim = '' and day > today - 30
        and metric in ('sessions', 'active_devices', 'installs', 'deletions') group by 1) x), '{}'))
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_retention"("p_days" integer, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_retention_ch"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.users desc) from (
    with f as (select m.user_id id, (m.created_at at time zone tz)::date d0, coalesce(m.ch, 'ismeretlen') ch from public.admin_signups_matched(now() - interval '180 days', now() + interval '1 minute') m)
    select ch k, count(*) users,
      count(*) filter (where d0 + 7 <= public.admin_today()) d7_n, count(*) filter (where d0 + 7 <= public.admin_today() and exists (select 1 from public.admin_user_days ud where ud.user_id = f.id and ud.day between f.d0 + 1 and f.d0 + 7)) d7,
      count(*) filter (where d0 + 30 <= public.admin_today()) d30_n, count(*) filter (where d0 + 30 <= public.admin_today() and exists (select 1 from public.admin_user_days ud where ud.user_id = f.id and ud.day between f.d0 + 8 and f.d0 + 30)) d30
    from f group by 1) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_retention_ch"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_rollup"("p_from" "date" DEFAULT NULL::"date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest';
  f date := coalesce(p_from, date '2000-01-01');
  v0 timestamptz := (f::timestamp at time zone tz);
  c0 timestamptz := clock_timestamp();
  cnt int;
begin
  /* the 10-minute job and the nightly job never write the same days at once */
  perform pg_advisory_xact_lock(hashtext('public.admin_rollup'));
  delete from public.admin_daily where day >= f;
  with e as (
    /* '*' marks "all" in the summary: a real channel or language spelt '*' would collide with it */
    select session, created_at, name, props->>'step' step, (created_at at time zone tz)::date as dy, props ? 'src' has_src,
      nullif(public.admin_channel(props->'src', props->>'ia'), '*') ch0, nullif(left(coalesce(lang, ''), 2), '*') lg0
    from public.events_real where created_at >= v0
  ),
  e2 as (select session, created_at, name, step, dy, has_src, coalesce(ch0, '?') ch, coalesce(nullif(lg0, ''), '?') lg from e),
  evd as (
    select dy, case when grouping(ch) = 1 then '*' else ch end ch, case when grouping(lg) = 1 then '*' else lg end lg,
      count(*) events, min(created_at) first_at
    from e2 group by grouping sets ((dy), (dy, ch), (dy, lg), (dy, ch, lg))
  ),
  s1 as (
    select session, min(created_at) st,
      coalesce((array_agg(ch order by created_at) filter (where has_src))[1], (array_agg(ch order by created_at))[1]) ch,
      coalesce((array_agg(lg order by created_at desc) filter (where lg <> '?'))[1], '?') lg,
      bool_or(name = 'app_open') app, bool_or(name = 'flow_step' and step = 'score') scored, bool_or(name = 'reveal_shown') revealed,
      bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared
    from e2 where session is not null
      /* a session that began before the rebuilt days stays on the day it began */
      and not exists (select 1 from public.events o where o.session = e2.session and o.created_at < v0)
    group by session
  ),
  ss as (
    select session, case when grouping(ch) = 1 then '*' else ch end ch, case when grouping(lg) = 1 then '*' else lg end lg, min(st) st,
      bool_or(app) app, bool_or(scored) scored, bool_or(revealed) revealed, bool_or(shared) shared
    from s1 group by grouping sets ((session), (session, ch), (session, lg), (session, ch, lg))
  ),
  sd as (
    select (st at time zone tz)::date as dy, ch, lg, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored,
      count(*) filter (where revealed) revealed, count(*) filter (where shared) shared
    from ss group by 1, 2, 3
  )
  insert into public.admin_daily (day, ch, lg, events, sessions, app, scored, revealed, shared, first_at)
  select coalesce(a.dy, b.dy), coalesce(a.ch, b.ch), coalesce(a.lg, b.lg), coalesce(a.events, 0), coalesce(b.sessions, 0), coalesce(b.app, 0),
    coalesce(b.scored, 0), coalesce(b.revealed, 0), coalesce(b.shared, 0), a.first_at
  from evd a full join sd b on a.dy = b.dy and a.ch = b.ch and a.lg = b.lg
  on conflict (day, ch, lg) do update set events = excluded.events, sessions = excluded.sessions, app = excluded.app, scored = excluded.scored,
    revealed = excluded.revealed, shared = excluded.shared, first_at = excluded.first_at;
  get diagnostics cnt = row_count;
  insert into public.admin_rollup_state (k, at, from_day, rows, ms)
  values (case when p_from is null then 'full' when p_from < (now() at time zone tz)::date - 2 then 'week' else 'recent' end, now(), f, cnt,
    (extract(epoch from clock_timestamp() - c0) * 1000)::int)
  on conflict (k) do update set at = excluded.at, from_day = excluded.from_day, rows = excluded.rows, ms = excluded.ms;
  return cnt;
end
$$;

ALTER FUNCTION "public"."admin_rollup"("p_from" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_rollup_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare jobs jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  begin
    select coalesce(jsonb_object_agg(j.jobname, jsonb_build_object('active', j.active, 'schedule', j.schedule,
      'last', (select jsonb_build_object('status', r.status, 'at', r.start_time, 'msg', left(coalesce(r.return_message, ''), 200))
               from cron.job_run_details r where r.jobid = j.jobid order by r.start_time desc limit 1),
      'fails_7d', (select count(*) from cron.job_run_details r where r.jobid = j.jobid and r.status = 'failed' and r.start_time > now() - interval '7 days'))), '{}')
    into jobs from cron.job j where j.jobname in ('admin-rollup', 'admin-rollup-week', 'admin-digest', 'admin-weekly', 'admin-publish');
  exception when others then jobs := null;
  end;
  return jsonb_build_object(
    'state', coalesce((select jsonb_object_agg(k, jsonb_build_object('at', at, 'from', from_day, 'rows', rows, 'ms', ms)) from public.admin_rollup_state), '{}'),
    'jobs', jobs,
    'bing', (select max(at) from public.sync_log where source = 'bing' and ok),
    'bing_error', (select max(at) from public.sync_log where source = 'bing' and not ok),
    'apple', (select max(at) from public.sync_log where source = 'apple' and ok),
    'google', (select max(at) from public.sync_log where source = 'google' and ok));
end $$;

ALTER FUNCTION "public"."admin_rollup_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_rule_save"("p" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare m text := p->>'metric'; o text := coalesce(p->>'op', '>'); th numeric; w integer := coalesce((p->>'window_min')::int, 60); chs text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (p->>'delete') is not null then delete from public.alert_rules where id = (p->>'delete')::bigint; return; end if;
  if (p->>'toggle') is not null then update public.alert_rules set on_ = coalesce((p->>'on')::boolean, not on_) where id = (p->>'toggle')::bigint; return; end if;
  if m not in ('errors', 'sessions', 'scored', 'score_rate', 'down', 'latency', 'signups') and m !~ '^pf_(views|visits|followers):(tiktok|instagram|facebook|pinterest|linkedin|youtube)$' then raise exception 'Ismeretlen mutató.'; end if;
  if o not in ('>', '<') then raise exception 'A feltétel csak „több mint” vagy „kevesebb mint” lehet.'; end if;
  begin th := (p->>'threshold')::numeric; exception when others then raise exception 'A határ egy szám legyen.'; end;
  if th is null or th < -1e9 or th > 1e9 then raise exception 'A határ egy szám legyen.'; end if;
  if th < 0 and m !~ '^pf_followers:' then raise exception 'A határ egy nem negatív szám legyen.'; end if;
  if w not between 5 and 43200 then raise exception 'Az ablak 5 perc és 30 nap között legyen.'; end if;
  select coalesce(array_agg(x), '{push}') into chs from jsonb_array_elements_text(coalesce(p->'channels', '["push"]')) x where x in ('push', 'telegram', 'email');
  if (p->>'id') is not null then
    update public.alert_rules set metric = m, op = o, threshold = th, window_min = w, channels = chs where id = (p->>'id')::bigint;
  else
    insert into public.alert_rules (metric, op, threshold, window_min, channels) values (m, o, th, w, chs);
  end if;
end $_$;

ALTER FUNCTION "public"."admin_rule_save"("p" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_rule_value"("p_metric" "text", "p_window_min" integer) RETURNS numeric
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare pf text := split_part(p_metric, ':', 2); t0 timestamptz := now() - make_interval(mins => p_window_min); v numeric;
begin
  if p_metric like 'pf_visits:%' then
    select count(distinct session) into v from public.events_real e where e.created_at > t0 and e.session is not null and public.admin_channel(e.props->'src', e.props->>'ia') = pf;
  elsif p_metric like 'pf_views:%' then
    select sum(greatest(0, p.views - b.views)) into v from public.social_posts p
      cross join lateral (select case when p.created_at >= t0 then 0 else (select s.views from (
          select h.views, h.at t from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.views is not null and h.at <= t0
          union all select d.views, ((d.day + 1)::timestamp at time zone 'Europe/Budapest') from public.social_post_daily d where d.platform = p.platform and d.post_id = p.post_id and d.views is not null and ((d.day + 1)::timestamp at time zone 'Europe/Budapest') <= t0
        ) s order by s.t desc limit 1) end views) b
      where p.platform = pf and p.views is not null and b.views is not null;
  elsif p_metric like 'pf_followers:%' then
    select (select a.followers from public.social_account_daily a where a.platform = pf and a.followers is not null order by a.day desc limit 1)
         - (select a.followers from public.social_account_daily a where a.platform = pf and a.followers is not null and a.day <= (t0 at time zone 'Europe/Budapest')::date order by a.day desc limit 1) into v;
  end if;
  return v;
end $$;

ALTER FUNCTION "public"."admin_rule_value"("p_metric" "text", "p_window_min" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_search"("p_days" integer DEFAULT 28, "p_country" "text" DEFAULT NULL::"text", "p_device" "text" DEFAULT NULL::"text", "p_page" "text" DEFAULT NULL::"text", "p_q" "text" DEFAULT NULL::"text", "p_brand" "text" DEFAULT 'all'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  today date := public.admin_today();
  last date := least(public.admin_gsc_last(), public.admin_today() - 1);
  k integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  v_a date; v_pa date; res jsonb; v_exact boolean; v_partial boolean;
  t_first date := (select min(day) from public.gsc_totals where type = 'web');
  d_first date := (select min(day) from public.gsc_daily);
  flt boolean := (p_country is not null or p_device is not null or p_page is not null or nullif(trim(coalesce(p_q, '')), '') is not null or coalesce(p_brand, 'all') <> 'all');
  brand_re constant text := '(inkage|ink age|inkag|inkaege)';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if d_first is null and t_first is null then
    return jsonb_build_object('empty', true, 'sync', coalesce((select jsonb_agg(x order by x.at desc) from (select at, ok, rows, message from public.sync_log where source = 'gsc' order by at desc limit 5) x), '[]'));
  end if;
  if coalesce(p_days, 0) = 0 then
    v_a := case when flt then coalesce(d_first, t_first) else coalesce(t_first, d_first) end;
    k := greatest(1, last - v_a + 1);
  else
    v_a := last - k + 1;
  end if;
  v_pa := v_a - k;
  v_exact := not flt and t_first is not null and v_a >= t_first;
  v_partial := v_pa < least(coalesce(t_first, d_first), coalesce(d_first, t_first));
  with g as (select * from public.gsc_daily x where x.day >= v_a and x.day <= last and (p_country is null or x.country = p_country) and (p_device is null or x.device = p_device)
      and (p_page is null or x.page = p_page) and (nullif(trim(coalesce(p_q, '')), '') is null or x.query ilike '%' || trim(p_q) || '%')
      and (coalesce(p_brand, 'all') = 'all' or (p_brand = 'brand') = (x.query ~* brand_re))),
  gp as (select * from public.gsc_daily x where x.day >= v_pa and x.day < v_a and (p_country is null or x.country = p_country) and (p_device is null or x.device = p_device)
      and (p_page is null or x.page = p_page) and (nullif(trim(coalesce(p_q, '')), '') is null or x.query ilike '%' || trim(p_q) || '%')
      and (coalesce(p_brand, 'all') = 'all' or (p_brand = 'brand') = (x.query ~* brand_re))),
  dd as (select x.*, t.position from public.admin_gsc_days(v_pa, last) x left join public.gsc_totals t on t.type = 'web' and t.day = x.day),
  q as (select query, sum(clicks) clicks, sum(impressions) impressions, sum(position * impressions) / nullif(sum(impressions), 0) pos, (array_agg(page order by impressions desc))[1] page from g group by query),
  qp as (select query, sum(clicks) clicks, sum(impressions) impressions, sum(position * impressions) / nullif(sum(impressions), 0) pos from gp group by query),
  qq as (select q.*, coalesce(qp.clicks, 0) prev_clicks, qp.pos prev_pos from q left join qp on qp.query = q.query),
  pg as (select page, sum(clicks) clicks, sum(impressions) impressions, sum(position * impressions) / nullif(sum(impressions), 0) pos, count(distinct query) queries from g group by page),
  pgp as (select page, sum(clicks) clicks, sum(position * impressions) / nullif(sum(impressions), 0) pos from gp group by page),
  pgg as (select pg.*, coalesce(pgp.clicks, 0) prev_clicks, pgp.pos prev_pos from pg left join pgp on pgp.page = pg.page),
  c3 as (select sum(clicks)::numeric / nullif(sum(impressions), 0) v, coalesce(sum(impressions), 0) imp from g where position <= 3.5)
  select jsonb_build_object(
    'empty', false, 'last_day', last, 'from', v_a, 'days', k, 'exact', v_exact, 'exact_from', t_first, 'filtered', flt, 'today_left_out', true,
    'prev_partial', v_partial, 'first_day', least(d_first, t_first),
    'totals', case when not flt then (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0),
        'pos', sum(position * impressions) filter (where exact) / nullif(sum(impressions) filter (where exact), 0), 'queries', (select count(distinct query) from g), 'pages', (select count(distinct page) from g),
        'exact_days', count(*) filter (where exact), 'days', count(*)) from dd where day >= v_a)
      else (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0),
        'pos', sum(position * impressions) / nullif(sum(impressions), 0), 'queries', count(distinct query), 'pages', count(distinct page)) from g) end,
    'rows_totals', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from g),
    'prev', case when v_partial then null when not flt then (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0),
        'pos', sum(position * impressions) filter (where exact) / nullif(sum(impressions) filter (where exact), 0)) from dd where day < v_a)
      else (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0), 'pos', sum(position * impressions) / nullif(sum(impressions), 0)) from gp) end,
    'trend', case when not flt then coalesce((select jsonb_agg(x order by x.t) from (
        select day t, clicks, impressions, position pos, exact from dd where day >= v_a) x), '[]')
      else coalesce((select jsonb_agg(x order by x.t) from (
        select gs::date t, coalesce(sum(g.clicks), 0) clicks, coalesce(sum(g.impressions), 0) impressions, sum(g.position * g.impressions) / nullif(sum(g.impressions), 0) pos
        from generate_series(v_a, last, interval '1 day') gs left join g on g.day = gs::date group by 1) x), '[]') end,
    'prev_trend', case when not flt then coalesce((select jsonb_agg(x order by x.t) from (
        select day t, clicks, impressions, position pos from dd where day < v_a) x), '[]')
      else coalesce((select jsonb_agg(x order by x.t) from (
        select gs::date t, coalesce(sum(gp.clicks), 0) clicks, coalesce(sum(gp.impressions), 0) impressions, sum(gp.position * gp.impressions) / nullif(sum(gp.impressions), 0) pos
        from generate_series(v_pa, v_a - 1, interval '1 day') gs left join gp on gp.day = gs::date group by 1) x), '[]') end,
    'queries', coalesce((select jsonb_agg(x) from (select * from qq order by clicks desc, impressions desc limit 100) x), '[]'),
    'pages', coalesce((select jsonb_agg(x) from (select * from pgg order by clicks desc, impressions desc limit 60) x), '[]'),
    'near', coalesce((select jsonb_agg(x) from (select * from qq where pos >= 8 and pos <= 20 and impressions >= 10 order by impressions desc limit 30) x), '[]'),
    'low_ctr', coalesce((select jsonb_agg(x) from (select * from qq where pos < 8 and impressions >= 50 and clicks::numeric / impressions < 0.02 order by impressions desc limit 20) x), '[]'),
    'ctr3', (select case when imp >= 200 then v end from c3), 'ctr3_imp', (select imp from c3),
    'brand', jsonb_build_object(
      'brand', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from g where query ~* brand_re),
      'other', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from g where query !~* brand_re)),
    'countries', coalesce((select jsonb_agg(x) from (select country k, sum(clicks) clicks, sum(impressions) impressions from g group by 1 order by 2 desc, 3 desc limit 30) x), '[]'),
    'devices', coalesce((select jsonb_agg(x) from (select device k, sum(clicks) clicks, sum(impressions) impressions from g group by 1 order by 2 desc) x), '[]'),
    'new_queries', coalesce((select jsonb_agg(x) from (
        select query, sum(impressions) impressions, sum(clicks) clicks, min(day) first from public.gsc_daily group by query
        having min(day) >= last - 6 order by 2 desc limit 25) x), '[]'),
    'types', coalesce((select jsonb_agg(x) from (select t.type k, coalesce(sum(t.clicks) filter (where t.day >= v_a), 0) clicks, coalesce(sum(t.impressions) filter (where t.day >= v_a), 0) impressions,
        coalesce(sum(t.clicks) filter (where t.day < v_a), 0) prev_clicks, coalesce(sum(t.impressions) filter (where t.day < v_a), 0) prev_impressions
      from public.gsc_totals t where t.day >= v_pa and t.day <= last group by 1) x), '[]'),
    'type_queries', coalesce((select jsonb_agg(x) from (select type, query, sum(clicks) clicks, sum(impressions) impressions,
        round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) pos from public.gsc_search_type where day >= v_a and day <= last group by 1, 2 order by 4 desc limit 60) x), '[]'),
    'bing', jsonb_build_object(
      'clicks', (select coalesce(sum(clicks), 0) from public.bing_daily where day > today - k), 'impressions', (select coalesce(sum(impressions), 0) from public.bing_daily where day > today - k),
      'prev_clicks', (select coalesce(sum(clicks), 0) from public.bing_daily where day > today - 2 * k and day <= today - k),
      'prev_impressions', (select coalesce(sum(impressions), 0) from public.bing_daily where day > today - 2 * k and day <= today - k),
      'last', (select max(day) from public.bing_daily),
      'queries', coalesce((select jsonb_agg(x) from (select query, sum(impressions) impressions, sum(clicks) clicks, round(avg(pos)::numeric, 1) pos from public.bing_daily
        where day > today - k group by 1 order by 2 desc limit 10) x), '[]')),
    'updates', coalesce((select jsonb_agg(x order by x.begin_at) from (select id, title, begin_at, end_at from public.google_updates
      where begin_at::date between v_a and last) x), '[]'),
    'sync', coalesce((select jsonb_agg(x order by x.at desc) from (select at, ok, rows, message from public.sync_log where source = 'gsc' order by at desc limit 5) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_search"("p_days" integer, "p_country" "text", "p_device" "text", "p_page" "text", "p_q" "text", "p_brand" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_selfcheck"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare out jsonb := '[]'; r record; direct bigint; rolled bigint; bad jsonb; hb timestamptz; today date := public.admin_today();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select a.platform, d.posts, (select count(*) from public.social_posts p where p.platform = a.platform) held, a.last_sync_at
           from public.social_accounts a left join lateral (select posts from public.social_account_daily x where x.platform = a.platform order by day desc limit 1) d on true loop
    out := out || jsonb_build_object('k', r.platform || '_posts', 'what', initcap(r.platform) || ': posztok száma', 'expected', r.posts, 'found', r.held,
      'ok', r.posts is null or r.held >= least(r.posts, 300), 'note', 'a platform szerint / nálunk');
    out := out || jsonb_build_object('k', r.platform || '_fresh', 'what', initcap(r.platform) || ': frissesség', 'expected', 'legfeljebb 2 óra', 'found', r.last_sync_at,
      'ok', r.last_sync_at > now() - interval '2 hours', 'note', 'utolsó lehúzás');
  end loop;
  select count(distinct session) into direct from public.events_real e
   where e.created_at >= (today - 1)::timestamp at time zone 'Europe/Budapest'
     and e.created_at < today::timestamp at time zone 'Europe/Budapest'
     and not exists (select 1 from public.events o where o.session = e.session and o.created_at < (today - 1)::timestamp at time zone 'Europe/Budapest');
  select sessions into rolled from public.admin_daily where day = today - 1 and ch = '*' and lg = '*';
  out := out || jsonb_build_object('k', 'rollup', 'what', 'Napi összesítő (tegnap)', 'expected', direct, 'found', coalesce(rolled, 0), 'ok', coalesce(rolled, 0) = direct, 'note', 'látogatás az eseményekből / az összesítőben');
  out := out || jsonb_build_object('k', 'gsc', 'what', 'Google Search Console', 'expected', 'legfeljebb 4 nap késés', 'found', public.admin_gsc_last(),
    'ok', coalesce(public.admin_gsc_last() >= today - 4, false), 'note', 'a Google 2–3 nap késéssel véglegesít');
  bad := public.admin_jobs_failing();
  out := out || jsonb_build_object('k', 'runs', 'what', 'Időzített feladatok (az utolsó futás)', 'expected', 0, 'found', jsonb_array_length(bad), 'ok', jsonb_array_length(bad) = 0,
    'note', case when jsonb_array_length(bad) = 0 then 'mind rendben, ugyanaz, mint a Monitoring listája' else 'hibás: ' || (select string_agg(x, ', ') from jsonb_array_elements_text(bad) x) end);
  hb := (select max(at) from public.uptime_checks where via = 'pg_net');
  out := out || jsonb_build_object('k', 'heartbeat', 'what', 'Elérhetőség-mérés', 'expected', 'legfeljebb 10 perce', 'found', hb, 'ok', hb > now() - interval '10 minutes', 'note', 'az utolsó ellenőrzés');
  return out;
end $$;

ALTER FUNCTION "public"."admin_selfcheck"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_seo"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer := greatest(7, least(coalesce(nullif(p_days, 0), 480), 480));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', k,
    'pages', coalesce((select jsonb_agg(to_jsonb(p) - 'links_internal' order by jsonb_array_length(coalesce(p.issues, '[]')) desc, p.url) from public.seo_pages p), '[]'),
    'checked', (select max(checked_at) from public.seo_pages),
    'health', coalesce((select jsonb_agg(h order by h.day) from public.seo_health h where h.day > public.admin_today() - 365), '[]'),
    'orphans', coalesce((select jsonb_agg(url order by url) from public.seo_pages where coalesce(links_in, 0) = 0 and status = 200 and url <> 'https://inkage.app/'), '[]'),
    -- the page that should stay: the most clicks, then the most impressions
    'cannibal', coalesce((select jsonb_agg(x order by x.impressions desc) from (
      select query, count(distinct page) pages, sum(imp) impressions, sum(clk) clicks,
        jsonb_agg(jsonb_build_object('page', page, 'impressions', imp, 'clicks', clk, 'pos', pos) order by clk desc, imp desc) list
      from (select query, page, sum(impressions) imp, sum(clicks) clk, round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1) pos
            from public.gsc_daily where day > public.admin_today() - k group by 1, 2 having sum(impressions) >= 5) q
      group by query having count(distinct page) > 1 order by 3 desc limit 30) x), '[]'),
    -- every language gets its share of ideas (Hungarian and English no longer crowd out the others)
    'ideas', coalesce((select jsonb_agg(x order by x.lang, x.first_seen desc, x.q) from (
      select z.q, z.lang, z.seed, z.first_seen, (select sum(g.impressions) from public.gsc_daily g where g.query = z.q and g.day > public.admin_today() - 60) impressions
      from (select kw.*, row_number() over (partition by kw.lang order by kw.first_seen desc, kw.q) rn from public.kw_ideas kw) z where z.rn <= 80) x), '[]'),
    'idea_langs', coalesce((select jsonb_agg(x order by x.n desc) from (select lang k, count(*) n from public.kw_ideas group by 1) x), '[]'),
    'appearance', coalesce((select jsonb_agg(x) from (select appearance k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_appearance where day > public.admin_today() - k group by 1 order by 3 desc) x), '[]'),
    'appearance_days', (select count(distinct day) from public.gsc_appearance where day > public.admin_today() - k),
    'bing', jsonb_build_object('totals', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from public.bing_daily where day > public.admin_today() - k),
      'prev', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from public.bing_daily where day > public.admin_today() - 2 * k and day <= public.admin_today() - k),
      'trend', coalesce((select jsonb_agg(x order by x.t) from (select day t, sum(clicks) clicks, sum(impressions) impressions from public.bing_daily where day > public.admin_today() - k group by 1) x), '[]'),
      'queries', coalesce((select jsonb_agg(x) from (select query, sum(impressions) impressions, sum(clicks) clicks, round(avg(pos)::numeric, 1) pos from public.bing_daily where day > public.admin_today() - k group by 1 order by 2 desc limit 20) x), '[]'),
      'links', coalesce((select jsonb_agg(x order by x.first_seen desc) from (select * from public.bing_links where last_seen >= (select max(last_seen) from public.bing_links) - 7 order by first_seen desc limit 150) x), '[]'),
      -- not seen for more than a week while the others were: lost
      'lost', coalesce((select jsonb_agg(x order by x.last_seen desc) from (select * from public.bing_links where last_seen < (select max(last_seen) from public.bing_links) - 7 order by last_seen desc limit 60) x), '[]')),
    'competitors', coalesce((select jsonb_agg(jsonb_build_object('domain', c.domain, 'sitemap', c.sitemap, 'pages', (select count(*) from public.competitor_pages p where p.domain = c.domain),
        'new', coalesce((select jsonb_agg(x order by x.first_seen desc) from (select url, title, first_seen from public.competitor_pages p where p.domain = c.domain and not p.initial and p.first_seen > public.admin_today() - 30 order by first_seen desc limit 15) x), '[]'))) from public.competitor_sites c), '[]'),
    'competitor_titles', coalesce((select jsonb_agg(x) from (select domain, title, url from public.competitor_pages where title is not null order by first_seen desc limit 300) x), '[]'),
    'updates', coalesce((select jsonb_agg(x order by x.begin_at desc) from (select * from public.google_updates order by begin_at desc limit 12) x), '[]'));
end $$;

ALTER FUNCTION "public"."admin_seo"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_seo_alerts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare out jsonb := '[]'; r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select t.query, (select sum(position * impressions) / nullif(sum(impressions), 0) from public.gsc_daily g where g.query = t.query and g.day between public.admin_today() - 6 and public.admin_today()) now_p,
             (select sum(position * impressions) / nullif(sum(impressions), 0) from public.gsc_daily g where g.query = t.query and g.day between public.admin_today() - 20 and public.admin_today() - 7) was_p
           from public.admin_tracked_queries t loop
    if r.now_p is not null and r.was_p is not null and r.now_p - r.was_p >= 3 then
      out := out || jsonb_build_object('c', 'warn', 't', 'Visszaesett a Google-ben: „' || r.query || '”', 's', round(r.was_p::numeric, 1) || '. helyről ' || round(r.now_p::numeric, 1) || '. helyre az elmúlt héten.', 'to', 'search');
    end if;
  end loop;
  if (select count(*) from public.brand_mentions where not seen) > 0 then
    out := out || jsonb_build_object('c', 'info', 't', (select count(*) from public.brand_mentions where not seen) || ' új említés a weben', 's', 'Valaki írt a Calligráról.', 'to', 'brand');
  end if;
  if (select count(*) from public.seo_pages where status >= 400) > 0 then
    out := out || jsonb_build_object('c', 'bad', 't', (select count(*) from public.seo_pages where status >= 400) || ' hibás oldal a weboldalon', 's', 'A heti bejárás 4xx/5xx választ kapott. Részletek az SEO-ellenőrzésben.', 'to', 'seo');
  end if;
  for r in select target from public.uptime_checks where done and not ok and at > now() - interval '15 minutes' group by target having count(*) >= 2 loop
    out := out || jsonb_build_object('c', 'bad', 't', 'Nem érhető el: ' || replace(r.target, 'https://inkage.app', ''), 's', 'Az utolsó két ellenőrzés hibát adott.', 'to', 'monitor');
  end loop;
  for r in select host, valid_to, domain_expires from public.cert_status loop
    if r.valid_to < now() + interval '14 days' then out := out || jsonb_build_object('c', 'bad', 't', 'Lejár a tanúsítvány: ' || r.host, 's', to_char(r.valid_to, 'YYYY.MM.DD.'), 'to', 'monitor'); end if;
    if r.domain_expires < now() + interval '30 days' then out := out || jsonb_build_object('c', 'bad', 't', 'Lejár a domain: ' || r.host, 's', to_char(r.domain_expires, 'YYYY.MM.DD.'), 'to', 'monitor'); end if;
  end loop;
  return out;
end $$;

ALTER FUNCTION "public"."admin_seo_alerts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_seo_week"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'issues', (select coalesce(sum(jsonb_array_length(coalesce(issues, '[]'))), 0) from public.seo_pages),
    'broken', (select count(*) from public.seo_pages where status >= 400),
    'up', coalesce((select jsonb_agg(x) from (select query, round((a - b)::numeric, 1) gain from (
        select query, sum(position * impressions) filter (where day between public.admin_today() - 20 and public.admin_today() - 7) / nullif(sum(impressions) filter (where day between public.admin_today() - 20 and public.admin_today() - 7), 0) a,
               sum(position * impressions) filter (where day > public.admin_today() - 7) / nullif(sum(impressions) filter (where day > public.admin_today() - 7), 0) b
        from public.gsc_daily where day > public.admin_today() - 20 group by 1 having sum(impressions) >= 10) z where a - b >= 2 order by 2 desc limit 5) x), '[]'),
    'down', coalesce((select jsonb_agg(x) from (select query, round((b - a)::numeric, 1) loss from (
        select query, sum(position * impressions) filter (where day between public.admin_today() - 20 and public.admin_today() - 7) / nullif(sum(impressions) filter (where day between public.admin_today() - 20 and public.admin_today() - 7), 0) a,
               sum(position * impressions) filter (where day > public.admin_today() - 7) / nullif(sum(impressions) filter (where day > public.admin_today() - 7), 0) b
        from public.gsc_daily where day > public.admin_today() - 20 group by 1 having sum(impressions) >= 10) z where b - a >= 2 order by 2 desc limit 5) x), '[]'),
    'mentions', (select count(*) from public.brand_mentions where at > now() - interval '7 days'),
    'uptime', (select round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 2) from public.uptime_checks where done and at > now() - interval '7 days'));
end $$;

ALTER FUNCTION "public"."admin_seo_week"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_server_lock_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('token', exists (select 1 from public.admin_secrets where k = 'server'), 'locked', exists (select 1 from public.admin_secrets where k = 'server_lock' and v = 'on'));
end $$;

ALTER FUNCTION "public"."admin_server_lock_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_server_lock_t"("p_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if p_token is null or p_token <> coalesce((select v from public.admin_secrets where k = 'server'), '-') then return false; end if;
  insert into public.admin_secrets (k, v) values ('server_lock', 'on') on conflict (k) do update set v = 'on';
  return true;
end $$;

ALTER FUNCTION "public"."admin_server_lock_t"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_server_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tok text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_secrets s where s.k = 'server_lock' and s.v = 'on') then raise exception 'already locked'; end if;
  select s.v into tok from public.admin_secrets s where s.k = 'server';
  if tok is null then
    tok := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.admin_secrets (k, v) values ('server', tok);
  end if;
  return tok;
end $$;

ALTER FUNCTION "public"."admin_server_token"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_sess"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS TABLE("session" "text", "t0" timestamp with time zone, "t1" timestamp with time zone, "n" bigint, "src" "jsonb", "lang" "text", "channel" "text", "pf" "text", "land" boolean, "cta" boolean, "cta_reg" boolean, "cta_login" boolean, "cta_guest" boolean, "app" boolean, "named" boolean, "captured" boolean, "skipped" boolean, "scored" boolean, "quiz" boolean, "revealed" boolean, "detail" boolean, "more" boolean, "shared" boolean, "last_ev" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select x.session, x.t0, x.t1, x.n, x.src, x.lang, public.admin_channel(x.src, x.ia), public.admin_pf_guess(x.src, coalesce(x.pf, case when x.ia = 'androidapp' then 'android' end)),
    x.land, x.cta, x.cta_reg, x.cta_login, x.cta_guest, x.app, x.named, x.captured, x.skipped and not x.captured, x.scored, x.quiz, x.revealed, x.detail, x.more, x.shared, x.last_ev
  from (
    select e.session, min(e.created_at) t0, max(e.created_at) t1, count(*) n,
      (array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1] src,
      (array_agg(e.lang order by e.created_at desc) filter (where e.lang is not null))[1] lang,
      (array_agg(e.props->>'ia' order by e.created_at) filter (where e.props ? 'ia'))[1] ia,
      (array_agg(e.props->>'pf' order by e.created_at) filter (where e.props ? 'pf'))[1] pf,
      bool_or(e.name = 'landing_view') land, bool_or(e.name = 'cta_click') cta,
      bool_or(e.name = 'cta_click' and e.props->>'cta' = 'register') cta_reg, bool_or(e.name = 'cta_click' and e.props->>'cta' = 'login') cta_login,
      bool_or(e.name = 'cta_click' and e.props->>'cta' = 'guest') cta_guest,
      bool_or(e.name = 'app_open') app,
      bool_or(e.name = 'quiz_answer' and e.props->>'step' = 'name') named,
      -- a real signature: drawn or photographed (skipping is its own branch)
      bool_or(e.name = 'signature_captured' or (e.name = 'quiz_answer' and e.props->>'step' = 'sign' and coalesce(e.props->>'value', '') <> 'skipped')) captured,
      bool_or(e.name = 'capture_skipped' or (e.name = 'quiz_answer' and e.props->>'step' = 'sign' and e.props->>'value' = 'skipped')) skipped,
      bool_or(e.name = 'flow_step' and e.props->>'step' = 'score') scored,
      -- the app's quiz only (the landing page's style quiz sends its language and runs outside /app)
      bool_or(e.name = 'quiz_start' and (e.props ? 'gift' or coalesce(e.path, '') like '/app%')) quiz,
      bool_or(e.name = 'reveal_shown') revealed, bool_or(e.name = 'detail_open') detail, bool_or(e.name = 'more_designs') more,
      bool_or(e.name in ('share_open', 'share_save', 'share_video', 'reveal_share')) shared,
      (array_agg(e.name || coalesce(':' || coalesce(e.props->>'step', e.props->>'k', e.props->>'kind'), '') order by e.created_at desc))[1] last_ev
    from public.admin_events(p_ch, p_lang) e
    where e.created_at >= a and e.created_at < b and e.session is not null
    group by e.session) x
$$;

ALTER FUNCTION "public"."admin_sess"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_sess_attr_rebuild"("p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare n int;
begin
  insert into public.admin_sess_attr (session, first_at, ch_first, src_at, ch_src, lg_at, lg)
  select session, min(created_at),
    (array_agg(public.admin_channel(props->'src', props->>'ia') order by created_at))[1],
    min(created_at) filter (where props ? 'src'),
    (array_agg(public.admin_channel(props->'src', props->>'ia') order by created_at) filter (where props ? 'src'))[1],
    max(created_at) filter (where coalesce(lang, '') <> ''),
    (array_agg(left(lang, 2) order by created_at desc) filter (where coalesce(lang, '') <> ''))[1]
  from public.events
  where session is not null and (p_from is null or session in (select session from public.events where created_at >= p_from))
  group by session
  on conflict (session) do update set first_at = excluded.first_at, ch_first = excluded.ch_first, src_at = excluded.src_at,
    ch_src = excluded.ch_src, lg_at = excluded.lg_at, lg = excluded.lg;
  get diagnostics n = row_count;
  return n;
end $$;

ALTER FUNCTION "public"."admin_sess_attr_rebuild"("p_from" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_setting_get"("p_k" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_k not in ('views', 'tv', 'approvals') then raise exception 'unknown setting'; end if;
  return (select v from public.admin_settings where k = p_k);
end $$;

ALTER FUNCTION "public"."admin_setting_get"("p_k" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_setting_save"("p_k" "text", "p_v" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_k not in ('views', 'tv', 'approvals') then raise exception 'unknown setting'; end if;
  if length(coalesce(p_v, 'null')::text) > 8000 then raise exception 'too long'; end if;
  insert into public.admin_settings (k, v) values (p_k, coalesce(p_v, '{}')) on conflict (k) do update set v = excluded.v, updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_setting_save"("p_k" "text", "p_v" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_share_create"("p_label" "text", "p_days" integer DEFAULT 30) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare t text := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.share_links (token, label, expires_at) values (t, left(coalesce(nullif(trim(p_label), ''), 'Megosztott nézet'), 60), now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))));
  return t;
end $$;

ALTER FUNCTION "public"."admin_share_create"("p_label" "text", "p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_share_delete"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.share_links where token = p_token;
end $$;

ALTER FUNCTION "public"."admin_share_delete"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_share_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (select token, label, created_at, expires_at, views, last_view from public.share_links) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_share_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_signins"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(x order by x.updated_at desc) from (
      select s.created_at, coalesce(s.refreshed_at at time zone 'UTC', s.updated_at) updated_at, left(s.user_agent, 160) ua, host(s.ip) ip, s.id = nullif(auth.jwt()->>'session_id', '')::uuid this
      from auth.sessions s where s.user_id in (select u.id from auth.users u where lower(u.email) in (select email from public.admin_emails)) order by 2 desc limit 20) x), '[]'),
    'log', coalesce((select jsonb_agg(x order by x.at desc) from (
      select a.created_at at, a.payload->>'action' action, host(a.ip_address::inet) ip from auth.audit_log_entries a
      where a.payload->>'actor_id' in (select u.id::text from auth.users u where lower(u.email) in (select email from public.admin_emails))
        and a.payload->>'action' in ('login', 'logout', 'user_signedup', 'user_recovery_requested', 'user_updated_password')
      order by a.created_at desc limit 30) x), '[]'));
exception when others then
  return jsonb_build_object('sessions', '[]'::jsonb, 'log', '[]'::jsonb, 'error', sqlerrm);
end $$;

ALTER FUNCTION "public"."admin_signins"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_signups_matched"("a" timestamp with time zone, "b" timestamp with time zone) RETURNS TABLE("user_id" "uuid", "created_at" timestamp with time zone, "lang" "text", "provider" "text", "session" "text", "ch" "text", "pf" "text", "code" "text", "src" "jsonb", "slang" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select u.id, u.created_at, nullif(u.raw_user_meta_data->>'lang', ''), u.raw_app_meta_data->>'provider', s.session,
    case when s.session is null then null else public.admin_channel(m.src, m.ia) end,
    case when s.session is null then null else public.admin_pf_guess(m.src, m.pf) end,
    m.src->>'ux', m.src, m.lang
  from auth.users u
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
  where u.created_at >= a and u.created_at < b and not public.admin_own_uid(u.id)
$$;

ALTER FUNCTION "public"."admin_signups_matched"("a" timestamp with time zone, "b" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_social"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  /* Budapest calendar days, like the views gained: "Ma" is today since midnight, "3 nap" today and the two days before */
  a timestamptz := ((public.admin_today() - d + 1)::timestamp at time zone 'Europe/Budapest');
  pa timestamptz := ((public.admin_today() - least(2 * d, 7300) + 1)::timestamp at time zone 'Europe/Budapest');
  res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with visits as (
    select props->'src'->>'ux' code, count(distinct session) sessions,
      count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') scored,
      count(distinct session) filter (where name = 'reveal_shown') revealed,
      count(distinct session) filter (where name = 'signup') signups,
      count(distinct session) filter (where created_at >= a) sessions_now
    from public.events_real where props->'src' ? 'ux' and session is not null group by 1
  ), p as (
    select p.*, coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) c
    from public.social_posts p
  ), base as (
    select p.platform, p.post_id, p.created_at, p.kind, p.title, p.url, p.thumb, p.duration, p.c code,
      p.views, p.likes, p.comments, p.shares, p.saves, p.reach, p.impressions, p.clicks, p.watch_avg, p.watch_total, p.profile_visits, p.follows, p.completion, p.traffic, p.updated_at,
      (select dd.views from public.social_post_daily dd where dd.platform = p.platform and dd.post_id = p.post_id and dd.day <= public.admin_today() - 7 order by dd.day desc limit 1) views_week_ago,
      /* the count on the first day of the period: what the post gathered in the period is views - views_start */
      (select dd.views from public.social_post_daily dd where dd.platform = p.platform and dd.post_id = p.post_id and dd.day <= public.admin_today() - d order by dd.day desc limit 1) views_start,
      (select sum(x.pin_clicks) from public.social_post_day x where x.platform = p.platform and x.post_id = p.post_id) pin_clicks,
      (select sum(x.impressions * x.ctr) / nullif(sum(x.impressions) filter (where x.ctr is not null), 0) from public.social_post_day x where x.platform = p.platform and x.post_id = p.post_id) ctr,
      coalesce(v.sessions, 0) sessions, coalesce(v.scored, 0) scored, coalesce(v.revealed, 0) revealed, coalesce(v.signups, 0) signups, coalesce(v.sessions_now, 0) sessions_now
    from p left join visits v on v.code = p.c
  ), chs as (
    /* one channel per visit, the same as everywhere else */
    select e.session, min(e.created_at) t0, coalesce(min(sa.ch), 'közvetlen') ch,
      bool_or(e.name = 'flow_step' and e.props->>'step' = 'score') scored, bool_or(e.name = 'signup') signed
    from public.events_real e left join public.admin_sess_attr sa on sa.session = e.session
    where e.created_at >= pa and e.session is not null group by e.session
  ), lc as (
    select l.source, count(*) filter (where c.at >= a) clicks, count(*) filter (where c.at < a) clicks_prev
    from public.short_links l join public.link_clicks c on c.code = l.code where c.at >= pa group by 1
  )
  select jsonb_build_object(
    'days', d,
    'gained', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from public.admin_post_gains(public.admin_today() - 2 * d + 1)
        where day >= public.admin_today() - d + 1 group by 1) x), '{}'),
    'gained_prev', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from public.admin_post_gains(public.admin_today() - 2 * d + 1)
        where day < public.admin_today() - d + 1 group by 1) x), '{}'),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'username', username, 'display_name', display_name,
        'avatar_url', avatar_url, 'connected_at', connected_at, 'last_sync_at', last_sync_at, 'last_error', last_error, 'scopes', scopes,
        'token_expires_at', token_expires_at, 'refresh_expires_at', refresh_expires_at)) from public.social_accounts), '[]'),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select platform, day, followers, following, likes, posts, impressions, reach, profile_views, views, watch_min, gained, lost, clicks, shares, impressions_30d, views_total
        from public.social_account_daily where day >= (now() - make_interval(days => greatest(d, 30)))::date) x), '[]'),
    'posts', coalesce((select jsonb_agg(to_jsonb(x) - 'rn' order by x.created_at desc nulls last, x.post_id) from (
        select b.*, row_number() over (partition by b.platform order by b.created_at desc nulls last) rn
        from base b where b.created_at >= a or b.created_at is null) x where x.rn <= 300), '[]'),
    /* older posts that still gathered views in the period ("ebben az időszakban szerzett" view of the leaderboard) */
    'active', coalesce((select jsonb_agg(to_jsonb(x) - 'rn') from (
        select b.*, row_number() over (partition by b.platform order by b.views - coalesce(b.views_start, 0) desc) rn
        from base b where b.created_at < a and b.views_start is not null and b.views > b.views_start) x where x.rn <= 100), '[]'),
    /* every post, few fields, for the calendar's earlier months */
    'cal', coalesce((select jsonb_agg(x) from (
        select platform, post_id, created_at, kind, title, url, thumb, views, impressions from public.social_posts where created_at is not null order by created_at desc limit 2000) x), '[]'),
    'groups', coalesce((select jsonb_agg(to_jsonb(g)) from public.social_post_groups g), '[]'),
    'prev', jsonb_build_object(
      'posts', coalesce((select jsonb_object_agg(platform, to_jsonb(x) - 'platform') from (
          select b.platform, count(*) n, sum(b.views) views, sum(b.impressions) impressions, sum(b.likes) likes, sum(b.comments) comments, sum(b.shares) shares, sum(b.saves) saves,
            sum(b.sessions) filter (where b.code is not null) sessions, sum(b.views) filter (where b.code is not null) tagged_views
          from base b where b.created_at >= pa and b.created_at < a group by 1) x), '{}'),
      'leads', coalesce((select jsonb_object_agg(k, to_jsonb(x) - 'k') from (
          select ch k, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where signed) signups
          from chs where t0 < a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '{}')),
    'visits', coalesce((select jsonb_agg(x order by x.t) from (
        select date_trunc('day', t0 at time zone 'Europe/Budapest') t,
          count(*) filter (where ch = 'tiktok') tiktok, count(*) filter (where ch = 'instagram') instagram,
          count(*) filter (where ch = 'facebook') facebook, count(*) filter (where ch = 'pinterest') pinterest, count(*) filter (where ch = 'linkedin') linkedin, count(*) filter (where ch = 'youtube') youtube,
          count(*) filter (where ch = 'tiktok' and scored) tiktok_scored, count(*) filter (where ch = 'instagram' and scored) instagram_scored,
          count(*) filter (where ch = 'facebook' and scored) facebook_scored, count(*) filter (where ch = 'pinterest' and scored) pinterest_scored,
          count(*) filter (where ch = 'linkedin' and scored) linkedin_scored, count(*) filter (where ch = 'youtube' and scored) youtube_scored
        from chs where t0 >= a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '[]'),
    'leads', coalesce((select jsonb_agg(x order by x.sessions desc) from (
        select ch k, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where signed) signups,
          coalesce((select lc.clicks from lc where lc.source = chs.ch), 0) clicks, coalesce((select lc.clicks_prev from lc where lc.source = chs.ch), 0) clicks_prev
        from chs where t0 >= a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '[]'),
    'sync', coalesce((select jsonb_agg(x order by x.at desc) from (select at, source, ok, rows, message from public.sync_log order by at desc limit 100) x), '[]'),
    /* each source: the last good run, the last failed one, the failures of the week */
    'sync_state', coalesce((select jsonb_agg(x) from (
        select source, max(at) filter (where ok) last_ok, max(at) filter (where not ok) last_fail,
          (array_agg(message order by at desc) filter (where not ok))[1] last_msg, count(*) filter (where not ok and at > now() - interval '7 days') fails_7d
        from public.sync_log where at > now() - interval '60 days' group by source) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_social"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_social_reach"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare t date := public.admin_today(); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  /* materialized: computed once, not again for each of the 48 cells (it took 19 s and always hit the time limit) */
  with w as (
    select k, 'now'::text per, t - (k - 1) d0, t + 1 d1 from unnest(array[1, 3, 7, 30]) k
    union all select k, 'prev', t - (2 * k - 1), t - (k - 1) from unnest(array[1, 3, 7, 30]) k
  ), pf(platform) as (select unnest(array['tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube'])),
  gn as materialized (select * from public.admin_post_gains(t - 59)),
  pvs as materialized (
    select w.k, w.per, g.platform, sum(g.gain) views, false partial from w join gn g on g.platform <> 'pinterest' and g.day >= w.d0 and g.day < w.d1 group by 1, 2, 3
  ), chs as materialized (
    select s.session, s.first_at t0, s.ch from public.admin_sess_attr s
    where s.first_at >= ((t - 59)::timestamp at time zone 'Europe/Budapest')
      and exists (select 1 from public.events_real e where e.session = s.session)
  ), cell as (
    select w.k, w.per, pf.platform,
      s.views, coalesce(s.partial, false) partial,
      case when pf.platform = 'pinterest' then (select sum(x.impressions) from public.social_post_day x where x.platform = 'pinterest' and x.day >= w.d0 and x.day < w.d1)
        else (select sum(a.impressions) from public.social_account_daily a where a.platform = pf.platform and a.day >= w.d0 and a.day < w.d1) end imps,
      (select sum(a.views) from public.social_account_daily a where a.platform = pf.platform and a.day >= w.d0 and a.day < w.d1) acc_views,
      (select count(*) from public.social_posts p where p.platform = pf.platform and p.created_at >= (w.d0::timestamp at time zone 'Europe/Budapest') and p.created_at < (w.d1::timestamp at time zone 'Europe/Budapest')) posts,
      (select count(*) from chs where chs.ch = pf.platform and chs.t0 >= (w.d0::timestamp at time zone 'Europe/Budapest') and chs.t0 < (w.d1::timestamp at time zone 'Europe/Budapest')) visits
    from w cross join pf left join pvs s on s.k = w.k and s.per = w.per and s.platform = pf.platform
  )
  select jsonb_build_object(
    'today', t,
    'cells', coalesce((select jsonb_agg(to_jsonb(c)) from cell c), '[]'),
    'platforms', (select jsonb_agg(jsonb_build_object('platform', pf.platform,
        'connected', exists (select 1 from public.social_accounts a where a.platform = pf.platform),
        'last_sync_at', (select a.last_sync_at from public.social_accounts a where a.platform = pf.platform),
        'last_error', (select a.last_error from public.social_accounts a where a.platform = pf.platform),
        'posts', (select count(*) from public.social_posts p where p.platform = pf.platform),
        'manual', (select count(*) from public.social_posts p where p.platform = pf.platform and p.post_id like 'm:%'),
        'last_post', (select max(p.created_at) from public.social_posts p where p.platform = pf.platform),
        'snap_since', (select min(d.day) from public.social_post_daily d where d.platform = pf.platform))) from pf)
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_social_reach"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_solved_list"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(key, at) from public.admin_solved), '{}');
end $$;

ALTER FUNCTION "public"."admin_solved_list"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_solved_set"("p_key" "text", "p_provider" "text" DEFAULT NULL::"text", "p_msg" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_solved (key, at) values (left(p_key, 200), now()) on conflict (key) do update set at = now();
  if p_msg is not null then
    insert into public.error_groups (fp, state, resolved_at)
    select distinct md5(name || '|' || coalesce(props->>'provider', props->>'where', '') || '|' || left(regexp_replace(coalesce(props->>'why', props->>'msg', ''), '[0-9a-f]{6,}|\d+', '#', 'g'), 120)), 'resolved', now()
    from public.events_real where name in ('client_error', 'storage_full', 'signin_failed', 'auth_error') and created_at > now() - interval '60 days'
      and coalesce(props->>'provider', props->>'where', '') = coalesce(p_provider, '') and left(coalesce(props->>'why', props->>'msg', ''), 80) = left(p_msg, 80)
    on conflict (fp) do update set state = 'resolved', resolved_at = now(), updated_at = now();
  end if;
end $$;

ALTER FUNCTION "public"."admin_solved_set"("p_key" "text", "p_provider" "text", "p_msg" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_spikes"("p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(7, least(coalesce(nullif(p_days, 0), 365), 365)); today date := public.admin_today(); res jsonb;
  d0 date := (select min(day) from public.admin_daily where ch = '*' and lg = '*' and sessions > 0);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with t as (select day, sessions from public.admin_daily where ch = '*' and lg = '*' and day >= today - d - 14),
  m0 as (select t.day, t.sessions, greatest(0, t.day - greatest(d0, t.day - 14))::int nb,
          (select coalesce(sum(t2.sessions), 0) from t t2 where t2.day between t.day - 14 and t.day - 1) tot from t),
  m as (select m0.*, case when nb > 0 then tot::numeric / nb end base from m0),
  s as (
    select m.*, 'up' kind from m where day >= today - d and nb >= 3 and sessions >= 8 and sessions >= 1.6 * greatest(base, 1)
    union all select m.*, 'down' from m where day >= today - d and day < today and nb >= 7 and base >= 8 and sessions <= 0.5 * base
  )
  select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'kind', s.kind, 'sessions', s.sessions, 'base', round(s.base, 1), 'base_days', s.nb,
    'chans', (select coalesce(jsonb_agg(c order by abs(c.extra) desc), '[]') from (
        select c0.* from (
          select k.ch k, coalesce((select a.sessions from public.admin_daily a where a.day = s.day and a.ch = k.ch and a.lg = '*'), 0) n,
            round(coalesce((select a.sessions from public.admin_daily a where a.day = s.day and a.ch = k.ch and a.lg = '*'), 0)
              - coalesce((select sum(b.sessions) from public.admin_daily b where b.ch = k.ch and b.lg = '*' and b.day between s.day - 14 and s.day - 1), 0) / s.nb::numeric) extra
          from (select distinct ch from public.admin_daily where lg = '*' and ch <> '*' and day between s.day - 14 and s.day) k) c0
        where (s.kind = 'up' and c0.extra > 0) or (s.kind = 'down' and c0.extra < 0) order by abs(c0.extra) desc limit 3) c),
    'langs', (select coalesce(jsonb_agg(c order by abs(c.extra) desc), '[]') from (
        select c0.* from (
          select k.lg k, coalesce((select a.sessions from public.admin_daily a where a.day = s.day and a.lg = k.lg and a.ch = '*'), 0) n,
            round(coalesce((select a.sessions from public.admin_daily a where a.day = s.day and a.lg = k.lg and a.ch = '*'), 0)
              - coalesce((select sum(b.sessions) from public.admin_daily b where b.lg = k.lg and b.ch = '*' and b.day between s.day - 14 and s.day - 1), 0) / s.nb::numeric) extra
          from (select distinct lg from public.admin_daily where ch = '*' and lg <> '*' and day between s.day - 14 and s.day) k) c0
        where (s.kind = 'up' and c0.extra > 0) or (s.kind = 'down' and c0.extra < 0) order by abs(c0.extra) desc limit 2) c),
    'posts', (select coalesce(jsonb_agg(p), '[]') from (select platform, post_id, title, url, views, created_at from public.social_posts
        where created_at >= (s.day - 2)::timestamp at time zone 'Europe/Budapest' and created_at < (s.day + 1)::timestamp at time zone 'Europe/Budapest'
        order by (platform = (select a.ch from public.admin_daily a where a.day = s.day and a.lg = '*' and a.ch <> '*'
            order by a.sessions - coalesce((select sum(b.sessions) from public.admin_daily b where b.ch = a.ch and b.lg = '*' and b.day between s.day - 14 and s.day - 1), 0) / s.nb::numeric desc limit 1)) desc,
          views desc nulls last limit 3) p),
    'notes', (select coalesce(jsonb_agg(n.text), '[]') from public.admin_notes n where n.day between s.day - 1 and s.day)
  ) order by s.day desc), '[]') into res from s;
  return res;
end $$;

ALTER FUNCTION "public"."admin_spikes"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_stores"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_days integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650)); a0 date := public.admin_today() - greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  pa0 date := public.admin_today() - 2 * greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650)); res jsonb;
  la date := greatest(least(coalesce((select max(day) from public.store_daily where store = 'apple'), public.admin_today()), public.admin_today()), public.admin_today() - 7);
  lg date := greatest(least(coalesce((select max(day) from public.store_daily where store = 'google'), public.admin_today()), public.admin_today()), public.admin_today() - 7);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'days', v_days,
    'last', jsonb_build_object('apple', (select max(day) from public.store_daily where store = 'apple'), 'google', (select max(day) from public.store_daily where store = 'google')),
    'downloads', coalesce((select jsonb_agg(x order by x.t) from (select day t, sum(downloads) filter (where store = 'apple') apple, sum(redownloads) filter (where store = 'apple') apple_re,
      sum(downloads) filter (where store = 'google') google, sum(uninstalls) filter (where store = 'google') google_un from public.store_daily where day > a0 group by day) x), '[]'),
    'totals', (select jsonb_build_object(
      'apple', coalesce(sum(downloads) filter (where store = 'apple' and day > la - v_days and day <= la), 0), 'apple_re', coalesce(sum(redownloads) filter (where store = 'apple' and day > la - v_days and day <= la), 0),
      'apple_upd', coalesce(sum(updates) filter (where store = 'apple' and day > la - v_days and day <= la), 0),
      'google', coalesce(sum(downloads) filter (where store = 'google' and day > lg - v_days and day <= lg), 0), 'google_un', coalesce(sum(uninstalls) filter (where store = 'google' and day > lg - v_days and day <= lg), 0),
      'google_upd', coalesce(sum(updates) filter (where store = 'google' and day > lg - v_days and day <= lg), 0),
      'apple_prev', coalesce(sum(downloads) filter (where store = 'apple' and day > la - 2 * v_days and day <= la - v_days), 0),
      'google_prev', coalesce(sum(downloads) filter (where store = 'google' and day > lg - 2 * v_days and day <= lg - v_days), 0),
      'apple_all', coalesce(sum(downloads) filter (where store = 'apple'), 0), 'google_all', coalesce(sum(downloads) filter (where store = 'google'), 0),
      'apple_first', min(day) filter (where store = 'apple'), 'google_first', min(day) filter (where store = 'google')) from public.store_daily),
    'countries', coalesce((select jsonb_agg(x) from (select country k, sum(downloads) n from public.store_daily where store = 'apple' and day > la - v_days and day <= la and country <> '' group by 1 order by 2 desc limit 20) x), '[]'),
    'play_countries', coalesce((select jsonb_agg(x) from (select k, sum(n) n from (select m.*, greatest(least(max(m.day) over (), public.admin_today()), public.admin_today() - 7) mx from public.store_metrics m where m.store = 'google' and m.metric = 'installs' and m.dim = 'country') m
      where day > mx - v_days and day <= mx group by 1 order by 2 desc limit 20) x), '[]'),
    'real', jsonb_build_object(
      'apple', coalesce((select jsonb_agg(x order by x.ratings desc nulls last) from (
        select distinct on (d.country) d.country, d.rating, d.ratings, d.day from public.competitor_daily d join public.competitors c on c.app_id = d.app_id and c.mine order by d.country, d.day desc) x), '[]'),
      'google', (select jsonb_build_object('rating', n, 'day', day) from public.store_metrics where store = 'google' and metric = 'rating_total' and dim = '' order by day desc limit 1)),
    'ratings', coalesce((select jsonb_agg(x order by x.store, x.rating) from (select store, rating, count(*) n from public.store_reviews group by 1, 2) x), '[]'),
    'rating_trend', coalesce((select jsonb_agg(x order by x.t) from (select date_trunc('week', created_at)::date t, store, round(avg(rating)::numeric, 2) avg, count(*) n from public.store_reviews
      where created_at > now() - interval '1 year' group by 1, 2) x), '[]'),
    'reviews', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (select store, review_id, created_at, rating, title, body, author, territory, lang, version, reply, replied_at
      from public.store_reviews order by created_at desc nulls last limit 400) x), '[]'),
    'metrics', coalesce((select jsonb_agg(x) from (select store, metric, dim, k,
      case when metric in ('crash_rate', 'anr_rate', 'rating_total', 'rating_daily') then round(avg(n)::numeric, 3) else sum(n) end n
      from (select m.*, greatest(least(max(m.day) over (partition by m.store, m.metric), public.admin_today()), public.admin_today() - 7) mx from public.store_metrics m) m where day > mx - v_days and day <= mx group by 1, 2, 3, 4) x), '[]'),
    'metrics_prev', coalesce((select jsonb_agg(x) from (select store, metric, case when metric in ('crash_rate', 'anr_rate') then round(avg(n)::numeric, 3) else sum(n) end n
      from (select m.*, greatest(least(max(m.day) over (partition by m.store, m.metric), public.admin_today()), public.admin_today() - 7) mx from public.store_metrics m) m where day > mx - 2 * v_days and day <= mx - v_days and dim = '' group by 1, 2) x), '[]'),
    'metric_days', coalesce((select jsonb_agg(x order by x.day) from (select store, metric, day, case when metric in ('crash_rate', 'anr_rate', 'rating_total', 'rating_daily') then avg(n) else sum(n) end n
      from public.store_metrics where day > a0 and dim = '' group by 1, 2, 3) x), '[]'),
    'sync', coalesce((select jsonb_agg(x order by x.at desc) from (select at, source, ok, rows, message from public.sync_log
      where source in ('apple', 'google', 'apple_reviews', 'apple_sales', 'apple_analytics', 'google_reviews', 'google_installs', 'google_quality', 'competitors', 'aso') order by at desc limit 24) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_stores"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_system_alerts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare out jsonb := '[]'; r record; hb timestamptz; db bigint; b numeric; d numeric;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- a scheduled call that did not get a good answer, or a run that failed (the last one of each job)
  for r in select distinct on (j.jobname) j.jobname, c.status, c.timed_out, c.error, c.at,
             (select ok from public.admin_runs x where x.job = c.path order by started_at desc limit 1) run_ok,
             (select message from public.admin_runs x where x.job = c.path order by started_at desc limit 1) run_msg
           from cron.job j join public.admin_cron_calls c on c.path = substring(j.command from 'admin_cron_call\(''([^'']+)''\)')
           where j.jobname like 'admin-%' and j.active and c.done order by j.jobname, c.at desc loop
    if r.timed_out or r.status is null or r.status not between 200 and 299 or r.run_ok = false then
      out := out || jsonb_build_object('c', 'bad', 't', 'Időzített feladat hibával futott: ' || r.jobname,
        's', coalesce(nullif(r.run_msg, ''), case when r.timed_out then 'időtúllépés' when r.status is null then coalesce(r.error, 'nincs válasz') else 'HTTP ' || r.status end), 'to', 'monitor');
    end if;
  end loop;
  hb := (select max(at) from public.uptime_checks);
  if hb is not null and hb < now() - interval '20 minutes' then
    out := out || jsonb_build_object('c', 'bad', 't', 'Leállt a mérés', 's', 'Az elérhetőség-ellenőrzés ' || to_char(hb at time zone 'Europe/Budapest', 'MM.DD. HH24:MI') || ' óta nem futott: a Supabase időzítője áll.', 'to', 'monitor');
  end if;
  db := pg_database_size(current_database());
  if db > 400e6 then
    out := out || jsonb_build_object('c', 'warn', 't', 'Az adatbázis ' || round(db / 1e6) || ' MB', 's', 'Az ingyenes csomag 500 MB-ig tart. Nézd meg a legnagyobb táblákat a Monitoringban.', 'to', 'monitor');
  end if;
  select count(*) filter (where type = 'email.bounced'), count(*) filter (where type in ('email.sent', 'email.delivered')) into b, d from public.email_events where at > now() - interval '7 days';
  if d >= 20 and b / d > 0.05 then
    out := out || jsonb_build_object('c', 'warn', 't', 'Sok visszapattanó e-mail', 's', round(100 * b / d, 1) || '% az elmúlt héten (a jó arány 2% alatt van).', 'to', 'monitor');
  end if;
  for r in select platform, refresh_expires_at from public.social_accounts where platform = 'youtube' and refresh_expires_at is not null and refresh_expires_at < now() + interval '3 days' loop
    out := out || jsonb_build_object('c', 'warn', 't', 'YouTube: a kapcsolat ' || to_char(r.refresh_expires_at at time zone 'Europe/Budapest', 'MM.DD.') || '-n megszakad',
      's', 'A Google „Testing” állapotban 7 naponta lejárt kapcsolatot ad. Kösd be újra, vagy tedd közzé az OAuth-képernyőt.', 'to', 'connect');
  end loop;
  if (select count(*) from public.admin_push_subs where fails >= 3) > 0 then
    out := out || jsonb_build_object('c', 'warn', 't', 'Egy eszköz nem kapja az értesítéseket', 's', 'Többször egymás után sikertelen volt a küldés. Kapcsold ki és be az értesítést azon az eszközön.', 'to', 'system');
  end if;
  if (now() at time zone 'UTC')::time > time '08:00'
     and exists (select 1 from cron.job where jobname = 'admin-digest' and active)
     and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and started_at > date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then
    out := out || jsonb_build_object('c', 'warn', 't', 'Ma nem ment ki a reggeli összefoglaló', 's', 'Nézd meg a Monitoring „Időzített feladatok” sorát.', 'to', 'monitor');
  end if;
  return out;
end $$;

ALTER FUNCTION "public"."admin_system_alerts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_test_results"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(substr(k, 6), v) from public.admin_settings where k like 'test:%'), '{}');
end $$;

ALTER FUNCTION "public"."admin_test_results"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_today"() RETURNS "date"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select (now() at time zone 'Europe/Budapest')::date
$$;

ALTER FUNCTION "public"."admin_today"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_today_more"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare sd date := (select max(day) from public.store_daily where downloads > 0); gd date := least(public.admin_gsc_last(), public.admin_today() - 1);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'downloads', case when sd is null then null else jsonb_build_object('day', sd,
      'apple', (select coalesce(sum(downloads), 0) from public.store_daily where day = sd and store = 'apple'),
      'google', (select coalesce(sum(downloads), 0) from public.store_daily where day = sd and store = 'google'),
      'prev', (select coalesce(sum(downloads), 0) from public.store_daily where day = sd - 1)) end,
    'gsc', case when gd is null then null else jsonb_build_object('day', gd,
      'clicks', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(gd, gd) g), 'impressions', (select coalesce(sum(g.impressions), 0) from public.admin_gsc_days(gd, gd) g),
      'prev', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(gd - 1, gd - 1) g)) end,
    'reviews_today', (select count(*) from public.store_reviews where created_at >= now() - interval '24 hours'));
end $$;

ALTER FUNCTION "public"."admin_today_more"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_token_age"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(k, created_at) from public.admin_secrets), '{}');
end $$;

ALTER FUNCTION "public"."admin_token_age"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_total"("p_k" "text", "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tz constant text := 'Europe/Budapest';
  today date := (now() at time zone tz)::date;
  v0 timestamptz := (today::timestamp at time zone tz);
  past bigint; live bigint;
begin
  select coalesce(sum(case p_k when 'events' then events when 'sessions' then sessions when 'scored' then scored when 'revealed' then revealed when 'shared' then shared end), 0)
    into past from public.admin_daily where day < today and ch = any(coalesce(string_to_array(p_ch, ','), array['*'])) and lg = coalesce(left(p_lang, 2), '*');
  if p_k = 'events' then
    select count(*) into live from public.admin_events(p_ch, p_lang) where created_at >= v0;
  else
    select count(distinct x.session) into live from public.admin_events(p_ch, p_lang) x
    where x.created_at >= v0 and x.session is not null
      and (p_k = 'sessions'
        or (p_k = 'scored' and x.name = 'flow_step' and x.props->>'step' = 'score')
        or (p_k = 'revealed' and x.name = 'reveal_shown')
        or (p_k = 'shared' and x.name in ('share_open','share_save','share_video','reveal_share')))
      and not exists (select 1 from public.events o where o.session = x.session and o.created_at < v0);
  end if;
  return past + live;
end
$$;

ALTER FUNCTION "public"."admin_total"("p_k" "text", "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_touch"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    with s as (select session,
        public.admin_channel((array_agg(props->'src' order by created_at))[1], (array_agg(props->>'ia' order by created_at))[1]) first_ch,
        public.admin_channel((array_agg(props->'src' order by (props ? 'src') desc, created_at desc))[1], (array_agg(props->>'ia' order by created_at desc))[1]) last_ch,
        bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'signup') signed
      from public.events_real where created_at >= now() - make_interval(days => d) and session is not null group by session)
    select k, sum(f) first_sessions, sum(l) last_sessions, sum(fs) first_scored, sum(ls) last_scored, sum(fu) first_signups, sum(lu) last_signups from (
      select first_ch k, 1 f, 0 l, scored::int fs, 0 ls, signed::int fu, 0 lu from s
      union all select last_ch, 0, 1, 0, scored::int, 0, signed::int from s) z group by k) x), '[]');
end $$;

ALTER FUNCTION "public"."admin_touch"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_track_flag_set"("p_on" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_settings (k, v) values ('track_android_ext', to_jsonb(coalesce(p_on, false)))
  on conflict (k) do update set v = excluded.v, updated_at = now();
  perform public.admin_audit_add('meres.android_bovebb', null, jsonb_build_object('be', coalesce(p_on, false)));
  return public.track_flags();
end $$;

ALTER FUNCTION "public"."admin_track_flag_set"("p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_track_query"("p_q" "text", "p_on" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_on then insert into public.admin_tracked_queries (query) values (left(trim(p_q), 200)) on conflict do nothing;
  else delete from public.admin_tracked_queries where query = p_q; end if;
end $$;

ALTER FUNCTION "public"."admin_track_query"("p_q" "text", "p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_traffic"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; res jsonb; tz constant text := 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with s as (select * from public.admin_sess(r.a, r.b, p_ch, p_lang)),
  ps as (select * from public.admin_sess(r.pa, r.a, p_ch, p_lang)),
  su as (select m.* from public.admin_signups_matched(r.a, r.b) m where (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2)) and (p_ch is null or m.ch = any(string_to_array(p_ch, ',')))),
  psu as (select m.* from public.admin_signups_matched(r.pa, r.a) m where (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2)) and (p_ch is null or m.ch = any(string_to_array(p_ch, ',')))),
  pv as (
    select p.platform, p.created_at,
      (select x.views from public.social_post_daily x where x.platform = p.platform and x.post_id = p.post_id and x.day <= (r.b at time zone tz)::date order by x.day desc limit 1) v1,
      (select x.views from public.social_post_daily x where x.platform = p.platform and x.post_id = p.post_id and x.day < (r.a at time zone tz)::date order by x.day desc limit 1) v0,
      (select x.views from public.social_post_daily x where x.platform = p.platform and x.post_id = p.post_id and x.day >= (r.a at time zone tz)::date order by x.day limit 1) vf
    from public.social_posts p),
  lc as (select coalesce(l.post_platform, public.admin_channel(jsonb_build_object('us', l.source))) k, count(*) n
    from public.link_clicks c join public.short_links l on l.code = c.code where c.at >= r.a and c.at < r.b group by 1),
  gd as (select * from public.admin_gsc_days((r.a at time zone tz)::date, (r.b at time zone tz)::date))
  select jsonb_build_object(
    'from', r.a, 'to', r.b, 'days', r.d,
    'channels', coalesce((select jsonb_agg(x order by x.sessions desc, x.signups desc) from (
      select z.k, sum(z.sessions) sessions, sum(z.app) app, sum(z.scored) scored, sum(z.revealed) revealed, sum(z.shared) shared, sum(z.signups) signups,
        sum(z.p_sessions) p_sessions, sum(z.p_scored) p_scored, sum(z.p_signups) p_signups
      from (
        select channel k, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored, count(*) filter (where revealed) revealed,
          count(*) filter (where shared) shared, 0::bigint signups, 0::bigint p_sessions, 0::bigint p_scored, 0::bigint p_signups from s group by 1
        union all select channel, 0, 0, 0, 0, 0, 0, count(*), count(*) filter (where scored), 0 from ps group by 1
        union all select su.ch, 0, 0, 0, 0, 0, count(*), 0, 0, 0 from su where su.ch is not null group by 1
        union all select psu.ch, 0, 0, 0, 0, 0, 0, 0, 0, count(*) from psu where psu.ch is not null group by 1) z
      group by z.k) x), '[]'),
    'known', jsonb_build_object('now', (select count(*) filter (where channel not in ('közvetlen', 'androidapp')) from s), 'all', (select count(*) from s),
      'prev', (select count(*) filter (where channel not in ('közvetlen', 'androidapp')) from ps), 'prev_all', (select count(*) from ps)),
    'duration', (select jsonb_build_object('mean', avg(extract(epoch from t1 - t0)), 'mean_capped', avg(least(extract(epoch from t1 - t0), 1800)),
      'median', percentile_cont(.5) within group (order by extract(epoch from t1 - t0)),
      'p75', percentile_cont(.75) within group (order by extract(epoch from t1 - t0)), 'n', count(*)) from s where n > 1),
    'duration_prev', (select jsonb_build_object('mean', avg(extract(epoch from t1 - t0)), 'mean_capped', avg(least(extract(epoch from t1 - t0), 1800)),
      'median', percentile_cont(.5) within group (order by extract(epoch from t1 - t0))) from ps where n > 1),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select pf k, count(*) n, count(*) filter (where app) app, count(*) filter (where scored) scored from s group by 1) x), '[]'),
    'platforms_prev', coalesce((select jsonb_agg(x) from (select pf k, count(*) n from ps group by 1) x), '[]'),
    'flow', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select channel k, count(*) sessions, count(*) filter (where app) app, count(*) filter (where app and captured) captured, count(*) filter (where app and skipped) skipped,
        count(*) filter (where app and captured and scored) scored, count(*) filter (where app and revealed) revealed, count(*) filter (where app and revealed and shared) shared
      from s group by 1) x), '[]'),
    'signups', jsonb_build_object('n', (select count(*) from su), 'matched', (select count(*) from su where su.session is not null), 'prev', (select count(*) from psu)),
    'campaigns', coalesce((select jsonb_agg(c order by c.sessions desc) from (
      select y.*, (select coalesce(q.title, l.note) from public.short_links l left join public.social_posts q on (q.platform = l.post_platform and q.post_id = l.post_id) or q.code = l.code
                   where l.code = y.content limit 1) post_title,
        (select coalesce(q.platform, l.post_platform) from public.short_links l left join public.social_posts q on (q.platform = l.post_platform and q.post_id = l.post_id) or q.code = l.code
                   where l.code = y.content limit 1) post_platform
      from (select coalesce(nullif(s.src->>'us', ''), '–') source, coalesce(nullif(s.src->>'um', ''), '–') medium, coalesce(nullif(s.src->>'uc', ''), '–') campaign,
          coalesce(nullif(s.src->>'ux', ''), '–') content, count(*) sessions, count(*) filter (where s.scored) scored, count(*) filter (where s.revealed) revealed,
          count(*) filter (where s.shared) shared, count(distinct su.user_id) signups
        from s left join su on su.session = s.session where s.src ?| array['us', 'uc', 'ux'] group by 1, 2, 3, 4 order by 5 desc limit 40) y) c), '[]'),
    'platform_path', coalesce((select jsonb_agg(x) from (
      select pl.k,
        case when pl.k = 'google' then (select coalesce(sum(gd.impressions), 0) from gd)
          when pl.k = 'ai' then null
          else (select coalesce(sum(greatest(0, coalesce(pv.v1, 0) - coalesce(pv.v0, case when pv.created_at >= r.a then 0 else pv.vf end, 0))), 0) from pv where pv.platform = pl.k) end views,
        case when pl.k = 'google' then (select coalesce(sum(gd.clicks), 0) from gd)
          else coalesce((select lc.n from lc where lc.k = pl.k), 0) end clicks,
        (select count(*) from s where s.channel = pl.k) sessions, (select count(*) from s where s.channel = pl.k and s.scored) scored,
        (select count(*) from su where su.ch = pl.k) signups,
        (select count(*) from s where s.channel = pl.k and not (coalesce(s.src, '{}'::jsonb) ?| array['us', 'ux'])) organic
      from unnest(array['tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube', 'google', 'ai']) pl(k)) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_traffic"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_tz_set"("p_tz" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then raise exception 'unknown time zone' using errcode = '22023'; end if;
  insert into public.admin_settings (k, v) values ('digest_tz', to_jsonb(p_tz))
  on conflict (k) do update set v = excluded.v, updated_at = now() where public.admin_settings.v is distinct from excluded.v;
  return jsonb_build_object('tz', p_tz);
end $$;

ALTER FUNCTION "public"."admin_tz_set"("p_tz" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_uptime_target_save"("p_url" "text", "p_on" boolean, "p_label" "text" DEFAULT NULL::"text", "p_ok_max" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_url !~ '^https://[a-z0-9.-]+(/[^\s]*)?$' or length(p_url) > 300 then raise exception 'A cím https://-sel kezdődjön.'; end if;
  if p_on is null then delete from public.uptime_targets where url = p_url; return; end if;
  insert into public.uptime_targets (url, label, ok_max, on_) values (p_url, left(p_label, 60), coalesce(p_ok_max, 399), p_on)
  on conflict (url) do update set on_ = excluded.on_, label = coalesce(excluded.label, public.uptime_targets.label), ok_max = coalesce(p_ok_max, public.uptime_targets.ok_max);
end $_$;

ALTER FUNCTION "public"."admin_uptime_target_save"("p_url" "text", "p_on" boolean, "p_label" "text", "p_ok_max" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_uptime_tick"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare t record;
begin
  update public.uptime_checks u set status = r.status_code,
    ok = (not r.timed_out and r.status_code between 200 and coalesce((select ok_max from public.uptime_targets x where x.url = u.target), 399)),
    ms = null, done = true
  from net._http_response r where r.id = u.req and not u.done;
  update public.uptime_checks set done = true, ok = false, status = 0 where not done and at < now() - interval '4 minutes';
  for t in select url from public.uptime_targets where on_ order by url loop
    insert into public.uptime_checks (target, req) values (t.url, net.http_get(url := t.url, timeout_milliseconds := 15000));
  end loop;
  delete from public.uptime_checks where at < now() - interval '45 days';
  update public.admin_cron_calls c set status = r.status_code, timed_out = r.timed_out, error = left(r.error_msg, 300), done = true
  from net._http_response r where r.id = c.id and not c.done;
  update public.admin_cron_calls set done = true, error = coalesce(error, 'nincs válasz') where not done and at < now() - interval '5 hours';
  update public.admin_runs set finished_at = now(), ok = false, message = 'megszakadt: nem fejeződött be 10 percen belül (időtúllépés vagy összeomlás)'
  where finished_at is null and started_at < now() - interval '10 minutes';
  delete from public.admin_cron_calls where at < now() - case when path like '%only=rules%' then interval '3 days' else interval '60 days' end;
  delete from public.admin_runs where started_at < now() - case when job like '%only=rules%' then interval '3 days' else interval '60 days' end;
end $$;

ALTER FUNCTION "public"."admin_uptime_tick"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_user"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare res jsonb; ca timestamptz := (select created_at from auth.users where id = p_id); mm record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mm from public.admin_signups_matched(ca, ca + interval '1 microsecond') x where x.user_id = p_id limit 1;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.raw_app_meta_data->>'provider' provider,
      u.raw_user_meta_data - 'avatar_url' - 'picture' meta, p.credits, p.gift_claimed from auth.users u left join public.admin_ink_profiles p on p.id = u.id where u.id = p_id) x),
    'match', case when mm.session is null then null else jsonb_build_object('session', right(mm.session, 6), 'ch', mm.ch, 'pf', mm.pf, 'src', mm.src, 'lang', mm.slang) end,
    'visit', public.admin_visit(mm.session),
    'celeb', public.admin_celeb_use(p_id),
    'unlocks', coalesce((select jsonb_agg(x order by x.created_at desc) from (select name_norm, calligrapher, created_at, design is not null has_design from public.admin_ink_unlocks where user_id = p_id) x), '[]'),
    'timeline', coalesce((select jsonb_agg(x order by x.created_at) from (
      select e.created_at, e.name, coalesce(e.props->>'step', e.props->>'scr', e.props->>'k', e.props->>'kind', e.props->>'cta', e.props->>'look') detail, e.props->>'value' val, e.props->>'secs' secs, e.path, e.lang,
        public.admin_channel(e.props->'src', e.props->>'ia') ch
      from public.events_real e where e.session = mm.session
      order by e.created_at limit 400) x), '[]'),
    'days', coalesce((select jsonb_agg(day order by day) from public.admin_user_days where user_id = p_id), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_user"("p_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_user_export"("p_user" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'kiadva', now(),
    'fiok', (select jsonb_build_object('azonosito', u.id, 'email', u.email, 'regisztralt', u.created_at, 'megerositve', u.email_confirmed_at, 'utolso_belepes', u.last_sign_in_at,
       'belepes_modja', u.raw_app_meta_data->>'provider', 'nev', u.raw_user_meta_data->>'display_name', 'nyelv', u.raw_user_meta_data->>'lang') from auth.users u where u.id = p_user),
    'profil', (select jsonb_build_object('kredit', p.credits, 'ajandek_felhasznalva', p.gift_claimed, 'letrehozva', p.created_at) from public.admin_ink_profiles p where p.id = p_user),
    'mentett_elonezetek', coalesce((select jsonb_agg(jsonb_build_object('testresz', x.name_norm, 'elkeszitette', x.calligrapher, 'mentve', x.created_at, 'mi_jelentes', x.design is not null) order by x.created_at) from public.admin_ink_unlocks x where x.user_id = p_user), '[]'),
    'aktiv_napok', coalesce((select jsonb_agg(d.day order by d.day) from public.admin_user_days d where d.user_id = p_user), '[]'));
end $$;

ALTER FUNCTION "public"."admin_user_export"("p_user" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_user_facts"() RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "email" "text", "name" "text", "provider" "text", "confirmed" boolean, "lang" "text", "own" boolean, "days30" integer, "days_prev30" integer, "unl_all" integer, "unl30" integer, "first_unlock_at" timestamp with time zone, "cal" boolean, "design" boolean, "gift" boolean, "credits" integer, "welcomed" boolean, "scored_visit" boolean, "ch" "text", "last_active_at" timestamp with time zone, "online" boolean, "score" integer, "stage" "text", "churn" boolean, "stuck" boolean, "tags" "text"[], "follow_up" "date", "banned" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  b as (
    select u.id, u.created_at, u.email, nullif(u.raw_user_meta_data->>'display_name', '') name, u.raw_app_meta_data->>'provider' provider,
      (u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider' <> 'email') confirmed,
      left(coalesce(nullif(u.raw_user_meta_data->>'lang', ''), m.slang, ''), 2) lang, public.admin_own_uid(u.id) own,
      (select count(*) from public.admin_user_days d where d.user_id = u.id and d.day > public.admin_today() - 30)::int days30,
      (select count(*) from public.admin_user_days d where d.user_id = u.id and d.day > public.admin_today() - 60 and d.day <= public.admin_today() - 30)::int days_prev30,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id)::int unl_all,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id and x.created_at > now() - interval '30 days')::int unl30,
      (select min(x.created_at) from public.admin_ink_unlocks x where x.user_id = u.id) first_unlock_at,
      exists (select 1 from public.admin_ink_unlocks x where x.user_id = u.id and x.calligrapher) cal,
      exists (select 1 from public.admin_ink_unlocks x where x.user_id = u.id and x.design is not null) design,
      coalesce(p.gift_claimed, false) gift, coalesce(p.credits, 0)::int credits,
      u.raw_user_meta_data ? 'welcome_sent_at' welcomed,
      (m.session is not null and exists (select 1 from public.events_real e where e.session = m.session and e.name = 'flow_step' and e.props->>'step' = 'score')) scored_visit,
      m.ch,
      greatest(u.last_sign_in_at, (select max(x.created_at) from public.admin_ink_unlocks x where x.user_id = u.id),
        ((select max(d.day) from public.admin_user_days d where d.user_id = u.id)::timestamp at time zone 'Europe/Budapest'), u.created_at) last_active_at,
      (exists (select 1 from auth.sessions s where s.user_id = u.id and greatest(s.updated_at, s.refreshed_at at time zone 'UTC') > now() - interval '5 minutes')
        or (m.session is not null and exists (select 1 from public.events_real e where e.session = m.session and e.created_at > now() - interval '5 minutes'))) online,
      (u.banned_until is not null and u.banned_until > now()) banned
    from auth.users u left join public.admin_ink_profiles p on p.id = u.id left join m on m.user_id = u.id
  )
  select b.id, b.created_at, b.email, b.name, b.provider, b.confirmed, nullif(b.lang, ''), b.own, b.days30, b.days_prev30, b.unl_all, b.unl30, b.first_unlock_at,
    b.cal, b.design, b.gift, b.credits, b.welcomed, b.scored_visit, b.ch, b.last_active_at, b.online,
    (least(b.days30, 10) * 4 + least(b.unl30, 5) * 5
      + case when b.last_active_at > now() - interval '1 day' then 20 when b.last_active_at > now() - interval '7 days' then 12 when b.last_active_at > now() - interval '30 days' then 5 else 0 end
      + least(15, 3 * (b.confirmed::int + b.gift::int + b.cal::int + b.design::int + b.scored_visit::int)))::int score,
    case when b.created_at > now() - interval '7 days' then 'uj'
      when b.last_active_at < now() - interval '30 days' then 'alvo'
      when b.last_active_at < now() - interval '7 days' then 'veszelyben'
      when b.unl_all = 0 and not b.gift then 'probalgatja'
      else 'aktiv' end stage,
    ((b.days_prev30 >= 3 or b.unl_all >= 2) and b.last_active_at < now() - interval '7 days' and b.last_active_at >= now() - interval '30 days') churn,
    (b.created_at < now() - interval '3 days' and b.created_at > now() - interval '30 days' and b.unl_all = 0) stuck,
    coalesce((select array_agg(distinct t) from public.admin_user_notes n, unnest(n.tags) t where n.user_id = b.id), '{}'),
    (select min(n.follow_up) from public.admin_user_notes n where n.user_id = b.id and n.done_at is null and n.follow_up is not null),
    b.banned
  from b
$$;

ALTER FUNCTION "public"."admin_user_facts"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_user_more"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare mm record; ca timestamptz := (select created_at from auth.users where id = p_id);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mm from public.admin_signups_matched(ca, ca + interval '1 microsecond') x where x.user_id = p_id limit 1;
  return jsonb_build_object(
    'facts', (select to_jsonb(f) - 'email' from public.admin_user_facts() f where f.id = p_id),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.done_at nulls first, n.created_at desc) from public.admin_user_notes n where n.user_id = p_id), '[]'),
    'audit', coalesce((select jsonb_agg(to_jsonb(a) order by a.at desc) from (select * from public.admin_audit where target = p_id::text order by at desc limit 50) a), '[]'),
    'landing', (select jsonb_build_object('path', e.path, 'title', (select s.title from public.seo_pages s where s.url like '%' || split_part(e.path, '?', 1) order by length(s.url) limit 1))
      from public.events_real e where e.session = mm.session order by e.created_at limit 1),
    'timeline', coalesce((select jsonb_agg(x order by x.at desc) from (
      select ca at, 'signup' k, coalesce(mm.ch, '') d
      union all select (d.day::timestamp at time zone 'Europe/Budapest') + interval '12 hours', 'active', '' from public.admin_user_days d where d.user_id = p_id
      union all select x.created_at, 'unlock', x.name_norm || case when x.calligrapher then ' · elkészíttette' else '' end from public.admin_ink_unlocks x where x.user_id = p_id
      union all select (u.raw_user_meta_data->>'welcome_sent_at')::timestamptz, 'welcome', '' from auth.users u where u.id = p_id and u.raw_user_meta_data ? 'welcome_sent_at'
      union all select u.email_confirmed_at, 'confirmed', '' from auth.users u where u.id = p_id and u.email_confirmed_at is not null and u.raw_app_meta_data->>'provider' = 'email'
      union all select n.created_at, 'note', left(n.body, 120) from public.admin_user_notes n where n.user_id = p_id
      union all select a.at, 'admin', a.action from public.admin_audit a where a.target = p_id::text and a.action not like 'jegyzet.%'
    ) x where x.at is not null), '[]'));
end $$;

ALTER FUNCTION "public"."admin_user_more"("p_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_user_suspend"("p_user" "uuid", "p_on" boolean, "p_reason" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.admin_own_uid(p_user) then raise exception 'A saját fiókodat nem függesztheted fel.'; end if;
  update auth.users set banned_until = case when p_on then 'infinity'::timestamptz end where id = p_user;
  if p_on then delete from auth.sessions where user_id = p_user; delete from auth.refresh_tokens where user_id = p_user::text; end if;
  perform public.admin_audit_add(case when p_on then 'fiok.felfuggesztes' else 'fiok.visszaallitas' end, p_user::text, jsonb_build_object('ok', left(p_reason, 200)));
end $$;

ALTER FUNCTION "public"."admin_user_suspend"("p_user" "uuid", "p_on" boolean, "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_users"("p_q" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_filter" "text" DEFAULT 'all'::"text", "p_lang" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT NULL::"text", "p_ch" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%'; res jsonb; today date := public.admin_today();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  u as (
    select u.id, u.created_at, u.email, nullif(u.raw_user_meta_data->>'display_name', '') name,
      u.raw_app_meta_data->>'provider' provider,
      (u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider' <> 'email') confirmed,
      coalesce(nullif(u.raw_user_meta_data->>'lang', ''), m.slang) lang, (nullif(u.raw_user_meta_data->>'lang', '') is null and m.slang is not null) lang_from_visit,
      u.last_sign_in_at, m.ch, m.pf, m.code,
      u.raw_user_meta_data ? 'welcome_sent_at' welcomed, u.raw_user_meta_data->>'welcome_sent_at' welcome_at,
      coalesce(p.credits, 0) credits, coalesce(p.gift_claimed, false) gift_claimed,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id) unlocks,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id and x.calligrapher) pro,
      (select max(x.created_at) from public.admin_ink_unlocks x where x.user_id = u.id) last_unlock,
      (select count(*) from public.admin_user_days x where x.user_id = u.id) active_days,
      (select max(x.day) from public.admin_user_days x where x.user_id = u.id) last_active,
      exists (select 1 from public.admins ad where ad.user_id = u.id) is_admin,
      public.admin_own_uid(u.id) own
    from auth.users u left join public.admin_ink_profiles p on p.id = u.id left join m on m.user_id = u.id
    where (lower(coalesce(u.email, '')) like q or lower(coalesce(u.raw_user_meta_data->>'display_name', '')) like q or u.id::text like q)
  ), f as (
    select * from u where (own = (p_filter = 'own')) and case p_filter
      when 'unconfirmed' then not confirmed
      when 'unlocked' then unlocks > 0
      when 'pro' then pro > 0
      when 'credits' then credits > 0
      when 'active7' then last_active >= today - 6
      when 'dormant' then coalesce(last_active, (created_at at time zone 'Europe/Budapest')::date) < today - 30
      else true end
      and (p_lang is null or left(coalesce(lang, ''), 2) = left(p_lang, 2))
      and (p_provider is null or provider = p_provider)
      and (p_ch is null or coalesce(ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
  )
  select jsonb_build_object('total', (select count(*) from f), 'own', (select count(*) from u where own),
    'rows', coalesce((select jsonb_agg(x) from (select * from f order by created_at desc limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)) x), '[]'))
  into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_users"("p_q" "text", "p_limit" integer, "p_offset" integer, "p_filter" "text", "p_lang" "text", "p_provider" "text", "p_ch" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_users_stats"("p_days" integer DEFAULT 30, "p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_lang" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT NULL::"text", "p_ch" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r record; res jsonb; today date := public.admin_today();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  u as (select x.id, x.created_at, x.email_confirmed_at, coalesce(x.raw_app_meta_data->>'provider', '?') prov, coalesce(left(coalesce(nullif(x.raw_user_meta_data->>'lang', ''), m.slang), 2), '?') lg,
      coalesce(m.ch, 'ismeretlen') ch, coalesce(m.pf, 'ismeretlen') pf, m.session is not null matched, x.raw_user_meta_data ? 'welcome_sent_at' welcomed,
      (x.created_at at time zone 'Europe/Budapest')::date d0
    from public.admin_real_users x left join m on m.user_id = x.id),
  uf as (select * from u where (p_lang is null or lg = left(p_lang, 2)) and (p_provider is null or prov = p_provider) and (p_ch is null or ch = any(string_to_array(p_ch, ',')))),
  up as (select * from uf where created_at >= r.a and created_at < r.b),
  la as (select ud.user_id, max(ud.day) as day from public.admin_user_days ud join uf on uf.id = ud.user_id group by 1)
  select jsonb_build_object('days', r.d, 'filtered', p_lang is not null or p_provider is not null or p_ch is not null,
    'total', (select count(*) from uf), 'signups', (select count(*) from up), 'signups_prev', (select count(*) from uf where created_at >= r.pa and created_at < r.a),
    'confirmed', (select count(*) from uf where email_confirmed_at is not null or prov <> 'email'),
    'unconfirmed', (select count(*) from uf where email_confirmed_at is null and prov = 'email'),
    'confirmed_p', (select count(*) from up where email_confirmed_at is not null or prov <> 'email'),
    'unconfirmed_p', (select count(*) from up where email_confirmed_at is null and prov = 'email'),
    'confirm_median_min', (select percentile_cont(.5) within group (order by extract(epoch from email_confirmed_at - created_at) / 60) from up where email_confirmed_at is not null and prov = 'email'),
    'confirm_median_all', (select percentile_cont(.5) within group (order by extract(epoch from email_confirmed_at - created_at) / 60) from uf where email_confirmed_at is not null and prov = 'email'),
    'welcome_sent', (select count(*) from up where welcomed),
    'providers', coalesce((select jsonb_agg(x order by x.n desc) from (select prov k, count(*) n from up group by 1) x), '[]'),
    'providers_all', coalesce((select jsonb_agg(x order by x.n desc) from (select prov k, count(*) n from uf group by 1) x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (select lg k, count(*) n from up group by 1) x), '[]'),
    'sources', coalesce((select jsonb_agg(x order by x.n desc) from (select ch k, count(*) n from up group by 1) x), '[]'),
    'sources_all', coalesce((select jsonb_agg(x order by x.n desc) from (select ch k, count(*) n from u group by 1) x), '[]'),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select pf k, count(*) n from up group by 1) x), '[]'),
    'matched', (select count(*) from up where matched),
    'active_1', (select count(*) from la where day >= today), 'active_7', (select count(*) from la where day >= today - 6), 'active_30', (select count(*) from la where day >= today - 29),
    'returned_1d', (select count(*) from uf where d0 + 1 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = uf.id and ud.day >= uf.d0 + 1)),
    'eligible_1d', (select count(*) from uf where d0 + 1 <= today),
    'returned_7d', (select count(*) from uf where d0 + 7 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = uf.id and ud.day >= uf.d0 + 7)),
    'eligible_7d', (select count(*) from uf where d0 + 7 <= today),
    'returned_1d_p', (select count(*) from up where d0 + 1 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = up.id and ud.day >= up.d0 + 1)),
    'eligible_1d_p', (select count(*) from up where d0 + 1 <= today),
    'returned_7d_p', (select count(*) from up where d0 + 7 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = up.id and ud.day >= up.d0 + 7)),
    'eligible_7d_p', (select count(*) from up where d0 + 7 <= today),
    'cum', coalesce((select jsonb_agg(x order by x.t) from (select (created_at at time zone 'Europe/Budapest')::date t, count(*) n from up group by 1) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_users_stats"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text", "p_provider" "text", "p_ch" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_viral"("p_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ch" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare b timestamptz := coalesce(p_to, now()); a timestamptz := coalesce(p_from, coalesce(p_to, now()) - interval '30 days'); pa timestamptz; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  pa := a - (b - a);
  with ev as (
    select * from public.admin_events(p_ch, p_lang) where created_at >= pa and created_at < b and session is not null
  ), s as (
    select session, min(created_at) t0, (array_agg(props->'src' order by created_at) filter (where props ? 'src'))[1] src,
      (array_agg(props->>'ia' order by created_at) filter (where props ? 'ia'))[1] ia,
      bool_or(name = 'flow_step' and props->>'step' = 'score') scored,
      bool_or(name = 'share_open' or name = 'reveal_share') opened,
      bool_or(name in ('share_save', 'share_video')) saved,
      bool_or(name in ('share_open', 'share_save', 'share_video', 'reveal_share')) shared
    from ev group by session
  ), r as (
    /* a visit that came back through a shared card: utm_source=share (the kind of card in utm_medium), or the old ?ref= */
    select s.*, case when lower(coalesce(src->>'us', '')) = 'share' then coalesce(nullif(src->>'um', ''), 'card') else coalesce(src->>'ref', '?') end kind,
      case when src->>'from' ilike '%instagram%' then 'Instagram' when src->>'from' ilike '%tiktok%' then 'TikTok'
           when src->>'from' ilike '%whatsapp%' or src->>'from' ilike '%wa.me%' then 'WhatsApp' when src->>'from' ilike '%messenger%' or src->>'from' ilike '%m.me%' then 'Messenger'
           when src->>'from' ilike '%facebook%' or src->>'from' ilike '%fb.%' then 'Facebook' when src->>'from' ilike '%t.me%' or src->>'from' ilike '%telegram%' then 'Telegram'
           when src->>'from' ilike '%snapchat%' then 'Snapchat' when src->>'from' ilike any (array['%t.co%', '%twitter%', '%x.com%']) then 'X'
           when src->>'from' ilike '%threads%' then 'Threads' when src->>'from' ilike '%pinterest%' then 'Pinterest'
           when src->>'from' ilike '%mail%' then 'E-mail' when src->>'from' is not null then 'Más oldal'
           when nullif(ia, '') is not null then initcap(ia) else 'Közvetlen (üzenet, másolt link)' end via
    from s where lower(coalesce(src->>'us', '')) = 'share' or src ? 'ref'
  ), per as (
    select (t0 >= a) cur, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where shared) shared,
      count(*) filter (where opened) opened, count(*) filter (where saved) saved, count(*) filter (where scored and shared) scored_shared from s group by 1
  ), rper as (
    select (t0 >= a) cur, count(*) back, count(*) filter (where scored) back_scored, count(*) filter (where shared) back_shared from r group by 1
  ), opens as (
    select coalesce(props->>'kind', '?') kind, coalesce(props->>'fmt', '') fmt, name, count(*) n from ev where created_at >= a and name in ('share_open', 'share_save', 'share_video', 'reveal_share') group by 1, 2, 3
  )
  select jsonb_build_object(
    'from', a, 'to', b,
    'now', coalesce((select to_jsonb(per) - 'cur' from per where cur), '{}') || coalesce((select to_jsonb(rper) - 'cur' from rper where cur), '{}'),
    'prev', coalesce((select to_jsonb(per) - 'cur' from per where not cur), '{}') || coalesce((select to_jsonb(rper) - 'cur' from rper where not cur), '{}'),
    'daily', coalesce((select jsonb_agg(x order by x.t) from (
        select t, sum(shared) shared, sum(back) back from (
          select date_trunc('day', t0 at time zone 'Europe/Budapest') t, count(*) filter (where shared) shared, 0 back from s where t0 >= a group by 1
          union all select date_trunc('day', t0 at time zone 'Europe/Budapest'), 0, count(*) from r where t0 >= a group by 1) u group by t) x), '[]'),
    /* card kind: how often it was opened and saved, and how many came back through it */
    'kinds', coalesce((select jsonb_agg(x order by x.back desc, x.opens desc) from (
        select k.kind k, coalesce((select sum(n) from opens o where o.kind = k.kind and o.name in ('share_open', 'reveal_share')), 0) opens,
          coalesce((select sum(n) from opens o where o.kind = k.kind and o.name in ('share_save', 'share_video')), 0) saves,
          (select count(*) from r where r.kind = k.kind and r.t0 >= a) back, (select count(*) from r where r.kind = k.kind and r.t0 >= a and r.scored) back_scored
        from (select kind from opens union select kind from r where t0 >= a) k) x), '[]'),
    'fmts', coalesce((select jsonb_agg(x order by x.n desc) from (select fmt k, sum(n) n from opens where name = 'share_open' and fmt <> '' group by 1) x), '[]'),
    'via', coalesce((select jsonb_agg(x order by x.n desc) from (select via k, count(*) n, count(*) filter (where scored) scored from r where t0 >= a group by 1) x), '[]')
  ) into res;
  return res;
end $$;

ALTER FUNCTION "public"."admin_viral"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_visit"("p_session" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $_$
  select case when p_session is null then null else (select jsonb_build_object(
    'first_at', min(e.created_at), 'last_at', max(e.created_at), 'secs', extract(epoch from max(e.created_at) - min(e.created_at))::int, 'n', count(*),
    'live', max(e.created_at) > now() - interval '5 minutes',
    'pages', count(*) filter (where e.name = 'landing_view'),
    'opened', coalesce(bool_or(e.name = 'app_open'), false),
    'sign', (array_agg(e.props->>'value' order by e.created_at desc) filter (where e.name = 'quiz_answer' and e.props->>'step' = 'sign' and e.props ? 'value'))[1],
    'captured', coalesce(bool_or(e.name = 'signature_captured'), false),
    'skipped', coalesce(bool_or(e.name = 'capture_skipped'), false),
    'scored', coalesce(bool_or(e.name = 'score_shown' or (e.name = 'flow_step' and e.props->>'step' = 'score')), false),
    'quiz', coalesce(bool_or(e.name = 'quiz_start'), false),
    'style', (array_agg(e.props->>'value' order by e.created_at desc) filter (where e.name = 'quiz_answer' and e.props->>'step' = 'style'))[1],
    'celeb', count(*) filter (where e.name = 'ai_design'),
    'revealed', coalesce(bool_or(e.name = 'reveal_shown'), false),
    'detail', count(*) filter (where e.name = 'detail_open'),
    'shared', coalesce(bool_or(e.name in ('share_open', 'share_save', 'share_video', 'reveal_share')), false),
    'files', count(*) filter (where e.name = 'pro_file'),
    'errors', count(*) filter (where e.name in ('client_error', 'storage_full', 'signin_failed', 'auth_error')),
    'last_step', (array_agg(e.props->>'step' order by e.created_at desc) filter (where e.name = 'flow_step'))[1],
    'timed', coalesce(bool_or(e.name = 'screen_time'), false),
    'result_secs', coalesce(sum((e.props->>'secs')::int) filter (where e.name = 'screen_time' and e.props->>'scr' in ('rev', 'picks', 'det') and e.props->>'secs' ~ '^[0-9]+$'), 0),
    'last_scr', (array_agg(e.props->>'scr' order by e.created_at desc) filter (where e.name = 'screen_time'))[1],
    'left_how', (array_agg(e.props->>'how' order by e.created_at desc) filter (where e.name = 'screen_time'))[1],
    'shots', count(*) filter (where e.name = 'screenshot_key'),
    'shot_scr', (array_agg(e.props->>'scr' order by e.created_at desc) filter (where e.name = 'screenshot_key'))[1],
    'screens', (select coalesce(jsonb_object_agg(x.scr, x.secs), '{}') from (select e2.props->>'scr' scr, sum((e2.props->>'secs')::int) secs from public.events_real e2
      where e2.session = p_session and e2.name = 'screen_time' and e2.props->>'secs' ~ '^[0-9]+$' group by 1) x))
    from public.events_real e where e.session = p_session) end
$_$;

ALTER FUNCTION "public"."admin_visit"("p_session" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.competitor_daily (app_id, day, country, rating, ratings, version, price)
  select r.app_id, r.day, coalesce(r.country, 'us'), r.rating, r.ratings, r.version, r.price from jsonb_populate_recordset(null::public.competitor_daily, p_rows) r
  where exists (select 1 from public.competitors c where c.app_id = r.app_id)
  on conflict (app_id, day, country) do update set rating = excluded.rating, ratings = excluded.ratings, version = excluded.version, price = excluded.price;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.competitors (app_id, name, developer, icon, url, mine)
  select r.app_id, r.name, r.developer, r.icon, r.url, coalesce(r.mine, false) from jsonb_populate_recordset(null::public.competitors, p_rows) r
  on conflict (app_id) do update set name = excluded.name, developer = excluded.developer, icon = excluded.icon, url = excluded.url, mine = excluded.mine;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_cwv"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_cwv select r.url, r.form, r.day, r.perf, r.lcp, r.inp, r.cls, r.fcp, r.ttfb, r.field from jsonb_populate_recordset(null::public.admin_cwv, p_rows) r
  on conflict (url, form, day) do update set perf = excluded.perf, lcp = excluded.lcp, inp = excluded.inp, cls = excluded.cls, fcp = excluded.fcp, ttfb = excluded.ttfb, field = excluded.field;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_cwv"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_digest_sent"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz text := coalesce((select v #>> '{}' from public.admin_settings where k = 'digest_tz'), 'Europe/Budapest');
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_settings (k, v) values ('digest_sent', to_jsonb(((now() at time zone tz)::date)::text))
  on conflict (k) do update set v = excluded.v, updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_w_digest_sent"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare k integer; pk text; cols text; upd text;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_table not in ('gsc_totals', 'gsc_search_type', 'gsc_sitemaps', 'seo_health', 'competitor_aso') then raise exception 'table not allowed: %', p_table; end if;
  if jsonb_array_length(coalesce(p_rows, '[]')) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ', ') into pk from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = ('public.' || p_table)::regclass and i.indisprimary;
  select string_agg(quote_ident(attname), ', '), string_agg(format('%I = excluded.%I', attname, attname), ', ') filter (where not (attname = any (string_to_array(replace(pk, '"', ''), ', '))))
    into cols, upd from pg_attribute where attrelid = ('public.' || p_table)::regclass and attnum > 0 and not attisdropped
      and attname in (select jsonb_object_keys(p_rows->0));
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
    p_table, cols, cols, p_table, pk, case when upd is null then 'nothing' else 'update set ' || upd end) using p_rows;
  get diagnostics k = row_count; return k;
end $_$;

ALTER FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.gsc_daily (day, query, page, country, device, clicks, impressions, position)
  select r.day, r.query, r.page, r.country, r.device, coalesce(r.clicks, 0), coalesce(r.impressions, 0), r.position from jsonb_populate_recordset(null::public.gsc_daily, p_rows) r
  on conflict (day, query, page, country, device) do update set clicks = excluded.clicks, impressions = excluded.impressions, position = excluded.position;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_gsc_index"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.gsc_index (url, verdict, coverage, indexing, fetch_state, robots, last_crawl, canonical_google, canonical_user, mobile, checked_at)
  select r.url, r.verdict, r.coverage, r.indexing, r.fetch_state, r.robots, r.last_crawl, r.canonical_google, r.canonical_user, r.mobile, coalesce(r.checked_at, now())
  from jsonb_populate_recordset(null::public.gsc_index, p_rows) r
  on conflict (url) do update set
    prev_verdict = case when public.gsc_index.verdict is distinct from excluded.verdict then public.gsc_index.verdict else public.gsc_index.prev_verdict end,
    changed_at = case when public.gsc_index.verdict is distinct from excluded.verdict then now() else public.gsc_index.changed_at end,
    verdict = excluded.verdict, coverage = excluded.coverage, indexing = excluded.indexing, fetch_state = excluded.fetch_state,
    robots = excluded.robots, last_crawl = excluded.last_crawl, canonical_google = excluded.canonical_google, canonical_user = excluded.canonical_user,
    mobile = excluded.mobile, checked_at = excluded.checked_at;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_gsc_index"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_inbox_flag"("p_token" "text", "p_source" "text", "p_item" "text", "p_hidden" boolean, "p_liked" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.inbox_items set hidden = coalesce(p_hidden, hidden), liked = coalesce(p_liked, liked), done = done or coalesce(p_hidden, false), updated_at = now()
  where source = p_source and item_id = p_item;
end $$;

ALTER FUNCTION "public"."admin_w_inbox_flag"("p_token" "text", "p_source" "text", "p_item" "text", "p_hidden" boolean, "p_liked" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_inbox_items"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.inbox_items (source, item_id, kind, post_id, post_title, post_url, post_thumb, author, body, rating, lang, created_at, reply, replied_at, done, updated_at)
  select r.source, r.item_id, coalesce(r.kind, 'comment'), r.post_id, r.post_title, r.post_url, r.post_thumb, r.author, r.body, r.rating, r.lang, r.created_at, r.reply, r.replied_at,
    coalesce(r.reply is not null, false), now()
  from jsonb_populate_recordset(null::public.inbox_items, p_rows) r
  on conflict (source, item_id) do update set body = excluded.body, rating = excluded.rating, post_title = coalesce(excluded.post_title, public.inbox_items.post_title),
    post_thumb = coalesce(excluded.post_thumb, public.inbox_items.post_thumb), reply = coalesce(excluded.reply, public.inbox_items.reply),
    replied_at = coalesce(excluded.replied_at, public.inbox_items.replied_at), done = public.inbox_items.done or excluded.reply is not null, updated_at = now();
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_inbox_items"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_inbox_reply"("p_token" "text", "p_source" "text", "p_item" "text", "p_reply" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.inbox_items set reply = p_reply, replied_at = now(), done = true, updated_at = now() where source = p_source and item_id = p_item;
end $$;

ALTER FUNCTION "public"."admin_w_inbox_reply"("p_token" "text", "p_source" "text", "p_item" "text", "p_reply" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_key"("p_token" "text", "p_name" "text", "p_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare sid uuid;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_name not in ('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY') then raise exception 'not allowed: %', p_name; end if;
  select id into sid from vault.secrets where name = 'inkage_admin.' || p_name;
  if sid is null then perform vault.create_secret(p_value, 'inkage_admin.' || p_name, 'InkAge Irányítóközpont');
  else perform vault.update_secret(sid, p_value); end if;
end $$;

ALTER FUNCTION "public"."admin_w_key"("p_token" "text", "p_name" "text", "p_value" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.sync_log (source, ok, rows, message) values (left(p_source, 40), p_ok, p_rows, left(coalesce(p_message, ''), 500));
end $$;

ALTER FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_plan_claim"("p_token" "text", "p_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k int;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.content_plans set publishing_at = now() where id = p_id and published_at is null and (publishing_at is null or publishing_at < now() - interval '5 minutes');
  get diagnostics k = row_count;
  return k > 0;
end $$;

ALTER FUNCTION "public"."admin_w_plan_claim"("p_token" "text", "p_id" bigint) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_plan_result"("p_token" "text", "p_id" bigint, "p_results" "jsonb", "p_done" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare res jsonb;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  select results || coalesce(p_results, '{}') into res from public.content_plans where id = p_id;
  /* "Kint van" only when at least one platform took it; otherwise "Hiba", and the plan can be sent again */
  update public.content_plans set results = res, publishing_at = null,
    published_at = case when p_done and exists (select 1 from jsonb_each(res) e where coalesce((e.value->>'ok')::boolean, false)) then now() else published_at end,
    status = case when not p_done then status when exists (select 1 from jsonb_each(res) e where coalesce((e.value->>'ok')::boolean, false)) then 'kint' else 'hiba' end,
    publish = case when p_done then false else publish end, updated_at = now() where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_w_plan_result"("p_token" "text", "p_id" bigint, "p_results" "jsonb", "p_done" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_push_result"("p_token" "text", "p_endpoint" "text", "p_ok" boolean, "p_gone" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_gone then delete from public.admin_push_subs where endpoint = p_endpoint; return; end if;
  update public.admin_push_subs set last_ok = case when p_ok then now() else last_ok end, fails = case when p_ok then 0 else fails + 1 end where endpoint = p_endpoint;
  delete from public.admin_push_subs where endpoint = p_endpoint and fails >= 5;
end $$;

ALTER FUNCTION "public"."admin_w_push_result"("p_token" "text", "p_endpoint" "text", "p_ok" boolean, "p_gone" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_push_sent"("p_token" "text", "p_kind" "text", "p_key" "text", "p_title" "text", "p_body" "text", "p_url" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_push_sent (kind, key, title, body, url) values (p_kind, left(p_key, 200), left(p_title, 120), left(p_body, 300), left(p_url, 200)) on conflict do nothing;
  get diagnostics k = row_count; return k > 0;
end $$;

ALTER FUNCTION "public"."admin_w_push_sent"("p_token" "text", "p_kind" "text", "p_key" "text", "p_title" "text", "p_body" "text", "p_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare k integer; pk text; cols text; upd text;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_table not in ('seo_pages', 'kw_ideas', 'gsc_appearance', 'bing_daily', 'bing_links', 'competitor_pages', 'social_competitor_daily', 'brand_mentions',
    'ai_visibility', 'google_updates', 'admin_releases', 'email_events', 'cert_status', 'cse_ranks') then raise exception 'table not allowed: %', p_table; end if;
  if jsonb_array_length(coalesce(p_rows, '[]')) = 0 then return 0; end if;
  select string_agg(quote_ident(a.attname), ', ') into pk from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = ('public.' || p_table)::regclass and i.indisprimary;
  select string_agg(quote_ident(attname), ', '), string_agg(format('%I = excluded.%I', attname, attname), ', ') filter (where not (attname = any (string_to_array(replace(pk, '"', ''), ', '))))
    into cols, upd from pg_attribute where attrelid = ('public.' || p_table)::regclass and attnum > 0 and not attisdropped
      and attname in (select jsonb_object_keys(p_rows->0));
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
    p_table, cols, cols, p_table, pk, case when upd is null then 'nothing' else 'update set ' || upd end) using p_rows;
  get diagnostics k = row_count; return k;
end $_$;

ALTER FUNCTION "public"."admin_w_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_runs set finished_at = now(), ok = p_ok, message = left(coalesce(p_message, ''), 500) where id = p_id;
end $$;

ALTER FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text" DEFAULT 'cron'::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare rid bigint;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_runs (job, via) values (left(p_job, 200), left(coalesce(p_via, 'cron'), 20)) returning id into rid;
  return rid;
end $$;

ALTER FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.seo_pages where checked_at >= p_before) then return 0; end if;
  delete from public.seo_pages where checked_at < p_before;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  /* a row of an earlier day can carry only some numbers (yesterday's reach, a day's watch time): the rest stays */
  insert into public.social_account_daily (platform, day, followers, following, likes, posts, impressions, reach, profile_views, views, watch_min, gained, lost, clicks, shares, impressions_30d, views_total)
  select r.platform, r.day, r.followers, r.following, r.likes, r.posts, r.impressions, r.reach, r.profile_views, r.views, r.watch_min, r.gained, r.lost, r.clicks, r.shares, r.impressions_30d, r.views_total
  from jsonb_populate_recordset(null::public.social_account_daily, p_rows) r
  on conflict (platform, day) do update set followers = coalesce(excluded.followers, public.social_account_daily.followers),
    following = coalesce(excluded.following, public.social_account_daily.following), likes = coalesce(excluded.likes, public.social_account_daily.likes),
    posts = coalesce(excluded.posts, public.social_account_daily.posts), impressions = coalesce(excluded.impressions, public.social_account_daily.impressions),
    reach = coalesce(excluded.reach, public.social_account_daily.reach), profile_views = coalesce(excluded.profile_views, public.social_account_daily.profile_views),
    views = coalesce(excluded.views, public.social_account_daily.views), watch_min = coalesce(excluded.watch_min, public.social_account_daily.watch_min),
    gained = coalesce(excluded.gained, public.social_account_daily.gained), lost = coalesce(excluded.lost, public.social_account_daily.lost),
    clicks = coalesce(excluded.clicks, public.social_account_daily.clicks), shares = coalesce(excluded.shares, public.social_account_daily.shares),
    impressions_30d = coalesce(excluded.impressions_30d, public.social_account_daily.impressions_30d),
    views_total = coalesce(excluded.views_total, public.social_account_daily.views_total);
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer; r public.social_accounts := jsonb_populate_record(null::public.social_accounts, p_set);
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.social_accounts a set
    username = case when p_set ? 'username' then r.username else a.username end,
    display_name = case when p_set ? 'display_name' then r.display_name else a.display_name end,
    avatar_url = case when p_set ? 'avatar_url' then r.avatar_url else a.avatar_url end,
    access_token = case when p_set ? 'access_token' then r.access_token else a.access_token end,
    refresh_token = case when p_set ? 'refresh_token' then r.refresh_token else a.refresh_token end,
    token_expires_at = case when p_set ? 'token_expires_at' then r.token_expires_at else a.token_expires_at end,
    refresh_expires_at = case when p_set ? 'refresh_expires_at' then r.refresh_expires_at else a.refresh_expires_at end,
    last_sync_at = case when p_set ? 'last_sync_at' then r.last_sync_at else a.last_sync_at end,
    last_error = case when p_set ? 'last_error' then r.last_error else a.last_error end
  where a.platform = p_platform;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_accounts (platform, account_id, access_token, refresh_token, token_expires_at, refresh_expires_at, scopes, connected_at, last_error)
  select r.platform, r.account_id, r.access_token, r.refresh_token, r.token_expires_at, r.refresh_expires_at, r.scopes, coalesce(r.connected_at, now()), r.last_error
  from jsonb_populate_recordset(null::public.social_accounts, p_rows) r
  on conflict (platform) do update set account_id = excluded.account_id, access_token = excluded.access_token, refresh_token = excluded.refresh_token,
    token_expires_at = excluded.token_expires_at, refresh_expires_at = excluded.refresh_expires_at, scopes = excluded.scopes,
    connected_at = excluded.connected_at, last_error = excluded.last_error;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_audience"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_audience select r.platform, r.breakdown, r.k, r.n, now() from jsonb_populate_recordset(null::public.social_audience, p_rows) r
  on conflict (platform, breakdown, k) do update set n = excluded.n, updated_at = now();
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_audience"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare s jsonb; d timestamptz; t timestamptz;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_platform !~ '^[a-z]{2,12}$' then raise exception 'bad platform'; end if;
  insert into public.admin_settings (k, v) values ('sync:social', '{}') on conflict (k) do nothing;
  select v into s from public.admin_settings where k = 'sync:social' for update;
  d := nullif(s->>('daily_' || p_platform), '')::timestamptz;
  t := nullif(s->>('try_' || p_platform), '')::timestamptz;
  if (d is not null and d > now() - interval '23 hours') or (t is not null and t > now() - interval '30 minutes') then return false; end if;
  update public.admin_settings set v = v || jsonb_build_object('try_' || p_platform, now()), updated_at = now() where k = 'sync:social';
  return true;
end $_$;

ALTER FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_post_daily (platform, post_id, day, views, likes, comments, shares, saves, reach, impressions, clicks)
  select r.platform, r.post_id, r.day, r.views, r.likes, r.comments, r.shares, r.saves, r.reach, r.impressions, r.clicks from jsonb_populate_recordset(null::public.social_post_daily, p_rows) r
  on conflict (platform, post_id, day) do update set views = coalesce(excluded.views, public.social_post_daily.views), likes = coalesce(excluded.likes, public.social_post_daily.likes),
    comments = coalesce(excluded.comments, public.social_post_daily.comments), shares = coalesce(excluded.shares, public.social_post_daily.shares),
    saves = coalesce(excluded.saves, public.social_post_daily.saves), reach = coalesce(excluded.reach, public.social_post_daily.reach),
    impressions = coalesce(excluded.impressions, public.social_post_daily.impressions),
    clicks = coalesce(excluded.clicks, public.social_post_daily.clicks);
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_post_day (platform, post_id, day, impressions, views, saves, clicks, pin_clicks, ctr)
  select r.platform, r.post_id, r.day, r.impressions, r.views, r.saves, r.clicks, r.pin_clicks, r.ctr from jsonb_populate_recordset(null::public.social_post_day, p_rows) r
  on conflict (platform, post_id, day) do update set impressions = coalesce(excluded.impressions, public.social_post_day.impressions),
    views = coalesce(excluded.views, public.social_post_day.views), saves = coalesce(excluded.saves, public.social_post_day.saves),
    clicks = coalesce(excluded.clicks, public.social_post_day.clicks), pin_clicks = coalesce(excluded.pin_clicks, public.social_post_day.pin_clicks),
    ctr = coalesce(excluded.ctr, public.social_post_day.ctr);
  get diagnostics k = row_count;
  with t as (select distinct r->>'platform' platform, r->>'post_id' post_id from jsonb_array_elements(p_rows) r),
  s as (select d.platform, d.post_id, sum(d.impressions) imp, sum(d.saves) saves, sum(d.clicks) clicks
        from public.social_post_day d join t on t.platform = d.platform and t.post_id = d.post_id group by 1, 2)
  update public.social_posts p set impressions = coalesce(s.imp, p.impressions),
    views = case when p.platform = 'pinterest' then coalesce(s.imp, p.views) else p.views end,
    saves = case when p.platform = 'pinterest' then coalesce(s.saves, p.saves) else p.saves end,
    clicks = case when p.platform = 'pinterest' then coalesce(s.clicks, p.clicks) else p.clicks end
  from s where p.platform = s.platform and p.post_id = s.post_id;
  /* today's snapshot of a pin follows its total, so the day-to-day growth (Megjelenések, +7 nap) is real */
  with t as (select distinct r->>'post_id' post_id from jsonb_array_elements(p_rows) r where r->>'platform' = 'pinterest')
  insert into public.social_post_daily (platform, post_id, day, views, saves, impressions, clicks)
  select p.platform, p.post_id, public.admin_today(), p.views, p.saves, p.impressions, p.clicks from public.social_posts p join t on t.post_id = p.post_id where p.platform = 'pinterest'
  on conflict (platform, post_id, day) do update set views = excluded.views, saves = excluded.saves, impressions = excluded.impressions, clicks = excluded.clicks;
  return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_post_hourly"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_post_hourly select r.platform, r.post_id, date_trunc('hour', r.at), r.views, r.likes, r.comments, r.shares, r.saves
  from jsonb_populate_recordset(null::public.social_post_hourly, p_rows) r
  on conflict (platform, post_id, at) do update set views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares, saves = excluded.saves;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_post_hourly"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_posts (platform, post_id, created_at, kind, title, url, thumb, duration, code, views, likes, comments, shares, saves, reach, impressions, clicks,
    watch_avg, watch_total, profile_visits, follows, completion, updated_at)
  select r.platform, r.post_id, r.created_at, r.kind, r.title, r.url, r.thumb, r.duration, r.code, r.views, r.likes, r.comments, r.shares, r.saves, r.reach, r.impressions, r.clicks,
    r.watch_avg, r.watch_total, r.profile_visits, r.follows, r.completion, coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.social_posts, p_rows) r
  on conflict (platform, post_id) do update set created_at = coalesce(excluded.created_at, public.social_posts.created_at), kind = coalesce(excluded.kind, public.social_posts.kind),
    title = coalesce(excluded.title, public.social_posts.title), url = coalesce(excluded.url, public.social_posts.url),
    thumb = coalesce(excluded.thumb, public.social_posts.thumb), duration = coalesce(excluded.duration, public.social_posts.duration),
    code = coalesce(excluded.code, public.social_posts.code), views = coalesce(excluded.views, public.social_posts.views),
    likes = coalesce(excluded.likes, public.social_posts.likes), comments = coalesce(excluded.comments, public.social_posts.comments),
    shares = coalesce(excluded.shares, public.social_posts.shares), saves = coalesce(excluded.saves, public.social_posts.saves),
    reach = coalesce(excluded.reach, public.social_posts.reach), impressions = coalesce(excluded.impressions, public.social_posts.impressions),
    clicks = coalesce(excluded.clicks, public.social_posts.clicks), watch_avg = coalesce(excluded.watch_avg, public.social_posts.watch_avg),
    watch_total = coalesce(excluded.watch_total, public.social_posts.watch_total),
    profile_visits = coalesce(excluded.profile_visits, public.social_posts.profile_visits),
    follows = coalesce(excluded.follows, public.social_posts.follows), completion = coalesce(excluded.completion, public.social_posts.completion),
    updated_at = excluded.updated_at;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_retention"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_retention select r.platform, r.post_id, r.x, r.ratio from jsonb_populate_recordset(null::public.social_retention, p_rows) r
  on conflict (platform, post_id, x) do update set ratio = excluded.ratio;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_retention"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_set) <> 'object' or exists (select 1 from jsonb_object_keys(p_set) x where x !~ '^(daily|try|rot)_[a-z]{2,12}$') then
    raise exception 'bad state';
  end if;
  insert into public.admin_settings (k, v) values ('sync:social', p_set)
  on conflict (k) do update set v = public.admin_settings.v || excluded.v, updated_at = now();
end $_$;

ALTER FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_social_stories"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_stories select r.platform, r.story_id, r.created_at, r.kind, r.thumb, r.url, r.views, r.reach, r.replies, r.shares, r.exits, r.taps_forward, r.taps_back, r.follows, r.profile_visits, now()
  from jsonb_populate_recordset(null::public.social_stories, p_rows) r
  on conflict (platform, story_id) do update set views = coalesce(excluded.views, public.social_stories.views), reach = coalesce(excluded.reach, public.social_stories.reach),
    replies = coalesce(excluded.replies, public.social_stories.replies), shares = coalesce(excluded.shares, public.social_stories.shares), exits = coalesce(excluded.exits, public.social_stories.exits),
    taps_forward = coalesce(excluded.taps_forward, public.social_stories.taps_forward), taps_back = coalesce(excluded.taps_back, public.social_stories.taps_back),
    follows = coalesce(excluded.follows, public.social_stories.follows), profile_visits = coalesce(excluded.profile_visits, public.social_stories.profile_visits),
    thumb = coalesce(excluded.thumb, public.social_stories.thumb), updated_at = now();
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_social_stories"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.store_daily (store, day, country, downloads, updates, redownloads, uninstalls)
  select r.store, r.day, coalesce(r.country, ''), coalesce(r.downloads, 0), coalesce(r.updates, 0), coalesce(r.redownloads, 0), coalesce(r.uninstalls, 0)
  from jsonb_populate_recordset(null::public.store_daily, p_rows) r
  on conflict (store, day, country) do update set downloads = excluded.downloads, updates = excluded.updates, redownloads = excluded.redownloads, uninstalls = excluded.uninstalls;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_store_metrics"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.store_metrics select r.store, r.day, r.metric, coalesce(r.dim, ''), coalesce(r.k, ''), r.n from jsonb_populate_recordset(null::public.store_metrics, p_rows) r
  on conflict (store, day, metric, dim, k) do update set n = excluded.n;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_store_metrics"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.store_reviews (store, review_id, created_at, rating, title, body, author, territory, lang, version, reply, replied_at)
  select r.store, r.review_id, r.created_at, r.rating, r.title, r.body, r.author, r.territory, r.lang, r.version, r.reply, r.replied_at
  from jsonb_populate_recordset(null::public.store_reviews, p_rows) r
  on conflict (store, review_id) do update set created_at = excluded.created_at, rating = excluded.rating, title = excluded.title, body = excluded.body,
    author = excluded.author, territory = excluded.territory, lang = excluded.lang, version = excluded.version, reply = excluded.reply, replied_at = excluded.replied_at;
  get diagnostics k = row_count; return k;
end $$;

ALTER FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_id !~ '^[a-z_]{2,20}$' then raise exception 'bad id'; end if;
  insert into public.admin_settings (k, v) values ('test:' || p_id, jsonb_build_object('ok', p_ok, 'msg', left(p_msg, 400), 'at', now()))
  on conflict (k) do update set v = excluded.v, updated_at = now();
end $_$;

ALTER FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_update_notes"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_notes (day, kind, text)
  select (u.begin_at at time zone 'Europe/Budapest')::date, 'kulso', 'Google: ' || left(u.title, 150) from public.google_updates u
  where u.begin_at > now() - interval '120 days' and not exists (select 1 from public.admin_notes n where n.kind = 'kulso' and n.text = 'Google: ' || left(u.title, 150));
end $$;

ALTER FUNCTION "public"."admin_w_update_notes"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_uptime"("p_token" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.uptime_checks (target, status, ms, ok, done, via)
  select left(x->>'url', 500), nullif(x->>'status', '')::int, greatest(0, least(120000, (x->>'ms')::numeric))::int, coalesce((x->>'ok')::boolean, false), true, 'server'
  from jsonb_array_elements(coalesce(p_rows, '[]')) x where x->>'url' in (select url from public.uptime_targets);
  get diagnostics k = row_count;
  return k;
end $$;

ALTER FUNCTION "public"."admin_w_uptime"("p_token" "text", "p_rows" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_w_week_plan"("p_token" "text", "p_items" "jsonb", "p_force" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare w date := date_trunc('week', now() at time zone 'Europe/Budapest')::date;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_force then
    insert into public.admin_week_plans (week, items) values (w, coalesce(p_items, '[]')) on conflict (week) do update set items = excluded.items, updated_at = now();
  else
    insert into public.admin_week_plans (week, items) values (w, coalesce(p_items, '[]')) on conflict (week) do nothing;
  end if;
end $$;

ALTER FUNCTION "public"."admin_w_week_plan"("p_token" "text", "p_items" "jsonb", "p_force" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_watch_set"("p_kind" "text", "p_a" "text", "p_b" "text", "p_on" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind = 'site' then
    if p_on then insert into public.competitor_sites (domain, sitemap) values (lower(regexp_replace(trim(p_a), '^https?://(www\.)?|/.*$', '', 'g')), nullif(trim(p_b), '')) on conflict (domain) do update set sitemap = excluded.sitemap;
    else delete from public.competitor_pages where domain = p_a; delete from public.competitor_sites where domain = p_a; end if;
  elsif p_kind = 'social' then
    if p_on then insert into public.social_competitors (platform, handle) values (p_a, lower(regexp_replace(trim(p_b), '^@', ''))) on conflict do nothing;
    else delete from public.social_competitor_daily where platform = p_a and handle = p_b; delete from public.social_competitors where platform = p_a and handle = p_b; end if;
  end if;
end $_$;

ALTER FUNCTION "public"."admin_watch_set"("p_kind" "text", "p_a" "text", "p_b" "text", "p_on" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_week_plan"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare tz constant text := 'Europe/Budapest'; w date := date_trunc('week', now() at time zone tz)::date; t0 timestamptz := w::timestamp at time zone tz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('week', w, 'items', coalesce((select items from public.admin_week_plans where week = w), '[]'),
    'updated_at', (select updated_at from public.admin_week_plans where week = w),
    'now', public.admin_period(t0, now()),
    /* the same part of last week (Monday to this very hour): a half week against a whole one was always "down" */
    'base', public.admin_period(t0 - interval '7 days', now() - interval '7 days'),
    'base_full', public.admin_period(t0 - interval '7 days', t0),
    'last', (select jsonb_build_object('week', week, 'items', items, 'now', public.admin_period(t0 - interval '7 days', t0), 'base', public.admin_period(t0 - interval '14 days', t0 - interval '7 days'))
             from public.admin_week_plans where week = w - 7));
end $$;

ALTER FUNCTION "public"."admin_week_plan"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_week_plan_save"("p_items" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare w date := date_trunc('week', now() at time zone 'Europe/Budapest')::date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_week_plans (week, items) values (w, coalesce(p_items, '[]')) on conflict (week) do update set items = excluded.items, updated_at = now();
end $$;

ALTER FUNCTION "public"."admin_week_plan_save"("p_items" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_youtube"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'demo', coalesce((select jsonb_agg(to_jsonb(a) order by a.breakdown, a.n desc) from public.social_audience a where a.platform = 'youtube'), '[]'),
    'retention', coalesce((select jsonb_agg(x) from (select post_id, jsonb_agg(jsonb_build_object('x', x, 'r', ratio) order by x) pts from public.social_retention where platform = 'youtube' group by 1) x), '[]'),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select day, followers, views, watch_min, gained, lost, impressions, views_total, shares from public.social_account_daily where platform = 'youtube' and day >= public.admin_today() - 400) x), '[]'),
    'account', (select jsonb_build_object('connected_at', connected_at, 'last_sync_at', last_sync_at, 'last_error', last_error, 'token_expires_at', token_expires_at)
        from public.social_accounts where platform = 'youtube'),
    'comments', (select count(*) from public.inbox_items where source = 'youtube'));
end $$;

ALTER FUNCTION "public"."admin_youtube"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."events_sess_attr"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare c text; l text;
begin
  if new.session is null then return new; end if;
  c := public.admin_channel(new.props->'src', new.props->>'ia');
  l := nullif(left(coalesce(new.lang, ''), 2), '');
  insert into public.admin_sess_attr as t (session, first_at, ch_first, src_at, ch_src, lg_at, lg)
  values (new.session, new.created_at, c, case when new.props ? 'src' then new.created_at end, case when new.props ? 'src' then c end,
    case when l is not null then new.created_at end, l)
  on conflict (session) do update set
    ch_first = case when excluded.first_at < t.first_at then excluded.ch_first else t.ch_first end,
    first_at = least(t.first_at, excluded.first_at),
    ch_src = case when excluded.src_at is not null and (t.src_at is null or excluded.src_at < t.src_at) then excluded.ch_src else t.ch_src end,
    src_at = least(t.src_at, excluded.src_at),
    lg = case when excluded.lg_at is not null and (t.lg_at is null or excluded.lg_at >= t.lg_at) then excluded.lg else t.lg end,
    lg_at = greatest(t.lg_at, excluded.lg_at);
  return new;
end $$;

ALTER FUNCTION "public"."events_sess_attr"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text" DEFAULT NULL::"text", "p_kind" "text" DEFAULT NULL::"text", "p_device" "text" DEFAULT NULL::"text", "p_own" boolean DEFAULT false, "p_visitor" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare l public.short_links; v_h text; v_c text := upper(left(coalesce(p_country, ''), 2)); v_k text := lower(left(coalesce(p_kind, ''), 20)); v_d text := lower(left(coalesce(p_device, ''), 10));
begin
  select * into l from public.short_links where code = lower(left(coalesce(p_code, ''), 40));
  if not found then return null; end if;
  if not coalesce(p_own, false) and v_k in ('tiktok', 'instagram', 'messenger', 'facebook', 'pinterest', 'linkedin', 'youtube', 'snapchat', 'threads', 'x', 'telegram', 'browser') then
    v_h := case when p_visitor ~ '^[0-9a-f]{64}$' then
      left(encode(extensions.digest(p_visitor || '|' || l.code || '|' || coalesce((select s.v from public.admin_secrets s where s.k = 'link_salt'), ''), 'sha256'), 'hex'), 32) end;
    if (v_h is null or not exists (select 1 from public.link_clicks x where x.code = l.code and x.visitor = v_h and x.at > now() - interval '30 minutes'))
      and (select count(*) from public.link_clicks x where x.code = l.code and x.at > now() - interval '1 minute') < 60 then
      insert into public.link_clicks (code, country, kind, device, visitor)
      values (l.code, case when v_c ~ '^[A-Z]{2}$' then v_c end, v_k, case when v_d in ('mobile', 'tablet', 'desktop') then v_d end, v_h);
    end if;
    update public.link_clicks set visitor = null where visitor is not null and at < now() - interval '1 hour';
  end if;
  return jsonb_build_object('target', l.target, 'source', l.source, 'medium', l.medium, 'campaign', l.campaign, 'code', l.code);
end $_$;

ALTER FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text", "p_kind" "text", "p_device" "text", "p_own" boolean, "p_visitor" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (exists (select 1 from public.admins where user_id = auth.uid())
      or exists (select 1 from auth.users u join public.admin_emails e on e.email = lower(u.email)
                 where u.id = auth.uid() and u.email_confirmed_at is not null))
    and (coalesce(auth.jwt()->>'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."public_announcements"("p_lang" "text" DEFAULT NULL::"text", "p_pf" "text" DEFAULT 'web'::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'kind', a.kind, 'link', a.link) order by a.created_at desc), '[]')
  from public.admin_announcements a
  where a.on_ and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
    and (a.lang is null or left(a.lang, 2) = left(coalesce(p_lang, ''), 2))
    and (a.platform = 'all' or a.platform = coalesce(p_pf, 'web') or (a.platform = 'app' and coalesce(p_pf, 'web') in ('android', 'ios')))
$$;

ALTER FUNCTION "public"."public_announcements"("p_lang" "text", "p_pf" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."public_report"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare l public.share_links; tz constant text := 'Europe/Budapest';
begin
  select * into l from public.share_links where token = p_token and expires_at > now();
  if not found then return null; end if;
  update public.share_links set views = views + 1, last_view = now() where token = p_token;
  return jsonb_build_object(
    'label', l.label, 'expires_at', l.expires_at, 'generated_at', now(),
    'since', (select min(created_at) from public.events_real),
    'totals', jsonb_build_object(
      'sessions', (select count(distinct session) from public.events_real),
      'scored', (select count(distinct session) from public.events_real where name = 'flow_step' and props->>'step' = 'score'),
      'accounts', (select count(*) from auth.users),
      'languages', (select count(distinct left(lang, 2)) from public.events_real where lang is not null),
      'shared', (select count(distinct session) from public.events_real where name in ('share_open','share_save','share_video','reveal_share'))),
    'weeks', coalesce((select jsonb_agg(x order by x.w) from (
      select date_trunc('week', created_at at time zone tz)::date w, count(distinct session) sessions,
        count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') scored
      from public.events_real group by 1) x), '[]'),
    'signups', coalesce((select jsonb_agg(x order by x.w) from (select date_trunc('week', created_at at time zone tz)::date w, count(*) n from auth.users group by 1) x), '[]'),
    'channels', coalesce((select jsonb_agg(x order by x.n desc) from (
      select public.admin_channel(src, null) k, count(*) n from (select session, (array_agg(props->'src' order by created_at))[1] src from public.events_real where session is not null group by session) s group by 1 order by 2 desc limit 6) x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (select left(lang, 2) k, count(distinct session) n from public.events_real where lang is not null group by 1 order by 2 desc limit 8) x), '[]'),
    'stores', (select jsonb_build_object('downloads', coalesce(sum(downloads), 0)) from public.store_daily),
    'rating', (select jsonb_build_object('avg', round(avg(rating)::numeric, 2), 'n', count(*)) from public.store_reviews)
  );
end $$;

ALTER FUNCTION "public"."public_report"("p_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."social_posts_keep_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.created_at is null and new.platform = 'pinterest' then
    new.created_at := coalesce((select p.created_at from public.social_posts p
      where p.platform = new.platform and p.post_id in (new.post_id, 'm:' || new.post_id) and p.created_at is not null
      order by (p.post_id = new.post_id) desc limit 1), now());
  end if;
  return new;
end $$;

ALTER FUNCTION "public"."social_posts_keep_created"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."social_posts_merge_manual"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare m record;
begin
  if new.post_id like 'm:%' then return new; end if;
  for m in select post_id from public.social_posts p
    where p.platform = new.platform and p.post_id like 'm:%'
      and (p.post_id = 'm:' || new.post_id
        or (new.url is not null and public.admin_norm_post_url(p.url) = public.admin_norm_post_url(new.url))
        or (new.url is not null and public.admin_post_id_of(new.platform, p.url) is not null and public.admin_post_id_of(new.platform, p.url) = public.admin_post_id_of(new.platform, new.url)))
  loop
    update public.short_links set post_id = new.post_id where post_platform = new.platform and post_id = m.post_id;
    update public.social_post_groups set post_id = new.post_id where platform = new.platform and post_id = m.post_id
      and not exists (select 1 from public.social_post_groups g where g.platform = new.platform and g.post_id = new.post_id);
    delete from public.social_post_groups where platform = new.platform and post_id = m.post_id;
    delete from public.social_post_daily where platform = new.platform and post_id = m.post_id;
    delete from public.social_post_hourly where platform = new.platform and post_id = m.post_id;
    delete from public.social_posts where platform = new.platform and post_id = m.post_id;
  end loop;
  return new;
end $$;

ALTER FUNCTION "public"."social_posts_merge_manual"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text" DEFAULT NULL::"text", "p_lang" "text" DEFAULT NULL::"text", "p_page" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare e text := lower(trim(coalesce(p_email, ''))); b text := trim(coalesce(p_body, '')); id text;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 200 then raise exception 'bad email'; end if;
  if length(b) < 5 or length(b) > 5000 then raise exception 'bad message'; end if;
  if (select count(*) from public.inbox_items where source = 'support' and email = e and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.inbox_items where source = 'support' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many';
  end if;
  id := 's' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(e || b || random()::text), 1, 8);
  insert into public.inbox_items (source, item_id, kind, author, body, lang, created_at, email, post_title, post_url, done)
  values ('support', id, 'support', nullif(left(trim(coalesce(p_name, '')), 80), ''), b, nullif(left(coalesce(p_lang, ''), 5), ''), now(), e,
    'Üzenet a weboldalról', nullif(left(coalesce(p_page, ''), 200), ''), false);
  return jsonb_build_object('ok', true);
end $_$;

ALTER FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text", "p_lang" "text", "p_page" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."track_flags"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object('android_ext', coalesce((select (v #>> '{}')::boolean from public.admin_settings where k = 'track_android_ext'), false))
$$;

ALTER FUNCTION "public"."track_flags"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_alert_state" (
    "k" "text" NOT NULL,
    "c" "text",
    "title" "text",
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen_n" integer DEFAULT 1 NOT NULL,
    "done_at" timestamp with time zone,
    "later_until" "date"
);

ALTER TABLE "public"."admin_alert_state" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_announcements" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "kind" "text" DEFAULT 'info'::"text" NOT NULL,
    "lang" "text",
    "platform" "text" DEFAULT 'all'::"text" NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "on_" boolean DEFAULT true NOT NULL,
    "link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_announcements_kind_check" CHECK (("kind" = ANY (ARRAY['info'::"text", 'good'::"text", 'warn'::"text"]))),
    CONSTRAINT "admin_announcements_platform_check" CHECK (("platform" = ANY (ARRAY['all'::"text", 'web'::"text", 'android'::"text", 'ios'::"text", 'app'::"text"])))
);

ALTER TABLE "public"."admin_announcements" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_announcements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_announcements_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_announcements_id_seq" OWNED BY "public"."admin_announcements"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_audit" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor" "text",
    "action" "text" NOT NULL,
    "target" "text",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE "public"."admin_audit" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_audit_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_audit_id_seq" OWNED BY "public"."admin_audit"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_cron_calls" (
    "id" bigint NOT NULL,
    "path" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" integer,
    "timed_out" boolean,
    "error" "text",
    "done" boolean DEFAULT false NOT NULL,
    "via" "text" DEFAULT 'cron'::"text" NOT NULL
);

ALTER TABLE "public"."admin_cron_calls" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_cwv" (
    "url" "text" NOT NULL,
    "form" "text" NOT NULL,
    "day" "date" NOT NULL,
    "perf" integer,
    "lcp" numeric,
    "inp" numeric,
    "cls" numeric,
    "fcp" numeric,
    "ttfb" numeric,
    "field" "jsonb"
);

ALTER TABLE "public"."admin_cwv" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_daily" (
    "day" "date" NOT NULL,
    "ch" "text" NOT NULL,
    "lg" "text" NOT NULL,
    "events" integer DEFAULT 0 NOT NULL,
    "sessions" integer DEFAULT 0 NOT NULL,
    "app" integer DEFAULT 0 NOT NULL,
    "scored" integer DEFAULT 0 NOT NULL,
    "revealed" integer DEFAULT 0 NOT NULL,
    "shared" integer DEFAULT 0 NOT NULL,
    "first_at" timestamp with time zone
);

ALTER TABLE "public"."admin_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_emails" (
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_emails_email_check" CHECK (("email" = "lower"("email")))
);

ALTER TABLE "public"."admin_emails" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_experiments" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "start_day" "date" NOT NULL,
    "metric" "text" DEFAULT 'scored'::"text" NOT NULL,
    "days" integer DEFAULT 7 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ch" "text",
    "lg" "text"
);

ALTER TABLE "public"."admin_experiments" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_experiments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_experiments_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_experiments_id_seq" OWNED BY "public"."admin_experiments"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_goals" (
    "metric" "text" NOT NULL,
    "period" "text" NOT NULL,
    "target" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_day" "date",
    "end_day" "date",
    CONSTRAINT "admin_goals_custom_check" CHECK ((("period" <> 'custom'::"text") OR (("start_day" IS NOT NULL) AND ("end_day" IS NOT NULL) AND ("end_day" >= "start_day")))),
    CONSTRAINT "admin_goals_metric_check" CHECK (("metric" ~ '^(sessions|scored|signups|shared|gsc_clicks|gsc_impressions|bing_clicks|downloads|reviews|followers|(followers|views|visits)_(tiktok|instagram|facebook|pinterest|linkedin|youtube))$'::"text")),
    CONSTRAINT "admin_goals_period_check" CHECK (("period" = ANY (ARRAY['week'::"text", 'month'::"text", 'quarter'::"text", 'year'::"text", 'custom'::"text"]))),
    CONSTRAINT "admin_goals_target_check" CHECK (("target" > 0))
);

ALTER TABLE "public"."admin_goals" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_notes" (
    "id" bigint NOT NULL,
    "day" "date" NOT NULL,
    "kind" "text" DEFAULT 'egyeb'::"text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notes_kind_check" CHECK (("kind" = ANY (ARRAY['kiadas'::"text", 'kampany'::"text", 'poszt'::"text", 'kulso'::"text", 'egyeb'::"text"]))),
    CONSTRAINT "admin_notes_text_check" CHECK ((("length"("text") >= 1) AND ("length"("text") <= 200)))
);

ALTER TABLE "public"."admin_notes" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_notes_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_notes_id_seq" OWNED BY "public"."admin_notes"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_own_accounts" (
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_own_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_push_sent" (
    "kind" "text" NOT NULL,
    "key" "text" NOT NULL,
    "title" "text",
    "body" "text",
    "url" "text",
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_push_sent" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_push_subs" (
    "endpoint" "text" NOT NULL,
    "p256dh" "text",
    "auth" "text",
    "ua" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_ok" timestamp with time zone,
    "fails" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "public"."admin_push_subs" OWNER TO "postgres";

-- InkAge: the dashboard's profile columns from InkAge's profiles ("credits" = the bonus previews she gave someone;
-- there is no welcome gift)
CREATE OR REPLACE VIEW "public"."admin_ink_profiles" AS
 SELECT p.id, p.display_name, coalesce(p.bonus, 0)::int AS credits, p.created_at, false AS gift_claimed, p.lang, p.plan, p.reviewer, p.welcomed_at
   FROM public.profiles p;
ALTER VIEW "public"."admin_ink_profiles" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."admin_real_profiles" AS
 SELECT "id", "display_name", "credits", "created_at", "gift_claimed"
   FROM "public"."admin_ink_profiles" "p"
  WHERE (NOT "public"."admin_own_uid"("id"));
ALTER VIEW "public"."admin_real_profiles" OWNER TO "postgres";

-- InkAge: what Calligra counts as an unlocked signature is a saved preview here (name_norm = the body part,
-- calligrapher = she marked it "I got it done", design = it has an AI report)
CREATE OR REPLACE VIEW "public"."admin_ink_unlocks" AS
 SELECT v.id, v.user_id, coalesce(nullif(v.placement, ''), '?') AS name_norm, (v.done_at IS NOT NULL) AS calligrapher, v.created_at,
   CASE WHEN v.report IS NOT NULL THEN jsonb_build_object('report', true) END AS design
   FROM public.previews v
  WHERE v.deleted_at IS NULL;
ALTER VIEW "public"."admin_ink_unlocks" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."admin_real_unlocks" AS
 SELECT "id", "user_id", "name_norm", "calligrapher", "created_at", "design"
   FROM "public"."admin_ink_unlocks" "u"
  WHERE (NOT "public"."admin_own_uid"("user_id"));
ALTER VIEW "public"."admin_real_unlocks" OWNER TO "postgres";

-- InkAge: App Store reviewers' accounts (profiles.reviewer) are not real users either
CREATE OR REPLACE VIEW "public"."admin_real_users" AS
 SELECT "id", "email", "created_at", "email_confirmed_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data"
   FROM "auth"."users" "u"
  WHERE (NOT "public"."admin_own_uid"("id")) AND NOT exists (select 1 from public.profiles p where p.id = u.id and coalesce(p.reviewer, false))
    AND u.email NOT LIKE 'erased+%@inkage.invalid';
ALTER VIEW "public"."admin_real_users" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_releases" (
    "sha" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "msg" "text"
);

ALTER TABLE "public"."admin_releases" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_rollup_state" (
    "k" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "from_day" "date",
    "rows" integer,
    "ms" integer
);

ALTER TABLE "public"."admin_rollup_state" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_runs" (
    "id" bigint NOT NULL,
    "job" "text" NOT NULL,
    "via" "text" DEFAULT 'cron'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "ok" boolean,
    "message" "text"
);

ALTER TABLE "public"."admin_runs" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_runs_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_runs_id_seq" OWNED BY "public"."admin_runs"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_secrets" (
    "k" "text" NOT NULL,
    "v" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_secrets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_sess_attr" (
    "session" "text" NOT NULL,
    "first_at" timestamp with time zone NOT NULL,
    "ch_first" "text",
    "src_at" timestamp with time zone,
    "ch_src" "text",
    "lg_at" timestamp with time zone,
    "lg" "text",
    "ch" "text" GENERATED ALWAYS AS (COALESCE("ch_src", "ch_first")) STORED
);

ALTER TABLE "public"."admin_sess_attr" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_settings" (
    "k" "text" NOT NULL,
    "v" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_settings" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_solved" (
    "key" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_solved" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_tracked_queries" (
    "query" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_tracked_queries" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_user_days" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL
);

ALTER TABLE "public"."admin_user_days" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admin_user_notes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "follow_up" "date",
    "done_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_user_notes" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."admin_user_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."admin_user_notes_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."admin_user_notes_id_seq" OWNED BY "public"."admin_user_notes"."id";

CREATE TABLE IF NOT EXISTS "public"."admin_week_plans" (
    "week" "date" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admin_week_plans" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."admins" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ai_visibility" (
    "day" "date" NOT NULL,
    "model" "text" NOT NULL,
    "question" "text" NOT NULL,
    "lang" "text",
    "mentioned" boolean,
    "rank" integer,
    "competitors" "text"[],
    "answer" "text"
);

ALTER TABLE "public"."ai_visibility" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."alert_rules" (
    "id" bigint NOT NULL,
    "metric" "text" NOT NULL,
    "op" "text" DEFAULT '>'::"text" NOT NULL,
    "threshold" numeric NOT NULL,
    "window_min" integer DEFAULT 60 NOT NULL,
    "on_" boolean DEFAULT true NOT NULL,
    "last_fired" timestamp with time zone,
    "channels" "text"[] DEFAULT '{push}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."alert_rules" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."alert_rules_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."alert_rules_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."alert_rules_id_seq" OWNED BY "public"."alert_rules"."id";

CREATE TABLE IF NOT EXISTS "public"."bing_daily" (
    "day" "date" NOT NULL,
    "query" "text" NOT NULL,
    "clicks" integer,
    "impressions" integer,
    "pos" real
);

ALTER TABLE "public"."bing_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."bing_links" (
    "url" "text" NOT NULL,
    "source" "text" NOT NULL,
    "anchor" "text",
    "first_seen" "date" DEFAULT CURRENT_DATE,
    "last_seen" "date" DEFAULT CURRENT_DATE
);

ALTER TABLE "public"."bing_links" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."brand_mentions" (
    "source" "text" NOT NULL,
    "id" "text" NOT NULL,
    "title" "text",
    "url" "text",
    "author" "text",
    "snippet" "text",
    "at" timestamp with time zone,
    "seen" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."brand_mentions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."cert_status" (
    "host" "text" NOT NULL,
    "valid_to" timestamp with time zone,
    "issuer" "text",
    "domain_expires" timestamp with time zone,
    "checked_at" timestamp with time zone
);

ALTER TABLE "public"."cert_status" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."competitor_aso" (
    "day" "date" NOT NULL,
    "country" "text" NOT NULL,
    "term" "text" NOT NULL,
    "app_id" "text" NOT NULL,
    "pos" integer
);

ALTER TABLE "public"."competitor_aso" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."competitor_daily" (
    "app_id" "text" NOT NULL,
    "day" "date" NOT NULL,
    "rating" numeric(3,2),
    "ratings" integer,
    "version" "text",
    "price" "text",
    "country" "text" DEFAULT 'us'::"text" NOT NULL
);

ALTER TABLE "public"."competitor_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."competitor_pages" (
    "domain" "text" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "first_seen" "date" DEFAULT CURRENT_DATE NOT NULL,
    "initial" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."competitor_pages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."competitor_sites" (
    "domain" "text" NOT NULL,
    "sitemap" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."competitor_sites" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."competitors" (
    "app_id" "text" NOT NULL,
    "name" "text",
    "developer" "text",
    "icon" "text",
    "url" "text",
    "mine" boolean DEFAULT false NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "competitors_app_id_check" CHECK (("app_id" ~ '^[0-9]{5,12}$'::"text"))
);

ALTER TABLE "public"."competitors" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."content_plans" (
    "id" bigint NOT NULL,
    "day" "date" NOT NULL,
    "at" time without time zone,
    "platforms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "title" "text" NOT NULL,
    "caption" "text",
    "code" "text",
    "status" "text" DEFAULT 'terv'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "media_url" "text",
    "media_path" "text",
    "media_kind" "text",
    "publish" boolean DEFAULT false NOT NULL,
    "results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "published_at" timestamp with time zone,
    "codes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "texts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "opts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "publishing_at" timestamp with time zone
);

ALTER TABLE "public"."content_plans" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."content_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."content_plans_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."content_plans_id_seq" OWNED BY "public"."content_plans"."id";

CREATE TABLE IF NOT EXISTS "public"."cse_ranks" (
    "day" "date" NOT NULL,
    "query" "text" NOT NULL,
    "pos" integer,
    "url" "text"
);

ALTER TABLE "public"."cse_ranks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."email_events" (
    "id" "text" NOT NULL,
    "type" "text",
    "at" timestamp with time zone,
    "subject" "text",
    "domain" "text"
);

ALTER TABLE "public"."email_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."error_groups" (
    "fp" "text" NOT NULL,
    "state" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ai" "text",
    "ai_at" timestamp with time zone
);

ALTER TABLE "public"."error_groups" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."google_updates" (
    "id" "text" NOT NULL,
    "title" "text",
    "begin_at" timestamp with time zone,
    "end_at" timestamp with time zone
);

ALTER TABLE "public"."google_updates" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_appearance" (
    "day" "date" NOT NULL,
    "appearance" "text" NOT NULL,
    "clicks" integer,
    "impressions" integer
);

ALTER TABLE "public"."gsc_appearance" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_daily" (
    "day" "date" NOT NULL,
    "query" "text" NOT NULL,
    "page" "text" NOT NULL,
    "country" "text" NOT NULL,
    "device" "text" NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "impressions" integer DEFAULT 0 NOT NULL,
    "position" real
);

ALTER TABLE "public"."gsc_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_index" (
    "url" "text" NOT NULL,
    "verdict" "text",
    "coverage" "text",
    "indexing" "text",
    "fetch_state" "text",
    "robots" "text",
    "last_crawl" timestamp with time zone,
    "canonical_google" "text",
    "canonical_user" "text",
    "mobile" "text",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prev_verdict" "text",
    "changed_at" timestamp with time zone
);

ALTER TABLE "public"."gsc_index" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_search_type" (
    "day" "date" NOT NULL,
    "type" "text" NOT NULL,
    "query" "text" NOT NULL,
    "clicks" integer,
    "impressions" integer,
    "position" real
);

ALTER TABLE "public"."gsc_search_type" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_sitemaps" (
    "path" "text" NOT NULL,
    "last_submitted" timestamp with time zone,
    "last_downloaded" timestamp with time zone,
    "errors" integer,
    "warnings" integer,
    "pending" boolean,
    "submitted" integer,
    "in_sitemap" integer,
    "checked_at" timestamp with time zone
);

ALTER TABLE "public"."gsc_sitemaps" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."gsc_totals" (
    "day" "date" NOT NULL,
    "type" "text" NOT NULL,
    "clicks" integer,
    "impressions" integer,
    "position" real
);

ALTER TABLE "public"."gsc_totals" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."inbox_items" (
    "source" "text" NOT NULL,
    "item_id" "text" NOT NULL,
    "kind" "text" DEFAULT 'comment'::"text" NOT NULL,
    "post_id" "text",
    "post_title" "text",
    "post_url" "text",
    "post_thumb" "text",
    "author" "text",
    "body" "text",
    "rating" integer,
    "lang" "text",
    "created_at" timestamp with time zone,
    "reply" "text",
    "replied_at" timestamp with time zone,
    "done" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden" boolean DEFAULT false NOT NULL,
    "liked" boolean DEFAULT false NOT NULL,
    "email" "text",
    "seen_at" timestamp with time zone,
    "tag_manual" "text"
);

ALTER TABLE "public"."inbox_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."kw_ideas" (
    "q" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "seed" "text",
    "first_seen" "date" DEFAULT CURRENT_DATE NOT NULL
);

ALTER TABLE "public"."kw_ideas" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."link_clicks" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "country" "text",
    "kind" "text",
    "device" "text",
    "visitor" "text"
);

ALTER TABLE "public"."link_clicks" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."link_clicks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."link_clicks_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."link_clicks_id_seq" OWNED BY "public"."link_clicks"."id";

CREATE TABLE IF NOT EXISTS "public"."seo_health" (
    "day" "date" NOT NULL,
    "score" integer,
    "pages" integer,
    "ok" integer,
    "bad" integer,
    "warn" integer,
    "info" integer,
    "orphans" integer
);

ALTER TABLE "public"."seo_health" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."seo_pages" (
    "url" "text" NOT NULL,
    "checked_at" timestamp with time zone,
    "status" integer,
    "redirect_to" "text",
    "ms" integer,
    "bytes" integer,
    "title" "text",
    "meta" "text",
    "h1" "text",
    "h1_count" integer,
    "canonical" "text",
    "lang" "text",
    "hreflangs" "jsonb",
    "robots" "text",
    "words" integer,
    "imgs" integer,
    "imgs_no_alt" integer,
    "links_in" integer,
    "links_internal" "jsonb",
    "links_out" integer,
    "schema_types" "text"[],
    "issues" "jsonb",
    "h2" "jsonb",
    "intro" "text"
);

ALTER TABLE "public"."seo_pages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."share_links" (
    "token" "text" NOT NULL,
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "last_view" timestamp with time zone,
    CONSTRAINT "share_links_token_check" CHECK (("length"("token") >= 24))
);

ALTER TABLE "public"."share_links" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."short_links" (
    "code" "text" NOT NULL,
    "target" "text" DEFAULT '/app?guest=1'::"text" NOT NULL,
    "source" "text",
    "medium" "text",
    "campaign" "text",
    "note" "text",
    "post_platform" "text",
    "post_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "short_links_code_check" CHECK (("code" ~ '^[a-z0-9-]{1,40}$'::"text")),
    CONSTRAINT "short_links_target_check" CHECK (("target" ~ '^/[^/\\]'::"text"))
);

ALTER TABLE "public"."short_links" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_account_daily" (
    "platform" "text" NOT NULL,
    "day" "date" NOT NULL,
    "followers" bigint,
    "following" bigint,
    "likes" bigint,
    "posts" bigint,
    "impressions" bigint,
    "reach" bigint,
    "profile_views" bigint,
    "views" bigint,
    "watch_min" bigint,
    "gained" bigint,
    "lost" bigint,
    "clicks" bigint,
    "shares" bigint,
    "impressions_30d" bigint,
    "views_total" bigint
);

ALTER TABLE "public"."social_account_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_accounts" (
    "platform" "text" NOT NULL,
    "account_id" "text",
    "username" "text",
    "display_name" "text",
    "avatar_url" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "refresh_expires_at" timestamp with time zone,
    "scopes" "text",
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_error" "text",
    CONSTRAINT "social_accounts_platform_check" CHECK (("platform" = ANY (ARRAY['tiktok'::"text", 'instagram'::"text", 'facebook'::"text", 'pinterest'::"text", 'linkedin'::"text", 'youtube'::"text"])))
);

ALTER TABLE "public"."social_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_audience" (
    "platform" "text" NOT NULL,
    "breakdown" "text" NOT NULL,
    "k" "text" NOT NULL,
    "n" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."social_audience" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_competitor_daily" (
    "platform" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "day" "date" NOT NULL,
    "name" "text",
    "followers" bigint,
    "posts" bigint,
    "avg_likes" numeric,
    "avg_comments" numeric,
    "avatar" "text"
);

ALTER TABLE "public"."social_competitor_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_competitors" (
    "platform" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."social_competitors" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_post_daily" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "day" "date" NOT NULL,
    "views" bigint,
    "likes" bigint,
    "comments" bigint,
    "shares" bigint,
    "saves" bigint,
    "reach" bigint,
    "impressions" bigint,
    "clicks" bigint
);

ALTER TABLE "public"."social_post_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_post_day" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "day" "date" NOT NULL,
    "impressions" bigint,
    "views" bigint,
    "saves" bigint,
    "clicks" bigint,
    "pin_clicks" bigint,
    "ctr" numeric
);

ALTER TABLE "public"."social_post_day" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_post_groups" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "grp" "text" NOT NULL
);

ALTER TABLE "public"."social_post_groups" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_post_hourly" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "at" timestamp with time zone NOT NULL,
    "views" bigint,
    "likes" bigint,
    "comments" bigint,
    "shares" bigint,
    "saves" bigint
);

ALTER TABLE "public"."social_post_hourly" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_posts" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "kind" "text",
    "title" "text",
    "url" "text",
    "thumb" "text",
    "duration" integer,
    "code" "text",
    "views" bigint,
    "likes" bigint,
    "comments" bigint,
    "shares" bigint,
    "saves" bigint,
    "reach" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint,
    "clicks" bigint,
    "watch_avg" numeric,
    "watch_total" bigint,
    "profile_visits" bigint,
    "follows" bigint,
    "completion" numeric,
    "traffic" "jsonb"
);

ALTER TABLE "public"."social_posts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_retention" (
    "platform" "text" NOT NULL,
    "post_id" "text" NOT NULL,
    "x" numeric NOT NULL,
    "ratio" numeric
);

ALTER TABLE "public"."social_retention" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."social_stories" (
    "platform" "text" NOT NULL,
    "story_id" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "kind" "text",
    "thumb" "text",
    "url" "text",
    "views" bigint,
    "reach" bigint,
    "replies" bigint,
    "shares" bigint,
    "exits" bigint,
    "taps_forward" bigint,
    "taps_back" bigint,
    "follows" bigint,
    "profile_visits" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."social_stories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."store_daily" (
    "store" "text" NOT NULL,
    "day" "date" NOT NULL,
    "country" "text" DEFAULT ''::"text" NOT NULL,
    "downloads" integer DEFAULT 0 NOT NULL,
    "updates" integer DEFAULT 0 NOT NULL,
    "redownloads" integer DEFAULT 0 NOT NULL,
    "uninstalls" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "store_daily_store_check" CHECK (("store" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);

ALTER TABLE "public"."store_daily" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."store_metrics" (
    "store" "text" NOT NULL,
    "day" "date" NOT NULL,
    "metric" "text" NOT NULL,
    "dim" "text" DEFAULT ''::"text" NOT NULL,
    "k" "text" DEFAULT ''::"text" NOT NULL,
    "n" numeric
);

ALTER TABLE "public"."store_metrics" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."store_reviews" (
    "store" "text" NOT NULL,
    "review_id" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "rating" integer,
    "title" "text",
    "body" "text",
    "author" "text",
    "territory" "text",
    "lang" "text",
    "version" "text",
    "reply" "text",
    "replied_at" timestamp with time zone,
    "done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    CONSTRAINT "store_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "store_reviews_store_check" CHECK (("store" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);

ALTER TABLE "public"."store_reviews" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."sync_log" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "ok" boolean NOT NULL,
    "rows" integer,
    "message" "text"
);

ALTER TABLE "public"."sync_log" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."sync_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."sync_log_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."sync_log_id_seq" OWNED BY "public"."sync_log"."id";

CREATE TABLE IF NOT EXISTS "public"."uptime_checks" (
    "id" bigint NOT NULL,
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target" "text" NOT NULL,
    "req" bigint,
    "status" integer,
    "ms" integer,
    "ok" boolean,
    "done" boolean DEFAULT false NOT NULL,
    "via" "text" DEFAULT 'pg_net'::"text" NOT NULL
);

ALTER TABLE "public"."uptime_checks" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."uptime_checks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."uptime_checks_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."uptime_checks_id_seq" OWNED BY "public"."uptime_checks"."id";

CREATE TABLE IF NOT EXISTS "public"."uptime_targets" (
    "url" "text" NOT NULL,
    "label" "text",
    "ok_max" integer DEFAULT 399 NOT NULL,
    "on_" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."uptime_targets" OWNER TO "postgres";

ALTER TABLE ONLY "public"."admin_announcements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_announcements_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_audit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_audit_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_experiments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_experiments_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_notes_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_runs_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_user_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_user_notes_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."alert_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."alert_rules_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."content_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."content_plans_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."link_clicks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."link_clicks_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."sync_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sync_log_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."uptime_checks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."uptime_checks_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."admin_alert_state"
    ADD CONSTRAINT "admin_alert_state_pkey" PRIMARY KEY ("k");

ALTER TABLE ONLY "public"."admin_announcements"
    ADD CONSTRAINT "admin_announcements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_audit"
    ADD CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_bot_sessions"
    ADD CONSTRAINT "admin_bot_sessions_pkey" PRIMARY KEY ("session");

ALTER TABLE ONLY "public"."admin_cron_calls"
    ADD CONSTRAINT "admin_cron_calls_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_cwv"
    ADD CONSTRAINT "admin_cwv_pkey" PRIMARY KEY ("url", "form", "day");

ALTER TABLE ONLY "public"."admin_daily"
    ADD CONSTRAINT "admin_daily_pkey" PRIMARY KEY ("day", "ch", "lg");

ALTER TABLE ONLY "public"."admin_emails"
    ADD CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("email");

ALTER TABLE ONLY "public"."admin_experiments"
    ADD CONSTRAINT "admin_experiments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_goals"
    ADD CONSTRAINT "admin_goals_pkey" PRIMARY KEY ("metric", "period");

ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_own_accounts"
    ADD CONSTRAINT "admin_own_accounts_pkey" PRIMARY KEY ("email");

ALTER TABLE ONLY "public"."admin_own_sessions"
    ADD CONSTRAINT "admin_own_sessions_pkey" PRIMARY KEY ("session");

ALTER TABLE ONLY "public"."admin_push_sent"
    ADD CONSTRAINT "admin_push_sent_pkey" PRIMARY KEY ("kind", "key");

ALTER TABLE ONLY "public"."admin_push_subs"
    ADD CONSTRAINT "admin_push_subs_pkey" PRIMARY KEY ("endpoint");

ALTER TABLE ONLY "public"."admin_releases"
    ADD CONSTRAINT "admin_releases_pkey" PRIMARY KEY ("sha");

ALTER TABLE ONLY "public"."admin_rollup_state"
    ADD CONSTRAINT "admin_rollup_state_pkey" PRIMARY KEY ("k");

ALTER TABLE ONLY "public"."admin_runs"
    ADD CONSTRAINT "admin_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_secrets"
    ADD CONSTRAINT "admin_secrets_pkey" PRIMARY KEY ("k");

ALTER TABLE ONLY "public"."admin_sess_attr"
    ADD CONSTRAINT "admin_sess_attr_pkey" PRIMARY KEY ("session");

ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("k");

ALTER TABLE ONLY "public"."admin_solved"
    ADD CONSTRAINT "admin_solved_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."admin_tracked_queries"
    ADD CONSTRAINT "admin_tracked_queries_pkey" PRIMARY KEY ("query");

ALTER TABLE ONLY "public"."admin_user_days"
    ADD CONSTRAINT "admin_user_days_pkey" PRIMARY KEY ("user_id", "day");

ALTER TABLE ONLY "public"."admin_user_notes"
    ADD CONSTRAINT "admin_user_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."admin_week_plans"
    ADD CONSTRAINT "admin_week_plans_pkey" PRIMARY KEY ("week");

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."ai_visibility"
    ADD CONSTRAINT "ai_visibility_pkey" PRIMARY KEY ("day", "model", "question");

ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bing_daily"
    ADD CONSTRAINT "bing_daily_pkey" PRIMARY KEY ("day", "query");

ALTER TABLE ONLY "public"."bing_links"
    ADD CONSTRAINT "bing_links_pkey" PRIMARY KEY ("url", "source");

ALTER TABLE ONLY "public"."brand_mentions"
    ADD CONSTRAINT "brand_mentions_pkey" PRIMARY KEY ("source", "id");

ALTER TABLE ONLY "public"."cert_status"
    ADD CONSTRAINT "cert_status_pkey" PRIMARY KEY ("host");

ALTER TABLE ONLY "public"."competitor_aso"
    ADD CONSTRAINT "competitor_aso_pkey" PRIMARY KEY ("day", "country", "term", "app_id");

ALTER TABLE ONLY "public"."competitor_daily"
    ADD CONSTRAINT "competitor_daily_pkey" PRIMARY KEY ("app_id", "day", "country");

ALTER TABLE ONLY "public"."competitor_pages"
    ADD CONSTRAINT "competitor_pages_pkey" PRIMARY KEY ("domain", "url");

ALTER TABLE ONLY "public"."competitor_sites"
    ADD CONSTRAINT "competitor_sites_pkey" PRIMARY KEY ("domain");

ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("app_id");

ALTER TABLE ONLY "public"."content_plans"
    ADD CONSTRAINT "content_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cse_ranks"
    ADD CONSTRAINT "cse_ranks_pkey" PRIMARY KEY ("day", "query");

ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."error_groups"
    ADD CONSTRAINT "error_groups_pkey" PRIMARY KEY ("fp");

ALTER TABLE ONLY "public"."google_updates"
    ADD CONSTRAINT "google_updates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gsc_appearance"
    ADD CONSTRAINT "gsc_appearance_pkey" PRIMARY KEY ("day", "appearance");

ALTER TABLE ONLY "public"."gsc_daily"
    ADD CONSTRAINT "gsc_daily_pkey" PRIMARY KEY ("day", "query", "page", "country", "device");

ALTER TABLE ONLY "public"."gsc_index"
    ADD CONSTRAINT "gsc_index_pkey" PRIMARY KEY ("url");

ALTER TABLE ONLY "public"."gsc_search_type"
    ADD CONSTRAINT "gsc_search_type_pkey" PRIMARY KEY ("day", "type", "query");

ALTER TABLE ONLY "public"."gsc_sitemaps"
    ADD CONSTRAINT "gsc_sitemaps_pkey" PRIMARY KEY ("path");

ALTER TABLE ONLY "public"."gsc_totals"
    ADD CONSTRAINT "gsc_totals_pkey" PRIMARY KEY ("day", "type");

ALTER TABLE ONLY "public"."inbox_items"
    ADD CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("source", "item_id");

ALTER TABLE ONLY "public"."kw_ideas"
    ADD CONSTRAINT "kw_ideas_pkey" PRIMARY KEY ("q", "lang");

ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."seo_health"
    ADD CONSTRAINT "seo_health_pkey" PRIMARY KEY ("day");

ALTER TABLE ONLY "public"."seo_pages"
    ADD CONSTRAINT "seo_pages_pkey" PRIMARY KEY ("url");

ALTER TABLE ONLY "public"."share_links"
    ADD CONSTRAINT "share_links_pkey" PRIMARY KEY ("token");

ALTER TABLE ONLY "public"."short_links"
    ADD CONSTRAINT "short_links_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."social_account_daily"
    ADD CONSTRAINT "social_account_daily_pkey" PRIMARY KEY ("platform", "day");

ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("platform");

ALTER TABLE ONLY "public"."social_audience"
    ADD CONSTRAINT "social_audience_pkey" PRIMARY KEY ("platform", "breakdown", "k");

ALTER TABLE ONLY "public"."social_competitor_daily"
    ADD CONSTRAINT "social_competitor_daily_pkey" PRIMARY KEY ("platform", "handle", "day");

ALTER TABLE ONLY "public"."social_competitors"
    ADD CONSTRAINT "social_competitors_pkey" PRIMARY KEY ("platform", "handle");

ALTER TABLE ONLY "public"."social_post_daily"
    ADD CONSTRAINT "social_post_daily_pkey" PRIMARY KEY ("platform", "post_id", "day");

ALTER TABLE ONLY "public"."social_post_day"
    ADD CONSTRAINT "social_post_day_pkey" PRIMARY KEY ("platform", "post_id", "day");

ALTER TABLE ONLY "public"."social_post_groups"
    ADD CONSTRAINT "social_post_groups_pkey" PRIMARY KEY ("platform", "post_id");

ALTER TABLE ONLY "public"."social_post_hourly"
    ADD CONSTRAINT "social_post_hourly_pkey" PRIMARY KEY ("platform", "post_id", "at");

ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY ("platform", "post_id");

ALTER TABLE ONLY "public"."social_retention"
    ADD CONSTRAINT "social_retention_pkey" PRIMARY KEY ("platform", "post_id", "x");

ALTER TABLE ONLY "public"."social_stories"
    ADD CONSTRAINT "social_stories_pkey" PRIMARY KEY ("platform", "story_id");

ALTER TABLE ONLY "public"."store_daily"
    ADD CONSTRAINT "store_daily_pkey" PRIMARY KEY ("store", "day", "country");

ALTER TABLE ONLY "public"."store_metrics"
    ADD CONSTRAINT "store_metrics_pkey" PRIMARY KEY ("store", "day", "metric", "dim", "k");

ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("store", "review_id");

ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."uptime_checks"
    ADD CONSTRAINT "uptime_checks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."uptime_targets"
    ADD CONSTRAINT "uptime_targets_pkey" PRIMARY KEY ("url");

CREATE INDEX "admin_audit_at" ON "public"."admin_audit" USING "btree" ("at" DESC);

CREATE INDEX "admin_audit_target" ON "public"."admin_audit" USING "btree" ("target");

CREATE INDEX "admin_cron_calls_path_at" ON "public"."admin_cron_calls" USING "btree" ("path", "at" DESC);

CREATE INDEX "admin_notes_day" ON "public"."admin_notes" USING "btree" ("day");

CREATE INDEX "admin_runs_job_at" ON "public"."admin_runs" USING "btree" ("job", "started_at" DESC);

CREATE INDEX "admin_sess_attr_ch" ON "public"."admin_sess_attr" USING "btree" ("ch");

CREATE INDEX "admin_sess_attr_lg" ON "public"."admin_sess_attr" USING "btree" ("lg");

CREATE INDEX "admin_user_notes_user" ON "public"."admin_user_notes" USING "btree" ("user_id");

CREATE INDEX "gsc_daily_day" ON "public"."gsc_daily" USING "btree" ("day");

CREATE INDEX "inbox_items_new" ON "public"."inbox_items" USING "btree" ("done", "created_at" DESC);

CREATE INDEX "link_clicks_code_at" ON "public"."link_clicks" USING "btree" ("code", "at");

CREATE INDEX "link_clicks_visitor_at" ON "public"."link_clicks" USING "btree" ("at") WHERE ("visitor" IS NOT NULL);

CREATE INDEX "uptime_checks_at" ON "public"."uptime_checks" USING "btree" ("at" DESC);

CREATE INDEX "uptime_checks_target_via_at" ON "public"."uptime_checks" USING "btree" ("target", "via", "at");

CREATE OR REPLACE TRIGGER "admin_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."admin_announcements" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_trg"('kozlemeny');

CREATE OR REPLACE TRIGGER "admin_audit" AFTER INSERT OR DELETE OR UPDATE OF "threshold", "on_", "op", "window_min" ON "public"."alert_rules" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_trg"('szabaly');

CREATE OR REPLACE TRIGGER "admin_audit" AFTER INSERT OR DELETE OR UPDATE OF "publish", "status", "day", "platforms" ON "public"."content_plans" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_trg"('terv');

CREATE OR REPLACE TRIGGER "admin_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."short_links" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_trg"('link');

CREATE OR REPLACE TRIGGER "admin_audit" AFTER INSERT OR DELETE OR UPDATE OF "on_" ON "public"."uptime_targets" FOR EACH ROW EXECUTE FUNCTION "public"."admin_audit_trg"('figyeles');

CREATE OR REPLACE TRIGGER "social_posts_keep_created" BEFORE INSERT ON "public"."social_posts" FOR EACH ROW EXECUTE FUNCTION "public"."social_posts_keep_created"();

CREATE OR REPLACE TRIGGER "social_posts_merge_manual" AFTER INSERT ON "public"."social_posts" FOR EACH ROW EXECUTE FUNCTION "public"."social_posts_merge_manual"();

ALTER TABLE ONLY "public"."admin_user_days"
    ADD CONSTRAINT "admin_user_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."admin_user_notes"
    ADD CONSTRAINT "admin_user_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."competitor_daily"
    ADD CONSTRAINT "competitor_daily_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."competitors"("app_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_code_fkey" FOREIGN KEY ("code") REFERENCES "public"."short_links"("code") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."admin_alert_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_announcements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_bot_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_cron_calls" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_cwv" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_experiments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_own_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_own_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_push_sent" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_push_subs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_releases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_rollup_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_runs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_secrets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_sess_attr" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_solved" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_tracked_queries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_user_days" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_user_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admin_week_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_visibility" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."alert_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bing_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bing_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."brand_mentions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cert_status" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."competitor_aso" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."competitor_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."competitor_pages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."competitor_sites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."competitors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."content_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cse_ranks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."error_groups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."google_updates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_appearance" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_index" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_search_type" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_sitemaps" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gsc_totals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inbox_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."kw_ideas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."link_clicks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."seo_health" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."seo_pages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."share_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."short_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_account_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_audience" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_competitor_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_competitors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_post_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_post_day" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_post_groups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_post_hourly" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_retention" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."social_stories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."store_daily" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."store_metrics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."store_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."uptime_checks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."uptime_targets" ENABLE ROW LEVEL SECURITY;

do $acl$ declare r record; begin
  for r in select c.oid::regclass t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('admin_alert_state', 'admin_announcements', 'admin_announcements_id_seq', 'admin_audit', 'admin_audit_id_seq', 'admin_bot_sessions', 'admin_cron_calls', 'admin_cwv', 'admin_daily', 'admin_emails', 'admin_experiments', 'admin_experiments_id_seq', 'admin_goals', 'admin_notes', 'admin_notes_id_seq', 'admin_own_accounts', 'admin_own_sessions', 'admin_push_sent', 'admin_push_subs', 'admin_releases', 'admin_rollup_state', 'admin_runs', 'admin_runs_id_seq', 'admin_secrets', 'admin_sess_attr', 'admin_settings', 'admin_solved', 'admin_tracked_queries', 'admin_user_days', 'admin_user_notes', 'admin_user_notes_id_seq', 'admin_week_plans', 'admins', 'ai_visibility', 'alert_rules', 'alert_rules_id_seq', 'bing_daily', 'bing_links', 'brand_mentions', 'cert_status', 'competitor_aso', 'competitor_daily', 'competitor_pages', 'competitor_sites', 'competitors', 'content_plans', 'content_plans_id_seq', 'cse_ranks', 'email_events', 'error_groups', 'google_updates', 'gsc_appearance', 'gsc_daily', 'gsc_index', 'gsc_search_type', 'gsc_sitemaps', 'gsc_totals', 'inbox_items', 'kw_ideas', 'link_clicks', 'link_clicks_id_seq', 'seo_health', 'seo_pages', 'share_links', 'short_links', 'social_account_daily', 'social_accounts', 'social_audience', 'social_competitor_daily', 'social_competitors', 'social_post_daily', 'social_post_day', 'social_post_groups', 'social_post_hourly', 'social_posts', 'social_retention', 'social_stories', 'store_daily', 'store_metrics', 'store_reviews', 'sync_log', 'sync_log_id_seq', 'uptime_checks', 'uptime_checks_id_seq', 'uptime_targets') loop
    execute format('revoke all on %s from public, anon, authenticated', r.t);
  end loop;
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('_admin_patch', 'admin_activation', 'admin_alert_mark', 'admin_alerts_sync', 'admin_announce_delete', 'admin_announce_list', 'admin_announce_save', 'admin_articles', 'admin_audience', 'admin_audit_add', 'admin_audit_list', 'admin_audit_note', 'admin_audit_trg', 'admin_badges', 'admin_bots_tick', 'admin_brand', 'admin_brand_seen', 'admin_breadcrumbs', 'admin_channel', 'admin_channel_detail', 'admin_cohorts_source', 'admin_collect_days', 'admin_collect_days_t', 'admin_competitor_delete', 'admin_competitors', 'admin_connections', 'admin_cron_call_long', 'admin_cron_ok', 'admin_cron_run', 'admin_cron_toggle', 'admin_cron_token_rotate', 'admin_cron_token_rotate_job', 'admin_cse_ranks', 'admin_cwv_list', 'admin_dashboard', 'admin_data_quality', 'admin_day_replay', 'admin_digest', 'admin_digest_data', 'admin_digest_errors', 'admin_digest_t', 'admin_disconnect', 'admin_dropout_sessions', 'admin_dropouts', 'admin_email_hook', 'admin_email_ok', 'admin_error_ai', 'admin_error_state', 'admin_events', 'admin_exp_sum', 'admin_experiment_delete', 'admin_experiment_save', 'admin_experiments_list', 'admin_first', 'admin_fresh', 'admin_funnel', 'admin_funnel_weeks', 'admin_gate', 'admin_goal_save', 'admin_goal_value', 'admin_goals_compute', 'admin_goals_list', 'admin_goals_list_internal', 'admin_grand_total', 'admin_gsc_days', 'admin_gsc_index', 'admin_gsc_last', 'admin_gsc_page', 'admin_heat_ch', 'admin_home_extra', 'admin_import_posts', 'admin_impressions', 'admin_inbox', 'admin_inbox_done', 'admin_inbox_done_many', 'admin_inbox_replied', 'admin_inbox_seen', 'admin_inbox_tag', 'admin_inbox_tag_set', 'admin_jobs_failing', 'admin_key_ok', 'admin_key_set', 'admin_key_status', 'admin_leads', 'admin_link_delete', 'admin_link_for_post', 'admin_link_save', 'admin_links', 'admin_links_detail', 'admin_live', 'admin_live_posts', 'admin_mark_bots', 'admin_mark_own', 'admin_mark_own_short', 'admin_markets', 'admin_monitor', 'admin_norm_post_url', 'admin_norm_url', 'admin_nosrc', 'admin_note_delete', 'admin_note_save', 'admin_note_update', 'admin_note_user_delete', 'admin_note_user_done', 'admin_note_user_save', 'admin_notes_list', 'admin_own_account_set', 'admin_own_accounts_list', 'admin_own_events_trg', 'admin_own_list', 'admin_own_uid', 'admin_partners', 'admin_people', 'admin_people_today', 'admin_period', 'admin_pf_guess', 'admin_plan_delete', 'admin_plan_media_clear', 'admin_plan_media_old', 'admin_plan_move', 'admin_plan_posts', 'admin_plan_save', 'admin_plans', 'admin_platform_alerts', 'admin_platform_today', 'admin_post', 'admin_post_gains', 'admin_post_gains_day', 'admin_post_group_set', 'admin_post_id_of', 'admin_post_manual_delete', 'admin_post_manual_save', 'admin_post_views_at', 'admin_product', 'admin_push_delete', 'admin_push_latest', 'admin_push_prefs', 'admin_push_prefs_save', 'admin_push_save', 'admin_push_status', 'admin_r_accounts', 'admin_r_appearance_has', 'admin_r_competitor_ids', 'admin_r_cwv_urls', 'admin_r_digest_extra', 'admin_r_digest_slot', 'admin_r_due_plans', 'admin_r_evening', 'admin_r_gsc_has', 'admin_r_health', 'admin_r_inbox_item', 'admin_r_index_queue', 'admin_r_keys', 'admin_r_log_count', 'admin_r_plan', 'admin_r_push_news', 'admin_r_push_prefs', 'admin_r_push_subs', 'admin_r_push_system', 'admin_r_push_wake', 'admin_r_recipients', 'admin_r_rules', 'admin_r_social_state', 'admin_r_store_has', 'admin_r_support_item', 'admin_r_uptime_targets', 'admin_r_watch', 'admin_range', 'admin_ranks', 'admin_report', 'admin_retention', 'admin_retention_ch', 'admin_rollup', 'admin_rollup_status', 'admin_rule_save', 'admin_rule_value', 'admin_search', 'admin_selfcheck', 'admin_seo', 'admin_seo_alerts', 'admin_seo_week', 'admin_server_lock_status', 'admin_server_lock_t', 'admin_server_token', 'admin_sess', 'admin_sess_attr_rebuild', 'admin_setting_get', 'admin_setting_save', 'admin_share_create', 'admin_share_delete', 'admin_share_list', 'admin_signins', 'admin_signups_matched', 'admin_social', 'admin_social_reach', 'admin_solved_list', 'admin_solved_set', 'admin_spikes', 'admin_stores', 'admin_system_alerts', 'admin_test_results', 'admin_today', 'admin_today_more', 'admin_token_age', 'admin_total', 'admin_touch', 'admin_track_flag_set', 'admin_track_query', 'admin_traffic', 'admin_tz_set', 'admin_uptime_target_save', 'admin_uptime_tick', 'admin_user', 'admin_user_export', 'admin_user_facts', 'admin_user_more', 'admin_user_suspend', 'admin_users', 'admin_users_stats', 'admin_viral', 'admin_visit', 'admin_w_competitor_daily', 'admin_w_competitors', 'admin_w_cwv', 'admin_w_digest_sent', 'admin_w_growth_rows', 'admin_w_gsc_daily', 'admin_w_gsc_index', 'admin_w_inbox_flag', 'admin_w_inbox_items', 'admin_w_inbox_reply', 'admin_w_key', 'admin_w_log', 'admin_w_plan_claim', 'admin_w_plan_result', 'admin_w_push_result', 'admin_w_push_sent', 'admin_w_rows', 'admin_w_run_end', 'admin_w_run_start', 'admin_w_seo_prune', 'admin_w_social_account_daily', 'admin_w_social_account_patch', 'admin_w_social_accounts', 'admin_w_social_audience', 'admin_w_social_daily_claim', 'admin_w_social_post_daily', 'admin_w_social_post_day', 'admin_w_social_post_hourly', 'admin_w_social_posts', 'admin_w_social_retention', 'admin_w_social_state', 'admin_w_social_stories', 'admin_w_store_daily', 'admin_w_store_metrics', 'admin_w_store_reviews', 'admin_w_test_result', 'admin_w_update_notes', 'admin_w_uptime', 'admin_w_week_plan', 'admin_watch_set', 'admin_week_plan', 'admin_week_plan_save', 'admin_youtube', 'events_sess_attr', 'follow_short_link', 'is_admin', 'public_announcements', 'public_report', 'social_posts_keep_created', 'social_posts_merge_manual', 'support_submit', 'track_flags') loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end $acl$;

REVOKE ALL ON FUNCTION "public"."_admin_patch"("p_sig" "text", "p_pairs" "text"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."_admin_patch"("p_sig" "text", "p_pairs" "text"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_activation"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_activation"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_activation"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_alert_mark"("p_k" "text", "p_state" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_alert_mark"("p_k" "text", "p_state" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_alert_mark"("p_k" "text", "p_state" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_alerts_sync"("p_list" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_alerts_sync"("p_list" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_alerts_sync"("p_list" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_announce_delete"("p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_announce_delete"("p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_announce_delete"("p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_announce_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_announce_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_announce_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_announce_save"("p" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_announce_save"("p" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_announce_save"("p" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_articles"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_articles"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_articles"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_audience"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_audience"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_audience"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_audit_add"("p_action" "text", "p_target" "text", "p_detail" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_audit_add"("p_action" "text", "p_target" "text", "p_detail" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_audit_list"("p_kind" "text", "p_limit" integer, "p_offset" integer, "p_target" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_audit_list"("p_kind" "text", "p_limit" integer, "p_offset" integer, "p_target" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_audit_list"("p_kind" "text", "p_limit" integer, "p_offset" integer, "p_target" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_audit_note"("p_action" "text", "p_target" "text", "p_detail" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_audit_note"("p_action" "text", "p_target" "text", "p_detail" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_audit_note"("p_action" "text", "p_target" "text", "p_detail" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_audit_trg"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_audit_trg"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_badges"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_badges"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_badges"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_bots_tick"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_bots_tick"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_brand"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_brand"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_brand"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_brand_seen"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_brand_seen"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_brand_seen"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_breadcrumbs"("p_session" "text", "p_before" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_breadcrumbs"("p_session" "text", "p_before" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_breadcrumbs"("p_session" "text", "p_before" timestamp with time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_channel"("src" "jsonb", "ia" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_channel"("src" "jsonb", "ia" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_channel"("src" "jsonb", "ia" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_channel_detail"("p_ch" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_channel_detail"("p_ch" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_channel_detail"("p_ch" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cohorts_source"("p_days" integer, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cohorts_source"("p_days" integer, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cohorts_source"("p_days" integer, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_collect_days"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_collect_days"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_collect_days"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_collect_days_t"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_collect_days_t"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_collect_days_t"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_collect_days_t"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_competitor_delete"("p_app_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_competitor_delete"("p_app_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_competitor_delete"("p_app_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_competitors"("p_country" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_competitors"("p_country" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_competitors"("p_country" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_connections"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_connections"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_connections"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_call_long"("p_path" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_call_long"("p_path" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_ok"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_ok"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_cron_ok"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cron_ok"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_run"("p_job" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_run"("p_job" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cron_run"("p_job" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_toggle"("p_job" "text", "p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_toggle"("p_job" "text", "p_on" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cron_toggle"("p_job" "text", "p_on" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_token_rotate"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_token_rotate"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cron_token_rotate"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cron_token_rotate_job"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cron_token_rotate_job"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cse_ranks"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cse_ranks"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cse_ranks"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_cwv_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_cwv_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_cwv_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_dashboard"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_dashboard"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_dashboard"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_data_quality"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_data_quality"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_data_quality"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_day_replay"("p_day" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_day_replay"("p_day" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_day_replay"("p_day" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_digest"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_digest"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_digest_data"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_digest_data"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_digest_errors"("a" timestamp with time zone, "b" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_digest_errors"("a" timestamp with time zone, "b" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_digest_t"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_digest_t"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_digest_t"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_digest_t"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_disconnect"("p_platform" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_disconnect"("p_platform" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_disconnect"("p_platform" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_dropout_sessions"("p_days" integer, "p_at" "text", "p_last" "text", "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_dropout_sessions"("p_days" integer, "p_at" "text", "p_last" "text", "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_dropout_sessions"("p_days" integer, "p_at" "text", "p_last" "text", "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_dropouts"("p_days" integer, "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_dropouts"("p_days" integer, "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_dropouts"("p_days" integer, "p_ch" "text", "p_lang" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_email_hook"("p_id" "text", "p_ts" "text", "p_sig" "text", "p_body" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_email_hook"("p_id" "text", "p_ts" "text", "p_sig" "text", "p_body" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_email_hook"("p_id" "text", "p_ts" "text", "p_sig" "text", "p_body" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_email_ok"("p_email" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_email_ok"("p_email" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_error_ai"("p_fp" "text", "p_text" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_error_ai"("p_fp" "text", "p_text" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_error_ai"("p_fp" "text", "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_error_state"("p_fp" "text", "p_state" "text", "p_note" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_error_state"("p_fp" "text", "p_state" "text", "p_note" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_error_state"("p_fp" "text", "p_state" "text", "p_note" "text") TO "authenticated";

GRANT ALL ON TABLE "public"."admin_bot_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."admin_own_sessions" TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_events"("p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_events"("p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_exp_sum"("p_metric" "text", "p_ch" "text", "p_lg" "text", "p_d0" "date", "p_d1" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_exp_sum"("p_metric" "text", "p_ch" "text", "p_lg" "text", "p_d0" "date", "p_d1" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_experiment_delete"("p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_experiment_delete"("p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_experiment_delete"("p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_experiment_save"("p" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_experiment_save"("p" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_experiment_save"("p" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_experiments_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_experiments_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_experiments_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_first"("p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_first"("p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_fresh"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_fresh"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_fresh"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_funnel"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_funnel"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_funnel"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_funnel_weeks"("p_weeks" integer, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_funnel_weeks"("p_weeks" integer, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_funnel_weeks"("p_weeks" integer, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_gate"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_gate"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_goal_save"("p_metric" "text", "p_period" "text", "p_target" integer, "p_start" "date", "p_end" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_goal_save"("p_metric" "text", "p_period" "text", "p_target" integer, "p_start" "date", "p_end" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_goal_save"("p_metric" "text", "p_period" "text", "p_target" integer, "p_start" "date", "p_end" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_goal_value"("p_metric" "text", "p_t0" timestamp with time zone, "p_t1" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_goal_value"("p_metric" "text", "p_t0" timestamp with time zone, "p_t1" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_goals_compute"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_goals_compute"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_goals_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_goals_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_goals_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_goals_list_internal"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_goals_list_internal"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_grand_total"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_grand_total"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_grand_total"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_gsc_days"("p_d0" "date", "p_d1" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_gsc_days"("p_d0" "date", "p_d1" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_gsc_index"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_gsc_index"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_gsc_index"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_gsc_last"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_gsc_last"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_gsc_page"("p_page" "text", "p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_gsc_page"("p_page" "text", "p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_gsc_page"("p_page" "text", "p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_heat_ch"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_heat_ch"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_heat_ch"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_home_extra"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_home_extra"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_home_extra"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_import_posts"("p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_import_posts"("p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_import_posts"("p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_impressions"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_impressions"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_impressions"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox"("p_all" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox"("p_all" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox"("p_all" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_done"("p_source" "text", "p_item" "text", "p_done" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_done"("p_source" "text", "p_item" "text", "p_done" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_done"("p_source" "text", "p_item" "text", "p_done" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_done_many"("p_items" "jsonb", "p_done" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_done_many"("p_items" "jsonb", "p_done" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_done_many"("p_items" "jsonb", "p_done" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_replied"("p_source" "text", "p_item" "text", "p_text" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_replied"("p_source" "text", "p_item" "text", "p_text" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_replied"("p_source" "text", "p_item" "text", "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_seen"("p_source" "text", "p_item" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_seen"("p_source" "text", "p_item" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_seen"("p_source" "text", "p_item" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_tag"("body" "text", "rating" integer, "kind" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_tag"("body" "text", "rating" integer, "kind" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_tag"("body" "text", "rating" integer, "kind" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_inbox_tag_set"("p_source" "text", "p_item" "text", "p_tag" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_inbox_tag_set"("p_source" "text", "p_item" "text", "p_tag" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_inbox_tag_set"("p_source" "text", "p_item" "text", "p_tag" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_jobs_failing"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_jobs_failing"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_key_ok"("p_name" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_key_ok"("p_name" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_key_set"("p_name" "text", "p_value" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_key_set"("p_name" "text", "p_value" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_key_set"("p_name" "text", "p_value" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_key_status"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_key_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_key_status"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_leads"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_leads"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_leads"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_link_delete"("p_code" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_link_delete"("p_code" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_link_delete"("p_code" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_link_for_post"("p_platform" "text", "p_post_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_link_for_post"("p_platform" "text", "p_post_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_link_for_post"("p_platform" "text", "p_post_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_link_save"("p_code" "text", "p_target" "text", "p_source" "text", "p_medium" "text", "p_campaign" "text", "p_note" "text", "p_post_platform" "text", "p_post_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_link_save"("p_code" "text", "p_target" "text", "p_source" "text", "p_medium" "text", "p_campaign" "text", "p_note" "text", "p_post_platform" "text", "p_post_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_link_save"("p_code" "text", "p_target" "text", "p_source" "text", "p_medium" "text", "p_campaign" "text", "p_note" "text", "p_post_platform" "text", "p_post_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_links"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_links"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_links"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_links_detail"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_links_detail"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_links_detail"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_live"("p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_live"("p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_live"("p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_live_posts"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_live_posts"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_live_posts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_mark_bots"("p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_mark_bots"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_mark_own"("p_session" "text", "p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_mark_own"("p_session" "text", "p_on" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_mark_own"("p_session" "text", "p_on" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_mark_own_short"("p_short" "text", "p_on" boolean, "p_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_mark_own_short"("p_short" "text", "p_on" boolean, "p_at" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_mark_own_short"("p_short" "text", "p_on" boolean, "p_at" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_markets"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_markets"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_markets"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_monitor"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_monitor"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_monitor"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_norm_post_url"("u" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_norm_post_url"("u" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_norm_post_url"("u" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_norm_url"("u" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_norm_url"("u" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_norm_url"("u" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_nosrc"("src" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_nosrc"("src" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_nosrc"("src" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_delete"("p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_delete"("p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_delete"("p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_save"("p_day" "date", "p_kind" "text", "p_text" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_save"("p_day" "date", "p_kind" "text", "p_text" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_save"("p_day" "date", "p_kind" "text", "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_update"("p_id" bigint, "p_day" "date", "p_kind" "text", "p_text" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_update"("p_id" bigint, "p_day" "date", "p_kind" "text", "p_text" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_update"("p_id" bigint, "p_day" "date", "p_kind" "text", "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_user_delete"("p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_user_delete"("p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_user_delete"("p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_user_done"("p_id" bigint, "p_done" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_user_done"("p_id" bigint, "p_done" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_user_done"("p_id" bigint, "p_done" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_note_user_save"("p_user" "uuid", "p_body" "text", "p_tags" "text"[], "p_follow" "date", "p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_note_user_save"("p_user" "uuid", "p_body" "text", "p_tags" "text"[], "p_follow" "date", "p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_note_user_save"("p_user" "uuid", "p_body" "text", "p_tags" "text"[], "p_follow" "date", "p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_notes_list"("p_from" "date", "p_to" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_notes_list"("p_from" "date", "p_to" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_notes_list"("p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_own_account_set"("p_email" "text", "p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_own_account_set"("p_email" "text", "p_on" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_own_account_set"("p_email" "text", "p_on" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_own_accounts_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_own_accounts_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_own_accounts_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_own_events_trg"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_own_events_trg"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_own_events_trg"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_own_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_own_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_own_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_own_uid"("p_uid" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_own_uid"("p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_partners"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_partners"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_partners"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_people"("p_q" "text", "p_filter" "text", "p_limit" integer, "p_offset" integer, "p_lang" "text", "p_provider" "text", "p_ch" "text", "p_sort" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_people"("p_q" "text", "p_filter" "text", "p_limit" integer, "p_offset" integer, "p_lang" "text", "p_provider" "text", "p_ch" "text", "p_sort" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_people"("p_q" "text", "p_filter" "text", "p_limit" integer, "p_offset" integer, "p_lang" "text", "p_provider" "text", "p_ch" "text", "p_sort" "text", "p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_people_today"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_people_today"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_people_today"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_period"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_period"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_pf_guess"("src" "jsonb", "pf" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_pf_guess"("src" "jsonb", "pf" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_delete"("p_id" bigint) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_delete"("p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_delete"("p_id" bigint) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_media_clear"("p_ids" bigint[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_media_clear"("p_ids" bigint[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_media_clear"("p_ids" bigint[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_media_old"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_media_old"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_media_old"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_move"("p_id" bigint, "p_day" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_move"("p_id" bigint, "p_day" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_move"("p_id" bigint, "p_day" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_posts"("p_from" "date", "p_to" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_posts"("p_from" "date", "p_to" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_posts"("p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plan_save"("p" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plan_save"("p" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plan_save"("p" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_plans"("p_from" "date", "p_to" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_plans"("p_from" "date", "p_to" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_plans"("p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_platform_alerts"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_platform_alerts"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_platform_alerts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_platform_today"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_platform_today"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_platform_today"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post"("p_platform" "text", "p_post_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post"("p_platform" "text", "p_post_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post"("p_platform" "text", "p_post_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_gains"("p_from" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_gains"("p_from" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_gains_day"("p_day" "date", "p_platform" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_gains_day"("p_day" "date", "p_platform" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_group_set"("p_platform" "text", "p_post_id" "text", "p_grp" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_group_set"("p_platform" "text", "p_post_id" "text", "p_grp" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post_group_set"("p_platform" "text", "p_post_id" "text", "p_grp" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_id_of"("p_platform" "text", "u" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_id_of"("p_platform" "text", "u" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post_id_of"("p_platform" "text", "u" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_manual_delete"("p_platform" "text", "p_post_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_manual_delete"("p_platform" "text", "p_post_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post_manual_delete"("p_platform" "text", "p_post_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_manual_save"("p_platform" "text", "p_url" "text", "p_created_at" timestamp with time zone, "p_title" "text", "p_kind" "text", "p_views" bigint, "p_likes" bigint, "p_comments" bigint, "p_shares" bigint, "p_saves" bigint, "p_impressions" bigint, "p_post_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_manual_save"("p_platform" "text", "p_url" "text", "p_created_at" timestamp with time zone, "p_title" "text", "p_kind" "text", "p_views" bigint, "p_likes" bigint, "p_comments" bigint, "p_shares" bigint, "p_saves" bigint, "p_impressions" bigint, "p_post_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post_manual_save"("p_platform" "text", "p_url" "text", "p_created_at" timestamp with time zone, "p_title" "text", "p_kind" "text", "p_views" bigint, "p_likes" bigint, "p_comments" bigint, "p_shares" bigint, "p_saves" bigint, "p_impressions" bigint, "p_post_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_post_views_at"("p_platform" "text", "p_post_id" "text", "p_created" timestamp with time zone, "p_cur" bigint, "p_day" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_post_views_at"("p_platform" "text", "p_post_id" "text", "p_created" timestamp with time zone, "p_cur" bigint, "p_day" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_post_views_at"("p_platform" "text", "p_post_id" "text", "p_created" timestamp with time zone, "p_cur" bigint, "p_day" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_product"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_product"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_product"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_delete"("p_endpoint" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_delete"("p_endpoint" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_delete"("p_endpoint" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_latest"("p_since" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_latest"("p_since" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_latest"("p_since" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_prefs"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_prefs"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_prefs"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_prefs_save"("p" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_prefs_save"("p" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_prefs_save"("p" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_save"("p_sub" "jsonb", "p_ua" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_save"("p_sub" "jsonb", "p_ua" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_save"("p_sub" "jsonb", "p_ua" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_push_status"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_push_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_push_status"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_accounts"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_accounts"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_accounts"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_accounts"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_appearance_has"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_appearance_has"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_appearance_has"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_appearance_has"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_competitor_ids"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_cwv_urls"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_cwv_urls"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_cwv_urls"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_digest_extra"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_digest_extra"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_digest_extra"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_digest_slot"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_digest_slot"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_digest_slot"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_due_plans"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_due_plans"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_due_plans"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_evening"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_evening"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_evening"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_gsc_has"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_gsc_has"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_gsc_has"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_gsc_has"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_health"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_health"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_health"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_health"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_inbox_item"("p_token" "text", "p_source" "text", "p_item" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_inbox_item"("p_token" "text", "p_source" "text", "p_item" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_inbox_item"("p_token" "text", "p_source" "text", "p_item" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_index_queue"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_index_queue"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_index_queue"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_index_queue"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_keys"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_keys"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_keys"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_keys"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_log_count"("p_token" "text", "p_source" "text", "p_since" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_plan"("p_token" "text", "p_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_push_news"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_push_news"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_push_news"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_push_prefs"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_push_prefs"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_push_prefs"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_push_prefs"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_push_subs"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_push_subs"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_push_subs"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_push_system"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_push_system"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_push_system"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_push_system"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_push_wake"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_push_wake"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_push_wake"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_recipients"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_recipients"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_recipients"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_recipients"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_rules"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_rules"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_rules"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_rules"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_social_state"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_social_state"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_social_state"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_social_state"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_store_has"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_store_has"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_store_has"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_store_has"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_support_item"("p_token" "text", "p_item" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_uptime_targets"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_uptime_targets"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_uptime_targets"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_r_watch"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_r_watch"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_r_watch"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_range"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_range"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_ranks"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_ranks"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_ranks"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_report"("p_from" "date", "p_to" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_report"("p_from" "date", "p_to" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_report"("p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_retention"("p_days" integer, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_retention"("p_days" integer, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_retention"("p_days" integer, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_retention_ch"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_retention_ch"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_retention_ch"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_rollup"("p_from" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_rollup"("p_from" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_rollup_status"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_rollup_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_rollup_status"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_rule_save"("p" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_rule_save"("p" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_rule_save"("p" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_rule_value"("p_metric" "text", "p_window_min" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_rule_value"("p_metric" "text", "p_window_min" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_search"("p_days" integer, "p_country" "text", "p_device" "text", "p_page" "text", "p_q" "text", "p_brand" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_search"("p_days" integer, "p_country" "text", "p_device" "text", "p_page" "text", "p_q" "text", "p_brand" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_search"("p_days" integer, "p_country" "text", "p_device" "text", "p_page" "text", "p_q" "text", "p_brand" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_selfcheck"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_selfcheck"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_selfcheck"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_seo"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_seo"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_seo"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_seo_alerts"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_seo_alerts"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_seo_alerts"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_seo_week"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_seo_week"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_seo_week"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_server_lock_status"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_server_lock_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_server_lock_status"() TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_server_lock_t"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_server_lock_t"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_server_lock_t"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_server_token"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_server_token"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_server_token"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_sess"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_sess"("a" timestamp with time zone, "b" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_sess_attr_rebuild"("p_from" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_sess_attr_rebuild"("p_from" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_setting_get"("p_k" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_setting_get"("p_k" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_setting_get"("p_k" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_setting_save"("p_k" "text", "p_v" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_setting_save"("p_k" "text", "p_v" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_setting_save"("p_k" "text", "p_v" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_share_create"("p_label" "text", "p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_share_create"("p_label" "text", "p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_share_create"("p_label" "text", "p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_share_delete"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_share_delete"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_share_delete"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_share_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_share_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_share_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_signins"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_signins"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_signins"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_signups_matched"("a" timestamp with time zone, "b" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_signups_matched"("a" timestamp with time zone, "b" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_social"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_social"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_social"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_social_reach"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_social_reach"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_social_reach"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_solved_list"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_solved_list"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_solved_list"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_solved_set"("p_key" "text", "p_provider" "text", "p_msg" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_solved_set"("p_key" "text", "p_provider" "text", "p_msg" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_solved_set"("p_key" "text", "p_provider" "text", "p_msg" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_spikes"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_spikes"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_spikes"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_stores"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_stores"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_stores"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_system_alerts"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_system_alerts"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_system_alerts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_test_results"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_test_results"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_test_results"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_today"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_today"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_today"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_today_more"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_today_more"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_today_more"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_token_age"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_token_age"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_token_age"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_total"("p_k" "text", "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_total"("p_k" "text", "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_touch"("p_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_touch"("p_days" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_touch"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_track_flag_set"("p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_track_flag_set"("p_on" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_track_flag_set"("p_on" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_track_query"("p_q" "text", "p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_track_query"("p_q" "text", "p_on" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_track_query"("p_q" "text", "p_on" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_traffic"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_traffic"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_traffic"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_tz_set"("p_tz" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_tz_set"("p_tz" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_tz_set"("p_tz" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_uptime_target_save"("p_url" "text", "p_on" boolean, "p_label" "text", "p_ok_max" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_uptime_target_save"("p_url" "text", "p_on" boolean, "p_label" "text", "p_ok_max" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_uptime_target_save"("p_url" "text", "p_on" boolean, "p_label" "text", "p_ok_max" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_uptime_tick"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_uptime_tick"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_user"("p_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_user"("p_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_user"("p_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_user_export"("p_user" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_user_export"("p_user" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_user_export"("p_user" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_user_facts"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_user_facts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_user_more"("p_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_user_more"("p_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_user_more"("p_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_user_suspend"("p_user" "uuid", "p_on" boolean, "p_reason" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_user_suspend"("p_user" "uuid", "p_on" boolean, "p_reason" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_user_suspend"("p_user" "uuid", "p_on" boolean, "p_reason" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_users"("p_q" "text", "p_limit" integer, "p_offset" integer, "p_filter" "text", "p_lang" "text", "p_provider" "text", "p_ch" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_users"("p_q" "text", "p_limit" integer, "p_offset" integer, "p_filter" "text", "p_lang" "text", "p_provider" "text", "p_ch" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_users"("p_q" "text", "p_limit" integer, "p_offset" integer, "p_filter" "text", "p_lang" "text", "p_provider" "text", "p_ch" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_users_stats"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text", "p_provider" "text", "p_ch" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_users_stats"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text", "p_provider" "text", "p_ch" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_users_stats"("p_days" integer, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_lang" "text", "p_provider" "text", "p_ch" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_viral"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_viral"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_viral"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_ch" "text", "p_lang" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_visit"("p_session" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_visit"("p_session" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_competitor_daily"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_competitors"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_cwv"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_cwv"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_cwv"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_digest_sent"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_digest_sent"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_digest_sent"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_growth_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_gsc_daily"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_gsc_index"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_gsc_index"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_gsc_index"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_flag"("p_token" "text", "p_source" "text", "p_item" "text", "p_hidden" boolean, "p_liked" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_flag"("p_token" "text", "p_source" "text", "p_item" "text", "p_hidden" boolean, "p_liked" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_flag"("p_token" "text", "p_source" "text", "p_item" "text", "p_hidden" boolean, "p_liked" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_items"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_items"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_items"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_reply"("p_token" "text", "p_source" "text", "p_item" "text", "p_reply" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_reply"("p_token" "text", "p_source" "text", "p_item" "text", "p_reply" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_inbox_reply"("p_token" "text", "p_source" "text", "p_item" "text", "p_reply" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_key"("p_token" "text", "p_name" "text", "p_value" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_key"("p_token" "text", "p_name" "text", "p_value" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_key"("p_token" "text", "p_name" "text", "p_value" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_log"("p_token" "text", "p_source" "text", "p_ok" boolean, "p_rows" integer, "p_message" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_plan_claim"("p_token" "text", "p_id" bigint) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_plan_claim"("p_token" "text", "p_id" bigint) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_plan_claim"("p_token" "text", "p_id" bigint) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_plan_result"("p_token" "text", "p_id" bigint, "p_results" "jsonb", "p_done" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_plan_result"("p_token" "text", "p_id" bigint, "p_results" "jsonb", "p_done" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_plan_result"("p_token" "text", "p_id" bigint, "p_results" "jsonb", "p_done" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_push_result"("p_token" "text", "p_endpoint" "text", "p_ok" boolean, "p_gone" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_push_result"("p_token" "text", "p_endpoint" "text", "p_ok" boolean, "p_gone" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_push_result"("p_token" "text", "p_endpoint" "text", "p_ok" boolean, "p_gone" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_push_sent"("p_token" "text", "p_kind" "text", "p_key" "text", "p_title" "text", "p_body" "text", "p_url" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_push_sent"("p_token" "text", "p_kind" "text", "p_key" "text", "p_title" "text", "p_body" "text", "p_url" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_push_sent"("p_token" "text", "p_kind" "text", "p_key" "text", "p_title" "text", "p_body" "text", "p_url" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_rows"("p_token" "text", "p_table" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_run_end"("p_token" "text", "p_id" bigint, "p_ok" boolean, "p_message" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_run_start"("p_token" "text", "p_job" "text", "p_via" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_seo_prune"("p_token" "text", "p_before" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_account_daily"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_account_patch"("p_token" "text", "p_platform" "text", "p_set" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_accounts"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_social_audience"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_audience"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_audience"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_daily_claim"("p_token" "text", "p_platform" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_daily"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_day"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_hourly"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_hourly"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_post_hourly"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_posts"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_social_retention"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_retention"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_retention"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_state"("p_token" "text", "p_set" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_social_stories"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_social_stories"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_social_stories"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_store_daily"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_store_metrics"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_store_metrics"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_store_metrics"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_store_reviews"("p_token" "text", "p_rows" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_test_result"("p_token" "text", "p_id" "text", "p_ok" boolean, "p_msg" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_update_notes"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_update_notes"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_update_notes"("p_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_uptime"("p_token" "text", "p_rows" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_uptime"("p_token" "text", "p_rows" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_uptime"("p_token" "text", "p_rows" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_w_week_plan"("p_token" "text", "p_items" "jsonb", "p_force" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."admin_w_week_plan"("p_token" "text", "p_items" "jsonb", "p_force" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_w_week_plan"("p_token" "text", "p_items" "jsonb", "p_force" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_watch_set"("p_kind" "text", "p_a" "text", "p_b" "text", "p_on" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_watch_set"("p_kind" "text", "p_a" "text", "p_b" "text", "p_on" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_watch_set"("p_kind" "text", "p_a" "text", "p_b" "text", "p_on" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_week_plan"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_week_plan"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_week_plan"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_week_plan_save"("p_items" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_week_plan_save"("p_items" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_week_plan_save"("p_items" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_youtube"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."admin_youtube"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."admin_youtube"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."events_sess_attr"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."events_sess_attr"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text", "p_kind" "text", "p_device" "text", "p_own" boolean, "p_visitor" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text", "p_kind" "text", "p_device" "text", "p_own" boolean, "p_visitor" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text", "p_kind" "text", "p_device" "text", "p_own" boolean, "p_visitor" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."follow_short_link"("p_code" "text", "p_country" "text", "p_kind" "text", "p_device" "text", "p_own" boolean, "p_visitor" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."public_announcements"("p_lang" "text", "p_pf" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."public_announcements"("p_lang" "text", "p_pf" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."public_announcements"("p_lang" "text", "p_pf" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."public_announcements"("p_lang" "text", "p_pf" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."public_report"("p_token" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."public_report"("p_token" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."public_report"("p_token" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."public_report"("p_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."social_posts_keep_created"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."social_posts_keep_created"() TO "service_role";

GRANT ALL ON FUNCTION "public"."social_posts_merge_manual"() TO "anon";

GRANT ALL ON FUNCTION "public"."social_posts_merge_manual"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."social_posts_merge_manual"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text", "p_lang" "text", "p_page" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text", "p_lang" "text", "p_page" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text", "p_lang" "text", "p_page" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."support_submit"("p_email" "text", "p_body" "text", "p_name" "text", "p_lang" "text", "p_page" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."track_flags"() TO "anon";

GRANT ALL ON FUNCTION "public"."track_flags"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."track_flags"() TO "service_role";

GRANT ALL ON TABLE "public"."admin_alert_state" TO "service_role";

GRANT ALL ON TABLE "public"."admin_announcements" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_announcements_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."admin_announcements_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."admin_announcements_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_audit" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_audit_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."admin_audit_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."admin_audit_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_cron_calls" TO "service_role";

GRANT ALL ON TABLE "public"."admin_cwv" TO "service_role";

GRANT ALL ON TABLE "public"."admin_daily" TO "service_role";

GRANT ALL ON TABLE "public"."admin_emails" TO "service_role";

GRANT ALL ON TABLE "public"."admin_experiments" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_experiments_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."admin_experiments_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."admin_experiments_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_goals" TO "service_role";

GRANT ALL ON TABLE "public"."admin_notes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_notes_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_own_accounts" TO "service_role";

GRANT ALL ON TABLE "public"."admin_push_sent" TO "service_role";

GRANT ALL ON TABLE "public"."admin_push_subs" TO "service_role";

GRANT ALL ON TABLE "public"."admin_releases" TO "service_role";

GRANT ALL ON TABLE "public"."admin_rollup_state" TO "service_role";

GRANT ALL ON TABLE "public"."admin_runs" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_runs_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."admin_runs_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."admin_runs_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_secrets" TO "service_role";

GRANT ALL ON TABLE "public"."admin_sess_attr" TO "service_role";

GRANT ALL ON TABLE "public"."admin_settings" TO "service_role";

GRANT ALL ON TABLE "public"."admin_solved" TO "service_role";

GRANT ALL ON TABLE "public"."admin_tracked_queries" TO "service_role";

GRANT ALL ON TABLE "public"."admin_user_days" TO "service_role";

GRANT ALL ON TABLE "public"."admin_user_notes" TO "service_role";

GRANT ALL ON SEQUENCE "public"."admin_user_notes_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."admin_user_notes_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."admin_user_notes_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."admin_week_plans" TO "service_role";

GRANT ALL ON TABLE "public"."admins" TO "service_role";

GRANT ALL ON TABLE "public"."ai_visibility" TO "service_role";

GRANT ALL ON TABLE "public"."alert_rules" TO "service_role";

GRANT ALL ON SEQUENCE "public"."alert_rules_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."alert_rules_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."alert_rules_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."bing_daily" TO "service_role";

GRANT ALL ON TABLE "public"."bing_links" TO "service_role";

GRANT ALL ON TABLE "public"."brand_mentions" TO "service_role";

GRANT ALL ON TABLE "public"."cert_status" TO "service_role";

GRANT ALL ON TABLE "public"."competitor_aso" TO "service_role";

GRANT ALL ON TABLE "public"."competitor_daily" TO "service_role";

GRANT ALL ON TABLE "public"."competitor_pages" TO "service_role";

GRANT ALL ON TABLE "public"."competitor_sites" TO "service_role";

GRANT ALL ON TABLE "public"."competitors" TO "service_role";

GRANT ALL ON TABLE "public"."content_plans" TO "service_role";

GRANT ALL ON SEQUENCE "public"."content_plans_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."content_plans_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."content_plans_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."cse_ranks" TO "service_role";

GRANT ALL ON TABLE "public"."email_events" TO "service_role";

GRANT ALL ON TABLE "public"."error_groups" TO "service_role";

GRANT ALL ON TABLE "public"."google_updates" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_appearance" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_daily" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_index" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_search_type" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_sitemaps" TO "service_role";

GRANT ALL ON TABLE "public"."gsc_totals" TO "service_role";

GRANT ALL ON TABLE "public"."inbox_items" TO "service_role";

GRANT ALL ON TABLE "public"."kw_ideas" TO "service_role";

GRANT ALL ON TABLE "public"."link_clicks" TO "service_role";

GRANT ALL ON SEQUENCE "public"."link_clicks_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."seo_health" TO "service_role";

GRANT ALL ON TABLE "public"."seo_pages" TO "service_role";

GRANT ALL ON TABLE "public"."share_links" TO "service_role";

GRANT ALL ON TABLE "public"."short_links" TO "service_role";

GRANT ALL ON TABLE "public"."social_account_daily" TO "service_role";

GRANT ALL ON TABLE "public"."social_accounts" TO "service_role";

GRANT ALL ON TABLE "public"."social_audience" TO "service_role";

GRANT ALL ON TABLE "public"."social_competitor_daily" TO "service_role";

GRANT ALL ON TABLE "public"."social_competitors" TO "service_role";

GRANT ALL ON TABLE "public"."social_post_daily" TO "service_role";

GRANT ALL ON TABLE "public"."social_post_day" TO "service_role";

GRANT ALL ON TABLE "public"."social_post_groups" TO "service_role";

GRANT ALL ON TABLE "public"."social_post_hourly" TO "service_role";

GRANT ALL ON TABLE "public"."social_posts" TO "service_role";

GRANT ALL ON TABLE "public"."social_retention" TO "service_role";

GRANT ALL ON TABLE "public"."social_stories" TO "service_role";

GRANT ALL ON TABLE "public"."store_daily" TO "service_role";

GRANT ALL ON TABLE "public"."store_metrics" TO "service_role";

GRANT ALL ON TABLE "public"."store_reviews" TO "service_role";

GRANT ALL ON TABLE "public"."sync_log" TO "service_role";

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."uptime_checks" TO "service_role";

GRANT ALL ON SEQUENCE "public"."uptime_checks_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."uptime_checks_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."uptime_checks_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."uptime_targets" TO "service_role";

-- ---------------------------------------------------------------- InkAge: the parts written for InkAge

-- the scheduled calls go to inkage.app
CREATE OR REPLACE FUNCTION "public"."admin_cron_call"("p_path" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare rid bigint;
begin
  rid := net.http_get(url := 'https://inkage.app' || p_path,
    headers := jsonb_build_object('authorization', 'Bearer ' || (select v from public.admin_secrets where k = 'cron')),
    timeout_milliseconds := 300000);
  insert into public.admin_cron_calls (id, path) values (rid, left(p_path, 200)) on conflict (id) do nothing;
  return rid;
end $$;
REVOKE ALL ON FUNCTION "public"."admin_cron_call"("p_path" "text") FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION "public"."admin_cron_call"("p_path" "text") TO "service_role";

-- Calligra's "celeb signatures" of an account: here the AI images made for it (looks = by body part)
CREATE OR REPLACE FUNCTION "public"."admin_celeb_use"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select jsonb_build_object('total', count(*), 'ok', count(*), 'used24', count(*) filter (where g.created_at > now() - interval '24 hours'),
    'daily', null, 'last_at', max(g.created_at),
    'looks', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(g2.placement, '?') k, count(*) n from public.generations g2 where g2.user_id = p_id group by 1) x), '[]'))
  from public.generations g where g.user_id = p_id
$$;
REVOKE ALL ON FUNCTION "public"."admin_celeb_use"("p_id" "uuid") FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION "public"."admin_celeb_use"("p_id" "uuid") TO "service_role";

-- bonus previews for an account (InkAge's profiles.bonus); the welcome-gift reset does not exist here
CREATE OR REPLACE FUNCTION "public"."admin_user_credit"("p_user" "uuid", "p_delta" integer, "p_gift_reset" boolean DEFAULT false, "p_reason" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare c int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if abs(coalesce(p_delta, 0)) > 100 then raise exception 'Egyszerre legfeljebb 100 bónusz előnézet.'; end if;
  insert into public.profiles (id, bonus) values (p_user, greatest(0, coalesce(p_delta, 0))) on conflict (id) do update
    set bonus = greatest(0, coalesce(public.profiles.bonus, 0) + coalesce(p_delta, 0))
  returning bonus into c;
  perform public.admin_audit_add('fiok.bonusz', p_user::text, jsonb_build_object('változás', p_delta, 'ok', left(p_reason, 200), 'új egyenleg', c));
  return jsonb_build_object('credits', c);
end $$;
REVOKE ALL ON FUNCTION "public"."admin_user_credit"("p_user" "uuid", "p_delta" integer, "p_gift_reset" boolean, "p_reason" "text") FROM PUBLIC, anon;
GRANT ALL ON FUNCTION "public"."admin_user_credit"("p_user" "uuid", "p_delta" integer, "p_gift_reset" boolean, "p_reason" "text") TO "authenticated", "service_role";

-- deleting an account: the same clean-up as the app's own "Delete account" (erase_my_account), then the account itself
CREATE OR REPLACE FUNCTION "public"."admin_user_delete"("p_user" "uuid", "p_reason" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare e text := (select email from auth.users where id = p_user);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.admin_own_uid(p_user) then raise exception 'A saját fiókodat innen nem törölheted.'; end if;
  if e is null then raise exception 'Nincs ilyen fiók.'; end if;
  update public.community_posts set status = 'withdrawn', reviewed_at = now()
   where share_id in (select share_id from public.previews where user_id = p_user and share_id is not null)
      or share_id in (select share_id from public.guest_shares where user_id = p_user);
  update public.guest_shares set hidden = true, fresh = null, y50 = null, fresh_b = null, y50_b = null where user_id = p_user;
  update public.polls set hidden = true where user_id = p_user;
  update public.jobs set data = '{}'::jsonb where owner = p_user::text;
  delete from public.push_reminders where user_id = p_user;
  delete from public.push_devices where user_id = p_user;
  delete from public.apple_tokens where user_id = p_user;
  delete from public.author_blocks where blocker = p_user::text;
  update public.feedback set email = null where user_id = p_user;
  delete from public.previews where user_id = p_user;
  delete from public.uploads where user_id = p_user;
  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
  perform public.admin_audit_add('fiok.torles', p_user::text, jsonb_build_object('ok', left(p_reason, 200), 'domain', split_part(e, '@', 2)));
end $$;
REVOKE ALL ON FUNCTION "public"."admin_user_delete"("p_user" "uuid", "p_reason" "text") FROM PUBLIC, anon;
GRANT ALL ON FUNCTION "public"."admin_user_delete"("p_user" "uuid", "p_reason" "text") TO "authenticated", "service_role";

-- the event triggers Calligra has on its events table (visit source / language, and the owner's own visits)
drop trigger if exists events_sess_attr on public.events;
create trigger events_sess_attr after insert on public.events for each row execute function public.events_sess_attr();
drop trigger if exists admin_own_events on public.events;
create trigger admin_own_events after insert on public.events for each row execute function public.admin_own_events_trg();

-- the admin views are read only through the admin functions
revoke all on table public.events_real, public.admin_ink_profiles, public.admin_real_profiles, public.admin_ink_unlocks, public.admin_real_unlocks, public.admin_real_users from public, anon, authenticated;
grant select on table public.events_real, public.admin_ink_profiles, public.admin_real_profiles, public.admin_ink_unlocks, public.admin_real_unlocks, public.admin_real_users to service_role;

-- who may open the dashboard: the owner e-mail(s) InkAge already keeps for its admin page
insert into public.admin_emails (email)
select distinct lower(trim(x)) from private.config c, unnest(string_to_array(c.value, ',')) x
where c.key = 'admin_emails' and trim(x) like '%@%'
on conflict do nothing;

-- the token pg_cron calls the site with, and the salt of the short links' visitor hashes: made here, never leave the database
insert into public.admin_secrets (k, v) values ('cron', encode(extensions.gen_random_bytes(32), 'hex')), ('link_salt', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (k) do nothing;

-- what the uptime monitor checks, and the two default alerts
insert into public.uptime_targets (url, label, ok_max) values
  ('https://inkage.app/', 'Főoldal', 399), ('https://inkage.app/app', 'App', 399), ('https://inkage.app/tudastar', 'Tudástár', 399),
  ('https://inkage.app/api/config', 'API', 399), ('https://inkage.app/admin', 'Irányítóközpont', 399),
  ('https://ibfpdbbcnyoqazodkmna.supabase.co/auth/v1/health', 'Supabase', 401)
on conflict (url) do nothing;
insert into public.alert_rules (metric, op, threshold, window_min, on_, channels)
select * from (values ('down', '>', 1, 15, true, array['push']), ('errors', '>', 10, 60, true, array['push'])) v(metric, op, threshold, window_min, on_, channels)
where not exists (select 1 from public.alert_rules);
insert into public.admin_settings (k, v) values ('digest_tz', to_jsonb('Europe/Budapest'::text)) on conflict (k) do nothing;

-- the history: every visit's source and language, then the daily totals
select public.admin_sess_attr_rebuild(null);
select public.admin_rollup(date '2026-10-01');

-- the database-only schedules (no call to the site): the daily totals, the uptime checks and the robot filter.
-- The ones that call inkage.app/api/admin (sync, digest, publish…) are added when the dashboard is live
-- (2026-10-28-admin-cron.sql), so nothing calls an address that does not exist yet.
select cron.schedule('admin-rollup', '*/10 * * * *', $$select public.admin_rollup(((now() at time zone 'Europe/Budapest')::date - 1))$$);
select cron.schedule('admin-rollup-week', '35 3 * * *', $$select public.admin_rollup(((now() at time zone 'Europe/Budapest')::date - 7))$$);
select cron.schedule('admin-uptime', '*/5 * * * *', $$select public.admin_uptime_tick()$$);
select cron.schedule('admin-bots', '25 * * * *', $$select public.admin_bots_tick()$$);
select cron.schedule('admin-cron-rotate', '52 3 1 * *', $$select public.admin_cron_token_rotate_job()$$);

