"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ACC, BarList, Delta, Donut, Empty, Spark, TrendChart, compact, fmt, pct, SERIES } from "../charts";
import { KeywordRadar } from "../wow";
import { Band, COUNTRY, Card, DEV, daysLabel, useCardDays, FreshRow, Kpi, Loading, MOCK, Mini, P, Tbl, api, lang, n, pctCell, posChip, rpc, short, type D, useRpc, Layer, ago } from "../shared";
import { ChartBox, More } from "../extra";
import { toast } from "../phone";
import { BingEmpty, Setup, SyncButton, agoDay } from "./social";

const TYPE: Record<string, string> = { web: "Webes keresés", image: "Képkeresés", video: "Videókeresés", discover: "Discover", news: "Google Hírek" };
/* the click rate by position when our own is not known yet (an industry curve); our own replaces it at 200 impressions in places 1–3 */
const CTR_DEFAULT = 0.11;
type Flt = { country: string; device: string; page: string; q: string; brand: "all" | "brand" | "nonbrand" };

export function Search({ days }: { days: number }) {
  /* exactly the chosen days, counted back from the last day Google has given (it is 1–3 days late) */
  const sd = days; /* Google reports whole days, two or three days late: 24 hours is too short */
  const [fl, setFl] = useState<Flt>({ country: "", device: "", page: "", q: "", brand: "all" });
  const [qIn, setQIn] = useState("");
  useEffect(() => { const t = setTimeout(() => setFl((o) => ({ ...o, q: qIn.trim() })), 400); return () => clearTimeout(t); }, [qIn]);
  const { d, e, load } = useRpc("admin_search", { p_days: sd, p_country: fl.country || null, p_device: fl.device || null, p_page: fl.page || null, p_q: fl.q || null, p_brand: fl.brand }, [sd, fl.country, fl.device, fl.page, fl.q, fl.brand]);
  const [view, setView] = useState<"queries" | "pages" | "near" | "low" | "new">("queries");
  const [metric, setMetric] = useState<"clicks" | "impressions" | "pos">("clicks");
  const [openPg, setOpenPg] = useState<string | null>(null); const [seo, setSeo] = useState<D | null>(null);
  if (e) return <div className="g"><Setup only={["gsc"]} /><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  if (d.empty) return (
    <div className="g"><Setup only={["gsc"]} />
      <Card className="s12" icon={P.doc} title="Cikkek × nyelvek" sub="A tudásbázis-cikkek megtekintései nyelvenként (a saját mérésünkből). Az üres cellák a lehetőségek: ott még senki nem olvassa az adott cikket.">
        <ArticleMatrix days={days} />
      </Card>
      <Card className="s12" icon={P.search} title="Google Search Console" sub="Még nincs letöltött adat." right={<SyncButton done={load} />}>
        <Empty t={d.sync?.[0] && !d.sync[0].ok ? "Az utolsó próbálkozás hibája: " + d.sync[0].message : "Ha a beállítás kész, az „Adatok lehúzása most” gomb letölti az elmúlt 16 hónapot: kattintások, megjelenések, helyezések cikkenként és kulcsszavanként."} icon={P.search} />
      </Card>
    </div>
  );
  /* no period before when the data does not reach back that far (one measured day gave "+600%") */
  const t = d.totals || {}, hasPrev = !!d.prev, pv = d.prev || {};
  const P0 = (v: number) => (hasPrev ? v : undefined);
  const dShort = (x?: string) => (x ? new Date(String(x).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–");
  const rt = d.rows_totals || {};
  /* Google counts days in Pacific time and keeps finishing the newest one: the morning run reads "yesterday" while it is
     still evening in California, so the last day (yesterday in Pacific time or later) is preliminary */
  const ptToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const prelim = !!d.last_day && String(d.last_day).slice(0, 10) >= new Date(new Date(ptToday + "T12:00:00Z").getTime() - 864e5).toISOString().slice(0, 10);
  const ctr = (c: any, i: any) => pct(n(c), n(i));
  const ctr3 = d.ctr3 != null ? n(d.ctr3) : CTR_DEFAULT;
  const dPos = (r: D) => (r.prev_pos != null && r.pos != null ? n(r.prev_pos) - n(r.pos) : null);
  const chg = (r: D) => <>{r.prev_clicks != null && (n(r.clicks) || n(r.prev_clicks)) ? <Delta now={n(r.clicks)} prev={n(r.prev_clicks)} /> : null}{dPos(r) != null && Math.abs(dPos(r)!) >= 0.5 ? <small className={dPos(r)! > 0 ? "up" : "down"}> {dPos(r)! > 0 ? "▲" : "▼"}{fmt(Math.abs(dPos(r)!), 1)} hely</small> : null}</>;
  const qcols = [
    { k: "query", l: "Keresés", r: (r: D) => <span className="cellwrap">{r.query}<br /><span className="mut">{short(r.page)}</span></span> },
    { k: "clicks", l: "Kattintás", num: true, r: (r: D) => <b>{fmt(r.clicks)}</b> },
    { k: "impressions", l: "Megjelenés", num: true, r: (r: D) => fmt(r.impressions) },
    { k: "ctr", l: "CTR", num: true, r: (r: D) => ctr(r.clicks, r.impressions) },
    { k: "pos", l: "Helyezés", num: true, r: (r: D) => posChip(n(r.pos)) },
    { k: "prev_clicks", l: "Változás", num: true, r: chg },
  ];
  /* the opportunity: how many more clicks the 1–3. place would bring, with our own click rate there (or the industry one) */
  const opp = (r: D) => Math.max(0, Math.round(n(r.impressions) * ctr3 - n(r.clicks)));
  const ncols = [...qcols, { k: "opp", l: "Lehetőség", num: true, r: (r: D) => <span className="chip gold" title={`Ennyivel több kattintás jöhetne az 1–3. helyen (${d.ctr3 != null ? "a saját" : "iparági"} ${fmt(ctr3 * 100, 1)}%-os kattintási aránnyal)`}>+{fmt(opp(r))}</span> },
    { k: "x", l: "", r: (r: D) => <button className="adm-ibtn sm" onClick={(e) => { e.stopPropagation(); setSeo(r); }}>✦ Javaslat</button> }];
  const lists: Record<string, { rows: D[]; cols: any[]; sub: string; empty: string }> = {
    queries: { rows: d.queries, cols: qcols, sub: "A legtöbb kattintást hozó keresések, mellettük a változás az előző időszakhoz (kattintás és helyezés).", empty: "Nincs keresés." },
    pages: { rows: d.pages, sub: "Melyik oldal (cikk) hozza a legtöbb kattintást a Google-ből. Kattints egy sorra: az oldal részletei.", empty: "Nincs oldal.", cols: [
      { k: "page", l: "Oldal", r: (r: D) => <span className="cellwrap">{short(r.page)}</span> },
      { k: "clicks", l: "Kattintás", num: true, r: (r: D) => <b>{fmt(r.clicks)}</b> }, { k: "impressions", l: "Megjelenés", num: true, r: (r: D) => fmt(r.impressions) },
      { k: "ctr", l: "CTR", num: true, r: (r: D) => ctr(r.clicks, r.impressions) }, { k: "pos", l: "Helyezés", num: true, r: (r: D) => posChip(n(r.pos)) },
      { k: "queries", l: "Kulcsszó", num: true, r: (r: D) => fmt(r.queries) }, { k: "prev_clicks", l: "Változás", num: true, r: chg },
      { k: "f", l: "", r: (r: D) => <button className="adm-ibtn sm" onClick={(e) => { e.stopPropagation(); setFl({ ...fl, page: r.page }); }}>Szűrés</button> }] },
    near: { rows: [...(d.near || [])].sort((a: D, b: D) => opp(b) - opp(a)), cols: ncols, sub: `Átlagosan a 8–20. helyen: a cikk bővítésével, jobb címmel és belső linkekkel feljöhetnek. A „Lehetőség” ${d.ctr3 != null ? `a saját, 1–3. helyen mért ${fmt(ctr3 * 100, 1)}%-os kattintási arányoddal` : `iparági ${fmt(ctr3 * 100)}%-kal (a sajátod 200 megjelenés után lép a helyére)`} számol.`, empty: "Most nincs ilyen kulcsszó." },
    low: { rows: d.low_ctr, cols: qcols, sub: "Az első oldalon vagyunk, sokan látják, de kevesen kattintanak: a cím és a leírás újraírása segít.", empty: "Nincs ilyen kulcsszó." },
    new: { rows: d.new_queries, sub: "Az elmúlt 7 napban először megjelent keresések: új cikkek ötletei.", empty: "Nincs új keresés.", cols: [
      { k: "query", l: "Keresés" }, { k: "impressions", l: "Megjelenés", num: true, r: (r: D) => fmt(r.impressions) }, { k: "clicks", l: "Kattintás", num: true, r: (r: D) => fmt(r.clicks) },
      { k: "first", l: "Először", r: (r: D) => new Date(r.first).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) }] },
  };
  const L = lists[view];
  const flt = !!(fl.country || fl.device || fl.page || fl.q || fl.brand !== "all");
  const br = d.brand || {}, types: D[] = (d.types || []).filter((x: D) => x.k !== "web"), tq: D[] = d.type_queries || [], bing = d.bing || {};
  /* the days Google gave nothing for are left out (not drawn as 0); the dashed line only when the period before was measured */
  /* a day with no impressions has no position (Google gives 0, which would be drawn as 1st place) */
  const posOf = (x?: D) => (x && n(x.impressions) > 0 && x.pos != null && n(x.pos) > 0 ? -n(x.pos) : undefined);
  const chartData = ((d.trend || []) as D[]).map((x, i) => ({ x, i })).filter(({ x }) => (metric === "pos" ? posOf(x) != null : x.clicks != null || x.impressions != null))
    .map(({ x, i }) => ({ t: x.t, v: metric === "pos" ? posOf(x)! : n(x[metric]), p: !hasPrev ? undefined : metric === "pos" ? posOf(d.prev_trend?.[i]) : n(d.prev_trend?.[i]?.[metric]) }));
  const exactNote = d.filtered ? "Szűrt nézet: a keresés × oldal sorokból, amelyekből a Google kihagyja az anonimizált kereséseket, ezért kisebb."
    : d.exact ? "Pontos számok: a Google napi összesítőjéből (ez megegyezik a Search Console felületével)."
    : d.exact_from ? `${dShort(d.exact_from)}-tól pontos (a Google napi összesítője); előtte csak a keresés × oldal sorok vannak meg, amelyek az anonimizált keresések nélkül kisebbek.`
    : "A keresés × oldal sorokból (a napi összesítő az első lehúzás után jön): az anonimizált keresések nélkül, ezért kisebb lehet.";
  return (
    <div className="g">
      <Setup only={["gsc"]} />
      <FreshRow srcs={["gsc", "index"]} />
      <Band label={`Kattintás a Google-ből · ${daysLabel(n(d.days))}${d.from && d.last_day ? " · " + dShort(d.from) + (d.from !== d.last_day ? " – " + dShort(d.last_day) : "") : ""}${prelim ? ` · ${dShort(d.last_day)} előzetes` : ""}`} value={n(t.clicks)} now={n(t.clicks)} prev={P0(n(pv.clicks))} sentence={<><b>{compact(n(t.impressions))}</b> megjelenés, <b>{ctr(t.clicks, t.impressions)}</b> kattintási arány, átlagosan a <b>{t.pos ? fmt(n(t.pos), 1) : "–"}.</b> helyen ({dShort(d.from)} – {dShort(d.last_day)}; a mai, félkész nap nélkül{prelim ? <>; az utolsó nap, {dShort(d.last_day)}, <b>előzetes</b>: a Google csendes-óceáni idő szerint számol, és még pótolja</> : null}). {exactNote} {hasPrev ? null : "Az előző ugyanilyen hosszú időszakra még nincs teljes adat, ezért nincs változás. "}<b>{fmt((d.near || []).length)}</b> keresés van majdnem az első oldalon.</>} side={<Spark values={(d.trend || []).filter((x: D) => x.clicks != null).map((x: D) => n(x.clicks))} h={92} />} />
      <Kpi kind="api" to="@next" tone="butter" className="s4" icon={P.eye} l="Megjelenés" v={compact(n(t.impressions))} now={n(t.impressions)} prev={P0(n(pv.impressions))} spark={(d.trend || []).filter((x: D) => x.impressions != null).map((x: D) => n(x.impressions))} color={SERIES[0]} />
      <Kpi spark={((d.trend || []) as D[]).filter((x) => n(x.impressions) > 0).map((x) => (n(x.clicks) / n(x.impressions)) * 100)} kind="api" to="@next" tone="pink" className="s4" icon={P.target} l="Kattintási arány (CTR)" v={ctr(t.clicks, t.impressions)} now={n(t.impressions) ? n(t.clicks) / n(t.impressions) : 0} prev={hasPrev ? (n(pv.impressions) ? n(pv.clicks) / n(pv.impressions) : 0) : undefined} sub={hasPrev ? `előtte: ${ctr(pv.clicks, pv.impressions)}` : "előtte: még nincs adat"} />
      <Kpi spark={((d.trend || []) as D[]).filter((x) => n(x.impressions) > 0 && n(x.position ?? x.pos) > 0).map((x) => -n(x.position ?? x.pos))} kind="api" to="@next" tone="sky" className="s4" icon={P.layers} l="Átlagos helyezés" v={t.pos ? fmt(n(t.pos), 1) : "–"} now={n(t.pos)} prev={hasPrev && pv.pos ? n(pv.pos) : undefined} invert sub={`${fmt(t.queries)} keresés · ${fmt(t.pages)} oldal`} />
      <Card className="s12" icon={P.search} title="Szűrők" sub="Ország, eszköz, oldal, szöveg és márkás / nem márkás keresés. A szűrt számok a keresés × oldal sorokból jönnek (az anonimizált keresések nélkül).">
        <div className="adm-row">
          <select className="adm-in sm" value={fl.country} onChange={(x) => setFl({ ...fl, country: x.target.value })}><option value="">Minden ország</option>{(d.countries || []).map((c: D) => <option key={c.k} value={c.k}>{COUNTRY(c.k)}</option>)}{fl.country && !(d.countries || []).some((c: D) => c.k === fl.country) && <option value={fl.country}>{COUNTRY(fl.country)}</option>}</select>
          <select className="adm-in sm" value={fl.device} onChange={(x) => setFl({ ...fl, device: x.target.value })}><option value="">Minden eszköz</option>{Object.entries(DEV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input className="adm-in sm" style={{ flex: "1 1 200px" }} placeholder="Szöveg a keresésben…" value={qIn} onChange={(x) => setQIn(x.target.value)} />
          <div className="adm-seg sm">{([["all", "Mind"], ["brand", "Márkás"], ["nonbrand", "Nem márkás"]] as const).map(([k, l]) => <button key={k} aria-pressed={fl.brand === k} onClick={() => setFl({ ...fl, brand: k })}>{l}</button>)}</div>
          {fl.page && <span className="chip">{short(fl.page)} <button className="lnk" onClick={() => setFl({ ...fl, page: "" })}>×</button></span>}
          {flt && <button className="lnk" onClick={() => { setFl({ country: "", device: "", page: "", q: "", brand: "all" }); setQIn(""); }}>Szűrők törlése</button>}
        </div>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          <Mini l="Márkás keresés (InkAge)" v={fmt(br.brand?.clicks)} sub={`${compact(n(br.brand?.impressions))} megjelenés`} />
          <Mini l="Nem márkás keresés" v={fmt(br.other?.clicks)} sub={`${compact(n(br.other?.impressions))} megjelenés · ${pct(n(br.other?.clicks), n(br.brand?.clicks) + n(br.other?.clicks))} a kattintásokból`} />
        </div>
        {/* the splits come from the query rows, never the exact total: say how much of the headline they cover */}
        {!flt && <p className="note">A márkás / nem márkás, az ország- és az eszközbontás a keresési sorokból jön: együtt {fmt(rt.clicks)} kattintást és {fmt(rt.impressions)} megjelenést fednek le a fenti {fmt(t.clicks)} / {fmt(t.impressions)}-ból (a Google az anonimizált kereséseket nem bontja).</p>}
      </Card>
      <IndexCard />
      <Card className="s12" icon={P.traffic} title="Naponta" sub={`${dShort(d.from)} – ${dShort(d.last_day)}. A Google 2–3 nap késéssel adja az adatot; a mai, félkész nap nem látszik (a végén zuhanásnak tűnne), az utolsó pont előzetes (a Google még pótolja). Ahol a Google semmit nem adott, ott nincs pont. Szaggatott vonal: az előző ugyanilyen hosszú időszak (ha már mértük). A helyezésnél a magasabb pont a jobb hely.`}
        right={<><div className="adm-seg sm"><button aria-pressed={metric === "clicks"} onClick={() => setMetric("clicks")}>Kattintás</button><button aria-pressed={metric === "impressions"} onClick={() => setMetric("impressions")}>Megjelenés</button><button aria-pressed={metric === "pos"} onClick={() => setMetric("pos")}>Helyezés</button></div><SyncButton done={load} /></>}>
        <ChartBox data={chartData} marks={[...((d.updates || []) as D[]).map((u) => ({ t: String(u.begin_at).slice(0, 10), label: "Google-frissítés: " + String(u.title || "").slice(0, 60), color: "#c98500" })),
          ...(prelim ? [{ t: String(d.last_day).slice(0, 10), label: "előzetes: a Google még pótolja", color: "#8e8e93" }] : [])]} label={metric === "clicks" ? "Kattintás" : metric === "impressions" ? "Megjelenés" : "Helyezés (mínusz előjellel: fent a jobb)"} color={metric === "clicks" ? ACC : metric === "impressions" ? SERIES[0] : SERIES[2]} name={"google-" + metric} />
      </Card>
      <Card className="s12" icon={P.target} title="Keresési radar" sub="Minden buborék egy keresés. Minél közelebb van a közepéhez, annál előrébb vagy a Google-ben; a nagy buborékot sokan látják, az erős színűre sokan kattintanak. A kiemelt gyűrű a majdnem első oldal: itt a leggyorsabb a nyerés.">
        <div className="mapgrid"><KeywordRadar rows={d.queries || []} onPick={(r) => setOpenPg(r.page)} /><BarList items={(d.near || []).slice(0, 8).map((r: D) => ({ k: r.query, n: n(r.impressions), sub: `${fmt(n(r.pos), 1)}. hely` }))} accent empty="Most nincs majdnem első oldalas keresés." /></div>
      </Card>
      <Card className="s12" icon={P.search} title={{ queries: "Keresések", pages: "Oldalak és cikkek", near: "Majdnem első oldal", low: "Sokan látják, kevesen kattintanak", new: "Új keresések" }[view]} sub={L.sub}
        right={<div className="adm-seg sm" role="group">{([["queries", "Keresések"], ["pages", "Oldalak"], ["near", `Majdnem 1. oldal · ${(d.near || []).length}`], ["low", "Alacsony CTR"], ["new", "Új"]] as const).map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k as typeof view)}>{l}</button>)}</div>}>
        <Tbl name={"google-" + view} rows={L.rows || []} cols={L.cols} empty={L.empty} onRow={view === "new" ? undefined : (r) => setOpenPg(r.page)} />
      </Card>
      <Card className="s6" icon={P.eye} title="Kép, videó, Discover, Hírek" sub="A Google többi keresési felülete (napi összesítő). Egy tetoválás-appnál a képkeresés különösen fontos: itt látszik, hányszor jelentünk meg képként.">
        {types.length ? <div className="mini-stats" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>{types.map((x) => <Mini key={x.k} l={TYPE[x.k] || x.k} v={fmt(x.clicks)} sub={<>{compact(n(x.impressions))} megjelenés · <Delta now={n(x.impressions)} prev={n(x.prev_impressions)} /></>} />)}</div>
          : <Empty t="A következő Google-lehúzás után jelenik meg (a kép-, videó-, Discover- és Hírek-összesítő új)." icon={P.eye} />}
        {tq.length > 0 && <Tbl name="google-kep-video" rows={tq} cols={[{ k: "type", l: "Felület", r: (r) => TYPE[r.type] || r.type }, { k: "query", l: "Keresés" }, { k: "impressions", l: "Megjelenés", num: true, r: (r) => fmt(r.impressions) }, { k: "clicks", l: "Kattintás", num: true, r: (r) => fmt(r.clicks) }, { k: "pos", l: "Helyezés", num: true, r: (r) => (r.pos ? posChip(n(r.pos)) : "–") }]} />}
      </Card>
      <Card className="s6" icon={P.search} title="Bing" sub={`A Bing Webmaster Tools adatai (${d.days} nap): a ChatGPT keresője és a Copilot is ebből dolgozik. Részletek a SEO-ellenőrzés oldalon.`}>
        {n(bing.impressions) || (bing.queries || []).length ? <>
          <div className="mini-stats" style={{ gridTemplateColumns: "1fr 1fr" }}><Mini l="Megjelenés" v={fmt(bing.impressions)} sub={<Delta now={n(bing.impressions)} prev={n(bing.prev_impressions)} />} /><Mini l="Kattintás" v={fmt(bing.clicks)} sub={<Delta now={n(bing.clicks)} prev={n(bing.prev_clicks)} />} /></div>
          <BarList items={(bing.queries || []).map((x: D) => ({ k: x.query, n: n(x.impressions), sub: `${fmt(x.clicks)} katt. · ${fmt(n(x.pos), 1)}. hely` }))} max={8} />
        </> : <BingEmpty />}
      </Card>
      {openPg && <PageDrawer page={openPg} days={d.days} close={() => setOpenPg(null)} onFilter={() => { setFl({ ...fl, page: openPg }); setOpenPg(null); }} />}
      {seo && <SeoDrawer q={seo} close={() => setSeo(null)} />}
      <Card className="s12" icon={P.target} title="Kulcsszavak követése" sub="A fontos keresések helyezése napról napra (a Google 2–3 nap késéssel adja), a kattintás és a megjelenés az elmúlt 4 hétben, az oldal, amelyik nyer rá, a Bing-helyezés, és országonként a helyezés. Adj hozzá egy keresést, vagy válassz a javaslatokból." src="gsc"><Ranks /></Card>
      <Card className="s12" icon={P.bolt} title="Oldalsebesség (Core Web Vitals)" sub="A főoldal, az /app és a három legtöbbet kattintott cikk minden reggel lemérve, telefonon és számítógépen (PageSpeed Insights). Labor: a Google egyszeri mérése; valódi: a látogatók mérése az elmúlt 28 napból (ott, ahol a Google-nek elég adata van; ha egy oldalnak kevés, a Google az egész webhely számait adja, ezt a sor jelöli). Zöld: jó, sárga: javítandó, piros: lassú."><Cwv /></Card>
      <More label="Részletek: cikkek × nyelvek, országok, eszközök">
      <Card className="s12" icon={P.doc} title="Cikkek × nyelvek" sub="A tudásbázis-cikkek megtekintései nyelvenként (a saját mérésünkből), vagy a Google-kattintások nyelvenként. A Google-nél a nyelv a cím ?lang= részéből jön (vagy a /xx/ előtagból; jelölés nélkül magyar). Az üres cellák a lehetőségek.">
        <ArticleMatrix days={days} />
      </Card>
      <Card className="s6" icon={P.globe} title="Országok" sub="Kattintás országonként. Kattints: szűrés erre az országra."><BarList items={(d.countries || []).map((r: D) => ({ k: r.k, n: n(r.clicks), sub: `${compact(n(r.impressions))} megjelenés` }))} fmtK={COUNTRY} onPick={(k) => setFl({ ...fl, country: k })} /></Card>
      <Card className="s6" icon={P.eye} title="Eszközök"><Donut items={(d.devices || []).map((r: D) => ({ k: r.k, n: n(r.clicks) }))} center={fmt(t.clicks)} sub="kattintás" label={(k) => DEV[k] || k} color={(k) => ({ MOBILE: SERIES[0], DESKTOP: SERIES[2], TABLET: SERIES[6] } as D)[k] || "#6E6E73"} size={150} onPick={(k) => setFl({ ...fl, device: k })} /></Card>
      </More>
    </div>
  );
}

