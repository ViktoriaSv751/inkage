"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, Funnel, fmt, pct } from "../charts";
import { Funnel3D } from "../wow";
import { Radar, StepBars } from "../visuals";
import { Band, Card, EV, Kpi, Layer, Lesson, Loading, P, QSTEP, QVAL, Tbl, ch, cleanAns, lang, n, periodName, periodWords, rpc, secs, type D, useBlockRpc, useFlt, usePeriod, useRpc , series } from "../shared";
import { per } from "./traffic";

/* the steps of the strict funnel: each counts the visits that reached every step before it */
const STEP: Record<string, [string, string]> = {
  sessions: ["Látogatás", "minden munkamenet"], app: ["Megnyitotta az appot", "/app betöltve"], named: ["Elkezdte", "fotóválasztó megnyitva"],
  captured: ["Feltöltött egy bőrfotót", "kihagyás nélkül"], scored: ["Megkapta az előnézetet", "a fő élmény"], quiz: ["Bevezető kérdések", "cél, stílus, testrész"],
  revealed: ["Megnézte 50 év múlva", "az öregedés"], detail: ["Elmentette az előnézetet", "a galériába"], shared: ["Megosztott", "az öregedés után: megosztó link vagy meghívó"],
};
const ORDER = ["sessions", "app", "named", "captured", "scored", "quiz", "revealed", "detail"];
/* what one more step through brings, said in the unit of the step it ends in */
const UNIT: Record<string, string> = { scored: "előnézet", revealed: "öregedés-megnézés", detail: "mentett előnézet", shared: "megosztás" };
/* answers the shared list does not name, and the gender / profession questions that send no value */
const QV: Record<string, string> = { ...QVAL, look: "Megjelenés", legible: "Olvashatóság", unique: "Egyediség", fast: "Gyors", speed: "Gyorsaság", pro: "Profi hatás", fun: "Játékosság", easy: "Könnyű leírni" };

