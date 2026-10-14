import { appSecret, json, userClient } from '@/lib/server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Sign up for the monthly guides e-mail (double opt-in). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const lang = b.lang === 'en' ? 'en' : 'hu';
  const { data, error } = await userClient().rpc('newsletter_subscribe', { p_secret: appSecret('db'), p_email: String(b.email || '').trim(), p_lang: lang });
  const r = data as { ok: boolean; token?: string; confirmed?: boolean } | null;
  if (error || !r?.ok) return json({ error: lang === 'hu' ? 'Ez nem tűnik e-mail-címnek.' : 'That doesn’t look like an e-mail address.' }, 400);
  if (r.confirmed) return json({ ok: true, state: 'already' });
  const link = `${SITE()}/api/newsletter?confirm=${r.token}`;
  const hu = lang === 'hu';
  const sent = await sendMail(
    String(b.email).trim(),
    hu ? 'Erősítsd meg a feliratkozást – InkAge' : 'Confirm your subscription – InkAge',
    layout({
      title: hu ? 'Még egy kattintás' : 'One more click',
      lines: [hu ? 'Havonta egyszer küldünk egy új útmutatót arról, hogyan marad szép a tetoválás. Ha te iratkoztál fel, erősítsd meg:' : 'Once a month we send a new guide on keeping tattoos looking good. If this was you, please confirm:'],
      button: { href: link, label: hu ? 'Feliratkozás megerősítése' : 'Confirm subscription' },
      foot: hu ? 'Ha nem te voltál, hagyd figyelmen kívül ezt a levelet.' : 'If this wasn’t you, just ignore this e-mail.',
    }),
    `${hu ? 'Megerősítés' : 'Confirm'}: ${link}`
  );
  return json({ ok: true, state: sent ? 'confirm' : 'saved' });
}

/** Confirm or unsubscribe from the link in the e-mail. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const confirm = u.searchParams.get('confirm');
  const unsub = u.searchParams.get('unsub');
  const token = (confirm || unsub || '').slice(0, 64);
  const { data } = await userClient().rpc('newsletter_set', { p_secret: appSecret('db'), p_token: token, p_action: confirm ? 'confirm' : 'unsub' });
  const status = !data ? 'invalid' : confirm ? 'confirmed' : 'unsubscribed';
  return Response.redirect(`${u.origin}/hirlevel?status=${status}`, 302);
}
