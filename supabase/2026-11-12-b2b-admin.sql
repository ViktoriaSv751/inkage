-- InkAge admin: Szalonok (B2B) page (2026-11-12, agent "admin", branch b2b-admin). Additive: new columns with
-- defaults, one new table, new functions. Two existing objects change: the default of b2b_leads.status ('new' → 'uj';
-- the table was empty) and public.pay_rows (a 0 Ft row that is not 'manual', e.g. a 100% coupon month, now reads as
-- 'manual' on the money pages, so it is never counted as revenue). Applied 2026-11-12 as migrations
-- inkage_b2b_admin_leads_webhook, inkage_b2b_admin_page_fns, inkage_b2b_admin_tools_payrows, inkage_b2b_admin_studio_team.
-- The CSV import was run once the same day (Desktop/INKAGE/Marketing/B2B/leads.csv + sent.csv merged per e-mail):
--   select public.b2b_lead_import('[{"company":..,"email":..,"kind":..,"city":..,"website":..,"note":..,"sent":"2026-11-12","ref":"b1-01","status":"sent","followup_due":"2026-11-16"}, ...]');
--   → 40 leads inserted (20 'kikuldve' with ref b1-01..b1-20, 20 'uj'). Running it again only completes rows, never duplicates.

-- ---------- the lead pipeline ----------
alter table public.b2b_leads alter column status set default 'uj';
update public.b2b_leads set status = 'uj' where status is null or status = 'new';
alter table public.b2b_leads add column if not exists note text;
alter table public.b2b_leads add column if not exists updated_at timestamptz not null default now();
alter table public.b2b_leads add column if not exists city text;
alter table public.b2b_leads add column if not exists website text;
alter table public.b2b_leads add column if not exists source text not null default 'form';   -- form | outreach
alter table public.b2b_leads add column if not exists sent_at date;
alter table public.b2b_leads add column if not exists followup_due date;
create index if not exists b2b_leads_email on public.b2b_leads (lower(email));
create index if not exists b2b_leads_ref on public.b2b_leads (ref);

-- the seven steps (uj = new, kikuldve = e-mail sent, valaszolt = replied, minta = sample preview sent, proba = trial,
-- elofizeto = subscriber, elutasitotta = said no)
create or replace function public.b2b_lead_status_ok(p text) returns boolean language sql immutable set search_path = '' as $$
  select p in ('uj', 'kikuldve', 'valaszolt', 'minta', 'proba', 'elofizeto', 'elutasitotta')
$$;

-- the import: rows from leads.csv and sent.csv as one jsonb array; one lead per e-mail (lower case), existing rows are
-- completed, never emptied, and a status only moves forward from 'uj'. Callable only by the database owner (the SQL
-- editor / MCP) and through admin_b2b_lead_import (the admin).
create or replace function public.b2b_lead_import(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; e text; st text; ins int := 0; upd int := 0; skip int := 0; lid bigint;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    e := lower(trim(coalesce(r->>'email', '')));
    if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then skip := skip + 1; continue; end if;
    st := case lower(coalesce(r->>'status', '')) when 'sent' then 'kikuldve' when 'replied' then 'valaszolt' when 'sample' then 'minta'
      when 'trial' then 'proba' when 'subscribed' then 'elofizeto' when 'declined' then 'elutasitotta' when 'rejected' then 'elutasitotta'
      else case when public.b2b_lead_status_ok(lower(r->>'status')) then lower(r->>'status') else null end end;
    select id into lid from public.b2b_leads where lower(email) = e order by id limit 1;
    if lid is null then
      insert into public.b2b_leads (company, email, city, website, kind, ref, note, source, sent_at, followup_due, status)
      values (left(trim(coalesce(r->>'company', r->>'name', '')), 120), left(e, 160), left(nullif(trim(r->>'city'), ''), 80), left(nullif(trim(r->>'website'), ''), 200),
        left(nullif(trim(coalesce(r->>'kind', r->>'type')), ''), 20), left(nullif(trim(r->>'ref'), ''), 60), left(nullif(trim(r->>'note'), ''), 1000), 'outreach',
        nullif(r->>'sent', '')::date, nullif(r->>'followup_due', '')::date, coalesce(st, case when nullif(r->>'sent', '') is not null then 'kikuldve' else 'uj' end));
      ins := ins + 1;
    else
      update public.b2b_leads l set
        company = coalesce(nullif(l.company, ''), left(trim(coalesce(r->>'company', r->>'name')), 120)),
        city = coalesce(l.city, left(nullif(trim(r->>'city'), ''), 80)), website = coalesce(l.website, left(nullif(trim(r->>'website'), ''), 200)),
        kind = coalesce(l.kind, left(nullif(trim(coalesce(r->>'kind', r->>'type')), ''), 20)), ref = coalesce(l.ref, left(nullif(trim(r->>'ref'), ''), 60)),
        note = coalesce(l.note, left(nullif(trim(r->>'note'), ''), 1000)),
        sent_at = coalesce(l.sent_at, nullif(r->>'sent', '')::date), followup_due = coalesce(nullif(r->>'followup_due', '')::date, l.followup_due),
        status = case when coalesce(l.status, 'uj') = 'uj' then coalesce(st, case when nullif(r->>'sent', '') is not null then 'kikuldve' end, 'uj') else l.status end,
        updated_at = now()
      where l.id = lid;
      upd := upd + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skip);
