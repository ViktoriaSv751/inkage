-- Fault list 2026-10-29: cost caps, the job_put timeout, account erase, and the Explore trends.

-- 1. A global daily cap for signed-in previews too (it was only on guest previews, which are switched off):
--    one runaway account or a viral day can't empty the AI credit overnight. 'busy' shows the waiting-list sheet.
create or replace function public.start_generation(p_placement text)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  q json;
  gid bigint;
  rev boolean;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  q := public.my_quota();
  if (q->>'remaining')::int <= 0 then
    return (json_build_object('ok', false)::jsonb || q::jsonb)::json;
  end if;
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false)
     and (select count(*) from public.generations where kind = 'preview' and created_at > now() - interval '24 hours') >= 300 then
    return (json_build_object('ok', false, 'reason', 'busy')::jsonb || q::jsonb)::json;
  end if;
  insert into public.generations(user_id, placement) values (auth.uid(), left(p_placement, 80)) returning id into gid;
  return (json_build_object('ok', true, 'gid', gid)::jsonb || q::jsonb)::json;
end $function$;

-- 2. Aging images per preview: 4 aging stages + 3 laser sessions + one spare (was 14)
create or replace function public.bump_age(p_gid bigint)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare n int;
begin
  update public.generations set aged = aged + 1
  where id = p_gid and user_id = auth.uid() and aged < 8
  returning aged into n;
  return n is not null;
end $function$;

-- 3. Helper jobs (cut-out, AI drawing, redraw): 15 a day per account (was 60); 600 a day in all stays
create or replace function public.helper_start(p_label text)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare used int; global_day int; gid bigint; rev boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('helper:' || auth.uid()::text));
  select coalesce(reviewer, false) into rev from public.profiles where id = auth.uid();
  if not coalesce(rev, false) then
    select count(*) into used from public.generations where user_id = auth.uid() and kind = 'helper' and created_at > now() - interval '24 hours';
    select count(*) into global_day from public.generations where kind = 'helper' and created_at > now() - interval '24 hours';
    if used >= 15 then return json_build_object('ok', false, 'reason', 'used'); end if;
    if global_day >= 600 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  end if;
  insert into public.generations(user_id, placement, kind) values (auth.uid(), left(p_label, 80), 'helper') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$;

-- 4. job_put timed out (3 s for anon): it emptied old rows of the whole table on every call. The clean-up moves to a
--    nightly job, so saving a running preview is a single-row write.
create or replace function public.job_put(p_secret text, p_id text, p_owner text, p_key text, p_value jsonb)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  insert into public.jobs(id, owner, data) values (left(p_id, 64), p_owner, jsonb_build_object(p_key, p_value))
  on conflict (id) do update set data = public.jobs.data || jsonb_build_object(p_key, p_value), updated_at = now()
  where public.jobs.owner = p_owner;
end $function$;

create or replace function public.jobs_cleanup() returns void language sql security definer set search_path to 'public' as $$
  -- old results are emptied (images are large), the tiny row stays
  update public.jobs set data = '{}'::jsonb where created_at < now() - interval '2 days' and data <> '{}'::jsonb;
$$;
revoke all on function public.jobs_cleanup() from public, anon, authenticated;
select cron.schedule('inkage-jobs-cleanup', '17 3 * * *', 'select public.jobs_cleanup()');

