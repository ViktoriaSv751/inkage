-- InkAge Bevétel, every part (2026-11-06): Calligra's 20270203_admin_payments_all.sql brought to InkAge, on top of
-- 2026-11-05-admin-v2.sql (which ported Calligra's admin up to 20270202). Same pages and answers as Calligra: Fizetések
-- (admin_payments(int, jsonb) replaces admin_payments(int)), Vevők, Pénzügy, Fizetési hibák, Árak és tesztek, the month's
-- close, the phone's money signals and digest, and the tables the server would fill (pay_events, stripe_tx,
-- stripe_payouts, fx_rates) and the owner keeps (pay_costs, pay_codes, admin_settings 'pay').
--
-- InkAge takes no payments, has no Stripe and no packages: every answer is an honest zero on the empty purchases /
-- invoices tables, and nothing here can write a payment. "InkAge:" comments mark every InkAge choice:
--   public.settings (payments_live)          → public.admin_ink_settings (always false), as in 2026-11-05-admin-v2.sql
--   public.celeb_claims, public.celeb_ratings → public.admin_ink_claims, public.admin_ink_ratings (empty views)
--   AI cost per month (Calligra: celeb claims) → InkAge's AI previews made (public.admin_ink_made, ok rows)
--   pay_list_usd (Calligra: Basic/Pro/Ultra 8.99/24.99/27.99, step-ups 16/19/3) → read from admin_settings 'pay'
--                                               -> 'list_usd' ({"plan": price}); empty by default, so 0
--   pay_cfg defaults: no goals (0), AI cost 0, the test without Calligra's packages; fees and the HUF limit kept
--   the account label "Calligra · tiktok" → "InkAge · tiktok"
--   record_refund (not in 2026-11-05) ported here: admin_w_refund needs it; it only marks a purchases row
--   admin_pay_grant / rename / revoke: InkAge has no grant_purchase and no unlocks by name, so they stop with
--                                       'no_packages' (after the admin check) instead of touching InkAge's credits
--   track_flags: InkAge's own flags (android_ext, ios_ext) kept, pay_ab added (null until the test is switched on)
--   Calligra defines admin_w_pay_events twice in the file; only the final one (dispute closing too) is kept here.
--   Billingo parts (invoices) read the empty invoices table and keep working.
-- Calligra's prod definitions (yaimucilncjkuaxnmpbg) were compared with the file on 2026-11-05: same logic (prod
-- has the comments inside bodies stripped and one redundant case folded in pay_rows).
-- Run it ONCE, as a whole (one transaction), or c01.sql, c02.sql in order in one session. Validated 2026-11-05 on InkAge
-- inside a rolled-back transaction (nothing kept): every statement, then the pages' calls as the admin.

-- ---------- what a purchase also knows ----------
alter table public.purchases add column if not exists country text;
alter table public.purchases add column if not exists coupon text;
alter table public.purchases add column if not exists discount numeric;
alter table public.purchases add column if not exists app_session text;
alter table public.purchases add column if not exists lang text;
alter table public.purchases add column if not exists device text;
alter table public.purchases add column if not exists ab text;
alter table public.purchases add column if not exists note text;
-- a package given by hand (a fault, a gift) is a purchase of its own kind, without money
alter table public.purchases drop constraint if exists purchases_store_check;
alter table public.purchases add constraint purchases_store_check check (store in ('apple', 'google', 'stripe', 'manual'));

create or replace function public.set_purchase_meta(p_store text, p_tx text, p_meta jsonb)
returns void language sql security definer set search_path = '' as $$
  update public.purchases set
    country = coalesce(nullif(upper(p_meta->>'country'), ''), country), coupon = coalesce(nullif(p_meta->>'coupon', ''), coupon),
    discount = coalesce((p_meta->>'discount')::numeric, discount), app_session = coalesce(nullif(p_meta->>'sess', ''), app_session),
    lang = coalesce(nullif(p_meta->>'lang', ''), lang), device = coalesce(nullif(p_meta->>'device', ''), device), ab = coalesce(nullif(p_meta->>'ab', ''), ab),
    amount = coalesce(amount, (p_meta->>'amount')::numeric), currency = coalesce(currency, nullif(p_meta->>'currency', ''))
  where store = p_store and transaction_id = p_tx
$$;
revoke execute on function public.set_purchase_meta(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.set_purchase_meta(text, text, jsonb) to service_role;

-- the price list in dollars, for a store sale that came without its price
-- InkAge: no packages and no prices. Calligra hard-codes its Basic/Pro/Ultra list here; InkAge reads it from the
-- settings instead (admin_settings 'pay' -> 'list_usd', e.g. {"list_usd": {"plan": 9.99}}), empty by default = 0.
create or replace function public.pay_list_usd(p_plan text) returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.v->'list_usd'->>p_plan)::numeric from public.admin_settings s where s.k = 'pay' and jsonb_typeof(s.v->'list_usd') = 'object'), 0)::numeric
$$;
revoke execute on function public.pay_list_usd(text) from public, anon, authenticated;

-- ---------- exchange rates: one row a day, units of each currency for 1 USD (ECB reference rates) ----------
create table if not exists public.fx_rates (day date primary key, rates jsonb not null, at timestamptz not null default now());
alter table public.fx_rates enable row level security;
revoke all on public.fx_rates from anon, authenticated;
create or replace function public.pay_usd(p_amount numeric, p_cur text, p_day date) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when p_amount is null then null when upper(coalesce(p_cur, 'USD')) in ('USD', '?') then p_amount
    else p_amount / nullif(coalesce(
      (select (r.rates->>upper(p_cur))::numeric from public.fx_rates r where r.day <= p_day and r.rates ? upper(p_cur) order by r.day desc limit 1),
      (select (r.rates->>upper(p_cur))::numeric from public.fx_rates r where r.rates ? upper(p_cur) order by r.day asc limit 1)), 0) end
$$;
create or replace function public.pay_huf_rate(p_day date) returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select (r.rates->>'HUF')::numeric from public.fx_rates r where r.day <= p_day and r.rates ? 'HUF' order by r.day desc limit 1),
    (select (r.rates->>'HUF')::numeric from public.fx_rates r where r.rates ? 'HUF' order by r.day desc limit 1), 360)
