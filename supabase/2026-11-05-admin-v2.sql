-- InkAge Irányítóközpont v2 (2026-11-05): InkAge's admin database brought up to Calligra's current admin
-- (Calligra migrations 20261219_admin_saves … 20270202_admin_payments), so the new /admin UI (phone admin, Ma feed,
-- true-data numbers, Fizetések, extra social accounts, RPC cache) runs on InkAge's own data.
--
-- How: Calligra's admin migrations in their order, with the same mapping the 2026-10-28 port used. Calligra's product
-- tables are read through InkAge views (section 1); "InkAge:" comments mark every InkAge choice:
--   celeb_signatures (an AI signature made; "made" = ok rows) → admin_ink_made  = InkAge's AI aging previews
--                                                               (public.generations, kind 'preview'; a refunded guest
--                                                               preview is ok = false; style / name = the body part)
--   saved_signatures (saved signatures)                        → admin_ink_saved = InkAge's saved previews (public.previews)
--   unlocks / profiles (credits, gift)                         → admin_ink_unlocks / admin_ink_profiles (since 2026-10-28)
--   celeb_ratings, celeb_claims (stars and claims)             → empty views: InkAge has no star ratings of a preview
--   settings.payments_live                                     → admin_ink_settings: always false (InkAge takes no payments)
--   purchases, invoices                                        → created empty with Calligra's columns, so Fizetések,
--                                                               Bevétel and the paying counts answer with zeros
--   calligra.me → inkage.app, Vault calligra_admin.* → inkage_admin.*, /knowledge/ → /tudastar/ (and /learn/)
-- Left out (Calligra only): the celeb look tables and their app functions, Basic/Pro/Ultra packages, Billingo,
-- the Arvow blog, the e-mail sign-up block (20270105), the refund writer, Calligra's own data rows.
-- InkAge's own fixes of 2026-10-29 / 10-30 are kept (section 3 re-applies them where Calligra rewrote a function).
-- Run it ONCE, as a whole, in one session (the SQL editor runs it as one transaction: any error undoes all of it).
-- Like Calligra's migrations it patches function text and stops if a piece is not found, so it is not meant to run twice.
-- Validated 2026-11-05 on InkAge's database inside rolled-back transactions (nothing was kept).

-- ################################################################ 1. InkAge: what Calligra's admin reads, on InkAge's data

-- InkAge: no payments yet. The table has Calligra's columns so the payments page (admin_payments, admin_revenue,
-- admin_sales, admin_payers) and every "paying" count answer with honest zeros. Only the server could ever write it.
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  store text not null check (store in ('apple', 'google', 'stripe')),
  transaction_id text not null,
  product text not null,
  plan text not null,
  name_norm text,
  amount numeric, currency text,
  refunded_at timestamptz, refund_amount numeric,
  unique (store, transaction_id)
);
alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;

-- InkAge: "made" = an AI aging preview (Calligra: an AI signature). A row of public.generations kind 'preview' is
-- written when a preview starts and is deleted when it fails for a signed-in person; a failed guest preview is kept as
-- "…:refunded" (ok = false). Guests (no account) count as made, accounts as made_users. The look ("style") and the
-- "name" are the body part. Store-reviewer and store-robot accounts are left out, as in admin_real_users.
create or replace view public.admin_ink_made as
 select g.id, g.user_id, coalesce(nullif(g.placement, ''), '?') as name_norm, coalesce(nullif(g.placement, ''), '?') as style,
   false as underline, 0::smallint as variant, null::text as path,
   coalesce(g.guest_id, '') not like '%:refunded' as ok, g.created_at, null::text as mood, false as initials,
   case when coalesce(g.guest_id, '') like '%:refunded' then 'refunded' end as err
 from public.generations g
 where g.kind = 'preview'
   and (g.user_id is null or (not exists (select 1 from public.profiles p where p.id = g.user_id and coalesce(p.reviewer, false))
     and not exists (select 1 from public.admin_bot_accounts b where b.user_id = g.user_id)));

-- InkAge: a saved signature = a saved preview (not deleted); "fav" = her favourite mark
create or replace view public.admin_ink_saved as
 select v.id, v.user_id, coalesce(nullif(v.placement, ''), '?') as name_norm, coalesce(nullif(v.placement, ''), '?') as name,
   'preview'::text as kind, 'preview:' || v.id as key, v.report as design, coalesce(v.favorite, false) as fav, v.created_at
 from public.previews v
 where v.deleted_at is null
   and not exists (select 1 from public.profiles p where p.id = v.user_id and coalesce(p.reviewer, false))
   and not exists (select 1 from public.admin_bot_accounts b where b.user_id = v.user_id);

-- InkAge: no star ratings of a preview and no claims: empty, with Calligra's columns
create or replace view public.admin_ink_ratings as
 select null::uuid as user_id, null::text as sig_key, null::text as kind, null::text as name_norm, null::text as style,
   null::smallint as stars, null::timestamptz as created_at, null::timestamptz as updated_at
 where false;
create or replace view public.admin_ink_claims as
 select null::uuid as user_id, null::text as name_norm, null::text as style, null::boolean as paid, null::text as state,
   null::timestamptz as created_at
 where false;

-- InkAge: payments are off (Calligra reads settings.payments_live)
create or replace view public.admin_ink_settings as
 select 'payments_live'::text as key, 'false'::jsonb as value, now() as updated_at;

revoke all on table public.admin_ink_made, public.admin_ink_saved, public.admin_ink_ratings, public.admin_ink_claims, public.admin_ink_settings from public, anon, authenticated;
grant select on table public.admin_ink_made, public.admin_ink_saved, public.admin_ink_ratings, public.admin_ink_claims, public.admin_ink_settings to service_role;

-- ################################################################ 2. Calligra's admin changes, adapted

-- ======================================== from Calligra 20261219_admin_saves
-- How every "save as image" ended (save_done {how}), and which button started it (share_save {via}), so a save that
-- never reaches the phone shows: download (desktop file), share (the phone's share sheet), native (the app), hold
-- (in-app browsers: shown to keep with a long press), cancel, fail, empty. Plus the name-screen errors (name_error {kind, sc}).
create or replace function public.admin_saves(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null, p_ch text default null, p_lang text default null)
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare r record; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with ev as (select * from public.admin_events(p_ch, p_lang) e where e.created_at >= r.a and e.created_at < r.b and e.name in ('save_done', 'share_save', 'name_error'))
  select jsonb_build_object(
    'how', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'how', '–') k, count(*) n from ev where name = 'save_done' group by 1) x),
    'via', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'via', props->>'kind', '–') k, count(*) n from ev where name = 'share_save' group by 1) x),
    'ia', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'ia', 'böngésző') k, count(*) n from ev where name = 'save_done' group by 1) x),
    'name_err', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]') from (select coalesce(props->>'kind', '–') || ' · ' || coalesce(props->>'sc', '–') k, count(distinct session) n from ev where name = 'name_error' group by 1) x),
    'sessions', (select count(distinct session) from ev where name = 'save_done'),
    'landed', (select count(distinct session) from ev where name = 'save_done' and props->>'how' in ('download', 'share', 'native', 'hold'))
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_saves(integer, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_saves(integer, timestamptz, timestamptz, text, text) to authenticated;

-- ======================================== from Calligra 20261221_signup_facts
-- The owner's "new sign-up" e-mail: how many real accounts there are now, and which channel the visit came from (the same
-- rule as the dashboard). Only for an account in its first week (the moment of the e-mail) or an admin (the sample).
create or replace function public.signup_facts(p_src jsonb default null)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select case when public.is_admin() or exists (select 1 from auth.users u where u.id = auth.uid() and u.created_at > now() - interval '7 days')
    then jsonb_build_object(
      'count', (select count(*) from public.admin_real_users),
      'channel', case when p_src is null then null else public.admin_channel(p_src, p_src->>'ia') end)
  end
$function$;
revoke all on function public.signup_facts(jsonb) from public, anon;
grant execute on function public.signup_facts(jsonb) to authenticated;

-- ======================================== from Calligra 20261222_track_ios
-- The iPhone app records usage only after the person's own yes in the app, and only once the owner switches 'track_ios_ext' on
-- (after the App Store Connect App Privacy answers and the privacy notice say so). Until then nobody is asked and nothing is sent.
create or replace function public.track_flags() returns jsonb
language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'android_ext', coalesce((select (v #>> '{}')::boolean from public.admin_settings where k = 'track_android_ext'), false),
    'ios_ext', coalesce((select (v #>> '{}')::boolean from public.admin_settings where k = 'track_ios_ext'), false))
$function$;
grant execute on function public.track_flags() to anon, authenticated;

-- the owner's switch (Kapcsolatok page)
create or replace function public.admin_track_ios_set(p_on boolean) returns jsonb
language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_settings (k, v) values ('track_ios_ext', to_jsonb(coalesce(p_on, false)))
  on conflict (k) do update set v = excluded.v, updated_at = now();
  return public.track_flags();
end $function$;
revoke execute on function public.admin_track_ios_set(boolean) from public, anon;
grant execute on function public.admin_track_ios_set(boolean) to authenticated;

-- ======================================== from Calligra 20261223_admin_sales
-- The goal in one place: paying people today and revenue by source. Store sales are named by their store (the visit pairing
-- can't see the iPhone app); web sales by the channel of the visit nearest to the sign-up, an estimate.
create or replace function public.admin_sales(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare a timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))); r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with u as (select p.user_id, min(p.created_at) at from public.purchases p group by 1),
  m as (select x.user_id, x.ch from u, lateral public.admin_signups_matched('2026-01-01'::timestamptz, now()) x where x.user_id = u.user_id),
  s as (
    select p.user_id, p.created_at, coalesce(p.amount, 0) amount, coalesce(p.currency, '?') currency,
      case when p.store = 'stripe' then coalesce(nullif(m.ch, ''), 'ismeretlen') else p.store end source
    from public.purchases p left join m on m.user_id = p.user_id
    where p.created_at >= a and not public.admin_own_uid(p.user_id)),
  d as (select s.*, (s.created_at at time zone 'Europe/Budapest')::date = (now() at time zone 'Europe/Budapest')::date today from s)
  select jsonb_build_object(
    'today_people', (select count(distinct user_id) from d where today),
    'today_sales', (select count(*) from d where today),
    'today_rev', coalesce((select jsonb_object_agg(currency, v) from (select currency, sum(amount) v from d where today group by 1) x), '{}'::jsonb),
    'avg_7', round((select count(distinct (user_id, (created_at at time zone 'Europe/Budapest')::date)) from d where created_at >= now() - interval '7 days') / 7.0, 1),
    'total_sales', (select count(*) from d),
    'by_source', coalesce((select jsonb_agg(x order by x.sales desc) from (select source, currency, count(*) sales, count(distinct user_id) people, sum(amount) rev from d group by 1, 2) x), '[]'::jsonb)
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_sales(int) from public, anon;
grant execute on function public.admin_sales(int) to authenticated;

-- ======================================== from Calligra 20261227_admin_true_people
-- The admin's picture of people, from what an account really did (docs/admin-adathibak-2026-11-01.md, points 1-42):
-- signatures and saves instead of the old "saved name / credit / gift", a usage flag on the active days, time in the
-- visit without idle gaps, and a confidence on the estimated visit of an account. The visit measurement stays anonymous:
-- nothing new is written about a person, the pairing is still the old estimate, only now it says how sure it is.

/* ---------- content pages opened once with no source at all: machine-made (flat across all 27 languages) ---------- */
create or replace function public.admin_mark_bots(p_from timestamp with time zone, p_to timestamp with time zone default (now() - '00:30:00'::interval))
 returns integer language plpgsql security definer set search_path to '' as $function$
declare k integer;
begin
  with s as (
    select e.session, min(e.created_at) t0, max(e.created_at) t1, count(*) n,
      (array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1] src,
      (array_agg(e.path order by e.created_at))[1] p0, (array_agg(e.lang order by e.created_at))[1] lg,
      bool_and(e.name = 'landing_view') only_land, bool_and(e.name in ('app_open', 'flow_step')) only_app,
      bool_or(e.name = 'app_open') app, bool_or(e.name = 'flow_step') step,
      bool_and(e.path in ('/privacy', '/terms', '/delete-account', '/security')) legal,
      bool_and(e.path in ('/login', '/register')) auth,
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
      and public.admin_nosrc(a.src) and public.admin_nosrc(b.src) and a.p0 = b.p0 and coalesce(a.p0, '') <> '/start'
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
    select session from s where only_land and auth and n >= 2 and t1 - t0 < interval '3 seconds' and public.admin_nosrc(src)),
  /* a people-facing door (home, /start, the app, sign-in) can be a real person who typed the address: those stay */
  onehit as (
    select session from s where n = 1 and only_land and public.admin_nosrc(src) and coalesce(split_part(p0, '?', 1), '/') not in ('/', '/start', '/app', '/login', '/register'))
  insert into public.admin_bot_sessions (session, reason)
  select session, 'crawler pair' from pairs
  union select session, 'speed test burst' from bursts
  union select session, 'scripted run' from scripted
  union select session, 'app flash' from flashes
  union select session, 'legal check' from legal
  union select session, 'store review' from review
  union select session, 'auth crawl' from authc
  union select session, 'one hit no source' from onehit
  on conflict (session) do nothing;
  get diagnostics k = row_count;
  return k;
end $function$;

/* someone who only looked long at one page and then clicked was no machine: the mark comes off */
create or replace function public.admin_bots_tick()
 returns integer language plpgsql security definer set search_path to '' as $function$
declare k integer; d0 date;
begin
  delete from public.admin_bot_sessions b where b.reason = 'one hit no source' and (select count(*) from public.events e where e.session = b.session) > 1;
  k := public.admin_mark_bots(now() - interval '2 days', now() - interval '30 minutes');
  if k > 0 then
    select min((x.t0 at time zone 'Europe/Budapest')::date) into d0
    from (select min(e.created_at) t0 from public.events e join public.admin_bot_sessions b on b.session = e.session where b.marked_at = now() group by e.session) x;
    if d0 is not null then perform public.admin_rollup(d0); end if;
  end if;
  perform public.admin_collect_days_i();
  return k;
end $function$;

/* ---------- active days: a day with real use is marked, and they are kept fresh every 10 minutes ---------- */
alter table public.admin_user_days add column if not exists used boolean not null default false;

create or replace function public.admin_collect_days_i()
 returns integer language plpgsql security definer set search_path to '' as $function$
declare k integer;
begin
  insert into public.admin_user_days (user_id, day)
  select user_id, (created_at at time zone 'Europe/Budapest')::date from public.events where user_id is not null
  on conflict do nothing;
  get diagnostics k = row_count;
  insert into public.admin_user_days (user_id, day, used)
  select user_id, (created_at at time zone 'Europe/Budapest')::date, true from public.admin_ink_made where user_id is not null
  union select user_id, (created_at at time zone 'Europe/Budapest')::date, true from public.admin_ink_saved
  union select user_id, (created_at at time zone 'Europe/Budapest')::date, true from public.admin_ink_unlocks
  on conflict (user_id, day) do update set used = true where not public.admin_user_days.used;
  return k;
end $function$;
revoke all on function public.admin_collect_days_i() from public, anon, authenticated;

create or replace function public.admin_collect_days()
 returns integer language plpgsql security definer set search_path to '' as $function$
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_collect_days_i();
end $function$;

create or replace function public.admin_collect_days_t(p_token text)
 returns integer language plpgsql security definer set search_path to '' as $function$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_collect_days_i();
end $function$;

/* ---------- time in a visit: the gaps added up, a gap over 5 minutes is a tab left open and counts as nothing ---------- */
create or replace function public.admin_session_active(p_session text)
 returns integer language sql stable set search_path to '' as $function$
  select coalesce(sum(case when g <= 300 then g else 0 end), 0)::int from (
    select extract(epoch from e.created_at - lag(e.created_at) over (order by e.created_at)) g from public.events_real e where e.session = p_session) x
$function$;
revoke all on function public.admin_session_active(text) from public, anon, authenticated;

create or replace function public.admin_visit(p_session text)
 returns jsonb language sql stable set search_path to '' as $function$
  select case when p_session is null then null else (select jsonb_build_object(
    'first_at', min(e.created_at), 'last_at', max(e.created_at), 'secs', public.admin_session_active(p_session), 'span_secs', extract(epoch from max(e.created_at) - min(e.created_at))::int, 'n', count(*),
    'live', max(e.created_at) > now() - interval '5 minutes',
    'pages', count(*) filter (where e.name = 'landing_view'),
    'opened', coalesce(bool_or(e.name = 'app_open'), false),
    'sign', (array_agg(e.props->>'value' order by e.created_at desc) filter (where e.name = 'quiz_answer' and e.props->>'step' = 'sign' and e.props ? 'value'))[1],
    'captured', coalesce(bool_or(e.name = 'signature_captured'), false),
    'skipped', coalesce(bool_or(e.name = 'capture_skipped'), false),
    'scored', coalesce(bool_or(e.name = 'score_shown' or (e.name = 'flow_step' and e.props->>'step' = 'score')), false),
    'quiz', coalesce(bool_or(e.name = 'quiz_start'), false),
    'style', (array_agg(e.props->>'value' order by e.created_at desc) filter (where e.name = 'quiz_answer' and e.props->>'step' = 'style'))[1],
    'celeb', count(*) filter (where (e.name = 'flow_step' and e.props->>'step' = 'score')),
    'revealed', coalesce(bool_or(e.name = 'reveal_shown'), false),
    'celebrated', coalesce(bool_or(e.name = 'celebrate'), false),
    'detail', count(*) filter (where e.name = 'detail_open'),
    'shared', coalesce(bool_or(e.name in ('share_open', 'share_video', 'reveal_share')), false),
    'saved', count(*) filter (where e.name = 'save_done' or e.name = 'share_save'),
    'mailed', coalesce(bool_or(e.name = 'sig_mail'), false),
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
$function$;

/* ---------- the estimated visit of an account says how sure it is ----------
   biztos: its own sign-up event, or its signatures at the moments the visit made them. jo: within a minute of the sign-up
   and nothing against it. gyenge: far away in time, another account's sign-up in it, another account within two minutes,
   or an Apple sign-in on an Android visit. Nothing is taken away (the owner keeps the estimate): only labelled. */
drop function if exists public.admin_signups_matched(timestamp with time zone, timestamp with time zone);
create function public.admin_signups_matched(a timestamp with time zone, b timestamp with time zone)
 returns table(user_id uuid, created_at timestamp with time zone, lang text, provider text, session text, ch text, pf text, code text, src jsonb, slang text, near_secs integer, conf text)
 language sql stable set search_path to '' as $function$
  select u.id, u.created_at, nullif(u.raw_user_meta_data->>'lang', ''), u.raw_app_meta_data->>'provider', s.session,
    case when s.session is null then null else public.admin_channel(m.src, m.ia) end,
    case when s.session is null then null else public.admin_pf_guess(m.src, case when m.ia = 'androidapp' then 'android' else m.pf end) end,
    m.src->>'ux', m.src, m.lang, s.near::int,
    case when s.session is null then null
      when ev.sig or ev.made then 'biztos'
      when ev.sig_any then 'gyenge'
      when u.raw_app_meta_data->>'provider' = 'apple' and m.ia = 'androidapp' then 'gyenge'
      when s.near > 60 then 'gyenge'
      when exists (select 1 from auth.users o where o.id <> u.id and not public.admin_own_uid(o.id) and abs(extract(epoch from o.created_at - u.created_at)) < 120) then 'gyenge'
      else 'jo' end
  from public.admin_real_users u
  left join lateral (
    select e.session, abs(extract(epoch from e.created_at - u.created_at)) near from public.events_real e
    where e.session is not null and e.created_at between u.created_at - interval '45 minutes' and u.created_at + interval '10 minutes'
      and (nullif(u.raw_user_meta_data->>'lang', '') is null or e.lang is null or left(e.lang, 2) = left(u.raw_user_meta_data->>'lang', 2))
    order by abs(extract(epoch from e.created_at - u.created_at)) limit 1) s on true
  left join lateral (
    select (array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1] src,
      (array_agg(e.props->>'ia' order by e.created_at) filter (where e.props ? 'ia'))[1] ia,
      (array_agg(e.props->>'pf' order by e.created_at) filter (where e.props ? 'pf'))[1] pf,
      (array_agg(e.lang order by e.created_at desc) filter (where e.lang is not null))[1] lang
    from public.events_real e where e.session = s.session) m on s.session is not null
  left join lateral (
    select coalesce(bool_or(e.name = 'signup' and abs(extract(epoch from e.created_at - u.created_at)) < 120), false) sig,
      coalesce(bool_or(e.name = 'signup'), false) sig_any,
      exists (select 1 from public.events_real e2 join public.admin_ink_made c on c.user_id = u.id and abs(extract(epoch from e2.created_at - c.created_at)) < 30 where e2.session = s.session and (e2.name = 'flow_step' and e2.props->>'step' = 'score')) made
    from public.events_real e where e.session = s.session and e.name = 'signup') ev on s.session is not null
  where u.created_at >= a and u.created_at < b and not public.admin_own_uid(u.id)
$function$;
revoke all on function public.admin_signups_matched(timestamp with time zone, timestamp with time zone) from public, anon, authenticated;

/* ---------- every account's facts: what it made, when, and how long ---------- */
drop function if exists public.admin_user_facts();
create function public.admin_user_facts()
 returns table(id uuid, created_at timestamp with time zone, email text, name text, provider text, confirmed boolean, lang text, own boolean, days30 integer, days_prev30 integer,
   made integer, made_ok integer, styles integer, saved integer, favs integer, first_made_at timestamp with time zone, last_made_at timestamp with time zone, used_days integer, used_secs integer, returned boolean,
   unl_all integer, unl30 integer, first_unlock_at timestamp with time zone, cal boolean, design boolean, gift boolean, credits integer, welcomed boolean, scored_visit boolean,
   ch text, pf text, conf text, near_secs integer, last_active_at timestamp with time zone, online boolean, score integer, stage text, churn boolean, stuck boolean, tags text[], follow_up date, banned boolean)
 language sql stable security definer set search_path to '' as $function$
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  b as (
    select u.id, u.created_at, u.email, coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', '')) name, u.raw_app_meta_data->>'provider' provider,
      (u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider' <> 'email') confirmed,
      left(coalesce(nullif(u.raw_user_meta_data->>'lang', ''), m.slang, ''), 2) lang, public.admin_own_uid(u.id) own,
      (select count(*) from public.admin_user_days d where d.user_id = u.id and d.day > public.admin_today() - 30)::int days30,
      (select count(*) from public.admin_user_days d where d.user_id = u.id and d.day > public.admin_today() - 60 and d.day <= public.admin_today() - 30)::int days_prev30,
      (select count(*) from public.admin_ink_made c where c.user_id = u.id)::int made,
      (select count(*) from public.admin_ink_made c where c.user_id = u.id and c.ok)::int made_ok,
      (select count(distinct c.style) from public.admin_ink_made c where c.user_id = u.id and c.ok)::int styles,
      (select count(*) from public.admin_ink_saved s where s.user_id = u.id)::int saved,
      (select count(*) from public.admin_ink_saved s where s.user_id = u.id and s.fav)::int favs,
      (select min(c.created_at) from public.admin_ink_made c where c.user_id = u.id and c.ok) first_made_at,
      (select max(c.created_at) from public.admin_ink_made c where c.user_id = u.id) last_made_at,
      (select count(*) from public.admin_user_days d where d.user_id = u.id and d.used)::int used_days,
      /* the least it was in use, on any device: from the sign-up, the gaps between what it made and saved, up to 10 minutes each */
      (select coalesce(sum(case when g <= 600 then g else 0 end), 0)::int from (
        select extract(epoch from t - lag(t) over (order by t)) g from (
          select u.created_at t union all select c.created_at from public.admin_ink_made c where c.user_id = u.id
          union all select s.created_at from public.admin_ink_saved s where s.user_id = u.id union all select x.created_at from public.admin_ink_unlocks x where x.user_id = u.id) tt) gg) used_secs,
      exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.used and d.day > (u.created_at at time zone 'Europe/Budapest')::date) returned,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id)::int unl_all,
      (select count(*) from public.admin_ink_unlocks x where x.user_id = u.id and x.created_at > now() - interval '30 days')::int unl30,
      (select min(x.created_at) from public.admin_ink_unlocks x where x.user_id = u.id) first_unlock_at,
      exists (select 1 from public.admin_ink_unlocks x where x.user_id = u.id and x.calligrapher) cal,
      exists (select 1 from public.admin_ink_unlocks x where x.user_id = u.id and x.design is not null) design,
      coalesce(p.gift_claimed, false) gift, coalesce(p.credits, 0)::int credits,
      u.raw_user_meta_data ? 'welcome_sent_at' welcomed,
      (m.session is not null and m.conf <> 'gyenge' and exists (select 1 from public.events_real e where e.session = m.session and e.name = 'flow_step' and e.props->>'step' = 'score')) scored_visit,
      m.ch, m.pf, m.conf, m.near_secs,
      /* real moments only: the day-only activity has no time of its own */
      greatest(u.last_sign_in_at, u.created_at, (select max(x.created_at) from public.admin_ink_unlocks x where x.user_id = u.id),
        (select max(c.created_at) from public.admin_ink_made c where c.user_id = u.id), (select max(s.created_at) from public.admin_ink_saved s where s.user_id = u.id),
        (select max(greatest(se.updated_at, se.refreshed_at at time zone 'UTC')) from auth.sessions se where se.user_id = u.id)) last_active_at,
      (exists (select 1 from auth.sessions s where s.user_id = u.id and greatest(s.updated_at, s.refreshed_at at time zone 'UTC') > now() - interval '5 minutes')
        or exists (select 1 from public.admin_ink_made c where c.user_id = u.id and c.created_at > now() - interval '5 minutes')
        or (m.session is not null and m.conf <> 'gyenge' and exists (select 1 from public.events_real e where e.session = m.session and e.created_at > now() - interval '5 minutes'))) online,
      (u.banned_until is not null and u.banned_until > now()) banned
    from auth.users u left join public.admin_ink_profiles p on p.id = u.id left join m on m.user_id = u.id
  )
  select b.id, b.created_at, b.email, b.name, b.provider, b.confirmed, nullif(b.lang, ''), b.own, b.days30, b.days_prev30,
    b.made, b.made_ok, b.styles, b.saved, b.favs, b.first_made_at, b.last_made_at, b.used_days, b.used_secs, b.returned,
    b.unl_all, b.unl30, b.first_unlock_at, b.cal, b.design, b.gift, b.credits, b.welcomed, b.scored_visit, b.ch, b.pf, b.conf, b.near_secs, b.last_active_at, b.online,
    /* 0-100: signatures made (up to 40), different looks (15), a favourite (5), came back on another day (20), how fresh (20) */
    (least(b.made_ok, 5) * 8 + least(b.styles, 5) * 3 + case when b.favs > 0 then 5 else 0 end + case when b.returned then 20 else 0 end
      + case when b.last_active_at > now() - interval '1 day' then 20 when b.last_active_at > now() - interval '7 days' then 12 when b.last_active_at > now() - interval '30 days' then 5 else 0 end)::int score,
    case when b.made_ok = 0 and b.created_at > now() - interval '3 days' then 'uj'
      when b.made_ok = 0 then 'probalgatja'
      when b.last_active_at < now() - interval '30 days' then 'alvo'
      when b.last_active_at < now() - interval '7 days' then 'veszelyben'
      else 'aktiv' end stage,
    (b.used_days >= 2 and b.last_active_at < now() - interval '7 days' and b.last_active_at >= now() - interval '30 days') churn,
    (b.created_at < now() - interval '3 days' and b.created_at > now() - interval '30 days' and b.made_ok = 0) stuck,
    coalesce((select array_agg(distinct t) from public.admin_user_notes n, unnest(n.tags) t where n.user_id = b.id), '{}'),
    (select min(n.follow_up) from public.admin_user_notes n where n.user_id = b.id and n.done_at is null and n.follow_up is not null),
    b.banned
  from b
$function$;
revoke all on function public.admin_user_facts() from public, anon, authenticated;

/* ---------- activation: from the sign-up to the first signature ---------- */
create or replace function public.admin_activation(p_days integer default 0, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; a timestamptz := '-infinity'; b timestamptz := 'infinity';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_days, 0) <> 0 or p_from is not null then select * into r from public.admin_range(p_days, p_from, p_to); a := r.a; b := r.b; end if;
  return (with f as (select * from public.admin_user_facts() where not own and created_at >= a and created_at < b),
    h as (select extract(epoch from first_made_at - created_at) / 3600 hrs from f where first_made_at is not null)
    select jsonb_build_object(
      'accounts', (select count(*) from f), 'activated', (select count(*) from f where made_ok > 0),
      'made', (select coalesce(sum(made_ok), 0) from f), 'saved', (select coalesce(sum(saved), 0) from f), 'favs', (select coalesce(sum(favs), 0) from f),
      'median_hours', (select percentile_cont(.5) within group (order by hrs) from h),
      'median_made', (select percentile_cont(.5) within group (order by made_ok) from f where made_ok > 0),
      'median_secs', (select percentile_cont(.5) within group (order by used_secs) from f where made_ok > 0),
      'buckets', jsonb_build_object('h1', (select count(*) from h where hrs < 1), 'd1', (select count(*) from h where hrs >= 1 and hrs < 24),
        'w1', (select count(*) from h where hrs >= 24 and hrs < 168), 'later', (select count(*) from h where hrs >= 168), 'never', (select count(*) from f where first_made_at is null)),
      'gaps', (select jsonb_agg(jsonb_build_object('k', g.k, 'have', g.have, 'missing', g.missing, 'who', g.who)) from (
        select k.k,
          count(*) filter (where k.done) have, count(*) filter (where not k.done) missing,
          coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'email', k.email, 'score', k.score) order by k.score desc) filter (where not k.done), '[]') who
        from (select x.*, v.k, case v.k when 'made' then x.made_ok > 0 when 'second' then x.made_ok >= 2 when 'styles' then x.styles >= 3 when 'fav' then x.favs > 0 when 'back' then x.returned end done
          from public.admin_user_facts() x cross join (values ('made'), ('second'), ('styles'), ('fav'), ('back')) v(k)
          where not x.own and x.last_active_at > now() - interval '30 days') k
        group by k.k) g)));
end $function$;

/* ---------- the list ---------- */
create or replace function public.admin_people(p_q text default ''::text, p_filter text default 'all'::text, p_limit integer default 25, p_offset integer default 0, p_lang text default null, p_provider text default null, p_ch text default null, p_sort text default 'created'::text, p_days integer default null, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
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
        when p_filter = 'made' then made_ok > 0
        when p_filter = 'returned' then returned
        when p_filter = 'banned' then banned
        else true end
      and (p_lang is null or left(coalesce(lang, ''), 2) = left(p_lang, 2))
      and (p_provider is null or provider = p_provider)
      and (p_ch is null or coalesce(ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
  ),
  pg as (select * from f order by case p_sort when 'score' then -score when 'active' then -extract(epoch from last_active_at) when 'made' then -made_ok else -extract(epoch from created_at) end
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'own', (select count(*) from fp where own),
    'counts', (select jsonb_build_object('uj', count(*) filter (where stage = 'uj'), 'probalgatja', count(*) filter (where stage = 'probalgatja'),
        'aktiv', count(*) filter (where stage = 'aktiv'), 'veszelyben', count(*) filter (where stage = 'veszelyben'), 'alvo', count(*) filter (where stage = 'alvo'),
        'churn', count(*) filter (where churn), 'stuck', count(*) filter (where stuck), 'online', count(*) filter (where online),
        'made', count(*) filter (where made_ok > 0), 'returned', count(*) filter (where returned),
        'followup', count(*) filter (where follow_up is not null and follow_up <= public.admin_today()), 'banned', count(*) filter (where banned),
        'avg_score', round(avg(score))) from fp where not own),
    'tags', coalesce((select jsonb_agg(x order by x.n desc) from (select t k, count(*) n from fp, unnest(fp.tags) t where not fp.own group by 1) x), '[]'),
    'rows', coalesce((select jsonb_agg(to_jsonb(pg) || jsonb_build_object(
        'visit', public.admin_visit((select m.session from public.admin_signups_matched(pg.created_at, pg.created_at + interval '1 microsecond') m where m.user_id = pg.id limit 1)),
        'celeb', public.admin_celeb_use(pg.id))
      order by case p_sort when 'score' then -pg.score when 'active' then -extract(epoch from pg.last_active_at) when 'made' then -pg.made_ok else -extract(epoch from pg.created_at) end) from pg), '[]'))
  into res;
  return res;
end $function$;

/* ---------- one account ---------- */
create or replace function public.admin_celeb_use(p_id uuid)
 returns jsonb language sql stable set search_path to '' as $function$
  select jsonb_build_object('total', count(*), 'ok', count(*) filter (where c.ok), 'used24', count(*) filter (where c.created_at > now() - interval '24 hours'),
    'last_at', max(c.created_at), 'first_at', min(c.created_at),
    'looks', coalesce((select jsonb_agg(x order by x.n desc) from (select c2.style k, count(*) n from public.admin_ink_made c2 where c2.user_id = p_id group by 1) x), '[]'),
    'list', coalesce((select jsonb_agg(x order by x.created_at desc) from (select c3.style, c3.name_norm, c3.ok, c3.underline, c3.initials, c3.created_at from public.admin_ink_made c3 where c3.user_id = p_id order by c3.created_at desc limit 60) x), '[]'))
  from public.admin_ink_made c where c.user_id = p_id
$function$;

create or replace function public.admin_user(p_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare res jsonb; ca timestamptz := (select created_at from auth.users where id = p_id); mm record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mm from public.admin_signups_matched(ca, ca + interval '1 microsecond') x where x.user_id = p_id limit 1;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.raw_app_meta_data->>'provider' provider,
      u.raw_user_meta_data - 'avatar_url' - 'picture' meta from auth.users u where u.id = p_id) x),
    'match', case when mm.session is null then null else jsonb_build_object('session', right(mm.session, 6), 'ch', mm.ch, 'pf', mm.pf, 'src', mm.src, 'lang', mm.slang, 'conf', mm.conf, 'near_secs', mm.near_secs,
      'shared_with', (select count(*) from public.admin_signups_matched(ca - interval '1 hour', ca + interval '1 hour') o where o.session = mm.session and o.user_id <> p_id)) end,
    'visit', public.admin_visit(mm.session),
    'celeb', public.admin_celeb_use(p_id),
    'saved', coalesce((select jsonb_agg(x order by x.created_at desc) from (select s.name_norm, s.kind, s.key, s.fav, s.created_at from public.admin_ink_saved s where s.user_id = p_id order by s.created_at desc limit 60) x), '[]'),
    'unlocks', coalesce((select jsonb_agg(x order by x.created_at desc) from (select name_norm, calligrapher, created_at, design is not null has_design from public.admin_ink_unlocks where user_id = p_id) x), '[]'),
    'timeline', coalesce((select jsonb_agg(x order by x.created_at) from (
      select e.created_at, e.name, coalesce(e.props->>'step', e.props->>'scr', e.props->>'k', e.props->>'kind', e.props->>'cta', e.props->>'look') detail, e.props->>'value' val, e.props->>'secs' secs, e.path, e.lang,
        public.admin_channel(e.props->'src', e.props->>'ia') ch
      from public.events_real e where e.session = mm.session
      order by e.created_at limit 400) x), '[]'),
    'days', coalesce((select jsonb_agg(day order by day) from public.admin_user_days where user_id = p_id), '[]'),
    'days_used', coalesce((select jsonb_agg(day order by day) from public.admin_user_days where user_id = p_id and used), '[]')
  ) into res;
  return res;
end $function$;

create or replace function public.admin_user_more(p_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare mm record; ca timestamptz := (select created_at from auth.users where id = p_id);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mm from public.admin_signups_matched(ca, ca + interval '1 microsecond') x where x.user_id = p_id limit 1;
  return jsonb_build_object(
    'facts', (select to_jsonb(f) - 'email' from public.admin_user_facts() f where f.id = p_id),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.done_at nulls first, n.created_at desc) from public.admin_user_notes n where n.user_id = p_id), '[]'),
    'audit', coalesce((select jsonb_agg(to_jsonb(a) order by a.at desc) from (select * from public.admin_audit where target = p_id::text order by at desc limit 50) a), '[]'),
    'landing', case when mm.conf = 'gyenge' then null else (select jsonb_build_object('path', e.path, 'title', (select s.title from public.seo_pages s where s.url like '%' || split_part(e.path, '?', 1) order by length(s.url) limit 1))
      from public.events_real e where e.session = mm.session order by e.created_at limit 1) end,
    /* the day-only entries carry a date, not a made-up hour */
    'timeline', coalesce((select jsonb_agg(x order by x.at desc) from (
      select ca at, 'signup' k, coalesce(case when mm.conf <> 'gyenge' then mm.ch end, '') d, false day_only
      union all select (d.day::timestamp at time zone 'Europe/Budapest') + interval '23 hours 59 minutes', 'active', '', true from public.admin_user_days d where d.user_id = p_id and not d.used
      union all select c.created_at, case when c.ok then 'celeb' else 'celeb_bad' end, c.style, false from public.admin_ink_made c where c.user_id = p_id
      union all select s.created_at, 'fav', s.key, false from public.admin_ink_saved s where s.user_id = p_id and s.fav
      union all select (u.raw_user_meta_data->>'sig_mail_sent_at')::timestamptz, 'sig_mail', '', false from auth.users u where u.id = p_id and u.raw_user_meta_data ? 'sig_mail_sent_at'
      union all select (u.raw_user_meta_data->>'welcome_sent_at')::timestamptz, 'welcome', '', false from auth.users u where u.id = p_id and u.raw_user_meta_data->>'welcome_sent_at' ~ '^\d{4}-'
      union all select u.email_confirmed_at, 'confirmed', '', false from auth.users u where u.id = p_id and u.email_confirmed_at is not null and u.raw_app_meta_data->>'provider' = 'email'
      union all select n.created_at, 'note', left(n.body, 120), false from public.admin_user_notes n where n.user_id = p_id
      union all select a.at, 'admin', a.action, false from public.admin_audit a where a.target = p_id::text and a.action not like 'jegyzet.%'
    ) x where x.at is not null), '[]'));
end $function$;

/* the export really holds all of it: what is sent to someone who asks for their data */
create or replace function public.admin_user_export(p_user uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'kiadva', now(),
    'fiok', (select jsonb_build_object('azonosito', u.id, 'email', u.email, 'regisztralt', u.created_at, 'megerositve', u.email_confirmed_at, 'utolso_belepes', u.last_sign_in_at,
       'belepes_modja', u.raw_app_meta_data->>'provider', 'nev', coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), 'nyelv', u.raw_user_meta_data->>'lang') from auth.users u where u.id = p_user),
    'profil', (select jsonb_build_object('kredit', p.credits, 'ajandek_felhasznalva', p.gift_claimed, 'letrehozva', p.created_at) from public.admin_ink_profiles p where p.id = p_user),
    'alairasok', coalesce((select jsonb_agg(jsonb_build_object('nev', c.name_norm, 'stilus', c.style, 'alahuzas', c.underline, 'monogram', c.initials, 'hangulat', c.mood, 'fajl', c.path, 'sikeres', c.ok, 'keszult', c.created_at) order by c.created_at) from public.admin_ink_made c where c.user_id = p_user), '[]'),
    'mentett_alairasok', coalesce((select jsonb_agg(jsonb_build_object('nev', s.name, 'fajta', s.kind, 'kulcs', s.key, 'dizajn', s.design, 'kedvenc', s.fav, 'mentve', s.created_at) order by s.created_at) from public.admin_ink_saved s where s.user_id = p_user), '[]'),
    'mentett_nevek', coalesce((select jsonb_agg(jsonb_build_object('nev', x.name_norm, 'kalligrafus', x.calligrapher, 'mentve', x.created_at, 'dizajn', x.design) order by x.created_at) from public.admin_ink_unlocks x where x.user_id = p_user), '[]'),
    'dizajnok', coalesce((select jsonb_agg(to_jsonb(d) - 'user_id') from public.uploads d where d.user_id = p_user), '[]'),
    'vasarlasok', coalesce((select jsonb_agg(to_jsonb(q) - 'user_id') from public.purchases q where q.user_id = p_user), '[]'),
    'igenylesek', coalesce((select jsonb_agg(to_jsonb(q) - 'user_id') from public.admin_ink_claims q where q.user_id = p_user), '[]'),
    'aktiv_napok', coalesce((select jsonb_agg(d.day order by d.day) from public.admin_user_days d where d.user_id = p_user), '[]'),
    'jegyzetek', coalesce((select jsonb_agg(jsonb_build_object('szoveg', n.body, 'cimkek', n.tags, 'keszult', n.created_at) order by n.created_at) from public.admin_user_notes n where n.user_id = p_user), '[]'));
end $function$;

/* ---------- the numbers above the list ---------- */
create or replace function public.admin_users_stats(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_lang text default null, p_provider text default null, p_ch text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record; res jsonb; today date := public.admin_today();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with m as (select * from public.admin_signups_matched('-infinity'::timestamptz, now() + interval '1 minute')),
  u as (select x.id, x.created_at, x.email_confirmed_at, coalesce(x.raw_app_meta_data->>'provider', '?') prov, coalesce(left(coalesce(nullif(x.raw_user_meta_data->>'lang', ''), m.slang), 2), '?') lg,
      coalesce(m.ch, 'ismeretlen') ch, coalesce(m.pf, 'ismeretlen') pf, m.conf, m.session is not null matched, x.raw_user_meta_data ? 'welcome_sent_at' welcomed,
      (x.created_at at time zone 'Europe/Budapest')::date d0,
      (select count(*) from public.admin_ink_made c where c.user_id = x.id and c.ok) made,
      (select count(*) from public.admin_ink_saved s where s.user_id = x.id) saved
    from public.admin_real_users x left join m on m.user_id = x.id),
  uf as (select * from u where (p_lang is null or lg = left(p_lang, 2)) and (p_provider is null or prov = p_provider) and (p_ch is null or ch = any(string_to_array(p_ch, ',')))),
  up as (select * from uf where created_at >= r.a and created_at < r.b),
  /* an active day: real use (a signature, a save), or the session opened, on any device */
  dd as (select ud.user_id, ud.day, ud.used from public.admin_user_days ud join uf on uf.id = ud.user_id),
  la as (select user_id, max(day) as day from dd group by 1),
  lu as (select user_id, max(day) as day from dd where used group by 1)
  select jsonb_build_object('days', r.d, 'filtered', p_lang is not null or p_provider is not null or p_ch is not null,
    'total', (select count(*) from uf), 'signups', (select count(*) from up), 'signups_prev', (select count(*) from uf where created_at >= r.pa and created_at < r.a),
    'made_p', (select count(*) from up where made > 0), 'made_all', (select count(*) from uf where made > 0),
    'made_rows_p', (select coalesce(sum(made), 0) from up), 'saved_rows_p', (select coalesce(sum(saved), 0) from up),
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
    'sources', coalesce((select jsonb_agg(x order by x.n desc) from (select ch k, count(*) n, count(*) filter (where conf = 'biztos') sure, count(*) filter (where conf = 'jo') good, count(*) filter (where conf = 'gyenge') weak from up group by 1) x), '[]'),
    'sources_all', coalesce((select jsonb_agg(x order by x.n desc) from (select ch k, count(*) n from u group by 1) x), '[]'),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select pf k, count(*) n from up group by 1) x), '[]'),
    'matched', (select count(*) from up where matched),
    'conf', jsonb_build_object('biztos', (select count(*) from up where conf = 'biztos'), 'jo', (select count(*) from up where conf = 'jo'), 'gyenge', (select count(*) from up where conf = 'gyenge'), 'nincs', (select count(*) from up where not matched)),
    'active_1', (select count(*) from la where day >= today), 'active_7', (select count(*) from la where day >= today - 6), 'active_30', (select count(*) from la where day >= today - 29),
    'used_1', (select count(*) from lu where day >= today), 'used_7', (select count(*) from lu where day >= today - 6), 'used_30', (select count(*) from lu where day >= today - 29),
    'returned_1d', (select count(*) from uf where d0 + 1 <= today and exists (select 1 from dd where dd.user_id = uf.id and dd.used and dd.day >= uf.d0 + 1)),
    'eligible_1d', (select count(*) from uf where d0 + 1 <= today),
    'returned_7d', (select count(*) from uf where d0 + 7 <= today and exists (select 1 from dd where dd.user_id = uf.id and dd.used and dd.day >= uf.d0 + 7)),
    'eligible_7d', (select count(*) from uf where d0 + 7 <= today),
    'returned_1d_p', (select count(*) from up where d0 + 1 <= today and exists (select 1 from dd where dd.user_id = up.id and dd.used and dd.day >= up.d0 + 1)),
    'opened_1d_p', (select count(*) from up where d0 + 1 <= today and exists (select 1 from dd where dd.user_id = up.id and dd.day >= up.d0 + 1)),
    'eligible_1d_p', (select count(*) from up where d0 + 1 <= today),
    'returned_7d_p', (select count(*) from up where d0 + 7 <= today and exists (select 1 from dd where dd.user_id = up.id and dd.used and dd.day >= up.d0 + 7)),
    'eligible_7d_p', (select count(*) from up where d0 + 7 <= today),
    'cum', coalesce((select jsonb_agg(x order by x.t) from (select (created_at at time zone 'Europe/Budapest')::date t, count(*) n from up group by 1) x), '[]')
  ) into res;
  return res;
