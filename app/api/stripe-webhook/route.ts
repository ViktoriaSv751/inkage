import { json } from '@/lib/server';
import { isPlan, PLAN, type PlanId } from '@/lib/pricing';
import { grantPurchase, planTitle, recordPayEvent, recordRefund, stripeSessionOf, stripeSignatureOk } from '@/lib/pay';
import { addressOk, invoicingOn, recordSale, refundSale } from '@/lib/billingo';
import { sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Stripe calls this (endpoint https://inkage.app/api/stripe-webhook, its own signing secret STRIPE_WEBHOOK_SECRET).
    Events: checkout.session.completed / async_payment_succeeded / expired, payment_intent.payment_failed,
    charge.refunded, charge.dispute.created / closed. The Stripe account also sells Calligra, whose endpoint gets the
    same events: anything without metadata app=inkage is ignored here. Only a correctly signed, paid checkout adds previews. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'not_configured' }, 501);
  const raw = await req.text();
  if (!(await stripeSignatureOk(raw, req.headers.get('stripe-signature'), secret))) return json({ error: 'bad_signature' }, 400);

  const ev = JSON.parse(raw);
  const o = ev.data?.object ?? {};
  if (ev.type === 'charge.refunded') return refunded(o);
  if (ev.type.startsWith('charge.dispute.')) return noted(ev);
  /* a Calligra sale */
  if (o.metadata?.app !== 'inkage') return json({ ok: true, ignored: 'other_app' });
  if (ev.type === 'checkout.session.expired' || ev.type === 'payment_intent.payment_failed') return noted(ev);
  if (ev.type !== 'checkout.session.completed' && ev.type !== 'checkout.session.async_payment_succeeded') return json({ ok: true, ignored: ev.type });
  const s = o;
  /* a 100% coupon finishes as "no_payment_required": nothing charged, the package is still bought */
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return json({ ok: true, unpaid: true });
  const m = s.metadata ?? {};
  if (!isPlan(m.plan) || !m.user) return json({ error: 'bad_metadata' }, 400);
  const plan = m.plan as PlanId;
  const amount = (s.amount_total ?? 0) / 100;
  try {
    await grantPurchase({
      user: m.user, store: 'stripe', tx: String(s.id), plan, amount, currency: s.currency,
      meta: { country: s.customer_details?.address?.country || m.country, coupon: await promoCode(s), discount: (s.total_details?.amount_discount ?? 0) / 100 || null, sess: m.sess, lang: m.lang, device: m.device },
    });
  } catch (e) {
    /* a non-2xx makes Stripe retry later, so a temporary failure doesn't lose the purchase */
    console.error('grant_failed', s.id, String(e));
    return json({ error: 'grant_failed' }, 500);
  }
  if (!invoicingOn()) return json({ ok: true });
  try {
    const c = s.customer_details ?? {};
    const ad = c.address ?? {};
    const tax = (c.tax_ids ?? [])[0];
    const buyer = {
      name: c.business_name || c.name || '',
      email: c.email || s.customer_email || '',
      country: String(ad.country || m.country || 'HU').toUpperCase(),
      postCode: ad.postal_code || '', city: ad.city || '',
      address: [ad.line1, ad.line2, ad.state].filter(Boolean).join(', '),
      taxId: tax?.value || undefined,
    };
    /* tax on the checkout or no address: the owner invoices it by hand instead of an invalid invoice going out */
    const note = (s.total_details?.amount_tax ?? 0) > 0 ? 'tax' : !addressOk(buyer) ? 'address' : undefined;
    if (note === 'address') await missingAddressMail(String(s.id), buyer.email, planTitle(plan), amount, s.currency || 'usd');
    await recordSale({
      session: String(s.id),
      paymentIntent: s.payment_intent ? String(s.payment_intent) : null,
      note,
      sale: { buyer, item: planTitle(plan), plan, comment: '', amount, currency: s.currency || 'usd', paidAt: new Date((ev.created || Date.now() / 1000) * 1000).toISOString() },
    });
  } catch (e) {
    console.error('invoice_record_failed', s.id, String(e));
    return json({ error: 'invoice_record_failed' }, 500);
  }
  return json({ ok: true, previews: PLAN[plan].n });
}

