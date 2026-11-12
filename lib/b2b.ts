/* B2B monthly plans for tattoo studios and laser clinics (2026-11-12). Prices in forint, no VAT (the seller is exempt).
   Every paid month adds its previews to the account (unused ones roll over); the trial adds 20 for 14 days.
   The database keeps the same counts (public.pay_plan_credits): change both together. Client-safe. */
export type B2BPlan = 'b2b_studio' | 'b2b_pro' | 'b2b_clinic';
export const B2B_PLANS: B2BPlan[] = ['b2b_studio', 'b2b_pro', 'b2b_clinic'];
export const B2B: Record<B2BPlan, { name: string; huf: number; n: number; who: string }> = {
  b2b_studio: { name: 'Szalon', huf: 9900, n: 40, who: '1–2 tetováló' },
  b2b_pro: { name: 'Szalon Pro', huf: 19900, n: 120, who: 'nagyobb szalon, több tetováló' },
  b2b_clinic: { name: 'Klinika', huf: 29900, n: 150, who: 'lézeres eltávolítás: 3, 6, 10 kezelés' },
};
export const isB2BPlan = (x: unknown): x is B2BPlan => typeof x === 'string' && (B2B_PLANS as string[]).includes(x);
export const B2B_TRIAL = { days: 14, n: 20 };
export const huf = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n)} Ft`;
