import { appSecret, json, signToken, userClient } from '@/lib/server';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { logServerError } from '@/lib/errlog';
import { mailReady, SITE, sendMail } from '@/lib/mail';
import { photoReminderEmail, previewReadyEmail } from '@/lib/mail-lifecycle';
import { isLang, type Lang } from '@/lib/tr';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Due = { id: string; email: string; lang: string | null };

/** Every 10 minutes from the database's cron (with its token): the e-mails that depend on time passing. */
export async function GET(req: Request) {
  const tok = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  const ok = tok && (await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_cron_ok`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: tok }), cache: 'no-store' }).then((r) => r.json()).catch(() => false));
  if (ok !== true) return new Response('Not found', { status: 404 });
  if (!mailReady()) return json({ ok: false, error: 'no mail key' });
  const secret = appSecret('db');
  const db = userClient();
  const { data, error } = await db.rpc('mail_due', { p_secret: secret });
  if (error) return json({ ok: false, error: error.message }, 500);
  const langOf = (l: string | null): Lang => (isLang(l) ? l : 'hu');
  const reply = process.env.CONTACT_EMAIL || undefined;
  const res = { ready: 0, photo: 0, failed: 0 };
  const mark = (kind: string, id: string) => db.rpc('mail_mark', { p_secret: secret, p_kind: kind, p_id: id }).then(() => {}, () => {});
  for (const r of ((data as any)?.ready || []) as Due[]) {
    const m = previewReadyEmail(langOf(r.lang), r.id);
    if (await sendMail(r.email, m.subject, m.html, m.text, reply, `ready-${r.id}`)) ((res.ready += 1), await mark('ready', r.id));
    else res.failed += 1;
  }
  for (const r of ((data as any)?.photo || []) as Due[]) {
    const off = `${SITE()}/api/mail-off?t=${encodeURIComponent(signToken({ uid: r.id, off: 1, exp: Date.now() + 365 * 864e5 }))}`;
    const m = photoReminderEmail(langOf(r.lang), off);
    const headers = { 'List-Unsubscribe': `<${off}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    if (await sendMail(r.email, m.subject, m.html, m.text, reply, `photo-${r.id}`, headers)) ((res.photo += 1), await mark('photo', r.id));
    else res.failed += 1;
  }
  if (res.failed) await logServerError('mail_cron', new Error(`${res.failed} timed e-mail(s) could not be sent`));
  return json({ ok: true, ...res });
}
