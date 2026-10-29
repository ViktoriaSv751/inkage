/* TikTok, Instagram, Facebook (page), Pinterest and LinkedIn (company page): the owner connects her own accounts once
   (OAuth), then the hourly sync reads followers and every post's numbers through the platforms' official APIs into the
   admin tables: exactly the counts the platforms give out, nothing estimated. Server-only. */
import { SITE, call, env, log, patchAccount, upsert } from "./server";

export type Platform = "tiktok" | "instagram" | "facebook" | "pinterest" | "linkedin" | "youtube";
export const PLATFORMS: Platform[] = ["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"];
/* the app keys each platform needs on the Kapcsolatok page */
export const KEYS: Record<Platform, [string, string]> = {
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"], facebook: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
  pinterest: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"], linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
};
const YT = "https://www.googleapis.com/youtube/v3";
const FB = "https://graph.facebook.com/v23.0";
const LI = { "LinkedIn-Version": "202509", "X-Restli-Protocol-Version": "2.0.0" };
const ymdUtc = (d: Date) => d.toISOString().slice(0, 10);
const redirect = (p: Platform) => `${SITE}/api/admin/callback/${p}`;
/* the snapshot's day is the Budapest calendar day (the dashboard counts days in Budapest; UTC put 0-2 a.m. on the day before).
   The platforms' own day numbers (dayOf, the API ranges) stay on the day the platform reports them for. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const plus = (sec?: number) => (sec ? new Date(Date.now() + sec * 1000).toISOString() : null);
/* the short-link code a caption points at: "inkage.app/go/12" → "12" */
const codeIn = (s?: string | null) => (s?.match(/inkage\.app\/go\/([a-z0-9-]{1,40})/i)?.[1] || null)?.toLowerCase() || null;
/* a pin's link with utm_content (inkage.app/app?…&utm_content=P16): the measuring keeps it as the visit's "ux", the
   same key the short links' visitors are counted by, so the pin gets its visitors */
const utmCode = (link?: string | null) => { try { return (link && new URL(link).searchParams.get("utm_content")?.slice(0, 40)) || null; } catch { return null; } };

async function json(r: Response) {
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; } // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r.ok || j?.error?.code && j.error.code !== "ok" || j?.error_message) throw new Error(`${r.status} ${JSON.stringify(j?.error || j?.error_message || j).slice(0, 240)}`);
  return j;
}

/* the "Kipróbálom" button: TikTok hands out an app-only token for a correct key + secret pair */
export async function testTiktok(): Promise<{ ok: boolean; msg: string }> {
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY || "", client_secret: env().TIKTOK_CLIENT_SECRET || "", grant_type: "client_credentials" }) });
  const j = await r.json().catch(() => ({}));
  return j.access_token ? { ok: true, msg: "A kulcsok jók. Most jöhet az Összekapcsolás." } : { ok: false, msg: `A TikTok nem fogadta el a kulcsokat (${String(j.error_description || j.error || r.status).slice(0, 120)}). Nézd meg, hogy a Client key és a Client secret ugyanabból az appból van-e.` };
}

/* ---------- sign-in ---------- */
/* the write permissions publishing from the planner needs, asked only when she switches publishing on (a reconnect) */
const PUBLISH: Record<Platform, string> = { tiktok: ",video.publish,video.upload", instagram: ",instagram_business_content_publish", facebook: ",pages_manage_posts,instagram_content_publish",
  pinterest: ",pins:write,boards:write", linkedin: " w_organization_social", youtube: " https://www.googleapis.com/auth/youtube.upload" };
export function authUrl(p: Platform, state: string, publish = false) {
  const extra = publish ? PUBLISH[p] : "";
  if (p === "tiktok") {
    const q = new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY || "", response_type: "code", redirect_uri: redirect(p), state,
      scope: "user.info.basic,user.info.profile,user.info.stats,video.list" + extra });
    return "https://www.tiktok.com/v2/auth/authorize/?" + q;
  }
  if (p === "facebook") {
    const q = new URLSearchParams({ client_id: env().FACEBOOK_APP_ID || "", redirect_uri: redirect(p), response_type: "code", state,
      scope: "pages_show_list,pages_read_engagement,read_insights,pages_read_user_content,pages_manage_engagement,instagram_basic,instagram_manage_insights,instagram_manage_comments" + extra });
    return "https://www.facebook.com/v23.0/dialog/oauth?" + q;
  }
  if (p === "pinterest") {
    const q = new URLSearchParams({ client_id: env().PINTEREST_APP_ID || "", redirect_uri: redirect(p), response_type: "code", state,
      scope: "user_accounts:read,boards:read,pins:read" + extra });
    return "https://www.pinterest.com/oauth/?" + q;
  }
  if (p === "youtube") {
    const q = new URLSearchParams({ client_id: env().YOUTUBE_CLIENT_ID || "", redirect_uri: redirect(p), response_type: "code", state, access_type: "offline", prompt: "consent",
      scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.force-ssl" + extra });
    return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
  }
  if (p === "linkedin") {
    const q = new URLSearchParams({ response_type: "code", client_id: env().LINKEDIN_CLIENT_ID || "", redirect_uri: redirect(p), state,
      scope: "r_organization_social rw_organization_admin" + extra });
    return "https://www.linkedin.com/oauth/v2/authorization?" + q;
  }
  const q = new URLSearchParams({ client_id: env().INSTAGRAM_APP_ID || "", redirect_uri: redirect(p), response_type: "code", state,
    scope: "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments" + extra, enable_fb_login: "0" });
  return "https://www.instagram.com/oauth/authorize?" + q;
}

const pinBasic = () => "Basic " + Buffer.from(`${env().PINTEREST_APP_ID}:${env().PINTEREST_APP_SECRET}`).toString("base64");

export async function connect(p: Platform, code: string) {
  if (p === "facebook") {
    const s = await json(await fetch(`${FB}/oauth/access_token?${new URLSearchParams({ client_id: env().FACEBOOK_APP_ID!, client_secret: env().FACEBOOK_APP_SECRET!, redirect_uri: redirect(p), code })}`));
    /* a long-lived user token, and from it the page's own token, which does not expire */
    const l = await json(await fetch(`${FB}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: env().FACEBOOK_APP_ID!, client_secret: env().FACEBOOK_APP_SECRET!, fb_exchange_token: s.access_token })}`));
    const pages = (await json(await fetch(`${FB}/me/accounts?fields=id,name,access_token&limit=50&access_token=${encodeURIComponent(l.access_token)}`))).data || [];
    if (!pages.length) throw new Error("Ehhez a Facebook-fiókhoz nem tartozik oldal, amit kezelsz. Egy Facebook-oldal (pl. InkAge) kell hozzá.");
    const pg = pages.find((x: { name: string }) => /inkage/i.test(x.name)) || pages[0];
    await saveAccount(p, { account_id: pg.id, access_token: pg.access_token, refresh_token: null, token_expires_at: null, refresh_expires_at: null, scopes: "pages_read_engagement,read_insights" });
    /* the Instagram account linked to the page comes along: no Instagram app needed (unless one is connected already) */
    const ig = (await fetch(`${FB}/${pg.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pg.access_token)}`).then((r) => r.json()).catch(() => ({}))).instagram_business_account;
    const have = (await call<Acc[]>("admin_r_accounts")).find((a) => a.platform === "instagram" && !viaFb(a));
    if (ig?.id && !have) await saveAccount("instagram", { account_id: ig.id, access_token: pg.access_token, refresh_token: null, token_expires_at: null, refresh_expires_at: null, scopes: "via_facebook" });
    return;
  }
  if (p === "youtube") {
    const t = await json(await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env().YOUTUBE_CLIENT_ID!, client_secret: env().YOUTUBE_CLIENT_SECRET!, redirect_uri: redirect(p), grant_type: "authorization_code" }) }));
    const ch = (await json(await fetch(`${YT}/channels?part=id&mine=true`, { headers: { authorization: `Bearer ${t.access_token}` } }))).items?.[0]?.id;
    if (!ch) throw new Error("Ehhez a Google-fiókhoz nem tartozik YouTube-csatorna.");
    await saveAccount(p, { account_id: ch, access_token: t.access_token, refresh_token: t.refresh_token || null, token_expires_at: plus(t.expires_in), refresh_expires_at: null, scopes: t.scope || null });
    return;
  }
  if (p === "pinterest") {
    const t = await json(await fetch("https://api.pinterest.com/v5/oauth/token", { method: "POST", headers: { authorization: pinBasic(), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect(p) }) }));
    await saveAccount(p, { account_id: null, access_token: t.access_token, refresh_token: t.refresh_token || null, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_token_expires_in), scopes: t.scope || null });
    return;
  }
  if (p === "linkedin") {
    const t = await json(await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect(p), client_id: env().LINKEDIN_CLIENT_ID!, client_secret: env().LINKEDIN_CLIENT_SECRET! }) }));
    /* the company page she administers */
    const acl = await json(await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", { headers: { authorization: `Bearer ${t.access_token}`, ...LI } }));
    const org = String(acl.elements?.[0]?.organization || "").split(":").pop() || null;
    if (!org) throw new Error("Ehhez a LinkedIn-fiókhoz nem tartozik céges oldal, amit adminisztrálsz.");
    await saveAccount(p, { account_id: org, access_token: t.access_token, refresh_token: t.refresh_token || null, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_token_expires_in), scopes: t.scope || null });
    return;
  }
  if (p === "tiktok") {
    const t = await json(await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, client_secret: env().TIKTOK_CLIENT_SECRET!, code, grant_type: "authorization_code", redirect_uri: redirect(p) }),
    }));
    await saveAccount(p, { account_id: t.open_id, access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_expires_in), scopes: t.scope });
  } else {
    const s = await json(await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env().INSTAGRAM_APP_ID!, client_secret: env().INSTAGRAM_APP_SECRET!, grant_type: "authorization_code", redirect_uri: redirect(p), code }),
    }));
    const short = s.access_token || s.data?.[0]?.access_token;
    /* the short token lasts an hour; swap it for the 60-day one, which the daily sync keeps renewing */
    const l = await json(await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: env().INSTAGRAM_APP_SECRET!, access_token: short })}`));
    await saveAccount(p, { account_id: String(s.user_id || s.data?.[0]?.user_id || ""), access_token: l.access_token, refresh_token: null, token_expires_at: plus(l.expires_in), refresh_expires_at: null, scopes: (s.permissions || []).join?.(",") || null });
  }
}

async function saveAccount(p: Platform, a: Record<string, unknown>) {
  await upsert("social_accounts", [{ platform: p, ...a, connected_at: new Date().toISOString(), last_error: null }], "platform");
}

type Acc = { platform: Platform; account_id: string | null; access_token: string; refresh_token: string | null; token_expires_at: string | null; last_sync_at?: string | null; scopes?: string | null };
/* Instagram through the Facebook page (graph.facebook.com, the account's id) or through its own login (graph.instagram.com, "me"):
   told by what connecting saved (scopes "via_facebook"), else by the token itself (Instagram's own login gives "IG…" tokens),
   never by a missing expiry (a refresh without expires_in used to turn an Instagram login into a Facebook one) */
const viaFb = (a: Acc) => a.platform === "instagram" && (a.scopes ? a.scopes === "via_facebook" : !/^IG/.test(a.access_token || ""));
/* a number the platform gave, or null (never 0 for "not given", never NaN) */
const num = (x: unknown): number | null => (x == null || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const dayOf = (ms: number) => ymdUtc(new Date(ms));

/* a fresh token: TikTok's lasts a day (refreshed with the year-long refresh token), Instagram's 60 days (renewed in place) */
async function token(a: Acc) {
  const left = a.token_expires_at ? new Date(a.token_expires_at).getTime() - Date.now() : 0;
  if (a.platform === "tiktok" && left < 3600_000 && a.refresh_token) {
    const t = await json(await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, client_secret: env().TIKTOK_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: a.refresh_token }),
    }));
    await patchAccount("tiktok", { access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_expires_in) });
    return t.access_token as string;
  }
  if (a.platform === "instagram" && !viaFb(a) && left < 20 * 86400_000) {
    const t = await json(await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.access_token)}`));
    /* a refreshed token lasts 60 days; without expires_in in the answer it is still those 60 days, never "no expiry" */
    await patchAccount("instagram", { access_token: t.access_token, token_expires_at: plus(t.expires_in) || plus(60 * 86400) });
    return t.access_token as string;
  }
  if (a.platform === "pinterest" && left < 3 * 86400_000 && a.refresh_token) {
    const t = await json(await fetch("https://api.pinterest.com/v5/oauth/token", { method: "POST", headers: { authorization: pinBasic(), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: a.refresh_token }) }));
    await patchAccount("pinterest", { access_token: t.access_token, ...(t.refresh_token ? { refresh_token: t.refresh_token, refresh_expires_at: plus(t.refresh_token_expires_in) } : {}), token_expires_at: plus(t.expires_in) });
    return t.access_token as string;
  }
  if (a.platform === "linkedin" && left < 5 * 86400_000 && a.refresh_token) {
    const t = await json(await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: a.refresh_token, client_id: env().LINKEDIN_CLIENT_ID!, client_secret: env().LINKEDIN_CLIENT_SECRET! }) }));
    await patchAccount("linkedin", { access_token: t.access_token, refresh_token: t.refresh_token || a.refresh_token, token_expires_at: plus(t.expires_in) });
    return t.access_token as string;
  }
  if (a.platform === "youtube" && left < 5 * 60_000 && a.refresh_token) {
    const t = await json(await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env().YOUTUBE_CLIENT_ID!, client_secret: env().YOUTUBE_CLIENT_SECRET!, refresh_token: a.refresh_token, grant_type: "refresh_token" }) }));
    await patchAccount("youtube", { access_token: t.access_token, token_expires_at: plus(t.expires_in) });
    return t.access_token as string;
  }
  if (a.platform === "linkedin" && a.token_expires_at && left < 0) throw new Error("A LinkedIn-kapcsolat lejárt (60 nap). Kösd be újra a Kapcsolatok oldalon.");
  return a.access_token;
}

