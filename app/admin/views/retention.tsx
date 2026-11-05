"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { BarList, Empty, Info, Spark, TrendChart, fmt, pct } from "../charts";
import { CohortBars } from "../visuals";
import { Card, Lesson, Loading, NeedKey, P, PROV, Tbl, ago, ch, lang, n, type D, useFlt, useRpc } from "../shared";
import { Hero, Ring, type RingKind } from "../ink";
import { TRows, Top } from "./traffic";
import { Logo } from "../wow";
import { usePhone } from "../phone";
import { LoadErr, PageErr, PhMore } from "./people";

const PFL: Record<string, string> = { web: "Weboldal", android: "Android-app (becslés)", ios: "iPhone-app", ismeretlen: "Nem párosítható (pl. statisztika nélkül)" };
const DIM: Record<string, string> = { ch: "Csatorna", lang: "Nyelv", pf: "Platform", prov: "Belépés módja" };
/* one week of one cohort as a small ring: the share of a real total; while the week still runs it is drawn in dots and marked in words */
const RingCell = ({ a, b, part }: { a: unknown; b: unknown; part?: boolean }) => (n(b) ? <span className={"ix-rc" + (part ? " part" : "")} title={`${fmt(n(a))} / ${fmt(n(b))} fiók${part ? " · a hét még tart" : ""}`}><Ring p={n(a) / n(b)} kind={part ? "dots" : "solid"}><b>{pct(n(a), n(b))}</b></Ring></span> : <span className="mut">–</span>);
const WK = Array.from({ length: 9 }, (_, k) => ({ k: "w" + k, i: k, l: k === 0 ? "1. hét" : `+${k}` }));
/* ---------- retention ----------
   The page has no period picker, so it shows every account (it used to read a period kept in the browser: after a
   "Ma" view it silently showed only today's sign-ups). A caller may still pass one. */
