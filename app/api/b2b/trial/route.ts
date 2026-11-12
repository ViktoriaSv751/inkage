import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { sendMail } from '@/lib/mail';
import { PUBLIC } from '@/lib/public-config';
import { b2bMail } from '@/lib/b2b-mail';

export const dynamic = 'force-dynamic';

/* The 14-day trial (20 previews, no card), one per account; the owner gets an e-mail about it. */
export async function POST(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const b = await req.json().catch(() => ({}));
  const company = String(b.company || '').trim().slice(0, 120);
  if (!company) return json({ error: 'Add the name of the studio or clinic.' }, 400);
  const { data, error } = await a.db.rpc('b2b_trial_start', { p_company: company });
  if (error) return json({ error: 'Could not start the trial. Try again.' }, 500);
  if (!data?.ok) return json({ ok: false, reason: data?.reason, status: data?.status }, 409);
  await userClient().rpc('b2b_lead_add', { p_company: company, p_name: '', p_email: a.user.email || '', p_phone: String(b.phone || '').slice(0, 40), p_kind: String(b.kind || 'studio'), p_plan: 'trial', p_message: 'Próba elindítva az oldalon (státusz: proba)', p_ref: String(b.ref || '').slice(0, 60) }).then(() => {}, () => {});
  await b2bMail('trial_welcome', a.user.id).catch(() => 'failed');
  await userClient().rpc('b2b_lead_progress', { p_key: appSecret('db'), p_email: a.user.email || '', p_status: 'proba' }).then(() => {}, () => {});
  const to = process.env.CONTACT_EMAIL || process.env.ALERT_EMAIL || PUBLIC.contactEmail;
  await sendMail(to, `Szalon-próba indult: ${company}`, `<p><b>${company.replace(/</g, '&lt;')}</b> elindította a 14 napos próbát (20 előnézet).</p><p>Fiók: ${a.user.email || a.user.id}${b.ref ? `<br>Levél: ${String(b.ref).replace(/</g, '&lt;')}` : ''}</p>`, `${company} elindította a 14 napos próbát. Fiók: ${a.user.email || a.user.id}`, a.user.email || undefined).catch(() => false);
  return json({ ok: true, trialEndsAt: data.trial_ends_at });
}