$$;
create or replace function public.admin_w_fx(p_token text, p_day date, p_rates jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.fx_rates (day, rates) values (p_day, p_rates) on conflict (day) do update set rates = excluded.rates, at = now();
end $$;

-- ---------- what Stripe, Apple and Google report besides a sale ----------
-- kinds: expired (checkout left), failed (card declined), dispute, dispute_closed, paid_missing (paid at Stripe, no package here),
-- refund_apple, refund_google, apple_notice (any other App Store notice), declined_refund
create table if not exists public.pay_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null, ref text not null,
  store text, session_id text, payment_intent text, user_id uuid references auth.users(id) on delete set null,
  plan text, amount numeric, currency text, reason text, email text, device text, country text,
  detail jsonb not null default '{}'::jsonb, resolved_at timestamptz,
  unique (kind, ref)
);
create index if not exists pay_events_at on public.pay_events (at desc);
alter table public.pay_events enable row level security;
revoke all on public.pay_events from anon, authenticated;
create or replace function public.record_pay_event(p_row jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare k int;
begin
  insert into public.pay_events (at, kind, ref, store, session_id, payment_intent, user_id, plan, amount, currency, reason, email, device, country, detail)
  values (coalesce((p_row->>'at')::timestamptz, now()), p_row->>'kind', p_row->>'ref', p_row->>'store', p_row->>'session_id', p_row->>'payment_intent',
    (select u.id from auth.users u where u.id::text = p_row->>'user_id'), p_row->>'plan', (p_row->>'amount')::numeric, upper(p_row->>'currency'),
    left(p_row->>'reason', 300), left(p_row->>'email', 200), p_row->>'device', upper(p_row->>'country'), coalesce(p_row->'detail', '{}'::jsonb))
  on conflict (kind, ref) do update set reason = coalesce(excluded.reason, public.pay_events.reason), detail = public.pay_events.detail || excluded.detail;
  get diagnostics k = row_count; return k > 0;
end $$;
revoke execute on function public.record_pay_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_pay_event(jsonb) to service_role;
-- (admin_w_pay_events: defined once, further down)
-- InkAge: record_refund was not ported on 2026-11-05 (no payments); admin_w_refund needs it. Calligra's own
-- definition: it only marks the purchases row (when, how much), so on InkAge's empty table it finds nothing.
create or replace function public.record_refund(p_store text, p_tx text, p_amount numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.purchases set refunded_at = coalesce(refunded_at, now()),
    refund_amount = greatest(coalesce(refund_amount, 0), coalesce(p_amount, amount, 0))
  where store = p_store and transaction_id = p_tx;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;
revoke execute on function public.record_refund(text, text, numeric) from public, anon, authenticated;
grant execute on function public.record_refund(text, text, numeric) to service_role;
-- the server's refund path for the stores (Apple notifications, Google's voided list), through the cron token
create or replace function public.admin_w_refund(p_token text, p_store text, p_tx text, p_amount numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.record_refund(p_store, p_tx, p_amount);
end $$;

-- ---------- Stripe's own books: every balance movement (with the exact fee) and every payout ----------
create table if not exists public.stripe_tx (
  id text primary key, created timestamptz not null, type text, amount numeric, fee numeric, net numeric, currency text,
  source text, session_id text, payment_intent text, available_on timestamptz, payout_id text, status text, description text
);
create index if not exists stripe_tx_created on public.stripe_tx (created desc);
create index if not exists stripe_tx_pi on public.stripe_tx (payment_intent);
alter table public.stripe_tx enable row level security;
revoke all on public.stripe_tx from anon, authenticated;
create table if not exists public.stripe_payouts (
  id text primary key, created timestamptz not null, arrival_date timestamptz, amount numeric, currency text, status text, method text, description text
);
alter table public.stripe_payouts enable row level security;
revoke all on public.stripe_payouts from anon, authenticated;
create or replace function public.admin_w_stripe(p_token text, p_tx jsonb, p_payouts jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a int; b int;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.stripe_tx select * from jsonb_populate_recordset(null::public.stripe_tx, coalesce(p_tx, '[]'::jsonb))
  on conflict (id) do update set fee = excluded.fee, net = excluded.net, available_on = excluded.available_on, payout_id = coalesce(excluded.payout_id, public.stripe_tx.payout_id),
    status = excluded.status, session_id = coalesce(excluded.session_id, public.stripe_tx.session_id), payment_intent = coalesce(excluded.payment_intent, public.stripe_tx.payment_intent);
  get diagnostics a = row_count;
  insert into public.stripe_payouts select * from jsonb_populate_recordset(null::public.stripe_payouts, coalesce(p_payouts, '[]'::jsonb))
  on conflict (id) do update set arrival_date = excluded.arrival_date, status = excluded.status, amount = excluded.amount;
  get diagnostics b = row_count;
  return jsonb_build_object('tx', a, 'payouts', b);
end $$;
-- where the Stripe sync should start again, and the sessions it may need to look up
create or replace function public.admin_r_stripe_state(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'last_tx', (select max(created) from public.stripe_tx),
    'last_payout', (select max(created) from public.stripe_payouts),
    'sessions', coalesce((select jsonb_agg(transaction_id) from public.purchases where store = 'stripe' and created_at > now() - interval '3 days'), '[]'::jsonb),
    'fx_day', (select max(day) from public.fx_rates));
end $$;

-- ---------- the owner's own numbers: costs, partner codes, settings ----------
create table if not exists public.pay_costs (
  id bigint generated always as identity primary key, month date not null, label text not null, amount numeric not null,
  currency text not null default 'USD', recurring boolean not null default false, created_at timestamptz not null default now()
);
alter table public.pay_costs enable row level security;
revoke all on public.pay_costs from anon, authenticated;
create table if not exists public.pay_codes (
  code text primary key, partner text, account_id bigint, percent numeric, commission numeric, stripe_coupon text, stripe_promo text,
  active boolean not null default true, note text, created_at timestamptz not null default now()
);
alter table public.pay_codes enable row level security;
revoke all on public.pay_codes from anon, authenticated;

create or replace function public.admin_pay_cost_save(p_month date, p_label text, p_amount numeric, p_currency text default 'USD', p_recurring boolean default false, p_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare i bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.pay_costs (month, label, amount, currency, recurring) values (date_trunc('month', p_month)::date, left(p_label, 80), p_amount, upper(coalesce(p_currency, 'USD')), coalesce(p_recurring, false)) returning id into i;
  else
    update public.pay_costs set month = date_trunc('month', p_month)::date, label = left(p_label, 80), amount = p_amount, currency = upper(coalesce(p_currency, 'USD')), recurring = coalesce(p_recurring, false) where id = p_id returning id into i;
  end if;
  perform public.admin_audit_add('pay_cost', coalesce(i::text, ''), jsonb_build_object('label', p_label, 'amount', p_amount, 'currency', p_currency));
  return i;
end $$;
create or replace function public.admin_pay_cost_delete(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.pay_costs where id = p_id;
  perform public.admin_audit_add('pay_cost_delete', p_id::text, '{}'::jsonb);
end $$;
-- a partner code once Stripe made it (the server route creates the coupon and the promotion code first)
create or replace function public.admin_pay_code_save(p_code text, p_partner text, p_percent numeric, p_commission numeric, p_coupon text default null, p_promo text default null, p_note text default null, p_active boolean default true, p_account bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.pay_codes (code, partner, percent, commission, stripe_coupon, stripe_promo, note, active, account_id)
  values (upper(p_code), p_partner, p_percent, p_commission, p_coupon, p_promo, p_note, coalesce(p_active, true), p_account)
  on conflict (code) do update set partner = excluded.partner, percent = coalesce(excluded.percent, public.pay_codes.percent), commission = excluded.commission,
    stripe_coupon = coalesce(excluded.stripe_coupon, public.pay_codes.stripe_coupon), stripe_promo = coalesce(excluded.stripe_promo, public.pay_codes.stripe_promo),
    note = excluded.note, active = excluded.active, account_id = excluded.account_id;
  perform public.admin_audit_add('pay_code', upper(p_code), jsonb_build_object('partner', p_partner, 'percent', p_percent, 'commission', p_commission, 'active', p_active));
end $$;

-- the settings the pages use (goal, fees, limits, the test); one row in admin_settings
-- InkAge: no goals yet (0), no AI cost guess (0), no price list, and the test names no Calligra package; the owner sets
-- them on the Pénzügy page. The store and Stripe fee rates, the commission and the HUF limit are Calligra's defaults.
create or replace function public.pay_cfg() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('goal_day', 0, 'goal_month', 0, 'apple_sbp', true, 'google_rate', 0.15, 'stripe_pct', 0.029, 'stripe_fix', 0.30,
    'ai_cost', 0, 'vat_limit_huf', 20000000, 'commission', 0.2, 'currency', 'USD', 'list_usd', '{}'::jsonb,
    'ab', jsonb_build_object('on', false, 'id', null, 'a', null, 'b', null))
    || coalesce((select v from public.admin_settings where k = 'pay'), '{}'::jsonb)
$$;
revoke execute on function public.pay_cfg() from public, anon;

-- the web paywall's test: which package is chosen first (never a price); read by the app with the other flags
-- InkAge: InkAge's own flags (android_ext, ios_ext, as defined on 2026-11-05) stay exactly as they are; pay_ab is added
create or replace function public.track_flags() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'android_ext', coalesce((select (v #>> '{}')::boolean from public.admin_settings where k = 'track_android_ext'), false),
    'ios_ext', coalesce((select (v #>> '{}')::boolean from public.admin_settings where k = 'track_ios_ext'), false),
    'pay_ab', (select case when coalesce((c->'ab'->>'on')::boolean, false) then c->'ab' end from (select public.pay_cfg() c) x))
$$;
grant execute on function public.track_flags() to anon, authenticated;

-- ---------- what she does by hand: a package given, a name corrected, a package taken back ----------
-- InkAge: no packages. Calligra's admin_pay_grant calls grant_purchase (a Basic/Pro/Ultra unlock for a name) and
-- rename / revoke edit unlocks and celeb_claims by name; InkAge has none of these (its credits are profiles.bonus).
-- The three stay callable for the page but stop with 'no_packages' after the admin check and change nothing.
create or replace function public.admin_pay_grant(p_user uuid, p_plan text, p_name text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  raise exception 'no_packages' using errcode = '0A000', hint = 'InkAge has no packages to give';
end $$;
create or replace function public.admin_pay_rename(p_id bigint, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  raise exception 'no_packages' using errcode = '0A000', hint = 'InkAge has no packages to rename';
end $$;
create or replace function public.admin_pay_revoke(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  raise exception 'no_packages' using errcode = '0A000', hint = 'InkAge has no packages to take back';
end $$;
revoke execute on function public.admin_pay_grant(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_pay_rename(bigint, text) from public, anon;
revoke execute on function public.admin_pay_revoke(bigint) from public, anon;
-- the purchase a refund needs (the route asks Stripe with it)
create or replace function public.admin_pay_get(p_id bigint) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select to_jsonb(p) from public.purchases p where p.id = p_id);
end $$;

-- ---------- one view of a purchase for every page: money in dollars and forints, where the buyer came from ----------
create or replace function public.pay_rows(a timestamptz, b timestamptz) returns table (
  id bigint, created_at timestamptz, day date, user_id uuid, store text, tx text, plan text, name_norm text, amount numeric, currency text, est boolean,
  usd numeric, huf numeric, refunded_at timestamptz, refund_usd numeric, upgrade boolean, country text, coupon text, discount numeric, app_session text,
  device text, ab text, lang text, ch text, pf text, code text, account text, conf text, first_buy boolean, signed_up timestamptz, email text, note text, land text)
language sql stable security definer set search_path = '' as $$
  with p as (
    select x.*, (x.created_at at time zone 'Europe/Budapest')::date d,
      coalesce(x.amount, case when x.store = 'manual' then 0 else public.pay_list_usd(x.plan) end) amt,
      case when x.amount is null then (case when x.store = 'manual' then 'USD' else 'USD' end) else upper(coalesce(x.currency, 'USD')) end cur
    from public.purchases x where x.created_at >= a and x.created_at < b and not public.admin_own_uid(x.user_id)),
  m as (select s.user_id, s.ch, s.pf, s.code, s.lang, s.conf, s.src->>'land' land from public.admin_signups_matched('2026-01-01'::timestamptz, now()) s where s.user_id in (select p.user_id from p))
  select p.id, p.created_at, p.d, p.user_id, p.store, p.transaction_id, p.plan, p.name_norm, p.amt, p.cur, p.amount is null and p.store <> 'manual',
    round(public.pay_usd(p.amt, p.cur, p.d), 2), round(public.pay_usd(p.amt, p.cur, p.d) * public.pay_huf_rate(p.d)),
    p.refunded_at, round(public.pay_usd(case when p.refunded_at is not null then coalesce(nullif(p.refund_amount, 0), p.amt) else 0 end, p.cur, p.d), 2), p.plan like 'up\_%',
    p.country, upper(p.coupon), p.discount, p.app_session, p.device, p.ab, coalesce(p.lang, m.lang),
    coalesce(case when p.store = 'apple' then 'iphoneapp' when p.store = 'google' and coalesce(m.ch, '') in ('', 'ismeretlen') then 'androidapp' end, nullif(m.ch, ''), 'ismeretlen'),
    coalesce(m.pf, case p.store when 'apple' then 'ios' when 'google' then 'android' else 'web' end), m.code,
    coalesce((select e.label from public.social_extra_accounts e where e.code is not null and e.code = m.code limit 1),
      case when m.ch in ('tiktok', 'instagram') and coalesce(m.conf, '') <> 'gyenge' then 'InkAge · ' || m.ch end),  /* InkAge: the main accounts */
    m.conf, p.created_at = (select min(q.created_at) from public.purchases q where q.user_id = p.user_id),
    u.created_at, u.email, p.note, m.land
  from p left join m on m.user_id = p.user_id left join auth.users u on u.id = p.user_id
$$;
revoke execute on function public.pay_rows(timestamptz, timestamptz) from public, anon, authenticated;

-- ---------- Fizetések ----------
drop function if exists public.admin_payments(int);
create or replace function public.admin_payments(p_days int default 30, p_f jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 3650));
  a timestamptz := now() - make_interval(days => d);
  b timestamptz := now() - make_interval(days => d * 2);
  f jsonb := coalesce(p_f, '{}'::jsonb);
  t0 timestamptz := date_trunc('day', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
  cfg jsonb := public.pay_cfg(); r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with everp as materialized (select * from public.pay_rows('2020-01-01', now())),
  _pay as materialized (select * from everp x
    where (f->>'store' is null or x.store = f->>'store') and (f->>'plan' is null or x.plan = f->>'plan') and (f->>'lang' is null or x.lang = f->>'lang')
      and (f->>'country' is null or x.country = f->>'country') and (f->>'ch' is null or x.ch = f->>'ch') and (f->>'pf' is null or x.pf = f->>'pf')
      and (f->>'buyer' is null or (f->>'buyer' = 'new' and x.first_buy) or (f->>'buyer' = 'back' and not x.first_buy))),
  cur as (select * from _pay where created_at >= a and store <> 'manual'),
  prev as (select * from _pay where created_at >= b and created_at < a and store <> 'manual'),
  allp as (select * from _pay where store <> 'manual'),
  firsts as (select user_id, min(created_at) as at from public.purchases where user_id is not null and store <> 'manual' group by 1),
  newacc as (select u.id from auth.users u where u.created_at >= a and not public.admin_own_uid(u.id)),
  ev as (select e.name, e.session, e.created_at, e.props from public.events e where e.created_at >= a and e.name in ('paywall_shown', 'plan_pick', 'pay_start', 'paywall_signup', 'purchase'))
  select jsonb_build_object(
    'days', d, 'cfg', cfg, 'filter', f,
    'live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false),
    'first_ever', (select min(created_at) from public.purchases where store <> 'manual'),
    'fx', jsonb_build_object('huf', public.pay_huf_rate(current_date), 'day', (select max(day) from public.fx_rates)),
    'all_time', (select jsonb_build_object('sales', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd - refund_usd), 0)) from everp x where x.store <> 'manual'),
    'totals', jsonb_build_object(
      'sales', (select count(*) from cur), 'payers', (select count(distinct user_id) from cur),
      'usd', (select coalesce(sum(usd), 0) from cur), 'refund_usd', (select coalesce(sum(refund_usd), 0) from cur), 'net_usd', (select coalesce(sum(usd - refund_usd), 0) from cur),
      'huf', (select coalesce(sum(huf), 0) from cur), 'refunds', (select count(*) from cur where refunded_at is not null),
      'upgrades', (select count(*) from cur where upgrade), 'est', (select count(*) from cur where est),
      'new_payers', (select count(*) from firsts f2 where f2.at >= a and not public.admin_own_uid(f2.user_id)),
      'manual', (select count(*) from _pay where created_at >= a and store = 'manual'),
      'prev_sales', (select count(*) from prev), 'prev_payers', (select count(distinct user_id) from prev), 'prev_usd', (select coalesce(sum(usd - refund_usd), 0) from prev)),
    'rev', coalesce((select jsonb_agg(x order by x.gross desc) from (
      select currency, sum(amount) gross, count(*) sales, round(avg(amount), 2) avg from cur group by 1) x), '[]'::jsonb),
    -- today so far against yesterday and the same weekday last week, up to the same minute
    'pace', jsonb_build_object(
      'today', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd), 0)) from allp where created_at >= t0),
      'yest', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd), 0)) from allp where created_at >= t0 - interval '1 day' and created_at < now() - interval '1 day'),
      'yest_all', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd), 0)) from allp where created_at >= t0 - interval '1 day' and created_at < t0),
      'week', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd), 0)) from allp where created_at >= t0 - interval '7 days' and created_at < now() - interval '7 days'),
      'month', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd - refund_usd), 0)) from allp x where x.created_at >= date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest'),
      -- the share of a day's sales usually done by this hour (last 28 days), for the end-of-day estimate
      'share_by_now', (select case when count(*) >= 10 then round(count(*) filter (where (created_at at time zone 'Europe/Budapest')::time <= (now() at time zone 'Europe/Budapest')::time)::numeric / count(*), 3) end
        from public.purchases q where q.created_at >= now() - interval '28 days' and q.store <> 'manual' and not public.admin_own_uid(q.user_id))),
    'by_store', coalesce((select jsonb_agg(x order by x.sales desc) from (
      select store, count(*) sales, count(distinct user_id) payers, sum(usd) usd, sum(refund_usd) refund_usd, count(*) filter (where refunded_at is not null) refunds,
        count(*) filter (where est) est, max(created_at) as last,
        coalesce((select jsonb_object_agg(cu, s) from (select c2.currency cu, sum(c2.amount) s from cur c2 where c2.store = c.store group by 1) z), '{}'::jsonb) money
      from cur c group by store) x), '[]'::jsonb),
    'store_prev', coalesce((select jsonb_object_agg(store, c) from (select store, count(*) c from prev group by 1) x), '{}'::jsonb),
    -- the exact Stripe fee where the sync has it
    'stripe_fee', (select coalesce(sum(t.fee), 0) from public.stripe_tx t where t.type in ('charge', 'payment') and t.created >= a),
    'by_plan', coalesce((select jsonb_agg(x order by x.sales desc) from (select plan, count(*) sales, sum(usd) usd from cur group by 1) x), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(x order by x.day) from (select day, store, count(*) sales, sum(usd) usd from cur group by 1, 2) x), '[]'::jsonb),
    'prev_by_day', coalesce((select jsonb_agg(x order by x.day) from (select day, count(*) sales, sum(usd) usd from prev group by 1) x), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('day', n2.day, 'kind', n2.kind, 'text', n2.text) order by n2.day) from public.admin_notes n2 where n2.day >= (a at time zone 'Europe/Budapest')::date), '[]'::jsonb),
    'releases', coalesce((select jsonb_agg(jsonb_build_object('at', r2.at, 'msg', r2.msg) order by r2.at) from public.admin_releases r2 where r2.at >= a), '[]'::jsonb),
    'heat', coalesce((select jsonb_agg(x) from (select extract(isodow from created_at at time zone 'Europe/Budapest')::int dow, extract(hour from created_at at time zone 'Europe/Budapest')::int h, count(*) n, sum(usd) usd from cur group by 1, 2) x), '[]'::jsonb),
    'by_ch', coalesce((select jsonb_agg(x order by x.usd desc) from (select ch, count(*) sales, count(distinct user_id) payers, sum(usd) usd, count(*) filter (where conf = 'gyenge') weak from cur group by 1) x), '[]'::jsonb),
    'by_account', coalesce((select jsonb_agg(x order by x.usd desc) from (select account, count(*) sales, count(distinct user_id) payers, sum(usd) usd from cur where account is not null group by 1) x), '[]'::jsonb),
    'by_link', coalesce((select jsonb_agg(x order by x.usd desc) from (
      select c.code, l.source, l.campaign, l.note, l.post_platform, l.post_id, l.target, count(*) sales, sum(c.usd) usd
      from cur c join public.short_links l on l.code = c.code group by 1, 2, 3, 4, 5, 6, 7 order by 9 desc limit 30) x), '[]'::jsonb),
    'by_lang', coalesce((select jsonb_agg(x order by x.usd desc) from (select coalesce(lang, '?') lang, count(*) sales, sum(usd) usd from cur group by 1) x), '[]'::jsonb),
    'by_country', coalesce((select jsonb_agg(x order by x.usd desc) from (select coalesce(country, '?') country, count(*) sales, sum(usd) usd from cur group by 1) x), '[]'::jsonb),
    'by_pf', coalesce((select jsonb_agg(x order by x.usd desc) from (select pf, count(*) sales, sum(usd) usd from cur group by 1) x), '[]'::jsonb),
    'by_article', coalesce((select jsonb_agg(x order by x.sales desc) from (
      select c.land, count(*) sales, sum(c.usd) usd from cur c
      where c.land like '/%' and c.land not in ('/', '/start', '/register', '/app') group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'to_pay', (select jsonb_build_object('n', count(*),
        'median_h', round((percentile_cont(0.5) within group (order by extract(epoch from f2.at - u.created_at) / 3600))::numeric, 1),
        'same_day', count(*) filter (where f2.at - u.created_at < interval '24 hours'))
      from firsts f2 join auth.users u on u.id = f2.user_id where f2.at >= a and not public.admin_own_uid(f2.user_id)),
    'conv', jsonb_build_object('new_accounts', (select count(*) from newacc), 'paid', (select count(distinct c.user_id) from cur c join newacc n on n.id = c.user_id)),
    'steps', jsonb_build_object(
      'shown', (select count(distinct session) from ev where name = 'paywall_shown'), 'pick', (select count(distinct session) from ev where name = 'plan_pick'),
      'start', (select count(distinct session) from ev where name in ('pay_start', 'paywall_signup')), 'signup', (select count(distinct session) from ev where name = 'paywall_signup'),
      'bought', (select count(distinct session) from ev where name = 'purchase')),
    'recent', coalesce((select jsonb_agg(x order by x.at desc) from (
      select c.id, c.created_at as at, c.store, c.plan, c.amount, c.currency, c.usd, c.est, c.name_norm as name, c.tx, c.refunded_at, c.refund_usd, c.user_id, c.email, c.signed_up,
        c.ch, c.account, c.lang, c.country, c.coupon, c.first_buy, c.note,
        (select count(*) from public.purchases q where q.user_id = c.user_id) user_sales,
        i.status invoice, i.last_error invoice_error
      from _pay c left join public.invoices i on c.store = 'stripe' and i.session_id = c.tx
      where c.created_at >= a order by c.created_at desc limit 300) x), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(x order by x.usd desc) from (
      select q.user_id, max(q.email) email, count(*) sales, sum(q.usd) usd, max(q.created_at) as last
      from everp q where q.user_id is not null and q.store <> 'manual' group by 1 having count(*) > 1 order by 4 desc limit 20) x), '[]'::jsonb),
    'invoices', jsonb_build_object(
      'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from public.invoices where created_at >= a group by 1) x), '{}'::jsonb),
      'stuck', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select session_id, status, attempts, last_error, note, created_at, updated_at from public.invoices
        where status in ('failed', 'pending', 'cancel_pending', 'manual') and created_at >= now() - interval '90 days' order by created_at desc limit 30) x), '[]'::jsonb)),
    'problems', jsonb_build_object(
      'open', (select count(*) from public.pay_events e where e.resolved_at is null and e.kind in ('paid_missing', 'dispute') ),
      'expired', (select count(*) from public.pay_events e where e.kind = 'expired' and e.at >= a), 'failed', (select count(*) from public.pay_events e where e.kind = 'failed' and e.at >= a))
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_payments(int, jsonb) from public, anon;
grant execute on function public.admin_payments(int, jsonb) to authenticated;

