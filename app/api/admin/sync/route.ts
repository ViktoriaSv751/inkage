import { NextResponse } from "next/server";
import { asAdmin, asCron, call, settings, track } from "@/lib/admin/server";
import { syncSocial } from "@/lib/admin/social";
import { syncCwv, syncGsc, syncIndex } from "@/lib/admin/gsc";
import { syncStores } from "@/lib/admin/stores";
import { syncCompetitors } from "@/lib/admin/competitors";
import { notifyNews, notifySystem } from "@/lib/admin/push";
import { syncKwIdeas, syncSeo } from "@/lib/admin/seo";
import { checkRules, measureUptime, runWatch, syncAiVisibility } from "@/lib/admin/watch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* "ok" is false when any part says "hiba": the run's record (admin_runs) and the Monitoring page then show it red */
const J = (o: Record<string, unknown>) => {
  const bad = Object.values(o).some((v) => typeof v === "string" && /^hiba/i.test(v));
  return NextResponse.json({ ok: !bad, ...o }, { headers: { "cache-control": "no-store" } });
};

async function run(only?: string | null, force = false) {
  /* every 5 minutes (admin-rules): the alert rules, then what the system itself should tell the phone */
  if (only === "rules") {
    /* the real response time of every watched address first (the latency rule reads it) */
    const up = await measureUptime().catch((e) => "hiba: " + String((e as Error)?.message || e).slice(0, 80));
    const fired = await checkRules(); const sys = await notifySystem().catch(() => 0);
    return J({ uptime: up, rules: `${fired} riasztás`, system: `${sys} jelzés` });
  }
  /* the hourly run, and every social page that opens: only the social platforms, then whatever is new goes to the phone.
     An account read in the last 10 minutes is not read again (the page opens came on top of the hourly run), unless
     forced (?force=1); when nothing was read, nothing new goes to the phone either. */
  if (only === "social") {
    const r = await syncSocial(undefined, undefined, { force, freshMs: 10 * 60_000 });
    const parts = Object.values(r);
    if (!parts.length || parts.some((v) => v !== "friss")) await notifyNews().catch(() => 0);
    return J(r);
  }
  /* the weekly crawl of the site, the daily watch (mentions, competitors, Bing, Google's updates, certificates), the weekly AI round */
  if (only === "seo") return J({ seo: await syncSeo() });
  if (only === "kw") return J({ kw: await syncKwIdeas() });
  if (only === "watch") return J(await runWatch());
  if (only === "aivis") return J({ aivis: await syncAiVisibility() });
  /* the Google index of every page, once a day on its own (it takes most of a minute) */
  if (only === "index") { const r = await syncIndex(); await notifyNews().catch(() => 0); return J({ index: r }); }
  /* page speed, once a day on its own */
  if (only === "cwv") return J({ cwv: await syncCwv() });
  const s = settings();
  const [social, gsc, stores, competitors] = await Promise.all([syncSocial(undefined, undefined, { force }), s.gsc ? syncGsc() : Promise.resolve("nincs beállítva"), syncStores(), syncCompetitors()]);
  /* the active days of accounts for the retention page (sign-ins and token refreshes the auth tables still keep) */
  await call("admin_collect_days_t").catch(() => null);
  await notifyNews().catch(() => 0);
  return J({ ...social, gsc, ...stores, competitors });
}

/* from pg_cron in Supabase, with the database's own token: everything every morning (admin-sync), the social
   numbers every hour (admin-social, ?only=social), the index (?only=index) and page speed (?only=cwv) once a day,
   the rules every 5 minutes (?only=rules). An exception is an error answer (500), recorded as a failed run. */
export async function GET(req: Request) {
  return asCron(req, async () => {
    try { const q = new URL(req.url).searchParams; return await run(q.get("only"), q.get("force") === "1"); }
    catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e).slice(0, 400) }, { status: 500 }); }
  });
}

/* "Lehúzás most" on /admin, and the fresh social numbers each time a social page opens (?only=social): recorded too */
export async function POST(req: Request) {
  return asAdmin(async () => {
    const u = new URL(req.url);
    return track(u.pathname + u.search, "admin", async () => {
      try { return await run(u.searchParams.get("only"), u.searchParams.get("force") === "1"); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); }
    });
  });
}
