-- ================================================================
-- InkAge database schema (exported from the live Supabase project, 2026-10-14)
-- Run in the Supabase SQL editor on a fresh project. It also needs:
--   create schema if not exists private;
--   create table if not exists private.config (key text primary key, value text);
--   insert into private.config values ('webhook_secret', '<APP_SECRET-derived value>'), ('admin_emails', 'you@example.com');
-- ================================================================
create extension if not exists pgcrypto;
create schema if not exists private;
create table if not exists private.config (key text primary key, value text);
create sequence if not exists public.community_posts_id_seq;
create sequence if not exists public.feedback_id_seq;
create sequence if not exists public.health_log_id_seq;

-- tables
create table if not exists public.community_posts (
  id bigint not null default nextval('community_posts_id_seq'::regclass),
  share_id text not null,
  caption text,
  status text not null default 'pending'::text,
  voter text,
  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone
);
alter table public.community_posts enable row level security;

create table if not exists public.events (
  id bigint generated always as identity,
  created_at timestamp with time zone not null default now(),
  name text not null,
  anon_id text,
  user_id uuid,
  props jsonb
);
alter table public.events enable row level security;

create table if not exists public.feedback (
  id bigint not null default nextval('feedback_id_seq'::regclass),
  kind text not null,
  message text not null,
  email text,
  anon_id text,
  user_id uuid,
  page text,
  created_at timestamp with time zone not null default now()
);
alter table public.feedback enable row level security;

create table if not exists public.generations (
  id bigint generated always as identity,
  user_id uuid,
  placement text,
  aged integer not null default 0,
  created_at timestamp with time zone not null default now(),
  guest_id text,
  ip_hash text,
  kind text not null default 'preview'::text
);
alter table public.generations enable row level security;

create table if not exists public.guest_shares (
  share_id text not null,
  guest_id text not null,
  placement text,
  score integer,
  fresh text,
  y50 text,
  hidden boolean not null default false,
  created_at timestamp with time zone not null default now(),
  fresh_b text,
  y50_b text,
  label_a text,
  label_b text,
  user_id uuid,
  notified_at timestamp with time zone
);
alter table public.guest_shares enable row level security;

create table if not exists public.health_log (
  id bigint not null default nextval('health_log_id_seq'::regclass),
  ok boolean not null,
  detail jsonb,
  created_at timestamp with time zone not null default now()
);
alter table public.health_log enable row level security;

create table if not exists public.jobs (
  id text not null,
  owner text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table public.jobs enable row level security;

create table if not exists public.newsletter (
  email text not null,
  lang text,
  token text not null default replace((gen_random_uuid())::text, '-'::text, ''::text),
  created_at timestamp with time zone not null default now(),
  confirmed_at timestamp with time zone,
  unsubscribed_at timestamp with time zone
);
alter table public.newsletter enable row level security;

create table if not exists public.previews (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  placement text,
  size text,
  score integer,
  analysis jsonb,
  report jsonb,
  notes text,
  favorite boolean not null default false,
  collection text,
  hidden boolean not null default false,
  paths jsonb not null default '{}'::jsonb,
  share_id text,
  share_paths jsonb,
  done_at timestamp with time zone,
  notified_at timestamp with time zone
);
alter table public.previews enable row level security;

create table if not exists public.profiles (
  id uuid not null,
  plan text not null default 'free'::text,
  plan_until timestamp with time zone,
  stripe_customer_id text,
  created_at timestamp with time zone not null default now(),
  onboarding jsonb,
  bonus integer not null default 0,
  referred_by uuid,
  lang text,
  welcomed_at timestamp with time zone,
  notify_votes boolean not null default true
);
alter table public.profiles enable row level security;

create table if not exists public.votes (
  id bigint generated always as identity,
  share_id text not null,
  choice text not null,
  voter text not null,
  created_at timestamp with time zone not null default now()
);
alter table public.votes enable row level security;

create table if not exists public.waitlist (
  email text not null,
  lang text,
  created_at timestamp with time zone not null default now(),
  notified_at timestamp with time zone
);
alter table public.waitlist enable row level security;

-- constraints
alter table community_posts add constraint community_posts_pkey PRIMARY KEY (id);
alter table community_posts add constraint community_posts_share_id_key UNIQUE (share_id);
alter table community_posts add constraint community_posts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text])));
alter table events add constraint events_pkey PRIMARY KEY (id);
alter table feedback add constraint feedback_pkey PRIMARY KEY (id);
alter table generations add constraint generations_pkey PRIMARY KEY (id);
alter table generations add constraint generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table guest_shares add constraint guest_shares_pkey PRIMARY KEY (share_id);
alter table guest_shares add constraint guest_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table health_log add constraint health_log_pkey PRIMARY KEY (id);
alter table jobs add constraint jobs_pkey PRIMARY KEY (id);
alter table newsletter add constraint newsletter_pkey PRIMARY KEY (email);
alter table previews add constraint previews_pkey PRIMARY KEY (id);
alter table previews add constraint previews_share_id_key UNIQUE (share_id);
alter table previews add constraint previews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table profiles add constraint profiles_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'weekly'::text, 'lifetime'::text])));
alter table votes add constraint votes_choice_check CHECK ((choice = ANY (ARRAY['yes'::text, 'no'::text, 'change'::text])));
alter table votes add constraint votes_pkey PRIMARY KEY (id);
alter table votes add constraint votes_share_id_voter_key UNIQUE (share_id, voter);
alter table waitlist add constraint waitlist_pkey PRIMARY KEY (email);