/* ---------- the sync ---------- */
/* `only`: just these platforms (right after connecting one), read at once and with their once-a-day parts. Without it:
   an account read in the last 10 minutes is not read again unless forced (every social page that opens asks for fresh
   numbers, on top of the hourly run), and the accounts read longest ago go first. The time budget is checked inside
   every platform too: the posts are saved page by page, and a run that runs out of time keeps what it read and says so
   in the log instead of dying silently at the route's limit. The slow once-a-day parts (demographics, YouTube retention
   and thumbnail impressions, 90 days of pin history, 60 days of LinkedIn) run when the platform's last finished daily
   part is over 23 hours old; the database keeps the time and gives the part to one run only. */
type Post = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Run = { p: Platform; t0: number; budget: number; daily: boolean; cut: boolean; limited: boolean; errs: number; why: string[]; notes: string[];
  buf: Post[]; saved: number; state: Record<string, unknown>; next: Record<string, unknown> };
class Limited extends Error {}
const over = (r: Run) => (r.cut = r.cut || Date.now() - r.t0 > r.budget);

export async function syncSocial(only?: Platform[], budgetMs = 240_000, opt: { force?: boolean; freshMs?: number } = {}) {
  const t0 = Date.now(), fresh = opt.force ? 0 : opt.freshMs ?? 10 * 60_000;
  const accs = (await call<Acc[]>("admin_r_accounts")).filter((a) => !only || only.includes(a.platform))
    .sort((a, b) => String(a.last_sync_at || "").localeCompare(String(b.last_sync_at || "")));
  /* the daily times and the rotation cursors; without the database function (not applied yet) the old 04 UTC hour */
  const state = await call<Record<string, unknown>>("admin_r_social_state").catch(() => null);
  const out: Record<string, string> = {};
  for (const a of accs) {
    if (!only && a.last_sync_at && Date.now() - new Date(a.last_sync_at).getTime() < fresh) { out[a.platform] = "friss"; continue; }
    if (Date.now() - t0 > budgetMs) { await log(a.platform, false, null, "kimaradt: elfogyott a lehúzás időkerete, a következő körben jön"); out[a.platform] = "kimaradt (időkeret)"; continue; }
    const daily = !!only || (state ? await call<boolean>("admin_w_social_daily_claim", { p_platform: a.platform }).catch(() => false) : new Date().getUTCHours() === 4);
    const r: Run = { p: a.platform, t0, budget: budgetMs, daily, cut: false, limited: false, errs: 0, why: [], notes: [], buf: [], saved: 0, state: state || {}, next: {} };
    let err: string | null = null;
    try {
      const tok = await token(a);
      if (a.platform === "tiktok") await syncTiktok(r, tok);
      else if (a.platform === "instagram") await syncInstagram(r, tok, viaFb(a) ? FB : IG, viaFb(a) ? a.account_id! : "me");
      else if (a.platform === "facebook") await syncFacebook(r, tok, a.account_id!);
      else if (a.platform === "pinterest") await syncPinterest(r, tok);
      else if (a.platform === "youtube") await syncYoutube(r, tok, a.account_id!);
      else await syncLinkedin(r, tok, a.account_id!);
    } catch (e) { if (!(e instanceof Limited)) err = String((e as Error)?.message || e); }
    /* what was read before the time, a rate limit or an error stopped it is saved all the same */
    await flush(r).catch((e) => { err = err || "mentés: " + String((e as Error)?.message || e); });
    const set: Record<string, unknown> = { ...r.next };
    if (r.daily && !err && !r.cut && !r.limited) set[`daily_${a.platform}`] = new Date().toISOString();
    if (state && Object.keys(set).length) await call("admin_w_social_state", { p_set: set }).catch(() => null);
    const extra = [r.cut && "részleges: elfogyott az időkeret, a többi a következő körben jön", ...r.notes, r.errs && `${r.errs} kérés hibás (${r.why.join("; ")})`].filter(Boolean).join(" · ");
    if (err) {
      await patchAccount(a.platform, { last_error: err.slice(0, 400) }).catch(() => {});
      await log(a.platform, false, r.saved || null, [err, r.saved && `előtte ${r.saved} poszt mentve`, extra].filter(Boolean).join(" · "));
      out[a.platform] = "hiba: " + err.slice(0, 120);
    } else {
      /* a partial or rate-limited run counts as a read too, so the page opens do not hammer it again at once */
      await patchAccount(a.platform, { last_sync_at: new Date().toISOString(), last_error: r.limited ? "a platform korlátozta a kéréseket (rate limit), a következő körben folytatja" : null }).catch(() => {});
      await log(a.platform, !r.limited, r.saved, `${r.saved} poszt frissítve${extra ? " · " + extra : ""}`);
      out[a.platform] = `${r.saved} poszt${r.cut ? ", részleges (időkeret)" : ""}${r.limited ? ", leállt (rate limit)" : ""}${r.errs ? `, ${r.errs} hibás kérés` : ""}`;
    }
  }
  /* Pinterest before its API is connected: the public profile, without any key */
  if ((!only || only.includes("pinterest")) && !accs.some((a) => a.platform === "pinterest")) out.pinterest = await syncPinterestPublic(state, opt.force || only ? 0 : fresh);
  return out;
}

/* a failed request's short reason for the log: the status and the platform's own words, never the address (it carries the token) */
const hide = (s: string) => s.replace(/(access_token|token|key|secret)=[^&\s"]+/gi, "$1=…").replace(/\s+/g, " ");
function why(t: string) {
  let j: any; try { j = JSON.parse(t); } catch { j = null; } // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = j?.error?.message || j?.error_description || j?.message || j?.error?.errors?.[0]?.reason || (typeof j?.error === "string" ? j.error : "") || t;
  return hide(String(m)).slice(0, 80);
}
const errMsg = (e: unknown) => ((e as Error)?.name === "TimeoutError" ? "időtúllépés" : hide(String((e as Error)?.message || e)).slice(0, 80));
const fail = (r: Run, m: string) => { r.errs++; if (r.why.length < 3 && !r.why.includes(m)) r.why.push(m); };

/* rate limits: HTTP 429, Meta's throttling codes (4, 17, 32, 613, 80001–80014), Google's and TikTok's rate-limit reasons */
const LIMITED = /"code":\s*(4|17|32|613|8000[1-9]|8001[0-4])\b|rateLimitExceeded|userRateLimitExceeded|rate_limit_exceeded|quotaExceeded|dailyLimitExceeded/;
/* one request of a platform's run (30 s at most): a rate limit waits (Retry-After, at most 30 s, within the budget) and
   tries once more; limited again (or out of the day's quota), the platform stops for this run */
async function req(r: Run, url: string, init: RequestInit = {}): Promise<Response> {
  if (r.limited) throw new Limited("rate limit");
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return res;
    const t = await res.text().catch(() => "");
    if (res.status !== 429 && !LIMITED.test(t)) return new Response(t, { status: res.status, headers: res.headers });
    const ra = Number(res.headers.get("retry-after")), wait = Math.min(30_000, (ra > 0 ? ra : 5) * 1000);
    if (i || /quotaExceeded|dailyLimitExceeded/.test(t) || Date.now() + wait - r.t0 > r.budget) {
      r.limited = true; r.notes.push(`a platform korlátozta a kéréseket (${res.status}), ebben a körben leállt`);
      throw new Limited("rate limit");
    }
    await sleep(wait);
  }
}
/* strict: the answer, or an exception (the platform's run fails) */
const jget = async (r: Run, url: string, init?: RequestInit) => json(await req(r, url, init));
/* soft: the answer, or null with the failure counted for the run's log (Meta's code 100, "no such metric for this post", is an answer, not a failure) */
async function soft(r: Run, url: string, init?: RequestInit): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const res = await req(r, url, init);
    if (res.ok) return await res.json().catch(() => null);
    const t = await res.text().catch(() => "");
    if (!(res.status === 400 && /"code":\s*100\b/.test(t))) fail(r, `${res.status} ${why(t)}`);
    return null;
  } catch (e) { if (e instanceof Limited) throw e; fail(r, errMsg(e)); return null; }
}
/* a side part (stories, comments, audience) may fail without failing the posts: counted; a rate limit still stops the platform */
const quiet = <T>(r: Run, x: Promise<T>) => x.catch((e) => { if (e instanceof Limited) throw e; fail(r, errMsg(e)); return null; });
const getJ = (r: Run, url: string, headers: Record<string, string>): Promise<any> => soft(r, url, { headers }).then((j) => j || {}); // eslint-disable-line @typescript-eslint/no-explicit-any

