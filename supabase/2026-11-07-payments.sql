-- Applied to the live database 2026-11-07 as migration inkage_payments_01 (dormant: pay.live = false).
-- InkAge payments (2026-11-07): one-time packages of previews, a one-preview trial with locked stages.
-- Everything here is dormant until admin_settings 'pay' has "live": true (pay_live()); until then the old
-- 30 previews a month apply to everyone, exactly as before.
--
-- Packages (owner, 2026-11-07): mini 5 previews $4.99, plus 15 $11.99, studio 40 $27.99. Pay once, no subscription.
-- Trial: 1 preview, of which only the 50-year stage (aging) or the 10-session stage (laser) is made; the other
-- stages unlock with any package. AI drawings / cut-outs before buying: 2 in all.
-- Store apps (iOS / Android) stay on the old 30 a month until store billing exists: the server tells the database
-- so with the db secret (p_key), so nobody can claim it from the browser.
-- Accounts made before payments went live keep the old 30 for the rest of that calendar month.

-- ---------------------------------------------------------------- settings
insert into public.admin_settings(k, v) values ('pay', '{"live": false, "start": null, "list_usd": {"mini": 4.99, "plus": 11.99, "studio": 27.99}}'::jsonb)
on conflict (k) do update set v = public.admin_settings.v
  || jsonb_build_object('list_usd', coalesce(public.admin_settings.v->'list_usd', '{}'::jsonb) || '{"mini": 4.99, "plus": 11.99, "studio": 27.99}'::jsonb)
  || case when public.admin_settings.v ? 'live' then '{}'::jsonb else '{"live": false}'::jsonb end;

alter table public.purchases add column if not exists credits int not null default 0;

create or replace function public.pay_live() returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce((select (v->>'live')::boolean from public.admin_settings where k = 'pay'), false)
$$;
create or replace function public.pay_start() returns timestamptz language sql stable security definer set search_path to '' as $$
  select coalesce((select (v->>'start')::timestamptz from public.admin_settings where k = 'pay'), now())
$$;
grant execute on function public.pay_live() to anon, authenticated;

-- previews in a package; the database's own copy, so a client can never name its own number
create or replace function public.pay_plan_credits(p_plan text) returns int language sql immutable as $$
  select case p_plan when 'mini' then 5 when 'plus' then 15 when 'studio' then 40 else 0 end
$$;

-- the server's secret (lib/server.ts appSecret('db')), as the health check and the crons already use it
create or replace function public.pay_key_ok(p_key text) returns boolean language sql stable security definer set search_path to '' as $$
  select p_key is not null and p_key = (select value from private.config where key = 'webhook_secret')
$$;
revoke execute on function public.pay_key_ok(text) from public, anon, authenticated;

-- previews bought and not refunded
create or replace function public.pay_credits(p_uid uuid) returns int language sql stable security definer set search_path to '' as $$
  select coalesce(sum(credits), 0)::int from public.purchases
  where user_id = p_uid and (refunded_at is null or coalesce(refund_amount, 0) < coalesce(amount, 0))
$$;
revoke execute on function public.pay_credits(uuid) from public, anon, authenticated;

/* How this person is counted right now:
   'free'   payments off, a store app, a reviewer, or an account from before the switch in its first month: 30 a month, nothing locked
   'paid'   bought a package: the trial + packages, nothing locked
   'trial'  never bought: the trial preview, with locked stages */
