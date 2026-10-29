/* SEO without a subscription: a weekly crawl of the whole site (every language), keyword ideas from Google's own
   autocomplete, Bing Webmaster Tools (search and backlinks), competitors' new pages from their sitemaps, Google
   Programmable Search positions, and Google's update log. Server-only. */
import { call, env, log } from "./server";
import { growthRows } from "./gsc";

const SITE = "https://inkage.app";
const rows = (table: string, r: Record<string, unknown>[]) => (r.length ? call<number>("admin_w_rows", { p_table: table, p_rows: r }) : Promise.resolve(0));
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const attr = (tag: string, a: string) => tag.match(new RegExp(`${a}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>) { const out: R[] = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
const get = (url: string, ms = 10000, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(ms), headers: { "user-agent": "InkAgeAudit/1.0 (+https://inkage.app)", ...(init?.headers || {}) } });

/* ---------- the crawl ---------- */
type Page = { url: string; status: number; redirect_to: string | null; ms: number; bytes: number; title: string | null; meta: string | null; h1: string | null; h1_count: number; h2: string[];
  canonical: string | null; lang: string | null; hreflangs: Record<string, string>; robots: string | null; words: number; imgs: number; imgs_no_alt: number; links_internal: string[]; links_out: number;
  schema_types: string[]; intro: string };
async function page(url: string): Promise<Page> {
  const t0 = Date.now();
  const r = await get(url, 12000, { redirect: "manual" }).catch(() => null);
  const ms = Date.now() - t0;
  if (!r) return { url, status: 0, redirect_to: null, ms, bytes: 0, title: null, meta: null, h1: null, h1_count: 0, h2: [], canonical: null, lang: null, hreflangs: {}, robots: null, words: 0, imgs: 0, imgs_no_alt: 0, links_internal: [], links_out: 0, schema_types: [], intro: "" };
  const loc = r.headers.get("location");
  const html = r.status >= 300 && r.status < 400 ? "" : await r.text();
  /* Next.js streams the title and the meta tags into the body (browsers and Google read them there too), so search the whole page, without the SVG icons' own <title>s */
  const head = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  const metas = head.match(/<meta[^>]+>/gi) || [], links = html.match(/<link[^>]+>/gi) || [];
  const meta = (n: string) => { const t = metas.find((m) => new RegExp(`name\\s*=\\s*["']${n}["']`, "i").test(m)); return t ? attr(t, "content") : null; };
  const body = html.slice(Math.max(0, html.search(/<body/i)));
  const h1s = Array.from(body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) => strip(m[1]));
  const h2s = Array.from(body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => strip(m[1])).filter(Boolean).slice(0, 20);
  const imgs = body.match(/<img[^>]*>/gi) || [];
  const hrefs = Array.from(body.matchAll(/<a[^>]+href\s*=\s*["']([^"'#]+)["']/gi)).map((m) => m[1]);
  const internal = new Set<string>(); let out = 0;
  for (const h of hrefs) { try { const u = new URL(h, url); if (u.hostname === "inkage.app" || u.hostname === "www.inkage.app") internal.add(u.origin.replace("www.", "") + u.pathname.replace(/\/$/, "") + u.search); else if (/^https?:/.test(u.protocol)) out++; } catch {} }
  const hreflangs: Record<string, string> = {};
  for (const l of links) if (/rel\s*=\s*["']alternate["']/i.test(l) && attr(l, "hreflang")) hreflangs[attr(l, "hreflang")!] = attr(l, "href") || "";
  const schema = Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)).flatMap((m) => { try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : j["@graph"] || [j]; return arr.map((x: { "@type"?: string | string[] }) => [x["@type"]].flat().join("/")).filter(Boolean); } catch { return ["(hibás JSON-LD)"]; } });
  const text = strip(body);
  return { url, status: r.status, redirect_to: loc ? new URL(loc, url).toString() : null, ms, bytes: html.length, title: strip(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || null,
    meta: meta("description"), h1: h1s[0] || null, h1_count: h1s.length, h2: h2s, canonical: (links.find((l) => /rel\s*=\s*["']canonical["']/i.test(l)) && attr(links.find((l) => /rel\s*=\s*["']canonical["']/i.test(l))!, "href")) || null,
    lang: attr(html.match(/<html[^>]*>/i)?.[0] || "", "lang"), hreflangs, robots: meta("robots"), words: text ? text.split(" ").length : 0, imgs: imgs.length,
    imgs_no_alt: imgs.filter((i) => !/\balt\s*=/i.test(i)).length, links_internal: Array.from(internal).slice(0, 300), links_out: out, schema_types: Array.from(new Set(schema)), intro: text.slice(0, 900) };
}

/* every issue a page has, in plain words; the check also compares the pages with each other (duplicate titles, hreflang return links) */
function issues(p: Page, all: Page[], inSitemap: Set<string>) {
  const out: { k: string; t: string; c: "bad" | "warn" | "info" }[] = [];
  const add = (k: string, t: string, c: "bad" | "warn" | "info" = "warn") => out.push({ k, t, c });
  if (p.status === 0) add("down", "Nem válaszolt 12 mp alatt", "bad");
  else if (p.status >= 400) add("status", `Hibás válasz: ${p.status}`, "bad");
  else if (p.status >= 300) add("redirect", `Átirányít ide: ${p.redirect_to}`, inSitemap.has(p.url) ? "warn" : "info");
  if (p.status !== 200) return out;
  if (!p.title) add("title", "Nincs címe (title)", "bad"); else if (p.title.length > 65) add("title_long", `Túl hosszú cím (${p.title.length} karakter; a Google kb. 60-at mutat)`); else if (p.title.length < 15) add("title_short", "Túl rövid cím");
  if (all.some((q) => q !== p && q.status === 200 && q.title && q.title === p.title)) add("title_dup", "Ugyanez a cím másik oldalon is szerepel");
  if (!p.meta) add("meta", "Nincs leírása (meta description)"); else if (p.meta.length > 165) add("meta_long", `Túl hosszú leírás (${p.meta.length} karakter)`, "info");
  if (p.h1_count === 0) add("h1", "Nincs H1 főcím"); else if (p.h1_count > 1) add("h1_many", `${p.h1_count} H1 főcím van (egy legyen)`, "info");
  if (!p.canonical) add("canonical", "Nincs canonical link", "info");
  else if (p.canonical.replace(/\/$/, "") !== p.url.replace(/\/$/, "") && inSitemap.has(p.url)) add("canonical_other", `A canonical másik oldalra mutat: ${p.canonical}`);
  if (p.robots && /noindex/i.test(p.robots) && inSitemap.has(p.url)) add("noindex", "noindex, pedig a sitemapban van", "bad");
  if (p.imgs_no_alt) add("alt", `${p.imgs_no_alt} kép alt szöveg nélkül`, "info");
  if (/\/(tudastar|knowledge)\//.test(p.url) && p.words < 300) add("thin", `Kevés szöveg (${p.words} szó)`);
  if (/\/(tudastar|knowledge)\//.test(p.url) && !p.schema_types.some((t) => /Article|BlogPosting|FAQ|HowTo/i.test(t))) add("schema", "Nincs Article / FAQ strukturált adat", "info");
  if (p.schema_types.includes("(hibás JSON-LD)")) add("schema_bad", "Hibás strukturált adat (JSON-LD)", "bad");
  if (p.ms > 1800) add("slow", `Lassú válasz (${(p.ms / 1000).toFixed(1)} mp)`);
  /* hreflang: every language version should point back */
  for (const [lg, href] of Object.entries(p.hreflangs)) {
    if (lg === "x-default" || !href) continue;
    const q = all.find((x) => x.url.replace(/\/$/, "") === href.replace(/\/$/, ""));
    if (q && q.status === 200 && !Object.values(q.hreflangs).some((h) => h.replace(/\/$/, "") === p.url.replace(/\/$/, ""))) { add("hreflang", `A(z) ${lg} változat nem mutat vissza erre az oldalra`); break; }
    if (q && q.status >= 400) { add("hreflang_404", `A(z) ${lg} nyelvi változat hibás (${q.status})`, "bad"); break; }
  }
  return out;
}

export async function syncSeo() {
  try {
    const xml = await (await get(`${SITE}/sitemap.xml`, 15000)).text();
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
    const alts = Array.from(xml.matchAll(/hreflang="[^"]+"\s+href="([^"]+)"/g)).map((m) => m[1].replace(/&amp;/g, "&"));
    const inSitemap = new Set(locs);
    /* the whole sitemap (~600 addresses, every language); a hard cap only against a runaway sitemap, and new fetches
       stop after ~3.5 minutes (the route has five), so a slow day still saves what it read */
    const urls = Array.from(new Set([...locs, ...alts])).slice(0, 1500), t0 = Date.now();
    const pages = (await pool(urls, 10, (u) => (Date.now() - t0 < 210_000 ? page(u) : Promise.resolve(null)))).filter((p): p is Page => !!p);
    const whole = pages.length === urls.length;
    /* a link into a page: an <a href> from another page, or another language version naming it in hreflang (the
       language versions are reached that way, so they are not orphans) */
    const inbound = new Map<string, number>();
    const norm = (u: string) => u.replace(/\/$/, "").replace("://www.", "://");
    pages.forEach((p) => {
      const self = norm(p.url), to = new Set<string>();
      p.links_internal.forEach((l) => to.add(norm(l)));
      Object.entries(p.hreflangs).forEach(([lg, h]) => { if (lg !== "x-default" && h) to.add(norm(h)); });
      to.forEach((l) => { if (l !== self) inbound.set(l, (inbound.get(l) || 0) + 1); });
    });
    const now = new Date().toISOString();
    const r = pages.map((p) => ({ url: p.url, checked_at: now, status: p.status, redirect_to: p.redirect_to, ms: p.ms, bytes: p.bytes, title: p.title, meta: p.meta, h1: p.h1, h1_count: p.h1_count, h2: p.h2,
      canonical: p.canonical, lang: p.lang, hreflangs: p.hreflangs, robots: p.robots, words: p.words, imgs: p.imgs, imgs_no_alt: p.imgs_no_alt,
      links_in: inbound.get(norm(p.url)) || 0, links_internal: p.links_internal, links_out: p.links_out, schema_types: p.schema_types, intro: p.intro, issues: issues(p, pages, inSitemap) }));
    let n = 0; for (let i = 0; i < r.length; i += 60) n += await rows("seo_pages", r.slice(i, i + 60));
    /* pages that left the sitemap leave the table too: only after a crawl that read every sitemap address and saved
       every row, so a page still in the sitemap is never dropped just because this run did not reach it */
    if (whole && n === r.length && n >= 20) await call("admin_w_seo_prune", { p_before: now }).catch(() => null);
    const all = r.flatMap((x) => x.issues), cnt = (c: string) => all.filter((x) => x.c === c).length;
    /* the health score (the same formula the page shows), kept day by day so it has a history */
    const score = r.length ? Math.max(0, Math.round(100 - ((cnt("bad") * 6 + cnt("warn") * 2 + cnt("info") * 0.3) / Math.max(1, r.length)) * 10)) : 0;
    await growthRows("seo_health", [{ day: now.slice(0, 10), score, pages: r.length, ok: r.filter((x) => x.status === 200).length, bad: cnt("bad"), warn: cnt("warn"), info: cnt("info"),
      orphans: r.filter((x) => x.status === 200 && !x.links_in && norm(x.url) !== norm(SITE + "/")).length }]).catch(() => 0);
    const msg = `${n} oldal, ${all.length} észrevétel${whole ? "" : ` · ${urls.length - pages.length} cím időhiány miatt kimaradt`}`;
    await log("seo", true, n, msg);
    return msg;
  } catch (e) { const m = String((e as Error)?.message || e); await log("seo", false, null, m); return "hiba: " + m.slice(0, 120); }
}

/* ---------- keyword ideas: Google's autocomplete, in every language the site speaks ---------- */
const SEEDS: Record<string, string[]> = { hu: ["tetoválás", "tetoválás öregedése", "tetoválás minta", "hogyan nézne ki a tetoválás"], en: ["tattoo", "tattoo aging", "tattoo preview", "tattoo try on"],
  de: ["tattoo vorschau"], es: ["tatuaje envejecido"], fr: ["tatouage vieillissement"], it: ["tatuaggio invecchiamento"], pt: ["tatuagem envelhecida"], nl: ["tattoo veroudering"], pl: ["tatuaż starzenie"], tr: ["dövme"], id: ["tato"],
  ru: ["тату"], ja: ["タトゥー シミュレーション"], ko: ["타투 미리보기"], zh: ["纹身 预览"], cs: ["tetování"], da: ["tatovering"], sv: ["tatuering"], ro: ["tatuaj"], sk: ["tetovanie"], uk: ["тату"],
  el: ["τατουάζ"], fi: ["tatuointi"], no: ["tatovering"], ar: ["وشم"], hi: ["टैटू"], fa: ["تتو"] };
export async function syncKwIdeas() {
  try {
    const jobs: [string, string][] = [];
    for (const [lg, seeds] of Object.entries(SEEDS)) for (const s of seeds) { jobs.push([lg, s]); if (lg === "hu" || lg === "en") for (const c of "abcdefghijklmnoprstuvz") jobs.push([lg, `${seeds[0]} ${c}`]); }
    const found = await pool(jobs, 6, async ([lg, q]) => {
      const r = await get(`https://suggestqueries.google.com/complete/search?client=firefox&hl=${lg}&q=${encodeURIComponent(q)}`, 6000).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      return ((j?.[1] || []) as string[]).map((x) => ({ q: x.toLowerCase().slice(0, 200), lang: lg, seed: q }));
    });
    const uniq = new Map<string, { q: string; lang: string; seed: string }>(); found.flat().forEach((x) => uniq.set(x.q + "|" + x.lang, x));
    const n = await rows("kw_ideas", Array.from(uniq.values()));
    await log("kw_ideas", true, n, `${uniq.size} ötlet`);
    return `${uniq.size} ötlet`;
  } catch (e) { const m = String((e as Error)?.message || e); await log("kw_ideas", false, null, m); return "hiba"; }
}

/* ---------- Bing Webmaster Tools: search performance and the links pointing to us ---------- */
export async function syncBing() {
  const key = env().BING_WMT_KEY; if (!key) return "nincs BING_WMT_KEY";
  try {
    const api = (m: string, q = "") => get(`https://ssl.bing.com/webmaster/api.svc/json/${m}?siteUrl=${encodeURIComponent(SITE + "/")}&apikey=${key}${q}`, 15000).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Bing ${m} ${r.status}`))));
    const qs = ((await api("GetQueryStats")).d || []) as { Query: string; Impressions: number; Clicks: number; AvgImpressionPosition: number; Date: string }[];
    const day = (d: string) => new Date(Number(d.match(/\d+/)?.[0] || Date.now())).toISOString().slice(0, 10);
    const n1 = await rows("bing_daily", qs.map((x) => ({ day: day(x.Date), query: x.Query.slice(0, 300), clicks: x.Clicks, impressions: x.Impressions, pos: x.AvgImpressionPosition })));
    /* every page of the link list (not only the first), and for each of our pages every page of its links; last_seen
       marks what is still there, so a link missing for a week counts as lost */
    const lc: { Url: string; Count: number }[] = [];
    for (let pg = 0; pg < 5; pg++) {
      const d = (await api("GetLinkCounts", `&page=${pg}`).catch(() => ({}))).d || {};
      lc.push(...((d.Links || []) as { Url: string; Count: number }[]));
      if (!(d.TotalPages > pg + 1)) break;
    }
    const links: Record<string, unknown>[] = [], today = new Date().toISOString().slice(0, 10);
    for (const l of lc.slice(0, 40)) {
      for (let pg = 0; pg < 3; pg++) {
        const d = (await api("GetUrlLinks", `&link=${encodeURIComponent(l.Url)}&page=${pg}`).catch(() => ({}))).d || {};
        ((d.Details || []) as { Url: string; AnchorText: string }[]).forEach((x) => links.push({ url: l.Url, source: x.Url, anchor: (x.AnchorText || "").slice(0, 200), last_seen: today }));
        if (!(d.TotalPages > pg + 1)) break;
      }
    }
    const n2 = await rows("bing_links", links);
    /* Bing answered but gave no search rows (bing_daily stays empty): "üres:" at the start, so freshness does not say fresh */
    const msg = `${qs.length ? "" : "üres: a Bing nem adott keresési adatot · "}${n1} keresés-sor, ${n2} link`;
    await log("bing", true, n1 + n2, msg);
    return msg;
  } catch (e) { const m = String((e as Error)?.message || e); await log("bing", false, null, m); return "hiba: " + m.slice(0, 100); }
}

/* ---------- competitors: their new pages, read from their sitemaps ---------- */
type Watch = { sites: { domain: string; sitemap: string | null }[]; social: { platform: string; handle: string }[]; known_pages: string[]; tracked: string[]; top_queries: string[] };
export async function syncCompetitorSites(w: Watch) {
  const known = new Set(w.known_pages);
  let total = 0;
  for (const s of w.sites) {
    try {
      const sm = s.sitemap || `https://${s.domain}/sitemap.xml`;
      let xml = await (await get(sm, 12000)).text();
      const subs = Array.from(xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)).map((m) => m[1]).slice(0, 5);
      for (const u of subs) xml += await (await get(u, 12000).catch(() => null))?.text().catch(() => "") || "";
      const urls = Array.from(new Set(Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim()).filter((u) => !/sitemap.*\.xml$/i.test(u)))).slice(0, 800);
      const fresh = urls.filter((u) => !known.has(`${s.domain} ${u}`));
      /* the first run of a site records everything quietly, marked "initial" (not new: they were there before we
         looked); after that, titles are read for the new ones (up to 25 a day) */
      const first = !w.known_pages.some((k) => k.startsWith(s.domain + " "));
      const titled = await pool(fresh.slice(0, 25), 5, async (u) => { const h = await (await get(u, 8000).catch(() => null))?.text().catch(() => "") || ""; return { domain: s.domain, url: u, initial: first, title: strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 200) || null }; });
      total += await rows("competitor_pages", [...titled, ...fresh.slice(25).map((u) => ({ domain: s.domain, url: u, initial: first, title: null }))]);
    } catch { /* one site failing does not stop the others */ }
  }
  return total;
}

/* ---------- Google Programmable Search: our place where Search Console has no data yet ---------- */
export async function syncCse(w: Watch) {
  const k = env().GOOGLE_CSE_KEY, cx = env().GOOGLE_CSE_ID; if (!k || !cx) return "nincs kulcs";
  const day = new Date().toISOString().slice(0, 10), out: Record<string, unknown>[] = [];
  for (const q of w.tracked.slice(0, 25)) {
    let pos: number | null = null, url: string | null = null;
    for (const start of [1, 11, 21]) {
      const j = await get(`https://www.googleapis.com/customsearch/v1?key=${k}&cx=${cx}&q=${encodeURIComponent(q)}&start=${start}`, 8000).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const i = ((j?.items || []) as { link: string }[]).findIndex((x) => /inkage\.app/.test(x.link));
      if (i >= 0) { pos = start + i; url = j.items[i].link; break; }
      if (!j?.items?.length) break;
    }
    out.push({ day, query: q, pos, url });
  }
  return `${await rows("cse_ranks", out)} keresés`;
}

/* ---------- Google's own log of ranking updates, as notes on the charts ---------- */
export async function syncGoogleUpdates() {
  const j = await get("https://status.search.google.com/incidents.json", 10000).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const r = ((j || []) as { id: string; external_desc: string; begin: string; end?: string; affected_products?: { title: string }[] }[])
    .filter((x) => /rank|update|core|spam|review/i.test(x.external_desc || "") || (x.affected_products || []).some((p) => /Ranking/i.test(p.title)))
    .slice(0, 40).map((x) => ({ id: String(x.id), title: String(x.external_desc || "").slice(0, 200), begin_at: x.begin, end_at: x.end || null }));
  const n = await rows("google_updates", r);
  await call("admin_w_update_notes").catch(() => null);
  return `${n} frissítés`;
}
