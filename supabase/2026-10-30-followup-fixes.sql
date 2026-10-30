-- Fault list 2026-10-29, the rest of the code-only items (applied 2026-10-30).

-- 1.5 where a person came from and their language stay on the account, not only in a guess from the visit
alter table public.profiles add column if not exists signup_source jsonb;

create or replace function public.save_signup(p_src jsonb, p_lang text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  insert into public.profiles(id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set
    signup_source = coalesce(signup_source, nullif(p_src, '{}'::jsonb)),
    lang = coalesce(left(p_lang, 5), lang)
  where id = auth.uid();
end $function$;
revoke all on function public.save_signup(jsonb, text) from public, anon;
grant execute on function public.save_signup(jsonb, text) to authenticated;

do $fix$
declare d text;
begin
  d := pg_get_functiondef('public.admin_user_facts'::regproc);
  d := replace(d, $$left(coalesce(nullif(u.raw_user_meta_data->>'lang', ''), m.slang, ''), 2) lang$$,
                  $$left(coalesce(nullif(u.raw_user_meta_data->>'lang', ''), (select pr.lang from public.profiles pr where pr.id = u.id), m.slang, ''), 2) lang$$);
  d := replace(d, E'      m.ch,\n', E'      coalesce((select public.admin_channel(pr.signup_source, null) from public.profiles pr where pr.id = u.id and pr.signup_source is not null), m.ch) ch,\n');
  if d !~ 'signup_source' or d !~ 'pr.lang' then raise exception 'admin_user_facts: nothing replaced'; end if;
  execute d;
end $fix$;

-- 4.S3 the function was killed before it could refund: the job has the generation's id but neither a result nor an error
create or replace function public.jobs_refund_stale() returns integer
 language plpgsql security definer set search_path to 'public'
as $function$
declare n int;
begin
  with stale as (
    select j.id, (j.data->>'gid')::bigint gid, j.owner from public.jobs j
    where j.data ? 'gid' and not j.data ? 'fresh' and not j.data ? 'error'
      and j.created_at < now() - interval '10 minutes' and j.created_at > now() - interval '2 days'
  ), gone as (
    delete from public.generations g using stale s
    where g.id = s.gid and g.user_id::text = s.owner and g.kind = 'preview' and g.aged = 0
    returning g.id
  ), marked as (
    update public.jobs j set data = j.data || jsonb_build_object('error', 'The server took too long. Please try again.', 'refunded', (select count(*) from gone))
    from stale s where j.id = s.id returning 1
  )
  select count(*) into n from marked;
  return n;
end $function$;
revoke all on function public.jobs_refund_stale() from public, anon, authenticated;
select cron.schedule('inkage-jobs-refund', '*/5 * * * *', 'select public.jobs_refund_stale()');

-- 4.M7 one reminder the day after a preview, for people who turned notifications on; at most one a month
create or replace function public.push_comeback(p_title text, p_body text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.push_devices where user_id = auth.uid() and active) then return; end if;
  if exists (select 1 from public.push_reminders where user_id = auth.uid() and kind = 'comeback' and created_at > now() - interval '30 days') then return; end if;
  insert into public.push_reminders(user_id, kind, send_at, title, body, url)
  values (auth.uid(), 'comeback', now() + interval '1 day', left(p_title, 120), left(p_body, 400), '/app/gallery');
end $function$;
revoke all on function public.push_comeback(text, text) from public, anon;
grant execute on function public.push_comeback(text, text) to authenticated;

-- 4.A6 no payment leftovers in the allowance answer
do $fix$
declare d text;
begin
  d := pg_get_functiondef('public.my_quota'::regproc);
  d := replace(d, $$, 'stripe_customer_id', null)$$, ')');
  if d ~ 'stripe_customer_id' then raise exception 'my_quota: not replaced'; end if;
  execute d;
end $fix$;

-- 4.M1 app_open / gallery_open fired 2-3 times a visit until 2026-10-30: the repeats within 3 s leave the numbers
do $fix$
declare d text;
begin
  d := pg_get_viewdef('public.events_real'::regclass, true);
  d := regexp_replace(d, 'WHERE NOT \(COALESCE\(\(e\.props -> ''src''::text\) ->> ''us''::text',
    $$WHERE NOT (e.name = ANY (ARRAY['app_open'::text, 'gallery_open'::text]) AND EXISTS ( SELECT 1 FROM events p
                  WHERE p.name = e.name AND COALESCE(p.user_id::text, p.anon_id) = COALESCE(e.user_id::text, e.anon_id)
                    AND p.created_at < e.created_at AND p.created_at >= (e.created_at - '00:00:03'::interval)))
            AND NOT (COALESCE((e.props -> 'src'::text) ->> 'us'::text$$);
  if d !~ 'app_open' then raise exception 'events_real: not replaced'; end if;
  execute 'create or replace view public.events_real as ' || d;
end $fix$;

-- 5.14 events from 10-19…10-23 without a visit id: one visit per person per day, so they count in the visit numbers
update public.events set session = 'old-' || left(md5(coalesce(user_id::text, anon_id, 'x') || (created_at at time zone 'Europe/Budapest')::date::text), 20)
where (session is null or session = '') and created_at < '2026-10-24' and coalesce(user_id::text, anon_id) is not null;
