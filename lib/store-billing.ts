'use client';
/* In-app purchases in the iOS / Android apps (App Store, Google Play), 2026-11-10: the same three packages as the website.
   Only builds whose native shell carries @capgo/native-purchases can sell (billingReady); older builds on people's phones
   don't, and stay as they were. A purchase is checked with Apple / Google on the server (Supabase function
   verify-purchase), which adds the package's previews to the account, so a new phone gets them back by signing in.
   Ported from Calligra (lib/native.ts there), where the same flow passed App Review. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanId } from './pricing';

const cap = () => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
export const billingReady = () => {
  try {
    const c = cap();
    return !!c?.isNativePlatform?.() && !!c?.isPluginAvailable?.('NativePurchases');
  } catch {
    return false;
  }
};
const storeOf = () => (cap()?.getPlatform?.() === 'ios' ? 'apple' : 'google');

/** one consumable product per package: each purchase adds 5, 15 or 40 previews */
export const PRODUCTS: Record<PlanId, string> = { mini: 'app.inkage.mini', plus: 'app.inkage.plus', studio: 'app.inkage.studio' };
const PLAN_OF: Record<string, PlanId> = Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [v, k as PlanId]));

/** the store's own price strings in the buyer's currency ("4,99 €", "1 990 Ft"); null when the store can't be asked */
export async function storePrices(): Promise<Partial<Record<PlanId, string>> | null> {
  if (!billingReady()) return null;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
    const { products } = await NativePurchases.getProducts({ productIdentifiers: Object.values(PRODUCTS), productType: PURCHASE_TYPE.INAPP });
    const out: Partial<Record<PlanId, string>> = {};
    for (const p of products) {
      const plan = PLAN_OF[p.identifier];
      if (plan) out[plan] = p.priceString;
    }
    return out;
  } catch {
    return null;
  }
}

type Tx = { transactionId?: string; productIdentifier?: string; jwsRepresentation?: string; purchaseToken?: string };
const PENDING = 'inkage.pendingTx';

async function verify(sb: SupabaseClient, tx: Tx, plan: PlanId, lang: string) {
  const { data, error } = await sb.functions.invoke('verify-purchase', {
    body: { store: storeOf(), plan, productId: tx.productIdentifier || PRODUCTS[plan], jws: tx.jwsRepresentation, purchaseToken: tx.purchaseToken, transactionId: tx.transactionId, lang },
  });
  if (error || !data?.ok) throw new Error('verify_failed');
  return data as { ok: true; credits?: number };
}

/** buy one package; resolves once the server has checked it with Apple / Google and added the previews */
export async function buyStore(sb: SupabaseClient, uid: string, plan: PlanId, lang: string) {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const tx = await NativePurchases.purchaseProduct({
    productIdentifier: PRODUCTS[plan],
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
    appAccountToken: uid,
    isConsumable: true,
    autoAcknowledgePurchases: true,
  });
  // kept until the server has confirmed it, so a dropped connection can't lose a paid purchase
  try {
    localStorage.setItem(PENDING, JSON.stringify({ tx, plan }));
  } catch {}
  const r = await verify(sb, tx as Tx, plan, lang);
  try {
    localStorage.removeItem(PENDING);
  } catch {}
  return r;
}

/** "Restore purchases": re-sends a purchase the server hasn't confirmed yet; everything confirmed is on the account */
export async function restoreStore(sb: SupabaseClient, lang: string) {
  if (!billingReady()) return 0;
  let n = 0;
  try {
    const raw = localStorage.getItem(PENDING);
    if (raw) {
      const p = JSON.parse(raw);
      await verify(sb, p.tx, p.plan, lang);
      localStorage.removeItem(PENDING);
      n++;
    }
  } catch {}
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    await NativePurchases.restorePurchases().catch(() => {});
  } catch {}
  return n;
}
