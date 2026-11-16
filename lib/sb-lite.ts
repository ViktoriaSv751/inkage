'use client';
/* Website pages only need two things from Supabase: "is someone signed in?" and one public RPC (the preview counter).
   Loading supabase-js (~34 KB) for that was flagged by PageSpeed as unused JavaScript, so this reads the session that
   supabase-js itself keeps in localStorage and calls the RPC over plain fetch. The app (/app), sign-in and payments
   keep using lib/sb. */
import { PUBLIC } from './public-config';

const ref = (() => {
  try {
    return new URL(PUBLIC.supabaseUrl).hostname.split('.')[0];
  } catch {
    return '';
  }
})();
/** supabase-js v2 default storage key */
export const SESSION_KEY = `sb-${ref}-auth-token`;

/** True when supabase-js has a stored session that can still be used or refreshed. */
export function hasSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const sess = s?.currentSession || s;
    return !!(sess?.refresh_token || (sess?.access_token && (sess.expires_at || 0) * 1000 > Date.now()));
  } catch {
    return false;
  }
}

/** An OAuth / e-mail link landed on this page: only supabase-js can turn it into a session. */
export function authReturnInUrl(): boolean {
  try {
    return /access_token=|refresh_token=|error_description=/.test(location.hash) || /[?&](code|error_description)=/.test(location.search);
  } catch {
    return false;
  }
}

/** The stored access token while it is still valid (supabase-js refreshes it when the app is open). */
function userToken(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const sess = s?.currentSession || s;
    return sess?.access_token && (sess.expires_at || 0) * 1000 > Date.now() + 30_000 ? sess.access_token : null;
  } catch {
    return null;
  }
}

/** Calls a Postgres function over plain fetch: as anon, or (asUser) with the visitor's own valid session. */
export async function rpcLite<T = unknown>(name: string, args: Record<string, unknown> = {}, asUser = false): Promise<T | null> {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO) return null;
  try {
    const bearer = (asUser && userToken()) || PUBLIC.supabaseAnonKey;
    const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
