/* The brand and the site, watched every day: mentions on the web, what the AI assistants recommend, the
   competitors' social numbers, the hashtag, the release running, the certificate and the domain, and the alert
   rules. Server-only. */
import { connect as tlsConnect } from "node:tls";
import { call, env, log } from "./server";
import { GRAPH, accToken } from "./social";
import { notifyOne } from "./push";

const rows = (table: string, r: Record<string, unknown>[]) => (r.length ? call<number>("admin_w_rows", { p_table: table, p_rows: r }) : Promise.resolve(0));
const get = (url: string, ms = 10000, headers: Record<string, string> = {}) => fetch(url, { signal: AbortSignal.timeout(ms), headers: { "user-agent": "InkAgeWatch/1.0 (+https://inkage.app)", ...headers } });
const strip = (h: string) => h.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
/* "InkAge" alone can mean other things: only mentions of inkage.app, or InkAge together with tattoos (in the main languages) */
const ours = (t: string) => /inkage\.app/i.test(t) || (/inkage/i.test(t) && /tattoo|tetoválás|tetov|tätowier|tatuaje|tatuagem|tatouage|tatuaggi|tatuaż|tatoeage|dövme|tatuering|tatovering|тату/i.test(t));
/* an AI answer line naming InkAge: ours, unless it is clearly about an office suite (a name clash kept from the template) */
const SUITE = /inkage\s*(suite|office|words|sheets|stage|plan|flow|karbon|author)|\bkde\b|koffice|libreoffice|openoffice|office suite|irodai (programcsomag|csomag)/i;
const oursAi = (line: string) => /inkage\.app/i.test(line) || (/inkage/i.test(line) && !SUITE.test(line));