export function PageDrawer({ page, close, days = 90, onFilter }: { page: string; close: () => void; days?: number; onFilter?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [x, setX] = useState<D | null>(null);
  const [m, setM] = useState<"clicks" | "impressions" | "pos">("clicks");
  useEffect(() => { rpc(sb, "admin_gsc_page", { p_page: page, p_days: days }).then(({ data }) => setX(data || {})); }, [sb, page, days]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const tr: D[] = x?.trend || [];
  const tc = tr.reduce((a: number, r: D) => a + n(r.clicks), 0), ti = tr.reduce((a: number, r: D) => a + n(r.impressions), 0);
  const tp = ti ? tr.reduce((a: number, r: D) => a + n(r.pos) * n(r.impressions), 0) / ti : 0;
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Oldal részletei">
        <div className="c-h"><div><div><span className="eyebrow">Google · {days} nap</span><h2 style={{ fontSize: 18, marginTop: 6, wordBreak: "break-all" }}>{short(page)}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {!x ? <div className="skel" style={{ height: 200 }} /> : (
          <>
            <div className="mini-stats" style={{ gridTemplateColumns: "repeat(5,1fr)" }}><Mini l="Kattintás" v={tc} /><Mini l="Megjelenés" v={compact(ti)} /><Mini l="CTR" v={pct(tc, ti)} /><Mini l="Átl. helyezés" v={tp ? fmt(tp, 1) : "–"} /><Mini l="Megtekintés a webhelyen" v={n(x.views)} /></div>
            <div className="adm-seg sm" style={{ alignSelf: "flex-start" }}><button aria-pressed={m === "clicks"} onClick={() => setM("clicks")}>Kattintás</button><button aria-pressed={m === "impressions"} onClick={() => setM("impressions")}>Megjelenés</button><button aria-pressed={m === "pos"} onClick={() => setM("pos")}>Helyezés</button></div>
            {tr.length ? <TrendChart data={tr.map((r: D) => ({ t: r.t, v: m === "pos" ? -n(r.pos) : n(r[m]) }))} label={m === "clicks" ? "Kattintás" : m === "impressions" ? "Megjelenés" : "Helyezés (fent a jobb)"} height={180} /> : <Empty t="Ehhez az oldalhoz még nincs Google-adat." />}
            <h3>Keresések, amikre megjelenik</h3>
            <Tbl name="oldal-keresesek" rows={x.queries || []} empty="Nincs keresés." cols={[
              { k: "query", l: "Keresés", r: (r) => <span className="cellwrap">{r.query}</span> }, { k: "clicks", l: "Kattintás", num: true, r: (r) => <b>{fmt(r.clicks)}</b> },
              { k: "impressions", l: "Megjelenés", num: true, r: (r) => fmt(r.impressions) }, { k: "pos", l: "Helyezés", num: true, r: (r) => posChip(n(r.pos)) },
            ]} />
            <h3>Országok</h3>
            <Tbl name="oldal-orszagok" rows={x.countries || []} csv={false} empty="Nincs ország." cols={[
              { k: "k", l: "Ország", r: (r) => COUNTRY(r.k) }, { k: "clicks", l: "Kattintás", num: true }, { k: "impressions", l: "Megjelenés", num: true, r: (r) => fmt(r.impressions) }, { k: "pos", l: "Helyezés", num: true, r: (r) => (r.pos ? posChip(n(r.pos)) : "–") },
            ]} />
            {(x.devices || []).length > 0 && <><h3>Eszközök</h3><BarList items={(x.devices as D[]).map((r) => ({ k: r.k, n: n(r.impressions), sub: `${fmt(r.clicks)} kattintás` }))} fmtK={(k) => DEV[k] || k} /></>}
            <div className="adm-row"><a className="adm-ibtn gold" href={page} target="_blank" rel="noreferrer">Oldal megnyitása ↗</a>{onFilter && <button className="adm-ibtn" onClick={onFilter}>Az oldal szűrése erre</button>}</div>
          </>
        )}
      </aside>
    </Layer>
  );
}


/* ---------- articles × languages ---------- */
export function ArticleMatrix({ days }: { days: number }) {
  const { d, e } = useRpc("admin_articles", { p_days: days || 3650 }, [days]);
  const [m, setM] = useState<"views" | "gsc">("views");
  if (e) return <div className="alert err">{e}</div>;
  if (!d) return <div className="skel" style={{ height: 160 }} />;
  const gscOn = (d.gsc || []).length > 0;
  const allArts: D[] = d.articles || [];
  const arts: D[] = [...allArts].sort((a, b) => (m === "views" ? n(b.n) - n(a.n) : n(b.clicks) - n(a.clicks) || n(b.impressions) - n(a.impressions))).slice(0, 25);
  const val = (slug: string, lg: string) => m === "views" ? n((d.cells || []).find((c: D) => c.slug === slug && c.lg === lg)?.n) : n((d.gsc || []).find((c: D) => c.slug === slug && c.lg === lg)?.clicks);
  const cols = m === "views" ? ((d.langs || []) as D[]).map((x) => x.k as string).slice(0, 14) : Array.from(new Set((d.gsc || []).map((c: D) => c.lg as string))).slice(0, 14) as string[];
  const max = Math.max(1, ...arts.flatMap((a) => cols.map((l) => val(a.slug, l))));
  if (!arts.length) return <Empty t="Még nincs cikk-megtekintés vagy Google-adat ebben az időszakban." ghost />;
  return (
    <>
      {gscOn && <div className="adm-seg sm" style={{ alignSelf: "flex-start" }}><button aria-pressed={m === "views"} onClick={() => setM("views")}>Megtekintés</button><button aria-pressed={m === "gsc"} onClick={() => setM("gsc")}>Google-kattintás</button></div>}
      <div className="tw"><table className="tb amx">
        <thead><tr><th>Cikk</th>{cols.map((l) => <th key={l} className="num" title={lang(l)}>{l.toUpperCase()}</th>)}<th className="num">Össz.</th>{m === "views" ? <th className="num">Appba ment</th> : <th className="num">Megjelenés</th>}</tr></thead>
        <tbody>{arts.map((a) => (
          <tr key={a.slug}><td><a href={"/tudastar/" + a.slug} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{a.slug}</a></td>
            {cols.map((l) => { const v = val(a.slug, l); return <td key={l} className="num"><span className="amc" style={{ background: v ? `color-mix(in srgb, var(--acc) ${Math.round(10 + 75 * Math.sqrt(v / max))}%, transparent)` : undefined, color: v / max > 0.45 ? "#fff" : undefined }}>{v || ""}</span></td>; })}
            {m === "views" ? <><td className="num"><b>{fmt(a.n)}</b></td><td className="num">{fmt(a.to_app)} {pctCell(n(a.to_app), n(a.sessions))}</td></>
              : <><td className="num"><b>{fmt(a.clicks)}</b></td><td className="num">{compact(n(a.impressions))}</td></>}</tr>
        ))}</tbody>
      </table></div>
    </>
  );
}

/* Is each page in Google? The URL Inspection API's answer for every sitemap page in every language, the ones checked
   longest ago first, every morning: indexed or not, why not, since when, which canonical Google chose. */
const COV: Record<string, string> = { "Submitted and indexed": "Indexelve", "Indexed, not submitted in sitemap": "Indexelve (sitemap nélkül)", "Crawled - currently not indexed": "Beolvasta, de nem indexelte",
  "Discovered - currently not indexed": "Megtalálta, még nem olvasta be", "URL is unknown to Google": "A Google még nem ismeri", "Duplicate, Google chose different canonical than user": "Másolatnak tartja",
  "Alternate page with proper canonical tag": "Nyelvi változat (rendben)", "Page with redirect": "Átirányít", "Excluded by ‘noindex’ tag": "noindex miatt kizárva",
  "Duplicate without user-selected canonical": "Másolat, canonical nélkül", "Not found (404)": "Nem található (404)", "Soft 404": "Üres oldal (soft 404)",
  /* the Hungarian states of the checks made before the request asked for English (they fade out as pages are re-checked) */
  "Beküldött és indexelt": "Indexelve", "A Google nem ismeri az URL-t": "A Google még nem ismeri", "Párhuzamos oldal felhasználó által választott gyűjtőoldal nélkül": "Másolat, canonical nélkül",
  "Alternatív oldal megfelelő kanonikus címkével": "Nyelvi változat (rendben)", "Felfedezve – jelenleg nincs indexelve": "Megtalálta, még nem olvasta be", "Feltérképezve – jelenleg nincs indexelve": "Beolvasta, de nem indexelte" };
/* in order: indexed, or a language version whose canonical points to the indexed one (that is how it should be) */
const idxOk = (r: D) => r.verdict === "PASS" || /^(Alternate page with proper canonical tag|Alternatív oldal megfelelő kanonikus címkével)$/.test(String(r.coverage || ""));
const VER: Record<string, string> = { PASS: "indexelve", NEUTRAL: "kizárva", FAIL: "hiba", PARTIAL: "részben" };
export function IndexCard() {
  const { d } = useRpc("admin_gsc_index", undefined, []);
  if (!d || !n(d.all)) return <Card className="s12" icon={P.search} title="Indexelés a Google-ben" sub="Minden oldal minden nyelven: benne van-e a Google-ben, és mikor olvasta be utoljára. Minden reggel ellenőrzi."><Empty t="Az első ellenőrzés holnap reggel fut le (vagy az „Adatok lehúzása most” után)." icon={P.search} /></Card>;
  const rows: D[] = d.rows || [], bad = rows.filter((r) => !idxOk(r)), dropped: D[] = ((d.dropped || []) as D[]).filter((r) => !idxOk(r)), sms: D[] = d.sitemaps || [];
  const pass = rows.length ? rows.length - bad.length : n(d.pass), all = rows.length || n(d.all);
  /* by language, the same "in order" count (the ?lang= part of the address, none: Hungarian) */
  const byLang = new Map<string, { k: string; n: number; pass: number }>();
  rows.forEach((r) => { const k = String(r.url).match(/[?&]lang=([a-z]{2})/)?.[1] || "hu", o = byLang.get(k) || { k, n: 0, pass: 0 }; o.n++; if (idxOk(r)) o.pass++; byLang.set(k, o); });
  const langs = Array.from(byLang.values()).sort((a, b) => b.n - a.n);
  const inSm = Math.max(0, ...sms.map((s) => n(s.in_sitemap)));
  return (
    <Card className="s12" icon={P.search} title="Indexelés a Google-ben" sub="Minden oldal a sitemapból, minden nyelvi változatával: benne van-e a Google-ben, miért nem, mikor változott, és melyik canonicalt választotta a Google. Naponta a legrégebben ellenőrzöttek kerülnek sorra (a Google napi kerete 2 000 cím). A mobilos vizsgálatot a Google 2023-ban megszüntette."
      right={<span className={"chip " + (bad.length ? "warn" : "good")}>{fmt(pass)} / {fmt(all)} rendben{inSm ? ` · sitemapban ${fmt(inSm)}` : ""} · {ago(d.checked)}</span>}>
      {dropped.length > 0 && <div className="alert err">Kiesett az indexből: {dropped.slice(0, 5).map((x) => `${short(x.url) || "/"} (${COV[x.coverage] || x.coverage || "?"}, ${ago(x.changed_at)})`).join(" · ")}{dropped.length > 5 ? ` és még ${dropped.length - 5}` : ""}</div>}
      <p className="note">Rendben: indexelve, vagy nyelvi változat, amelynek a canonicalja a már indexelt oldalra mutat (a Google így kezeli a nyelvi változatokat).</p>
      {langs.length > 1 && <div className="grw-row">{langs.map((x) => <span key={x.k} className={"chip " + (n(x.pass) === n(x.n) ? "good" : "")}>{String(x.k).toUpperCase()}: {fmt(x.pass)} / {fmt(x.n)}</span>)}</div>}
      {sms.length > 0 && <div className="grw-row">{sms.map((s) => <span key={s.path} className={"chip " + (n(s.errors) ? "bad" : n(s.warnings) ? "warn" : "")}>{short(s.path)}: {fmt(s.submitted)} beküldve · olvasva {s.last_downloaded ? ago(s.last_downloaded) : "–"}{n(s.errors) ? ` · ${fmt(s.errors)} hiba` : ""}</span>)}</div>}
      <Tbl name="indexeles" rows={rows} cols={[
        { k: "url", l: "Oldal", r: (r) => <a href={r.url} target="_blank" rel="noreferrer" className="cellwrap" style={{ textDecoration: "none" }}>{String(r.url).replace("https://inkage.app", "") || "/"}</a> },
        { k: "verdict", l: "Állapot", r: (r) => <span className={"chip " + (idxOk(r) ? "good" : r.verdict === "NEUTRAL" ? "" : "warn")}>{COV[r.coverage] || r.coverage || (r.verdict === "PASS" ? "Indexelve" : "Ismeretlen")}</span> },
        { k: "changed_at", l: "Változott", r: (r) => (r.changed_at ? <span title={`előtte: ${VER[r.prev_verdict] || r.prev_verdict || "–"}`}>{ago(r.changed_at)} <small className="mut">({VER[r.prev_verdict] || r.prev_verdict || "–"} →)</small></span> : <span className="mut">–</span>) },
        { k: "canonical_google", l: "Canonical", r: (r) => (!r.canonical_google ? <span className="mut">–</span> : r.canonical_user && r.canonical_google !== r.canonical_user ? <span className="chip warn" title={`A miénk: ${r.canonical_user}`}>Google: {short(r.canonical_google) || "/"}</span> : <span className="mut">egyezik</span>) },
        { k: "last_crawl", l: "Utoljára beolvasva", r: (r) => (r.last_crawl ? ago(r.last_crawl) : "–") },
        { k: "checked_at", l: "Ellenőrizve", r: (r) => ago(r.checked_at) },
      ]} />
    </Card>
  );
}

/* ---------- tracked keywords, day by day ---------- */
function Ranks() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rkDays, rkCtl] = useCardDays("ranks", 28);
  const { d, load } = useRpc("admin_ranks", { p_days: rkDays }, [rkDays]);
  const [q, setQ] = useState("");
  const track = async (query: string, on = true) => { await rpc(sb, "admin_track_query", { p_q: query, p_on: on }); toast(on ? "Követve" : "Levéve"); setQ(""); load(); };
  if (!d) return <div className="skel" style={{ height: 160 }} />;
  const tr: D[] = d.tracked || [], sug: D[] = d.suggest || [];
  return (
    <>
      <div className="adm-row" style={{ justifyContent: "flex-end" }}>{rkCtl}</div>
      <form className="adm-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) track(q.trim()); }}><input className="adm-in" style={{ flex: "1 1 260px" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="pl. tetoválás öregedése" /><button className="adm-ibtn gold">Követés</button></form>
      {sug.length > 0 && <div className="sug">{sug.slice(0, 8).map((x) => <button key={x.query} className="chip" onClick={() => track(x.query)}>+ {x.query} <small>{fmt(n(x.pos), 1)}.</small></button>)}</div>}
      {tr.length ? <div className="ranks">{tr.map((t) => { const ds: D[] = t.days || [], last = ds.slice(-1)[0], first = ds.find((x) => x.pos != null);
        return (
          <div key={t.query} className="rk-i">
            <div className="rk-h"><b>{t.query}</b>{last ? posChip(n(last.pos)) : <span className="chip">nincs adat</span>}{first && last && n(first.pos) && n(last.pos) ? <span className={n(last.pos) < n(first.pos) ? "up" : n(last.pos) > n(first.pos) ? "down" : ""}>{n(last.pos) < n(first.pos) ? "▲" : n(last.pos) > n(first.pos) ? "▼" : "="} {fmt(Math.abs(n(first.pos) - n(last.pos)), 1)}</span> : null}<button className="lnk" onClick={() => track(t.query, false)}>levesz</button></div>
            {ds.length > 1 ? <Spark values={ds.map((x) => -n(x.pos))} h={40} /> : <span className="note">Még nincs napi adat.</span>}
            <div className="rk-c"><span><b>{fmt(t.clicks28)}</b> katt. · {compact(n(t.impressions28))} megj. (4 hét)</span>{t.page && <span>Nyerő oldal: <b>{short(t.page) || "/"}</b></span>}<span>Bing: {t.bing_pos ? <b>{fmt(n(t.bing_pos), 1)}.</b> : <span className="mut">nincs adat</span>}</span></div>
            <div className="rk-c">{((t.countries || []) as D[]).map((c) => <span key={c.k}>{COUNTRY(c.k)}: <b>{fmt(n(c.pos), 1)}.</b> · {fmt(c.clicks)} katt.</span>)}</div>
          </div>); })}</div> : <Empty t="Még nincs követett keresés." icon={P.target} />}
    </>
  );
}

