/* More TikTok and Instagram accounts next to the main InkAge ones (up to 10 a platform): the partners'
   accounts abroad. Each is connected once (by the owner, or by the partner from their own phone through an invite
   link, so the owner never signs in to a foreign account from Hungary), then the hourly run reads its followers and
   every post's numbers through the same official APIs as the main accounts, into their own tables
   (social_extra_*), so nothing on the existing pages changes. Server-only. */
import { call, env, log, rpcPublic, withKeys } from "./server";
import { authUrl, KEYS } from "./social";

export type ExtraPlatform = "tiktok" | "instagram";
export const EXTRA_PLATFORMS: ExtraPlatform[] = ["tiktok", "instagram"];

type Row = { account_id: string; username: string | null; display_name: string | null; avatar_url: string | null; access_token: string; refresh_token: string | null;
  token_expires_at: string | null; refresh_expires_at: string | null; scopes: string | null };
type Acc = { id: string; platform: ExtraPlatform; label: string; account_id: string | null; access_token: string; refresh_token: string | null; token_expires_at: string | null; last_sync_at: string | null };
type Post = Record<string, unknown>;

const plus = (sec?: number) => (sec ? new Date(Date.now() + sec * 1000).toISOString() : null);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const IG = "https://graph.instagram.com/v23.0";
const TT = "https://open.tiktokapis.com/v2";

async function json(r: Response) {
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; } // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r.ok || (j?.error?.code && j.error.code !== "ok") || j?.error_message) throw new Error(`${r.status} ${JSON.stringify(j?.error || j?.error_message || j).slice(0, 200)}`);
  return j;
}
const get = (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(30_000) }).then(json);

/* the platform's sign-in, always with its account picker / login screen: the browser may already be signed in to
   another account of the same platform (the main InkAge one), which would otherwise be connected again */
export function extraAuthUrl(p: ExtraPlatform, state: string) {
  const u = new URL(authUrl(p, state));
  if (p === "tiktok") u.searchParams.set("disable_auto_auth", "1"); else u.searchParams.set("force_reauth", "true");
  return u.toString();
}

/* the code the platform sent back → the account's tokens and profile */
export async function exchange(p: ExtraPlatform, code: string): Promise<Row> {
  const e = env(), redirect = new URL(authUrl(p, "x")).searchParams.get("redirect_uri")!;
  if (p === "tiktok") {
    const t = await get(`${TT}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY!, client_secret: e.TIKTOK_CLIENT_SECRET!, code, grant_type: "authorization_code", redirect_uri: redirect }) });
    const u = (await get(`${TT}/user/info/?fields=open_id,avatar_url,display_name,username`, { headers: { authorization: `Bearer ${t.access_token}` } })).data?.user || {};
    return { account_id: t.open_id, username: u.username || null, display_name: u.display_name || null, avatar_url: u.avatar_url || null, access_token: t.access_token,
      refresh_token: t.refresh_token || null, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_expires_in), scopes: t.scope || null };
  }
  const s = await get("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.INSTAGRAM_APP_ID!, client_secret: e.INSTAGRAM_APP_SECRET!, grant_type: "authorization_code", redirect_uri: redirect, code }) });
  const short = s.access_token || s.data?.[0]?.access_token;
  const l = await get(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: e.INSTAGRAM_APP_SECRET!, access_token: short })}`);
  const me = await get(`${IG}/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(l.access_token)}`);
  return { account_id: String(me.user_id || s.user_id || s.data?.[0]?.user_id || ""), username: me.username || null, display_name: me.name || null, avatar_url: me.profile_picture_url || null,
    access_token: l.access_token, refresh_token: null, token_expires_at: plus(l.expires_in) || plus(60 * 86400), refresh_expires_at: null, scopes: (s.permissions || []).join?.(",") || null };
}

/* ---------- the partner's invite: no admin session, only this one platform's app keys ---------- */
export type Invite = { id: string; platform: ExtraPlatform; label: string };
export const inviteInfo = (t: string) => (/^[0-9a-f]{48}$/.test(t) ? rpcPublic<Invite | null>("social_invite_info", { p_invite: t }).catch(() => null) : Promise.resolve(null));
/* the app keys come from the database only for a valid invite and only with the server's own secret (SOCIAL_INVITE_TOKEN):
   the invite link alone never reads them */
export async function asInvite<T>(t: string, p: ExtraPlatform, fn: () => Promise<T>): Promise<T> {
  const own = Object.fromEntries(KEYS[p].map((k) => [k, process.env[k] || ""]));
  const keys = own[KEYS[p][0]] && own[KEYS[p][1]] ? own
    : await rpcPublic<Record<string, string> | null>("social_invite_keys", { p_srv: process.env.SOCIAL_INVITE_TOKEN || "", p_invite: t }).catch(() => null);
  if (!keys || !keys[KEYS[p][0]]) throw new Error("A meghívós bekötés még nincs beállítva a szerveren (SOCIAL_INVITE_TOKEN).");
  return withKeys(keys, fn);
}
export const claimInvite = (t: string, row: Row) => rpcPublic<string>("social_invite_claim", { p_invite: t, p_row: row });

/* ---------- the hourly read ---------- */
async function token(a: Acc) {
  const left = a.token_expires_at ? new Date(a.token_expires_at).getTime() - Date.now() : 0;
  if (a.platform === "tiktok" && left < 3600_000 && a.refresh_token) {
    const t = await get(`${TT}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, client_secret: env().TIKTOK_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: a.refresh_token }) });
    await call("admin_w_extra_patch", { p_id: a.id, p_set: { access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: plus(t.expires_in), refresh_expires_at: plus(t.refresh_expires_in) } });
    return t.access_token as string;
  }
  if (a.platform === "instagram" && left < 20 * 86400_000) {
    const t = await get(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.access_token)}`);
    await call("admin_w_extra_patch", { p_id: a.id, p_set: { access_token: t.access_token, token_expires_at: plus(t.expires_in) || plus(60 * 86400) } });
    return t.access_token as string;
  }
  return a.access_token;
}

async function readTiktok(a: Acc, tok: string, until: number) {
  const h = { authorization: `Bearer ${tok}` };
  const u = (await get(`${TT}/user/info/?fields=open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count`, { headers: h })).data.user;
  const posts: Post[] = [];
  let cursor: number | null = null;
  /* the newest 200 videos (20 a page) */
  for (let i = 0; i < 10 && Date.now() < until; i++) {
    const j: any = (await get(`${TT}/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count`, // eslint-disable-line @typescript-eslint/no-explicit-any
      { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }) })).data;
    for (const v of j.videos || []) posts.push({ post_id: String(v.id), created_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null, kind: "video",
      title: (v.title || v.video_description || "").slice(0, 300), url: v.share_url || null, thumb: v.cover_image_url || null, duration: v.duration ?? null,
      views: v.view_count ?? null, likes: v.like_count ?? null, comments: v.comment_count ?? null, shares: v.share_count ?? null });
    if (!j.has_more || !j.cursor) break;
    cursor = Number(j.cursor);
  }
  return { profile: { username: u.username || null, display_name: u.display_name || null, avatar_url: u.avatar_url || null },
    daily: { followers: u.follower_count ?? null, following: u.following_count ?? null, likes: u.likes_count ?? null, posts: u.video_count ?? null }, posts };
}

