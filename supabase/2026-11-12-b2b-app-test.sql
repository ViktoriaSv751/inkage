-- Tests for 2026-11-12-b2b-app.sql. Everything runs in one DO block that ends by RAISING its result, so every row
-- it made (throwaway auth.users, purchases, generations, team rows) is rolled back. Read the result in the error text.
do $test$
declare
  c uuid := gen_random_uuid(); ct uuid := gen_random_uuid(); o uuid := gen_random_uuid(); m uuid := gen_random_uuid(); m2 uuid := gen_random_uuid();
  q json; r json; tok text; out text := ''; ok boolean := true; i int;
begin
  insert into auth.users(id, instance_id, aud, role, email, created_at, updated_at)
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x::text || '@test.invalid', now(), now() from unnest(array[c, ct, o, m, m2]) x;
  insert into public.profiles(id) select x from unnest(array[c, ct, o, m, m2]) x on conflict do nothing;

  -- 1. consumer with a package: 5 credits, 2 previews made → 3 left, paid
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency) values (c, 'stripe', 'test-' || c, 'inkage.mini', 'mini', 5, 4.99, 'USD');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.start_generation('test', false, null); perform public.start_generation('test', false, null);
  q := public.my_quota(false, null);
  out := out || ' | consumer: ' || (q::jsonb - 'onboarding' - 'lang')::text;
  if (q->>'remaining')::int <> 3 or q->>'pay' <> 'paid' or (q->>'used')::int <> 2 or (q->>'studio')::boolean then ok := false; out := out || ' FAIL1'; end if;
  if exists (select 1 from public.generations where user_id = c and billed_to is not null) then ok := false; out := out || ' FAIL1b'; end if;

  -- 2. consumer without a package: trial, 0 left, teaser available (unchanged)
  perform set_config('request.jwt.claims', json_build_object('sub', ct, 'role', 'authenticated')::text, true);
  q := public.my_quota(false, null);
  out := out || ' | trial consumer: ' || (q::jsonb - 'onboarding' - 'lang')::text;
  if (q->>'remaining')::int <> 0 or q->>'pay' <> 'trial' or not (q->>'teaserLeft')::boolean then ok := false; out := out || ' FAIL2'; end if;

  -- 3. studio owner (Szalon Pro, 3 previews) invites a member, the member joins and shares the owner's previews
  insert into public.b2b_subs(user_id, company, plan, status, current_period_end) values (o, 'Teszt Szalon', 'b2b_pro', 'active', now() + interval '30 days');
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency) values (o, 'stripe', 'test-' || o, 'inkage.b2b_pro', 'b2b_pro', 3, 19900, 'HUF');
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  r := public.b2b_team_invite('member@test.invalid');
  tok := r->>'token';
  if not (r->>'ok')::boolean then ok := false; out := out || ' FAIL3 invite ' || r::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  r := public.b2b_team_join(tok);
  out := out || ' | join: ' || r::text;
  if not (r->>'ok')::boolean then ok := false; out := out || ' FAIL3 join'; end if;
  q := public.my_quota(false, null);
  out := out || ' | member before: ' || (q::jsonb - 'onboarding' - 'lang')::text;
  if (q->>'remaining')::int <> 3 or q->>'pay' <> 'paid' or q->>'team' <> 'member' or not (q->>'studio')::boolean or (q->>'teaserLeft')::boolean then ok := false; out := out || ' FAIL3 quota'; end if;
  -- a second account can't use the same link
  perform set_config('request.jwt.claims', json_build_object('sub', m2, 'role', 'authenticated')::text, true);
  r := public.b2b_team_join(tok);
  if (r->>'ok')::boolean or r->>'reason' <> 'taken' then ok := false; out := out || ' FAIL3 taken ' || r::text; end if;

  -- 4. member makes 2, owner makes 1 → pool empty; a 4th is refused for both (member can't exceed the owner's remaining)
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  r := public.start_generation('test', false, null); if not (r->>'ok')::boolean then ok := false; out := out || ' FAIL4a'; end if;
  r := public.start_generation('test', false, null); if not (r->>'ok')::boolean then ok := false; out := out || ' FAIL4b'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  r := public.start_generation('test', false, null); if not (r->>'ok')::boolean then ok := false; out := out || ' FAIL4c'; end if;
  q := public.my_quota(false, null);
  out := out || ' | owner after 3: ' || (q::jsonb - 'onboarding' - 'lang')::text;
  if (q->>'remaining')::int <> 0 or (q->>'used')::int <> 3 or q->>'team' <> 'owner' then ok := false; out := out || ' FAIL4d'; end if;
  r := public.start_generation('test', false, null); if (r->>'ok')::boolean or r->>'reason' <> 'paywall' then ok := false; out := out || ' FAIL4e ' || r::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  r := public.start_generation('test', false, null); if (r->>'ok')::boolean or r->>'reason' <> 'paywall' or (r->>'teaser')::boolean then ok := false; out := out || ' FAIL4f ' || r::text; end if;
  out := out || ' | owner list: ';
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  r := public.b2b_team_list();
  out := out || (r->'members')::text || ' ownerUsed=' || (r->>'ownerUsedPeriod');
  if (r->'members'->0->>'usedPeriod')::int <> 2 or (r->>'ownerUsedPeriod')::int <> 1 then ok := false; out := out || ' FAIL4g'; end if;
  r := public.b2b_me();
  out := out || ' | owner meter: ' || r::text;
  if (r->>'remaining')::int <> 0 or (r->>'usedPeriod')::int <> 3 or not (r->>'low')::boolean or (r->>'members')::int <> 1 then ok := false; out := out || ' FAIL4h'; end if;

  -- 5. the owner removes the member → the member is back on their own account (0 previews, trial); own purchase → own pool
  r := public.b2b_team_remove((select id from public.b2b_team where owner = o limit 1));
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  q := public.my_quota(false, null);
  out := out || ' | removed member: ' || (q::jsonb - 'onboarding' - 'lang')::text;
  if (q->>'remaining')::int <> 0 or q->>'pay' <> 'trial' or (q->>'used')::int <> 0 or (q->>'studio')::boolean or q->>'team' is not null then ok := false; out := out || ' FAIL5a'; end if;
  insert into public.purchases(user_id, store, transaction_id, product, plan, credits, amount, currency) values (m, 'stripe', 'test-' || m, 'inkage.mini', 'mini', 2, 4.99, 'USD');
  q := public.my_quota(false, null);
  if (q->>'remaining')::int <> 2 or q->>'pay' <> 'paid' then ok := false; out := out || ' FAIL5b ' || q::text; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  q := public.my_quota(false, null);
  if (q->>'used')::int <> 3 or (q->>'remaining')::int <> 0 then ok := false; out := out || ' FAIL5c ' || q::text; end if;

  -- 6. seats: Szalon (b2b_studio) is owner only
  update public.b2b_subs set plan = 'b2b_studio' where user_id = o;
  r := public.b2b_team_invite('x@test.invalid');
  if (r->>'ok')::boolean or r->>'reason' <> 'seats' then ok := false; out := out || ' FAIL6 ' || r::text; end if;

  raise exception 'B2B_APP_TEST % %', case when ok then 'PASS' else 'FAIL' end, out;
end $test$;
