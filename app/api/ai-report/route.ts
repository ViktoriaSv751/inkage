import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { pushToUser } from '@/lib/push-server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** "Report inappropriate content" on one of your own AI results (required by Google Play's AI-generated content policy).
 *  Saved for review (with a small thumbnail) and the admins are told right away. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Sign in to continue.' }, 401);
  const b = await req.json().catch(() => ({}));
  const secret = appSecret('db');
  if (!secret) return json({ error: 'Not available' }, 500);
  const { data, error } = await userClient().rpc('report_ai', {
    p_secret: secret,
    p_user: a.user.id,
    p_ref: String(b.ref || '').slice(0, 80) || null,
    p_reason: String(b.reason || 'other').slice(0, 20),
    p_note: b.note ? String(b.note).slice(0, 500) : null,
    p_thumb: typeof b.thumb === 'string' ? b.thumb : null,
  });
  if (error) return json({ error: /limit/.test(error.message) ? 'You sent a lot of reports today. Try again tomorrow.' : 'Could not send. Try again.' }, /limit/.test(error.message) ? 429 : 500);
  const admins = (data || []) as { id: string; email: string }[];
  for (const ad of admins) {
    await pushToUser(ad.id, { title: 'InkAge: MI-eredmény jelentve', body: `Ok: ${b.reason || 'egyéb'}. Nézd át 24 órán belül.`, url: '/admin', tag: 'ai-report' }).catch(() => 0);
    await sendMail(
      ad.email,
      'InkAge: jelentett MI-eredmény',
      layout({ title: 'Jelentett MI-eredmény', lines: [`Ok: ${b.reason || 'egyéb'}`, b.note ? `Megjegyzés: ${String(b.note).slice(0, 300)}` : 'Megjegyzés nélkül.', 'A kép kicsinyített változata az admin felületen látható.'], button: { href: `${SITE()}/admin`, label: 'Admin felület' }, foot: '' }),
      `${SITE()}/admin`
    ).catch(() => false);
  }
  return json({ ok: true });
}
