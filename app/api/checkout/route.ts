import { getAuthed, json, quota, serverConfig } from '@/lib/server';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cfg = serverConfig();
  if (!cfg.payments || !cfg.auth) return json({ error: 'Payments open very soon. Check back shortly.' }, 503);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in first.', code: 'auth' }, 401);
  const { plan } = await req.json().catch(() => ({}));
  if (plan !== 'weekly' && plan !== 'lifetime') return json({ error: 'Bad plan' }, 400);

  const q = await quota(a.db);
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const session = await stripe().checkout.sessions.create({
    ...(q.stripe_customer_id ? { customer: q.stripe_customer_id } : { customer_email: a.user.email ?? undefined }),
    ...(plan === 'lifetime' && !q.stripe_customer_id ? { customer_creation: 'always' as const } : {}),
    client_reference_id: a.user.id,
    mode: plan === 'weekly' ? 'subscription' : 'payment',
    line_items: [{ price: plan === 'weekly' ? process.env.STRIPE_PRICE_WEEKLY! : process.env.STRIPE_PRICE_LIFETIME!, quantity: 1 }],
    metadata: { user_id: a.user.id, plan },
    ...(plan === 'weekly' ? { subscription_data: { metadata: { user_id: a.user.id } } } : {}),
    allow_promotion_codes: true,
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/?canceled=1`,
  });
  return json({ url: session.url });
}
