import { tx, isLang, type Lang } from '@/lib/tr';
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
    const lang: Lang = isLang(w.lang) ? w.lang : 'hu';
    const ok = await sendMail(
      w.email,
      tx(lang, 'Previews are open again – InkAge', 'Újra lehet előnézetet készíteni – InkAge'),
      layout({ title: tx(lang, 'We’re back!', 'Újra mehet!'), lines: [tx(lang, 'As promised: previews are available again.', 'Ahogy ígértük, szólunk: az előnézetek újra elérhetők.')], button: { href: `${SITE()}/app`, label: tx(lang, 'Try it', 'Kipróbálom') } }),
      `${SITE()}/app`
    );
    if (ok) sent++;
  }
  return json({ ok: true, sent, more: list.length === 100 });
}
