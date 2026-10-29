"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Delta, Empty, Spark, StackedColumns, TrendChart, fmt, pct, SERIES } from "../charts";
import { Storefront } from "../wow";
import { countryName, flag } from "../visuals";
import { Band, Card, FreshRow, I, Kpi, Loading, MOCK, P, Tbl, ago, api, dt, n, rpc, type D, useRpc } from "../shared";
import { More } from "../extra";
import { toast } from "../phone";
import { SyncButton, agoDay } from "./social";

/* ---------- App Store + Google Play ---------- */
export const STARS = (r: number) => "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
const ST: Record<string, string> = { apple: "App Store", google: "Google Play" };
const SRC: Record<string, string> = { "App Store Search": "App Store-keresés", "App Store Browse": "Böngészés az App Store-ban", "Web Referrer": "Weboldalról", "App Referrer": "Más appból", "Unavailable": "Nem ismert", "Institutional Purchase": "Intézményi", "App Clip": "App Clip",
  "Google Play search": "Play-keresés", "Google Play explore": "Play böngészés", "Third-party referrers": "Weboldalról / más appból", "Google Search": "Google-keresés" };
const SYNC: Record<string, string> = { apple: "App Store", google: "Google Play", apple_reviews: "App Store: értékelések", apple_sales: "App Store: letöltések", apple_analytics: "App Store: analitika",
  google_reviews: "Google Play: értékelések", google_installs: "Google Play: telepítések", google_quality: "Google Play: minőség", competitors: "Versenytársak", aso: "ASO-helyezések" };
const PER = 20;

