/* Money, server side, for the Bevétel pages: what Stripe, Google and the exchange rates say, read every 5 minutes
   by the rules run, and what the phone should hear about it. Stripe's key comes from Vercel (STRIPE_SECRET_KEY) or
   the Kapcsolatok page; nothing here runs without it, and nothing here moves money except the refund route.
   InkAge takes no payments yet: with no Stripe key the Stripe step only says so, and with no sale the phone hears nothing. */
import { call, env } from "./server";
import { notifyOne } from "./push";
import { PKG, googleToken } from "./stores";

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (ms = 12_000) => AbortSignal.timeout(ms);
export const stripeKey = () => process.env.STRIPE_SECRET_KEY || env().STRIPE_SECRET_KEY || "";
export async function stripe<J = D>(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<J> {
  const key = stripeKey();
  if (!key) throw new Error("nincs STRIPE_SECRET_KEY");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method || (init?.form ? "POST" : "GET"), signal: T(),
    headers: { authorization: `Bearer ${key}`, ...(init?.form ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined, cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${String(j?.error?.message || "").slice(0, 160)}`);
  return j as J;
}
const sec = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);
const major = (v?: number | null) => (v == null ? null : v / 100);
/* ---------- Stripe: balance (exact fees), payouts, lost and failed checkouts, paid sales not recorded here, disputes ---------- */
export async function syncStripe() {
  if (!stripeKey()) return "nincs Stripe-kulcs";
  const st = await call<D>("admin_r_stripe_state");
  const since = Math.floor((st.last_tx ? new Date(st.last_tx).getTime() - 3 * 864e5 : Date.now() - 90 * 864e5) / 1000);
  const tx: D[] = [];
  let after = "";
  for (let i = 0; i < 5; i++) {
    const j = await stripe<{ data: D[]; has_more: boolean }>(`balance_transactions?limit=100&created[gte]=${since}&expand[]=data.source${after ? `&starting_after=${after}` : ""}`);
    for (const b of j.data) {
      const src = typeof b.source === "object" && b.source ? b.source : null;
      const pi = src?.payment_intent ? String(src.payment_intent) : null;
      tx.push({ id: b.id, created: sec(b.created), type: b.type, amount: major(b.amount), fee: major(b.fee), net: major(b.net), currency: String(b.currency || "").toUpperCase(),
        source: src?.id || (typeof b.source === "string" ? b.source : null), session_id: null, payment_intent: pi, available_on: sec(b.available_on), payout_id: null, status: b.status, description: b.description ? String(b.description).slice(0, 200) : null });
    }
    if (!j.has_more || !j.data.length) break;
    after = j.data[j.data.length - 1].id;
  }
  /* each new charge's Checkout Session (purchases keep the session id) */
  for (const t of tx.filter((x) => x.payment_intent && (x.type === "charge" || x.type === "payment")).slice(0, 40)) {
    const s = await stripe<{ data: D[] }>(`checkout/sessions?limit=1&payment_intent=${encodeURIComponent(t.payment_intent)}`).catch(() => null);
    t.session_id = s?.data?.[0]?.id || null;
  }
  const po = await stripe<{ data: D[] }>("payouts?limit=20").catch(() => ({ data: [] as D[] }));
  const payouts = po.data.map((p) => ({ id: p.id, created: sec(p.created), arrival_date: sec(p.arrival_date), amount: major(p.amount), currency: String(p.currency || "").toUpperCase(), status: p.status, method: p.method, description: p.description || null }));
  /* which balance movements each recent payout carried */
  for (const p of payouts.slice(0, 6)) {
    const j = await stripe<{ data: D[] }>(`balance_transactions?limit=100&payout=${p.id}`).catch(() => null);
    for (const b of j?.data || []) { const t = tx.find((x) => x.id === b.id); if (t) t.payout_id = p.id; else tx.push({ id: b.id, created: sec(b.created), type: b.type, amount: major(b.amount), fee: major(b.fee), net: major(b.net), currency: String(b.currency || "").toUpperCase(), source: typeof b.source === "string" ? b.source : null, session_id: null, payment_intent: null, available_on: sec(b.available_on), payout_id: p.id, status: b.status, description: null }); }
  }
  const w = await call<D>("admin_w_stripe", { p_tx: tx, p_payouts: payouts });
  /* the last two days of checkouts: the left ones, and a paid one not recorded here (the webhook did not arrive) */
  const have = new Set<string>(st.sessions || []);
  const cs = await stripe<{ data: D[] }>(`checkout/sessions?limit=100&created[gte]=${Math.floor(Date.now() / 1000) - 2 * 86400}`).catch(() => ({ data: [] as D[] }));
  const ev: D[] = [];
  for (const s of cs.data) {
    const m = s.metadata || {};
    /* the Stripe account also sells Calligra: only InkAge's own checkouts belong here */
    if (m.app !== "inkage") continue;
    const base = { session_id: s.id, payment_intent: s.payment_intent || null, user_id: m.user || null, plan: m.plan || null, amount: major(s.amount_total), currency: s.currency, email: s.customer_details?.email || s.customer_email || null, device: m.device || null, country: s.customer_details?.address?.country || m.country || null, store: "stripe" };
    if (s.status === "expired") ev.push({ ...base, kind: "expired", ref: s.id, at: sec(s.expires_at) });
    else if (s.payment_status === "paid" && !have.has(s.id) && Date.now() / 1000 - s.created > 600) ev.push({ ...base, kind: "paid_missing", ref: s.id, at: sec(s.created), reason: "A Stripe szerint fizetett, de nálunk nincs meg a vásárlás (nem jött meg a Stripe értesítése)." });
  }
  const dsp = await stripe<{ data: D[] }>(`disputes?limit=20&created[gte]=${Math.floor(Date.now() / 1000) - 120 * 86400}`).catch(() => ({ data: [] as D[] }));
  for (const x of dsp.data) {
    if (!(await inkagePayment(x.payment_intent))) continue;
    const closed = ["won", "lost", "warning_closed"].includes(x.status);
    ev.push({ kind: "dispute", ref: x.id, at: sec(x.created), store: "stripe", payment_intent: x.payment_intent || null, amount: major(x.amount), currency: x.currency, reason: x.reason, detail: { status: x.status, due_by: sec(x.evidence_details?.due_by), charge: x.charge } });
    if (closed) ev.push({ kind: "dispute_closed", ref: x.id, at: sec(x.created), store: "stripe", amount: major(x.amount), currency: x.currency, reason: x.status, detail: { status: x.status } });
  }
  const n = ev.length ? await call<number>("admin_w_pay_events", { p_rows: ev }) : 0;
  return `${w?.tx ?? 0} mozgás, ${w?.payouts ?? 0} kifizetés, ${n} új jelzés`;
}

/* a dispute names only the payment: ours if the payment carries metadata app=inkage (Calligra's are skipped) */
async function inkagePayment(pi?: string | null) {
  if (!pi) return false;
  const j = await stripe<D>(`payment_intents/${encodeURIComponent(String(pi))}`).catch(() => null);
  return j?.metadata?.app === "inkage";
}

/* ---------- exchange rates (the ECB's, through frankfurter.app), once a day ---------- */
export async function syncFx() {
  const st = await call<D>("admin_r_stripe_state");
  const today = new Date().toISOString().slice(0, 10);
  if (st.fx_day && st.fx_day >= new Date(Date.now() - 864e5).toISOString().slice(0, 10) && new Date().getUTCHours() < 16) return "friss";
  const r = await fetch("https://api.frankfurter.app/latest?from=USD", { signal: T() }).catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) : null;
  if (!j?.rates) return "hiba: az árfolyam nem jött meg";
  await call("admin_w_fx", { p_day: j.date || today, p_rates: { USD: 1, ...j.rates } });
  return `1 USD = ${j.rates.HUF} Ft`;
}

/* ---------- Google Play: the voided (refunded, charged back) purchases of the last 30 days ---------- */
export async function syncGoogleVoided() {
  if (!env().PLAY_SERVICE_ACCOUNT_JSON) return "nincs Play-kulcs";
  const tok = await googleToken("https://www.googleapis.com/auth/androidpublisher");
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG()}/purchases/voidedpurchases?startTime=${Date.now() - 30 * 864e5}&maxResults=1000`, { headers: { authorization: `Bearer ${tok}` }, signal: T() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Play voided " + r.status + ": " + JSON.stringify(j).slice(0, 120));
  const list: D[] = j.voidedPurchases || [];
  const REASON: Record<number, string> = { 0: "egyéb", 1: "vevő visszavonta", 2: "nem kapta meg", 3: "hibás", 4: "véletlen vásárlás", 5: "csalás", 6: "barátságos csalás", 7: "visszaterhelés" };
  let n = 0;
  for (const v of list) {
    for (const tx of [v.orderId, v.purchaseToken].filter(Boolean)) { const x = await call<D>("admin_w_refund", { p_store: "google", p_tx: String(tx) }).catch(() => null); if (x?.ok) { n++; break; } }
  }
  if (list.length) await call("admin_w_pay_events", { p_rows: list.map((v) => ({ kind: "refund_google", ref: String(v.orderId || v.purchaseToken), at: v.voidedTimeMillis ? new Date(Number(v.voidedTimeMillis)).toISOString() : null, store: "google", reason: REASON[Number(v.voidedReason)] || null, detail: { source: v.voidedSource } })) });
  return `${list.length} visszavont, ${n} párosítva`;
}

/* ---------- the phone: each sale, the day's goal, milestones, and every money fault ---------- */
/* the product as the data names it: InkAge has no fixed packages */
const planOf = (x: D) => String(x.plan_name || x.plan || "vásárlás");
const STORE: Record<string, string> = { stripe: "weboldal", apple: "App Store", google: "Google Play" };
const CHN: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", google: "Google", pinterest: "Pinterest", facebook: "Facebook", "közvetlen": "közvetlen", iphoneapp: "iPhone-app", androidapp: "Android-app", ismeretlen: "" };
const money = (v: number, c: string) => { try { return new Intl.NumberFormat("hu-HU", { style: "currency", currency: (c || "USD").toUpperCase(), maximumFractionDigits: (c || "").toUpperCase() === "HUF" ? 0 : 2 }).format(v); } catch { return `${v} ${c}`; } };
const MS_SALES = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const MS_USD = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000];
export async function notifyPay() {
  const s = await call<D>("admin_r_pay_signals").catch(() => null);
  if (!s) return 0;
  let n = 0;
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
  const tg = env().TELEGRAM_BOT_TOKEN, chat = env().TELEGRAM_CHAT_ID;
  const cfg: D = (await call<D>("admin_r_pay_cfg").catch(() => null)) || {};
  for (const x of (s.sales || []) as D[]) {
    const title = `Új fizetés: ${planOf(x)} · ${money(Number(x.amount) || 0, x.currency)}`;
    const body = [STORE[x.store] || x.store, x.first ? "új vevő" : "visszatérő vevő", x.account || CHN[x.ch] || ""].filter(Boolean).join(" · ") + `. Ma eddig: ${s.today?.n ?? 0} fizetés.`;
    const woke = await notifyOne("sale", "sale:" + x.id, title, body, "/admin#payments").catch(() => 0);
    n += woke;
    if (tg && chat && cfg.telegram_sales) await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: `${title}\n${body}` }), signal: T(8000) }).catch(() => null);
  }
  const goal = Number(s.goal_day) || 0, today = Number(s.today?.n) || 0;
  if (goal && today >= goal) n += await notifyOne("paygoal", "paygoal:" + day, `Megvan a mai cél: ${today} fizetés`, `A napi cél ${goal} volt. Ma eddig ${money(Number(s.today?.usd) || 0, "USD")}.`, "/admin#payments").catch(() => 0);
  const ms = s.milestones || {};
  const ss = [...MS_SALES].reverse().find((v) => Number(ms.sales) >= v), su = [...MS_USD].reverse().find((v) => Number(ms.usd) >= v);
  if (ss) n += await notifyOne("paymile", "paymile:sales:" + ss, ss === 1 ? "Megjött az első fizetés!" : `${ss}. fizetés`, `Eddig ${ms.sales} fizetés, ${money(Number(ms.usd) || 0, "USD")}.`, "/admin#payments").catch(() => 0);
  if (su) n += await notifyOne("paymile", "paymile:usd:" + su, `Átlépted a ${money(su, "USD")} bevételt`, `Eddig ${money(Number(ms.usd) || 0, "USD")}, ${ms.sales} fizetésből.`, "/admin#payments").catch(() => 0);
  for (const e of (s.open || []) as D[]) {
    if (e.kind === "paid_missing") n += await notifyOne("errors", "paymissing:" + e.id, "Fizetett, de nem kapta meg a vásárlást", `${money(Number(e.amount) || 0, e.currency || "USD")}. Nézd meg a Fizetési hibák oldalon, és add meg kézzel.`, "/admin#payfail").catch(() => 0);
    if (e.kind === "dispute") n += await notifyOne("errors", "dispute:" + e.id, "Kártyavita (chargeback) érkezett", `${money(Number(e.amount) || 0, e.currency || "USD")} · ${e.reason || "ok nélkül"}. Pár napon belül válaszolni kell a Stripe-ban.`, "/admin#payfail").catch(() => 0);
  }
  /* a silence: these two hours usually bring sales, and none came (after a release it may be our fault) */
  if (s.live && Number(s.usual_2h) >= 1.5 && Number(s.last_2h) === 0) {
    const rel = s.release?.at && Date.now() - new Date(s.release.at).getTime() < 3 * 3600e3;
    const hour = new Date().toISOString().slice(0, 13);
    n += await notifyOne("errors", "paysilence:" + hour, "2 órája nem jött fizetés", `Ilyenkor általában ${Math.round(Number(s.usual_2h))} szokott jönni.${rel ? " Az utolsó feltöltés óta egy sem: nézd meg, működik-e a fizetés." : " Nézd meg, működik-e a fizetés."}`, "/admin#payfail").catch(() => 0);
  }
  if (Number(s.refunds_24h) >= 3) n += await notifyOne("errors", "refundwave:" + day, `${s.refunds_24h} visszatérítés 24 óra alatt`, "Szokatlanul sok. Nézd meg, mi a közös bennük.", "/admin#payments").catch(() => 0);
  for (const r of (s.low_stars || []) as D[]) n += await notifyOne("feedback", `paystar:${r.user}:${r.at}`, `Egy vevő ${r.stars} csillagot adott`, `${r.style || "egy előnézetre"}. Írj neki, mielőtt visszakéri a pénzt.`, "/admin#customers").catch(() => 0);
  return n;
}

/* every money sync in the 5-minute run; Google's list and the rate a few times an hour is plenty */
export async function payRun() {
  const out: string[] = [];
  out.push("stripe: " + (await syncStripe().catch((e) => "hiba: " + String(e?.message || e).slice(0, 80))));
  const m = new Date().getUTCMinutes();
  if (m < 5 || m >= 30 && m < 35) {
    out.push("árfolyam: " + (await syncFx().catch((e) => "hiba: " + String(e?.message || e).slice(0, 60))));
    out.push("play: " + (await syncGoogleVoided().catch((e) => "hiba: " + String(e?.message || e).slice(0, 60))));
  }
  const p = await notifyPay().catch(() => 0);
  return out.join(" · ") + ` · ${p} értesítés`;
}
