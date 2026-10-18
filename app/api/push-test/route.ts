import { tx, isLang, type Lang } from '@/lib/tr';
import { getAuthed, json } from '@/lib/server';
import { pushToUser } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

/** Signed-in user: send a test notification to all of their devices. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ ok: false, error: 'auth' }, 401);
  const b = await req.json().catch(() => ({}));
  const lang: Lang = isLang(b.lang) ? b.lang : 'hu';
  const sent = await pushToUser(a.user.id, {
    title: 'InkAge',
    body: tx(lang, 'Notifications work on this device. ✨', 'Az értesítések működnek ezen az eszközön. ✨'),
    url: '/app/profile',
    tag: 'inkage-test',
  });
  return json({ ok: true, sent });
}
