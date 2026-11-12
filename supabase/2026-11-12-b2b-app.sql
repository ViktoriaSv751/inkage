-- APPLIED live 2026-11-12 (migration inkage_b2b_app_team_quota_20261112). B2B studio accounts inside the app (agent "app"). Tests: 2026-11-12-b2b-app-test.sql (PASS before and after applying).
-- Additive: new table b2b_team, new column generations.billed_to (null = the maker's own account, as before),
-- new functions; my_quota / start_generation / pay_mode / b2b_trial_expire keep their signatures and JSON keys
-- (my_quota only ADDS 'studio' and 'team'). For anyone who is not in a team the numbers are exactly the same as before:
-- pay_account(uid) = uid, and "used" counts (user_id = uid and billed_to is null) or billed_to = uid, which for them is
-- the same rows as user_id = uid.
--
-- Team rules: the owner is the account with the b2b_subs row. Seats INCLUDING the owner: b2b_studio 1 (owner only),
-- trial 2, b2b_pro 5, b2b_clinic 5. A member's previews are billed to the owner (generations.billed_to = owner):
-- they use the owner's purchases, and the owner sees per-member usage. One team per member. A removed member falls back
-- to their own account (their earlier team previews stay counted on the owner, where they were paid from).
-- An account that has its own b2b_subs row is never a member (its own subscription wins).

-- ---------------------------------------------------------------- tables
create table if not exists public.b2b_team (
  id bigserial primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  member uuid references auth.users(id) on delete cascade,
  email text not null,
  invite_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists b2b_team_one_team on public.b2b_team(member) where member is not null;
create index if not exists b2b_team_owner on public.b2b_team(owner);
alter table public.b2b_team enable row level security;
drop policy if exists b2b_team_select_own on public.b2b_team;
create policy b2b_team_select_own on public.b2b_team for select to authenticated using (owner = auth.uid() or member = auth.uid());

alter table public.generations add column if not exists billed_to uuid;
create index if not exists generations_billed_to on public.generations(billed_to, created_at desc) where billed_to is not null;

-- ---------------------------------------------------------------- helpers (internal)
/* whose previews this account uses: the team owner for an accepted member, otherwise itself */
create or replace function public.pay_account(p_uid uuid)
 returns uuid language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (select t.owner from public.b2b_team t
      where t.member = p_uid and t.accepted_at is not null
        and not exists (select 1 from public.b2b_subs s where s.user_id = p_uid)
      limit 1),
    p_uid)
$$;

/* previews made on an account's pool since a moment: its own (not billed elsewhere) + its members' */
create or replace function public.pay_used(p_acct uuid, p_since timestamptz)
 returns integer language sql stable security definer set search_path to ''
as $$
  select ((select count(*) from public.generations g where g.user_id = p_acct and g.billed_to is null and g.kind = 'preview' and g.created_at >= p_since)
        + (select count(*) from public.generations g where g.billed_to = p_acct and g.kind = 'preview' and g.created_at >= p_since))::int
$$;

/* a studio account: has its own b2b_subs row (any status) or is an accepted team member */
create or replace function public.b2b_is_studio(p_uid uuid)
 returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (select 1 from public.b2b_subs s where s.user_id = p_uid)
      or exists (select 1 from public.b2b_team t where t.member = p_uid and t.accepted_at is not null)
$$;

/* seats including the owner */
create or replace function public.b2b_seats(p_owner uuid)
 returns integer language sql stable security definer set search_path to ''
as $$
  select coalesce((select case
      when s.plan in ('b2b_pro', 'b2b_clinic') then 5
      when s.plan = 'b2b_studio' then 1
      when s.status in ('trial', 'trial_ended') then 2
      else 1 end
    from public.b2b_subs s where s.user_id = p_owner), 1)
$$;

revoke all on function public.pay_account(uuid) from public, anon, authenticated;
revoke all on function public.pay_used(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.b2b_is_studio(uuid) from public, anon, authenticated;
revoke all on function public.b2b_seats(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- pay_mode: a member is "paid" on the owner's purchases;
-- a studio account always counts on its pool (the old store builds' 30-a-month free mode does not apply to it)
create or replace function public.pay_mode(p_uid uuid, p_native boolean default false, p_key text default null::text)
 returns text language plpgsql stable security definer set search_path to ''
as $function$
declare st timestamptz; created timestamptz; rev boolean;
begin
  if not public.pay_live() then return 'free'; end if;
  if p_native and public.pay_key_ok(p_key) and not public.b2b_is_studio(p_uid) then return 'free'; end if;
  select coalesce(reviewer, false), created_at into rev, created from public.profiles where id = p_uid;
  if coalesce(rev, false) then return 'free'; end if;
  if public.pay_credits(public.pay_account(p_uid)) > 0 then return 'paid'; end if;
  st := public.pay_start();
  if created < st and now() < (date_trunc('month', st at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest' then return 'free'; end if;
  return 'trial';
end $function$;

-- ---------------------------------------------------------------- my_quota (same keys + 'studio', 'team')
create or replace function public.my_quota(p_native boolean default false, p_key text default null::text)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  p public.profiles;
  op public.profiles;
  acct uuid;
  lim int; used int; legacy int; mode text; cr int;
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
  since timestamptz;
  no_trial_from constant timestamptz := '2026-11-10 05:20:00+00';
  tleft boolean := false;
  studio boolean;
  team text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  acct := public.pay_account(uid);
  studio := public.b2b_is_studio(uid);
  team := case when acct <> uid then 'member'
               when exists (select 1 from public.b2b_team t where t.owner = uid and t.accepted_at is not null) then 'owner' end;
  mode := public.pay_mode(uid, p_native, p_key);
  if mode = 'free' then
    lim := 30 + coalesce(p.bonus, 0) + case when coalesce(p.reviewer, false) then 1000 else 0 end;
    select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at >= month_start;
    return json_build_object('used', used, 'limit', lim,
      'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'month',
      'resetsAt', (month_start at time zone 'Europe/Budapest' + interval '1 month') at time zone 'Europe/Budapest',
      'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
      'notifyVotes', coalesce(p.notify_votes, true), 'pay', 'free', 'payLive', public.pay_live(), 'studio', studio, 'team', team);
  end if;
  if acct = uid then op := p; else select * into op from public.profiles where id = acct; end if;
  since := public.pay_start();
  if op.created_at < since then since := (date_trunc('month', since at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest'; end if;
  cr := public.pay_credits(acct);
  used := public.pay_used(acct, since);
  select least(1, count(*)) into legacy from public.generations g
   where ((g.user_id = acct and g.billed_to is null) or g.billed_to = acct) and g.kind = 'preview' and g.created_at >= since and g.created_at < no_trial_from;
  lim := cr + legacy + case when cr > 0 then coalesce(op.bonus, 0) else 0 end;
  -- one teaser per account that never had a trial preview and has no package; never for a studio account
  if mode = 'trial' and not studio then
    tleft := public.teaser_on() and legacy = 0 and not exists (select 1 from public.generations where user_id = uid and kind = 'preview' and placement like '%#teaser%');
  end if;
  return json_build_object('used', used, 'limit', lim, 'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'total',
    'resetsAt', null, 'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
    'notifyVotes', coalesce(p.notify_votes, true), 'pay', mode, 'payLive', true, 'credits', cr, 'noTrial', true, 'teaserLeft', tleft,
    'studio', studio, 'team', team);
end $function$;

-- ---------------------------------------------------------------- start_generation: a member's preview is billed to the owner
create or replace function public.start_generation(p_placement text, p_native boolean default false, p_key text default null::text)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare q json; gid bigint; rev boolean; teaser boolean := false; acct uuid;
begin
  acct := public.pay_account(auth.uid());
  -- the pool's lock: the owner and the members never spend the last preview twice (= the old per-user lock for everyone else)
  perform pg_advisory_xact_lock(hashtext(acct::text));
  q := public.my_quota(p_native, p_key);
  if (q->>'remaining')::int <= 0 then
    if q->>'pay' = 'trial' and coalesce((q->>'teaserLeft')::boolean, false) then
      teaser := true;
    else
      return (json_build_object('ok', false, 'reason', case when q->>'pay' = 'free' then 'used' else 'paywall' end)::jsonb || q::jsonb)::json;
    end if;
  end if;
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false)
     and (select count(*) from public.generations where kind = 'preview' and created_at > now() - interval '24 hours') >= 300 then
    return (json_build_object('ok', false, 'reason', 'busy')::jsonb || q::jsonb)::json;
  end if;
  insert into public.generations(user_id, placement, billed_to)
  values (auth.uid(), left(p_placement, 60) || case when teaser then '#teaser' else '' end,
          case when acct <> auth.uid() and q->>'pay' <> 'free' then acct end)
  returning id into gid;
  return (json_build_object('ok', true, 'gid', gid, 'teaser', teaser)::jsonb || q::jsonb)::json;
end $function$;

-- ---------------------------------------------------------------- trial end: previews made by the members during the trial count too
create or replace function public.b2b_trial_expire()
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  update public.purchases p
     set credits = least(p.credits, public.pay_used(s.user_id, s.created_at)),
         note = coalesce(p.note, '') || ' · trial ended'
    from public.b2b_subs s
   where s.status = 'trial' and s.trial_ends_at < now() and p.user_id = s.user_id and p.plan = 'b2b_trial' and p.store = 'manual'
     and p.transaction_id = 'b2b-trial-' || s.user_id;
  get diagnostics n = row_count;
  update public.b2b_subs set status = 'trial_ended', updated_at = now() where status = 'trial' and trial_ends_at < now();
  return n;
end $function$;
revoke all on function public.b2b_trial_expire() from public, anon, authenticated;

-- ---------------------------------------------------------------- b2b_me: the usage meter
create or replace function public.b2b_me()
 returns json language plpgsql security definer set search_path to ''
as $function$
declare
  uid uuid := auth.uid(); acct uuid; s public.b2b_subs; q json;
  ps timestamptz; grant_n int := 0; extra_n int := 0; used_p int := 0; rem int; nxt timestamptz; tdays int; owner_email text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.b2b_is_studio(uid) then return json_build_object('studio', false); end if;
  acct := public.pay_account(uid);
  select * into s from public.b2b_subs where user_id = acct;
  q := public.my_quota(false, null);
  rem := coalesce((q->>'remaining')::int, 0);
  -- this period = since the latest monthly refill (or the trial start)
  select p.created_at, p.credits into ps, grant_n from public.purchases p
   where p.user_id = acct and p.plan in ('b2b_trial', 'b2b_studio', 'b2b_pro', 'b2b_clinic')
     and (p.refunded_at is null or coalesce(p.refund_amount, 0) < coalesce(p.amount, 0))
   order by p.created_at desc limit 1;
  if ps is not null then
    select coalesce(sum(p.credits), 0) into extra_n from public.purchases p
     where p.user_id = acct and p.created_at > ps and p.plan not in ('b2b_trial', 'b2b_studio', 'b2b_pro', 'b2b_clinic')
       and (p.refunded_at is null or coalesce(p.refund_amount, 0) < coalesce(p.amount, 0));
    used_p := public.pay_used(acct, ps);
  end if;
  if s.status in ('active', 'past_due') and not coalesce(s.cancel_at_period_end, false) then
    nxt := case when ps is not null and s.plan is not null and s.current_period_end is not null then least(s.current_period_end, ps + interval '1 month')
                else s.current_period_end end;
  end if;
  if s.status = 'trial' then tdays := greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400)::int); end if;
  if acct <> uid then select u.email into owner_email from auth.users u where u.id = acct; end if;
  return json_build_object(
    'studio', true,
    'role', case when acct <> uid then 'member' else 'owner' end,
    'company', s.company,
    'ownerEmail', owner_email,
    'plan', s.plan,
    'status', s.status,
    'trial', s.status = 'trial',
    'trialEndsAt', s.trial_ends_at,
    'trialDaysLeft', tdays,
    'trialTotal', case when s.status = 'trial' then grant_n end,
    'remaining', rem,
    'usedPeriod', used_p,
    'periodStart', ps,
    'refill', grant_n,
    'extra', extra_n,
    'carried', greatest(0, rem + used_p - coalesce(grant_n, 0) - coalesce(extra_n, 0)),
    'nextRefill', nxt,
    'periodEnd', s.current_period_end,
    'cancelAtPeriodEnd', coalesce(s.cancel_at_period_end, false),
    'low', rem <= 5,
    'seats', public.b2b_seats(acct),
    'members', (select count(*) from public.b2b_team t where t.owner = acct and t.accepted_at is not null));
end $function$;

-- ---------------------------------------------------------------- team
create or replace function public.b2b_team_invite(p_email text)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); s public.b2b_subs; e text := lower(trim(coalesce(p_email, ''))); t public.b2b_team; n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.b2b_subs where user_id = uid;
  if not found then return json_build_object('ok', false, 'reason', 'not_owner'); end if;
  if s.status not in ('trial', 'active', 'past_due') then return json_build_object('ok', false, 'reason', 'inactive'); end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 200 then return json_build_object('ok', false, 'reason', 'email'); end if;
  if e = lower(coalesce((select u.email from auth.users u where u.id = uid), '')) then return json_build_object('ok', false, 'reason', 'own'); end if;
  perform pg_advisory_xact_lock(hashtext('b2bteam:' || uid::text));
  select * into t from public.b2b_team where owner = uid and lower(email) = e and accepted_at is null limit 1;
  if found then return json_build_object('ok', true, 'id', t.id, 'token', t.invite_token, 'path', '/app/csapat?t=' || t.invite_token, 'again', true); end if;
  select count(*) into n from public.b2b_team where owner = uid;
  if n + 1 >= public.b2b_seats(uid) then return json_build_object('ok', false, 'reason', 'seats', 'seats', public.b2b_seats(uid)); end if;
  insert into public.b2b_team(owner, email) values (uid, e) returning * into t;
  return json_build_object('ok', true, 'id', t.id, 'token', t.invite_token, 'path', '/app/csapat?t=' || t.invite_token);
end $function$;

create or replace function public.b2b_team_join(p_token text)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); t public.b2b_team; n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into t from public.b2b_team where invite_token = trim(coalesce(p_token, ''));
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if t.member = uid then return json_build_object('ok', true, 'already', true); end if;
  if t.member is not null then return json_build_object('ok', false, 'reason', 'taken'); end if;
  if t.owner = uid then return json_build_object('ok', false, 'reason', 'own'); end if;
  if exists (select 1 from public.b2b_subs s where s.user_id = uid) then return json_build_object('ok', false, 'reason', 'studio'); end if;
  if exists (select 1 from public.b2b_team x where x.member = uid) then return json_build_object('ok', false, 'reason', 'other_team'); end if;
  perform pg_advisory_xact_lock(hashtext('b2bteam:' || t.owner::text));
  select count(*) into n from public.b2b_team where owner = t.owner and accepted_at is not null;
  if n + 2 > public.b2b_seats(t.owner) then return json_build_object('ok', false, 'reason', 'seats'); end if;
  update public.b2b_team set member = uid, accepted_at = now() where id = t.id;
  return json_build_object('ok', true, 'company', (select s.company from public.b2b_subs s where s.user_id = t.owner));
end $function$;

create or replace function public.b2b_team_remove(p_id bigint)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.b2b_team where id = p_id and owner = auth.uid();
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
end $function$;

create or replace function public.b2b_team_leave()
 returns json language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.b2b_team where member = auth.uid();
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
end $function$;

/* owner: members + invites + per-member usage this period and in all; member: whose team */
create or replace function public.b2b_team_list()
 returns json language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); s public.b2b_subs; t public.b2b_team; ps timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.b2b_subs where user_id = uid;
  if found then
    select max(p.created_at) into ps from public.purchases p where p.user_id = uid and p.plan in ('b2b_trial', 'b2b_studio', 'b2b_pro', 'b2b_clinic');
    ps := coalesce(ps, s.created_at);
    return json_build_object('role', 'owner', 'company', s.company, 'status', s.status, 'plan', s.plan,
      'seats', public.b2b_seats(uid), 'periodStart', ps,
      'canInvite', s.status in ('trial', 'active', 'past_due') and (select count(*) from public.b2b_team x where x.owner = uid) + 1 < public.b2b_seats(uid),
      'ownerUsedPeriod', (select count(*) from public.generations g where g.user_id = uid and g.billed_to is null and g.kind = 'preview' and g.created_at >= ps),
      'members', coalesce((select json_agg(json_build_object(
          'id', x.id, 'email', x.email, 'memberEmail', (select u.email from auth.users u where u.id = x.member),
          'joined', x.accepted_at is not null, 'acceptedAt', x.accepted_at, 'createdAt', x.created_at,
          'path', case when x.accepted_at is null then '/app/csapat?t=' || x.invite_token end,
          'usedPeriod', (select count(*) from public.generations g where g.billed_to = uid and g.user_id = x.member and g.kind = 'preview' and g.created_at >= ps),
          'usedTotal', (select count(*) from public.generations g where g.billed_to = uid and g.user_id = x.member and g.kind = 'preview'))
        order by x.created_at) from public.b2b_team x where x.owner = uid), '[]'::json));
  end if;
  select * into t from public.b2b_team where member = uid and accepted_at is not null;
  if found then
    return json_build_object('role', 'member', 'company', (select x.company from public.b2b_subs x where x.user_id = t.owner),
      'ownerEmail', (select u.email from auth.users u where u.id = t.owner), 'acceptedAt', t.accepted_at,
      'usedTotal', (select count(*) from public.generations g where g.billed_to = t.owner and g.user_id = uid and g.kind = 'preview'));
  end if;
  return json_build_object('role', null);
end $function$;

/* the invite page before joining: which studio invited (nothing else about the owner) */
create or replace function public.b2b_team_peek(p_token text)
 returns json language sql stable security definer set search_path to ''
as $$
  select coalesce((select json_build_object('ok', true, 'company', s.company, 'taken', coalesce(t.member <> auth.uid(), false), 'mine', coalesce(t.member = auth.uid(), false), 'own', t.owner = auth.uid())
    from public.b2b_team t left join public.b2b_subs s on s.user_id = t.owner where t.invite_token = trim(coalesce(p_token, ''))), json_build_object('ok', false))
$$;

revoke all on function public.b2b_me() from public, anon;
revoke all on function public.b2b_team_invite(text) from public, anon;
revoke all on function public.b2b_team_join(text) from public, anon;
revoke all on function public.b2b_team_remove(bigint) from public, anon;
revoke all on function public.b2b_team_leave() from public, anon;
revoke all on function public.b2b_team_list() from public, anon;
revoke all on function public.b2b_team_peek(text) from public, anon;
grant execute on function public.b2b_me(), public.b2b_team_invite(text), public.b2b_team_join(text), public.b2b_team_remove(bigint),
  public.b2b_team_leave(), public.b2b_team_list(), public.b2b_team_peek(text) to authenticated;
