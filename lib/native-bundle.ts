'use client';
/* Only in the store apps' bundled copy of the app screens (NEXT_PUBLIC_NATIVE_BUNDLE):
   - calls to /api/... go to the website;
   - links to pages that are not bundled (guides, articles, shared posts, legal pages) open from the website in an
     in-app browser sheet, so the person never lands on a missing page. */
import { BUNDLED_PATH, NATIVE_BUNDLE, SITE_URL } from './site';

let done = false;
export function setupNativeBundle() {
  if (!NATIVE_BUNDLE || done || typeof window === 'undefined') return;
  done = true;

  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) input = SITE_URL + input;
    else if (input instanceof URL && input.origin === location.origin && input.pathname.startsWith('/api/')) input = new URL(input.pathname + input.search, SITE_URL);
    return orig(input as any, init);
  };

  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (/^(mailto:|tel:|#|javascript:)/i.test(href)) return;
      const u = new URL(href, location.href);
      const local = u.origin === location.origin;
      if (local && BUNDLED_PATH.test(u.pathname)) return;
      const remote = local ? SITE_URL + u.pathname + u.search + u.hash : u.href;
      if (/^https?:/i.test(remote)) {
        e.preventDefault();
        e.stopPropagation();
        openRemote(remote);
      }
    },
    true
  );
}

export async function openRemote(url: string) {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.open(url, '_blank');
  }
}

/** A full page load inside the bundle starts at the app's index page: send it on to the address it asked for. */
export function wantedPath(): string | null {
  if (!NATIVE_BUNDLE || typeof location === 'undefined') return null;
  return location.pathname + location.search + location.hash;
}
