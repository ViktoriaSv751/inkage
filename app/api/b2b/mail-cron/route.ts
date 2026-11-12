import { appSecret, json, userClient } from '@/lib/server';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { logServerError } from '@/lib/errlog';
import { mailReady, sendMail } from '@/lib/mail';
import { b2bInfo, b2bMail, b2bMailRender, b2bMailSync, b2bOwnerNotice, b2bSample, ownerTo, type B2BInfo, type B2BMailKind } from '@/lib/b2b-mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Every 10 minutes from the database's cron (with its token, like /api/mail-cron): the B2B mails that depend on time
    passing — studio welcome (safety net), trial day 7 and day 12, trial ended (+ the owner's daily digest), yearly
    renewal 3 days ahead, the monthly summary after a refill — and b2bMailSync for subscriptions changed lately, in
    case the webhook's call failed. Each mail goes once (public.b2b_mail_log). Reminders only 8:00–20:00 Budapest time.
    ?test=1 sends every mail with sample data to the owner only, and logs nothing. */
export async function GET(req: Request) {
  const tok = (req.headers.get('authorization') || '').match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  const ok = tok && (await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_cron_ok`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: tok }), cache: 'no-store' }).then((r) => r.json()).catch(() => false));
  if (ok !== true) return new Response('Not found', { status: 404 });
  if (!mailReady()) return json({ ok: false, error: 'no mail key' });
  if (new URL(req.url).searchParams.get('test') === '1') return test();

  const { data, error } = await userClient().rpc('b2b_mail_due', { p_key: appSecret('db') });
  if (error) return json({ ok: false, error: error.message }, 500);
  const due = (data || {}) as Record<string, string[]>;
  const res: Record<string, number> = { failed: 0 };
  const count = (k: string, r: string) => (r === 'sent' ? (res[k] = (res[k] || 0) + 1) : r === 'failed' ? (res.failed += 1) : 0);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: 'numeric', hour12: false }).format(new Date()));
  const daytime = hour >= 8 && hour < 20;

  // at once, any hour: the studio welcome and the subscription's own state (confirmed / payment failed / cancelled)
  for (const u of due.welcome || []) count('trial_welcome', await b2bMail('trial_welcome', u).catch(() => 'failed'));
  for (const u of due.sync || []) for (const k of await b2bMailSync(u)) res[k] = (res[k] || 0) + 1;

  if (daytime) {
    const run = async (kind: B2BMailKind, ids: string[] | undefined) => {
      for (const u of ids || []) count(kind, await b2bMail(kind, u).catch(() => 'failed'));
    };
    await run('trial_day7', due.day7);
    await run('trial_day12', due.day12);
    await run('renewal_soon', due.renewal);
    await run('monthly_summary', due.summary);
    // trial ended: the studio's mail, and one digest to the owner of the studios that didn't subscribe
    const ended: B2BInfo[] = [];
    for (const u of due.ended || []) {
      const i = await b2bInfo(u).catch(() => null);
      if (!i || i.status !== 'trial_ended') continue;
      const r = await b2bMail('trial_ended', u, '', i).catch(() => 'failed' as const);
      count('trial_ended', r);
      if (r === 'sent' || r === 'skipped') ended.push(i);
    }
    if (ended.length && (await b2bOwnerNotice('trial_ended_digest', { list: ended }))) res.owner_digest = 1;
  }
  if (res.failed) await logServerError('b2b_mail_cron', new Error(`${res.failed} B2B e-mail(s) could not be sent`));
  return json({ ok: true, ...res });
}

/* every studio mail with made-up numbers, to the owner's address only (subject marked TESZT) */
async function test() {
  const to = ownerTo();
  if (!to) return json({ ok: false, error: 'no owner address' });
  const sample = b2bSample();
  const kinds: B2BMailKind[] = ['trial_welcome', 'trial_day7', 'trial_day12', 'trial_ended', 'sub_confirmed', 'renewal_soon', 'payment_failed', 'sub_canceled', 'monthly_summary'];
  let sent = 0;
  for (const k of kinds) {
    const i = { ...sample, ...(k === 'renewal_soon' ? { annual: true, plan: 'b2b_pro_y' } : {}), ...(k === 'trial_ended' ? { status: 'trial_ended' as const } : {}) };
    const m = b2bMailRender(k, i, { summary: k === 'monthly_summary' ? { ref: 'test', from: new Date(Date.now() - 30 * 864e5).toISOString(), to: new Date().toISOString(), previews: 23, added: 40 } : null, off: k.startsWith('trial_day') || k === 'monthly_summary' ? 'https://inkage.app/api/mail-off?t=TESZT' : undefined });
    if (await sendMail(to, `[TESZT] ${m.subject}`, m.html, m.text, undefined, `b2b-test-${k}-${Date.now()}`)) sent += 1;
  }
  return json({ ok: true, test: true, sent, to: to.replace(/^(.).*(@.*)$/, '$1…$2') });
}
