import { appSecret, json, userClient } from '@/lib/server';
import { guestFrom } from '@/lib/guest';

export const dynamic = 'force-dynamic';

/** A vote link without an account: the two small images are kept with the share. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
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
  const res = error
    ? json({ error: /limit/.test(error.message) ? 'You shared a lot today. Try again tomorrow.' : 'Sharing failed. Try again.' }, error.message.includes('limit') ? 429 : 500)
    : json({ id: data });
  if (g.setCookie) res.headers.append('set-cookie', g.setCookie);
  return res;
}
