'use client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let c: SupabaseClient | null | undefined;
export function sb(): SupabaseClient | null {
  if (c !== undefined) return c;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  c = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;
  return c;
}

export async function authHeader(): Promise<Record<string, string>> {
  const s = sb();
  if (!s) return {};
  const { data } = await s.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function api<T = any>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
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