/* ---------- page speed: the lab run and the real visitors apart, the trend ---------- */
const CWV_OK = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25], perf: [90, 50], fcp: [1800, 3000], ttfb: [800, 1800] } as const;
const grade = (k: keyof typeof CWV_OK, v: number | null | undefined) => { if (v == null) return ""; const [a, b] = CWV_OK[k]; return k === "perf" ? (v >= a ? "good" : v >= b ? "warn" : "bad") : v <= a ? "good" : v <= b ? "warn" : "bad"; };
const ms = (k: keyof typeof CWV_OK, v: number | null | undefined) => (v == null ? <span className="mut">–</span> : <span className={"chip " + grade(k, v)}>{k === "cls" ? fmt(v, 2) : v >= 1000 ? fmt(v / 1000, 1) + " mp" : fmt(v) + " ms"}</span>);
function Cwv() {
  const { d } = useRpc("admin_cwv_list", undefined, []);
  const [sel, setSel] = useState("");
  if (!d) return <div className="skel" style={{ height: 140 }} />;
  const rows: D[] = d.latest || [];
  if (!rows.length) return <Empty t="Az első mérés a következő reggeli futáskor (05:40) készül el." icon={P.bolt} />;
  const key = sel || `${rows[0].url}|${rows[0].form}`;
  const tr: D[] = ((d.trend || []) as D[]).filter((x) => `${x.url}|${x.form}` === key);
  return <>
    <Tbl name="oldalsebesseg" rows={rows} onRow={(r) => setSel(`${r.url}|${r.form}`)} cols={[
      { k: "url", l: "Oldal", r: (r) => <span className="cellwrap">{short(r.url) || "/"} <span className="mut">· {r.form === "mobile" ? "telefon" : "számítógép"}</span>{r.field?.origin && <><br /><span className="chip" title="Ennek az oldalnak kevés a látogatója, ezért a Google a valódi méréseknél az egész webhely számait adja">valódi: az egész webhely adata</span></>}</span> },
      { k: "perf", l: "Pontszám (labor)", num: true, r: (r) => <span className={"chip " + grade("perf", r.perf)}>{fmt(r.perf)}</span> },
      { k: "lcp", l: "LCP labor", num: true, r: (r) => ms("lcp", r.lcp) },
      { k: "lcp_f", l: "LCP valódi", num: true, r: (r) => ms("lcp", r.field?.LARGEST_CONTENTFUL_PAINT_MS?.p) },
      { k: "inp", l: "INP valódi", num: true, r: (r) => ms("inp", r.inp ?? r.field?.INTERACTION_TO_NEXT_PAINT?.p) },
      { k: "cls", l: "CLS labor", num: true, r: (r) => ms("cls", r.cls) },
      { k: "cls_f", l: "CLS valódi", num: true, r: (r) => ms("cls", r.field?.CUMULATIVE_LAYOUT_SHIFT_SCORE ? n(r.field.CUMULATIVE_LAYOUT_SHIFT_SCORE.p) / 100 : null) },
      { k: "fcp", l: "FCP labor", num: true, r: (r) => ms("fcp", r.fcp) },
      { k: "ttfb", l: "TTFB labor", num: true, r: (r) => ms("ttfb", r.ttfb) },
      { k: "day", l: "Mérve", r: (r) => agoDay(String(r.day).slice(0, 10)) /* a day, not a moment: never "~14 órája" from UTC midnight */ },
    ]} />
    {tr.length > 1 ? <><h4>{short(key.split("|")[0]) || "/"} · {key.endsWith("mobile") ? "telefon" : "számítógép"}: pontszám és LCP az elmúlt 60 napban (kattints egy sorra a váltáshoz)</h4>
      <TrendChart data={tr.map((x) => ({ t: x.day, v: n(x.perf), p: Math.round(n(x.lcp) / 100) }))} label="Pontszám" prevLabel="LCP (tized mp)" height={160} /></> : <p className="note">A trend a második mérési nap után jelenik meg.</p>}
  </>;
}

