-- The vote e-mail shows the picture the voters saw: the leading option of a poll, or the shared preview.
create or replace function public.vote_notify_target(p_secret text, p_share text)
 returns json language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare uid uuid; lab text; em text; lng text; pv json; gs json; lead json;
begin
  if p_secret is null or p_secret <> (select value from private.config where key = 'webhook_secret') then raise exception 'forbidden'; end if;
  update public.previews set notified_at = now()
    where share_id = p_share and not hidden and (notified_at is null or notified_at < now() - interval '1 hour')
    returning user_id, placement into uid, lab;
  if uid is null then
    update public.guest_shares set notified_at = now()
      where share_id = p_share and not hidden and user_id is not null and (notified_at is null or notified_at < now() - interval '1 hour')
      returning user_id, placement into uid, lab;
  end if;
  if uid is null then
    update public.polls set notified_at = now()
      where share_id = p_share and not hidden and user_id is not null and (notified_at is null or notified_at < now() - interval '1 hour')
      returning user_id, question into uid, lab;
    if uid is not null then
      pv := public.get_poll(p_share);
    end if;
  end if;
  if uid is null then return null; end if;
  if not coalesce((select notify_votes from public.profiles where id = uid), true) then return null; end if;
  select email, coalesce((select lang from public.profiles where id = uid), 'hu') into em, lng from auth.users where id = uid;
  if em like '%@inkage.invalid' then em := null; end if;
  if pv is not null then
    select json_build_object('label', o->>'label', 'votes', (o->>'votes')::int, 'path', coalesce(o->>'y50', o->>'fresh')) into lead
      from json_array_elements(pv->'options') o order by (o->>'votes')::int desc, (o->>'idx')::int limit 1;
    return json_build_object('user', uid, 'email', em, 'placement', lab, 'lang', lng, 'poll', true, 'total', pv->'total', 'leader', lead,
      'votes', json_build_object('yes', 0, 'no', 0, 'change', 0));
  end if;
  gs := public.get_share(p_share);
  return json_build_object('user', uid, 'email', em, 'placement', lab, 'lang', lng, 'votes', gs->'votes', 'paths', gs->'paths');
end $function$;
