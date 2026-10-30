-- Timed e-mails: "your preview is ready" (the app was left before it finished) and one "a photo is missing" reminder.
alter table public.profiles add column if not exists mail_off boolean not null default false;
alter table public.profiles add column if not exists photo_reminded_at timestamptz;

create or replace function public.mail_due(p_secret text) returns json
 language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  return json_build_object(
    -- finished, but no preview was saved since it started: nobody was there to receive it
    'ready', (select coalesce(json_agg(x), '[]'::json) from (
      select j.id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.jobs j join auth.users u on u.id::text = j.owner left join public.profiles pr on pr.id = u.id
      where j.data ? 'fresh' and j.data ? 'meta' and not j.data ? 'mailed'
        and j.created_at between now() - interval '6 hours' and now() - interval '12 minutes'
        and u.email !~~ 'erased+%@inkage.invalid'
        and not exists (select 1 from public.previews p where p.user_id = u.id and p.created_at >= j.created_at - interval '1 minute')
      order by j.created_at limit 50) x),
    -- a day after signing up, no photo and no preview yet; once only
    'photo', (select coalesce(json_agg(y), '[]'::json) from (
      select u.id::text id, u.email, coalesce(pr.lang, u.raw_user_meta_data->>'lang') lang
      from public.admin_real_users u left join public.profiles pr on pr.id = u.id
      where u.created_at between now() - interval '72 hours' and now() - interval '24 hours'
        and not coalesce(pr.mail_off, false) and pr.photo_reminded_at is null
        and not exists (select 1 from public.uploads up where up.user_id = u.id and up.kind = 'photo')
        and not exists (select 1 from public.generations g where g.user_id = u.id and g.kind = 'preview')
      order by u.created_at limit 50) y));
end $function$;

create or replace function public.mail_mark(p_secret text, p_kind text, p_id text) returns void
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if p_kind = 'ready' then update public.jobs set data = data || '{"mailed": true}'::jsonb where id = p_id;
  elsif p_kind = 'photo' then insert into public.profiles(id, photo_reminded_at) values (p_id::uuid, now()) on conflict (id) do update set photo_reminded_at = now();
  end if;
end $function$;

create or replace function public.mail_opt_out(p_secret text, p_user uuid) returns void
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  insert into public.profiles(id, mail_off) values (p_user, true) on conflict (id) do update set mail_off = true;
end $function$;

revoke all on function public.mail_due(text), public.mail_mark(text, text, text), public.mail_opt_out(text, uuid) from public;
grant execute on function public.mail_due(text), public.mail_mark(text, text, text), public.mail_opt_out(text, uuid) to anon, authenticated;
select cron.schedule('inkage-mail', '*/10 * * * *', $$select public.admin_cron_call('/api/mail-cron')$$);
