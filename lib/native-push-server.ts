import crypto from 'crypto';
import http2 from 'http2';

/* Store-app push: FCM HTTP v1 (Android) and APNs (iOS), with keys from environment variables:
   FCM_SERVICE_ACCOUNT  – the Firebase service-account JSON (whole file contents)
   APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID (default BVM9R6J6D3), APNS_TOPIC (default app.inkage), APNS_SANDBOX=1 for TestFlight/dev builds */

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export type NativeMsg = { title: string; body: string; url: string; tag?: string };
export type SendResult = 'ok' | 'gone' | 'error';

let fcmTok: { t: string; exp: number } | null = null;
async function fcmAccess(sa: { client_email: string; private_key: string }) {
  if (fcmTok && fcmTok.exp > Date.now() + 60_000) return fcmTok.t;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claim}`), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('fcm auth failed');
  fcmTok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmTok.t;
}

export async function sendFcm(token: string, m: NativeMsg): Promise<SendResult> {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return 'error';
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await fcmAccess(sa)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: { url: m.url },
        android: { priority: 'HIGH', ttl: '86400s', notification: { tag: m.tag, channel_id: 'default', icon: 'ic_stat_inkage', color: '#E0483B' } },
      },
    }),
  });
  if (r.ok) return 'ok';
  const txt = await r.text();
  return r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*token/i.test(txt) ? 'gone' : 'error';
}

let apnsJwt: { t: string; at: number } | null = null;
function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.at < 45 * 60_000) return apnsJwt.t;
  const key = (process.env.APNS_KEY_P8 || '').replace(/\\n/g, '\n');
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }));
  const claim = b64u(JSON.stringify({ iss: process.env.APNS_TEAM_ID || 'BVM9R6J6D3', iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claim}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  apnsJwt = { t: `${head}.${claim}.${sig}`, at: Date.now() };
  return apnsJwt.t;
}

export function sendApns(token: string, m: NativeMsg): Promise<SendResult> {
  if (!process.env.APNS_KEY_P8 || !process.env.APNS_KEY_ID) return Promise.resolve('error');
  const host = process.env.APNS_SANDBOX === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  return new Promise((resolve) => {
    const c = http2.connect(host);
    c.on('error', () => resolve('error'));
    const req = c.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${apnsToken()}`,
      'apns-topic': process.env.APNS_TOPIC || 'app.inkage',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
      ...(m.tag ? { 'apns-collapse-id': m.tag.slice(0, 64) } : {}),
    });
    let status = 0, body = '';
    req.on('response', (h) => (status = Number(h[':status'])));
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      c.close();
      resolve(status === 200 ? 'ok' : status === 410 || /BadDeviceToken|Unregistered/.test(body) ? 'gone' : 'error');
    });
    req.on('error', () => {
      c.close();
      resolve('error');
    });
    req.end(JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: 'default', 'thread-id': m.tag }, url: m.url }));
  });
}