end $$;
revoke execute on function public.b2b_lead_import(jsonb) from public, anon, authenticated;

create or replace function public.admin_b2b_lead_import(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  res := public.b2b_lead_import(p_rows);
  perform public.admin_audit_add('b2b_lead_import', 'b2b_leads', res);
  return res;
end $$;
revoke execute on function public.admin_b2b_lead_import(jsonb) from public, anon;

create or replace function public.admin_b2b_lead_set(p_id bigint, p_status text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.b2b_leads;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status is not null and not public.b2b_lead_status_ok(p_status) then raise exception 'bad_status'; end if;
  update public.b2b_leads set status = coalesce(p_status, status), note = case when p_note is null then note else left(nullif(trim(p_note), ''), 2000) end, updated_at = now()
   where id = p_id returning * into l;
  if l.id is null then raise exception 'not_found'; end if;
  perform public.admin_audit_add('b2b_lead_set', l.company, jsonb_build_object('id', p_id, 'status', p_status, 'note', p_note is not null));
  return jsonb_build_object('ok', true, 'status', l.status);
end $$;
revoke execute on function public.admin_b2b_lead_set(bigint, text, text) from public, anon;

-- ---------- webhook problems ----------
create table if not exists public.b2b_webhook_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event_type text, ref text, ok boolean not null default true, error text
);
create index if not exists b2b_webhook_log_at on public.b2b_webhook_log (at desc);
alter table public.b2b_webhook_log enable row level security;
revoke all on public.b2b_webhook_log from anon, authenticated;
-- the webhook calls this (anon client + the db key); it never fails the webhook: a bad key raises, anything else is kept short
create or replace function public.b2b_webhook_log_add(p_key text, p_event_type text, p_ref text default null, p_ok boolean default true, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.b2b_webhook_log (event_type, ref, ok, error) values (left(p_event_type, 80), left(p_ref, 120), coalesce(p_ok, true), left(p_error, 1000));
  delete from public.b2b_webhook_log where at < now() - interval '180 days';
end $$;
revoke execute on function public.b2b_webhook_log_add(text, text, text, boolean, text) from public;
grant execute on function public.b2b_webhook_log_add(text, text, text, boolean, text) to anon, authenticated;

-- ---------- prices and names (the same as lib/b2b.ts; annual = 10 months for 12) ----------
create or replace function public.b2b_month_huf(p_plan text) returns numeric language sql immutable set search_path = '' as $$
  select case p_plan when 'b2b_studio' then 9900 when 'b2b_pro' then 19900 when 'b2b_clinic' then 29900
    when 'b2b_studio_y' then round(99000 / 12.0) when 'b2b_pro_y' then round(199000 / 12.0) when 'b2b_clinic_y' then round(299000 / 12.0) else 0 end::numeric
$$;
create or replace function public.b2b_plan_name(p_plan text) returns text language sql immutable set search_path = '' as $$
  select case p_plan when 'b2b_trial' then 'Szalon próba (14 nap)' when 'b2b_studio' then 'Szalon (havi)' when 'b2b_pro' then 'Szalon Pro (havi)' when 'b2b_clinic' then 'Klinika (havi)'
    when 'b2b_studio_y' then 'Szalon (éves)' when 'b2b_pro_y' then 'Szalon Pro (éves)' when 'b2b_clinic_y' then 'Klinika (éves)'
    when 'b2b_topup' then 'Szalon: extra előnézetek' when 'b2b_bonus' then 'Szalon: ajándék előnézetek' else p_plan end
$$;

-- previews still left on one account (as the app counts them: every package since the start of payments, minus the
-- previews made since then)
create or replace function public.b2b_left(p_uid uuid) returns int language sql stable security definer set search_path = '' as $$
  select greatest(0, public.pay_credits(p_uid) + coalesce((select case when public.pay_credits(p_uid) > 0 then pr.bonus else 0 end from public.profiles pr where pr.id = p_uid), 0)
    - (select count(*) from public.generations g where g.user_id = p_uid and g.kind = 'preview' and g.created_at >= public.pay_start()))::int
$$;
revoke execute on function public.b2b_left(uuid) from public, anon, authenticated;

-- ---------- the page ----------
create or replace function public.admin_b2b(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a timestamptz := now() - make_interval(days => greatest(coalesce(nullif(p_days, 0), 3650), 1)); res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with ev as (
    select e.name, e.created_at, e.user_id, coalesce(e.anon_id, e.session, e.user_id::text, e.id::text) who, nullif(e.props->>'ref', '') ref, e.path, e.props
      from public.events e
     where e.created_at >= a and not public.admin_own_uid(e.user_id)
       and (e.name like 'b2b\_%' or (e.name = 'page_view' and e.path like '/szalonoknak%'))),
  subs as (
    select s.*, u.email, public.admin_own_uid(s.user_id) own,
      (select count(*) from public.generations g where g.user_id = s.user_id and g.kind = 'preview' and g.created_at >= s.created_at) used_all,
      (select max(p.created_at) from public.purchases p where p.user_id = s.user_id and p.plan like 'b2b\_%' and p.plan not in ('b2b_trial', 'b2b_bonus', 'b2b_topup')) last_refill,
      public.b2b_left(s.user_id) left_now,
      public.b2b_month_huf(s.plan) mrr_huf
    from public.b2b_subs s left join auth.users u on u.id = s.user_id),
  subs2 as (select s.*, (select count(*) from public.generations g where g.user_id = s.user_id and g.kind = 'preview'
      and g.created_at >= coalesce(s.last_refill, s.current_period_end - interval '1 month', s.created_at)) used_period from subs s)
  select jsonb_build_object(
    'days', p_days,
    'funnel', jsonb_build_object(
      'visitors', (select count(distinct who) from ev where name in ('page_view', 'b2b_view')),
      'views_ref', (select count(distinct who) from ev where name = 'b2b_view' and ref is not null),
      'leads', (select count(*) from public.b2b_leads l where l.created_at >= a and l.source = 'form'),
      'trial_ev', (select count(distinct who) from ev where name = 'b2b_trial'),
      'checkout_ev', (select count(distinct who) from ev where name = 'b2b_checkout'),
      'subscribed_ev', (select count(distinct who) from ev where name = 'b2b_subscribed'),
      'portal_ev', (select count(distinct who) from ev where name = 'b2b_portal'),
      'trials', (select count(*) from subs where created_at >= a and not own),
      'paid', (select count(*) from subs where not own and status in ('active', 'past_due', 'canceled') and created_at >= a)),
    'by_day', coalesce((select jsonb_agg(x order by x.day) from (
      select (created_at at time zone 'Europe/Budapest')::date as day, count(distinct who) filter (where name in ('page_view', 'b2b_view')) views,
        count(distinct who) filter (where name = 'b2b_trial') trials, count(distinct who) filter (where name = 'b2b_checkout') checkouts
      from ev group by 1) x), '[]'::jsonb),
    'by_ref', coalesce((select jsonb_agg(x order by x.last_at desc) from (
      select ev.ref, count(*) views, count(distinct ev.who) visitors, min(ev.created_at) as first_at, max(ev.created_at) as last_at,
        (select l.company from public.b2b_leads l where l.ref = ev.ref limit 1) company, (select l.id from public.b2b_leads l where l.ref = ev.ref limit 1) lead_id,
        bool_or(ev.name = 'b2b_trial') trial, bool_or(ev.name = 'b2b_checkout') checkout
      from ev where ev.ref is not null group by ev.ref limit 200) x), '[]'::jsonb),
    'mrr', jsonb_build_object(
      'huf', (select coalesce(sum(mrr_huf), 0) from subs where status = 'active' and not own),
      'active', (select count(*) from subs where status = 'active' and not own),
      'annual', (select count(*) from subs where status = 'active' and not own and plan like '%\_y'),
      'past_due_huf', (select coalesce(sum(mrr_huf), 0) from subs where status = 'past_due' and not own),
      'ending_huf', (select coalesce(sum(mrr_huf), 0) from subs where status = 'active' and cancel_at_period_end and not own),
      'by_plan', coalesce((select jsonb_agg(x order by x.huf desc) from (select plan, public.b2b_plan_name(plan) as name, count(*) n, sum(mrr_huf) huf from subs where status = 'active' and not own group by plan) x), '[]'::jsonb)),
    'trials', coalesce((select jsonb_agg(x order by x.trial_ends_at desc nulls last) from (
      select s.user_id, s.company, s.email, s.status, s.created_at, s.trial_ends_at, s.own,
        greatest(0, ceil(extract(epoch from s.trial_ends_at - now()) / 86400))::int days_left, s.used_all used, s.left_now "left",
        (select l.id from public.b2b_leads l where lower(l.email) = lower(s.email) limit 1) lead_id
      from subs s where s.status in ('trial', 'trial_ended')) x), '[]'::jsonb),
    'subs', coalesce((select jsonb_agg(x order by x.status, x.current_period_end) from (
      select s.user_id, s.company, s.email, s.plan, public.b2b_plan_name(s.plan) plan_name, s.plan like '%\_y' annual, s.status, s.current_period_end,
        s.cancel_at_period_end, s.created_at, s.updated_at, s.mrr_huf, s.used_period, s.left_now "left", public.pay_plan_credits(regexp_replace(coalesce(s.plan, ''), '_y$', '')) per_month,
        s.stripe_customer is not null has_customer, s.own
      from subs2 s where s.status in ('active', 'past_due', 'canceled')) x), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(x order by x.updated_at desc) from (
      select l.id, l.created_at, l.updated_at, l.company, l.name, l.email, l.phone, l.city, l.website, l.kind, l.plan, l.message, l.ref, l.source,
        coalesce(nullif(l.status, 'new'), 'uj') as status, l.note, l.sent_at, l.followup_due,
        (select count(*) from public.events e where e.name = 'b2b_view' and l.ref is not null and e.props->>'ref' = l.ref) views,
        (select s.status from public.b2b_subs s join auth.users u on u.id = s.user_id where lower(u.email) = lower(l.email) limit 1) sub_status
      from public.b2b_leads l) x), '[]'::jsonb),
    'webhook', coalesce((select jsonb_agg(x order by x.at desc) from (select w.id, w.at, w.event_type, w.ref, w.ok, w.error from public.b2b_webhook_log w order by w.at desc limit 50) x), '[]'::jsonb),
    'webhook_bad_7d', (select count(*) from public.b2b_webhook_log w where not w.ok and w.at > now() - interval '7 days'),
    'team_table', to_regclass('public.b2b_team') is not null
  ) into res;
  return res;
end $$;
revoke execute on function public.admin_b2b(int) from public, anon;

-- one studio: its plan, every B2B purchase, previews per month, its B2B events and (when the table exists) its team
create or replace function public.admin_b2b_studio(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; team jsonb := null; col text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  -- b2b_team is another agent's table: read it whatever its owner column is called, and never fail the page over it
  if to_regclass('public.b2b_team') is not null then
    select c.column_name into col from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'b2b_team' and c.column_name in ('owner_id', 'studio_id', 'owner_user_id', 'owner', 'studio_user_id', 'sub_user_id')
     order by array_position(array['owner_id', 'studio_id', 'owner_user_id', 'owner', 'studio_user_id', 'sub_user_id'], c.column_name::text) limit 1;
    begin
      if col is not null then
        execute format('select coalesce(jsonb_agg(to_jsonb(t) - ''token'' - ''token_hash'' - ''invite_token'' - ''secret''), ''[]''::jsonb) from public.b2b_team t where t.%I::text = $1::text', col) into team using p_user;
      end if;
    exception when others then team := jsonb_build_array(jsonb_build_object('error', sqlerrm));
    end;
    -- each member's own previews (a member's id, when the table has one)
    if team is not null and jsonb_typeof(team) = 'array' then
      select coalesce(jsonb_agg(m || jsonb_build_object('previews_month', (select count(*) from public.generations g where g.kind = 'preview' and g.user_id::text = coalesce(m->>'member', m->>'member_id', m->>'user_id')
          and g.created_at >= date_trunc('month', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest'),
        'previews_all', (select count(*) from public.generations g where g.kind = 'preview' and g.user_id::text = coalesce(m->>'member', m->>'member_id', m->>'user_id')))), '[]'::jsonb)
        into team from jsonb_array_elements(team) m;
    end if;
  end if;
  select jsonb_build_object(
    'sub', (select to_jsonb(s) || jsonb_build_object('email', u.email, 'plan_name', public.b2b_plan_name(s.plan), 'mrr_huf', public.b2b_month_huf(s.plan), 'left', public.b2b_left(s.user_id))
              from public.b2b_subs s left join auth.users u on u.id = s.user_id where s.user_id = p_user),
    'lead', (select to_jsonb(l) from public.b2b_leads l join auth.users u on lower(u.email) = lower(l.email) where u.id = p_user limit 1),
    'purchases', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select p.id, p.created_at, p.store, p.transaction_id, p.plan, public.b2b_plan_name(p.plan) plan_name, p.credits, p.amount, p.currency, p.refunded_at, p.note
        from public.purchases p where p.user_id = p_user) x), '[]'::jsonb),
    'by_month', coalesce((select jsonb_agg(x order by x.month) from (
      select to_char(g.created_at at time zone 'Europe/Budapest', 'YYYY-MM') as month, count(*) previews, count(distinct (g.created_at at time zone 'Europe/Budapest')::date) days
        from public.generations g where g.user_id = p_user and g.kind = 'preview' group by 1) x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select e.created_at, e.name, e.props from public.events e where e.user_id = p_user and e.name like 'b2b\_%' order by e.created_at desc limit 50) x), '[]'::jsonb),
    'team', team, 'team_table', to_regclass('public.b2b_team') is not null
  ) into res;
  return res;