/* the posts read so far go to the database page by page */
const keep = (r: Run, p: Post) => (r.buf.push(p), p);
async function flush(r: Run) { if (r.buf.length) r.saved += await savePosts(r.p, r.buf.splice(0)); }

/* the posts newest first: `fresh` pages every run, then `older` pages from where the previous run stopped (back to the
   newest end once it reaches the oldest), so a profile with more posts than one run reads still has every post read in
   turns. `page` reads one page from a cursor (null: the first) and gives the next one (null: no more). */
async function pages(r: Run, fresh: number, older: number, page: (cur: string | null) => Promise<string | null>) {
  const k = `rot_${r.p}`;
  let cur: string | null = null;
  for (let i = 0; i < fresh; i++) { if (over(r)) return; if (!(cur = await page(cur))) { r.next[k] = null; return; } }
  const at = r.state[k];
  let from: string = typeof at === "string" && at ? at : cur!;
  for (let i = 0; i < older; i++) {
    if (over(r)) { r.next[k] = from; return; }
    let nx: string | null;
    try { nx = await page(from); } catch (e) { if (e instanceof Limited || from === cur) throw e; fail(r, "a régebbi posztok lapozója lejárt, elölről kezdi"); r.next[k] = null; return; }
    if (!nx) { r.next[k] = null; return; }
    from = nx;
  }
  r.next[k] = from;
  r.notes.push("több poszt van, mint ami egy körbe fér: a legújabbak minden körben, a régebbiek sorban");
}

async function savePosts(platform: Platform, posts: Post[]) {
  const now = new Date().toISOString(), day = today();
  await upsert("social_posts", posts.map((p) => ({ platform, updated_at: now, ...p })), "platform,post_id");
  await upsert("social_post_daily", posts.map((p) => ({ platform, post_id: p.post_id, day, views: p.views ?? null, likes: p.likes ?? null, comments: p.comments ?? null, shares: p.shares ?? null, saves: p.saves ?? null, reach: p.reach ?? null, impressions: p.impressions ?? null, clicks: p.clicks ?? null })), "platform,post_id,day");
  /* the posts of the last week hour by hour: the curve of their first 72 hours */
  const young = posts.filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 86400_000);
  if (young.length) await upsert("social_post_hourly", young.map((p) => ({ platform, post_id: p.post_id, at: now, views: p.views ?? null, likes: p.likes ?? null, comments: p.comments ?? null, shares: p.shares ?? null, saves: p.saves ?? null })), "platform,post_id,at").catch(() => null);
  return posts.length;
}

async function syncTiktok(r: Run, tok: string) {
  const h = { authorization: `Bearer ${tok}` };
  const u = (await jget(r, "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count", { headers: h })).data.user;
  await patchAccount("tiktok", { username: u.username || null, display_name: u.display_name || null, avatar_url: u.avatar_url || null });
  await upsert("social_account_daily", [{ platform: "tiktok", day: today(), followers: u.follower_count ?? null, following: u.following_count ?? null, likes: u.likes_count ?? null, posts: u.video_count ?? null }], "platform,day");
  const fields = "id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count";
  /* 20 a page: the newest 200 every run, then 100 older ones in turns (300 a run, as before) */
  await pages(r, 10, 5, async (cur) => {
    const j = (await jget(r, `https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify(cur ? { max_count: 20, cursor: Number(cur) } : { max_count: 20 }) })).data;
    for (const v of j.videos || []) {
      const text = [v.title, v.video_description].filter(Boolean).join(" ");
      keep(r, { post_id: String(v.id), created_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null, kind: "video", title: (v.title || v.video_description || "").slice(0, 300),
        url: v.share_url || null, thumb: v.cover_image_url || null, duration: v.duration ?? null, code: codeIn(text),
        views: v.view_count ?? null, likes: v.like_count ?? null, comments: v.comment_count ?? null, shares: v.share_count ?? null });
    }
    await flush(r);
    return j.has_more && j.cursor ? String(j.cursor) : null;
  });
}

const IG = "https://graph.instagram.com/v23.0";
async function syncInstagram(r: Run, tok: string, base = IG, id = "me") {
  const me = await jget(r, `${base}/${id}?fields=${base === IG ? "user_id," : ""}username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(tok)}`);
  await patchAccount("instagram", { username: me.username || null, display_name: me.name || null, avatar_url: me.profile_picture_url || null });
  /* the day numbers of yesterday, a whole day (without since/until Instagram gives today's partial day), on yesterday's row */
  const d0 = new Date(); d0.setUTCHours(0, 0, 0, 0); const until = Math.floor(d0.getTime() / 1000), since = until - 86400;
  const igm = async (metric: string) => (await soft(r, `${base}/${id}/insights?metric=${metric}&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${encodeURIComponent(tok)}`))?.data?.[0]?.total_value?.value ?? null;
  /* new followers day by day (the last 30 days Instagram gives) */
  const fc = await soft(r, `${base}/${id}/insights?metric=follower_count&period=day&access_token=${encodeURIComponent(tok)}`);
  const gains = ((fc?.data?.[0]?.values || []) as { value?: number; end_time?: string }[]).filter((v) => v.end_time && v.value != null)
    .map((v) => ({ platform: "instagram", day: dayOf(new Date(v.end_time!).getTime() - 86400_000), gained: v.value }));
  await upsert("social_account_daily", [{ platform: "instagram", day: today(), followers: me.followers_count ?? null, following: me.follows_count ?? null, posts: me.media_count ?? null },
    { platform: "instagram", day: dayOf(since * 1000), reach: await igm("reach"), profile_views: await igm("profile_views"), impressions: await igm("views") }, ...gains], "platform,day");
  /* the stories first: their numbers last 24 hours only, so a long post round must not crowd them out */
  await quiet(r, igStories(r, tok, base, id));
  const posts: Post[] = [];
  /* 50 a page: the newest 200 every run, then 100 older ones in turns (300 a run, as before) */
  await pages(r, 4, 2, async (cur) => {
    const j: any = await jget(r, `${base}/${id}/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50${cur ? "&after=" + encodeURIComponent(cur) : ""}&access_token=${encodeURIComponent(tok)}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const m of j.data || []) {
      const p: Post = { post_id: m.id, created_at: m.timestamp || null, kind: (m.media_product_type === "REELS" ? "reel" : String(m.media_type || "").toLowerCase()) || null,
        title: (m.caption || "").slice(0, 300), url: m.permalink || null, thumb: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null) || null,
        code: codeIn(m.caption), likes: m.like_count ?? null, comments: m.comments_count ?? null };
      /* views, reach, saves and shares come from the insights of posts from the last 90 days (older ones keep their last
         numbers); once the time is up, the rest keep their likes and comments only */
      if (m.timestamp && Date.now() - new Date(m.timestamp).getTime() < 90 * 86400_000 && !over(r)) Object.assign(p, await igInsights(r, m.id, tok, base));
      posts.push(keep(r, p));
    }
    await flush(r);
    return j.paging?.next ? j.paging?.cursors?.after || null : null;
  });
  if (r.daily && !over(r)) await quiet(r, igAudience(r, tok, base, id));
  if (!over(r)) await quiet(r, igComments(r, tok, base, posts.filter((p) => p.comments !== 0 && p.created_at && Date.now() - new Date(String(p.created_at)).getTime() < 60 * 86400_000).slice(0, 50)));
}

/* stories: their numbers exist for 24 hours only; the hourly run keeps each one for good */
async function igStories(r: Run, tok: string, base: string, id: string) {
  const j: any = await jget(r, `${base}/${id}/stories?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${encodeURIComponent(tok)}`); // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = [];
  for (const m of j.data || []) {
    if (over(r)) break;
    const v: Record<string, unknown> = {};
    for (const [metric, k] of [["views", "views"], ["reach", "reach"], ["replies", "replies"], ["shares", "shares"], ["follows", "follows"], ["profile_visits", "profile_visits"]]) {
      const x = await soft(r, `${base}/${m.id}/insights?metric=${metric}&access_token=${encodeURIComponent(tok)}`); if (!x) continue;
      v[k] = x.data?.[0]?.values?.[0]?.value ?? x.data?.[0]?.total_value?.value ?? null;
    }
    /* how people moved through it: forward, back, out */
    const nav = await soft(r, `${base}/${m.id}/insights?metric=navigation&breakdown=story_navigation_action_type&access_token=${encodeURIComponent(tok)}`);
    for (const b of nav?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []) {
      const t = b.dimension_values?.[0]; if (t === "TAP_FORWARD") v.taps_forward = b.value; if (t === "TAP_BACK") v.taps_back = b.value; if (t === "TAP_EXIT" || t === "SWIPE_FORWARD") v.exits = (Number(v.exits) || 0) + b.value;
    }
    rows.push({ platform: "instagram", story_id: m.id, created_at: m.timestamp || null, kind: String(m.media_type || "").toLowerCase(), thumb: m.thumbnail_url || m.media_url || null, url: m.permalink || null, ...v });
  }
  if (rows.length) await upsert("social_stories", rows, "platform,story_id");
}

/* followers by age, gender, country and city (Instagram gives it above 100 followers) */
async function igAudience(r: Run, tok: string, base: string, id: string) {
  const rows = [];
  for (const bd of ["age", "gender", "country", "city"]) {
    const j = await soft(r, `${base}/${id}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${bd}&access_token=${encodeURIComponent(tok)}`);
    for (const x of j?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []) rows.push({ platform: "instagram", breakdown: bd, k: String(x.dimension_values?.[0] ?? "?"), n: x.value ?? null });
  }
  /* when her followers are on Instagram, hour by hour (the last day Instagram gives) */
  const on = await soft(r, `${base}/${id}/insights?metric=online_followers&period=lifetime&access_token=${encodeURIComponent(tok)}`);
  const hours = (on?.data?.[0]?.values || []).filter((v: { value?: Record<string, number> }) => v.value && Object.keys(v.value).length).pop()?.value as Record<string, number> | undefined;
  if (hours) for (const [h, v] of Object.entries(hours)) rows.push({ platform: "instagram", breakdown: "online", k: String(h), n: v });
  if (rows.length) await upsert("social_audience", rows, "platform,breakdown,k");
}

/* the comments of the recent posts go to the shared inbox, with their replies when she already answered (50 a page, up to 200 a post) */
async function igComments(r: Run, tok: string, base: string, posts: Post[]) {
  const rows = [];
  for (const p of posts) {
    let url: string | null = `${base}/${p.post_id}/comments?fields=id,text,username,timestamp,replies{id,text,username,timestamp}&limit=50&access_token=${encodeURIComponent(tok)}`;
    for (let i = 0; url && i < 4 && !over(r); i++) {
      const j = await soft(r, url);
      for (const c of j?.data || []) {
        const mine = (c.replies?.data || []).find((x: { username?: string }) => /inkage/i.test(x.username || ""));
        rows.push({ source: "instagram", item_id: c.id, kind: "comment", post_id: p.post_id, post_title: String(p.title || "").slice(0, 120), post_url: p.url, post_thumb: p.thumb,
          author: c.username || null, body: c.text || "", created_at: c.timestamp || null, reply: mine?.text || null, replied_at: mine?.timestamp || null });
      }
      url = j?.paging?.next || null;
    }
  }
  if (rows.length) await upsert("inbox_items", rows, "source,item_id");
}