async function readInstagram(a: Acc, tok: string, until: number) {
  const q = (x: string) => `${x}${x.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(tok)}`;
  const me = await get(q(`${IG}/me?fields=username,name,profile_picture_url,followers_count,follows_count,media_count`));
  const posts: Post[] = [];
  let next: string | null = q(`${IG}/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50`);
  for (let i = 0; next && i < 2 && Date.now() < until; i++) {
    const j: any = await get(next); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const m of j.data || []) posts.push({ post_id: m.id, created_at: m.timestamp || null, kind: (m.media_product_type === "REELS" ? "reel" : String(m.media_type || "").toLowerCase()) || null,
      title: (m.caption || "").slice(0, 300), url: m.permalink || null, thumb: m.thumbnail_url || (m.media_type === "IMAGE" ? m.media_url : null) || null,
      likes: m.like_count ?? null, comments: m.comments_count ?? null });
    next = j.paging?.next || null;
  }
  /* views, reach, saves and shares of the posts of the last 30 days (Instagram gives them per post only) */
  for (const p of posts.filter((x) => x.created_at && Date.now() - new Date(String(x.created_at)).getTime() < 30 * 86400_000).slice(0, 30)) {
    if (Date.now() > until) break;
    const j = await get(q(`${IG}/${p.post_id}/insights?metric=views,reach,saved,shares`)).catch(() => null);
    for (const x of j?.data || []) p[x.name === "saved" ? "saves" : x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? null;
  }
  return { profile: { username: me.username || null, display_name: me.name || null, avatar_url: me.profile_picture_url || null },
    daily: { followers: me.followers_count ?? null, following: me.follows_count ?? null, likes: null, posts: me.media_count ?? null }, posts };
}

/* every connected extra account (or only these ids), longest unread first; one read in the last 10 minutes is enough
   unless forced. Gives one line for the run's log, or null when there is no extra account at all. */
export async function syncExtra(opt: { ids?: string[]; force?: boolean; budgetMs?: number } = {}): Promise<string | null> {
  const t0 = Date.now(), until = t0 + (opt.budgetMs ?? 60_000);
  const accs = (await call<Acc[]>("admin_r_extra_accounts").catch(() => [] as Acc[])).filter((a) => !opt.ids || opt.ids.includes(a.id))
    .sort((a, b) => String(a.last_sync_at || "").localeCompare(String(b.last_sync_at || "")));
  if (!accs.length) return null;
  let read = 0, posts = 0, fresh = 0; const bad: string[] = [];
  for (const a of accs) {
    if (!opt.force && !opt.ids && a.last_sync_at && Date.now() - new Date(a.last_sync_at).getTime() < 10 * 60_000) { fresh++; continue; }
    if (Date.now() > until) break;
    try {
      const tok = await token(a);
      const r = a.platform === "tiktok" ? await readTiktok(a, tok, until) : await readInstagram(a, tok, until);
      posts += await call<number>("admin_w_extra_sync", { p_id: a.id, p_day: today(), p_daily: r.daily, p_posts: r.posts });
      await call("admin_w_extra_patch", { p_id: a.id, p_set: { ...r.profile, last_sync_at: new Date().toISOString(), last_error: null } });
      read++;
    } catch (e) {
      const m = String((e as Error)?.message || e).replace(/(access_token|token|secret)=[^&\s"]+/gi, "$1=…").slice(0, 300);
      bad.push(`${a.label}: ${m.slice(0, 80)}`);
      await call("admin_w_extra_patch", { p_id: a.id, p_set: { last_error: m } }).catch(() => null);
      await log(`${a.platform}:${a.label}`.slice(0, 60), false, null, m);
    }
  }
  if (!read && !bad.length) return fresh ? "friss" : null;
  return bad.length ? `hiba: ${bad.join("; ")}${read ? ` (${read} fiók rendben)` : ""}` : `${read} fiók, ${posts} poszt`;
}
