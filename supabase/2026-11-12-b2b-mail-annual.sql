-- APPLIED live 2026-11-12 (migration inkage_b2b_mail_annual_plans_20261112).
-- Annual plans have their own ids (b2b_studio_y / b2b_pro_y / b2b_clinic_y, set by the lead): "yearly" is now the
-- plan id, not a guess from the period length. The monthly summary follows refills: monthly plans' Stripe invoices and
-- every b2b_*_y row (the annual invoice and the monthly manual refills 'b2b-y-<uid>-<YYYYMMDD>'); never b2b_topup or
-- b2b_trial. Status 'none' (billing data saved, nothing started) gets no studio mails (no list below includes it).
-- Same signatures as inkage_b2b_mail_log_and_due_20261112.

create or replace function public.b2b_mail_refill(p public.purchases)
 returns boolean language sql immutable set search_path to ''
as $function$
  select coalesce(p.credits, 0) > 0 and (
    (p.store = 'stripe' and p.plan in ('b2b_studio', 'b2b_pro', 'b2b_clinic'))
    or p.plan in ('b2b_studio_y', 'b2b_pro_y', 'b2b_clinic_y'))
$function$;
revoke all on function public.b2b_mail_refill(public.purchases) from public, anon, authenticated;

create or replace function public.b2b_mail_info(p_key text, p_user uuid)
 returns json language plpgsql stable security definer set search_path to ''
as $function$
declare s public.b2b_subs; p public.profiles; em text; cr int; used int; legacy int; since timestamptz;
  no_trial_from constant timestamptz := '2026-11-10 05:20:00+00';
  t_used int; t_n int; last_inv timestamptz;
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into s from public.b2b_subs where user_id = p_user;
  if not found then return null; end if;
  select * into p from public.profiles where id = p_user;
  select email into em from auth.users where id = p_user;
  since := public.pay_start();
  if p.created_at < since then since := (date_trunc('month', since at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest'; end if;
  cr := public.pay_credits(p_user);
  select count(*) into used from public.generations where user_id = p_user and kind = 'preview' and created_at >= since;
  select least(1, count(*)) into legacy from public.generations where user_id = p_user and kind = 'preview' and created_at >= since and created_at < no_trial_from;
  select count(*) into t_used from public.generations where user_id = p_user and kind = 'preview' and created_at >= s.created_at and created_at < coalesce(s.trial_ends_at, now());
  select coalesce(max(credits), 0) into t_n from public.purchases where user_id = p_user and transaction_id = 'b2b-trial-' || p_user;
  -- a paid subscription invoice (monthly or the annual one; not a top-up, not a manual refill)
  select max(created_at) into last_inv from public.purchases where user_id = p_user and store = 'stripe'
     and plan in ('b2b_studio', 'b2b_pro', 'b2b_clinic', 'b2b_studio_y', 'b2b_pro_y', 'b2b_clinic_y');
  return json_build_object(
    'email', em, 'company', s.company, 'plan', s.plan, 'status', s.status, 'trial_ends_at', s.trial_ends_at,
    'current_period_end', s.current_period_end, 'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'stripe_sub', s.stripe_sub, 'created_at', s.created_at, 'updated_at', s.updated_at,
    'lang', p.lang, 'mail_off', coalesce(p.mail_off, false),
    'remaining', greatest(0, cr + legacy + case when cr > 0 then coalesce(p.bonus, 0) else 0 end - used),
    'trial_used', t_used, 'trial_n', t_n, 'trial_left', greatest(0, t_n - t_used),
    'last_invoice_at', last_inv,
    'annual', coalesce(s.plan like '%\_y', false));
end $function$;

create or replace function public.b2b_mail_summary(p_key text, p_user uuid)
 returns json language plpgsql stable security definer set search_path to ''
as $function$
declare cur public.purchases; prev public.purchases; n int;
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into cur from public.purchases p where p.user_id = p_user and public.b2b_mail_refill(p) order by p.created_at desc limit 1;
  if not found or cur.created_at < now() - interval '3 days' then return null; end if;
  select * into prev from public.purchases p where p.user_id = p_user and public.b2b_mail_refill(p) and p.created_at < cur.created_at order by p.created_at desc limit 1;
  if not found then return null; end if; -- the first paid month: nothing to sum up yet
  select count(*) into n from public.generations where user_id = p_user and kind = 'preview' and created_at >= prev.created_at and created_at < cur.created_at;
  return json_build_object('ref', cur.transaction_id, 'from', prev.created_at, 'to', cur.created_at, 'previews', n, 'added', cur.credits);
end $function$;

create or replace function public.b2b_mail_due(p_key text)
 returns json language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  return json_build_object(
    'welcome', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'trial' and s.created_at > now() - interval '2 days'
       and not exists (select 1 from public.b2b_mail_log l where l.user_id = s.user_id and l.kind = 'trial_welcome')),
    'day7', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'trial' and s.created_at <= now() - interval '7 days' and s.created_at > now() - interval '12 days'
       and not exists (select 1 from public.b2b_mail_log l where l.user_id = s.user_id and l.kind = 'trial_day7')),
    'day12', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'trial' and s.created_at <= now() - interval '12 days' and s.trial_ends_at > now()
       and not exists (select 1 from public.b2b_mail_log l where l.user_id = s.user_id and l.kind = 'trial_day12')),
    'ended', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'trial_ended' and s.updated_at > now() - interval '3 days'
       and not exists (select 1 from public.b2b_mail_log l where l.user_id = s.user_id and l.kind = 'trial_ended')),
    'sync', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status in ('active', 'past_due', 'canceled') and s.updated_at > now() - interval '3 days'),
    'renewal', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'active' and s.plan like '%\_y' and not coalesce(s.cancel_at_period_end, false)
       and s.current_period_end between now() and now() + interval '3 days'),
    'summary', (select coalesce(json_agg(distinct p.user_id), '[]') from public.purchases p join public.b2b_subs s on s.user_id = p.user_id
       where s.status in ('active', 'past_due') and public.b2b_mail_refill(p) and p.created_at > now() - interval '3 days'));
end $function$;