-- ---------- Vevők ----------
create or replace function public.admin_pay_customers(p_days int default 3650, p_q text default null) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare a timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 3650), 3650))); r jsonb; q text := lower(nullif(trim(p_q), ''));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with p as (select * from public.pay_rows('2020-01-01', now()) where user_id is not null),
  c as (
    select p.user_id, max(p.email) email, min(p.created_at) first_at, max(p.created_at) last_at, count(*) filter (where p.store <> 'manual') sales,
      count(*) filter (where p.store = 'manual') manual, sum(p.usd) filter (where p.store <> 'manual') usd, sum(p.refund_usd) refund_usd,
      count(*) filter (where p.refunded_at is not null) refunds, count(distinct p.name_norm) names,
      array_agg(distinct p.name_norm) names_list, array_agg(distinct p.plan) plans, array_agg(distinct p.store) stores,
      max(p.ch) ch, max(p.account) account, max(p.lang) lang, max(p.country) country, max(p.signed_up) signed_up, max(p.coupon) coupon
    from p group by p.user_id),
  us2 as (
    select c.user_id,
      (select count(*) from public.admin_ink_claims k where k.user_id = c.user_id) claims,
      (select max(k.created_at) from public.admin_ink_claims k where k.user_id = c.user_id) last_claim,
      (select round(avg(s.stars), 1) from public.admin_ink_ratings s where s.user_id = c.user_id) stars,
      (select min(s.stars) from public.admin_ink_ratings s where s.user_id = c.user_id and s.updated_at >= c.first_at) low_after
    from c)
  select jsonb_build_object(
    'n', (select count(*) from c where c.last_at >= a),
    'ltv', (select round(avg(coalesce(usd, 0) - coalesce(refund_usd, 0)), 2) from c where sales > 0),
    'repeat', (select count(*) from c where sales > 1), 'multi_name', (select count(*) from c where names > 1),
    'ltv_by_ch', coalesce((select jsonb_agg(x order by x.ltv desc nulls last) from (select coalesce(ch, 'ismeretlen') ch, count(*) buyers, round(avg(coalesce(usd, 0) - coalesce(refund_usd, 0)), 2) ltv, sum(usd) usd from c where sales > 0 group by 1) x), '[]'::jsonb),
    'unused', (select count(*) from c join us2 u on u.user_id = c.user_id where u.claims = 0 and c.sales > 0 and c.first_at < now() - interval '2 hours'),
    'unhappy', (select count(*) from us2 u where u.low_after <= 2),
    'rows', coalesce((select jsonb_agg(x order by x.last_at desc) from (
      select c.*, u.claims, u.last_claim, u.stars, u.low_after from c join us2 u on u.user_id = c.user_id
      where c.last_at >= a and (q is null or lower(coalesce(c.email, '')) like '%' || q || '%' or exists (select 1 from unnest(c.names_list) nm where nm like '%' || q || '%'))
      order by c.last_at desc limit 500) x), '[]'::jsonb)
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_pay_customers(int, text) from public, anon;
grant execute on function public.admin_pay_customers(int, text) to authenticated;

-- one buyer from start to now: the visit, the sign-up, each purchase, what was drawn, the stars, the notices
create or replace function public.admin_pay_customer(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'user', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'provider', u.raw_app_meta_data->>'provider') from auth.users u where u.id = p_user),
    'origin', (select to_jsonb(s) from public.admin_signups_matched('2026-01-01', now()) s where s.user_id = p_user limit 1),
    'purchases', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.pay_rows('2020-01-01', now()) x where x.user_id = p_user), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('at', k.created_at, 'name', k.name_norm, 'style', k.style, 'state', k.state) order by k.created_at) from public.admin_ink_claims k where k.user_id = p_user), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('at', s.updated_at, 'style', s.style, 'stars', s.stars) order by s.updated_at) from public.admin_ink_ratings s where s.user_id = p_user), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.at) from public.pay_events e where e.user_id = p_user), '[]'::jsonb)
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_pay_customer(uuid) from public, anon;
grant execute on function public.admin_pay_customer(uuid) to authenticated;

