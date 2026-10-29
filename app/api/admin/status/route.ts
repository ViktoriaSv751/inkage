import { NextResponse } from "next/server";
import { asAdmin, call, env, settings } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

type Sys = { heartbeat: string | null; digest_missing: boolean };

/* which connections are set up (yes / no, never a value): the setup checklists on /admin. "cron" is no longer a
   fixed yes: the schedule counts as running when the 5-minute measuring is alive and today's digest went out.
   ?vercel=1: the last deployments' state too, when a Vercel API token was given on the Kapcsolatok page. */
export async function GET(req: Request) {
  return asAdmin(async () => {
    const s = settings();
    const sys = await call<Sys>("admin_r_push_system").catch(() => null);
    const cron = !!sys?.heartbeat && Date.now() - new Date(sys.heartbeat).getTime() < 20 * 60e3 && !sys.digest_missing;
    let vercel: unknown = undefined;
    if (new URL(req.url).searchParams.has("vercel") && s.vercel) {
      const e = env();
      /* the project this server runs in (Vercel sets VERCEL_PROJECT_ID itself); VERCEL_PROJECT on the Kapcsolatok page
         wins. No guessed name: without either, say so instead of listing another project's deployments. */
      const proj = e.VERCEL_PROJECT || process.env.VERCEL_PROJECT_ID;
      if (!proj) vercel = { error: "Nem tudom, melyik Vercel-projekt ez: add meg a VERCEL_PROJECT értékét a Kapcsolatok oldalon." };
      else {
        const q = new URLSearchParams({ limit: "6", projectId: proj, ...(e.VERCEL_TEAM_ID ? { teamId: e.VERCEL_TEAM_ID } : {}) });
        const r = await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: { authorization: `Bearer ${e.VERCEL_API_TOKEN}` }, cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
        const j = r?.ok ? ((await r.json().catch(() => ({}))) as { deployments?: { uid: string; state?: string; readyState?: string; created: number; target?: string | null; meta?: Record<string, string> }[] }) : null;
        vercel = j ? (j.deployments || []).map((d) => ({ id: d.uid, state: d.readyState || d.state, at: new Date(d.created).toISOString(), target: d.target || "preview", sha: d.meta?.githubCommitSha?.slice(0, 7) || null, msg: d.meta?.githubCommitMessage?.split("\n")[0].slice(0, 120) || null }))
          : { error: r ? `A Vercel ezt válaszolta: ${r.status}` : "A Vercel nem válaszolt." };
      }
    }
    return NextResponse.json({ ...s, cron, heartbeat: sys?.heartbeat ?? null, digest_missing: sys?.digest_missing ?? null, vercel }, { headers: { "cache-control": "no-store" } });
  });
}