end $function$;

/* the leads: how sure the visit is, and the bare numbers from the account itself */
create or replace function public.admin_leads(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select m.created_at at, coalesce(m.lang, m.slang) lang, m.ch, m.pf, m.code, m.provider, m.session is not null matched, m.conf, m.near_secs,
      coalesce(p.platform, l.post_platform, l.source) post_platform, p.title post_title, p.url post_url,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'flow_step' and e.props->>'step' = 'score') scored,
      exists (select 1 from public.events_real e where e.session = m.session and e.name in ('share_open', 'share_video', 'reveal_share')) shared,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'signature_captured') captured,
      (select min(e.created_at) from public.events_real e where e.session = m.session) first_at,
      public.admin_session_active(m.session) secs,
      (select count(*) from public.admin_ink_made c where c.user_id = m.user_id and c.ok) celeb,
      (select count(*) from public.admin_ink_saved s where s.user_id = m.user_id) saved,
      (select count(*) from public.admin_ink_saved s where s.user_id = m.user_id and s.fav) favs,
      (select sum((e.props->>'secs')::int) from public.events_real e where e.session = m.session and e.name = 'screen_time' and e.props->>'scr' in ('rev', 'picks', 'det') and e.props->>'secs' ~ '^[0-9]+$') result_secs,
      (select count(*) from public.events_real e where e.session = m.session and e.name = 'screenshot_key') shots
    from public.admin_signups_matched(r.a, least(r.b, now()) + interval '1 minute') m
    left join public.short_links l on l.code = m.code
    left join lateral (select q.platform, q.title, q.url from public.social_posts q where q.code = m.code or (q.platform = l.post_platform and q.post_id = l.post_id) limit 1) p on true
    limit 500) x), '[]');
end $function$;

/* the people list on the home page says why: the same rows, the fields it reads */
create or replace function public.admin_people_today()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.prio, x.score desc) from (
    select f.id, f.email, f.name, f.lang, f.score, f.stage, f.last_active_at, f.created_at, f.made_ok, f.tags, f.follow_up,
      case when f.follow_up is not null and f.follow_up <= public.admin_today() then 'followup' when f.churn then 'churn' else 'stuck' end why,
      case when f.follow_up is not null and f.follow_up <= public.admin_today() then 1 when f.churn then 2 else 3 end prio
    from public.admin_user_facts() f
    where not f.own and not f.banned and ((f.follow_up is not null and f.follow_up <= public.admin_today()) or f.churn or f.stuck)
    limit 30) x), '[]');
end $function$;

/* the history gets the same treatment once: usage on the active days, machine visits marked, the daily summary rebuilt */
select public.admin_collect_days_i();
select public.admin_mark_bots('2026-10-04'::timestamptz, now() - interval '30 minutes');
select public.admin_rollup(date '2026-10-01');

-- ======================================== from Calligra 20261228_admin_true_home
-- The admin's main numbers tell the truth (docs/admin-adathibak-2026-11-01.md: 43-57, 86-103, 153-167).
-- The product is the AI signature: "made" comes from celeb_signatures and saved_signatures, own accounts left out, every device
-- counted. "shared" is a real share only (share_open, share_video, reveal_share); share_save and save_done are "saved", apart.
-- "Used" days carry the return numbers, "opened" (a session seen) stands beside them. A number nobody measures is null, not 0.
-- Every old JSON field stays, so the dashboard already deployed keeps working. The visit measurement stays anonymous.
-- The long functions are changed by replacing their exact text: sub() stops the whole migration if a piece is not found.

create function pg_temp.sub(fn text, a text, b text) returns void language plpgsql as $$
declare s text := pg_get_functiondef(fn::regprocedure);
begin
  if position(a in s) = 0 then raise exception 'no match in %: %', fn, left(a, 80); end if;
  execute replace(s, a, b);
end $$;

/* ---------- signatures made, day by day: the one source for the curves ---------- */
create function public.admin_made_days()
 returns table(dy date, n bigint, users bigint) language sql stable security definer set search_path to '' as $function$
  select (c.created_at at time zone 'Europe/Budapest')::date, count(*), count(distinct c.user_id)
  from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id) group by 1
$function$;
revoke all on function public.admin_made_days() from public, anon, authenticated;

/* ---------- a period ---------- */
select pg_temp.sub('public.admin_period(timestamptz,timestamptz,text,text)', $a$bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared$a$,
  $b$bool_or(name in ('share_open','share_video','reveal_share')) shared, bool_or(name in ('share_save','save_done')) saved$b$);
select pg_temp.sub('public.admin_period(timestamptz,timestamptz,text,text)', $a$'scored_shared', (select count(*) from s where scored and shared),$a$,
  $b$'scored_shared', (select count(*) from s where scored and shared),
    'revealed_shared', (select count(*) from s where revealed and shared),
    'saved', (select count(*) from s where saved),
    /* signatures and accounts know no channel or language: in a filtered view the number is unknown */
    'made', case when p_ch is null and p_lang is null then (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= a and c.created_at < b and not public.admin_own_uid(c.user_id)) end,
    'made_users', case when p_ch is null and p_lang is null then (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and c.created_at >= a and c.created_at < b and not public.admin_own_uid(c.user_id)) end,
    'made_saved', case when p_ch is null and p_lang is null then (select count(*) from public.admin_ink_saved c where c.created_at >= a and c.created_at < b and not public.admin_own_uid(c.user_id)) end,$b$);

/* ---------- the daily summary: "shared" is real, "saved" is its own column ---------- */
alter table public.admin_daily add column if not exists saved integer not null default 0;
select pg_temp.sub('public.admin_rollup(date)', $a$bool_or(name in ('share_open','share_save','share_video','reveal_share')) shared$a$,
  $b$bool_or(name in ('share_open','share_video','reveal_share')) shared, bool_or(name in ('share_save','save_done')) saved$b$);
select pg_temp.sub('public.admin_rollup(date)', $a$bool_or(revealed) revealed, bool_or(shared) shared$a$, $b$bool_or(revealed) revealed, bool_or(shared) shared, bool_or(saved) saved$b$);
select pg_temp.sub('public.admin_rollup(date)', $a$count(*) filter (where shared) shared$a$, $b$count(*) filter (where shared) shared, count(*) filter (where saved) saved$b$);
select pg_temp.sub('public.admin_rollup(date)', $a$(day, ch, lg, events, sessions, app, scored, revealed, shared, first_at)$a$, $b$(day, ch, lg, events, sessions, app, scored, revealed, shared, saved, first_at)$b$);
select pg_temp.sub('public.admin_rollup(date)', $a$coalesce(b.shared, 0), a.first_at$a$, $b$coalesce(b.shared, 0), coalesce(b.saved, 0), a.first_at$b$);
select pg_temp.sub('public.admin_rollup(date)', $a$shared = excluded.shared,$a$, $b$shared = excluded.shared, saved = excluded.saved,$b$);

select pg_temp.sub('public.admin_total(text,text,text)', $a$when 'shared' then shared end$a$, $b$when 'shared' then shared when 'saved' then saved end$b$);
select pg_temp.sub('public.admin_total(text,text,text)', $a$(p_k = 'shared' and x.name in ('share_open','share_save','share_video','reveal_share'))$a$,
  $b$(p_k = 'shared' and x.name in ('share_open','share_video','reveal_share'))
        or (p_k = 'saved' and x.name in ('share_save','save_done'))$b$);

/* ---------- the dashboard ---------- */
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$('share_open','share_save','share_video','reveal_share')$a$, $b$('share_open','share_video','reveal_share')$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$bool_or(name = 'purchase') bought, bool_or(name = 'celebrate') celebrated,$a$,
  $b$bool_or(name = 'purchase') bought, bool_or(name = 'celebrate') celebrated, bool_or(name in ('share_save','save_done')) saved,$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$bool_or(name = 'purchase') bought
    from public.admin_events(p_ch, p_lang) where created_at >= pa$a$, $b$bool_or(name = 'purchase') bought, bool_or(name in ('share_save','save_done')) saved
    from public.admin_events(p_ch, p_lang) where created_at >= pa$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$count(*) filter (where bought) bought from ss group by 1) v on v.t = bk.t$a$, $b$count(*) filter (where bought) bought, count(*) filter (where saved) saved from ss group by 1) v on v.t = bk.t$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$count(*) filter (where bought) bought from ps group by 1) v on v.t = bk2.t$a$, $b$count(*) filter (where bought) bought, count(*) filter (where saved) saved from ps group by 1) v on v.t = bk2.t$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$coalesce(v.bought, 0) bought, coalesce(su.n, 0) signups, coalesce(er.n, 0) errors,$a$,
  $b$coalesce(v.bought, 0) bought, coalesce(v.saved, 0) saved, coalesce(mk.n, 0) made, coalesce(su.n, 0) signups, coalesce(er.n, 0) errors,$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$coalesce(v.bought, 0) bought, coalesce(su.n, 0) signups
      from bk2$a$, $b$coalesce(v.bought, 0) bought, coalesce(v.saved, 0) saved, coalesce(mk.n, 0) made, coalesce(su.n, 0) signups
      from bk2$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$su on su.t = bk.t$a$,
  $b$su on su.t = bk.t
      left join (select date_trunc(bucket, c.created_at at time zone tz) t, count(*) n from public.admin_ink_made c where c.ok and c.created_at >= a and c.created_at < b and p_ch is null and p_lang is null and not public.admin_own_uid(c.user_id) group by 1) mk on mk.t = bk.t$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$su on su.t = bk2.t$a$,
  $b$su on su.t = bk2.t
      left join (select date_trunc(bucket, c.created_at at time zone tz) t, count(*) n from public.admin_ink_made c where c.ok and c.created_at >= pa and c.created_at < a and p_ch is null and p_lang is null and not public.admin_own_uid(c.user_id) group by 1) mk on mk.t = bk2.t$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$'admins', (select count(*) from public.admins)$a$,
  $b$'admins', (select count(*) from public.admins),
      'made', (select count(*) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),
      'made_users', (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),
      'made_saved', (select count(*) from public.admin_ink_saved c where not public.admin_own_uid(c.user_id)),
      'used_users', (select count(distinct d.user_id) from public.admin_user_days d join public.admin_real_users u on u.id = d.user_id where d.used)$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$select coalesce(lang, '?') k, count(*) n, count(*) filter (where scored) scored,$a$,
  $b$select coalesce(lang, '?') k, count(*) n, count(*) filter (where scored) scored, count(*) filter (where revealed) revealed,$b$);
select pg_temp.sub('public.admin_dashboard(integer,timestamptz,timestamptz,text,text)', $a$'shared', (select count(*) from ss where shared),$a$,
  $b$'shared', (select count(*) from ss where shared), 'saved', (select count(*) from ss where saved),$b$);

/* ---------- the home page's extras ---------- */
select pg_temp.sub('public.admin_home_extra(integer)', $a$select day t, sessions, scored from public.admin_daily where ch = '*' and lg = '*' and day >= today - 120$a$,
  $b$select ad.day t, ad.sessions, ad.scored, ad.shared, ad.saved, coalesce(mk.n, 0) made from public.admin_daily ad left join public.admin_made_days() mk on mk.dy = ad.day where ad.ch = '*' and ad.lg = '*' and ad.day >= today - 120$b$);
select pg_temp.sub('public.admin_home_extra(integer)', $a$'prev', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(a - glag - d, a - glag - 1) g),$a$,
  $b$'prev', (select coalesce(sum(g.clicks), 0) from public.admin_gsc_days(a - glag - d, a - glag - 1) g),
      /* the part of the clicks Google breaks down by country and page (it hides the rare searches) */
      'detail_clicks', (select coalesce(sum(clicks), 0) from public.gsc_daily where day between a - glag and today - glag),$b$);
select pg_temp.sub('public.admin_home_extra(integer)', $a$'bing', (select max(at) from public.sync_log where source = 'bing' and ok)$a$,
  $b$'bing', (select max(at) from public.sync_log where source = 'bing' and ok),
    'bing_has', exists (select 1 from public.bing_daily)$b$);

/* ---------- goals: the new metrics, and a number nobody measures is unknown ---------- */
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.admin_goals'::regclass and pg_get_constraintdef(oid) like '%metric ~%';
  execute format('alter table public.admin_goals drop constraint %I', c);
  alter table public.admin_goals add constraint admin_goals_metric_check check (metric ~ '^(sessions|scored|signups|shared|saved|made|made_users|paying|gsc_clicks|gsc_impressions|bing_clicks|downloads|reviews|followers|(followers|views|visits)_(tiktok|instagram|facebook|pinterest|linkedin|youtube))$');
end $$;
select pg_temp.sub('public.admin_goal_value(text,timestamptz,timestamptz)', $a$elsif p_metric = 'bing_clicks' then
    select max(day) into mx from public.bing_daily;$a$, $b$elsif p_metric = 'paying' then
    select count(distinct user_id) into v from public.purchases where created_at >= p_t0 and created_at < p_t1 and not public.admin_own_uid(user_id);
  elsif p_metric = 'bing_clicks' then
    select max(day) into mx from public.bing_daily;
    if mx is null then return null; end if;$b$);
select pg_temp.sub('public.admin_goal_value(text,timestamptz,timestamptz)', $a$elsif p_metric = 'downloads' then$a$, $b$elsif p_metric = 'downloads' then
    if not exists (select 1 from public.store_daily) then return null; end if;$b$);
select pg_temp.sub('public.admin_goal_value(text,timestamptz,timestamptz)', $a$elsif p_metric = 'reviews' then$a$, $b$elsif p_metric = 'reviews' then
    if not exists (select 1 from public.store_reviews) then return null; end if;$b$);

/* ---------- the report ---------- */
select pg_temp.sub('public.admin_report(date,date)', $a$sum(ad.sessions) over (order by ad.day) s from public.admin_daily ad where$a$,
  $b$sum(ad.sessions) over (order by ad.day) s, sum(coalesce(mk.n, 0)) over (order by ad.day) m from public.admin_daily ad left join public.admin_made_days() mk on mk.dy = ad.day where$b$);
select pg_temp.sub('public.admin_report(date,date)', $a$select date_trunc('month', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared from public.admin_daily ad where$a$,
  $b$select date_trunc('month', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared, sum(ad.saved) saved, sum(coalesce(mk.n, 0)) made from public.admin_daily ad left join public.admin_made_days() mk on mk.dy = ad.day where$b$);
select pg_temp.sub('public.admin_report(date,date)', $a$select date_trunc('week', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared from public.admin_daily ad where$a$,
  $b$select date_trunc('week', ad.day)::date dd, sum(ad.sessions) sessions, sum(ad.scored) scored, sum(ad.shared) shared, sum(ad.saved) saved, sum(coalesce(mk.n, 0)) made from public.admin_daily ad left join public.admin_made_days() mk on mk.dy = ad.day where$b$);

/* ---------- Használat ---------- */
select pg_temp.sub('public.admin_product(integer,timestamptz,timestamptz,text,text)', $a$'share_open', 'share_save', 'share_video', 'reveal_share'$a$, $b$'share_open', 'share_video', 'reveal_share'$b$);
select pg_temp.sub('public.admin_product(integer,timestamptz,timestamptz,text,text)', $a$bool_or(name = 'pro_file') files,$a$, $b$bool_or(name in ('share_save', 'save_done')) saved, bool_or(name = 'pro_file') files,$b$);
select pg_temp.sub('public.admin_product(integer,timestamptz,timestamptz,text,text)', $a$'files', count(*) filter (where files),$a$, $b$'saved', count(*) filter (where saved), 'files', count(*) filter (where files),$b$);
select pg_temp.sub('public.admin_product(integer,timestamptz,timestamptz,text,text)', $a$'scores', coalesce(($a$,
  $b$/* the signatures themselves, on every device; a channel or language filter cannot split them */
    'made', case when p_ch is null and p_lang is null then jsonb_build_object(
      'n', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id)),
      'prev', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= r.pa and c.created_at < r.a and not public.admin_own_uid(c.user_id)),
      'users', (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id)),
      'failed', (select count(*) from public.admin_ink_made c where not c.ok and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id)),
      'saved', (select count(*) from public.admin_ink_saved c where c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id)),
      'favs', (select count(*) from public.admin_ink_saved c where c.fav and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id)),
      'looks', coalesce((select jsonb_agg(x order by x.n desc) from (select c.style k, count(*) n from public.admin_ink_made c where c.ok and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id) group by 1 order by 2 desc limit 15) x), '[]'),
      'daily', coalesce((select jsonb_agg(x order by x.t) from (select (c.created_at at time zone tz)::date t, count(*) n from public.admin_ink_made c where c.ok and c.created_at >= r.a and c.created_at < r.b and not public.admin_own_uid(c.user_id) group by 1) x), '[]')) end,
    /* when each old feature last sent anything: an old number says how old it is */
    'last', (select coalesce(jsonb_object_agg(name, t), '{}') from (select e.name, max(e.created_at) t from public.events_real e where e.name in ('legibility_change', 'pro_file', 'pro_variant', 'ai_note_report', 'reminder', 'score_shown') group by 1) x),
    'scores', coalesce(($b$);
select pg_temp.sub('public.admin_saves(integer,timestamptz,timestamptz,text,text)', $a$('download', 'share', 'native', 'hold')$a$, $b$('download', 'share', 'native', 'hold', 'gallery')$b$);
select pg_temp.sub('public.admin_sales(integer)', $a$'today_people', (select count(distinct user_id) from d where today),$a$,
  $b$'live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false),
    'today_people', (select count(distinct user_id) from d where today),$b$);

/* ---------- Megosztás: a return counts only from a link really shared (the one ?ref= ever seen is a directory, Fazier) ---------- */
select pg_temp.sub('public.admin_viral(timestamptz,timestamptz,text,text)', $a$'share_open', 'share_save', 'share_video', 'reveal_share'$a$, $b$'share_open', 'share_video', 'reveal_share'$b$);
select pg_temp.sub('public.admin_viral(timestamptz,timestamptz,text,text)', $a$bool_or(name = 'flow_step' and props->>'step' = 'score') scored,$a$,
  $b$bool_or(name = 'flow_step' and props->>'step' = 'score') scored, bool_or(name = 'reveal_shown') revealed, bool_or(name in ('share_save', 'save_done')) saves,$b$);
select pg_temp.sub('public.admin_viral(timestamptz,timestamptz,text,text)', $a$from s where lower(coalesce(src->>'us', '')) = 'share' or src ? 'ref'$a$, $b$from s where lower(coalesce(src->>'us', '')) = 'share'$b$);
select pg_temp.sub('public.admin_viral(timestamptz,timestamptz,text,text)', $a$count(*) filter (where scored and shared) scored_shared from s group by 1$a$,
  $b$count(*) filter (where scored and shared) scored_shared, count(*) filter (where revealed) revealed, count(*) filter (where revealed and shared) revealed_shared, count(*) filter (where saves) saves from s group by 1$b$);
select pg_temp.sub('public.admin_viral(timestamptz,timestamptz,text,text)', $a$count(*) filter (where scored) back_scored,$a$, $b$count(*) filter (where scored) back_scored, count(*) filter (where revealed) back_revealed,$b$);

/* ---------- Megtartás: coming back means using it; a session merely seen is shown beside it ---------- */
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$coalesce(m.pf, 'ismeretlen') pf, coalesce(u.raw_app_meta_data->>'provider', '?') prov$a$, $b$coalesce(m.pf, 'ismeretlen') pf, coalesce(u.raw_app_meta_data->>'provider', '?') prov, m.conf$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$act as (select ud.user_id, ud.day, x.d0,$a$, $b$act as (select ud.user_id, ud.day, ud.used, x.d0,$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$'n', (select count(distinct ac.user_id) from act ac where ac.w = c.w and ac.wk = k and ac.day > ac.d0),$a$,
  $b$'n', (select count(distinct ac.user_id) from act ac where ac.w = c.w and ac.wk = k and ac.day > ac.d0 and ac.used),
          'n_opened', (select count(distinct ac.user_id) from act ac where ac.w = c.w and ac.wk = k and ac.day > ac.d0),$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$and ud.day > z.d0) wau_back$a$,
  $b$and ud.day > z.d0) wau_back,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.used and ud.day = dd.day) dau_used,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.used and ud.day > dd.day - 7 and ud.day <= dd.day) wau_used,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.used and ud.day > dd.day - 30 and ud.day <= dd.day) mau_used,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.used and ud.day > dd.day - 30 and ud.day <= dd.day and ud.day > z.d0) mau_back_used,
        (select count(distinct ud.user_id) from public.admin_user_days ud join uall z on z.id = ud.user_id where ud.used and ud.day > dd.day - 7 and ud.day <= dd.day and ud.day > z.d0) wau_back_used$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$select k, count(*) filter (where exists (select 1 from public.admin_user_days ud where ud.user_id = c.id and ud.day >= c.d0 + k)) back, count(*) eligible$a$,
  $b$select k, count(*) filter (where exists (select 1 from public.admin_user_days ud where ud.user_id = c.id and ud.used and ud.day >= c.d0 + k)) back,
        count(*) filter (where exists (select 1 from public.admin_user_days ud where ud.user_id = c.id and ud.day >= c.d0 + k)) opened, count(*) eligible$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$select z.dim, z.k, count(*) users,$a$, $b$select z.dim, z.k, count(*) users, count(*) filter (where z.conf is null or z.conf = 'gyenge') weak,$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$and ud.day between z.d0 + 1 and z.d0 + 7)) d7,$a$,
  $b$and ud.used and ud.day between z.d0 + 1 and z.d0 + 7)) d7,
        count(*) filter (where z.d0 + 7 <= today and exists (select 1 from public.admin_user_days ud where ud.user_id = z.id and ud.day between z.d0 + 1 and z.d0 + 7)) d7_opened,$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$and ud.day between z.d0 + 8 and z.d0 + 30)) d30$a$, $b$and ud.used and ud.day between z.d0 + 8 and z.d0 + 30)) d30$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$select id, d0, 'ch' dim, ch k from u union all select id, d0, 'lang', lg from u union all select id, d0, 'pf', pf from u union all select id, d0, 'prov', prov from u$a$,
  $b$select id, d0, conf, 'ch' dim, ch k from u union all select id, d0, conf, 'lang', lg from u union all select id, d0, conf, 'pf', pf from u union all select id, d0, conf, 'prov', prov from u$b$);
select pg_temp.sub('public.admin_retention(integer,text,text)', $a$from public.admin_user_days ud join u x on x.id = ud.user_id group by 1) z$a$, $b$from public.admin_user_days ud join u x on x.id = ud.user_id where ud.used group by 1) z$b$);

select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$coalesce(m.ch, 'ismeretlen') ch from public.admin_real_users u$a$, $b$coalesce(m.ch, 'ismeretlen') ch, m.conf from public.admin_real_users u$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$x as (select u.ch, u.d0,$a$, $b$x as (select u.ch, u.d0, u.conf,
        exists (select 1 from public.admin_user_days d where d.user_id = u.id and d.day between u.d0 + 1 and u.d0 + 7) o7,$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$d.user_id = u.id and d.day = u.d0 + 1) r1$a$, $b$d.user_id = u.id and d.used and d.day = u.d0 + 1) r1$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$d.user_id = u.id and d.day between u.d0 + 1 and u.d0 + 7) r7$a$, $b$d.user_id = u.id and d.used and d.day between u.d0 + 1 and u.d0 + 7) r7$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$d.user_id = u.id and d.day between u.d0 + 8 and u.d0 + 30) r30$a$, $b$d.user_id = u.id and d.used and d.day between u.d0 + 8 and u.d0 + 30) r30$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$d.user_id = u.id and d.day > t - 7) a7$a$, $b$d.user_id = u.id and d.used and d.day > t - 7) a7$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$'a7', a7)$a$, $b$'a7', a7, 'o7', o7, 'weak', weak)$b$);
select pg_temp.sub('public.admin_cohorts_source(integer,text,text)', $a$count(*) filter (where a7) a7$a$, $b$count(*) filter (where a7) a7, count(*) filter (where d0 <= t - 7 and o7) o7, count(*) filter (where conf is null or conf = 'gyenge') weak$b$);

select pg_temp.sub('public.admin_retention_ch()', $a$ud.user_id = f.id and ud.day between f.d0 + 1 and f.d0 + 7$a$, $b$ud.user_id = f.id and ud.used and ud.day between f.d0 + 1 and f.d0 + 7$b$);
select pg_temp.sub('public.admin_retention_ch()', $a$ud.user_id = f.id and ud.day between f.d0 + 8 and f.d0 + 30$a$, $b$ud.user_id = f.id and ud.used and ud.day between f.d0 + 8 and f.d0 + 30$b$);

/* ---------- the morning and evening messages ---------- */
select pg_temp.sub('public.admin_digest_data()', $a$'users', (select count(*) from public.admin_real_users),$a$,
  $b$'users', (select count(*) from public.admin_real_users),
    'all_made', (select count(*) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),
    'all_made_users', (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),$b$);
/* the best post of yesterday, a whole day between two snapshots. At 6 in the morning "today against yesterday" is 6 hours,
   a post with no row before it is its lifetime only if it is new, and Pinterest's and LinkedIn's rolling figures are no views */
select pg_temp.sub('public.admin_digest_data()', $a$join public.social_post_daily d on d.platform = p.platform and d.post_id = p.post_id and d.day = d1
      left join public.social_post_daily d0 on d0.platform = p.platform and d0.post_id = p.post_id and d0.day = d1 - 1
      order by gained desc nulls last limit 1) x)$a$,
  $b$join public.social_post_daily d on d.platform = p.platform and d.post_id = p.post_id and d.day = d1 - 1
      left join public.social_post_daily d0 on d0.platform = p.platform and d0.post_id = p.post_id and d0.day = d1 - 2
      where p.platform not in ('pinterest', 'linkedin') and (d0.views is not null or (p.created_at at time zone tz)::date >= d1 - 1)
      order by gained desc nulls last limit 1) x where x.gained > 0)$b$);
select pg_temp.sub('public.admin_digest_errors(timestamptz,timestamptz)', $a$coalesce(props->>'why', props->>'message', '')$a$, $b$coalesce(props->>'why', props->>'message', props->>'msg', '')$b$);
select pg_temp.sub('public.admin_r_evening(text)', $a$'signups', (select count(*) from public.admin_real_users where created_at >= t0),$a$,
  $b$'signups', (select count(*) from public.admin_real_users where created_at >= t0),
    'made', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= t0 and not public.admin_own_uid(c.user_id)),
    'made_users', (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and c.created_at >= t0 and not public.admin_own_uid(c.user_id)),$b$);

/* ---------- signals: Google's drop from the exact totals (the detailed rows hold a fraction, the alarm could not ring) ---------- */
select pg_temp.sub('public.admin_platform_alerts()', $a$gd := (select max(day) from public.gsc_daily);$a$, $b$gd := public.admin_gsc_last();$b$);
select pg_temp.sub('public.admin_platform_alerts()', $a$select coalesce(sum(clicks) filter (where day > gd - 7), 0), coalesce(sum(clicks) filter (where day <= gd - 7), 0) into v1, v0 from public.gsc_daily where day > gd - 14;$a$,
  $b$select coalesce(sum(g.clicks) filter (where g.day > gd - 7), 0), coalesce(sum(g.clicks) filter (where g.day <= gd - 7), 0) into v1, v0 from public.admin_gsc_days(gd - 13, gd) g;$b$);
select pg_temp.sub('public.admin_platform_alerts()', $a$case when r.metric = 'scored' then 'elemzés' when$a$,
  $b$case when r.metric = 'made' then 'elkészült előnézet' when r.metric = 'made_users' then 'előnézetet készített fiók' when r.metric = 'paying' then 'fizető' when r.metric = 'saved' then 'mentés' when r.metric = 'scored' then 'pontszám-lépés' when$b$);

/* ---------- her settings: the home layout and the paying goal are kept too (the home layout was refused without a word) ---------- */
select pg_temp.sub('public.admin_setting_get(text)', $a$('views', 'tv', 'approvals')$a$, $b$('views', 'tv', 'approvals', 'home_layout', 'pay_goal')$b$);
select pg_temp.sub('public.admin_setting_save(text,jsonb)', $a$('views', 'tv', 'approvals')$a$, $b$('views', 'tv', 'approvals', 'home_layout', 'pay_goal')$b$);

