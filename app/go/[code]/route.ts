import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/* InkAge (the same as Calligra's /v/…, here at /go/… because /v/ is a shared preview).
   Short links for videos and posts: inkage.app/go/12 opens the app tagged with where it was shared
   (utm_source / utm_medium / utm_campaign / utm_content=12), so the dashboard can tell which video brought the visit.
   Only the click itself is counted (country code, app it was opened in, phone or computer); no IP is stored. A HEAD
   request, a prefetch, a link preview or a robot leads on but is not counted; the same visitor counts once in 30
   minutes (a cookie, and in the database a salted hash of IP + browser that is wiped after an hour). */
const BOT = /bot\b|bot\/|crawl|spider|preview|slurp|WhatsApp|facebookexternalhit|vkShare|SkypeUriPreview|HeadlessChrome|PhantomJS|Lighthouse|curl\/|wget|python-requests|python-urllib|aiohttp|httpx|Go-http-client|node-fetch|undici|axios|libwww|httpie|Java\/|scrapy|okhttp\/[\d.]+$/i;
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toLowerCase().slice(0, 40);
  const ua = req.headers.get("user-agent") || "", h = (k: string) => (req.headers.get(k) || "").toLowerCase();
  const prefetch = req.method === "HEAD" || /prefetch|prerender|preview/.test(h("purpose") + h("sec-purpose") + h("x-purpose") + h("x-moz")) || req.headers.has("next-router-prefetch");
  /* the app it was opened in (its in-app browser says so in the user agent); a link preview is not a click */
  const kind = !ua.trim() || BOT.test(ua) ? "bot" : /musical_ly|bytedance|tiktok/i.test(ua) ? "tiktok" : /instagram/i.test(ua) ? "instagram" : /Messenger|FB_IAB\/MESSENGER|Orca-Android/i.test(ua) ? "messenger"
    : /FBAN|FBAV|FB_IAB/i.test(ua) ? "facebook" : /Pinterest/i.test(ua) ? "pinterest" : /LinkedInApp|LinkedIn/i.test(ua) ? "linkedin"
    : /com\.google\.ios\.youtube|com\.google\.android\.youtube|YouTube/i.test(ua) ? "youtube" : /Snapchat/i.test(ua) ? "snapchat" : /Threads|Barcelona/i.test(ua) ? "threads"
    : /Twitter|TwitterAndroid/i.test(ua) ? "x" : /Telegram/i.test(ua) ? "telegram" : "browser";
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  const seenCookie = `inkage_go_${code.replace(/[^a-z0-9-]/g, "")}`;
  const counts = kind !== "bot" && !prefetch;
  /* her own click (the owner mark's cookie), a reload within 30 minutes, a preview: leads on, not counted */
  const skip = !counts || req.cookies.get("inkage_own")?.value === "1" || req.cookies.get(seenCookie)?.value === "1";
  /* only a hash leaves this server (the database salts it again and keeps it for an hour): never the IP itself */
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const visitor = ip || ua ? createHash("sha256").update(`${ip}|${ua}`).digest("hex") : null;
  let l: { target?: string; source?: string; medium?: string; campaign?: string; code?: string } | null = null;
  if (/^[a-z0-9-]+$/.test(code)) {
    const body = { p_code: code, p_country: req.headers.get("x-vercel-ip-country"), p_kind: kind === "bot" ? "browser" : kind, p_device: device, p_own: skip };
    const rpc = (b: Record<string, unknown>) => fetch(`${SUPABASE_URL}/rest/v1/rpc/follow_short_link`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json" }, body: JSON.stringify(b), cache: "no-store",
    }).catch(() => null);
    let r = await rpc({ ...body, p_visitor: visitor });
    /* before the database update that adds p_visitor: the old function (PostgREST answers 404 for an unknown argument) */
    if (r && r.status === 404) r = await rpc(body);
    l = r && r.ok ? await r.json().catch(() => null) : null;
  }
  const u = new URL(l?.target && l.target.startsWith("/") && !l.target.startsWith("//") ? l.target : "/app", req.nextUrl.origin);
  if (l) {
    const tag = { utm_source: l.source || (["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube", "threads"].includes(kind) ? kind : "link"), utm_medium: l.medium || "social", utm_campaign: l.campaign, utm_content: l.code };
    for (const [k, v] of Object.entries(tag)) if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
  }
  const res = NextResponse.redirect(u, { status: 302, headers: { "cache-control": "no-store" } });
  if (l && counts) res.cookies.set(seenCookie, "1", { maxAge: 1800, path: "/go", httpOnly: true, sameSite: "lax", secure: true });
  return res;
}
