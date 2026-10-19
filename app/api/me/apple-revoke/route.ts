import crypto from 'crypto';
import { getAuthed, json } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/* Sign in with Apple token revocation on account deletion (App Store guideline 5.1.1(v)).
   Needs a Sign in with Apple key: APPLE_SIWA_KEY_P8 + APPLE_SIWA_KEY_ID (falls back to the APNs key when that
   key also has Sign in with Apple enabled), APPLE_TEAM_ID and APPLE_SIWA_CLIENT_ID (the Services ID Supabase uses). */
const b64u = (s: string) => Buffer.from(s).toString('base64url');

function clientSecret(clientId: string) {
  const key = (process.env.APPLE_SIWA_KEY_P8 || process.env.APNS_KEY_P8 || '').replace(/\\n/g, '\n');
  const kid = process.env.APPLE_SIWA_KEY_ID || process.env.APNS_KEY_ID;
  if (!key || !kid) return null;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid }));
  const claim = b64u(JSON.stringify({ iss: process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID || 'BVM9R6J6D3', iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claim}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${claim}.${sig}`;
}

export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Sign in first.' }, 401);
  const { data } = await a.db.from('apple_tokens').select('refresh_token').eq('user_id', a.user.id).maybeSingle();
  const token = data?.refresh_token as string | undefined;
  if (!token) return json({ ok: true, revoked: false, reason: 'no_token' });

  let revoked = false;
  const ids = [process.env.APPLE_SIWA_CLIENT_ID || 'app.inkage.web', 'app.inkage'];
  for (const clientId of Array.from(new Set(ids))) {
    let secret: string | null = null;
    try {
      secret = clientSecret(clientId);
    } catch {
      secret = null;
    }
    if (!secret) break;
    const res = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: secret, token, token_type_hint: 'refresh_token' }),
    }).catch(() => null);
    if (res?.ok) {
      revoked = true;
      break;
    }
  }
  await a.db.from('apple_tokens').delete().eq('user_id', a.user.id);
  return json({ ok: true, revoked });
}
