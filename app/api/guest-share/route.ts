import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { guestFrom } from '@/lib/guest';

export const dynamic = 'force-dynamic';

/** A vote link without an account: the two small images are kept with the share. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // claim: after signing in, links made on this device belong to the account
  if (new URL(req.url).searchParams.get('claim')) {
    const a = await getAuthed(req);
    if (!a) return json({ error: 'Sign in first.' }, 401);
    const g = guestFrom(req);
    const { data } = await userClient().rpc('claim_device_shares', { p_secret: appSecret('db'), p_guest: g.id, p_user: a.user.id });
    return json({ claimed: data ?? 0 });
  }
  // revoke: close a link made on this device, or one owned by the signed-in user
  const rid = new URL(req.url).searchParams.get('revoke') ? new URL(req.url).searchParams.get('id') : null;
  if (rid) {
    const g = guestFrom(req);
    const a = await getAuthed(req);
    const { data, error } = await userClient().rpc('revoke_guest_share', { p_secret: appSecret('db'), p_share: rid.slice(0, 40), p_guest: g.id, p_user: a?.user.id ?? null });
    return error ? json({ error: 'Could not close the link. Try again.' }, 500) : data ? json({ ok: true }) : json({ error: 'Link not found.' }, 404);
  }
  const ok = (s: any) => typeof s === 'string' && /^data:image\/jpeg;base64,/.test(s) && s.length < 700_000;
  if (!ok(body.fresh) || !ok(body.y50)) return json({ error: 'Wait for the 50-year image first.' }, 400);
  const g = guestFrom(req);
  // A/B: "which one should I get?" with a second version
  const ab = ok(body.freshB) && ok(body.y50B);
  const common = {
    p_secret: appSecret('db'),
    p_guest: g.id,
    p_placement: String(body.placement || '').slice(0, 200),
    p_score: Number.isFinite(Number(body.score)) ? Math.round(Number(body.score)) : null,
    p_fresh: body.fresh,
    p_y50: body.y50,
  };
  const { data, error } = ab
    ? await userClient().rpc('guest_share_ab', { ...common, p_fresh_b: body.freshB, p_y50_b: body.y50B, p_label_a: String(body.labelA || 'A').slice(0, 60), p_label_b: String(body.labelB || 'B').slice(0, 60) })
    : await userClient().rpc('guest_share', common);
  // signed in: the link belongs to the account too, so it can be listed and removed later
  if (!error && data) {
    const a = await getAuthed(req);
    if (a) await userClient().rpc('claim_guest_share', { p_secret: appSecret('db'), p_share: data, p_user: a.user.id }).then(() => {}, () => {});
  }
  const res = error
    ? json({ error: /limit/.test(error.message) ? 'You shared a lot today. Try again tomorrow.' : 'Sharing failed. Try again.' }, error.message.includes('limit') ? 429 : 500)
    : json({ id: data });
  if (g.setCookie) res.headers.append('set-cookie', g.setCookie);
  return res;
}
