-- InkAge: a fióktörlés az Apple-tokent és a "posztjai elrejtése" listát is törölje.
-- Supabase → SQL Editor → New query → illeszd be az egészet → Run.
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
  update public.polls set hidden = true where user_id = me;
  update public.jobs set data = '{}'::jsonb where owner = me::text;
  update public.ai_reports set thumb = null, note = null where user_id = me;
  update public.push_devices set active = false, endpoint = 'erased-' || id::text, sub = '{}'::jsonb, ua = null where user_id = me;
  update public.push_reminders set cancelled = true, title = '', body = '', url = null where user_id = me and sent_at is null;
  update public.feedback set email = null where user_id = me;
  update public.profiles set onboarding = null, lang = null where id = me;
  delete from public.apple_tokens where user_id = me;
  delete from public.author_blocks where blocker = me::text;
  update auth.identities set provider_id = 'erased-' || id::text, identity_data = '{}'::jsonb where user_id = me;
  update auth.users set email = 'erased+' || me::text || '@inkage.invalid', raw_user_meta_data = '{}'::jsonb,
    banned_until = '2999-12-31 00:00:00+00'::timestamptz where id = me;
end $function$;