end $$;
revoke execute on function public.admin_b2b_studio(uuid) from public, anon;

-- ---------- the owner's tools on a studio ----------
-- more trial days: from the later of today and the old end; an ended trial opens again (the previews it lost at the
-- end do not come back: add them with admin_b2b_bonus)
create or replace function public.admin_b2b_trial_extend(p_user uuid, p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.b2b_subs;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_days, 0) < 1 or p_days > 90 then raise exception 'bad_days'; end if;
  update public.b2b_subs set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_days),
    status = case when status = 'trial_ended' then 'trial' else status end, updated_at = now()
   where user_id = p_user and status in ('trial', 'trial_ended') returning * into s;
  if s.user_id is null then raise exception 'not_trial'; end if;
  perform public.admin_audit_add('b2b_trial_extend', coalesce(s.company, p_user::text), jsonb_build_object('user', p_user, 'days', p_days, 'ends', s.trial_ends_at));
  return jsonb_build_object('ok', true, 'trial_ends_at', s.trial_ends_at, 'status', s.status);
end $$;
revoke execute on function public.admin_b2b_trial_extend(uuid, int) from public, anon;

-- bonus previews: a purchases row of its own (store 'manual', plan 'b2b_bonus', 0 Ft), so it is never revenue and
-- the trial's end (which only trims the 'b2b_trial' row) leaves it alone
create or replace function public.admin_b2b_bonus(p_user uuid, p_n int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare tx text := 'b2b-bonus-' || p_user || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_n, 0) < 1 or p_n > 500 then raise exception 'bad_n'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then raise exception 'not_found'; end if;
  insert into public.purchases (user_id, store, transaction_id, product, plan, credits, amount, currency, note)
  values (p_user, 'manual', tx, 'inkage.b2b_bonus', 'b2b_bonus', p_n, 0, 'HUF', left(coalesce(nullif(trim(p_note), ''), 'admin bonus'), 300));
  perform public.admin_audit_add('b2b_bonus', p_user::text, jsonb_build_object('n', p_n, 'note', p_note, 'tx', tx));
  return jsonb_build_object('ok', true, 'left', public.b2b_left(p_user));