async function refunded(ch: { payment_intent?: string; refunded?: boolean; amount_refunded?: number; amount?: number; metadata?: { app?: string } }) {
  if (!ch.payment_intent) return json({ ok: true });
  /* a charge carries its payment's metadata only sometimes: a Calligra refund simply finds no InkAge row */
  try {
    const session = await stripeSessionOf(String(ch.payment_intent));
    if (session) {
      const r: any = await recordRefund('stripe', session, (ch.amount_refunded ?? 0) / 100 || undefined);
      if (r && r.ok === false) return json({ ok: true, ignored: 'not_inkage' });
    }
  } catch (e) {
    console.error('refund_mark_failed', ch.payment_intent, String(e));
    return json({ error: 'refund_mark_failed' }, 500);
  }
  if (!invoicingOn()) return json({ ok: true });
  try {
    const full = ch.refunded === true || (ch.amount_refunded ?? 0) >= (ch.amount ?? Infinity);
    return json({ ok: true, invoice: await refundSale(String(ch.payment_intent), full) });
  } catch (e) {
    console.error('refund_record_failed', ch.payment_intent, String(e));
    return json({ error: 'refund_record_failed' }, 500);
  }
}

/* the code typed at checkout (a partner's), as the buyer saw it */
async function promoCode(s: { discounts?: { promotion_code?: string | null }[] }) {
  const id = s.discounts?.find((d) => d.promotion_code)?.promotion_code;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!id || !key) return null;
  const r = await fetch(`https://api.stripe.com/v1/promotion_codes/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${key}` } }).catch(() => null);
  const j = r?.ok ? ((await r.json().catch(() => null)) as { code?: string } | null) : null;
  return j?.code || id;
}

/* a left checkout, a declined card, a dispute: written down for the admin's Fizetési hibák page */
async function noted(ev: { id: string; type: string; created?: number; data?: { object?: Record<string, any> } }) {
  const o = ev.data?.object ?? {};
  const m = o.metadata ?? {};
  /* a dispute names only the charge: kept if the payment was ours (InkAge metadata), else ignored */
  if (ev.type.startsWith('charge.dispute.') && !(await isInkagePayment(o.payment_intent))) return json({ ok: true, ignored: 'other_app' });
  const at = new Date((ev.created || Date.now() / 1000) * 1000).toISOString();
  let row: Record<string, unknown>;
  if (ev.type === 'checkout.session.expired')
    row = { kind: 'expired', ref: o.id, at, store: 'stripe', session_id: o.id, user_id: m.user, plan: m.plan, amount: (o.amount_total ?? 0) / 100, currency: o.currency,
      email: o.customer_details?.email || o.customer_email, device: m.device, country: o.customer_details?.address?.country || m.country, detail: { lang: m.lang, sess: m.sess } };
  else if (ev.type === 'payment_intent.payment_failed') {
    const e = o.last_payment_error ?? {};
    row = { kind: 'failed', ref: ev.id, at, store: 'stripe', payment_intent: o.id, user_id: m.user, plan: m.plan, amount: (o.amount ?? 0) / 100, currency: o.currency,
      reason: e.decline_code || e.code || e.type || null, device: m.device, country: m.country, detail: { message: String(e.message || '').slice(0, 200), method: e.payment_method?.type } };
  } else
    row = { kind: ev.type === 'charge.dispute.closed' ? 'dispute_closed' : 'dispute', ref: o.id, at, store: 'stripe', payment_intent: o.payment_intent, amount: (o.amount ?? 0) / 100, currency: o.currency,
      reason: ev.type === 'charge.dispute.closed' ? o.status : o.reason, detail: { status: o.status, due_by: o.evidence_details?.due_by ? new Date(o.evidence_details.due_by * 1000).toISOString() : null, charge: o.charge } };
  try {
    await recordPayEvent(row);
  } catch (e) {
    console.error('pay_event_failed', ev.id, String(e));
    return json({ error: 'pay_event_failed' }, 500);
  }
  return json({ ok: true });
}

async function isInkagePayment(pi?: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!pi || !key) return false;
  const r = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(pi)}`, { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' }).catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) : null;
  return j?.metadata?.app === 'inkage';
}

/* the owner hears at once when a sale waits for the buyer's address */
async function missingAddressMail(session: string, email: string, item: string, amount: number, currency: string) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL;
  if (!to) return;
  const text =
    `Egy InkAge-vásárlásnál hiányzik a vevő neve vagy címe, ezért a számla nem készült el automatikusan.\n\n` +
    `Vásárlás: ${item}, ${amount} ${currency.toUpperCase()}\nVevő e-mail: ${email || 'nincs'}\nStripe: ${session}\n\n` +
    `Teendő: kérd el a vevőtől a nevét és a címét, és állítsd ki a számlát a Billingóban.`;
  await sendMail(to, '🧾 InkAge számla vár: hiányzik a vevő címe', `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`, text, email || undefined, 'inkage-invoice-address-' + session).catch(() => false);
}
