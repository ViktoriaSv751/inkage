import { tx, isLang, type Lang } from '@/lib/tr';
import { appSecret, json, userClient } from '@/lib/server';
import { sendMail, SITE } from '@/lib/mail';
import { newsletterConfirmEmail } from '@/lib/mail-more';

export const dynamic = 'force-dynamic';

/** Sign up for the monthly guides e-mail (double opt-in). */
export async function POST(req: Request) {
  // the mail app's own one-click unsubscribe
  const oneClick = new URL(req.url).searchParams.get('unsub');
  if (oneClick) {
    await userClient().rpc('newsletter_set', { p_secret: appSecret('db'), p_token: oneClick.slice(0, 64), p_action: 'unsub' });
    return json({ ok: true });
  }
  const b = await req.json().catch(() => ({}));
  const lang: Lang = isLang(b.lang) ? b.lang : 'hu';
  const { data, error } = await userClient().rpc('newsletter_subscribe', { p_secret: appSecret('db'), p_email: String(b.email || '').trim(), p_lang: lang });
  const r = data as { ok: boolean; token?: string; confirmed?: boolean; send?: boolean } | null;
  if (error || !r?.ok) return json({ error: tx(lang, 'That doesn’t look like an e-mail address.', 'Ez nem tűnik e-mail-címnek.') }, 400);
  if (r.confirmed) return json({ ok: true, state: 'already' });
  if (!r.send) return json({ ok: true, state: 'confirm' }); // a confirmation mail just went out
  const link = `${SITE()}/api/newsletter?confirm=${r.token}`;
  const unsub = `${SITE()}/api/newsletter?unsub=${r.token}`;
  const m = newsletterConfirmEmail(lang, link, unsub);
  const sent = await sendMail(String(b.email).trim(), m.subject, m.html, m.text);
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