/* asks for all metrics at once; a post type that lacks one of them fails the whole call, so then one by one */
async function igInsights(r: Run, id: string, tok: string, base = IG) {
  const want: Record<string, string> = { views: "views", reach: "reach", saved: "saves", shares: "shares", profile_visits: "profile_visits", follows: "follows",
    ig_reels_avg_watch_time: "watch_avg", ig_reels_video_view_total_time: "watch_total" };
  const read = (j: any) => Object.fromEntries((j?.data || []).map((x: any) => [want[x.name], x.values?.[0]?.value ?? x.total_value?.value ?? null])); // eslint-disable-line @typescript-eslint/no-explicit-any
  const q = (metrics: string) => soft(r, `${base}/${id}/insights?metric=${metrics}&access_token=${encodeURIComponent(tok)}`);
  const all = await q(Object.keys(want).join(","));
  const out: Record<string, unknown> = {};
  if (all) Object.assign(out, read(all));
  else for (const k of Object.keys(want)) { if (over(r)) break; const j = await q(k); if (j) Object.assign(out, read(j)); }
  /* Reels watch time comes in milliseconds; every other platform's is stored in seconds */
  if (out.watch_avg != null) out.watch_avg = Number(out.watch_avg) / 1000;
  if (out.watch_total != null) out.watch_total = Math.round(Number(out.watch_total) / 1000);
  return out;
}

/* ---------- Facebook page: followers, every post's reactions, comments, shares, and its reach and clicks ---------- */
/* Meta keeps renaming the insight metrics; each is asked alone, so one that is gone does not lose the others */
async function fbMetric(r: Run, id: string, metric: string, tok: string, extra = "") {
  const j = await soft(r, `${FB}/${id}/insights?metric=${metric}${extra}&access_token=${encodeURIComponent(tok)}`);
  if (!j) return null;
  const v = j.data?.[0]?.values; return v?.length ? v[v.length - 1]?.value ?? null : j.data?.[0]?.total_value?.value ?? null;
}
/* a page metric day by day: Facebook's day ends at end_time, so the value belongs to the day before it */
async function fbDays(r: Run, id: string, metric: string, tok: string) {
  const j = await soft(r, `${FB}/${id}/insights?metric=${metric}&period=day&access_token=${encodeURIComponent(tok)}`);
  return ((j?.data?.[0]?.values || []) as { value?: number; end_time?: string }[]).filter((x) => x.end_time && typeof x.value === "number").map((x) => ({ day: dayOf(new Date(x.end_time!).getTime() - 86400_000), v: x.value! }));
}
/* a post's clicks: post_clicks where Meta still gives it, else the sum of its clicks by type (link, photo, video, other) */
async function fbClicks(r: Run, id: string, tok: string) {
  const c = await fbMetric(r, id, "post_clicks", tok);
  if (typeof c === "number") return c;
  const t = await fbMetric(r, id, "post_clicks_by_type", tok);
  return t && typeof t === "object" ? Object.values(t as Record<string, number>).reduce((a, v) => a + (Number(v) || 0), 0) : null;
}
const FB_KIND: Record<string, string> = { added_photos: "image", added_video: "video", shared_story: "link", mobile_status_update: "post", created_note: "post", wall_post: "post", published_story: "post" };
async function syncFacebook(r: Run, tok: string, page: string) {
  const pg = await jget(r, `${FB}/${page}?fields=name,username,followers_count,fan_count,picture{url}&access_token=${encodeURIComponent(tok)}`);
  await patchAccount("facebook", { username: pg.username || null, display_name: pg.name || null, avatar_url: pg.picture?.data?.url || null });
  /* views and reach on their own days (the last two days Facebook gives), followers today */
  const days = new Map<string, Record<string, unknown>>(); const at = (d: string) => days.get(d) || days.set(d, { platform: "facebook", day: d }).get(d)!;
  for (const x of await fbDays(r, page, "page_media_view", tok)) at(x.day).impressions = x.v;
  for (const x of await fbDays(r, page, "page_impressions_unique", tok)) at(x.day).reach = x.v;
  for (const x of await fbDays(r, page, "page_daily_follows_unique", tok)) at(x.day).gained = x.v;
  Object.assign(at(today()), { followers: pg.followers_count ?? pg.fan_count ?? null, likes: pg.fan_count ?? null });
  await upsert("social_account_daily", [...days.values()], "platform,day");
  /* the page's stories first (Facebook keeps them a day): kept with their reach */
  const st = await soft(r, `${FB}/${page}/stories?access_token=${encodeURIComponent(tok)}`);
  const stories = [];
  for (const s of (st?.data || []).slice(0, 20)) {
    if (over(r)) break;
    const sid = String(s.post_id || s.id || ""); if (!sid) continue;
    stories.push({ platform: "facebook", story_id: sid, created_at: s.creation_time ? new Date(Number(s.creation_time) * 1000 || s.creation_time).toISOString() : null, kind: String(s.media_type || "story").toLowerCase(),
      url: s.url || null, thumb: null, reach: await fbMetric(r, sid, "post_impressions_unique", tok), views: await fbMetric(r, sid, "post_media_view", tok) });
  }
  if (stories.length) await quiet(r, upsert("social_stories", stories, "platform,story_id"));
  const posts: Post[] = [], ret: Record<string, unknown>[] = [];
  /* 50 a page: the newest 200 every run, then 100 older ones in turns (300 a run, as before) */
  await pages(r, 4, 2, async (cur) => {
    const j: any = await jget(r, `${FB}/${page}/posts?fields=id,message,created_time,permalink_url,full_picture,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)&limit=50${cur ? "&after=" + encodeURIComponent(cur) : ""}&access_token=${encodeURIComponent(tok)}`); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const m of j.data || []) {
      /* the insights of the last 90 days' posts, while the time lasts (the rest keep their reactions, comments and shares) */
      const deep = m.created_time && Date.now() - new Date(m.created_time).getTime() < 90 * 86400_000 && !over(r), kind = FB_KIND[m.status_type] || "post";
      const p: Post = { post_id: m.id, created_at: m.created_time || null, kind, title: (m.message || "").slice(0, 300), url: m.permalink_url || null, thumb: m.full_picture || null,
        code: codeIn(m.message), likes: m.reactions?.summary?.total_count ?? null, comments: m.comments?.summary?.total_count ?? null, shares: m.shares?.count ?? 0,
        ...(deep ? { views: await fbMetric(r, m.id, "post_media_view", tok), reach: await fbMetric(r, m.id, "post_impressions_unique", tok), clicks: await fbClicks(r, m.id, tok) } : {}) };
      /* a video's watch time (milliseconds from Facebook, seconds here), finished views and the retention curve */
      if (deep && kind === "video") {
        const avg = await fbMetric(r, m.id, "post_video_avg_time_watched", tok), plays = await fbMetric(r, m.id, "post_video_views", tok), done = await fbMetric(r, m.id, "post_video_complete_views_organic", tok);
        if (avg != null) p.watch_avg = Number(avg) / 1000;
        if (plays && done != null) p.completion = (Number(done) / Number(plays)) * 100;
        const curve = await fbMetric(r, m.id, "post_video_retention_graph", tok);
        if (curve && typeof curve === "object") for (const [k, v] of Object.entries(curve as Record<string, number>)) ret.push({ platform: "facebook", post_id: m.id, x: Number(k) / 40, ratio: Number(v) });
      }
      posts.push(keep(r, p));
    }
    await flush(r);
    return j.paging?.next ? j.paging?.cursors?.after || null : null;
  });
  if (ret.length) await quiet(r, upsert("social_retention", ret, "platform,post_id,x"));
  /* comments of the last two months' posts into the shared inbox (50 a page, up to 200 a post) */
  const rows = [];
  for (const p of posts.filter((x) => x.comments !== 0 && x.created_at && Date.now() - new Date(String(x.created_at)).getTime() < 60 * 86400_000).slice(0, 40)) {
    let url: string | null = `${FB}/${p.post_id}/comments?fields=id,message,from,created_time,comments{id,message,from,created_time}&limit=50&access_token=${encodeURIComponent(tok)}`;
    for (let i = 0; url && i < 4 && !over(r); i++) {
      const j = await soft(r, url);
      for (const c of j?.data || []) {
        const mine = (c.comments?.data || []).find((x: { from?: { id?: string } }) => x.from?.id === page);
        rows.push({ source: "facebook", item_id: c.id, kind: "comment", post_id: p.post_id, post_title: String(p.title || "").slice(0, 120), post_url: p.url, post_thumb: p.thumb,
          author: c.from?.name || null, body: c.message || "", created_at: c.created_time || null, reply: mine?.message || null, replied_at: mine?.created_time || null });
      }
      url = j?.paging?.next || null;
    }
  }
  if (rows.length) await quiet(r, upsert("inbox_items", rows, "source,item_id"));
}

/* ---------- Pinterest: followers, monthly views, and every pin's impressions, saves and outbound clicks ---------- */
async function syncPinterest(r: Run, tok: string) {
  const h = { authorization: `Bearer ${tok}` };
  const u = await jget(r, "https://api.pinterest.com/v5/user_account", { headers: h });
  await patchAccount("pinterest", { account_id: u.id || u.username || null, username: u.username || null, display_name: u.business_name || u.username || null, avatar_url: u.profile_image || null });
  const end = ymdUtc(new Date()), start = ymdUtc(new Date(Date.now() - 89 * 86400_000));
  type PDay = { date: string; data_status: string; metrics?: Record<string, number> };
  const an = await soft(r, `https://api.pinterest.com/v5/user_account/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,PIN_CLICK`, { headers: h });
  const ready: PDay[] = (an?.all?.daily_metrics || []).filter((x: PDay) => x.data_status === "READY" && x.date);
  /* every day on its own row (impressions and outbound clicks of that day); the monthly number is the sum of the last 30 days */
  const m30 = ready.slice(-30).reduce((t, x) => t + (Number(x.metrics?.IMPRESSION) || 0), 0);
  await upsert("social_account_daily", [...ready.map((x) => ({ platform: "pinterest", day: x.date, impressions: num(x.metrics?.IMPRESSION), clicks: num(x.metrics?.OUTBOUND_CLICK) })),
    { platform: "pinterest", day: today(), followers: u.follower_count ?? null, following: u.following_count ?? null, posts: u.pin_count ?? null, impressions_30d: ready.length ? m30 : null }], "platform,day");
  /* the pin's days: all 90 once a day, the last week every hour; only days with something in them */
  const from = r.daily ? start : ymdUtc(new Date(Date.now() - 7 * 86400_000));
  /* 100 a page: the newest 300 every run, then 200 older ones in turns (500 a run, as before) */
  await pages(r, 3, 2, async (cur) => {
    const j: any = await jget(r, `https://api.pinterest.com/v5/pins?page_size=100${cur ? "&bookmark=" + encodeURIComponent(cur) : ""}`, { headers: h }); // eslint-disable-line @typescript-eslint/no-explicit-any
    const days: Record<string, unknown>[] = [];
    for (const m of j.items || []) {
      const img = m.media?.images || {}, thumb = (img["600x"] || img["400x300"] || img["150x150"] || Object.values(img)[0] as { url?: string } | undefined)?.url || null;
      const video = m.media?.media_type === "video", vstats = video && r.daily; /* the 90-day watch numbers, read with the daily run */
      /* the last 90 days of the pin (the longest Pinterest gives per pin), day by day: the total is added up in the database,
         so a pin older than 90 days does not lose its earlier numbers. A pin click is not a like: it has its own field.
         Once the time is up, the rest of the page is saved without new numbers. */
      const pa = over(r) ? null : await soft(r, `https://api.pinterest.com/v5/pins/${m.id}/analytics?start_date=${from}&end_date=${end}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK${vstats ? ",VIDEO_MRC_VIEW,VIDEO_AVG_WATCH_TIME,VIDEO_START,QUARTILE_95_PERCENT_VIEW" : ""}`, { headers: h });
      for (const x of (pa?.all?.daily_metrics || []) as PDay[]) {
        const mm = x.metrics || {};
        if (x.data_status === "READY" && (mm.IMPRESSION || mm.SAVE || mm.PIN_CLICK || mm.OUTBOUND_CLICK)) days.push({ platform: "pinterest", post_id: String(m.id), day: x.date, impressions: num(mm.IMPRESSION), saves: num(mm.SAVE), clicks: num(mm.OUTBOUND_CLICK), pin_clicks: num(mm.PIN_CLICK) });
      }
      const sm = pa?.all?.summary_metrics || {};
      keep(r, { post_id: String(m.id), created_at: m.created_at || null, kind: video ? "video" : "pin", title: (m.title || m.description || "").slice(0, 300),
        url: `https://www.pinterest.com/pin/${m.id}/`, thumb, code: codeIn([m.link, m.description].filter(Boolean).join(" ")) || utmCode(m.link),
        ...(vstats && sm.VIDEO_AVG_WATCH_TIME != null ? { watch_avg: Number(sm.VIDEO_AVG_WATCH_TIME) / 1000 } : {}),
        ...(vstats && Number(sm.VIDEO_START) > 0 && sm.QUARTILE_95_PERCENT_VIEW != null ? { completion: (Number(sm.QUARTILE_95_PERCENT_VIEW) / Number(sm.VIDEO_START)) * 100 } : {}) });
    }
    await flush(r);
    if (days.length) await upsert("social_post_day", days, "platform,post_id,day");
    return j.bookmark || null;
  });
  if (r.daily && !over(r)) await quiet(r, pinAudience(r, h));
}