export function Stores({ days }: { days: number }) {
  const { d, e, load } = useRpc("admin_stores", { p_days: days || 3650 }, [days]);
  const [st, setSt] = useState<D | null>(null);
  const [f, setF] = useState<"all" | "apple" | "google" | "low" | "open">("all");
  const [rl, setRl] = useState(""); const [rc, setRc] = useState(""); const [pg, setPg] = useState(0);
  const [starSt, setStarSt] = useState<"apple" | "google">("apple"); const [srcSt, setSrcSt] = useState<"apple" | "google">("apple");
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)); }, []);
  if (e) return <div className="alert err">{e}</div>;
  if (!d) return <Loading />;
  const t = d.totals || {}, ratings = (d.ratings || []) as D[];
  const cnt = ratings.reduce((s, r) => s + n(r.n), 0), avgRev = cnt ? ratings.reduce((s, r) => s + n(r.n) * n(r.rating), 0) / cnt : 0;
  /* the stores' real average: Apple from its public lookup (per country), Google from the ratings report */
  const ra: D[] = d.real?.apple || [], raN = ra.reduce((s, x) => s + n(x.ratings), 0), raAvg = raN ? ra.reduce((s, x) => s + n(x.rating) * n(x.ratings), 0) / raN : 0;
  const rg = n(d.real?.google?.rating);
  /* the two stores weighted by their number of ratings (Play gives no total count: the Play ratings we downloaded
     stand in); with only one store measured (iOS in review), that store's own average and count */
  const rgN = ratings.filter((r) => r.store === "google").reduce((s, r) => s + n(r.n), 0);
  const realAvg = raAvg && rg ? (raN + rgN ? (raAvg * raN + rg * rgN) / (raN + rgN) : (raAvg + rg) / 2) : raAvg || rg;
  const realN = raAvg && rg ? raN + rgN : raAvg ? raN : rg ? rgN : 0;
  /* both periods end on the last day the store has reported (today and yesterday are not in yet) */
  const lastDay = [d.last?.apple, d.last?.google].filter(Boolean).sort()[0] as string | undefined;
  const upTo = lastDay ? ` · ${new Date(String(lastDay).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}-ig, az utolsó jelentett napig` : "";
  const allRev = (d.reviews || []) as D[];
  const rlangs = Array.from(new Set(allRev.map((r) => r.lang).filter(Boolean))) as string[], rcs = Array.from(new Set(allRev.map((r) => r.territory).filter(Boolean))) as string[];
  const reviews = allRev.filter((r) => (f === "all" || (f === "low" ? n(r.rating) < 3 : f === "open" ? !r.reply && n(r.rating) < 3 : r.store === f)) && (!rl || r.lang === rl) && (!rc || r.territory === rc));
  const unanswered = allRev.filter((r) => !r.reply && n(r.rating) < 3).length;
  /* the stores' own analytics: product page views, impressions, where people found the app, crashes */
  const M: D[] = d.metrics || [], MD: D[] = d.metric_days || [], MP: D[] = d.metrics_prev || [];
  const tot = (store: string, metric: string) => M.filter((x) => x.store === store && x.metric === metric && x.dim === "").reduce((a, x) => a + n(x.n), 0);
  const prv = (store: string, metric: string) => n(MP.find((x) => x.store === store && x.metric === metric)?.n);
  const dims = (store: string, metric: string, dim: string) => { const m = new Map<string, number>(); M.filter((x) => x.store === store && x.metric === metric && x.dim === dim).forEach((x) => m.set(x.k, (m.get(x.k) || 0) + n(x.n))); return [...m].map(([k, v]) => ({ k, n: v })).sort((a, b) => b.n - a.n); };
  const imp = tot("apple", "impressions"), pvA = tot("apple", "page_views"), pvG = tot("google", "page_views"), dlA = tot("apple", "downloads_src"), dlG = tot("google", "downloads_src");
  const conv = (a: number, b: number) => (!b ? "–" : a > b ? "100%+" : pct(a, b));
  const crashRate = tot("google", "crash_rate"), anrRate = tot("google", "anr_rate"), crashUsers = tot("google", "crash_users");
  const crashV = dims("apple", "crashes", "version").slice(0, 8), rateV = M.filter((x) => x.store === "google" && x.metric === "crash_rate" && x.dim === "version"), anrV = M.filter((x) => x.store === "google" && x.metric === "anr_rate" && x.dim === "version");
  const crashDays = MD.filter((x) => x.store === "apple" && x.metric === "crashes"), rateDays = MD.filter((x) => x.store === "google" && x.metric === "crash_rate");
  const rtA = ((d.rating_trend || []) as D[]).filter((x) => x.store === "apple"), rtG = ((d.rating_trend || []) as D[]).filter((x) => x.store === "google");
  const rtWeeks = Array.from(new Set([...rtA, ...rtG].map((x) => x.t))).sort();
  /* not connected and no data yet: "–" and a plain sentence, never a big 0 that reads like "nobody downloaded it" */
  const dlOn = !!(st?.apple_sales || st?.google_installs) || ((d.downloads || []) as D[]).length > 0 || n(t.apple_all) + n(t.google_all) + n(t.apple) + n(t.google) > 0;
  const metOn = M.length > 0 || MD.length > 0 || !!st?.apple;
  const v0 = (on: boolean, x: number, f: (x: number) => string = fmt) => (on ? f(x) : "–");
  const steps = st ? [
    { ok: !!st.apple, t: "App Store Connect", p: <>App Store Connect → Users and Access → Integrations → App Store Connect API: kulcs (App Manager szerep). A kulcsokat a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon adhatod meg.</> },
    { ok: !!st.apple_sales, t: "App Store-letöltések", p: <>Payments and Financial Reports → a vendor number, a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon.</> },
    { ok: !!st.google_play, t: "Google Play", p: <>Play Console → Users and permissions: egy Google Cloud szolgáltatásfiók meghívása (alkalmazásadatok megtekintése, értékelések). A kulcsfájlt a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon töltheted fel.</> },
    { ok: !!st.google_installs, t: "Google Play-telepítések", p: <>Play Console → Download reports → Statistics: a „pubsite_prod_…” tárhely neve, a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon.</> },
  ] : [];
  const daysRows = ((d.downloads || []) as D[]).map((x) => ({ t: x.t, v: { apple: n(x.apple), apple_re: n(x.apple_re), google: n(x.google) } }));
  const lbl = (k: string) => ({ apple: "App Store (első letöltés)", apple_re: "App Store (újraletöltés)", google: "Google Play" } as D)[k] || k;
  const col = (k: string) => ({ apple: SERIES[0], apple_re: "#9cc3f0", google: SERIES[2] } as D)[k] || SERIES[6];
  const shown = reviews.slice(pg * PER, (pg + 1) * PER);
  return (
    <div className="g">
      {!dlOn ? <section className="band plain s12"><div><span className="lbl">Letöltés {d.days > 3000 ? "összesen" : d.days + " nap"}</span><div className="num"><b>–</b><small>az áruházak még nincsenek bekötve: a letöltések a kulcsok után jelennek meg</small></div></div></section>
      : <Band plain label={`Letöltés ${d.days > 3000 ? "összesen" : d.days + " nap"}${d.days > 3000 ? "" : upTo}`} value={n(t.apple) + n(t.google)} now={n(t.apple) + n(t.google)} prev={n(t.apple_prev) + n(t.google_prev)}
        sentence={<>App Store: <b>{fmt(t.apple)}</b> első letöltés (+ {fmt(t.apple_re)} újraletöltés), Google Play: <b>{fmt(t.google)}</b> telepítés. A kettő így összemérhető: mindkettő új felhasználó, az újraletöltés külön.{d.days > 3000 || !lastDay ? null : " Az előző időszak ugyanilyen hosszú, és szintén az utolsó jelentett nap előtt ér véget."} {realAvg ? <>{raAvg && rg ? "Az áruházak valódi átlaga" : raAvg ? "Az App Store valódi átlaga" : "A Google Play valódi átlaga"} <b>{fmt(realAvg, 2)} ★</b> (minden értékelésből, nem csak a szövegesekből{raAvg && rg ? "; a két áruház az értékelések számával súlyozva" : ""}).</> : cnt ? <>A letöltött véleményekből számolt átlag <b>{fmt(avgRev, 2)} ★</b> ({fmt(cnt)} vélemény; a valódi átlag az áruházi kulcsok után jön).</> : "Még nincs értékelés letöltve."}{unanswered ? <> <b>{fmt(unanswered)}</b> 3 csillag alatti vélemény vár válaszra.</> : null}</>}
        side={daysRows.length ? <StackedColumns days={daysRows} keys={["apple", "apple_re", "google"]} label={lbl} color={col} height={120} /> : undefined} />}
      {(dlOn || cnt > 0) && <section className="c s12"><Storefront avg={realAvg || avgRev} count={realAvg ? realN : cnt} dist={[5, 4, 3, 2, 1].map((r) => ratings.filter((x) => n(x.rating) === r).reduce((s2, x) => s2 + n(x.n), 0))} downloads={n(t.apple_all) + n(t.google_all) || n(t.apple) + n(t.google)} /></section>}
      {steps.some((x) => !x.ok) && (
        <Card className="s12" icon={P.bolt} title="Beállítás" desc="A kulcsokkal a reggeli frissítés minden nap behúzza a letöltéseket és az értékeléseket; az első futás visszamenőleg is betölt (App Store: 60 nap, Google Play: 12 hónap). Az értékeket itt soha nem mutatjuk.">
          <ul className="adm-steps">{steps.map((x, i) => <li key={x.t} className={x.ok ? "done" : ""}><span className="ck">{x.ok ? "✓" : i + 1}</span><div><b>{x.t}</b><p>{x.ok ? "Kész." : x.p}</p></div></li>)}</ul>
        </Card>
      )}
      <Kpi kind="api" to="@Vélemények" tone="sky" className="s3" icon={P.spark} l="Valódi átlag: App Store" v={raAvg ? fmt(raAvg, 2) + " ★" : "–"} sub={raN ? `${fmt(raN)} értékelés, ${ra.length} ország` : "az App Store nyilvános adataiból, a kulcs után"} />
      <Kpi kind="api" to="@Vélemények" tone="butter" className="s3" icon={P.spark} l="Valódi átlag: Google Play" v={rg ? fmt(rg, 2) + " ★" : "–"} sub={d.real?.google?.day ? `a Play-jelentés szerint, ${agoDay(d.real.google.day)}` : "a Play-jelentésekből, a tárhely beállítása után"} />
      <Kpi kind="api" to="@Letöltések naponta" tone="pink" className="s3" icon={P.layers} l="Frissítés" v={v0(dlOn, n(t.apple_upd) + n(t.google_upd))} sub={`App Store ${fmt(t.apple_upd)} · Play ${fmt(t.google_upd)}`} />
      <Kpi kind="api" to="@Letöltések naponta" tone="peach" className="s3" icon={P.alert} l="Eltávolítás" v={v0(dlOn || metOn, n(t.google_un) + tot("apple", "deletions"))} sub={`Play ${fmt(t.google_un)} · App Store ${fmt(tot("apple", "deletions"))} törlés`} invert />
      <Card className="s4" icon={P.spark} src={["apple", "google"]} title="Csillagok" sub="A letöltött vélemények eloszlása, áruházanként."
        right={<div className="adm-seg sm">{(["apple", "google"] as const).map((k) => <button key={k} aria-pressed={starSt === k} onClick={() => setStarSt(k)}>{ST[k]}</button>)}</div>}>
        {ratings.some((x) => x.store === starSt) ? <BarList items={[5, 4, 3, 2, 1].map((r) => ({ k: STARS(r), n: ratings.filter((x) => x.store === starSt && n(x.rating) === r).reduce((s, x) => s + n(x.n), 0) }))} max={5} /> : <Empty t="Ebből az áruházból még nincs értékelés." icon={P.spark} />}
      </Card>
      <Card className="s8" icon={P.layers} src={["apple", "google"]} title="Letöltések naponta" sub="App Store: első letöltés és külön az újraletöltés (a sales-jelentésből); Google Play: felhasználói telepítés (a havi jelentésből). Az első futás visszamenőleg is betölt.">
        {daysRows.length ? <StackedColumns days={daysRows} keys={["apple", "apple_re", "google"]} label={lbl} color={col} /> : <Empty t="A kulcsok beállítása után itt jelennek meg a napi letöltések." ghost />}
      </Card>
      <FreshRow srcs={["apple", "google"]} />
      <Kpi kind="api" to="@next" tone="sky" className="s3" icon={P.eye} l="Megjelenés az App Store-ban" v={v0(metOn, imp)} now={imp} prev={prv("apple", "impressions")} sub="keresésben, böngészésben" />
      <Kpi kind="api" to="@next" tone="butter" className="s3" icon={P.doc} l="Termékoldal-megtekintés" v={v0(metOn, pvA + pvG)} now={pvA + pvG} prev={prv("apple", "page_views") + prv("google", "page_views")} sub={`App Store ${fmt(pvA)} · Play ${fmt(pvG)}`} />
      <Kpi kind="api" to="@next" tone="pink" className="s3" icon={P.target} l="Konverzió" v={conv(dlA, pvA)} sub={`App Store ${conv(dlA, pvA)} · Play ${conv(dlG, pvG)}`} title="Első letöltés / termékoldal-megtekintés, áruházanként. 100% fölött: sokan a találati listából, termékoldal nélkül töltenek le." />
      <Kpi kind="api" to="@Összeomlások" tone="peach" className="s3" icon={P.alert} l="Összeomlás" v={v0(metOn, tot("apple", "crashes"))} sub={rateDays.length ? `Android: ${fmt(crashRate, 2)}% összeomlás, ${fmt(anrRate, 2)}% lefagyás (ANR), napi átlag` : metOn ? "iOS, az időszakban" : "az áruházi analitika még nincs bekötve"} invert />
      <Card className="s6" icon={P.traffic} src="apple" title="Honnan találtak rá" sub="Első letöltések forrásonként, áruházanként külön (App Store Analytics, Google Play-jelentések)."
        right={<div className="adm-seg sm">{(["apple", "google"] as const).map((k) => <button key={k} aria-pressed={srcSt === k} onClick={() => setSrcSt(k)}>{ST[k]}</button>)}</div>}>
        <BarList items={dims(srcSt, "downloads_src", "source")} fmtK={(k) => SRC[k] || k} accent empty="Az áruházi kulcsok és az első napi jelentés után jelenik meg (az Apple 1–2 nap késéssel adja)." />
        {srcSt === "apple" && dims("apple", "downloads_src", "source_info").length > 0 && <><h4>Hivatkozó appok és oldalak (Source Info)</h4><BarList items={dims("apple", "downloads_src", "source_info")} max={6} /></>}
      </Card>
      <Card className="s6" icon={P.eye} src="apple" title="Termékoldal forrásonként" sub="A termékoldal megtekintései: honnan jöttek, áruházanként.">
        <BarList items={dims(srcSt, "page_views", "source")} fmtK={(k) => SRC[k] || k} empty="Még nincs adat." />
      </Card>
      <Card className="s6" icon={P.alert} src={["apple", "google"]} title="Összeomlások verziónként" sub="iOS: összeomlások száma; Android: összeomlási és lefagyási (ANR) arány verziókódonként, napi átlag. Az érintett felhasználók az Android mérés alapja.">
        {crashV.length || rateV.length || anrV.length ? <BarList items={[...crashV.map((x) => ({ k: "iOS " + x.k, n: x.n })), ...rateV.map((x) => ({ k: "Android " + x.k + " · összeomlás %", n: n(x.n) })), ...anrV.map((x) => ({ k: "Android " + x.k + " · ANR %", n: n(x.n) }))]} empty="Nincs összeomlás." /> : <Empty t="Nincs mért összeomlás (vagy még nincs bekötve az áruház)." icon={P.check} />}
        {crashUsers > 0 && <p className="note">Android: a mérés alapja {fmt(crashUsers)} felhasználó-nap; az érintettek kb. {fmt((crashRate / 100) * crashUsers)}.</p>}
        {crashDays.length > 1 && <TrendChart data={crashDays.map((x) => ({ t: x.day, v: n(x.n) }))} label="Összeomlás (iOS)" height={150} />}
        {rateDays.length > 1 && <TrendChart data={rateDays.map((x) => ({ t: x.day, v: n(x.n) }))} label="Android összeomlási arány" unit="%" height={150} />}
      </Card>
      <Card className="s6" icon={P.spark} src={["apple", "google"]} title="Értékelés alakulása" sub="Az átlagos csillag hetente a letöltött véleményekből: App Store (folytonos) és Google Play (szaggatott).">
        {rtWeeks.length > 1 ? <TrendChart data={rtWeeks.map((w) => ({ t: w, v: n(rtA.find((x) => x.t === w)?.avg), p: n(rtG.find((x) => x.t === w)?.avg) }))} label="App Store ★" prevLabel="Google Play ★" height={180} /> : <Empty t="Legalább két hét vélemény kell hozzá." icon={P.spark} />}
      </Card>
      <Card className="s12" icon={P.layers} title="Eszközök és verziók (App Store)" sub="Munkamenetek eszköz, iOS-verzió és app-verzió szerint (App Store Analytics: App Sessions).">
        {dims("apple", "sessions", "device").length ? <div className="demo-cols">
          <div><h4>Eszköz</h4><BarList items={dims("apple", "sessions", "device")} max={6} /></div>
          <div><h4>iOS-verzió</h4><BarList items={dims("apple", "sessions", "os")} max={6} /></div>
          <div><h4>App-verzió</h4><BarList items={dims("apple", "sessions", "version")} max={6} /></div>
        </div> : <Empty t="Az App Store-analitika első napi jelentése után jelenik meg." icon={P.layers} />}
      </Card>
      <Card className="s12" icon={P.mail} src={["apple", "google"]} title="Vélemények" sub="Minden értékelés egy helyen, a legújabb elöl, oldalanként 20. A válaszolatlan, 3 csillag alattiak a legfontosabbak; a válasz innen is elküldhető. Az App Store nyelvet és verziót nem ad a véleményhez, csak országot."
        right={<><div className="adm-seg sm">{([["all", "Mind"], ["apple", "App Store"], ["google", "Google Play"], ["low", "1–2 ★"], ["open", "Válaszra vár"]] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => { setF(k); setPg(0); }}>{l}</button>)}</div><SyncButton done={load} /></>}>
        {(rlangs.length > 0 || rcs.length > 0) && <div className="adm-row">
          {rlangs.length > 0 && <select className="adm-in sm" value={rl} onChange={(x) => { setRl(x.target.value); setPg(0); }}><option value="">Minden nyelv</option>{rlangs.map((k) => <option key={k} value={k}>{k}</option>)}</select>}
          {rcs.length > 0 && <select className="adm-in sm" value={rc} onChange={(x) => { setRc(x.target.value); setPg(0); }}><option value="">Minden ország</option>{rcs.map((k) => <option key={k} value={k}>{countryName(k.length === 2 ? k : k.slice(0, 2))} ({k})</option>)}</select>}
        </div>}
        {shown.length ? <ul className="revs">{shown.map((r) => <Review key={r.store + r.review_id} r={r} done={load} />)}</ul> : <Empty t="Nincs ilyen vélemény." icon={P.mail} />}
        {reviews.length > PER && <div className="pager"><span>{pg * PER + 1}–{Math.min(reviews.length, (pg + 1) * PER)} / {fmt(reviews.length)}</span>
          <div className="adm-row"><button className="adm-ibtn" disabled={!pg} onClick={() => setPg(pg - 1)}>← Előző</button><button className="adm-ibtn" disabled={(pg + 1) * PER >= reviews.length} onClick={() => setPg(pg + 1)}>Következő →</button></div></div>}
      </Card>
      <More label="Részletek: versenytársak, ASO, adatlehúzások">
      <Card className="s12" icon={P.target} title="Versenytársak" sub="Hasonló appok az App Store-ban (nyilvános adat, kulcs nélkül), országonként: az értékelések számát is országonként számolja az Apple. Minden reggel frissül. A Google Play nem ad nyilvános lekérdezést, ezért Play-versenytársat nem tudunk figyelni.">
        <Competitors />
      </Card>
      <Card className="s12" icon={P.refresh} title="Adatlehúzások" sub="App Store és Google Play, részenként (értékelés, letöltés, analitika, minőség), és a versenytársak.">
        <Tbl name="aruhaz-lehuzas" csv={false} rows={d.sync || []} empty="Még nem futott." cols={[{ k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "source", l: "Forrás", r: (r) => SYNC[r.source] || r.source }, { k: "ok", l: "Eredmény", r: (r) => <span className={"chip " + (r.ok ? "good" : "bad")}>{r.ok ? "rendben" : "hiba"}</span> }, { k: "rows", l: "Sor", num: true }, { k: "message", l: "Részlet", r: (r) => <span className="cellwrap mut">{r.message}</span> }]} />
      </Card>
      </More>
    </div>
  );
}

