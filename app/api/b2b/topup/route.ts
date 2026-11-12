import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { B2B_TOPUP } from '@/lib/b2b';
import { nativeReq } from '@/lib/pay';

export const dynamic = 'force-dynamic';

/* +20 previews for a studio between refills (one-time Stripe Checkout payment, metadata plan=b2b_topup: the webhook's
   one-time path adds them and records the Billingo invoice). Only for studios (a b2b_subs row). Web only. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'payments_not_configured' }, 501);
  if (nativeReq(req)) return json({ error: 'not_in_app' }, 403);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const { data: cur } = await userClient().rpc('b2b_billing_of', { p_key: appSecret('db'), p_user: a.user.id });
  if (!cur || !['trial', 'trial_ended', 'active', 'past_due', 'canceled'].includes(cur.status)) return json({ error: 'not_a_studio' }, 403);
  const origin = new URL(req.url).origin;
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', 'huf');
  f.set('line_items[0][price_data][unit_amount]', String(B2B_TOPUP.huf * 100));
  f.set('line_items[0][price_data][product_data][name]', `InkAge kiegészítő csomag – ${B2B_TOPUP.n} előnézet`);
  f.set('line_items[0][price_data][product_data][description]', 'Egyszeri, nem újul meg. Az előnézetek nem járnak le.');
  f.set('client_reference_id', a.user.id);
  for (const [k, v] of Object.entries({ app: 'inkage', kind: 'b2b_topup', user: a.user.id, plan: B2B_TOPUP.id, company: cur.company || '', tax: cur.tax || '' })) if (v) f.set(`metadata[${k}]`, v);
  f.set('locale', 'hu');
  f.set('payment_method_types[0]', 'card'); // card only: no Stripe Link SMS step for studios
  if (cur.customer) f.set('customer', String(cur.customer));
  else {
    if (a.user.email) f.set('customer_email', a.user.email);
    f.set('customer_creation', 'always');
  }
  f.set('billing_address_collection', 'required');
  f.set('tax_id_collection[enabled]', 'true');
  f.set('invoice_creation[enabled]', 'false');
  f.set('success_url', `${origin}/szalonoknak?kiegeszito=ok`);
  f.set('cancel_url', `${origin}/szalonoknak#kiegeszito`);
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('b2b topup failed', r.status, JSON.stringify(j).slice(0, 300));
    return json({ error: 'stripe_error' }, 502);
  }
  return json({ url: j.url });
}