/* the daily summary rebuilt with the new "shared" and "saved", without her three visits */
select public.admin_rollup(date '2026-10-01');

/* ---------- second step, applied separately: the report knows whether the stores gave anything; the record push counts signatures ---------- */
create function pg_temp.sub2(fn text, a text, b text) returns void language plpgsql as $$
declare s text := pg_get_functiondef(fn::regprocedure);
begin
  if position(a in s) = 0 then raise exception 'no match in %: %', fn, left(a, 80); end if;
  execute replace(s, a, b);
end $$;
select pg_temp.sub2('public.admin_report(date,date)', $a$'from', v_f, 'to', v_t, 'days', v_len,$a$, $b$'from', v_f, 'to', v_t, 'days', v_len,
    'stores_on', exists (select 1 from public.store_daily),$b$);
select pg_temp.sub2('public.admin_r_push_news(text)', $a$'yesterday', (select jsonb_build_object('day', day, 'scored', scored,$a$,
  $b$'yesterday', (select jsonb_build_object('day', day, 'scored', scored,
         'made', coalesce((select m.n from public.admin_made_days() m where m.dy = a.day), 0), 'best_made', (select max(m.n) from public.admin_made_days() m where m.dy < a.day),$b$);

-- ======================================== from Calligra 20261229_admin_true_traffic
-- The admin's picture of visits, sources and the funnel (docs/admin-adathibak-2026-11-01.md, points 58-85, 149-152, 188-189):
-- an active visit (two events, or a source) next to the plain count, a one-hit door told apart, a "shared" that is really a share,
-- the steps of the current flow, time without idle gaps, the exact Google totals next to the partial country split.
-- The visit measurement stays anonymous: nothing new is stored, all of it is read from the events that already exist.
-- Each page's numbers live in an _i function without the admin gate (closed to everyone), so they can be checked as plain SELECTs.

/* ---------- a sign-in coming back, or the site itself, is not where the visit came from ---------- */
create or replace function public.admin_channel(src jsonb, ia text default null::text)
 returns text language sql immutable set search_path to '' as $function$
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
      when x.h in ('accounts.google.com', 'appleid.apple.com', 'inkage.app', 'www.inkage.app', 'checkout.stripe.com') then null
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
$function$;

/* the visits the sign-in return had filed under Google get their channel back */
update public.admin_sess_attr a set ch_first = x.c, ch_src = x.c
from (select e.session, public.admin_channel((array_agg(e.props->'src' order by e.created_at) filter (where e.props ? 'src'))[1], (array_agg(e.props->>'ia' order by e.created_at) filter (where e.props ? 'ia'))[1]) c
  from public.events e where e.props->'src'->>'from' in ('accounts.google.com', 'appleid.apple.com', 'inkage.app', 'www.inkage.app', 'checkout.stripe.com') group by 1) x
where a.session = x.session and a.ch_src is distinct from x.c;

/* ---------- one visit ----------
   engaged: two events, or it came from somewhere; door: one event from nowhere, which may be a person or a machine.
   shared is a real share now; a saved file is saved. active_secs: the gaps added up, a gap over 5 minutes counts as nothing. */
drop function if exists public.admin_sess(timestamp with time zone, timestamp with time zone, text, text);
create function public.admin_sess(a timestamp with time zone, b timestamp with time zone, p_ch text default null::text, p_lang text default null::text)
 returns table(session text, t0 timestamp with time zone, t1 timestamp with time zone, n bigint, src jsonb, lang text, channel text, pf text, land boolean, cta boolean, cta_reg boolean, cta_login boolean, cta_guest boolean, app boolean, named boolean, captured boolean, skipped boolean, scored boolean, quiz boolean, revealed boolean, detail boolean, more boolean, shared boolean, last_ev text,
   engaged boolean, door boolean, signup boolean, celeb boolean, picks boolean, celebrated boolean, saved boolean, fav boolean, mailed boolean, active_secs integer)
 language sql stable set search_path to '' as $function$
  select x.session, x.t0, x.t1, x.n, x.src, x.lang, public.admin_channel(x.src, x.ia), public.admin_pf_guess(x.src, coalesce(x.pf, case when x.ia = 'androidapp' then 'android' end)),
    x.land, x.cta, x.cta_reg, x.cta_login, x.cta_guest, x.app, x.named, x.captured, x.skipped and not x.captured, x.scored, x.quiz, x.revealed, x.detail, x.more, x.shared, x.last_ev,
    (x.n >= 2 or not public.admin_nosrc(x.src)), (x.n = 1 and public.admin_nosrc(x.src)), x.signup, x.celeb, x.picks, x.celebrated, x.saved, x.fav, x.mailed, x.active_secs
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
      bool_or(e.name in ('share_open', 'share_video', 'reveal_share')) shared,
      (array_agg(e.name || coalesce(':' || coalesce(e.props->>'step', e.props->>'k', e.props->>'kind'), '') order by e.created_at desc))[1] last_ev,
      bool_or(e.name = 'signup') signup, bool_or((e.name = 'flow_step' and e.props->>'step' = 'score')) celeb, bool_or(e.name = 'flow_step' and e.props->>'step' = 'swipe') picks,
      bool_or(e.name = 'celebrate') celebrated, bool_or(e.name in ('share_save', 'save_done')) saved, bool_or(e.name in ('fav_on', 'look_fav')) fav, bool_or(e.name = 'sig_mail') mailed,
      coalesce(sum(case when e.gap <= 300 then e.gap else 0 end), 0)::int active_secs
    from (select e2.*, extract(epoch from e2.created_at - lag(e2.created_at) over (partition by e2.session order by e2.created_at)) gap
      from public.admin_events(p_ch, p_lang) e2 where e2.created_at >= a and e2.created_at < b and e2.session is not null) e
    group by e.session) x
$function$;
revoke all on function public.admin_sess(timestamp with time zone, timestamp with time zone, text, text) from public, anon, authenticated;

/* ---------- Forrás ---------- */
create or replace function public.admin_traffic_i(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare r record; res jsonb; tz constant text := 'Europe/Budapest';
begin
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
  /* whole days only: a rolling window starts on the first full day after it begins, so 7 days are 7 days of Google too */
  gd as (select * from public.admin_gsc_days(((r.a at time zone tz) + interval '1 day' - interval '1 microsecond')::date, (r.b at time zone tz)::date)),
  lk as (select coalesce(l.post_platform, public.admin_channel(jsonb_build_object('us', l.source))) k, count(*) n from public.short_links l group by 1)
  select jsonb_build_object(
    'from', r.a, 'to', r.b, 'days', r.d,
    'engaged', (select count(*) from s where engaged), 'doors', (select count(*) from s where door), 'prev_engaged', (select count(*) from ps where engaged),
    'door_pages', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(src->>'land', '?') k, count(*) n from s where door group by 1 order by 2 desc limit 8) x), '[]'),
    'channels', coalesce((select jsonb_agg(x order by x.sessions desc, x.signups desc) from (
      select z.k, sum(z.sessions) sessions, sum(z.app) app, sum(z.scored) scored, sum(z.revealed) revealed, sum(z.shared) shared, sum(z.signups) signups,
        sum(z.p_sessions) p_sessions, sum(z.p_scored) p_scored, sum(z.p_signups) p_signups, sum(z.engaged) engaged, sum(z.doors) doors, sum(z.saved) saved,
        sum(z.su_sure) su_sure, sum(z.su_good) su_good, sum(z.su_weak) su_weak
      from (
        select channel k, count(*) sessions, count(*) filter (where app) app, count(*) filter (where scored) scored, count(*) filter (where revealed) revealed,
          count(*) filter (where shared) shared, 0::bigint signups, 0::bigint p_sessions, 0::bigint p_scored, 0::bigint p_signups,
          count(*) filter (where engaged) engaged, count(*) filter (where door) doors, count(*) filter (where saved) saved, 0::bigint su_sure, 0::bigint su_good, 0::bigint su_weak from s group by 1
        union all select channel, 0, 0, 0, 0, 0, 0, count(*), count(*) filter (where scored), 0, 0, 0, 0, 0, 0, 0 from ps group by 1
        union all select su.ch, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0, count(*) filter (where su.conf = 'biztos'), count(*) filter (where su.conf = 'jo'), count(*) filter (where su.conf = 'gyenge') from su where su.ch is not null group by 1
        union all select psu.ch, 0, 0, 0, 0, 0, 0, 0, 0, count(*), 0, 0, 0, 0, 0, 0 from psu where psu.ch is not null group by 1) z
      group by z.k) x), '[]'),
    /* a device (the Android app) and someone coming back on their own say nothing about where the visit came from */
    'known', jsonb_build_object('now', (select count(*) filter (where channel not in ('közvetlen', 'androidapp', 'visszatérő')) from s), 'all', (select count(*) from s), 'engaged', (select count(*) from s where engaged),
      'prev', (select count(*) filter (where channel not in ('közvetlen', 'androidapp', 'visszatérő')) from ps), 'prev_all', (select count(*) from ps), 'prev_engaged', (select count(*) from ps where engaged),
      'android', (select count(*) from s where channel = 'androidapp'), 'returning', (select count(*) from s where channel = 'visszatérő')),
    /* time without idle gaps, over the visits with at least two events: one event has no length */
    'duration', (select jsonb_build_object('mean', avg(active_secs), 'mean_capped', avg(active_secs),
      'median', percentile_cont(.5) within group (order by active_secs),
      'p75', percentile_cont(.75) within group (order by active_secs), 'n', count(*), 'all', (select count(*) from s)) from s where n > 1),
    'duration_prev', (select jsonb_build_object('mean', avg(active_secs), 'mean_capped', avg(active_secs),
      'median', percentile_cont(.5) within group (order by active_secs)) from ps where n > 1),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select pf k, count(*) n, count(*) filter (where app) app, count(*) filter (where scored) scored, count(*) filter (where engaged) engaged from s group by 1) x), '[]'),
    'platforms_prev', coalesce((select jsonb_agg(x) from (select pf k, count(*) n from ps group by 1) x), '[]'),
    'flow', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select channel k, count(*) sessions, count(*) filter (where app) app, count(*) filter (where app and captured) captured, count(*) filter (where app and skipped) skipped,
        count(*) filter (where app and captured and scored) scored, count(*) filter (where app and revealed) revealed, count(*) filter (where app and revealed and shared) shared
      from s where engaged group by 1) x), '[]'),
    'signups', jsonb_build_object('n', (select count(*) from su), 'matched', (select count(*) from su where su.session is not null), 'prev', (select count(*) from psu),
      'sure', (select count(*) from su where su.conf = 'biztos'), 'good', (select count(*) from su where su.conf = 'jo'), 'weak', (select count(*) from su where su.conf = 'gyenge'), 'none', (select count(*) from su where su.session is null)),
    'campaigns', coalesce((select jsonb_agg(c order by c.sessions desc) from (
      select y.*, (select coalesce(q.title, l.note) from public.short_links l left join public.social_posts q on (q.platform = l.post_platform and q.post_id = l.post_id) or q.code = l.code
                   where l.code = y.content limit 1) post_title,
        (select coalesce(q.platform, l.post_platform) from public.short_links l left join public.social_posts q on (q.platform = l.post_platform and q.post_id = l.post_id) or q.code = l.code
                   where l.code = y.content limit 1) post_platform
      from (select coalesce(nullif(s.src->>'us', ''), '–') source, coalesce(nullif(s.src->>'um', ''), '–') medium, coalesce(nullif(s.src->>'uc', ''), '–') campaign,
          coalesce(nullif(s.src->>'ux', ''), '–') content, count(distinct s.session) sessions, count(distinct s.session) filter (where s.scored) scored, count(distinct s.session) filter (where s.revealed) revealed,
          count(distinct s.session) filter (where s.shared) shared, count(distinct su.user_id) signups
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
        (select count(*) from s where s.channel = pl.k and not (coalesce(s.src, '{}'::jsonb) ?| array['us', 'ux'])) organic,
        coalesce((select lk.n from lk where lk.k = pl.k), 0) links
      from unnest(array['tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube', 'google', 'ai']) pl(k)) x), '[]'),
    /* the channels that could show a visit at all: a link tagged for them, or a visit ever seen from them. The others are not measurable, which is not 0 */
    'measured', coalesce((select jsonb_agg(distinct x.k) from (
      select lk.k from lk union select q.platform from public.social_posts q where q.code is not null union select a.ch from public.admin_sess_attr a where a.ch is not null) x where x.k is not null), '[]'),
    /* the page's own entry pages and hours, over the active visits only */
    'landings', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(src->>'land', '?') k, count(*) filter (where engaged) n, count(*) total, count(*) filter (where app) app, count(*) filter (where scored) scored from s group by 1 having count(*) filter (where engaged) > 0 order by 2 desc limit 25) x), '[]'),
    'hours', coalesce((select jsonb_agg(x order by x.h) from (select extract(hour from t0 at time zone tz)::int h, count(*) n from s where engaged group by 1) x), '[]'),
    'weekdays', coalesce((select jsonb_agg(x order by x.w) from (select extract(isodow from t0 at time zone tz)::int w, count(*) n from s where engaged group by 1) x), '[]')
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_traffic_i(integer, timestamp with time zone, timestamp with time zone, text, text) from public, anon, authenticated;

create or replace function public.admin_traffic(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_traffic_i(p_days, p_from, p_to, p_ch, p_lang);
end $function$;

/* ---------- one channel ---------- */
create or replace function public.admin_channel_detail_i(p_ch text, p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_lang text default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare r record; res jsonb; tz constant text := 'Europe/Budapest';
begin
  select * into r from public.admin_range(p_days, p_from, p_to);
  with s as (select * from public.admin_sess(r.a, r.b, p_ch, p_lang)),
  ps as (select * from public.admin_sess(r.pa, r.a, p_ch, p_lang)),
  su as (select m.* from public.admin_signups_matched(r.a, r.b) m where m.ch = any(string_to_array(p_ch, ',')) and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
  psu as (select m.* from public.admin_signups_matched(r.pa, r.a) m where m.ch = any(string_to_array(p_ch, ',')) and (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2))),
  bk as (select g::date t from generate_series((r.a at time zone tz)::date, (r.b at time zone tz)::date, interval '1 day') g)
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(x order by x.t) from (
      select bk.t, count(s.session) sessions, count(s.session) filter (where s.scored) scored, count(s.session) filter (where s.engaged) engaged,
        (select count(*) from su where (su.created_at at time zone tz)::date = bk.t) signups
      from bk left join s on (s.t0 at time zone tz)::date = bk.t group by bk.t) x), '[]'),
    'landing', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.src->>'land', '/') k, count(distinct s.session) n, count(distinct s.session) filter (where s.scored) scored, count(distinct s.session) filter (where s.engaged) engaged, count(distinct su.user_id) signups
      from s left join su on su.session = s.session group by 1 order by 2 desc limit 12) x), '[]'),
    'campaigns', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.src->>'ux', s.src->>'uc') k, count(distinct s.session) n, count(distinct s.session) filter (where s.scored) scored, count(distinct su.user_id) signups, min(s.t0) first, max(s.t0) last
      from s left join su on su.session = s.session where s.src ? 'ux' or s.src ? 'uc' group by 1 order by 2 desc limit 15) x), '[]'),
    'referrers', coalesce((select jsonb_agg(x order by x.n desc) from (
      select s.src->>'from' k, count(*) n, count(*) filter (where s.scored) scored from s where s.src ? 'from' and s.src->>'from' not in ('accounts.google.com', 'appleid.apple.com', 'inkage.app', 'www.inkage.app', 'checkout.stripe.com') group by 1 order by 2 desc limit 10) x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(s.lang, '?') k, count(distinct s.session) n, count(distinct s.session) filter (where s.scored) scored, count(distinct s.session) filter (where s.engaged) engaged, count(distinct su.user_id) signups
      from s left join su on su.session = s.session group by 1 order by 2 desc limit 10) x), '[]'),
    'platforms', coalesce((select jsonb_agg(x order by x.n desc) from (select s.pf k, count(*) n from s group by 1) x), '[]'),
    'totals', (select jsonb_build_object('sessions', count(*), 'scored', count(*) filter (where scored), 'revealed', count(*) filter (where revealed), 'signups', (select count(*) from su),
      'engaged', count(*) filter (where engaged), 'doors', count(*) filter (where door), 'saved', count(*) filter (where saved),
      'su_sure', (select count(*) from su where su.conf = 'biztos'), 'su_good', (select count(*) from su where su.conf = 'jo'), 'su_weak', (select count(*) from su where su.conf = 'gyenge')) from s),
    'prev', (select jsonb_build_object('sessions', count(*), 'scored', count(*) filter (where scored), 'signups', (select count(*) from psu)) from ps),
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (
      select y.*, (select count(*) from s where s.src->>'ux' = y.code) sessions, (select count(*) from s where s.src->>'ux' = y.code and s.scored) scored
      from (select q.title, q.url, q.views, q.created_at, coalesce(q.code, (select l.code from public.short_links l where l.post_platform = q.platform and l.post_id = q.post_id limit 1)) code
            from public.social_posts q where q.platform = any(string_to_array(p_ch, ',')) order by q.created_at desc nulls last limit 12) y) x), '[]')
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_channel_detail_i(text, integer, timestamp with time zone, timestamp with time zone, text) from public, anon, authenticated;

create or replace function public.admin_channel_detail(p_ch text, p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_channel_detail_i(p_ch, p_days, p_from, p_to, p_lang);
end $function$;

/* ---------- Tölcsér ---------- */
create or replace function public.admin_funnel_i(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare r record; res jsonb;
begin
  select * into r from public.admin_range(p_days, p_from, p_to);
  with s as (select * from public.admin_sess(r.a, r.b, p_ch, p_lang)),
  ps as (select * from public.admin_sess(r.pa, r.a, p_ch, p_lang)),
  su as (select m.* from public.admin_signups_matched(r.a, r.b) m where (p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2)) and (p_ch is null or m.ch = any(string_to_array(p_ch, ',')))),
  /* the last answer of a visit to each question: stepping back and answering again is still one person */
  qa as (
    select distinct on (e.session, e.props->>'step') e.session, e.props->>'step' step, e.props->>'value' val
    from public.admin_events(p_ch, p_lang) e
    where e.name = 'quiz_answer' and e.created_at >= r.a and e.created_at < r.b and e.session is not null and e.props->>'step' not in ('name', 'sign')
    order by e.session, e.props->>'step', e.created_at desc),
  /* the buttons of the visits on the website, the Android app's own /start left out */
  ct as (
    select e.props->>'cta' k, e.session
    from public.admin_events(p_ch, p_lang) e join s on s.session = e.session and s.pf = 'web'
    where e.name = 'cta_click' and e.created_at >= r.a and e.created_at < r.b)
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
      'any_scored', count(*) filter (where scored), 'any_revealed', count(*) filter (where revealed), 'any_shared', count(*) filter (where shared),
      'engaged', count(*) filter (where engaged), 'doors', count(*) filter (where door),
      'any_app', count(*) filter (where app), 'any_named', count(*) filter (where named), 'any_quiz', count(*) filter (where quiz),
      'after_picks', count(*) filter (where revealed and picks), 'after_celeb', count(*) filter (where revealed and celeb), 'after_fav', count(*) filter (where revealed and fav), 'after_celebrated', count(*) filter (where revealed and celebrated),
      'after_detail', count(*) filter (where revealed and detail), 'after_saved', count(*) filter (where revealed and saved), 'after_shared', count(*) filter (where revealed and shared), 'after_mailed', count(*) filter (where revealed and mailed),
      'any_celeb', count(*) filter (where celeb), 'any_saved', count(*) filter (where saved), 'any_signup', count(*) filter (where signup),
      'web_sessions', count(*) filter (where pf = 'web'), 'web_engaged', count(*) filter (where pf = 'web' and engaged), 'web_land', count(*) filter (where pf = 'web' and land), 'web_land_engaged', count(*) filter (where pf = 'web' and land and engaged),
      'web_cta', count(*) filter (where pf = 'web' and land and cta), 'web_land_app', count(*) filter (where pf = 'web' and land and app), 'web_direct_app', count(*) filter (where pf = 'web' and app and not land),
      'web_signup', count(*) filter (where pf = 'web' and land and signup), 'android_sessions', count(*) filter (where pf = 'android'), 'android_land_app', count(*) filter (where pf = 'android' and land and app)) from s),
    'prev', (select jsonb_build_object('sessions', count(*), 'app', count(*) filter (where app), 'named', count(*) filter (where app and named),
      'captured', count(*) filter (where app and named and captured), 'scored', count(*) filter (where app and named and captured and scored),
      'quiz', count(*) filter (where app and named and captured and scored and quiz), 'revealed', count(*) filter (where app and named and captured and scored and quiz and revealed),
      'detail', count(*) filter (where app and named and captured and scored and quiz and revealed and detail),
      'shared', count(*) filter (where app and named and captured and scored and quiz and revealed and shared),
      'skipped', count(*) filter (where app and named and skipped), 'land', count(*) filter (where land), 'land_app', count(*) filter (where land and app),
      'any_scored', count(*) filter (where scored), 'any_revealed', count(*) filter (where revealed), 'engaged', count(*) filter (where engaged), 'doors', count(*) filter (where door), 'any_saved', count(*) filter (where saved)) from ps),
    /* the answers people gave: a question without a value counts its people; "a+b" (several picked) counts each */
    'quiz', coalesce((select jsonb_agg(x order by x.step, x.n desc) from (
      select qa.step, coalesce(u.v, '') v, count(*) n
      from qa left join lateral unnest(string_to_array(nullif(qa.val, ''), '+')) u(v) on true group by 1, 2) x), '[]'),
    'quiz_people', coalesce((select jsonb_object_agg(x.step, x.n) from (select qa.step, count(*) n from qa group by 1) x), '{}'),
    'ctas', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(ct.k, '?') k, count(distinct ct.session) n from ct group by 1) x), '[]'),
    'cta_register_intent', (select count(distinct ct.session) from ct where coalesce(ct.k, '') not in ('login', 'guest')),
    'accounts', jsonb_build_object('n', (select count(*) from su), 'sure', (select count(*) from su where su.conf = 'biztos'), 'good', (select count(*) from su where su.conf = 'jo'), 'weak', (select count(*) from su where su.conf = 'gyenge'), 'none', (select count(*) from su where su.session is null)),
    'duration', (select jsonb_build_object('median', percentile_cont(.5) within group (order by active_secs), 'p75', percentile_cont(.75) within group (order by active_secs), 'n', count(*), 'all', (select count(*) from s)) from s where n > 1)
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_funnel_i(integer, timestamp with time zone, timestamp with time zone, text, text) from public, anon, authenticated;

create or replace function public.admin_funnel(p_days integer default 30, p_from timestamp with time zone default null, p_to timestamp with time zone default null, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_funnel_i(p_days, p_from, p_to, p_ch, p_lang);
end $function$;

create or replace function public.admin_funnel_weeks_i(p_weeks integer default 12, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare tz constant text := 'Europe/Budapest'; v_a timestamptz := date_trunc('week', now() at time zone tz) at time zone tz - make_interval(weeks => greatest(1, least(coalesce(p_weeks, 12), 52)) - 1);
begin
  return coalesce((select jsonb_agg(x order by x.w) from (
    select date_trunc('week', t0 at time zone tz)::date w, count(*) sessions, count(*) filter (where engaged) engaged, count(*) filter (where app) app, count(*) filter (where app and named) named,
      count(*) filter (where app and named and captured) captured, count(*) filter (where app and named and captured and scored) scored,
      count(*) filter (where app and named and captured and scored and quiz) quiz,
      count(*) filter (where app and named and captured and scored and quiz and revealed) revealed,
      count(*) filter (where app and named and captured and scored and quiz and revealed and shared) shared,
      count(*) filter (where app and named and skipped) skipped, count(*) filter (where saved) saved
    from public.admin_sess(v_a, now(), p_ch, p_lang) group by 1) x), '[]');
end $function$;
revoke all on function public.admin_funnel_weeks_i(integer, text, text) from public, anon, authenticated;

create or replace function public.admin_funnel_weeks(p_weeks integer default 12, p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_funnel_weeks_i(p_weeks, p_ch, p_lang);
end $function$;

/* ---------- who stopped where ----------
   door: one event from nowhere, on its own line, so it does not bury the real drop-outs. A length is only given where it can be measured. */
create or replace function public.admin_dropouts_i(p_days integer default 30, p_ch text default null, p_lang text default null, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare k integer := greatest(1, least(coalesce(nullif(p_days, 0), 365), 365)); r record;
begin
  select * into r from public.admin_range(k, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.at_step, x.n desc) from (
    with st as (select last_ev, n, active_secs, case
        when door then 'door'
        when land and not app then 'web'
        when app and not named then 'app'
        when app and named and skipped and not revealed then 'skipped'
        when app and named and not captured and not skipped then 'named'
        when app and named and captured and not scored then 'captured'
        when app and named and captured and scored and not revealed then 'scored'
        when revealed and not picks and not detail and not celebrated then 'revealed'
        when revealed and not celebrated and not saved and not shared then 'picked' end at_step
      from public.admin_sess(r.a, r.b, p_ch, p_lang))
    select at_step, last_ev, count(*) n, round(avg(active_secs) filter (where n > 1)) secs from st where at_step is not null group by 1, 2) x), '[]');
end $function$;
revoke all on function public.admin_dropouts_i(integer, text, text, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;

create or replace function public.admin_dropouts(p_days integer default 30, p_ch text default null, p_lang text default null, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_dropouts_i(p_days, p_ch, p_lang, p_from, p_to);
end $function$;

create or replace function public.admin_dropout_sessions_i(p_days integer, p_at text, p_last text default null, p_ch text default null, p_lang text default null, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare k integer := greatest(1, least(coalesce(nullif(p_days, 0), 365), 365)); r record;
begin
  select * into r from public.admin_range(k, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.t0 desc) from (
    with st as (select session, t0, t1, n, channel, lang, pf, last_ev, active_secs, case
        when door then 'door'
        when land and not app then 'web'
        when app and not named then 'app'
        when app and named and skipped and not revealed then 'skipped'
        when app and named and not captured and not skipped then 'named'
        when app and named and captured and not scored then 'captured'
        when app and named and captured and scored and not revealed then 'scored'
        when revealed and not picks and not detail and not celebrated then 'revealed'
        when revealed and not celebrated and not saved and not shared then 'picked' end at_step
      from public.admin_sess(r.a, r.b, p_ch, p_lang))
    select right(st.session, 6) s, st.t0, case when st.n > 1 then st.active_secs end secs, st.channel ch, st.lang, st.pf,
      (select jsonb_agg(e.name || coalesce(':' || coalesce(e.props->>'step', e.props->>'k', e.props->>'cta'), '') order by e.created_at)
       from (select * from public.events_real e2 where e2.session = st.session order by e2.created_at limit 40) e) trail
    from st where st.at_step = p_at and (p_last is null or st.last_ev = p_last) order by st.t0 desc limit 25) x), '[]');
end $function$;
revoke all on function public.admin_dropout_sessions_i(integer, text, text, text, text, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;

create or replace function public.admin_dropout_sessions(p_days integer, p_at text, p_last text default null, p_ch text default null, p_lang text default null, p_from timestamp with time zone default null, p_to timestamp with time zone default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_dropout_sessions_i(p_days, p_at, p_last, p_ch, p_lang, p_from, p_to);
end $function$;

/* ---------- Élő ----------
   a single page opened from nowhere in the last 30 minutes is not yet a visit we count: the machine marks reach it after 30 minutes,
   so it stands apart as unconfirmed until it does something, or its 30 minutes are up */
create or replace function public.admin_live_i(p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare tz constant text := 'Europe/Budapest'; d0 timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
begin
  return (with unc as (
    select e.session, min(e.created_at) t0 from public.admin_events(p_ch, p_lang) e
    where e.created_at >= now() - interval '30 minutes' and e.session is not null
      and not exists (select 1 from public.events o where o.session = e.session and o.created_at < now() - interval '30 minutes')
    group by e.session having count(*) = 1 and bool_and(e.name = 'landing_view') and public.admin_nosrc((array_agg(e.props->'src'))[1])),
  td as (select public.admin_period(d0, now(), p_ch, p_lang) p),
  ts as (select count(*) filter (where engaged) engaged, count(*) filter (where door) doors from public.admin_sess(d0, now(), p_ch, p_lang))
  select jsonb_build_object(
    'live', (select coalesce(jsonb_agg(x), '[]') from (
      select created_at, name, props - 'src' props, props->'src' src, path, lang, right(session, 6) s, right(session, 12) sid
      from public.admin_events(p_ch, p_lang) order by created_at desc limit 80) x),
    'live_now', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '5 minutes'),
    'live_hour', (select count(distinct session) from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '1 hour'),
    'live_now_confirmed', (select count(distinct session) from public.admin_events(p_ch, p_lang) e where e.created_at >= now() - interval '5 minutes' and not exists (select 1 from unc where unc.session = e.session)),
    'live_hour_confirmed', (select count(distinct session) from public.admin_events(p_ch, p_lang) e where e.created_at >= now() - interval '1 hour' and not exists (select 1 from unc where unc.session = e.session)),
    'unconfirmed', (select count(*) from unc),
    'unconfirmed_ids', coalesce((select jsonb_agg(right(unc.session, 6)) from unc), '[]'),
    'per_min', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by g.m), '[]') from generate_series(0, 29) g(m)
      left join (select floor(extract(epoch from now() - created_at) / 60)::int m, count(*) n from public.admin_events(p_ch, p_lang) where created_at >= now() - interval '30 minutes' group by 1) c on c.m = 29 - g.m),
    'today', (select p from td),
    'today_confirmed', (select greatest(0, coalesce((p->>'sessions')::int, 0) - (select count(*) from unc where unc.t0 >= d0)) from td),
    'today_engaged', (select engaged from ts),
    'today_doors', (select doors from ts),
    'clicks', coalesce((select jsonb_agg(x) from (select c.code, c.at, c.country, c.device, l.source, l.note,
        (select p.title from public.social_posts p where (p.platform = l.post_platform and p.post_id = l.post_id) or p.code = c.code limit 1) title
      from public.link_clicks c join public.short_links l on l.code = c.code where c.at > now() - interval '60 minutes' order by c.at desc limit 30) x), '[]'),
    'clicks_today', (select count(*) from public.link_clicks where at >= d0),
    'codes', coalesce((select jsonb_object_agg(k.code, jsonb_build_object('platform', coalesce(p.platform, l.post_platform, l.source), 'title', coalesce(p.title, l.note)))
      from (select distinct props->'src'->>'ux' code from public.admin_events(p_ch, p_lang) where created_at > now() - interval '3 hours' and props->'src' ? 'ux') k
      join public.short_links l on l.code = k.code
      left join lateral (select platform, title from public.social_posts p where (p.platform = l.post_platform and p.post_id = l.post_id) or p.code = l.code limit 1) p on true), '{}'),
    'bots', coalesce((select jsonb_agg(right(b.session, 6)) from public.admin_bot_sessions b where b.marked_at > now() - interval '2 days'), '[]'),
    'generated_at', now()));
end $function$;
revoke all on function public.admin_live_i(text, text) from public, anon, authenticated;

create or replace function public.admin_live(p_ch text default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_live_i(p_ch, p_lang);
end $function$;

/* ---------- Piacok ----------
   Google's exact totals next to the part that can be split by country; the languages with their active visits;
   which sources hold any row at all, so an empty source says "no data" and not 0 */
create or replace function public.admin_markets_i(p_days integer default 30)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare v_days integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  last date := (select max(day) from public.gsc_daily);
  /* each store source ends on its own last reported day (they come 1–3 days late), as Google does above */
  a_dl date := coalesce((select max(day) from public.store_daily where store = 'apple'), public.admin_today()) - v_days;
  a_play date := coalesce((select max(day) from public.store_metrics where store = 'google' and metric = 'installs' and dim = 'country'), public.admin_today()) - v_days;
  a_imp date := coalesce((select max(day) from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = 'territory'), public.admin_today()) - v_days;
  a_pv date := coalesce((select max(day) from public.store_metrics where store = 'apple' and metric = 'page_views' and dim = 'territory'), public.admin_today()) - v_days;
begin
  return jsonb_build_object('days', v_days,
    'acc_langs', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(left(coalesce(m.lang, m.slang), 2), '?') k, count(*) n from public.admin_signups_matched(now() - make_interval(days => v_days), now() + interval '1 minute') m group by 1) x), '[]'),
    'langs', coalesce((select jsonb_agg(x order by x.engaged desc, x.n desc) from (
      select coalesce(s.lang, '?') k, count(*) n, count(*) filter (where s.engaged) engaged, count(*) filter (where s.door) doors, count(*) filter (where s.scored) scored
      from public.admin_sess(now() - make_interval(days => v_days), now(), null, null) s group by 1) x), '[]'),
    'gsc', coalesce((select jsonb_agg(x order by x.clicks desc) from (
      select country k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where day > coalesce(last, public.admin_today()) - v_days group by 1) x), '[]'),
    'gsc_total', (select jsonb_build_object('clicks', coalesce(sum(g.clicks), 0), 'impressions', coalesce(sum(g.impressions), 0)) from public.admin_gsc_days(coalesce(last, public.admin_today()) - v_days + 1, coalesce(last, public.admin_today())) g),
    'gsc_part', (select jsonb_build_object('clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0)) from public.gsc_daily where day > coalesce(last, public.admin_today()) - v_days),
    'has', jsonb_build_object('apple', exists (select 1 from public.store_daily where store = 'apple'), 'play', exists (select 1 from public.store_metrics where store = 'google' and metric = 'installs' and dim = 'country'),
      'imp', exists (select 1 from public.store_metrics where store = 'apple' and metric = 'impressions' and dim = 'territory'), 'pv', exists (select 1 from public.store_metrics where store = 'apple' and metric = 'page_views' and dim = 'territory'),
      'aud', exists (select 1 from public.social_audience where breakdown = 'country')),
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
end $function$;
revoke all on function public.admin_markets_i(integer) from public, anon, authenticated;

create or replace function public.admin_markets(p_days integer default 30)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_markets_i(p_days);
end $function$;

/* ---------- Linkek: the tagged visits that came through no short link (the Instagram bio link) are shown too ---------- */
create or replace function public.admin_links_detail_i(p_days integer default 30)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650)); a timestamptz := now() - make_interval(days => d);
begin
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
    'untagged', coalesce((select jsonb_agg(x order by x.sessions desc) from (
        select e.props->'src'->>'ux' code, min(e.props->'src'->>'us') source, count(distinct e.session) sessions,
          count(distinct e.session) filter (where e.name = 'flow_step' and e.props->>'step' = 'score') scored
        from public.events_real e where e.props->'src' ? 'ux' and e.created_at >= a and e.session is not null
          and not exists (select 1 from public.short_links l where l.code = e.props->'src'->>'ux') group by 1 limit 20) x), '[]'),
    /* the posts a link can be tied to: the newest of each platform */
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc nulls last) from (
        select platform, post_id, created_at, left(title, 90) title, code from (
          select p.*, row_number() over (partition by platform order by created_at desc nulls last) rn from public.social_posts p) y where rn <= 60) x), '[]'));
end $function$;
revoke all on function public.admin_links_detail_i(integer) from public, anon, authenticated;

create or replace function public.admin_links_detail(p_days integer default 30)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_links_detail_i(p_days);
end $function$;

/* ---------- data quality: the active visits and the test visits next to the old counts ---------- */
create or replace function public.admin_data_quality_i(p_days integer default 30)
 returns jsonb language plpgsql stable set search_path to '' as $function$
