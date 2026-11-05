"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Fizetési hibák: where money is lost or at risk (admin_pay_problems). The urgent cases first (paid but not recorded,
   a dispute), then the left and the declined checkouts with their reasons, the devices that fail, the stores'
   notices, and the checklist of what payments need to run. InkAge has no invoicing (no stuck invoices card) and takes
   no payments yet: the checklist says honestly what is still missing. */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, fmt, pct } from "../charts";
import { Card, I, Lesson, Loading, P, Tbl, ago, api, dt, n, rpc, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { toast } from "../phone";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { BuyerDrawer, DISPUTE_L, GrantSheet, Mail, REASON_L, money, planOf } from "./pay-shared";

const KIND_L: Record<string, string> = { paid_missing: "Fizetett, de nincs meg a vásárlás", dispute: "Kártyavita", expired: "Félbehagyott fizetés", failed: "Sikertelen fizetés", dispute_closed: "Lezárt kártyavita", refund_apple: "App Store-visszatérítés", refund_google: "Google Play-visszatérítés", apple_notice: "App Store-értesítés", declined_refund: "Elutasított visszatérítés" };
const WEBHOOK_EVENTS = "checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, payment_intent.payment_failed, charge.refunded, charge.dispute.created, charge.dispute.closed";

export function PayFail({ days }: { days: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_pay_problems", { p_days: days || 30 }, [days]);
  const [st, setSt] = useState<D | null>(null);
  const [u, setU] = useState<string | null>(null); const [grant, setGrant] = useState<D | null>(null); const [tab, setTab] = useState<"expired" | "failed">("expired");
  const [syncing, setSyncing] = useState(false);
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)); }, []);
  const d = q.d;
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d) return <Loading />;
  const k = d.by_kind || {}, open: D[] = d.open || [];
  const lost = ((d.expired || []) as D[]).reduce((s, x) => s + n(x.amount), 0);
  const resolve = async (id: number) => { const note = prompt("Mi lett vele? (csak neked)") ?? null; const { error } = await rpc(sb, "admin_pay_resolve", { p_id: id, p_note: note }); if (error) toast(error.message); else { toast("Lezárva"); q.load(); } };
  const syncNow = async () => { setSyncing(true); const r = await api("/api/admin/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync" }) }); setSyncing(false); toast(r.ok ? String(r.json?.result || "Kész") : String(r.json?.error || "Nem sikerült")); q.load(); };
  const sw = d.signup_wall || {}, sp = d.speed || {};
  const checks: [boolean | null, string, string][] = [
    [st ? !!st.stripe : null, "Stripe titkos kulcs (STRIPE_SECRET_KEY)", st?.stripe_live === false && st?.stripe ? "teszt-kulcs van beállítva, élesben az sk_live_ kell" : "Vercel → Settings → Environment Variables"],
    [st ? !!st.stripe_webhook : null, "Stripe-értesítés (STRIPE_WEBHOOK_SECRET)", `az InkAge-ben még nincs Stripe-értesítést fogadó végpont (a fizetés bevezetésekor készül: https://inkage.app/api/stripe-webhook), ezekkel az eseményekkel: ${WEBHOOK_EVENTS}`],
    [st ? !!st.pay_service : null, "Adatbázis-írás a fizetéshez (SUPABASE_SERVICE_ROLE_KEY)", "e nélkül a vásárlás nem kerül a fiókba"],
    [d.last_notice?.apple ? true : null, "App Store-értesítések", "az InkAge-ben még nincs ilyen végpont (a fizetés bevezetésekor készül); utána: App Store Connect → InkAge → App Information → App Store Server Notifications (Version 2)"],
    [st ? !!st.google_play : null, "Google Play-visszatérítések", "a Play szolgáltatásfiók (PLAY_SERVICE_ACCOUNT_JSON) óránként lekéri a visszavont vásárlásokat; „View financial data” jog kell hozzá"],
    [d.last_notice?.stripe_sync ? true : null, "Stripe-díjak és kifizetések letöltése", d.last_notice?.stripe_sync ? `utolsó mozgás: ${ago(d.last_notice.stripe_sync)}` : "5 percenként, amint a kulcs megvan"],
  ];
  return (
    <div className="g ix pay">
      <Top><Hero flip label="Sürgős fizetési ügy" v={open.length} sub={open.length ? "Fizetett, de nem kapta meg, vagy kártyavita: ezekkel ma foglalkozz." : "Nincs most semmi sürgős."} /></Top>
      <Trio items={[
        { l: "Félbehagyott fizetés", v: n(k.expired), run: () => setTab("expired") },
        { l: "Sikertelen fizetés", v: n(k.failed), run: () => setTab("failed") },
        { l: "Később mégis fizetett", v: n(d.recovered) },
      ]} />
      {open.length > 0 && <Card className="s12" icon={P.alert} title="Most kell foglalkozni velük" sub="„Fizetett, de nincs meg a vásárlás”: a Stripe szerint fizetett, de nálunk nem jött létre a vásárlás (például nem érkezett meg a Stripe értesítése). Add meg kézzel, és magától lezárul. Kártyavita: a bank visszakérte a pénzt; a Stripe-ban pár napon belül bizonyítékot kell küldeni (a vásárlás ideje, a lemondás az elállásról a fizetésnél megvan).">
        <Tbl name="surgos" rows={open} csv={false} cols={[
          { k: "kind", l: "Mi", ph: "name", r: (r) => <b className="bad">{KIND_L[r.kind] || r.kind}</b> },
          { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => money(n(r.amount), r.currency || "USD") },
          { k: "reason", l: "Miért", ph: "sub", r: (r) => r.kind === "dispute" ? `${DISPUTE_L[r.reason] || r.reason || ""}${r.detail?.due_by ? ` · határidő: ${dt(r.detail.due_by)}` : ""}` : (r.reason || "") },
          { k: "email", l: "Ki", r: (r) => <Mail e={r.email} /> },
          { k: "at", l: "Mikor", r: (r) => ago(r.at) },
          { k: "x", l: "", r: (r) => <span className="pay-row">{r.kind === "paid_missing" && r.user_id && <button className="lnk" onClick={(e) => { e.stopPropagation(); setGrant(r); }}>Vásárlás kézzel</button>}
            {r.kind === "dispute" && <a className="lnk" href={`https://dashboard.stripe.com/disputes/${r.ref}`} target="_blank" rel="noreferrer">Stripe ↗</a>}<button className="lnk" onClick={(e) => { e.stopPropagation(); resolve(r.id); }}>Lezárom</button></span> },
        ]} />
      </Card>}

      <Card className="s12" icon={P.funnel} title={tab === "expired" ? "Félbehagyott fizetések" : "Sikertelen fizetések"} sub={tab === "expired" ? `Akik megnyitották a fizetést, de nem fejezték be (a Stripe 24 óra után lezárja). Összesen ${money(lost)} maradt itt. Ők a „majdnem vevők”: ha hozzájárultak, hogy írj nekik, egy rövid emlékeztető sokat hozhat; e nélkül ne írj nekik reklámot. A letöltés (CSV) a saját nyilvántartásodnak.` : "Ahol a kártyát elutasították. Ha egy ok sokszor jön elő (például 3D Secure), az a fizetési oldal hibája is lehet."}
        right={<div className="adm-seg sm"><button aria-pressed={tab === "expired"} onClick={() => setTab("expired")}>Félbehagyott</button><button aria-pressed={tab === "failed"} onClick={() => setTab("failed")}>Sikertelen</button></div>}>
        {tab === "failed" && (d.reasons || []).length > 0 && <BarList items={(d.reasons as D[]).map((x) => ({ k: REASON_L[x.reason] || x.reason, n: n(x.n) }))} fmtK={(x) => x} max={6} />}
        <Tbl name={tab === "expired" ? "felbehagyott" : "sikertelen"} rows={(tab === "expired" ? d.expired : d.failed) || []} onRow={(r) => r.user_id && setU(String(r.user_id))} empty="Ebben az időszakban nem volt ilyen." cols={[
          { k: "at", l: "Mikor", ph: "sub", r: (r) => dt(r.at) },
          { k: "plan", l: "Termék", ph: "name", r: (r) => planOf(r) },
          { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => money(n(r.amount), r.currency || "USD") },
          ...(tab === "failed" ? [{ k: "reason", l: "Ok", r: (r: D) => REASON_L[r.reason] || r.reason || "–" }] : []),
          { k: "email", l: "Ki", r: (r) => <Mail e={r.email} /> },
          { k: "device", l: "Eszköz", ph: "hide" as const },
          { k: "country", l: "Ország", ph: "hide" as const },
        ]} />
      </Card>

      <Card className="s6" icon={P.layers} title="Eszközönként" sub="Hányan nyomták meg a fizetés gombot, és hányan fizettek, platformonként. Ha az egyik sokkal rosszabb, ott hiba lehet (például az Instagram vagy a TikTok appon belüli böngészője).">
        {(d.by_device || []).length ? <Tbl name="eszkozok" rows={d.by_device} csv={false} cols={[{ k: "dev", l: "Eszköz", ph: "name" }, { k: "start", l: "Fizetés gomb", num: true }, { k: "done", l: "Fizetett", num: true, ph: "main", r: (r) => `${fmt(r.done)} (${pct(n(r.done), n(r.start))})` }]} /> : <Empty t="Még nincs adat (az InkAge még nem fogad fizetést)." />}
        {(d.by_browser || []).length > 0 && <BarList items={(d.by_browser as D[]).map((x) => ({ k: x.device, n: n(x.n) }))} fmtK={(x) => x} max={6} />}
      </Card>
      <Card className="s6" icon={P.clock} title="Gyorsaság és a regisztrációs fal" sub="Mennyi idő telik el a fizetés gombtól a sikeres fizetésig, és akiket a vásárlási oldal regisztrálni küldött, visszajöttek-e fizetni.">
        <div className="pay-conv">
          <div><b>{sp.median_s == null ? "–" : n(sp.median_s) < 120 ? `${fmt(sp.median_s)} mp` : `${fmt(Math.round(n(sp.median_s) / 60))} perc`}</b><small>a fizetés gombtól a fizetésig (medián)</small></div>
          <div><b>{sp.p90_s == null ? "–" : `${fmt(Math.round(n(sp.p90_s) / 60))} perc`}</b><small>a leglassabb 10%</small></div>
          <div><b>{fmt(sw.sent)}</b><small>regisztrálni ment</small></div>
          <div><b>{n(sw.sent) ? pct(n(sw.bought), n(sw.sent)) : "–"}</b><small>közülük fizetett ({fmt(sw.signed)} regisztrált)</small></div>
        </div>
      </Card>

      <Card className="s12" icon={P.layers} title="Áruházak értesítései" sub="Amit az App Store és a Google Play küldött: visszatérítések, elutasított visszatérítési kérések, egyéb értesítések. Az ellenőrizetlen (nem az Apple aláírásával érkezett) értesítés semmit nem változtat.">
        {(d.store_notes || []).length ? <Tbl name="aruhazi-ertesitesek" rows={d.store_notes} csv={false} cols={[{ k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "kind", l: "Mi", ph: "name", r: (r) => KIND_L[r.kind] || r.kind }, { k: "reason", l: "Részlet", ph: "sub" }, { k: "amount", l: "Összeg", num: true, r: (r) => (r.amount ? money(n(r.amount), r.currency) : "–") }]} /> : <Empty t="Még nem jött áruházi értesítés." />}
      </Card>
      {(d.disputes || []).length > 0 && <Card className="s12" icon={P.alert} title="Minden kártyavita" sub="A nyitottak és a lezártak, az okkal és az állapottal.">
        <Tbl name="kartyavitak" rows={d.disputes} cols={[{ k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "kind", l: "Mi", ph: "name", r: (r) => KIND_L[r.kind] }, { k: "reason", l: "Ok / eredmény", r: (r) => DISPUTE_L[r.reason] || ({ won: "Megnyerted", lost: "Elvesztetted" } as D)[r.reason] || r.reason }, { k: "amount", l: "Összeg", num: true, r: (r) => money(n(r.amount), r.currency || "USD") }]} />
      </Card>}

      <Card className="s12" icon={P.check} title="Mi kell, hogy a fizetés működjön" sub="A beállítások állapota (csak igen vagy nem, értéket sosem mutat). A pipásak mennek, a többit még be kell állítani. Az InkAge még nem fogad fizetést, ezért most a legtöbb hiányzik: ez így rendben van."
        right={<button className="adm-ibtn" disabled={syncing} onClick={syncNow}>{I(P.refresh)}{syncing ? "…" : "Lehúzás most"}</button>}>
        <ul className="pay-checks">{checks.map(([ok, t, h]) => <li key={t} className={ok ? "ok" : ok === false ? "no" : "wait"}><i>{ok ? "✓" : ok === false ? "✕" : "·"}</i><b>{t}</b><small>{h}</small></li>)}</ul>
        <Lesson>A fizetés bekapcsolása (payments_live) szándékosan nem gomb: egy lépés az adatbázisban, amikor a fenti kulcsok már megvannak. Ez az oldal csak mutatja, mi hiányzik még hozzá.</Lesson>
      </Card>
      {u && <BuyerDrawer id={u} close={() => setU(null)} />}
      {grant && <GrantSheet user={grant.user_id} email={grant.email} plans={grant.plan ? [String(grant.plan)] : undefined} close={() => setGrant(null)} done={q.load} />}
    </div>
  );
}
