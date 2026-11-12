-- APPLIED live 2026-11-12 (migration inkage_b2b_mail_log_and_due_20261112).
-- B2B e-mails for studios (lib/b2b-mail.ts, /api/b2b/mail-cron): a send log so every mail goes once, the facts a mail
-- needs (remaining previews, trial use, annual or monthly), the list of what is due, and the consumer welcome
-- sweep skipping studios. Additive: one new table, new functions, welcome_due keeps its signature.

create table if not exists public.b2b_mail_log (
  user_id uuid not null,
  kind text not null,
  ref text not null default '',
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.b2b_mail_log enable row level security; -- no policies: only the functions below touch it
revoke all on table public.b2b_mail_log from anon, authenticated;

-- claim a mail before sending it: true only for the first caller (a failed send gives it back with b2b_mail_undo)
create or replace function public.b2b_mail_claim(p_key text, p_user uuid, p_kind text, p_ref text default '')
 returns boolean language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.b2b_mail_log(user_id, kind, ref) values (p_user, left(p_kind, 40), left(coalesce(p_ref, ''), 120)) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $function$;

create or replace function public.b2b_mail_undo(p_key text, p_user uuid, p_kind text, p_ref text default '')
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.b2b_mail_log where user_id = p_user and kind = p_kind and ref = coalesce(p_ref, '');
end $function$;

-- what a studio mail says: the subscription row, the e-mail address, previews left (the same sum my_quota shows
-- a paying account), trial use, and whether the plan is billed yearly (Stripe's period is longer than 60 days)
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
  select max(created_at) into last_inv from public.purchases where user_id = p_user and store = 'stripe' and plan like 'b2b\_%' and plan <> 'b2b_trial';
  return json_build_object(
    'email', em, 'company', s.company, 'plan', s.plan, 'status', s.status, 'trial_ends_at', s.trial_ends_at,
    'current_period_end', s.current_period_end, 'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'stripe_sub', s.stripe_sub, 'created_at', s.created_at, 'updated_at', s.updated_at,
    'lang', p.lang, 'mail_off', coalesce(p.mail_off, false),
    'remaining', greatest(0, cr + legacy + case when cr > 0 then coalesce(p.bonus, 0) else 0 end - used),
    'trial_used', t_used, 'trial_n', t_n, 'trial_left', greatest(0, t_n - t_used),
    'last_invoice_at', last_inv,
    'annual', coalesce(s.current_period_end - last_inv > interval '60 days', false));
end $function$;

-- the monthly summary: the newest paid refill (within 3 days) and the period before it (from the previous paid one)
create or replace function public.b2b_mail_summary(p_key text, p_user uuid)
 returns json language plpgsql stable security definer set search_path to ''
as $function$
declare cur public.purchases; prev public.purchases; n int;
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into cur from public.purchases where user_id = p_user and plan in ('b2b_studio', 'b2b_pro', 'b2b_clinic') and credits > 0
   order by created_at desc limit 1;
  if not found or cur.created_at < now() - interval '3 days' then return null; end if;
  select * into prev from public.purchases where user_id = p_user and plan in ('b2b_studio', 'b2b_pro', 'b2b_clinic') and created_at < cur.created_at
   order by created_at desc limit 1;
  if not found then return null; end if; -- the first paid month: nothing to sum up yet
  select count(*) into n from public.generations where user_id = p_user and kind = 'preview' and created_at >= prev.created_at and created_at < cur.created_at;
  return json_build_object('ref', cur.transaction_id, 'from', prev.created_at, 'to', cur.created_at, 'previews', n, 'added', cur.credits);
end $function$;

-- what the cron should look at: ids per kind (the route claims each before sending, so a list may repeat safely)
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
    -- active, past due or cancelled lately: b2bMailSync decides (confirmed / payment failed / cancelled)
    'sync', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status in ('active', 'past_due', 'canceled') and s.updated_at > now() - interval '3 days'),
    'renewal', (select coalesce(json_agg(s.user_id), '[]') from public.b2b_subs s where s.status = 'active' and not coalesce(s.cancel_at_period_end, false)
       and s.current_period_end between now() and now() + interval '3 days'),
    'summary', (select coalesce(json_agg(distinct p.user_id), '[]') from public.purchases p join public.b2b_subs s on s.user_id = p.user_id
       where s.status in ('active', 'past_due') and p.plan in ('b2b_studio', 'b2b_pro', 'b2b_clinic') and p.credits > 0 and p.created_at > now() - interval '3 days'));
end $function$;

revoke all on function public.b2b_mail_claim(text, uuid, text, text) from public;
revoke all on function public.b2b_mail_undo(text, uuid, text, text) from public;
revoke all on function public.b2b_mail_info(text, uuid) from public;
revoke all on function public.b2b_mail_summary(text, uuid) from public;
revoke all on function public.b2b_mail_due(text) from public;
-- the server calls these with the anon key; each checks pay_key_ok first (same as b2b_sub_set)
grant execute on function public.b2b_mail_claim(text, uuid, text, text) to anon, authenticated;
grant execute on function public.b2b_mail_undo(text, uuid, text, text) to anon, authenticated;
grant execute on function public.b2b_mail_info(text, uuid) to anon, authenticated;
grant execute on function public.b2b_mail_summary(text, uuid) to anon, authenticated;
grant execute on function public.b2b_mail_due(text) to anon, authenticated;

-- the consumer welcome sweep skips studios (an account with a B2B row gets the studio welcome instead)
create or replace function public.welcome_due(p_secret text) returns json
 language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select u.id::text id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang, u.raw_user_meta_data meta,
      coalesce(u.raw_app_meta_data->>'provider', 'email') provider, u.created_at, pr.signup_source source
    from auth.users u left join public.profiles pr on pr.id = u.id
    where u.created_at between now() - interval '14 days' and now() - interval '10 minutes'
      and u.email is not null and u.email !~~ 'erased+%@inkage.invalid'
      and pr.welcomed_at is null
      and not exists (select 1 from public.b2b_subs b where b.user_id = u.id)
    order by u.created_at limit 40) x);
end $function$;
revoke all on function public.welcome_due(text) from public;
grant execute on function public.welcome_due(text) to anon, authenticated;

-- TO RUN AFTER THE DEPLOY (the lead): the cron job. Not scheduled yet, so the live site doesn't get 404 calls.
-- select cron.schedule('inkage-b2b-mail', '*/10 * * * *', $$select public.admin_cron_call('/api/b2b/mail-cron')$$);
