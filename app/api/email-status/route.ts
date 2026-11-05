import { NextResponse } from "next/server";
import { asAdmin, env } from "@/lib/admin/server";

/** Read-only check of whether the e-mails are switched on (the Rendszer page of /admin). Reports only yes/no per
    setting, never a value. Also asks Resend whether the sending domain is verified (no e-mail is sent). Admin only (a
    plain 404 for anyone else); the keys come from Vercel or from the Kapcsolatok page, like everywhere on /admin. */
export const dynamic = "force-dynamic";

export async function GET() {
  return asAdmin(async () => {
    const e = env();
    const key = e.RESEND_API_KEY;
    const from = e.RESEND_FROM || e.MAIL_FROM || e.ALERT_FROM || "InkAge <onboarding@resend.dev>";
    const fromDomain = (from.match(/@([^>\s]+)/) || [])[1] || "";
    let domain: { name: string; status: string } | null = null;
    let resend_key_works = false;
    if (key) {
      const r = await fetch("https://api.resend.com/domains", { headers: { authorization: "Bearer " + key }, signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (r && r.ok) {
        resend_key_works = true;
        const j = (await r.json().catch(() => ({}))) as { data?: { name: string; status: string }[] };
        const d = (j.data || []).find((x) => x.name === fromDomain);
        domain = d ? { name: d.name, status: d.status } : { name: fromDomain, status: "not_added" };
      } else if (r && r.status === 401) {
        /* a "sending only" key cannot list domains but can still send */
        resend_key_works = (await r.text().catch(() => "")).includes("restricted");
      }
    }
    /* the app's own e-mails (lib/mail.ts: welcome, sign-up notice, care mails) read only Vercel's variables: a key saved
       on the Kapcsolatok page serves the dashboard's digest, not them. Supabase's own messages (confirmation, new
       password) go through Supabase's mail settings, which this page cannot see. */
    const hook = !!process.env.SEND_EMAIL_HOOK_SECRET, app = !!process.env.RESEND_API_KEY;
    return NextResponse.json(
      {
        resend_api_key: !!key,
        resend_key_works,
        sending_domain: domain,
        from_address_domain: fromDomain,
        send_email_hook_secret: hook,
        app_key_in_vercel: app,
        emails: { signup_confirmation: app && hook, password_reset: app && hook, welcome: app, password_changed: app },
      },
      { headers: { "cache-control": "no-store" } },
    );
  });
}
