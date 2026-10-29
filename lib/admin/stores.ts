/* App Store Connect and Google Play → store_daily (downloads) and store_reviews, read with the owner's own API keys.
   Apple: ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY (the .p8 text), ASC_APP_ID, and ASC_VENDOR_NUMBER for downloads.
   Google: PLAY_SERVICE_ACCOUNT_JSON (a service account invited in Play Console), PLAY_PACKAGE, and PLAY_REPORTS_BUCKET
   (the "pubsite_prod_…" Cloud Storage bucket from Play Console → Download reports) for installs. Server-only. */
import { createSign, sign } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { call, env, log, upsert } from "./server";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iso = (d: Date) => d.toISOString().slice(0, 10);
/* whether a store already has days in the table: the first run reaches further back (backfill). A failed check is
   "unknown": the backfill runs (the upserts make a repeat harmless), rather than never filling the past */
const has = async () => (await call<{ apple?: boolean; google?: boolean }>("admin_r_store_has").catch(() => null)) || { apple: false, google: false };
/* a Play report CSV (UTF-16 or UTF-8) as rows of named columns */
const csv = (buf: Buffer) => {
  const txt = (buf[0] === 0xff && buf[1] === 0xfe ? buf.subarray(2).toString("utf16le") : buf.toString("utf8")).trim();
  const ls = txt.split(/\r?\n/), head = (ls.shift() || "").split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
  return ls.filter(Boolean).map((l) => { const c = l.split(",").map((x) => x.trim().replace(/^"|"$/g, "")); return Object.fromEntries(head.map((h, i) => [h, c[i]])) as Record<string, string>; });
};
const col = (row: Record<string, string>, re: RegExp) => { const k = Object.keys(row).find((h) => re.test(h)); return k ? row[k] : undefined; };
/* the installs reports' columns by exact name, one family for a whole row: the per-user columns when the report has
   them, else the event columns (a regex found "Uninstall events" for installs, or device upgrades for updates) */
const playCols = (row: Record<string, string>) => {
  const v = (k: string) => Number(row[k]) || 0;
  return "Daily User Installs" in row ? { installs: v("Daily User Installs"), uninstalls: v("Daily User Uninstalls"), updates: v("Daily Device Upgrades") }
    : { installs: v("Install events"), uninstalls: v("Uninstall events"), updates: v("Update events") };
};
const months = (back: number) => Array.from({ length: back + 1 }, (_, m) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - m); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });

