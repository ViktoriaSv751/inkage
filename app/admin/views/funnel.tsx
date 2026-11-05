"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, Funnel, Info, fmt, pct } from "../charts";
import { Radar, StepBars } from "../visuals";
import { CTAK, Card, EV, Kpi, Layer, Loading, P, QSTEP, QVAL, SCR, ch, cleanAns, lang, n, periodName, periodWords, rpc, secs, type D, useBlockRpc, useFlt, usePeriod, useRpc , series } from "../shared";
import { ChgP, TRows, Top, breakNote, per } from "./traffic";
import { StoryFull, type SC } from "./report";
import { Hero, Trio } from "../ink";
import { CloseX, usePhone } from "../phone";
import { LoadErr, PageErr, PhMore, authWhy } from "./people";
import { stepName } from "./users";
/* InkAge takes no payments yet: the payment slider below always says so */
const paymentsOn = (_native: boolean) => false;

/* the steps of the strict funnel: each counts the visits that reached every step before it */
const STEP: Record<string, [string, string]> = {
  sessions: ["Látogatás", "minden munkamenet"], engaged: ["Aktív látogatás", "legalább két esemény, vagy ismert forrás"], app: ["Megnyitotta az appot", "/app betöltve"], named: ["Elkezdte", "fotóválasztó megnyitva"],
  captured: ["Feltöltött egy bőrfotót", "kihagyás nélkül"], scored: ["Megkapta az előnézetet", "a fő élmény"], quiz: ["Bevezető kérdések", "cél, stílus, testrész"],
  revealed: ["Megnézte 50 év múlva", "az öregedés"], detail: ["Elmentette az előnézetet", "a galériába"], shared: ["Megosztott", "az öregedés után: megosztó link vagy meghívó; a mentés nélkül"],
};
const ORDER = ["engaged", "app", "named", "captured", "scored", "quiz", "revealed"];
/* an active visit where the database gives it; the plain count until it arrives */
const vOf = (o: D, k: string) => (k === "engaged" ? n(o.engaged) || n(o.sessions) : n(o[k]));
/* what one more step through brings, said in the unit of the step it ends in */
const UNIT: Record<string, string> = { scored: "előnézet", revealed: "öregedés-megnézés", detail: "mentett előnézet", shared: "megosztás" };
/* answers the shared list does not name, and the gender / profession questions that send no value */
const QV: Record<string, string> = { ...QVAL };