/* Pinterest without the API: the public profile widget (the one Pinterest gives for embedding a profile on a website,
   no key) lists the newest pins with their picture, link and saves, and the profile's followers. Impressions, clicks and
   the 90-day history only come with the API connection (PINTEREST_APP_ID / _SECRET, then "Összekapcsolás"); once that
   account exists this part stops and the API sync writes the same pins (the same post_id). A pin added by hand earlier
   ("m:" + its id) is replaced by the real one by the database (social_posts_merge_manual), its date kept. */
const pinUser = () => env().PINTEREST_USERNAME || "";
const unent = (t?: string | null) => String(t || "").replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c))).replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
async function syncPinterestPublic(state: Record<string, unknown> | null, fresh: number): Promise<string> {
  const at = state?.try_pinterest;
  if (fresh && typeof at === "string" && Date.now() - new Date(at).getTime() < fresh) return "friss (nyilvános profil)";
  const user = pinUser();
  try {
    const j = await json(await fetch(`https://widgets.pinterest.com/v3/pidgets/users/${encodeURIComponent(user)}/pins/`, { cache: "no-store", signal: AbortSignal.timeout(15_000) }));
    const u = j?.data?.user || {}, pins: Post[] = j?.data?.pins || [];
    const rows: Post[] = pins.filter((m) => m?.id).map((m) => {
      const link = unent(m.link), img = m.images || {};
      return { post_id: String(m.id), kind: m.is_video ? "video" : "pin", title: unent(m.story_pin_data?.metadata?.pin_title || m.title || m.description).slice(0, 300) || null,
        url: `https://www.pinterest.com/pin/${m.id}/`, thumb: (img["564x"] || img["237x"] || img["236x"])?.url || null,
        code: codeIn([link, unent(m.description)].join(" ")) || utmCode(link), saves: num(m.aggregated_pin_data?.aggregated_stats?.saves) };
    });
    const saved = rows.length ? await savePosts("pinterest", rows) : 0;
    await upsert("social_account_daily", [{ platform: "pinterest", day: today(), followers: num(u.follower_count), posts: num(u.pin_count) }], "platform,day");
    await call("admin_w_social_state", { p_set: { try_pinterest: new Date().toISOString() } }).catch(() => null);
    await log("pinterest", true, saved, `${saved} pin a nyilvános profilból (@${user}): kép, mentés, link és látogató; megjelenés és kattintás az API-bekötéssel jön`);
    return `${saved} pin (nyilvános profil)`;
  } catch (e) {
    const m = errMsg(e);
    await log("pinterest", false, null, `nyilvános profil (@${user}): ${m}`);
    return "hiba: " + m.slice(0, 120);
  }
}

/* who sees the pins: age, gender, country, city (shares, stored as per mille like YouTube's) */
async function pinAudience(r: Run, h: Record<string, string>) {
  const j = await soft(r, "https://api.pinterest.com/v5/user_account/audience_insights?audience_insight_type=YOUR_TOTAL_AUDIENCE", { headers: h });
  const dem = j?.demographics || {}, rows: Record<string, unknown>[] = [];
  const add = (bd: string, list: { key?: string; ratio?: number }[] | undefined, k = (x: string) => x) => (list || []).forEach((x) => x.key && x.ratio != null && rows.push({ platform: "pinterest", breakdown: bd, k: k(x.key), n: Math.round(x.ratio * 1000) }));
  add("age", dem.ages); add("gender", dem.genders, (x) => (/^f/i.test(x) ? "F" : /^m/i.test(x) ? "M" : "U")); add("country", dem.countries, (x) => x.toUpperCase()); add("city", dem.metros);
  if (rows.length) await upsert("social_audience", rows, "platform,breakdown,k");
}

/* ---------- LinkedIn company page: followers, and every post's impressions, clicks, reactions, comments, reposts ---------- */
async function syncLinkedin(r: Run, tok: string, org: string) {
  const h = { authorization: `Bearer ${tok}`, ...LI };
  const urn = `urn:li:organization:${org}`;
  const o = await getJ(r, `https://api.linkedin.com/rest/organizations/${org}`, h);
  await patchAccount("linkedin", { username: o.vanityName || null, display_name: o.localizedName || null });
  const fol = await getJ(r, `https://api.linkedin.com/rest/networkSizes/${encodeURIComponent(urn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`, h);
  /* the page's numbers day by day (without a time range LinkedIn gives the lifetime total, which is not a day's number) */
  const span = `(timeRange:(start:${Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - (r.daily ? 60 : 7) * 86400_000},end:${Date.now()}),timeGranularityType:DAY)`;
  const days = new Map<string, Record<string, unknown>>(); const at = (d: string) => days.get(d) || days.set(d, { platform: "linkedin", day: d }).get(d)!;
  const tot = await getJ(r, `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}&timeIntervals=${span}`, h);
  for (const e of tot.elements || []) { const s = e.totalShareStatistics || {}; if (e.timeRange?.start == null) continue;
    Object.assign(at(dayOf(e.timeRange.start)), { impressions: num(s.impressionCount), reach: num(s.uniqueImpressionsCount), clicks: num(s.clickCount), shares: num(s.shareCount) }); }
  const fg = await getJ(r, `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}&timeIntervals=${span}`, h);
  for (const e of fg.elements || []) if (e.timeRange?.start != null) at(dayOf(e.timeRange.start)).gained = (Number(e.followerGains?.organicFollowerGain) || 0) + (Number(e.followerGains?.paidFollowerGain) || 0);
  at(today()).followers = fol.firstDegreeSize ?? null;
  await upsert("social_account_daily", [...days.values()], "platform,day");
  if (r.daily) await quiet(r, liAudience(r, h, urn));
  /* the posts by last change, 50 a page: the newest 150 every run, then 50 older ones in turns (200 a run, as before) */
  const items: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  await pages(r, 3, 1, async (cur) => {
    const start = Number(cur) || 0;
    const list = await jget(r, `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(urn)}&q=author&count=50&start=${start}&sortBy=LAST_MODIFIED`, { headers: { ...h, "X-RestLi-Method": "FINDER" } });
    items.push(...(list.elements || []));
    return (list.elements || []).length < 50 ? null : String(start + 50);
  });
  const posts: Post[] = [];
  for (let i = 0; i < items.length && !over(r); i += 20) {
    const part = items.slice(i, i + 20), shares = part.filter((x) => String(x.id).includes(":share:")).map((x) => encodeURIComponent(x.id)), ugc = part.filter((x) => String(x.id).includes(":ugcPost:")).map((x) => encodeURIComponent(x.id));
    const q = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}${shares.length ? `&shares=List(${shares.join(",")})` : ""}${ugc.length ? `&ugcPosts=List(${ugc.join(",")})` : ""}`;
    const st = await getJ(r, `https://api.linkedin.com/rest/organizationalEntityShareStatistics?${q}`, h);
    const stats: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const e of st.elements || []) stats[e.share || e.ugcPost] = e.totalShareStatistics || {};
    for (const [j, m] of part.entries()) {
      const s = stats[m.id] || {}, text = String(m.commentary || ""), media = String(m.content?.media?.id || ""), newest = i + j < 40 && !over(r);
      const kind = media.includes(":video:") ? "video" : media.includes(":image:") ? "image" : m.content?.multiImage ? "carousel" : m.content?.article ? "link" : m.content?.document ? "document" : "post";
      const p: Post = { post_id: String(m.id), created_at: m.publishedAt || m.createdAt ? new Date(m.publishedAt || m.createdAt).toISOString() : null, kind, title: text.slice(0, 300),
        url: `https://www.linkedin.com/feed/update/${m.id}/`, thumb: null, code: codeIn(text),
        views: s.impressionCount ?? null, impressions: s.impressionCount ?? null, reach: s.uniqueImpressionsCount ?? null, clicks: s.clickCount ?? null,
        likes: s.likeCount ?? null, comments: s.commentCount ?? null, shares: s.shareCount ?? null };
      /* the cover of the newest 40: the image itself, a video's thumbnail, a link's picture */
      if (newest) {
        if (kind === "image") p.thumb = (await getJ(r, `https://api.linkedin.com/rest/images/${encodeURIComponent(media)}`, h)).downloadUrl || null;
        else if (kind === "video") p.thumb = (await getJ(r, `https://api.linkedin.com/rest/videos/${encodeURIComponent(media)}`, h)).thumbnail || null;
        else if (kind === "carousel") { const im = String(m.content?.multiImage?.images?.[0]?.id || ""); if (im) p.thumb = (await getJ(r, `https://api.linkedin.com/rest/images/${encodeURIComponent(im)}`, h)).downloadUrl || null; }
        else if (kind === "link" && m.content?.article?.thumbnail) p.thumb = (await getJ(r, `https://api.linkedin.com/rest/images/${encodeURIComponent(m.content.article.thumbnail)}`, h)).downloadUrl || null;
      }
      /* a video's plays and watch time (milliseconds from LinkedIn) */
      if (kind === "video" && newest) {
        const va = (t: string) => getJ(r, `https://api.linkedin.com/rest/videoAnalytics?q=entity&entity=${encodeURIComponent(m.id)}&type=${t}&aggregation=ALL`, h).then((x) => num(x.elements?.[0]?.value));
        const plays = await va("VIDEO_VIEW"), ms = await va("TIME_WATCHED");
        if (ms != null) { p.watch_total = Math.round(ms / 1000); if (plays) p.watch_avg = ms / 1000 / plays; }
      }
      posts.push(keep(r, p));
    }
    await flush(r);
  }
  /* comments of the newest posts into the shared inbox (answered from LinkedIn itself) */
  const rows = [];
  for (const p of posts.filter((x) => Number(x.comments) > 0).slice(0, 20)) {
    if (over(r)) break;
    const j = await getJ(r, `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(String(p.post_id))}/comments?count=50`, h);
    for (const c of j.elements || []) {
      const id = String(c.$URN || c.commentUrn || c.id || ""); if (!id) continue;
      const mine = String(c.actor || "") === urn;
      if (mine) continue;
      rows.push({ source: "linkedin", item_id: id, kind: "comment", post_id: p.post_id, post_title: String(p.title || "").slice(0, 120), post_url: p.url, post_thumb: p.thumb,
        author: null, body: c.message?.text || "", created_at: c.created?.time ? new Date(c.created.time).toISOString() : null, reply: null, replied_at: null });
    }
  }
  if (rows.length) await quiet(r, upsert("inbox_items", rows, "source,item_id"));
}

