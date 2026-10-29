import { NextResponse } from "next/server";
import { SITE, asAdmin, asCron, call, env } from "@/lib/admin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* The daily check (05:00 UTC, pg_cron admin-health): is everything working? An e-mail goes out only when something is
   wrong, and on Mondays anyway ("minden rendben"), so a silent failure of the check itself gets noticed too.
   Besides the database's own checks (jobs, outages, the preview canary, errors, data sources), the app's path is
   tried from outside: the app page, its settings and the knowledge base must load. */
type H = { problems: { k: string; t: string }[]; stats: { sessions: number; scored: number; signups: number } };
const esc = (t: string) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function appPath(): Promise<string[]> {
  const out: string[] = [];
  const get = (u: string) => fetch(u, { signal: AbortSignal.timeout(15000), cache: "no-store", headers: { "user-agent": "InkAgeHealth/1.0 (+https://inkage.app)" } }).catch(() => null);
  const app = await get(`${SITE}/app`);
  if (!app?.ok) out.push(`Az app oldala nem töltődik be (${app ? "HTTP " + app.status : "nincs válasz"}).`);
  /* InkAge: the app reads its settings from /api/config before anything works, and the knowledge base brings the Google visitors */
  const cfg = await get(`${SITE}/api/config`);
  if (!cfg?.ok) out.push(`Az app beállításai (/api/config) nem töltődnek be (${cfg ? "HTTP " + cfg.status : "nincs válasz"}).`);
  const kb = await get(`${SITE}/tudastar`);
  if (!kb?.ok) out.push(`A Tudástár nem töltődik be (${kb ? "HTTP " + kb.status : "nincs válasz"}).`);
  return out;
}

async function check(force = false) {
  const h = await call<H>("admin_r_health");
  const problems = [...(h.problems || []).map((p) => p.t), ...(await appPath())];
  const monday = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Budapest", weekday: "short" }) === "Mon";
  if (!problems.length && !monday && !force) return { ok: true, email: "nem kellett (minden rendben)", problems: 0 };
  const key = env().RESEND_API_KEY;
  const to = await call<string[]>("admin_r_recipients").catch(() => [] as string[]);
  if (!key || !to.length) return { ok: true, email: key ? "hiba: nincs címzett" : "hiba: nincs RESEND_API_KEY", problems: problems.length };
  const s = h.stats || { sessions: 0, scored: 0, signups: 0 };
  const subject = problems.length ? `InkAge · ${problems.length} dolog nem működik` : "InkAge · minden rendben (hétfői ellenőrzés)";
  const html = `<!doctype html><html><body style="margin:0;background:#060607;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#F4F2EC">
<div style="max-width:560px;margin:0 auto;padding:28px 22px">
  <div style="color:#F3D58A;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700">InkAge · napi ellenőrzés</div>
  <h1 style="font-size:22px;margin:8px 0 14px">${problems.length ? "Ezt nézd meg" : "Minden rendben"}</h1>
  ${problems.length ? problems.map((p) => `<div style="margin:8px 0;padding:10px 12px;border-radius:12px;background:#2A1512;color:#FFD9D2;font-size:14px">● ${esc(p)}</div>`).join("") : `<p style="color:#A3A3A8;font-size:14px">Az időzített feladatok, az elérhetőség, az előnézetek, a hibák és az adatforrások mind rendben vannak.</p>`}
  <p style="color:#A3A3A8;font-size:13px;margin-top:16px">Az elmúlt 24 óra: ${s.sessions} látogatás · ${s.scored} kész előnézet · ${s.signups} regisztráció</p>
  <a href="${SITE}/admin#monitor" style="display:inline-block;margin-top:16px;background:#F3D58A;color:#141008;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">Monitoring megnyitása</a>
</div></body></html>`;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env().RESEND_FROM || "InkAge <hello@inkage.app>", to, subject, html, text: [subject, ...problems.map((p) => "• " + p), `${SITE}/admin#monitor`].join("\n") }) }).catch(() => null);
  return { ok: true, email: r?.ok ? "elküldve" : "hiba " + (r ? r.status : "időtúllépés"), problems: problems.length, ...(problems.length ? { hibak: problems.join(" · ").slice(0, 300) } : {}) };
}

export async function GET(req: Request) {
  return asCron(req, async () => { try { return NextResponse.json(await check()); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); } });
}
/* "Ellenőrzés most" (Rendszer): the same check, and the e-mail even when everything is fine */
export async function POST() {
  return asAdmin(async () => { try { return NextResponse.json(await check(true)); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); } });
}