/* ---------- funnel ---------- */
export function FunnelTab({ d }: { d: D }) {
  const { f } = useFlt();
  const { d: F, e } = useRpc("admin_funnel", { ...per(d), p_ch: f.ch || null, p_lang: f.lang || null }, [d.days, d.from, f.ch, f.lang]);
  /* "A tölcsér" with a period of its own (the page's while it says "Mint fölül") */
  const fb = useBlockRpc("admin_funnel", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!F) return <Loading />;
  const N: D = F.now || {}, PV: D = F.prev || {};
  const val = (k: string) => n(N[k]);
  /* the worst step, the first one (opening the app) included */
  let worstK = "", worstR = 2;
  ORDER.forEach((k, i) => { if (!i) return; const a = val(ORDER[i - 1]), b = val(k); if (a >= 5 && b / a < worstR) { worstR = b / a; worstK = k; } });
  /* the gain of ten more points there, in what the chain then gives: previews up to the preview step, aging views or saves after it */
  const end = ORDER.indexOf(worstK) <= ORDER.indexOf("scored") ? "scored" : ORDER.indexOf(worstK) <= ORDER.indexOf("revealed") ? "revealed" : worstK;
  const gain = worstK ? Math.round(val(end) * (Math.min(1, worstR + 0.1) / Math.max(0.01, worstR) - 1)) : 0;
  const steps = [...ORDER, "shared"].map((k, i) => ({ k, l: STEP[k][0], sub: STEP[k][1], n: val(k), prev: i ? val(k === "shared" ? "revealed" : ORDER[i - 1]) : undefined }));
  const rate = (o: D) => (n(o.sessions) ? (n(o.scored) / n(o.sessions)) * 100 : 0);
  const quiz: Record<string, { k: string; n: number }[]> = {};
  ((F.quiz || []) as D[]).forEach((q) => { (quiz[q.step] ||= []).push({ k: q.v || "", n: n(q.n) }); });
  /* one path, each step inside the one before: website → a button → the app after that button. Opening the app
     without a button (a link, the menu) is its own number below, so a later step is never bigger than an earlier one. */
  const web = [{ k: "land", l: "Weboldalt látta", sub: "főoldal, tudástár, cikkek", n: val("land") }, { k: "cta", l: "Gombra kattintott", sub: "a weboldalon", n: val("cta"), prev: val("land") },
    { k: "cta_app", l: "Utána megnyitotta az appot", sub: "gombnyomás után", n: val("cta_app"), prev: val("cta") }];
  return (
    <div className="g">
      {worstK && <Lesson>A legnagyobb kiesés itt van: <b>„{STEP[worstK][0]}”</b>. Az előző lépésből csak <b>{fmt(worstR * 100)}%</b> jut el idáig. Ha itt 10 ponttal többen maradnak, {periodName(d)} kb. <b>{fmt(gain)}</b> {UNIT[end] || "lépéssel"} több lett volna.</Lesson>}
      <Band plain label={`Látogatásból előnézet ${periodName(d)}`} value={rate(N)} d={1} fmtFn={(x) => fmt(x, 1) + "%"} now={rate(N)} prev={rate(PV)} sentence={<><b>{fmt(val("scored"))}</b> látogatás jutott el az előnézetig <b>{fmt(val("sessions"))}</b>-ból (előtte {fmt(rate(PV), 1)}%). Minden lépés csak azokat számolja, akik az összes előzőn is átmentek, ezért egyik sem lehet 100% fölött. {worstK ? <>A legnagyobb kiesés: <b>{STEP[worstK][0].toLowerCase()}</b> előtt ({fmt((1 - worstR) * 100)}% esik ki).</> : null}</>} />
      <Kpi spark={series(d, "app")} kind="own" to="@next" tone="peach" className="s3" icon={P.bolt} l="Megnyitotta az appot" v={fmt(val("app"))} now={val("app")} prev={n(PV.app)} sub={pct(val("app"), val("sessions"))} />
      <Kpi spark={series(d, "scored")} kind="own" to="@next" tone="butter" className="s3" icon={P.target} l="Előnézet" v={fmt(val("scored"))} now={val("scored")} prev={n(PV.scored)} sub={`${pct(val("scored"), val("app"))} az appot nyitókból`} />
      <Kpi spark={series(d, "revealed")} kind="own" to="@next" tone="pink" className="s3" icon={P.spark} l="Megnézte 50 év múlva" v={fmt(val("revealed"))} now={val("revealed")} prev={n(PV.revealed)} sub={`${fmt(N.any_revealed)} összesen, a kihagyókkal`} />
      <Kpi spark={series(d, "shared")} kind="own" to="@next" tone="sky" className="s3" icon={P.share} l="Megosztott" v={fmt(val("shared"))} now={val("shared")} prev={n(PV.shared)} sub={`${pct(val("shared"), val("revealed"))} az öregedés megnézése után`} />
      <Card className="s12" icon={P.funnel} title="A tölcsér" right={fb.ctl} sub={`Minden lemez egy lépés; a szélessége, hány % jutott el idáig (${periodWords(fb.p)}). Pirossal: ahol a legtöbben kiesnek.`}>
        {fb.own && !fb.q.d ? <div className="skel" style={{ height: 220 }} /> : <Funnel3D steps={ORDER.map((k) => ({ l: STEP[k][0], n: fb.own ? n(((fb.q.d as D).now || {})[k]) : val(k) }))} />}
      </Card>
      <Card className="s6" icon={P.target} title="A tölcsér alakja" sub="Minden tengely: a lépés hány %-ban megy tovább az előzőből. Ahol a forma behorpad, ott esnek ki a legtöbben.">
        <Radar axes={ORDER.slice(1).map((k, i) => ({ l: STEP[k][0].replace("Megnyitotta az appot", "App megnyitva").replace("Megkapta az előnézetet", "Előnézet").replace("Megnézte 50 év múlva", "50 év múlva").replace("Elmentette az előnézetet", "Mentés").replace("Feltöltött egy bőrfotót", "Bőrfotó").replace("Bevezető kérdések", "Kérdések").replace("Elkezdte", "Kezdés"), v: val(ORDER[i]) ? Math.round((val(k) / val(ORDER[i])) * 100) : 0 }))} />
      </Card>
      <Card className="s6" icon={P.layers} title="Hányan jutnak el idáig" sub="A látogatások hány %-a ér el az egyes lépésekig.">
        <StepBars steps={ORDER.slice(1).map((k) => ({ l: STEP[k][0], n: val(k), base: val("sessions") }))} />
      </Card>
      <Card className="s12" icon={P.funnel} title="A teljes út, lépésről lépésre" sub={`Munkamenetek ${periodName(d)}. Minden sor: hányan jutottak el idáig (az összes előző lépésen át), és az előző lépéshez képest hány % esett ki. A megosztás az öregedés megnézése után.`}
        foot={<span>Egy munkamenet = egy böngészőfül egy látogatása. Az iPhone-app nem küld adatot.</span>}>
        <Funnel steps={steps} worst={worstK} />
      </Card>
      <Card className="s6" icon={P.pen} title="Akik kihagyták a bőrfotót" sub="Saját bőrfotó nélkül is tovább lehet menni a bevezető kérdésekhez és az öregedéshez: ez az ág.">
        <Funnel steps={[{ k: "skipped", l: "Kihagyta a bőrfotót", n: val("skipped") }, { k: "skip_quiz", l: "Bevezető kérdések", n: val("skip_quiz"), prev: val("skipped") }, { k: "skip_revealed", l: "Megnézte 50 év múlva", n: val("skip_revealed"), prev: val("skip_quiz") }]} accentK="skip_revealed" />
      </Card>
      <Card className="s6" icon={P.doc} title="A weboldalon át érkezők" sub={`Csak akik a weboldalon kezdtek (főoldal, tudástár, cikkek). Egyenesen az appba ${fmt(val("direct_app"))} látogatás jött.`}>
        <Funnel steps={web} accentK="cta_app" />
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}><MiniN l="Appot nyitott a weboldalról (gombbal vagy anélkül)" v={val("land_app")} /><MiniN l="Ebből gomb nélkül" v={Math.max(0, val("land_app") - val("cta_app"))} /></div>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><MiniN l="Regisztráció gomb" v={val("cta_reg")} /><MiniN l="Belépés gomb" v={val("cta_login")} /><MiniN l="Kipróbálás fiók nélkül" v={val("cta_guest")} /></div>
      </Card>
      <Kpi kind="own" to="@next" tone="peach" className="s3" icon={P.clock} l="Megnyitástól az előnézetig" v={secs(d.time_to_score?.median_sec)} sub={<span>medián, {fmt(d.time_to_score?.n)} látogatás</span>} />
      <Kpi kind="own" to="@next" tone="butter" className="s3" icon={P.clock} l="Megnyitástól az 50 év múlváig" v={secs(d.time_to_reveal?.median_sec)} sub={<span>medián, {fmt(d.time_to_reveal?.n)} látogatás</span>} />
      <Kpi kind="own" to="@next" tone="pink" className="s3" icon={P.eye} l="Látogatás hossza" v={secs(d.session_len?.median_sec)} sub={<span>75%-uk {secs(d.session_len?.p75_sec)} alatt</span>} />
      <Kpi kind="own" to="@next" tone="sky" className="s3" icon={P.target} l="Végig a bevezető kérdéseken" v={pct(val("revealed"), val("quiz"))} now={val("quiz") ? val("revealed") / val("quiz") : 0} prev={n(PV.quiz) ? n(PV.revealed) / n(PV.quiz) : 0} sub="a bevezető kérdéseket elkezdők közül" />

      <FunnelWeeks d={d} />
      <Card className="s12" icon={P.arrow} title="Hová lettek, akik kiestek" sub={`Akik egy lépésnél megálltak: mi volt az utolsó dolog, amit csináltak, és mennyi ideig voltak ott (${periodName(d)}, legfeljebb 365 nap; a csatorna- és nyelvszűrő itt is hat). Kattints egy sorra: a mögötte lévő látogatások.`}><Dropouts days={d.days} /></Card>
      <Card className="s6" icon={P.arrow} title="Hol lépnek vissza" sub="Visszalépések lépésenként: itt bizonytalanok."><BarList items={(d.backs || []).map((r: D) => ({ k: r.k, n: n(r.n) }))} fmtK={(k) => QSTEP[k] || k} empty="Senki nem lépett vissza." /></Card>
      <Card className="s6" icon={P.layers} title="Bevezető kérdések válaszai" sub="Mit választanak az egyes kérdéseknél (cél, stílus, testrész). A testrésznél a testtérkép koordinátái nélkül, csak a szöveg; aki átugrotta a kérdést, „nem válaszolt”. A több választásosaknál minden választás külön számít.">
        {Object.keys(quiz).length ? (
          <div className="g">{Object.entries(quiz).map(([k, v]) => { const vals = v.filter((x) => x.k), blank = v.filter((x) => !x.k).reduce((s, x) => s + x.n, 0);
            return <div key={k} className="mini s6" style={{ gap: 12, padding: 14 }}><h3>{QSTEP[k] || k}</h3>{vals.length ? <BarList items={vals.sort((a, b) => b.n - a.n)} fmtK={(x) => QV[x] || cleanAns(x)} max={5} /> : null}{blank ? <span className="note">{fmt(blank)} nem válaszolt</span> : null}</div>; })}</div>
        ) : <Empty t="Még nincs válasz a bevezető kérdésekre." />}
      </Card>
    </div>
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
  const chans = ((d.channels || []) as D[]).map((c) => c.k), langs = ((d.langs || []) as D[]).map((x) => x.k).filter((k: string) => k && k !== "?");
  const rows: D[] = (all.d as D[]) || [];
  const tot = (r: D[] | undefined) => (r || []).reduce((o: D, x) => { ["sessions", ...STEPS.map((s2) => s2[0])].forEach((k) => (o[k] = n(o[k]) + n(x[k]))); return o; }, {});
  const A = tot(sa.d as D[]), B = tot(sbb.d as D[]);
  const pick = (v: { ch: string; lang: string }, set: (x: { ch: string; lang: string }) => void) => (
    <div className="seg-pick"><select className="adm-in sm" value={v.ch} onChange={(e) => set({ ...v, ch: e.target.value })}><option value="">Minden csatorna</option>{chans.map((k) => <option key={k} value={k}>{ch(k)}</option>)}</select>
      <select className="adm-in sm" value={v.lang} onChange={(e) => set({ ...v, lang: e.target.value })}><option value="">Minden nyelv</option>{langs.map((k: string) => <option key={k} value={k}>{lang(k)}</option>)}</select></div>
  );
  return (
    <>
      <Card className="s12" icon={P.calendar} title="A tölcsér hétről hétre" sub={`Az elmúlt ${weeks} hét hétfőtől vasárnapig (a folyó héttel együtt; hetekben számol, legalább 4 hetet mutat, ezért 24 óránál, 3 és 7 napnál is 4 hét látszik): a látogatások hány %-a ért el az egyes lépésekig, ugyanazokkal a szigorú lépésekkel, mint fent.`}>
        <Tbl name="tolcser-hetente" rows={[...rows].reverse()} empty="Még nincs elég adat." cols={[
          { k: "w", l: "Hét", r: (r) => new Date(r.w).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " –" },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => <b>{fmt(r.sessions)}</b> },
          ...STEPS.map(([k, l]) => ({ k, l, num: true, r: (r: D) => <>{fmt(r[k])} <small className="mut">{pct(n(r[k]), n(r.sessions))}</small></> })),
        ]} />
      </Card>
      <Card className="s12" icon={P.layers} title="Két csoport összevetése" sub={`Válassz két csoportot (csatorna és/vagy nyelv): az elmúlt ${weeks} hét tölcsére egymás mellett, lépésenként a % és a különbség. ★: a különbség 95%-os biztonsággal nem a véletlen műve (legalább 20–20 látogatásnál számoljuk).`}>
        <div className="seg-cmp"><div><span className="eyebrow">A csoport</span>{pick(a, setA)}</div><div><span className="eyebrow">B csoport</span>{pick(b, setB)}</div></div>
        <div className="tw"><table className="tb"><thead><tr><th>Lépés</th><th className="num">A</th><th className="num">B</th><th className="num">Különbség</th></tr></thead><tbody>
          <tr><td>Látogatás</td><td className="num"><b>{fmt(A.sessions)}</b></td><td className="num"><b>{fmt(B.sessions)}</b></td><td /></tr>
          {STEPS.map(([k, l]) => { const ra = n(A.sessions) ? n(A[k]) / n(A.sessions) : 0, rb = n(B.sessions) ? n(B[k]) / n(B.sessions) : 0, df = (rb - ra) * 100, z = zTest(n(A[k]), n(A.sessions), n(B[k]), n(B.sessions));
            return <tr key={k}><td>{l}</td><td className="num">{pct(n(A[k]), n(A.sessions))}</td><td className="num">{pct(n(B[k]), n(B.sessions))}</td><td className="num"><span className={df > 0.5 ? "up" : df < -0.5 ? "down" : ""}>{df > 0 ? "+" : ""}{fmt(df, 1)} pont</span>{z != null && <small className="mut" title={`z = ${fmt(z, 2)}`}> {z >= 1.96 ? "★ valódi" : "lehet véletlen"}</small>}</td></tr>; })}
        </tbody></table></div>
      </Card>
    </>
  );
}