/* the followers of the page: seniority, job function and country (LinkedIn gives them for the whole follower base) */
const LI_SEN: Record<string, string> = { "1": "Gyakornok", "2": "Kezdő", "3": "Junior", "4": "Tapasztalt", "5": "Vezető szakember", "6": "Menedzser", "7": "Igazgató", "8": "Alelnök", "9": "Felsővezető (C-szint)", "10": "Tulajdonos", "11": "Partner", "12": "Önkéntes" };
const LI_FN: Record<string, string> = { "1": "Könyvelés", "2": "Adminisztráció", "3": "Művészet és dizájn", "4": "Üzletfejlesztés", "5": "Közösség és szociális munka", "6": "Tanácsadás", "7": "Oktatás",
  "8": "Mérnöki munka", "9": "Vállalkozás", "10": "Pénzügy", "11": "Egészségügy", "12": "HR", "13": "Informatika", "14": "Jog", "15": "Marketing", "16": "Média és kommunikáció",
  "17": "Katonai és védelmi", "18": "Üzemeltetés", "19": "Termékmenedzsment", "20": "Projektmenedzsment", "21": "Beszerzés", "22": "Minőségbiztosítás", "23": "Ingatlan", "24": "Kutatás", "25": "Értékesítés", "26": "Ügyfélszolgálat" };
async function liAudience(r: Run, h: Record<string, string>, urn: string) {
  const j = await getJ(r, `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}`, h);
  const e = j.elements?.[0]; if (!e) return;
  const cnt = (x: { followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number } }) => (Number(x.followerCounts?.organicFollowerCount) || 0) + (Number(x.followerCounts?.paidFollowerCount) || 0);
  const id = (u: unknown) => String(u || "").split(":").pop() || "?";
  const rows: Record<string, unknown>[] = [];
  for (const x of e.followerCountsBySeniority || []) rows.push({ platform: "linkedin", breakdown: "seniority", k: LI_SEN[id(x.seniority)] || id(x.seniority), n: cnt(x) });
  for (const x of e.followerCountsByFunction || []) rows.push({ platform: "linkedin", breakdown: "function", k: LI_FN[id(x.function)] || id(x.function), n: cnt(x) });
  /* countries come as LinkedIn place ids: their names from the geo service */
  const geos = ((e.followerCountsByGeoCountry || []) as { geo?: string }[]).sort((a, b) => cnt(b as never) - cnt(a as never)).slice(0, 25);
  const names = geos.length ? await getJ(r, `https://api.linkedin.com/rest/geo?ids=List(${geos.map((g) => id(g.geo)).join(",")})`, h) : {};
  for (const g of geos) rows.push({ platform: "linkedin", breakdown: "country", k: names.results?.[id(g.geo)]?.defaultLocalizedName?.value || id(g.geo), n: cnt(g as never) });
  if (rows.length) await upsert("social_audience", rows, "platform,breakdown,k");
}

/* ---------- YouTube: subscribers, every video's views, likes, comments, shares, watch time, thumbnail impressions, and the comments ---------- */
const YTA = "https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE";
async function syncYoutube(r: Run, tok: string, channel: string) {
  const h = { authorization: `Bearer ${tok}` };
  const c = (await jget(r, `${YT}/channels?part=snippet,statistics,contentDetails&id=${channel}`, { headers: h })).items?.[0];
  if (!c) throw new Error("A YouTube-csatorna nem érhető el.");
  await patchAccount("youtube", { username: c.snippet?.customUrl || null, display_name: c.snippet?.title || null, avatar_url: c.snippet?.thumbnails?.default?.url || null });
  const rep = (q: string, start: string, end = ymdUtc(new Date())) => soft(r, `${YTA}&startDate=${start}&endDate=${end}&${q}`, { headers: h });
  /* today: subscribers (0 stays 0; a hidden count is null), videos, the channel's lifetime views. The days: views, watch
     minutes, subscribers gained and lost, shares, from YouTube Analytics (the last 5 weeks, 2–3 days late) */
  const days = new Map<string, Record<string, unknown>>(); const at = (d: string) => days.get(d) || days.set(d, { platform: "youtube", day: d }).get(d)!;
  const dd = await rep("metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,shares&dimensions=day&sort=day", ymdUtc(new Date(Date.now() - 35 * 86400_000)));
  for (const [d, v, m, g, l, s] of (dd?.rows || []) as [string, number, number, number, number, number][]) Object.assign(at(d), { views: num(v), watch_min: num(m), gained: num(g), lost: num(l), shares: num(s) });
  Object.assign(at(today()), { followers: c.statistics?.hiddenSubscriberCount ? null : num(c.statistics?.subscriberCount), posts: num(c.statistics?.videoCount), views_total: num(c.statistics?.viewCount) });
  /* the uploads, newest first: 150 every run, then 50 older ones in turns (200 a run, as before) */
  const ids: string[] = [];
  await pages(r, 3, 1, async (pt) => {
    const j = await jget(r, `${YT}/playlistItems?part=contentDetails&maxResults=50&playlistId=${c.contentDetails?.relatedPlaylists?.uploads}${pt ? "&pageToken=" + pt : ""}`, { headers: h });
    ids.push(...(j.items || []).map((x: { contentDetails: { videoId: string } }) => x.contentDetails.videoId));
    return j.nextPageToken || null;
  });
  /* watch time, new subscribers and shares per video over the channel's whole life, every video (200 a page) */
  const since = ymdUtc(new Date(c.snippet?.publishedAt || Date.now() - 3650 * 86400_000));
  const watch = new Map<string, number[]>();
  for (let s = 1; s <= Math.max(1, ids.length) && !over(r); s += 200) {
    const an = await rep(`metrics=estimatedMinutesWatched,averageViewDuration,subscribersGained,shares&dimensions=video&maxResults=200&startIndex=${s}&sort=-estimatedMinutesWatched`, since);
    const rows = (an?.rows || []) as [string, number, number, number, number][];
    rows.forEach((x) => watch.set(x[0], [x[1], x[2], x[3], x[4]]));
    if (rows.length < 200) break;
  }
  const types = over(r) ? new Map<string, string>() : await ytTypes(r, h, since, ids.length);
  const posts: Post[] = [];
  for (let i = 0; i < ids.length && !over(r); i += 50) {
    const j = await jget(r, `${YT}/videos?part=snippet,statistics,contentDetails&id=${ids.slice(i, i + 50).join(",")}`, { headers: h });
    for (const v of j.items || []) {
      const dur = String(v.contentDetails?.duration || ""), sec = (Number(dur.match(/(\d+)H/)?.[1]) || 0) * 3600 + (Number(dur.match(/(\d+)M/)?.[1]) || 0) * 60 + (Number(dur.match(/(\d+)S/)?.[1]) || 0);
      const w = watch.get(v.id), t = types.get(v.id);
      /* Short or long as YouTube Analytics reports it; unknown (no views in its reports yet): by length, a Short can be up to 3 minutes since October 2024 */
      const kind = t === "SHORTS" ? "short" : t === "VIDEO_ON_DEMAND" || t === "LIVE_STREAM" ? "video" : sec && sec <= 180 ? "short" : "video";
      /* a hidden count stays null (unknown), not 0 */
      posts.push(keep(r, { post_id: v.id as string, created_at: (v.snippet?.publishedAt || null) as string | null, kind, title: String(v.snippet?.title || "").slice(0, 300), url: `https://www.youtube.com/watch?v=${v.id}`,
        thumb: (v.snippet?.thumbnails?.medium?.url || null) as string | null, duration: sec || null, code: codeIn(v.snippet?.description),
        views: num(v.statistics?.viewCount), likes: num(v.statistics?.likeCount), comments: num(v.statistics?.commentCount),
        watch_total: w ? Math.round(w[0] * 60) : null, watch_avg: w ? w[1] : null, follows: w ? w[2] : null, shares: w ? w[3] : null }));
    }
    await flush(r);
  }
  /* thumbnail impressions and click-through rate: only the Reporting API has them (a daily file, 2 days late) */
  if (r.daily && !over(r)) await quiet(r, ytReach(r, h, days));
  await upsert("social_account_daily", [...days.values()], "platform,day");
  /* the newest comments on the channel into the shared inbox (up to 500 threads) */
  const byId = new Map(posts.map((p) => [p.post_id, p]));
  const rows: Record<string, unknown>[] = []; let cpt = "";
  for (let i = 0; i < 5 && !over(r); i++) {
    const cj = await soft(r, `${YT}/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${channel}&maxResults=100&order=time${cpt ? "&pageToken=" + cpt : ""}`, { headers: h });
    for (const t of cj?.items || []) {
      const top = t.snippet?.topLevelComment?.snippet || {}, vid = t.snippet?.videoId, p = byId.get(vid);
      const mine = (t.replies?.comments || []).find((x: any) => x.snippet?.authorChannelId?.value === channel)?.snippet; // eslint-disable-line @typescript-eslint/no-explicit-any
      rows.push({ source: "youtube", item_id: t.snippet?.topLevelComment?.id || t.id, kind: "comment", post_id: vid, post_title: p?.title?.slice(0, 120) || null, post_url: p?.url || null, post_thumb: p?.thumb || null,
        author: top.authorDisplayName || null, body: top.textOriginal || top.textDisplay || "", created_at: top.publishedAt || null, reply: mine?.textOriginal || null, replied_at: mine?.publishedAt || null });
    }
    cpt = cj?.nextPageToken || ""; if (!cpt) break;
  }
  if (rows.length) await quiet(r, upsert("inbox_items", rows, "source,item_id"));
  if (!over(r)) await quiet(r, ytAudience(r, h, posts));
}

/* the content type YouTube Analytics reports per video (SHORTS, VIDEO_ON_DEMAND, LIVE_STREAM, …; the creatorContentType
   the channel's ctype breakdown uses too): asked as a second dimension next to the video, or, where YouTube does not give
   that report, one filtered report per type. A video without views in the period is not in it (then its length decides). */
