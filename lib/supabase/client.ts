'use client';
/* The admin dashboard's browser client is the app's own one (lib/sb), so the owner's app sign-in also opens /admin.
   While she is signed in, her access token is also kept in a cookie for /api/admin only: the platforms' sign-in
   redirects (TikTok, Instagram…) come back to /api/admin/callback without the page's Authorization header. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sb } from '../sb';

let watching = false;
function keepCookie(c: SupabaseClient) {
  if (watching) return;
  watching = true;
  const set = (tok: string | null | undefined) => {
    try {
      document.cookie = tok
        ? `ink_adm=${tok}; path=/api/admin; max-age=3600; samesite=lax; secure`
        : 'ink_adm=; path=/api/admin; max-age=0';
    } catch {}
  };
  c.auth.getSession().then(({ data }) => set(data.session?.access_token), () => {});
  c.auth.onAuthStateChange((_e, s) => set(s?.access_token));
}

export function supabaseBrowser(): SupabaseClient | null {
  const c = sb();
  if (c && typeof window !== 'undefined') keepCookie(c);
  return c;
}
