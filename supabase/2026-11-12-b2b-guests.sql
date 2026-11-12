-- B2B: how a studio handles its guests (2026-11-12, branch b2b-guests). Additive only.
--   * previews.guest_name / guest_note / guest_consent_at: the guest a studio preview was made for, and when the
--     studio ticked "the guest agreed that I upload their photo" (required before the photo for studio accounts)
--   * b2b_studio: a studio's own settings (logo, name shown to guests, auto-delete of guest photos)
--   * guest_links: the clean "send it to the guest" page /e/<id> (images copied to the public shares bucket, revocable)
--   * b2b_purge_queue + b2b_guest_sweep(): the daily auto-delete. Postgres may not delete storage files itself
--     (storage.protect_delete), and the server has no service key, so the sweep removes the database records at once
--     (the app no longer shows or links them; the files stay in the studio's private folder) and queues the file
--     paths; the studio's own app removes the files with its session the next time it opens (lib/studio.ts).

-- ---------------------------------------------------------------- previews: guest fields
alter table public.previews add column if not exists guest_name text;
alter table public.previews add column if not exists guest_note text;
alter table public.previews add column if not exists guest_consent_at timestamptz;
do $$ begin
  alter table public.previews add constraint previews_guest_len check (char_length(coalesce(guest_name, '')) <= 80 and char_length(coalesce(guest_note, '')) <= 500);
exception when duplicate_object then null; end $$;
create index if not exists previews_user_guest on public.previews (user_id, guest_name) where guest_name is not null;

-- ---------------------------------------------------------------- is this account a studio?
create or replace function public.is_studio(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid is not null and p_uid = auth.uid() and exists (select 1 from public.b2b_subs where user_id = p_uid)
$$;
revoke all on function public.is_studio(uuid) from public, anon;
grant execute on function public.is_studio(uuid) to authenticated;

-- ---------------------------------------------------------------- studio settings
create table if not exists public.b2b_studio (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(coalesce(name, '')) <= 80),
  logo_url text check (char_length(coalesce(logo_url, '')) <= 500),
  logo_path text check (char_length(coalesce(logo_path, '')) <= 300),
  photo_days integer check (photo_days in (30, 90)),          -- null = never delete
  delete_previews boolean not null default false,             -- also delete that guest's previews (and close their links)
  mark_downloads boolean not null default false,              -- small studio name in the corner of downloaded images
  updated_at timestamptz not null default now()
);
alter table public.b2b_studio enable row level security;
drop policy if exists b2b_studio_select on public.b2b_studio;
create policy b2b_studio_select on public.b2b_studio for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists b2b_studio_insert on public.b2b_studio;
create policy b2b_studio_insert on public.b2b_studio for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.b2b_subs s where s.user_id = (select auth.uid())));
drop policy if exists b2b_studio_update on public.b2b_studio;
create policy b2b_studio_update on public.b2b_studio for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.b2b_studio to authenticated;

-- ---------------------------------------------------------------- guest links (/e/<id>)
create table if not exists public.guest_links (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{16,40}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  guest_name text check (char_length(coalesce(guest_name, '')) <= 80),
  -- [{ "id": preview uuid, "placement": text, "created_at": ts, "mode": text, "images": { "fresh": url, "healed": url, ... } }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 20),
  files text[] not null default '{}',                         -- their copies in the shares bucket (removed on revoke)
  views integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists guest_links_user on public.guest_links (user_id, created_at desc);
alter table public.guest_links enable row level security;
drop policy if exists guest_links_select on public.guest_links;
create policy guest_links_select on public.guest_links for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists guest_links_insert on public.guest_links;
create policy guest_links_insert on public.guest_links for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.b2b_subs s where s.user_id = (select auth.uid())));
drop policy if exists guest_links_update on public.guest_links;
create policy guest_links_update on public.guest_links for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.guest_links to authenticated;