async function ytTypes(r: Run, h: Record<string, string>, since: string, n: number) {
  const out = new Map<string, string>(), url = (q: string) => `${YTA}&startDate=${since}&endDate=${ymdUtc(new Date())}&metrics=views&${q}`;
  let both = true;
  for (let s = 1; s <= Math.max(1, n) && !over(r); s += 200) {
    /* a report YouTube does not offer is an answer here, not a failure */
    const res = await req(r, url(`dimensions=video,creatorContentType&maxResults=200&startIndex=${s}&sort=-views`), { headers: h }).catch((e) => { if (e instanceof Limited) throw e; return null; });
    const j = res?.ok ? await res.json().catch(() => null) : null;
    if (!j) { both = false; break; }
    for (const [v, t] of (j.rows || []) as [string, string][]) out.set(v, t);
    if ((j.rows || []).length < 200) break;
  }
  if (both) return out;
  for (const t of ["SHORTS", "VIDEO_ON_DEMAND", "LIVE_STREAM"]) {
    if (over(r)) break;
    const j = await soft(r, url(`dimensions=video&filters=creatorContentType==${t}&maxResults=200&sort=-views`), { headers: h });
    for (const [v] of (j?.rows || []) as [string][]) out.set(v, t);
  }
  return out;
}

/* the Reporting API's channel_reach_basic_a1 report: per video and day, how often its thumbnail was shown and clicked.
   The job is created once (yt-analytics.readonly is enough); YouTube then writes one file a day. */
async function ytReach(r: Run, h: Record<string, string>, days: Map<string, Record<string, unknown>>) {
  const RP = "https://youtubereporting.googleapis.com/v1", TYPE = "channel_reach_basic_a1";
  const jobs = await soft(r, `${RP}/jobs`, { headers: h });
  const job = (jobs?.jobs || []).find((j: { reportTypeId: string }) => j.reportTypeId === TYPE)?.id as string | undefined;
  if (!job) { await jget(r, `${RP}/jobs`, { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ reportTypeId: TYPE, name: "InkAge megjelenések" }) }); return; }
  const list = await soft(r, `${RP}/jobs/${job}/reports?pageSize=30`, { headers: h });
  const reps = ((list?.reports || []) as { startTime: string; downloadUrl: string }[]).sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, 7);
  const per = new Map<string, { imp: number; clicks: number }>();
  for (const rp of reps) {
    if (over(r)) break;
    const res = await quiet(r, req(r, rp.downloadUrl, { headers: h }));
    const txt = res?.ok ? await res.text().catch(() => "") : (res && fail(r, `${res.status} jelentésfájl`), "");
    const [head, ...lines] = txt.trim().split(/\r?\n/); if (!head) continue;
    const cols = head.split(","), ci = (k: string) => cols.indexOf(k);
    const di = ci("date"), vi = ci("video_id"), ii = ci("video_thumbnail_impressions"), ti = ci("video_thumbnail_impressions_ctr");
    if (di < 0 || vi < 0 || ii < 0) continue;
    for (const l of lines) {
      const c = l.split(","), imp = Number(c[ii]) || 0; if (!imp) continue;
      let ctr = ti >= 0 ? Number(c[ti]) || 0 : 0; if (ctr > 1) ctr /= 100;
      const day = `${c[di].slice(0, 4)}-${c[di].slice(4, 6)}-${c[di].slice(6, 8)}`, k = c[vi] + "|" + day, o = per.get(k) || { imp: 0, clicks: 0 };
      o.imp += imp; o.clicks += imp * ctr; per.set(k, o);
    }
  }
  const rows: Record<string, unknown>[] = [], byDay = new Map<string, number>();
  per.forEach((o, k) => { const [post_id, day] = k.split("|"); rows.push({ platform: "youtube", post_id, day, impressions: o.imp, ctr: o.clicks / o.imp }); byDay.set(day, (byDay.get(day) || 0) + o.imp); });
  if (rows.length) await upsert("social_post_day", rows, "platform,post_id,day");
  byDay.forEach((v, d) => { const x = days.get(d) || { platform: "youtube", day: d }; x.impressions = v; days.set(d, x); });
}

/* the channel's viewers (age, gender, country), where the views come from, Shorts against long videos, and (with the
   daily part: about 30 reports) how long the videos hold them */
async function ytAudience(r: Run, h: Record<string, string>, posts: Post[]) {
  const end = ymdUtc(new Date()), start = ymdUtc(new Date(Date.now() - 90 * 86400_000));
  const rep = (q: string) => soft(r, `${YTA}&startDate=${start}&endDate=${end}&${q}`, { headers: h });
  const rows: Record<string, unknown>[] = [];
  const demo = await rep("metrics=viewerPercentage&dimensions=ageGroup,gender");
  const age = new Map<string, number>(), gender = new Map<string, number>();
  for (const [a, g, v] of (demo?.rows || []) as [string, string, number][]) { age.set(a, (age.get(a) || 0) + v); gender.set(g, (gender.get(g) || 0) + v); }
  /* shares in per mille (percent × 10), so one decimal survives */
  age.forEach((v, k) => rows.push({ platform: "youtube", breakdown: "age", k: k.replace("age", ""), n: Math.round(v * 10) }));
  gender.forEach((v, k) => rows.push({ platform: "youtube", breakdown: "gender", k: k === "female" ? "F" : k === "male" ? "M" : "U", n: Math.round(v * 10) }));
  const ctry = await rep("metrics=views&dimensions=country&sort=-views&maxResults=25");
  for (const [k, v] of (ctry?.rows || []) as [string, number][]) rows.push({ platform: "youtube", breakdown: "country", k, n: v });
  const src = await rep("metrics=views&dimensions=insightTrafficSourceType&sort=-views");
  for (const [k, v] of (src?.rows || []) as [string, number][]) rows.push({ platform: "youtube", breakdown: "traffic", k, n: v });
  /* Shorts, long videos and lives apart: views and watch minutes by content type */
  const ct = await rep("metrics=views,estimatedMinutesWatched&dimensions=creatorContentType");
  for (const [k, v, m] of (ct?.rows || []) as [string, number, number][]) { rows.push({ platform: "youtube", breakdown: "ctype", k, n: v }); rows.push({ platform: "youtube", breakdown: "ctype_min", k, n: Math.round(m) }); }
  if (rows.length) await upsert("social_audience", rows, "platform,breakdown,k");
  if (!r.daily) return;
  /* audience retention: the 20 newest videos and the 10 most watched */
  const newest = [...posts].filter((x) => x.created_at).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
  const top = [...posts].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 10);
  const ret: Record<string, unknown>[] = [];
  for (const p of Array.from(new Map([...newest, ...top].map((x) => [x.post_id, x])).values())) {
    if (over(r)) break;
    const j = await rep(`metrics=audienceWatchRatio&dimensions=elapsedVideoTimeRatio&filters=video==${p.post_id}`);
    for (const [x, v] of (j?.rows || []) as [number, number][]) ret.push({ platform: "youtube", post_id: p.post_id, x, ratio: v });
  }
  if (ret.length) await upsert("social_retention", ret, "platform,post_id,x");
}

/* ---------- hide or like a comment from the inbox ---------- */
export async function moderate(source: string, itemId: string, action: "hide" | "unhide" | "like") {
  const accs = await call<Acc[]>("admin_r_accounts");
  const acc = (p: string) => accs.find((a) => a.platform === p);
  if (source === "instagram") {
    const a = acc("instagram"); if (!a) throw new Error("Az Instagram nincs bekötve.");
    if (action === "like") throw new Error("Instagram-kommentet az API-n át nem lehet kedvelni.");
    const base = viaFb(a) ? FB : IG, tok = await token(a);
    await json(await fetch(`${base}/${itemId}?hide=${action === "hide"}&access_token=${encodeURIComponent(tok)}`, { method: "POST" }));
  } else if (source === "facebook") {
    const a = acc("facebook"); if (!a) throw new Error("A Facebook nincs bekötve.");
    if (action === "like") await json(await fetch(`${FB}/${itemId}/likes?access_token=${encodeURIComponent(a.access_token)}`, { method: "POST" }));
    else await json(await fetch(`${FB}/${itemId}?is_hidden=${action === "hide"}&access_token=${encodeURIComponent(a.access_token)}`, { method: "POST" }));
  } else if (source === "youtube") {
    const a = acc("youtube"); if (!a) throw new Error("A YouTube nincs bekötve.");
    if (action === "like") throw new Error("YouTube-kommentet az API-n át nem lehet kedvelni.");
    const tok = await token(a);
    const r = await fetch(`${YT}/comments/setModerationStatus?id=${encodeURIComponent(itemId)}&moderationStatus=${action === "hide" ? "heldForReview" : "published"}`, { method: "POST", headers: { authorization: `Bearer ${tok}` } });
    if (!r.ok) throw new Error(`YouTube ${r.status}: ${(await r.text()).slice(0, 160)}`);
  } else throw new Error("Ennél a forrásnál ez nem érhető el.");
  await call("admin_w_inbox_flag", { p_source: source, p_item: itemId, p_hidden: action === "like" ? null : action === "hide", p_liked: action === "like" ? true : null });
}

/* ---------- "Kipróbálom" for every platform: are the keys right, and does the connection answer ---------- */
export async function testPlatform(p: Platform): Promise<{ ok: boolean; msg: string }> {
  const e = env(), [k1, k2] = KEYS[p];
  if (!e[k1] || !e[k2]) return { ok: false, msg: "Előbb mentsd el a kulcsokat." };
  if (p === "tiktok") { const t = await testTiktok(); if (!t.ok) return t; }
  else {
    /* the token endpoint with a made-up code: a wrong key pair answers "invalid client", a right one "invalid code" */
    const form = (o: Record<string, string>) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o) });
    const r = p === "youtube" ? await fetch("https://oauth2.googleapis.com/token", form({ code: "probe", client_id: e[k1]!, client_secret: e[k2]!, redirect_uri: redirect(p), grant_type: "authorization_code" }))
      : p === "linkedin" ? await fetch("https://www.linkedin.com/oauth/v2/accessToken", form({ grant_type: "authorization_code", code: "probe", redirect_uri: redirect(p), client_id: e[k1]!, client_secret: e[k2]! }))
      : p === "pinterest" ? await fetch("https://api.pinterest.com/v5/oauth/token", { ...form({ grant_type: "authorization_code", code: "probe", redirect_uri: redirect(p) }), headers: { authorization: pinBasic(), "content-type": "application/x-www-form-urlencoded" } })
      : p === "facebook" ? await fetch(`${FB}/oauth/access_token?${new URLSearchParams({ client_id: e[k1]!, client_secret: e[k2]!, grant_type: "client_credentials" })}`)
      : await fetch("https://api.instagram.com/oauth/access_token", form({ client_id: e[k1]!, client_secret: e[k2]!, grant_type: "authorization_code", redirect_uri: redirect(p), code: "probe" }));
    const t = (await r.text()).toLowerCase();
    const bad = /invalid_client|unauthorized_client|invalid client|client authentication|invalid platform app|error validating client secret|invalid app id|app_id.*invalid|"code":\s*101/.test(t);
    if (bad || (p === "facebook" && !r.ok)) return { ok: false, msg: "A platform nem fogadta el a kulcsokat. Nézd meg, hogy az app ID és a titkos kulcs ugyanabból az appból van-e (a titkosat a szem ikonnal megjelenítve másold)." };
  }
  const a = (await call<Acc[]>("admin_r_accounts")).find((x) => x.platform === p);
  if (!a) return { ok: true, msg: "A kulcsok jók. Most jöhet az Összekapcsolás." };
  try {
    const tok = await token(a);
    const url = p === "tiktok" ? "https://open.tiktokapis.com/v2/user/info/?fields=display_name" : p === "instagram" ? `${viaFb(a) ? FB : IG}/${viaFb(a) ? a.account_id : "me"}?fields=username&access_token=${encodeURIComponent(tok)}`
      : p === "facebook" ? `${FB}/${a.account_id}?fields=name&access_token=${encodeURIComponent(tok)}` : p === "pinterest" ? "https://api.pinterest.com/v5/user_account"
      : p === "youtube" ? `${YT}/channels?part=id&mine=true` : `https://api.linkedin.com/rest/organizations/${a.account_id}`;
    const r = await fetch(url, { headers: p === "instagram" || p === "facebook" ? {} : { authorization: `Bearer ${tok}`, ...(p === "linkedin" ? LI : {}) } });
    return r.ok ? { ok: true, msg: "A kulcsok jók, és a kapcsolat is működik: a platform válaszol." } : { ok: false, msg: `A kulcsok jók, de a kapcsolat nem válaszol (${r.status}). Kösd be újra.` };
  } catch (x) { return { ok: false, msg: String((x as Error)?.message || x).slice(0, 200) }; }
}

