import { appSecret, signToken, userClient } from './server';
import { layout, mailReady, sendMail, SITE } from './mail';
import { B2B, B2B_TRIAL, isB2BPlan } from './b2b';
import { tx, type Lang } from './tr';
import { logServerError } from './errlog';

/* E-mails for studios and clinics on the B2B plans (2026-11-12), and the owner's notices about them. Every mail is
   sent once: it is claimed in public.b2b_mail_log (user, kind, ref) before sending and given back if the send fails.
   Hungarian first (B2B is sold in Hungary); an account whose app language is English gets English.
   - b2bMail(kind, userId)   one studio mail (trial_welcome, trial_day7, trial_day12, trial_ended, sub_confirmed,
                             renewal_soon, payment_failed, sub_canceled, monthly_summary)
   - b2bMailSync(userId)     looks at the subscription now and sends what its state calls for (confirmed, payment failed,
                             cancelled + the owner's notices). The Stripe webhook calls it after every B2B change;
                             /api/b2b/mail-cron calls it too, as a safety net.
   - b2bOwnerNotice(...)     a notice to the owner (ADMIN_NOTIFY_EMAIL, else CONTACT_EMAIL). */

export type B2BMailKind =
  | 'trial_welcome' | 'trial_day7' | 'trial_day12' | 'trial_ended'
  | 'sub_confirmed' | 'renewal_soon' | 'payment_failed' | 'sub_canceled' | 'monthly_summary';

export type B2BInfo = {
  email: string | null; company: string | null; plan: string | null; status: 'trial' | 'trial_ended' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean; stripe_sub: string | null;
  created_at: string; updated_at: string; lang: string | null; mail_off: boolean; remaining: number;
  trial_used: number; trial_n: number; trial_left: number; last_invoice_at: string | null; annual: boolean;
};
export type B2BSummary = { ref: string; from: string; to: string; previews: number; added: number };

/* reminders and summaries respect "Ne küldjetek emlékeztetőt" (profiles.mail_off); the rest is about their account */
const OPTIONAL: B2BMailKind[] = ['trial_day7', 'trial_day12', 'monthly_summary'];

const key = () => appSecret('db');
const db = () => userClient();
export const ownerTo = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL || '';
const langOf = (l: string | null | undefined): Lang => (l === 'en' ? 'en' : 'hu');
const day = (iso: string | null | undefined, lang: Lang) =>
  iso ? new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso)) : '';
/* "november 26-ig" / "until 26 November" (the year only when it isn't this year) */
const until = (iso: string | null | undefined, lang: Lang) => {
  if (!iso) return '';
  const d = new Date(iso), y = d.getFullYear() !== new Date().getFullYear();
  const f = new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', { timeZone: 'Europe/Budapest', ...(y ? { year: 'numeric' } : {}), month: 'long', day: 'numeric' }).format(d);
  return lang === 'hu' ? `${f.replace(/\.$/, '')}-ig` : `until ${f}`;
};
const planName = (p: string | null) => (isB2BPlan(p) ? B2B[p].name : 'InkAge');
const planN = (p: string | null) => (isB2BPlan(p) ? B2B[p].n : 0);

export async function b2bInfo(userId: string): Promise<B2BInfo | null> {
  const { data, error } = await db().rpc('b2b_mail_info', { p_key: key(), p_user: userId });
  if (error) throw new Error(error.message);
  return (data as B2BInfo) || null;
}
async function claim(userId: string, kind: string, ref = '') {
  const { data, error } = await db().rpc('b2b_mail_claim', { p_key: key(), p_user: userId, p_kind: kind, p_ref: ref });
  if (error) throw new Error(error.message);
  return data === true;
}
const undo = (userId: string, kind: string, ref = '') => db().rpc('b2b_mail_undo', { p_key: key(), p_user: userId, p_kind: kind, p_ref: ref }).then(() => {}, () => {});

const offLink = (uid: string) => `${SITE()}/api/mail-off?t=${encodeURIComponent(signToken({ uid, off: 1, exp: Date.now() + 365 * 864e5 }))}`;