/* ---------- Apple ---------- */
function appleToken() {
  const e = env();
  const key = (e.ASC_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: e.ASC_KEY_ID, typ: "JWT" }), body = b64({ iss: e.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const ASC = "https://api.appstoreconnect.apple.com/v1";

/* every review the API gives (200 a page, following the next links up to 2 000); Apple gives no language or app
   version for a review, only the country */
async function appleReviews(tok: string) {
  let url: string | null = `${ASC}/apps/${env().ASC_APP_ID}/customerReviews?sort=-createdDate&limit=200&include=response`;
  let total = 0;
  for (let pg = 0; url && pg < 10; pg++) {
    const r: Response = await fetch(url, { headers: { authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`App Store-értékelések ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    const resp = new Map<string, { text: string; at: string }>(((j.included || []) as { id: string; attributes: { responseBody: string; lastModifiedDate: string } }[]).map((x) => [x.id, { text: x.attributes?.responseBody, at: x.attributes?.lastModifiedDate }]));
    const rows = ((j.data || []) as { id: string; attributes: Record<string, string | number>; relationships?: { response?: { data?: { id: string } } } }[]).map((x) => {
      const a = x.attributes || {}, rp = x.relationships?.response?.data?.id ? resp.get(x.relationships.response.data.id) : undefined;
      return { store: "apple", review_id: x.id, created_at: a.createdDate || null, rating: Number(a.rating) || null, title: a.title || null, body: a.body || null,
        author: a.reviewerNickname || null, territory: a.territory || null, lang: null, version: null, reply: rp?.text || null, replied_at: rp?.at || null };
    });
    total += await upsert("store_reviews", rows, "store,review_id");
    url = j.links?.next || null;
  }
  return total;
}

/* daily SUMMARY sales report: product types 1* are first downloads, 3* re-downloads, 7* updates. The first run reads the
   last 60 days (the report is kept for a year), then the last 7. */
async function appleDownloads(tok: string) {
  const vendor = env().ASC_VENDOR_NUMBER;
  if (!vendor) return 0;
  const appId = String(env().ASC_APP_ID || "");
  const back0 = (await has()).apple ? 7 : 60;
  let total = 0;
  for (let back = 1; back <= back0; back++) {
    const day = iso(new Date(Date.now() - back * 864e5));
    const q = new URLSearchParams({ "filter[frequency]": "DAILY", "filter[reportType]": "SALES", "filter[reportSubType]": "SUMMARY", "filter[vendorNumber]": vendor, "filter[reportDate]": day });
    const r = await fetch(`${ASC}/salesReports?${q}`, { headers: { authorization: `Bearer ${tok}`, accept: "application/a-gzip" } });
    if (r.status === 404) continue; /* no report for that day (yet) */
    if (!r.ok) throw new Error(`App Store-letöltések ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const lines = gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8").trim().split("\n");
    const head = lines.shift()!.split("\t");
    const col = (n: string) => head.indexOf(n);
    const by = new Map<string, { downloads: number; redownloads: number; updates: number }>();
    for (const ln of lines) {
      const c = ln.split("\t"), type = c[col("Product Type Identifier")] || "", units = Number(c[col("Units")]) || 0, cc = c[col("Country Code")] || "";
      if (appId && c[col("Apple Identifier")] && c[col("Apple Identifier")] !== appId) continue;
      const o = by.get(cc) || { downloads: 0, redownloads: 0, updates: 0 };
      if (/^(1|F1)/.test(type)) o.downloads += units; else if (/^(3|F3)/.test(type)) o.redownloads += units; else if (/^(7|F7)/.test(type)) o.updates += units;
      by.set(cc, o);
    }
    total += await upsert("store_daily", [...by].map(([country, o]) => ({ store: "apple", day, country, ...o })), "store,day,country");
  }
  return total;
}

/* ---------- Google ---------- */
async function googleToken(scope: string) {
  const raw = (env().PLAY_SERVICE_ACCOUNT_JSON || "").trim();
  const j = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }), body = b64({ iss: j.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(String(j.private_key).replace(/\\n/g, "\n")).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }) });
  const t = await r.json();
  if (!r.ok) throw new Error("Google-bejelentkezés: " + JSON.stringify(t).slice(0, 160));
  return t.access_token as string;
}
const PKG = () => env().PLAY_PACKAGE || "app.inkage";

/* Play keeps the reviews with text from the last week in the API; the table keeps them for good */
async function googleReviews() {
  const tok = await googleToken("https://www.googleapis.com/auth/androidpublisher");
  const rows: Record<string, unknown>[] = [];
  let page = "";
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG()}/reviews?maxResults=100${page ? "&token=" + page : ""}`, { headers: { authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`Google Play-értékelések ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    for (const v of j.reviews || []) {
      const u = (v.comments || []).find((c: { userComment?: unknown }) => c.userComment)?.userComment || {};
      const dv = (v.comments || []).find((c: { developerComment?: unknown }) => c.developerComment)?.developerComment;
      rows.push({ store: "google", review_id: v.reviewId, created_at: u.lastModified?.seconds ? new Date(Number(u.lastModified.seconds) * 1000).toISOString() : null,
        rating: u.starRating || null, title: null, body: (u.text || "").trim() || null, author: v.authorName || null, territory: null, lang: u.reviewerLanguage || null,
        version: u.appVersionName || null, reply: dv?.text || null, replied_at: dv?.lastModified?.seconds ? new Date(Number(dv.lastModified.seconds) * 1000).toISOString() : null });
    }
    page = j.tokenPagination?.nextPageToken || "";
    if (!page) break;
  }
  return upsert("store_reviews", rows, "store,review_id");
}

/* one object of the Play reports bucket, or null when it is not there (yet) */
async function playReport(tok: string, path: string) {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${env().PLAY_REPORTS_BUCKET}/o/${encodeURIComponent(path)}?alt=media`, { headers: { authorization: `Bearer ${tok}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Google Play-jelentés ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return csv(Buffer.from(await r.arrayBuffer()));
}

/* The monthly installs CSVs in the Play reports bucket: the overview (installs, uninstalls, updates a day), the same by
   country, and the ratings (the store's real average, not only the reviews we downloaded). The current and the last
   month every day (so the last days of a month are not lost), the last 12 months on the first run. */
