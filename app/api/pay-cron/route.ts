import { json } from '@/lib/server';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { retryInvoices } from '@/lib/billingo';
import { sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Every 10 minutes from the database's cron (with its token): retries invoices that failed, and e-mails the owner
    once about anything that needs a hand (missing address, tax, partial refund, a try failing again and again). */
export async function GET(req: Request) {
  const tok = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  const ok = tok && (await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_cron_ok`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: tok }), cache: 'no-store' }).then((r) => r.json()).catch(() => false));
  if (ok !== true) return new Response('Not found', { status: 404 });
  const { retried, alerts } = await retryInvoices();
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL;
  if (to)
    for (const a of alerts) {
      const text = `${a.title}\n\n${a.body}`;
      /* the same alert key never sends twice (Resend idempotency, 24 h) */
      await sendMail(to, `InkAge: ${a.title}`, `<p>${a.body.replace(/</g, '&lt;')}</p>`, text, undefined, 'inkage-inv-' + a.key.replace(/[^\w:-]/g, '').slice(0, 200)).catch(() => false);
    }
  return json({ ok: true, retried, alerts: alerts.length });
}
