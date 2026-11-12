"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Fizetések: the day's money page. Every payment from the web (Stripe), the App Store and Google Play in one answer
   (admin_payments): the goal and today's pace, the live list, where buyers come from, when they pay, the products,
   the road to paying, every payment with its actions. InkAge takes no payments yet: until the first purchase arrives
   the page says so plainly, and it fills in by itself from the first one. Product names come from the data, none are
   written in here, and there is no invoicing (no Billingo). */
import { useEffect, useMemo, useState } from "react";
import { BarList, Empty, Funnel, Info, StackedColumns, TrendChart, fmt, pct } from "../charts";
import { Card, I, Loading, P, Tbl, ago, dt, lang, n, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { haptic, toast, usePhone } from "../phone";
import { countryName } from "../visuals";
import { Top } from "./traffic";
import { B2BLine } from "./b2b";
import { PageErr } from "./people";
import { BuyerDrawer, CurPick, Dot, GrantSheet, M, Mail, PayActions, STORE_C, STORE_L, chName, conv, money, planOf, useCur } from "./pay-shared";

export { money, STORE_L, PLAN_L } from "./pay-shared";
const DOW = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const FKEYS: { k: string; l: string }[] = [{ k: "store", l: "Hely" }, { k: "plan", l: "Termék" }, { k: "buyer", l: "Vevő" }, { k: "ch", l: "Csatorna" }, { k: "lang", l: "Nyelv" }, { k: "country", l: "Ország" }, { k: "pf", l: "Platform" }];
const FEE_L: Record<string, string> = { stripe: "a Stripe pontos díja, ahol már megvan", apple: "15% a Small Business Programmal, nélküle 30%", google: "15% (az első 1 millió $ évente)" };

export function Payments({ days }: { days: number }) {
  const [f, setF] = useState<Record<string, string>>({});
  const q = useRpc("admin_payments", { p_days: days || 3650, p_f: f }, [days, JSON.stringify(f)]);
  const phone = usePhone();
  const { cur, setCur } = useCur();
  const [u, setU] = useState<string | null>(null); const [act, setAct] = useState<D | null>(null); const [grant, setGrant] = useState(false);
  const [st, setSt] = useState<"all" | "stripe" | "apple" | "google" | "refund" | "manual">("all");
  const [src, setSrc] = useState<"ch" | "account" | "link" | "article" | "lang" | "country" | "pf">("ch");
  /* an empty answer (no payment table yet) counts as "nothing yet", not as an endless load */
  const d: D | null = q.d ?? (q.at && !q.e ? {} : null);
  const huf = n(d?.fx?.huf) || 360;
  const $ = (usd: number) => M(usd, cur, huf);
  /* a milestone not seen yet on this device: one line of joy at the top */
  const [ms, setMs] = useState<string | null>(null);
  useEffect(() => {
    if (!d) return;
    const s = n(d.all_time?.sales), v = n(d.all_time?.usd);
    const hit = [1, 10, 50, 100, 250, 500, 1000, 5000].filter((x) => s >= x).pop(), hitV = [100, 1000, 5000, 10000, 50000, 100000].filter((x) => v >= x).pop();
    const key = `s${hit || 0}v${hitV || 0}`;
    let seen = ""; try { seen = localStorage.getItem("inkage.admin.payms") || ""; } catch {}
    if ((hit || hitV) && seen !== key) { setMs(hit === 1 && !hitV ? "Megjött az első fizetés!" : `${fmt(s)} fizetés, ${money(v, "USD")} bevétel eddig.`); try { localStorage.setItem("inkage.admin.payms", key); } catch {} }
  }, [d]);
  const view = useMemo(() => {
    if (!d) return null;
    const span = Math.min(days || 90, 90), cols: { t: string; v: Record<string, number> }[] = [], money2: { t: string; v: number; p?: number }[] = [];
    const dm = new Map<string, Record<string, number>>(), um = new Map<string, number>(), pm = new Map<string, number>();
    ((d.by_day || []) as D[]).forEach((x) => { const v = dm.get(x.day) || {}; v[x.store] = (v[x.store] || 0) + n(x.sales); dm.set(x.day, v); um.set(x.day, (um.get(x.day) || 0) + n(x.usd)); });
    const prev = (d.prev_by_day || []) as D[];
    prev.forEach((x, i) => pm.set(String(i), n(x.usd)));
    for (let i = span - 1; i >= 0; i--) {
      const t = new Date(Date.now() - i * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
      const pt = new Date(Date.now() - (i + span) * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
      cols.push({ t, v: dm.get(t) || {} });
      money2.push({ t, v: Math.round(conv(um.get(t) || 0, cur, huf) * 100) / 100, p: Math.round(conv(n(prev.find((x) => x.day === pt)?.usd), cur, huf) * 100) / 100 });
    }
    const marks = [...((d.notes || []) as D[]).map((x) => ({ t: x.day, label: x.text })), ...((d.releases || []) as D[]).slice(-12).map((x) => ({ t: new Date(x.at).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }), label: "Kiadás: " + String(x.msg || "").slice(0, 60), color: "var(--a-dim)" }))];
    const heat = new Map<string, number>(); ((d.heat || []) as D[]).forEach((x) => heat.set(`${x.dow}:${x.h}`, n(x.n)));
    const hmax = Math.max(1, ...heat.values());
    return { cols, money2, marks, heat, hmax };
  }, [d, days, cur, huf]);
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d || !view) return <Loading />;
  const t = d.totals || {}, pace = d.pace || {}, s = d.steps || {}, cv = d.conv || {}, tp = d.to_pay || {}, cfg = d.cfg || {};
  /* the day's goal is hers to set (cfg.goal_day); none is written in here */
  const goal = n(cfg.goal_day), today = n(pace.today?.n);
  const share = n(pace.share_by_now);
  const estEnd = share > 0.05 ? Math.round(today / share) : null;
  const monthGoal = n(cfg.goal_month), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), dom = new Date().getDate();
  const monthEst = n(pace.month?.usd) / Math.max(1, dom - 1 + (share || 0.5)) * dim;
  const recent: D[] = (d.recent || []).filter((r: D) => st === "all" ? r.store !== "manual" : st === "refund" ? !!r.refunded_at : r.store === st);
  const per = days >= 3650 || !days ? "összesen" : days === 1 ? "az elmúlt 24 órában" : `az elmúlt ${days} napban`;
  const nothing = !n(d.all_time?.sales);
  const stores = ["stripe", "apple", "google"].map((k) => ({ k, ...(((d.by_store || []) as D[]).find((x) => x.store === k) || {}) })) as D[];
  const fee = (x: D) => x.k === "stripe" ? (n(d.stripe_fee) || n(x.usd) * n(cfg.stripe_pct || 0.029) + n(x.sales) * n(cfg.stripe_fix || 0.3)) : n(x.usd) * (x.k === "apple" ? (cfg.apple_sbp === false ? 0.3 : 0.15) : n(cfg.google_rate || 0.15));
  const feeAll = stores.reduce((a, x) => a + fee(x), 0);
  const fChip = Object.entries(f);
  const setFilter = (k: string, v?: string) => { haptic(5); setF((o) => { const x = { ...o }; if (!v || x[k] === v) delete x[k]; else x[k] = v; return x; }); };
  const opt = (k: string): [string, string][] => k === "store" ? Object.entries(STORE_L).filter(([x]) => x !== "manual") : k === "plan" ? ((d.by_plan || []) as D[]).map((x) => [String(x.plan), planOf(x)] as [string, string]) : k === "buyer" ? [["new", "Új vevő"], ["back", "Visszatérő"]]
    : k === "ch" ? ((d.by_ch || []) as D[]).map((x) => [x.ch, chName(x.ch)]) : k === "lang" ? ((d.by_lang || []) as D[]).map((x) => [x.lang, lang(x.lang)]) : k === "country" ? ((d.by_country || []) as D[]).filter((x) => x.country !== "?").map((x) => [x.country, countryName(x.country)])
    : [["web", "Weboldal"], ["ios", "iPhone"], ["android", "Android"]];
  const srcRows: { k: string; n: number; sub?: string }[] = src === "ch" ? ((d.by_ch || []) as D[]).map((x) => ({ k: chName(x.ch), n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés${n(x.weak) ? ` · ${fmt(x.weak)} bizonytalan` : ""}` }))
    : src === "account" ? ((d.by_account || []) as D[]).map((x) => ({ k: x.account, n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés · ${fmt(x.payers)} ember` }))
    : src === "link" ? ((d.by_link || []) as D[]).map((x) => ({ k: `${x.code}${x.note ? " · " + x.note : x.campaign ? " · " + x.campaign : ""}`, n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés${x.post_platform ? " · " + x.post_platform : ""}` }))
    : src === "article" ? ((d.by_article || []) as D[]).map((x) => ({ k: x.land, n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés` }))
    : src === "lang" ? ((d.by_lang || []) as D[]).map((x) => ({ k: lang(x.lang), n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés` }))
    : src === "country" ? ((d.by_country || []) as D[]).map((x) => ({ k: x.country === "?" ? "Nem tudjuk" : countryName(x.country), n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés` }))
    : ((d.by_pf || []) as D[]).map((x) => ({ k: x.pf === "ios" ? "iPhone" : x.pf === "android" ? "Android" : "Weboldal", n: conv(n(x.usd), cur, huf), sub: `${fmt(x.sales)} fizetés` }));
  const askAbout = () => { try { sessionStorage.setItem("inkage.admin.askq", `Mi történt a bevétellel ${per}? Honnan jöttek a vevők, mi változott az előző időszakhoz képest, és mit tegyek, hogy több fizetés jöjjön?`); } catch {} location.hash = "ask"; };
  const fresh = ((d.recent || []) as D[]).filter((r) => r.store !== "manual").slice(0, 5);

  return (
    <div className="g ix pay">
      {nothing && <section className="s12 c pay-none" aria-label="Még nincs fizetés"><h2 className="ink-h">Még nincs fizetés</h2><p className="note">{d.live ? "A fizetés be van kapcsolva, de még senki nem fizetett." : "Az InkAge még nem fogad fizetést, ezért itt nincs mit mutatni."} Ez nem hiba és nem mérési rés: amint megérkezik az első vásárlás (a weboldalon Stripe-on, az appokban az App Store-on vagy a Google Playen), ez az oldal magától megtelik: bevétel, fizetési helyek, termékek, a fizetésig vezető út és minden egyes fizetés.</p></section>}
      {ms && <div className="s12 pay-ms" role="status"><b>{ms}</b><button className="lnk" onClick={() => setMs(null)}>Bezár</button></div>}
      {n(d.problems?.open) > 0 && <a className="s12 alert err pay-alert" href="#payfail">{I(P.alert)} {fmt(d.problems.open)} sürgős fizetési ügy vár rád (fizetett, de nem kapta meg, vagy kártyavita). Megnézem →</a>}

      <section className="s12 pay-goal">
        <div className="pay-goal-h"><span>Ma eddig</span><b>{fmt(today)} <small>{goal > 0 ? `/ ${fmt(goal)} fizető cél` : "fizetés · napi cél még nincs megadva"}</small></b><CurPick cur={cur} set={setCur} /></div>
        {goal > 0 && <div className="pay-bar" role="progressbar" aria-valuenow={today} aria-valuemax={goal}><i style={{ width: Math.min(100, (today / goal) * 100) + "%" }} />{estEnd != null && <u style={{ left: Math.min(100, (estEnd / goal) * 100) + "%" }} title="Estére várható" />}</div>}
        <div className="pay-pace">
          <span><b>{$(n(pace.today?.usd))}</b> ma</span>
          <span>Tegnap ugyanekkor: <b>{fmt(pace.yest?.n)}</b> · {$(n(pace.yest?.usd))}</span>
          <span>Múlt hét ugyanekkor: <b>{fmt(pace.week?.n)}</b></span>
          {estEnd != null ? <span>Estére várhatóan <b>{fmt(estEnd)}</b> fizetés</span> : <span className="mut">Az esti becsléshez még kevés a fizetés.</span>}
          <span>A hónap eddig: <b>{$(n(pace.month?.usd))}</b>{n(pace.month?.usd) > 0 && <> · hó végére ≈ <b>{$(monthEst)}</b></>}{monthGoal > 0 && <> · cél {fmt(monthGoal)} fizetés</>}</span>
        </div>
      </section>

      <Top><Hero flip label={<>Nettó bevétel {per}<Info>Amit a vevők fizettek, a visszatérítések nélkül, {cur === "HUF" ? "forintban" : "dollárban"} (a más pénznemű áruházi vásárlások az aznapi EKB-árfolyamon átszámolva). A díjak még nincsenek levonva: lent, a fizetési helyeknél és a Pénzügy oldalon.{n(t.est) ? ` ${fmt(t.est)} Google Play-vásárlásnál az ár nem jött meg, ott a listaár szerepel.` : ""}</Info></>}
        text={$(n(t.net_usd))}
        sub={<>előtte {$(n(t.prev_usd))} · {fmt(t.sales)} fizetés · {fmt(t.payers)} fizető{n(t.refunds) ? ` · ${fmt(t.refunds)} visszatérítés` : ""}</>} /></Top>
      <Trio items={[
        { l: "Átlagos vásárlás", v: n(t.sales) ? $(n(t.usd) / n(t.sales)) : "–" },
        { l: "Új fizető", v: n(t.new_payers) },
        { l: "Visszatérő vevő", v: Math.max(0, n(t.payers) - n(t.new_payers)) },
      ]} />

      <B2BLine rows={(d.by_plan || []) as D[]} fmtMoney={$} />

      <div className="s12 pay-filters">
        {FKEYS.map((x) => <label key={x.k} className={f[x.k] ? "on" : ""}><span>{x.l}</span><select value={f[x.k] || ""} onChange={(e) => setFilter(x.k, e.target.value || undefined)}><option value="">Mind</option>{opt(x.k).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
        {fChip.length > 0 && <button className="lnk" onClick={() => setF({})}>Szűrők törlése</button>}
        <button className="lnk" onClick={askAbout}>{I(P.spark)} Mi történt? (Kérdezz)</button>
      </div>

      {fresh.length > 0 && <Card eager className="s12" icon={P.live} title="Legfrissebb fizetések" sub="Az utolsó öt fizetés, frissüléskor jönnek az újak. Koppintva a vevő adatlapja nyílik.">
        <ul className="pay-live">{fresh.map((r) => <li key={r.id} onClick={() => r.user_id && setU(String(r.user_id))}><Dot store={r.store} /><b>{planOf(r)}</b><span>{money(n(r.amount), r.currency)}</span><small>{[r.first_buy ? "új vevő" : "visszatérő", r.account || chName(r.ch), r.lang ? lang(r.lang) : ""].filter(Boolean).join(" · ")}</small><time>{ago(r.at)}</time></li>)}</ul>
      </Card>}

      <Card className="s12" icon={P.layers} title="Honnan fizetnek" sub="A három fizetési hely egymás mellett ebben az időszakban: fizetés, pénz, emberek, visszatérítés, és a díj, amit a Stripe, az Apple vagy a Google megtart.">
        <div className="pay-stores">{stores.map((x) => (
          <button key={x.k} className={"pay-store" + (f.store === x.k ? " on" : "")} style={{ ["--pc" as any]: STORE_C[x.k] }} onClick={() => setFilter("store", x.k)}>
            <span className="pay-st-h"><i />{STORE_L[x.k]}</span>
            <b>{$(n(x.usd))}</b>
            <small>{fmt(x.sales)} fizetés · {pct(n(x.sales), Math.max(1, n(t.sales)))}{n(d.store_prev?.[x.k]) || n(x.sales) ? ` · előtte ${fmt(d.store_prev?.[x.k])}` : ""}</small>
            <small>{fmt(x.payers)} ember{n(x.refunds) ? <> · <span className="bad">{fmt(x.refunds)} visszatérítés</span></> : null}</small>
            {x.money && Object.keys(x.money).some((c) => c !== "USD") && <small className="mut">{Object.entries(x.money as Record<string, number>).map(([c, v]) => money(v, c)).join(" + ")}</small>}
            <small className="mut">Díj ≈ {$(fee(x))} · {FEE_L[x.k]}</small>
            <small className="mut">{x.last ? "Utolsó: " + ago(x.last) : "Még nem fizettek itt"}</small>
          </button>))}
        </div>
        {feeAll > 0 && <p className="note">Díjak után ≈ <b>{$(n(t.net_usd) - feeAll)}</b>. A pontos számokat (díj, kifizetés, költség) a Pénzügy oldal mutatja.</p>}
      </Card>

      <Card className="s7" icon={P.calendar} title="Bevétel naponta" sub="Nettó bevétel naponta (budapesti idő), szaggatottal az előző ugyanilyen hosszú időszak. A jelek: a Célok és naplóba írt jegyzeteid és a kiadások, hogy lásd, mi okozta a kiugrást. Legfeljebb 90 nap.">
        {n(t.sales) || n(t.prev_sales) ? <TrendChart data={view.money2} label={cur === "HUF" ? "Ft" : "$"} prevLabel="Előző időszak" marks={view.marks} height={230} bars /> : <Empty t="Ebben az időszakban még nem volt fizetés." />}
      </Card>
      <Card className="s5" icon={P.layers} title="Fizetések helyenként" sub="Darabszám naponta, színenként a fizetés helye.">
        {n(t.sales) ? <StackedColumns days={view.cols.slice(-30)} keys={["stripe", "apple", "google"]} label={(k) => STORE_L[k]} color={(k) => STORE_C[k]} height={200} /> : <Empty t="Még nincs fizetés." />}
      </Card>

      <Card className="s7" icon={P.traffic} title="Honnan jönnek a vevők" sub="A fizetők a regisztrációjukat hozó látogatás szerint (ugyanaz a párosítás, mint az Emberek oldalon: becslés, a bizonytalanokat külön jelzi). A Fiók a partnerfiókok rövid linkje; a Link a videónkénti rövid link; a Cikk az, amelyik oldalon először érkezett."
        right={<div className="adm-seg sm pay-seg">{([["ch", "Csatorna"], ["account", "Fiók"], ["link", "Poszt"], ["article", "Cikk"], ["lang", "Nyelv"], ["country", "Ország"], ["pf", "Platform"]] as const).map(([k, l]) => <button key={k} aria-pressed={src === k} onClick={() => setSrc(k)}>{l}</button>)}</div>}>
        <BarList items={srcRows} fmtK={(k) => k} empty="Még nincs ilyen fizetés." max={phone ? 6 : 10} />
      </Card>
      <Card className="s5" icon={P.clock} title="Mikor fizetnek" sub="A hét napjai és a nap órái szerint (budapesti idő). Minél sötétebb, annál több fizetés: ilyenkor érdemes posztolni.">
        {(d.heat || []).length ? <div className="pay-heat" role="table" aria-label="Fizetések napok és órák szerint">
          <div className="ph-r"><span />{Array.from({ length: 24 }, (_, h) => <i key={h} className="hh">{h % 6 === 0 ? h : ""}</i>)}</div>
          {DOW.map((dn, i) => <div key={dn} className="ph-r"><span>{dn}</span>{Array.from({ length: 24 }, (_, h) => { const v = view.heat.get(`${i + 1}:${h}`) || 0; return <i key={h} title={`${dn} ${h}:00 · ${v} fizetés`} style={{ opacity: v ? 0.18 + 0.82 * (v / view.hmax) : 0.06 }} />; })}</div>)}
        </div> : <Empty t="Még nincs adat." />}
      </Card>

      <Card className="s5" icon={P.product} title="Termékek" sub="Mit vettek, a termék neve úgy, ahogy a fizetési adatban áll, és a váltások nagyobb termékre (amikor csak a különbözetet fizetik). Az árak hatását az Árak és tesztek oldal mutatja.">
        <BarList items={((d.by_plan || []) as D[]).map((x) => ({ k: x.plan, n: n(x.sales), sub: $(n(x.usd)) }))} fmtK={(k) => planOf(((d.by_plan || []) as D[]).find((x) => x.plan === k) || { plan: k })} empty="Még nem vettek semmit." max={6} onPick={(k) => setFilter("plan", k)} />
        {n(t.upgrades) > 0 && <p className="note">{fmt(t.upgrades)} váltás nagyobb termékre ({pct(n(t.upgrades), Math.max(1, n(t.sales)))} a fizetésekből).</p>}
      </Card>
      <Card className="s7" icon={P.funnel} title="Az út a fizetésig" sub="Látogatásonként: hányan látták, mit lehet venni, választottak, megnyomták a fizetés gombot, és fizettek. Az iPhone-app nem küld eseményt, ezért az App Store vásárlásai itt kevesebbnek látszanak; a valódi szám a fenti kártyákon van. A félbehagyott és sikertelen fizetések a Fizetési hibák oldalon vannak.">
        <Funnel steps={[
          { k: "shown", l: "Látta, mit lehet venni", n: n(s.shown) },
          { k: "pick", l: "Választott", n: n(s.pick) },
          { k: "start", l: "Megnyomta a fizetés gombot", sub: n(s.signup) ? `ebből ${fmt(s.signup)} előbb regisztrálni ment` : undefined, n: n(s.start) },
          { k: "bought", l: "Fizetett", n: n(s.bought) },
        ]} accentK="bought" />
        {(n(d.problems?.expired) || n(d.problems?.failed)) > 0 && <p className="note"><a href="#payfail">{fmt(d.problems.expired)} félbehagyott és {fmt(d.problems.failed)} sikertelen fizetés ebben az időszakban →</a></p>}
      </Card>
      <Card className="s12" icon={P.users} title="Fiókokból vevők" sub="Az időszakban regisztrált fiókok közül hányan fizettek már, és mennyi idő telt el a regisztráció és az első fizetés között.">
        <div className="pay-conv four">
          <div><b>{pct(n(cv.paid), Math.max(1, n(cv.new_accounts)))}</b><small>{fmt(cv.paid)} / {fmt(cv.new_accounts)} új fiók fizetett</small></div>
          <div><b>{tp.median_h == null ? "–" : n(tp.median_h) < 1 ? Math.round(n(tp.median_h) * 60) + " perc" : n(tp.median_h) < 48 ? fmt(n(tp.median_h)) + " óra" : fmt(Math.round(n(tp.median_h) / 24)) + " nap"}</b><small>regisztrációtól az első fizetésig (medián)</small></div>
          <div><b>{n(tp.n) ? pct(n(tp.same_day), n(tp.n)) : "–"}</b><small>az első napon fizetett</small></div>
          <div><b>{fmt(t.refunds)}</b><small>visszatérítés{n(t.sales) ? ` (${pct(n(t.refunds), n(t.sales))})` : ""}</small></div>
        </div>
      </Card>

      <Card className="s12" icon={P.doc} title="Minden fizetés" sub="A legutóbbi 300 fizetés ebben az időszakban, egyenként. Egy sorra koppintva: visszatérítés, a vásárlás visszavétele, másik névre tétel, válaszsablon. A kézi vásárlások (amit te adtál) külön szűrőn."
        right={<div className="pay-row"><div className="adm-seg sm pay-seg">{(["all", "stripe", "apple", "google", "refund", "manual"] as const).map((k) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{k === "all" ? "Mind" : k === "refund" ? "Visszatérítve" : k === "manual" ? "Kézi" : k === "stripe" ? "Web" : STORE_L[k]}</button>)}</div>
          <button className="adm-ibtn" onClick={() => setGrant(true)}>{I(P.check)}Vásárlás kézzel</button></div>}>
        <Tbl name="fizetesek" rows={recent} onRow={(r) => setAct(r)} empty={nothing ? "Még egyetlen fizetés sem volt." : "Ebben az időszakban nincs ilyen fizetés."} cols={[
          { k: "at", l: "Mikor", ph: "sub", r: (r) => <span title={dt(r.at)}>{dt(r.at)}</span> },
          { k: "store", l: "Hol", r: (r) => <Dot store={r.store} /> },
          { k: "plan", l: "Termék", ph: "name", r: (r) => <b>{planOf(r)}</b> },
          { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => r.refunded_at ? <span className="bad" title={"Visszatérítve: " + dt(r.refunded_at)}><s>{money(n(r.amount), r.currency)}</s> vissza</span> : <b>{money(n(r.amount), r.currency)}{r.est ? <small className="mut" title="Az áruház nem küldte az árat: listaár"> ≈</small> : null}</b> },
          { k: "name", l: "Név", r: (r) => <span className="cap">{r.name || "–"}</span> },
          { k: "email", l: "Fiók", r: (r) => <span><Mail e={r.email} />{n(r.user_sales) > 1 ? <small className="mut"> · {fmt(r.user_sales)} vásárlás</small> : null}</span> },
          { k: "ch", l: "Honnan", ph: "hide", r: (r) => r.account || chName(r.ch) },
          { k: "coupon", l: "Kód", ph: "hide", r: (r) => r.coupon || <span className="mut">–</span> },
        ]} />
      </Card>

      <Card className="s12" icon={P.users} title="Visszatérő vevők" sub="Akik egynél többször fizettek (mindig). Minden vevő a Vevők oldalon.">
        {(d.top || []).length ? <Tbl name="visszatero-vevok" rows={d.top} onRow={(r) => setU(String(r.user_id))} cols={[
          { k: "email", l: "Fiók", ph: "name", r: (r) => <Mail e={r.email} /> }, { k: "sales", l: "Vásárlás", num: true, ph: "main" },
          { k: "usd", l: "Összesen", num: true, r: (r) => $(n(r.usd)) }, { k: "last", l: "Utoljára", r: (r) => ago(r.last) },
        ]} /> : <Empty t="Még senki nem vett kétszer." />}
      </Card>
      <p className="s12 note mut">Mindig: {fmt(d.all_time?.sales)} fizetés, {fmt(d.all_time?.payers)} fizető ember, {money(n(d.all_time?.usd), "USD")}{d.first_ever ? `, az első ${dt(d.first_ever)}` : ""}. Az App Store és a Google Play visszatérítései csak akkor látszanak itt, ha az áruház jelzi őket. Árfolyam: 1 $ = {fmt(huf, 1)} Ft{d.fx?.day ? ` (${d.fx.day}, EKB)` : " (még nincs letöltve, becslés)"}.</p>
      {u && <BuyerDrawer id={u} close={() => setU(null)} />}
      {act && <PayActions p={act} close={() => setAct(null)} done={q.load} />}
      {grant && <GrantSheet plans={((d.by_plan || []) as D[]).map((x) => String(x.plan)).filter(Boolean)} close={() => setGrant(false)} done={() => { q.load(); toast("Kész"); }} />}
    </div>
  );
}
