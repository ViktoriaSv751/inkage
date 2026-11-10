/* Server-side payment helpers. Secrets only from Vercel env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
   The database is reached with the anon key plus the db secret (appSecret('db')), no service key needed. */
import { appSecret, userClient } from './server';
import { PLAN, type PlanId } from './pricing';

export const priceCents = (p: PlanId) => Math.round(PLAN[p].usd * 100);
export const planTitle = (p: PlanId) => `InkAge ${PLAN[p].name}: ${PLAN[p].n} tattoo previews`;

/** The iOS / Android app: its fetches carry x-ink-app (lib/sb.ts) and come from a WebView. The database only believes
    it together with the db secret, so a browser can't claim it; a forged header gets the old 30 a month at most. */
export function nativeReq(req: Request) {
  const app = req.headers.get('x-ink-app');
  if (app !== 'ios' && app !== 'android') return false;
  // a store build that sells packages is counted like the website (no free monthly previews), 2026-11-10
  if (req.headers.get('x-ink-bill') === '1') return false;
  const ua = req.headers.get('user-agent') || '';
  return /; wv\)/.test(ua) || (/AppleWebKit/.test(ua) && !/Safari\//.test(ua));
}
/** the extra arguments every counting RPC takes */
export const payArgs = (req: Request) => (nativeReq(req) ? { p_native: true, p_key: appSecret('db') } : {});

async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await userClient().rpc(fn, { p_key: appSecret('db'), ...args });
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** a paid checkout: adds the package's previews once per transaction */
export const grantPurchase = (a: { user: string; store: 'stripe' | 'apple' | 'google'; tx: string; plan: PlanId; amount?: number; currency?: string; meta?: Record<string, unknown> }) =>
  rpc('pay_grant', { p_user: a.user, p_store: a.store, p_tx: a.tx, p_plan: a.plan, p_amount: a.amount ?? null, p_currency: a.currency ?? null, p_meta: a.meta ?? {} });
export const recordRefund = (store: 'stripe', tx: string, amount?: number) => rpc('pay_refund', { p_store: store, p_tx: tx, p_amount: amount ?? null });
export const recordPayEvent = (row: Record<string, unknown>) => rpc('pay_event', { p_row: row });

/** the Checkout Session a payment belongs to (purchases keep the session id; a refund names the payment) */
export async function stripeSessionOf(paymentIntent: string): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions?limit=1&payment_intent=${encodeURIComponent(paymentIntent)}`, { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { data?: { id?: string }[] } | null;
  return j?.data?.[0]?.id ?? null;
}

/** a browser in two words ("iPhone Safari"), for the admin's Bevétel pages */
export function deviceOf(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'egyéb';
  const br = /FBAN|FBAV|Instagram|TikTok|musical_ly|BytedanceWebview/.test(ua) ? 'appon belül' : /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'böngésző';
  return `${os} ${br}`;
}

/** Stripe signs each webhook: HMAC-SHA256 of "<timestamp>.<raw body>" with the endpoint secret */
export async function stripeSignatureOk(raw: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && same(s, hex));
}
function same(a: string, b: string) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
