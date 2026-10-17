import { appSecret, json, userClient } from '@/lib/server';
import { pushToUser } from '@/lib/push-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Called by the database every minute while reminders are due (header x-secret). */
export async function POST(req: Request) {
  const secret = appSecret('db');
  if (!secret || req.headers.get('x-secret') !== secret) return json({ ok: false }, 401);
  const { data, error } = await userClient().rpc('push_due', { p_secret: secret });
  if (error) return json({ ok: false, error: error.message }, 500);
  const due = (data || []) as { id: string; user_id: string; title: string; body: string; url: string }[];
  let sent = 0;
  for (const r of due) sent += await pushToUser(r.user_id, { title: r.title, body: r.body, url: r.url, tag: r.id });
  return json({ ok: true, due: due.length, sent });
}