/* ---------- the drop-outs' last step ---------- */
const AT: Record<string, string> = { web: "Csak a weboldalt látta, az appot nem nyitotta meg", app: "Megnyitotta az appot, de nem nyitotta meg a fotóválasztót", named: "Elkezdte, de nem töltött fel bőrfotót (és nem is hagyta ki)", skipped: "Kihagyta a bőrfotót, és nem nézte meg 50 év múlva",
  captured: "Feltöltött egy bőrfotót, de nem jutott az előnézetig", scored: "Megkapta az előnézetet, de nem nézte meg 50 év múlva", revealed: "Megnézte 50 év múlva, de nem mentette el az előnézetet" };
const evl = (x: string) => { const [nm, det] = String(x).split(":"); return `${EV[nm] || nm}${det ? " · " + (QSTEP[det] || det) : ""}`; };
function Dropouts({ days }: { days: number }) {
  const { f } = useFlt();
  /* a range of her own too (the drop-outs always counted back from now) */
  const pr = usePeriod();
  const { d } = useRpc("admin_dropouts", { p_days: Math.min(365, days || 30), p_ch: f.ch || null, p_lang: f.lang || null, p_from: pr.p_from, p_to: pr.p_to }, [days, f.ch, f.lang, pr.p_from, pr.p_to]);
  const [open, setOpen] = useState<{ at: string; last?: string } | null>(null);
  if (!d) return <div className="skel" style={{ height: 140 }} />;
  const rows: D[] = Array.isArray(d) ? d : [];
  if (!rows.length) return <Empty t="Még nincs kieső látogatás ebben az időszakban." />;
  return <>
    <div className="drops">{Object.keys(AT).map((k) => { const rs = rows.filter((r) => r.at_step === k); if (!rs.length) return null; const tot2 = rs.reduce((t, r) => t + n(r.n), 0);
      return <div key={k} className="drop-g"><h4 role="button" style={{ cursor: "pointer" }} onClick={() => setOpen({ at: k })}>{AT[k]} <small>{fmt(tot2)} látogatás →</small></h4><BarList items={rs.slice(0, 5).map((r) => ({ k: r.last_ev, n: n(r.n), sub: `átl. ${secs(n(r.secs))} az oldalon` }))} fmtK={evl} max={5} onPick={(last) => setOpen({ at: k, last })} /></div>; })}</div>
    {open && <DropSessions days={Math.min(365, days || 30)} at={open.at} last={open.last} close={() => setOpen(null)} />}
  </>;
}

