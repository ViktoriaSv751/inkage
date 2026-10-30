import { isAdmin } from '@/lib/admin/server';
import { sendMail } from '@/lib/mail';
import { signupEmail } from '@/lib/mail-signup';
import { welcomeEmail } from '@/lib/mail-welcome';
import { photoReminderEmail, previewReadyEmail } from '@/lib/mail-lifecycle';

export const dynamic = 'force-dynamic';

const notice = () =>
  signupEmail({ name: 'Próba Anna', email: 'proba.anna@example.com', lang: 'hu', country: 'HU', provider: 'google', createdAt: new Date().toISOString(), userId: '00000000-teszt', source: 'tiktok.com', count: 7 });
const welcome = () => welcomeEmail('Viktória', 'hu');
const ready = () => previewReadyEmail('hu', '00000000-0000-0000-0000-000000000000');
const photo = () => photoReminderEmail('hu', 'https://inkage.app/api/mail-off');
const ALL = { notice, welcome, ready, photo };

/** Owner only: how the e-mails look (GET ?k=welcome) and a real test of them (POST ?k=ready,photo). */
export async function GET(req: Request) {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const k = new URL(req.url).searchParams.get('k') as keyof typeof ALL;
  const m = (ALL[k] || notice)();
  return new Response(m.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST(req: Request) {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.ALERT_EMAIL;
  if (!to) return Response.json({ ok: false, error: 'no recipient' });
  const out: Record<string, boolean> = {};
  for (const k of (new URL(req.url).searchParams.get('k') || 'notice,welcome').split(',') as (keyof typeof ALL)[]) {
    if (!ALL[k]) continue;
    const m = ALL[k]();
    out[k] = await sendMail(to, `[MINTA] ${m.subject}`, m.html, m.text);
  }
  return Response.json(out);
}