/* ---------- funnel ---------- */
export function FunnelTab({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: F, e, load, busy } = useRpc("admin_funnel", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  /* "A tölcsér" with a period of its own (the page's while it says "Mint fölül") */
  const fb = useBlockRpc("admin_funnel", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  if (e && !F) return <PageErr e={e} retry={load} busy={busy} />;
  if (!F) return <Loading />;
  const N: D = F.now || {}, PV: D = F.prev || {};
  const val = (k: string) => vOf(N, k);
  /* the worst step, the first one (opening the app) included */
  const { k: worstK, r: worstR } = worstOf(val);
  /* the gain of ten more points there, in what the chain then gives: previews up to the preview step, aging views or saves after it */
  const end = ORDER.indexOf(worstK) <= ORDER.indexOf("scored") ? "scored" : ORDER.indexOf(worstK) <= ORDER.indexOf("revealed") ? "revealed" : worstK;
  const gain = worstK ? Math.round(val(end) * (Math.min(1, worstR + 0.1) / Math.max(0.01, worstR) - 1)) : 0;
  const steps = [...ORDER, "detail", "shared"].map((k, i) => ({ k, l: STEP[k][0], sub: STEP[k][1], n: val(k), prev: i ? val(k === "shared" || k === "detail" ? "revealed" : ORDER[i - 1]) : undefined }));
  const rate = (o: D) => (vOf(o, "engaged") ? (n(o.scored) / vOf(o, "engaged")) * 100 : 0);
  const doors = n(N.doors), acc: D = F.accounts || {}, dur: D = F.duration || {}, brk = breakNote(d);
  /* what comes after looking at 50 years, each counted among all who did (the order is not fixed, so it is no chain) */
  const after = [{ k: "any_revealed", l: "Megnézte 50 év múlva", sub: "a kihagyókkal együtt", n: val("any_revealed") }, { k: "after_celeb", l: "Új előnézetet kapott", n: val("after_celeb") },
    { k: "after_picks", l: "Választott a változatok közül", n: val("after_picks") }, { k: "after_fav", l: "Kedvencet jelölt", n: val("after_fav") }, { k: "after_celebrated", l: "Elért a záró képernyőig", n: val("after_celebrated") },
    { k: "after_detail", l: "Elmentette az előnézetet", sub: "a galériába", n: val("after_detail") }, { k: "after_saved", l: "Képet mentett", sub: "fájl vagy kép", n: val("after_saved") },
    { k: "after_mailed", l: "E-mailben kérte", n: val("after_mailed") }, { k: "after_shared", l: "Megosztotta", sub: "megosztó link, videó, meghívó", n: val("after_shared") }];
  const quiz: Record<string, { k: string; n: number }[]> = {};
  ((F.quiz || []) as D[]).forEach((q) => { (quiz[q.step] ||= []).push({ k: q.v || "", n: n(q.n) }); });
  /* the website alone: the Android app opens on /start and would count here. Before the database gives them, the old mixed numbers */
  const hasWeb = N.web_land != null, webBase = hasWeb ? val("web_land_engaged") : val("land"), webApp = hasWeb ? val("web_land_app") : val("land_app");
  const web = [{ k: "land", l: "Weboldalt látta", sub: "aktív látogatás, Android-app nélkül", n: webBase }, { k: "cta", l: "Gombra kattintott", sub: "főoldal, /start, útmutató, cikk", n: hasWeb ? val("web_cta") : val("cta"), prev: webBase },
    { k: "land_app", l: "Megnyitotta az appot", sub: "a weboldalról", n: webApp, prev: webBase }, { k: "web_signup", l: "Regisztrált", sub: "a látogatás saját jelzése szerint", n: val("web_signup"), prev: webBase }];
  return (
    <div className="g ix">
      <Top pc><Hero flip label={<>Látogatásból előnézet {periodName(d)}<Info><b>{fmt(val("scored"))}</b> látogatás jutott el az előnézetig <b>{fmt(val("engaged"))}</b> aktív látogatásból (előtte {fmt(rate(PV), 1)}%). {doors ? <>Nincs benne <b>{fmt(doors)}</b> egyetlen megnyitás forrás nélkül (főoldal, /start, belépés), ezek lehetnek emberek és gépek is; velük együtt {fmt(val("sessions"))} látogatás. </> : null}Minden lépés csak azokat számolja, akik az összes előzőn is átmentek, ezért egyik sem lehet 100% fölött. {worstK ? <>A legnagyobb kiesés: <b>{STEP[worstK][0].toLowerCase()}</b> előtt ({fmt((1 - worstR) * 100)}% esik ki).</> : null} Az iPhone-app nincs benne, mert nem küld adatot. {brk}</Info></>} v={rate(N)} d={1} unit="%"
        chg={d.prev_partial ? undefined : <ChgP a={rate(N)} b={rate(PV)} tail={`előtte ${fmt(rate(PV), 1)}%`} />}
        side={<Trio items={[{ l: "aktív látogatás", v: fmt(val("engaged")) }, { l: "előnézet", v: fmt(val("scored")) }, { l: "50 év múlva", v: fmt(val("any_revealed")) }]} />} /></Top>
      <BandFunnel d={d} val={val} fb={fb} />
      {worstK && <WorstCard d={d} k={worstK} lost={val(ORDER[ORDER.indexOf(worstK) - 1]) - val(worstK)} base={val(ORDER[ORDER.indexOf(worstK) - 1])} gain={<>Ha itt 10 ponttal többen maradnak, {periodName(d)} kb. <b>{fmt(gain)}</b> {UNIT[end] || "lépéssel"} több lett volna.</>} />}
      <RegisterStuck d={d} />
      <PhoneExtras d={d} val={val} accounts={n(acc.n)} />
      <Kpi spark={series(d, "app")} kind="own" to="@next" tone="peach" className="s3 ph-hide" icon={P.bolt} l="Megnyitotta az appot" v={fmt(val("app"))} now={val("app")} prev={n(PV.app)} sub={`${pct(val("app"), val("engaged"))} az aktív látogatásokból`} />
      <Kpi spark={series(d, "scored")} kind="own" to="@next" tone="butter" className="s3 ph-hide" icon={P.target} l="Előnézet" v={fmt(val("scored"))} now={val("scored")} prev={n(PV.scored)} sub={`${pct(val("scored"), val("app"))} az appot nyitókból`} />
      <Kpi spark={series(d, "revealed")} kind="own" to="@next" tone="pink" className="s3 ph-hide" icon={P.spark} l="Megnézte 50 év múlva" v={fmt(val("any_revealed"))} now={val("any_revealed")} prev={n(PV.any_revealed)} sub={`látogatás, nem előnézetszám · a kihagyókkal együtt · ${fmt(val("revealed"))} kihagyás nélkül`} />
      <Kpi spark={series(d, "shared")} kind="own" to="@next" tone="sky" className="s3 ph-hide" icon={P.share} l="Megosztott" v={fmt(val("any_shared"))} now={val("any_shared")} prev={PV.any_shared == null ? undefined : n(PV.any_shared)} sub={`${pct(val("any_shared"), val("any_revealed"))} az öregedés megnézése után · ${fmt(val("shared"))} kihagyás nélkül · ${fmt(N.any_saved)} látogatás mentett, az nem megosztás`} />
      <Card className="s6 ph-hide" icon={P.target} title="A tölcsér alakja" sub="Minden tengely: a lépés hány %-ban megy tovább az előzőből. Ahol a forma behorpad, ott esnek ki a legtöbben.">
        <Radar axes={ORDER.slice(1).map((k, i) => ({ l: STEP[k][0].replace("Megnyitotta az appot", "App megnyitva").replace("Megkapta az előnézetet", "Előnézet").replace("Megnézte 50 év múlva", "50 év múlva").replace("Elmentette az előnézetet", "Mentés").replace("Feltöltött egy bőrfotót", "Bőrfotó").replace("Bevezető kérdések", "Kérdések").replace("Elkezdte", "Kezdés"), v: val(ORDER[i]) ? Math.round((val(k) / val(ORDER[i])) * 100) : 0 }))} />
      </Card>
      <Card className="s6 ph-hide" icon={P.layers} title="Hányan jutnak el idáig" sub="Az aktív látogatások hány %-a ér el az egyes lépésekig.">
        <StepBars steps={ORDER.slice(1).map((k) => ({ l: STEP[k][0], n: val(k), base: val("engaged") }))} />
      </Card>
      <Card className="s12 ph-hide" icon={P.funnel} title="A teljes út, lépésről lépésre" sub={`Munkamenetek ${periodName(d)}. Minden sor: hányan jutottak el idáig (az összes előző lépésen át), és az előző lépéshez képest hány % esett ki. A megosztás az öregedés megnézése után.`}
        foot={<span>Egy munkamenet = egy böngészőfül egy látogatása. Az iPhone-app nem küld adatot.</span>}>
        <Funnel steps={steps} worst={worstK} />
      </Card>
      <Card className="s12" icon={P.spark} title="Az öregedés megnézése után" sub={`A mai folyamat vége, ${periodName(d)}. Mindegyik sor azok közül számol, akik megnézték a tetoválásukat 50 év múlva (a kihagyókkal együtt), és a sorrend nem kötött, ezért ez nem lánc. Egy lépés csak a mérése indulása óta látszik.`}
        foot={<span>Új fiók ebben az időszakban: <b>{fmt(acc.n)}</b><Info>{fmt(acc.sure)}-ról tudjuk, honnan jött, {fmt(acc.good)} valószínű, {fmt(n(acc.weak) + n(acc.none))}-ról nem tudjuk. A regisztráció a látogatásoknál többnyire az app előtt történik, és csak a weboldal küldi: {fmt(N.any_signup)} látogatás jelezte. Az Android- és iPhone-app nem küldi.</Info></span>}>
        {N.any_revealed != null && N.after_picks != null ? <Funnel steps={after} accentK="after_saved" /> : <div className="skel" style={{ height: 160 }} />}
      </Card>
      <Card className="s6" icon={P.pen} title="Akik kihagyták a bőrfotót" sub="Saját bőrfotó nélkül is tovább lehet menni a bevezető kérdésekhez és az öregedéshez: ez az ág.">
        <Funnel steps={[{ k: "skipped", l: "Kihagyta a bőrfotót", n: val("skipped") }, { k: "skip_quiz", l: "Bevezető kérdések", n: val("skip_quiz"), prev: val("skipped") }, { k: "skip_revealed", l: "Megnézte 50 év múlva", n: val("skip_revealed"), prev: val("skip_quiz") }]} accentK="skip_revealed" />
      </Card>
      <Card className="s6" icon={P.doc} title="A weboldalon át érkezők" sub={hasWeb ? `Csak a weboldal: az Android-app ${fmt(N.android_sessions)} látogatása nincs benne (ebből ${fmt(N.android_land_app)} a saját /start oldalán át nyitotta meg az appot). Egyenesen az appba a weboldalon ${fmt(val("web_direct_app"))} látogatás jött. Az első oldal bármelyik lehet: főoldal, /start, tudástár, cikk.` : `Akik láttak weboldalt (főoldal, /start, tudástár, cikkek). Egyenesen az appba ${fmt(val("direct_app"))} látogatás jött.`}>
        <Funnel steps={web} accentK="land_app" />
        {F.ctas ? <><div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}><MiniN l="Regisztrálni indult (bármelyik gomb)" v={n(F.cta_register_intent)} /><MiniN l="Egyéb (belépés, kipróbálás)" v={val("web_cta") - n(F.cta_register_intent)} /></div>
          <BarList items={(F.ctas as D[]).map((r) => ({ k: r.k, n: n(r.n) }))} fmtK={(k) => CTAK[k] || k} max={9} /></> : null}
      </Card>
      <Kpi kind="own" to="@next" tone="peach" className="s3" icon={P.clock} l="Megnyitástól az előnézetig" v={secs(d.time_to_score?.median_sec)} sub={<span>medián, {fmt(d.time_to_score?.n)} látogatás</span>} />
      <Kpi kind="own" to="@next" tone="butter" className="s3" icon={P.clock} l="Megnyitástól az 50 év múlváig" v={secs(d.time_to_reveal?.median_sec)} sub={<span>medián, {fmt(d.time_to_reveal?.n)} látogatás</span>} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.eye} l="Látogatás hossza" v={secs(dur.median ?? d.session_len?.median_sec)} sub={<span>{dur.n != null ? <>{fmt(dur.n)} látogatásra a {fmt(dur.all)}-ból, az 5 percnél hosszabb szünet nélkül · </> : null}75%-uk {secs(dur.p75 ?? d.session_len?.p75_sec)} alatt</span>} />
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.target} l="Végig a bevezető kérdéseken" v={pct(val("revealed"), val("quiz"))} now={val("quiz") ? val("revealed") / val("quiz") : 0} prev={n(PV.quiz) ? n(PV.revealed) / n(PV.quiz) : 0} sub="a bevezető kérdéseket elkezdők közül" />

      <PhMore label="Hétről hétre, két csoport összevetése"><FunnelWeeks d={d} /></PhMore>
      <Card className="s12" icon={P.arrow} title="Hová lettek, akik kiestek" sub={`Akik egy lépésnél megálltak: mi volt az utolsó dolog, amit csináltak, és mennyi ideig voltak ott (${periodName(d)}, legfeljebb 365 nap; a csatorna- és nyelvszűrő itt is hat). Kattints egy sorra: a mögötte lévő látogatások.`}><Dropouts days={d.days} /></Card>
      <Card className="s6" icon={P.arrow} title="Hol lépnek vissza" sub="Visszalépések lépésenként: itt bizonytalanok."><BarList items={(d.backs || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} fmtK={(k) => QSTEP[k] || k} empty="Senki nem lépett vissza." /></Card>
      <Card className="s6" icon={P.layers} title="Bevezető kérdések válaszai" sub="Mit választanak az egyes kérdéseknél (cél, stílus, testrész; a testrésznél a testtérkép koordinátái nélkül, csak a szöveg): látogatásonként a legutolsó válasz, tehát aki visszalépett és újra válaszolt, egynek számít. Ahol a kérdés értéket nem küld (pl. nem, foglalkozás), ott a válaszadók száma látszik; a több választásosaknál minden választás külön számít.">
        {Object.keys(quiz).length ? (
          <div className="g">{Object.entries(quiz).map(([k, v]) => { const vals = v.filter((x) => x.k), blank = v.filter((x) => !x.k).reduce((s, x) => s + x.n, 0);
            return <div key={k} className="mini s6" style={{ gap: 12, padding: 14 }}><h3>{QSTEP[k] || k}</h3>{vals.length ? <BarList items={vals.sort((a, b) => b.n - a.n)} fmtK={(x) => QV[x] || cleanAns(x)} max={5} /> : null}{blank ? <span className="note">{fmt(blank)} válaszadó {vals.length ? "érték nélkül" : "(a kérdés nem küld értéket)"}</span> : null}</div>; })}</div>
        ) : <Empty t="Még nincs válasz a bevezető kérdésekre." />}
      </Card>
    </div>
  );
}

