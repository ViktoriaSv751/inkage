import { getAuthed, json, userClient } from '@/lib/server';
import { layout, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** Contact form + in-app feedback: stored, then forwarded to the team by e-mail. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const message = String(b.message || '').trim().slice(0, 2000);
  if (message.length < 3) return json({ error: 'Write a little more, please.' }, 400);
  const kind = ['bug', 'idea', 'question', 'other'].includes(b.kind) ? b.kind : 'other';
  const email = String(b.email || '').trim().slice(0, 200);
  const a = await getAuthed(req);
  const db = a?.db || userClient();
  const { data, error } = await db.rpc('send_feedback', { p_kind: kind, p_message: message, p_email: email || a?.user.email || '', p_anon: String(b.anon || '').slice(0, 64), p_page: String(b.page || '').slice(0, 200) });
  if (error || !data) return json({ error: 'Too many messages in a short time. Try again later.' }, 429);
  const to = process.env.CONTACT_EMAIL || process.env.ALERT_EMAIL;
  const from = email || a?.user.email || '';
  if (to) {
    const label = { bug: 'Hiba', idea: 'Ötlet', question: 'Kérdés', other: 'Üzenet' }[kind as 'bug'];
    await sendMail(to, `InkAge – ${label}${from ? ` (${from})` : ''}`, layout({ title: `${label} érkezett`, lines: [message, from ? `Válaszcím: ${from}` : 'Nem adott meg e-mail-címet.', `Oldal: ${b.page || '-'}`] }), `${message}\n\nFrom: ${from || '-'}\nPage: ${b.page || '-'}`, from || undefined);
  }
  return json({ ok: true });
}
