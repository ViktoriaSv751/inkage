-- 2026-11-10 owner: InkAge fully paid on the web, no free preview at all. APPLIED live (migration inkage_no_free_trial_20261110).
-- New accounts (pay_mode 'trial') get 0 previews and 0 AI helper jobs until they buy. A trial preview made before
-- 2026-11-10 05:20 UTC still counts as allowed (those accounts never show a negative or lose a bought one).
-- Invite bonuses only add on top of a bought package. Store apps, reviewers and 'free' mode are unchanged.
create or replace function public.my_quota(p_native boolean default false, p_key text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  p public.profiles;
  lim int;
  used int;
  legacy int;
  mode text;
  cr int;
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
  since timestamptz;
  no_trial_from constant timestamptz := '2026-11-10 05:20:00+00';
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
  since := public.pay_start();
  if p.created_at < since then since := (date_trunc('month', since at time zone 'Europe/Budapest') + interval '1 month') at time zone 'Europe/Budapest'; end if;
  cr := public.pay_credits(uid);
  select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at >= since;
  select least(1, count(*)) into legacy from public.generations where user_id = uid and kind = 'preview' and created_at >= since and created_at < no_trial_from;
  lim := cr + legacy + case when cr > 0 then coalesce(p.bonus, 0) else 0 end;
  return json_build_object('used', used, 'limit', lim, 'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'total',
    'resetsAt', null, 'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
    'notifyVotes', coalesce(p.notify_votes, true), 'pay', mode, 'payLive', true, 'credits', cr, 'noTrial', true);
end $function$;

create or replace function public.helper_start(p_label text, p_native boolean default false, p_key text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare used int; global_day int; gid bigint; rev boolean; mode text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('helper:' || auth.uid()::text));
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false) then
    mode := public.pay_mode(auth.uid(), p_native, p_key);
    -- 2026-11-10: no free AI drawings / cut-outs before a package
    if mode = 'trial' then return json_build_object('ok', false, 'reason', 'paywall'); end if;
    select count(*) into used from public.generations where user_id = auth.uid() and kind = 'helper' and created_at > now() - interval '24 hours';
    select count(*) into global_day from public.generations where kind = 'helper' and created_at > now() - interval '24 hours';
    if used >= 15 then return json_build_object('ok', false, 'reason', 'used'); end if;
    if global_day >= 600 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  end if;
  insert into public.generations(user_id, placement, kind) values (auth.uid(), left(p_label, 80), 'helper') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$;