export async function syncMentions() {
  const out: Record<string, unknown>[] = [];
  const hn = await get("https://hn.algolia.com/api/v1/search_by_date?query=inkage.app&tags=(story,comment)").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  for (const h of hn?.hits || []) out.push({ source: "hackernews", id: String(h.objectID), title: h.title || h.story_title || "Hacker News", url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, author: h.author, snippet: strip(h.comment_text || h.story_text || "").slice(0, 300), at: h.created_at });
  /* Reddit often blocks server addresses (403, or an HTML page): that is a failed source, not "no mentions" */
  let rdErr = "";
  const rd = await get("https://www.reddit.com/search.json?q=%22inkage.app%22%20OR%20%22inkage%20app%22&sort=new&limit=25")
    .then(async (r) => { const j = r.ok ? await r.json().catch(() => null) : null; if (!j?.data) rdErr = r.ok ? "nem JSON-t adott" : `HTTP ${r.status}`; return j; })
    .catch((e) => { rdErr = /abort|timeout/i.test(String((e as Error)?.name || e)) ? "időtúllépés" : "nem válaszolt"; return null; });
  for (const c of rd?.data?.children || []) { const p = c.data || {}; out.push({ source: "reddit", id: String(p.id), title: p.title, url: `https://www.reddit.com${p.permalink}`, author: p.author, snippet: String(p.selftext || "").slice(0, 300), at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null }); }
  for (const hl of ["hu", "en"]) {
    const x = await get(`https://news.google.com/rss/search?q=%22inkage.app%22&hl=${hl}`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    for (const it of x.split("<item>").slice(1, 20)) { const t = strip(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""), l = strip(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ""); out.push({ source: "news", id: l.slice(-120), title: t, url: l, author: strip(it.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || ""), snippet: "", at: it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ? new Date(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)![1]).toISOString() : null }); }
  }
  /* YouTube: videos that mention inkage.app (with the channel's own sign-in, or a YouTube API key) */
  const yt = await accToken("youtube").catch(() => null), ykey = env().YOUTUBE_API_KEY;
  if (yt || ykey) {
    const j = await get(`${GRAPH.YT}/search?part=snippet&type=video&order=date&maxResults=20&q=%22inkage.app%22${ykey && !yt ? "&key=" + ykey : ""}`, 10000, yt ? { authorization: `Bearer ${yt.tok}` } : {}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    for (const v of j?.items || []) out.push({ source: "youtube", id: v.id?.videoId, title: v.snippet?.title, url: `https://www.youtube.com/watch?v=${v.id?.videoId}`, author: v.snippet?.channelTitle, snippet: String(v.snippet?.description || "").slice(0, 300), at: v.snippet?.publishedAt });
  }
  /* Instagram: the newest posts of the #inkage hashtag (through the Facebook connection) */
  const ig = await accToken("instagram").catch(() => null);
  if (ig?.viaFacebook && ig.id) {
    const h = await get(`${GRAPH.FB}/ig_hashtag_search?user_id=${ig.id}&q=inkage&access_token=${encodeURIComponent(ig.tok)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const hid = h?.data?.[0]?.id;
    if (hid) {
      const m = await get(`${GRAPH.FB}/${hid}/recent_media?user_id=${ig.id}&fields=id,caption,permalink,timestamp&access_token=${encodeURIComponent(ig.tok)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      for (const p of m?.data || []) out.push({ source: "instagram", id: p.id, title: "#inkage", url: p.permalink, author: null, snippet: String(p.caption || "").slice(0, 300), at: p.timestamp });
    }
  }
  const keep = out.filter((x) => x.id && (x.source === "instagram" || ours(`${x.title} ${x.snippet} ${x.url}`)));
  const n = await rows("brand_mentions", keep);
  for (const x of keep.slice(0, 3)) await notifyOne("mention", `${x.source}:${x.id}`, `Említés: ${x.source === "news" ? "hír" : x.source}`, String(x.title || x.snippet || "").slice(0, 140), "/admin#brand").catch(() => null);
  /* "részben:" keeps the daily watch green but the freshness row shows the mentions as incomplete (Reddit blocks often) */
  return rdErr ? `részben: a Reddit kimaradt (${rdErr}); ${n} említés a többi forrásból` : `${n} említés`;
}

/* competitors' public numbers: Instagram (Business Discovery, through the Facebook connection) and YouTube */
export async function syncSocialCompetitors(list: { platform: string; handle: string }[]) {
  const day = new Date().toISOString().slice(0, 10), out: Record<string, unknown>[] = [];
  const ig = await accToken("instagram").catch(() => null), yt = await accToken("youtube").catch(() => null), ykey = env().YOUTUBE_API_KEY;
  for (const c of list) {
    if (c.platform === "instagram" && ig?.viaFacebook && ig.id) {
      const j = await get(`${GRAPH.FB}/${ig.id}?fields=business_discovery.username(${encodeURIComponent(c.handle)}){name,followers_count,media_count,profile_picture_url,media.limit(12){like_count,comments_count}}&access_token=${encodeURIComponent(ig.tok)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const b = j?.business_discovery; if (!b) continue;
      const media = (b.media?.data || []) as { like_count?: number; comments_count?: number }[];
      out.push({ platform: "instagram", handle: c.handle, day, name: b.name, followers: b.followers_count, posts: b.media_count, avatar: b.profile_picture_url,
        avg_likes: media.length ? media.reduce((t, m) => t + (m.like_count || 0), 0) / media.length : null, avg_comments: media.length ? media.reduce((t, m) => t + (m.comments_count || 0), 0) / media.length : null });
    }
    if (c.platform === "youtube" && (yt || ykey)) {
      const j = await get(`${GRAPH.YT}/channels?part=snippet,statistics&forHandle=${encodeURIComponent("@" + c.handle)}${ykey && !yt ? "&key=" + ykey : ""}`, 10000, yt ? { authorization: `Bearer ${yt.tok}` } : {}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const ch = j?.items?.[0]; if (!ch) continue;
      out.push({ platform: "youtube", handle: c.handle, day, name: ch.snippet?.title, followers: Number(ch.statistics?.subscriberCount) || null, posts: Number(ch.statistics?.videoCount) || null, avatar: ch.snippet?.thumbnails?.default?.url,
        avg_likes: Number(ch.statistics?.viewCount) && Number(ch.statistics?.videoCount) ? Number(ch.statistics.viewCount) / Number(ch.statistics.videoCount) : null });
    }
  }
  return `${await rows("social_competitor_daily", out)} versenytárs`;
}

/* ---------- what the AI assistants recommend: the same questions every week, in Hungarian and English ---------- */
const QUESTIONS: [string, string][] = [
  ["hu", "Melyik a legjobb app, amivel előre megnézhetem, hogyan nézne ki egy tetoválás a bőrömön?"], ["hu", "Hogyan láthatom előre, milyen lesz a tetoválásom 10–20 év múlva?"], ["hu", "Van olyan app, ami megmutatja, hogyan öregszik egy tetoválás?"],
  ["hu", "Milyen alkalmazást ajánlasz tetoválás kipróbálásához fotón?"], ["hu", "Melyik tetoválás-előnézet app a legjobb 2026-ban?"], ["hu", "Hogyan dönthetem el, melyik testrészre tegyem a tetoválást?"],
  ["en", "What is the best app to preview a tattoo on my skin?"], ["en", "How can I see what my tattoo will look like in 20 years?"], ["en", "Which tattoo try-on app do you recommend?"],
  ["en", "Is there an app that shows how a tattoo ages over time?"], ["en", "Best AI tattoo preview tools in 2026"], ["en", "How do I know if a fine-line tattoo will blur with age?"],
];
/* One answer, or why there is none. Every call has its own time limit: one slow model never eats the whole run. */
const AI_TIMEOUT = 45_000;
async function ask(model: string, q: string): Promise<{ a: string | null; err?: string }> {
  const e = env(), sig = AbortSignal.timeout(AI_TIMEOUT);
  const fail = (x: unknown) => ({ a: null, err: /abort|timeout/i.test(String((x as Error)?.name || x)) ? "időtúllépés" : String((x as Error)?.message || x).slice(0, 80) });
  try {
    if (model === "claude" && e.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: sig, headers: { "x-api-key": e.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: e.ADMIN_AIVIS_MODEL || "claude-haiku-5-5", max_tokens: 900, messages: [{ role: "user", content: q }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { a: null, err: `HTTP ${r.status}` };
      return { a: ((j.content || []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("\n") || null };
    }
    if (model === "chatgpt" && e.OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: sig, headers: { authorization: `Bearer ${e.OPENAI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: e.OPENAI_MODEL || "gpt-5-mini", messages: [{ role: "user", content: q }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { a: null, err: `HTTP ${r.status}` };
      return { a: j.choices?.[0]?.message?.content || null };
    }
    if (model === "perplexity" && e.PERPLEXITY_API_KEY) {
      const r = await fetch("https://api.perplexity.ai/chat/completions", { method: "POST", signal: sig, headers: { authorization: `Bearer ${e.PERPLEXITY_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: e.PERPLEXITY_MODEL || "sonar", messages: [{ role: "user", content: q }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { a: null, err: `HTTP ${r.status}` };
      return { a: j.choices?.[0]?.message?.content || null };
    }
  } catch (x) { return fail(x); }
  return { a: null, err: "nincs kulcs" };
}
/* The three models side by side, each through its twelve questions; every answer is saved the moment it arrives, so a
   cut-off run keeps what it already has. The run stops asking after 4 minutes (the route may run 5). */
export async function syncAiVisibility() {
  const day = new Date().toISOString().slice(0, 10), t0 = Date.now(), DEADLINE = 240_000;
  let saved = 0, skipped = 0; const errs: string[] = [];
  const e = env(), models = ([["claude", e.ANTHROPIC_API_KEY], ["chatgpt", e.OPENAI_API_KEY], ["perplexity", e.PERPLEXITY_API_KEY]] as const).filter(([, k]) => k).map(([m]) => m);
  /* no AI key yet: nothing to ask, which is not a failure (the Kapcsolatok page shows the missing key) */
  if (!models.length) { await log("aivis", true, 0, "kihagyva: nincs MI-kulcs (Kapcsolatok → MI)"); return "kihagyva: nincs MI-kulcs"; }
  await Promise.all(models.map(async (model) => {
    for (const [lang, q] of QUESTIONS) {
      if (Date.now() - t0 > DEADLINE) { skipped++; continue; }
      const { a, err } = await ask(model, q);
      if (!a) { errs.push(`${model}: ${err || "üres válasz"}`); continue; }
      /* the apps it names, in its order: numbered or bulleted lines, the bold or the first words */
      const lines = a.split("\n"), named = lines.map((l) => ({ l, k: l.match(/^\s*(?:\d+[.)]|[-*•])\s*\**([^*:–—\-(]{2,40})/)?.[1]?.trim() })).filter((x): x is { l: string; k: string } => !!x.k);
      /* the KDE office suite named "InkAge" is not us: judged by the line it stands in */
      const rank = named.findIndex((x) => /inkage/i.test(x.k) && oursAi(x.l));
      try {
        saved += await rows("ai_visibility", [{ day, model, question: q, lang, mentioned: lines.some(oursAi), rank: rank >= 0 ? rank + 1 : null, competitors: named.filter((x) => !/inkage/i.test(x.k)).map((x) => x.k).slice(0, 8), answer: a.slice(0, 1800) }]);
      } catch (x) { errs.push(`${model}: mentés: ${String((x as Error)?.message || x).slice(0, 60)}`); }
    }
  }));
  const total = models.length * QUESTIONS.length, ok = saved > 0 && saved >= total * 0.75;
  const msg = `${saved} / ${total} válasz` + (skipped ? `, ${skipped} kimaradt (időkorlát)` : "") + (errs.length ? ` · hibák: ${Array.from(new Set(errs)).slice(0, 4).join("; ")}` : "");
  await log("aivis", ok, saved, msg);
  return ok ? msg : "hiba: " + msg;
}

/* ---------- the release running now, the certificate and the domain, the alert rules ---------- */
/* (server.ts records the release on the first request of every instance too; this stays for the daily watch) */
export async function recordRelease() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA; if (!sha) return;
  await rows("admin_releases", [{ sha: sha.slice(0, 12), msg: String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "").split("\n")[0].slice(0, 200) }]).catch(() => null);
}
function cert(host: string) {
  return new Promise<{ valid_to: string | null; issuer: string | null }>((res) => {
    const s = tlsConnect({ host, port: 443, servername: host, timeout: 8000 }, () => { const c = s.getPeerCertificate(); s.end(); res({ valid_to: c?.valid_to ? new Date(c.valid_to).toISOString() : null, issuer: (c?.issuer?.O as string) || null }); });
    s.on("error", () => res({ valid_to: null, issuer: null })); s.on("timeout", () => { s.destroy(); res({ valid_to: null, issuer: null }); });
  });
}
export async function syncCerts() {
  const out: Record<string, unknown>[] = [];
  for (const host of ["inkage.app"]) {
    const c = await cert(host);
    const rd = await get(`https://rdap.org/domain/${host}`, 10000).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const exp = ((rd?.events || []) as { eventAction: string; eventDate: string }[]).find((e) => e.eventAction === "expiration")?.eventDate || null;
    /* a failed read keeps the last known dates (only the columns present are written) */
    out.push({ host, ...(c.valid_to ? { valid_to: c.valid_to, issuer: c.issuer } : {}), ...(exp ? { domain_expires: exp } : {}), checked_at: new Date().toISOString() });
    if (!c.valid_to) { await rows("cert_status", out); throw new Error(`${host}: a tanúsítvány nem olvasható`); }
  }
  return `${await rows("cert_status", out)} tanúsítvány`;
}
/* Every 5 minutes (with the rules): each watched address fetched from this server, timed with performance.now(), one
   row per address. The database's own check (pg_net) only tells whether it answered: its "time" was its queue's. */
export async function measureUptime() {
  const targets = await call<{ url: string; ok_max: number }[]>("admin_r_uptime_targets");
  const rows = await Promise.all((targets || []).map(async (t) => {
    const t0 = performance.now();
    try {
      const r = await fetch(t.url, { cache: "no-store", redirect: "manual", headers: { "user-agent": "InkAgeUptime/1.0 (+https://inkage.app)" }, signal: AbortSignal.timeout(15_000) });
      await r.arrayBuffer().catch(() => null); /* the whole answer, not only its first byte */
      return { url: t.url, status: r.status, ms: Math.round(performance.now() - t0), ok: r.status >= 200 && r.status <= (t.ok_max || 399) };
    } catch { return { url: t.url, status: null, ms: Math.round(performance.now() - t0), ok: false }; }
  }));
  if (rows.length) await call("admin_w_uptime", { p_rows: rows });
  return `${rows.length} cím mérve`;
}

const RULE: Record<string, string> = { errors: "hiba", sessions: "látogatás", scored: "kész előnézet", score_rate: "előnézetig jutók %", down: "kiesés", latency: "válaszidő (ms)", signups: "regisztráció",
  ...Object.fromEntries(Object.entries({ tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube" }).flatMap(([k, l]) => [["pf_views:" + k, `${l}-megtekintés`], ["pf_visits:" + k, `${l}-látogatás`], ["pf_followers:" + k, `${l}-követőváltozás`]])) };
/* Every 5 minutes (admin-rules). A rule that fires goes to the channels chosen for it: the phone (push), Telegram,
   e-mail. A failed channel throws, so the run is recorded as failed. */
export async function checkRules() {
  const fired = await call<{ id: number; metric: string; op: string; threshold: number; window_min: number; value: number; channels?: string[] }[]>("admin_r_rules");
  const errs: string[] = [];
  for (const f of fired) {
    const win = f.window_min < 60 ? `${f.window_min} percben` : f.window_min < 1440 ? `${f.window_min / 60} órában` : `${f.window_min / 1440} napban`;
    const title = `Riasztás: ${RULE[f.metric] || f.metric}`, body = `${f.value} az elmúlt ${win} (a szabály: ${f.op} ${f.threshold}).`;
    const ch = f.channels?.length ? f.channels : ["push"];
    if (ch.includes("push")) await notifyOne("rule", `${f.id}:${new Date().toISOString().slice(0, 13)}`, title, body, "/admin#monitor").catch((x) => errs.push("push: " + String(x)));
    if (ch.includes("telegram")) await telegram(`${title}\n${body}`).catch((x) => errs.push("telegram: " + String((x as Error)?.message || x)));
    if (ch.includes("email")) await email(title, body).catch((x) => errs.push("e-mail: " + String((x as Error)?.message || x)));
  }
  if (errs.length) throw new Error(errs.join(" · ").slice(0, 300));
  return fired.length;
}
async function telegram(text: string) {
  const e = env();
  if (!e.TELEGRAM_BOT_TOKEN || !e.TELEGRAM_CHAT_ID) throw new Error("nincs Telegram-bot beállítva");
  const r = await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: e.TELEGRAM_CHAT_ID, text }), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error("Telegram " + r.status);
}
async function email(subject: string, text: string) {
  const e = env();
  if (!e.RESEND_API_KEY) throw new Error("nincs RESEND_API_KEY");
  /* the admins' addresses only (admin_r_recipients); the whole digest is read only until that function exists */
  const to = (await call<string[]>("admin_r_recipients").catch(() => null)) ?? (await call<{ to: string[] }>("admin_digest_t").catch(() => ({ to: [] as string[] }))).to;
  if (!to?.length) throw new Error("nincs címzett");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: e.RESEND_FROM || "InkAge <hello@inkage.app>", to, subject: `InkAge · ${subject}`, text }), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error("Resend " + r.status);
}

export async function runWatch() {
  const w = await call<{ sites: { domain: string; sitemap: string | null }[]; social: { platform: string; handle: string }[]; known_pages: string[]; tracked: string[]; top_queries: string[] }>("admin_r_watch");
  const out: Record<string, string> = {};
  const step = async (k: string, f: () => Promise<string | number>) => { try { out[k] = String(await f()); } catch (e) { out[k] = "hiba: " + String((e as Error)?.message || e).slice(0, 80); } };
  const seo = await import("./seo"), gsc = await import("./gsc");
  await step("mentions", syncMentions);
  await step("competitors", () => syncSocialCompetitors(w.social));
  await step("sites", () => seo.syncCompetitorSites(w));
  await step("updates", seo.syncGoogleUpdates);
  await step("bing", seo.syncBing);
  await step("cse", () => seo.syncCse(w));
  await step("appearance", gsc.syncAppearance);
  await step("certs", syncCerts);
  if (new Date().getUTCDay() === 2) await step("ideas", seo.syncKwIdeas);
  await recordRelease();
  /* honest: the watch counts as failed when any of its steps failed (the steps without a key say "nincs", that is no failure) */
  const bad = Object.entries(out).filter(([, v]) => /^hiba/i.test(v));
  await log("watch", !bad.length, null, (bad.length ? `${bad.length} lépés hibás · ` : "") + Object.entries(out).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 440));
  return out;
}
