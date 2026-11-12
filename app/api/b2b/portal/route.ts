import { appSecret, getAuthed, json, userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/* "Előfizetés kezelése": Stripe's customer portal (cancel, card, invoices). Needs the portal permission on the key. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'payments_not_configured' }, 501);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const { data: customer } = await userClient().rpc('b2b_customer', { p_key: appSecret('db'), p_user: a.user.id });
  if (!customer) return json({ error: 'no_subscription' }, 404);
  const f = new URLSearchParams({ customer: String(customer), return_url: `${new URL(req.url).origin}/szalonoknak`, locale: 'hu' });
  const r = await fetch('https://api.stripe.com/v1/billing_portal/sessions', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('b2b portal failed', r.status, JSON.stringify(j).slice(0, 300));
    return json({ error: 'stripe_error' }, 502);
  }
  return json({ url: j.url });
}