/* the visits behind a drop-out row: when, from where, and every step they took (anonymous) */
function DropSessions({ days, at, last, close }: { days: number; at: string; last?: string; close: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f } = useFlt();
  const [x, setX] = useState<D[] | null>(null);
  const pr = usePeriod();
  useEffect(() => { rpc(sb, "admin_dropout_sessions", { p_days: days, p_at: at, p_last: last || null, p_ch: f.ch || null, p_lang: f.lang || null, p_from: pr.p_from, p_to: pr.p_to }).then(({ data }) => setX(Array.isArray(data) ? data : [])); }, [sb, days, at, last, f.ch, f.lang, pr.p_from, pr.p_to]);
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Kieső látogatások">
        <div className="c-h"><div><div><span className="eyebrow">Kiesők · legutóbbi 25</span><h2 style={{ fontSize: 18, marginTop: 6 }}>{AT[at]}{last ? ` · ${evl(last)}` : ""}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {!x ? <div className="skel" style={{ height: 200 }} /> : !x.length ? <Empty t="Nincs ilyen látogatás." /> : (
          <ol className="tline">{x.map((s) => (
            <li key={s.s + s.t0}>
              <time>{new Date(s.t0).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
              <span><b>…{s.s}</b> · {ch(s.ch)} · {lang(s.lang || "?")} · {s.pf === "android" ? "Android (becslés)" : "web"} · {secs(n(s.secs))}</span>
              <small>{((s.trail || []) as string[]).map(evl).join(" → ")}</small>
            </li>))}</ol>
        )}
        <p className="note">Névtelen látogatások: a munkamenet-azonosító utolsó 6 jele, fiók és személy nélkül.</p>
      </aside>
    </Layer>
  );
}
