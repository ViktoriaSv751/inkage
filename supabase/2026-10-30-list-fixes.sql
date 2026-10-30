-- InkAge-kimaradt-2026-10-30.pdf, the database part (applied 2026-10-30).

-- 1.4 Accounts that look like the stores' automatic testers (Google sign-up on 10-24 / 10-25, then not one event, generation
-- or preview) leave the numbers. Reversible: delete the row and the account counts again.
create table if not exists public.admin_bot_accounts (user_id uuid primary key references auth.users(id) on delete cascade, note text, created_at timestamptz not null default now());
alter table public.admin_bot_accounts enable row level security;
insert into public.admin_bot_accounts (user_id, note)
select u.id, 'automatic store tester (assumed): no activity at all after the sign-up'
from auth.users u
where u.created_at between '2026-10-24' and '2026-10-26' and u.raw_app_meta_data->>'provider' = 'google'
  and not exists (select 1 from public.events e where e.user_id = u.id)
  and not exists (select 1 from public.generations g where g.user_id = u.id)
  and not exists (select 1 from public.previews p where p.user_id = u.id)
on conflict do nothing;

create or replace view public.admin_real_users as
 select id, email, created_at, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data
   from auth.users u
  where not admin_own_uid(id)
    and not exists (select 1 from profiles p where p.id = u.id and coalesce(p.reviewer, false))
    and not exists (select 1 from admin_bot_accounts b where b.user_id = u.id)
    and email::text !~~ 'erased+%@inkage.invalid'::text;

-- 4.A6 no plan in the allowance answer: there is one allowance for everyone
do $fix$
declare d text;
begin
  d := pg_get_functiondef('public.my_quota'::regproc);
  d := replace(d, $$json_build_object('plan', 'free', 'used'$$, $$json_build_object('used'$$);
  if d ~ '''plan''' then raise exception 'my_quota: not replaced'; end if;
  execute d;
end $fix$;

-- 5.14 old events without a language: the visit's own language if another event of it has one, else the account's
update public.events e set lang = x.lang
from (select session, max(lang) lang from public.events where session is not null and lang is not null group by session having count(distinct lang) = 1) x
where e.lang is null and e.session = x.session;
update public.events e set lang = left(p.lang, 5)
from public.profiles p
where e.lang is null and e.user_id = p.id and p.lang is not null;

-- 5.6 an announcement for one language reaches exactly that language (left(…, 2) mixed up Filipino with Finnish)
create or replace function public.public_announcements(p_lang text default null, p_pf text default 'web')
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'kind', a.kind, 'link', a.link) order by a.created_at desc), '[]')
  from public.admin_announcements a
  where a.on_ and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
    and (a.lang is null or a.lang = '' or a.lang = coalesce(p_lang, ''))
    and (a.platform = 'all' or a.platform = coalesce(p_pf, 'web') or (a.platform = 'app' and coalesce(p_pf, 'web') in ('android', 'ios')))
$function$;
