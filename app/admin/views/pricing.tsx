"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Árak és tesztek: what the products do (admin_pay_pricing). The mix over the weeks, the step-ups, the tattoo styles
   that sell, what a buyer did before paying, the one try, the countries; partner codes with what they brought and what
   each partner is owed; the web purchase page's test (the product chosen first, never a price); two calculators; the
   year's tattoo seasons. InkAge takes no payments yet and has no fixed packages: no price and no product name is
   written in here, everything comes from the data, and every card says plainly when there is nothing yet. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, StackedColumns, fmt, pct } from "../charts";
import { CELEB, Card, I, Lesson, Loading, MOCK, P, Tbl, api, n, rpc, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { Sheet, toast } from "../phone";
import { countryName } from "../visuals";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { CurPick, M, STORE_S, money, planKey, useCur } from "./pay-shared";

/* black and white only: the products get greys in turn (no colour is tied to a product name) */
const SER = ["var(--ser-0)", "var(--ser-2)", "var(--ser-4)", "var(--ser-6)", "var(--ser-1)", "var(--ser-3)", "var(--ser-5)", "var(--ser-7)", "var(--ser-8)"];
/* the times of the year people think about a new tattoo, or about how an old one will look */
const SEASONS: { d: string; l: string; why: string }[] = [
  { d: "01-02", l: "Újévi fogadalmak", why: "„idén megcsináltatom”: sokan most döntik el, mit és hova" },
  { d: "02-14", l: "Valentin-nap", why: "páros tetoválások: hogy fog kinézni évek múlva mindkettőn" },
  { d: "04-01", l: "Tavasz, nyár előtt", why: "a nyári szezon előtti foglalások: előtte még meg lehet nézni a mintát" },
  { d: "05-04", l: "Anyák napja (Magyarország, május első vasárnapja)", why: "emléktetoválások, nevek, dátumok" },
  { d: "06-15", l: "Nyár, nyaralás", why: "napfény és tetoválás: hogyan fakul a minta" },
  { d: "09-01", l: "Ősz, a szalonok fő szezonja", why: "a nyár után sokan most csináltatják meg" },
  { d: "11-27", l: "Black Friday hete", why: "a legnagyobb vásárlási hét: kódos akció" },
  { d: "12-10", l: "Karácsonyi ajándékszezon", why: "tetoválás-utalvány ajándékba: előtte megnézni, hogy fog öregedni" },
];

export function Pricing({ days }: { days: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_pay_pricing", { p_days: days || 90 }, [days]);
  const fx = useRpc("admin_payments", { p_days: 30 }, []);
  const huf = n(fx.d?.fx?.huf) || 360;
  const { cur, setCur } = useCur();
  const $ = (usd: number) => M(usd, cur, huf);
  const [code, setCode] = useState(false); const [ab, setAb] = useState(false);
  const d = q.d;
  /* the calculators: what a better rate or a bigger share of the dearest product would bring, and what the goal needs */
  const [w, setW] = useState({ conv: 0, ultra: 0, visits: 0 });
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d) return <Loading />;
  const cfg = d.cfg || {}, testOn = !!cfg.ab?.on;
  const weeks = Array.from(new Set(((d.mix_week || []) as D[]).map((x) => x.wk))).sort();
  const mix = weeks.map((wk) => ({ t: wk, v: Object.fromEntries(((d.mix_week || []) as D[]).filter((x) => x.wk === wk).map((x) => [x.plan, n(x.n)])) }));
  const plans = Array.from(new Set(((d.mix_week || []) as D[]).map((x) => x.plan)));
  const pp = d.per_paywall || {}, base = fx.d || {};
  /* no price is written in here: the average and the dearest product come from the last 30 days' sales (none: no estimate) */
  const sales30 = n(base.totals?.sales), usd30 = n(base.totals?.usd), avg = sales30 ? usd30 / sales30 : 0;
  const shown30 = n(base.steps?.shown), rate = shown30 ? n(base.steps?.bought) / shown30 : 0;
  const byPlan = ((base.by_plan || []) as D[]).filter((x) => n(x.sales) > 0).map((x) => ({ ...x, avg: n(x.usd) / n(x.sales) }) as D).sort((a, b) => b.avg - a.avg);
  const top = byPlan[0], topPrice = top ? top.avg : avg;
  const topShare = sales30 && top ? n(top.sales) / sales30 : 0;
  const monthNow = usd30;
  const monthWhatIf = shown30 * Math.max(0.0001, rate * (1 + w.conv / 100)) * (1 + w.visits / 100) * (avg + (w.ultra / 100) * (topPrice - avg));
  const goal = n(cfg.goal_day);
  const needPaywalls = rate > 0 && goal > 0 ? Math.ceil(goal / rate) : null;
  const up = d.up_share || {};
  const toggleCode = async (c: D) => { const r = await api("/api/admin/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "code_active", code: c.code, active: !c.active }) }); toast(r.ok ? (c.active ? "Kód kikapcsolva" : "Kód bekapcsolva") : String(r.json?.error || "Nem sikerült")); q.load(); };
  const thisYear = new Date().getFullYear();
  const upcoming = SEASONS.map((s) => { let t = new Date(`${thisYear}-${s.d}T12:00:00`); if (t.getTime() < Date.now() - 864e5) t = new Date(`${thisYear + 1}-${s.d}T12:00:00`); return { ...s, t, in: Math.round((t.getTime() - Date.now()) / 864e5) }; }).sort((a, b) => a.t.getTime() - b.t.getTime());
  return (
    <div className="g ix pay">
      {!sales30 && !mix.length && <Lesson><b>Még nincs eladás.</b> Az InkAge még nem fogad fizetést, ezért itt minden üres. Amint megérkeznek az első vásárlások, a termékek nevei, az arányok és a kalkulátorok az adatokból töltődnek ki.</Lesson>}
      <Top><Hero flip label="A vásárlási oldal egy megnyitása ennyi pénzt hoz (web)" text={n(pp.shown) ? $(n(pp.usd) / n(pp.shown)) : "–"} sub={<>{fmt(pp.shown)} megnyitás · {fmt(pp.sales)} fizetés · ez dönti el, melyik ár vagy elrendezés a jobb</>} side={<CurPick cur={cur} set={setCur} />} /></Top>
      <Trio items={[
        { l: "Később nagyobb termékre váltott", v: n(up.basic) + n(up.pro) ? pct(n(up.basic_up) + n(up.pro_up), n(up.basic) + n(up.pro)) : "–" },
        { l: "Egy fizetés átlagosan (30 nap)", v: sales30 ? $(avg) : "–" },
        { l: "A kipróbálás után fizetett", v: n(d.try?.tried) ? pct(n(d.try?.bought), n(d.try?.tried)) : "–" },
      ]} />

      <Card className="s7" icon={P.product} title="Termékarány hétről hétre" sub="Melyik termékből hány fogyott hetente, a termék neve úgy, ahogy a fizetési adatban áll. Ha egy olcsóbb termék aránya nő a drágább rovására, az ár vagy az elrendezés nem jól vezet.">
        {mix.length ? <StackedColumns days={mix} keys={plans} label={(k) => planKey(k)} color={(k) => SER[Math.max(0, plans.indexOf(k)) % SER.length]} height={210} /> : <Empty t="Még nincs eladás." />}
      </Card>
      <Card className="s5" icon={P.refresh} title="Váltások nagyobb termékre" sub="Később nagyobb terméket vettek (csak a különbözetet fizetik), és mennyi idő után.">
        {(d.upgrades || []).length ? <Tbl name="valtasok" rows={d.upgrades} csv={false} cols={[{ k: "plan", l: "Váltás", ph: "name", r: (r) => planKey(r.plan) }, { k: "n", l: "Darab", num: true, ph: "main" }, { k: "median_h", l: "Ennyi idő után", r: (r) => n(r.median_h) < 48 ? `${fmt(r.median_h)} óra` : `${fmt(Math.round(n(r.median_h) / 24))} nap` }]} /> : <Empty t="Még nem volt váltás." />}
      </Card>

      <Card className="s7" icon={P.spark} title="A tetoválásstílusok, amelyek eladják az appot" sub="Amit a vevők a vásárlásuk után választottak, és hányszor volt ez az első választásuk (valószínűleg ezért fizettek). Érdemes ezeket tenni a minták és a vásárlási oldal elejére.">
        <BarList items={((d.styles || []) as D[]).map((x) => ({ k: CELEB[x.style] || x.style, n: n(x.n), sub: `${fmt(x.first_pick)}× első választás · ${fmt(x.people)} vevő` }))} fmtK={(k) => k} empty="Még nincs ilyen adat." max={10} />
      </Card>
      <Card className="s5" icon={P.clock} title="Vásárlás előtt" sub="Amit a vevő látogatása a fizetésig csinált (csak a webes vásárlásoknál, ahol a látogatás ismert), és a kipróbálás hatása.">
        <div className="pay-conv">
          <div><b>{d.before?.minutes == null ? "–" : `${fmt(d.before.minutes)} perc`}</b><small>a látogatás elejétől a fizetésig (medián)</small></div>
          <div><b>{d.before?.paywalls == null ? "–" : fmt(d.before.paywalls, 1)}</b><small>vásárlásioldal-megnyitás fizetés előtt</small></div>
          <div><b>{fmt(d.try?.tried)}</b><small>kipróbálta (egy próba)</small></div>
          <div><b>{d.try?.median_h == null ? "–" : `${fmt(d.try.median_h)} óra`}</b><small>a kipróbálástól a fizetésig</small></div>
        </div>
      </Card>

      <Card className="s12" icon={P.globe} title="Országok és pénznemek" sub="Az áruházakban az ár országonként más (az áruház árlépcsői szerint); itt látszik, hol mennyit fizetnek egy vásárlásra helyi pénzben és dollárban.">
        {(d.by_country || []).length ? <Tbl name="orszagok" rows={d.by_country} cols={[{ k: "country", l: "Ország", ph: "name", r: (r) => r.country === "?" ? "Nem tudjuk" : countryName(r.country) }, { k: "store", l: "Hol", r: (r) => STORE_S[r.store] || r.store }, { k: "sales", l: "Fizetés", num: true, ph: "main" },
          { k: "avg_local", l: "Átlag helyi pénzben", num: true, r: (r) => money(n(r.avg_local), r.currency) }, { k: "avg_usd", l: "Átlag", num: true, r: (r) => $(n(r.avg_usd)) }]} /> : <Empty t="Még nincs eladás." />}
      </Card>

      <Card className="s12" icon={P.links} title="Partnerkódok és kuponok" sub="Kód partnerenként (a partnerfiókok): a vevő a fizetésnél beírja, kedvezményt kap, és itt látszik, mennyit hozott, mennyi kedvezményt adtunk, és mennyi jutalék jár a partnernek. A kód a Stripe-ban készül el; csak a weboldalon működik."
        right={<button className="adm-ibtn" onClick={() => setCode(true)}>{I(P.check)}Új kód</button>}>
        {(d.codes || []).length ? <Tbl name="kodok" rows={d.codes} cols={[
          { k: "code", l: "Kód", ph: "name", r: (r) => <b>{r.code}</b> }, { k: "partner", l: "Partner" }, { k: "percent", l: "Kedvezmény", num: true, r: (r) => `${fmt(r.percent)}%` },
          { k: "sales", l: "Fizetés", num: true }, { k: "usd", l: "Bevétel", num: true, ph: "main", r: (r) => $(n(r.usd)) }, { k: "discount", l: "Adott kedvezmény", num: true, r: (r) => money(n(r.discount)) },
          { k: "owed", l: "Jutalék", num: true, r: (r) => <b>{$(n(r.owed))}</b> },
          { k: "active", l: "", r: (r) => <button className="lnk" onClick={(e) => { e.stopPropagation(); toggleCode(r); }}>{r.active ? "Kikapcsolom" : "Bekapcsolom"}</button> },
        ]} /> : <Empty t="Még nincs partnerkód." />}
        {(d.other_codes || []).length > 0 && <p className="note">A Stripe-ban készült egyéb kódok: {(d.other_codes as D[]).map((x) => `${x.coupon} (${fmt(x.sales)} fizetés, ${money(n(x.usd))})`).join(", ")}.</p>}
      </Card>

      <Card className="s7" icon={P.target} title="Teszt a vásárlási oldalon" sub="A weboldalon a látogatók fele az egyik, fele a másik terméket látja kiválasztva, amikor megnyílik a vásárlási oldal. Az ár sosem változik. Az nyer, amelyik több pénzt hoz egy megnyitásra (nem az, amelyik több vevőt). Alapból ki van kapcsolva."
        right={<button className="adm-ibtn" onClick={() => setAb(true)}>{I(P.pen)}{testOn ? "Teszt beállítása" : "Teszt indítása"}</button>}>
        {(d.ab || []).length ? <Tbl name="ab-teszt" rows={d.ab} csv={false} cols={[{ k: "variant", l: "Változat", ph: "name", r: (r) => { const side = String(r.variant).split("-").pop(); return `${side === "a" ? "A" : "B"}: ${cfg.ab?.[side || "a"] ? planKey(cfg.ab[side || "a"]) : "?"} kiválasztva`; } },
          { k: "shown", l: "Megnyitás", num: true }, { k: "sales", l: "Fizetés", num: true }, { k: "usd", l: "Bevétel", num: true, r: (r) => $(n(r.usd)) }, { k: "per", l: "Egy megnyitásra", num: true, ph: "main", r: (r) => <b>{n(r.shown) ? $(n(r.usd) / n(r.shown)) : "–"}</b> }]} />
          : <Empty t={testOn ? "A teszt fut, még nincs megnyitás." : "Nincs futó teszt."} />}
        {(d.ab || []).length === 2 && Math.min(...(d.ab as D[]).map((x) => n(x.shown))) < 300 && <p className="note">Még kevés a megnyitás: változatonként legalább 300 kell, hogy a különbség ne a véletlen műve legyen.</p>}
      </Card>
      <Card className="s5" icon={P.spark} title="Mi lenne, ha…" sub="A legutóbbi 30 nap számaiból: mennyi lenne egy hónap, ha jobb lenne a fizetési arány, nagyobb a legdrágább termék aránya, vagy több a látogató. Eladás nélkül nincs miből számolni.">
        {[["conv", "Fizetési arány", rate * 100, "%"], ["ultra", top ? `${planKey(top.plan)} aránya` : "A legdrágább termék aránya", topShare * 100, "%"], ["visits", "Látogatók", 0, "%"]].map(([k, l, now]) => <label key={String(k)} className="pfield"><span>{l} {k === "visits" ? "" : `(most ${fmt(Number(now), 1)}%)`}: <b>{(w as D)[String(k)] >= 0 ? "+" : ""}{(w as D)[String(k)]}%</b></span><input type="range" min={k === "ultra" ? 0 : -50} max={k === "ultra" ? 100 : 200} step={5} value={(w as D)[String(k)]} onChange={(e) => setW({ ...w, [String(k)]: Number(e.target.value) })} /></label>)}
        <div className="pay-conv"><div><b>{$(monthNow)}</b><small>most, 30 nap</small></div><div><b>{shown30 && sales30 ? $(monthWhatIf) : "–"}</b><small>a csúszkákkal</small></div></div>
      </Card>
      <Card className="s6" icon={P.target} title="Mi kell a napi célhoz?" sub="A mostani fizetési aránnyal visszaszámolva: ennyi vásárlásioldal-megnyitás kell naponta a napi célhoz. A napi célt a Pénzügy oldal Beállításaiban adod meg.">
        <div className="pay-conv">
          <div><b>{goal > 0 ? fmt(goal) : "–"}</b><small>{goal > 0 ? "fizető ember naponta (cél)" : "napi cél még nincs megadva"}</small></div>
          <div><b>{needPaywalls == null ? "–" : fmt(needPaywalls)}</b><small>vásárlásioldal-megnyitás naponta ({fmt(rate * 100, 1)}% fizet)</small></div>
          <div><b>{shown30 ? fmt(Math.round(shown30 / 30)) : "–"}</b><small>most naponta</small></div>
        </div>
      </Card>
      <Card className="s6" icon={P.calendar} title="Akciós naptár" sub="Az év időszakai, amikor többen gondolkodnak új tetováláson (magukra vagy ajándékba). Két héttel előtte érdemes tartalommal és partnerkóddal készülni.">
        <ul className="pay-season">{upcoming.slice(0, 6).map((s) => <li key={s.l}><b>{s.l}</b><small>{s.t.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })} · {s.in <= 0 ? "most" : `${s.in} nap múlva`} · {s.why}</small></li>)}</ul>
      </Card>
      {code && <CodeSheet close={() => setCode(false)} done={q.load} />}
      {ab && <AbSheet cfg={cfg} plans={plans.filter((k) => !String(k).startsWith("up_"))} close={() => setAb(false)} done={q.load} sb={sb} />}
      <Lesson>Árat itt nem lehet változtatni: az árak a weboldalon, az App Store-ban és a Google Playen is ugyanazok, és csak a te döntéseddel változhatnak.</Lesson>
    </div>
  );
}

function CodeSheet({ close, done }: { close: () => void; done: () => void }) {
  const [v, setV] = useState({ code: "", partner: "", percent: "10", commission: "20", max: "", note: "" }); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = MOCK ? { ok: true, json: {} as D } : await api("/api/admin/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "code", ...v }) });
    setBusy(false);
    if (!r.ok) { toast(String(r.json?.error || "Nem sikerült")); return; }
    toast(`A ${v.code.toUpperCase()} kód él a Stripe-ban`); done(); close();
  };
  return (
    <Sheet title="Új partnerkód" sub="a Stripe-ban készül, a weboldalon működik" close={close} foot={<button className="adm-ibtn gold" disabled={busy || v.code.length < 3} onClick={go}>{busy ? "…" : "Létrehozom"}</button>}>
      <label className="pfield"><span>A kód (amit a vevő beír)</span><input className="adm-in" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="PARTNER10" /></label>
      <label className="pfield"><span>Partner</span><input className="adm-in" value={v.partner} onChange={(e) => setV({ ...v, partner: e.target.value })} placeholder="a partner neve" /></label>
      <label className="pfield"><span>Kedvezmény (%)</span><input className="adm-in" inputMode="numeric" value={v.percent} onChange={(e) => setV({ ...v, percent: e.target.value })} /></label>
      <label className="pfield"><span>A partner jutaléka (% a kódjával jött bevételből)</span><input className="adm-in" inputMode="numeric" value={v.commission} onChange={(e) => setV({ ...v, commission: e.target.value })} /></label>
      <label className="pfield"><span>Legfeljebb ennyiszer használható (üresen: korlátlan)</span><input className="adm-in" inputMode="numeric" value={v.max} onChange={(e) => setV({ ...v, max: e.target.value })} /></label>
      <label className="pfield"><span>Megjegyzés</span><input className="adm-in" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></label>
    </Sheet>
  );
}

/* the two variants are products already seen in the data (InkAge has no fixed packages) */
function AbSheet({ cfg, plans, close, done, sb }: { cfg: D; plans: string[]; close: () => void; done: () => void; sb: ReturnType<typeof supabaseBrowser> }) {
  const [v, setV] = useState({ on: !!cfg.ab?.on, a: cfg.ab?.a || plans[0] || "", b: cfg.ab?.b || plans[1] || plans[0] || "" });
  const can = plans.length >= 2;
  const save = async () => {
    const id = v.on && !cfg.ab?.on ? "t" + new Date().toISOString().slice(2, 10).replace(/-/g, "") : cfg.ab?.id || "t1";
    const { error } = await rpc(sb, "admin_pay_cfg_save", { p_v: { ab: { on: v.on, id, a: v.a, b: v.b } } });
    if (error) { toast(error.message); return; } toast(v.on ? "A teszt fut (az új látogatóknál)" : "A teszt leállt"); done(); close();
  };
  return (
    <Sheet title="Teszt a vásárlási oldalon" close={close} foot={<button className="adm-ibtn gold" disabled={!can && !cfg.ab?.on} onClick={save}>Mentés</button>}>
      {!can && <p className="note">A teszthez legalább két termék kell az eladások között. Az InkAge még nem fogad fizetést, ezért most nincs mit kiválasztani.</p>}
      <label className="pay-ck"><input type="checkbox" checked={v.on} disabled={!can && !v.on} onChange={(e) => setV({ ...v, on: e.target.checked })} /> A teszt fut</label>
      {can && (["a", "b"] as const).map((k) => <label key={k} className="pfield"><span>{k.toUpperCase()} változat: kiválasztott termék</span><select className="adm-in" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}>{plans.map((p) => <option key={p} value={p}>{planKey(p)}</option>)}</select></label>)}
      <p className="note">Egy új teszt új azonosítót kap, így a régi eredmények nem keverednek bele. Az ár sosem változik.</p>
    </Sheet>
  );
}