declare t date := public.admin_today(); d integer := greatest(7, least(coalesce(p_days, 30), 90)); res jsonb;
begin
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
  ), ev as (select session, min(created_at) t0 from public.events where created_at >= now() - make_interval(days => d) and session is not null group by 1),
  sr as (select * from public.admin_sess(now() - make_interval(days => d), now(), null, null))
  select jsonb_build_object(
    'days', d,
    'sources', coalesce((select jsonb_agg(to_jsonb(p) order by p.source) from per p), '[]'),
    'sessions_all', (select count(*) from ev),
    'sessions_real', (select count(*) from sr),
    'sessions_engaged', (select count(*) from sr where engaged),
    'doors', (select count(*) from sr where door),
    'test', (select count(*) from ev where exists (select 1 from public.events e where e.session = ev.session and (coalesce(e.props->'src'->>'us', '') ilike '%test%' or coalesce(e.props->'src'->>'uc', '') in ('qa', 'qa2', 'scoretest', 'rec', 'test')))),
    'bots', (select count(*) from ev join public.admin_bot_sessions b on b.session = ev.session),
    'bot_reasons', coalesce((select jsonb_object_agg(reason, n) from (select b.reason, count(*) n from ev join public.admin_bot_sessions b on b.session = ev.session group by 1) x), '{}'),
    'own', (select count(*) from ev join public.admin_own_sessions o on o.session = ev.session)
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_data_quality_i(integer) from public, anon, authenticated;

create or replace function public.admin_data_quality(p_days integer default 30)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_data_quality_i(p_days);
end $function$;

-- ======================================== from Calligra 20261230_admin_true_social
/* The social pages tell the truth: posts the platform no longer returns are marked and left out of counts; clean pin codes; a pin code is no short link;
   comparisons on finished days; Pinterest windows end on its last day with data; "≈" for late-read data; an hour without a number is no 0; the false plan alert. */

/* posts the platform no longer returns: kept, with their past views, but marked ("nem látszik az élő fiókon": we cannot tell deleted from private) */
alter table public.social_posts add column if not exists gone_at timestamptz;

/* a pin link's utm_content with the pin's board or title glued on ("N15Signature Ideas for Your Name"): the real code is the front part ("N15").
   Other codes (short links, link_in_bio) pass through unchanged. */
create or replace function public.admin_clean_code(c text)
 returns text language sql immutable set search_path to ''
as $function$
  select case when c ~ '^[A-Z]{1,2}[0-9]{1,3}[A-Z ]' then substring(c from '^[A-Z]{1,2}[0-9]{1,3}') else c end
$function$;
revoke execute on function public.admin_clean_code(text) from public, anon, authenticated;

create or replace function public.admin_w_social_posts(p_token text, p_rows jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.social_posts (platform, post_id, created_at, kind, title, url, thumb, duration, code, views, likes, comments, shares, saves, reach, impressions, clicks,
    watch_avg, watch_total, profile_visits, follows, completion, updated_at)
  select r.platform, r.post_id, r.created_at, r.kind, r.title, r.url, r.thumb, r.duration, public.admin_clean_code(r.code), r.views, r.likes, r.comments, r.shares, r.saves, r.reach, r.impressions, r.clicks,
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
    updated_at = excluded.updated_at, gone_at = null; /* the platform gave it back: it is on the account again */
  get diagnostics k = row_count; return k;
end $function$;

/* the sync, after the platform gave its whole list: what is not on the list is marked. Hand-added posts are not the platform's to list;
   a post written in the last hour may simply be newer than the list. */
create or replace function public.admin_w_social_gone(p_token text, p_platform text, p_seen jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.social_posts p set gone_at = now()
  where p.platform = p_platform and p.gone_at is null and p.post_id not like 'm:%' and p.updated_at < now() - interval '1 hour'
    and not exists (select 1 from jsonb_array_elements_text(coalesce(p_seen, '[]')) s where s = p.post_id);
  get diagnostics k = row_count; return k;
end $function$;
revoke execute on function public.admin_w_social_gone(text, text, jsonb) from public;
grant execute on function public.admin_w_social_gone(text, text, jsonb) to anon, authenticated, service_role;

/* one-time: the rows the live lists stopped returning (TikTok 10-26: 12, Instagram 10-29: 3), dated by their last reading */
update public.social_posts set gone_at = updated_at
where platform in ('tiktok', 'instagram') and gone_at is null and post_id not like 'm:%' and updated_at < '2026-10-30 00:00+00';

/* one-time: the codes as the admin reads them */
update public.social_posts set code = public.admin_clean_code(code) where code is distinct from public.admin_clean_code(code);

create or replace function public.admin_live_posts()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  /* an hourly row holds the last reading of that hour, up to 59 minutes after its time: the pace compares the latest reading with the hour before it
     (not with "an hour ago by the clock", which gave 0 until the next run). An hour without a number (pins) is no number, not 0.
     An old post's hourly rows stopped when it turned a week old: its last one is no "an hour ago". */
  return coalesce((select jsonb_agg(x order by x.gain_h desc nulls last, x.views desc nulls last) from (
    select p.platform, p.post_id, p.title, p.url, p.thumb, p.views, p.likes, p.comments, p.created_at, p.updated_at,
      p.views - (select h.views from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.views is not null and h.at <= date_trunc('hour', p.updated_at) - interval '1 hour' and h.at >= date_trunc('hour', p.updated_at) - interval '2 hours' order by h.at desc limit 1) gain_h,
      p.views - (select h.views from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.views is not null and h.at <= date_trunc('hour', p.updated_at) - interval '24 hours' and h.at >= date_trunc('hour', p.updated_at) - interval '27 hours' order by h.at desc limit 1) gain_d,
      (select jsonb_agg(h.views order by h.at) from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.views is not null and h.at > now() - interval '24 hours') hourly
    from public.social_posts p
    where p.gone_at is null and (p.created_at > now() - interval '30 days' or exists (select 1 from public.social_post_hourly h where h.platform = p.platform and h.post_id = p.post_id and h.at > now() - interval '6 hours'))
    order by p.created_at desc nulls last limit 120) x), '[]');
end $function$;

create or replace function public.admin_plan_posts(p_from date, p_to date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'posts', coalesce((select jsonb_agg(x order by x.created_at) from (
      select p.platform, p.post_id, p.created_at, p.kind, p.title, p.url, p.thumb, p.views, p.likes, p.comments, p.saves, p.shares,
        coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) code
      from public.social_posts p
      where p.gone_at is null and p.created_at >= p_from::timestamp at time zone 'Europe/Budapest' and p.created_at < (p_to + 1)::timestamp at time zone 'Europe/Budapest'
      order by p.created_at limit 3000) x), '[]'),
    'competitor', coalesce((select jsonb_agg(x) from (select domain, title, url, first_seen from public.competitor_pages where title is not null and first_seen > public.admin_today() - 30 order by first_seen desc limit 12) x), '[]'));
end $function$;

create or replace function public.admin_platform_today()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
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
      /* Pinterest gives its day numbers 1-2 days late: the last day it has given, named */
      case when a.platform = 'pinterest' then (select d.impressions from public.social_account_daily d where d.platform = 'pinterest' and d.impressions is not null order by d.day desc limit 1) end impressions_last,
      case when a.platform = 'pinterest' then (select max(d.day) from public.social_account_daily d where d.platform = 'pinterest' and d.impressions is not null) end impressions_last_day,
      (select count(distinct session) from public.events_real e where e.created_at >= t0 and public.admin_channel(e.props->'src', e.props->>'ia') = a.platform) visits_today
    from public.social_accounts a
    left join lateral (select d.day, d.followers from public.social_account_daily d where d.platform = a.platform and d.followers is not null order by d.day desc limit 1) f on true) x), '[]');
end $function$;

create or replace function public.admin_audience(p_days integer default 120)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare d integer := greatest(7, least(coalesce(nullif(p_days, 0), 3650), 3650));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', d,
    'demo', coalesce((select jsonb_agg(to_jsonb(a) order by a.platform, a.breakdown, a.n desc) from public.social_audience a), '[]'),
    'followers', coalesce((select jsonb_agg(x order by x.day) from (select platform, day, followers, gained, lost from public.social_account_daily where day >= public.admin_today() - d) x), '[]'),
    'posts', coalesce((select jsonb_agg(x order by x.created_at) from (
        select platform, post_id, created_at, left(title, 80) title, views, likes, comments, shares, saves, follows from public.social_posts where gone_at is null and created_at >= now() - make_interval(days => d)) x), '[]'),
    'stories', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from (
        select * from public.social_stories where created_at >= now() - make_interval(days => d) order by created_at desc limit 200) s), '[]'),
    /* for the empty cards: what is really behind an empty block */
    'connected', coalesce((select jsonb_agg(platform) from public.social_accounts), '[]'),
    'stories_total', (select count(*) from public.social_stories),
    'ig_followers', (select d2.followers from public.social_account_daily d2 where d2.platform = 'instagram' and d2.followers is not null order by d2.day desc limit 1),
    'pin_audience_failed_at', (select max(at) from public.sync_log where source = 'pinterest' and message like '%404%' and at > now() - interval '7 days'));
end $function$;

create or replace function public.admin_social(p_days integer default 30)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  d integer := greatest(1, least(coalesce(nullif(p_days, 0), 3650), 3650));
  t date := public.admin_today();
  /* Budapest calendar days, like the views gained: "Ma" is today since midnight, "3 nap" today and the two days before */
  a timestamptz := ((t - d + 1)::timestamp at time zone 'Europe/Budapest');
  pa timestamptz := ((t - least(2 * d, 7300) + 1)::timestamp at time zone 'Europe/Budapest');
  /* the comparisons on finished days: the d days before today against the d days before those (today is only part of a day) */
  tm timestamptz := (t::timestamp at time zone 'Europe/Budapest');
  fa timestamptz := ((t - d)::timestamp at time zone 'Europe/Budapest');
  fp timestamptz := ((t - least(2 * d, 7300))::timestamp at time zone 'Europe/Budapest');
  pl date := (select max(x.day) from public.social_account_daily x where x.platform = 'pinterest' and x.impressions is not null);
  codes text[] := array(select coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) from public.social_posts p where p.gone_at is null);
  res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with gn as materialized (
    select * from public.admin_post_gains(t - least(2 * d, 7300))
  ), gp as (
    select g.platform, g.post_id, sum(g.gain) gain from gn g where g.day >= t - d + 1 group by 1, 2
  ), visits as (
    select public.admin_clean_code(props->'src'->>'ux') code, count(distinct session) sessions,
      count(distinct session) filter (where name = 'flow_step' and props->>'step' = 'score') scored,
      count(distinct session) filter (where name = 'reveal_shown') revealed,
      count(distinct session) filter (where name = 'signup') signups,
      count(distinct session) filter (where created_at >= a) sessions_now
    from public.events_real where props->'src' ? 'ux' and session is not null group by 1
  ), p as (
    /* a post the platform no longer returns is left out of every list and count; what it gathered stays in the views gained */
    select p.*, coalesce(p.code, (select l.code from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id limit 1)) c
    from public.social_posts p where p.gone_at is null
  ), base as (
    select p.platform, p.post_id, p.created_at, p.kind, p.title, p.url, p.thumb, p.duration, p.c code,
      /* a short link (inkage.app/v/…) or a code in the link's utm_content: they are not the same thing */
      case when p.c is null then null when exists (select 1 from public.short_links l where l.code = p.c) then 'short' else 'utm' end link_kind,
      p.views, p.likes, p.comments, p.shares, p.saves, p.reach, p.impressions, p.clicks, p.watch_avg, p.watch_total, p.profile_visits, p.follows, p.completion, p.traffic, p.updated_at,
      (select dd.views from public.social_post_daily dd where dd.platform = p.platform and dd.post_id = p.post_id and dd.day <= t - 7 order by dd.day desc limit 1) views_week_ago,
      /* the count on the first day of the period: what the post gathered in the period is views - views_start */
      (select dd.views from public.social_post_daily dd where dd.platform = p.platform and dd.post_id = p.post_id and dd.day <= t - d order by dd.day desc limit 1) views_start,
      (select gp.gain from gp where gp.platform = p.platform and gp.post_id = p.post_id) period_gain,
      (select sum(x.pin_clicks) from public.social_post_day x where x.platform = p.platform and x.post_id = p.post_id) pin_clicks,
      (select sum(x.impressions * x.ctr) / nullif(sum(x.impressions) filter (where x.ctr is not null), 0) from public.social_post_day x where x.platform = p.platform and x.post_id = p.post_id) ctr,
      coalesce(v.sessions, 0) sessions, coalesce(v.scored, 0) scored, coalesce(v.revealed, 0) revealed, coalesce(v.signups, 0) signups, coalesce(v.sessions_now, 0) sessions_now
    from p left join visits v on v.code = p.c
  ), chs as (
    /* one channel per visit, the same as everywhere else */
    select e.session, min(e.created_at) t0, coalesce(min(sa.ch), 'közvetlen') ch,
      bool_or(e.name = 'flow_step' and e.props->>'step' = 'score') scored, bool_or(e.name = 'signup') signed,
      bool_or(e.props->'src'->>'ux' = 'link_in_bio') bio, bool_or(public.admin_clean_code(e.props->'src'->>'ux') = any (codes)) from_post
    from public.events_real e left join public.admin_sess_attr sa on sa.session = e.session
    where e.created_at >= fp and e.session is not null group by e.session
  ), lc as (
    select l.source, count(*) filter (where c.at >= a) clicks, count(*) filter (where c.at < a) clicks_prev
    from public.short_links l join public.link_clicks c on c.code = l.code where c.at >= pa group by 1
  )
  select jsonb_build_object(
    'days', d,
    'gained', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from gn where day >= t - d + 1 group by 1) x), '{}'),
    'gained_prev', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from gn where day >= t - least(2 * d, 7300) + 1 and day < t - d + 1 group by 1) x), '{}'),
    'gained_full', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from gn where day >= t - d and day < t group by 1) x), '{}'),
    'gained_full_prev', coalesce((select jsonb_object_agg(platform, v) from (select platform, sum(gain) v from gn where day < t - d group by 1) x), '{}'),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'username', username, 'display_name', display_name,
        'avatar_url', avatar_url, 'connected_at', connected_at, 'last_sync_at', last_sync_at, 'last_error', last_error, 'scopes', scopes,
        'token_expires_at', token_expires_at, 'refresh_expires_at', refresh_expires_at)) from public.social_accounts), '[]'),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (
        select platform, day, followers, following, likes, posts, impressions, reach, profile_views, views, watch_min, gained, lost, clicks, shares, impressions_30d, views_total
        from public.social_account_daily where day >= (now() - make_interval(days => greatest(d, 30)))::date) x), '[]'),
    'posts', coalesce((select jsonb_agg(to_jsonb(x) - 'rn' order by x.created_at desc nulls last, x.post_id) from (
        select b.*, row_number() over (partition by b.platform order by b.created_at desc nulls last) rn
        from base b where b.created_at >= a or b.created_at is null) x where x.rn <= 300), '[]'),
    /* older posts that still gathered views in the period ("ebben az időszakban szerzett" view of the leaderboard): by the same day numbers as the views gained, the pins' exact days too */
    'active', coalesce((select jsonb_agg((to_jsonb(x) - 'rn') || jsonb_build_object('views_start', coalesce(x.views, 0) - x.period_gain)) from (
        select b.*, row_number() over (partition by b.platform order by b.period_gain desc) rn
        from base b where b.created_at < a and b.period_gain > 0) x where x.rn <= 100), '[]'),
    /* every post, few fields, for the calendar's earlier months */
    'cal', coalesce((select jsonb_agg(x) from (
        select platform, post_id, created_at, kind, title, url, thumb, views, impressions from public.social_posts where gone_at is null and created_at is not null order by created_at desc limit 2000) x), '[]'),
    /* the posts left out above, so they do not vanish without a word */
    'gone', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select platform, post_id, created_at, kind, title, url, thumb, views, likes, updated_at last_seen, gone_at from public.social_posts where gone_at is not null) x), '[]'),
    'groups', coalesce((select jsonb_agg(to_jsonb(g)) from public.social_post_groups g), '[]'),
    'prev', jsonb_build_object(
      'posts', coalesce((select jsonb_object_agg(platform, to_jsonb(x) - 'platform') from (
          select b.platform, count(*) n, sum(b.views) views, sum(b.impressions) impressions, sum(b.likes) likes, sum(b.comments) comments, sum(b.shares) shares, sum(b.saves) saves,
            sum(b.sessions) filter (where b.code is not null) sessions, sum(b.views) filter (where b.code is not null) tagged_views
          from base b where b.created_at >= pa and b.created_at < a group by 1) x), '{}'),
      'leads', coalesce((select jsonb_object_agg(k, to_jsonb(x) - 'k') from (
          select ch k, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where signed) signups
          from chs where chs.t0 >= pa and chs.t0 < a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '{}')),
    /* the same visits on finished days only, for the change shown beside them */
    'full', coalesce((select jsonb_object_agg(k, to_jsonb(x) - 'k') from (
        select ch k, count(*) filter (where chs.t0 >= fa and chs.t0 < tm) now, count(*) filter (where chs.t0 < fa) prev
        from chs where chs.t0 < tm and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '{}'),
    /* Pinterest's account day numbers (complete; the pins' own arrive days later), up to its last day with data */
    'pin', case when pl is null then null else jsonb_build_object('last_day', pl, 'from', pl - d + 1,
      'imps', (select sum(x.impressions) from public.social_account_daily x where x.platform = 'pinterest' and x.day between pl - d + 1 and pl),
      'imps_prev', (select sum(x.impressions) from public.social_account_daily x where x.platform = 'pinterest' and x.day between pl - least(2 * d, 7300) + 1 and pl - d),
      'pin_sum', (select sum(x.impressions) from public.social_post_day x where x.platform = 'pinterest' and x.day between pl - d + 1 and pl),
      'clicks', (select sum(x.clicks) from public.social_account_daily x where x.platform = 'pinterest' and x.day between pl - d + 1 and pl)) end,
    /* can a visit be tied to a post at all on this platform? */
    'measure', (select jsonb_object_agg(f.pf, jsonb_build_object(
        'tagged', (select count(*) from base b where b.platform = f.pf and b.code is not null),
        'short', (select count(*) from base b where b.platform = f.pf and b.link_kind = 'short'),
        'posts', (select count(*) from base b where b.platform = f.pf),
        'visits_ever', (select count(*) from public.admin_sess_attr s where s.ch = f.pf)))
      from unnest(array['tiktok','instagram','facebook','pinterest','linkedin','youtube']) f(pf)),
    'visits', coalesce((select jsonb_agg(x order by x.t) from (
        select date_trunc('day', chs.t0 at time zone 'Europe/Budapest') t,
          count(*) filter (where ch = 'tiktok') tiktok, count(*) filter (where ch = 'instagram') instagram,
          count(*) filter (where ch = 'facebook') facebook, count(*) filter (where ch = 'pinterest') pinterest, count(*) filter (where ch = 'linkedin') linkedin, count(*) filter (where ch = 'youtube') youtube,
          count(*) filter (where ch = 'tiktok' and scored) tiktok_scored, count(*) filter (where ch = 'instagram' and scored) instagram_scored,
          count(*) filter (where ch = 'facebook' and scored) facebook_scored, count(*) filter (where ch = 'pinterest' and scored) pinterest_scored,
          count(*) filter (where ch = 'linkedin' and scored) linkedin_scored, count(*) filter (where ch = 'youtube' and scored) youtube_scored
        from chs where chs.t0 >= a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '[]'),
    'leads', coalesce((select jsonb_agg(x order by x.sessions desc) from (
        select ch k, count(*) sessions, count(*) filter (where scored) scored, count(*) filter (where signed) signups,
          count(*) filter (where bio) bio, count(*) filter (where from_post) from_post,
          coalesce((select lc.clicks from lc where lc.source = chs.ch), 0) clicks, coalesce((select lc.clicks_prev from lc where lc.source = chs.ch), 0) clicks_prev,
          /* no short link of this source: "0 clicks" would be no measurement, not a result */
          exists (select 1 from public.short_links l where l.source = chs.ch) clicks_known
        from chs where chs.t0 >= a and ch in ('tiktok','instagram','facebook','pinterest','linkedin','youtube') group by 1) x), '[]'),
    'sync', coalesce((select jsonb_agg(x order by x.at desc) from (select at, source, ok, rows, message, ok and message like '%kérés hibás%' partial from public.sync_log order by at desc limit 100) x), '[]'),
    /* each source: the last good run, the last failed one, the failures of the week; a run that saved its data while some requests failed is "partial" */
    'sync_state', coalesce((select jsonb_agg(x) from (
        select source, max(at) filter (where ok) last_ok, max(at) filter (where not ok) last_fail,
          (array_agg(message order by at desc) filter (where not ok))[1] last_msg, count(*) filter (where not ok and at > now() - interval '7 days') fails_7d,
          count(*) filter (where ok and message like '%kérés hibás%' and at > now() - interval '7 days') partial_7d,
          (array_agg(message order by at desc) filter (where ok and message like '%kérés hibás%'))[1] partial_msg
        from public.sync_log where at > now() - interval '60 days' group by source) x), '[]')
  ) into res;
  return res;
end $function$;

create or replace function public.admin_social_reach()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare t date := public.admin_today(); res jsonb;
  pl date := (select max(x.day) from public.social_account_daily x where x.platform = 'pinterest' and x.impressions is not null);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  /* materialized: computed once, not again for each of the 48 cells (it took 19 s and always hit the time limit) */
  with w as (
    select k, 'now'::text per, t - (k - 1) d0, t + 1 d1, pl - k + 1 p0, pl + 1 p1 from unnest(array[1, 3, 7, 30]) k
    union all select k, 'prev', t - (2 * k - 1), t - (k - 1), pl - 2 * k + 1, pl - k + 1 from unnest(array[1, 3, 7, 30]) k
  ), pf(platform) as (select unnest(array['tiktok', 'instagram', 'facebook', 'pinterest', 'linkedin', 'youtube'])),
  gn as materialized (select * from public.admin_post_gains(t - 60)),
  /* a post first read two or more days after it went out: all it had by then sits on the day it went out. A window that holds only part of that
     stretch cannot say how much of it belongs inside; a window that holds all of it is exact. */
  lump as materialized (
    select s.platform, (p.created_at at time zone 'Europe/Budapest')::date born, min(s.day) first_day
    from public.social_post_daily s join public.social_posts p on p.platform = s.platform and p.post_id = s.post_id
    where s.platform <> 'pinterest' and s.views is not null and p.created_at is not null group by 1, 2, s.post_id
    having min(s.day) > (p.created_at at time zone 'Europe/Budapest')::date + 1
  ),
  pvs as materialized (
    select w.k, w.per, g.platform, sum(g.gain) views,
      exists (select 1 from lump l where l.platform = g.platform and l.born < w.d1 and l.first_day >= w.d0 and not (l.born >= w.d0 and l.first_day < w.d1)) partial
    from w join gn g on g.platform <> 'pinterest' and g.day >= w.d0 and g.day < w.d1 group by 1, 2, 3, w.d0, w.d1
  ), chs as materialized (
    select s.session, s.first_at t0, s.ch from public.admin_sess_attr s
    where s.first_at >= ((t - 60)::timestamp at time zone 'Europe/Budapest')
      and exists (select 1 from public.events_real e where e.session = s.session)
  ), cell as (
    select w.k, w.per, pf.platform,
      s.views, coalesce(s.partial, false) partial,
      /* Pinterest: the account's day numbers, whole days up to its last day with data (it is 1-2 days late, so it has no "today") */
      case when pf.platform = 'pinterest' then (case when w.k = 1 then null else (select sum(a.impressions) from public.social_account_daily a where a.platform = 'pinterest' and a.day >= w.p0 and a.day < w.p1) end)
        else (select sum(a.impressions) from public.social_account_daily a where a.platform = pf.platform and a.day >= w.d0 and a.day < w.d1) end imps,
      case when pf.platform = 'pinterest' then (case when w.k = 1 then null else (select sum(x.impressions) from public.social_post_day x where x.platform = 'pinterest' and x.day >= w.p0 and x.day < w.p1) end) end imps_pins,
      case when pf.platform = 'pinterest' then pl else (select max(a.day) from public.social_account_daily a where a.platform = pf.platform and a.impressions is not null and a.day >= w.d0 and a.day < w.d1) end imps_to,
      (select sum(a.views) from public.social_account_daily a where a.platform = pf.platform and a.day >= w.d0 and a.day < w.d1) acc_views,
      (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform and p.created_at >= (w.d0::timestamp at time zone 'Europe/Budapest') and p.created_at < (w.d1::timestamp at time zone 'Europe/Budapest')) posts,
      (select count(*) from chs where chs.ch = pf.platform and chs.t0 >= (w.d0::timestamp at time zone 'Europe/Budapest') and chs.t0 < (w.d1::timestamp at time zone 'Europe/Budapest')) visits,
      /* finished days only, for the change: the k days before today against the k days before those */
      case when w.per = 'now' then jsonb_build_object(
        'views', (select sum(g.gain) from gn g where g.platform = pf.platform and g.day >= t - w.k and g.day < t),
        'views_prev', (select sum(g.gain) from gn g where g.platform = pf.platform and g.day >= t - 2 * w.k and g.day < t - w.k),
        'visits', (select count(*) from chs where chs.ch = pf.platform and chs.t0 >= ((t - w.k)::timestamp at time zone 'Europe/Budapest') and chs.t0 < (t::timestamp at time zone 'Europe/Budapest')),
        'visits_prev', (select count(*) from chs where chs.ch = pf.platform and chs.t0 >= ((t - 2 * w.k)::timestamp at time zone 'Europe/Budapest') and chs.t0 < ((t - w.k)::timestamp at time zone 'Europe/Budapest')),
        'posts', (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform and p.created_at >= ((t - w.k)::timestamp at time zone 'Europe/Budapest') and p.created_at < (t::timestamp at time zone 'Europe/Budapest')),
        'posts_prev', (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform and p.created_at >= ((t - 2 * w.k)::timestamp at time zone 'Europe/Budapest') and p.created_at < ((t - w.k)::timestamp at time zone 'Europe/Budapest'))) end full_days
    from w cross join pf left join pvs s on s.k = w.k and s.per = w.per and s.platform = pf.platform
  )
  select jsonb_build_object(
    'today', t,
    'cells', coalesce((select jsonb_agg(to_jsonb(c)) from cell c), '[]'),
    'platforms', (select jsonb_agg(jsonb_build_object('platform', pf.platform,
        'connected', exists (select 1 from public.social_accounts a where a.platform = pf.platform),
        'last_sync_at', (select a.last_sync_at from public.social_accounts a where a.platform = pf.platform),
        'last_error', (select a.last_error from public.social_accounts a where a.platform = pf.platform),
        'posts', (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform),
        'gone', (select count(*) from public.social_posts p where p.gone_at is not null and p.platform = pf.platform),
        'manual', (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform and p.post_id like 'm:%'),
        'last_post', (select max(p.created_at) from public.social_posts p where p.gone_at is null and p.platform = pf.platform),
        'tagged', (select count(*) from public.social_posts p where p.gone_at is null and p.platform = pf.platform and (p.code is not null or exists (select 1 from public.short_links l where l.post_platform = p.platform and l.post_id = p.post_id))),
        'visits_ever', (select count(*) from public.admin_sess_attr s where s.ch = pf.platform),
        'imps_from', (select min(a.day) from public.social_account_daily a where a.platform = pf.platform and a.impressions is not null),
        'imps_last', (select max(a.day) from public.social_account_daily a where a.platform = pf.platform and a.impressions is not null),
        'snap_since', (select min(d.day) from public.social_post_daily d where d.platform = pf.platform))) from pf)
  ) into res;
  return res;
end $function$;

/* surgical changes: these functions have parts other work may be changing at the same time, so only the named pieces are replaced in whatever is live */
do $do$
declare d text; n text;
begin
  /* admin_inbox: what the connections do not bring in, and which are connected */
  d := pg_get_functiondef('public.admin_inbox(boolean)'::regprocedure);
  n := replace(d, $s$'open', (select count(*) from public.inbox_items where not done)$s$,
    $s$'connected', coalesce((select jsonb_agg(platform) from public.social_accounts), '[]'),
    /* comments the platform counts but its API does not hand over: TikTok's and Pinterest's */
    'not_fetched', jsonb_build_object('tiktok', (select coalesce(sum(comments), 0) from public.social_posts where platform = 'tiktok' and gone_at is null)),
    'open', (select count(*) from public.inbox_items where not done)$s$);
  if n = d then raise exception 'admin_inbox: nothing replaced'; end if;
  execute n;

  /* the alert: a plan whose post is on the platform did go out, whatever its stage says */
  d := pg_get_functiondef('public.admin_platform_alerts()'::regprocedure);
  n := replace(d, $s$select count(*) into k from public.content_plans where day < today and day >= today - 14 and status in ('terv', 'kesz');$s$,
    $s$select count(*) into k from public.content_plans c where c.day < today and c.day >= today - 14 and c.status in ('terv', 'kesz')
    and not exists (select 1 from public.social_posts p where p.platform = any (c.platforms) and lower(btrim(p.title)) = lower(btrim(c.title)));$s$);
  if n = d then raise exception 'admin_platform_alerts: plan count not replaced'; end if;
  d := n;
  n := replace(d, 'A napja elmúlt, és nincs „Kint van” állapotban. Tedd át egy új napra, vagy jelöld késznek.', 'A napja elmúlt, és ilyen című poszt a platformon sincs. Tedd át egy új napra, vagy állítsd „Kint van”-ra, ha mégis kiment.');
  if n = d then raise exception 'admin_platform_alerts: text not replaced'; end if;
  execute n;

  /* admin_post: the peers are the live posts; the visits by the clean code; what kind of code it is */
  d := pg_get_functiondef('public.admin_post(text,text)'::regprocedure);
  n := replace(d, $s$props->'src'->>'ux' = c and session is not null$s$, $s$public.admin_clean_code(props->'src'->>'ux') = c and session is not null$s$);
  if n = d then raise exception 'admin_post: visits not replaced'; end if; d := n;
  n := replace(d, $s$where platform = p_platform and post_id <> p_post_id and views > 0$s$, $s$where platform = p_platform and post_id <> p_post_id and views > 0 and gone_at is null$s$);
  if n = d then raise exception 'admin_post: peers not replaced'; end if; d := n;
  n := replace(d, $s$'code', c,$s$, $s$'code', c,
    'link_kind', case when c is null then null when exists (select 1 from public.short_links l where l.code = c) then 'short' else 'utm' end,$s$);
  if n = d then raise exception 'admin_post: code not replaced'; end if;
  execute n;

  /* admin_impressions: each account's window ends on its last day with data; the posts listed are the live ones */
  d := pg_get_functiondef('public.admin_impressions(integer)'::regprocedure);
  n := replace(d, $s$ga date := lg - d + 1; first date := least(lg, lb, la, lp, today) - 2 * d + 1; res jsonb;$s$,
    $s$ga date := lg - d + 1;
  /* the last day each account has a day number for (Pinterest is 1-2 days late, Instagram gives yesterday): a window of empty days compares nothing */
  lacc jsonb := coalesce((select jsonb_object_agg(platform, e) from (select platform, max(day) e from public.social_account_daily where impressions is not null group by 1) x), '{}');
  lmin date := coalesce((select min((v)::date) from jsonb_each_text(lacc) j(k, v)), today);
  first date := least(lg, lb, la, lp, today, lmin) - 2 * d + 1; res jsonb;$s$);
  if n = d then raise exception 'admin_impressions: declare not replaced'; end if; d := n;
  n := replace(d, $s$('tiktok', today), ('instagram', today), ('facebook', today), ('pinterest', today), ('linkedin', today), ('youtube', today)) v(k, e)$s$,
    $s$('tiktok', today), ('instagram', coalesce((lacc->>'instagram')::date, today)), ('facebook', coalesce((lacc->>'facebook')::date, today)), ('pinterest', coalesce((lacc->>'pinterest')::date, today)), ('linkedin', coalesce((lacc->>'linkedin')::date, today)), ('youtube', coalesce((lacc->>'youtube')::date, today))) v(k, e)$s$);
  if n = d then raise exception 'admin_impressions: windows not replaced'; end if; d := n;
  n := replace(d, $s$from g join public.social_posts p on p.platform = g.platform and p.post_id = g.post_id where g.day >= today - d + 1 group by 1, 2$s$,
    $s$from g join public.social_posts p on p.platform = g.platform and p.post_id = g.post_id where p.gone_at is null and g.day >= today - d + 1 group by 1, 2$s$);
  if n = d then raise exception 'admin_impressions: posts not replaced'; end if; d := n;
  /* the first day each account has a day number: a previous window reaching before it compares with days that were never measured */
  n := replace(d, $s$'gsc_last', lg,$s$, $s$'gsc_last', lg,
    'since', coalesce((select jsonb_object_agg(platform, d0) from (select platform, min(day) d0 from public.social_account_daily where impressions is not null group by 1) x), '{}'),$s$);
  if n = d then raise exception 'admin_impressions: since not replaced'; end if;
  execute n;
end $do$;

-- ======================================== from Calligra 20261231_admin_true_search
-- Admin, true numbers: Search, SEO, Stores, Brand, Monitoring (docs/admin-adathibak-2026-11-01.md, points 132-148, 168-187).
-- The long functions are patched in place (a piece of text swapped, failing loudly when the piece is not there), so what
-- the other changes of this round wrote into the same functions stays. Existing JSON fields stay: the deployed page reads them.

create or replace function pg_temp.patch(p_fn text, p_pairs text[]) returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p_fn::regprocedure); i int;
begin
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if position(p_pairs[2 * i - 1] in d) = 0 then raise exception 'patch %: not found: %', p_fn, left(p_pairs[2 * i - 1], 80); end if;
    d := replace(d, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  execute d;
end $p$;

-- ---------- new tables ----------
-- Google's own totals by page, by country and by device: asked on their own they keep the searches Google hides in the
-- query rows, so they add up to (nearly) the real total. Filled by the next sync, 16 months back.
create table if not exists public.gsc_dims (
  day date not null, dim text not null check (dim in ('page', 'country', 'device')), val text not null,
  clicks integer not null default 0, impressions integer not null default 0, position real,
  primary key (day, dim, val));
alter table public.gsc_dims enable row level security;

-- each place the mention watch reads, and what happened there on the last run
create table if not exists public.brand_sources (
  source text primary key, state text not null, note text, n integer, at timestamptz not null default now());
alter table public.brand_sources enable row level security;

select pg_temp.patch('public.admin_w_growth_rows(text,text,jsonb)', array[
  $a$'competitor_aso') then raise$a$, $a$'competitor_aso', 'gsc_dims') then raise$a$]);
select pg_temp.patch('public.admin_w_rows(text,text,jsonb)', array[
  $a$'cert_status', 'cse_ranks')$a$, $a$'cert_status', 'cse_ranks', 'brand_sources')$a$]);

create or replace function public.admin_r_gsc_dims_has(p_token text)
 returns boolean language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return exists (select 1 from public.gsc_dims);
end $f$;
revoke all on function public.admin_r_gsc_dims_has(text) from public;
grant execute on function public.admin_r_gsc_dims_has(text) to anon, authenticated, service_role;

-- ---------- what the sources did NOT bring, though their run said "ok" ----------
create or replace function public.admin_source_problems()
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare out jsonb := '[]'; r record; m text; n bigint;
begin
  if not exists (select 1 from public.sync_log where source = 'apple' and ok and at > now() - interval '3 days') then
    out := out || jsonb_build_object('k', 'apple', 't', 'App Store: a letöltéseket és az értékeléseket nem olvassuk. A kulcsokat neked kell megadni a Kapcsolatok oldalon.');
  end if;
  if not exists (select 1 from public.sync_log where source = 'google' and ok and at > now() - interval '3 days') then
    out := out || jsonb_build_object('k', 'google', 't', 'Google Play: a telepítéseket és az értékeléseket nem olvassuk. A kulcsfájlt neked kell feltölteni a Kapcsolatok oldalon.');
  end if;
  select l.rows, l.message into r from public.sync_log l where l.source = 'bing' order by l.at desc limit 1;
  if found and coalesce(r.rows, 0) = 0 then
    out := out || jsonb_build_object('k', 'bing', 't', 'Bing: a lehúzás lefut, de nem jön adat (0 sor). Nézd meg a Bing Webmaster Toolsban, hogy az inkage.app igazolva van-e.');
  end if;
  select string_agg(case b.source when 'reddit' then 'Reddit' when 'youtube' then 'YouTube' when 'instagram' then 'Instagram' when 'hackernews' then 'Hacker News' when 'news' then 'Google Hírek' else b.source end, ', ' order by b.source) into m
    from public.brand_sources b where b.state <> 'ok';
  if m is not null then out := out || jsonb_build_object('k', 'mentions', 't', 'Említés-figyelés: ezek nem mérnek: ' || m || '.'); end if;
  select l.message into m from public.sync_log l where l.source = 'gsc_index' order by l.at desc limit 1;
  if m ~ 'sikertelen' then out := out || jsonb_build_object('k', 'gsc_index', 't', 'Google-indexelés: az utolsó futásban nem minden cím ellenőrzése sikerült (' || coalesce(substring(m from '\d+ sikertelen[^·]*'), 'részben') || ').'); end if;
  for r in select a.platform, (select l.message from public.sync_log l where l.source = a.platform order by l.at desc limit 1) msg from public.social_accounts a loop
    if r.msg ~ 'hibás' then out := out || jsonb_build_object('k', r.platform, 't', initcap(r.platform) || ': a legutóbbi lehúzásban volt hibás kérés (' || left(coalesce(substring(r.msg from '\d+ kérés hibás[^·]*'), 'részben'), 90) || ').'); end if;
  end loop;
  select count(*) into n from public.cert_status where domain_expires is null;
  if n > 0 then out := out || jsonb_build_object('k', 'domain', 't', 'A domain lejárati dátuma nem ismert: a figyelmeztetés így nem tud szólni.'); end if;
  return out;
end $f$;
revoke all on function public.admin_source_problems() from public, anon, authenticated;

