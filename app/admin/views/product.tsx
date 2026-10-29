"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState , useEffect } from "react";
import { BarList, Donut, Empty, TrendChart, compact, fmt, pct, SERIES } from "../charts";
import { BellCurve } from "../wow";
import { Band, Card, FILES, Kpi, Lesson, Loading, P, QVAL, SIGN, lang, n, periodName, periodWords, type D, useBlockRpc, useFlt, useRpc , series } from "../shared";
import { per } from "./traffic";
import { FeatureGaps } from "./people";
import { UserDrawer } from "./users";

const SHARE_EV: Record<string, string> = { share_open: "Meghívó megosztva", share_save: "PDF a tetoválóművésznek", share_video: "Öregedés-videó", reveal_share: "Megosztó link" };
const FMT: Record<string, string> = { story: "Story (9:16)", post: "Poszt (1:1)", square: "Négyzet", wide: "Széles", card: "Kártya", video: "Videó", "–": "nincs megadva" };

/* ---------- product ---------- */
/* Every number here counts visits (sessions), like the funnel, with the period before beside it. */
export function Product({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: X, e } = useRpc("admin_product", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  /* "Mentett előnézetek" with a period of its own (the page's while it says "Mint fölül") */
  const ub = useBlockRpc("admin_product", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!X) return <Loading />;
  const N: D = X.now || {}, PV: D = X.prev || {}, U: D = (ub.own ? (ub.q.d as D | null)?.unlocks : X.unlocks) || {};
  const sc = Array.from({ length: 11 }, (_, i) => ({ k: i * 10, n: n(((X.scores || []) as D[]).find((x) => n(x.k) === i * 10)?.n) }));
  const scTotal = sc.reduce((s, x) => s + x.n, 0);
  const shares: D[] = X.share_fmt || [];
  const byFmt = Object.values(shares.reduce((m: Record<string, D>, x) => { (m[x.fmt] ||= { k: x.fmt, n: 0 }).n += n(x.n); return m; }, {})) as D[];
  const byEv = Object.values(shares.reduce((m: Record<string, D>, x) => { (m[x.ev] ||= { k: x.ev, n: 0 }).n += n(x.n); return m; }, {})) as D[];
  const decided = n(N.captured) + n(N.skipped);
  return (
    <div className="g">
      <Lesson>{n(N.revealed) ? <>Akik megnézik a tetoválásukat 50 év múlva, azoknak <b>{pct(n(N.detail), n(N.revealed))}</b>-a elmenti az előnézetet, és <b>{pct(n(N.more), n(N.revealed))}</b>-a kér újat. {n(N.detail) / n(N.revealed) < 0.3 ? "Az öregedés megnézése utáni első lépés a legnagyobb lehetőség." : "Az öregedés megnézése jól viszi tovább az embereket."}</> : <>Ebben az időszakban még senki nem nézte meg az öregedést.</>}</Lesson>
      <Band plain label={`Előnézet készült ${periodName(d)}`} value={n(N.analysis)} unit="látogatásban" now={n(N.analysis)} prev={n(PV.analysis)} sentence={<>Előnézet készült: aki elindította, vagy már a kész előnézetet is látta (az app az indulást nem mindig küldi, így kevesebb lehet, mint a kész előnézet). A „Kihagyta” csak azokat számolja, akik nem töltöttek fel bőrfotót. Látogatásokat számolunk, mint a Tölcsér: <b>{fmt(N.revealed)}</b> látogatás nézte meg 50 év múlva, <b>{fmt(N.detail)}</b> mentett el előnézetet, <b>{fmt(N.more)}</b> kért újat, <b>{fmt(N.shared)}</b> osztott meg.</>} />
      <Kpi spark={series(d, "revealed")} kind="own" to="@next" tone="butter" className="s3" icon={P.spark} l="Megnézte 50 év múlva" v={fmt(N.revealed)} now={n(N.revealed)} prev={n(PV.revealed)} sub={`${pct(n(N.revealed), n(N.analysis))} az előnézetekből`} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.eye} l="Elmentette az előnézetet" v={fmt(N.detail)} now={n(N.detail)} prev={n(PV.detail)} sub={`${pct(n(N.detail), n(N.revealed))} az öregedés megnézése után`} />
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.refresh} l="Újat kért" v={fmt(N.more)} now={n(N.more)} prev={n(PV.more)} sub={`${pct(n(N.more), n(N.revealed))} az öregedés megnézése után`} />
      <Kpi kind="own" to="@next" tone="peach" className="s3" icon={P.pen} l="Kihagyta a bőrfotót" v={pct(n(N.skipped), decided)} now={decided ? n(N.skipped) / decided : 0} prev={n(PV.skipped) + n(PV.captured) ? n(PV.skipped) / (n(PV.skipped) + n(PV.captured)) : 0} invert sub={`${fmt(N.skipped)} / ${fmt(decided)} döntésből`} />
      {scTotal > 0 ? <Card className="s12" icon={P.target} title="Értékek eloszlása" sub={`${fmt(scTotal)} érték ${periodName(d)}, tízes sávokban 0-tól 100-ig. A függőleges vonal az átlag.`}><BellCurve bins={sc} /></Card>
        : <Card className="s12" icon={P.target} title="Értékek eloszlása" sub="Az InkAge nem ad pontszámot."><Empty t="Az InkAge nem küld ilyen értéket, ezért ez a kártya üres. Új mérést az áruházi ellenőrzés végéig nem adunk hozzá (az adatvédelmi adatlap nem változhat)." icon={P.target} /></Card>}
      <Card className="s4" icon={P.pen} title="Honnan jön a minta" sub="Saját feltöltés, mintatár, MI-minta, fotóról kivágva vagy kihagyás."><Donut items={(d.capture || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} center={fmt((d.capture || []).reduce((s: number, r: D) => s + n(r.n), 0))} sub="minta" label={(k) => SIGN[k] || k} color={(k) => ({ drawn: SERIES[0], draw: SERIES[0], photo: SERIES[2], skipped: "#6E6E73" } as D)[k] || SERIES[6]} size={150} /></Card>
      <Card className="s4" icon={P.spark} title="Melyik stílust választják" sub="A bevezető kérdéseknél választott tetoválásstílus."><BarList items={((X.styles || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => QVAL[k] || k} empty="Még senki nem választott stílust." /></Card>
      <Card className="s4" icon={P.eye} title="Melyik változatot nyitják meg" sub="Az előnézetnél választott változat."><BarList items={((X.variants || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} empty="Még senki nem választott változatot." /></Card>
      <Card className="s6" icon={P.share} title="Megosztás: forma" sub="Milyen formában osztanak meg (link, videó, PDF)."><BarList items={byFmt.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => FMT[k] || k} empty="Még nincs megosztás." /></Card>
      <Card className="s6" icon={P.share} title="Megosztás: hol" sub="Megosztó link, öregedés-videó, PDF vagy meghívó."><BarList items={byEv.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => SHARE_EV[k] || k} empty="Még nincs megosztás." /></Card>
      <Card className="s8" icon={P.doc} title="Mentett előnézetek" right={ub.ctl} sub={`A galériába mentett előnézetek ${periodWords(ub.p)}, és hányat csináltattak meg valóban.`}>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}><div className="mini"><span>Mentett előnézet</span><b>{fmt(U.n)}</b><small>előtte {fmt(U.prev)}</small></div><div className="mini"><span>Fiók</span><b>{fmt(U.users)}</b></div><div className="mini"><span>Elkészíttette</span><b>{fmt(U.pro)}</b></div><div className="mini"><span>Mintával</span><b>{fmt(U.design)}</b></div></div>
        {(U.daily || []).length > 1 ? <TrendChart data={(U.daily as D[]).map((x) => ({ t: x.t, v: n(x.n) }))} label="Mentett előnézet" height={150} /> : null}
      </Card>
      <Card className="s4" icon={P.alert} title="MI-megjegyzés jelentve" sub="Hányszor jelentették az MI megjegyzését, a felület nyelve szerint."><BarList items={((X.ai_reports || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} empty="Senki nem jelentett." /></Card>
      <Card className="s4" icon={P.eye} title="Csúszka" sub="Az InkAge-ben nincs ilyen csúszka (–)."><BarList items={(d.legibility || []).map((x: D) => ({ k: String(x.k), n: n(x.n) }))} fmtK={(k) => QVAL[k] || k} empty="Még senki nem állította." /></Card>
      <Card className="s4" icon={P.refresh} title="Újrakezdések köre" sub="Hányadik körig kérnek új előnézetet."><BarList items={(d.more_rounds || []).map((x: D) => ({ k: x.k + ". kör", n: n(x.n) }))} empty="Még senki nem kért újat." /></Card>
      <Card className="s4" icon={P.doc} title="Letöltött fájlok" sub="Kép, öregedés-videó, PDF a tetoválóművésznek."><BarList items={(d.pro_files || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => FILES[k] || k} empty="Még nincs letöltés." /></Card>
      <Card className="s4" icon={P.clock} title="Emlékeztető" sub="Be- és kikapcsolások (csak az appban; az InkAge most nem küld ilyet)."><BarList items={(d.reminders || []).map((x: D) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => (k === "true" ? "Bekapcsolta" : k === "false" ? "Kikapcsolta" : k)} empty="Még nincs adat." /></Card>
      <ProductGaps />
    </div>
  );
}


/* ---------- what-if calculator (shown on the Célok page, which imports it from here) ---------- */
export function WhatIf({ d }: { d: D }) {
  const N = d.now || {}, A = d.all || {};
  const days0 = Math.max(1, Math.min(n(d.days), (Date.now() - new Date(d.first_event || Date.now()).getTime()) / 864e5 || 1));
  /* the goal can be counted in previews or in users (accounts): the share that gets there and the start differ */
  const [goalK, setGoalK] = useState<"scored" | "users">("scored");
  const users0 = ((d.users?.providers || []) as D[]).reduce((t, x) => t + n(x.n), 0);
  const baseVisits = Math.max(1, Math.round(n(N.sessions) / days0));
  const baseConv = goalK === "users" ? (n(N.sessions) && N.signups != null ? Math.max(0.1, (n(N.signups) / n(N.sessions)) * 100) : 1) : n(N.sessions) ? (n(N.scored) / n(N.sessions)) * 100 : 10;
  const [v, setV] = useState(baseVisits); const [c, setC] = useState(Math.round(baseConv * 10) / 10); const [g, setG] = useState(5);
  useEffect(() => { setC(Math.round(baseConv * 10) / 10); }, [goalK]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = goalK === "users" ? users0 : n(A.scored);
  const word = goalK === "users" ? "felhasználó" : "előnézet";
  /* day by day: visits grow g % a week, a share c % gets a preview */
  const proj: { t: string; v: number }[] = []; const hits: Record<number, number> = {};
  let total = start, visits = v; const goals = [1_000, 10_000, 100_000, 1_000_000];
  for (let day = 1; day <= 3650 && total < 1_000_000; day++) {
    visits *= Math.pow(1 + g / 100, 1 / 7); total += visits * (c / 100);
    goals.forEach((x) => { if (!hits[x] && total >= x) hits[x] = day; });
    if (day % 7 === 0) proj.push({ t: new Date(Date.now() + day * 864e5).toISOString(), v: Math.round(total) });
  }
  const when = (dd?: number) => (dd == null ? "10 éven belül nem" : new Date(Date.now() + dd * 864e5).toLocaleDateString("hu-HU", { year: "numeric", month: "long" }) + (dd < 400 ? ` (${fmt(dd)} nap)` : ""));
  const sl = (l: string, val: number, set: (x: number) => void, min: number, max: number, step: number, unit: string, base: number) => (
    <label className="wi-s"><span>{l}<b>{fmt(val, step < 1 ? 1 : 0)}{unit}</b></span><input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))} /><small>most: {fmt(base, step < 1 ? 1 : 0)}{unit}</small></label>
  );
  return (
    <div className="wi">
      <div className="wi-in">
        {sl("Látogatás naponta", v, setV, 1, Math.max(500, baseVisits * 20), 1, "", baseVisits)}
        <div className="adm-seg sm" role="group" aria-label="Mit számoljon"><button aria-pressed={goalK === "scored"} onClick={() => setGoalK("scored")}>Előnézet</button><button aria-pressed={goalK === "users"} onClick={() => setGoalK("users")}>Felhasználó (fiók)</button></div>
        {sl(goalK === "users" ? "Regisztrál" : "Előnézetig jut", c, setC, goalK === "users" ? 0.1 : 1, 60, goalK === "users" ? 0.1 : 0.5, "%", baseConv)}
        {sl("Heti növekedés", g, setG, 0, 30, 1, "%", 0)}
        <button className="lnk" onClick={() => { setV(baseVisits); setC(Math.round(baseConv * 10) / 10); setG(5); }}>Vissza a mostani számokra</button>
      </div>
      <div className="wi-out">
        <div className="wi-goal"><span>1 000 000 {word}</span><b>{when(hits[1_000_000])}</b></div>
        <div className="wi-row">{[1_000, 10_000, 100_000].map((x) => <div key={x}><span>{compact(x)}</span><b>{start >= x ? "✓ megvan" : when(hits[x])}</b></div>)}</div>
        {proj.length > 1 && <TrendChart data={proj.slice(0, 260)} label={`${word === "felhasználó" ? "Felhasználó" : "Előnézet"} összesen (becslés)`} height={190} />}
      </div>
    </div>
  );
}

/* "Kinek mutassuk meg": the accounts that have not tried a feature yet, each opening its panel */
function ProductGaps() {
  const [open, setOpen] = useState<string | null>(null);
  return <><FeatureGaps open={setOpen} />{open && <UserDrawer id={open} close={() => setOpen(null)} />}</>;
}
