"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Pénzügy: the real money (admin_pay_finance). Each month's result after fees, refunds and costs; what Stripe holds
   and when it pays out; what the stores owe; the yearly limit; the month's close for the accountant; the settings.
   InkAge takes no payments yet and has no invoicing (no Billingo): the figures stay at zero until the first sale. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Info, fmt, pct } from "../charts";
import { Card, I, Lesson, Loading, MOCK, P, Tbl, ago, dt, n, rpc, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { Sheet, toast } from "../phone";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { CurPick, M, money, planOf, useCur } from "./pay-shared";

const ym = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("hu-HU", { year: "numeric", month: "long" });
const csv = (rows: D[], cols: [string, string][]) => "﻿" + [cols.map((c) => c[1]).join(";"), ...rows.map((r) => cols.map(([k]) => { const v = r[k]; const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";"))].join("\n");
const download = (name: string, body: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

export function Finance() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_pay_finance", { p_months: 12 }, []);
  const { cur, setCur } = useCur();
  const [cost, setCost] = useState<D | null>(null); const [cfgOpen, setCfgOpen] = useState(false);
  const d = q.d;
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d) return <Loading />;
  const huf = n(d.huf) || 360, $ = (usd: number) => M(usd, cur, huf);
  const months: D[] = (d.months || []).map((m: D) => ({ ...m, net: n(m.gross) - n(m.refunds) - n(m.fees) - n(m.costs) - n(m.ai_usd) }));
  const m0 = months[0] || {}, m1 = months[1] || {};
  const y = d.year || {}, lim = n(y.limit) || 20000000;
  const pend: Record<string, number> = d.stripe_pending || {};
  const exportMonth = async (mo: string) => {
    const r = MOCK ? { data: [] } : await rpc(sb, "admin_pay_month", { p_month: mo });
    if ((r as D).error) { toast("Nem sikerült."); return; }
    const rows = ((r as D).data || []).map((x: D) => ({ ...x, plan: planOf(x) })) as D[];
    download(`inkage-zaras-${mo.slice(0, 7)}.csv`, csv(rows, [["created_at", "Időpont"], ["store", "Hely"], ["tx", "Azonosító"], ["plan", "Termék"], ["amount", "Összeg"], ["currency", "Pénznem"], ["usd", "USD"], ["huf", "HUF"], ["huf_rate", "Árfolyam (Ft/$)"],
      ["stripe_fee", "Stripe-díj"], ["refunded_at", "Visszatérítve"], ["refund_usd", "Visszatérítés USD"], ["country", "Ország"], ["coupon", "Kód"], ["discount", "Kedvezmény"], ["email", "Vevő e-mail"], ["note", "Megjegyzés"]]));
    toast(`${rows.length} fizetés letöltve`);
  };
  return (
    <div className="g ix pay">
      <Top><Hero flip label={<>Ami ebben a hónapban neked marad<Info>Bevétel mínusz visszatérítés, díjak (Stripe pontosan, ahol a szinkron már letöltötte; Apple és Google a kulcsuk szerint), a költségeid és a képgenerálás becsült ára ({money(n(d.cfg?.ai_cost), "USD")} / elkészült előnézet). Adó nélkül.</Info></>}
        text={$(n(m0.net))} sub={<>bevétel {$(n(m0.gross))} · díj {$(n(m0.fees))} · költség {$(n(m0.costs) + n(m0.ai_usd))} · előző hónap {$(n(m1.net))}</>} side={<CurPick cur={cur} set={setCur} />} /></Top>
      <Trio items={[
        { l: "A Stripe-nál vár kifizetésre", v: Object.keys(pend).length ? Object.entries(pend).map(([c, v]) => money(v, c)).join(" + ") : "–" },
        { l: "Az App Store és a Google Play tartozik (becslés)", v: $(n(d.store_due?.apple) + n(d.store_due?.google)) },
        { l: "Következő Stripe-kifizetés", v: d.stripe_next ? new Date(d.stripe_next).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–" },
      ]} />
      {!d.synced?.n && <Lesson><b>A Stripe-adatok még nem jöttek le.</b> Az InkAge még nem fogad fizetést, ezért itt minden nulla. Amint a STRIPE_SECRET_KEY be van állítva a Vercelben, a rendszer 5 percenként letölti a pontos díjakat és a kifizetéseket; addig a díj becslés (2,9% + 0,30 $).</Lesson>}

      <Card className="s12" icon={P.calendar} title="Hónapról hónapra" sub="Bruttó bevétel, visszatérítés, díj, költség és ami marad, havonta. A „pontos díj” azt mutatja, hány Stripe-fizetés díja jött már meg a Stripe-tól (a többi becslés). A záráshoz a letöltés minden fizetést megad a könyvelőnek: díjjal és az aznapi árfolyammal.">
        <Tbl name="havi-eredmeny" rows={months} cols={[
          { k: "mo", l: "Hónap", ph: "name", r: (r) => <b>{ym(r.mo)}</b> },
          { k: "gross", l: "Bevétel", num: true, ph: "main", r: (r) => $(n(r.gross)) },
          { k: "sales", l: "Fizetés", num: true },
          { k: "refunds", l: "Visszatérítés", num: true, r: (r) => n(r.refunds) ? <span className="bad">−{$(n(r.refunds))}</span> : "–" },
          { k: "fees", l: "Díj", num: true, r: (r) => <span title={`${fmt(r.exact)} pontos Stripe-díj`}>−{$(n(r.fees))}</span> },
          { k: "costs", l: "Költség", num: true, r: (r) => n(r.costs) ? `−${$(n(r.costs))}` : "–" },
          { k: "ai_usd", l: "Képgenerálás", num: true, ph: "hide", r: (r) => n(r.ai_n) ? <span title={`${fmt(r.ai_n)} elkészült előnézet`}>−{$(n(r.ai_usd))}</span> : "–" },
          { k: "net", l: "Marad", num: true, r: (r) => <b className={n(r.net) < 0 ? "bad" : ""}>{$(n(r.net))}</b> },
          { k: "stripe", l: "Web", num: true, ph: "hide", r: (r) => $(n(r.stripe)) }, { k: "apple", l: "App Store", num: true, ph: "hide", r: (r) => $(n(r.apple)) }, { k: "google", l: "Google Play", num: true, ph: "hide", r: (r) => $(n(r.google)) },
          { k: "x", l: "Zárás", r: (r) => <button className="lnk" onClick={(e) => { e.stopPropagation(); exportMonth(r.mo); }}>CSV ⤓</button> },
        ]} />
      </Card>

      <Card className="s6" icon={P.target} title="Az éves határ" sub="Az idei bevétel forintban az egyéni vállalkozás értékhatárához mérve (alapból az alanyi ÁFA-mentesség 20 millió Ft-os határa; a pontos számot a könyvelőddel állítsd be lent, a Beállításokban). A „várható” a mostani tempóból számol.">
        <div className="pay-bar big"><i style={{ width: Math.min(100, (n(y.huf) / lim) * 100) + "%" }} /><u style={{ left: Math.min(100, (n(y.pace_huf) / lim) * 100) + "%" }} title="Év végére várható" /></div>
        <div className="pay-conv"><div><b>{money(n(y.huf), "HUF")}</b><small>idén eddig ({pct(n(y.huf), lim)})</small></div><div><b>{money(n(y.pace_huf), "HUF")}</b><small>év végére várható · határ {money(lim, "HUF")}</small></div></div>
        {n(y.pace_huf) > lim * 0.8 && <p className="note bad">A mostani tempóval az év végéig eléred a határ 80%-át. Beszélj a könyvelőddel, mielőtt átléped.</p>}
        <p className="note mut">Külföldi magánszemélynek eladott digitális szolgáltatásnál az EU-ban más ÁFA-szabályok (OSS) is vonatkozhatnak; ezt is a könyvelőd tudja megmondani.</p>
      </Card>
      <Card className="s6" icon={P.refresh} title="Árfolyam: eladáskor és utaláskor" sub="A dolláros bevétel forintban az eladás napján és a Stripe-kifizetés napján (EKB-árfolyam). A különbség az, amit az árfolyam hozott vagy vitt.">
        {n(d.fx_diff?.usd) ? <div className="pay-conv"><div><b>{money(n(d.fx_diff.huf_at_sale), "HUF")}</b><small>eladáskor ért</small></div><div><b>{money(n(d.fx_diff.huf_at_payout), "HUF")}</b><small>utaláskor ért</small></div>
          <div><b className={n(d.fx_diff.huf_at_payout) < n(d.fx_diff.huf_at_sale) ? "bad" : ""}>{money(n(d.fx_diff.huf_at_payout) - n(d.fx_diff.huf_at_sale), "HUF")}</b><small>különbség</small></div></div> : <Empty t="Még nem volt kifizetés." />}
      </Card>

      <Card className="s7" icon={P.calendar} title="Kifizetések" sub="A Stripe utalásai a dolláros számládra: mikor érkezik, mennyi. Az App Store a hónap vége után kb. 33 nappal, a Google Play havonta, a hónap 15-e körül utal (ezek nem látszanak itt, csak a becsült tartozásuk fent).">
        {(d.payouts || []).length ? <Tbl name="kifizetesek" rows={d.payouts} cols={[
          { k: "arrival_date", l: "Érkezik", ph: "name", r: (r) => dt(r.arrival_date) }, { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => <b>{money(n(r.amount), r.currency)}</b> },
          { k: "status", l: "Állapot", r: (r) => ({ paid: "Megérkezett", pending: "Úton", in_transit: "Úton", canceled: "Törölve", failed: "Sikertelen" } as D)[r.status] || r.status },
        ]} /> : <Empty t="Még nem volt kifizetés." />}
      </Card>
      <Card className="s5" icon={P.doc} title="Költségek" sub="Amit havonta fizetsz (Vercel, Supabase, Apple fejlesztői díj, képgenerálás, könyvelő). A havi eredményből vonódik le. Az ismétlődő költség minden hónapban számít a kezdőhónaptól."
        right={<button className="adm-ibtn" onClick={() => setCost({ month: new Date().toISOString().slice(0, 10), label: "", amount: "", currency: "USD", recurring: true })}>{I(P.check)}Új költség</button>}>
        {(d.costs || []).length ? <Tbl name="koltsegek" rows={d.costs} csv={false} onRow={(r) => setCost(r)} cols={[
          { k: "label", l: "Mi", ph: "name" }, { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => money(n(r.amount), r.currency) },
          { k: "month", l: "Hónap", r: (r) => ym(r.month) + (r.recurring ? " óta, havonta" : "") },
        ]} /> : <Empty t="Még nincs költség. Add meg, hogy lásd, mennyi marad valójában." />}
      </Card>

      {/* InkAge has no invoicing: the reconciliation is only "every Stripe payment is recorded here" */}
      <Card className="s12" icon={P.check} title="Egyeztetés" sub="Minden Stripe-fizetéshez létrejött-e nálunk a vásárlás. Ha valami nincs párban, itt látszik.">
        <div className="pay-conv">
          <div><b className={(d.recon?.no_package || []).length ? "bad" : ""}>{fmt((d.recon?.no_package || []).length)}</b><small>fizetés, amihez nincs vásárlás (lásd Fizetési hibák)</small></div>
          <div><b>{d.synced?.tx ? ago(d.synced.tx) : "–"}</b><small>utolsó Stripe-mozgás letöltve</small></div>
        </div>
      </Card>

      <Card className="s12" icon={P.system} title="Beállítások" sub="A napi és havi cél, a díjak kulcsa, a képgenerálás ára, a határ, a partnerek alap jutaléka és a telefonos értesítés. Ezekkel számolnak a Bevétel oldalak."
        right={<button className="adm-ibtn" onClick={() => setCfgOpen(true)}>{I(P.pen)}Szerkesztés</button>}>
        <div className="grw-row">{[["Napi cél", n(d.cfg?.goal_day) ? `${d.cfg?.goal_day} fizető` : "nincs megadva"], ["Havi cél", n(d.cfg?.goal_month) ? `${d.cfg?.goal_month} fizetés` : "nincs megadva"], ["Apple", d.cfg?.apple_sbp === false ? "30%" : "15% (Small Business)"], ["Google", `${Math.round(n(d.cfg?.google_rate) * 100)}%`],
          ["Képgenerálás", money(n(d.cfg?.ai_cost))], ["Éves határ", money(n(d.cfg?.vat_limit_huf), "HUF")], ["Partner jutalék", `${Math.round(n(d.cfg?.commission) * 100)}%`], ["Telegram minden fizetésnél", d.cfg?.telegram_sales ? "be" : "ki"]].map(([k, v]) => <span key={k} className="chip">{k}: <b>{v}</b></span>)}</div>
      </Card>
      {cost && <CostSheet c={cost} close={() => setCost(null)} done={q.load} />}
      {cfgOpen && <CfgSheet cfg={d.cfg || {}} close={() => setCfgOpen(false)} done={q.load} />}
    </div>
  );
}

function CostSheet({ c, close, done }: { c: D; close: () => void; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [v, setV] = useState<D>({ ...c, month: String(c.month || "").slice(0, 7) });
  const save = async () => {
    const { error } = await rpc(sb, "admin_pay_cost_save", { p_month: v.month + "-01", p_label: v.label, p_amount: Number(String(v.amount).replace(",", ".")), p_currency: v.currency, p_recurring: !!v.recurring, p_id: c.id || null });
    if (error) { toast(error.message); return; } toast("Mentve"); done(); close();
  };
  const del = async () => { const { error } = await rpc(sb, "admin_pay_cost_delete", { p_id: c.id }); if (error) { toast(error.message); return; } toast("Törölve"); done(); close(); };
  return (
    <Sheet title={c.id ? "Költség" : "Új költség"} close={close} foot={<div className="pay-row">{c.id && <button className="adm-ibtn" onClick={del}>Törlés</button>}<button className="adm-ibtn gold" disabled={!v.label || !v.amount} onClick={save}>Mentés</button></div>}>
      <label className="pfield"><span>Mi</span><input className="adm-in" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="Vercel, Supabase, Apple fejlesztői díj, MI-modell…" /></label>
      <label className="pfield"><span>Összeg</span><input className="adm-in" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
      <label className="pfield"><span>Pénznem</span><select className="adm-in" value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>{["USD", "HUF", "EUR"].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="pfield"><span>Hónap</span><input className="adm-in" type="month" value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} /></label>
      <label className="pay-ck"><input type="checkbox" checked={!!v.recurring} onChange={(e) => setV({ ...v, recurring: e.target.checked })} /> Minden hónapban (ettől a hónaptól)</label>
    </Sheet>
  );
}

function CfgSheet({ cfg, close, done }: { cfg: D; close: () => void; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [v, setV] = useState<D>({ goal_day: cfg.goal_day, goal_month: cfg.goal_month, apple_sbp: cfg.apple_sbp !== false, google_rate: Math.round(n(cfg.google_rate) * 100), ai_cost: cfg.ai_cost, vat_limit_huf: cfg.vat_limit_huf, commission: Math.round(n(cfg.commission) * 100), telegram_sales: !!cfg.telegram_sales });
  const num = (x: unknown) => Number(String(x).replace(",", ".").replace(/\s/g, "")) || 0;
  const save = async () => {
    const { error } = await rpc(sb, "admin_pay_cfg_save", { p_v: { goal_day: num(v.goal_day), goal_month: num(v.goal_month), apple_sbp: !!v.apple_sbp, google_rate: num(v.google_rate) / 100, ai_cost: num(v.ai_cost), vat_limit_huf: num(v.vat_limit_huf), commission: num(v.commission) / 100, telegram_sales: !!v.telegram_sales } });
    if (error) { toast(error.message); return; } toast("Mentve"); done(); close();
  };
  const F = ({ k, l, unit }: { k: string; l: string; unit?: string }) => <label className="pfield"><span>{l}{unit ? ` (${unit})` : ""}</span><input className="adm-in" inputMode="decimal" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>;
  return (
    <Sheet title="Bevétel beállításai" close={close} foot={<button className="adm-ibtn gold" onClick={save}>Mentés</button>}>
      {F({ k: "goal_day", l: "Napi cél", unit: "fizető ember" })}{F({ k: "goal_month", l: "Havi cél", unit: "fizetés" })}
      <label className="pay-ck"><input type="checkbox" checked={!!v.apple_sbp} onChange={(e) => setV({ ...v, apple_sbp: e.target.checked })} /> Benne vagyok az Apple Small Business Programban (15% a 30% helyett)</label>
      {F({ k: "google_rate", l: "Google Play díja", unit: "%" })}{F({ k: "ai_cost", l: "Egy előnézet képgenerálása", unit: "$" })}
      {F({ k: "vat_limit_huf", l: "Éves határ", unit: "Ft" })}{F({ k: "commission", l: "Partnerek alap jutaléka", unit: "% a kódjukkal jött bevételből" })}
      <label className="pay-ck"><input type="checkbox" checked={!!v.telegram_sales} onChange={(e) => setV({ ...v, telegram_sales: e.target.checked })} /> Minden fizetésről Telegram-üzenet is (ha be van kötve)</label>
    </Sheet>
  );
}
