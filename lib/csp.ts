/* Content Security Policy for every page (set by middleware.ts, 2026-11-16, PageSpeed "CSP effective against XSS").
   Scripts run only with this request's nonce ('strict-dynamic' lets those scripts load Next's chunks); 'unsafe-inline'
   and https: are ignored by browsers that understand nonces and only keep very old browsers working.
   The site loads no third-party scripts: Google / Apple sign-in and Stripe work by redirect.
   The app (/app) and the dashboard also allow eval: the HEIC photo converter (heic2any) compiles code in a worker.
   Trusted Types are required on the website pages; the default policy is created first thing in app/layout.tsx. */

export function makeNonce() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export function cspFor(pathname: string, nonce: string) {
  const app = /^\/(app|admin)(\/|$)/.test(pathname);
  const embed = /^\/embed(\/|$)/.test(pathname);
  const dev = process.env.NODE_ENV !== 'production';
  const script = [`'nonce-${nonce}'`, `'strict-dynamic'`, 'https:', `'unsafe-inline'`, ...(app || dev ? [`'unsafe-eval'`, `'wasm-unsafe-eval'`] : [])];
  return [
    `script-src ${script.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `worker-src 'self' blob:`,
    // other sites may iframe only the embeddable pain map
    ...(embed ? [] : [`frame-ancestors 'self'`]),
    // not in the app: heic2any's blob worker inherits the policy and has no Trusted Types policy of its own
    ...(app ? [] : [`require-trusted-types-for 'script'`]),
  ].join('; ');
}
