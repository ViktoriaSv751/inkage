import { isAdmin } from '@/lib/admin/server';
import { sendMail } from '@/lib/mail';
import { signupEmail } from '@/lib/mail-signup';

export const dynamic = 'force-dynamic';

const sample = () =>
  signupEmail({ name: 'Próba Anna', email: 'proba.anna@example.com', lang: 'hu', country: 'HU', provider: 'google', createdAt: new Date().toISOString(), userId: '00000000-teszt' });

/** Owner only: how the new sign-up notice looks (GET) and a real test of it (POST). */
export async function GET() {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  return new Response(sample().html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST() {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.ALERT_EMAIL;
  if (!to) return Response.json({ ok: false, error: 'no recipient' });
  const m = sample();
  return Response.json({ ok: await sendMail(to, `[PRÓBA] ${m.subject}`, m.html, m.text) });
}
