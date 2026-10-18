import { NextResponse, type NextRequest } from 'next/server';
import { fromBrowser, isLang } from './lib/tr';

/**
 * Website pages are rendered on the server in the language of ?lang= (Hungarian without it).
 * A visitor who chose another language (cookie) or whose browser speaks one of ours is sent to that version.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.has('lang')) return NextResponse.next();
  const cookie = req.cookies.get('ink_lang')?.value;
  const accept = req.headers.get('accept-language');
  // no preference at all (search engines): keep the Hungarian page
  const want = isLang(cookie) ? cookie : accept ? (/^\s*hu/i.test(accept) ? 'hu' : fromBrowser(accept)) : 'hu';
  if (want === 'hu') return NextResponse.next();
  url.searchParams.set('lang', want);
  return NextResponse.redirect(url, 307);
}

export const config = {
  // website pages only: not the app, the API, files or the vote links
  matcher: ['/((?!api|app|_next|v/|admin|offline|.*\\..*).*)'],
};
