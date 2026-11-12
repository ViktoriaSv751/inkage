-- APPLIED live 2026-11-12 (migration inkage_b2b_trial_expire_keep_used_20261112).
-- Trial end removes only the UNUSED trial previews: the trial purchase keeps as many credits as previews were made
-- during the trial, so a later subscription's month is not eaten by previews already made (test: 15 used → 40 left after subscribing).
create or replace function public.b2b_trial_expire()
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  update public.purchases p
     set credits = least(p.credits, (select count(*) from public.generations g where g.user_id = s.user_id and g.kind = 'preview' and g.created_at >= s.created_at)),
         note = coalesce(p.note, '') || ' · trial ended'
    from public.b2b_subs s
   where s.status = 'trial' and s.trial_ends_at < now() and p.user_id = s.user_id and p.plan = 'b2b_trial' and p.store = 'manual'
     and p.transaction_id = 'b2b-trial-' || s.user_id;
  get diagnostics n = row_count;
  update public.b2b_subs set status = 'trial_ended', updated_at = now() where status = 'trial' and trial_ends_at < now();
  return n;
end $function$;
revoke all on function public.b2b_trial_expire() from public, anon, authenticated;