async function googleInstalls() {
  if (!env().PLAY_REPORTS_BUCKET) return 0;
  const tok = await googleToken("https://www.googleapis.com/auth/devstorage.read_only");
  const back = (await has()).google ? 1 : 12;
  let total = 0;
  const metrics: Record<string, unknown>[] = [];
  for (const ym of months(back)) {
    const ov = await playReport(tok, `stats/installs/installs_${PKG()}_${ym}_overview.csv`);
    if (ov) total += await upsert("store_daily", ov.filter((x) => x.Date).map((x) => { const c = playCols(x); return { store: "google", day: x.Date, country: "",
      downloads: c.installs, updates: c.updates, uninstalls: c.uninstalls, redownloads: 0 }; }), "store,day,country");
    const cc = await playReport(tok, `stats/installs/installs_${PKG()}_${ym}_country.csv`).catch(() => null);
    for (const x of cc || []) { const c = col(x, /^Country$/i); if (x.Date && c) metrics.push({ store: "google", day: x.Date, metric: "installs", dim: "country", k: c, n: playCols(x).installs }); }
    const rt = await playReport(tok, `stats/ratings/ratings_${PKG()}_${ym}_overview.csv`).catch(() => null);
    for (const x of rt || []) {
      if (!x.Date) continue;
      const tot = Number(col(x, /Total Average Rating/i)), daily = Number(col(x, /^Daily Average Rating/i));
      if (Number.isFinite(tot) && tot > 0) metrics.push({ store: "google", day: x.Date, metric: "rating_total", dim: "", k: "", n: tot });
      if (Number.isFinite(daily) && daily > 0) metrics.push({ store: "google", day: x.Date, metric: "rating_daily", dim: "", k: "", n: daily });
    }
  }
  for (let i = 0; i < metrics.length; i += 500) await upsert("store_metrics", metrics.slice(i, i + 500), "store,day,metric,dim,k");
  return total;
}