-- the public page reads one open link (no e-mail, no user id; only what the studio chose to send)
create or replace function public.guest_link_get(p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.guest_links; st public.b2b_studio; co text;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{16,40}$' then return null; end if;
  select * into r from public.guest_links where id = p_id and revoked_at is null;
  if not found then return null; end if;
  update public.guest_links set views = views + 1 where id = p_id;
  select * into st from public.b2b_studio where user_id = r.user_id;
  select company into co from public.b2b_subs where user_id = r.user_id;
  return jsonb_build_object(
    'guest', r.guest_name,
    'studio', coalesce(nullif(st.name, ''), co),
    'logo', st.logo_url,
    'items', r.items,
    'created_at', r.created_at
  );
end $$;
revoke all on function public.guest_link_get(text) from public;
grant execute on function public.guest_link_get(text) to anon, authenticated;

-- ---------------------------------------------------------------- auto-delete
create table if not exists public.b2b_purge_queue (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('previews', 'shares')),
  path text not null,
  queued_at timestamptz not null default now()
);
create index if not exists b2b_purge_queue_user on public.b2b_purge_queue (user_id);
alter table public.b2b_purge_queue enable row level security;
drop policy if exists b2b_purge_select on public.b2b_purge_queue;
create policy b2b_purge_select on public.b2b_purge_queue for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists b2b_purge_delete on public.b2b_purge_queue;
create policy b2b_purge_delete on public.b2b_purge_queue for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.b2b_purge_queue to authenticated;

/* Daily: for every studio that chose 30 or 90 days, guest photos older than that go.
   - uploads of kind 'photo' (the body photos the studio added): row deleted, file queued
   - with delete_previews: the previews (same as emptying Recently deleted: paths emptied, hidden, guest data cleared,
     vote link closed), their files queued, and every open guest link showing one of them revoked (its copies queued)
   Only accounts with a b2b_subs row AND a b2b_studio row with photo_days set are ever touched; photos only from the
   day the account became a studio (b2b_subs.created_at), previews only those made in the studio flow (guest_consent_at). */
create or replace function public.b2b_guest_sweep()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s record; cut timestamptz; n_up int := 0; n_pv int := 0; n_ln int := 0; k int; gone uuid[];
begin
  for s in
    select st.user_id, st.photo_days, st.delete_previews, b.created_at as since
    from public.b2b_studio st join public.b2b_subs b on b.user_id = st.user_id
    where st.photo_days in (30, 90)
  loop
    cut := now() - make_interval(days => s.photo_days);

    with del as (
      delete from public.uploads u where u.user_id = s.user_id and u.kind = 'photo' and u.created_at < cut and u.created_at >= s.since returning u.path
    ), q as (
      insert into public.b2b_purge_queue (user_id, bucket, path) select s.user_id, 'previews', path from del where path is not null returning 1
    ) select count(*) into k from q;
    n_up := n_up + k;

    if s.delete_previews then
      select coalesce(array_agg(p.id), '{}') into gone from public.previews p
        where p.user_id = s.user_id and p.created_at < cut and p.guest_consent_at is not null and (p.paths <> '{}'::jsonb or p.guest_name is not null or p.share_id is not null);
      if array_length(gone, 1) > 0 then
        insert into public.b2b_purge_queue (user_id, bucket, path)
          select s.user_id, 'previews', e.v from public.previews p, jsonb_each_text(p.paths) e(key, v)
          where p.id = any(gone) and e.v is not null and e.v not like 'job:%';
        -- the vote link's two copies (cloud.share writes <uid>/<preview>/fresh.jpg and y50.jpg)
        insert into public.b2b_purge_queue (user_id, bucket, path)
          select s.user_id, 'shares', s.user_id::text || '/' || p.id::text || '/' || x.f
          from public.previews p, unnest(array['fresh.jpg', 'y50.jpg']) x(f)
          where p.id = any(gone) and p.share_id is not null;
        update public.previews p set paths = '{}'::jsonb, hidden = true, deleted_at = coalesce(p.deleted_at, now()),
          report = null, notes = null, guest_name = null, guest_note = null, share_id = null, share_paths = null
          where p.id = any(gone);
        n_pv := n_pv + array_length(gone, 1);

        with rv as (
          update public.guest_links l set revoked_at = now()
          where l.user_id = s.user_id and l.revoked_at is null
            and exists (select 1 from jsonb_array_elements(l.items) it where (it->>'id') = any(gone::text[]))
          returning l.files
        ), q2 as (
          insert into public.b2b_purge_queue (user_id, bucket, path) select s.user_id, 'shares', f from rv, unnest(rv.files) f returning 1
        ) select count(*) into k from rv;
        n_ln := n_ln + k;
      end if;
    end if;
  end loop;
  return jsonb_build_object('photos', n_up, 'previews', n_pv, 'links', n_ln, 'at', now());
end $$;
revoke all on function public.b2b_guest_sweep() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('inkage-b2b-guest-sweep');
exception when others then null; end $$;
select cron.schedule('inkage-b2b-guest-sweep', '41 3 * * *', 'select public.b2b_guest_sweep()');
