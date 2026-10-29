"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { BarList, Empty, Spark, TrendChart, fmt, pct, SERIES } from "../charts";
import { ActivityRings } from "../wow";
import { CohortBars } from "../visuals";
import { Band, Card, Lesson, Loading, P, PROV, Tbl, ago, ch, lang, n, type D, useFlt, useRpc } from "../shared";
import { Logo } from "../wow";
import { Heat } from "./users";

const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app (becslés)", ismeretlen: "Nem párosítható (pl. iPhone-app)" };
const DIM: Record<string, string> = { ch: "Csatorna", lang: "Nyelv", pf: "Platform", prov: "Belépés módja" };
/* ---------- retention ----------
   The page has no period picker, so it shows every account (it used to read a period kept in the browser: after a
   "Ma" view it silently showed only today's sign-ups). A caller may still pass one. */
export function Retention({ days }: { days?: number } = {}) {
  const { f } = useFlt();
  const pd = days ?? 0;
  const { d, e } = useRpc("admin_retention", { p_days: pd, p_ch: f.ch || null, p_lang: f.lang || null }, [pd, f.ch, f.lang]);
  const [dim, setDim] = useState<"ch" | "lang" | "pf" | "prov">("ch");
  if (e) return <div className="alert err">{e}</div>;
  if (!d) return <Loading />;
  const act: D[] = d.active || [], last = act[act.length - 1] || {};
  const curve: D[] = d.curve || [], cprev: D[] = d.curve_prev || [];
  const c7 = curve.find((x) => x.k === 7), p7 = cprev.find((x) => x.k === 7);
  const accounts = Math.max(1, n(d.accounts_all));
  const by: D[] = (d.by || []).filter((x: D) => x.dim === dim);
  const lab = (k: string) => (dim === "ch" ? ch(k) : dim === "lang" ? lang(k) : dim === "pf" ? PFL[k] || k : PROV[k] || k);
  const G = d.store?.google || {}, A = d.store?.apple || {};
  const scope = pd ? `az elmúlt ${pd === 1 ? "24 órában" : pd + " napban"} regisztráltak` : "minden fiók, a saját és tesztfiókjaid nélkül";
  return (
    <div className="g">
      {c7 && n(c7.eligible) > 0 && <Lesson>A legalább egy hete regisztráltak <b>{pct(n(c7.back), n(c7.eligible))}</b>-a jött vissza egy hét után{p7 && n(p7.eligible) ? <> (az előző időszak fiókjainál {pct(n(p7.back), n(p7.eligible))})</> : null}. {n(c7.back) / n(c7.eligible) < 0.2 ? "Egy heti emlékeztető (ápolási tipp, új tudástár-cikk) a legolcsóbb módja, hogy többen visszajöjjenek." : "Ez jó arány egy ilyen apptól."}</Lesson>}
      <Band plain label="Aktív fiókok (30 nap)" value={n(last.mau)} sentence={<>Ma <b>{fmt(last.dau)}</b>, az elmúlt 7 napban <b>{fmt(last.wau)}</b> fiók volt aktív. {c7 ? <>A legalább egy hete regisztráltak <b>{pct(n(c7.back), n(c7.eligible))}</b>-a visszajött 7 nap után.</> : null} Aktív nap = belépés vagy használat a fiókkal (az anonim események nélkül), a regisztráció napja is; a Felhasználók oldal ugyanezt a meghatározást használja. {last.mau_back != null ? <>A regisztráció napja nélkül, vagyis akik <b>visszajöttek</b>: 30 nap alatt <b>{fmt(last.mau_back)}</b>, 7 nap alatt <b>{fmt(last.wau_back)}</b> fiók.</> : null} A kohorszok és a görbék: {scope}{f.ch || f.lang ? ", a szűrő szerint" : ""}.</>}
        side={<Spark values={act.map((x) => n(x.wau))} h={92} color={SERIES[2]} />} />
      <Card className="s5" icon={P.refresh} title="Aktivitás" sub="A fiókok hány %-a volt aktív ma, az elmúlt 7 és az elmúlt 30 napban (a szűrő szerinti fiókok közül).">
        <ActivityRings rings={[{ l: "Havi aktív", v: n(last.mau), of: accounts, c: "#FF4FA3" }, { l: "Heti aktív", v: n(last.wau), of: accounts, c: "#8B5CF6" }, { l: "Napi aktív", v: n(last.dau), of: accounts, c: "#2BA597" }]} />
      </Card>
      <Card className="s7" icon={P.users} title="Aktív fiókok naponta" sub="Heti aktív (az elmúlt 7 napban legalább egyszer) az elmúlt 60 napban; a szaggatott a napi aktív.">
        <TrendChart data={act.map((x) => ({ t: x.day, v: n(x.wau), p: n(x.dau) }))} label="Heti aktív" prevLabel="Napi aktív" height={230} />
      </Card>
      <Card className="s12" icon={P.calendar} title="Kohorszok hétről hétre" sub="Soronként a regisztráció hete; oszloponként a regisztráció utáni hét. A cella: a kohorsz hány %-a volt aktív abban a héten; a regisztráció napja nem számít visszatérésnek, ezért az 1. hét sem 100%. A dőlt, halvány érték: a hét még tart. A még el nem kezdődött hetek üresek.">
        {(d.cohorts || []).length ? (
          <div className="tw"><table className="tb coh">
            <thead><tr><th>Hét</th><th className="num">Fiók</th>{Array.from({ length: 9 }, (_, k) => <th key={k} className="num">{k === 0 ? "1. hét" : `+${k}`}</th>)}</tr></thead>
            <tbody>{(d.cohorts as D[]).map((c) => (
              <tr key={c.w}><td>{new Date(c.w).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} –</td><td className="num"><b>{fmt(c.n)}</b></td>
                {(c.weeks as D[]).map((wk) => <td key={wk.k} className="num">{wk.open ? <Heat a={wk.n} b={c.n} /> : wk.partial ? <span className="grw-partial" title="A hét még tart"><Heat a={wk.n} b={c.n} /></span> : <span className="mut">·</span>}</td>)}</tr>
            ))}</tbody>
          </table></div>
        ) : <Empty t="Ebben az időszakban nem volt regisztráció." />}
      </Card>
      <Card className="s12" icon={P.refresh} title="Visszatérés a regisztráció után" sub="Hány % volt még aktív legalább N nappal a regisztrációja után (azok közül, akik elég régen regisztráltak). Mellette az előző ugyanilyen hosszú időszak fiókjai.">
        {curve.length ? <CohortBars cols={curve.map((x) => { const p = cprev.find((y) => y.k === x.k); return { l: x.k + ". nap", v: n(x.eligible) ? Math.round((n(x.back) / n(x.eligible)) * 100) : 0, tip: `${fmt(x.back)} / ${fmt(x.eligible)} fiók${p && n(p.eligible) ? ` · előtte ${pct(n(p.back), n(p.eligible))}` : ""}` }; })} /> : <Empty t="Még nincs elég régi fiók." />}
        {cprev.length > 0 && <div className="grw-row">{curve.map((x) => { const p = cprev.find((y) => y.k === x.k); return <span key={x.k} className="chip">{x.k}. nap: {pct(n(x.back), n(x.eligible))}{p && n(p.eligible) ? <small className="mut"> · előtte {pct(n(p.back), n(p.eligible))}</small> : null}</span>; })}</div>}
      </Card>
      <Card className="s12" icon={P.target} title="Ki jön vissza" sub="A fiókok hány %-a volt újra aktív az 1–7. napon és a 8–30. napon, bontásban. A csatorna, a nyelv és a platform a regisztrációt hozó látogatásból jön (becslés: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük; az iPhone-app nem küld adatot, ezért ott „nem párosítható”)."
        right={<div className="adm-seg sm">{(Object.keys(DIM) as (keyof typeof DIM)[]).map((k) => <button key={k} aria-pressed={dim === k} onClick={() => setDim(k as typeof dim)}>{DIM[k]}</button>)}</div>}>
        <Tbl name={"megtartas-" + dim} rows={by} empty="Még nincs elég regisztráció." cols={[
          { k: "k", l: DIM[dim], r: (r) => <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>{dim === "ch" && <Logo k={r.k} size={22} />}{lab(r.k)}</span> },
          { k: "users", l: "Fiók", num: true, r: (r) => <b>{fmt(r.users)}</b> },
          { k: "d7", l: "Visszajött 1–7 nap", num: true, r: (r) => (n(r.d7_n) ? <Heat a={r.d7} b={r.d7_n} /> : <span className="mut">még korai</span>) },
          { k: "d30", l: "Visszajött 8–30 nap", num: true, r: (r) => (n(r.d30_n) ? <Heat a={r.d30} b={r.d30_n} /> : <span className="mut">még korai</span>) },
        ]} />
      </Card>
      <SourceCohorts />
      <Card className="s6" icon={P.layers} src={["apple", "google"]} title="Áruházi megtartás" sub="Amit az áruházak mérnek (a kulcsok beállítása után): Google Play – a telepítők közül hányan tartották meg az appot 1, 7, 15 és 30 nap után (60 nap); App Store – aktív eszközök, munkamenetek, telepítés és törlés (30 nap).">
        {Object.keys(G).length || Object.keys(A).length ? <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          {Object.keys(G).length > 0 && <>{[1, 7, 15, 30].map((k) => <div key={k} className="mini"><span>Play: megtartotta {k} nap után</span><b>{n(G.downloads_src) ? pct(n(G["retained_d" + k]), n(G.downloads_src)) : "–"}</b><small>{fmt(G["retained_d" + k])} / {fmt(G.downloads_src)} telepítő</small></div>)}</>}
          {Object.keys(A).length > 0 && <><div className="mini"><span>App Store: aktív eszköz (a legtöbb egy napon)</span><b>{fmt(A.active_devices)}</b><small>{fmt(A.sessions)} munkamenet</small></div>
            <div className="mini"><span>App Store: telepítés / törlés</span><b>{fmt(A.installs)} / {fmt(A.deletions)}</b><small>{n(A.installs) ? pct(n(A.deletions), n(A.installs)) : "–"} törlési arány</small></div></>}
        </div> : <Empty t="Az App Store- és a Google Play-kulcsok (Kapcsolatok oldal) és az első napi jelentések után jelenik meg." icon={P.layers} />}
      </Card>
      <Card className="s6" icon={P.moon} title={`Alvó fiókok (30+ nap): ${fmt(d.dormant)}`} sub="Akik 30 napja nem voltak aktívak (a legutóbb aktívak elöl). Nekik szólhat egy visszahívó e-mail.">
        <Tbl name="alvo-fiokok" rows={d.dormant_list || []} empty="Nincs alvó fiók." csv={false} cols={[
          { k: "email", l: "Fiók", r: (r) => <span className="cellwrap">{r.email || "–"}</span> },
          { k: "lang", l: "Nyelv", r: (r) => lang(r.lang || "?") },
          { k: "last_day", l: "Utoljára aktív", r: (r) => ago(r.last_day) },
          { k: "created_at", l: "Regisztrált", r: (r) => ago(r.created_at) },
        ]} />
      </Card>
      <Card className="s6" icon={P.layers} title="Aktív napok fiókonként" sub="Hány különböző napon használták eddig a fiókjukat (10+ egybe).">
        <BarList items={(d.days_per_user || []).map((x: D) => ({ k: (n(x.k) >= 10 ? "10+" : x.k) + " nap", n: n(x.n) }))} max={10} />
      </Card>
      <Card className="s6" icon={P.alert} title="Mit jelent ez?" sub="A mérés korlátai.">
        <p className="note">Az aktív napokat a belépésekből és a munkamenet-frissítésekből számoljuk {d.since ? `(${new Date(d.since).toLocaleDateString("hu-HU", { month: "long", day: "numeric" })} óta)` : ""}. A régebbi napokból csak a regisztráció és az utolsó belépés ismert, ezért az első hetek kohorszai alulbecsültek; mostantól minden reggel bekerülnek az aznapi aktív fiókok.</p>
        <p className="note">Vendégként (fiók nélkül) használók és a weboldal visszatérő látogatói itt nem látszanak: ehhez tartós, böngészőnként megmaradó azonosító kellene, amit az adatvédelmi vállalásaink miatt nem használunk (a látogatás egy böngészőfülnyi ideig azonosítható).</p>
      </Card>
    </div>
  );
}