/* ---------- Apple Analytics Reports: product page views, impressions, where people found the app, crashes per version ---------- */
/* An ongoing report request is made once; Apple then produces daily instances. Each is a gzipped TSV. */
const tsv = (txt: string) => { const ls = txt.trim().split(/\r?\n/); const head = (ls.shift() || "").split("\t").map((h) => h.replace(/^"|"$/g, "").trim()); return ls.map((l) => { const c = l.split("\t").map((x) => x.replace(/^"|"$/g, "")); return Object.fromEntries(head.map((h, i) => [h, c[i]])); }); };
async function ascJ(tok: string, path: string, init?: RequestInit) {
  const r = await fetch(path.startsWith("http") ? path : `${ASC}${path}`, { ...init, headers: { authorization: `Bearer ${tok}`, "content-type": "application/json", ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`App Store-analitika ${r.status}: ${(await r.text()).slice(0, 140)}`);
  return r.json();
}
async function appleAnalytics(tok: string) {
  const app = env().ASC_APP_ID;
  let req = (await ascJ(tok, `/apps/${app}/analyticsReportRequests?filter[accessType]=ONGOING`)).data?.[0]?.id as string | undefined;
  if (!req) req = (await ascJ(tok, "/analyticsReportRequests", { method: "POST", body: JSON.stringify({ data: { type: "analyticsReportRequests", attributes: { accessType: "ONGOING" }, relationships: { app: { data: { type: "apps", id: app } } } } }) })).data?.id;
  if (!req) return 0;
  /* discovery (impressions, product page), downloads (first-time and re-downloads, by source and "Source Info": the
     referring app or site), installs and deletions, sessions (active devices, by device and OS version), crashes */
  const want: [string, string][] = [["APP_STORE_ENGAGEMENT", "App Store Discovery and Engagement Standard"], ["COMMERCE", "App Downloads Standard"],
    ["APP_USAGE", "App Store Installation and Deletion Standard"], ["APP_USAGE", "App Sessions Standard"], ["APP_USAGE", "App Crashes"]];
  /* one value per day × metric × key: every segment (chunk) of an instance is summed, so a day split across chunks is
     counted whole; a day in two instances keeps the newer instance's value */
  const all = new Map<string, number>();
  const reports = new Map<string, { id: string; attributes?: { name?: string } }[]>();
  for (const [cat, name] of want) {
    if (!reports.has(cat)) reports.set(cat, (await ascJ(tok, `/analyticsReportRequests/${req}/reports?filter[category]=${cat}`)).data || []);
    const rep = reports.get(cat)!.find((x) => x.attributes?.name === name);
    if (!rep) continue;
    const inst = ((await ascJ(tok, `/analyticsReports/${rep.id}/instances?filter[granularity]=DAILY&limit=14`)).data || []) as { id: string; attributes: { processingDate: string } }[];
    for (const i of inst.slice(0, 7).sort((a, b) => String(a.attributes?.processingDate).localeCompare(String(b.attributes?.processingDate)))) {
      const agg = new Map<string, number>();
      const add = (day: string, metric: string, dim: string, k: string, n: number) => { const key = [day, metric, dim, k].join("|"); agg.set(key, (agg.get(key) || 0) + n); };
      /* unique devices cannot be added up across rows (one device is in several rows): the largest row, a lower bound */
      const most = (day: string, metric: string, n: number) => { const key = [day, metric, "", ""].join("|"); agg.set(key, Math.max(agg.get(key) || 0, n)); };
      for (const seg of ((await ascJ(tok, `/analyticsReportInstances/${i.id}/segments`)).data || []) as { attributes: { url: string } }[]) {
        const raw = Buffer.from(await (await fetch(seg.attributes.url)).arrayBuffer());
        const txt = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8");
        for (const r of tsv(txt)) {
          if (r["App Apple Identifier"] && String(r["App Apple Identifier"]) !== String(app)) continue;
          const day = r.Date, n = Number(r.Counts ?? r.Crashes ?? r.Sessions ?? 0) || 0;
          if (!day) continue;
          if (name.startsWith("App Store Discovery")) {
            const m = /impression/i.test(r.Event || "") ? "impressions" : /page view/i.test(r.Event || "") ? "page_views" : null;
            if (!m) continue;
            add(day, m, "", "", n); if (r["Source Type"]) add(day, m, "source", r["Source Type"], n); if (r.Territory) add(day, m, "territory", r.Territory, n);
          } else if (name.startsWith("App Downloads")) {
            const re = /re-?download/i.test(r["Download Type"] || "");
            const m = re ? "redownloads_src" : "downloads_src";
            add(day, m, "", "", n); if (r["Source Type"]) add(day, m, "source", r["Source Type"], n);
            if (!re && r["Source Info"] && r["Source Info"] !== "-") add(day, m, "source_info", r["Source Info"].slice(0, 80), n);
            if (!re && r.Territory) add(day, m, "territory", r.Territory, n);
          } else if (name.startsWith("App Store Installation")) {
            const m = /delet/i.test(r.Event || "") ? "deletions" : /install/i.test(r.Event || "") ? "installs" : null;
            if (!m) continue;
            add(day, m, "", "", n); if (r.Device) add(day, m, "device", r.Device, n);
          } else if (name.startsWith("App Sessions")) {
            add(day, "sessions", "", "", n); most(day, "active_devices", Number(r["Unique Devices"]) || 0);
            if (r.Device) add(day, "sessions", "device", r.Device, n); if (r["Platform Version"]) add(day, "sessions", "os", r["Platform Version"], n);
            if (r["App Version"]) add(day, "sessions", "version", r["App Version"], n);
          } else {
            add(day, "crashes", "", "", n); if (r["App Version"]) add(day, "crashes", "version", r["App Version"], n); if (r.Device) add(day, "crashes", "device", r.Device, n);
          }
        }
      }
      agg.forEach((n, key) => all.set(key, n));
    }
  }
  const rows = Array.from(all, ([key, n]) => { const [day, metric, dim, k] = key.split("|"); return { store: "apple", day, metric, dim, k, n }; });
  let k = 0;
  for (let i = 0; i < rows.length; i += 500) k += await upsert("store_metrics", rows.slice(i, i + 500), "store,day,metric,dim,k");
  return k;
}

/* ---------- Google Play: crash and ANR rate per version (Play Developer Reporting API), store listing visitors (reports bucket) ---------- */
async function googleQuality() {
  const tok = await googleToken("https://www.googleapis.com/auth/playdeveloperreporting");
  const end = new Date(Date.now() - 2 * 864e5), start = new Date(Date.now() - 30 * 864e5);
  const dt = (d: Date) => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  const rows: Record<string, unknown>[] = [];
  for (const [set, metric, m] of [["crashRateMetricSet", "crashRate", "crash_rate"], ["anrRateMetricSet", "anrRate", "anr_rate"]] as const) {
    for (const dims of [[], ["versionCode"]]) {
      const r = await fetch(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PKG()}/${set}:query`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
        body: JSON.stringify({ timelineSpec: { aggregationPeriod: "DAILY", startTime: { ...dt(start), timeZone: { id: "America/Los_Angeles" } }, endTime: { ...dt(end), timeZone: { id: "America/Los_Angeles" } } }, dimensions: dims, metrics: [metric, "distinctUsers"] }) });
      if (!r.ok) throw new Error(`Google Play-minőség ${r.status}: ${(await r.text()).slice(0, 140)}`);
      for (const x of (await r.json()).rows || []) {
        const s0 = x.startTime || {}, day = `${s0.year}-${String(s0.month).padStart(2, "0")}-${String(s0.day).padStart(2, "0")}`;
        const v = Number((x.metrics || []).find((y: { metric: string }) => y.metric === metric)?.decimalValue?.value) * 100;
        const users = Number((x.metrics || []).find((y: { metric: string }) => y.metric === "distinctUsers")?.decimalValue?.value);
        const dim = dims.length ? "version" : "", k = dims.length ? String(x.dimensions?.[0]?.stringValue ?? x.dimensions?.[0]?.int64Value ?? "?") : "";
        if (Number.isFinite(v)) rows.push({ store: "google", day, metric: m, dim, k, n: Math.round(v * 1000) / 1000 });
        /* the users the rate is measured on (the affected ones are rate × users) */
        if (Number.isFinite(users)) rows.push({ store: "google", day, metric: m.replace("_rate", "_users"), dim, k, n: users });
      }
    }
  }
  /* store listing visitors, installers and how many of them kept the app (1, 7, 15, 30 days) from the monthly CSVs in
     the reports bucket: the current and the last month, so the end of a month is not lost */
  if (env().PLAY_REPORTS_BUCKET) {
    const gt = await googleToken("https://www.googleapis.com/auth/devstorage.read_only");
    for (const ym of months(1)) for (const kind of ["overview", "channel", "country"]) {
      const data = await playReport(gt, `acquisition/retained_installers/retained_installers_${PKG()}_${ym}_${kind}.csv`).catch(() => null);
      for (const x of data || []) {
        if (!x.Date) continue;
        const dim = kind === "channel" ? "source" : kind === "country" ? "country" : "", k = kind === "channel" ? col(x, /Acquisition Channel/i) || "?" : kind === "country" ? col(x, /^Country/i) || "?" : "";
        const vis = col(x, /Store listing visitors/i), inst = col(x, /Store listing acquisitions|^Installers$/i);
        if (vis != null) rows.push({ store: "google", day: x.Date, metric: "page_views", dim, k, n: Number(vis) || 0 });
        if (inst != null) rows.push({ store: "google", day: x.Date, metric: "downloads_src", dim, k, n: Number(inst) || 0 });
        if (!dim) for (const d of [1, 7, 15, 30]) { const v = col(x, new RegExp(`retained for ${d} day`, "i")); if (v != null) rows.push({ store: "google", day: x.Date, metric: `retained_d${d}`, dim: "", k: "", n: Number(v) || 0 }); }
      }
    }
  }
  let k = 0;
  for (let i = 0; i < rows.length; i += 500) k += await upsert("store_metrics", rows.slice(i, i + 500), "store,day,metric,dim,k");
  return k;
}

/* "Kipróbálom" for the stores */
export async function testStores(which: "apple" | "play"): Promise<{ ok: boolean; msg: string }> {
  try {
    if (which === "apple") {
      const e = env(); if (!(e.ASC_ISSUER_ID && e.ASC_KEY_ID && e.ASC_PRIVATE_KEY && e.ASC_APP_ID)) return { ok: false, msg: "Előbb add meg mind a négy App Store-kulcsot." };
      const r = await fetch(`${ASC}/apps/${e.ASC_APP_ID}`, { headers: { authorization: `Bearer ${appleToken()}` } });
      return r.ok ? { ok: true, msg: `Működik: ${(await r.json()).data?.attributes?.name || "az app"} adatai olvashatók.` } : { ok: false, msg: `Az App Store Connect ezt válaszolta: ${r.status}. Nézd meg az Issuer ID-t, a Key ID-t és az app ID-t.` };
    }
    if (!env().PLAY_SERVICE_ACCOUNT_JSON) return { ok: false, msg: "Előbb töltsd fel a szolgáltatásfiók kulcsfájlját." };
    const tok = await googleToken("https://www.googleapis.com/auth/androidpublisher");
    const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG()}/reviews?maxResults=1`, { headers: { authorization: `Bearer ${tok}` } });
    return r.ok ? { ok: true, msg: "Működik: a Google Play-értékelések olvashatók." } : { ok: false, msg: `A Google Play ezt válaszolta: ${r.status}. A szolgáltatásfiókot meg kell hívni a Play Console-ban (Users and permissions).` };
  } catch (x) { return { ok: false, msg: String((x as Error)?.message || x).slice(0, 200) }; }
}

export async function syncStores() {
  const e = env(), out: Record<string, string> = {};
  let tok = "";
  if (e.ASC_ISSUER_ID && e.ASC_KEY_ID && e.ASC_PRIVATE_KEY && e.ASC_APP_ID) {
    try { tok = appleToken(); } catch (x) { const m = String((x as Error)?.message || x); await log("apple", false, null, m); out.apple = "hiba: " + m.slice(0, 120); }
  }
  if (tok) {
    /* each part logs on its own, so a failing part shows which one it was (and the others still run) */
    const part = async (src: string, f: () => Promise<number>) => { try { const k = await f(); await log(src, true, k, `${k} sor`); return k; } catch (x) { await log(src, false, null, String((x as Error)?.message || x)); return -1; } };
    const a = await part("apple_reviews", () => appleReviews(tok)), b = await part("apple_sales", () => appleDownloads(tok)), c = await part("apple_analytics", () => appleAnalytics(tok));
    const ok = a >= 0 || b >= 0;
    await log("apple", ok, Math.max(0, a) + Math.max(0, b), `${a < 0 ? "értékelés: hiba" : a + " értékelés"}, ${b < 0 ? "letöltés: hiba" : b + " letöltési sor"}, ${c < 0 ? "analitika: hiba" : c + " analitikai sor"}`);
    out.apple = ok ? `${Math.max(0, a)} értékelés` : "hiba";
  }
  if (e.PLAY_SERVICE_ACCOUNT_JSON) {
    const part = async (src: string, f: () => Promise<number>) => { try { const k = await f(); await log(src, true, k, `${k} sor`); return k; } catch (x) { await log(src, false, null, String((x as Error)?.message || x)); return -1; } };
    const a = await part("google_reviews", googleReviews), b = await part("google_installs", googleInstalls), c = await part("google_quality", googleQuality);
    const ok = a >= 0 || b >= 0;
    await log("google", ok, Math.max(0, a) + Math.max(0, b), `${a < 0 ? "értékelés: hiba" : a + " értékelés"}, ${b < 0 ? "telepítés: hiba" : b + " telepítési sor"}, ${c < 0 ? "minőség: hiba" : c + " minőségi sor"}`);
    out.google = ok ? `${Math.max(0, a)} értékelés` : "hiba";
  }
  return out;
}

/* a reply to a store review, sent from the inbox */
export async function replyStore(store: string, reviewId: string, text: string) {
  if (store === "apple") {
    const r = await fetch(`${ASC}/customerReviewResponses`, { method: "POST", headers: { authorization: `Bearer ${appleToken()}`, "content-type": "application/json" },
      body: JSON.stringify({ data: { type: "customerReviewResponses", attributes: { responseBody: text }, relationships: { review: { data: { type: "customerReviews", id: reviewId } } } } }) });
    if (!r.ok) throw new Error(`App Store-válasz ${r.status}: ${(await r.text()).slice(0, 160)}`);
  } else if (store === "google") {
    const tok = await googleToken("https://www.googleapis.com/auth/androidpublisher");
    const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG()}/reviews/${encodeURIComponent(reviewId)}:reply`, { method: "POST",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ replyText: text.slice(0, 350) }) });
    if (!r.ok) throw new Error(`Google Play-válasz ${r.status}: ${(await r.text()).slice(0, 160)}`);
  } else throw new Error("Ismeretlen áruház.");
  /* the store's own copy of the reply comes back with the next sync (a partial row here would overwrite the review) */
}
