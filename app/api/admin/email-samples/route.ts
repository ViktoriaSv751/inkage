import { isAdmin } from '@/lib/admin/server';
import { sendMail } from '@/lib/mail';
import { SAMPLES } from '@/lib/email-samples';

export const dynamic = 'force-dynamic';

/** Owner only: the welcome e-mail's design samples, to look at (GET ?v=a) and to receive (POST). */
export async function GET(req: Request) {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const v = new URL(req.url).searchParams.get('v') as keyof typeof SAMPLES;
  const s = SAMPLES[v] || SAMPLES.a;
  return new Response(s('Viktória').html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST() {
  if (!(await isAdmin().catch(() => false))) return new Response('Not found', { status: 404 });
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return Response.json({ ok: false });
  const out: Record<string, boolean> = {};
  for (const k of ['a', 'b', 'c'] as const) {
    const m = SAMPLES[k]('Viktória');
    out[k] = await sendMail(to, `[${k.toUpperCase()} minta] ${m.subject}`, m.html, m.text);
  }
  return Response.json(out);
}
