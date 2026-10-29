/* Phone notifications for the owner (Web Push, no third party): the dashboard's service worker subscribes once per
   device; a signal is recorded once (admin_push_sent) and every device gets an empty push, after which the worker
   fetches the newest signals itself (signed in), so nothing readable travels through the push services.
   The key pair (VAPID) is made here on first use and kept in Supabase Vault. Server-only. */
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { SITE, call, env, youtubePublished } from "./server";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/* the public key for the browser (and the private one for signing), made once */
export async function vapid(): Promise<{ pub: string; priv: string }> {
  const e = env();
  if (e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY) return { pub: e.VAPID_PUBLIC_KEY, priv: e.VAPID_PRIVATE_KEY };
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const j = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const pub = b64(Buffer.concat([Buffer.from([4]), Buffer.from(j.x, "base64url"), Buffer.from(j.y, "base64url")]));
  const priv = JSON.stringify(privateKey.export({ format: "jwk" }));
  await call("admin_w_key", { p_name: "VAPID_PUBLIC_KEY", p_value: pub });
  await call("admin_w_key", { p_name: "VAPID_PRIVATE_KEY", p_value: priv });
  return { pub, priv };
}

function jwt(aud: string, priv: string) {
  const head = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:hello@inkage.app" }));
  const key = createPrivateKey({ key: JSON.parse(priv), format: "jwk" });
  return `${head}.${body}.${b64(sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }))}`;
}

/* one empty push to every subscribed device; gone subscriptions are dropped */
export async function sendAll() {
  const subs = await call<{ endpoint: string }[]>("admin_r_push_subs").catch(() => []);
  if (!subs.length) return 0;
  const { pub, priv } = await vapid();
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const r = await fetch(s.endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "high", "Content-Length": "0", Authorization: `vapid t=${jwt(new URL(s.endpoint).origin, priv)}, k=${pub}` } });
      if (r.ok) ok++;
      await call("admin_w_push_result", { p_endpoint: s.endpoint, p_ok: r.ok, p_gone: r.status === 404 || r.status === 410 });
    } catch { await call("admin_w_push_result", { p_endpoint: s.endpoint, p_ok: false, p_gone: false }).catch(() => null); }
  }));
  return ok;
}

/* The owner's choices (Rendszer → Értesítések): kinds switched off, and quiet hours (Budapest time) when signals are
   kept but the phone stays silent; they arrive together when the quiet hours end. A test always goes through. */
export type Prefs = { off?: string[]; quiet?: { from: string; to: string } | null; batch?: number };
let prefsCache: { at: number; p: Prefs } | null = null;
async function prefs(): Promise<Prefs> {
  if (prefsCache && Date.now() - prefsCache.at < 60_000) return prefsCache.p;
  const p = await call<Prefs>("admin_r_push_prefs").catch(() => ({}));
  prefsCache = { at: Date.now(), p: p || {} };
  return prefsCache.p;
}
const hm = (d = new Date()) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const inRange = (t: string, a: string, b: string) => (a <= b ? t >= a && t < b : t >= a || t < b);
export async function quietNow() { const q = (await prefs()).quiet; return !!(q?.from && q?.to && inRange(hm(), q.from, q.to)); }

/* a signal is kept once: true when it is new (a kind switched off is not kept at all) */
const mark = async (kind: string, key: string, title: string, body: string, url = "/admin") => {
  if (kind !== "test" && (await prefs()).off?.includes(kind)) return false;
  return call<boolean>("admin_w_push_sent", { p_kind: kind, p_key: key, p_title: title.slice(0, 120), p_body: body.slice(0, 300), p_url: url }).catch(() => false);
};
/* the phone is woken unless it is quiet time (a test always); with batching on, at most once in the chosen minutes
   (the signals stay recorded, and the 5-minute run wakes the phone for them once the time is up) */