create or replace function public.pay_mode(p_uid uuid, p_native boolean default false, p_key text default null) returns text
language plpgsql stable security definer set search_path to '' as $$
declare st timestamptz; created timestamptz; rev boolean;
begin
  if not public.pay_live() then return 'free'; end if;
  if p_native and public.pay_key_ok(p_key) then return 'free'; end if;
  select coalesce(reviewer, false), created_at into rev, created from public.profiles where id = p_uid;
  if coalesce(rev, false) then return 'free'; end if;
  if public.pay_credits(p_uid) > 0 then return 'paid'; end if;
  st := public.pay_start();
  if created < st and now() < (date_trunc('month', st at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest' then return 'free'; end if;
  return 'trial';
end $$;
revoke execute on function public.pay_mode(uuid, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- quota
drop function if exists public.my_quota();
create or replace function public.my_quota(p_native boolean default false, p_key text default null)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  p public.profiles;
  lim int;
  used int;
  mode text;
  cr int;
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
  since timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  mode := public.pay_mode(uid, p_native, p_key);
  if mode = 'free' then
    lim := 30 + coalesce(p.bonus, 0) + case when coalesce(p.reviewer, false) then 1000 else 0 end;
    select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at >= month_start;
    return json_build_object('used', used, 'limit', lim,
      'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'month',
      'resetsAt', (month_start at time zone 'Europe/Budapest' + interval '1 month') at time zone 'Europe/Budapest',
      'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
      'notifyVotes', coalesce(p.notify_votes, true), 'pay', 'free', 'payLive', public.pay_live());
  end if;
  -- counted from the switch (or, for an older account, from the end of its free month)
  since := public.pay_start();
  if p.created_at < since then since := (date_trunc('month', since at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest'; end if;
  cr := public.pay_credits(uid);
  lim := 1 + cr + coalesce(p.bonus, 0);
  select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at >= since;
  return json_build_object('used', used, 'limit', lim, 'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'total',
    'resetsAt', null, 'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
    'notifyVotes', coalesce(p.notify_votes, true), 'pay', mode, 'payLive', true, 'credits', cr);
end $function$;
grant execute on function public.my_quota(boolean, text) to authenticated;

drop function if exists public.start_generation(text);
create or replace function public.start_generation(p_placement text, p_native boolean default false, p_key text default null)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  q json;
  gid bigint;
  rev boolean;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  q := public.my_quota(p_native, p_key);
  if (q->>'remaining')::int <= 0 then
    return (json_build_object('ok', false, 'reason', case when q->>'pay' = 'free' then 'used' else 'paywall' end)::jsonb || q::jsonb)::json;
  end if;
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false)
     and (select count(*) from public.generations where kind = 'preview' and created_at > now() - interval '24 hours') >= 300 then
    return (json_build_object('ok', false, 'reason', 'busy')::jsonb || q::jsonb)::json;
  end if;
  insert into public.generations(user_id, placement) values (auth.uid(), left(p_placement, 80)) returning id into gid;
  return (json_build_object('ok', true, 'gid', gid)::jsonb || q::jsonb)::json;
end $function$;
grant execute on function public.start_generation(text, boolean, text) to authenticated;

-- ---------------------------------------------------------------- stages
/* One aging / laser image of a preview. In 'trial' only the 50-year and the 10-session image may be made, and one
   of each per preview; 'locked' tells the app to show the packages. Otherwise as bump_age: at most 8 per preview. */
create or replace function public.age_step(p_gid bigint, p_stage text, p_native boolean default false, p_key text default null)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare n int; mode text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  mode := public.pay_mode(auth.uid(), p_native, p_key);
  if mode = 'trial' then
    if p_stage not in ('y50', 'laser10') then return json_build_object('ok', false, 'reason', 'locked'); end if;
    -- the trial image of this kind was already made for this preview (a retry after a failure is refunded by age_refund)
    if exists (select 1 from public.generations g where g.id = p_gid and g.user_id = auth.uid()
               and (g.placement like '%#' || p_stage || '%')) then
      return json_build_object('ok', false, 'reason', 'locked');
    end if;
  end if;
  update public.generations set aged = aged + 1,
    placement = case when mode = 'trial' then left(placement, 60) || '#' || p_stage else placement end
  where id = p_gid and user_id = auth.uid() and aged < 8
  returning aged into n;
  return json_build_object('ok', n is not null, 'reason', case when n is null then 'used' end);
end $function$;
grant execute on function public.age_step(bigint, text, boolean, text) to authenticated;

-- a failed stage gives its trial image back (only the mark, the count of 8 stays: failures are rare)
create or replace function public.age_refund(p_gid bigint, p_stage text) returns void
language sql security definer set search_path to 'public' as $$
  update public.generations set placement = replace(placement, '#' || p_stage, '') where id = p_gid and user_id = auth.uid()
$$;
grant execute on function public.age_refund(bigint, text) to authenticated;

-- ---------------------------------------------------------------- AI drawings / cut-outs
drop function if exists public.helper_start(text);
create or replace function public.helper_start(p_label text, p_native boolean default false, p_key text default null)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare used int; global_day int; gid bigint; rev boolean; mode text; since timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('helper:' || auth.uid()::text));
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false) then
    mode := public.pay_mode(auth.uid(), p_native, p_key);
    if mode = 'trial' then
      since := public.pay_start();
      select count(*) into used from public.generations where user_id = auth.uid() and kind = 'helper' and created_at >= since;
      if used >= 2 then return json_build_object('ok', false, 'reason', 'paywall'); end if;
    end if;
    select count(*) into used from public.generations where user_id = auth.uid() and kind = 'helper' and created_at > now() - interval '24 hours';
    select count(*) into global_day from public.generations where kind = 'helper' and created_at > now() - interval '24 hours';
    if used >= 15 then return json_build_object('ok', false, 'reason', 'used'); end if;
    if global_day >= 600 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  end if;
  insert into public.generations(user_id, placement, kind) values (auth.uid(), left(p_label, 80), 'helper') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$;
grant execute on function public.helper_start(text, boolean, text) to authenticated;

-- ---------------------------------------------------------------- purchases (called by the server with the db secret)
/* A paid Stripe checkout (or a store purchase later): one row per store transaction, so a webhook sent twice adds the
   previews once. Returns the person's previews bought so far. */
create or replace function public.pay_grant(p_key text, p_user uuid, p_store text, p_tx text, p_plan text, p_amount numeric default null,
  p_currency text default null, p_meta jsonb default '{}'::jsonb) returns json
language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  n := public.pay_plan_credits(p_plan);
  if n <= 0 then raise exception 'bad_plan'; end if;
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency, country, coupon, discount, app_session, lang, device, ab, note)
  values (p_user, p_store, p_tx, 'inkage.' || p_plan, p_plan, n, p_amount, upper(p_currency),
    nullif(upper(p_meta->>'country'), ''), nullif(p_meta->>'coupon', ''), (p_meta->>'discount')::numeric, nullif(p_meta->>'sess', ''),
    nullif(p_meta->>'lang', ''), nullif(p_meta->>'device', ''), nullif(p_meta->>'ab', ''), nullif(p_meta->>'note', ''))
  on conflict (store, transaction_id) do nothing;
  return json_build_object('ok', true, 'credits', public.pay_credits(p_user));
end $$;
revoke execute on function public.pay_grant(text, uuid, text, text, text, numeric, text, jsonb) from public;
grant execute on function public.pay_grant(text, uuid, text, text, text, numeric, text, jsonb) to anon, authenticated;

-- a refund: the row remembers it; a full refund takes the package's previews back (pay_credits)
create or replace function public.pay_refund(p_key text, p_store text, p_tx text, p_amount numeric default null) returns json
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.purchases set refunded_at = coalesce(refunded_at, now()), refund_amount = coalesce(p_amount, amount)
  where store = p_store and transaction_id = p_tx;
  return json_build_object('ok', found);
end $$;
revoke execute on function public.pay_refund(text, text, text, numeric) from public;
grant execute on function public.pay_refund(text, text, text, numeric) to anon, authenticated;

-- a left checkout, a declined card, a dispute (the admin's Fizetési hibák page)
create or replace function public.pay_event(p_key text, p_row jsonb) returns boolean
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.record_pay_event(p_row);
end $$;
revoke execute on function public.pay_event(text, jsonb) from public;
grant execute on function public.pay_event(text, jsonb) to anon, authenticated;

-- the admin's "give a package" button (Vevők page): a manual purchase with no money
create or replace function public.admin_pay_grant(p_user uuid, p_plan text, p_name text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  n := public.pay_plan_credits(p_plan);
  if n <= 0 then raise exception 'bad_plan'; end if;
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency, note)
  values (p_user, 'manual', 'admin-' || gen_random_uuid(), 'inkage.' || p_plan, p_plan, n, 0, 'USD', left(coalesce(p_note, p_name), 300));
  return jsonb_build_object('ok', true, 'credits', public.pay_credits(p_user));
end $function$;
