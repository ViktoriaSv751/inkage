import { getAuthed, json, quota, serverConfig } from '@/lib/server';
import { stripe } from '@/lib/stripe';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!serverConfig().payments) return json({ error: 'Payments are not set up yet.' }, 503);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in.' }, 401);
  const q = await quota(a.db);
  if (!q.stripe_customer_id) return json({ error: 'No purchases found on this account.' }, 404);
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const s = await stripe().billingPortal.sessions.create({ customer: q.stripe_customer_id, return_url: origin });
  return json({ url: s.url });
}
