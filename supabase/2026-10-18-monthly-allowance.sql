-- Applied to the live database on 2026-10-18.
-- The preview allowance is 30 per calendar month (Budapest time, starts again on the 1st) instead of 30 per 24 hours.
-- Invite bonuses still add to it. start_generation() reads this, so nothing else changes.
CREATE OR REPLACE FUNCTION public.my_quota()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  p public.profiles;
  lim int;
  used int;
  -- the allowance is per calendar month (Budapest time) and starts again on the 1st
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  -- 30 previews a month, plus invite bonuses
  lim := 30 + coalesce(p.bonus, 0);
  select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at >= month_start;
  return json_build_object('plan', 'free', 'used', used, 'limit', lim,
    'remaining', greatest(0, lim - used), 'canAge', true, 'period', 'month',
    'resetsAt', (month_start at time zone 'Europe/Budapest' + interval '1 month') at time zone 'Europe/Budapest',
    'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
    'notifyVotes', coalesce(p.notify_votes, true), 'stripe_customer_id', null);
end $function$;
