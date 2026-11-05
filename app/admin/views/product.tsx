"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState , useEffect } from "react";
import { BarList, Donut, Empty, Info, TrendChart, compact, fmt, pct, SERIES } from "../charts";
import { Card, FILES, Kpi, Lesson, Loading, P, QVAL, SIGN, lang, n, periodName, periodWords, styleName, type D, useBlockRpc, useFlt, useRpc , series } from "../shared";
import { Top, per } from "./traffic";
import { Chg, Hero, Ring, Trio, type RingKind } from "../ink";
import { FeatureGaps, LoadErr, PageErr, PhMore } from "./people";
import { UserDrawer } from "./users";
import { StyleRank } from "./style-rank";
import { REDO } from "./inkage";

/* the PDF, the video and the saved image are downloads (Letöltött fájlok), not shares */
const SHARE_EV: Record<string, string> = { share_open: "Meghívó megosztva", share_save: "Mentés megosztásra", share_video: "Videó megosztva", reveal_share: "Megosztó link" };
const FMT: Record<string, string> = { story: "Story (9:16)", post: "Poszt (1:1)", square: "Négyzet", wide: "Széles", card: "Kártya", video: "Videó", "–": "nincs megadva" };

/* ---------- product ---------- */
/* Every number here counts visits (sessions), like the funnel, with the period before beside it. */
export function Product({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: X, e, load, busy } = useRpc("admin_product", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  /* "Előnézetek" with a period of its own (the page's while it says "Mint fölül") */
  const ub = useBlockRpc("admin_product", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  if (e && !X) return <PageErr e={e} retry={load} busy={busy} />;
  if (!X) return <Loading />;
  const N: D = X.now || {}, PV: D = X.prev || {}, M: D | null = X.made || null, U: D | null = (ub.own ? (ub.q.d as D | null)?.made : X.made) || null;
  /* InkAge's own blocks: the "Nem lett jó?" re-requests, the downloads and the app reminders; a block the data does not carry is not drawn */
  const R: D | null = X.redo || null, RM: D | null = X.reminders || null;
  const shares: D[] = X.share_fmt || [];
  const byFmt = Object.values(shares.reduce((m: Record<string, D>, x) => { (m[x.fmt] ||= { k: x.fmt, n: 0 }).n += n(x.n); return m; }, {})) as D[];
  const byEv = Object.values(shares.reduce((m: Record<string, D>, x) => { (m[x.ev] ||= { k: x.ev, n: 0 }).n += n(x.n); return m; }, {})) as D[];
  const decided = n(N.captured) + n(N.skipped);
  return (
    <div className="g ix">
      {M ? <Top><Hero flip label={<>Elkészült előnézet {periodName(d)}<Info><b>{fmt(M.users)}</b> fiók készítette, minden eszközről, a saját fiókjaid nélkül. Az alatta lévő lépések látogatásokat számolnak, mint a Tölcsér: <b>{fmt(N.revealed)}</b> látogatás nézte meg 50 év múlva, <b>{fmt(N.detail)}</b> mentette el az előnézetet, <b>{fmt(N.more)}</b> kért újat, <b>{fmt(N.shared)}</b> osztott meg, <b>{fmt(N.saved)}</b> mentett képet.</Info></>} v={n(M.n)}
          chg={d.prev_partial ? undefined : <Chg a={n(M.n)} b={n(M.prev)} tail="az előző időszakhoz" />} sub="MI-előnézet" side={<Trio items={[{ l: "fiók készítette", v: fmt(M.users) }, { l: "mentett", v: fmt(N.saved) }, { l: "megosztott", v: fmt(N.shared) }]} />} /></Top>
        : <Top><Hero flip label={<>Megnézte 50 év múlva {periodName(d)}<Info>Az elkészült előnézetek száma csatornára vagy nyelvre szűrve nem bontható, ezért itt a szűrt látogatások látszanak.</Info></>} v={n(N.revealed)} chg={d.prev_partial ? undefined : <Chg a={n(N.revealed)} b={n(PV.revealed)} tail="az előző időszakhoz" />} sub="látogatásban" /></Top>}
      <Lesson>{n(N.revealed) ? <>Akik megnézik a tetoválásukat 50 év múlva, azoknak <b>{pct(n(N.detail), n(N.revealed))}</b>-a elmenti az előnézetet, és <b>{pct(n(N.more), n(N.revealed))}</b>-a kér újat. {n(N.detail) / n(N.revealed) < 0.3 ? "Az öregedés megnézése utáni első lépés a legnagyobb lehetőség." : "Az öregedés megnézése jól viszi tovább az embereket."}</> : <>Ebben az időszakban még senki nem nézte meg az öregedést.</>}</Lesson>
      <Kpi spark={series(d, "revealed")} kind="own" to="@next" tone="butter" className="s3" icon={P.spark} l="Megnézte 50 év múlva" v={fmt(N.revealed)} now={n(N.revealed)} prev={n(PV.revealed)} sub={`${pct(n(N.revealed), n(N.captured))} a bőrfotót feltöltőkből`} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.eye} l="Elmentette az előnézetet" v={fmt(N.detail)} now={n(N.detail)} prev={n(PV.detail)} sub={`${pct(n(N.detail), n(N.revealed))} az öregedés megnézése után`} />
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.refresh} l="Újat kért" v={fmt(N.more)} now={n(N.more)} prev={n(PV.more)} sub={`${pct(n(N.more), n(N.revealed))} az öregedés megnézése után`} />
      <Kpi kind="own" to="@next" tone="peach" className="s3" icon={P.pen} l="Kihagyta a bőrfotót" v={pct(n(N.skipped), decided)} now={decided ? n(N.skipped) / decided : 0} prev={n(PV.skipped) + n(PV.captured) ? n(PV.skipped) / (n(PV.skipped) + n(PV.captured)) : 0} invert sub={`${fmt(N.skipped)} / ${fmt(decided)} döntésből`} />


      <AfterRings d={d} />
      <Card className="s4" icon={P.pen} title="Honnan jön a minta" sub="Saját feltöltés, mintatár, MI-minta, fotóról kivágva vagy kihagyás."><Donut items={(d.capture || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} center={fmt((d.capture || []).reduce((s: number, r: D) => s + n(r.n), 0))} sub="minta" label={(k) => SIGN[k] || k} color={(k) => ({ drawn: SERIES[0], draw: SERIES[0], photo: SERIES[2], skipped: "var(--ser-o)" } as D)[k] || SERIES[6]} size={150} /></Card>
      <Card className="s4" icon={P.spark} title="Melyik stílust választják" sub="A bevezető kérdéseknél választott tetoválásstílus."><BarList items={((X.styles || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={styleName} empty="Még senki nem választott stílust." /></Card>
      {M && <Card className="s4" icon={P.pen} title="Melyik stílusban készült előnézet" sub="Az elkészült előnézetek tetoválásstílusonként, minden eszközről."><BarList items={((M.looks || []) as D[]).map((x) => ({ k: String(x.k), n: n(x.n) }))} fmtK={styleName} empty="Még nem készült előnézet." /></Card>}
      <StyleRank />
      {((X.variants || []) as D[]).length > 0 && <Card className="s4" icon={P.eye} title="Melyik változatot nyitják meg" sub="Az előnézet-oldalon választott változat."><BarList items={((X.variants || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} /></Card>}
      <Card className="s6" icon={P.share} title="Megosztás: forma" sub="Milyen formában osztanak meg. A mentés gomb nincs benne, az lent, a Mentés kártyákon látszik."><BarList items={byFmt.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => FMT[k] || k} empty="Még nincs megosztás." /></Card>
      <Card className="s6" icon={P.share} title="Megosztás: hol" sub="Megosztó link vagy meghívó (a PDF, a videó és a mentett kép letöltés: a „Letöltött fájlok” kártyán)."><BarList items={byEv.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => SHARE_EV[k] || k} empty="Még nincs megosztás." /></Card>
      <Card className="s8" icon={P.doc} title="Előnézetek" right={ub.ctl} sub={`Elkészült MI-előnézetek és a fiókokban eltárolt előnézetek ${periodWords(ub.p)}, minden eszközről, a saját fiókjaid nélkül. Csatornára vagy nyelvre szűrve nem bontható.`}>
        {U ? <><div className="mini-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}><div className="mini"><span>Elkészült előnézet</span><b>{fmt(U.n)}</b><small>előtte {fmt(U.prev)}{n(U.failed) ? ` · ${fmt(U.failed)} nem sikerült` : ""}</small></div><div className="mini"><span>Előnézetet készített fiók</span><b>{fmt(U.users)}</b></div><div className="mini"><span>Eltárolt előnézet</span><b>{fmt(U.saved)}</b></div><div className="mini"><span>Kedvenc</span><b>{fmt(U.favs)}</b></div></div>
        {(U.daily || []).length > 1 ? <TrendChart data={(U.daily as D[]).map((x) => ({ t: x.t, v: n(x.n) }))} label="Elkészült előnézet" height={150} /> : null}</> : ub.own && ub.q.e ? <LoadErr e={ub.q.e} retry={ub.q.load} busy={ub.q.busy} /> : ub.own && !ub.q.d ? <div className="skel" style={{ height: 150 }} aria-busy="true" /> : <Empty t="Szűrt nézetben nem bontható." />}
      </Card>
      {R && <Card className="s4" icon={P.refresh} title="Újrakérések („Nem lett jó?”)" sub={`Hányszor kértek új előnézetet a „Nem lett jó?” gombbal ${periodName(d)}, és milyen okot jelöltek (egy újrakérésnél több ok is lehet).`}>
        <div className="mini-stats" style={{ gridTemplateColumns: "1fr" }}><div className="mini"><span>Újrakérés</span><b>{fmt(R.n)}</b><small>előtte {fmt(R.prev)}</small></div></div>
        <BarList items={((R.why || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => REDO[k] || k} empty="Még senki nem kért újat." /></Card>}
      {((X.files || []) as D[]).length > 0 && <Card className="s4" icon={P.doc} title="Letöltött fájlok" sub="PDF a tetoválóművésznek, öregedés-videó, mentett kép, ápolási naptár."><BarList items={((X.files || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => FILES[k] || k} /></Card>}
      {RM && <Card className="s4" icon={P.clock} title="Emlékeztetők" sub={`Az app emlékeztetői ${periodName(d)}: hányat állítottak be, hány ment ki, hányat mondtak le, és hány vár még kiküldésre. A saját és a tesztfiókok nélkül.`}>
        {n(RM.set) + n(RM.sent) + n(RM.cancelled) + n(RM.waiting) ? <>
          <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}><div className="mini"><span>Beállítva</span><b>{fmt(RM.set)}</b></div><div className="mini"><span>Kiment</span><b>{fmt(RM.sent)}</b></div><div className="mini"><span>Lemondva</span><b>{fmt(RM.cancelled)}</b></div><div className="mini"><span>Vár</span><b>{fmt(RM.waiting)}</b></div></div>
          <BarList items={((RM.kinds || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} empty="" /></> : <Empty t="Még senki nem állított be emlékeztetőt." />}
      </Card>}
      <PhMore label="Ritkábban kell: régi és technikai számok">
      {((X.ai_reports || []) as D[]).length > 0 && <Card className="s4" icon={P.alert} title="MI-megjegyzés jelentve" sub="Hányszor jelentették az MI megjegyzését, a felület nyelve szerint."><BarList items={((X.ai_reports || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} /></Card>}
      <Card className="s4" icon={P.refresh} title="Újrakérés köre" sub="Hányadik körig kérnek újat."><BarList items={(d.more_rounds || []).map((x: D) => ({ k: x.k + ". kör", n: n(x.n) }))} empty="Még senki nem kért újat." /></Card>
      <Saves d={d} />
      </PhMore>
      <ProductGaps />
    </div>
  );
}


/* ---------- what they did with it, in rings: each a real share of the visits that looked at 50 years; a step not sent yet says so instead of 0 ---------- */
function AfterRings({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: F, e, load, busy } = useRpc("admin_funnel", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  const N: D = (F as D)?.now || {}, base = n(N.any_revealed);
  const list: [string, string, RingKind][] = [["after_saved", "Mentés", "solid"], ["after_shared", "Megosztás", "tick"], ["after_mailed", "E-mail", "dots"]];
  return <section className="c s12 ix-back"><h2 className="ink-h">Mentés, megosztás, e-mail<Info>Az öregedést 50 év múlva megnéző látogatások közül (a kihagyókkal együtt), {periodName(d)}. Egy látogatás több gyűrűben is számíthat. Ahol egy lépésről még nem jön mérés, ott „nem mérhető” áll, nem 0.</Info></h2>
    {e && !F ? <LoadErr e={e} retry={load} busy={busy} /> : !F ? <div className="skel" style={{ height: 180 }} /> : <div className="ix-rings">{list.map(([k, l, kind]) => { const on = N[k] != null && base > 0; return <div key={k}><Ring p={on ? n(N[k]) / base : 0} kind={kind} label={`${l}: ${on ? pct(n(N[k]), base) : "nem mérhető"}`}><b>{on ? pct(n(N[k]), base) : "–"}</b></Ring><strong>{l}</strong><small>{on ? `${fmt(N[k])} / ${fmt(base)} látogatás` : "Nem mérhető"}</small></div>; })}</div>}
  </section>;
}

/* ---------- saves: does the picture reach the phone ---------- */
const HOW: Record<string, string> = { gallery: "Galériába mentve", download: "Letöltve (fájl)", share: "Telefon megosztó menüje", native: "Appban mentve", hold: "Beépített böngésző: hosszan nyomva", cancel: "Megszakította", fail: "Hiba", empty: "Üres kép (hiba)" };
const VIA: Record<string, string> = { ba: "Előtte–utána kártya", score: "Előnézet-kártya", reveal: "50 év múlva nézet", celebrate: "Záró képernyő", detail: "Előnézet alatt", share_tab: "Megosztás fül", png: "Kép" };
function Saves({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: X, e, load, busy } = useRpc("admin_saves", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  const L = (a: unknown) => ((a || []) as D[]).map((x) => ({ k: String(x.k), n: n(x.n) }));
  if (e && !X) return <Card className="s12" icon={P.doc} title="Mentés"><LoadErr e={e} retry={load} busy={busy} /></Card>;
  return (
    <>
      <Card className="s6" icon={P.doc} title="Mentés: hova jutott" sub={X ? `${fmt(n(X.landed))} látogatásban jutott el a kép a telefonig / gépig, ${fmt(n(X.sessions))} próbálkozásból.` : "Betöltés…"}><BarList items={L(X?.how)} fmtK={(k) => HOW[k] || k} empty="Még nincs mentés." /></Card>
      <Card className="s6" icon={P.share} title="Mentés: melyik gombról" sub="Melyik képernyőn nyomták meg a mentést."><BarList items={L(X?.via)} fmtK={(k) => VIA[k] || k} empty="Még nincs mentés." /></Card>
    </>
  );
}

/* ---------- what-if calculator (shown on the Célok page, which imports it from here) ---------- */
export function WhatIf({ d }: { d: D }) {
  const N = d.now || {}, A = d.all || {};
  const days0 = Math.max(1, Math.min(n(d.days), (Date.now() - new Date(d.first_event || Date.now()).getTime()) / 864e5 || 1));
  /* the goal is counted in users (accounts), or in previews: the share that gets there and the start differ */
  const [goalK, setGoalK] = useState<"scored" | "users">("users");
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
        <div className="adm-seg sm" role="group" aria-label="Mit számoljon"><button aria-pressed={goalK === "users"} onClick={() => setGoalK("users")}>Felhasználó (fiók)</button><button aria-pressed={goalK === "scored"} onClick={() => setGoalK("scored")}>Előnézet</button></div>
        {sl(goalK === "users" ? "Regisztrál" : "Előnézetig jut", c, setC, goalK === "users" ? 0.1 : 1, 60, goalK === "users" ? 0.1 : 0.5, "%", baseConv)}
        {sl("Heti növekedés", g, setG, 0, 30, 1, "%", 0)}
        {goalK === "users" && <small className="note">A regisztrációban az iPhone is benne van, a látogatásban nem, ezért a mostani arány magasabbnak látszik a valósnál.</small>}
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
  return <><FeatureGaps open={setOpen} />{open && <UserDrawer id={open} close={() => setOpen(null)} openOther={setOpen} />}</>;
}