/* ---------- a near-first-page search: what to change in the article, written by the AI, and how the result would look ---------- */
function SeoDrawer({ q, close }: { q: D; close: () => void }) {
  const [t, setT] = useState(""); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = MOCK ? { ok: true, json: { text: "1. Title: Fine line tetoválás öregedése: 7 tipp, hogy évekig szép maradjon\n2. Meta: Elmosódik a fine line? 7 bevált tipp, és nézd meg előre, milyen lesz 10, 30 és 50 év múlva. Próbáld ki!\n3. H2: Miért mosódik el a vékony vonal? · Az ápolás · 3 példa\n4. Belső link: /tudastar/tetovalas-oregedese, /tudastar/tetovalas-apolasa\n5. Hiányzik: képes példák." } }
      : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "seo", data: { kereses: q.query, oldal: q.page, megjelenes: q.impressions, kattintas: q.clicks, helyezes: q.pos } }) });
    setBusy(false); setT(r.ok ? r.json?.text || "" : r.json?.error || "Nem sikerült.");
  };
  const title = (t.match(/Title:\s*(.+)/i)?.[1] || "").trim(), meta = (t.match(/Meta[^:]*:\s*(.+)/i)?.[1] || "").trim();
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Cikkfrissítés">
        <div className="c-h"><div><div><span className="eyebrow">Majdnem első oldal · {fmt(n(q.pos), 1)}. hely</span><h2 style={{ fontSize: 19, marginTop: 6 }}>„{q.query}”</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><Mini l="Megjelenés" v={fmt(q.impressions)} /><Mini l="Kattintás" v={fmt(q.clicks)} /><Mini l="Oldal" v={short(q.page)} /></div>
        <button className="adm-ibtn gold" onClick={run} disabled={busy}>{busy ? "Írom…" : t ? "Újra" : "✦ MI-javaslat a cikk frissítésére"}</button>
        {t && <div className="ai-t">{t.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>}
        <h3>Így látszana a Google-ben</h3>
        <div className="serp"><span className="serp-u">inkage.app › {short(q.page).replace(/^\//, "").split("/").join(" › ")}</span><b>{title || "A cikk címe (az MI-javaslat után az új)"}</b><p>{meta || "A meta leírás: az MI-javaslat után itt látod, hogyan jelenne meg."}</p></div>
        <a className="adm-ibtn" href={q.page} target="_blank" rel="noreferrer">A cikk megnyitása ↗</a>
      </aside>
    </Layer>
  );
}