/* ---------- the funnel itself: white bands narrowing down the screen, the biggest loss a striped gap with a big number; a tap shows who fell out there ---------- */
/* the same step, said of those who did not get there */
const NOT_DONE: Record<string, string> = { app: "nem nyitotta meg az appot", named: "nem nyitotta meg a fotóválasztót", captured: "nem töltött fel bőrfotót", scored: "nem kapta meg az előnézetet", quiz: "nem kezdte el a bevezető kérdéseket", revealed: "nem nézte meg 50 év múlva" };
const LOST_AT: Record<string, string> = { app: "web", named: "app", captured: "named", scored: "captured", quiz: "scored", revealed: "scored" };
/* the worst step, the first one (opening the app) included */
function worstOf(val: (k: string) => number) {
  let k = "", r = 2;
  ORDER.forEach((x, i) => { if (!i) return; const a = val(ORDER[i - 1]), b = val(x); if (a >= 5 && b / a < r) { r = b / a; k = x; } });
  return { k, r };
}
/* the biggest loss on the inverted card: where, how many, what ten points would bring, and the visits behind it */
function WorstCard({ d, k, lost, base, gain }: { d: D; k: string; lost: number; base: number; gain: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className="s12 ink-flip ix-loss">
    <span className="ix-loss-l">Hol veszítünk a legtöbbet</span>
    <b className="ix-loss-n">−{fmt(lost)}</b>
    <p><b>{pct(lost, base)}</b> {NOT_DONE[k] || `nem jutott el idáig: ${STEP[k][0].toLowerCase()}`}. {gain}</p>
    <button type="button" className="adm-ibtn gold" onClick={() => setOpen(true)}>Kik estek ki</button>
    {open && <DropSessions days={Math.min(365, n(d.days) || 30)} at={LOST_AT[k]} close={() => setOpen(false)} />}
  </section>;
}
/* web or Android: the database splits only these three figures by platform (admin_traffic), the other steps only as a whole */
const PF_L: Record<string, string> = { all: "Összes", web: "Web", android: "Android" };
function BandFunnel({ d, val, fb }: { d: D; val: (k: string) => number; fb: ReturnType<typeof useBlockRpc> }) {
  const [open, setOpen] = useState<string | null>(null); const [pf, setPf] = useState<"all" | "web" | "android">("all"); const [steps, setSteps] = useState(false);
  const { f } = useFlt();
  const tq = useRpc("admin_traffic", { ...(fb.own ? fb.args : per(d)), p_ch: f.ch || null, p_lang: f.lang || null }, [fb.own, fb.args.p_days, fb.args.p_from, fb.args.p_to, d.days, d.from, f.ch, f.lang], pf === "all");
  const pr: D | undefined = ((tq.d as D)?.platforms || []).find((x: D) => x.k === pf);
  /* "A tölcsér" can have a period of its own: then the bands and the worst step are that period's, and the visits behind a loss (page period) stay closed */
  const own: D = fb.own ? ((fb.q.d as D)?.now || {}) : {};
  const v = (k: string) => (fb.own ? vOf(own, k) : val(k));
  const seq: { k: string; l: string; x: number }[] = pf === "all" ? ORDER.map((k) => ({ k, l: STEP[k][0], x: v(k) })) : [{ k: "sessions", l: "Látogatás", x: n(pr?.n) }, { k: "app", l: STEP.app[0], x: n(pr?.app) }, { k: "scored", l: STEP.scored[0], x: n(pr?.scored) }];
  const at = new Map(seq.map((s) => [s.k, s.x])), base = Math.max(1, seq[0].x), wd = (k: string) => Math.max(4, (n(at.get(k)) / base) * 100);
  let worst = "", wr = 2; seq.forEach((s, i) => { if (!i) return; const a = seq[i - 1].x; if (a >= 5 && s.x / a < wr) { wr = s.x / a; worst = s.k; } });
  const cards: SC[] = seq.map((s, i) => { const a = i ? seq[i - 1].x : 0, lost = a - s.x; return { k: s.k, l: s.l, v: s.x, flip: s.k === worst, chg: s.k === worst ? <span className="ink-chg up">a legnagyobb kiesés</span> : undefined, sub: i ? `${pct(s.x, a)} az előző lépésből${lost > 0 ? ` · −${fmt(lost)}` : ""}` : "innen indul a tölcsér" }; });
  const busy = (fb.own && !fb.q.d) || (pf !== "all" && !tq.d);
  return (
    <Card eager className="s12" icon={P.funnel} title="A tölcsér" right={<>{fb.ctl}<button type="button" className="adm-ibtn sm" disabled={busy} onClick={() => setSteps(true)}>Lépésenként</button></>} sub={`Minden sáv egy lépés, a szélessége: hány % jutott el idáig (${periodWords(fb.p)}). Minden sor csak azokat számolja, akik az összes előző lépésen is átmentek. Az iPhone-app nem küld adatot. Csíkozva: ahol a legtöbben kiesnek.${!fb.own && pf === "all" ? " Érintsd meg a rést: kik estek ki ott." : ""}`}>
      <div className="adm-seg sm ix-pf" role="group" aria-label="Platform">{(["all", "web", "android"] as const).map((k) => <button key={k} type="button" aria-pressed={pf === k} onClick={() => setPf(k)}>{PF_L[k]}</button>)}</div>
      {pf !== "all" && <p className="ix-honest">Platformonként csak ez a három szám van meg, a többi lépés csak összesítve. Itt minden látogatásból indul, az Összes az aktív látogatásból, ezért az arányok a kettő közt nem hasonlíthatók össze. iPhone-adat nincs.</p>}
      {busy ? <div className="skel" style={{ height: 320 }} /> : pf !== "all" && !pr ? <Empty t={`Ebben az időszakban nincs ${PF_L[pf]}-látogatás.`} /> : <ol className="ix-fn">{seq.map(({ k, l, x }, i) => { const pv = i ? seq[i - 1].x : 0, lost = i ? pv - x : 0, isW = k === worst, w = wd(k), wp = i ? wd(seq[i - 1].k) : w;
        const gap = <><i style={{ clipPath: `polygon(${50 - wp / 2}% 0,${50 + wp / 2}% 0,${50 + w / 2}% 100%,${50 - w / 2}% 100%)` }} />{lost > 0 && (isW ? <span className="big"><b>−{fmt(lost)}</b><small>{pct(lost, pv)} esik ki · a legnagyobb kiesés</small></span> : <span>−{fmt(lost)} · {pct(lost, pv)}</span>)}</>;
        return <li key={k}>
          {i > 0 && (lost > 0 && !fb.own && pf === "all" ? <button type="button" className={"ix-gap" + (isW ? " worst" : "")} aria-label={`Kik estek ki itt: ${l}`} onClick={() => setOpen(k)}>{gap}</button> : <div className={"ix-gap" + (isW ? " worst" : "")}>{gap}</div>)}
          <div className="ix-band"><span><small>{l}</small><b>{fmt(x)}</b></span><i style={{ width: w + "%" }} /></div>
        </li>; })}</ol>}
      {open && <DropSessions days={Math.min(365, n(d.days) || 30)} at={LOST_AT[open]} close={() => setOpen(null)} />}
      {steps && <StoryFull cards={cards} when={`A tölcsér · ${PF_L[pf]} · ${periodWords(fb.p)}`} close={() => setSteps(false)} />}
    </Card>
  );
}

/* ---------- the phone: experiments and a calculation ---------- */
const EM: Record<string, string> = { scored: "Előnézet", sessions: "Látogatás", signups: "Regisztráció", shared: "Megosztás", app: "Appmegnyitás", revealed: "50 év múlva", gsc_clicks: "Google-kattintás", gsc_impressions: "Google-megjelenés", downloads: "Letöltés" };
/* the sign-up page as a loss point: reached it, and left without an account */
function RegisterStuck({ d }: { d: D }) {
  const { f } = useFlt();
  const q = useRpc("admin_register_stuck", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  const x: D = (q.d as D) || {};
  if (q.e && !q.d) return <Card className="s12" icon={P.user} title="Elakadtak a regisztrációs oldalon"><LoadErr e={q.e} retry={q.load} busy={q.busy} /></Card>;
  if (q.d && !n(x.visits)) return <Card className="s12" icon={P.user} title="Elakadtak a regisztrációs oldalon" noData="Ebben az időszakban senki nem járt a regisztrációs oldalon."><Empty t="Ebben az időszakban senki nem járt a regisztrációs oldalon." /></Card>;
  return (
    <Card className="s12" icon={P.user} title="Elakadtak a regisztrációs oldalon" sub="Akik eljutottak a regisztrációs oldalra, de fiók nélkül mentek el. Ha valaki másik böngészőben fejezi be (pl. a TikTok beépített böngészőjéből átlép), az itt kiesőnek látszik.">
      {!q.d ? <div className="skel" style={{ height: 90 }} /> : <>
        <div className="ix-stuck"><b>{fmt(x.left)}<small> / {fmt(x.visits)}</small></b><span>látogatás ment el fiók nélkül ({pct(n(x.left), n(x.visits))}){x.median_secs != null ? <>, középen {secs(x.median_secs)} után</> : null}</span></div>
        <div className="ix-quad"><div><b>{fmt(x.no_try)}</b><small>Hozzá sem nyúlt</small></div><div><b>{fmt(x.tried)}</b><small>Próbálta, de nem lett fiók</small></div><div><b>{fmt(x.err)}</b><small>Hibát kapott</small></div><div><b>{fmt(x.inapp)}</b><small>Beépített böngészőben volt</small></div></div>
        {(x.whys || []).length > 0 && <p className="note">Hibák: {(x.whys as D[]).map((y) => `${authWhy(y.k)} (${fmt(y.n)})`).join(", ")}.</p>}
      </>}
    </Card>
  );
}

function PhoneExtras({ d, val, accounts }: { d: D; val: (k: string) => number; accounts: number }) {
  const phone = usePhone();
  if (!phone) return null;
  return <><Experiments /><GrowthCalc d={d} val={val} accounts={accounts} /></>;
}
function Experiments() {
  const q = useRpc("admin_experiments_list", undefined, []);
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  const none = "Még nincs kísérlet. A Célok oldalon indíthatsz egyet.";
  return (
    <Card className="s12" icon={P.target} title="Kísérletek" sub="Egy változtatás előtte és utána, ugyanazokon a hétnapokon. Ez nem két párhuzamos változat: közben más is változhatott." noData={q.d && !rows.length ? none : undefined}>
      <ul className="pp-exp">{rows.slice(0, 5).map((r) => { const g = n(r.gone), b = n(r.v_before_dow), a = n(r.v_after), few = b + a < 30, c = b ? ((a - b) / b) * 100 : null; return (
        <li key={r.id}><b>{r.title}</b><small>{EM[r.metric] || "Mért szám"}{r.done ? " · lezárult" : ` · ${fmt(g)} / ${fmt(r.days)} nap`}</small>
          {g < 1 ? <span className="mut">holnaptól látszik</span> : <div className="pp-exp-n"><span><small>Előtte</small><b>{fmt(b)}</b></span><span><small>Utána</small><b>{fmt(a)}</b></span>{few ? <span className="chip warn">még kevés adat</span> : c == null ? <span className="mut">előtte nem volt adat</span> : <span className={"chip " + (c >= 0 ? "good" : "warn")}>{c >= 0 ? "+" : ""}{fmt(c)}%</span>}</div>}</li>); })}</ul>
    </Card>
  );
}
function GrowthCalc({ d, val, accounts }: { d: D; val: (k: string) => number; accounts: number }) {
  const days = Math.max(1, Math.min(n(d.days) || 30, (Date.now() - new Date(d.first_event || Date.now()).getTime()) / 864e5 || 1));
  const act = useRpc("admin_activation", per(d), [d.days, d.from]);
  const A: D = (act.d as D) || {};
  const bV = Math.max(1, Math.round(val("engaged") / days)), bS = val("engaged") ? Math.max(0.1, Math.round((accounts / val("engaged")) * 1000) / 10) : 1, bM = n(A.accounts) ? Math.round((n(A.activated) / n(A.accounts)) * 100) : 60;
  const [v, setV] = useState<number | null>(null), [s, setS] = useState<number | null>(null), [m, setM] = useState<number | null>(null), [p, setP] = useState(3);
  const V = v ?? bV, S = s ?? bS, M = m ?? bM;
  const accs = (V * S) / 100, made = (accs * M) / 100, pays = (made * p) / 100, on = paymentsOn(false) || paymentsOn(true);
  const sl = (l: string, x: number, set: (y: number) => void, min: number, max: number, step: number, unit: string, note: string) => <label className="wi-s"><span>{l}<b>{fmt(x, step < 1 ? 1 : 0)}{unit}</b></span><input type="range" min={min} max={max} step={step} value={x} onChange={(e) => set(Number(e.target.value))} /><small>{note}</small></label>;
  return (
    <Card className="s12" icon={P.bolt} title="Mi lenne, ha" sub="Számítás, nem előrejelzés: a csúszkák szorzata. A regisztrációban az iPhone is benne van, a látogatásban nem, ezért a mostani arány magasabbnak látszik a valósnál. A fizetési arány feltevés.">
      <div className="pp-wi">
        {sl("Aktív látogatás naponta", V, setV, 1, Math.max(500, bV * 20), 1, "", `most: ${fmt(bV)}`)}
        {sl("Ebből regisztrál", S, setS, 0.1, 60, 0.1, "%", `most: ${fmt(bS, 1)}%`)}
        {sl("A fiókokból előnézetet készít", M, setM, 1, 100, 1, "%", n(A.accounts) ? `most: ${fmt(bM)}%` : "most: nincs adat, ez csak kiinduló érték")}
        {sl("Az előnézetet készítőkből fizet", p, setP, 0.5, 30, 0.5, "%", on ? "feltevés, a mostani arányt a Fizetők listája adja" : "feltevés: most nincs mért adat, a fizetés nincs bekapcsolva")}
      </div>
      <div className="pp-wi-o"><div><b>{fmt(accs, accs < 10 ? 1 : 0)}</b><small>új fiók naponta</small></div><div><b>{fmt(made, made < 10 ? 1 : 0)}</b><small>előnézetet készít</small></div><div className={pays >= 10 ? "ok" : ""}><b>{fmt(pays, pays < 10 ? 1 : 0)}</b><small>fizető naponta (cél: 10–50)</small></div></div>
    </Card>
  );
}

const MiniN = ({ l, v }: { l: string; v: number }) => <div className="mini"><span>{l}</span><b>{fmt(v)}</b></div>;

/* ---------- the funnel week by week, and two segments side by side ---------- */
const STEPS: [string, string][] = [["app", "App"], ["named", "Kezdés"], ["captured", "Bőrfotó"], ["scored", "Előnézet"], ["quiz", "Kérdések"], ["revealed", "50 év múlva"], ["shared", "Megosztás"]];
/* is the difference between two rates real, or chance (two-proportion z-test, 95 %) */
const zTest = (a: number, na: number, b: number, nb: number) => { if (na < 20 || nb < 20) return null; const p = (a + b) / (na + nb), se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb)); return se ? Math.abs(b / nb - a / na) / se : null; };
function FunnelWeeks({ d }: { d: D }) {
  /* whole weeks, 4 at least: at 24 óra, 3 or 7 nap one calendar week would say little (and used to look like the period) */
  const weeks = Math.max(4, Math.min(52, Math.ceil(n(d.days) / 7) || 12));
  const { f: gf } = useFlt();
  const [a, setA] = useState({ ch: "", lang: "" }); const [b, setB] = useState({ ch: "tiktok", lang: "" });
  const all = useRpc("admin_funnel_weeks", { p_weeks: weeks, p_ch: gf.ch || null, p_lang: gf.lang || null }, [weeks, gf.ch, gf.lang]);
  const sa = useRpc("admin_funnel_weeks", { p_weeks: weeks, p_ch: a.ch || null, p_lang: a.lang || null }, [weeks, a.ch, a.lang]);
  const sbb = useRpc("admin_funnel_weeks", { p_weeks: weeks, p_ch: b.ch || null, p_lang: b.lang || null }, [weeks, b.ch, b.lang]);
  const chans = ((d.channels || []) as D[]).map((c) => c.k) as string[], langs = ((d.langs || []) as D[]).map((x) => x.k).filter((k: string) => k && k !== "?");
  const rows: D[] = (all.d as D[]) || [];
  const tot = (r: D[] | undefined) => (r || []).reduce((o: D, x) => { ["sessions", "engaged", "saved", ...STEPS.map((s2) => s2[0])].forEach((k) => (o[k] = n(o[k]) + n(x[k]))); return o; }, {});
  const A = tot(sa.d as D[]), B = tot(sbb.d as D[]);
  const pick = (v: { ch: string; lang: string }, set: (x: { ch: string; lang: string }) => void) => (
    <div className="seg-pick"><select className="adm-in sm" value={v.ch} onChange={(e) => set({ ...v, ch: e.target.value })}><option value="">Minden csatorna</option>{(v.ch && !chans.includes(v.ch) ? [...chans, v.ch] : chans).map((k) => <option key={k} value={k}>{ch(k)}</option>)}</select>
      <select className="adm-in sm" value={v.lang} onChange={(e) => set({ ...v, lang: e.target.value })}><option value="">Minden nyelv</option>{langs.map((k: string) => <option key={k} value={k}>{lang(k)}</option>)}</select></div>
  );
  return (
    <>
      <Card className="s12" icon={P.calendar} title="A tölcsér hétről hétre" sub={`Az elmúlt ${weeks} hét hétfőtől vasárnapig (a folyó héttel együtt; hetekben számol, legalább 4 hetet mutat, ezért 24 óránál, 3 és 7 napnál is 4 hét látszik): az aktív látogatások hány %-a ért el az egyes lépésekig, ugyanazokkal a szigorú lépésekkel, mint fent.`}>
        <TRows name="tolcser-hetente" rows={[...rows].reverse()} empty="Még nincs elég adat." cols={[
          { k: "w", l: "Hét", r: (r) => new Date(r.w).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " –" },
          { k: "engaged", l: "Aktív látogatás", num: true, r: (r) => <><b>{fmt(vOf(r, "engaged"))}</b> <small className="mut">a {fmt(r.sessions)}-ból</small></> },
          ...STEPS.map(([k, l]) => ({ k, l, num: true, r: (r: D) => <>{fmt(r[k])} <small className="mut">{pct(n(r[k]), vOf(r, "engaged"))}</small></> })),
          { k: "saved", l: "Mentés", num: true, r: (r: D) => (r.saved == null ? "–" : fmt(r.saved)) },
        ]} />
      </Card>
      <Card className="s12" icon={P.layers} title="Két csoport összevetése" sub={`Válassz két csoportot (csatorna és/vagy nyelv): az elmúlt ${weeks} hét tölcsére egymás mellett, lépésenként az aktív látogatásokból számolt % és a különbség. ★: a különbség 95%-os biztonsággal nem a véletlen műve (legalább 20–20 látogatásnál számoljuk).`}>
        <div className="seg-cmp"><div><span className="eyebrow">A csoport</span>{pick(a, setA)}</div><div><span className="eyebrow">B csoport</span>{pick(b, setB)}</div></div>
        <div className="tw"><table className="tb"><thead><tr><th>Lépés</th><th className="num">A</th><th className="num">B</th><th className="num">Különbség</th></tr></thead><tbody>
          <tr><td>Aktív látogatás</td><td className="num"><b>{fmt(vOf(A, "engaged"))}</b></td><td className="num"><b>{fmt(vOf(B, "engaged"))}</b></td><td /></tr>
          {STEPS.map(([k, l]) => { const ea = vOf(A, "engaged"), eb = vOf(B, "engaged"), ra = ea ? n(A[k]) / ea : 0, rb = eb ? n(B[k]) / eb : 0, df = (rb - ra) * 100, z = zTest(n(A[k]), ea, n(B[k]), eb);
            return <tr key={k}><td>{l}</td><td className="num">{pct(n(A[k]), ea)}</td><td className="num">{pct(n(B[k]), eb)}</td><td className="num"><span className={df > 0.5 ? "up" : df < -0.5 ? "down" : ""}>{df > 0 ? "+" : ""}{fmt(df, 1)} pont</span>{z != null && <small className="mut" title={`z = ${fmt(z, 2)}`}> {z >= 1.96 ? "★ valódi" : "lehet véletlen"}</small>}</td></tr>; })}
        </tbody></table></div>
      </Card>
    </>
  );
}

