/* Google Search Console → public.gsc_daily, read with a service account that was added to the property as a user.
   The first run fetches everything Google still keeps (16 months); after that the last 7 days, since Google keeps
   finalising the numbers for a few days. Server-only. */
import { createSign } from "node:crypto";
import { call, env, log, upsert } from "./server";

function account() {
  const raw = (env().GSC_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) throw new Error("A GSC_SERVICE_ACCOUNT_JSON nincs beállítva a Vercelben.");
  const j = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  return { email: j.client_email as string, key: (j.private_key as string).replace(/\\n/g, "\n") };
}

async function accessToken() {
  const { email, key } = account();
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error("Google-bejelentkezés: " + JSON.stringify(j).slice(0, 200));
  return j.access_token as string;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/* the "Kipróbálom" button: signs in with the key and checks that the property shares its data with the service account */
export async function testGsc(): Promise<{ ok: boolean; msg: string }> {
  try {
    const tok = await accessToken(), { email } = account();
    const site = env().GSC_SITE_URL || "sc-domain:inkage.app";
    const r = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { authorization: `Bearer ${tok}` } });
    const j = await r.json();
    if (r.status === 403 && /has not been used|disabled/i.test(JSON.stringify(j))) return { ok: false, msg: "A kulcs jó, de a Google Search Console API nincs bekapcsolva a Google Cloud-projektben." };
    if (!r.ok) return { ok: false, msg: `A Google ezt válaszolta: ${String(j.error?.message || r.status).slice(0, 160)}` };
    const has = ((j.siteEntry || []) as { siteUrl: string }[]).some((x) => x.siteUrl === site);
    return has ? { ok: true, msg: `Működik: a(z) ${site} adatai olvashatók.` } : { ok: false, msg: `A kulcs jó, de a Search Console-ban még add hozzá felhasználóként ezt a címet: ${email}` };
  } catch (e) {
    return { ok: false, msg: String((e as Error)?.message || e).slice(0, 200) };
  }
}

/* rows of the tables the growth pages added (day totals, search types, sitemaps, SEO health, ASO), through the one
   writer that takes only those tables */
export const growthRows = (table: string, r: Record<string, unknown>[]) => (r.length ? call<number>("admin_w_growth_rows", { p_table: table, p_rows: r }) : Promise.resolve(0));