-- ---------- Pénzügy ----------
create or replace function public.admin_pay_finance(p_months int default 12) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare m0 date := (date_trunc('month', now() at time zone 'Europe/Budapest') - make_interval(months => greatest(1, least(coalesce(p_months, 12), 36)) - 1))::date;
  cfg jsonb := public.pay_cfg(); r jsonb; y0 timestamptz := date_trunc('year', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with p as (select * from public.pay_rows(m0::timestamptz, now()) where store <> 'manual'),
  months as (select generate_series(m0, (now() at time zone 'Europe/Budapest')::date, interval '1 month')::date mo),
  fee_est as (select p.*, case p.store when 'apple' then p.usd * case when coalesce((cfg->>'apple_sbp')::boolean, true) then 0.15 else 0.30 end
      when 'google' then p.usd * coalesce((cfg->>'google_rate')::numeric, 0.15)
      else coalesce((select sum(t.fee) from public.stripe_tx t where t.session_id = p.tx), p.usd * coalesce((cfg->>'stripe_pct')::numeric, 0.029) + coalesce((cfg->>'stripe_fix')::numeric, 0.3)) end fee,
      p.store = 'stripe' and exists (select 1 from public.stripe_tx t where t.session_id = p.tx) exact from p),
  costs as (select mo.mo, coalesce(sum(public.pay_usd(c.amount, c.currency, mo.mo)), 0) usd from months mo
    left join public.pay_costs c on c.month = mo.mo or (c.recurring and c.month <= mo.mo) group by mo.mo),
  -- InkAge: the AI work of a month = the AI previews made (Calligra: the styles drawn)
  ai as (select date_trunc('month', k.created_at at time zone 'Europe/Budapest')::date mo, count(*) n from public.admin_ink_made k where k.ok and k.created_at >= m0 group by 1)
  select jsonb_build_object(
    'cfg', cfg, 'huf', public.pay_huf_rate(current_date),
    'months', coalesce((select jsonb_agg(x order by x.mo desc) from (
      select mo.mo, count(f.id) sales, coalesce(sum(f.usd), 0) gross, coalesce(sum(f.refund_usd), 0) refunds, round(coalesce(sum(f.fee), 0), 2) fees,
        count(f.id) filter (where f.exact) exact, coalesce(sum(f.huf), 0) huf,
        (select c.usd from costs c where c.mo = mo.mo) costs, coalesce((select a2.n from ai a2 where a2.mo = mo.mo), 0) ai_n,
        round(coalesce((select a2.n from ai a2 where a2.mo = mo.mo), 0) * coalesce((cfg->>'ai_cost')::numeric, 0), 2) ai_usd,
        coalesce(sum(f.usd) filter (where f.store = 'stripe'), 0) stripe, coalesce(sum(f.usd) filter (where f.store = 'apple'), 0) apple, coalesce(sum(f.usd) filter (where f.store = 'google'), 0) google
      from months mo left join fee_est f on date_trunc('month', f.created_at at time zone 'Europe/Budapest')::date = mo.mo group by mo.mo) x), '[]'::jsonb),
    'costs', coalesce((select jsonb_agg(to_jsonb(c) order by c.month desc, c.id desc) from public.pay_costs c), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(to_jsonb(o) order by o.arrival_date desc) from (select * from public.stripe_payouts order by arrival_date desc limit 40) o), '[]'::jsonb),
    -- money Stripe holds: charged, not paid out yet
    'stripe_pending', coalesce((select jsonb_object_agg(cu, v) from (select upper(currency) cu, sum(net) v from public.stripe_tx where payout_id is null and type not in ('payout') group by 1) x), '{}'::jsonb),
    'stripe_next', (select min(available_on) from public.stripe_tx where payout_id is null and available_on > now()),
    -- the stores pay a month later: what this month and last month have earned so far
    'store_due', jsonb_build_object(
      'apple', (select coalesce(sum(usd - refund_usd), 0) * case when coalesce((cfg->>'apple_sbp')::boolean, true) then 0.85 else 0.70 end from p where store = 'apple' and created_at >= date_trunc('month', now()) - interval '1 month'),
      'google', (select coalesce(sum(usd - refund_usd), 0) * (1 - coalesce((cfg->>'google_rate')::numeric, 0.15)) from p where store = 'google' and created_at >= date_trunc('month', now()) - interval '1 month')),
    'synced', jsonb_build_object('tx', (select max(created) from public.stripe_tx), 'n', (select count(*) from public.stripe_tx), 'fx', (select max(day) from public.fx_rates)),
    -- does every web sale have its invoice, and every Stripe charge its package
    'recon', jsonb_build_object(
      'no_invoice', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'tx', p.tx, 'at', p.created_at, 'usd', p.usd, 'email', p.email)) from p
        where p.store = 'stripe' and p.created_at < now() - interval '1 hour' and not exists (select 1 from public.invoices i where i.session_id = p.tx)), '[]'::jsonb),
      'no_package', coalesce((select jsonb_agg(to_jsonb(e)) from public.pay_events e where e.kind = 'paid_missing' and e.resolved_at is null), '[]'::jsonb),
      'invoicing', (select count(*) from public.invoices) > 0),
    'year', jsonb_build_object('huf', (select coalesce(sum(huf - refund_usd * public.pay_huf_rate(day)), 0) from public.pay_rows(y0, now()) x where x.store <> 'manual'),
      'limit', coalesce((cfg->>'vat_limit_huf')::numeric, 20000000),
      'days_left', (date_trunc('year', now()) + interval '1 year')::date - current_date,
      'pace_huf', (select coalesce(sum(huf), 0) / greatest(1, extract(doy from now())) * 365 from public.pay_rows(y0, now()) x where x.store <> 'manual')),
    -- what the dollar was worth on the sale day and on the payout day
    'fx_diff', (select jsonb_build_object('usd', coalesce(sum(t.amount), 0),
        'huf_at_sale', round(coalesce(sum(t.amount * public.pay_huf_rate((t.created at time zone 'Europe/Budapest')::date)), 0)),
        'huf_at_payout', round(coalesce(sum(t.amount * public.pay_huf_rate((o.arrival_date at time zone 'Europe/Budapest')::date)), 0)))
      from public.stripe_tx t join public.stripe_payouts o on o.id = t.payout_id where t.type in ('charge', 'payment') and o.arrival_date >= m0)
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_pay_finance(int) from public, anon;
grant execute on function public.admin_pay_finance(int) to authenticated;

