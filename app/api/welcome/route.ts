import { tx, isLang, type Lang } from '@/lib/tr';
import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Once per account: a short welcome with what to try first. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ ok: false }, 401);
  const { data: email } = await userClient().rpc('welcome_once', { p_secret: appSecret('db'), p_user: a.user.id });
  if (!email) return json({ ok: true, sent: false });
  const rl = (await req.json().catch(() => ({}))).lang;
  const lang: Lang = isLang(rl) ? rl : 'hu';
  const name = String((a.user.user_metadata as any)?.full_name || '').split(' ')[0];
  const sent = await sendMail(
    email as string,
    tx(lang, 'Welcome to InkAge', 'Üdv az InkAge-ben'),
    layout({
      title: name ? tx(lang, `Welcome, ${name}!`, `Üdv, ${name}!`) : tx(lang, 'Welcome!', 'Üdv!'),
      lines: [
        tx(lang, 'Your designs are now on every device you use.', 'A terveid most már minden eszközödön megvannak.'),
        tx(lang, 'Three things worth trying: two sizes on the same spot, the “Make it last” redraw, and a vote link for your friends.', 'Három dolog, amit érdemes kipróbálni: két különböző méret ugyanazon a helyen, a „Tedd tartóssá” átrajzolás, és egy szavazós link a barátaidnak.'),
        tx(lang, 'Everything is free after sign-up. If something doesn’t work, just reply to this e-mail.', 'Regisztráció után minden ingyenes. Ha bármi nem működik, válaszolj erre a levélre.'),
      ],
      button: { href: `${SITE()}/app`, label: tx(lang, 'Make a preview', 'Új előnézet készítése') },
    }),
    tx(lang, `Welcome to InkAge! ${SITE()}/app`, `Üdv az InkAge-ben! ${SITE()}/app`),
    process.env.CONTACT_EMAIL || undefined
  );
  return json({ ok: true, sent });
}