-- 5. Deleting an account empties what was left in the rows: the preview details (spot, size, score, analysis,
--    report), the spots of past generations, the display name and the account's events. Only the bare dates stay
--    (so the monthly allowance can't be reset by signing in again).
create or replace function public.erase_my_account()
 returns void language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.community_posts set status = 'withdrawn', reviewed_at = now()
   where share_id in (select share_id from public.previews where user_id = me and share_id is not null)
      or share_id in (select share_id from public.guest_shares where user_id = me);
  update public.guest_shares set hidden = true, fresh = null, y50 = null, fresh_b = null, y50_b = null where user_id = me;
  update public.previews set hidden = true, share_id = null, share_paths = null, notes = null, paths = '{}'::jsonb,
    placement = null, size = null, score = null, analysis = null, report = null, collection = null,
    deleted_at = coalesce(deleted_at, now()) where user_id = me;
  update public.generations set placement = null where user_id = me;
  update public.polls set hidden = true where user_id = me;
  delete from public.jobs where owner = me::text;
  update public.ai_reports set thumb = null, note = null where user_id = me;
  update public.push_devices set active = false, endpoint = 'erased-' || id::text, sub = '{}'::jsonb, ua = null where user_id = me;
  update public.push_reminders set cancelled = true, title = '', body = '', url = null where user_id = me and sent_at is null;
  update public.feedback set email = null where user_id = me;
  update public.events set user_id = null, props = '{}'::jsonb where user_id = me;
  update public.profiles set onboarding = null, lang = null, display_name = null where id = me;
  delete from public.apple_tokens where user_id = me;
  delete from public.author_blocks where blocker = me::text;
  update auth.identities set provider_id = 'erased-' || id::text, identity_data = '{}'::jsonb where user_id = me;
  update auth.users set email = 'erased+' || me::text || '@inkage.invalid', raw_user_meta_data = '{}'::jsonb,
    banned_until = '2999-12-31 00:00:00+00'::timestamptz where id = me;
end $function$;

-- 6. Explore "Trending this week": no own, test or store-reviewer accounts, a week's previews (not all time),
--    and a spot only when at least 3 different people chose it; previews_total (home page) counts real people only
create or replace function public.trends()
 returns json language sql security definer set search_path to 'public'
as $function$
  with real_gen as (
    select g.* from public.generations g
    left join auth.users u on u.id = g.user_id
    left join public.profiles pr on pr.id = g.user_id
    where g.kind = 'preview'
      and not coalesce(pr.reviewer, false)
      and (u.email is null or lower(u.email) not in (select email from public.admin_own_accounts))
  )
  select json_build_object(
    'places', (select coalesce(json_agg(p), '[]'::json) from (
        select placement, count(*) n from real_gen
        where created_at > now() - interval '7 days' and placement is not null and placement not like '@%'
        group by placement having count(distinct user_id) >= 3 order by n desc limit 6) p),
    'designs', (select coalesce(json_agg(d), '[]'::json) from (
        select props->>'id' as id, count(*) n from public.events
        where name in ('design_added', 'explore_design') and props->>'id' is not null and created_at > now() - interval '7 days'
        group by 1 having count(distinct coalesce(user_id::text, anon_id)) >= 3 order by n desc limit 8) d),
    'previews_week', (select count(*) from real_gen where created_at > now() - interval '7 days'),
    'previews_total', (select count(*) from real_gen)
  );
$function$;

-- 7. A welcome e-mail that failed to send is tried again on the next app open (welcomed_at was set before sending)
create or replace function public.welcome_undo(p_secret text, p_user uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.profiles set welcomed_at = null where id = p_user;
end $function$;
revoke all on function public.welcome_undo(text, uuid) from public;
grant execute on function public.welcome_undo(text, uuid) to anon, authenticated;

-- 8. A new push token from the same account and the same device replaces the old one instead of adding a row
create or replace function public.push_save(p_sub jsonb, p_ua text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null or coalesce(p_sub->>'endpoint','') = '' then raise exception 'forbidden'; end if;
  insert into public.push_devices(user_id, endpoint, sub, ua) values (auth.uid(), p_sub->>'endpoint', p_sub, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = excluded.user_id, sub = excluded.sub, ua = excluded.ua, last_seen = now(), active = true;
  if p_ua is not null then
    update public.push_devices set active = false
     where user_id = auth.uid() and ua = left(p_ua, 200) and endpoint <> p_sub->>'endpoint' and active;
  end if;
end $function$;

-- 9. The daily AI model check (/api/health) is no longer public: the database's own cron calls it with its token
select cron.schedule('inkage-model-check', '0 6 * * *', $$select public.admin_cron_call('/api/health')$$);