/* ---------- the drop-outs' last step ---------- */
const AT: Record<string, string> = { web: "Több lépést tett a weboldalon, vagy forrásból jött, de az appot nem nyitotta meg", app: "Megnyitotta az appot, de nem nyitotta meg a fotóválasztót", named: "Elkezdte, de nem töltött fel bőrfotót (és nem is hagyta ki)", skipped: "Kihagyta a bőrfotót, és nem nézte meg 50 év múlva",
  captured: "Feltöltött egy bőrfotót, de nem jutott az előnézetig", scored: "Megkapta az előnézetet, de nem nézte meg 50 év múlva", revealed: "Megnézte 50 év múlva, de nem választott, és nem mentette el az előnézetet", picked: "Választott vagy elmentette az előnézetet, de nem ért a végéig (nem mentett képet, nem osztott meg, nincs záró képernyő)", door: "Egyetlen megnyitás forrás nélkül (főoldal, /start, belépés): lehet ember és gép is, ezért külön áll" };
const evl = (x: string) => { const [nm, det] = String(x).split(":"); return `${EV[nm] || nm}${det ? " · " + (QSTEP[det] || SCR[det] || stepName(det)) : ""}`; };
function Dropouts({ days }: { days: number }) {
  const { f } = useFlt();
  /* a range of her own too (the drop-outs always counted back from now) */
  const pr = usePeriod();
  const { d, e, load, busy } = useRpc("admin_dropouts", { p_days: Math.min(365, days || 30), p_ch: f.ch || null, p_lang: f.lang || null, p_from: pr.p_from, p_to: pr.p_to }, [days, f.ch, f.lang, pr.p_from, pr.p_to]);
  const [open, setOpen] = useState<{ at: string; last?: string } | null>(null);
  if (e && !d) return <LoadErr e={e} retry={load} busy={busy} />;
  if (!d) return <div className="skel" style={{ height: 140 }} />;
  const rows: D[] = Array.isArray(d) ? d : [];
  if (!rows.length) return <Empty t="Még nincs kieső látogatás ebben az időszakban." />;
  return <>
    <div className="drops">{Object.keys(AT).map((k) => { const rs = rows.filter((r) => r.at_step === k); if (!rs.length) return null; const tot2 = rs.reduce((t, r) => t + n(r.n), 0);
      return <div key={k} className="drop-g"><h4 role="button" style={{ cursor: "pointer" }} onClick={() => setOpen({ at: k })}>{AT[k]} <small>{fmt(tot2)} látogatás →</small></h4><BarList items={rs.slice(0, 5).map((r) => ({ k: r.last_ev, n: n(r.n), sub: r.secs == null ? "egy eseményből az idő nem mérhető" : `átl. ${secs(n(r.secs))} aktív idő` }))} fmtK={evl} max={5} onPick={(last) => setOpen({ at: k, last })} /></div>; })}</div>
    {open && <DropSessions days={Math.min(365, days || 30)} at={open.at} last={open.last} close={() => setOpen(null)} />}
  </>;
}

