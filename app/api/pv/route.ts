import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { appSecret, userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/* Anonymous page views for the owner's dashboard, for every visitor (also before or without the cookie choice):
   no cookie, nothing stored on the device, no IP kept. The visit is a hash of the IP, the browser and a salt that
   changes every day, so the same visitor is one visit for a day and cannot be followed from one day to the next.
   It also says where the visit came from (the first page's utm tags, ?ref, the referring site, the in-app browser).
   A sign-up button tap (ev: 'cta') is counted the same way, in the same visit.
   Robots, link previews and the owner's own devices (inkage_own cookie) are not counted. */
const BOT = /bot\b|bot\/|crawl|spider|slurp|preview|lighthouse|pagespeed|headless|ptst|google-inspectiontool|bingpreview|facebookexternalhit|WhatsApp|curl\/|wget|python|node-fetch|undici|axios|okhttp/i;
const cut = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : undefined);

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua) || /InkAgeApp/.test(ua) || req.cookies.get('inkage_own')?.value === '1') return new NextResponse(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return new NextResponse(null, { status: 204 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const day = new Date().toISOString().slice(0, 10);
  const salt = appSecret('db') || 'inkage';
  const sid = 'pv' + crypto.createHash('sha256').update(`${salt}|${day}|${ip}|${ua}`).digest('hex').slice(0, 30);
  const src = Object.fromEntries(
    Object.entries({ us: cut(b.us, 60), um: cut(b.um, 60), uc: cut(b.uc, 60), ux: cut(b.ux, 60), ref: cut(b.ref, 60), from: cut(b.from, 60), land: cut(b.land, 60), ret: b.ret === '1' ? '1' : undefined }).filter(([, v]) => v)
  );
  const isCta = b.ev === 'cta';
  /* the studio funnel on /szalonoknak (2026-11-12): b2b_view (with the outreach ref), b2b_trial, b2b_checkout, b2b_subscribed, b2b_portal, b2b_change, b2b_topup */
  /* a buying-path step of someone who didn't accept statistics cookies (lib/store.ts FUNNEL): name + plain details, nc=1 */
  const FN = /^(photo_added|design_added|generate_start|generate_done|teaser_shown|teaser_unlock_tap|paywall_open|paywall_hit|paywall_close|plan_pick|checkout_start|why_not|store_purchase)$/;
  const fn = b.ev === 'fn' && typeof b.name === 'string' && FN.test(b.name) ? b.name : null;
  const b2b = typeof b.ev === 'string' && /^b2b_(view|trial|checkout|subscribed|portal|change|topup|contact|faq)$/.test(b.ev) ? b.ev : null;
  const props: Record<string, unknown> = { sid, path: cut(b.path, 200) || '/', lang: cut(b.lang, 8), src };
  if (isCta) Object.assign(props, { cta: 'register', btn: cut(b.btn, 30), article: cut(b.article, 80) });
  else if (fn) {
    const d = (b.d && typeof b.d === 'object' ? b.d : {}) as Record<string, unknown>;
    for (const k of ['why', 'plan', 'secs', 'at', 'reason', 'store']) if (d[k] !== undefined) props[k] = k === 'secs' ? Number(d[k]) || 0 : cut(d[k], 40);
    props.nc = 1;
  } else if (b2b) Object.assign(props, { ref: cut(b.b2bref, 60), plan: cut(b.plan, 20) });
  else props.pv = 1;
  const ia = cut(b.ia, 20);
  if (ia) props.ia = ia;
  else props.pf = 'web';
  const country = req.headers.get('x-vercel-ip-country');
  if (country && /^[A-Z]{2}$/.test(country)) props.cc = country;
  // _sk: sent by our server, so the visitor rate limit for anonymous callers doesn't apply
  await userClient().rpc('log_event', { p_name: fn || b2b || (isCta ? 'cta_click' : 'page_view'), p_anon: null, p_props: { ...props, _sk: appSecret('db') } }).then(() => {}, () => {});
  return NextResponse.json({ sid });
}