/* ---------- the studio mails ---------- */

/** Subject, HTML and text of one studio mail. Pure (no database), so the preview script and ?test=1 use it too. */
export function b2bMailRender(kind: B2BMailKind, i: B2BInfo, o: { summary?: B2BSummary | null; off?: string } = {}) {
  const lang = langOf(i.lang);
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const site = SITE();
  const app = `${site}/app`;
  const page = `${site}/szalonoknak`;
  const plans = `${page}#csomagok`;
  const hello = T('Hello,', 'Szia!');
  const sign = T('The InkAge team', 'Az InkAge csapata');
  const reply = T('If you get stuck anywhere, just reply to this e-mail and we’ll help.', 'Ha bárhol elakadsz, válaszolj erre a levélre, és segítünk.');
  const company = (i.company || '').trim();
  const name = planName(i.plan), n = planN(i.plan);
  const foot = (extra = '') =>
    (extra ? extra + ' ' : '') +
    T(`You’re getting this because ${company || 'your studio'} uses InkAge’s plan for studios. AI previews are a simulation, not a guarantee.`,
      `Azért kapod, mert a szalonod${company ? ` (${company})` : ''} az InkAge szalonoknak szóló csomagját használja. Az MI-előnézet szimuláció, nem garancia.`);
  const offFoot = o.off ? T(`No more reminders: ${o.off}`, `Leiratkozás az emlékeztetőkről: ${o.off}`) : '';
  let subject = '', title = '', lines: string[] = [], button: { href: string; label: string } | undefined, ft = foot();

  switch (kind) {
    case 'trial_welcome':
      subject = T(`Your 14-day InkAge trial has started`, `Elindult a 14 napos InkAge-próbád`);
      title = T('Your trial is on. Here’s the first guest.', 'Indulhat a próba. Így megy az első vendég.');
      lines = [
        hello,
        T(`You have ${i.trial_n || B2B_TRIAL.n} previews ${until(i.trial_ends_at, lang)}, no card needed.`, `${i.trial_n || B2B_TRIAL.n} előnézeted van ${until(i.trial_ends_at, lang)}, kártya nélkül.`),
        T('1. Take a photo of the guest’s body part (arm, leg, back) in good light.', '1. Fotózd le a vendég testrészét (kar, láb, hát), jó fényben.'),
        T('2. Add the design: upload the sketch or pick one.', '2. Add hozzá a mintát: töltsd fel a vázlatot, vagy válassz egyet.'),
        T('3. Set the size and place it where it will go.', '3. Állítsd be a méretet, és tedd oda, ahová kerül.'),
        T('4. Show the guest the 50-year view: today, 1, 10, 30 and 50 years later.', '4. Mutasd meg a vendégnek az 50 éves nézetet: ma, 1, 10, 30 és 50 év múlva.'),
        T('It works on a tablet or phone too, right at the counter.', 'Tableten és telefonon is működik, akár a pultnál.'),
        T('Unused previews stay with you if you subscribe.', 'Ha előfizetsz, a fel nem használt előnézetek megmaradnak.'),
        reply, sign,
      ];
      button = { href: app, label: T('Open InkAge', 'Megnyitom az InkAge-et') };
      break;
    case 'trial_day7':
      subject = T(`Halfway through your trial: ${i.trial_left} previews left`, `A próba felénél: ${i.trial_left} előnézeted maradt`);
      title = T('One week of your trial is done.', 'Eltelt a próba első hete.');
      lines = [
        hello,
        T(`So far you’ve made ${i.trial_used} previews; ${i.trial_left} are left, ${until(i.trial_ends_at, lang)}.`, `Eddig ${i.trial_used} előnézetet készítettél, ${until(i.trial_ends_at, lang)} még ${i.trial_left} maradt.`),
        i.trial_used
          ? T('Try it with a guest who is unsure about the spot or the size: the 50-year view helps decide.', 'Próbáld ki olyan vendéggel, aki bizonytalan a helyben vagy a méretben: az 50 éves nézet segít dönteni.')
          : T('Start with the next guest: a photo of the body part, the design, the size, and show the 50-year view.', 'Kezdd a következő vendéggel: fotó a testrészről, minta, méret, és mutasd meg az 50 éves nézetet.'),
        reply, sign,
      ];
      button = { href: app, label: T('Open InkAge', 'Megnyitom az InkAge-et') };
      ft = foot(offFoot);
      break;
    case 'trial_day12':
      subject = T('2 days left in your InkAge trial', '2 nap van hátra az InkAge-próbádból');
      title = T('2 days left in your trial.', '2 nap van hátra a próbádból.');
      lines = [
        hello,
        T(`Your trial runs ${until(i.trial_ends_at, lang)}. You have ${i.trial_left} previews left.`, `A próbád ${until(i.trial_ends_at, lang)} tart, ${i.trial_left} előnézeted maradt.`),
        T('If you subscribe, the trial previews you have left stay with you too.', 'Ha előfizetsz, a megmaradt próba-előnézetek is megmaradnak.'),
        T('Plans are monthly and can be cancelled any time.', 'A csomagok havidíjasak, bármikor lemondhatók.'),
        reply, sign,
      ];
      button = { href: plans, label: T('Choose a plan', 'Csomagot választok') };
      ft = foot(offFoot);
      break;
    case 'trial_ended':
      subject = T('Your InkAge trial has ended', 'Lejárt az InkAge-próbád');
      title = T('Your trial has ended.', 'Lejárt a próbád.');
      lines = [
        hello,
        T(`Thanks for trying InkAge. You made ${i.trial_used} previews during the trial.`, `Köszönjük, hogy kipróbáltad az InkAge-et. A próba alatt ${i.trial_used} előnézetet készítettél.`),
        T('The unused trial previews have expired; the previews you made stay in your gallery.', 'A fel nem használt próba-előnézetek lejártak; az elkészült előnézetek megmaradnak a galériádban.'),
        T('To go on, choose a plan: unused previews roll over from month to month.', 'A folytatáshoz válassz csomagot: a fel nem használt előnézetek hónapról hónapra megmaradnak.'),
        reply, sign,
      ];
      button = { href: plans, label: T('Choose a plan', 'Csomagot választok') };
      break;
    case 'sub_confirmed':
      subject = T(`Your InkAge ${name} subscription is active`, `Aktív az InkAge ${name} előfizetésed`);
      title = T('Thanks, your subscription is active.', 'Köszönjük, aktív az előfizetésed.');
      lines = [
        hello,
        T(`Plan: ${name}, ${n} previews a month. Unused previews roll over.`, `Csomag: ${name}, havi ${n} előnézet. A fel nem használtak megmaradnak.`),
        i.current_period_end
          ? i.annual
            ? T(`Billed yearly; your previews are added every month. Next yearly charge: ${day(i.current_period_end, lang)}.`, `Éves díjas, az előnézetek havonta érkeznek. A következő éves terhelés: ${day(i.current_period_end, lang)}`)
            : T(`Next charge and next ${n} previews: ${day(i.current_period_end, lang)}.`, `Következő terhelés és a következő ${n} előnézet: ${day(i.current_period_end, lang)}`)
          : '',
        T(`You now have ${i.remaining} previews.`, `Most ${i.remaining} előnézeted van.`),
        T('Card, invoices or cancelling: on inkage.app/szalonoknak, under “Előfizetés kezelése”. The invoice comes by e-mail.', 'Kártya, számlák vagy lemondás: az inkage.app/szalonoknak oldalon, az „Előfizetés kezelése” gombbal. A számlát e-mailben kapod.'),
        reply, sign,
      ].filter(Boolean);
      button = { href: app, label: T('Open InkAge', 'Megnyitom az InkAge-et') };
      break;
    case 'renewal_soon':
      subject = T(`Your yearly InkAge plan renews in 3 days`, `3 nap múlva megújul az éves InkAge-csomagod`);
      title = T('Your yearly plan renews in 3 days.', '3 nap múlva megújul az éves csomagod.');
      lines = [
        hello,
        T(`Your ${name} plan (${n} previews a month) renews for another year. Date of the charge: ${day(i.current_period_end, lang)}.`, `A ${name} csomagod (havi ${n} előnézet) újabb egy évre megújul. A terhelés napja: ${day(i.current_period_end, lang)}`),
        T('Nothing to do if you want to keep it. To change the card or cancel, open “Előfizetés kezelése” on inkage.app/szalonoknak.', 'Ha maradnál, nincs teendőd. Kártyacseréhez vagy lemondáshoz nyisd meg az „Előfizetés kezelése” gombot az inkage.app/szalonoknak oldalon.'),
        reply, sign,
      ];
      button = { href: page, label: T('Manage subscription', 'Előfizetés kezelése') };
      break;
    case 'payment_failed':
      subject = T('Your InkAge payment didn’t go through', 'Nem ment át az InkAge-havidíj');
      title = T('The last payment didn’t go through.', 'A legutóbbi díj nem ment át.');
      lines = [
        hello,
        T(`We couldn’t charge the card for your ${name} plan. Often the card has expired or hit a limit.`, `Nem sikerült terhelni a kártyát a ${name} csomagodért. Gyakran lejárt a kártya, vagy elérte a limitet.`),
        T('Update the card: inkage.app/szalonoknak → “Előfizetés kezelése”.', 'Frissítsd a kártyát: inkage.app/szalonoknak → „Előfizetés kezelése”.'),
        T(`The previews you already have stay usable (now ${i.remaining}).`, `A meglévő előnézeteid továbbra is használhatók (most ${i.remaining}).`),
        reply, sign,
      ];
      button = { href: page, label: T('Update card', 'Kártya frissítése') };
      break;
    case 'sub_canceled': {
      const ended = i.status === 'canceled';
      subject = T('Your InkAge subscription is cancelled', 'Lemondtad az InkAge-előfizetést');
      title = T('Your cancellation is confirmed.', 'Megkaptuk a lemondást.');
      lines = [
        hello,
        ended || !i.current_period_end
          ? T(`Your ${name} plan has ended; no more charges.`, `A ${name} csomagod megszűnt, több terhelés nem lesz.`)
          : T(`Your ${name} plan runs ${until(i.current_period_end, lang)}, then it stops; no more charges.`, `A ${name} csomagod ${until(i.current_period_end, lang)} fut, utána megszűnik; több terhelés nem lesz.`),
        T(`The previews you have left stay usable (now ${i.remaining}).`, `A megmaradt előnézeteid továbbra is használhatók (most ${i.remaining}).`),
        T('Changed your mind? You can restart any time on inkage.app/szalonoknak.', 'Meggondoltad magad? Bármikor újraindíthatod az inkage.app/szalonoknak oldalon.'),
        T('If something was missing, we’d love to hear it: just reply.', 'Ha valami hiányzott, szívesen meghallgatjuk: csak válaszolj erre a levélre.'),
        sign,
      ];
      button = { href: page, label: T('My subscription', 'Az előfizetésem') };
      break;
    }
    case 'monthly_summary': {
      const s = o.summary;
      const prev = s ? s.previews : 0;
      const carried = Math.max(0, i.remaining - (s?.added || 0));
      subject = T(`Your InkAge month: ${prev} previews`, `Az InkAge-hónapod: ${prev} előnézet`);
      title = T(`${prev} previews for your guests this month.`, `Ebben a hónapban ${prev} előnézet készült a vendégeidnek.`);
      lines = [
        hello,
        s ? T(`Between ${day(s.from, lang)} and ${day(s.to, lang)} you made ${prev} previews.`, `${day(s.from, lang)} és ${day(s.to, lang)} között ${prev} előnézetet készítettél.`) : '',
        T(`New this month: ${s?.added || n} previews. Carried over: ${carried}. You now have ${i.remaining}.`, `Új havi keret: ${s?.added || n} előnézet. Átjött az előző hónapból: ${carried}. Most összesen ${i.remaining} van.`),
        prev === 0
          ? T('Haven’t used it yet this month? Try it with the next guest who is unsure about the size or the spot.', 'Még nem használtad? Próbáld ki a következő vendéggel, aki bizonytalan a méretben vagy a helyben.')
          : '',
        reply, sign,
      ].filter(Boolean);
      button = { href: app, label: T('Open InkAge', 'Megnyitom az InkAge-et') };
      ft = foot(offFoot);
      break;
    }
  }
  const html = layout({ title, lines, button, foot: ft });
  const text = [title, '', ...lines, '', button ? `${button.label}: ${button.href}` : '', '', ft].join('\n');
  return { subject, html, text };
}

