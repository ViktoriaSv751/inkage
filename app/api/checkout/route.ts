import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { isPlan, PLAN, webPaymentsOn } from '@/lib/pricing';
import { deviceOf, nativeReq, planTitle, priceCents } from '@/lib/pay';
import { invoicingOn } from '@/lib/billingo';

export const dynamic = 'force-dynamic';

/** Starts a Stripe Checkout for one package. 501 until NEXT_PUBLIC_PAYMENTS=stripe and STRIPE_SECRET_KEY are set in Vercel.
    Never from the store apps (Apple 3.1.1): they have nothing to buy until store billing exists. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !webPaymentsOn) return json({ error: 'payments_not_configured' }, 501);
  if (nativeReq(req)) return json({ error: 'not_in_app' }, 403);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);

  const b = await req.json().catch(() => ({}));
  const plan = b.plan;
  if (!isPlan(plan)) return json({ error: 'bad_request' }, 400);
  /* the waiver box (immediate delivery, the 14-day withdrawal right lost): not ticked, no checkout */
  if (b.consent !== true) return json({ error: 'consent_required' }, 400);
  const lang = String(b.lang || '').replace(/[^\w-]/g, '').slice(0, 8);
  const hu = lang === 'hu';

  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const origin = new URL(req.url).origin;
  const device = deviceOf(req.headers.get('user-agent') || '');
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', 'usd');
  f.set('line_items[0][price_data][unit_amount]', String(priceCents(plan)));
  f.set('line_items[0][price_data][product_data][name]', planTitle(plan));
  f.set('line_items[0][price_data][product_data][description]', hu ? `${PLAN[plan].n} tetoválás-előnézet, mindegyik az összes évvel` : `${PLAN[plan].n} tattoo previews, each with all the years`);
  f.set('client_reference_id', a.user.id);
  f.set('metadata[app]', 'inkage');
  f.set('metadata[user]', a.user.id);
  f.set('metadata[plan]', plan);
  f.set('metadata[country]', country);
  f.set('metadata[device]', device);
  if (lang) f.set('metadata[lang]', lang);
  const sess = String(b.sess || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (sess) f.set('metadata[sess]', sess);
  f.set('payment_intent_data[metadata][app]', 'inkage');
  f.set('payment_intent_data[metadata][user]', a.user.id);
  f.set('payment_intent_data[metadata][plan]', plan);
  f.set('payment_intent_data[metadata][device]', device);
  f.set('payment_intent_data[metadata][country]', country);
  /* the same Stripe account sells Calligra: the bank statement says INKAGE */
  f.set('payment_intent_data[statement_descriptor_suffix]', 'INKAGE');
  /* when the buyer asked for immediate delivery and waived withdrawal: kept with the payment as evidence */
  f.set('metadata[waiver]', new Date().toISOString());
  f.set(
    'custom_text[submit][message]',
    hu
      ? 'Az előnézeteket azonnal megkapod az InkAge-ben. Kérted az azonnali teljesítést, és tudomásul vetted, hogy ezzel elveszíted a 14 napos elállási jogot. Egyszeri fizetés, nincs előfizetés.'
      : 'You get the previews in InkAge right away. You asked for immediate delivery and acknowledged that you lose the 14-day right of withdrawal. One-time payment, no subscription.'
  );
  if (hu) f.set('locale', 'hu');
  if (a.user.email) f.set('customer_email', a.user.email);
  f.set('success_url', `${origin}/app?paid=${plan}`);
  f.set('cancel_url', `${origin}/app?canceled=1`);
  f.set('allow_promotion_codes', 'true');
  /* a Hungarian invoice needs the buyer's name and address (lib/billingo.ts) */
  if (invoicingOn()) {
    f.set('billing_address_collection', 'required');
    f.set('tax_id_collection[enabled]', 'true');
  }

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: f.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('stripe checkout failed', r.status, JSON.stringify(j).slice(0, 300));
    return json({ error: 'stripe_error' }, 502);
  }
  /* the Stripe page opened (2026-11-14): counted on the server, so the funnel shows it for everyone; an unpaid
     page arrives later as checkout.session.expired (pay_noted) */
  await userClient().rpc('log_event', { p_name: 'checkout_open', p_anon: null, p_props: { plan, sess: j.id, _sk: appSecret('db') } }).then(() => {}, () => {});
  return json({ url: j.url });
}
