"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Fizetések: every payment from the three places people can pay (Stripe on the web, the App Store, Google Play), one
   database answer (admin_payments). InkAge takes no payments yet: until the first purchase arrives the page says so
   plainly, and it fills in by itself from the first one. Product names come from the data, none are written in here. */
import { useMemo, useState } from "react";
import { BarList, Empty, Funnel, Info, StackedColumns, fmt, pct } from "../charts";
import { Card, Loading, P, Tbl, ago, dt, n, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { usePhone } from "../phone";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { UserDrawer } from "./users";

export const STORE_L: Record<string, string> = { stripe: "Weboldal (Stripe)", apple: "App Store", google: "Google Play" };
/* black and white only: three greys tell the places apart */
const STORE_C: Record<string, string> = { stripe: "var(--ser-1)", apple: "var(--ser-3)", google: "var(--ser-5)" };
/* the product as the data names it (plan_name, or the plan key itself): InkAge has no fixed packages */
const planName = (r: D) => String(r.plan_name || r.plan || "–");
/* what each place keeps from a sale, an estimate: the stores' small-business rate, Stripe's standard card fee */
const FEE: Record<string, { p: number; f: number; l: string }> = {
  stripe: { p: 0.029, f: 0.3, l: "kb. 2,9% + 0,30 $ (EU-s kártyánál kevesebb)" },
  apple: { p: 0.15, f: 0, l: "15% (Small Business Program; nélküle 30%)" },
  google: { p: 0.15, f: 0, l: "15% (az első 1 millió $ évente)" },
};

/* money in its own currency: "$27.99", "3 490 HUF" */
export const money = (v: number, cur: string) => {
  const c = (cur || "?").toUpperCase();
  try { return new Intl.NumberFormat("hu-HU", { style: "currency", currency: c === "?" ? "USD" : c, maximumFractionDigits: c === "HUF" ? 0 : 2 }).format(v); }
  catch { return `${fmt(Math.round(v * 100) / 100)} ${c}`; }
};
const moneyList = (m: Record<string, number> | D[] | undefined, key = "gross") => {
  const rows = Array.isArray(m) ? m.map((x) => [x.currency, n(x[key])] as [string, number]) : Object.entries(m || {}).map(([c, v]) => [c, n(v)] as [string, number]);
  return rows.length ? rows.map(([c, v]) => money(v, c)).join(" + ") : money(0, "USD");
};

export function Payments({ days }: { days: number }) {
  const q = useRpc("admin_payments", { p_days: days || 3650 }, [days]);
  const phone = usePhone();
  const [u, setU] = useState<string | null>(null);
  const [st, setSt] = useState<"all" | "stripe" | "apple" | "google" | "refund">("all");
  /* an empty answer (no payment table yet) counts as "nothing yet", not as an endless load */
  const d: D | null = q.d ?? (q.at && !q.e ? {} : null);
  const view = useMemo(() => {
    if (!d) return null;
    const rev: D[] = d.rev || [];
    /* the main figure is in dollars (the web price list); store sales in other currencies stand beside it */
    const usd = rev.find((x) => x.currency === "USD") || { gross: 0, net: 0, refunded: 0, sales: 0, avg: 0 };
    const other = rev.filter((x) => x.currency !== "USD");
    const prevUsd = n(d.rev_prev?.USD);
    const byStore: D[] = d.by_store || [];
    const stores = ["stripe", "apple", "google"].map((k) => {
      const rows = byStore.filter((x) => x.store === k);
      const sales = rows.reduce((s, x) => s + n(x.sales), 0);
      /* the fee in dollars, only on the dollar sales (a forint sale's fee would not add up with them) */
      const fee = rows.filter((x) => x.currency === "USD").reduce((s, x) => s + n(x.gross) * FEE[k].p + n(x.sales) * FEE[k].f, 0);
      return { k, rows, sales, payers: rows.reduce((s, x) => s + n(x.payers), 0), refunds: rows.reduce((s, x) => s + n(x.refunds), 0), last: rows.map((x) => x.last).sort().pop(), prev: n(d.store_prev?.[k]), feeUsd: rows.filter((x) => x.currency === "USD").length ? fee : 0 };
    });
    const totalSales = n(d.totals?.sales);
    /* the days, by store (count of sales: money in mixed currencies can't stack) */
    const dayMap = new Map<string, Record<string, number>>();
    ((d.by_day || []) as D[]).forEach((x) => { const v = dayMap.get(x.day) || {}; v[x.store] = (v[x.store] || 0) + n(x.sales); dayMap.set(x.day, v); });
    const span = Math.min(days || 90, 90), cols: { t: string; v: Record<string, number> }[] = [];
    for (let i = span - 1; i >= 0; i--) { const t = new Date(Date.now() - i * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }); cols.push({ t, v: dayMap.get(t) || {} }); }
    const plans = new Map<string, { n: number; m: Record<string, number> }>();
    ((d.by_plan || []) as D[]).forEach((x) => { const k = planName(x), p = plans.get(k) || { n: 0, m: {} }; p.n += n(x.sales); p.m[x.currency] = (p.m[x.currency] || 0) + n(x.gross); plans.set(k, p); });
    return { usd, other, prevUsd, stores, totalSales, cols, plans };
  }, [d, days]);
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d || !view) return <Loading />;
  const t = d.totals || {}, s = d.steps || {}, conv = d.conv || {}, tp = d.to_pay || {};
  const recent: D[] = (d.recent || []).filter((r: D) => st === "all" || (st === "refund" ? !!r.refunded_at : r.store === st));
  const per = days >= 3650 || !days ? "összesen" : days === 1 ? "az elmúlt 24 órában" : `az elmúlt ${days} napban`;
  const nothing = !n(d.all_time?.sales);
  const feeTotal = view.stores.reduce((a, x) => a + x.feeUsd, 0);

  return (
    <div className="g ix pay">
      {nothing && <section className="s12 c pay-none" aria-label="Még nincs fizetés"><h2 className="ink-h">Még nincs fizetés</h2><p className="note">{d.live ? "A fizetés be van kapcsolva, de még senki nem fizetett." : "Az InkAge még nem fogad fizetést, ezért itt nincs mit mutatni."} Ez nem hiba és nem mérési rés: amint megérkezik az első vásárlás (a weboldalon Stripe-on, az appokban az App Store-on vagy a Google Playen), ez az oldal magától megtelik: bevétel, fizetési helyek, termékek, a fizetésig vezető út és minden egyes fizetés.</p></section>}
      <Top><Hero flip label={<>Bevétel {per}<Info>Bruttó, dollárban: amit a vevők fizettek, a visszatérítések nélkül. Az áruházak a vevő saját pénznemében jelentenek, azok külön látszanak alatta. A díjak (Stripe, Apple, Google) nincsenek levonva; becslésük lent, az áruházak kártyáján.</Info></>}
        v={Math.round(n(view.usd.net) * 100) / 100} d={2} unit="$"
        sub={<>{view.prevUsd || n(view.usd.net) ? <>előtte {money(view.prevUsd, "USD")} · </> : null}{fmt(t.sales)} fizetés · {fmt(t.payers)} fizető ember{view.other.length ? <> · és {view.other.map((x) => money(n(x.net), x.currency)).join(", ")}</> : null}</>} /></Top>
      <Trio items={[
        { l: "Ma", v: n(d.today?.sales) ? moneyList(d.today?.rev) : "0" },
        { l: "Átlagos vásárlás", v: n(view.usd.sales) ? money(n(view.usd.avg), "USD") : "–" },
        { l: "Új fizető", v: n(t.new_payers) },
      ]} />

      <Card className="s12" icon={P.layers} title="Honnan fizetnek" sub="A három fizetési hely egymás mellett ebben az időszakban: hány fizetés, mennyi pénz, és a becsült díj, amit a Stripe, az Apple vagy a Google megtart. A díj becslés: a Stripe pontos díja a kártya országától függ, az Apple 15%-a csak a Small Business Programmal él.">
        <div className="pay-stores">{view.stores.map((x) => (
          <div key={x.k} className="pay-store" style={{ ["--pc" as any]: STORE_C[x.k] }}>
            <span className="pay-st-h"><i />{STORE_L[x.k]}</span>
            <b>{x.rows.length ? moneyList(x.rows) : money(0, "USD")}</b>
            <small>{fmt(x.sales)} fizetés · {pct(x.sales, Math.max(1, view.totalSales))}{x.prev || x.sales ? <> · előtte {fmt(x.prev)}</> : null}</small>
            <small>{fmt(x.payers)} ember{x.refunds ? <> · <span className="bad">{fmt(x.refunds)} visszatérítés</span></> : null}</small>
            <small className="mut">Díj: {FEE[x.k].l}{x.feeUsd ? <> ≈ {money(x.feeUsd, "USD")}</> : null}</small>
            <small className="mut">{x.last ? "Utolsó: " + ago(x.last) : "Még nem fizettek itt"}</small>
          </div>))}
        </div>
        {feeTotal > 0 && <p className="note">Becsült nettó (díjak után, csak a dolláros részen): <b>{money(n(view.usd.net) - feeTotal, "USD")}</b>. Az adót ez nem számolja.</p>}
      </Card>

      <Card className="s7" icon={P.calendar} title="Fizetések naponta" sub="Hány fizetés jött naponta (budapesti idő szerint), színenként a fizetés helye. Darabszám, mert a pénznemek nem adhatók össze; a pénz a fenti kártyákon látszik. Legfeljebb 90 nap.">
        {view.totalSales ? <StackedColumns days={view.cols} keys={["stripe", "apple", "google"]} label={(k) => STORE_L[k]} color={(k) => STORE_C[k]} height={220} /> : <Empty t="Ebben az időszakban még nem volt fizetés." />}
      </Card>
      <Card className="s5" icon={P.product} title="Termékek" sub="Mit vettek, a termék neve úgy, ahogy a fizetési adatban áll, darabszámmal és összeggel.">
        <BarList items={[...view.plans].map(([k, v]) => ({ k, n: v.n, sub: Object.entries(v.m).map(([c, m]) => money(m, c)).join(" + ") }))} empty="Még nem vettek semmit." max={6} />
        {n(t.upgrades) > 0 && <p className="note">{fmt(t.upgrades)} váltás nagyobb termékre ({pct(n(t.upgrades), Math.max(1, n(t.sales)))} a fizetésekből).</p>}
      </Card>

      <Card className="s6" icon={P.funnel} title="Az út a fizetésig" sub="Látogatásonként (munkamenet): hányan látták a vásárlási lehetőséget, hányan választottak, hányan nyomták meg a fizetés gombot, és hányan fejezték be. Az iPhone-app nem küld eseményt, ezért az App Store vásárlásai itt nem látszanak; a valódi szám a fenti kártyákon van.">
        <Funnel steps={[
          { k: "shown", l: "Látta, mit lehet venni", n: n(s.shown) },
          { k: "pick", l: "Választott", n: n(s.pick) },
          { k: "start", l: "Megnyomta a fizetés gombot", sub: n(s.signup) ? `ebből ${fmt(s.signup)} előbb regisztrálni ment` : undefined, n: n(s.start) },
          { k: "bought", l: "Fizetett", n: n(s.bought) },
        ]} accentK="bought" />
      </Card>
      <Card className="s6" icon={P.users} title="Fiókokból vevők" sub="Az időszakban regisztrált fiókok közül hányan fizettek már (a saját és tesztfiókjaid nélkül), és mennyi idő telt el a regisztráció és az első fizetés között.">
        <div className="pay-conv">
          <div><b>{pct(n(conv.paid), Math.max(1, n(conv.new_accounts)))}</b><small>{fmt(conv.paid)} / {fmt(conv.new_accounts)} új fiók fizetett</small></div>
          <div><b>{tp.median_h == null ? "–" : n(tp.median_h) < 1 ? Math.round(n(tp.median_h) * 60) + " perc" : n(tp.median_h) < 48 ? fmt(n(tp.median_h)) + " óra" : fmt(Math.round(n(tp.median_h) / 24)) + " nap"}</b><small>regisztrációtól az első fizetésig (medián)</small></div>
          <div><b>{n(tp.n) ? pct(n(tp.same_day), n(tp.n)) : "–"}</b><small>az első napon fizetett</small></div>
          <div><b>{fmt(t.refunds)}</b><small>visszatérítés{n(t.sales) ? ` (${pct(n(t.refunds), n(t.sales))})` : ""}</small></div>
        </div>
      </Card>

      <Card className="s12" icon={P.doc} title="Minden fizetés" sub="A legutóbbi 200 fizetés ebben az időszakban, egyenként: mikor, hol, mit vett, mennyi, kinek a nevére és melyik fiók. Egy sorra koppintva megnyílik az ember adatlapja."
        right={<div className="adm-seg sm">{(["all", "stripe", "apple", "google", "refund"] as const).map((k) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{k === "all" ? "Mind" : k === "refund" ? "Visszatérítve" : k === "stripe" ? "Web" : STORE_L[k]}</button>)}</div>}>
        <Tbl name="fizetesek" rows={recent} onRow={(r) => r.user_id && setU(String(r.user_id))} empty={nothing ? "Még egyetlen fizetés sem volt." : "Ebben az időszakban nincs ilyen fizetés."} cols={[
          { k: "at", l: "Mikor", ph: "sub", r: (r) => <span title={dt(r.at)}>{dt(r.at)}</span> },
          { k: "store", l: "Hol", r: (r) => <span className="pay-dot" style={{ ["--pc" as any]: STORE_C[r.store] }}>{STORE_L[r.store] || r.store}</span> },
          { k: "plan", l: "Termék", ph: "name", r: (r) => <b>{planName(r)}</b> },
          { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => r.refunded_at ? <span className="bad" title={"Visszatérítve: " + dt(r.refunded_at)}><s>{money(n(r.amount), r.currency)}</s> visszaadva</span> : <b>{money(n(r.amount), r.currency)}</b> },
          { k: "name", l: "Név", r: (r) => <span className="cap">{r.name || "–"}</span> },
          { k: "email", l: "Fiók", r: (r) => <span>{r.email || (r.user_id ? "törölt e-mail" : "törölt fiók")}{n(r.user_sales) > 1 ? <small className="mut"> · {fmt(r.user_sales)}. vásárlás</small> : null}</span> },
          { k: "signed_up", l: "Regisztrált", ph: "hide", r: (r) => (r.signed_up ? ago(r.signed_up) : "–") },
          { k: "tx", l: "Azonosító", ph: "hide", r: (r) => <code className="s11">{String(r.tx).slice(0, 28)}</code> },
        ]} />
      </Card>

      <Card className="s12" icon={P.clock} title="Mikor fizetnek" sub="A nap órái szerint (budapesti idő), ebben az időszakban. Segít eldönteni, mikor érdemes posztolni.">
        {(d.by_hour || []).length ? <BarList items={(d.by_hour as D[]).map((x) => ({ k: String(x.h), n: n(x.sales) }))} fmtK={(k) => `${k}:00–${k}:59`} max={phone ? 6 : 8} /> : <Empty t="Még nincs adat." />}
      </Card>
      {(d.top || []).length > 0 && <Card className="s12" icon={P.users} title="Visszatérő vevők" sub="Akik egynél többször fizettek (mindig, nem csak ebben az időszakban).">
        <Tbl name="visszatero-vevok" rows={d.top} onRow={(r) => setU(String(r.user_id))} cols={[
          { k: "email", l: "Fiók", ph: "name" }, { k: "sales", l: "Vásárlás", num: true, ph: "main" },
          { k: "gross", l: "Összesen", num: true, r: (r) => money(n(r.gross), r.currency) }, { k: "last", l: "Utoljára", r: (r) => ago(r.last) },
        ]} />
      </Card>}
      <p className="s12 note mut">Mindig: {fmt(d.all_time?.sales)} fizetés, {fmt(d.all_time?.payers)} fizető ember{d.first_ever ? `, az első ${dt(d.first_ever)}` : ""}. Az App Store és a Google Play visszatérítései csak akkor látszanak itt, ha az áruház jelzi őket.</p>
      {u && <UserDrawer id={u} close={() => setU(null)} />}
    </div>
  );
}
