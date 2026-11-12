import { json, userClient } from '@/lib/server';
import { sendMail } from '@/lib/mail';
import { PUBLIC } from '@/lib/public-config';

export const dynamic = 'force-dynamic';

/* A studio or clinic asks for a 2-week trial of a monthly plan (inkage.app/szalonoknak): saved in public.b2b_leads and
   sent to the owner at once, with the asker as reply-to. */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // a bot filled the hidden field
  const f = {
    company: String(b.company || '').slice(0, 120),
    name: String(b.name || '').slice(0, 80),
    email: String(b.email || '').trim().slice(0, 160),
    phone: String(b.phone || '').slice(0, 40),
    kind: ['studio', 'clinic', 'other'].includes(b.kind) ? b.kind : 'other',
    plan: ['studio', 'pro', 'clinic'].includes(b.plan) ? b.plan : '',
    message: String(b.message || '').slice(0, 1500),
    ref: String(b.ref || '').slice(0, 60),
  };
  const { data, error } = await userClient().rpc('b2b_lead_add', {
    p_company: f.company, p_name: f.name, p_email: f.email, p_phone: f.phone, p_kind: f.kind, p_plan: f.plan, p_message: f.message, p_ref: f.ref,
  });
  if (error || !data?.ok) return json({ ok: false, error: data?.reason === 'bad' ? 'Add the business name and a valid e-mail.' : 'Try again a little later.' }, 400);
  const to = process.env.CONTACT_EMAIL || process.env.ALERT_EMAIL || PUBLIC.contactEmail;
  const rows = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#888;padding:2px 12px 2px 0">${k}</td><td>${esc(String(v))}</td></tr>`).join('');
  await sendMail(to, `Új szalon-érdeklődő: ${f.company}`, `<p>Próbahozzáférést kér az InkAge havidíjas csomagjához:</p><table>${rows}</table><p>Válaszolj erre a levélre, és a kérőnek megy.</p>`, Object.entries(f).map(([k, v]) => `${k}: ${v}`).join('\n'), f.email).catch(() => false);
  return json({ ok: true });
}
