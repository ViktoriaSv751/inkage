-- InkAge database. All writes go through SECURITY DEFINER functions;
-- the app never needs the service-role key.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','weekly','lifetime')),
  plan_until timestamptz,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
create table if not exists public.generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  placement text,
  aged int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists generations_user_created on public.generations(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.generations enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own generations" on public.generations;
create policy "own generations" on public.generations for select to authenticated using (user_id = auth.uid());

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);

-- Current plan + usage for the signed-in user
create or replace function public.my_quota() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  eff text;
  lim int;
  used int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  insert into public.profiles(id) values (uid) on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  eff := case
    when p.plan = 'lifetime' then 'lifetime'
    when p.plan = 'weekly' and p.plan_until > now() then 'weekly'
    else 'free' end;
  if eff = 'weekly' then
    lim := 20; select count(*) into used from public.generations where user_id = uid and created_at > now() - interval '7 days';
  elsif eff = 'lifetime' then
    lim := 40; select count(*) into used from public.generations where user_id = uid and created_at > now() - interval '30 days';
  else
    lim := 1; select count(*) into used from public.generations where user_id = uid;
  end if;
  return json_build_object('plan', eff, 'used', used, 'limit', lim,
    'remaining', greatest(0, lim - used), 'canAge', eff <> 'free',
    'stripe_customer_id', p.stripe_customer_id);
end $$;

-- Reserve one preview if the plan allows it
create or replace function public.start_generation(p_placement text) returns json
language plpgsql security definer set search_path = public as $$
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
end $$;

-- Give the preview back if generation failed
create or replace function public.refund_generation(p_gid bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.generations
  where id = p_gid and user_id = auth.uid() and aged = 0 and created_at > now() - interval '15 minutes';
$$;

-- Count an aging call (max 8 per preview)
create or replace function public.bump_age(p_gid bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.generations set aged = aged + 1
  where id = p_gid and user_id = auth.uid() and aged < 8
  returning aged into n;
  return n is not null;
end $$;

-- Stripe webhook entry point, guarded by a shared secret
create or replace function public.stripe_apply(p_secret text, p_user uuid, p_customer text, p_plan text, p_until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
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
  -- never downgrade a lifetime buyer because of a weekly/cancel event
  update public.profiles
    set plan = p_plan, plan_until = p_until
    where id = p_user and not (plan = 'lifetime' and p_plan <> 'lifetime');
end $$;

revoke all on function public.my_quota() from public, anon;
revoke all on function public.start_generation(text) from public, anon;
revoke all on function public.refund_generation(bigint) from public, anon;
revoke all on function public.bump_age(bigint) from public, anon;
revoke all on function public.stripe_apply(text, uuid, text, text, timestamptz) from public;
grant execute on function public.my_quota() to authenticated;
grant execute on function public.start_generation(text) to authenticated;
grant execute on function public.refund_generation(bigint) to authenticated;
grant execute on function public.bump_age(bigint) to authenticated;
grant execute on function public.stripe_apply(text, uuid, text, text, timestamptz) to anon, authenticated;
