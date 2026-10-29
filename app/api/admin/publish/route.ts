import { NextResponse } from "next/server";
import { asAdmin, asCron, call } from "@/lib/admin/server";
import { publishTo, type Plan } from "@/lib/admin/social";
import { notifyOne } from "@/lib/admin/push";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* Publishing from the planner: every 10 minutes pg_cron asks for the plans whose time has come (publish switched on),
   and each platform gets the post from here. A platform already done is not posted twice; an Instagram video still
   processing is finished on the next run. "Közzététel most" in the planner runs one plan at once.
   A plan is claimed first (admin_w_plan_claim), so the button and the 10-minute run never post the same plan together.
   Each platform gets its own short link (codes) and its own text (texts), when the plan has them. */
type Full = Plan & { codes?: Record<string, string>; texts?: Record<string, string>; opts?: { yt_title?: string } };

/* the plan as one platform sees it: its own link, its own text, YouTube's own title */
const forPf = (p: Full, pf: string): Plan => ({ ...p, code: p.codes?.[pf] || p.code, caption: (p.texts?.[pf] || "").trim() || p.caption,
  title: pf === "youtube" && p.opts?.yt_title?.trim() ? p.opts.yt_title.trim() : p.title });

async function one(p: Full): Promise<{ busy?: boolean; results: Plan["results"]; status?: string }> {
  /* someone else is publishing this plan right now: no second post */
  const mine = await call<boolean>("admin_w_plan_claim", { p_id: p.id }).catch(() => true);
  if (!mine) return { busy: true, results: p.results || {} };
  const res: Plan["results"] = {};
  try {
    for (const pf of p.platforms) {
      if (p.results?.[pf]?.ok) continue;
      try { res[pf] = await publishTo(pf, forPf(p, pf)); } catch (e) { res[pf] = { error: String((e as Error)?.message || e).slice(0, 200) }; }
    }
  } finally {
    const all0 = { ...(p.results || {}), ...res };
    const done0 = p.platforms.every((pf) => all0[pf]?.ok || (all0[pf]?.error && !all0[pf]?.pending));
    /* the result is written (and the claim released) even if a platform threw something unexpected */
    await call("admin_w_plan_result", { p_id: p.id, p_results: res, p_done: done0 }).catch(() => null);
  }
  const all = { ...(p.results || {}), ...res };
  const done = p.platforms.every((pf) => all[pf]?.ok || (all[pf]?.error && !all[pf]?.pending));
  const okN = p.platforms.filter((pf) => all[pf]?.ok).length;
  if (done) await notifyOne("publish", String(p.id), okN ? `Kint van: ${p.title.slice(0, 60)}` : `Nem ment ki: ${p.title.slice(0, 60)}`,
    p.platforms.map((pf) => `${pf}: ${all[pf]?.ok ? "✓" : all[pf]?.error || "–"}`).join(" · ").slice(0, 280), "/admin#planner").catch(() => null);
  return { results: all, status: !done ? "folyamatban" : okN ? "kint" : "hiba" };
}

export async function GET(req: Request) {
  return asCron(req, async () => {
    const due = await call<Full[]>("admin_r_due_plans");
    const out: Record<string, unknown> = {};
    for (const p of due) out[p.id] = await one(p);
    return NextResponse.json({ ok: true, n: due.length, out });
  });
}

export async function POST(req: Request) {
  return asAdmin(async () => {
    const b = (await req.json().catch(() => ({}))) as { plan?: Full };
    if (!b.plan?.id) return NextResponse.json({ ok: false, error: "Előbb mentsd el a tervet." }, { status: 400 });
    /* the plan as saved in the database, not what the browser sent */
    const plan = await call<Full | null>("admin_r_plan", { p_id: String(b.plan.id) });
    if (!plan) return NextResponse.json({ ok: false, error: "Ez a terv nincs elmentve. Mentsd el, és próbáld újra." }, { status: 404 });
    const r = await one(plan);
    if (r.busy) return NextResponse.json({ ok: false, busy: true, error: "Ez a terv épp most megy ki (az időzítő küldi). Pár perc múlva nézd meg az eredményt." }, { status: 409 });
    return NextResponse.json({ ok: true, results: r.results, status: r.status });
  });
}
