-- APPLIED live 2026-11-12 (migration inkage_b2b_lead_annual_topup_20261112).
-- Annual studio plans (10 months' price for 12, previews refilled monthly), the +20 top-up, company billing data,
-- outreach ref on the subscription, and one trial per company name.
create or replace function public.pay_plan_credits(p_plan text)
 returns integer language sql immutable
as $function$
  select case p_plan when 'mini' then 5 when 'plus' then 15 when 'studio' then 40
    when 'b2b_trial' then 20 when 'b2b_studio' then 40 when 'b2b_pro' then 120 when 'b2b_clinic' then 150
    when 'b2b_studio_y' then 40 when 'b2b_pro_y' then 120 when 'b2b_clinic_y' then 150 when 'b2b_topup' then 20 else 0 end
$function$;

alter table public.b2b_subs add column if not exists tax_number text;
alter table public.b2b_subs add column if not exists ref text;
alter table public.b2b_subs add column if not exists last_refill_at timestamptz;

-- status 'none' = billing data saved, no trial or plan yet
-- company name + tax number before checkout (the invoice needs them), and the outreach ref
create or replace function public.b2b_set_billing(p_company text, p_tax text, p_ref text default null)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.b2b_subs(user_id, company, status, tax_number, ref)
  values (uid, nullif(left(trim(coalesce(p_company, '')), 120), ''), 'none', nullif(left(trim(coalesce(p_tax, '')), 30), ''), nullif(left(coalesce(p_ref, ''), 60), ''))
  on conflict (user_id) do update set
    company = coalesce(nullif(left(trim(coalesce(p_company, '')), 120), ''), public.b2b_subs.company),
    tax_number = coalesce(nullif(left(trim(coalesce(p_tax, '')), 30), ''), public.b2b_subs.tax_number),
    ref = coalesce(public.b2b_subs.ref, nullif(left(coalesce(p_ref, ''), 60), '')), updated_at = now();
  return json_build_object('ok', true);
end $function$;
revoke all on function public.b2b_set_billing(text, text, text) from public, anon;
grant execute on function public.b2b_set_billing(text, text, text) to authenticated;

-- server-side read of the billing data (webhook → Billingo)
create or replace function public.b2b_billing_of(p_key text, p_user uuid)
 returns json language sql stable security definer set search_path to ''
as $function$ select case when public.pay_key_ok(p_key) then (select json_build_object('company', company, 'tax', tax_number, 'status', status, 'customer', stripe_customer, 'sub', stripe_sub, 'plan', plan) from public.b2b_subs where user_id = p_user) end $function$;

-- an annual invoice adds the first month; remember when
create or replace function public.b2b_mark_refill(p_key text, p_user uuid)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.b2b_subs set last_refill_at = now(), updated_at = now() where user_id = p_user;
end $function$;

-- daily: every active annual plan gets its month's previews one month after the last refill, until the paid year ends
create or replace function public.b2b_annual_refill()
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare s record; nxt timestamptz; n int := 0;
begin
  for s in select * from public.b2b_subs where status in ('active', 'past_due') and plan like 'b2b\_%\_y' and last_refill_at is not null loop
    nxt := s.last_refill_at + interval '1 month';
    while nxt <= now() and (s.current_period_end is null or nxt < s.current_period_end) loop
      insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency, note)
      values (s.user_id, 'manual', 'b2b-y-' || s.user_id || '-' || to_char(nxt, 'YYYYMMDD'), 'inkage.' || s.plan, s.plan, public.pay_plan_credits(s.plan), null, 'HUF', 'annual monthly refill')
      on conflict (store, transaction_id) do nothing;
      n := n + 1;
      update public.b2b_subs set last_refill_at = nxt, updated_at = now() where user_id = s.user_id;
      nxt := nxt + interval '1 month';
    end loop;
  end loop;
  return n;
end $function$;
revoke all on function public.b2b_annual_refill() from public, anon, authenticated;
select cron.schedule('inkage-b2b-annual-refill', '23 3 * * *', 'select public.b2b_annual_refill()');

-- one trial per company: the same name (case, spaces and "kft/bt/ev" ignored) can't start a second one
create or replace function public.b2b_company_key(p text)
 returns text language sql immutable
as $function$ select regexp_replace(regexp_replace(lower(coalesce(p, '')), '\m(kft|bt|e\.?v|zrt|nyrt|kkt)\M\.?', '', 'g'), '[^a-z0-9áéíóöőúüű]+', '', 'g') $function$;

create or replace function public.b2b_trial_start(p_company text)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); s public.b2b_subs; k text := public.b2b_company_key(p_company);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.b2b_subs where user_id = uid;
  if found and (s.trial_ends_at is not null or s.status <> 'none' or s.stripe_sub is not null) then
    return json_build_object('ok', false, 'reason', 'exists', 'status', s.status);
  end if;
  if length(k) >= 3 and exists (select 1 from public.b2b_subs o where o.user_id <> uid and o.trial_ends_at is not null and public.b2b_company_key(o.company) = k) then
    return json_build_object('ok', false, 'reason', 'company_exists');
  end if;
  insert into public.b2b_subs(user_id, company, status, trial_ends_at) values (uid, left(trim(coalesce(p_company, '')), 120), 'trial', now() + interval '14 days')
  on conflict (user_id) do update set company = coalesce(nullif(excluded.company, ''), public.b2b_subs.company), status = 'trial', trial_ends_at = excluded.trial_ends_at, updated_at = now();
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency, note)
  values (uid, 'manual', 'b2b-trial-' || uid, 'inkage.b2b_trial', 'b2b_trial', 20, 0, 'HUF', 'B2B trial 14 days')
  on conflict (store, transaction_id) do nothing;
  return json_build_object('ok', true, 'trial_ends_at', now() + interval '14 days');
end $function$;

-- APPLIED 2026-11-12 (inkage_b2b_lead_annual_in_meter_seats_20261112): b2b_me and b2b_seats also know b2b_*_y (patched in place).
-- APPLIED 2026-11-12 (inkage_b2b_lead_progress_20261112): b2b_lead_progress(p_key, p_email, p_status) moves a lead forward
-- (trial → proba from /api/b2b/trial, paid invoice → elofizeto from the webhook), never backwards.
