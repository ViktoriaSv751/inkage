import { json, stripeApply } from '@/lib/server';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return json({ error: `Webhook error: ${e.message}` }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s: any = event.data.object;
        const user = s.client_reference_id || s.metadata?.user_id || null;
        if (s.metadata?.plan === 'lifetime' && s.payment_status === 'paid') {
          await stripeApply({ user, customer: s.customer, plan: 'lifetime' });
        } else if (s.metadata?.plan === 'weekly') {
          await stripeApply({ user, customer: s.customer, plan: 'weekly', until: new Date(Date.now() + 8 * 864e5).toISOString() });
        }
        break;
      }
      case 'invoice.paid': {
        const inv: any = event.data.object;
        const meta = inv.parent?.subscription_details?.metadata || inv.subscription_details?.metadata || {};
        const end = Math.max(0, ...(inv.lines?.data || []).map((l: any) => l.period?.end || 0));
        const until = new Date(end ? (end + 86400) * 1000 : Date.now() + 8 * 864e5).toISOString();
        await stripeApply({ user: meta.user_id || null, customer: inv.customer, plan: 'weekly', until });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub: any = event.data.object;
        await stripeApply({ user: sub.metadata?.user_id || null, customer: sub.customer, plan: 'free' });
        break;
      }
      case 'charge.refunded': {
        const ch: any = event.data.object;
        if (ch.refunded) await stripeApply({ customer: ch.customer, plan: 'refund' });
        break;
      }
    }
  } catch (e: any) {
    console.error('webhook apply failed', e);
    return json({ error: 'apply failed' }, 500);
  }
  return json({ received: true });
}
