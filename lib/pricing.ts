/* InkAge packages (owner, 2026-11-07). Pay once, no subscription, the same dollar price in every country.
   A package adds previews; a preview is one tattoo on one photo with all its years (1, 10, 30, 50) or laser sessions.
   Measured cost (2026-11-07): ~$0.17 a preview on average, $0.31 at worst (retry + 4 years + 3 laser images), so every
   package keeps money in the worst case, even as a store sale with VAT and the store's cut.
   The database holds its own copy of the counts (public.pay_plan_credits): change both together.
   Client-safe: no secrets here. */

export type PlanId = 'mini' | 'plus' | 'studio';
export const PLANS: PlanId[] = ['mini', 'plus', 'studio'];
export const PLAN: Record<PlanId, { n: number; usd: number; name: string }> = {
  mini: { n: 5, usd: 4.99, name: 'Mini' },
  plus: { n: 15, usd: 11.99, name: 'Plus' },
  studio: { n: 40, usd: 27.99, name: 'Studio' },
};
/** the package shown as the best choice */
export const BEST: PlanId = 'plus';
export const isPlan = (x: unknown): x is PlanId => typeof x === 'string' && (PLANS as string[]).includes(x);

/* THE switch for the web: NEXT_PUBLIC_PAYMENTS=stripe (baked in at build time, so a change needs a redeploy).
   The database switch (admin_settings 'pay' live) decides who is counted how; both must be on.
   The store apps never show prices or packages until store billing exists (Apple 3.1.1). */
export const webPaymentsOn = process.env.NEXT_PUBLIC_PAYMENTS === 'stripe';

/** "$4.99" with the decimal mark of the language ("$4,99" in Hungarian). */
export function fmtUsd(n: number, locale = 'en-GB') {
  try {
    return '$' + new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(n);
  } catch {
    return '$' + n.toFixed(2);
  }
}
