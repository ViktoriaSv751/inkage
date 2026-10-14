import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { layout, mailReady, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Admin: tell the waitlist that previews are open again. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  const admins = (process.env.ADMIN_EMAILS || 'vviktoriasoti@gmail.com').toLowerCase().split(',').map((x) => x.trim());
  if (!a || !admins.includes((a.user.email || '').toLowerCase())) return json({ error: 'forbidden' }, 403);
  if (!mailReady()) return json({ error: 'E-mail is not set up (RESEND_API_KEY).' }, 503);
  const { data } = await userClient().rpc('waitlist_take', { p_secret: appSecret('db'), p_limit: 100 });
  const list = (data as { email: string; lang: string | null }[]) || [];
  let sent = 0;
  for (const w of list) {
    const hu = w.lang !== 'en';
    const ok = await sendMail(
      w.email,
      hu ? 'Újra lehet előnézetet készíteni – InkAge' : 'Previews are open again – InkAge',
      layout({ title: hu ? 'Újra mehet!' : 'We’re back!', lines: [hu ? 'Ahogy ígértük, szólunk: az előnézetek újra elérhetők.' : 'As promised: previews are available again.'], button: { href: `${SITE()}/app`, label: hu ? 'Kipróbálom' : 'Try it' } }),
      `${SITE()}/app`
    );
    if (ok) sent++;
  }
  return json({ ok: true, sent, more: list.length === 100 });
}