const URGENT = new Set(["test", "heartbeat", "viral"]);
const lastWake = () => call<{ last: string | null; pending: number }>("admin_r_push_wake").catch(() => ({ last: null, pending: 0 }));
const wake = async (kind?: string) => {
  if (kind !== "test" && (await quietNow())) return 0;
  const b = Number((await prefs()).batch) || 0;
  if (b > 0 && !URGENT.has(kind || "")) { const w = await lastWake(); if (w.last && Date.now() - new Date(w.last).getTime() < b * 60e3) return 0; }
  return sendAll();
};

export async function notifyOne(kind: string, key: string, title: string, body: string, url?: string): Promise<number> {
  return (await mark(kind, key, title, body, url)) ? wake(kind) : 0;
}

/* Every 5 minutes, after the rules: what the system itself should say. A connection or the certificate before it
   expires, a run or a sync that failed, the digest that did not go out, the measuring that stopped. Each once. */
type Sys = { expiring: { platform: string; at: string }[]; certs: { host: string; valid_to: string | null; domain_expires: string | null }[];
  failed: { job: string; at: string; message: string }[]; calls_bad: { path: string; at: string; status: number | null; error: string | null }[];
  sync_bad: { source: string; at: string; message: string }[]; digest_missing: boolean; digest_day: string; heartbeat: string | null; last_sent: string | null };
const JOBN: Record<string, string> = { "/api/admin/sync": "Reggeli lehúzás", "/api/admin/sync?only=social": "Óránkénti közösségi lehúzás", "/api/admin/digest": "Reggeli összefoglaló",
  "/api/admin/digest?weekly=1": "Heti riport", "/api/admin/publish": "Publikálás", "/api/admin/sync?only=index": "Google-indexelés", "/api/admin/sync?only=cwv": "Oldalsebesség",
  "/api/admin/sync?only=seo": "SEO-bejárás", "/api/admin/sync?only=watch": "Napi figyelés", "/api/admin/sync?only=aivis": "MI-láthatóság" };
