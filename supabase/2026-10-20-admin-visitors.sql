-- Visitors and returning visitors for the admin page, from our own anonymous events
-- (only devices that accepted usage stats in the cookie banner are counted; no third parties).
-- A visitor is one anonymous device id; "returning" means it was also seen on an earlier day.
create or replace function public.admin_visitors()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null or position(lower(em) in lower((select value from private.config where key = 'admin_emails'))) = 0 then
    raise exception 'forbidden';
  end if;
  return (
    with days as (
      select distinct anon_id, (created_at at time zone 'Europe/Budapest')::date as day
      from public.events
      where anon_id is not null
    ),
    firsts as (
      select anon_id, min(day) as first_day from days group by anon_id
    ),
    tagged as (
      select d.anon_id, d.day, d.day > f.first_day as back
      from days d join firsts f using (anon_id)
    ),
    win as (
      select n,
        (select count(distinct anon_id) from tagged where day > current_date - n) as visitors,
        (select count(distinct anon_id) from tagged where day > current_date - n and back) as returning,
        (select count(*) from firsts where first_day > current_date - n) as new_visitors
      from (values (1), (7), (30)) v(n)
    )
    select json_build_object(
      'today', (select row_to_json(w) from win w where n = 1),
      'd7', (select row_to_json(w) from win w where n = 7),
      'd30', (select row_to_json(w) from win w where n = 30),
      'daily', (select coalesce(json_agg(x order by x.day), '[]'::json) from (
          select day, count(*) as visitors, count(*) filter (where back) as returning
          from tagged where day > current_date - 30 group by day) x)
    )
  );
end;
$function$;

revoke all on function public.admin_visitors() from public, anon;
grant execute on function public.admin_visitors() to authenticated;
