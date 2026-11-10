-- 2026-11-10: App Store / Google Play purchases. APPLIED live (migration inkage_pay_grant_store_20261110).
-- The edge function verify-purchase checks the purchase with Apple / Google, then adds the package with this function.
-- Only the service role (the edge function) may call it.
create or replace function public.pay_grant_store(p_user uuid, p_store text, p_tx text, p_plan text, p_amount numeric default null, p_currency text default null, p_meta jsonb default '{}'::jsonb)
 returns json language plpgsql security definer set search_path to ''
as $function$
declare n int; dup boolean;
begin
  if p_store not in ('apple', 'google') then raise exception 'bad_store'; end if;
  n := public.pay_plan_credits(p_plan);
  if n <= 0 then raise exception 'bad_plan'; end if;
  dup := exists (select 1 from public.purchases where store = p_store and transaction_id = p_tx);
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency, country, app_session, lang, device, note)
  values (p_user, p_store, p_tx, 'inkage.' || p_plan, p_plan, n, p_amount, upper(p_currency),
    nullif(upper(p_meta->>'country'), ''), nullif(p_meta->>'sess', ''), nullif(p_meta->>'lang', ''), nullif(p_meta->>'device', ''), nullif(p_meta->>'note', ''))
  on conflict (store, transaction_id) do nothing;
  return json_build_object('ok', true, 'duplicate', dup, 'credits', public.pay_credits(p_user));
end $function$;
revoke all on function public.pay_grant_store(uuid, text, text, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.pay_grant_store(uuid, text, text, text, numeric, text, jsonb) to service_role;
