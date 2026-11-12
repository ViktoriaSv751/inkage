import { getAuthed, json } from '@/lib/server';
import { B2B, isB2BPlan } from '@/lib/b2b';
import { nativeReq } from '@/lib/pay';

export const dynamic = 'force-dynamic';

/* A monthly plan for a studio or clinic: Stripe Checkout in subscription mode, in forint. The subscription carries
   metadata app=inkage kind=b2b so the webhook adds each paid month's previews (invoice.paid). Web only. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'payments_not_configured' }, 501);
  if (nativeReq(req)) return json({ error: 'not_in_app' }, 403);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const b = await req.json().catch(() => ({}));
  if (!isB2BPlan(b.plan)) return json({ error: 'bad_request' }, 400);
  const p = B2B[b.plan as keyof typeof B2B];
  const origin = new URL(req.url).origin;
  const f = new URLSearchParams();
  f.set('mode', 'subscription');
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', 'huf');
  f.set('line_items[0][price_data][unit_amount]', String(p.huf * 100)); // Stripe counts forint in fillér
  f.set('line_items[0][price_data][recurring][interval]', 'month');
  f.set('line_items[0][price_data][product_data][name]', `InkAge ${p.name} – havidíj`);
  f.set('line_items[0][price_data][product_data][description]', `${p.n} tetoválás-előnézet havonta, a fel nem használtak megmaradnak`);
  f.set('client_reference_id', a.user.id);
  for (const [k, v] of Object.entries({ app: 'inkage', kind: 'b2b', user: a.user.id, plan: b.plan })) {
    f.set(`metadata[${k}]`, v);
    f.set(`subscription_data[metadata][${k}]`, v);
  }
  f.set('locale', 'hu');
  if (a.user.email) f.set('customer_email', a.user.email);
  f.set('billing_address_collection', 'required');
  f.set('tax_id_collection[enabled]', 'true');
  f.set('allow_promotion_codes', 'true');
  f.set('payment_method_collection', 'if_required'); // a 100% coupon month needs no card; paid months still ask for one
  f.set('custom_text[submit][message]', 'Havidíjas előfizetés, bármikor lemondható az InkAge-ben (Előfizetés kezelése). A számlát e-mailben kapod.');
  f.set('success_url', `${origin}/szalonoknak?elofizetes=ok`);
  f.set('cancel_url', `${origin}/szalonoknak?elofizetes=megszakitva`);
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('b2b checkout failed', r.status, JSON.stringify(j).slice(0, 300));
    return json({ error: 'stripe_error' }, 502);
  }
  return json({ url: j.url });
}
