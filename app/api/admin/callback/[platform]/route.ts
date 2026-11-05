import { NextResponse, type NextRequest } from "next/server";
import { asAdmin, call, isAdmin, log, patchAccount, SITE, youtubePublished } from "@/lib/admin/server";
import { connect, PLATFORMS, syncSocial, type Platform } from "@/lib/admin/social";
import { asInvite, claimInvite, exchange, syncExtra, type ExtraPlatform } from "@/lib/admin/social-extra";
import { invitePage, PF } from "@/lib/admin/invite-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* where each platform's numbers live on /admin: the owner lands there after connecting */
const PAGE: Record<Platform, string> = { tiktok: "social", instagram: "social", facebook: "social", pinterest: "social", linkedin: "social", youtube: "youtube" };

/* The platform sends the owner back here after she allowed access: save the account, then read its posts, but never
   longer than 40 seconds; a slow first read finishes in the next hourly run instead of ending on a 504 page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const p = (await params).platform as Platform;
  if (!PLATFORMS.includes(p)) return new NextResponse("Not found", { status: 404 });
  /* a partner's invite (their own phone, no admin session): only this cookie and the invite itself let it in */
  const inv = req.cookies.get("inv_oauth")?.value?.split(".");
  if (inv?.length === 3 && inv[0] === p && inv[1] === req.nextUrl.searchParams.get("state")) return invited(req, p as ExtraPlatform, inv[2]);
  /* the sign-in ran out while she was on the platform's page: back to /admin with a plain sentence, not a bare 404 */
  if (!(await isAdmin())) return NextResponse.redirect(`${SITE}/admin?connect=${encodeURIComponent("Lejárt a belépés a kapcsolódás közben. Lépj be, és kösd be újra.")}#connect`);
  return asAdmin(async () => {
    const back = (msg: string, page = msg === "ok" || msg.startsWith("ok:") ? PAGE[p] : "connect") => {
      const r = NextResponse.redirect(`${SITE}/admin?connect=${encodeURIComponent(msg)}#${page}`);
      r.cookies.delete({ name: "adm_oauth", path: "/api/admin" });
      return r;
    };
    const q = req.nextUrl.searchParams;
    /* "<platform>.<state>" for the main account, "<platform>.<state>.<id>" for one of the extra accounts */
    const ck = (req.cookies.get("adm_oauth")?.value || "").split(".");
    if (ck[0] !== p || !ck[1] || ck[1] !== q.get("state")) return back("A belépés lejárt, próbáld újra.");
    const slot = /^[0-9a-f-]{36}$/.test(ck[2] || "") && (p === "tiktok" || p === "instagram") ? ck[2] : null;
    const code = q.get("code");
    /* fixed sentences on the page: the platform's own text is never shown as if it were ours (it goes into the log) */
    if (!code) {
      const err = q.get("error") || "";
      if (err && err !== "access_denied") await log(p, false, null, `bekötés: ${err} ${q.get("error_description") || ""}`.slice(0, 300));
      return back(!err || err === "access_denied" ? "A kapcsolódást megszakítottad." : "A platform nem engedte a kapcsolódást. Próbáld újra; a részletek a Monitoring oldalon.");
    }
    if (slot) {
      try { await call("admin_w_extra_connect", { p_id: slot, p_row: await exchange(p as ExtraPlatform, code) }); }
      catch (e) {
        await log(p, false, null, `bekötés (további fiók): ${String((e as Error)?.message || e)}`.slice(0, 300));
        const m = String((e as Error)?.message || e).replace(/^.*?: /, "");
        return back(/https?:|[{}<>]|\b(token|secret|key)=/i.test(m) || m.length > 160 ? "Nem sikerült menteni a kapcsolatot. Próbáld újra; a részletek a Monitoring oldalon." : m, "accounts");
      }
      const res = await Promise.race([syncExtra({ ids: [slot], budgetMs: 35_000 }).then((r) => (/^hiba/.test(r || "") ? "hiba" : "ok")).catch(() => "hiba"), new Promise<string>((ok) => setTimeout(() => ok("lassú"), 40_000))]);
      return back(res === "ok" ? "ok" : res === "lassú" ? "ok:slow" : "ok:syncerr", "accounts");
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

/* the partner came back from the platform: save the account under the invite (the invite then stops working); its
   numbers come in the next hourly run. A plain page in English, never the admin. */
async function invited(req: NextRequest, p: ExtraPlatform, t: string) {
  const q = req.nextUrl.searchParams, name = PF[p];
  const done = (r: NextResponse) => { r.cookies.delete({ name: "inv_oauth", path: "/api" }); return r; };
  const code = q.get("code");
  if (!code) return done(invitePage("Not connected", `<p>${q.get("error") === "access_denied" ? "You cancelled the connection." : `${name} did not allow the connection.`} You can open the invite link again to retry.</p>`));
  try {
    const label = await asInvite(t, p, async () => claimInvite(t, await exchange(p, code)));
    return done(invitePage("Connected ✓", `<p><b>${label.replace(/[<>&"]/g, "")}</b> is now connected. Thank you! You can close this page.</p>`));
  } catch (e) {
    const m = String((e as Error)?.message || e);
    await rpcLog(p, m);
    return done(invitePage("Could not connect", /már be van kötve|fő (Calligra|InkAge)/.test(m) ? "<p>This account is already connected.</p>" : /lejárt|felhasznált/.test(m) ? "<p>The invite has expired or was already used. Please ask for a new link.</p>" : "<p>Something went wrong. Please open the invite link again, or ask for a new one.</p>"));
  }
}
/* no admin session here: the failure goes to the server log only (Vercel), never with a token */
async function rpcLog(p: string, m: string) { console.error(`invite ${p}: ${m.replace(/(access_token|token|secret)=[^&\s"]+/gi, "$1=…").slice(0, 300)}`); }
