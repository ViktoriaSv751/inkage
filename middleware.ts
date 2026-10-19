import { NextResponse, type NextRequest } from 'next/server';
import { fromBrowser, isLang } from './lib/tr';

/**
 * Website pages are rendered on the server in the language of ?lang= (Hungarian without it).
 * A visitor who chose another language (cookie) or whose browser speaks one of ours is sent to that version.
 * Every page also gets the language in a request header, so the layout can ship that language's words.
 */
// the store apps carry their own copy of the app screens and call the API from these origins
const APP_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost', 'ionic://localhost']);

function cors(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  if (!APP_ORIGINS.has(origin)) return req.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  const h = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': req.headers.get('access-control-request-headers') || 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: h });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (url.pathname.startsWith('/api/')) return cors(req);
  // the old address moves to the new domain (pages only; the API and app-link files keep working on both)
  if ((req.headers.get('host') || '').startsWith('inkage.vercel.app')) {
    const to = new URL(url.pathname + url.search, 'https://inkage.app');
    return NextResponse.redirect(to, 308);
  }
  const cookie = req.cookies.get('ink_lang')?.value;
  const app = /^\/(app|v|admin|offline)(\/|$)/.test(url.pathname);
  const q = url.searchParams.get('lang');
  if (!app && !q) {
    const accept = req.headers.get('accept-language');
    // no preference at all (search engines): keep the Hungarian page
    const want = isLang(cookie) ? cookie : accept ? (/^\s*hu/i.test(accept) ? 'hu' : fromBrowser(accept)) : 'hu';
    if (want !== 'hu') {
      url.searchParams.set('lang', want);
      return NextResponse.redirect(url, 307);
    }
  }
  const lang = isLang(q) ? q : app && isLang(cookie) ? cookie : app ? fromBrowser(req.headers.get('accept-language')) : 'hu';
  const headers = new Headers(req.headers);
  headers.set('x-ink-lang', lang);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)', '/api/:path*'],
};