/* the visits behind a drop-out row: when, from where, and every step they took (anonymous) */
function DropSessions({ days, at, last, close }: { days: number; at: string; last?: string; close: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f } = useFlt();
  const [x, setX] = useState<D[] | null>(null); const [err, setErr] = useState(""); const [tv, setTv] = useState(0);
  const pr = usePeriod();
  useEffect(() => { let live = true; setErr(""); rpc(sb, "admin_dropout_sessions", { p_days: days, p_at: at, p_last: last || null, p_ch: f.ch || null, p_lang: f.lang || null, p_from: pr.p_from, p_to: pr.p_to }).then(({ data, error }) => { if (!live) return; if (error) setErr(error.message); else setX(Array.isArray(data) ? data : []); }); return () => { live = false; }; }, [sb, days, at, last, f.ch, f.lang, pr.p_from, pr.p_to, tv]);
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Kieső látogatások">
        <div className="c-h"><div><div><span className="eyebrow">Kiesők · legutóbbi 25</span><h2 style={{ fontSize: 18, marginTop: 6 }}>{AT[at]}{last ? ` · ${evl(last)}` : ""}</h2></div></div><CloseX close={close} /></div>
        {err && !x ? <LoadErr e={err} retry={() => setTv((v) => v + 1)} /> : !x ? <div className="skel" style={{ height: 200 }} /> : !x.length ? <Empty t="Nincs ilyen látogatás." /> : (
          <ol className="tline">{x.map((s) => (
            <li key={s.s + s.t0}>
              <time>{new Date(s.t0).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
              <span><b>…{s.s}</b> · {ch(s.ch)} · {lang(s.lang || "?")} · {s.pf === "android" ? "Android (becslés)" : "web"} · {s.secs == null ? "egy esemény, nincs hossza" : secs(n(s.secs))}</span>
              <small>{((s.trail || []) as string[]).map(evl).join(" → ")}</small>
            </li>))}</ol>
        )}
        <p className="note">Névtelen látogatások: a munkamenet-azonosító utolsó 6 jele, fiók és személy nélkül.</p>
      </aside>
    </Layer>
  );
}