/* ---------- cohorts by source: do the people from TikTok come back as often as those from Google? ---------- */
function SourceCohorts() {
  const [days, setDays] = useState(90);
  /* the page's channel and language filter too (a channel keeps its own row, a language the accounts that signed up in it) */
  const { f } = useFlt();
  const { d } = useRpc("admin_cohorts_source", { p_days: days, p_ch: f.ch || null, p_lang: f.lang || null }, [days, f.ch, f.lang]);
  const rows: D[] = Array.isArray(d) ? d : [];
  const rate = (a: number, b: number) => (b ? <><b>{Math.round((a / b) * 100)}%</b><div className="mut" style={{ fontSize: 11 }}>{a} / {b}</div></> : <span className="mut" title="Még nincs ilyen régi fiók ebből a forrásból">–</span>);
  return (
    <Card className="s12" icon={P.users} title="Visszatérés forrás szerint"
      sub="A regisztrált fiókok csatornánként (honnan jött a regisztráció előtti látogatás, becslés): hányan jöttek vissza a következő napon, az első héten és az utána következő hónapban. Minden arány csak azokból a fiókokból számol, amelyek elég régiek hozzá. Kevés fióknál még csak irány."
      right={<div className="adm-seg sm" role="group">{[[30, "30 nap"], [90, "90 nap"], [365, "1 év"], [0, "Összes"]].map(([v, l]) => <button key={v} aria-pressed={days === v} onClick={() => setDays(v as number)}>{l}</button>)}</div>}>
      <Tbl name="visszateres-forras" rows={rows} empty="Ebben az időszakban nem volt regisztráció." cols={[
        { k: "ch", l: "Forrás", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Logo k={r.ch} size={20} /><b>{ch(r.ch)}</b></span> },
        { k: "n", l: "Fiók", num: true, r: (r) => fmt(r.n) },
        { k: "r1", l: "Másnap vissza", num: true, r: (r) => rate(n(r.r1), n(r.e1)) },
        { k: "r7", l: "Az első héten", num: true, r: (r) => rate(n(r.r7), n(r.e7)) },
        { k: "r30", l: "A 2–4. héten", num: true, r: (r) => rate(n(r.r30), n(r.e30)) },
        { k: "a7", l: "Aktív az elmúlt 7 napban", num: true, r: (r) => rate(n(r.a7), n(r.n)) },
      ]} />
    </Card>
  );
}
