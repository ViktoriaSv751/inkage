import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Once per account: a short welcome with what to try first. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ ok: false }, 401);
  const { data: email } = await userClient().rpc('welcome_once', { p_secret: appSecret('db'), p_user: a.user.id });
  if (!email) return json({ ok: true, sent: false });
  const hu = (await req.json().catch(() => ({}))).lang !== 'en';
  const name = String((a.user.user_metadata as any)?.full_name || '').split(' ')[0];
  const sent = await sendMail(
    email as string,
    hu ? 'Üdv az InkAge-ben' : 'Welcome to InkAge',
    layout({
      title: hu ? `Üdv${name ? `, ${name}` : ''}!` : `Welcome${name ? `, ${name}` : ''}!`,
      lines: hu
        ? ['A terveid most már minden eszközödön megvannak.', 'Három dolog, amit érdemes kipróbálni: két különböző méret ugyanazon a helyen, a „Tedd tartóssá” átrajzolás, és egy szavazós link a barátaidnak.', 'A béta alatt minden ingyenes. Ha bármi nem működik, válaszolj erre a levélre.']
        : ['Your designs are now on every device you use.', 'Three things worth trying: two sizes on the same spot, the “Make it last” redraw, and a vote link for your friends.', 'Everything is free during the beta. If something doesn’t work, just reply to this e-mail.'],
      button: { href: `${SITE()}/app`, label: hu ? 'Új előnézet készítése' : 'Make a preview' },
    }),
    hu ? `Üdv az InkAge-ben! ${SITE()}/app` : `Welcome to InkAge! ${SITE()}/app`,
    process.env.CONTACT_EMAIL || undefined
  );
  return json({ ok: true, sent });
}
