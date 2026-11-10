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

/** The store apps say so on every call: until store billing exists they keep the old monthly previews and see no
    prices (the server believes it only from a WebView, lib/pay.ts nativeReq). */
export function appHeader(): Record<string, string> {
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
  if (!cap?.isNativePlatform?.()) return {};
  const p = cap.getPlatform?.();
  if (p !== 'ios' && p !== 'android') return {};
  // a build that can sell (App Store / Google Play purchases): counted like the website, packages and all (2026-11-10)
  return cap.isPluginAvailable?.('NativePurchases') ? { 'x-ink-app': p, 'x-ink-bill': '1' } : { 'x-ink-app': p };
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
      headers: { 'content-type': 'application/json', ...(await authHeader()), ...appHeader() },
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
  // "choose a package": the app opens the packages wherever the call came from (AppProvider)
  if (res.status === 402 && (data?.code === 'paywall' || data?.code === 'locked') && typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('ink:paywall', { detail: data.code === 'locked' ? 'locked' : /api\/(design|improve|extract|model-photo)/.test(path) ? 'helper' : 'previews' }));
  return { ok: res.ok, status: res.status, data };
}