/* one review, with a reply box for the unanswered ones (the reply goes out in the store itself) */
function Review({ r, done }: { r: D; done: () => void }) {
  const [open, setOpen] = useState(false); const [txt, setTxt] = useState(""); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!txt.trim()) return;
    setBusy(true);
    const x = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: r.store, id: r.review_id, text: txt.trim() }) });
    setBusy(false);
    if (x.ok && x.json?.ok !== false) { toast("Elküldve: a válasz a következő frissítéskor jelenik meg itt"); setOpen(false); setTxt(""); done(); } else toast(x.json?.error || "Nem sikerült elküldeni.");
  };
  return (
    <li className={n(r.rating) <= 2 ? "low" : ""}>
      <div className="rv-h"><span className="stars">{STARS(n(r.rating))}</span><span className="chip">{ST[r.store] || r.store}{r.territory ? " · " + r.territory : ""}{r.lang ? " · " + r.lang : ""}</span><span className="mut">{ago(r.created_at)}{r.version ? " · v" + r.version : ""}</span></div>
      {r.title && <b>{r.title}</b>}<p>{r.body || "(szöveg nélkül)"}</p>
      {r.reply ? <div className="rv-r"><span>Válaszod · {ago(r.replied_at)}</span>{r.reply}</div> : <div className="adm-row">{n(r.rating) < 3 && <span className="chip warn">válaszra vár</span>}<button className="lnk" onClick={() => setOpen(!open)}>{open ? "Mégse" : "Válasz"}</button></div>}
      {open && <div className="grw-reply"><textarea className="adm-in" rows={3} maxLength={r.store === "google" ? 350 : 5000} value={txt} onChange={(x) => setTxt(x.target.value)} placeholder="A válaszod (nyilvános, az áruházban jelenik meg)" /><button className="adm-ibtn gold" onClick={send} disabled={busy || !txt.trim()}>{busy ? "Küldés…" : "Válasz küldése"}</button></div>}
    </li>
  );
}


