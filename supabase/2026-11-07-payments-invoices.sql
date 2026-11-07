-- Applied 2026-11-07 as migration inkage_payments_02. public.invoices for the server without a service key:
-- each call carries the db secret (lib/server.ts appSecret('db')). Used by lib/billingo.ts.
create or replace function public.inv_record(p_key text, p_session text, p_pi text, p_payload jsonb, p_note text default null) returns boolean
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.invoices(session_id, payment_intent, payload, status, note)
  values (p_session, p_pi, p_payload, case when p_note is null then 'pending' else 'manual' end, p_note)
  on conflict (session_id) do nothing;
  return found;
end $$;

-- the row for this request only, or nothing when another request holds it (5-minute lock)
create or replace function public.inv_claim(p_key text, p_session text) returns setof public.invoices
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query update public.invoices set locked_at = now()
    where session_id = p_session and status in ('pending', 'failed', 'cancel_pending')
      and (locked_at is null or locked_at < now() - interval '5 minutes')
    returning *;
end $$;

-- set some fields of one row (only these columns)
create or replace function public.inv_save(p_key text, p_session text, p_set jsonb) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.invoices set
    status = case when p_set ? 'status' then p_set->>'status' else status end,
    partner_id = case when p_set ? 'partner_id' then (p_set->>'partner_id')::bigint else partner_id end,
    doc_id = case when p_set ? 'doc_id' then (p_set->>'doc_id')::bigint else doc_id end,
    attempts = case when p_set ? 'attempts' then (p_set->>'attempts')::int else attempts end,
    last_error = case when p_set ? 'last_error' then p_set->>'last_error' else last_error end,
    note = case when p_set ? 'note' then p_set->>'note' else note end,
    payload = case when p_set ? 'payload' then p_set->'payload' else payload end,
    locked_at = case when p_set ? 'locked_at' then (p_set->>'locked_at')::timestamptz else locked_at end,
    updated_at = now()
  where session_id = p_session;
end $$;

-- rows: by payment, the open ones, or the ones that need the owner
create or replace function public.inv_rows(p_key text, p_what text, p_ref text default null) returns setof public.invoices
language plpgsql security definer set search_path to '' as $$
begin
  if not public.pay_key_ok(p_key) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_what = 'pi' then return query select * from public.invoices where payment_intent = p_ref limit 1;
  elsif p_what = 'session' then return query select * from public.invoices where session_id = p_ref limit 1;
  elsif p_what = 'open' then return query select * from public.invoices where status in ('pending', 'failed', 'cancel_pending') order by updated_at limit 50;
  elsif p_what = 'bad' then return query select * from public.invoices where updated_at > now() - interval '30 days'
    and (attempts >= 3 or note is not null) and status <> 'void' limit 50;
  end if;
end $$;

revoke execute on function public.inv_record(text, text, text, jsonb, text), public.inv_claim(text, text), public.inv_save(text, text, jsonb), public.inv_rows(text, text, text) from public;
grant execute on function public.inv_record(text, text, text, jsonb, text), public.inv_claim(text, text), public.inv_save(text, text, jsonb), public.inv_rows(text, text, text) to anon, authenticated;

-- GO-LIVE STEP (not applied yet, the endpoint must be deployed first): every 10 minutes retry failed invoices
-- select cron.schedule('inkage-invoices', '*/10 * * * *', $$select public.admin_cron_call('/api/pay-cron')$$);
