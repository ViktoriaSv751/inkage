import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { SITE, asAdmin, env } from "@/lib/admin/server";
import { authUrl, KEYS, PLATFORMS, type Platform } from "@/lib/admin/social";
import { extraAuthUrl } from "@/lib/admin/social-extra";

export const dynamic = "force-dynamic";

/* "Connect TikTok / Instagram / Facebook / Pinterest / LinkedIn" on /admin: off to the platform's own sign-in, with a one-time state kept in a cookie */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const p = (await params).platform as Platform;
  if (!PLATFORMS.includes(p)) return new NextResponse("Not found", { status: 404 });
  return asAdmin(async () => {
    /* without the platform's app keys the platform only shows its own error page; say what is missing instead */
    const e = env(), need = KEYS[p];
    const missing = need.filter((k) => !e[k]);
    if (missing.length) return NextResponse.redirect(`${SITE}/admin?connect=${encodeURIComponent("előbb add meg a kulcsokat a Kapcsolatok oldalon: " + missing.join(", "))}#connect`);
    const state = randomBytes(18).toString("base64url");
    /* ?slot=<id>: one of the extra TikTok / Instagram accounts, with the platform's login screen (not the account the browser is signed in to) */
    const slot = new URL(req.url).searchParams.get("slot");
    if (slot && /^[0-9a-f-]{36}$/.test(slot) && (p === "tiktok" || p === "instagram")) {
      const r = NextResponse.redirect(extraAuthUrl(p, state));
      r.cookies.set("adm_oauth", `${p}.${state}.${slot}`, { httpOnly: true, secure: SITE.startsWith("https"), sameSite: "lax", path: "/api/admin", maxAge: 600 });
      return r;
    }
    /* ?publish=1: the same sign-in with the write permissions the planner's publishing needs */
    const r = NextResponse.redirect(authUrl(p, state, new URL(req.url).searchParams.get("publish") === "1"));
    r.cookies.set("adm_oauth", `${p}.${state}`, { httpOnly: true, secure: SITE.startsWith("https"), sameSite: "lax", path: "/api/admin", maxAge: 600 });
    return r;
  });
}