-- ---------- Fizetési hibák ----------
create or replace function public.admin_pay_problems(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare a timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650))); r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with e as (select * from public.pay_events where at >= a or (resolved_at is null and kind in ('paid_missing', 'dispute'))),
  ev as (select x.name, x.session, x.created_at, x.props from public.events x where x.created_at >= a and x.name in ('paywall_shown', 'pay_start', 'purchase', 'paywall_signup', 'signup'))
  select jsonb_build_object(
    'open', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from e x where x.resolved_at is null and x.kind in ('paid_missing', 'dispute')), '[]'::jsonb),
    'by_kind', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from e where at >= a group by 1) x), '{}'::jsonb),
    'expired', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (select * from e where kind = 'expired' and at >= a order by at desc limit 200) x), '[]'::jsonb),
    'failed', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (select * from e where kind = 'failed' and at >= a order by at desc limit 200) x), '[]'::jsonb),
    'reasons', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(reason, 'ismeretlen') reason, count(*) n from e where kind = 'failed' and at >= a group by 1) x), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from e x where x.kind in ('dispute', 'dispute_closed')), '[]'::jsonb),
    'store_notes', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc) from (select * from e where kind in ('refund_apple', 'refund_google', 'apple_notice', 'declined_refund') and at >= a order by at desc limit 100) x), '[]'::jsonb),
    -- the expired checkouts whose person bought later anyway
    'recovered', (select count(*) from e x where x.kind = 'expired' and x.at >= a and exists (select 1 from public.purchases p where p.user_id = x.user_id and p.created_at > x.at)),
    -- by device: how many pressed pay and how many finished
    'by_device', coalesce((select jsonb_agg(x order by x.start desc) from (
      select coalesce(s.props->>'pf', 'web') || coalesce(' · ' || nullif(s.props->>'ia', ''), '') dev, count(distinct s.session) start,
        count(distinct s.session) filter (where exists (select 1 from ev b where b.session = s.session and b.name = 'purchase' and b.created_at >= s.created_at)) done
      from ev s where s.name = 'pay_start' group by 1) x), '[]'::jsonb),
    'by_browser', coalesce((select jsonb_agg(x order by x.n desc) from (select coalesce(device, '?') device, count(*) n from e where kind in ('expired', 'failed') and at >= a group by 1) x), '[]'::jsonb),
    -- seconds from the pay button to the purchase, per visit
    'speed', (select jsonb_build_object('n', count(*), 'median_s', round((percentile_cont(0.5) within group (order by sec))::numeric), 'p90_s', round((percentile_cont(0.9) within group (order by sec))::numeric))
      from (select extract(epoch from min(b.created_at) - min(s.created_at)) sec from ev s join ev b on b.session = s.session and b.name = 'purchase' and b.created_at >= s.created_at where s.name = 'pay_start' group by s.session) z),
    -- the wall's sign-up step: those sent to sign up, did they come back and buy
    'signup_wall', jsonb_build_object('sent', (select count(distinct session) from ev where name = 'paywall_signup'),
      'signed', (select count(distinct s.session) from ev s where s.name = 'paywall_signup' and exists (select 1 from ev b where b.session = s.session and b.name = 'signup' and b.created_at >= s.created_at)),
      'bought', (select count(distinct s.session) from ev s where s.name = 'paywall_signup' and exists (select 1 from ev b where b.session = s.session and b.name = 'purchase' and b.created_at >= s.created_at))),
    'stuck_invoices', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from (select session_id, status, attempts, last_error, note, created_at from public.invoices where status in ('failed', 'pending', 'cancel_pending', 'manual') order by created_at desc limit 30) i), '[]'::jsonb),
    'last_notice', jsonb_build_object('apple', (select max(at) from public.pay_events where kind in ('refund_apple', 'apple_notice', 'declined_refund')), 'stripe_sync', (select max(created) from public.stripe_tx))
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_pay_problems(int) from public, anon;
grant execute on function public.admin_pay_problems(int) to authenticated;
create or replace function public.admin_pay_resolve(p_id bigint, p_note text default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.pay_events set resolved_at = now(), detail = detail || jsonb_build_object('note', p_note) where id = p_id;
  perform public.admin_audit_add('pay_resolve', p_id::text, jsonb_build_object('note', p_note));
end $$;

-- ---------- Árak és tesztek ----------
create or replace function public.admin_pay_pricing(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare a timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650))); r jsonb; cfg jsonb := public.pay_cfg();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with p as (select * from public.pay_rows(a, now()) where store <> 'manual'),
  ev as (select x.name, x.session, x.created_at, x.props from public.events x where x.created_at >= a and x.name in ('paywall_shown', 'plan_pick', 'pay_start', 'purchase'))
  select jsonb_build_object(
    'cfg', cfg,
    'mix_week', coalesce((select jsonb_agg(x order by x.wk) from (select date_trunc('week', created_at at time zone 'Europe/Budapest')::date wk, plan, count(*) n, sum(usd) usd from p group by 1, 2) x), '[]'::jsonb),
    'upgrades', coalesce((select jsonb_agg(x) from (
      select u.plan, count(*) n, round((percentile_cont(0.5) within group (order by extract(epoch from u.created_at - f.created_at) / 3600))::numeric, 1) median_h
      from p u join lateral (select q.created_at from public.purchases q where q.user_id = u.user_id and q.name_norm = u.name_norm and q.plan not like 'up\_%' order by q.created_at limit 1) f on true
      where u.upgrade group by 1) x), '[]'::jsonb),
    'up_share', jsonb_build_object('basic', (select count(*) from p where plan = 'basic'), 'basic_up', (select count(*) from p where plan in ('up_basic_pro', 'up_basic_ultra')),
      'pro', (select count(*) from p where plan = 'pro'), 'pro_up', (select count(*) from p where plan = 'up_pro_ultra')),
    -- the styles bought with a package, and how many of those buyers bought first after seeing it (the first claim)
    'styles', coalesce((select jsonb_agg(x order by x.n desc) from (select k.style, count(*) n, count(distinct k.user_id) people,
        count(*) filter (where k.created_at = (select min(k2.created_at) from public.admin_ink_claims k2 where k2.user_id = k.user_id and k2.name_norm = k.name_norm)) first_pick
      from public.admin_ink_claims k where k.created_at >= a and k.user_id in (select user_id from p) group by 1 order by 2 desc limit 40) x), '[]'::jsonb),
    -- before buying: what the visit did, for the visits we can join
    'before', (select jsonb_build_object('n', count(*), 'events', round(avg(nev)::numeric, 1), 'minutes', round((percentile_cont(0.5) within group (order by mins))::numeric, 1), 'paywalls', round(avg(pw)::numeric, 1))
      from (select (select count(*) from public.events e where e.session = p.app_session and e.created_at <= p.created_at) nev,
        (select count(*) from public.events e where e.session = p.app_session and e.name = 'paywall_shown' and e.created_at <= p.created_at) pw,
        extract(epoch from p.created_at - (select min(e.created_at) from public.events e where e.session = p.app_session)) / 60 mins
        from p where p.app_session is not null) z),
    -- the one try before paying: of the accounts that drew it, how many bought, and after how long
    'try', (select jsonb_build_object('tried', count(*), 'bought', count(*) filter (where b.at is not null), 'median_h', round((percentile_cont(0.5) within group (order by extract(epoch from b.at - t.at) / 3600))::numeric, 1))
      from (select k.user_id, min(k.created_at) at from public.admin_ink_claims k where k.created_at >= a and coalesce(k.paid, false) = false group by 1) t
      left join lateral (select min(q.created_at) at from public.purchases q where q.user_id = t.user_id and q.created_at >= t.at and q.store <> 'manual') b on true),
    'by_country', coalesce((select jsonb_agg(x order by x.sales desc) from (select coalesce(country, '?') country, store, currency, count(*) sales, round(avg(amount), 2) avg_local, round(avg(usd), 2) avg_usd from p group by 1, 2, 3) x), '[]'::jsonb),
    'codes', coalesce((select jsonb_agg(x order by x.sales desc nulls last) from (
      select c.*, (select count(*) from p where p.coupon = c.code) sales, (select coalesce(sum(p.usd - p.refund_usd), 0) from p where p.coupon = c.code) usd,
        (select coalesce(sum(p.discount), 0) from p where p.coupon = c.code) discount,
        round((select coalesce(sum(p.usd - p.refund_usd), 0) from p where p.coupon = c.code) * coalesce(c.commission, (cfg->>'commission')::numeric, 0), 2) owed
      from public.pay_codes c) x), '[]'::jsonb),
    'other_codes', coalesce((select jsonb_agg(x) from (select coupon, count(*) sales, sum(usd) usd from p where coupon is not null and coupon not in (select code from public.pay_codes) group by 1) x), '[]'::jsonb),
    -- the test: each variant's paywalls, buyers and money (money per paywall decides)
    'ab', coalesce((select jsonb_agg(x) from (
      select v.variant, count(distinct v.session) shown,
        (select count(*) from p where p.ab = v.variant) sales, (select coalesce(sum(p.usd), 0) from p where p.ab = v.variant) usd
      from (select e.session, e.props->>'ab' variant from ev e where e.name = 'paywall_shown' and e.props ? 'ab') v group by 1) x), '[]'::jsonb),
    'per_paywall', (select jsonb_build_object('shown', (select count(distinct session) from ev where name = 'paywall_shown'), 'usd', coalesce(sum(usd), 0), 'sales', count(*)) from p where store = 'stripe')
  ) into r;
  return r;
