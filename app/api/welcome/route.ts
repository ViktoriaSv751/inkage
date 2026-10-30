import { isLang, type Lang } from '@/lib/tr';
import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { mailReady, sendMail } from '@/lib/mail';
import { logServerError } from '@/lib/errlog';
import { signupEmail } from '@/lib/mail-signup';
import { welcomeEmail } from '@/lib/mail-welcome';

export const dynamic = 'force-dynamic';

/** Once per account: the welcome e-mail, and a notice to the owner. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ ok: false }, 401);
  const { data: email } = await userClient().rpc('welcome_once', { p_secret: appSecret('db'), p_user: a.user.id });
  if (!email) return json({ ok: true, sent: false });
  const b = await req.json().catch(() => ({}));
  const lang: Lang = isLang(b.lang) ? b.lang : 'hu';
  const md = (a.user.user_metadata || {}) as any;
  const fullName = String(md.full_name || md.name || md.display_name || '').trim();
  // the first name: Hungarian names start with the family name
  const parts = fullName.split(/\s+/).filter(Boolean);
  const name = String(md.given_name || (lang === 'hu' ? parts[parts.length - 1] : parts[0]) || '');
  // where they came from, if they accepted usage stats
  const src = b.src && typeof b.src === 'object' ? b.src : {};
  const source = String(src.us || src.from || src.ref || '').slice(0, 60);
  // the owner hears about every new account (the key keeps a retried welcome from sending it twice)
  const notify = process.env.ADMIN_NOTIFY_EMAIL || process.env.ALERT_EMAIL;
  if (notify) {
    const { data: count } = await userClient().rpc('signup_count', { p_secret: appSecret('db') }).then((r) => r, () => ({ data: null }));
    const n = signupEmail({ name: fullName, email: email as string, lang, country: req.headers.get('x-vercel-ip-country') || '', provider: String(a.user.app_metadata?.provider || 'email'), createdAt: a.user.created_at, userId: a.user.id, source, count: typeof count === 'number' ? count : null });
    const told = await sendMail(notify, n.subject, n.html, n.text, email as string, `signup-${a.user.id}`);
    if (!told) await logServerError('signup_notice', new Error('new sign-up notice could not be sent'));
  }
  const w = welcomeEmail(name, lang);
  const sent = await sendMail(email as string, w.subject, w.html, w.text, process.env.CONTACT_EMAIL || undefined);
  if (!sent) {
    // shows up in the dashboard's errors; with a key set, the next app open tries again
    await logServerError('welcome', new Error(mailReady() ? 'welcome e-mail could not be sent' : 'welcome e-mail not sent: no RESEND_API_KEY'));
    if (mailReady()) await userClient().rpc('welcome_undo', { p_secret: appSecret('db'), p_user: a.user.id });
  }
  return json({ ok: true, sent });
}