export function Retention({ days }: { days?: number } = {}) {
  const { f } = useFlt();
  const pd = days ?? 0;
  const { d, e, load, busy } = useRpc("admin_retention", { p_days: pd, p_ch: f.ch || null, p_lang: f.lang || null }, [pd, f.ch, f.lang]);
  const [dim, setDim] = useState<"ch" | "lang" | "pf" | "prov">("ch");
  const phone = usePhone();
  if (e && !d) return <PageErr e={e} retry={load} busy={busy} />;
  if (!d) return <Loading />;
  const act: D[] = d.active || [], last = act[act.length - 1] || {};
  const curve: D[] = d.curve || [], cprev: D[] = d.curve_prev || [];
  const c7 = curve.find((x) => x.k === 7), p7 = cprev.find((x) => x.k === 7);
  const accounts = Math.max(1, n(d.accounts_all));
  const by: D[] = (d.by || []).filter((x: D) => x.dim === dim);
  const lab = (k: string) => (dim === "ch" ? ch(k) : dim === "lang" ? lang(k) : dim === "pf" ? PFL[k] || k : PROV[k] || k);
  const G = d.store?.google || {}, A = d.store?.apple || {};
  const scope = pd ? `az elmúlt ${pd === 1 ? "24 órában" : pd + " napban"} regisztráltak` : "minden fiók, a saját és tesztfiókjaid nélkül";
  /* did they come back, in rings; the product is used once for most people */
  const backRings = <section className="c s12 ix-back"><h2 className="ink-h">Visszajöttek-e<Info>Aki később is készített vagy mentett előnézetet. Egy tetoválás kipróbálásához általában elég egyszer használni, ezért ez csak irány. Csak munkamenet nyílt: az nem számít.</Info></h2>
    <div className="ix-rings">{curve.slice(0, 3).map((x, i) => <div key={x.k}><Ring p={n(x.eligible) ? n(x.back) / n(x.eligible) : 0} kind={(["solid", "tick", "dots"] as RingKind[])[i]}><b>{n(x.eligible) ? pct(n(x.back), n(x.eligible)) : "–"}</b></Ring><strong>{x.k}. nap után</strong><small>{n(x.eligible) ? `${fmt(x.back)} / ${fmt(x.eligible)} fiók` : "még nincs elég régi fiók"}</small></div>)}</div></section>;
  return (
    <div className="g ix">
      <Top><Hero flip label={<>Használta az appot (30 nap)<Info>Használat: aznap előnézet készült vagy mentés történt a fiókkal, bármelyik eszközön. A regisztráció napja nélkül, vagyis akik <b>később is visszajöttek használni</b>: 30 nap alatt <b>{fmt(last.mau_back_used)}</b>, 7 nap alatt <b>{fmt(last.wau_back_used)}</b> fiók. Külön szám, hogy nyílt-e munkamenet (belépés vagy a háttérben frissülő bejelentkezés, a regisztráció napja is): 30 nap <b>{fmt(last.mau)}</b>, 7 nap <b>{fmt(last.wau)}</b>; ebből nem derül ki, hogy használta is. A kohorszok és a görbék: {scope}{f.ch || f.lang ? ", a szűrő szerint" : ""}.</Info></>} v={n(last.mau_used)}
        sub={<>Ma <b>{fmt(last.dau_used)}</b> · 7 nap alatt <b>{fmt(last.wau_used)}</b> fiók</>} side={<Spark values={act.map((x) => n(x.wau_used))} h={92} color="var(--a-fg)" />} /></Top>
      {backRings}
      {!phone && c7 && n(c7.eligible) > 0 && <Lesson>Egy hét után is használta: <b>{pct(n(c7.back), n(c7.eligible))}</b> ({fmt(c7.back)} / {fmt(c7.eligible)} fiók){p7 && n(p7.eligible) ? <>, az előző időszak fiókjainál {pct(n(p7.back), n(p7.eligible))}</> : null}. Csak a munkamenete nyílt meg: {pct(n(c7.opened), n(c7.eligible))}. Egy tetoválás kipróbálásához általában elég egyszer használni az appot, és még kevés a fiók, ezért ez csak irány.</Lesson>}
      <PhMore label="Használat napról napra, kohorszok, görbék">
      <Card className="s5" icon={P.refresh} title="Használat" sub="A fiókok hány %-a készített előnézetet vagy mentett ma, az elmúlt 7 és az elmúlt 30 napban (a szűrő szerinti fiókok közül). A regisztráció napján végzett használat is számít; a csak megnyitott munkamenet nem.">
        <div className="ix-rings"><div><Ring p={n(last.mau_used) / accounts} kind="solid"><b>{fmt(last.mau_used)}</b></Ring><strong>Használta (30 nap)</strong><small>{pct(n(last.mau_used), accounts)} a fiókokból</small></div><div><Ring p={n(last.wau_used) / accounts} kind="tick"><b>{fmt(last.wau_used)}</b></Ring><strong>Használta (7 nap)</strong><small>{pct(n(last.wau_used), accounts)} a fiókokból</small></div><div><Ring p={n(last.dau_used) / accounts} kind="dots"><b>{fmt(last.dau_used)}</b></Ring><strong>Használta ma</strong><small>{pct(n(last.dau_used), accounts)} a fiókokból</small></div></div>
        <p className="note">Később is visszajött használni: {fmt(last.mau_back_used)} fiók. Csak munkamenet nyílt: {fmt(last.mau)} fiók (30 nap).</p>
      </Card>
      <Card className="s7" icon={P.users} title="Használó fiókok naponta" sub="Heti használó (az elmúlt 7 napban legalább egyszer előnézetet készített vagy mentett) az elmúlt 60 napban; a szaggatott a napi használó.">
        <TrendChart data={act.map((x) => ({ t: x.day, v: n(x.wau_used), p: n(x.dau_used) }))} label="Heti használó" prevLabel="Napi használó" height={230} />
      </Card>
      <Card className="s12" icon={P.calendar} title="Kohorszok hétről hétre" sub="Soronként a regisztráció hete; oszloponként a regisztráció utáni hét. A cella: a kohorsz hány %-a használta az appot abban a héten (előnézet vagy mentés); a regisztráció napja nem számít visszatérésnek, ezért az 1. hét sem 100%, és a csak megnyitott munkamenet sem számít. A dőlt, halvány érték: a hét még tart. A még el nem kezdődött hetek üresek.">
        <TRows all dense name="kohorszok" empty="Ebben az időszakban nem volt regisztráció." rows={((d.cohorts || []) as D[]).map((c) => ({ w: String(c.w).slice(0, 10), n: n(c.n), cells: c.weeks, ...Object.fromEntries(((c.weeks || []) as D[]).filter((wk) => wk.open || wk.partial).map((wk) => ["w" + wk.k, n(wk.n)])) }))} cols={[
          { k: "w", l: "Hét", r: (r) => <span className="ix-tr-id"><span><b>{new Date(r.w).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} –</b><small>{fmt(r.n)} fiók</small></span></span> },
          ...WK.map((c) => ({ k: c.k, l: c.l, r: (r: D) => { const wk = ((r.cells || []) as D[]).find((x) => n(x.k) === c.i); return wk?.open ? <RingCell a={wk.n} b={r.n} /> : wk?.partial ? <RingCell a={wk.n} b={r.n} part /> : <span className="mut" title="Ez a hét még nem kezdődött el">·</span>; } })),
        ]} />
        {(d.cohorts || []).length > 0 && <p className="ix-honest">Pöttyözött karika: a hét még tart.</p>}
      </Card>
      <Card className="s12" icon={P.refresh} title="Visszatérés a regisztráció után" sub="Hány % használta még az appot legalább N nappal a regisztrációja után (azok közül, akik elég régen regisztráltak). Mellette, ha van, az előző ugyanilyen hosszú időszak fiókjai, és hogy hányaknál nyílt csak munkamenet.">
        {curve.length ? <CohortBars cols={curve.map((x) => { const p = cprev.find((y) => y.k === x.k); return { l: x.k + ". nap", v: n(x.eligible) ? Math.round((n(x.back) / n(x.eligible)) * 100) : 0, tip: `${fmt(x.back)} / ${fmt(x.eligible)} fiók · munkamenet nyílt: ${fmt(x.opened)}${p && n(p.eligible) ? ` · előtte ${pct(n(p.back), n(p.eligible))}` : ""}` }; })} /> : <Empty t="Még nincs elég régi fiók." />}
        {cprev.length > 0 && <div className="grw-row">{curve.map((x) => { const p = cprev.find((y) => y.k === x.k); return <span key={x.k} className="chip">{x.k}. nap: {pct(n(x.back), n(x.eligible))}{p && n(p.eligible) ? <small className="mut"> · előtte {pct(n(p.back), n(p.eligible))}</small> : null}</span>; })}</div>}
      </Card>
      </PhMore>
      <Card className="s12" icon={P.target} title="Ki jön vissza" sub="A fiókok hány %-a használta újra az appot az 1–7. napon és a 8–30. napon, bontásban. A csatorna, a nyelv és a platform a regisztrációt hozó látogatásból jön, és ez becslés: a regisztrációt az időben legközelebbi, azonos nyelvű névtelen látogatáshoz kötjük. A „Bizonytalan” oszlop mutatja, hány fióknál gyenge vagy hiányzik ez a párosítás. Aki nem fogadta el a statisztikát, annak a látogatása nem látszik, ezért az ő fiókja is kerülhet idegen látogatáshoz."
        right={<div className="adm-seg sm">{(Object.keys(DIM) as (keyof typeof DIM)[]).map((k) => <button key={k} aria-pressed={dim === k} onClick={() => setDim(k as typeof dim)}>{DIM[k]}</button>)}</div>}>
        <TRows name={"megtartas-" + dim} rows={by} empty="Még nincs elég regisztráció." cols={[
          { k: "k", l: DIM[dim], r: (r) => <span className="ix-tr-id">{dim === "ch" && <Logo k={r.k} size={44} />}<b>{lab(r.k)}</b></span> },
          { k: "users", l: "Fiók", num: true, r: (r) => <b>{fmt(r.users)}</b> },
          { k: "weak", l: "Nem tudjuk, honnan", num: true, r: (r) => (dim === "ch" || dim === "pf" ? fmt(r.weak) : <span className="mut">–</span>) },
          { k: "d7", l: "Használta 1–7 nap", num: true, r: (r) => (n(r.d7_n) ? <RingCell a={r.d7} b={r.d7_n} /> : <span className="mut">még korai</span>) },
          { k: "d7_opened", l: "Munkamenet 1–7 nap", num: true, r: (r) => (n(r.d7_n) ? <RingCell a={r.d7_opened} b={r.d7_n} /> : <span className="mut">még korai</span>) },
          { k: "d30", l: "Használta 8–30 nap", num: true, r: (r) => (n(r.d30_n) ? <RingCell a={r.d30} b={r.d30_n} /> : <span className="mut">még korai</span>) },
        ]} />
      </Card>
      <PhMore label="Forrás szerint, áruházak, alvó fiókok, mérési korlátok">
      <SourceCohorts />
      <Card className="s6" icon={P.layers} src={["apple", "google"]} title="Áruházi megtartás" sub="Amit az áruházak mérnek (a kulcsok beállítása után): Google Play – a telepítők közül hányan tartották meg az appot 1, 7, 15 és 30 nap után (60 nap); App Store – aktív eszközök, munkamenetek, telepítés és törlés (30 nap).">
        {Object.keys(G).length || Object.keys(A).length ? <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          {Object.keys(G).length > 0 && <>{[1, 7, 15, 30].map((k) => <div key={k} className="mini"><span>Play: megtartotta {k} nap után</span><b>{n(G.downloads_src) ? pct(n(G["retained_d" + k]), n(G.downloads_src)) : "–"}</b><small>{fmt(G["retained_d" + k])} / {fmt(G.downloads_src)} telepítő</small></div>)}</>}
          {Object.keys(A).length > 0 && <><div className="mini"><span>App Store: aktív eszköz (a legtöbb egy napon)</span><b>{fmt(A.active_devices)}</b><small>{fmt(A.sessions)} munkamenet</small></div>
            <div className="mini"><span>App Store: telepítés / törlés</span><b>{fmt(A.installs)} / {fmt(A.deletions)}</b><small>{n(A.installs) ? pct(n(A.deletions), n(A.installs)) : "–"} törlési arány</small></div></>}
        </div> : <Empty t="Az App Store- és a Google Play-kulcsok (Kapcsolatok oldal) és az első napi jelentések után jelenik meg." icon={P.layers}><NeedKey k={["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_APP_ID", "PLAY_SERVICE_ACCOUNT_JSON", "PLAY_REPORTS_BUCKET"]} /></Empty>}
      </Card>
      <Card className="s6" icon={P.moon} title={`Alvó fiókok (30+ nap): ${fmt(d.dormant)}`} sub="Akiknél 30 napja nem nyílt munkamenet és nem történt használat (a legutóbb aktívak elöl).">
        <Tbl name="alvo-fiokok" rows={d.dormant_list || []} empty="Nincs alvó fiók." csv={false} cols={[
          { k: "email", l: "Fiók", r: (r) => <span className="cellwrap">{r.email || "–"}</span> },
          { k: "lang", l: "Nyelv", r: (r) => lang(r.lang || "?") },
          { k: "last_day", l: "Utoljára aktív", r: (r) => ago(r.last_day) },
          { k: "created_at", l: "Regisztrált", r: (r) => ago(r.created_at) },
        ]} />
      </Card>
      <Card className="s6" icon={P.layers} title="Használati napok fiókonként" sub="Hány különböző napon készítettek előnézetet vagy mentettek eddig (10+ egybe). A még nem használó fiókok nincsenek benne.">
        <BarList items={(d.days_per_user || []).map((x: D) => ({ k: (n(x.k) >= 10 ? "10+" : x.k) + " nap", n: n(x.n) }))} max={10} />
      </Card>
      <Card className="s6" icon={P.alert} title="Mit jelent ez?" sub="A mérés korlátai.">
        <p className="note">A használati napokat a fiók előnézeteiből és mentéseiből számoljuk, bármelyik eszközről, 10 percenként frissítve. A munkamenet-napok a belépésekből és a háttérben frissülő bejelentkezésekből jönnek {d.since ? `(${new Date(d.since).toLocaleDateString("hu-HU", { month: "long", day: "numeric" })} óta)` : ""}: ez azt mutatja, hogy nyitva volt az app, azt nem, hogy használták is.</p>
        <p className="note">Vendégként (fiók nélkül) használók és a weboldal visszatérő látogatói itt nem látszanak: ehhez tartós, böngészőnként megmaradó azonosító kellene, amit az adatvédelmi vállalásaink miatt nem használunk (a látogatás egy böngészőfülnyi ideig azonosítható).</p>
      </Card>
      </PhMore>
    </div>
  );
}