/* ---------- competitors ---------- */
export function Competitors() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [cc, setCc] = useState("");
  const { d, load } = useRpc("admin_competitors", { p_country: cc || null }, [cc]);
  const [q, setQ] = useState(""); const [res, setRes] = useState<D[]>([]); const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"stars" | "count">("stars");
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => { if (MOCK) { setRes([{ app_id: "123456789", name: "Tattoo Preview – " + q, developer: "Minta Kft.", rating: 4.4, ratings: 1820 }]); return; } const r = await fetch("/api/admin/competitors?q=" + encodeURIComponent(q.trim())); const j = await r.json().catch(() => ({})); setRes(j.results || []); }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const add = async (id: string) => { setMsg("Hozzáadás…"); const r = MOCK ? { ok: true, json: async () => ({ ok: true }) } : await fetch("/api/admin/competitors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app_id: id }) }); const j = await r.json(); setMsg(j.ok ? "Hozzáadva." : j.error || "Nem sikerült."); setQ(""); load(); };
  const del = async (r: D) => { if (!window.confirm(`Biztosan leveszed a figyelésből: ${r.name}? A múltbeli adatai is törlődnek.`)) return; await rpc(sb, "admin_competitor_delete", { p_app_id: r.app_id }); load(); };
  /* the older shape (a plain list) still reads */
  const X: D = Array.isArray(d) ? { apps: d, countries: [], aso: [] } : (d as D) || {};
  const list: D[] = X.apps || [], countries: string[] = X.countries || [], aso: D[] = X.aso || [];
  const terms = Array.from(new Set(aso.map((x) => x.term)));
  const versions: D[] = list.flatMap((a) => ((a.versions || []) as D[]).map((v): D => ({ ...v, name: a.name, mine: a.mine }))).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 30);
  return (
    <>
      <div className="adm-row">
        <input className="adm-in" style={{ flex: "1 1 280px" }} placeholder="Keresés az App Store-ban: pl. „tattoo”, „tetoválás”, egy app neve…" value={q} onChange={(e) => setQ(e.target.value)} />{msg && <span className="note">{msg}</span>}
        {countries.length > 1 && <select className="adm-in sm" value={cc || X.country || ""} onChange={(e) => setCc(e.target.value)}>{countries.map((c) => <option key={c} value={c}>{flag(c.toUpperCase())} {countryName(c.toUpperCase())}</option>)}</select>}
        <div className="adm-seg sm"><button aria-pressed={mode === "stars"} onClick={() => setMode("stars")}>Trend: csillag</button><button aria-pressed={mode === "count"} onClick={() => setMode("count")}>Trend: darab</button></div>
      </div>
      {res.length > 0 && <ul className="comp-res">{res.map((x) => <li key={x.app_id}>{x.icon && <img src={x.icon} alt="" />}<span><b>{x.name}</b><small>{x.developer} · {x.rating ? fmt(x.rating, 1) + " ★" : "–"} · {fmt(x.ratings)} értékelés</small></span><button className="adm-ibtn sm" onClick={() => add(x.app_id)}>{I(P.plus)}Figyelés</button></li>)}</ul>}
      <Tbl name="versenytarsak" rows={list} empty="Még nincs figyelt app. Keress rá fent egy hasonló alkalmazásra." cols={[
        { k: "name", l: "App", r: (r) => <span style={{ display: "flex", gap: 10, alignItems: "center" }}>{r.icon && <img src={r.icon} alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />}<span><a href={r.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><b>{r.name}</b></a>{r.mine && <span className="chip gold" style={{ marginLeft: 6 }}>InkAge</span>}<br /><span className="mut">{r.developer}{r.version ? " · v" + r.version : ""}</span></span></span> },
        { k: "rating", l: "Értékelés", num: true, r: (r) => (r.rating ? <>{fmt(n(r.rating), 2)} ★{r.rating_month_ago != null && <small className="mut"> <Delta now={n(r.rating)} prev={n(r.rating_month_ago)} /></small>}</> : "–") },
        { k: "ratings", l: `Értékelések (${(X.country || "").toUpperCase()})`, num: true, r: (r) => <b>{fmt(r.ratings)}</b> },
        { k: "w", l: "7 nap alatt", num: true, r: (r) => (r.ratings_week_ago != null ? <span style={{ color: n(r.ratings) > n(r.ratings_week_ago) ? "var(--a-good)" : "var(--a-dim)" }}>+{fmt(n(r.ratings) - n(r.ratings_week_ago))}</span> : "–") },
        { k: "s", l: mode === "stars" ? "Csillag (90 nap)" : "Értékelések száma (90 nap)", num: true, r: (r) => ((r.series || []).length > 1 ? <span style={{ display: "inline-block", width: 110 }}><Spark values={(r.series as D[]).map((x) => n(mode === "stars" ? x.r : x.v))} h={30} /></span> : "–") },
        { k: "price", l: "Ár" },
        { k: "x", l: "", r: (r) => (r.mine ? null : <button className="adm-ibtn sm" onClick={() => del(r)}>Törlés</button>) },
      ]} />
      <h3>ASO: helyezés az App Store-keresésben ({(X.country || "").toUpperCase()})</h3>
      {terms.length ? <div className="tw"><table className="tb"><thead><tr><th>Keresés</th>{list.map((a) => <th key={a.app_id} className="num">{a.mine ? "InkAge" : String(a.name).slice(0, 18)}</th>)}</tr></thead><tbody>
        {terms.map((tm) => <tr key={tm}><td><b>{tm}</b></td>{list.map((a) => { const x = aso.find((y) => y.term === tm && y.app_id === a.app_id); return <td key={a.app_id} className="num">{x?.pos ? <>{x.pos}.{x.pos_week_ago ? <small className="mut"> ({n(x.pos_week_ago) > n(x.pos) ? "▲" : n(x.pos_week_ago) < n(x.pos) ? "▼" : "="} {x.pos_week_ago}.)</small> : null}</> : <span className="mut">200+</span>}</td>; })}</tr>)}
      </tbody></table></div> : <Empty t="Az első mérés a következő reggeli frissítéskor fut (a figyelt appok helye a „tattoo”, „tetoválás”… keresésekben, országonként). A szavakat az ASO_TERMS beállítás módosítja." icon={P.search} />}
      <h3>Verzióváltások</h3>
      {versions.length ? <Tbl name="verziovaltasok" csv={false} rows={versions} cols={[{ k: "day", l: "Nap", r: (r) => new Date(r.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) }, { k: "name", l: "App", r: (r) => <>{r.name}{r.mine && <span className="chip gold" style={{ marginLeft: 6 }}>InkAge</span>}</> }, { k: "version", l: "Verzió", r: (r) => <>{r.prev} → <b>{r.version}</b></> }]} />
        : <p className="note">Még nem volt verzióváltás a figyelés óta.</p>}
    </>
  );
}