-- ---------- Search ----------
select pg_temp.patch('public.admin_search(integer,text,text,text,text,text)', array[
  $a$brand_re constant text := '(inkage|ink age|inkag|inkaege)';$a$,
  -- the word itself, not "calligrah" or "calligrafia"; the KDE office suite's words do not count as us
  $a$brand_re constant text := '(inkage|ink age|inkag|inkaege)';
  kde_re constant text := '^$';$a$,
  $a$(p_brand = 'brand') = (x.query ~* brand_re)$a$, $a$(p_brand = 'brand') = (x.query ~* brand_re and x.query !~* kde_re)$a$,
  $a$from g where query ~* brand_re)$a$, $a$from g where query ~* brand_re and query !~* kde_re)$a$,
  $a$from g where query !~* brand_re)$a$, $a$from g where not (query ~* brand_re and query !~* kde_re))$a$,
  $a$select query, sum(impressions) impressions, sum(clicks) clicks, min(day) first from public.gsc_daily group by query
        having min(day) >= last - 6 order by 2 desc limit 25) x), '[]'),$a$,
  $a$select g.query, sum(g.impressions) impressions, sum(g.clicks) clicks, f.first from g join (select query, min(day) first from public.gsc_daily group by query having min(day) >= greatest(last - 6, v_a)) f on f.query = g.query
        group by g.query, f.first order by 2 desc limit 25) x), '[]'),$a$,
  $a$'empty', false, 'last_day', last,$a$,
  $a$'empty', false, 'data_from', least(t_first, d_first),
    'type_rows', coalesce((select jsonb_object_agg(type, i) from (select type, sum(impressions) i from public.gsc_search_type where day >= v_a and day <= last group by 1) x), '{}'),
    'type_rows_from', (select min(day) from public.gsc_search_type),
    'exact_dims', case when flt then null else jsonb_build_object(
      'days', (select count(distinct day) from public.gsc_dims where day between v_a and last),
      'pages', coalesce((select jsonb_agg(x) from (select d.val page, sum(d.clicks) clicks, sum(d.impressions) impressions, sum(d.position * d.impressions) / nullif(sum(d.impressions), 0) pos,
          coalesce((select sum(p.clicks) from public.gsc_dims p where p.dim = 'page' and p.val = d.val and p.day >= v_pa and p.day < v_a), 0) prev_clicks
        from public.gsc_dims d where d.dim = 'page' and d.day between v_a and last group by d.val order by 2 desc, 3 desc limit 60) x), '[]'),
      'countries', coalesce((select jsonb_agg(x) from (select d.val k, sum(d.clicks) clicks, sum(d.impressions) impressions from public.gsc_dims d where d.dim = 'country' and d.day between v_a and last group by 1 order by 2 desc, 3 desc limit 30) x), '[]'),
      'devices', coalesce((select jsonb_agg(x) from (select d.val k, sum(d.clicks) clicks, sum(d.impressions) impressions from public.gsc_dims d where d.dim = 'device' and d.day between v_a and last group by 1 order by 2 desc) x), '[]')) end,
    'last_day', last,$a$]);

select pg_temp.patch('public.admin_articles(integer)', array[
  $a$lang, '?'), 2) lg, session
$a$, $a$lang, '?'), 2) lg, session, created_at
$a$,
  $a$select distinct session from public.events_real where name = 'app_open' and created_at >= now() - make_interval(days => k)$a$,
  $a$select session, max(created_at) last_at from public.events_real where name = 'app_open' and created_at >= now() - make_interval(days => k) group by 1$a$,
  $a$filter (where ap.session is not null) to_app$a$, $a$filter (where ap.last_at >= v.created_at) to_app$a$,
  $a$from public.gsc_daily where page ~ '/(tudastar|learn)/[^/?#]+' and day > public.admin_today() - k group by 1, 2$a$,
  $a$from (select val page, clicks, impressions from public.gsc_dims where dim = 'page' and day > public.admin_today() - k
        union all select d.page, d.clicks, d.impressions from public.gsc_daily d where d.day > public.admin_today() - k and not exists (select 1 from public.gsc_dims x where x.dim = 'page' and x.day = d.day)) s
      where page ~ '/(tudastar|learn)/[^/?#]+' group by 1, 2$a$,
  $a$'langs', coalesce($a$,
  $a$'gsc_exact', exists (select 1 from public.gsc_dims where dim = 'page' and day > public.admin_today() - k),
    'cover', (select jsonb_build_object('rows_clicks', (select coalesce(sum(clicks), 0) from public.gsc_daily where day > public.admin_today() - k), 'total_clicks', (select coalesce(sum(clicks), 0) from public.gsc_totals where type = 'web' and day > public.admin_today() - k))),
    'langs', coalesce($a$]);

select pg_temp.patch('public.admin_gsc_index()', array[
  $a$'sitemaps', coalesce($a$,
  $a$'in_sitemap', (select max(in_sitemap) from public.gsc_sitemaps),
    'never', greatest(0, coalesce((select max(in_sitemap) from public.gsc_sitemaps), 0) - (select count(*) from public.gsc_index)),
    'age', (select jsonb_build_object('d1', count(*) filter (where checked_at > now() - interval '36 hours'), 'd3', count(*) filter (where checked_at <= now() - interval '36 hours' and checked_at > now() - interval '3 days'),
      'd7', count(*) filter (where checked_at <= now() - interval '3 days' and checked_at > now() - interval '7 days'), 'older', count(*) filter (where checked_at <= now() - interval '7 days'), 'oldest', min(checked_at)) from public.gsc_index),
    'per_day', (select round(avg(x.rows)) from (select l.rows from public.sync_log l where l.source = 'gsc_index' and l.ok order by l.at desc limit 7) x),
    'rechecked', greatest(0, coalesce((select sum(l.rows) from public.sync_log l where l.source = 'gsc_index' and l.ok), 0) - (select count(*) from public.gsc_index)),
    'last_note', (select left(l.message, 200) from public.sync_log l where l.source = 'gsc_index' order by l.at desc limit 1),
    'sitemaps', coalesce($a$]);

select pg_temp.patch('public.admin_gsc_page(text,integer)', array[
  $a$'views', (select count(*)$a$,
  $a$'exact', (select case when count(*) > 0 then jsonb_build_object('clicks', sum(clicks), 'impressions', sum(impressions), 'pos', sum(position * impressions) / nullif(sum(impressions), 0)) end from public.gsc_dims where dim = 'page' and val = p_page and day >= v_a),
    'cover', jsonb_build_object('rows_clicks', (select coalesce(sum(clicks), 0) from public.gsc_daily where day >= v_a), 'rows_impressions', (select coalesce(sum(impressions), 0) from public.gsc_daily where day >= v_a),
      'total_clicks', (select coalesce(sum(clicks), 0) from public.gsc_totals where type = 'web' and day >= v_a), 'total_impressions', (select coalesce(sum(impressions), 0) from public.gsc_totals where type = 'web' and day >= v_a)),
    'views', (select count(*)$a$]);

select pg_temp.patch('public.admin_ranks(integer)', array[
  $a$'suggest', coalesce($a$,
  $a$'cover', jsonb_build_object('rows_clicks', (select coalesce(sum(clicks), 0) from public.gsc_daily where day >= public.admin_today() - 28), 'rows_impressions', (select coalesce(sum(impressions), 0) from public.gsc_daily where day >= public.admin_today() - 28),
      'total_clicks', (select coalesce(sum(clicks), 0) from public.gsc_totals where type = 'web' and day >= public.admin_today() - 28), 'total_impressions', (select coalesce(sum(impressions), 0) from public.gsc_totals where type = 'web' and day >= public.admin_today() - 28)),
    'suggest', coalesce($a$]);

-- the page speed list: the most clicked articles by Google's page totals when they are there
create or replace function public.admin_r_cwv_urls(p_token text)
 returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.gsc_dims where dim = 'page') then
    return coalesce((select jsonb_agg(page) from (select val page from public.gsc_dims where dim = 'page' and day > public.admin_today() - 28 and val like 'https://inkage.app/tudastar/%' group by 1 order by sum(clicks) desc, sum(impressions) desc limit 3) x), '[]');
  end if;
  return coalesce((select jsonb_agg(page) from (select page from public.gsc_daily where day > public.admin_today() - 28 and page like 'https://inkage.app/tudastar/%' group by 1 order by sum(clicks) desc, sum(impressions) desc limit 3) x), '[]');
end $f$;

-- ---------- SEO ----------
select pg_temp.patch('public.admin_seo(integer)', array[
  $a$'days', k,$a$,
  $a$'days', k,
    'in_sitemap', (select max(in_sitemap) from public.gsc_sitemaps),
    'cannibal_any', (select count(*) from (select query from public.gsc_daily where day > public.admin_today() - k group by 1 having count(distinct page) > 1) x),
    'cover', jsonb_build_object('rows_impressions', (select coalesce(sum(impressions), 0) from public.gsc_daily where day > public.admin_today() - k), 'total_impressions', (select coalesce(sum(impressions), 0) from public.gsc_totals where type = 'web' and day > public.admin_today() - k)),$a$]);

select pg_temp.patch('public.admin_seo_week()', array[
  $a$'uptime', (select round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 2) from public.uptime_checks where done and at > now() - interval '7 days'));$a$,
  -- the same rule as Monitoring: a failed database probe counts as up when the server's own check reached the address within 3 minutes
  $a$'uptime', (select round(100.0 * count(*) filter (where u.ok or exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes')) / nullif(count(*), 0), 2) from public.uptime_checks u where u.done and u.via = 'pg_net' and u.at > now() - interval '7 days'));$a$]);

select pg_temp.patch('public.admin_seo_alerts()', array[
  $a$for r in select target from public.uptime_checks where done and not ok and at > now() - interval '15 minutes' group by target having count(*) >= 2 loop$a$,
  $a$for r in select u.target from public.uptime_checks u where u.done and not u.ok and u.via = 'pg_net' and u.at > now() - interval '15 minutes'
      and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes') group by u.target having count(*) >= 2 loop$a$,
  $a$'Az utolsó két ellenőrzés hibát adott.'$a$, $a$'15 percen belül két ellenőrzés is hibát adott, és a szerver saját mérése sem érte el.'$a$]);

-- ---------- Stores ----------
select pg_temp.patch('public.admin_stores(integer)', array[
  $a$'days', v_days,$a$,
  $a$'days', v_days,
    'read', jsonb_build_object(
      'apple', (select jsonb_build_object('at', l.at, 'ok', l.ok, 'source', l.source, 'message', left(l.message, 200)) from public.sync_log l where l.source in ('apple', 'apple_keys') order by l.at desc limit 1),
      'google', (select jsonb_build_object('at', l.at, 'ok', l.ok, 'source', l.source, 'message', left(l.message, 200)) from public.sync_log l where l.source in ('google', 'google_keys') order by l.at desc limit 1)),$a$,
  $a$where source in ('apple', 'google', 'apple_reviews',$a$, $a$where source in ('apple', 'google', 'apple_keys', 'google_keys', 'apple_reviews',$a$]);

-- ---------- Brand ----------
select pg_temp.patch('public.admin_brand()', array[
  $a$'unseen', (select count(*)$a$,
  $a$'sources', coalesce((select jsonb_agg(to_jsonb(s) order by s.source) from public.brand_sources s), '[]'),
    'watch_at', (select max(l.at) from public.sync_log l where l.source = 'watch' and l.ok),
    'unseen', (select count(*)$a$]);

-- ---------- Connections: what each source really brought ----------
select pg_temp.patch('public.admin_connections()', array[
  $a$jsonb_build_object('ok_at', ok_at, 'err_at', err_at, 'err', err, 'last_ok', last_ok, 'unconnected', unconnected)$a$,
  $a$jsonb_build_object('ok_at', ok_at, 'err_at', err_at, 'err', err, 'last_ok', last_ok, 'unconnected', unconnected, 'rows', last_rows, 'msg', last_msg)$a$,
  $a$(array_agg(ok order by at desc))[1] last_ok$a$,
  $a$(array_agg(ok order by at desc))[1] last_ok, (array_agg(rows order by at desc) filter (where ok))[1] last_rows, (array_agg(left(message, 200) order by at desc) filter (where ok))[1] last_msg$a$,
  $a$'tests', coalesce($a$,
  $a$'brand_sources', coalesce((select jsonb_agg(to_jsonb(s) order by s.source) from public.brand_sources s), '[]'),
    'tests', coalesce($a$]);

-- ---------- Monitoring ----------
select pg_temp.patch('public.admin_monitor()', array[
  $a$'failing', public.admin_jobs_failing(),$a$,
  $a$'failing', public.admin_jobs_failing(),
    'source_problems', public.admin_source_problems(),
    /* single failed checks of 30 days that did not count as an outage, because the other kind of check reached the address */
    'probe_single', jsonb_build_object(
      'pg_net', (select count(*) from public.uptime_checks u where u.via = 'pg_net' and u.done and not u.ok and u.at > now() - interval '30 days' and exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes')),
      'server', (select count(*) from public.uptime_checks u where u.via = 'server' and u.done and not u.ok and u.at > now() - interval '30 days')),$a$,
  /* per job its last 6 runs that did something (or failed), not the last 60 rows of everything */
  $a$r.started_at, r.finished_at, r.ok, left(r.message, 300) message from public.admin_runs r
        where r.job not like '%only=rules%' or r.ok = false order by r.started_at desc limit 60) x), '[]'),$a$,
  $a$r.started_at, r.finished_at, r.ok, left(r.message, 300) message from (select a.*, row_number() over (partition by a.job order by a.started_at desc) rn from public.admin_runs a
          where a.ok is distinct from true or (a.job not like '%only=rules%' and coalesce(a.message, '') !~ '(^email: nem most|^n: 0)')) r
        where r.rn <= 6 order by r.started_at desc limit 80) x), '[]'),$a$,
  $a$(array_agg(rows order by at desc) filter (where ok))[1] last_rows
      from public.sync_log$a$,
  $a$(array_agg(rows order by at desc) filter (where ok))[1] last_rows, (array_agg(left(message, 200) order by at desc) filter (where ok))[1] last_msg
      from public.sync_log$a$,
  $a$from public.admin_runs where ok = false and started_at > now() - interval '14 days' group by 1, 2) x), '[]'),$a$,
  $a$from public.admin_runs where ok = false and started_at > now() - interval '14 days' group by 1, 2
      union all
      select 'hívás: ' || path, left(coalesce(error, case when timed_out then 'időtúllépés' when status is not null then 'HTTP ' || status end, 'nincs válasz'), 300), count(*), max(at), min(at)
        from public.admin_cron_calls where done and at > now() - interval '14 days' and (timed_out or status is null or status not between 200 and 299) group by 1, 2) x), '[]'),$a$]);

select pg_temp.patch('public.admin_selfcheck()', array[
  -- a difference counts both ways: more posts here than on the platform is a mismatch too
  $a$'ok', r.posts is null or r.held >= least(r.posts, 300), 'note', 'a platform szerint / nálunk');$a$,
  $a$'ok', r.posts is null or r.held = r.posts or (r.posts >= 300 and r.held >= 300),
      'note', case when r.held > r.posts then 'nálunk több van, mint a platformon: eltűnt posztok is számítanak' when r.held < r.posts then 'nálunk kevesebb van, mint a platformon' else 'a platform szerint / nálunk' end);$a$,
  $a$  return out;$a$,
  $a$  select count(*) into direct from public.seo_pages;
  rolled := (select max(in_sitemap) from public.gsc_sitemaps);
  if rolled is not null then
    out := out || jsonb_build_object('k', 'seo_cover', 'what', 'SEO-bejárás lefedettsége', 'expected', rolled, 'found', direct, 'ok', direct >= rolled * 0.9, 'note', 'a sitemap címei / bejárt oldal');
    select count(*) into direct from public.gsc_index;
    out := out || jsonb_build_object('k', 'index_cover', 'what', 'Google-indexelés lefedettsége', 'expected', rolled, 'found', direct, 'ok', direct >= rolled * 0.9, 'note', 'a sitemap címei / legalább egyszer ellenőrzött cím');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', 'src_' || (p->>'k'), 'what', split_part(p->>'t', ':', 1), 'expected', 'valódi adat', 'found', 'nincs vagy hiányos', 'ok', false, 'note', p->>'t')), '[]') into bad
    from jsonb_array_elements(public.admin_source_problems()) p;
  out := out || bad;
  return out;$a$]);

select pg_temp.patch('public.admin_r_health(text)', array[
  $a$return jsonb_build_object('problems', out, 'at', now(),$a$,
  $a$return jsonb_build_object('problems', out, 'standing', public.admin_source_problems(), 'at', now(),$a$]);

-- the morning e-mail counts as sent only when a run says so: the runs every 30 minutes ("nem most") also finish "ok"
select pg_temp.patch('public.admin_r_push_system(text)', array[
  $a$and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and started_at > ((dday + time '06:00') at time zone 'UTC')),$a$,
  $a$and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and message ~ 'email: elküldve' and started_at >= (dday::timestamp at time zone tz)),$a$]);

select pg_temp.patch('public.admin_system_alerts()', array[
  $a$and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and started_at > date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then$a$,
  $a$and not exists (select 1 from public.admin_runs where job = '/api/admin/digest' and ok and message ~ 'email: elküldve' and started_at > date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then$a$,
  $a$  return out;$a$,
  $a$  if exists (select 1 from public.cert_status where domain_expires is null) then
    out := out || jsonb_build_object('c', 'warn', 't', 'A domain lejárati dátuma nem ismert', 's', 'A napi lekérdezés nem kapott dátumot, így a „Lejár a domain” jelzés nem tud szólni. Nézd meg a domain regisztrátoránál.', 'to', 'monitor');
  end if;
  return out;$a$]);

-- ---------- the stores' parts, part by part (the keys arrived during this work: App Store reads, Play's installs answer 403) ----------
select pg_temp.patch('public.admin_source_problems()', array[
  $a$  select l.rows, l.message into r from public.sync_log l where l.source = 'bing' order by l.at desc limit 1;$a$,
  $a$  select l.ok, l.message into r from public.sync_log l where l.source = 'apple_sales' order by l.at desc limit 1;
  if found and not r.ok then out := out || jsonb_build_object('k', 'apple', 't', 'App Store: a letöltésszámok nem jönnek (' || left(coalesce(r.message, ''), 120) || ').'); end if;
  select l.ok, l.message into r from public.sync_log l where l.source = 'google_installs' order by l.at desc limit 1;
  if found and not r.ok then out := out || jsonb_build_object('k', 'google', 't', 'Google Play: a telepítésszámok nem jönnek' || case when r.message ~ 'storage\.objects' then ': a szolgáltatásfióknak nincs joga a jelentések tárhelyéhez. Teendő: Play Console → Users and permissions → View financial data (a jog akár 24 óra múlva él).' else ' (' || left(coalesce(r.message, ''), 120) || ').' end); end if;
  select l.ok, l.message into r from public.sync_log l where l.source = 'google_quality' order by l.at desc limit 1;
  if found and not r.ok then out := out || jsonb_build_object('k', 'google_quality', 't', 'Google Play: az összeomlási adatok nem jönnek (' || left(coalesce(r.message, ''), 100) || ').'); end if;
  select l.rows, l.message into r from public.sync_log l where l.source = 'bing' order by l.at desc limit 1;$a$]);

-- ======================================== from Calligra 20270101_admin_true_leftovers
-- The last of docs/admin-adathibak-2026-11-01.md: the same definitions in the functions the page-by-page work did not own.
-- A save is not a share; a post the live account no longer shows is not counted as held; the shared investor/press report
-- leaves out the owner's own accounts and names the real product number.
do $$
declare f record; d text; n text;
begin
  for f in select * from (values
    ('public.admin_links()', $a$'share_open','share_save','share_video','reveal_share'$a$, $b$'share_open','share_video','reveal_share'$b$),
    ('public.admin_day_replay(date)', $a$'share_open', 'share_save', 'share_video', 'reveal_share'$a$, $b$'share_open', 'share_video', 'reveal_share'$b$),
    ('public.admin_selfcheck()', $a$where p.platform = a.platform) held$a$, $b$where p.platform = a.platform and p.gone_at is null) held$b$),
    ('public.admin_connections()', $a$from public.social_posts p where p.platform = a.platform)))$a$, $b$from public.social_posts p where p.platform = a.platform and p.gone_at is null)))$b$),
    ('public.public_report(text)', $a$'share_open','share_save','share_video','reveal_share'$a$, $b$'share_open','share_video','reveal_share'$b$),
    ('public.public_report(text)', $a$'accounts', (select count(*) from auth.users),$a$, $b$'accounts', (select count(*) from public.admin_real_users),
      'signatures', (select count(*) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),
      'signature_accounts', (select count(distinct c.user_id) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)),$b$),
    ('public.public_report(text)', $a$count(*) n from auth.users group by 1$a$, $b$count(*) n from public.admin_real_users group by 1$b$)
  ) v(fn, a, b) loop
    d := pg_get_functiondef(f.fn::regprocedure);
    if position(f.a in d) = 0 then raise exception 'not found in %: %', f.fn, f.a; end if;
    n := replace(d, f.a, f.b);
    execute n;
  end loop;
end $$;

-- ======================================== from Calligra 20270102_admin_gsc_exact_countries
-- Now that gsc_dims holds Google's exact per-country and per-page totals, Markets and Home read those instead of the
-- query rows that hide most clicks; a page's clicks include its ?lang= versions.
do $$
declare f record; d text; n text;
begin
  for f in select * from (values
    ('public.admin_markets_i(integer)', $a$select country k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where day > coalesce(last, public.admin_today()) - v_days group by 1$a$, $b$select val k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_dims where dim = 'country' and day > coalesce(last, public.admin_today()) - v_days group by 1$b$),
    ('public.admin_markets_i(integer)', $a$coalesce(sum(impressions), 0)) from public.gsc_daily where day > coalesce(last, public.admin_today()) - v_days)$a$, $b$coalesce(sum(impressions), 0)) from public.gsc_dims where dim = 'country' and day > coalesce(last, public.admin_today()) - v_days)$b$),
    ('public.admin_home_extra(integer)', $a$'detail_clicks', (select coalesce(sum(clicks), 0) from public.gsc_daily where day between a - glag and today - glag)$a$, $b$'detail_clicks', (select coalesce(sum(clicks), 0) from public.gsc_dims where dim = 'country' and day between a - glag and today - glag)$b$),
    ('public.admin_home_extra(integer)', $a$select country k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_daily where day between a - glag and today - glag group by 1$a$, $b$select val k, sum(clicks) clicks, sum(impressions) impressions from public.gsc_dims where dim = 'country' and day between a - glag and today - glag group by 1$b$),
    ('public.admin_home_extra(integer)', $a$from public.gsc_daily g where g.page like '%' || e2.pg and g.day between a - glag and today - glag$a$, $b$from public.gsc_dims g where g.dim = 'page' and split_part(g.val, '?', 1) like '%' || e2.pg and g.day between a - glag and today - glag$b$)
  ) v(fn, a, b) loop
    d := pg_get_functiondef(f.fn::regprocedure);
    if position(f.a in d) = 0 then raise exception 'not found in %: %', f.fn, f.a; end if;
    n := replace(d, f.a, f.b);
    execute n;
  end loop;
end $$;

-- ======================================== from Calligra 20270103_admin_gone_posts_lists
-- Lists of current posts leave out the ones the live account no longer shows (social_posts.gone_at): a channel's posts, the
-- link picker, the best post of the digest, the weekly and evening top posts, the news pushes. What really happened stays:
-- the day replay, spikes, day gains, the report's history and the pairing of visits and titles still read every post.
do $$
declare f record; d text; n text;
begin
  for f in select * from (values
    ('public.admin_channel_detail_i(text,integer,timestamp with time zone,timestamp with time zone,text)', $a$from public.social_posts q where q.platform = any(string_to_array(p_ch, ','))$a$, $b$from public.social_posts q where q.gone_at is null and q.platform = any(string_to_array(p_ch, ','))$b$),
    ('public.admin_links_detail_i(integer)', $a$from public.social_posts p) y where rn <= 60$a$, $b$from public.social_posts p where p.gone_at is null) y where rn <= 60$b$),
    ('public.admin_digest_data()', $a$from public.social_posts p join public.social_post_daily d on d.platform = p.platform and d.post_id = p.post_id and d.day = d1 - 1$a$, $b$from public.social_posts p join public.social_post_daily d on d.platform = p.platform and d.post_id = p.post_id and d.day = d1 - 1 and p.gone_at is null$b$),
    ('public.admin_r_digest_extra(text)', $a$from public.social_posts where created_at > now() - interval '7 days'$a$, $b$from public.social_posts where gone_at is null and created_at > now() - interval '7 days'$b$),
    ('public.admin_r_evening(text)', $a$from public.social_posts p where p.created_at >= t0 order by$a$, $b$from public.social_posts p where p.gone_at is null and p.created_at >= t0 order by$b$),
    ('public.admin_r_push_news(text)', $a$from public.social_posts where created_at > now() - interval '60 days'$a$, $b$from public.social_posts where gone_at is null and created_at > now() - interval '60 days'$b$)
  ) v(fn, a, b) loop
    d := pg_get_functiondef(f.fn::regprocedure);
    if position(f.a in d) = 0 then raise exception 'not found in %: %', f.fn, f.a; end if;
    n := replace(d, f.a, f.b);
    execute n;
  end loop;
end $$;

-- ======================================== from Calligra 20270104_admin_bing_note
-- The Bing warning told her to check the verification even though the site is verified: Bing just gives no data yet.
do $$
declare d text; a text := 'Bing: a lehúzás lefut, de nem jön adat (0 sor). Nézd meg a Bing Webmaster Toolsban, hogy az inkage.app igazolva van-e.';
begin
  d := pg_get_functiondef('public.admin_source_problems()'::regprocedure);
  if position(a in d) = 0 then raise exception 'text not found'; end if;
  execute replace(d, a, 'Bing: a lehúzás lefut, de a Bing még nem ad adatot (0 sor). Az inkage.app igazolva van; a Bing a saját ütemében indexel.');
end $$;

-- ======================================== from Calligra 20270110_admin_phone_base
-- The phone view's own saved settings (pins, bottom tabs, Teendők marks and routine) follow her to every device.
-- Additive: the keys the live old screens use keep working, and any key starting with phone_ is accepted too.
create or replace function public.admin_setting_get(p_k text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_k not in ('views', 'tv', 'approvals', 'home_layout', 'pay_goal') and left(p_k, 6) <> 'phone_' then raise exception 'unknown setting'; end if;
  return (select v from public.admin_settings where k = p_k);
end $function$;

create or replace function public.admin_setting_save(p_k text, p_v jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_k not in ('views', 'tv', 'approvals', 'home_layout', 'pay_goal') and left(p_k, 6) <> 'phone_' then raise exception 'unknown setting'; end if;
  if length(coalesce(p_v, 'null')::text) > 8000 then raise exception 'too long'; end if;
  insert into public.admin_settings (k, v) values (p_k, coalesce(p_v, '{}')) on conflict (k) do update set v = excluded.v, updated_at = now();
end $function$;

-- ======================================== from Calligra 20270111_admin_phone_ma
-- The phone's Ma tab. Additive: new readers only, and one new column on the push log. The live old screens are untouched.

-- today so far against the same moment yesterday and a week ago, by the Budapest clock (a clock-change day stays right);
-- with her own accounts and sessions apart; what is unusual today.
create or replace function public.admin_ma_compare(p_ch text default null, p_lang text default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  tz constant text := 'Europe/Budapest';
  loc timestamp := now() at time zone tz;
  d0 timestamp := date_trunc('day', loc);
  t0 timestamptz := d0 at time zone tz;
  plain boolean := p_ch is null and p_lang is null;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'at', now(), 'hour', to_char(loc, 'HH24:MI'),
    'today', public.admin_period(t0, now(), p_ch, p_lang),
    'yest', public.admin_period((d0 - interval '1 day') at time zone tz, (loc - interval '1 day') at time zone tz, p_ch, p_lang),
    'week', public.admin_period((d0 - interval '7 days') at time zone tz, (loc - interval '7 days') at time zone tz, p_ch, p_lang),
    'yest_all', public.admin_period((d0 - interval '1 day') at time zone tz, t0, p_ch, p_lang),
    'week_all', public.admin_period((d0 - interval '7 days') at time zone tz, (d0 - interval '6 days') at time zone tz, p_ch, p_lang),
    -- "what would the number be with her own": accounts and signatures from the same tables, sessions from the marked list
    'own', case when plain then jsonb_build_object(
      'made', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= t0 and public.admin_own_uid(c.user_id)),
      'signups', (select count(*) from auth.users u where u.created_at >= t0) - (select count(*) from public.admin_real_users r where r.created_at >= t0),
      'sessions', (select count(distinct e.session) from public.events e join public.admin_own_sessions o on o.session = e.session where e.created_at >= t0)) end,
    'unusual', case when plain then public.admin_ma_unusual() else '[]'::jsonb end);
end $$;

-- three plain checks, each with its reason; an estimate, and the screen says so
create or replace function public.admin_ma_unusual()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare t0 timestamptz := public.admin_today()::timestamp at time zone 'Europe/Budapest'; h0 timestamptz := t0 - interval '14 days'; out_ jsonb := '[]';
  x record; tot numeric; tot14 numeric; bots int; bots14 numeric; hmax int; hat timestamptz; havg numeric;
begin
  -- a language suddenly much stronger than in the last two weeks (events keep no country: the language is the nearest thing)
  select count(distinct session) into tot from public.events_real where created_at >= t0 and session is not null;
  select count(distinct session) into tot14 from public.events_real where created_at >= h0 and created_at < t0 and session is not null;
  if tot >= 8 then
    for x in select left(lang, 2) k, count(distinct session) n from public.events_real where created_at >= t0 and session is not null and lang is not null group by 1 having count(distinct session) >= 5 loop
      declare s14 numeric := (select count(distinct session) from public.events_real where created_at >= h0 and created_at < t0 and session is not null and left(lang, 2) = x.k);
      begin
        if x.n / tot >= 0.3 and x.n / tot >= 3 * (s14 / greatest(tot14, 1)) then
          out_ := out_ || jsonb_build_object('k', 'lang:' || x.k, 'lang', x.k, 'n', x.n, 'share', round(x.n / tot * 100), 'usual', round(s14 / greatest(tot14, 1) * 100));
        end if;
      end;
    end loop;
  end if;
  -- many visits already sorted out as machines
  select count(distinct e.session) into bots from public.events e join public.admin_bot_sessions b on b.session = e.session where e.created_at >= t0;
  select count(distinct e.session) / 14.0 into bots14 from public.events e join public.admin_bot_sessions b on b.session = e.session where e.created_at >= h0 and e.created_at < t0;
  if bots >= 20 and bots >= 3 * bots14 then out_ := out_ || jsonb_build_object('k', 'bots', 'n', bots, 'usual', round(bots14)); end if;
  -- one hour of the last day far above the usual hour
  select count(distinct session), date_trunc('hour', created_at) into hmax, hat from public.events_real where created_at >= now() - interval '24 hours' and session is not null group by 2 order by 1 desc limit 1;
  havg := tot14 / (14 * 24.0);
  if hmax >= 10 and hmax >= 5 * greatest(havg, 1) then out_ := out_ || jsonb_build_object('k', 'hour', 'n', hmax, 'at', hat, 'usual', round(havg, 1)); end if;
  return out_;
end $$;
revoke all on function public.admin_ma_unusual() from public, anon, authenticated;

-- the day as a timeline: accounts (never who), signatures per hour, posts, notes, releases, what went to the phone (comments only as a count)
create or replace function public.admin_ma_feed(p_days integer default 3)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare a timestamptz := (public.admin_today() - greatest(0, least(coalesce(p_days, 3), 14) - 1))::timestamp at time zone 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select * from (
      select date_trunc('hour', u.created_at) as at, 'signup' kind, count(*)::text t, null::text s, 'users' "to" from public.admin_real_users u where u.created_at >= a group by 1
      union all select date_trunc('hour', c.created_at), 'made', count(*)::text, null, 'product' from public.admin_ink_made c where c.ok and c.created_at >= a and not public.admin_own_uid(c.user_id) group by 1
      union all select p.created_at, 'post', p.platform, left(p.title, 90), 'social' from public.social_posts p where p.created_at >= a and p.gone_at is null
      union all select (n.day::timestamp + interval '12 hours') at time zone 'Europe/Budapest', 'note', n.kind, left(n.text, 120), 'goals' from public.admin_notes n where n.day >= (a at time zone 'Europe/Budapest')::date
      union all select distinct date_trunc('hour', r.at), 'release', null, null, 'monitor' from public.admin_releases r where r.at >= a
      union all select s.at, 'push', s.kind, left(s.title, 90), case s.kind when 'rising' then 'social' when 'record' then 'product' when 'index' then 'search' when 'account' then 'connect' when 'errors' then 'system' else 'monitor' end from public.admin_push_sent s where s.at >= a and s.kind in ('rising', 'viral', 'record', 'milestone', 'errors', 'sigfail', 'account', 'index', 'myrule', 'heartbeat')
      union all select date_trunc('hour', s.at), 'inbox', count(*)::text, null, 'inbox' from public.admin_push_sent s where s.at >= a and s.kind = 'inbox' group by 1
    ) y order by y.at desc limit 80) x), '[]');
end $$;

-- "ezt a 41-et mutasd soronként": the rows behind a number of one day, same counting as the number. Never an e-mail or a name.
-- Visits stay anonymous: no account and no session id goes out with them.
create or replace function public.admin_ma_rows(p_metric text, p_day date default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare tz constant text := 'Europe/Budapest'; dy date := coalesce(p_day, public.admin_today());
  a timestamptz := dy::timestamp at time zone tz; b timestamptz := (dy + 1)::timestamp at time zone tz; r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_metric = 'made' then
    select coalesce(jsonb_agg(x order by x.at desc), '[]') into r from (select c.created_at as at, c.style, c.user_id id from public.admin_ink_made c where c.ok and c.created_at >= a and c.created_at < b and not public.admin_own_uid(c.user_id) order by 1 desc limit 300) x;
  elsif p_metric = 'signups' then
    select coalesce(jsonb_agg(x order by x.at desc), '[]') into r from (select u.created_at as at, u.raw_app_meta_data->>'provider' provider, u.id from public.admin_real_users u where u.created_at >= a and u.created_at < b order by 1 desc limit 300) x;
  elsif p_metric in ('sessions', 'shared', 'saved') then
    select coalesce(jsonb_agg(x order by x.at desc), '[]') into r from (
      select min(e.created_at) as at, left(max(e.lang), 2) lang, (select s.ch from public.admin_sess_attr s where s.session = e.session) ch, count(*) events, (array_agg(e.name order by e.created_at desc))[1] last_ev
      from public.events_real e where e.created_at >= a and e.created_at < b and e.session is not null
        and (p_metric = 'sessions' or (p_metric = 'shared' and e.session in (select z.session from public.events_real z where z.created_at >= a and z.created_at < b and z.name in ('share_open', 'share_video', 'reveal_share')))
          or (p_metric = 'saved' and e.session in (select z.session from public.events_real z where z.created_at >= a and z.created_at < b and z.name in ('share_save', 'save_done'))))
      group by e.session order by 1 desc limit 300) x;
  else raise exception 'unknown metric'; end if;
  return jsonb_build_object('metric', p_metric, 'day', dy, 'rows', r);
end $$;

-- what the notifications need beyond the existing readers. Token-gated like its neighbours.
create or replace function public.admin_r_ma_push(p_token text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare tz constant text := 'Europe/Budapest'; loc timestamp := now() at time zone tz; td date := loc::date;
  t0 timestamptz := td::timestamp at time zone tz; h int := extract(hour from loc); dw int := extract(isodow from loc);
  r jsonb; wk0 date := td - dw + 1;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  r := jsonb_build_object('hour', h, 'dow', dw, 'day', td, 'week', wk0,
    'cfg', coalesce((select v from public.admin_settings where k = 'phone_push'), '{}'),
    'rules', coalesce((select v from public.admin_settings where k = 'phone_push_rules'), '[]'),
    'users', (select count(*) from public.admin_real_users), 'users_24h', (select count(*) from public.admin_real_users where created_at > now() - interval '24 hours'),
    'made', (select count(*) from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)), 'made_24h', (select count(*) from public.admin_ink_made c where c.ok and c.created_at > now() - interval '24 hours' and not public.admin_own_uid(c.user_id)),
    'first_paid', (select min(p.created_at) from public.purchases p where not public.admin_own_uid(p.user_id)),
    'sig_bad_1h', (select count(*) from public.admin_ink_made c where not c.ok and c.created_at > now() - interval '1 hour' and not public.admin_own_uid(c.user_id)),
    'sig_all_1h', (select count(*) from public.admin_ink_made c where c.created_at > now() - interval '1 hour' and not public.admin_own_uid(c.user_id)),
    'today', jsonb_build_object(
      'made', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= t0 and not public.admin_own_uid(c.user_id)),
      'signups', (select count(*) from public.admin_real_users where created_at >= t0),
      'sessions', (select count(distinct session) from public.events_real where created_at >= t0 and session is not null),
      'paying', (select count(distinct p.user_id) from public.purchases p where p.created_at >= t0 and not public.admin_own_uid(p.user_id))),
    'payments_live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false));
  -- yesterday for the morning sentence, last week for Monday's: only in the hours they are used
  if h between 6 and 10 then
    r := r || jsonb_build_object('yest', jsonb_build_object(
      'made', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= (td - 1)::timestamp at time zone tz and c.created_at < t0 and not public.admin_own_uid(c.user_id)),
      'signups', (select count(*) from public.admin_real_users where created_at >= (td - 1)::timestamp at time zone tz and created_at < t0),
      'sessions', (select count(distinct session) from public.events_real where created_at >= (td - 1)::timestamp at time zone tz and created_at < t0 and session is not null)));
    if dw = 1 then r := r || jsonb_build_object('last_week', jsonb_build_object(
      'made', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= (wk0 - 7)::timestamp at time zone tz and c.created_at < wk0::timestamp at time zone tz and not public.admin_own_uid(c.user_id)),
      'made_prev', (select count(*) from public.admin_ink_made c where c.ok and c.created_at >= (wk0 - 14)::timestamp at time zone tz and c.created_at < (wk0 - 7)::timestamp at time zone tz and not public.admin_own_uid(c.user_id)),
      'signups', (select count(*) from public.admin_real_users where created_at >= (wk0 - 7)::timestamp at time zone tz and created_at < wk0::timestamp at time zone tz),
      'sessions', (select count(distinct session) from public.events_real where created_at >= (wk0 - 7)::timestamp at time zone tz and created_at < wk0::timestamp at time zone tz and session is not null))); end if;
  end if;
  return r;
