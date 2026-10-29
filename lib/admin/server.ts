/* Server-only helpers for the private /admin dashboard: who may act, and the writes into the admin tables.
   No service-role key: every write goes through a fixed database function (admin_w_*, admin_r_*) that lets in only
   the signed-in admin (her own session) or the morning run, which pg_cron starts with a token the database keeps
   for itself (admin_secrets). Platform secrets still come only from Vercel environment variables. */
import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://inkage.app";

type Sb = NonNullable<Awaited<ReturnType<typeof supabaseServer>>>;
type Cred = ({ sb: Sb; token: null } | { sb: null; token: string }) & { keys?: Record<string, string> };
const als = new AsyncLocalStorage<Cred>();

/* the signed-in visitor is an admin (public.is_admin(), the same check every admin function makes) */
export async function isAdmin() {
  return !!(await adminCred());
}
async function adminCred(): Promise<Cred | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.rpc("is_admin");
  return data === true ? { sb, token: null } : null;
}

/* the morning run from pg_cron: "Authorization: Bearer <token>", checked by the database (true / false only) */
async function cronCred(req: Request): Promise<Cred | null> {
  const tok = req.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!tok) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_cron_ok`, { method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ p_token: tok }), cache: "no-store" });
  return r.ok && (await r.json()) === true ? { sb: null, token: tok } : null;
}

/* a route's body, run as that caller (or a plain 404 when not allowed); every admin write inside uses the caller.
   A request another site's page started (its Origin is not this site) never runs: the browser sends the admin's cookie
   with it, but not her intent. A POST always carries Origin; the platforms' sign-in redirects back (GET) carry none. */
export async function asAdmin(fn: () => Promise<Response>) {
  const h = await Promise.resolve().then(() => headers()).catch(() => null);
  const o = h?.get("origin");
  if (o && o !== "null") { try { if (new URL(o).host !== h?.get("host")) return new Response("Forbidden", { status: 403 }); } catch { return new Response("Forbidden", { status: 403 }); } }
  else if (o === "null") return new Response("Forbidden", { status: 403 });
  return guard(await adminCred(), fn);
}
/* a scheduled call: its start and its finish are written down (admin_runs), so the Monitoring page shows whether the
   route really did its work, not only that pg_cron queued the request */
export async function asCron(req: Request, fn: () => Promise<Response>) {
  const u = new URL(req.url);
  return guard(await cronCred(req), () => track(u.pathname + u.search, "cron", fn));
}
function guard(c: Cred | null, fn: () => Promise<Response>) {
  if (!c) return Promise.resolve(new Response("Not found", { status: 404 }));
  /* the keys: with the server's own token (once the keys are locked to the server, only that or the cron token reads them) */
  return als.run(c, async () => {
    c.keys = await call<Record<string, string>>("admin_r_keys", c.token ? {} : { p_token: process.env.ADMIN_SERVER_TOKEN || null }).catch(() => ({}));
    noteRelease();
    return fn();
  });
}

/* the release running now, once per server instance: the first admin or scheduled request after a deploy records it
   (the rules run every 5 minutes, so a release shows within minutes, not an hour later) */
let releaseNoted = false;
function noteRelease() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (releaseNoted || !sha) return;
  releaseNoted = true;
  call("admin_w_rows", { p_table: "admin_releases", p_rows: [{ sha: sha.slice(0, 12), msg: String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "").split("\n")[0].slice(0, 200) }] })
    .catch(() => { releaseNoted = false; });
}

/* One run of a route, written down: started, then finished with ok / error and a short summary. A summary that says
   "hiba" for a part (one platform failed while the others worked) marks the run as failed, with that part named. */
export async function track(job: string, via: "cron" | "admin", fn: () => Promise<Response>): Promise<Response> {
  const id = await call<number>("admin_w_run_start", { p_job: job.slice(0, 200), p_via: via }).catch(() => null);
  const end = (ok: boolean, msg: string) => (id ? call("admin_w_run_end", { p_id: id, p_ok: ok, p_message: msg.slice(0, 500) }).catch(() => null) : null);
  let res: Response;
  try { res = await fn(); } catch (e) { await end(false, String((e as Error)?.message || e)); throw e; }
  const body = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
  const parts = body ? Object.entries(body).filter(([k]) => k !== "ok") : [];
  const bad = parts.filter(([, v]) => typeof v === "string" && /^(hiba|error|nem sikerült)/i.test(v));
  const ok = res.ok && body?.ok !== false && !bad.length;
  const msg = body?.error ? String(body.error)
    : bad.length ? "részben hibás: " + bad.map(([k, v]) => `${k}: ${v}`).join(" · ")
    : parts.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") || `HTTP ${res.status}`;
  await end(ok, msg);
  return res;
}

/* the settings: a Vercel environment variable wins, otherwise the key saved on /admin (Supabase Vault) */
/* InkAge: its own sender address is MAIL_FROM in Vercel (the dashboard reads RESEND_FROM) */
export const env = (): Record<string, string | undefined> => { const e: Record<string, string | undefined> = { ...(als.getStore()?.keys || {}), ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) }; if (!e.RESEND_FROM && e.MAIL_FROM) e.RESEND_FROM = e.MAIL_FROM; return e; };

/* one admin database function, as the caller of this request */
export async function call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const c = als.getStore();
  if (!c) throw new Error("Nincs jogosultság.");
  if (c.sb) {
    const { data, error } = await c.sb.rpc(fn, { p_token: null, ...args });
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ p_token: c.token, ...args }), cache: "no-store" });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

/* one admin-only database function (is_admin(), no token argument) with the signed-in admin's own session. call()
   always adds p_token, which a function without that argument does not accept (PostgREST finds no such function). */
export async function callAdmin<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const c = als.getStore();
  if (!c?.sb) throw new Error("Nincs jogosultság.");
  const { data, error } = await c.sb.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/* insert or update rows of one admin table (admin_w_<table>; the conflict columns are fixed there) */
export async function upsert(table: string, rows: Record<string, unknown>[], _onConflict?: string) {
  for (let i = 0; i < rows.length; i += 500) await call(`admin_w_${table}`, { p_rows: rows.slice(i, i + 500) });
  return rows.length;
}

/* change some columns of one connected TikTok / Instagram account */
export const patchAccount = (platform: string, set: Record<string, unknown>) => call("admin_w_social_account_patch", { p_platform: platform, p_set: set });

export async function log(source: string, ok: boolean, rows: number | null, message = "") {
  try { await call("admin_w_log", { p_source: source, p_ok: ok, p_rows: rows, p_message: message.slice(0, 500) }); } catch {}
}

/* every key the Kapcsolatok page can take (the same list as public.admin_key_ok) */
export const KEY_NAMES = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET",
  "PINTEREST_APP_ID", "PINTEREST_APP_SECRET", "PINTEREST_BOARD_ID", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_API_KEY",
  "YOUTUBE_OAUTH_PUBLISHED", "PSI_API_KEY", "BING_WMT_KEY", "GOOGLE_CSE_KEY", "GOOGLE_CSE_ID", "RESEND_WEBHOOK_SECRET", "RESEND_API_KEY", "RESEND_FROM", "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY", "ADMIN_AI_MODEL", "ADMIN_AIVIS_MODEL", "OPENAI_MODEL", "PERPLEXITY_MODEL", "COMPETITOR_COUNTRY", "VERCEL_API_TOKEN", "VERCEL_PROJECT",
  "GSC_SERVICE_ACCOUNT_JSON", "GSC_SITE_URL", "ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_APP_ID", "ASC_VENDOR_NUMBER", "PLAY_SERVICE_ACCOUNT_JSON", "PLAY_PACKAGE",
  "PLAY_REPORTS_BUCKET", "ANTHROPIC_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;

/* YouTube in the OAuth "Testing" state gives a connection that ends after 7 days; "Published" (set on /admin) does not */
export const youtubePublished = () => /^(1|igen|yes|true|published)$/i.test(env().YOUTUBE_OAUTH_PUBLISHED || "");

/* which settings exist (yes / no only, never a value), and where each key comes from. The database needs no key;
   whether the schedule really runs is answered by the status route from the runs themselves. */
export function settings() {
  const e = env(), vault = als.getStore()?.keys || {};
  return {
    service_role: true,
    /* every key: set or not, and where from ("vercel" wins over "vault", the key saved on /admin) */
    keys: Object.fromEntries(KEY_NAMES.map((k) => [k, !!e[k]])) as Record<string, boolean>,
    src: Object.fromEntries(KEY_NAMES.filter((k) => e[k]).map((k) => [k, process.env[k] ? (vault[k] ? "both" : "vercel") : "vault"])) as Record<string, "vercel" | "vault" | "both">,
    youtube_published: youtubePublished(),
    tiktok: !!(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET),
    instagram: !!(e.INSTAGRAM_APP_ID && e.INSTAGRAM_APP_SECRET),
    facebook: !!(e.FACEBOOK_APP_ID && e.FACEBOOK_APP_SECRET),
    pinterest: !!(e.PINTEREST_APP_ID && e.PINTEREST_APP_SECRET),
    linkedin: !!(e.LINKEDIN_CLIENT_ID && e.LINKEDIN_CLIENT_SECRET),
    youtube: !!(e.YOUTUBE_CLIENT_ID && e.YOUTUBE_CLIENT_SECRET),
    gsc: !!e.GSC_SERVICE_ACCOUNT_JSON,
    email: !!e.RESEND_API_KEY,
    apple: !!(e.ASC_ISSUER_ID && e.ASC_KEY_ID && e.ASC_PRIVATE_KEY && e.ASC_APP_ID),
    apple_sales: !!e.ASC_VENDOR_NUMBER,
    google_play: !!e.PLAY_SERVICE_ACCOUNT_JSON,
    google_installs: !!e.PLAY_REPORTS_BUCKET,
    ai: !!e.ANTHROPIC_API_KEY,
    openai: !!e.OPENAI_API_KEY,
    perplexity: !!e.PERPLEXITY_API_KEY,
    telegram: !!(e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID),
    push: !!e.VAPID_PUBLIC_KEY,
    bing: !!e.BING_WMT_KEY,
    cse: !!(e.GOOGLE_CSE_KEY && e.GOOGLE_CSE_ID),
    resend_webhook: !!e.RESEND_WEBHOOK_SECRET,
    vercel: !!e.VERCEL_API_TOKEN,
    server_token: !!process.env.ADMIN_SERVER_TOKEN,
    psi: !!e.PSI_API_KEY,
    gsc_site: e.GSC_SITE_URL || "sc-domain:inkage.app",
    redirect_tiktok: `${SITE}/api/admin/callback/tiktok`,
    redirect_instagram: `${SITE}/api/admin/callback/instagram`,
    redirect_facebook: `${SITE}/api/admin/callback/facebook`,
    redirect_pinterest: `${SITE}/api/admin/callback/pinterest`,
    redirect_linkedin: `${SITE}/api/admin/callback/linkedin`,
    redirect_youtube: `${SITE}/api/admin/callback/youtube`,
  };
}