end $function$;
revoke execute on function public.admin_pay_pricing(int) from public, anon;
grant execute on function public.admin_pay_pricing(int) to authenticated;

-- ---------- the phone: what the 5-minute run should say about money ----------
create or replace function public.admin_r_pay_signals(p_token text) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare cfg jsonb := public.pay_cfg(); h int := extract(hour from now() at time zone 'Europe/Budapest')::int; r jsonb;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false),
    'sales', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'store', p.store, 'plan', p.plan, 'amount', p.amount, 'currency', p.currency, 'first', p.first_buy, 'ch', p.ch, 'account', p.account) order by p.created_at)
      from public.pay_rows(now() - interval '30 minutes', now()) p where p.store <> 'manual'), '[]'::jsonb),
    'today', (select jsonb_build_object('n', count(*), 'usd', coalesce(sum(usd), 0)) from public.pay_rows(date_trunc('day', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest', now()) p where p.store <> 'manual'),
    'goal_day', (cfg->>'goal_day')::int,
    'last_sale', (select max(created_at) from public.purchases where store <> 'manual' and not public.admin_own_uid(user_id)),
    -- how many sales this hour of the day usually brings (last 14 days), to tell a real silence from a quiet hour
    'usual_2h', (select count(*) / 14.0 from public.purchases q where q.created_at >= now() - interval '14 days' and q.store <> 'manual'
      and extract(hour from q.created_at at time zone 'Europe/Budapest')::int in (h, (h + 23) % 24)),
    'last_2h', (select count(*) from public.purchases q where q.created_at >= now() - interval '2 hours' and q.store <> 'manual'),
    'release', (select jsonb_build_object('at', at, 'msg', msg) from public.admin_releases order by at desc limit 1),
    'since_release', (select count(*) from public.purchases q where q.store <> 'manual' and q.created_at >= (select max(at) from public.admin_releases)),
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'ref', e.ref, 'amount', e.amount, 'currency', e.currency, 'reason', e.reason, 'at', e.at))
      from public.pay_events e where e.resolved_at is null and e.kind in ('paid_missing', 'dispute') ), '[]'::jsonb),
    'refunds_24h', (select count(*) from public.purchases where refunded_at >= now() - interval '24 hours'),
    'low_stars', coalesce((select jsonb_agg(jsonb_build_object('user', s.user_id, 'stars', s.stars, 'style', s.style, 'at', s.updated_at)) from public.admin_ink_ratings s
      where s.updated_at >= now() - interval '30 minutes' and s.stars <= 2 and exists (select 1 from public.purchases q where q.user_id = s.user_id and q.store <> 'manual')), '[]'::jsonb),
    'milestones', (select jsonb_build_object('sales', count(*), 'usd', coalesce(sum(usd - refund_usd), 0)) from public.pay_rows('2020-01-01', now()) x where x.store <> 'manual')
  ) into r;
  return r;
