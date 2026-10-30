import { appSecret, json, signToken, userClient } from '@/lib/server';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { logServerError } from '@/lib/errlog';
import { mailReady, SITE, sendMail } from '@/lib/mail';
import { photoReminderEmail, previewReadyEmail } from '@/lib/mail-lifecycle';
import { anniversaryEmail, limitEmail, newsletterEmail } from '@/lib/mail-more';
import { monthGuides } from '@/lib/mail-guides';
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
  const res = { ready: 0, photo: 0, restart: 0, anniv: 0, guide: 0, failed: 0 };
  const offLink = (uid: string) => `${SITE()}/api/mail-off?t=${encodeURIComponent(signToken({ uid, off: 1, exp: Date.now() + 365 * 864e5 }))}`;
  const unsubHeaders = (off: string) => ({ 'List-Unsubscribe': `<${off}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
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
  for (const r of ((data as any)?.restart || []) as Due[]) {
    const off = offLink(r.id);
    const m = limitEmail(langOf(r.lang), { kind: 'restart', limit: 30, unsubscribe: off });
    if (await sendMail(r.email, m.subject, m.html, m.text, reply, `restart-${r.id}-${new Date().toISOString().slice(0, 7)}`, unsubHeaders(off))) ((res.restart += 1), await mark('restart', r.id));
    else res.failed += 1;
  }
  for (const r of ((data as any)?.anniv || []) as (Due & { user: string })[]) {
    const off = offLink(r.user);
    const m = anniversaryEmail(langOf(r.lang), r.id, off);
    if (await sendMail(r.email, m.subject, m.html, m.text, reply, `anniv-${r.id}`, unsubHeaders(off))) ((res.anniv += 1), await mark('anniv', r.id));
    else res.failed += 1;
  }
  // the monthly guide: on the 1st, from 9:00 in Budapest
  const bud = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', day: 'numeric', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const dayNow = Number(bud.find((p) => p.type === 'day')?.value), hourNow = Number(bud.find((p) => p.type === 'hour')?.value);
  if (dayNow === 1 && hourNow >= 9) {
    const { data: subs } = await db.rpc('newsletter_due', { p_secret: secret });
    for (const r of (subs || []) as { email: string; lang: string | null; token: string }[]) {
      const lang = langOf(r.lang);
      const g = monthGuides(lang) || monthGuides('en');
      if (!g) break;
      const off = `${SITE()}/api/newsletter?unsub=${r.token}`;
      const m = newsletterEmail(lang, g.main, g.more, off);
      if (await sendMail(r.email, m.subject, m.html, m.text, reply, `guide-${r.token}-${new Date().toISOString().slice(0, 7)}`, unsubHeaders(off))) ((res.guide += 1), await mark('guide', r.email));
      else res.failed += 1;
    }
  }
  if (res.failed) await logServerError('mail_cron', new Error(`${res.failed} timed e-mail(s) could not be sent`));
  return json({ ok: true, ...res });
}