type SaRow = { keys?: string[]; clicks: number; impressions: number; position?: number };
/* one Search Analytics query, every row Google has (25 000 a page) */
async function sa(tok: string, site: string, body: Record<string, unknown>, max = 500_000) {
  const out: SaRow[] = [];
  for (let startRow = 0; startRow < max; startRow += 25_000) {
    const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ ...body, rowLimit: 25_000, startRow }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Search Console ${r.status}: ${JSON.stringify(j.error?.message || j).slice(0, 200)}`);
    const rows = (j.rows || []) as SaRow[];
    out.push(...rows);
    if (rows.length < 25_000) break;
  }
  return out;
}

/* The rows by query × page × country × device leave out the anonymised searches, so their sum is smaller than the
   Search Console page shows. The day totals come from a date-only query (Google's exact numbers): web search, and image,
   video, News and Discover too; image and video also by query. */
export async function syncGsc() {
  try {
    const tok = await accessToken();
    const site = env().GSC_SITE_URL || "sc-domain:inkage.app";
    const have = await call<boolean>("admin_r_gsc_has");
    const end = new Date(), start = new Date(Date.now() - (have ? 7 : 485) * 86400_000);
    const range = { startDate: day(start), endDate: day(end), dataState: "all" };
    /* the day totals (one row a day, Google's exact numbers) always for the whole 16 months Google keeps: they are small,
       and a total missing for an older day used to fall back to the anonymised rows, which are smaller */
    const totRange = { ...range, startDate: day(new Date(Date.now() - 485 * 86400_000)) };
    const rows = await sa(tok, site, { ...range, dimensions: ["date", "query", "page", "country", "device"] });
    const total = await upsert("gsc_daily", rows.map((x) => ({ day: x.keys![0], query: x.keys![1], page: x.keys![2], country: x.keys![3], device: x.keys![4],
      clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: x.position })), "day,query,page,country,device");
    const tot: Record<string, unknown>[] = [], typed: Record<string, unknown>[] = [], miss: string[] = [];
    for (const type of ["web", "image", "video", "news", "discover"]) {
      try {
        for (const x of await sa(tok, site, { ...totRange, type, dimensions: ["date"] })) tot.push({ day: x.keys![0], type, clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: x.position ?? null });
        if (type === "image" || type === "video") for (const x of await sa(tok, site, { ...range, type, dimensions: ["date", "query"] }, 50_000)) typed.push({ day: x.keys![0], type, query: String(x.keys![1]).slice(0, 300), clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: x.position ?? null });
      } catch (e) { miss.push(`${type}: ${String((e as Error)?.message || e).slice(0, 80)}`); }
    }
    /* the totals never stop the main rows (e.g. before the database update that adds their table) */
    try {
      for (let i = 0; i < tot.length; i += 500) await growthRows("gsc_totals", tot.slice(i, i + 500));
      for (let i = 0; i < typed.length; i += 500) await growthRows("gsc_search_type", typed.slice(i, i + 500));
    } catch (e) { miss.push(`mentés: ${String((e as Error)?.message || e).slice(0, 80)}`); }
    await log("gsc", true, total, `${total} sor, ${tot.length} napi összesítő (${day(start)} – ${day(end)})${miss.length ? " · nem jött: " + miss.join("; ") : ""}`);
    return `${total} sor`;
  } catch (e) {
    const m = String((e as Error)?.message || e);
    await log("gsc", false, null, m);
    return "hiba: " + m.slice(0, 120);
  }
}

/* ---------- indexing: is every page of the sitemap in Google, and when was it last crawled ---------- */
/* The URL Inspection API answers one address at a time (2 000 a day per property). Every page of the sitemap in every
   language it lists (hreflang), the never checked and the longest unchecked first, as many as fit in about three
   minutes (the next run goes on with the rest, oldest first); one failing address no longer loses the others. Google ended the mobile-usability check in 2023, so that column stays
   empty. The sitemaps' own state (read when, errors, addresses submitted) comes from the Sitemaps API. */
export async function syncIndex() {
  const t0 = Date.now();
  try {
    const tok = await accessToken();
    const site = env().GSC_SITE_URL || "sc-domain:inkage.app";
    const xml = await (await fetch("https://inkage.app/sitemap.xml", { cache: "no-store" })).text();
    const base = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
    const alts = Array.from(xml.matchAll(/hreflang="[^"]+"\s+href="([^"]+)"/g)).map((m) => m[1].replace(/&amp;/g, "&"));
    const all = Array.from(new Set([...base, ...alts]));
    const seen = new Map<string, number>(((await call<{ url: string; checked_at: string }[]>("admin_r_index_queue").catch(() => [])) || []).map((x) => [x.url, new Date(x.checked_at).getTime()]));
    const urls = [...all].sort((a, b) => (seen.get(a) ?? 0) - (seen.get(b) ?? 0)).slice(0, 600);
    const rows: Record<string, unknown>[] = [], errs: string[] = [];
    let i = 0, quota = false;
    const one = async (url: string) => {
      const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: "en-US" /* English states: the view maps them (COV in search.tsx) */ }),
        signal: AbortSignal.timeout(20_000),
      }).catch((e) => { errs.push(String((e as Error)?.message || e).slice(0, 60)); return null; });
      if (!r) return;
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) { quota = true; return; }
      if (!r.ok) { errs.push(`${r.status} ${String(j.error?.message || "").slice(0, 60)}`); return; }
      const x = j.inspectionResult?.indexStatusResult || {};
      rows.push({ url, verdict: x.verdict || null, coverage: x.coverageState || null, indexing: x.indexingState || null, fetch_state: x.pageFetchState || null,
        robots: x.robotsTxtState || null, last_crawl: x.lastCrawlTime || null, canonical_google: x.googleCanonical || null, canonical_user: x.userCanonical || null,
        mobile: null, checked_at: new Date().toISOString() });
    };
    /* four at a time, until ~3 minutes have passed (the route has five; a started request can take 20 s more, then
       the writes and the sitemaps) or Google says the day's quota is used up; the rest go first next run */
    await Promise.all(Array.from({ length: 4 }, async () => { while (i < urls.length && !quota && Date.now() - t0 < 180_000) { const u = urls[i++]; await one(u); } }));
    let n = 0;
    for (let k = 0; k < rows.length; k += 100) n += await upsert("gsc_index", rows.slice(k, k + 100), "url");
    const sm = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`, { headers: { authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    type Sm = { path: string; lastSubmitted?: string; lastDownloaded?: string; errors?: string; warnings?: string; isPending?: boolean; contents?: { type: string; submitted?: string }[] };
    await growthRows("gsc_sitemaps", ((sm?.sitemap || []) as Sm[]).map((x) => ({ path: x.path, last_submitted: x.lastSubmitted || null, last_downloaded: x.lastDownloaded || null,
      errors: Number(x.errors) || 0, warnings: Number(x.warnings) || 0, pending: !!x.isPending, submitted: (x.contents || []).reduce((t, c) => t + (Number(c.submitted) || 0), 0),
      in_sitemap: all.length, checked_at: new Date().toISOString() }))).catch(() => 0);
    const note = `${n} / ${all.length} oldal megvizsgálva${i < urls.length && !quota ? " · a többi a következő futáskor" : ""}${quota ? " · elfogyott a napi Google-keret" : ""}${errs.length ? ` · ${errs.length} sikertelen (${errs[0]})` : ""}`;
    await log("gsc_index", n > 0 || !errs.length, n, note);
    return note;
  } catch (e) {
    const m = String((e as Error)?.message || e);
    await log("gsc_index", false, null, m);
    return "hiba: " + m.slice(0, 120);
  }
}

/* ---------- page speed: Core Web Vitals of the main pages (PageSpeed Insights: the lab run and, when Google has enough
   visits, the real visitors' numbers), mobile and desktop, once a day into public.admin_cwv ---------- */
export async function syncCwv() {
  try {
    const key = env().PSI_API_KEY;
    const top = await call<string[]>("admin_r_cwv_urls").catch(() => [] as string[]);
    const urls = Array.from(new Set(["https://inkage.app/", "https://inkage.app/app", ...(top || [])])).slice(0, 5);
    const day = new Date().toISOString().slice(0, 10);
    const errs: string[] = [];
    const one = async (url: string, form: "mobile" | "desktop") => {
      const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${new URLSearchParams({ url, strategy: form, category: "performance", ...(key ? { key } : {}) })}`, { signal: AbortSignal.timeout(100_000) })
        .catch((e) => { errs.push(String((e as Error)?.message || e).slice(0, 60)); return null; });
      if (!r) return null;
      if (!r.ok) { errs.push(`${r.status}${r.status === 429 ? " (kulcs nélkül kicsi a keret: PSI_API_KEY)" : ""}`); return null; }
      /* too few visits to the page: Google gives the whole site's field data instead (origin_fallback), marked so */
      const j = await r.json(), au = j.lighthouseResult?.audits || {}, le = j.loadingExperience?.metrics || {}, origin = !!j.loadingExperience?.origin_fallback;
      return { url, form, day, perf: Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100), lcp: au["largest-contentful-paint"]?.numericValue ?? null,
        cls: au["cumulative-layout-shift"]?.numericValue ?? null, fcp: au["first-contentful-paint"]?.numericValue ?? null, ttfb: au["server-response-time"]?.numericValue ?? null,
        inp: le.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
        field: Object.keys(le).length ? { ...Object.fromEntries(Object.entries(le).map(([k, v]) => [k, { p: (v as { percentile?: number }).percentile, c: (v as { category?: string }).category }])), ...(origin ? { origin: true } : {}) } : null };
    };
    const rows = (await Promise.all(urls.flatMap((u) => [one(u, "mobile"), one(u, "desktop")]))).filter(Boolean) as Record<string, unknown>[];
    /* the writer is admin_w_cwv: upsert("admin_cwv") looked for admin_w_admin_cwv, which never existed, so no run saved a row */
    const n = rows.length ? await call<number>("admin_w_cwv", { p_rows: rows }) : 0;
    await log("cwv", rows.length > 0, n, `${n} mérés${errs.length ? ` · ${errs.length} sikertelen (${errs[0]})` : ""}`);
    return `${n} mérés`;
  } catch (e) {
    const m = String((e as Error)?.message || e);
    await log("cwv", false, null, m);
    return "hiba: " + m.slice(0, 120);
  }
}

/* ---------- search appearance: how we showed (rich result, video, image, FAQ…), day by day ---------- */
/* Google allows this dimension only on its own, so one query a day: the last 30 days on the first run, then the last
   9 (Google finalises a few days late). A failure is logged now, not swallowed. */
export async function syncAppearance() {
  try {
    const tok = await accessToken();
    const site = env().GSC_SITE_URL || "sc-domain:inkage.app";
    const out: Record<string, unknown>[] = [], errs: string[] = [];
    const first = !(await call<boolean>("admin_r_appearance_has").catch(() => false));
    for (let back = 2; back <= (first ? 32 : 9); back++) {
      const d = day(new Date(Date.now() - back * 86400_000));
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
        body: JSON.stringify({ startDate: d, endDate: d, dimensions: ["searchAppearance"], rowLimit: 100, dataState: "all" }) });
      if (!r.ok) { errs.push(`${d}: ${r.status}`); continue; }
      for (const x of ((await r.json()).rows || []) as { keys: string[]; clicks: number; impressions: number }[]) out.push({ day: d, appearance: x.keys[0], clicks: Math.round(x.clicks), impressions: Math.round(x.impressions) });
    }
    const n = out.length ? await call<number>("admin_w_rows", { p_table: "gsc_appearance", p_rows: out }) : 0;
    await log("gsc_appearance", !errs.length, n, `${n} sor${errs.length ? ` · ${errs.length} nap hibás (${errs[0]})` : ""}`);
    return n;
  } catch (e) { await log("gsc_appearance", false, null, String((e as Error)?.message || e)); return 0; }
}
