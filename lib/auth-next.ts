'use client';

/**
 * Where to go after signing in: the app page that asked for it (?next=/app/…, or remembered before a Google / Apple /
 * e-mail round trip), else the designer – a new account landing in an empty gallery was a dead end.
 */
const KEY = 'ink_next';

export function nextFromUrl(): string | null {
  try {
    const n = new URLSearchParams(location.search).get('next');
    return n && /^\/app(\/|\?|$)/.test(n) ? n : null;
  } catch {
    return null;
  }
}

export function rememberNext(to: string | null) {
  try {
    if (to) localStorage.setItem(KEY, JSON.stringify({ to, at: Date.now() }));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function takeNext(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    localStorage.removeItem(KEY);
    if (v?.to && /^\/app(\/|\?|$)/.test(v.to) && Date.now() - v.at < 30 * 60e3) return v.to;
  } catch {}
  return null;
}

/** The page keeps the chosen language (the next page would otherwise follow the browser's language). */
export function withLang(to: string, lang: string) {
  return /[?&]lang=/.test(to) ? to : `${to}${to.includes('?') ? '&' : '?'}lang=${lang}`;
}
