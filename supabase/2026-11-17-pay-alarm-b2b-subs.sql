-- Applied 2026-11-17. The paid-but-missing check knows studio subscriptions (b2b_subs.stripe_sub),
-- so a paid studio plan is no longer flagged as a missing purchase.
create or replace function public.admin_r_stripe_state(p_token text) returns jsonb
language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.admin_gate(p_token) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'last_tx', (select max(created) from public.stripe_tx),
    'last_payout', (select max(created) from public.stripe_payouts),
    'sessions', coalesce((select jsonb_agg(transaction_id) from public.purchases where store = 'stripe' and created_at > now() - interval '3 days'), '[]'::jsonb),
    'subs', coalesce((select jsonb_agg(stripe_sub) from public.b2b_subs where stripe_sub is not null), '[]'::jsonb),
    'fx_day', (select max(day) from public.fx_rates));
end $function$;
