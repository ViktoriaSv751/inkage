import { NextResponse } from "next/server";
import { SITE, asAdmin, asCron, call, env } from "@/lib/admin/server";
import { type Digest, type Extra, digestEmail, text, weeklyEmail } from "@/lib/email/admin-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* The morning digest: yesterday against the day before, the week, the goals and what needs attention.
   E-mail (Resend) to the addresses in public.admin_emails, and Telegram when TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID exist.
   The e-mails themselves are in lib/email/admin-digest.ts. */
/* the e-mail and chat services get 15 seconds each, so one slow answer can't stop the whole run */
const T = () => AbortSignal.timeout(15000);
/* the digest's numbers: one more try after a short wait (a cold database can be slow on the first call) */
async function digestData() {
  try { return await call<Digest>("admin_digest_t"); } catch { await new Promise((r) => setTimeout(r, 2000)); return call<Digest>("admin_digest_t"); }
}

/* Monday: the week's plan, three steps from last week's numbers (Claude when there is a key, the signals otherwise) */
/* force: "Újratervezés" on the page replaces this week's plan (the Monday run never overwrites one) */
async function weekPlan(x: Extra, force = false) {
  if (x.week_plan?.length && !force) return "megvan";
  const w = x.week || {}, pw = x.prev_week || {};
  let items: { t: string; why?: string; metric: string }[] = [];
  const key = env().ANTHROPIC_API_KEY;
  if (key) {
    /* 15 seconds at most (the whole Monday e-mail waits for it), with room for the model's own thinking */
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: T(), headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env().ADMIN_AI_MODEL || "claude-opus-5-5", max_tokens: 4000, output_config: { effort: "low" },
        system: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) növekedési tanácsadója vagy. Csak organikus növekedés: soha ne javasolj fizetett hirdetést vagy kiemelést, és soha ne írd, hogy „ingyenes” vagy „free”. A számok jelentése: scored = kész tetoválás-előnézet (a fő élmény), revealed = megnézte 50 év múlva, shared = megosztott (link, öregedés-videó, PDF a tetoválóművésznek), captured = bőrfotót töltött fel. Csak JSON-t adj vissza: pontosan 3 elem, [{\"t\":\"lépés\",\"why\":\"miért\",\"metric\":\"sessions|scored|signups|shared\"}], magyarul, tegezve.",
        messages: [{ role: "user", content: JSON.stringify({ het: w, elozo_het: pw, posztok: x.top_posts, google: x.gsc_week, kovetok: x.followers, valaszra_var: x.inbox_open }) }] }) }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    const t = j.stop_reason === "end_turn" ? ((j.content || []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("") : "";
    try { items = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); } catch {}
  }
  if (!items.length) items = [
    { t: "Tegyél inkage.app/go/… rövid linket a hét minden videójába.", why: "Így látszik, melyik hozott embert.", metric: "sessions" },
    { t: w.scored < pw.scored ? "Posztolj egy „ma vs. 50 év múlva” videót: így látszik, mit tud az app." : "Ismételd meg a múlt hét legjobb videójának formáját egy új mintával.", metric: "scored" },
    { t: x.inbox_open ? `Válaszolj a ${x.inbox_open} várakozó kommentre és véleményre.` : "Kérj meg 3 elégedett felhasználót, hogy értékeljen az áruházban.", metric: "signups" },
  ];
  await call("admin_w_week_plan", { p_items: items.slice(0, 3).map((i) => ({ t: String(i.t).slice(0, 200), why: i.why ? String(i.why).slice(0, 200) : undefined, metric: i.metric, done: false })), p_force: force });
  return "elkészült";
}

async function sendWeekly() {
  const d = await digestData(), x = await call<Extra>("admin_r_digest_extra");
  const key = env().RESEND_API_KEY;
  /* "hiba:" makes the run a failed one, so an e-mail that can't go out raises the alarm */
  if (!key || !d.to.length) return { email: key ? "hiba: nincs címzett" : "hiba: nincs RESEND_API_KEY" };
  const m = { to: d.to, ...weeklyEmail(x, SITE) };
  const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: T(), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env().RESEND_FROM || "InkAge <hello@inkage.app>", ...m }) }).catch(() => null);
  return { email: r?.ok ? "elküldve" : "hiba " + (r ? r.status : "időtúllépés") };
}

/* the owner's time zone (saved by the dashboard), the local time there, and whether this morning's e-mail is due */
type Slot = { tz: string; local: string; due: boolean };

async function send(slot?: Slot) {
  const d = await digestData();
  const x = await call<Extra>("admin_r_digest_extra").catch(() => undefined);
  /* on Monday morning (the owner's Monday) the week's plan is made first, so the digest already carries it */
  if (x && (slot ? new Date(slot.local).getDay() : new Date().getUTCDay()) === 1) { await weekPlan(x).catch(() => null); x.week_plan = (await call<Extra>("admin_r_digest_extra").catch(() => x)).week_plan; }
  const out: Record<string, string> = {};
  const key = env().RESEND_API_KEY;
  if (key && d.to.length) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: T(), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env().RESEND_FROM || "InkAge <hello@inkage.app>", to: d.to, ...digestEmail(d, x, SITE, slot?.tz) }) }).catch(() => null);
    out.email = r?.ok ? "elküldve" : "hiba " + (r ? r.status : "időtúllépés");
  } else out.email = key ? "hiba: nincs címzett" : "hiba: nincs RESEND_API_KEY";
  const tg = env().TELEGRAM_BOT_TOKEN, chat = env().TELEGRAM_CHAT_ID;
  if (tg && chat) {
    const r = await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: "POST", signal: T(), headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: text(d, SITE), disable_web_page_preview: true }) }).catch(() => null);
    out.telegram = r?.ok ? "elküldve" : "hiba " + (r ? r.status : "időtúllépés");
  }
  return out;
}

/* every morning at 6:00 where the owner is: pg_cron in Supabase calls this every 30 minutes (admin-digest), it sends once a day */
async function morning() {
  const slot = await call<Slot>("admin_r_digest_slot");
  if (!slot.due) return { email: `nem most (${slot.tz}, ${String(slot.local).slice(11, 16)})` };
  const out = await send(slot);
  if (out.email === "elküldve") await call("admin_w_digest_sent");
  return out;
}

export async function GET(req: Request) {
  return asCron(req, async () => {
    try { return NextResponse.json({ ok: true, ...(new URL(req.url).searchParams.has("weekly") ? await sendWeekly() : await morning()) }); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); }
  });
}
/* "Küldj most egy próbát" on /admin */
export async function POST(req: Request) {
  return asAdmin(async () => {
    const q = new URL(req.url).searchParams;
    /* ?plan=1: the week's plan now (the planner's and the home page's "Heti terv" button) */
    if (q.has("plan")) { try { const x = await call<Extra>("admin_r_digest_extra"); return NextResponse.json({ ok: true, plan: await weekPlan(x, q.has("force")) }); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); } }
    try { return NextResponse.json({ ok: true, ...(q.has("weekly") ? await sendWeekly() : await send(await call<Slot>("admin_r_digest_slot").catch(() => undefined))) }); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); }
  });
}
