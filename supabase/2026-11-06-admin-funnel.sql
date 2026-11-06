-- Heti tölcsér (2026-11-06): one admin page, week by week (Budapest weeks, Monday to Sunday, the running week included),
-- from the first page view to the second active day, and what helps or blocks it on the way:
--   1. weeks:    page views → button taps (cta_click) → /regisztracio views → new accounts → first preview → active on a 2nd day
--   2. articles: every /tudastar/<slug>, /tattoo/<page> and /learn/<slug> page: views, taps, rate
--   3. sources:  new accounts by profiles.signup_source, grouped (Google, AI assistants, store app, social, direct/other)
--   4. goals:    the intro question's goal (profiles.onboarding->>'goal') against "made a preview"
--   5. errors:   generate_error by its reason (props.reason: offline | paused | busy | no_image | photo | timeout | other; older
--                rows classified from status / msg by the same rules), against generate_start, per week; generate_retry
--                ({why}); server_error "credits are depleted" (AI provider out of credit) per day
--   6. pick:     the "Your designs" picker (pick_open, pick_design by props.from)
-- Own accounts (admin_own_accounts / admin_emails / admins), store reviewers and tester accounts (admin_bot_accounts) are left
-- out: accounts through admin_real_users, events through events_real (own and robot visits out) and, where an event has an
-- account, only a real one. Read only; safe to run again (create or replace).
-- Notes on the data:
--   * page_view arrives in events_real as 'landing_view', generate_start as 'analysis_start' (events_real's renames).
--   * A cookieless visit id changes every day, so "visits" in a week are visitor-days, not people.
--   * The account steps (preview, 2nd day) follow the accounts created in that week, whenever they did it.
--   * "Active on a 2nd day": events of the account, its AI previews or its saved previews on at least two different
--     Budapest days (the iPhone app sends no events, its previews still count). day2_used: a preview or save on a day
--     other than the sign-up day.

create or replace function public.admin_weekly_funnel(p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  tz constant text := 'Europe/Budapest';
  w integer := greatest(1, least(coalesce(p_weeks, 8), 26));
  w0 date := (date_trunc('week', now() at time zone tz))::date;
  a timestamptz;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  a := ((w0 - (w - 1) * 7)::timestamp) at time zone tz;

  with wk as (select (w0 - g * 7) w from generate_series(0, w - 1) g),
  -- the events this page reads, with their week and a clean path (no query, no trailing slash)
  ev as (
    select e.name, e.created_at, (date_trunc('week', e.created_at at time zone tz))::date w, e.session, e.user_id, e.props,
      coalesce(nullif(rtrim(split_part(coalesce(nullif(e.path, ''), e.props->>'path', ''), '?', 1), '/'), ''), '/') path
    from public.events_real e
    where e.created_at >= a
      and e.name in ('landing_view', 'cta_click', 'analysis_start', 'generate_error', 'pick_open', 'pick_design', 'generate_retry', 'server_error')
      and (e.user_id is null or exists (select 1 from public.admin_real_users ru where ru.id = e.user_id))
  ),
  -- the new accounts of the window, with where they came from and what they did
  su as (
    select u.id, u.created_at, (date_trunc('week', u.created_at at time zone tz))::date w, (u.created_at at time zone tz)::date d0,
      nullif(p.signup_source, '{}'::jsonb) src, nullif(p.onboarding->>'goal', '') goal,
      exists (select 1 from public.admin_ink_made g where g.user_id = u.id and g.ok)
        or exists (select 1 from public.previews v where v.user_id = u.id) made,
      exists (select 1 from public.events x where x.user_id = u.id and x.props->>'ia' in ('androidapp', 'iosapp')) native
    from public.admin_real_users u
    left join public.profiles p on p.id = u.id
    where u.created_at >= a
  ),
  -- the Budapest days each new account was active on (raw events: these are real accounts already)
  ud as (
    select x.user_id, count(distinct x.d) days, bool_or(x.used and x.d <> s.d0) used_later
    from (
      select e.user_id, (e.created_at at time zone tz)::date d, false used from public.events e where e.user_id in (select id from su)
      union all
      select g.user_id, (g.created_at at time zone tz)::date, true from public.admin_ink_made g where g.ok and g.user_id in (select id from su)
      union all
      select v.user_id, (v.created_at at time zone tz)::date, true from public.previews v where v.user_id in (select id from su)
    ) x
    join su s on s.id = x.user_id
    group by x.user_id
  ),
  sx as (
    select s.*, coalesce(ud.days, 0) >= 2 day2, coalesce(ud.used_later, false) day2_used,
      lower(coalesce(s.src->>'us', '')) us, lower(coalesce(s.src->>'from', '')) host,
      case when s.src is null then null else public.admin_channel(s.src, null) end ch
    from su s left join ud on ud.user_id = s.id
  ),
  sg as (
    select sx.*,
      case
        when sx.ch = 'ai' then 'ai'
        when sx.ch = 'google' then 'google'
        when sx.ch in ('tiktok', 'instagram', 'pinterest', 'facebook', 'messenger', 'threads', 'youtube', 'snapchat', 'x', 'linkedin', 'reddit') then 'social'
        when sx.us = '' and sx.host = '' and sx.native then 'store'
        else 'direct'
      end grp
    from sx
  ),
  -- every preview error with its reason: the client's own (props.reason, since 2026-11-06), else the same rules on the old rows
  er as (
    select ev.w, ev.created_at, nullif(ev.props->>'status', '') st, left(coalesce(nullif(ev.props->>'msg', ''), ''), 80) msg,
      coalesce(nullif(ev.props->>'reason', ''), case
        when ev.props->>'status' = '0' then 'offline'
        when ev.props->>'msg' ~* 'paused|credit|billing' then 'paused'
        when ev.props->>'msg' ~* 'Lots of people' then 'busy'
        when ev.props->>'msg' ~* 'could not be created|IMAGE_OTHER' then 'no_image'
        else 'other' end) k
    from ev where ev.name = 'generate_error'
  ),
  art as (
    select path,
      count(*) filter (where name = 'landing_view') views,
      count(distinct session) filter (where name = 'landing_view') visits,
      count(*) filter (where name = 'cta_click') clicks,
      count(distinct session) filter (where name = 'cta_click') click_visits
    from ev
    where path ~ '^/(tudastar|tattoo|learn)/[^/]+$'
    group by path
  )
  select jsonb_build_object(
    'since', a, 'weeks_n', w,
    'weeks', (select coalesce(jsonb_agg(x order by x.w desc), '[]') from (
      select wk.w,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'landing_view') views,
        (select count(distinct ev.session) from ev where ev.w = wk.w and ev.name = 'landing_view') visits,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'cta_click') cta,
        (select count(distinct ev.session) from ev where ev.w = wk.w and ev.name = 'cta_click') cta_visits,
        (select count(distinct ev.session) from ev where ev.w = wk.w and ev.name = 'landing_view' and ev.path like '/regisztracio%') reg_visits,
        (select count(*) from sg where sg.w = wk.w) signups,
        (select count(*) from sg where sg.w = wk.w and sg.made) made,
        (select count(*) from sg where sg.w = wk.w and sg.day2) day2,
        (select count(*) from sg where sg.w = wk.w and sg.day2_used) day2_used,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'analysis_start') gen_starts,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'generate_error') gen_errors,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'generate_retry') gen_retries,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'server_error' and ev.props->>'msg' ~* 'credits are depleted') credit_out,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'pick_open') pick_open,
        (select count(distinct ev.session) from ev where ev.w = wk.w and ev.name = 'pick_open') pick_visits,
        (select count(*) from ev where ev.w = wk.w and ev.name = 'pick_design') pick_design
      from wk) x),
    'articles', (select coalesce(jsonb_agg(x order by x.views desc, x.path), '[]') from (
      select art.*, split_part(art.path, '/', 2) kind, (art.views >= 200 and art.clicks = 0) flag from art order by art.views desc limit 300) x),
    'sources', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select grp k, count(*) n, count(*) filter (where made) made, count(*) filter (where day2) day2, count(*) filter (where src is null) nosrc
      from sg group by grp) x),
    -- what is behind each group: the channel, else the referring site or utm_source as sent
    'source_detail', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select grp, coalesce(nullif(host, ''), nullif(us, ''), case when src is null then '(nincs forrás)' when native then '(app)' else '(link nélkül)' end) k,
        count(*) n, count(*) filter (where made) made
      from sg group by 1, 2 order by n desc limit 40) x),
    'goals', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(goal, '–') k, count(*) n, count(*) filter (where made) made, count(*) filter (where day2) day2 from sg group by 1) x),
    'err_reasons', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select er.k, count(*) n, max(er.created_at) last,
        (select jsonb_object_agg(q.w, q.n) from (select e2.w, count(*) n from er e2 where e2.k = er.k group by e2.w) q) wk,
        (select coalesce(jsonb_agg(jsonb_build_object('msg', m.msg, 'st', m.st, 'n', m.n) order by m.n desc), '[]') from (
          select coalesce(nullif(e3.msg, ''), 'HTTP ' || coalesce(e3.st, '?')) msg, max(e3.st) st, count(*) n from er e3 where e3.k = er.k group by 1 order by 3 desc limit 4) m) msgs
      from er group by er.k) x),
    -- the AI provider out of credit (server_error "credits are depleted"; the main cause of the failures on 2026-10-18), per Budapest day
    'credit_days', (select coalesce(jsonb_agg(x order by x.t desc), '[]') from (
      select (ev.created_at at time zone tz)::date t, count(*) n from ev
      where ev.name = 'server_error' and ev.props->>'msg' ~* 'credits are depleted' group by 1) x),
    'retry_why', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(nullif(props->>'why', ''), '?') k, count(*) n from ev where name = 'generate_retry' group by 1) x),
    'pick_from', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(nullif(props->>'from', ''), '?') k, count(*) n, count(distinct session) visits from ev where name = 'pick_design' group by 1) x),
    'pick_since', (select min(created_at) from ev where name in ('pick_open', 'pick_design'))
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_weekly_funnel(integer) from public, anon;
grant execute on function public.admin_weekly_funnel(integer) to authenticated;