/* ---------- publishing from the planner ---------- */
export type Plan = { id: number; title: string; caption: string | null; code: string | null; platforms: string[]; media_url: string | null; media_kind: string | null; results: Record<string, { ok?: boolean; id?: string; error?: string; pending?: string }> };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const linkOf = (p: Plan) => (p.code ? `inkage.app/go/${p.code}` : "");
const textOf = (p: Plan) => [p.caption || p.title, linkOf(p)].filter(Boolean).join("\n\n");
async function bytes(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(`A fájl nem tölthető le (${r.status}).`); return Buffer.from(await r.arrayBuffer()); }

export async function publishTo(pf: string, plan: Plan): Promise<{ ok?: boolean; id?: string; error?: string; pending?: string }> {
  const accs = await call<Acc[]>("admin_r_accounts");
  const a = accs.find((x) => x.platform === pf);
  if (!a) return { error: "nincs bekötve" };
  const tok = await token(a), video = plan.media_kind === "video", url = plan.media_url;
  if (pf === "instagram") {
    if (!url) return { error: "Instagramra kép vagy videó kell." };
    const base = viaFb(a) ? FB : IG, id = a.account_id || "me";
    let container = plan.results?.instagram?.pending;
    if (!container) {
      const q = new URLSearchParams({ caption: textOf(plan), access_token: tok, ...(video ? { media_type: "REELS", video_url: url } : { image_url: url }) });
      container = (await json(await fetch(`${base}/${id}/media?${q}`, { method: "POST" }))).id as string;
    }
    for (let i = 0; i < 9; i++) {
      const st = await json(await fetch(`${base}/${container}?fields=status_code&access_token=${encodeURIComponent(tok)}`));
      if (st.status_code === "FINISHED") { const pub = await json(await fetch(`${base}/${id}/media_publish?creation_id=${container}&access_token=${encodeURIComponent(tok)}`, { method: "POST" })); return { ok: true, id: pub.id }; }
      if (st.status_code === "ERROR") return { error: "Az Instagram nem tudta feldolgozni a fájlt." };
      await sleep(4000);
    }
    return { pending: container };
  }
  if (pf === "facebook") {
    const page = a.account_id!;
    const r = video && url ? await fetch(`${FB}/${page}/videos?${new URLSearchParams({ file_url: url, description: textOf(plan), access_token: tok })}`, { method: "POST" })
      : url ? await fetch(`${FB}/${page}/photos?${new URLSearchParams({ url, caption: textOf(plan), access_token: tok })}`, { method: "POST" })
      : await fetch(`${FB}/${page}/feed?${new URLSearchParams({ message: textOf(plan), ...(plan.code ? { link: `https://${linkOf(plan)}` } : {}), access_token: tok })}`, { method: "POST" });
    const j = await json(r); return { ok: true, id: j.post_id || j.id };
  }
  if (pf === "youtube") {
    if (!url || !video) return { error: "YouTube-ra videó kell." };
    const buf = await bytes(url);
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-length": String(buf.length), "x-upload-content-type": "video/*" },
      body: JSON.stringify({ snippet: { title: plan.title.slice(0, 100), description: textOf(plan).slice(0, 4900), categoryId: "26" }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } }) });
    if (!init.ok) return { error: `YouTube ${init.status}: ${(await init.text()).slice(0, 160)}` };
    const up = await fetch(init.headers.get("location")!, { method: "PUT", headers: { "content-type": "video/*", "content-length": String(buf.length) }, body: buf });
    const j = await up.json().catch(() => ({})); return up.ok ? { ok: true, id: j.id } : { error: `YouTube ${up.status}: ${JSON.stringify(j).slice(0, 160)}` };
  }
  if (pf === "pinterest") {
    const h = { authorization: `Bearer ${tok}`, "content-type": "application/json" };
    if (!url) return { error: "Pinterestre kép vagy videó kell." };
    const board = env().PINTEREST_BOARD_ID || (await json(await fetch("https://api.pinterest.com/v5/boards?page_size=1", { headers: h }))).items?.[0]?.id;
    if (!board) return { error: "Nincs Pinterest-tábla. Hozz létre egyet, vagy add meg a PINTEREST_BOARD_ID-t." };
    let source: Record<string, unknown> = { source_type: "image_url", url };
    if (video) {
      const m = await json(await fetch("https://api.pinterest.com/v5/media", { method: "POST", headers: h, body: JSON.stringify({ media_type: "video" }) }));
      const fd = new FormData(); for (const [k, v] of Object.entries(m.upload_parameters || {})) fd.append(k, String(v)); fd.append("file", new Blob([new Uint8Array(await bytes(url))]), "video.mp4");
      const up = await fetch(m.upload_url, { method: "POST", body: fd }); if (!up.ok) return { error: `Pinterest-feltöltés ${up.status}` };
      for (let i = 0; i < 10; i++) { const st = await json(await fetch(`https://api.pinterest.com/v5/media/${m.media_id}`, { headers: h })); if (st.status === "succeeded") break; if (st.status === "failed") return { error: "A Pinterest nem tudta feldolgozni a videót." }; await sleep(3000); }
      source = { source_type: "video_id", media_id: m.media_id, cover_image_key_frame_time: 1 };
    }
    const pin = await json(await fetch("https://api.pinterest.com/v5/pins", { method: "POST", headers: h, body: JSON.stringify({ board_id: board, title: plan.title.slice(0, 100), description: textOf(plan).slice(0, 500), ...(plan.code ? { link: `https://${linkOf(plan)}` } : {}), media_source: source }) }));
    return { ok: true, id: pin.id };
  }
  if (pf === "tiktok") {
    if (!url || !video) return { error: "TikTokra videó kell." };
    const h = { authorization: `Bearer ${tok}`, "content-type": "application/json; charset=UTF-8" };
    const ci = (await json(await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", { method: "POST", headers: h }))).data || {};
    const privacy = (ci.privacy_level_options || []).includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
    const buf = await bytes(url);
    const init = (await json(await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", { method: "POST", headers: h,
      body: JSON.stringify({ post_info: { title: textOf(plan).slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
        source_info: { source: "FILE_UPLOAD", video_size: buf.length, chunk_size: buf.length, total_chunk_count: 1 } }) }))).data;
    const up = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-range": `bytes 0-${buf.length - 1}/${buf.length}`, "content-length": String(buf.length) }, body: buf });
    if (!up.ok) return { error: `TikTok-feltöltés ${up.status}` };
    return { ok: true, id: init.publish_id, ...(privacy === "SELF_ONLY" ? { error: "privátként ment ki (a TikTok auditja után lehet nyilvános)" } : {}) };
  }
  if (pf === "linkedin") {
    const owner = `urn:li:organization:${a.account_id}`, h = { authorization: `Bearer ${tok}`, "content-type": "application/json", ...LI };
    /* a picture goes up through the Images API first (initializeUpload → PUT the bytes), then the post carries it */
    let media: string | null = null;
    if (url && !video) {
      const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", { method: "POST", headers: h, body: JSON.stringify({ initializeUploadRequest: { owner } }) });
      const iv = init.ok ? (await init.json().catch(() => ({}))).value : null;
      if (iv?.uploadUrl && iv?.image) { const up = await fetch(iv.uploadUrl, { method: "PUT", headers: { authorization: `Bearer ${tok}` }, body: new Uint8Array(await bytes(url)) }); if (up.ok) media = iv.image; }
    }
    const r = await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: h,
      body: JSON.stringify({ author: owner, commentary: textOf(plan).slice(0, 2900), visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        ...(media ? { content: { media: { id: media, title: plan.title.slice(0, 100) } } } : {}), lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }) });
    if (!r.ok) return { error: `LinkedIn ${r.status}: ${(await r.text()).slice(0, 160)}` };
    return { ok: true, id: r.headers.get("x-restli-id") || undefined, ...(url && !media ? { error: video ? "a LinkedIn-poszt szöveges ment ki (videó nélkül: a videófeltöltés még nincs megírva)" : "a LinkedIn-poszt szöveges ment ki (a kép feltöltése nem sikerült)" } : {}) };
  }
  return { error: "ismeretlen platform" };
}

/* ---------- replies sent from the inbox ---------- */
export async function replyTo(source: string, itemId: string, text: string) {
  const it = await call<Record<string, string> | null>("admin_r_inbox_item", { p_source: source, p_item: itemId });
  const accs = await call<Acc[]>("admin_r_accounts");
  const acc = (p: string) => accs.find((a) => a.platform === p);
  if (source === "instagram") {
    const a = acc("instagram"); if (!a) throw new Error("Az Instagram nincs bekötve.");
    const base = viaFb(a) ? FB : IG, tok = await token(a);
    await json(await fetch(`${base}/${itemId}/replies?message=${encodeURIComponent(text)}&access_token=${encodeURIComponent(tok)}`, { method: "POST" }));
  } else if (source === "facebook") {
    const a = acc("facebook"); if (!a) throw new Error("A Facebook nincs bekötve.");
    await json(await fetch(`${FB}/${itemId}/comments?message=${encodeURIComponent(text)}&access_token=${encodeURIComponent(a.access_token)}`, { method: "POST" }));
  } else if (source === "youtube") {
    const a = acc("youtube"); if (!a) throw new Error("A YouTube nincs bekötve.");
    const tok = await token(a);
    await json(await fetch(`${YT}/comments?part=snippet`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ snippet: { parentId: itemId, textOriginal: text } }) }));
  } else throw new Error("Erre a forrásra innen nem lehet válaszolni.");
  void it;
  await call("admin_w_inbox_reply", { p_source: source, p_item: itemId, p_reply: text });
}


/* a connected account's fresh token, for the watch jobs (competitors, hashtags, mentions) */
export async function accToken(p: Platform) {
  const a = (await call<Acc[]>("admin_r_accounts")).find((x) => x.platform === p);
  if (!a) return null;
  return { tok: await token(a), id: a.account_id, viaFacebook: viaFb(a) };
}
export const GRAPH = { FB, IG, YT };
