import { isAdmin } from '@/lib/admin/server';
import { sendMail } from '@/lib/mail';
import { signupEmail } from '@/lib/mail-signup';
import { welcomeEmail } from '@/lib/mail-welcome';

export const dynamic = 'force-dynamic';

const notice = () =>
  signupEmail({ name: 'Próba Anna', email: 'proba.anna@example.com', lang: 'hu', country: 'HU', provider: 'google', createdAt: new Date().toISOString(), userId: '00000000-teszt', source: 'tiktok.com', count: 7 });
const welcome = () => welcomeEmail('Viktória', 'hu');

/** Owner only: how the new sign-up notice and the welcome e-mail look (GET ?k=welcome) and a real test of both (POST). */
export async function GET(req: Request) {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const m = new URL(req.url).searchParams.get('k') === 'welcome' ? welcome() : notice();
  return new Response(m.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST() {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.ALERT_EMAIL;
  if (!to) return Response.json({ ok: false, error: 'no recipient' });
  const n = notice(), w = welcome();
  return Response.json({ notice: await sendMail(to, `[MINTA] ${n.subject}`, n.html, n.text), welcome: await sendMail(to, `[MINTA] ${w.subject}`, w.html, w.text) });
}
