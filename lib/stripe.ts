import Stripe from 'stripe';
let s: Stripe | null = null;
export function stripe() {
  if (!s) s = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return s;
}
