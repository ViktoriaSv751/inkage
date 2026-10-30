-- Allowance, anniversary and monthly guide e-mails.
alter table public.profiles add column if not exists limit_mailed_month text;
alter table public.profiles add column if not exists restart_mailed_month text;
alter table public.previews add column if not exists anniversary_mailed_at timestamptz;
alter table public.newsletter add column if not exists guide_sent_month text;

-- true the first time this month: the person just reached their allowance
create or replace function public.limit_mail_once() returns boolean
 language plpgsql security definer set search_path to 'public'
as $function$
declare m text := to_char(now() at time zone 'Europe/Budapest', 'YYYY-MM'); n int;
begin
  if auth.uid() is null then return false; end if;
  update public.profiles set limit_mailed_month = m where id = auth.uid() and coalesce(limit_mailed_month, '') <> m;
  get diagnostics n = row_count;
  return n > 0;
end $function$;
revoke all on function public.limit_mail_once() from public, anon;
grant execute on function public.limit_mail_once() to authenticated;

create or replace function public.mail_due(p_secret text) returns json
 language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
declare cur text := to_char(now() at time zone 'Europe/Budapest', 'YYYY-MM');
        prev text := to_char((now() at time zone 'Europe/Budapest') - interval '1 month', 'YYYY-MM');
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return json_build_object(
    'ready', (select coalesce(json_agg(x), '[]'::json) from (
      select j.id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.jobs j join auth.users u on u.id::text = j.owner left join public.profiles pr on pr.id = u.id
      where j.data ? 'fresh' and j.data ? 'meta' and not j.data ? 'mailed'
        and j.created_at between now() - interval '6 hours' and now() - interval '12 minutes'
        and u.email !~~ 'erased+%@inkage.invalid'
        and not exists (select 1 from public.previews p where p.user_id = u.id and p.created_at >= j.created_at - interval '1 minute')
      order by j.created_at limit 50) x),
    'photo', (select coalesce(json_agg(y), '[]'::json) from (
      select u.id::text id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.admin_real_users u left join public.profiles pr on pr.id = u.id
      where u.created_at between now() - interval '72 hours' and now() - interval '24 hours'
        and not coalesce(pr.mail_off, false) and pr.photo_reminded_at is null
        and not exists (select 1 from public.uploads up where up.user_id = u.id and up.kind = 'photo')
        and not exists (select 1 from public.generations g where g.user_id = u.id and g.kind = 'preview')
      order by u.created_at limit 50) y),
    -- reached the allowance last month: it's back
    'restart', (select coalesce(json_agg(z), '[]'::json) from (
      select u.id::text id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.profiles pr join auth.users u on u.id = pr.id
      where pr.limit_mailed_month = prev and coalesce(pr.restart_mailed_month, '') <> cur and not pr.mail_off
        and u.email !~~ 'erased+%@inkage.invalid'
      limit 50) z),
    -- a year after a preview was marked as done
    'anniv', (select coalesce(json_agg(w), '[]'::json) from (
      select p.id::text id, u.id::text "user", u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.previews p join auth.users u on u.id = p.user_id left join public.profiles pr on pr.id = u.id
      where not p.hidden and p.deleted_at is null and p.anniversary_mailed_at is null and not coalesce(pr.mail_off, false)
        and p.done_at between now() - interval '1 year 3 days' and now() - interval '1 year'
        and u.email !~~ 'erased+%@inkage.invalid'
      limit 50) w));
end $function$;

create or replace function public.newsletter_due(p_secret text) returns json
 language plpgsql stable security definer set search_path to 'public'
as $function$
declare cur text := to_char(now() at time zone 'Europe/Budapest', 'YYYY-MM');
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select email, lang, token from public.newsletter
    where confirmed_at is not null and unsubscribed_at is null and coalesce(guide_sent_month, '') <> cur limit 200) x);
end $function$;

create or replace function public.mail_mark(p_secret text, p_kind text, p_id text) returns void
 language plpgsql security definer set search_path to 'public'
as $function$
declare cur text := to_char(now() at time zone 'Europe/Budapest', 'YYYY-MM');
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if p_kind = 'ready' then update public.jobs set data = data || '{"mailed": true}'::jsonb where id = p_id;
  elsif p_kind = 'photo' then insert into public.profiles(id, photo_reminded_at) values (p_id::uuid, now()) on conflict (id) do update set photo_reminded_at = now();
  elsif p_kind = 'restart' then update public.profiles set restart_mailed_month = cur where id = p_id::uuid;
  elsif p_kind = 'anniv' then update public.previews set anniversary_mailed_at = now() where id = p_id::uuid;
  elsif p_kind = 'guide' then update public.newsletter set guide_sent_month = cur where email = p_id;
  end if;
end $function$;
revoke all on function public.newsletter_due(text) from public;
grant execute on function public.newsletter_due(text) to anon, authenticated;
