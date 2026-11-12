import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { B2B, baseOf, intervalOf, isB2BBase, isB2BPlan, planId } from '@/lib/b2b';
import { nativeReq } from '@/lib/pay';

export const dynamic = 'force-dynamic';

/* Change plan (Szalon ⇄ Szalon Pro ⇄ Klinika) on an active subscription. The new plan starts at the next renewal:
   no proration and no extra charge now; that renewal's invoice adds the new plan's previews (the webhook reads the
   subscription's metadata plan). Monthly ⇄ annual is not switched here (a new billing cycle): cancel and start annual. */
const stripe = async (secret: string, path: string, body?: URLSearchParams) => {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${secret}`, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: body?.toString(), cache: 'no-store' });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as any };
};

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'payments_not_configured' }, 501);
  if (nativeReq(req)) return json({ error: 'not_in_app' }, 403);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const b = await req.json().catch(() => ({}));
  if (!isB2BBase(b.plan)) return json({ error: 'bad_request' }, 400);
  const { data: cur } = await userClient().rpc('b2b_billing_of', { p_key: appSecret('db'), p_user: a.user.id });
  if (!cur?.sub || (cur.status !== 'active' && cur.status !== 'past_due') || !isB2BPlan(cur.plan)) return json({ error: 'no_subscription' }, 404);
  const next = planId(b.plan, intervalOf(cur.plan));
  if (next === cur.plan) return json({ ok: true, unchanged: true });

  const s = await stripe(secret, `subscriptions/${encodeURIComponent(cur.sub)}`);
  const item = s.j?.items?.data?.[0];
  if (!s.ok || !item?.id) return json({ error: 'stripe_error' }, 502);
  const p = B2B[baseOf(next)];
  const amount = intervalOf(next) === 'year' ? p.huf * 10 : p.huf;
  const f = new URLSearchParams();
  f.set('items[0][id]', item.id);
  f.set('items[0][price_data][currency]', 'huf');
  f.set('items[0][price_data][unit_amount]', String(amount * 100));
  f.set('items[0][price_data][recurring][interval]', intervalOf(next));
  f.set('items[0][price_data][product]', String(item.price?.product));
  f.set('proration_behavior', 'none');
  f.set('metadata[plan]', next);
  const u = await stripe(secret, `subscriptions/${encodeURIComponent(cur.sub)}`, f);
  if (!u.ok) {
    console.error('b2b change failed', JSON.stringify(u.j).slice(0, 300));
    return json({ error: 'stripe_error' }, 502);
  }
  // the product name still says the old plan: rename it so the next invoice reads right
  await stripe(secret, `products/${encodeURIComponent(String(item.price?.product))}`, new URLSearchParams({ name: `InkAge ${B2B[baseOf(next)].name} – ${intervalOf(next) === 'year' ? 'éves díj' : 'havidíj'}` })).catch(() => null);
  return json({ ok: true, plan: next, from: cur.plan, startsAt: u.j?.current_period_end ?? item.current_period_end ?? null });
}
