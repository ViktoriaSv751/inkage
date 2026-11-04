import crypto from 'crypto';

/* Sign in with Apple client secret (a short-lived ES256 JWT), signed with the Sign in with Apple key:
   APPLE_SIWA_KEY_P8 + APPLE_SIWA_KEY_ID (falls back to the APNs key when that key also has Sign in with Apple),
   APPLE_TEAM_ID. Server only. */
const b64u = (s: string) => Buffer.from(s).toString('base64url');

export function appleClientSecret(clientId: string): string | null {
  const key = (process.env.APPLE_SIWA_KEY_P8 || process.env.APNS_KEY_P8 || '').replace(/\\n/g, '\n');
  const kid = process.env.APPLE_SIWA_KEY_ID || process.env.APNS_KEY_ID;
  if (!key || !kid) return null;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid }));
  const claim = b64u(JSON.stringify({ iss: process.env.APPLE_TEAM_ID || process.env.APNS_TEAM_ID || 'BVM9R6J6D3', iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claim}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${claim}.${sig}`;
}
