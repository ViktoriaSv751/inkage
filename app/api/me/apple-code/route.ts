import { appleClientSecret } from '@/lib/apple-secret';
import { getAuthed, json } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* Native Sign in with Apple in the iOS app: the app sends Apple's one-time authorization code; we swap it for
   Apple's refresh token (client app.inkage) and keep it, so deleting the account can revoke it
   (/api/me/apple-revoke, App Store guideline 5.1.1(v)). */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Sign in first.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 2000) return json({ error: 'Missing code.' }, 400);
  const clientId = 'app.inkage';
  const secret = appleClientSecret(clientId);
  if (!secret) return json({ ok: true, saved: false, reason: 'no_key' });
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' }),
  }).catch(() => null);
  const data = res ? ((await res.json().catch(() => ({}))) as { refresh_token?: string }) : {};
  if (!res?.ok || !data.refresh_token) return json({ ok: true, saved: false, reason: 'exchange_failed', status: res?.status ?? 0 });
  const { error } = await a.db
    .from('apple_tokens')
    .upsert({ user_id: a.user.id, refresh_token: data.refresh_token, updated_at: new Date().toISOString() });
  return json({ ok: true, saved: !error });
}