export async function notifySystem() {
  const s = await call<Sys>("admin_r_push_system").catch(() => null);
  if (!s) return 0;
  const day = new Date().toISOString().slice(0, 10), d = (t: string) => new Date(t).toLocaleDateString("hu-HU", { month: "short", day: "numeric", timeZone: "Europe/Budapest" });
  let fresh = 0;
  const one = async (kind: string, key: string, t: string, b: string, url: string) => { if (await mark(kind, key, t, b, url)) fresh++; };
  /* a week ahead, and once more on the last day */
  for (const x of s.expiring) await one("expiry", `${x.platform}:${x.at.slice(0, 10)}:${new Date(x.at).getTime() - Date.now() < 1.5 * 864e5 ? "1" : "7"}`, `${PF[x.platform] || x.platform}: lejár a kapcsolat`,
    x.platform === "youtube" && !youtubePublished() ? `${d(x.at)}-n megszakad (a Google „Testing” állapotban 7 naponta). Kösd be újra a Kapcsolatok oldalon.` : `${d(x.at)}-n lejár. Kösd be újra a Kapcsolatok oldalon.`, "/admin#connect");
  for (const c of s.certs) {
    if (c.valid_to && new Date(c.valid_to).getTime() - Date.now() < 14 * 864e5) await one("cert", `${c.host}:cert:${c.valid_to.slice(0, 10)}`, `Lejár a tanúsítvány: ${c.host}`, `${d(c.valid_to)}-n. Nézd meg, megújul-e automatikusan (Vercel).`, "/admin#monitor");
    if (c.domain_expires && new Date(c.domain_expires).getTime() - Date.now() < 30 * 864e5) await one("cert", `${c.host}:domain:${c.domain_expires.slice(0, 10)}`, `Lejár a domain: ${c.host}`, `${d(c.domain_expires)}-n. Hosszabbítsd meg a regisztrátornál.`, "/admin#monitor");
  }
  for (const f of s.failed) await one("run", `${f.job}:${f.at.slice(0, 13)}`, `Hibával futott: ${JOBN[f.job] || f.job}`, f.message || "Nézd meg a Monitoring oldalt.", "/admin#monitor");
  for (const c of s.calls_bad) await one("run", `${c.path}:http:${c.at.slice(0, 13)}`, `Nem futott le: ${JOBN[c.path] || c.path}`, c.error || (c.status ? `HTTP ${c.status}` : "nincs válasz"), "/admin#monitor");
  for (const x of s.sync_bad) await one("sync", `${x.source}:${x.at.slice(0, 13)}`, `Hibás lehúzás: ${PF[x.source] || x.source}`, x.message || "", "/admin#monitor");
  if (s.digest_missing) await one("digest", s.digest_day, "Ma nem ment ki a reggeli összefoglaló", "Nézd meg a Monitoring „Időzített feladatok” sorát, vagy küldd el kézzel a Célok oldalon.", "/admin#monitor");
  /* 21:00 in Budapest: the day so far, once a day (Rendszer → Értesítések: "Esti összefoglaló" switches it off) */
  if (Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", hourCycle: "h23" }).format(new Date())) === 21) {
    const e = await call<{ day: string; sessions: number; scored: number; signups: number; views: number | null; top: { platform: string; title: string | null; views: number | null } | null }>("admin_r_evening").catch(() => null);
    const f = (x: number | null | undefined) => Number(x || 0).toLocaleString("hu-HU");
    if (e) await one("evening", e.day, "🌙 Esti összefoglaló", `Ma ${f(e.scored)} kész előnézet, ${f(e.sessions)} látogatás, ${f(e.signups)} regisztráció${e.views ? `, ${f(e.views)} új megtekintés a közösségi oldalakon` : ""}.${e.top ? ` A nap posztja (${PF[e.top.platform] || e.top.platform}): ${String(e.top.title || "").slice(0, 50)} · ${f(e.top.views)}.` : ""}`, "/admin");
  }
  if (s.heartbeat && Date.now() - new Date(s.heartbeat).getTime() > 20 * 60e3) await one("heartbeat", `${day}:${s.heartbeat.slice(0, 13)}`, "Leállt a mérés", "Az elérhetőség-ellenőrzés 20 perce nem futott: a Supabase időzítője áll.", "/admin#monitor");
  if (fresh) await wake();
  /* batching: signals kept back since the last wake go out once the chosen time has passed */
  else if (Number((await prefs()).batch) > 0 && !(await quietNow()) && await lastWake().then((w) => w.pending > 0 && (!w.last || Date.now() - new Date(w.last).getTime() >= Number(prefsCache?.p.batch) * 60e3))) await sendAll();
  /* the quiet hours just ended: what was kept during them goes out now */
  else {
    const q = (await prefs()).quiet;
    if (q?.from && q?.to && s.last_sent && !(await quietNow()) && inRange(hm(), q.to, addMin(q.to, 5))
      && Date.now() - new Date(s.last_sent).getTime() < (mins(q.to) - mins(q.from) + 1440) % 1440 * 60e3 + 5 * 60e3) await sendAll();
  }
  return fresh;
}
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const addMin = (t: string, m: number) => { const x = (mins(t) + m) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

type News = { errors_people?: number; inbox: { source: string; item_id: string; author: string | null; body: string; rating: number | null; kind: string }[]; errors: number;
  accounts: { platform: string; last_error: string | null }[]; index_drop: string[]; posts: { platform: string; post_id: string; title: string | null; url: string | null; views: number | null; created_at: string | null }[];
  yesterday: { day: string; scored: number; best: number | null } | null };
const PF: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", apple: "App Store", google: "Google Play" };

/* after every sync: a post taking off, new comments and reviews, a record day, errors, a broken connection, a page out of Google */
export async function notifyNews() {
  const n = await call<News>("admin_r_push_news").catch(() => null);
  if (!n) return 0;
  const today = new Date().toISOString().slice(0, 10);
  let fresh = 0;
  /* rising: under three days old and on pace for at least twice the median of her older posts on that platform */
  for (const pf of Object.keys(PF)) {
    const ps = n.posts.filter((p) => p.platform === pf && p.created_at && Number(p.views) > 0);
    const old = ps.filter((p) => Date.now() - new Date(p.created_at!).getTime() > 3 * 864e5).map((p) => Number(p.views)).sort((a, b) => a - b);
    if (old.length < 3) continue;
    const med = old[Math.floor(old.length / 2)];
    for (const p of ps) {
      const h = (Date.now() - new Date(p.created_at!).getTime()) / 36e5;
      if (h > 72 || h < 0.25) continue;
      const x = (Number(p.views) / h) * 72 / Math.max(1, med);
      /* in its first three hours, on pace for three times the median within a day: tell at once */
      /* one notification per post: "Gyorsan terjed" and "Most robban" share one key, so the same post never comes twice */
      if (h <= 3 && Number(p.views) >= 3 * med * (h / 24) && Number(p.views) >= 50) { if (await mark("rising", `${pf}:${p.post_id}`, `🚀 Gyorsan terjed: ${PF[pf]}`, `${String(p.title || "").slice(0, 60)} · ${Number(p.views).toLocaleString("hu-HU")} megtekintés ${Math.max(1, Math.round(h))} óra alatt: a szokásos napi tempó háromszorosa. Most érdemes kommentelni, kitűzni, folytatást tervezni.`, "/admin#social")) fresh++; continue; }
      if (h >= 1 && x >= 2 && await mark("rising", `${pf}:${p.post_id}`, `🔥 Most robban: ${PF[pf]}`, `${String(p.title || "").slice(0, 60)} · ${Number(p.views).toLocaleString("hu-HU")} megtekintés ${Math.round(h)} óra alatt. Most válaszolj a kommentekre!`, "/admin#social")) fresh++;
    }
  }
  /* comments and reviews: one line per new item, the worker shows the newest */
  for (const i of n.inbox) {
    const t = i.kind === "review" ? `${PF[i.source] || i.source}: új értékelés${i.rating ? " · " + "★".repeat(i.rating) : ""}` : `${PF[i.source] || i.source}: új komment`;
    if (await mark("inbox", `${i.source}:${i.item_id}`, t, `${i.author ? i.author + ": " : ""}${i.body}`, "/admin#inbox")) fresh++;
  }
  if (n.yesterday && n.yesterday.scored > 0 && n.yesterday.scored > Number(n.yesterday.best || 0)
    && await mark("record", n.yesterday.day, "🏆 Rekordnap!", `Tegnap ${n.yesterday.scored} kész előnézet: ennyi még egy nap alatt sem volt.`, "/admin")) fresh++;
  /* several visitors with errors, not one visitor's repeated error (or very many in any case) */
  const people = Number(n.errors_people ?? 99);
  if (((n.errors >= 5 && people >= 3) || n.errors >= 50) && await mark("errors", new Date().toISOString().slice(0, 13), "⚠️ Sok hiba az elmúlt órában", `${n.errors} hiba ${Number.isFinite(people) && n.errors_people != null ? people + " látogatásban" : ""} (belépés vagy böngésző). Nézd meg a Rendszer oldalt.`, "/admin#system")) fresh++;
  for (const a of n.accounts) if (a.last_error && await mark("account", `${a.platform}:${today}`, `${PF[a.platform] || a.platform}: hibás kapcsolat`, String(a.last_error).slice(0, 140), "/admin#connect")) fresh++;
  for (const u of n.index_drop) if (await mark("index", `${u}:${today}`, "Kiesett a Google-ből", u.replace(SITE, "") || "/", "/admin#search")) fresh++;
  if (fresh) await wake();
  return fresh;
}
