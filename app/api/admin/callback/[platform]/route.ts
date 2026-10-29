import { NextResponse, type NextRequest } from "next/server";
import { asAdmin, isAdmin, log, patchAccount, SITE, youtubePublished } from "@/lib/admin/server";
import { connect, PLATFORMS, syncSocial, type Platform } from "@/lib/admin/social";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* where each platform's numbers live on /admin: the owner lands there after connecting */
const PAGE: Record<Platform, string> = { tiktok: "social", instagram: "social", facebook: "social", pinterest: "social", linkedin: "social", youtube: "youtube" };

/* The platform sends the owner back here after she allowed access: save the account, then read its posts, but never
   longer than 40 seconds; a slow first read finishes in the next hourly run instead of ending on a 504 page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const p = (await params).platform as Platform;
  if (!PLATFORMS.includes(p)) return new NextResponse("Not found", { status: 404 });
  /* the sign-in ran out while she was on the platform's page: back to /admin with a plain sentence, not a bare 404 */
  if (!(await isAdmin())) return NextResponse.redirect(`${SITE}/admin?connect=${encodeURIComponent("Lejárt a belépés a kapcsolódás közben. Lépj be, és kösd be újra.")}#connect`);
  return asAdmin(async () => {
    const back = (msg: string, page = msg === "ok" || msg.startsWith("ok:") ? PAGE[p] : "connect") => {
      const r = NextResponse.redirect(`${SITE}/admin?connect=${encodeURIComponent(msg)}#${page}`);
      r.cookies.delete({ name: "adm_oauth", path: "/api/admin" });
      return r;
    };
    const q = req.nextUrl.searchParams;
    if (req.cookies.get("adm_oauth")?.value !== `${p}.${q.get("state")}`) return back("A belépés lejárt, próbáld újra.");
    const code = q.get("code");
    /* fixed sentences on the page: the platform's own text is never shown as if it were ours (it goes into the log) */
    if (!code) {
      const err = q.get("error") || "";
      if (err && err !== "access_denied") await log(p, false, null, `bekötés: ${err} ${q.get("error_description") || ""}`.slice(0, 300));
      return back(!err || err === "access_denied" ? "A kapcsolódást megszakítottad." : "A platform nem engedte a kapcsolódást. Próbáld újra; a részletek a Monitoring oldalon.");
    }
    try {
      await connect(p, code);
    } catch (e) {
      await log(p, false, null, `bekötés: ${String((e as Error)?.message || e)}`.slice(0, 300));
      /* our own plain sentences (a missing key and the like) are kept; anything with an address or a raw answer is not */
      const m = String((e as Error)?.message || e);
      return back(/https?:|[{}<>]|\b(token|secret|key)=/i.test(m) || m.length > 160 ? "Nem sikerült menteni a kapcsolatot. Próbáld újra; a részletek a Monitoring oldalon." : m);
    }
    /* YouTube in the OAuth "Testing" state: Google ends the connection after 7 days. The date is kept, so the
       Kapcsolatok page, the alerts and the phone warn before it happens (not when "Published" is set there). */
    if (p === "youtube" && !youtubePublished()) await patchAccount("youtube", { refresh_expires_at: new Date(Date.now() + 7 * 864e5 - 3600e3).toISOString() }).catch(() => null);
    /* only the platform just connected (a Facebook page brings its Instagram account along), within a time limit */
    const sync = syncSocial(p === "facebook" ? ["facebook", "instagram"] : [p]).then((r) => (Object.values(r).some((v) => /^hiba/i.test(v)) ? "hiba" : "ok")).catch(() => "hiba");
    const res = await Promise.race([sync, new Promise<string>((ok) => setTimeout(() => ok("lassú"), 40_000))]);
    return back(res === "ok" ? "ok" : res === "lassú" ? "ok:slow" : "ok:syncerr");
  });
}
