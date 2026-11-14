-- 2026-11-14 admin measurement: (1) robot visits out of every visit count, (2) weekly sign-up cohorts.
-- Additive: one new view, new functions, and events_real / admin_b2b get one extra condition each.
-- Nothing about how events are stored changes.

-- ---------------------------------------------------------------------------------------------
-- 1. Robot visits
-- A visit (events.session, the daily visit hash) is a robot when
--   * it came from China (props->>'cc' = 'CN'),
--   * no event of it has a source (props->'src' with from / us / ref: no referrer, no utm),
--   * it only has page views (no click, no app, nothing else), all on one single page.
-- 14 days to 2026-11-14: 3,502 of 4,014 page-view visits. Same-page reloads count as one page
-- (344 of them are two page views of the same address); a visit that moves on to a second page,
-- or does anything else, stays in.
-- It is computed on the fly, so a visit that later does something else leaves the list at once.
-- ---------------------------------------------------------------------------------------------
create or replace view public.admin_bot_visits as
  select e.session, min(e.created_at) t0, max(e.created_at) t1, count(*) hits, min(e.path) path
  from public.events e
  where e.session in (select c.session from public.events c where c.name = 'page_view' and c.props->>'cc' = 'CN' and c.session is not null)
  group by e.session
  having bool_and(e.name = 'page_view')
    and count(distinct coalesce(e.path, '')) = 1
    and bool_or(e.props->>'cc' = 'CN')
    and not bool_or(coalesce(e.props->'src', '{}'::jsonb) ?| array['from', 'us', 'ref']);
revoke all on public.admin_bot_visits from public, anon, authenticated;

create or replace function public.is_bot_visit(p_session text)
returns boolean language sql stable set search_path = '' as $$
  select p_session is not null and exists (select 1 from public.admin_bot_visits b where b.session = p_session)
$$;
revoke execute on function public.is_bot_visit(text) from public, anon, authenticated;

-- every admin number reads events through events_real (admin_events, admin_sess, admin_rollup, admin_live_i ...):
-- the robot visits leave it next to the already-marked bot sessions
do $$
declare v text := pg_get_viewdef('public.events_real'::regclass); w text;
begin
  if v like '%admin_bot_visits%' then return; end if;
  w := regexp_replace(v, '(FROM admin_bot_sessions b\s+WHERE \(b\.session = e\.session\)\)\)\))',
    '\1 AND (NOT (EXISTS ( SELECT 1 FROM public.admin_bot_visits bv WHERE (bv.session = e.session))))');
  if w = v then raise exception 'events_real: anchor not found'; end if;
  execute 'create or replace view public.events_real as ' || w;
end $$;

-- the salon page's visit count reads public.events directly
do $$
declare f text := pg_get_functiondef('public.admin_b2b(integer)'::regprocedure); g text;
begin
  if f like '%is_bot_visit%' then return; end if;
  g := replace(f, $x$(e.name = 'page_view' and e.path like '/szalonoknak%'))$x$,
    $x$(e.name = 'page_view' and e.path like '/szalonoknak%' and not public.is_bot_visit(e.session)))$x$);
  if g = f then raise exception 'admin_b2b: anchor not found'; end if;
  execute g;
end $$;