end $$;
-- the scheduled run calls with the public key and its token: anon must be able to knock, the token gate decides (as admin_r_push_system)
revoke all on function public.admin_r_ma_push(text) from public;
grant execute on function public.admin_r_ma_push(text) to anon, authenticated, service_role;
-- the same reason: these two could not be called by the scheduled run, so the 21:00 summary never went out and batching never saw its last wake
grant execute on function public.admin_r_evening(text) to anon;
grant execute on function public.admin_r_push_wake(text) to anon;

-- "Kész" from a notification: kept beside the notification, nothing else changes
alter table public.admin_push_sent add column if not exists acked_at timestamptz;
create or replace function public.admin_push_ack(p_kind text, p_key text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.admin_push_sent set acked_at = now() where kind = p_kind and key = p_key;
end $$;

revoke all on function public.admin_ma_compare(text, text) from public, anon;
revoke all on function public.admin_ma_feed(integer) from public, anon;
revoke all on function public.admin_ma_rows(text, date) from public, anon;
revoke all on function public.admin_push_ack(text, text) from public, anon;
grant execute on function public.admin_ma_compare(text, text) to authenticated, service_role;
grant execute on function public.admin_ma_feed(integer) to authenticated, service_role;
grant execute on function public.admin_ma_rows(text, date) to authenticated, service_role;
grant execute on function public.admin_push_ack(text, text) to authenticated, service_role;

-- ======================================== from Calligra 20270112_admin_phone_people
-- admin_people: the same list, with two more filters and counts (nomade: no finished signature; paid: has a purchase)
create or replace function public.admin_people(p_q text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_lang text DEFAULT NULL::text, p_provider text DEFAULT NULL::text, p_ch text DEFAULT NULL::text, p_sort text DEFAULT 'created'::text, p_days integer DEFAULT NULL::integer, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%'; res jsonb; r record; ranged boolean := p_days is not null or p_from is not null;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(coalesce(p_days, 0), p_from, p_to);
  with f0 as (select x.*, exists (select 1 from public.purchases b where b.user_id = x.id) paid from public.admin_user_facts() x),
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
        when p_filter = 'made' then made_ok > 0
        when p_filter = 'nomade' then made_ok = 0
        when p_filter = 'paid' then paid
        when p_filter = 'returned' then returned
        when p_filter = 'banned' then banned
        else true end
      and (p_lang is null or left(coalesce(lang, ''), 2) = left(p_lang, 2))
      and (p_provider is null or provider = p_provider)
      and (p_ch is null or coalesce(ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
  ),
  pg as (select * from f order by case p_sort when 'score' then -score when 'active' then -extract(epoch from last_active_at) when 'made' then -made_ok else -extract(epoch from created_at) end
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'own', (select count(*) from fp where own),
    'counts', (select jsonb_build_object('uj', count(*) filter (where stage = 'uj'), 'probalgatja', count(*) filter (where stage = 'probalgatja'),
        'aktiv', count(*) filter (where stage = 'aktiv'), 'veszelyben', count(*) filter (where stage = 'veszelyben'), 'alvo', count(*) filter (where stage = 'alvo'),
        'churn', count(*) filter (where churn), 'stuck', count(*) filter (where stuck), 'online', count(*) filter (where online),
        'made', count(*) filter (where made_ok > 0), 'nomade', count(*) filter (where made_ok = 0), 'paid', count(*) filter (where paid), 'returned', count(*) filter (where returned),
        'followup', count(*) filter (where follow_up is not null and follow_up <= public.admin_today()), 'banned', count(*) filter (where banned),
        'avg_score', round(avg(score))) from fp where not own),
    'tags', coalesce((select jsonb_agg(x order by x.n desc) from (select t k, count(*) n from fp, unnest(fp.tags) t where not fp.own group by 1) x), '[]'),
    'rows', coalesce((select jsonb_agg(to_jsonb(pg) || jsonb_build_object(
        'visit', public.admin_visit((select m.session from public.admin_signups_matched(pg.created_at, pg.created_at + interval '1 microsecond') m where m.user_id = pg.id limit 1)),
        'celeb', public.admin_celeb_use(pg.id))
      order by case p_sort when 'score' then -pg.score when 'active' then -extract(epoch from pg.last_active_at) when 'made' then -pg.made_ok else -extract(epoch from pg.created_at) end) from pg), '[]'))
  into res;
  return res;
end $function$;

-- The finished signatures of the given accounts (newest first, p_each each): where the image is, its style, the name
-- written, favourite or not. font_saved: older saves drawn by the engine, which have no image to show.
create or replace function public.admin_people_sigs(p_ids uuid[], p_each integer default 3)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', u.id,
      'total', (select count(*) from public.admin_ink_made c where c.user_id = u.id and c.ok and c.path is not null),
      'font_saved', (select count(*) from public.admin_ink_saved s where s.user_id = u.id and s.kind = 'font'),
      'sigs', coalesce((select jsonb_agg(x order by x.at desc) from (
        select c.path, c.style, c.name_norm nm, c.created_at at, coalesce(s.fav, false) fav
        from public.admin_ink_made c left join public.admin_ink_saved s on s.user_id = c.user_id and s.key = 'celeb:' || c.path
        where c.user_id = u.id and c.ok and c.path is not null order by c.created_at desc limit greatest(1, least(coalesce(p_each, 3), 60))) x), '[]')))
    from unnest(p_ids[1:200]) u(id)), '[]');
end $function$;

-- Two accounts that may be one person: a suggestion from what the accounts themselves hold, worked out when asked and
-- never stored. Nothing is merged or changed. strong: the same mailbox written differently.
create or replace function public.admin_people_dupes()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (with f as (
      select x.id, x.email, x.name, x.provider, x.created_at, x.made_ok, x.saved, x.last_active_at, x.score, x.stage,
        lower(split_part(x.email, '@', 2)) dom,
        regexp_replace(lower(split_part(x.email, '@', 1)), '\+.*$', '') loc,
        lower(trim(x.name)) nm
      from public.admin_user_facts() x where not x.own and x.email is not null and lower(x.email) not like '%privaterelay%'),
    g as (select f.*, case when dom in ('gmail.com', 'googlemail.com') then replace(loc, '.', '') else loc end l2, case when dom = 'googlemail.com' then 'gmail.com' else dom end d2 from f),
    pairs as (
      select a.id ai, b.id bi,
        case when a.l2 = b.l2 and a.d2 = b.d2 then 'mail' when a.l2 = b.l2 and length(a.l2) >= 5 then 'local' when a.nm = b.nm then 'name' else 'sig' end why,
        case when a.l2 = b.l2 and a.d2 = b.d2 then true else false end strong,
        (select min(c.name_norm) from public.admin_ink_made c join public.admin_ink_made e on e.name_norm = c.name_norm and e.user_id = b.id and e.ok where c.user_id = a.id and c.ok and length(c.name_norm) >= 6 and c.name_norm like '% %') sig
      from g a join g b on a.created_at < b.created_at or (a.created_at = b.created_at and a.id < b.id)
      where (a.l2 = b.l2 and a.d2 = b.d2) or (a.l2 = b.l2 and length(a.l2) >= 5) or (a.nm = b.nm and a.nm like '% %')
        or exists (select 1 from public.admin_ink_made c join public.admin_ink_made e on e.name_norm = c.name_norm and e.user_id = b.id and e.ok where c.user_id = a.id and c.ok and length(c.name_norm) >= 6 and c.name_norm like '% %'))
    select coalesce(jsonb_agg(jsonb_build_object('why', p.why, 'strong', p.strong,
        'a', (select jsonb_build_object('id', g.id, 'email', g.email, 'provider', g.provider, 'created_at', g.created_at, 'made_ok', g.made_ok, 'saved', g.saved, 'last_active_at', g.last_active_at) from g where g.id = p.ai),
        'b', (select jsonb_build_object('id', g.id, 'email', g.email, 'provider', g.provider, 'created_at', g.created_at, 'made_ok', g.made_ok, 'saved', g.saved, 'last_active_at', g.last_active_at) from g where g.id = p.bi))
      order by p.strong desc), '[]') from pairs p);
end $function$;

-- Who has paid: the purchases with their account, newest first. Empty until the payments are on.
create or replace function public.admin_payers()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select p.id, p.user_id, u.email, p.plan, p.product, p.store, p.amount, p.currency, p.created_at at
    from public.purchases p left join auth.users u on u.id = p.user_id
    where p.user_id is null or not public.admin_own_uid(p.user_id) order by p.created_at desc limit 300) x), '[]');
end $function$;

-- Sources in one row: the accounts of the period by the channel of their estimated visit, how sure that estimate is,
-- how many reached a finished signature (the account's own table) and how many paid.
create or replace function public.admin_sources_rank(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null, p_lang text default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(coalesce(p_days, 30), p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.accounts desc, x.k) from (
    select coalesce(m.ch, 'ismeretlen') k, count(*) accounts,
      count(*) filter (where m.conf = 'biztos') sure, count(*) filter (where m.conf = 'jo') good, count(*) filter (where m.conf = 'gyenge') weak,
      count(*) filter (where c.n > 0) made_accounts, coalesce(sum(c.n), 0) made,
      count(*) filter (where c.n > 0 and m.conf = 'gyenge') made_weak,
      count(*) filter (where exists (select 1 from public.purchases b where b.user_id = m.user_id)) payers
    from public.admin_signups_matched(r.a, r.b) m
    left join lateral (select count(*) n from public.admin_ink_made s where s.user_id = m.user_id and s.ok) c on true
    where p_lang is null or left(coalesce(m.lang, m.slang, ''), 2) = left(p_lang, 2)
    group by 1) x), '[]');
end $function$;

-- The posts that went out in a period (those still on the live account), to set beside a jump in the visits.
create or replace function public.admin_posts_days(p_from timestamptz, p_to timestamptz default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.at) from (
    select p.platform, p.post_id, p.title, p.url, p.created_at at, p.views from public.social_posts p
    where p.gone_at is null and p.created_at >= p_from and p.created_at < coalesce(p_to, now()) order by p.created_at limit 400) x), '[]');
end $function$;

revoke all on function public.admin_people_sigs(uuid[], integer) from public, anon;
revoke all on function public.admin_people_dupes() from public, anon;
revoke all on function public.admin_payers() from public, anon;
revoke all on function public.admin_sources_rank(integer, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.admin_posts_days(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_people_sigs(uuid[], integer) to authenticated;
grant execute on function public.admin_people_dupes() to authenticated;
grant execute on function public.admin_payers() to authenticated;
grant execute on function public.admin_sources_rank(integer, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.admin_posts_days(timestamptz, timestamptz) to authenticated;

-- ======================================== from Calligra 20270113_admin_phone_google
-- The phone's Google, stores and revenue pages. Additive: the old screens and functions keep working.
-- Tables have row level security on and no policies: only the admin-gated functions below reach them.

-- ---------- 1. Every move in or out of the index is logged ----------
-- admin_w_gsc_index keeps only the last verdict change per page, and a language version counts as in order although its
-- verdict is not PASS. The log holds each move in or out, so the news and the signals can be built from it.
create or replace function public.admin_idx_ok(p_verdict text, p_coverage text) returns boolean language sql immutable set search_path to '' as $f$
  select p_verdict = 'PASS' or coalesce(p_coverage, '') in ('Alternate page with proper canonical tag', 'Alternatív oldal megfelelő kanonikus címkével') $f$;

create table if not exists public.gsc_index_log (id bigserial primary key, url text not null, at timestamptz not null default now(), went text not null check (went in ('in', 'out')), from_coverage text, to_coverage text);
create index if not exists gsc_index_log_at on public.gsc_index_log (at desc);
alter table public.gsc_index_log enable row level security;

create or replace function public.gsc_index_track() returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.verdict is null then return new; end if; -- a check that gave no answer says nothing
  if old.verdict is not null and public.admin_idx_ok(old.verdict, old.coverage) <> public.admin_idx_ok(new.verdict, new.coverage) then
    insert into public.gsc_index_log (url, went, from_coverage, to_coverage) values (new.url, case when public.admin_idx_ok(new.verdict, new.coverage) then 'in' else 'out' end, old.coverage, new.coverage);
  end if;
  return new;
end $f$;
drop trigger if exists gsc_index_track on public.gsc_index;
create trigger gsc_index_track before update on public.gsc_index for each row execute function public.gsc_index_track();
revoke all on function public.gsc_index_track() from public, anon, authenticated;

-- ---------- 2. The daily indexing routine ----------
-- Search Console's inspection link holds an id of Google's own (a link built from the address is a 404, tried 2026-11-01);
-- the inspection answer gives the real link, so each morning check keeps it
alter table public.gsc_index add column if not exists inspect_link text;
create table if not exists public.admin_index_requests (url text primary key, requested_at timestamptz not null default now(), times integer not null default 1);
alter table public.admin_index_requests enable row level security;

-- a requested page is re-checked first two days after the request (the normal round takes ~12 days), so the result shows soon
create or replace function public.admin_r_index_queue(p_token text) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('url', g.url, 'checked_at',
      case when r.requested_at > g.checked_at and r.requested_at < now() - interval '2 days' then '1970-01-01T00:00:00Z'::timestamptz else g.checked_at end))
    from public.gsc_index g left join public.admin_index_requests r on r.url = g.url), '[]');
end $f$;

create or replace function public.admin_index_queue() returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_in_sm int := (select max(in_sitemap) from public.gsc_sitemaps);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (with g as (select i.*, r.requested_at, r.times, public.admin_idx_ok(i.verdict, i.coverage) ok,
      coalesce(i.coverage, '') ~* 'duplicate|Párhuzamos|noindex|redirect|404|Alternat' fixable_elsewhere,
      coalesce(substring(i.url from '[?&]lang=([a-z]{2})'), 'hu') lg from public.gsc_index i left join public.admin_index_requests r on r.url = i.url)
    select jsonb_build_object(
      'all', (select count(*) from g), 'ok', (select count(*) from g where ok), 'in_sitemap', v_in_sm, 'never', greatest(0, coalesce(v_in_sm, 0) - (select count(*) from g)),
      'per_day', (select round(avg(x.rows)) from (select l.rows from public.sync_log l where l.source = 'gsc_index' and l.ok order by l.at desc limit 7) x),
      'today', (select count(*) from public.admin_index_requests r where (r.requested_at at time zone 'Europe/Budapest')::date = (now() at time zone 'Europe/Budapest')::date),
      -- the priority agreed earlier: English and Hungarian first, guides before articles, legal pages last
      'queue', coalesce((select jsonb_agg(jsonb_build_object('url', x.url, 'link', x.inspect_link, 'coverage', x.coverage, 'last_crawl', x.last_crawl, 'checked_at', x.checked_at, 'lang', x.lg, 'times', x.times) order by x.p, x.url) from (
        select g.*, (case when lg = 'en' then 0 when lg = 'hu' then 10 else 20 end) + (case when url ~ '/(privacy|terms|contact|impressum|delete)' then 50 when url ~ '/(tudastar|learn)/' then 5 else 0 end) p
        from g where not ok and not fixable_elsewhere and (requested_at is null or requested_at < now() - interval '14 days')) x), '[]'),
      'requested', coalesce((select jsonb_agg(jsonb_build_object('url', g.url, 'at', g.requested_at, 'coverage', g.coverage, 'checked_at', g.checked_at,
          'state', case when g.checked_at > g.requested_at and g.ok then 'in' when g.checked_at > g.requested_at then 'no' else 'wait' end) order by g.requested_at desc)
        from g where g.requested_at is not null and g.requested_at >= now() - interval '30 days'), '[]'),
      'elsewhere', coalesce((select jsonb_agg(x) from (select coverage, count(*) n from g where not ok and fixable_elsewhere group by 1 order by 2 desc) x), '[]')
    ));
end $f$;

create or replace function public.admin_index_request_set(p_url text, p_on boolean) returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_url !~ '^https://inkage\.app(/|$)' then raise exception 'unknown address'; end if;
  if p_on then insert into public.admin_index_requests (url) values (p_url) on conflict (url) do update set requested_at = now(), times = public.admin_index_requests.times + 1;
  else delete from public.admin_index_requests where url = p_url; end if;
end $f$;

-- ---------- 3. The news: what really changed, from Google's exact totals ----------
create or replace function public.admin_google_news(p_days integer default 7) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_d int := greatest(7, least(coalesce(p_days, 7), 28)); v_last date; v_first date; v_a1 date; v_a0 date; v_tf date; r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select max(day), min(day) into v_last, v_first from public.gsc_dims where dim = 'page';
  select min(day) into v_tf from public.gsc_totals where type = 'web';
  if v_last is null then return jsonb_build_object('empty', true); end if;
  v_a1 := v_last - v_d + 1; v_a0 := v_a1 - v_d;
  with
  t as (select coalesce(sum(clicks) filter (where day >= v_a1), 0) c1, coalesce(sum(impressions) filter (where day >= v_a1), 0) i1, sum(position * impressions) filter (where day >= v_a1) / nullif(sum(impressions) filter (where day >= v_a1), 0) p1,
      coalesce(sum(clicks) filter (where day < v_a1 and day >= v_a0), 0) c0, coalesce(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) i0, sum(position * impressions) filter (where day < v_a1 and day >= v_a0) / nullif(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) p0
    from public.gsc_totals where type = 'web' and day <= v_last),
  y as (select coalesce(sum(clicks), 0) c, coalesce(sum(impressions), 0) i, count(*) n from public.gsc_totals where type = 'web' and day between v_a1 - 364 and v_last - 364),
  pg as (select val k, coalesce(sum(clicks) filter (where day >= v_a1), 0) c1, coalesce(sum(impressions) filter (where day >= v_a1), 0) i1, sum(position * impressions) filter (where day >= v_a1) / nullif(sum(impressions) filter (where day >= v_a1), 0) p1,
      coalesce(sum(clicks) filter (where day < v_a1 and day >= v_a0), 0) c0, coalesce(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) i0, sum(position * impressions) filter (where day < v_a1 and day >= v_a0) / nullif(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) p0,
      min(day) filter (where impressions > 0) first_at
    from public.gsc_dims where dim = 'page' and impressions > 0 group by 1),
  q as (select query k, (array_agg(page order by impressions desc))[1] page, coalesce(sum(clicks) filter (where day >= v_a1), 0) c1, coalesce(sum(impressions) filter (where day >= v_a1), 0) i1, sum(position * impressions) filter (where day >= v_a1) / nullif(sum(impressions) filter (where day >= v_a1), 0) p1,
      coalesce(sum(clicks) filter (where day < v_a1 and day >= v_a0), 0) c0, coalesce(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) i0, sum(position * impressions) filter (where day < v_a1 and day >= v_a0) / nullif(sum(impressions) filter (where day < v_a1 and day >= v_a0), 0) p0,
      min(day) first_at
    from public.gsc_daily where impressions > 0 and query is not null and query <> '' group by 1),
  pe as (select *, case
      when i0 >= 3 and i1 >= 5 and p1 <= 10 and p0 > 10 then 'first_in'
      when i0 >= 5 and i1 >= 3 and p0 <= 10 and p1 > 10 then 'first_out'
      when first_at >= v_a1 and i1 >= 3 then 'new'
      when i0 >= 10 and i1 = 0 then 'gone'
      when c1 - c0 >= 2 or (i1 - i0 >= 20 and i1 >= i0 * 2) then 'up'
      when c0 - c1 >= 2 or (i0 - i1 >= 20 and i0 >= i1 * 2) then 'down' end e from pg),
  qe as (select *, case
      when i0 >= 3 and i1 >= 3 and p1 <= 10 and p0 > 10 then 'first_in'
      when i0 >= 3 and i1 >= 3 and p0 <= 10 and p1 > 10 then 'first_out'
      when first_at >= v_a1 and i1 >= 2 then 'new'
      when i0 >= 3 and i1 >= 3 and p0 - p1 >= 3 then 'up'
      when i0 >= 3 and i1 >= 3 and p1 - p0 >= 3 then 'down' end e from q)
  select jsonb_build_object(
    'days', v_d, 'last_day', v_last, 'from', v_a1, 'prev_from', v_a0, 'data_from', v_tf,
    'has_prev', v_tf <= v_a0,
    'totals', (select jsonb_build_object('clicks', c1, 'impressions', i1, 'pos', round(p1::numeric, 1), 'prev_clicks', c0, 'prev_impressions', i0, 'prev_pos', round(p0::numeric, 1)) from t),
    'year', jsonb_build_object('has', v_tf <= v_a1 - 364, 'from', v_tf + 364 + v_d, 'clicks', (select c from y), 'impressions', (select i from y)),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('e', e, 'k', k, 'clicks', c1, 'impressions', i1, 'pos', round(p1::numeric, 1), 'prev_clicks', c0, 'prev_impressions', i0, 'prev_pos', round(p0::numeric, 1)) order by i1 + i0 desc) from pe where e is not null), '[]'),
    'queries', coalesce((select jsonb_agg(jsonb_build_object('e', e, 'k', k, 'page', page, 'clicks', c1, 'impressions', i1, 'pos', round(p1::numeric, 1), 'prev_clicks', c0, 'prev_impressions', i0, 'prev_pos', round(p0::numeric, 1)) order by i1 + i0 desc) from qe where e is not null), '[]'),
    'cover', (select jsonb_build_object('rows_clicks', coalesce(sum(clicks), 0), 'rows_impressions', coalesce(sum(impressions), 0)) from public.gsc_daily where day >= v_a1),
    'index', jsonb_build_object('log_from', date '2026-11-01',
      'in', coalesce((select jsonb_agg(jsonb_build_object('url', l.url, 'at', l.at, 'coverage', l.to_coverage) order by l.at desc) from public.gsc_index_log l where l.at > now() - make_interval(days => v_d) and l.went = 'in'), '[]'),
      'out', coalesce((select jsonb_agg(jsonb_build_object('url', l.url, 'at', l.at, 'coverage', l.to_coverage) order by l.at desc) from public.gsc_index_log l where l.at > now() - make_interval(days => v_d) and l.went = 'out'), '[]')),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('t', day, 'clicks', clicks, 'impressions', impressions, 'pos', position) order by day) from public.gsc_totals where type = 'web' and day <= v_last), '[]'),
    -- before and after a Google update, 7 measured days each; counts are given so that "not measurable" can say why
    'updates', coalesce((select jsonb_agg(u order by u.begin_at desc) from (
      select x.id, x.title, x.begin_at, x.end_at, b.n before_days, b.c before_clicks, b.i before_impressions, a.n after_days, a.c after_clicks, a.i after_impressions
      from (select * from public.google_updates order by begin_at desc limit 4) x
      cross join lateral (select count(*) n, sum(clicks) c, sum(impressions) i from public.gsc_totals t2 where t2.type = 'web' and t2.day between x.begin_at::date - 7 and x.begin_at::date - 1) b
      cross join lateral (select count(*) n, sum(clicks) c, sum(impressions) i from public.gsc_totals t2 where t2.type = 'web' and x.end_at is not null and t2.day between x.end_at::date + 1 and x.end_at::date + 7 and t2.day <= v_last) a) u), '[]')
  ) into r;
  return r;
end $f$;

-- ---------- 4. One page on one sheet ----------
create or replace function public.admin_google_page(p_url text, p_days integer default 28) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_base text := regexp_replace(p_url, '[?&]lang=[a-z]{2}', ''); v_d int := greatest(7, least(coalesce(p_days, 28), 365)); v_a date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_a := (select max(day) from public.gsc_dims where dim = 'page') - v_d + 1;
  return public.admin_gsc_page(p_url, v_d) || jsonb_build_object(
    'index', (select to_jsonb(g) - 'mobile' from public.gsc_index g where g.url = p_url),
    'requested', (select r.requested_at from public.admin_index_requests r where r.url = p_url),
    'seo', (select jsonb_build_object('checked_at', s.checked_at, 'status', s.status, 'ms', s.ms, 'title', s.title, 'meta', s.meta, 'words', s.words, 'links_in', s.links_in, 'issues', s.issues, 'hreflangs', s.hreflangs) from public.seo_pages s where s.url = p_url),
    'speed', (select jsonb_build_object('day', c.day, 'perf', c.perf, 'lcp', c.lcp) from public.admin_cwv c where c.url = p_url and c.form = 'mobile' order by c.day desc limit 1),
    'versions', coalesce((select jsonb_agg(x order by x.clicks desc, x.impressions desc, x.url) from (
      select g.url, coalesce(substring(g.url from '[?&]lang=([a-z]{2})'), 'hu') lang, public.admin_idx_ok(g.verdict, g.coverage) ok, g.coverage,
        coalesce((select sum(d.clicks) from public.gsc_dims d where d.dim = 'page' and d.val = g.url and d.day >= v_a), 0) clicks,
        coalesce((select sum(d.impressions) from public.gsc_dims d where d.dim = 'page' and d.val = g.url and d.day >= v_a), 0) impressions
      from public.gsc_index g where regexp_replace(g.url, '[?&]lang=[a-z]{2}', '') = v_base) x), '[]'));
end $f$;

-- ---------- 5. Tickable SEO tasks with the effect measured afterwards ----------
create table if not exists public.admin_seo_tasks (key text primary key, title text not null, url text, query text, kind text, done_at timestamptz not null default now(), base jsonb);
alter table public.admin_seo_tasks enable row level security;

-- per measured day, so that a shorter "after" still compares with the 14 days before
create or replace function public.admin_seo_measure(p_url text, p_query text, p_a date, p_b date) returns jsonb language sql stable security definer set search_path to '' as $f$
  with s as (
    select clicks, impressions, position from public.gsc_dims where p_query is null and dim = 'page' and val = p_url and day between p_a and p_b
    union all select clicks, impressions, position from public.gsc_daily where p_query is not null and query = p_query and day between p_a and p_b)
  select jsonb_build_object('days', (select count(*) from public.gsc_totals t where t.type = 'web' and t.day between p_a and p_b),
    'clicks', coalesce(sum(clicks), 0), 'impressions', coalesce(sum(impressions), 0), 'pos', round((sum(position * impressions) / nullif(sum(impressions), 0))::numeric, 1)) from s $f$;
revoke all on function public.admin_seo_measure(text, text, date, date) from public, anon, authenticated;

create or replace function public.admin_seo_task_set(p_key text, p_title text, p_url text, p_query text, p_kind text, p_on boolean) returns void language plpgsql security definer set search_path to '' as $f$
declare v_day date := (now() at time zone 'Europe/Budapest')::date;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_on then
    insert into public.admin_seo_tasks (key, title, url, query, kind, base) values (left(p_key, 300), left(p_title, 300), p_url, p_query, p_kind,
      case when p_url is null and p_query is null then null else public.admin_seo_measure(p_url, p_query, v_day - 14, v_day - 1) end)
    on conflict (key) do nothing;
  else delete from public.admin_seo_tasks where key = p_key; end if;
end $f$;

create or replace function public.admin_seo_tasks_list() returns jsonb language plpgsql stable security definer set search_path to '' as $f$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'title', t.title, 'url', t.url, 'query', t.query, 'kind', t.kind, 'done_at', t.done_at, 'base', t.base,
      'after', case when t.url is null and t.query is null then null else public.admin_seo_measure(t.url, t.query, ((t.done_at at time zone 'Europe/Budapest')::date) + 1, (now() at time zone 'Europe/Budapest')::date) end) order by t.done_at desc)
    from public.admin_seo_tasks t), '[]');
end $f$;

-- ---------- 6. Revenue: fills by itself when payments go on; each currency apart, nothing is converted ----------
create or replace function public.admin_revenue(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path to '' as $f$
declare v_a timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (with p as (select x.* from public.purchases x where x.created_at >= v_a and not public.admin_own_uid(x.user_id))
    select jsonb_build_object(
      'live', coalesce((select (s.value)::text::boolean from public.admin_ink_settings s where s.key = 'payments_live'), false),
      'all_time', (select count(*) from public.purchases x where not public.admin_own_uid(x.user_id)),
      'sales', (select count(*) from p), 'people', (select count(distinct user_id) from p),
      'rev', coalesce((select jsonb_agg(z) from (select coalesce(currency, '?') currency, sum(amount) v from p group by 1 order by 2 desc) z), '[]'),
      'days', coalesce((select jsonb_agg(z order by z.t) from (select ((created_at at time zone 'Europe/Budapest')::date) t, coalesce(currency, '?') currency, sum(amount) v, count(*) n from p group by 1, 2) z), '[]'),
      'plans', coalesce((select jsonb_agg(z order by z.n desc) from (select coalesce(plan, product, '?') k, count(*) n, count(distinct user_id) people from p group by 1) z), '[]'),
      'stores', coalesce((select jsonb_agg(z order by z.n desc) from (select coalesce(store, '?') k, coalesce(currency, '?') currency, count(*) n, sum(amount) v from p group by 1, 2) z), '[]'),
      'list', coalesce((select jsonb_agg(z order by z.at desc) from (select x.user_id, u.email, coalesce(x.plan, x.product) plan, x.amount, x.currency, x.store, x.created_at as at from p x left join auth.users u on u.id = x.user_id order by x.created_at desc limit 100) z), '[]')
    ));
end $f$;

-- ---------- 7. Signals: the index news join the bell and the notifications (additive fields: kind, n, urls) ----------
create or replace function public.admin_seo_alerts() returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare out jsonb := '[]'; r record; v_n int;
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
  -- the index news of the last 3 days (only pages that are still in that state)
  select count(*) into v_n from public.gsc_index_log l join public.gsc_index g on g.url = l.url where l.at > now() - interval '3 days' and l.went = 'out' and not public.admin_idx_ok(g.verdict, g.coverage);
  if v_n > 0 then
    out := out || jsonb_build_object('c', 'bad', 'kind', 'index_out', 'n', v_n, 't', v_n || ' oldal kiesett a Google-ből', 's', 'Az utolsó ellenőrzés szerint már nem jelenik meg a találatok között. A Google oldalon látod, melyik.', 'to', 'search',
      'urls', (select jsonb_agg(u) from (select l.url u from public.gsc_index_log l where l.at > now() - interval '3 days' and l.went = 'out' order by l.at desc limit 5) z));
  end if;
  select count(*) into v_n from public.gsc_index_log l where l.at > now() - interval '3 days' and l.went = 'in';
  if v_n > 0 then
    out := out || jsonb_build_object('c', 'info', 'kind', 'index_in', 'n', v_n, 't', v_n || ' új oldal került be a Google-be', 's', 'Mostantól megjelenhet a találatok között.', 'to', 'search',
      'urls', (select jsonb_agg(u) from (select l.url u from public.gsc_index_log l where l.at > now() - interval '3 days' and l.went = 'in' order by l.at desc limit 5) z));
  end if;
  for r in select u.target from public.uptime_checks u where u.done and not u.ok and u.via = 'pg_net' and u.at > now() - interval '15 minutes'
      and not exists (select 1 from public.uptime_checks s where s.via = 'server' and s.ok and s.target = u.target and s.at between u.at - interval '3 minutes' and u.at + interval '3 minutes') group by u.target having count(*) >= 2 loop
    out := out || jsonb_build_object('c', 'bad', 't', 'Nem érhető el: ' || replace(r.target, 'https://inkage.app', ''), 's', '15 percen belül két ellenőrzés is hibát adott, és a szerver saját mérése sem érte el.', 'to', 'monitor');
  end loop;
  for r in select host, valid_to, domain_expires from public.cert_status loop
    if r.valid_to < now() + interval '14 days' then out := out || jsonb_build_object('c', 'bad', 't', 'Lejár a tanúsítvány: ' || r.host, 's', to_char(r.valid_to, 'YYYY.MM.DD.'), 'to', 'monitor'); end if;
    if r.domain_expires < now() + interval '30 days' then out := out || jsonb_build_object('c', 'bad', 't', 'Lejár a domain: ' || r.host, 's', to_char(r.domain_expires, 'YYYY.MM.DD.'), 'to', 'monitor'); end if;
  end loop;
  return out;
end $function$;

-- ---------- 8. The morning check also keeps the inspection's own link ----------
create or replace function public.admin_w_gsc_index(p_token text, p_rows jsonb) returns integer language plpgsql security definer set search_path to '' as $function$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.gsc_index (url, verdict, coverage, indexing, fetch_state, robots, last_crawl, canonical_google, canonical_user, mobile, checked_at, inspect_link)
  select r.url, r.verdict, r.coverage, r.indexing, r.fetch_state, r.robots, r.last_crawl, r.canonical_google, r.canonical_user, r.mobile, coalesce(r.checked_at, now()), r.inspect_link
  from jsonb_populate_recordset(null::public.gsc_index, p_rows) r
  on conflict (url) do update set
    prev_verdict = case when public.gsc_index.verdict is distinct from excluded.verdict then public.gsc_index.verdict else public.gsc_index.prev_verdict end,
    changed_at = case when public.gsc_index.verdict is distinct from excluded.verdict then now() else public.gsc_index.changed_at end,
    verdict = excluded.verdict, coverage = excluded.coverage, indexing = excluded.indexing, fetch_state = excluded.fetch_state,
    robots = excluded.robots, last_crawl = excluded.last_crawl, canonical_google = excluded.canonical_google, canonical_user = excluded.canonical_user,
    mobile = excluded.mobile, checked_at = excluded.checked_at, inspect_link = coalesce(excluded.inspect_link, public.gsc_index.inspect_link);
  get diagnostics k = row_count; return k;
end $function$;

-- ======================================== from Calligra 20270115_admin_push_signups
-- The notification checks hand over the accounts registered in the last 6 hours (ids only): the phone says "Új fiók" and opens its page.
do $$
declare d text := pg_get_functiondef('public.admin_r_push_news(text)'::regprocedure);
begin
  if position($a$'inbox', coalesce($a$ in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, $a$'inbox', coalesce($a$, $b$'signups_new', coalesce((select jsonb_agg(id) from public.admin_real_users where created_at > now() - interval '6 hours'), '[]'),
    'inbox', coalesce($b$);
end $$;

-- ======================================== from Calligra 20270120_admin_round2
-- Admin, round two: what the visit story and the source wording need. Additive: new functions and new keys only;
-- every reader is gated by is_admin and nothing else in the app calls them.

-- which AI site a visit came from, when the visit says so
create or replace function public.admin_ai_site(src jsonb)
returns text language sql immutable set search_path to '' as $$
  with x as (select lower(coalesce(src->>'us', '')) || ' ' || lower(coalesce(src->>'from', '')) t)
  select case when t ~ '(chatgpt|openai)' then 'ChatGPT' when t ~ 'perplexity' then 'Perplexity' when t ~ 'gemini' then 'Gemini'
    when t ~ 'claude' then 'Claude' when t ~ 'copilot' then 'Copilot' end from x
$$;
revoke execute on function public.admin_ai_site(jsonb) from public, anon, authenticated;

-- the source lists' "ai" row, split by site: visits, and accounts whose match to the visit is not weak
create or replace function public.admin_ai_sites(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.sessions desc, x.signups desc) from (
    select coalesce(a.k, b.k) k, coalesce(a.n, 0) sessions, coalesce(b.n, 0) signups
    from (select coalesce(public.admin_ai_site(s.src), 'Más MI-kereső') k, count(*) n from public.admin_sess(r.a, r.b, 'ai', null) s group by 1) a
    full join (select coalesce(public.admin_ai_site(m.src), 'Más MI-kereső') k, count(*) n from public.admin_signups_matched(r.a, r.b) m where m.ch = 'ai' and m.conf <> 'gyenge' group by 1) b on b.k = a.k) x), '[]');
end $$;
revoke execute on function public.admin_ai_sites(integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_ai_sites(integer, timestamptz, timestamptz) to authenticated;

-- the funnel's loss point: visits that reached the sign-up page and left without an account
create or replace function public.admin_register_stuck(p_days integer default 30, p_from timestamptz default null, p_to timestamptz default null, p_ch text default null, p_lang text default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r record; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  with e as (select x.session, x.name, x.props, x.path, x.created_at from public.admin_events(p_ch, p_lang) x where x.created_at >= r.a and x.created_at < r.b and x.session is not null),
  flagged as (select e.*, (e.name = 'landing_view' and (e.props->>'page' = 'register' or coalesce(e.path, '') like '/register%')) or (e.name = 'auth_step' and e.props->>'mode' = 'register') reg from e),
  s as (select f.session,
      bool_or(f.name = 'signup') signup,
      bool_or(f.name = 'auth_step' and f.props->>'s' = 'sent') sent,
      count(*) filter (where f.name = 'auth_step' and f.props->>'s' in ('tap_google', 'tap_apple', 'tap_email', 'submit')) tries,
      bool_or(f.name = 'auth_step' and f.props->>'s' = 'error') err,
      bool_or(f.name = 'auth_step' and f.props->>'s' = 'inapp') inapp,
      extract(epoch from max(f.created_at) filter (where f.reg) - min(f.created_at) filter (where f.reg)) secs
    from flagged f group by 1 having bool_or(f.reg))
  select jsonb_build_object('visits', count(*), 'done', count(*) filter (where signup or sent),
    'left', count(*) filter (where not signup and not sent),
    'no_try', count(*) filter (where not signup and not sent and tries = 0),
    'tried', count(*) filter (where not signup and not sent and tries > 0),
    'err', count(*) filter (where not signup and not sent and err),
    'inapp', count(*) filter (where not signup and not sent and inapp),
    'median_secs', percentile_cont(.5) within group (order by secs) filter (where not signup and not sent and secs > 0),
    'whys', coalesce((select jsonb_agg(y order by y.n desc) from (select f.props->>'why' k, count(distinct f.session) n from flagged f where f.name = 'auth_step' and f.props->>'s' = 'error' group by 1) y), '[]'))
  into res from s;
  return res;
end $$;
revoke execute on function public.admin_register_stuck(integer, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_register_stuck(integer, timestamptz, timestamptz, text, text) to authenticated;

-- one account's page: each timeline row of the sign-up page carries what happened there; the match says the AI site
CREATE OR REPLACE FUNCTION public.admin_user(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare res jsonb; ca timestamptz := (select created_at from auth.users where id = p_id); mm record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into mm from public.admin_signups_matched(ca, ca + interval '1 microsecond') x where x.user_id = p_id limit 1;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.raw_app_meta_data->>'provider' provider,
      u.raw_user_meta_data - 'avatar_url' - 'picture' meta from auth.users u where u.id = p_id) x),
    'match', case when mm.session is null then null else jsonb_build_object('session', right(mm.session, 6), 'ch', mm.ch, 'pf', mm.pf, 'src', mm.src, 'lang', mm.slang, 'conf', mm.conf, 'near_secs', mm.near_secs, 'ai_site', public.admin_ai_site(mm.src),
      'shared_with', (select count(*) from public.admin_signups_matched(ca - interval '1 hour', ca + interval '1 hour') o where o.session = mm.session and o.user_id <> p_id)) end,
    'visit', public.admin_visit(mm.session),
    'celeb', public.admin_celeb_use(p_id),
    'saved', coalesce((select jsonb_agg(x order by x.created_at desc) from (select s.name_norm, s.kind, s.key, s.fav, s.created_at from public.admin_ink_saved s where s.user_id = p_id order by s.created_at desc limit 60) x), '[]'),
    'unlocks', coalesce((select jsonb_agg(x order by x.created_at desc) from (select name_norm, calligrapher, created_at, design is not null has_design from public.admin_ink_unlocks where user_id = p_id) x), '[]'),
    'timeline', coalesce((select jsonb_agg(x order by x.created_at) from (
      select e.created_at, e.name, coalesce(e.props->>'step', e.props->>'scr', e.props->>'k', e.props->>'kind', e.props->>'cta', e.props->>'look') detail, e.props->>'value' val, e.props->>'secs' secs, e.path, e.lang,
        public.admin_channel(e.props->'src', e.props->>'ia') ch,
        case when e.name = 'auth_step' then jsonb_strip_nulls(jsonb_build_object('s', e.props->>'s', 'mode', e.props->>'mode', 'how', e.props->>'how', 'why', e.props->>'why', 'iab', e.props->>'iab')) end auth
      from public.events_real e where e.session = mm.session
      order by e.created_at limit 400) x), '[]'),
    'days', coalesce((select jsonb_agg(day order by day) from public.admin_user_days where user_id = p_id), '[]'),
    'days_used', coalesce((select jsonb_agg(day order by day) from public.admin_user_days where user_id = p_id and used), '[]')
  ) into res;
  return res;
end $function$;

-- the sign-ups list: the AI site when the visit names one
CREATE OR REPLACE FUNCTION public.admin_leads(p_days integer DEFAULT 30, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(p_days, p_from, p_to);
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select m.created_at at, coalesce(m.lang, m.slang) lang, m.ch, m.pf, m.code, m.provider, m.session is not null matched, m.conf, m.near_secs, public.admin_ai_site(m.src) ai_site,
      coalesce(p.platform, l.post_platform, l.source) post_platform, p.title post_title, p.url post_url,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'flow_step' and e.props->>'step' = 'score') scored,
      exists (select 1 from public.events_real e where e.session = m.session and e.name in ('share_open', 'share_video', 'reveal_share')) shared,
      exists (select 1 from public.events_real e where e.session = m.session and e.name = 'signature_captured') captured,
      (select min(e.created_at) from public.events_real e where e.session = m.session) first_at,
      public.admin_session_active(m.session) secs,
      (select count(*) from public.admin_ink_made c where c.user_id = m.user_id and c.ok) celeb,
      (select count(*) from public.admin_ink_saved s where s.user_id = m.user_id) saved,
      (select count(*) from public.admin_ink_saved s where s.user_id = m.user_id and s.fav) favs,
      (select sum((e.props->>'secs')::int) from public.events_real e where e.session = m.session and e.name = 'screen_time' and e.props->>'scr' in ('rev', 'picks', 'det') and e.props->>'secs' ~ '^[0-9]+$') result_secs,
      (select count(*) from public.events_real e where e.session = m.session and e.name = 'screenshot_key') shots
    from public.admin_signups_matched(r.a, least(r.b, now()) + interval '1 minute') m
    left join public.short_links l on l.code = m.code
    left join lateral (select q.platform, q.title, q.url from public.social_posts q where q.code = m.code or (q.platform = l.post_platform and q.post_id = l.post_id) limit 1) p on true
    limit 500) x), '[]');
