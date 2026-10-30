import { isAdmin } from '@/lib/admin/server';
import { sendMail } from '@/lib/mail';
import { signupEmail } from '@/lib/mail-signup';
import { welcomeEmail } from '@/lib/mail-welcome';
import { photoReminderEmail, previewReadyEmail } from '@/lib/mail-lifecycle';
import { careEmail, launchEmail, voteEmail } from '@/lib/mail-engage';
import { anniversaryEmail, limitEmail, newsletterConfirmEmail, newsletterEmail } from '@/lib/mail-more';
import { monthGuides } from '@/lib/mail-guides';

export const dynamic = 'force-dynamic';

const notice = () =>
  signupEmail({ name: 'Próba Anna', email: 'proba.anna@example.com', lang: 'hu', country: 'HU', provider: 'google', createdAt: new Date().toISOString(), userId: '00000000-teszt', source: 'tiktok.com', count: 7 });
const welcome = () => welcomeEmail('Viktória', 'hu');
const ready = () => previewReadyEmail('hu', '00000000-0000-0000-0000-000000000000');
const photo = () => photoReminderEmail('hu', 'https://inkage.app/api/mail-off');
const O = 'https://inkage.app';
const vote = () => voteEmail('hu', { share: 'minta', image: `${O}/email/reminder-v2.jpg`, votes: { yes: 7, no: 1, change: 2 } });
const care = () => careEmail('hu', new Date().toISOString().slice(0, 10));
const launch = () => launchEmail('hu', { ios: `${O}/telepites`, play: 'https://play.google.com/store/apps/details?id=app.inkage', unsubscribe: `${O}/api/mail-off` });
const OFF = `${O}/api/mail-off`;
const reached = () => limitEmail('hu', { kind: 'reached', used: 30, limit: 30, resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1, 12).toISOString() });
const restart = () => limitEmail('hu', { kind: 'restart', limit: 30, unsubscribe: OFF });
const anniv = () => anniversaryEmail('hu', '00000000-0000-0000-0000-000000000000', OFF);
const guide = () => { const g = monthGuides('hu')!; return newsletterEmail('hu', g.main, g.more, OFF); };
const confirm = () => newsletterConfirmEmail('hu', `${O}/hirlevel`, OFF);
const ALL = { notice, welcome, ready, photo, vote, care, launch, reached, restart, anniv, guide, confirm };

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
