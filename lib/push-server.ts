import webpush from 'web-push';
import { appSecret, userClient } from './server';
import { SITE } from './mail';

export type PushMsg = { title: string; body: string; url?: string; tag?: string };

/** Sends a web push to every active device of a user. Dead subscriptions are switched off. Returns delivered count. */
export async function pushToUser(user: string, msg: PushMsg): Promise<number> {
  const secret = appSecret('db');
  if (!secret || !user) return 0;
  const db = userClient();
  const { data } = await db.rpc('push_targets', { p_secret: secret, p_user: user });
  const t = data as { pub: string | null; priv: string | null; subs: webpush.PushSubscription[] } | null;
  if (!t?.pub || !t.priv || !t.subs?.length) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@inkage.app', t.pub, t.priv);
  const url = msg.url?.startsWith('http') ? msg.url : `${SITE()}${msg.url || '/app'}`;
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url, tag: msg.tag });
  let ok = 0;
  await Promise.all(
    t.subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, payload, { urgency: 'high', TTL: 86400 });
        ok++;
      } catch (e) {
        const x = e as { statusCode?: number; body?: string };
        if (x.statusCode === 404 || x.statusCode === 410 || /VapidPkHashMismatch|BadJwtToken/.test(String(x.body || ''))) {
          await db.rpc('push_drop', { p_secret: secret, p_endpoint: s.endpoint });
        }
      }
    })
  );
  return ok;
}