-- how many robot visits were left out: in the period (admin_range, as the pages ask), the one before,
-- today (Budapest midnight), the last hour
create or replace function public.admin_bots_removed_i(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'n', count(*) filter (where b.t0 >= r.a and b.t0 < r.b),
    'hits', coalesce(sum(b.hits) filter (where b.t0 >= r.a and b.t0 < r.b), 0),
    'prev', count(*) filter (where b.t0 >= r.pa and b.t0 < r.a),
    'today', count(*) filter (where b.t0 >= (date_trunc('day', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest')),
    'hour', count(*) filter (where b.t1 >= now() - interval '1 hour'),
    'rule', 'cc=CN, no from/us/ref source, page views of one page only')
  from public.admin_range(p_days, p_from, p_to) r
  left join public.admin_bot_visits b on b.t0 >= least(r.pa, now() - interval '1 day')
$$;
revoke execute on function public.admin_bots_removed_i(integer, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_bots_removed(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_bots_removed_i(p_days, p_from, p_to);
end $$;
revoke execute on function public.admin_bots_removed(integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_bots_removed(integer, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Weekly sign-up cohorts
-- rows: sign-up week (auth.users.created_at, Europe/Budapest, Monday start), the last p_weeks weeks;
-- accounts = admin_real_users (no own, test, reviewer, bot or erased accounts).
-- Each column counts distinct accounts that ever did it. Events count only when they carry the user_id
-- (statistics consent given and signed in); cookieless events (props->>'nc' = '1') have no user_id.
-- Previews (generations kind = 'preview'), teasers and purchases are database facts for everyone.
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_cohorts_weekly_i(p_weeks integer default 8)
returns jsonb language sql stable set search_path = '' as $$
  with k as (select greatest(1, least(coalesce(p_weeks, 8), 52)) n),
  w0 as (select date_trunc('week', now() at time zone 'Europe/Budapest')::date - 7 * ((select n from k) - 1) d),
  u as (
    select r.id, date_trunc('week', r.created_at at time zone 'Europe/Budapest')::date wk
    from public.admin_real_users r
    where (r.created_at at time zone 'Europe/Budapest')::date >= (select d from w0)),
  ev as (
    select e.user_id,
      bool_or(e.name = 'photo_added') photo,
      bool_or(e.name in ('paywall_open', 'paywall_hit')) paywall,
      bool_or(e.name = 'plan_pick') plan,
      bool_or(e.name in ('checkout_open', 'checkout_start')) checkout
    from public.events e
    where e.user_id in (select id from u)
      and e.name in ('photo_added', 'paywall_open', 'paywall_hit', 'plan_pick', 'checkout_open', 'checkout_start')
    group by e.user_id),
  x as (
    select u.wk, u.id,
      coalesce(ev.photo, false) photo_ev, coalesce(ev.paywall, false) paywall, coalesce(ev.plan, false) plan, coalesce(ev.checkout, false) checkout,
      exists (select 1 from public.generations g where g.user_id = u.id and g.kind = 'preview') preview,
      exists (select 1 from public.teasers t where t.user_id = u.id) teaser,
      exists (select 1 from public.purchases p where p.user_id = u.id and p.store <> 'manual' and p.amount > 0) bought
    from u left join ev on ev.user_id = u.id),
  weeks as (select (select d from w0) + 7 * g wk from generate_series(0, (select n from k) - 1) g)
  select jsonb_build_object(
    'weeks', (select n from k),
    'rows', coalesce((select jsonb_agg(r order by r.wk desc) from (
      select w.wk,
        count(x.id) accounts,
        count(x.id) filter (where x.photo_ev or x.preview or x.teaser) photo,
        count(x.id) filter (where x.paywall) paywall,
        count(x.id) filter (where x.preview or x.teaser) got,
        count(x.id) filter (where x.teaser) teaser,
        count(x.id) filter (where x.preview) preview,
        count(x.id) filter (where x.plan) plan,
        count(x.id) filter (where x.checkout) checkout,
        count(x.id) filter (where x.bought) bought
      from weeks w left join x on x.wk = w.wk group by w.wk) r), '[]'::jsonb),
    'anon', (select jsonb_build_object(
        'plan', count(*) filter (where e.name = 'plan_pick'),
        'checkout', count(*) filter (where e.name in ('checkout_open', 'checkout_start')),
        'paywall', count(*) filter (where e.name in ('paywall_open', 'paywall_hit')))
      from public.events e
      where e.user_id is null and e.created_at >= ((select d from w0)::timestamp at time zone 'Europe/Budapest')
        and e.name in ('plan_pick', 'checkout_open', 'checkout_start', 'paywall_open', 'paywall_hit')),
    'generated_at', now())
$$;
revoke execute on function public.admin_cohorts_weekly_i(integer) from public, anon, authenticated;

create or replace function public.admin_cohorts_weekly(p_weeks integer default 8)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_cohorts_weekly_i(p_weeks);
end $$;
revoke execute on function public.admin_cohorts_weekly(integer) from public, anon;
grant execute on function public.admin_cohorts_weekly(integer) to authenticated;

-- the stored daily summary (admin_daily) and the kept answers were computed with the robots: rebuild them
select public.admin_rollup(null);
update public.admin_rpc_cache set at = now() - interval '1 day';
