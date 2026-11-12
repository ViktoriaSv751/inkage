import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { B2B, baseOf, intervalOf, isB2BBase, planId, planName, yearHuf, type B2BInterval } from '@/lib/b2b';
import { nativeReq } from '@/lib/pay';

export const dynamic = 'force-dynamic';

/* A plan for a studio or clinic: Stripe Checkout in subscription mode, in forint, monthly or annual (10 months for 12).
   The subscription carries metadata app=inkage kind=b2b so the webhook adds the previews (invoice.paid; annual plans are
   refilled monthly by public.b2b_annual_refill). Company name and tax number are saved first (the invoice needs them).
   One subscription per account: an active one is managed or changed, never bought twice. Web only. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'payments_not_configured' }, 501);
  if (nativeReq(req)) return json({ error: 'not_in_app' }, 403);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const b = await req.json().catch(() => ({}));
  if (!isB2BBase(b.plan)) return json({ error: 'bad_request' }, 400);
  const interval: B2BInterval = b.interval === 'year' ? 'year' : 'month';
  const plan = planId(b.plan, interval);
  const base = baseOf(plan);
  const company = String(b.company || '').trim().slice(0, 120);
  const tax = String(b.tax || '').trim().slice(0, 30);
  if (!company) return json({ error: 'company_required' }, 400);
  if (tax && !/^[0-9A-Za-z\- ]{8,30}$/.test(tax)) return json({ error: 'bad_tax' }, 400);

  await a.db.rpc('b2b_set_billing', { p_company: company, p_tax: tax, p_ref: String(b.ref || '').slice(0, 60) || null });
  const { data: cur } = await userClient().rpc('b2b_billing_of', { p_key: appSecret('db'), p_user: a.user.id });
  if (cur && (cur.status === 'active' || cur.status === 'past_due') && cur.sub) return json({ error: 'already_subscribed' }, 409);

  const p = B2B[base];
  const amount = intervalOf(plan) === 'year' ? yearHuf(base) : p.huf;
  const origin = new URL(req.url).origin;
  const f = new URLSearchParams();
  f.set('mode', 'subscription');
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', 'huf');
  f.set('line_items[0][price_data][unit_amount]', String(amount * 100)); // Stripe counts forint in fillér
  f.set('line_items[0][price_data][recurring][interval]', interval);
  f.set('line_items[0][price_data][product_data][name]', `InkAge ${planName(plan)} – ${interval === 'year' ? 'éves díj' : 'havidíj'}`);
  f.set(
    'line_items[0][price_data][product_data][description]',
    interval === 'year' ? `${p.n} tetoválás-előnézet havonta 12 hónapig (10 hónap áráért), a fel nem használtak megmaradnak` : `${p.n} tetoválás-előnézet havonta, a fel nem használtak megmaradnak`
  );
  f.set('client_reference_id', a.user.id);
  for (const [k, v] of Object.entries({ app: 'inkage', kind: 'b2b', user: a.user.id, plan, company, tax })) {
    if (!v) continue;
    f.set(`metadata[${k}]`, v);
    f.set(`subscription_data[metadata][${k}]`, v);
  }
  f.set('locale', 'hu');
  f.set('payment_method_types[0]', 'card'); // card only: no Stripe Link SMS step for studios
  // a returning studio keeps its Stripe customer (invoices and portal in one place)
  if (cur?.customer) f.set('customer', String(cur.customer));
  else if (a.user.email) f.set('customer_email', a.user.email);
  if (cur?.customer) f.set('customer_update[address]', 'auto'), f.set('customer_update[name]', 'auto');
  f.set('billing_address_collection', 'required');
  f.set('tax_id_collection[enabled]', 'true');
  f.set('allow_promotion_codes', 'true');
  f.set('payment_method_collection', 'if_required'); // a 100% coupon month needs no card; paid months still ask for one
  f.set('consent_collection[terms_of_service]', 'required');
  f.set('custom_text[terms_of_service_acceptance][message]', `Elfogadom az [ÁSZF](${origin}/terms) szalonoknak szóló részét és az [adatfeldolgozói feltételeket](${origin}/szalonoknak/adatfeldolgozas). Vállalkozásként vásárolok.`);
  f.set('custom_text[submit][message]', interval === 'year' ? 'Éves előfizetés, havonta töltődik. Lemondható, a kifizetett év végéig tart. A számlát e-mailben kapod.' : 'Havidíjas előfizetés, bármikor lemondható (Előfizetés kezelése). A számlát e-mailben kapod.');
  f.set('success_url', `${origin}/szalonoknak?elofizetes=ok`);
  f.set('cancel_url', `${origin}/szalonoknak?elofizetes=megszakitva`);
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('b2b checkout failed', r.status, JSON.stringify(j).slice(0, 300));
    // a terms-of-service checkbox needs a terms URL in the Stripe account settings: retry without it rather than fail
    if (/terms_of_service|consent_collection/i.test(JSON.stringify(j))) {
      f.delete('consent_collection[terms_of_service]');
      f.delete('custom_text[terms_of_service_acceptance][message]');
      const r2 = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
      const j2 = await r2.json().catch(() => ({}));
      if (r2.ok && j2.url) return json({ url: j2.url });
    }
    return json({ error: 'stripe_error' }, 502);
  }
  return json({ url: j.url });
}
