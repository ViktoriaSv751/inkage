/* B2B plans for tattoo studios and laser clinics (2026-11-12). Prices in forint, no VAT (the seller is exempt).
   Every paid month adds its previews to the account (unused ones roll over); the trial adds 20 for 14 days.
   Annual plans (b2b_*_y) cost 10 months for 12 and still refill monthly (public.b2b_annual_refill).
   The top-up (b2b_topup) is a one-time +20 for studios between refills.
   The database keeps the same counts (public.pay_plan_credits): change both together. Client-safe. */
export type B2BBase = 'b2b_studio' | 'b2b_pro' | 'b2b_clinic';
export type B2BPlan = B2BBase | 'b2b_studio_y' | 'b2b_pro_y' | 'b2b_clinic_y';
export type B2BInterval = 'month' | 'year';
export const B2B_PLANS: B2BBase[] = ['b2b_studio', 'b2b_pro', 'b2b_clinic'];
export const B2B: Record<B2BBase, { name: string; huf: number; n: number; seats: number; who: string; whoEn: string }> = {
  b2b_studio: { name: 'Szalon', huf: 9900, n: 40, seats: 1, who: '1 tetováló, 1 belépés', whoEn: '1 artist, 1 login' },
  b2b_pro: { name: 'Szalon Pro', huf: 19900, n: 120, seats: 5, who: 'nagyobb szalon, akár 5 munkatárs', whoEn: 'bigger studio, up to 5 people' },
  b2b_clinic: { name: 'Klinika', huf: 29900, n: 150, seats: 5, who: 'lézeres eltávolítás 3, 6, 10 kezelés, akár 5 munkatárs', whoEn: 'laser removal after 3, 6, 10 sessions, up to 5 people' },
};
/** an annual plan costs 10 months' price and refills monthly */
export const YEAR_MONTHS_PAID = 10;
export const yearHuf = (b: B2BBase) => B2B[b].huf * YEAR_MONTHS_PAID;
export const B2B_TOPUP = { id: 'b2b_topup' as const, n: 20, huf: 5900 };

export const isB2BBase = (x: unknown): x is B2BBase => typeof x === 'string' && (B2B_PLANS as string[]).includes(x);
export const isB2BPlan = (x: unknown): x is B2BPlan => typeof x === 'string' && (isB2BBase(x) || (x.endsWith('_y') && isB2BBase(x.slice(0, -2))));
export const baseOf = (p: B2BPlan): B2BBase => (p.endsWith('_y') ? (p.slice(0, -2) as B2BBase) : (p as B2BBase));
export const intervalOf = (p: B2BPlan): B2BInterval => (p.endsWith('_y') ? 'year' : 'month');
export const planId = (b: B2BBase, i: B2BInterval): B2BPlan => (i === 'year' ? (`${b}_y` as B2BPlan) : b);
/** display name, e.g. "Szalon Pro (éves)" */
export const planName = (p: B2BPlan, en = false) => `${B2B[baseOf(p)].name}${intervalOf(p) === 'year' ? (en ? ' (annual)' : ' (éves)') : ''}`;
export const B2B_TRIAL = { days: 14, n: 20 };
export const huf = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n)} Ft`;