end $function$;

-- the morning e-mail and the weekly report: yesterday's and last week's money in one small answer
create or replace function public.admin_r_pay_digest(p_token text) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare t0 timestamptz := date_trunc('day', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest'; r jsonb;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'yest', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd), 0), 'top_ch', (select ch from public.pay_rows(t0 - interval '1 day', t0) z where z.store <> 'manual' group by ch order by sum(usd) desc limit 1))
      from public.pay_rows(t0 - interval '1 day', t0) x where x.store <> 'manual'),
    'week', (select jsonb_build_object('n', count(*), 'payers', count(distinct user_id), 'usd', coalesce(sum(usd - refund_usd), 0)) from public.pay_rows(t0 - interval '7 days', t0) x where x.store <> 'manual'),
    'week_prev', (select jsonb_build_object('n', count(*), 'usd', coalesce(sum(usd - refund_usd), 0)) from public.pay_rows(t0 - interval '14 days', t0 - interval '7 days') x where x.store <> 'manual'),
    'problems', (select count(*) from public.pay_events where resolved_at is null and kind in ('paid_missing', 'dispute')),
    'failed_y', (select count(*) from public.pay_events where kind in ('failed', 'expired') and at >= t0 - interval '1 day' and at < t0),
    'live', coalesce((select (value)::text::boolean from public.admin_ink_settings where key = 'payments_live'), false)
  ) into r;
  return r;
