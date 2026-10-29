-- Security fix: InkAge's older admin functions let in anyone whose e-mail was a PART of the owner's address
-- (position(lower(email) in admin_emails) — e.g. "soti@gmail.com" matched "vviktoriasoti@gmail.com").
-- They now require an exact, confirmed match with one of the addresses in private.config.admin_emails.

create or replace function public.admin_email_ok(p_email text) returns boolean
language sql stable security definer set search_path to '' as $$
  select p_email is not null and lower(trim(p_email)) = any (
    select lower(trim(x)) from unnest(string_to_array((select value from private.config where key = 'admin_emails'), ',')) x where trim(x) <> '')
    and exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null)
$$;
revoke all on function public.admin_email_ok(text) from public, anon, authenticated;

do $fix$
declare r record; d text; n int := 0;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.prokind = 'f'
             and p.proname in ('admin_ai_report_done', 'admin_ai_reports', 'admin_extra', 'admin_feedback', 'admin_health', 'admin_posts',
                               'admin_report_action', 'admin_reports', 'admin_stats', 'admin_visitors', 'moderate_post', 'report_admin_targets', 'report_ai')
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, 'position\(lower\(([a-z_.]+)\) in lower\(\(select value from private\.config where key = ''admin_emails''\)\)\) = 0',
                        'not public.admin_email_ok(\1)', 'g');
    d := regexp_replace(d, 'position\(lower\(([a-z_.]+)\) in lower\(\(select value from private\.config where key = ''admin_emails''\)\)\) > 0',
                        'public.admin_email_ok(\1)', 'g');
    if d ~ 'position\(lower\(' then raise exception 'not replaced in %', r.proname; end if;
    execute d;
    n := n + 1;
  end loop;
  if n <> 13 then raise exception 'expected 13 functions, got %', n; end if;
end $fix$;

-- the dashboard's own functions are for signed-in callers only
revoke execute on function public.admin_extra(), public.admin_feedback(), public.admin_health(), public.admin_posts(), public.admin_reports(),
  public.admin_stats(), public.admin_report_action(text, boolean), public.moderate_post(bigint, boolean) from public, anon;
