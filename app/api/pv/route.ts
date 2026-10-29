import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { appSecret, userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/* Anonymous page views for the owner's dashboard, for every visitor (also before or without the cookie choice):
   no cookie, nothing stored on the device, no IP kept. The visit is a hash of the IP, the browser and a salt that
   changes every day, so the same visitor is one visit for a day and cannot be followed from one day to the next.
   It also says where the visit came from (the first page's utm tags, ?ref, the referring site, the in-app browser).
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
  const props: Record<string, unknown> = { sid, path: cut(b.path, 200) || '/', lang: cut(b.lang, 8), src, pv: 1 };
  const ia = cut(b.ia, 20);
  if (ia) props.ia = ia;
  else props.pf = 'web';
  const country = req.headers.get('x-vercel-ip-country');
  if (country && /^[A-Z]{2}$/.test(country)) props.cc = country;
  await userClient().rpc('log_event', { p_name: 'page_view', p_anon: null, p_props: props }).then(() => {}, () => {});
  return NextResponse.json({ sid });
}