-- indexes
CREATE INDEX generations_user_created ON public.generations USING btree (user_id, created_at DESC);
CREATE INDEX generations_guest ON public.generations USING btree (guest_id);
CREATE INDEX generations_ip_created ON public.generations USING btree (ip_hash, created_at DESC);
CREATE INDEX generations_created ON public.generations USING btree (created_at DESC);
CREATE INDEX generations_kind_created ON public.generations USING btree (kind, created_at);
CREATE UNIQUE INDEX votes_share_id_voter_key ON public.votes USING btree (share_id, voter);
CREATE INDEX events_created ON public.events USING btree (created_at DESC);
CREATE INDEX events_name_created ON public.events USING btree (name, created_at DESC);
CREATE UNIQUE INDEX previews_share_id_key ON public.previews USING btree (share_id);
CREATE INDEX previews_user_created ON public.previews USING btree (user_id, created_at DESC);
CREATE INDEX jobs_created ON public.jobs USING btree (created_at);
CREATE INDEX guest_shares_guest ON public.guest_shares USING btree (guest_id, created_at);
CREATE INDEX guest_shares_user_idx ON public.guest_shares USING btree (user_id);
CREATE INDEX guest_shares_guest_idx ON public.guest_shares USING btree (guest_id);
CREATE UNIQUE INDEX community_posts_share_id_key ON public.community_posts USING btree (share_id);

-- storage buckets
insert into storage.buckets(id, name, public) values ('previews', 'previews', f) on conflict do nothing;
insert into storage.buckets(id, name, public) values ('shares', 'shares', t) on conflict do nothing;

