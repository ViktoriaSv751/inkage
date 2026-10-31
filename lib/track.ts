'use client';
// For the public pages: their first JavaScript stays without the Supabase client, which arrives after the page has loaded.

/** Same as track() in lib/store, which is loaded the first time something is counted. */
export function track(name: string, props: Record<string, unknown> = {}) {
  import('./store').then((m) => m.track(name, props)).catch(() => {});
}

/** A tap on a sign-up button, counted like a page view: no cookie, nothing stored, no stats choice needed (see app/api/pv). */
export function countCta(btn: string, article?: string) {
  try {
    const w = window as any;
    if (/InkAgeApp/.test(navigator.userAgent) || w.Capacitor?.isNativePlatform?.()) return;
    if (!/(^|\.)inkage\.app$/.test(location.hostname)) return;
    fetch('/api/pv', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ev: 'cta', btn, article, path: location.pathname, lang: document.documentElement.lang, ...w.__inkSrc }),
    }).catch(() => {});
  } catch {}
}

/** Runs fn shortly after the page has finished loading; returns a function that cancels it. */
export function afterLoad(fn: () => void) {
  let t: ReturnType<typeof setTimeout>;
  const go = () => (t = setTimeout(fn, 300));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
  return () => {
    clearTimeout(t);
    window.removeEventListener('load', go);
  };
}