end $function$;

-- the people list: the AI site, only for the rows that came from an AI site (one more lookup per such row)
CREATE OR REPLACE FUNCTION public.admin_people(p_q text DEFAULT ''::text, p_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_lang text DEFAULT NULL::text, p_provider text DEFAULT NULL::text, p_ch text DEFAULT NULL::text, p_sort text DEFAULT 'created'::text, p_days integer DEFAULT NULL::integer, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%'; res jsonb; r record; ranged boolean := p_days is not null or p_from is not null;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(coalesce(p_days, 0), p_from, p_to);
  with f0 as (select x.*, exists (select 1 from public.purchases b where b.user_id = x.id) paid from public.admin_user_facts() x),
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
        when p_filter = 'made' then made_ok > 0
        when p_filter = 'nomade' then made_ok = 0
        when p_filter = 'paid' then paid
        when p_filter = 'returned' then returned
        when p_filter = 'banned' then banned
        else true end
      and (p_lang is null or left(coalesce(lang, ''), 2) = left(p_lang, 2))
      and (p_provider is null or provider = p_provider)
      and (p_ch is null or coalesce(ch, 'ismeretlen') = any(string_to_array(p_ch, ',')))
  ),
  pg as (select * from f order by case p_sort when 'score' then -score when 'active' then -extract(epoch from last_active_at) when 'made' then -made_ok else -extract(epoch from created_at) end
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'own', (select count(*) from fp where own),
    'counts', (select jsonb_build_object('uj', count(*) filter (where stage = 'uj'), 'probalgatja', count(*) filter (where stage = 'probalgatja'),
        'aktiv', count(*) filter (where stage = 'aktiv'), 'veszelyben', count(*) filter (where stage = 'veszelyben'), 'alvo', count(*) filter (where stage = 'alvo'),
        'churn', count(*) filter (where churn), 'stuck', count(*) filter (where stuck), 'online', count(*) filter (where online),
        'made', count(*) filter (where made_ok > 0), 'nomade', count(*) filter (where made_ok = 0), 'paid', count(*) filter (where paid), 'returned', count(*) filter (where returned),
        'followup', count(*) filter (where follow_up is not null and follow_up <= public.admin_today()), 'banned', count(*) filter (where banned),
        'avg_score', round(avg(score))) from fp where not own),
    'tags', coalesce((select jsonb_agg(x order by x.n desc) from (select t k, count(*) n from fp, unnest(fp.tags) t where not fp.own group by 1) x), '[]'),
    'rows', coalesce((select jsonb_agg(to_jsonb(pg) || jsonb_build_object(
        'visit', public.admin_visit((select m.session from public.admin_signups_matched(pg.created_at, pg.created_at + interval '1 microsecond') m where m.user_id = pg.id limit 1)),
        'celeb', public.admin_celeb_use(pg.id),
        'ai_site', case when pg.ch = 'ai' then (select public.admin_ai_site(m.src) from public.admin_signups_matched(pg.created_at, pg.created_at + interval '1 microsecond') m where m.user_id = pg.id limit 1) end)
      order by case p_sort when 'score' then -pg.score when 'active' then -extract(epoch from pg.last_active_at) when 'made' then -pg.made_ok else -extract(epoch from pg.created_at) end) from pg), '[]'))
  into res;
  return res;
end $function$;

-- ======================================== from Calligra 20270121_celeb_ratings
-- The admin's "Melyik stílus működik" card, per style, without her own accounts. "brush" is one look of two styles (a, b).
-- saves: taps on save-as-image, from the anonymous share_save event, which names the look from this release on.
create or replace function public.admin_style_rank(p_days integer default 0, p_from timestamptz default null, p_to timestamptz default null)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare r record; res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.admin_range(coalesce(p_days, 0), p_from, p_to);
  with base as materialized (
    select c.user_id, case when c.style in ('a', 'b') then 'brush' else c.style end k, c.created_at,
           (c.created_at at time zone 'Europe/Budapest')::date as day
    from public.admin_ink_made c where c.ok and not public.admin_own_uid(c.user_id)
  ),
  made as (select * from base where created_at >= r.a and created_at < r.b),
  m as (select k, count(*) made, count(distinct user_id) accounts from made group by k),
  per as (select k, user_id, count(*) n, min(day) first_day from made group by k, user_id),
  rep as (select k, count(*) filter (where n > 1) repeats from per group by k),
  back as (select p.k, count(*) came_back from per p where exists (select 1 from base b where b.user_id = p.user_id and b.day > p.first_day) group by p.k),
  last_used as (select k, max(created_at) last_at from base group by k),
  rated as (
    select case when x.style in ('a', 'b') then 'brush' else x.style end k, x.kind, x.user_id, x.stars
    from public.admin_ink_ratings x where x.updated_at >= r.a and x.updated_at <= r.b and not public.admin_own_uid(x.user_id)
  ),
  st as (
    select k, round(avg(stars), 2) avg_stars, count(*) ratings, count(*) filter (where stars >= 4) high, count(*) filter (where stars <= 2) low
    from rated where kind = 'celeb' group by k
  ),
  fav as (
    select case when v.s in ('a', 'b') then 'brush' else v.s end k, count(*) favs
    from public.admin_ink_saved x cross join lateral (select x.design #>> '{spec,celeb,style}' s) v
    where x.kind = 'celeb' and x.fav and v.s is not null and x.created_at >= r.a and x.created_at < r.b and not public.admin_own_uid(x.user_id)
    group by 1
  ),
  sv as (
    select case when e.props->>'look' in ('a', 'b') then 'brush' else e.props->>'look' end k, count(distinct e.session) saves
    from public.events_real e where e.name = 'share_save' and e.props->>'look' is not null and e.created_at >= r.a and e.created_at < r.b
    group by 1
  ),
  keys as (select k from last_used union select k from st union select k from fav union select k from sv),
  drawn as (
    select k, round(avg(stars), 2) avg_stars, count(*) ratings, count(*) filter (where stars >= 4) high, count(*) filter (where stars <= 2) low
    from rated where kind = 'font' group by k
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'k', y.k, 'made', coalesce(m.made, 0), 'accounts', coalesce(m.accounts, 0),
        'avg', st.avg_stars, 'ratings', coalesce(st.ratings, 0), 'high', coalesce(st.high, 0), 'low', coalesce(st.low, 0),
        'favs', coalesce(fav.favs, 0), 'saves', coalesce(sv.saves, 0), 'repeats', coalesce(rep.repeats, 0),
        'came_back', coalesce(back.came_back, 0), 'last_at', last_used.last_at))
      from keys y left join m using (k) left join st using (k) left join fav using (k) left join sv using (k)
        left join rep using (k) left join back using (k) left join last_used using (k)), '[]'::jsonb),
    'drawn', coalesce((select jsonb_agg(to_jsonb(d) order by d.ratings desc) from drawn d), '[]'::jsonb),
    'ratings', (select count(*) from rated),
    'rated_accounts', (select count(distinct user_id) from rated)
  ) into res;
  return res;
end $function$;
revoke all on function public.admin_style_rank(integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_style_rank(integer, timestamptz, timestamptz) to authenticated;

-- One account's stars, for the account page in the admin.
create or replace function public.admin_user_ratings(p_user uuid)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('style', x.style, 'kind', x.kind, 'stars', x.stars, 'at', x.updated_at) order by x.updated_at desc)
    from public.admin_ink_ratings x where x.user_id = p_user), '[]'::jsonb);
end $function$;
revoke all on function public.admin_user_ratings(uuid) from public, anon;
grant execute on function public.admin_user_ratings(uuid) to authenticated;

-- The data export of an account: the same answer as before, with its ratings as one more key.
create or replace function public.admin_user_export(p_user uuid)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'kiadva', now(),
    'fiok', (select jsonb_build_object('azonosito', u.id, 'email', u.email, 'regisztralt', u.created_at, 'megerositve', u.email_confirmed_at, 'utolso_belepes', u.last_sign_in_at,
       'belepes_modja', u.raw_app_meta_data->>'provider', 'nev', coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), 'nyelv', u.raw_user_meta_data->>'lang') from auth.users u where u.id = p_user),
    'profil', (select jsonb_build_object('kredit', p.credits, 'ajandek_felhasznalva', p.gift_claimed, 'letrehozva', p.created_at) from public.admin_ink_profiles p where p.id = p_user),
    'alairasok', coalesce((select jsonb_agg(jsonb_build_object('nev', c.name_norm, 'stilus', c.style, 'alahuzas', c.underline, 'monogram', c.initials, 'hangulat', c.mood, 'fajl', c.path, 'sikeres', c.ok, 'keszult', c.created_at) order by c.created_at) from public.admin_ink_made c where c.user_id = p_user), '[]'),
    'mentett_alairasok', coalesce((select jsonb_agg(jsonb_build_object('nev', s.name, 'fajta', s.kind, 'kulcs', s.key, 'dizajn', s.design, 'kedvenc', s.fav, 'mentve', s.created_at) order by s.created_at) from public.admin_ink_saved s where s.user_id = p_user), '[]'),
    'ertekelesek', coalesce((select jsonb_agg(jsonb_build_object('nev', x.name_norm, 'fajta', x.kind, 'kulcs', x.sig_key, 'stilus', x.style, 'csillag', x.stars, 'keszult', x.created_at, 'modositva', x.updated_at) order by x.created_at) from public.admin_ink_ratings x where x.user_id = p_user), '[]'),
    'mentett_nevek', coalesce((select jsonb_agg(jsonb_build_object('nev', x.name_norm, 'kalligrafus', x.calligrapher, 'mentve', x.created_at, 'dizajn', x.design) order by x.created_at) from public.admin_ink_unlocks x where x.user_id = p_user), '[]'),
    'dizajnok', coalesce((select jsonb_agg(to_jsonb(d) - 'user_id') from public.uploads d where d.user_id = p_user), '[]'),
    'vasarlasok', coalesce((select jsonb_agg(to_jsonb(q) - 'user_id') from public.purchases q where q.user_id = p_user), '[]'),
    'igenylesek', coalesce((select jsonb_agg(to_jsonb(q) - 'user_id') from public.admin_ink_claims q where q.user_id = p_user), '[]'),
    'aktiv_napok', coalesce((select jsonb_agg(d.day order by d.day) from public.admin_user_days d where d.user_id = p_user), '[]'),
    'jegyzetek', coalesce((select jsonb_agg(jsonb_build_object('szoveg', n.body, 'cimkek', n.tags, 'keszult', n.created_at) order by n.created_at) from public.admin_user_notes n where n.user_id = p_user), '[]'));
end $function$;

-- ======================================== from Calligra 20270122_admin_ma_feed_day
-- Legutóbb, a past day: its own whole timeline. admin_ma_feed took 80 rows over all the days and the day was picked afterwards, so a busy week left an older day empty.
create or replace function public.admin_ma_feed_day(p_day date)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare a timestamptz := p_day::timestamp at time zone 'Europe/Budapest'; e timestamptz := (p_day + 1)::timestamp at time zone 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.at desc) from (
    select * from (
      select date_trunc('hour', u.created_at) as at, 'signup' kind, count(*)::text t, null::text s, 'users' "to" from public.admin_real_users u where u.created_at >= a and u.created_at < e group by 1
      union all select date_trunc('hour', c.created_at), 'made', count(*)::text, null, 'product' from public.admin_ink_made c where c.ok and c.created_at >= a and c.created_at < e and not public.admin_own_uid(c.user_id) group by 1
      union all select p.created_at, 'post', p.platform, left(p.title, 90), 'social' from public.social_posts p where p.created_at >= a and p.created_at < e and p.gone_at is null
      union all select (n.day::timestamp + interval '12 hours') at time zone 'Europe/Budapest', 'note', n.kind, left(n.text, 120), 'goals' from public.admin_notes n where n.day = p_day
      union all select distinct date_trunc('hour', r.at), 'release', null, null, 'monitor' from public.admin_releases r where r.at >= a and r.at < e
      union all select s.at, 'push', s.kind, left(s.title, 90), case s.kind when 'rising' then 'social' when 'record' then 'product' when 'index' then 'search' when 'account' then 'connect' when 'errors' then 'system' else 'monitor' end from public.admin_push_sent s where s.at >= a and s.at < e and s.kind in ('rising', 'viral', 'record', 'milestone', 'errors', 'sigfail', 'account', 'index', 'myrule', 'heartbeat')
      union all select date_trunc('hour', s.at), 'inbox', count(*)::text, null, 'inbox' from public.admin_push_sent s where s.at >= a and s.at < e and s.kind = 'inbox' group by 1
    ) y order by y.at desc limit 300) x), '[]');
end $$;
revoke all on function public.admin_ma_feed_day(date) from public, anon;
grant execute on function public.admin_ma_feed_day(date) to authenticated, service_role;

-- ======================================== from Calligra 20270123_admin_badge_rate_limit
-- The Kapcsolatok badge no longer counts a platform's temporary request limit (429) as a broken connection: the pages already treat it as working.
do $$
declare d text; a text := 'where last_error is not null or least(';
begin
  d := pg_get_functiondef('public.admin_badges()'::regprocedure);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, 'where (last_error is not null and last_error !~* ''korlátozta a kéréseket|rate limit|429'') or least(');
end $$;

-- ======================================== from Calligra 20270124_admin_fresh_stores
-- Freshness also tells a partly failed store run: App Store and Google Play join the runs whose last message is read ("részben:" is not fresh).
do $$
declare d text; a text := 'where source in (''bing'', ''seo'', ''watch'',';
begin
  d := pg_get_functiondef('public.admin_fresh()'::regprocedure);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, 'where source in (''apple'', ''google'', ''bing'', ''seo'', ''watch'',');
end $$;

-- ======================================== from Calligra 20270125_admin_live_fixes
-- Live findings 2026-11-04: store metrics writes (variable named like a column), the series setting, data-request tag.
create or replace function public.admin_w_store_metrics(p_token text, p_rows jsonb)
returns integer language plpgsql security definer set search_path to '' as $function$
declare n_rows integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.store_metrics select r.store, r.day, r.metric, coalesce(r.dim, ''), coalesce(r.k, ''), r.n from jsonb_populate_recordset(null::public.store_metrics, p_rows) r
  on conflict (store, day, metric, dim, k) do update set n = excluded.n;
  get diagnostics n_rows = row_count; return n_rows;
