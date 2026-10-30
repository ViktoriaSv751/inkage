'use client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC } from './public-config';

let c: SupabaseClient | null | undefined;
export function sb(): SupabaseClient | null {
  if (c !== undefined) return c;
  if (process.env.NEXT_PUBLIC_STATIC_DEMO) return (c = null);
  const url = PUBLIC.supabaseUrl;
  const key = PUBLIC.supabaseAnonKey;
  c = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;
  // keep Apple's refresh token after an Apple sign-in, so deleting the account can revoke it (App Store 5.1.1(v))
  c?.auth.onAuthStateChange((evt, session) => {
    const rt = (session as any)?.provider_refresh_token as string | undefined;
    if (evt === 'SIGNED_IN' && rt && session?.user && c)
      import('./apple-token').then((m) => m.saveAppleToken(c!, session.user.id, rt)).catch(() => {});
  });
  return c;
}

export async function authHeader(): Promise<Record<string, string>> {
  const s = sb();
  if (!s) return {};
  const { data } = await s.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function api<T = any>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  if (typeof window !== 'undefined') {
    const m = await import('./ai-consent');
    if (m.AI_PATHS.test(path) && !(await m.askAiConsent())) {
      const { tx, isLang } = await import('./tr');
      const l = document.documentElement.lang;
      const error = tx(isLang(l) ? l : 'en', 'To make a preview, allow sending your photo to our AI providers.', 'Az előnézethez engedélyezned kell, hogy a fotódat elküldjük az MI-szolgáltatóinknak.');
      return { ok: false, status: 0, data: { code: 'ai_consent', error } as any };
    }
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, data: { error: 'No connection. Check your internet and try again.' } as any };
  }
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = { error: res.status === 504 ? 'The server took too long. Please try again.' : 'Network error' };
  }
  return { ok: res.ok, status: res.status, data };
}
