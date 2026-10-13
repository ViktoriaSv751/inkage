import { appSecret, json, userClient } from '@/lib/server';
import { guestFrom } from '@/lib/guest';

export const dynamic = 'force-dynamic';

/** A vote link without an account: the two small images are kept with the share. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ok = (s: any) => typeof s === 'string' && /^data:image\/jpeg;base64,/.test(s) && s.length < 700_000;
  if (!ok(body.fresh) || !ok(body.y50)) return json({ error: 'Wait for the 50-year image first.' }, 400);
  const g = guestFrom(req);
  const { data, error } = await userClient().rpc('guest_share', {
    p_secret: appSecret('db'),
    p_guest: g.id,
    p_placement: String(body.placement || '').slice(0, 200),
    p_score: Number.isFinite(Number(body.score)) ? Math.round(Number(body.score)) : null,
    p_fresh: body.fresh,
    p_y50: body.y50,
  });
  const res = error
    ? json({ error: /limit/.test(error.message) ? 'You shared a lot today. Try again tomorrow.' : 'Sharing failed. Try again.' }, error.message.includes('limit') ? 429 : 500)
    : json({ id: data });
  if (g.setCookie) res.headers.append('set-cookie', g.setCookie);
  return res;
}
