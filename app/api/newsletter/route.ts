import { tx, isLang, type Lang } from '@/lib/tr';
import { appSecret, json, userClient } from '@/lib/server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Sign up for the monthly guides e-mail (double opt-in). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const lang: Lang = isLang(b.lang) ? b.lang : 'hu';
  const { data, error } = await userClient().rpc('newsletter_subscribe', { p_secret: appSecret('db'), p_email: String(b.email || '').trim(), p_lang: lang });
  const r = data as { ok: boolean; token?: string; confirmed?: boolean; send?: boolean } | null;
  if (error || !r?.ok) return json({ error: tx(lang, 'That doesn’t look like an e-mail address.', 'Ez nem tűnik e-mail-címnek.') }, 400);
  if (r.confirmed) return json({ ok: true, state: 'already' });
  if (!r.send) return json({ ok: true, state: 'confirm' }); // a confirmation mail just went out
  const link = `${SITE()}/api/newsletter?confirm=${r.token}`;
  const unsub = `${SITE()}/api/newsletter?unsub=${r.token}`;
  const sent = await sendMail(
    String(b.email).trim(),
    tx(lang, 'Confirm your subscription – InkAge', 'Erősítsd meg a feliratkozást – InkAge'),
    layout({
      title: tx(lang, 'One more click', 'Még egy kattintás'),
      lines: [tx(lang, 'Once a month we send a new guide on keeping tattoos looking good. If this was you, please confirm:', 'Havonta egyszer küldünk egy új útmutatót arról, hogyan marad szép a tetoválás. Ha te iratkoztál fel, erősítsd meg:')],
      button: { href: link, label: tx(lang, 'Confirm subscription', 'Feliratkozás megerősítése') },
      foot: tx(lang, `If this wasn’t you, just ignore this e-mail. Unsubscribe: ${unsub}`, `Ha nem te voltál, hagyd figyelmen kívül ezt a levelet. Leiratkozás: ${unsub}`),
    }),
    `${tx(lang, 'Confirm', 'Megerősítés')}: ${link}`
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