end $function$;
do $$ declare f text; d text; begin
  foreach f in array array['public.admin_setting_get(text)', 'public.admin_setting_save(text,jsonb)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('''pay_goal'')' in d) = 0 then raise exception 'not found in %', f; end if;
    execute replace(d, '''pay_goal'')', '''pay_goal'', ''series'')');
  end loop;
  d := pg_get_functiondef('public.admin_inbox_tag(text,integer,text)'::regprocedure);
  if position('when kind = ''review'' and rating <= 2 then ''panasz''' in d) = 0 then raise exception 'tag not found'; end if;
  execute replace(d, 'when kind = ''review'' and rating <= 2 then ''panasz''', 'when body ~* ''(töröl|adataim|adatai(m|d)|gdpr|delete my|remove my|my data|erase)'' then ''adat''
    when kind = ''review'' and rating <= 2 then ''panasz''');
end $$;
-- a platform's temporary request limit is not a failing pull (the same rule as the Kapcsolatok page and the badge)
do $$ declare d text; a text := 'if r.last_error is not null then'; begin
  d := pg_get_functiondef('public.admin_platform_alerts()'::regprocedure);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, 'if r.last_error is not null and r.last_error !~* ''korlátozta a kéréseket|rate limit|429'' then');
end $$;
-- downloads on Áttekintés up to the last day both stores have, as Áruházak counts (one store's later day made 9 against 17)
do $$ declare d text; a text := 'smax date := (select max(day) from public.store_daily);'; begin
  d := pg_get_functiondef('public.admin_home_extra'::regproc);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, 'smax date := (select min(m) from (select max(day) m from public.store_daily group by store) q);');
end $$;

-- ======================================== from Calligra 20270126_admin_funnel_prev_shared
-- Tölcsér: the previous period also counts visits that shared, so the Megosztott tile can be compared again.
do $$ declare d text; a text := '''any_saved'', count(*) filter (where saved)) from ps)'; begin
  d := pg_get_functiondef('public.admin_funnel_i'::regproc);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, '''any_saved'', count(*) filter (where saved), ''any_shared'', count(*) filter (where shared)) from ps)');
end $$;

-- ======================================== from Calligra 20270127_admin_data_quality_i
-- Monitoring's data quality: the 2026-12-31 patch was aimed at the wrapper and never took effect; the same change on the function that counts
-- (weekly runs are not missed days, today is not a gap yet, the stores and Search Console always listed, partly empty runs marked).
create or replace function pg_temp.patch(p_fn text, p_pairs text[]) returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p_fn::regprocedure); i int;
begin
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if position(p_pairs[2 * i - 1] in d) = 0 then raise exception 'patch %: not found: %', p_fn, left(p_pairs[2 * i - 1], 80); end if;
    d := replace(d, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  execute d;
end $p$;
select pg_temp.patch('public.admin_data_quality_i(integer)', array[
  $a$src as (select distinct source from public.sync_log where at >= now() - make_interval(days => d)),$a$,
  $a$src as (select distinct source from public.sync_log where at >= now() - make_interval(days => d) and source <> 'ai' and source not like '%\_keys'
    union select unnest(array['apple', 'google', 'gsc', 'bing', 'competitors'])),$a$,
  $a$from days x where not exists (select 1 from ok where ok.source = s.source and ok.day = x.day)
$a$,
  $a$from days x where not exists (select 1 from ok where ok.source = s.source and ok.day = x.day) and x.day < t and s.source not in ('seo', 'aivis', 'kw_ideas')
$a$,
  $a$(select max(at) from public.sync_log l where l.source = s.source and l.ok) last_ok,$a$,
  $a$case when s.source in ('seo', 'aivis', 'kw_ideas') then 'heti' when s.source in ('tiktok', 'instagram', 'pinterest', 'facebook', 'linkedin', 'youtube') then 'óránként' else 'napi' end schedule,
      s.source in ('seo', 'aivis', 'kw_ideas') and coalesce((select max(at) from public.sync_log l where l.source = s.source and l.ok), '-infinity') < now() - interval '8 days' late,
      not exists (select 1 from public.sync_log l where l.source = s.source and l.ok) never,
      coalesce((select l.message ~* '(^|[:·;] *)(üres:|részben:|kihagyva)|sikertelen|hibás' or (l.rows = 0 and s.source = 'bing') from public.sync_log l where l.source = s.source and l.ok order by l.at desc limit 1), false) partial,
      (select max(at) from public.sync_log l where l.source = s.source and l.ok) last_ok,$a$]);

-- ======================================== from Calligra 20270128_admin_post_peers_age
-- A post's "usual level": posts younger than a day are still climbing and pulled the median down; they no longer count.
do $$ declare d text; a text := 'and views > 0 and gone_at is null order by created_at desc nulls last limit 300'; begin
  d := pg_get_functiondef('public.admin_post'::regproc);
  if position(a in d) = 0 then raise exception 'not found'; end if;
  execute replace(d, a, 'and views > 0 and gone_at is null and created_at < now() - interval ''24 hours'' order by created_at desc nulls last limit 300');
end $$;

-- ======================================== from Calligra 20270129_admin_rpc_cache
-- Admin numbers kept ready on the server.
-- The phone asks for ~20 admin functions at once and again every minute. Each takes 0.1-1.7 s alone, but together
-- they ran past the 8 s statement timeout ("canceling statement due to statement timeout") and the screen kept
-- showing the numbers of half an hour or two hours before. Now every read goes through admin_cached: an answer
-- younger than p_max_age seconds comes from admin_rpc_cache at once, an older one is computed (one at a time per
-- key) and saved. While the admin is open (asked in the last 5 minutes), pg_cron recomputes every saved answer
-- once a minute, one after the other, so the phone almost never computes and never waits.

create table if not exists public.admin_rpc_cache (
  fn text not null,
  args jsonb not null default '{}'::jsonb,
  data jsonb,
  at timestamptz not null default now(),
  wanted_at timestamptz not null default now(),
  ms integer,
  err text,
  primary key (fn, args)
);
alter table public.admin_rpc_cache enable row level security;
revoke all on public.admin_rpc_cache from anon, authenticated;

-- the call as SQL: only a stable public admin_ function, the names quoted, every value a literal
create or replace function public.admin_cache_sql(p_fn text, p_args jsonb)
returns text
language plpgsql
stable
set search_path to ''
as $$
declare
  ret_set boolean;
  call text;
begin
  if p_fn !~ '^admin_[a-z0-9_]+$' then return null; end if;
  select bool_or(p.proretset) into ret_set
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = p_fn and p.provolatile = 's';
  if ret_set is null then return null; end if;
  select format('public.%I(%s)', p_fn, coalesce(string_agg(format('%I => %L', k,
           case jsonb_typeof(v) when 'null' then null when 'string' then v #>> '{}' else v::text end), ', ' order by k), ''))
    into call
    from jsonb_each(coalesce(p_args, '{}'::jsonb)) e(k, v);
  if ret_set then
    return format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %s x', call);
  end if;
  return format('select to_jsonb(%s)', call);
end $$;
revoke all on function public.admin_cache_sql(text, jsonb) from public, anon, authenticated;

create or replace function public.admin_cached(p_fn text, p_args jsonb default '{}'::jsonb, p_max_age integer default 45)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  q text;
  r public.admin_rpc_cache;
  res jsonb;
  t0 timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  q := public.admin_cache_sql(p_fn, a);
  if q is null then return jsonb_build_object('nocache', true); end if;

  update public.admin_rpc_cache c set wanted_at = now() where c.fn = p_fn and c.args = a returning * into r;
  if r.fn is not null and r.err is null and r.at > now() - make_interval(secs => greatest(coalesce(p_max_age, 45), 0)) then
    return jsonb_build_object('d', r.data, 'at', r.at);
  end if;

  -- the same numbers asked twice at once are computed once: the second waits for the first and takes its answer
  perform pg_advisory_xact_lock(hashtext('admin_cached:' || p_fn || a::text));
  select * into r from public.admin_rpc_cache c where c.fn = p_fn and c.args = a;
  if r.fn is not null and r.err is null and r.at > now() - make_interval(secs => greatest(coalesce(p_max_age, 45), 0)) then
    return jsonb_build_object('d', r.data, 'at', r.at);
  end if;

  t0 := clock_timestamp();
  begin
    execute q into res;
  exception
    when query_canceled then
      -- out of time: the last answer, with its own time, rather than nothing
      if r.fn is not null and r.data is not null then
        return jsonb_build_object('d', r.data, 'at', r.at, 'stale', true);
      end if;
      raise;
    when others then
      -- forbidden, a wrong argument or a type this path cannot pass: the browser asks the function itself
      return jsonb_build_object('nocache', true, 'err', sqlerrm);
  end;
  insert into public.admin_rpc_cache as c (fn, args, data, at, wanted_at, ms, err)
  values (p_fn, a, res, now(), now(), (extract(epoch from clock_timestamp() - t0) * 1000)::int, null)
  on conflict (fn, args) do update set data = excluded.data, at = excluded.at, wanted_at = excluded.wanted_at, ms = excluded.ms, err = null;
  return jsonb_build_object('d', res, 'at', now());
end $$;
revoke all on function public.admin_cached(text, jsonb, integer) from public, anon;
grant execute on function public.admin_cached(text, jsonb, integer) to authenticated;

-- the admin functions that change something: after one of them the browser asks for fresh numbers
create or replace function public.admin_cache_writers()
returns text[]
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select coalesce(array_agg(distinct p.proname), '{}') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin\_%' and p.provolatile = 'v');
end $$;
revoke all on function public.admin_cache_writers() from public, anon;
grant execute on function public.admin_cache_writers() to authenticated;

-- once a minute while the admin is open: every answer asked for in the last 5 minutes is computed again, oldest first,
-- one at a time, as the owner (the functions check is_admin), within 50 seconds
create or replace function public.admin_cache_tick()
returns integer
language plpgsql
volatile
security definer
set search_path to ''
set statement_timeout to '58s'
as $$
declare
  uid uuid;
  r record;
  q text;
  res jsonb;
  t0 timestamptz;
  start timestamptz := clock_timestamp();
  n integer := 0;
begin
  delete from public.admin_rpc_cache where wanted_at < now() - interval '2 days';
  select u.id into uid from auth.users u join public.admin_emails e on e.email = lower(u.email)
   where u.email_confirmed_at is not null order by u.created_at limit 1;
  if uid is null then return 0; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  for r in select c.fn, c.args from public.admin_rpc_cache c
            where c.wanted_at > now() - interval '5 minutes' and c.at < now() - interval '40 seconds'
            order by c.at loop
    exit when clock_timestamp() - start > interval '50 seconds';
    q := public.admin_cache_sql(r.fn, r.args);
    continue when q is null;
    t0 := clock_timestamp();
    begin
      execute q into res;
      update public.admin_rpc_cache c set data = res, at = clock_timestamp(), ms = (extract(epoch from clock_timestamp() - t0) * 1000)::int, err = null
       where c.fn = r.fn and c.args = r.args;
      n := n + 1;
    exception when others then
      update public.admin_rpc_cache c set err = left(sqlerrm, 300) where c.fn = r.fn and c.args = r.args;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.admin_cache_tick() from public, anon, authenticated;

-- ======================================== from Calligra 20270129_invoices
-- Billingo invoices for web (Stripe) sales, one row per Checkout Session (lib/billingo.ts). The row is the lock and the
-- memory: a sale is invoiced once however often Stripe repeats the webhook, a failed attempt is retried by the 5-minute
-- run, and a refund cancels the invoice it belongs to. Only the server (service role) reads or writes it.
create table if not exists public.invoices (
  session_id text primary key,
  payment_intent text unique,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'failed', 'manual', 'void', 'cancel_pending', 'canceled')),
  payload jsonb not null,
  partner_id bigint,
  doc_id bigint,
  attempts integer not null default 0,
  last_error text,
  -- something the owner has to settle by hand (a partial refund, a sale with tax on it); the 5-minute run sends it to the admin phone
  note text,
  -- held while one request works on the row; a lock older than five minutes is treated as abandoned
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_open on public.invoices (status, updated_at) where status not in ('done', 'void', 'canceled');
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;

-- ======================================== from Calligra 20270130_social_extra_accounts
-- More TikTok and Instagram accounts (up to 10 per platform) next to the main Calligra ones. The main accounts keep
-- their own tables (social_accounts, social_posts, …) and every page built on them stays as it is; the extra accounts
-- (Daria, the partners' accounts abroad) live in their own tables here, each with its own bio short link
-- (inkage.app/v/<code>), so the sign-ups that came through it are counted for that account.
-- A partner abroad connects their own account from their own phone through a one-time invite link: the owner never
-- signs in to their TikTok from Hungary. Only the invite's hash is stored; it lasts 14 days and works once.

create table if not exists public.social_extra_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok', 'instagram')),
  label text not null check (length(label) between 1 and 60),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  code text references public.short_links (code) on update cascade on delete set null,
  account_id text, username text, display_name text, avatar_url text,
  access_token text, refresh_token text, token_expires_at timestamptz, refresh_expires_at timestamptz, scopes text,
  invite_hash text, invite_expires_at timestamptz,
  created_at timestamptz not null default now(), connected_at timestamptz, last_sync_at timestamptz, last_error text,
  unique (platform, account_id)
);
create table if not exists public.social_extra_daily (
  account uuid not null references public.social_extra_accounts (id) on delete cascade, day date not null,
  followers bigint, following bigint, likes bigint, posts bigint,
  primary key (account, day)
);
create table if not exists public.social_extra_posts (
  account uuid not null references public.social_extra_accounts (id) on delete cascade, post_id text not null,
  created_at timestamptz, kind text, title text, url text, thumb text, duration integer,
  views bigint, likes bigint, comments bigint, shares bigint, saves bigint, reach bigint,
  updated_at timestamptz not null default now(),
  primary key (account, post_id)
);
create table if not exists public.social_extra_post_daily (
  account uuid not null references public.social_extra_accounts (id) on delete cascade, post_id text not null, day date not null,
  views bigint, likes bigint, comments bigint, shares bigint,
  primary key (account, post_id, day)
);
alter table public.social_extra_accounts enable row level security;
alter table public.social_extra_daily enable row level security;
alter table public.social_extra_posts enable row level security;
alter table public.social_extra_post_daily enable row level security;

-- ---------- the owner: add, rename, new invite, remove ----------
create or replace function public.admin_extra_code(p_label text, p_country text)
returns text language plpgsql set search_path = '' as $$
declare base text := left(trim(both '-' from regexp_replace(lower(translate(coalesce(p_label, ''), 'áéíóöőúüűÁÉÍÓÖŐÚÜŰäßÄ', 'aeiooouuuAEIOOOUUUasA')), '[^a-z0-9]+', '-', 'g')), 30);
  c text; i int := 1;
begin
  if base = '' then base := 'fiok'; end if;
  if p_country is not null then base := base || '-' || lower(p_country); end if;
  c := base;
  while exists (select 1 from public.short_links where code = c) loop i := i + 1; c := left(base, 36) || '-' || i; end loop;
  return c;
end $$;
revoke all on function public.admin_extra_code(text, text) from public, anon, authenticated;

create or replace function public.admin_extra_new_invite(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.social_extra_accounts set invite_hash = encode(extensions.digest(t, 'sha256'), 'hex'), invite_expires_at = now() + interval '14 days' where id = p_id;
  if not found then raise exception 'nincs ilyen fiók'; end if;
  return t;
end $$;

create or replace function public.admin_extra_create(p_platform text, p_label text, p_country text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cc text := nullif(upper(trim(coalesce(p_country, ''))), ''); c text; nid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_platform not in ('tiktok', 'instagram') then raise exception 'csak TikTok vagy Instagram'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'adj nevet a fióknak'; end if;
  if cc is not null and cc !~ '^[A-Z]{2}$' then raise exception 'az ország kétbetűs kód (pl. DE)'; end if;
  if (select count(*) from public.social_extra_accounts where platform = p_platform) >= 10 then raise exception 'legfeljebb 10 további fiók lehet platformonként'; end if;
  c := public.admin_extra_code(p_label, cc);
  insert into public.short_links (code, source, medium, campaign, note) values (c, p_platform, 'bio', c, 'Bio-link: ' || trim(p_label));
  insert into public.social_extra_accounts (platform, label, country, code) values (p_platform, trim(p_label), cc, c) returning id into nid;
  perform public.admin_audit_add('kapcsolat.uj_fiok', p_platform, jsonb_build_object('label', trim(p_label), 'code', c));
  return jsonb_build_object('id', nid, 'code', c, 'invite', public.admin_extra_new_invite(nid));
end $$;

create or replace function public.admin_extra_update(p_id uuid, p_label text, p_country text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare cc text := nullif(upper(trim(coalesce(p_country, ''))), '');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(trim(p_label), '') = '' then raise exception 'adj nevet a fióknak'; end if;
  if cc is not null and cc !~ '^[A-Z]{2}$' then raise exception 'az ország kétbetűs kód (pl. DE)'; end if;
  update public.social_extra_accounts set label = trim(p_label), country = cc where id = p_id;
end $$;

-- the account and its numbers go; its short link stays (old bio links keep working and keep their visits)
create or replace function public.admin_extra_delete(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.social_extra_accounts where id = p_id returning label into l;
  perform public.admin_audit_add('kapcsolat.fiok_torles', coalesce(l, '?'), '{}');
end $$;

-- ---------- connecting: the invite (anyone with the link, once) or the owner herself ----------
create or replace function public.social_invite_info(p_invite text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'platform', platform, 'label', label) from public.social_extra_accounts
  where p_invite ~ '^[0-9a-f]{48}$' and invite_hash = encode(extensions.digest(p_invite, 'sha256'), 'hex') and invite_expires_at > now()
$$;

create or replace function public.admin_extra_save(p_id uuid, p_row jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare a public.social_extra_accounts; aid text := nullif(p_row->>'account_id', '');
begin
  select * into a from public.social_extra_accounts where id = p_id;
  if a.id is null then raise exception 'nincs ilyen fiók'; end if;
  if aid is null then raise exception 'a platform nem adta meg a fiók azonosítóját'; end if;
  if exists (select 1 from public.social_accounts where platform = a.platform and account_id = aid) then raise exception 'ez a fő InkAge-fiók, az már be van kötve'; end if;
  if exists (select 1 from public.social_extra_accounts where platform = a.platform and account_id = aid and id <> p_id) then raise exception 'ez a fiók már be van kötve egy másik helyen'; end if;
  update public.social_extra_accounts set account_id = aid, username = p_row->>'username', display_name = p_row->>'display_name', avatar_url = p_row->>'avatar_url',
    access_token = p_row->>'access_token', refresh_token = p_row->>'refresh_token', token_expires_at = (p_row->>'token_expires_at')::timestamptz,
    refresh_expires_at = (p_row->>'refresh_expires_at')::timestamptz, scopes = p_row->>'scopes', connected_at = now(), last_error = null,
    invite_hash = null, invite_expires_at = null
  where id = p_id;
  return a.label;
end $$;
revoke all on function public.admin_extra_save(uuid, jsonb) from public, anon, authenticated;

create or replace function public.social_invite_claim(p_invite text, p_row jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare i jsonb := public.social_invite_info(p_invite);
begin
  if i is null then raise exception 'a meghívó lejárt vagy már felhasználták'; end if;
  return public.admin_extra_save((i->>'id')::uuid, p_row);
end $$;

create or replace function public.admin_w_extra_connect(p_token text, p_id uuid, p_row jsonb)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.admin_extra_save(p_id, p_row);
end $$;

-- ---------- the sync (server only) ----------
create or replace function public.admin_r_extra_accounts(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.admin_secrets where k = 'server_lock' and v = 'on') then
    if p_token is null or length(p_token) <> 64 or p_token not in (select v from public.admin_secrets where k in ('server', 'cron')) then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'platform', platform, 'label', label, 'account_id', account_id, 'access_token', access_token, 'refresh_token', refresh_token,
    'token_expires_at', token_expires_at, 'last_sync_at', last_sync_at, 'scopes', scopes)) from public.social_extra_accounts where access_token is not null), '[]');
end $$;

create or replace function public.admin_w_extra_patch(p_token text, p_id uuid, p_set jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.social_extra_accounts a set
    username = case when p_set ? 'username' then p_set->>'username' else a.username end,
    display_name = case when p_set ? 'display_name' then p_set->>'display_name' else a.display_name end,
    avatar_url = case when p_set ? 'avatar_url' then p_set->>'avatar_url' else a.avatar_url end,
    access_token = case when p_set ? 'access_token' then p_set->>'access_token' else a.access_token end,
    refresh_token = case when p_set ? 'refresh_token' then p_set->>'refresh_token' else a.refresh_token end,
    token_expires_at = case when p_set ? 'token_expires_at' then (p_set->>'token_expires_at')::timestamptz else a.token_expires_at end,
    refresh_expires_at = case when p_set ? 'refresh_expires_at' then (p_set->>'refresh_expires_at')::timestamptz else a.refresh_expires_at end,
    last_sync_at = case when p_set ? 'last_sync_at' then (p_set->>'last_sync_at')::timestamptz else a.last_sync_at end,
    last_error = case when p_set ? 'last_error' then p_set->>'last_error' else a.last_error end
  where a.id = p_id;
end $$;

-- one read of one account: its numbers of the day and its posts (with the day's row of each post)
create or replace function public.admin_w_extra_sync(p_token text, p_id uuid, p_day date, p_daily jsonb, p_posts jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare k integer;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_daily is not null then
    insert into public.social_extra_daily (account, day, followers, following, likes, posts)
    values (p_id, p_day, (p_daily->>'followers')::bigint, (p_daily->>'following')::bigint, (p_daily->>'likes')::bigint, (p_daily->>'posts')::bigint)
    on conflict (account, day) do update set followers = coalesce(excluded.followers, public.social_extra_daily.followers), following = coalesce(excluded.following, public.social_extra_daily.following),
      likes = coalesce(excluded.likes, public.social_extra_daily.likes), posts = coalesce(excluded.posts, public.social_extra_daily.posts);
  end if;
  insert into public.social_extra_posts (account, post_id, created_at, kind, title, url, thumb, duration, views, likes, comments, shares, saves, reach, updated_at)
  select p_id, r->>'post_id', (r->>'created_at')::timestamptz, r->>'kind', left(r->>'title', 300), r->>'url', r->>'thumb', (r->>'duration')::int,
    (r->>'views')::bigint, (r->>'likes')::bigint, (r->>'comments')::bigint, (r->>'shares')::bigint, (r->>'saves')::bigint, (r->>'reach')::bigint, now()
  from jsonb_array_elements(coalesce(p_posts, '[]')) r where coalesce(r->>'post_id', '') <> ''
  on conflict (account, post_id) do update set created_at = coalesce(excluded.created_at, public.social_extra_posts.created_at), kind = coalesce(excluded.kind, public.social_extra_posts.kind),
    title = coalesce(excluded.title, public.social_extra_posts.title), url = coalesce(excluded.url, public.social_extra_posts.url), thumb = coalesce(excluded.thumb, public.social_extra_posts.thumb),
    duration = coalesce(excluded.duration, public.social_extra_posts.duration), views = coalesce(excluded.views, public.social_extra_posts.views), likes = coalesce(excluded.likes, public.social_extra_posts.likes),
    comments = coalesce(excluded.comments, public.social_extra_posts.comments), shares = coalesce(excluded.shares, public.social_extra_posts.shares),
    saves = coalesce(excluded.saves, public.social_extra_posts.saves), reach = coalesce(excluded.reach, public.social_extra_posts.reach), updated_at = now();
  get diagnostics k = row_count;
  insert into public.social_extra_post_daily (account, post_id, day, views, likes, comments, shares)
  select p_id, r->>'post_id', p_day, (r->>'views')::bigint, (r->>'likes')::bigint, (r->>'comments')::bigint, (r->>'shares')::bigint
  from jsonb_array_elements(coalesce(p_posts, '[]')) r where coalesce(r->>'post_id', '') <> ''
  on conflict (account, post_id, day) do update set views = coalesce(excluded.views, public.social_extra_post_daily.views), likes = coalesce(excluded.likes, public.social_extra_post_daily.likes),
    comments = coalesce(excluded.comments, public.social_extra_post_daily.comments), shares = coalesce(excluded.shares, public.social_extra_post_daily.shares);
  return k;
end $$;

-- ---------- the page: every account side by side, main and extra ----------
-- k: 'main:tiktok' / 'main:instagram' for the Calligra accounts, the id for the others.
-- Views in the period: each post's views now minus its views on the last day before the period (0 for a post made in it).
-- Sign-ups: the sign-ups whose matched visit came through the account's bio link (its code); for the main accounts the
-- sign-ups of the channel (TikTok / Instagram) that did not come through an extra account's link. "biztos"/"jo" count as known.
create or replace function public.admin_extra_overview(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d int := greatest(1, least(coalesce(p_days, 7), 365)); t0 timestamptz := now() - make_interval(days => d);
  d0 date := (now() at time zone 'Europe/Budapest')::date - (d - 1); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with acc as (
    select 'main:' || a.platform k, a.platform, coalesce(a.display_name, a.username, 'InkAge') label, null::text country, null::text code, a.username, a.display_name, a.avatar_url,
      true main, true connected, false invite_open, null::timestamptz invite_expires_at, a.last_sync_at, a.last_error, a.connected_at created_at
    from public.social_accounts a where a.platform in ('tiktok', 'instagram')
    union all
    select x.id::text, x.platform, x.label, x.country, x.code, x.username, x.display_name, x.avatar_url, false, x.access_token is not null,
      x.invite_hash is not null and x.invite_expires_at > now(), case when x.invite_hash is not null then x.invite_expires_at end, x.last_sync_at, x.last_error, x.created_at
    from public.social_extra_accounts x
  ), posts as (
    select 'main:' || p.platform k, p.post_id, p.created_at, p.title, p.url, p.thumb, p.views, p.likes, p.comments, p.shares from public.social_posts p
    where p.platform in ('tiktok', 'instagram') and p.gone_at is null
    union all select e.account::text, e.post_id, e.created_at, e.title, e.url, e.thumb, e.views, e.likes, e.comments, e.shares from public.social_extra_posts e
  ), pd as (
    select 'main:' || q.platform k, q.post_id, q.day, q.views from public.social_post_daily q where q.platform in ('tiktok', 'instagram')
    union all select e.account::text, e.post_id, e.day, e.views from public.social_extra_post_daily e
  ), ad as (
    select 'main:' || q.platform k, q.day, q.followers, q.likes, q.posts from public.social_account_daily q where q.platform in ('tiktok', 'instagram') and q.followers is not null
    union all select e.account::text, e.day, e.followers, e.likes, e.posts from public.social_extra_daily e
  ), gain as (
    select p.*, greatest(0, coalesce(p.views, 0) - coalesce((select b.views from pd b where b.k = p.k and b.post_id = p.post_id and b.day < d0 order by b.day desc limit 1),
      case when p.created_at >= t0 then 0 else coalesce(p.views, 0) end)) g
    from posts p
  ), med as (
    select k, percentile_cont(0.5) within group (order by coalesce(views, 0)) m from posts group by k
  ), series as (
    select z.k, z.day, sum(greatest(0, coalesce(z.views, 0) - coalesce(z.prev, 0))) filter (where z.prev is not null or p.created_at >= t0) v from (
      select k, post_id, day, views, lag(views) over (partition by k, post_id order by day) prev from pd) z
    left join posts p on p.k = z.k and p.post_id = z.post_id
    where z.day >= d0 group by z.k, z.day
  ), su as (
    select m.user_id, m.created_at, m.lang, m.provider, m.ch, m.code, m.conf from public.admin_signups_matched(t0, now()) m where m.session is not null
  ), su2 as (
    select coalesce(x.id::text, case when su.ch in ('tiktok', 'instagram') and su.conf <> 'gyenge' then 'main:' || su.ch end) k, su.*,
      exists (select 1 from public.purchases pu where pu.user_id = su.user_id and coalesce(pu.amount, 0) > 0) paid
    from su left join public.social_extra_accounts x on x.code is not null and x.code = su.code
  )
  select jsonb_build_object('days', d, 'from', t0, 'accounts', coalesce(jsonb_agg(row order by row->>'platform', (row->>'main')::boolean desc, row->>'created_at'), '[]')) into res
  from (
    select to_jsonb(a) || jsonb_build_object(
      'followers', (select followers from ad where ad.k = a.k order by day desc limit 1),
      'followers_before', (select followers from ad where ad.k = a.k and ad.day < d0 order by day desc limit 1),
      'likes_total', (select likes from ad where ad.k = a.k order by day desc limit 1),
      'posts_total', (select count(*) from posts where posts.k = a.k),
      'posts_new', (select count(*) from posts where posts.k = a.k and posts.created_at >= t0),
      'views_total', (select coalesce(sum(views), 0) from posts where posts.k = a.k),
      'views_period', (select coalesce(sum(g), 0) from gain where gain.k = a.k),
      'median_views', (select m from med where med.k = a.k),
      'top', coalesce((select jsonb_agg(t) from (
        select g.post_id, g.created_at, g.title, g.url, g.thumb, g.views, g.likes, g.comments, g.shares, g.g gained,
          (coalesce(g.views, 0) >= 1000 and coalesce(g.views, 0) >= 5 * greatest(1, coalesce((select m from med where med.k = a.k), 0))) viral
        from gain g where g.k = a.k order by g.g desc, g.views desc nulls last limit 6) t), '[]'),
      'series', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'views', s.v, 'followers', (select followers from ad where ad.k = a.k and ad.day = s.day)) order by s.day) from series s where s.k = a.k), '[]'),
      'clicks', case when a.code is null then null else (select count(*) from public.link_clicks c where c.code = a.code and c.at >= t0) end,
      'visits', case when a.code is null then null else (select count(distinct e.session) from public.events_real e where e.props->'src'->>'ux' = a.code and e.created_at >= t0 and e.session is not null) end,
      'signups', (select count(*) from su2 where su2.k = a.k),
      'signups_sure', (select count(*) from su2 where su2.k = a.k and su2.conf in ('biztos', 'jo')),
      'paid', (select count(*) from su2 where su2.k = a.k and su2.paid),
      'recent', coalesce((select jsonb_agg(r) from (select su2.user_id id, su2.created_at, su2.lang, su2.provider, su2.conf, su2.paid from su2 where su2.k = a.k order by su2.created_at desc limit 15) r), '[]')
    ) row from acc a
  ) z;
  return res;
end $$;

-- the code → account name pairs, for naming the account on a sign-up's source
create or replace function public.admin_extra_codes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then coalesce((select jsonb_object_agg(code, jsonb_build_object('label', label, 'platform', platform, 'country', country)) from public.social_extra_accounts where code is not null), '{}') end
$$;

revoke all on function public.admin_extra_new_invite(uuid), public.admin_extra_create(text, text, text), public.admin_extra_update(uuid, text, text), public.admin_extra_delete(uuid),
  public.admin_extra_overview(integer), public.admin_extra_codes() from public, anon;
grant execute on function public.admin_extra_new_invite(uuid), public.admin_extra_create(text, text, text), public.admin_extra_update(uuid, text, text), public.admin_extra_delete(uuid),
  public.admin_extra_overview(integer), public.admin_extra_codes() to authenticated;
revoke all on function public.social_invite_info(text), public.social_invite_claim(text, jsonb), public.admin_w_extra_connect(text, uuid, jsonb), public.admin_r_extra_accounts(text),
  public.admin_w_extra_patch(text, uuid, jsonb), public.admin_w_extra_sync(text, uuid, date, jsonb, jsonb) from public;
grant execute on function public.social_invite_info(text), public.social_invite_claim(text, jsonb), public.admin_w_extra_connect(text, uuid, jsonb), public.admin_r_extra_accounts(text),
  public.admin_w_extra_patch(text, uuid, jsonb), public.admin_w_extra_sync(text, uuid, date, jsonb, jsonb) to anon, authenticated;

-- the platform's app keys for an invite's sign-in: only with the server's own secret (Vercel SOCIAL_INVITE_TOKEN =
-- admin_secrets 'invite_srv') and a valid invite, and only that platform's two keys
create or replace function public.social_invite_keys(p_srv text, p_invite text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i jsonb; pre text;
begin
  if p_srv is null or length(p_srv) <> 64 or not exists (select 1 from public.admin_secrets where k = 'invite_srv' and v = p_srv) then raise exception 'forbidden' using errcode = '42501'; end if;
  i := public.social_invite_info(p_invite);
  if i is null then return null; end if;
  pre := case i->>'platform' when 'tiktok' then 'TIKTOK_CLIENT_' else 'INSTAGRAM_APP_' end;
  return (select jsonb_object_agg(substr(name, 16), decrypted_secret) from vault.decrypted_secrets
    where name in ('inkage_admin.' || pre || case when pre = 'TIKTOK_CLIENT_' then 'KEY' else 'ID' end, 'inkage_admin.' || pre || 'SECRET'));
end $$;
revoke all on function public.social_invite_keys(text, text) from public;
grant execute on function public.social_invite_keys(text, text) to anon, authenticated;

-- the tables are read and written only through the functions above
revoke all on table public.social_extra_accounts, public.social_extra_daily, public.social_extra_posts, public.social_extra_post_daily from anon, authenticated;
-- the server's own secret for invite sign-ins; the same value goes into Vercel as SOCIAL_INVITE_TOKEN
insert into public.admin_secrets (k, v) values ('invite_srv', encode(extensions.gen_random_bytes(32), 'hex')) on conflict (k) do nothing;

-- ======================================== from Calligra 20270201_admin_feedback_range
-- Visszajelzések: a chosen day or range (Budapest days), and the exact time of every rating per style and store.
drop function if exists public.admin_feedback(integer);
create or replace function public.admin_feedback(p_days integer, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  /* a chosen range wins: from its first Budapest midnight to the midnight after its last day; else the last p_days days */
  t0 timestamptz := case when p_from is not null then (p_from::timestamp at time zone 'Europe/Budapest')
                         when coalesce(p_days, 0) <= 0 then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;
  t1 timestamptz := case when p_from is not null then ((coalesce(p_to, p_from) + 1)::timestamp at time zone 'Europe/Budapest') else 'infinity'::timestamptz end;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with sr as (select * from public.store_reviews where created_at >= t0 and created_at < t1),
  cr as (select r.*, u.raw_user_meta_data->>'lang' lang, u.raw_app_meta_data->>'provider' provider from public.admin_ink_ratings r left join auth.users u on u.id = r.user_id
         where coalesce(r.updated_at, r.created_at) >= t0 and coalesce(r.updated_at, r.created_at) < t1 and not public.admin_own_uid(r.user_id)),
  allstars as (select rating s from sr where rating between 1 and 5 union all select stars from cr where stars between 1 and 5),
  wh as (select e.id, w why, null::text tune from public.events_real e cross join lateral unnest(string_to_array(coalesce(nullif(e.props->>'why', ''), 'other'), ',')) w
         where e.props->>'ev' = 'redo' and e.created_at >= t0 and e.created_at < t1)
  select jsonb_build_object(
    'days', p_days, 'from', t0, 'to', least(t1, now()),
    'all', jsonb_build_object('n', (select count(*) from allstars), 'avg', (select round(avg(s)::numeric, 2) from allstars),
      'dist', (select jsonb_object_agg(g, (select count(*) from allstars where s = g)) from generate_series(1, 5) g)),
    'stores', coalesce((select jsonb_agg(x order by x.store) from (
      select st store, (select count(*) from sr where sr.store = st) n, (select round(avg(rating)::numeric, 2) from sr where sr.store = st) avg,
        (select jsonb_object_agg(g, (select count(*) from sr where sr.store = st and sr.rating = g)) from generate_series(1, 5) g) dist,
        (select count(*) from sr where sr.store = st and sr.reply is null and not coalesce(sr.done, false)) open, (select max(created_at) from sr where sr.store = st) last_at
      from unnest(array['apple', 'google']) st) x), '[]'),
    'reviews', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select store, review_id, created_at, rating, title, body, author, territory, lang, version, reply, replied_at from sr order by created_at desc limit 200) x), '[]'),
    'app', jsonb_build_object('n', (select count(*) from cr), 'people', (select count(distinct user_id) from cr), 'avg', (select round(avg(stars)::numeric, 2) from cr),
      'dist', (select jsonb_object_agg(g, (select count(*) from cr where cr.stars = g)) from generate_series(1, 5) g)),
    'styles', coalesce((select jsonb_agg(x order by x.n desc, x.avg) from (
      select style, kind, count(*) n, round(avg(stars)::numeric, 2) avg, count(*) filter (where stars <= 2) low, count(*) filter (where stars >= 4) high,
        max(coalesce(updated_at, created_at)) last_at,
        jsonb_agg(jsonb_build_object('stars', stars, 'at', coalesce(updated_at, created_at), 'first', created_at) order by coalesce(updated_at, created_at) desc) list from cr group by 1, 2) x), '[]'),
    'ratings', coalesce((select jsonb_agg(x order by x.at desc) from (
      select user_id id, style, kind, stars, coalesce(updated_at, created_at) at, created_at first, lang, provider from cr order by coalesce(updated_at, created_at) desc limit 200) x), '[]'),
    'why', coalesce((select jsonb_agg(x order by x.n desc) from (select why k, count(*) n from wh where coalesce(why, '') <> '' group by 1) x), '[]'),
    'tune', coalesce((select jsonb_agg(x order by x.n desc) from (select tune k, count(*) n from wh where coalesce(tune, '') <> '' group by 1) x), '[]'),
    'why_n', (select count(distinct id) from wh)
  ) into res;
  return res;
end $$;
revoke all on function public.admin_feedback(integer, date, date) from public, anon;
grant execute on function public.admin_feedback(integer, date, date) to authenticated;

-- ======================================== from Calligra 20270202_admin_payments
-- Fizetések (/admin → Bevétel → Fizetések): every payment from the three places people pay (Stripe on the web, the
-- App Store, Google Play) in one answer. The packages are one-time purchases; "payers" are distinct accounts.
-- Refunds: a purchase row now remembers when (and how much) was given back, written by the server only.

alter table public.purchases add column if not exists refunded_at timestamptz;
alter table public.purchases add column if not exists refund_amount numeric;

create or replace function public.admin_payments(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 3650));
  a timestamptz := now() - make_interval(days => d);
  b timestamptz := now() - make_interval(days => d * 2);
  bp_today date := (now() at time zone 'Europe/Budapest')::date;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with p as (
    select x.id, x.created_at, x.user_id, x.store, x.transaction_id, x.product, x.plan, x.name_norm,
      coalesce(x.amount, 0) amount, upper(coalesce(x.currency, '?')) currency, x.refunded_at, coalesce(x.refund_amount, 0) refund_amount,
      x.plan like 'up\_%' as upgrade, (x.created_at at time zone 'Europe/Budapest')::date as day
    from public.purchases x where x.created_at >= b and not public.admin_own_uid(x.user_id)),
  cur as (select * from p where created_at >= a),
  prev as (select * from p where created_at < a),
  -- each payer's first purchase ever: a new payer in this period, or one who came back to step up
  firsts as (select user_id, min(created_at) as at from public.purchases where user_id is not null group by 1),
  newacc as (select u.id, u.created_at from auth.users u where u.created_at >= a and not public.admin_own_uid(u.id)),
  ev as (select e.name, e.session from public.events e where e.created_at >= a and e.name in ('paywall_shown', 'plan_pick', 'pay_start', 'paywall_signup', 'purchase'))
  select jsonb_build_object(
    'days', d,
    'live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false),
    'first_ever', (select min(created_at) from public.purchases),
    'all_time', (select jsonb_build_object('sales', count(*), 'payers', count(distinct user_id)) from public.purchases x where not public.admin_own_uid(x.user_id)),
    'totals', jsonb_build_object(
      'sales', (select count(*) from cur), 'payers', (select count(distinct user_id) from cur),
      'refunds', (select count(*) from cur where refunded_at is not null),
      'upgrades', (select count(*) from cur where upgrade),
      'new_payers', (select count(*) from firsts f where f.at >= a and not public.admin_own_uid(f.user_id)),
      'prev_sales', (select count(*) from prev), 'prev_payers', (select count(distinct user_id) from prev)),
    -- money per currency (the web is in dollars; the stores report in the buyer's currency)
    'rev', coalesce((select jsonb_agg(x order by x.gross desc) from (
      select currency, sum(amount) gross, sum(refund_amount) refunded, sum(amount) - sum(refund_amount) net, count(*) sales,
        round(avg(amount), 2) avg from cur group by 1) x), '[]'::jsonb),
    'rev_prev', coalesce((select jsonb_object_agg(currency, v) from (select currency, sum(amount) - sum(refund_amount) v from prev group by 1) x), '{}'::jsonb),
    'today', jsonb_build_object('sales', (select count(*) from cur where day = bp_today), 'payers', (select count(distinct user_id) from cur where day = bp_today),
      'rev', coalesce((select jsonb_object_agg(currency, v) from (select currency, sum(amount) v from cur where day = bp_today group by 1) x), '{}'::jsonb)),
    'by_store', coalesce((select jsonb_agg(x order by x.sales desc) from (
      select store, currency, count(*) sales, count(distinct user_id) payers, sum(amount) gross, sum(refund_amount) refunded,
        count(*) filter (where refunded_at is not null) refunds, max(created_at) as last from cur group by 1, 2) x), '[]'::jsonb),
    'store_prev', coalesce((select jsonb_object_agg(store, c) from (select store, count(*) c from prev group by 1) x), '{}'::jsonb),
    'by_plan', coalesce((select jsonb_agg(x order by x.sales desc) from (
      select plan, store, currency, count(*) sales, sum(amount) gross from cur group by 1, 2, 3) x), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(x order by x.day) from (
      select day, store, currency, count(*) sales, sum(amount) gross from cur group by 1, 2, 3) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(x order by x.h) from (
      select extract(hour from created_at at time zone 'Europe/Budapest')::int h, count(*) sales from cur group by 1) x), '[]'::jsonb),
    -- how long from sign-up to the first payment (hours), for those who first paid in this period
    'to_pay', (select jsonb_build_object('n', count(*),
        'median_h', round((percentile_cont(0.5) within group (order by extract(epoch from f.at - u.created_at) / 3600))::numeric, 1),
        'same_day', count(*) filter (where f.at - u.created_at < interval '24 hours'))
      from firsts f join auth.users u on u.id = f.user_id where f.at >= a and not public.admin_own_uid(f.user_id)),
    'conv', jsonb_build_object('new_accounts', (select count(*) from newacc),
      'paid', (select count(distinct c.user_id) from cur c join newacc n on n.id = c.user_id)),
    -- the paywall steps, counted by visit (session); "pay_start" is the pay button
    'steps', jsonb_build_object(
      'shown', (select count(distinct session) from ev where name = 'paywall_shown'),
      'pick', (select count(distinct session) from ev where name = 'plan_pick'),
      'start', (select count(distinct session) from ev where name in ('pay_start', 'paywall_signup')),
      'signup', (select count(distinct session) from ev where name = 'paywall_signup'),
      'bought', (select count(distinct session) from ev where name = 'purchase')),
    -- the newest payments one by one, with who and the invoice
    'recent', coalesce((select jsonb_agg(x order by x.at desc) from (
      select c.id, c.created_at as at, c.store, c.plan, c.amount, c.currency, c.name_norm name, c.transaction_id tx, c.refunded_at, c.refund_amount,
        c.user_id, u.email, u.created_at signed_up,
        (select count(*) from public.purchases q where q.user_id = c.user_id) user_sales,
        i.status invoice, i.last_error invoice_error
      from cur c left join auth.users u on u.id = c.user_id
        left join public.invoices i on c.store = 'stripe' and i.session_id = c.transaction_id
      order by c.created_at desc limit 200) x), '[]'::jsonb),
    -- the people who paid the most, all time
    'top', coalesce((select jsonb_agg(x order by x.sales desc, x.last desc) from (
      select q.user_id, u.email, count(*) sales, sum(coalesce(q.amount, 0)) gross, max(upper(coalesce(q.currency, '?'))) currency, max(q.created_at) as last
      from public.purchases q left join auth.users u on u.id = q.user_id
      where q.user_id is not null and not public.admin_own_uid(q.user_id) group by 1, 2 having count(*) > 1 order by 3 desc limit 20) x), '[]'::jsonb),
    -- Billingo: the invoices of Stripe sales
    'invoices', jsonb_build_object(
      'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.invoices where created_at >= a group by 1) x), '{}'::jsonb),
      'stuck', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select session_id, status, attempts, last_error, note, created_at, updated_at from public.invoices
        where status in ('failed', 'pending', 'cancel_pending', 'manual') and created_at >= now() - interval '90 days' order by created_at desc limit 30) x), '[]'::jsonb))
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_payments(int) from public, anon;
grant execute on function public.admin_payments(int) to authenticated;

-- ################################################################ 3. InkAge: its own fixes, again where Calligra rewrote a function

-- InkAge 2026-10-29: the journey starts at the photo picker (flow_step 'name'), not Calligra's name answer, and the intro
-- questions have no /app path or gift on InkAge. Every admin function Calligra rewrote gets the same replacement.
do $ink$
declare r record; d text; d0 text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.proname like 'admin\_%' loop
    d0 := pg_get_functiondef(r.oid); d := d0;
    d := replace(d, $a$e.name = 'quiz_answer' and e.props->>'step' = 'name'$a$, $a$e.name = 'flow_step' and e.props->>'step' = 'name'$a$);
    d := replace(d, $a$name = 'quiz_answer' and props->>'step' = 'name'$a$, $a$name = 'flow_step' and props->>'step' = 'name'$a$);
    d := replace(d, $a$e.name = 'quiz_start' and (e.props ? 'gift' or coalesce(e.path, '') like '/app%')$a$, $a$e.name = 'quiz_start'$a$);
    d := replace(d, $a$name = 'quiz_start' and (props ? 'gift' or coalesce(path, '') like '/app%')$a$, $a$name = 'quiz_start'$a$);
    if d <> d0 then execute d; end if;
  end loop;
end $ink$;

-- InkAge 2026-10-30 (2026-10-30-admin-fixes.sql): the same patches; each runs only where its fix is missing.
-- admin_funnel and admin_data_quality are wrappers now (Calligra 20261229): their fixes go to the _i functions that count.


-- admin_people: the own accounts stay listable (filter "own"); deleted and store-reviewer accounts leave every count
select public._admin_patch('public.admin_people(text,text,integer,integer,text,text,text,text,integer,timestamptz,timestamptz)', array[
  $a$with f0 as (select * from public.admin_user_facts()),$a$,
  $a$with f0 as (select x.* from public.admin_user_facts() x where x.own or exists (select 1 from public.admin_real_users ru where ru.id = x.id)),$a$])
where pg_get_functiondef('public.admin_people(text,text,integer,integer,text,text,text,text,integer,timestamptz,timestamptz)'::regprocedure) like '%with f0 as (select * from public.admin_user_facts()),%';

select public._admin_patch('public.admin_selfcheck()', array[
  $a$'found', public.admin_gsc_last(),
    'ok', coalesce(public.admin_gsc_last() >= today - 4, false), 'note', 'a Google 2–3 nap késéssel véglegesít');$a$,
  $a$'found', coalesce(public.admin_gsc_last()::text, 'nincs bekötve'),
    'ok', case when public.admin_gsc_last() is null then null else public.admin_gsc_last() >= today - 4 end,
    'note', case when public.admin_gsc_last() is null then 'még egy napi adat sincs: a Search Console bekötése a Kapcsolatok oldalon (GSC_SERVICE_ACCOUNT_JSON)' else 'a Google 2–3 nap késéssel véglegesít' end);$a$])
where pg_get_functiondef('public.admin_selfcheck()'::regprocedure) not like '%nincs bekötve%';

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

select public._admin_patch('public.admin_data_quality_i(integer)', array[
  $a$and not l.ok and l.at >= now() - make_interval(days => d)) fails$a$,
  $a$and not l.ok and not public.admin_not_connected(l.message) and l.at >= now() - make_interval(days => d)) fails$a$])
where pg_get_functiondef('public.admin_data_quality_i(integer)'::regprocedure) not like '%admin_not_connected%';

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
select public._admin_patch('public.admin_funnel_i(integer,timestamptz,timestamptz,text,text)', array[
  $a$'land_app', count(*) filter (where land and app),$a$,
  $a$'land_app', count(*) filter (where land and app), 'cta_app', count(*) filter (where land and cta and app),$a$])
where pg_get_functiondef('public.admin_funnel_i(integer,timestamptz,timestamptz,text,text)'::regprocedure) not like '%cta_app%';

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

-- ---------- 5.20 a visit's "last step" is the furthest step it reached (not the screen it happened to reopen last) ----------
select public._admin_patch('public.admin_visit(text)', array[
  $a$'last_step', (array_agg(e.props->>'step' order by e.created_at desc) filter (where e.name = 'flow_step'))[1],$a$,
  $a$'last_step', (array_agg(e.props->>'step' order by case e.props->>'step' when 'score' then 4 when 'style' then 3 when 'sign' then 2 when 'name' then 1 else 0 end desc, e.created_at desc) filter (where e.name = 'flow_step'))[1],$a$])
where pg_get_functiondef('public.admin_visit(text)'::regprocedure) not like '%when ''score'' then 4%';
-- InkAge: an account's page keeps its bonus previews ("credits", InkAge's profiles.bonus) and gift flag, as before
select public._admin_patch('public.admin_user(uuid)', array[
  $a$u.raw_user_meta_data - 'avatar_url' - 'picture' meta from auth.users u where u.id = p_id) x),$a$,
  $a$u.raw_user_meta_data - 'avatar_url' - 'picture' meta, p.credits, p.gift_claimed from auth.users u left join public.admin_ink_profiles p on p.id = u.id where u.id = p_id) x),$a$])
where pg_get_functiondef('public.admin_user(uuid)'::regprocedure) not like '%p.gift_claimed from auth.users u%';

-- InkAge: an account's finished images are its saved previews in the private "previews" bucket (Calligra: the AI
-- signatures in "celeb"). path = the fresh-tattoo image (else healed, 10, 30 or 50 years), y50 = the 50-year image;
-- the page asks for short-lived links with her own session, as on Calligra.
create or replace function public.admin_people_sigs(p_ids uuid[], p_each integer default 3)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', u.id,
      'total', (select count(*) from public.previews v where v.user_id = u.id and v.deleted_at is null
        and coalesce(v.paths->>'fresh', v.paths->>'healed', v.paths->>'y10', v.paths->>'y30', v.paths->>'y50') is not null),
      'font_saved', 0,
      'sigs', coalesce((select jsonb_agg(x order by x.at desc) from (
        select coalesce(v.paths->>'fresh', v.paths->>'healed', v.paths->>'y10', v.paths->>'y30', v.paths->>'y50') path, 'previews' bucket,
          v.paths->>'y50' y50, coalesce(nullif(v.placement, ''), '?') style, coalesce(nullif(v.placement, ''), '?') nm, v.created_at at, coalesce(v.favorite, false) fav
        from public.previews v where v.user_id = u.id and v.deleted_at is null
          and coalesce(v.paths->>'fresh', v.paths->>'healed', v.paths->>'y10', v.paths->>'y30', v.paths->>'y50') is not null
        order by v.created_at desc limit greatest(1, least(coalesce(p_each, 3), 60))) x), '[]')))
    from unnest(p_ids[1:200]) u(id)), '[]');
end $function$;
revoke all on function public.admin_people_sigs(uuid[], integer) from public, anon;
grant execute on function public.admin_people_sigs(uuid[], integer) to authenticated;

-- ################################################################ 4. pg_cron
-- Calligra's admin jobs that InkAge lacked: the RPC cache every minute, the robot marks and active days every 10 minutes.
-- InkAge's own admin-collect-days (hourly, 2026-10-29) stays: admin-bots now does the same every 10 minutes, so it is
-- only a safety net. Nothing else changes; the jobs that call the site already go to inkage.app (admin_cron_call).
-- from Calligra 20261227_admin_true_people
/* the machine marks and the active days every 10 minutes, so "today" is right the same day */
select cron.alter_job((select jobid from cron.job where jobname = 'admin-bots'), schedule := '*/10 * * * *');

-- from Calligra 20270129_admin_rpc_cache
select cron.unschedule(jobid) from cron.job where jobname = 'admin-cache';

-- from Calligra 20270129_admin_rpc_cache
select cron.schedule('admin-cache', '* * * * *', 'select public.admin_cache_tick()');