end $function$;

-- ---------- the settings, read by the server and saved by the page; disputes close themselves when Stripe closes them ----------
create or replace function public.admin_r_pay_cfg(p_token text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.pay_cfg();
end $$;
create or replace function public.admin_pay_cfg_save(p_v jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_settings (k, v) values ('pay', coalesce((select v from public.admin_settings where k = 'pay'), '{}'::jsonb) || coalesce(p_v, '{}'::jsonb))
  on conflict (k) do update set v = coalesce(public.admin_settings.v, '{}'::jsonb) || coalesce(p_v, '{}'::jsonb), updated_at = now();
  perform public.admin_audit_add('pay_settings', 'pay', p_v);
  return public.pay_cfg();
end $$;
create or replace function public.admin_w_pay_events(p_token text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0;
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if public.record_pay_event(r) then n := n + 1; end if;
  end loop;
  update public.pay_events e set resolved_at = now() where e.kind = 'paid_missing' and e.resolved_at is null
    and exists (select 1 from public.purchases p where p.store = 'stripe' and p.transaction_id = e.session_id);
  update public.pay_events e set resolved_at = now() where e.kind = 'dispute' and e.resolved_at is null
    and exists (select 1 from public.pay_events c where c.kind = 'dispute_closed' and c.ref = e.ref);
  return n;
end $$;

-- the month's close for the accountant: every payment with its fee, invoice and the rate of its day
create or replace function public.admin_pay_month(p_month date) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
declare a timestamptz := date_trunc('month', p_month)::timestamp at time zone 'Europe/Budapest'; b timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Europe/Budapest';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.created_at, p.store, p.tx, p.plan, p.amount, p.currency, p.usd, p.huf, round(public.pay_huf_rate(p.day), 2) huf_rate, p.refunded_at, p.refund_usd, p.country, p.coupon, p.discount, p.email, p.note,
      (select sum(t.fee) from public.stripe_tx t where t.session_id = p.tx) stripe_fee, i.status invoice, i.doc_id invoice_doc
    from public.pay_rows(a, b) p left join public.invoices i on p.store = 'stripe' and i.session_id = p.tx) x), '[]'::jsonb);
end $function$;
revoke execute on function public.admin_pay_month(date) from public, anon;
grant execute on function public.admin_pay_month(date) to authenticated;
