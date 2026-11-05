import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { SITE } from "@/lib/admin/server";
import { asInvite, extraAuthUrl, inviteInfo } from "@/lib/admin/social-extra";
import { invitePage, PF, esc } from "@/lib/admin/invite-page";

export const dynamic = "force-dynamic";

/* The partner's invite link (inkage.app/api/invite/<token>): what it does, then off to the platform's own sign-in on
   their own phone. Read-only access: profile and the posts' public numbers; nothing is posted. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const t = (await params).token;
  const inv = await inviteInfo(t);
  if (!inv) return invitePage("This link has expired", "<p>The invite is no longer valid (it works once and for 14 days). Please ask for a new link.</p>", undefined, 410);
  const name = PF[inv.platform];
  if (new URL(req.url).searchParams.get("go") !== "1") {
    return invitePage(`Connect your ${name} account`,
      `<p>This connects <b>${esc(inv.label)}</b> to InkAge's statistics.</p><ul><li>Read-only: your profile, follower count and your posts' views, likes, comments and shares.</li><li>Nothing is posted and no messages are read.</li><li>You can remove the access any time in ${name}'s settings.</li></ul><p>Sign in with the ${name} account you post from, on this phone.</p>`,
      { href: `${SITE}/api/invite/${t}?go=1`, label: `Continue with ${name}` });
  }
  try {
    const state = randomBytes(18).toString("base64url");
    const url = await asInvite(t, inv.platform, async () => extraAuthUrl(inv.platform, state));
    const r = NextResponse.redirect(url);
    r.cookies.set("inv_oauth", `${inv.platform}.${state}.${t}`, { httpOnly: true, secure: SITE.startsWith("https"), sameSite: "lax", path: "/api", maxAge: 900 });
    return r;
  } catch {
    return invitePage("Not available right now", "<p>Connecting is not set up yet on our side. Please try again later.</p>", undefined, 503);
  }
}