-- row level security policies
create policy shares_own_remove on storage.objects for DELETE to authenticated using (((bucket_id = 'shares'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "shares own read" on storage.objects for SELECT to authenticated using (((bucket_id = 'shares'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "shares own update" on storage.objects for UPDATE to authenticated using (((bucket_id = 'shares'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "previews own update" on storage.objects for UPDATE to authenticated using (((bucket_id = 'previews'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "previews own remove" on storage.objects for DELETE to authenticated using (((bucket_id = 'previews'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "shares own write" on storage.objects for INSERT to authenticated with check (((bucket_id = 'shares'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "previews own write" on storage.objects for INSERT to authenticated with check (((bucket_id = 'previews'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "previews own read" on storage.objects for SELECT to authenticated using (((bucket_id = 'previews'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "own generations" on public.generations for SELECT to authenticated using ((user_id = auth.uid()));
create policy "own profile" on public.profiles for SELECT to authenticated using ((id = auth.uid()));
create policy "previews update own" on public.previews for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "previews insert own" on public.previews for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "previews select own" on public.previews for SELECT to authenticated using ((user_id = auth.uid()));

-- functions
CREATE OR REPLACE FUNCTION public.admin_extra()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return json_build_object(
    'errors', (select coalesce(json_agg(e order by e.created_at desc), '[]'::json) from (
        select name, props, created_at from public.events
        where name in ('client_error', 'server_error', 'generate_error') and created_at > now() - interval '7 days'
        order by created_at desc limit 40) e),
    'errors_today', (select count(*) from public.events where name in ('client_error', 'server_error', 'generate_error') and created_at > now() - interval '24 hours'),
    'helpers_today', (select count(*) from public.generations where kind = 'helper' and created_at > now() - interval '24 hours'),
    'previews_today', (select count(*) from public.generations where kind = 'preview' and created_at > now() - interval '24 hours'),
    'waitlist', (select count(*) from public.waitlist),
    'recovered_today', (select count(*) from public.events where name = 'job_recovered' and created_at > now() - interval '24 hours'),
    'redo', (select coalesce(json_object_agg(k, n), '{}'::json) from (
        select x as k, count(*) as n from public.events, unnest(string_to_array(props->>'why', ',')) x
        where name = 'redo' and created_at > now() - interval '30 days' group by x) r)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_feedback()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return (select coalesce(json_agg(f order by f.created_at desc), '[]'::json) from (
    select kind, message, email, page, created_at from public.feedback order by created_at desc limit 60) f);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_health()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return (select coalesce(json_agg(h order by h.created_at desc), '[]'::json)
          from (select ok, detail, created_at from public.health_log order by created_at desc limit 20) h);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_posts()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select c.id, c.share_id, c.caption, c.status, c.created_at, public.get_share(c.share_id) as share
    from public.community_posts c where c.status = 'pending' order by c.created_at desc limit 50) x);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'gen_today', (select count(*) from public.generations where created_at > now() - interval '24 hours'),
    'gen_7d', (select count(*) from public.generations where created_at > now() - interval '7 days'),
    'guest_today', (select count(*) from public.generations where user_id is null and created_at > now() - interval '24 hours'),
    'aging_today', (select coalesce(sum(aged),0) from public.generations where created_at > now() - interval '24 hours'),
    'saved', (select count(*) from public.previews),
    'shares', (select count(*) from public.previews where share_id is not null),
    'votes', (select count(*) from public.votes),
    'paid', (select count(*) from public.profiles where plan <> 'free'),
    'events_today', (select coalesce(json_object_agg(name, c), '{}'::json) from (select name, count(*) c from public.events where created_at > now() - interval '24 hours' group by name) e),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (select date_trunc('day', created_at)::date as day, count(*) as previews, coalesce(sum(aged),0) as aging from public.generations where created_at > now() - interval '14 days' group by 1) d)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.apply_referral(p_ref uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); created timestamptz;
begin
  if me is null or p_ref is null or p_ref = me then return false; end if;
  if not exists (select 1 from public.profiles where id = p_ref) then return false; end if;
  select created_at into created from auth.users where id = me;
  if created < now() - interval '2 days' then return false; end if;
  insert into public.profiles(id) values (me) on conflict (id) do nothing;
  update public.profiles set referred_by = p_ref, bonus = bonus + 1 where id = me and referred_by is null;
  if not found then return false; end if;
  update public.profiles set bonus = bonus + 1 where id = p_ref;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.bump_age(p_gid bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  update public.generations set aged = aged + 1
  where id = p_gid and user_id = auth.uid() and aged < 14
  returning aged into n;
  return n is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.cast_vote(p_share text, p_choice text, p_voter text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.previews where share_id = p_share and not hidden)
     and not exists (select 1 from public.guest_shares where share_id = p_share and not hidden) then
    raise exception 'not_found';
  end if;
  insert into public.votes(share_id, choice, voter) values (p_share, p_choice, left(p_voter, 64))
    on conflict (share_id, voter) do update set choice = excluded.choice;
  return public.get_share(p_share);
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_device_shares(p_secret text, p_guest text, p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.guest_shares set user_id = p_user where guest_id = p_guest and user_id is null;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_guest_share(p_secret text, p_share text, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.guest_shares set user_id = p_user where share_id = p_share and user_id is null;
end $function$
;

CREATE OR REPLACE FUNCTION public.community_feed()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select c.share_id, c.caption, c.created_at, public.get_share(c.share_id) as share
    from public.community_posts c where c.status = 'approved'
    order by c.created_at desc limit 30) x
  where x.share is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_preview(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select share_id into sid from public.previews where id = p_id and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if sid is not null then
    update public.community_posts set status = 'withdrawn', reviewed_at = now() where share_id = sid;
  end if;
  update public.previews set hidden = true, share_id = null, share_paths = null, notes = null, paths = '{}'::jsonb
  where id = p_id and user_id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.erase_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.community_posts set status = 'withdrawn', reviewed_at = now()
   where share_id in (select share_id from public.previews where user_id = me and share_id is not null)
      or share_id in (select share_id from public.guest_shares where user_id = me);
  update public.guest_shares set hidden = true, fresh = null, y50 = null, fresh_b = null, y50_b = null where user_id = me;
  update public.previews set hidden = true, share_id = null, share_paths = null, notes = null, paths = '{}'::jsonb where user_id = me;
  update public.profiles set onboarding = null, lang = null where id = me;
  update auth.users set email = 'erased+' || me::text || '@inkage.invalid', raw_user_meta_data = '{}'::jsonb,
    banned_until = 'infinity'::timestamptz where id = me;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_guest_img(p_share text, p_k text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case p_k when 'fresh' then fresh when 'y50' then y50 when 'freshb' then fresh_b when 'y50b' then y50_b end
  from public.guest_shares where share_id = p_share and not hidden;
$function$
;

CREATE OR REPLACE FUNCTION public.get_share(p_share text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with votes as (
    select json_build_object(
      'yes', (select count(*) from public.votes v where v.share_id = p_share and v.choice = 'yes'),
      'no', (select count(*) from public.votes v where v.share_id = p_share and v.choice = 'no'),
      'change', (select count(*) from public.votes v where v.share_id = p_share and v.choice = 'change')) as v
  )
  select coalesce(
    (select json_build_object('paths', p.share_paths, 'placement', p.placement, 'score', p.score, 'created_at', p.created_at, 'votes', (select v from votes))
       from public.previews p where p.share_id = p_share and not p.hidden),
    (select json_build_object(
        'paths', json_strip_nulls(json_build_object(
          'fresh', '/api/share-img/' || g.share_id || '/fresh',
          'y50', '/api/share-img/' || g.share_id || '/y50',
          'freshB', case when g.y50_b is not null then '/api/share-img/' || g.share_id || '/freshb' end,
          'y50B', case when g.y50_b is not null then '/api/share-img/' || g.share_id || '/y50b' end)),
        'labels', json_build_object('a', g.label_a, 'b', g.label_b),
        'placement', g.placement, 'score', g.score, 'created_at', g.created_at, 'votes', (select v from votes))
       from public.guest_shares g where g.share_id = p_share and not g.hidden)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.guest_bump_age(p_secret text, p_gid bigint, p_guest text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  update public.generations set aged = aged + 1
  where id = p_gid and guest_id = p_guest and aged < 14
  returning aged into n;
  return n is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_helper_start(p_secret text, p_guest text, p_ip text, p_label text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare per_guest int; per_ip int; global_day int; gid bigint;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtext('ghelper:' || coalesce(p_ip, '')));
  select count(*) into per_guest from public.generations where guest_id = p_guest and kind = 'helper' and created_at > now() - interval '24 hours';
  select count(*) into per_ip from public.generations where ip_hash = p_ip and user_id is null and kind = 'helper' and created_at > now() - interval '24 hours';
  select count(*) into global_day from public.generations where kind = 'helper' and created_at > now() - interval '24 hours';
  if per_guest >= 40 or per_ip >= 80 then return json_build_object('ok', false, 'reason', 'used'); end if;
  if global_day >= 600 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  insert into public.generations(guest_id, ip_hash, placement, kind) values (p_guest, p_ip, left(p_label, 80), 'helper') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_refund(p_secret text, p_gid bigint, p_guest text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  update public.generations set guest_id = guest_id || ':refunded', ip_hash = null, created_at = now() - interval '2 days'
  where id = p_gid and guest_id = p_guest and aged = 0;
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_share(p_secret text, p_guest text, p_placement text, p_score integer, p_fresh text, p_y50 text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid text;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  if length(coalesce(p_fresh,'')) > 700000 or length(coalesce(p_y50,'')) > 700000 then raise exception 'too_large'; end if;
  if (select count(*) from public.guest_shares where guest_id = p_guest and created_at > now() - interval '1 day') >= 20 then
    raise exception 'limit';
  end if;
  sid := 'g' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.guest_shares(share_id, guest_id, placement, score, fresh, y50)
  values (sid, p_guest, left(p_placement, 200), p_score, p_fresh, p_y50);
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_share_ab(p_secret text, p_guest text, p_placement text, p_score integer, p_fresh text, p_y50 text, p_fresh_b text, p_y50_b text, p_label_a text, p_label_b text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid text;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  if greatest(length(coalesce(p_fresh,'')), length(coalesce(p_y50,'')), length(coalesce(p_fresh_b,'')), length(coalesce(p_y50_b,''))) > 700000 then raise exception 'too_large'; end if;
  if (select count(*) from public.guest_shares where guest_id = p_guest and created_at > now() - interval '1 day') >= 20 then
    raise exception 'limit';
  end if;
  sid := 'g' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.guest_shares(share_id, guest_id, placement, score, fresh, y50, fresh_b, y50_b, label_a, label_b)
  values (sid, p_guest, left(p_placement, 200), p_score, p_fresh, p_y50, p_fresh_b, p_y50_b, left(p_label_a, 60), left(p_label_b, 60));
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_start(p_secret text, p_guest text, p_ip text, p_placement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare per_guest int; per_ip int; global_day int; gid bigint;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtext('guest:' || coalesce(p_ip, '')));
  select count(*) into per_guest from public.generations where guest_id = p_guest and kind = 'preview' and created_at > now() - interval '24 hours';
  select count(*) into per_ip from public.generations where ip_hash = p_ip and user_id is null and kind = 'preview' and created_at > now() - interval '24 hours';
  select count(*) into global_day from public.generations where kind = 'preview' and created_at > now() - interval '24 hours';
  if per_guest >= 30 or per_ip >= 60 then
    return json_build_object('ok', false, 'reason', 'used');
  end if;
  if global_day >= 300 then
    return json_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.generations(guest_id, ip_hash, placement, kind) values (p_guest, p_ip, left(p_placement, 80), 'preview') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_start_v2_unused(p_secret text, p_guest uuid, p_ip text, p_placement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare per_guest int; per_ip int; global_day int; gid bigint;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtext('guest:' || coalesce(p_ip, '')));
  select count(*) into per_guest from public.generations where guest_id = p_guest and created_at > now() - interval '24 hours';
  select count(*) into per_ip from public.generations where ip_hash = p_ip and user_id is null and created_at > now() - interval '24 hours';
  select count(*) into global_day from public.generations where created_at > now() - interval '24 hours';
  -- test phase: free and generous, with a daily safety cap on total AI spend
  if per_guest >= 30 or per_ip >= 60 then
    return json_build_object('ok', false, 'reason', 'used');
  end if;
  if global_day >= 300 then
    return json_build_object('ok', false, 'reason', 'busy');
  end if;
  insert into public.generations(guest_id, ip_hash, placement) values (p_guest, p_ip, left(p_placement, 80)) returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$
;

CREATE OR REPLACE FUNCTION public.health_add(p_secret text, p_ok boolean, p_detail jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  insert into public.health_log(ok, detail) values (p_ok, p_detail);
end $function$
;

CREATE OR REPLACE FUNCTION public.health_recent(p_secret text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  return (select coalesce(json_agg(h order by h.created_at desc), '[]'::json) from (select ok, detail, created_at from public.health_log order by created_at desc limit 20) h);
end $function$
;

CREATE OR REPLACE FUNCTION public.helper_start(p_label text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare used int; global_day int; gid bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext('helper:' || auth.uid()::text));
  select count(*) into used from public.generations where user_id = auth.uid() and kind = 'helper' and created_at > now() - interval '24 hours';
  select count(*) into global_day from public.generations where kind = 'helper' and created_at > now() - interval '24 hours';
  if used >= 60 then return json_build_object('ok', false, 'reason', 'used'); end if;
  if global_day >= 600 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  insert into public.generations(user_id, placement, kind) values (auth.uid(), left(p_label, 80), 'helper') returning id into gid;
  return json_build_object('ok', true, 'gid', gid);
end $function$
;

CREATE OR REPLACE FUNCTION public.job_get(p_secret text, p_id text, p_owner text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  return (select data from public.jobs where id = p_id and owner = p_owner);
end $function$
;

CREATE OR REPLACE FUNCTION public.job_put(p_secret text, p_id text, p_owner text, p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  insert into public.jobs(id, owner, data) values (left(p_id, 64), p_owner, jsonb_build_object(p_key, p_value))
  on conflict (id) do update set data = public.jobs.data || jsonb_build_object(p_key, p_value), updated_at = now()
  where public.jobs.owner = p_owner;
  -- old results are emptied (images are large), the tiny row stays
  update public.jobs set data = '{}'::jsonb where created_at < now() - interval '2 days' and data <> '{}'::jsonb;
end $function$
;

CREATE OR REPLACE FUNCTION public.join_waitlist(p_email text, p_lang text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then return false; end if;
  insert into public.waitlist(email, lang) values (lower(p_email), left(p_lang, 5)) on conflict do nothing;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.log_event(p_name text, p_anon text, p_props jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.events(name, anon_id, user_id, props) values (left(p_name, 40), left(p_anon, 64), auth.uid(), p_props);
$function$
;

CREATE OR REPLACE FUNCTION public.moderate_post(p_id bigint, p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  update public.community_posts set status = case when p_ok then 'approved' else 'rejected' end, reviewed_at = now() where id = p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_invites()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object('joined', (select count(*) from public.profiles where referred_by = auth.uid()));
$function$
;

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
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  -- free beta: a daily allowance for everyone, plus invite bonuses
  lim := 30 + coalesce(p.bonus, 0);
  select count(*) into used from public.generations where user_id = uid and kind = 'preview' and created_at > now() - interval '24 hours';
  return json_build_object('plan', 'free', 'used', used, 'limit', lim,
    'remaining', greatest(0, lim - used), 'canAge', true,
    'bonus', coalesce(p.bonus, 0), 'onboarding', p.onboarding, 'lang', p.lang,
    'notifyVotes', coalesce(p.notify_votes, true), 'stripe_customer_id', null);
end $function$
;

CREATE OR REPLACE FUNCTION public.my_shares()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select p.share_id, 'preview' as kind, p.id::text as preview_id, p.placement, p.created_at,
           (select status from public.community_posts c where c.share_id = p.share_id) as post_status,
           public.get_share(p.share_id) as share
      from public.previews p where p.user_id = auth.uid() and p.share_id is not null and not p.hidden
    union all
    select g.share_id, case when g.y50_b is not null then 'ab' else 'guest' end, null, g.placement, g.created_at,
           (select status from public.community_posts c where c.share_id = g.share_id),
           public.get_share(g.share_id)
      from public.guest_shares g where g.user_id = auth.uid() and not g.hidden
  ) x;
$function$
;

CREATE OR REPLACE FUNCTION public.newsletter_set(p_secret text, p_token text, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if p_action = 'confirm' then
    update public.newsletter set confirmed_at = coalesce(confirmed_at, now()), unsubscribed_at = null where token = p_token;
  else
    update public.newsletter set unsubscribed_at = now() where token = p_token;
  end if;
  return found;
end $function$
;

CREATE OR REPLACE FUNCTION public.newsletter_subscribe(p_secret text, p_email text, p_lang text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.newsletter;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then return json_build_object('ok', false); end if;
  insert into public.newsletter(email, lang) values (lower(p_email), left(p_lang, 5))
    on conflict (email) do update set unsubscribed_at = null, lang = excluded.lang
    returning * into r;
  return json_build_object('ok', true, 'token', r.token, 'confirmed', r.confirmed_at is not null);
end $function$
;

CREATE OR REPLACE FUNCTION public.post_status(p_shares text[])
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_object_agg(share_id, status), '{}'::json) from public.community_posts where share_id = any(p_shares[1:50]);
$function$
;

CREATE OR REPLACE FUNCTION public.refund_generation(p_gid bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.generations
  where id = p_gid and user_id = auth.uid() and aged = 0 and created_at > now() - interval '15 minutes';
end $function$
;

CREATE OR REPLACE FUNCTION public.revoke_guest_share(p_secret text, p_share text, p_guest text, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.guest_shares set hidden = true, fresh = null, y50 = null, fresh_b = null, y50_b = null
  where share_id = p_share and (guest_id = p_guest or (p_user is not null and user_id = p_user));
  if not found then return false; end if;
  update public.community_posts set status = 'withdrawn', reviewed_at = now() where share_id = p_share;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_profile(p_onboarding jsonb, p_lang text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set
    onboarding = coalesce(p_onboarding, onboarding),
    lang = coalesce(left(p_lang, 5), lang)
  where id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.send_feedback(p_kind text, p_message text, p_email text, p_anon text, p_page text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if length(trim(coalesce(p_message, ''))) < 3 then return false; end if;
  if (select count(*) from public.feedback where anon_id = left(p_anon, 64) and created_at > now() - interval '1 hour') >= 5 then return false; end if;
  insert into public.feedback(kind, message, email, anon_id, user_id, page)
  values (case when p_kind in ('bug', 'idea', 'question', 'other') then p_kind else 'other' end, left(p_message, 2000), nullif(left(trim(coalesce(p_email, '')), 200), ''), left(p_anon, 64), auth.uid(), left(p_page, 200));
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_notify_votes(p_on boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.profiles(id, notify_votes) values (auth.uid(), p_on) on conflict (id) do update set notify_votes = excluded.notify_votes;
$function$
;

CREATE OR REPLACE FUNCTION public.share_preview(p_preview uuid, p_paths jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid text;
begin
  select share_id into sid from public.previews where id = p_preview and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if sid is null then
    sid := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  end if;
  update public.previews set share_id = sid, share_paths = p_paths where id = p_preview and user_id = auth.uid();
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.start_generation(p_placement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q json;
  gid bigint;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  q := public.my_quota();
  if (q->>'remaining')::int <= 0 then
    return (json_build_object('ok', false)::jsonb || q::jsonb)::json;
  end if;
  insert into public.generations(user_id, placement) values (auth.uid(), left(p_placement, 80)) returning id into gid;
  return (json_build_object('ok', true, 'gid', gid)::jsonb || q::jsonb)::json;
end $function$
;

CREATE OR REPLACE FUNCTION public.stripe_apply(p_secret text, p_user uuid, p_customer text, p_plan text, p_until timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then
    raise exception 'forbidden';
  end if;
  if p_user is null and p_customer is not null then
    select id into p_user from public.profiles where stripe_customer_id = p_customer;
  end if;
  if p_user is null then return; end if;
  insert into public.profiles(id) values (p_user) on conflict (id) do nothing;
  if p_customer is not null then
    update public.profiles set stripe_customer_id = p_customer where id = p_user;
  end if;
  if p_plan is null then return; end if;
  if p_plan = 'refund' then
    update public.profiles set plan = 'free', plan_until = null where id = p_user;
    return;
  end if;
  update public.profiles
    set plan = p_plan, plan_until = p_until
    where id = p_user and not (plan = 'lifetime' and p_plan <> 'lifetime');
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_post(p_share text, p_caption text, p_anon text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.guest_shares where share_id = p_share and not hidden)
     and not exists (select 1 from public.previews where share_id = p_share and not hidden) then
    return false;
  end if;
  if (select count(*) from public.community_posts where voter = left(p_anon, 64) and created_at > now() - interval '1 day') >= 5 then
    return false;
  end if;
  insert into public.community_posts(share_id, caption, voter) values (p_share, left(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g'), 120), left(p_anon, 64))
  on conflict (share_id) do nothing;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.trends()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'places', (select coalesce(json_agg(p), '[]'::json) from (
        select placement, count(*) n from public.generations
        where kind = 'preview' and created_at > now() - interval '7 days' and placement is not null and placement not like '@%'
        group by placement order by n desc limit 6) p),
    'designs', (select coalesce(json_agg(d), '[]'::json) from (
        select props->>'id' as id, count(*) n from public.events
        where name in ('design_added', 'explore_design') and props->>'id' is not null and created_at > now() - interval '7 days'
        group by 1 order by n desc limit 8) d),
    'previews_total', (select count(*) from public.generations where kind = 'preview')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.unshare_preview(p_preview uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare sid text;
begin
  select share_id into sid from public.previews where id = p_preview and user_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
  if sid is not null then
    update public.community_posts set status = 'withdrawn', reviewed_at = now() where share_id = sid;
  end if;
  update public.previews set share_id = null, share_paths = null where id = p_preview and user_id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.vote_notify_target(p_secret text, p_share text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare uid uuid; lab text; em text; lng text;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.previews set notified_at = now()
    where share_id = p_share and not hidden and (notified_at is null or notified_at < now() - interval '1 hour')
    returning user_id, placement into uid, lab;
  if uid is null then
    update public.guest_shares set notified_at = now()
      where share_id = p_share and not hidden and user_id is not null and (notified_at is null or notified_at < now() - interval '1 hour')
      returning user_id, placement into uid, lab;
  end if;
  if uid is null then return null; end if;
  if not coalesce((select notify_votes from public.profiles where id = uid), true) then return null; end if;
  select email, coalesce((select lang from public.profiles where id = uid), 'hu') into em, lng from auth.users where id = uid;
  if em is null or em like '%@inkage.invalid' then return null; end if;
  return json_build_object('email', em, 'placement', lab, 'lang', lng, 'votes', (public.get_share(p_share))->'votes');
end $function$
;

CREATE OR REPLACE FUNCTION public.waitlist_take(p_secret text, p_limit integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare out json;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  with picked as (
    update public.waitlist set notified_at = now()
    where email in (select email from public.waitlist where notified_at is null order by created_at limit greatest(1, least(p_limit, 200)))
    returning email, lang)
  select coalesce(json_agg(picked), '[]'::json) into out from picked;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION public.welcome_once(p_secret text, p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare em text;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  insert into public.profiles(id) values (p_user) on conflict (id) do nothing;
  update public.profiles set welcomed_at = now() where id = p_user and welcomed_at is null;
  if not found then return null; end if;
  select email into em from auth.users where id = p_user;
  return em;
end $function$
;

CREATE OR REPLACE FUNCTION public.withdraw_post(p_share text, p_anon text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.community_posts c set status = 'withdrawn', reviewed_at = now() where c.share_id = p_share and (
    c.voter = left(p_anon, 64)
    or exists (select 1 from public.previews p where p.share_id = p_share and p.user_id = auth.uid())
    or exists (select 1 from public.guest_shares g where g.share_id = p_share and g.user_id = auth.uid()));
  return found;
end $function$
;