/** Sends one studio mail, once per (user, kind, ref). Returns 'sent', 'skipped' (already sent, opted out, no address,
    not applicable) or 'failed'. ref: what makes a repeat a new mail (the subscription id, a period, an invoice). */
export async function b2bMail(kind: B2BMailKind, userId: string, ref = '', pre?: B2BInfo | null): Promise<'sent' | 'skipped' | 'failed'> {
  if (!mailReady()) return 'failed';
  const i = pre || (await b2bInfo(userId));
  if (!i?.email || i.email.endsWith('@inkage.invalid')) return 'skipped';
  if (OPTIONAL.includes(kind) && i.mail_off) return 'skipped';
  let summary: B2BSummary | null = null;
  if (kind === 'monthly_summary') {
    const { data } = await db().rpc('b2b_mail_summary', { p_key: key(), p_user: userId });
    summary = (data as B2BSummary) || null;
    if (!summary) return 'skipped';
    ref = summary.ref;
  }
  if (kind === 'renewal_soon') {
    if (!i.annual || !i.current_period_end) return 'skipped'; // monthly plans don't need it
    ref = i.current_period_end.slice(0, 10);
  }
  if (!(await claim(userId, kind, ref))) return 'skipped';
  const off = OPTIONAL.includes(kind) ? offLink(userId) : undefined;
  const m = b2bMailRender(kind, i, { summary, off });
  const headers = off ? { 'List-Unsubscribe': `<${off}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  const ok = await sendMail(i.email, m.subject, m.html, m.text, process.env.CONTACT_EMAIL || undefined, `b2b-${kind}-${userId}-${ref}`.slice(0, 250), headers);
  if (!ok) {
    await undo(userId, kind, ref);
    await logServerError('b2b_mail', new Error(`${kind} e-mail could not be sent`));
    return 'failed';
  }
  // a studio never also gets the consumer welcome (same mark the app's /api/welcome uses)
  if (kind === 'trial_welcome') await db().rpc('welcome_once', { p_secret: key(), p_user: userId }).then(() => {}, () => {});
  return 'sent';
}

/* ---------- the owner's notices ---------- */

export type B2BOwnerKind = 'canceled' | 'past_due' | 'trial_ended_digest';

/** A notice to the owner. canceled / past_due: about one studio (once per subscription / period). trial_ended_digest:
    a list of studios whose trial ended without subscribing (once per day). */
export async function b2bOwnerNotice(kind: B2BOwnerKind, a: { userId?: string; info?: B2BInfo | null; ref?: string; list?: B2BInfo[] }) {
  const to = ownerTo();
  if (!to || !mailReady()) return false;
  const who = (i: B2BInfo) => `${i.company || '(nincs név)'} · ${i.email || 'nincs e-mail'}`;
  let subject = '', text = '', idem = '';
  if (kind === 'trial_ended_digest') {
    const list = a.list || [];
    if (!list.length) return false;
    const d = new Date().toISOString().slice(0, 10);
    subject = `Lejárt szalon-próbák előfizetés nélkül: ${list.length}`;
    text = `Ezeknél a szalonoknál lejárt a 14 napos próba, és nem fizettek elő:\n\n` +
      list.map((i) => `• ${who(i)} – ${i.trial_used}/${i.trial_n} előnézetet használt`).join('\n') +
      `\n\nTipp: aki használta, annak érdemes személyesen írni.`;
    idem = `b2b-owner-trial-${d}-${list.map((i) => i.email).join(',')}`.slice(0, 250);
  } else {
    const i = a.info || (a.userId ? await b2bInfo(a.userId) : null);
    if (!i || !a.userId) return false;
    if (!(await claim(a.userId, `owner_${kind}`, a.ref || ''))) return false;
    if (kind === 'canceled') {
      subject = `Szalon lemondta: ${i.company || i.email}`;
      text = `${who(i)} lemondta az előfizetést (${planName(i.plan)}).\n` +
        (i.status === 'canceled' ? 'Már meg is szűnt.' : `Eddig fut: ${day(i.current_period_end, 'hu')}.`) + `\nMegmaradt előnézet: ${i.remaining}.`;
    } else {
      subject = `Szalon fizetése nem ment át: ${i.company || i.email}`;
      text = `${who(i)} – a(z) ${planName(i.plan)} díja nem ment át (past_due). Az ügyfél levelet kapott a kártyafrissítésről (ha van e-mail-címe).`;
    }
    idem = `b2b-owner-${kind}-${a.userId}-${a.ref || ''}`.slice(0, 250);
  }
  const ok = await sendMail(to, subject, `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`, text, undefined, idem).catch(() => false);
  if (!ok && a.userId && kind !== 'trial_ended_digest') await undo(a.userId, `owner_${kind}`, a.ref || '');
  return ok;
}

/* ---------- what the subscription's state calls for ---------- */

/** Call after every change to a B2B subscription (the Stripe webhook, after b2b_sub_set). Sends at most: the
    confirmation for a new subscription, the payment-failed mail for a past-due period, the cancellation confirmation,
    and the owner's notices for the last two. Safe to call again and again: each goes once. Never throws. */
export async function b2bMailSync(userId: string) {
  const out: string[] = [];
  try {
    const i = await b2bInfo(userId);
    if (!i) return out;
    const sub = i.stripe_sub || '';
    if (i.status === 'active' && sub && !i.cancel_at_period_end) {
      if ((await b2bMail('sub_confirmed', userId, sub, i)) === 'sent') out.push('sub_confirmed');
    }
    if (i.status === 'past_due') {
      const ref = `${sub}:${(i.current_period_end || '').slice(0, 10)}`;
      if ((await b2bMail('payment_failed', userId, ref, i)) === 'sent') out.push('payment_failed');
      if (await b2bOwnerNotice('past_due', { userId, info: i, ref })) out.push('owner_past_due');
    }
    /* only a subscription that was ever paid (an incomplete checkout that expires is not a cancellation) */
    if (i.last_invoice_at && (i.status === 'canceled' || (i.status === 'active' && i.cancel_at_period_end))) {
      if ((await b2bMail('sub_canceled', userId, sub, i)) === 'sent') out.push('sub_canceled');
      if (await b2bOwnerNotice('canceled', { userId, info: i, ref: sub })) out.push('owner_canceled');
    }
  } catch (e) {
    await logServerError('b2b_mail_sync', e);
  }
  return out;
}

/** Sample data for previews and the test send. */
export function b2bSample(): B2BInfo {
  const now = Date.now();
  return {
    email: 'szalon@example.com', company: 'Minta Tattoo Stúdió', plan: 'b2b_pro', status: 'active',
    trial_ends_at: new Date(now + 2 * 864e5).toISOString(), current_period_end: new Date(now + 30 * 864e5).toISOString(),
    cancel_at_period_end: false, stripe_sub: 'sub_test', created_at: new Date(now - 12 * 864e5).toISOString(), updated_at: new Date(now).toISOString(),
    lang: 'hu', mail_off: false, remaining: 137, trial_used: 8, trial_n: 20, trial_left: 12, last_invoice_at: new Date(now).toISOString(), annual: false,
  };
}
