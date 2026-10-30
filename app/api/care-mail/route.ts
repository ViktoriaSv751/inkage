import { getAuthed, json } from '@/lib/server';
import { logServerError } from '@/lib/errlog';
import { sendMail } from '@/lib/mail';
import { careEmail } from '@/lib/mail-engage';
import { isLang, type Lang } from '@/lib/tr';

export const dynamic = 'force-dynamic';

/** The healing plan by e-mail, to the signed-in person, once they say when they had the tattoo done. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a?.user.email || a.user.email.endsWith('@inkage.invalid')) return json({ ok: false }, 401);
  const b = await req.json().catch(() => ({}));
  const date = String(b.date || '');
  const at = Date.parse(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !at || Math.abs(at - Date.now()) > 400 * 864e5) return json({ ok: false }, 400);
  const lang: Lang = isLang(b.lang) ? b.lang : 'hu';
  const m = careEmail(lang, date);
  // the key: tapping twice on the same date sends one
  const sent = await sendMail(a.user.email, m.subject, m.html, m.text, process.env.CONTACT_EMAIL || undefined, `care-${a.user.id}-${date}`);
  if (!sent) await logServerError('care_mail', new Error('healing plan e-mail could not be sent'));
  return json({ ok: true, sent });
}