end $$;
revoke execute on function public.admin_b2b_bonus(uuid, int, text) from public, anon;

-- ---------- money pages: a 0 Ft row is not revenue ----------
-- pay_rows as before, except that a row with amount 0 outside 'manual' (a 100% coupon month) reads as 'manual'
create or replace function public.pay_rows(a timestamptz, b timestamptz)
 returns table(id bigint, created_at timestamptz, day date, user_id uuid, store text, tx text, plan text, name_norm text, amount numeric, currency text, est boolean, usd numeric, huf numeric, refunded_at timestamptz, refund_usd numeric, upgrade boolean, country text, coupon text, discount numeric, app_session text, device text, ab text, lang text, ch text, pf text, code text, account text, conf text, first_buy boolean, signed_up timestamptz, email text, note text, land text)
 language sql stable security definer set search_path = '' as $$
  with p as (
    select x.*, (x.created_at at time zone 'Europe/Budapest')::date d,
      case when x.amount = 0 then 'manual' else x.store end st,
      coalesce(x.amount, case when x.store = 'manual' then 0 else public.pay_list_usd(x.plan) end) amt,
      case when x.amount is null then 'USD' else upper(coalesce(x.currency, 'USD')) end cur
    from public.purchases x where x.created_at >= a and x.created_at < b and not public.admin_own_uid(x.user_id)),
  m as (select s.user_id, s.ch, s.pf, s.code, s.lang, s.conf, s.src->>'land' land from public.admin_signups_matched('2026-01-01'::timestamptz, now()) s where s.user_id in (select p.user_id from p))
  select p.id, p.created_at, p.d, p.user_id, p.st, p.transaction_id, p.plan, p.name_norm, p.amt, p.cur, p.amount is null and p.store <> 'manual',
    round(public.pay_usd(p.amt, p.cur, p.d), 2), round(public.pay_usd(p.amt, p.cur, p.d) * public.pay_huf_rate(p.d)),
    p.refunded_at, round(public.pay_usd(case when p.refunded_at is not null then coalesce(nullif(p.refund_amount, 0), p.amt) else 0 end, p.cur, p.d), 2), p.plan like 'up\_%',
    p.country, upper(p.coupon), p.discount, p.app_session, p.device, p.ab, coalesce(p.lang, m.lang),
    coalesce(case when p.store = 'apple' then 'iphoneapp' when p.store = 'google' and coalesce(m.ch, '') in ('', 'ismeretlen') then 'androidapp' end, nullif(m.ch, ''), 'ismeretlen'),
    coalesce(m.pf, case p.store when 'apple' then 'ios' when 'google' then 'android' else 'web' end), m.code,
    coalesce((select e.label from public.social_extra_accounts e where e.code is not null and e.code = m.code limit 1),
      case when m.ch in ('tiktok', 'instagram') and coalesce(m.conf, '') <> 'gyenge' then 'InkAge · ' || m.ch end),
    m.conf, p.created_at = (select min(q.created_at) from public.purchases q where q.user_id = p.user_id),
    u.created_at, u.email, p.note, m.land
  from p left join m on m.user_id = p.user_id left join auth.users u on u.id = p.user_id
$$;