/* ---------- cohorts by source: do the people from TikTok come back as often as those from Google? ---------- */
function SourceCohorts() {
  const [days, setDays] = useState(90);
  /* the page's channel and language filter too (a channel keeps its own row, a language the accounts that signed up in it) */
  const { f } = useFlt();
  const { d, e, load, busy } = useRpc("admin_cohorts_source", { p_days: days, p_ch: f.ch || null, p_lang: f.lang || null }, [days, f.ch, f.lang]);
  const rows: D[] = Array.isArray(d) ? d : [];
  const rate = (a: number, b: number) => (b ? <><b>{Math.round((a / b) * 100)}%</b><div className="mut" style={{ fontSize: 11 }}>{a} / {b}</div></> : <span className="mut" title="Még nincs ilyen régi fiók ebből a forrásból">–</span>);
  return (
    <Card className="s12" icon={P.users} title="Visszatérés forrás szerint"
      sub="A regisztrált fiókok csatornánként (honnan jött a regisztráció előtti látogatás; ez becslés, a „Nem tudjuk, honnan” oszlop mutatja, hánynál nem tudjuk): hányan használták újra az appot a következő napon, az első héten és az utána következő hónapban. Minden arány csak azokból a fiókokból számol, amelyek elég régiek hozzá. Kevés fióknál még csak irány."
      right={<div className="adm-seg sm" role="group">{[[30, "30 nap"], [90, "90 nap"], [365, "1 év"], [0, "Összes"]].map(([v, l]) => <button key={v} aria-pressed={days === v} onClick={() => setDays(v as number)}>{l}</button>)}</div>}>
      {e && !d ? <LoadErr e={e} retry={load} busy={busy} /> : <TRows name="visszateres-forras" rows={rows} empty="Ebben az időszakban nem volt regisztráció." cols={[
        { k: "ch", l: "Forrás", r: (r) => <span className="ix-tr-id"><Logo k={r.ch} size={44} /><b>{ch(r.ch)}</b></span> },
        { k: "n", l: "Fiók", num: true, r: (r) => fmt(r.n) },
        { k: "weak", l: "Nem tudjuk, honnan", num: true, r: (r) => fmt(r.weak) },
        { k: "r1", l: "Másnap vissza", num: true, r: (r) => rate(n(r.r1), n(r.e1)) },
        { k: "r7", l: "Az első héten", num: true, r: (r) => rate(n(r.r7), n(r.e7)) },
        { k: "o7", l: "Munkamenet az első héten", num: true, r: (r) => rate(n(r.o7), n(r.e7)) },
        { k: "r30", l: "A 2–4. héten", num: true, r: (r) => rate(n(r.r30), n(r.e30)) },
        { k: "a7", l: "Használta az elmúlt 7 napban", num: true, r: (r) => rate(n(r.a7), n(r.n)) },
      ]} />}
    </Card>
  );
}
