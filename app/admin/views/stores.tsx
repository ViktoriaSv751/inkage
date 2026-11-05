"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Delta, Empty, Info, Spark, StackedColumns, TrendChart, fmt, pct, SERIES } from "../charts";
import { Logo } from "../wow";
import { countryName } from "../visuals";
import { Chg, Giant, Hero, Ring, type RingKind } from "../ink";
import { Stars } from "./reach-ink";
import { Async, Card, FreshRow, I, Kpi, Loading, MOCK, NeedKey, P, Tbl, ago, api, daysLabel, dt, n, rpc, type D, useRpc } from "../shared";
import { More } from "../extra";
import { SubTabs, haptic, toast, usePhone } from "../phone";
import { SyncButton, agoDay } from "./social";

/* ---------- App Store + Google Play ---------- */
export const STARS = (r: number) => "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
const ST: Record<string, string> = { apple: "App Store", google: "Google Play" };
const SRC: Record<string, string> = { "App Store Search": "App Store-keresés", "App Store Browse": "Böngészés az App Store-ban", "Web Referrer": "Weboldalról", "App Referrer": "Más appból", "Unavailable": "Nem ismert", "Institutional Purchase": "Intézményi", "App Clip": "App Clip",
  "Google Play search": "Play-keresés", "Google Play explore": "Play böngészés", "Third-party referrers": "Weboldalról / más appból", "Google Search": "Google-keresés" };
const SYNC: Record<string, string> = { apple: "App Store", google: "Google Play", apple_reviews: "App Store: értékelések", apple_sales: "App Store: letöltések", apple_analytics: "App Store: analitika",
  apple_keys: "App Store: kulcsok", google_keys: "Google Play: kulcsok", google_reviews: "Google Play: értékelések", google_installs: "Google Play: telepítések", google_quality: "Google Play: minőség", competitors: "Versenytársak", aso: "ASO-helyezések" };
const PER = 20;

/* a stopped part of the sync in plain words, with what to do */
const plainStop = (x: D) => /42702|is ambiguous/.test(String(x.message)) ? "az áruházi adatok mentése egy adatbázis-hiba miatt nem sikerült (2026. nov. 4-én javítva)" : /storage\.objects|Play-jelentés 403/.test(String(x.message)) ? "a szolgáltatásfióknak nincs joga a jelentések tárhelyéhez. Teendő: Play Console → Users and permissions → View financial data (a jog akár 24 óra múlva él)." : /Reporting API/.test(String(x.message)) ? "a Google Play Developer Reporting API nincs bekapcsolva a Google Cloud-projektben." : String(x.message || "").slice(0, 200);

/* phone: both stores on one sheet, the reviews, the revenue; every table of the computer stays under "Minden adat" */
export function Stores({ days }: { days: number }) {
  const phone = usePhone();
  return phone ? <StoresPhone days={days} /> : <StoresFull days={days} />;
}

function StoresFull({ days, noTop }: { days: number; noTop?: boolean }) {
  const { d, e, load } = useRpc("admin_stores", { p_days: days || 3650 }, [days]);
  const [st, setSt] = useState<D | null>(null);
  const [f, setF] = useState<"all" | "apple" | "google" | "low" | "open">("all");
  const [rl, setRl] = useState(""); const [rc, setRc] = useState(""); const [pg, setPg] = useState(0);
  const [starSt, setStarSt] = useState<"all" | "apple" | "google">("all"); const [srcSt, setSrcSt] = useState<"apple" | "google">("apple");
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)); }, []);
  if (e) return <div className="alert err">{e}</div>;
  if (!d) return <Loading />;
  const t = d.totals || {}, ratings = (d.ratings || []) as D[];
  /* the stores' real average: Apple from its public lookup (per country), Google from the ratings report */
  const ra: D[] = d.real?.apple || [], raN = ra.reduce((s, x) => s + n(x.ratings), 0), raAvg = raN ? ra.reduce((s, x) => s + n(x.rating) * n(x.ratings), 0) / raN : 0;
  const rg = n(d.real?.google?.rating);
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
  /* Android gives a rate per version, iOS a count: never on one bar. Each version once, its two rates beside each other */
  const rateVers = Array.from(new Set([...rateV, ...anrV].map((x) => String(x.k)))).sort((a, b) => b.localeCompare(a, "hu", { numeric: true }));
  const rateOf = (l: D[], k: string) => { const x = l.find((y) => String(y.k) === k); return x ? `${fmt(n(x.n), 2)}%` : "–"; };
  const crashDays = MD.filter((x) => x.store === "apple" && x.metric === "crashes"), rateDays = MD.filter((x) => x.store === "google" && x.metric === "crash_rate");
  const rtA = ((d.rating_trend || []) as D[]).filter((x) => x.store === "apple"), rtG = ((d.rating_trend || []) as D[]).filter((x) => x.store === "google");
  const rtWeeks = Array.from(new Set([...rtA, ...rtG].map((x) => x.t))).sort();
  /* not connected and no data yet: "–" and a plain sentence, never a big 0 that reads like "nobody downloaded it" */
  const dlOn = !!(st?.apple_sales || st?.google_installs) || ((d.downloads || []) as D[]).length > 0 || n(t.apple_all) + n(t.google_all) + n(t.apple) + n(t.google) > 0;
  /* a key alone is no measurement: a number only from a store that has reported, "–" and the reason otherwise */
  const metOn = M.length > 0 || MD.length > 0;
  const aOn = !!d.last?.apple, gOn = !!d.last?.google;
  const has = (store: string, metric: string) => M.some((x) => x.store === store && x.metric === metric);
  const dash = (on: boolean, x: unknown) => (on ? fmt(x as number) : "–");
  /* the newest word of each part of the sync: what stopped a number, in plain words */
  const lastOf = new Map<string, D>(); ((d.sync || []) as D[]).forEach((x) => { if (!lastOf.has(x.source)) lastOf.set(x.source, x); });
  const plain = plainStop;
  const stops = ["apple_sales", "apple_analytics", "apple_reviews", "google_installs", "google_quality", "google_reviews"].map((k) => lastOf.get(k)).filter((x): x is D => !!x && !x.ok);
  const keysMsg = (k: string) => { const x = lastOf.get(k); return x && /^kihagyva/.test(String(x.message)) ? String(x.message).replace(/^kihagyva:\s*/, "") : ""; };
  const v0 = (on: boolean, x: number, f: (x: number) => string = fmt) => (on ? f(x) : "–");
  const steps = st ? [
    { ok: !!st.apple, t: "App Store Connect", p: <>App Store Connect → Users and Access → Integrations → App Store Connect API: kulcs (App Manager szerep). A kulcsokat a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon adhatod meg.</> },
    { ok: !!st.apple_sales, t: "App Store-letöltések", p: <>Payments and Financial Reports → a vendor number, a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon.</> },
    { ok: !!st.google_play, t: "Google Play", p: <>Play Console → Users and permissions: egy Google Cloud szolgáltatásfiók meghívása (alkalmazásadatok megtekintése, értékelések). A kulcsfájlt a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon töltheted fel.</> },
    { ok: !!st.google_installs, t: "Google Play-telepítések", p: <>Play Console → Download reports → Statistics: a „pubsite_prod_…” tárhely neve, a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon.</> },
  ] : [];
  const daysRows = ((d.downloads || []) as D[]).map((x) => ({ t: x.t, v: { apple: n(x.apple), apple_re: n(x.apple_re), google: n(x.google) } }));
  const lbl = (k: string) => ({ apple: "App Store (első letöltés)", apple_re: "App Store (újraletöltés)", google: "Google Play" } as D)[k] || k;
  const col = (k: string) => ({ apple: SERIES[0], apple_re: "var(--ser-5)", google: SERIES[2] } as D)[k] || SERIES[6];
  const shown = reviews.slice(pg * PER, (pg + 1) * PER);
  return (
    <div className="g">
      {!noTop && <StoresTop d={d} />}
      {!noTop && <Revenue days={days} />}
      {stops.length > 0 && <div className="alert err s12">{stops.map((x) => <div key={x.source}><b>{SYNC[x.source] || x.source}:</b> {plain(x)}</div>)}</div>}
      {steps.some((x) => !x.ok) && (
        <Card className="s12" icon={P.bolt} title="Beállítás" desc="A kulcsokkal a reggeli frissítés minden nap behúzza a letöltéseket és az értékeléseket; az első futás visszamenőleg is betölt (App Store: 60 nap, Google Play: 12 hónap). Az értékeket itt soha nem mutatjuk.">
          <ul className="adm-steps">{steps.map((x, i) => <li key={x.t} className={x.ok ? "done" : ""}><span className="ck">{x.ok ? "✓" : i + 1}</span><div><b>{x.t}</b><p>{x.ok ? "Kész." : x.p}</p></div></li>)}</ul>
        </Card>
      )}
      <Kpi kind="api" to="@Vélemények" tone="sky" className="s3" icon={P.spark} l="Valódi átlag: App Store" v={raAvg ? fmt(raAvg, 2) + " ★" : "–"} sub={raN ? `${fmt(raN)} értékelés, ${ra.length} ország` : "az App Store nyilvános adataiból, a kulcs után"} />
      <Kpi kind="api" to="@Vélemények" tone="butter" className="s3" icon={P.spark} l="Valódi átlag: Google Play" v={rg ? fmt(rg, 2) + " ★" : "–"} sub={d.real?.google?.day ? `a Play-jelentés szerint, ${agoDay(d.real.google.day)}` : "a Play-jelentésekből, a tárhely beállítása után"} />
      <Kpi kind="api" to="@Letöltések naponta" tone="pink" className="s3" icon={P.layers} l="Frissítés" v={v0(dlOn, n(t.apple_upd) + n(t.google_upd))} sub={dlOn ? `App Store ${dash(aOn, t.apple_upd)} · Play ${dash(gOn, t.google_upd)}` : "az áruház még nem jelentett"} />
      <Kpi kind="api" to="@Letöltések naponta" tone="peach" className="s3" icon={P.alert} l="Eltávolítás" v={v0(gOn || has("apple", "deletions"), n(t.google_un) + tot("apple", "deletions"))} sub={`Play ${dash(gOn, t.google_un)} · App Store ${has("apple", "deletions") ? fmt(tot("apple", "deletions")) + " törlés" : "–"}`} invert />
      <Card className="s4" icon={P.spark} src={["apple", "google"]} title="Csillagok" sub="A letöltött vélemények eloszlása, együtt vagy áruházanként."
        right={<div className="adm-seg sm">{(["all", "apple", "google"] as const).map((k) => <button key={k} aria-pressed={starSt === k} onClick={() => setStarSt(k)}>{k === "all" ? "Mind" : ST[k]}</button>)}</div>}>
        <BigRating d={d} store={starSt} />
        {ratings.some((x) => starSt === "all" || x.store === starSt) ? <BarList items={[5, 4, 3, 2, 1].map((r) => ({ k: STARS(r), n: ratings.filter((x) => (starSt === "all" || x.store === starSt) && n(x.rating) === r).reduce((s, x) => s + n(x.n), 0) }))} max={5} /> : <Empty t="Ebből az áruházból még nincs értékelés." icon={P.spark} />}
      </Card>
      <Card className="s8" icon={P.layers} src={["apple", "google"]} title="Letöltések naponta" sub={`App Store: első letöltés és külön az újraletöltés (a sales-jelentésből); Google Play: felhasználói telepítés (a havi jelentésből). Az első futás visszamenőleg is betölt.${!gOn ? " A Google Play most nincs az ábrán, mert még nem jött róla adat, nem azért, mert nulla lenne." : ""}${!aOn ? " Az App Store most nincs az ábrán, mert még nem jött róla adat." : ""}`}>
        {daysRows.length ? <StackedColumns days={daysRows} keys={["apple", "apple_re", "google"]} label={lbl} color={col} /> : <Empty t="A kulcsok beállítása után itt jelennek meg a napi letöltések." ghost><NeedKey k={["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_APP_ID", "ASC_VENDOR_NUMBER", "PLAY_SERVICE_ACCOUNT_JSON", "PLAY_REPORTS_BUCKET"]} /></Empty>}
      </Card>
      <FreshRow srcs={["apple", "google"]} />
      <Kpi kind="api" to="@next" tone="sky" className="s3" icon={P.eye} l="Megjelenés az App Store-ban" v={v0(metOn, imp)} now={imp} prev={prv("apple", "impressions")} sub={metOn ? "keresésben, böngészésben" : "az App Store analitikája az első jelentése után jön (1–2 nap)"} />
      <Kpi kind="api" to="@next" tone="butter" className="s3" icon={P.doc} l="Termékoldal-megtekintés" v={v0(metOn, pvA + pvG)} now={pvA + pvG} prev={prv("apple", "page_views") + prv("google", "page_views")} sub={`App Store ${dash(has("apple", "page_views"), pvA)} · Play ${dash(has("google", "page_views"), pvG)}`} />
      <Kpi kind="api" to="@next" tone="pink" className="s3" icon={P.target} l="Konverzió" v={conv(dlA, pvA)} sub={`App Store ${conv(dlA, pvA)} · Play ${conv(dlG, pvG)}`} title="Első letöltés / termékoldal-megtekintés, áruházanként. 100% fölött: sokan a találati listából, termékoldal nélkül töltenek le." />
      <Kpi kind="api" to="@Összeomlások" tone="peach" className="s3" icon={P.alert} l="Összeomlás" v={v0(metOn, tot("apple", "crashes"))} sub={rateDays.length ? `Android: ${fmt(crashRate, 2)}% összeomlás, ${fmt(anrRate, 2)}% lefagyás (ANR), napi átlag` : metOn ? "iOS, az időszakban" : "az áruházi analitika még nincs bekötve"} invert />
      <Card className="s6" icon={P.traffic} src={srcSt} title={`Honnan találtak rá: ${ST[srcSt]}`} sub="Első letöltések forrásonként, áruházanként külön (App Store Analytics, Google Play-jelentések)."
        right={<div className="adm-seg sm">{(["apple", "google"] as const).map((k) => <button key={k} aria-pressed={srcSt === k} onClick={() => setSrcSt(k)}>{ST[k]}</button>)}</div>}>
        <BarList items={dims(srcSt, "downloads_src", "source")} fmtK={(k) => SRC[k] || k} accent empty="Az áruházi kulcsok és az első napi jelentés után jelenik meg (az Apple 1–2 nap késéssel adja)." />
        {srcSt === "apple" && dims("apple", "downloads_src", "source_info").length > 0 && <><h4>Hivatkozó appok és oldalak (Source Info)</h4><BarList items={dims("apple", "downloads_src", "source_info")} max={6} /></>}
      </Card>
      <Card className="s6" icon={P.eye} src={srcSt} title={`Termékoldal forrásonként: ${ST[srcSt]}`} sub="A termékoldal megtekintései: honnan jöttek, áruházanként."
        right={<div className="adm-seg sm">{(["apple", "google"] as const).map((k) => <button key={k} aria-pressed={srcSt === k} onClick={() => setSrcSt(k)}>{ST[k]}</button>)}</div>}>
        <BarList items={dims(srcSt, "page_views", "source")} fmtK={(k) => SRC[k] || k} empty="Még nincs adat." />
      </Card>
      <Card className="s6" icon={P.alert} src={["apple", "google"]} title="Összeomlások verziónként" sub="iOS: összeomlások száma; Android: összeomlási és lefagyási (ANR) arány verziókódonként, napi átlag. Az érintett felhasználók az Android mérés alapja.">
        {crashV.length > 0 && <><h4>iOS: összeomlások száma</h4><BarList items={crashV} /></>}
        {rateVers.length > 0 && <><h4>Android: arány verziónként</h4><dl className="ir-kv">{rateVers.map((k) => <div key={k}><dt>{k}</dt><dd>{rateOf(rateV, k)} összeomlás · {rateOf(anrV, k)} lefagyás</dd></div>)}</dl></>}
        {!crashV.length && !rateVers.length && <Empty t="Nincs mért összeomlás (vagy még nincs bekötve az áruház)." icon={P.check} />}
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
        </div> : <Empty t="Az App Store-analitika első napi jelentése után jelenik meg." icon={P.layers}><NeedKey k={["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_APP_ID"]} /></Empty>}
      </Card>
      <Card className="s12" icon={P.mail} src={["apple", "google"]} title="Vélemények" sub="Minden értékelés egy helyen, a legújabb elöl, oldalanként 20. A válaszolatlan, 3 csillag alattiak a legfontosabbak; a válasz innen is elküldhető. Az App Store nyelvet és verziót nem ad a véleményhez, csak országot."
        right={<><div className="adm-seg sm ir-wrap">{([["all", "Mind"], ["apple", "App Store"], ["google", "Google Play"], ["low", "1–2 ★"], ["open", "Válaszra vár"]] as const).map(([k, l]) => <button key={k} aria-pressed={f === k} onClick={() => { setF(k); setPg(0); }}>{l}</button>)}</div><SyncButton done={load} /></>}>
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
        <Tbl name="aruhaz-lehuzas" csv={false} rows={((d.sync || []) as D[]).map((r) => ({ ...r, source_name: SYNC[r.source] || r.source }))} empty="Még nem futott." cols={[{ k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "source_name", l: "Forrás" }, { k: "ok", l: "Eredmény", r: (r) => <span className={"chip " + (r.ok ? "good" : "bad")}>{r.ok ? "rendben" : "hiba"}</span> }, { k: "rows", l: "Sor", num: true }, { k: "message", l: "Részlet", r: (r) => <span className="cellwrap mut">{r.message}</span> }]} />
      </Card>
      </More>
    </div>
  );
}

/* ---------- the phone: one sheet, reviews, revenue ---------- */
const STABS = [{ k: "sheet", l: "Összkép" }, { k: "rev", l: "Vélemények" }, { k: "money", l: "Bevétel" }, { k: "all", l: "Minden adat" }];
function StoresPhone({ days }: { days: number }) {
  const [tab, setTab] = useState("sheet");
  return <div className="gp"><SubTabs items={STABS} cur={tab} go={setTab} />
    {tab === "sheet" && <StoreSheet days={days} />}{tab === "rev" && <StoreReviews days={days} />}{tab === "money" && <Revenue days={days} />}{tab === "all" && <StoresFull days={days} noTop />}</div>;
}

function StoreSheet({ days }: { days: number }) {
  const q = useRpc("admin_stores", { p_days: days || 3650 }, [days]);
  return <Async q={q} h={320}>{(d) => <div className="g"><StoresTop d={d} /></div>}</Async>;
}

/* ---------- the rating as one large number: the store's real average where it gives one, else the downloaded reviews, and it says which ---------- */
function BigRating({ d, store = "all" }: { d: D; store?: "all" | "apple" | "google" }) {
  const ratings: D[] = (d.ratings || []).filter((x: D) => store === "all" || x.store === store), ra: D[] = d.real?.apple || [];
  const raN = ra.reduce((s, x) => s + n(x.ratings), 0), raAvg = raN ? ra.reduce((s, x) => s + n(x.rating) * n(x.ratings), 0) / raN : 0, rg = n(d.real?.google?.rating), rgN = ((d.ratings || []) as D[]).filter((r) => r.store === "google").reduce((s, r) => s + n(r.n), 0);
  const real = store === "apple" ? raAvg : store === "google" ? rg : raAvg && rg ? (raN + rgN ? (raAvg * raN + rg * rgN) / (raN + rgN) : (raAvg + rg) / 2) : raAvg || rg;
  const cnt = ratings.reduce((s, r) => s + n(r.n), 0), avg = real || (cnt ? ratings.reduce((s, r) => s + n(r.n) * n(r.rating), 0) / cnt : 0);
  if (!avg) return <div className="ir-bigstar"><Giant text="–" max={96} /><small>Még nincs értékelés.</small></div>;
  return <div className="ir-bigstar"><Giant text={fmt(avg, 1)} max={96} /><Stars v={avg} /><small>{real ? (store === "apple" || (store === "all" && raAvg && !rg) ? `App Store: ${fmt(raN)} értékelés` : store === "google" || !raAvg ? "A Google Play-jelentés szerint" : `A két áruház együtt, ${fmt(raN + rgN)} értékelésből`) : `${fmt(cnt)} letöltött véleményből`}</small></div>;
}

/* ---------- the page's top: the one figure, then the two stores as two big cards ---------- */
function StoresTop({ d }: { d: D }) {
  const comp = useRpc("admin_competitors", { p_country: null }, []);
  const t = d.totals || {}, aOn = !!d.last?.apple, gOn = !!d.last?.google, ratings: D[] = d.ratings || [];
  const ra: D[] = d.real?.apple || [], raN = ra.reduce((s, x) => s + n(x.ratings), 0), raAvg = raN ? ra.reduce((s, x) => s + n(x.rating) * n(x.ratings), 0) / raN : 0, rg = n(d.real?.google?.rating);
  const cnt = ratings.reduce((s, r) => s + n(r.n), 0), avgRev = cnt ? ratings.reduce((s, r) => s + n(r.n) * n(r.rating), 0) / cnt : 0;
  /* the two stores weighted by their number of ratings (Play gives no total count: the Play ratings we downloaded
     stand in); with only one store measured, that store's own average */
  const rgN = ratings.filter((r) => r.store === "google").reduce((s, r) => s + n(r.n), 0);
  const realAvg = raAvg && rg ? (raN + rgN ? (raAvg * raN + rg * rgN) / (raN + rgN) : (raAvg + rg) / 2) : raAvg || rg;
  const lastOf = new Map<string, D>(); ((d.sync || []) as D[]).forEach((x) => { if (!lastOf.has(x.source)) lastOf.set(x.source, x); });
  const stopOf = (store: string) => ["_installs", "_sales", "_analytics", "_quality", "_reviews"].map((k) => lastOf.get(store + k)).find((x) => x && !x.ok);
  const keysMsg = (k: string) => { const x = lastOf.get(k); return x && /^kihagyva/.test(String(x.message)) ? String(x.message).replace(/^kihagyva:\s*/, "") : ""; };
  const why = (store: "apple" | "google") => { const st = stopOf(store); return keysMsg(store + "_keys") || (st ? plainStop(st) : d.read?.[store] ? "még nem jelentett napot" : "az áruház nincs bekötve"); };
  const rv = (s: string) => ratings.filter((x) => x.store === s).reduce((a, x) => a + n(x.n), 0);
  const M: D[] = d.metrics || [], tot = (s: string, m: string) => M.filter((x) => x.store === s && x.metric === m && x.dim === "").reduce((a, x) => a + n(x.n), 0), has = (s: string, m: string) => M.some((x) => x.store === s && x.metric === m);
  const verA = (((comp.d as D)?.apps || []) as D[]).find((x) => x.mine)?.version;
  const dayS = (x?: string) => (x ? new Date(String(x).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "");
  const lastDay = [d.last?.apple, d.last?.google].filter(Boolean).sort()[0] as string | undefined;
  const period = d.days > 3000 ? "összesen" : d.days + " nap";
  const dlOn = aOn || gOn || ((d.downloads || []) as D[]).length > 0;
  const now = n(t.apple) + n(t.google), prev = n(t.apple_prev) + n(t.google_prev);
  const daysRows = ((d.downloads || []) as D[]).map((x) => ({ t: x.t, v: { apple: n(x.apple), apple_re: n(x.apple_re), google: n(x.google) } }));
  const lbl = (k: string) => ({ apple: "App Store (első letöltés)", apple_re: "App Store (újraletöltés)", google: "Google Play" } as D)[k] || k;
  const col = (k: string) => ({ apple: SERIES[0], apple_re: "var(--ser-5)", google: SERIES[2] } as D)[k] || SERIES[6];
  const unanswered = ((d.reviews || []) as D[]).filter((r) => !r.reply && n(r.rating) < 3).length;
  const card = (store: "apple" | "google", on: boolean, v: number, unit: string, extra: React.ReactNode, avg: number, avgSub: React.ReactNode, rows: [string, React.ReactNode][]) => (
    <section className={"ir-store" + (on ? "" : " off")} key={store}>
      <header><Logo k={store === "apple" ? "apple" : "play"} size={56} /><span><b>{ST[store]}</b><small>{on ? `${unit}, ${period}` : "Letöltés"}</small></span></header>
      {on ? <Giant v={v} max={132} /> : <b className="ir-nomeasure">Nem mérhető</b>}
      {on ? extra : <p className="ir-why">{why(store)[0].toUpperCase() + why(store).slice(1)}.</p>}
      <div className="ir-rate">{avg ? <span className="ir-sring"><Ring p={avg / 5} kind={store === "apple" ? "tick" : "dots"} label={`${fmt(avg, 2)} az 5-ből`}><b>{fmt(avg, 1)}</b></Ring></span> : <span className="ir-sring"><Ring p={0} kind={store === "apple" ? "tick" : "dots"}><b>–</b></Ring></span>}<span><b>{avg ? "Átlagos értékelés" : "Még nincs átlag"}</b><small>{avgSub}</small></span></div>
      <dl className="ir-kv">{rows.map(([l, x]) => <div key={l}><dt>{l}</dt><dd>{x}</dd></div>)}</dl>
    </section>
  );
  const none = (w: string) => <span className="ir-no">{w}</span>;
  return <>
    <div className="s12"><Hero flip label={<>Letöltés {period}<Info>App Store: {aOn ? <><b>{fmt(t.apple)}</b> első letöltés (+ {fmt(t.apple_re)} újraletöltés)</> : <><b>–</b> ({why("apple")})</>}, Google Play: {gOn ? <><b>{fmt(t.google)}</b> telepítés</> : <><b>–</b> ({why("google")})</>}. {aOn && gOn ? "A kettő így összemérhető: mindkettő új felhasználó, az újraletöltés külön." : <b>A fő szám csak a már jelentő áruházat tartalmazza, a valódi összeg nagyobb lehet.</b>}{d.days > 3000 || !lastDay ? null : <> Az előző időszak ugyanilyen hosszú, és szintén az utolsó jelentett nap ({dayS(lastDay)}) előtt ér véget.</>} {realAvg ? <>{raAvg && rg ? "Az áruházak valódi átlaga" : raAvg ? "Az App Store valódi átlaga" : "A Google Play valódi átlaga"} <b>{fmt(realAvg, 2)} ★</b> (minden értékelésből, nem csak a szövegesekből{raAvg && rg ? "; a két áruház az értékelések számával súlyozva" : ""}).</> : cnt ? <>A letöltött véleményekből számolt átlag <b>{fmt(avgRev, 2)} ★</b> ({fmt(cnt)} vélemény).</> : "Még nincs értékelés letöltve."}{unanswered ? <> <b>{fmt(unanswered)}</b> 3 csillag alatti vélemény vár válaszra.</> : null}</Info></>}
      v={dlOn ? now : null} chg={dlOn && prev > 0 && d.days <= 3000 ? <Chg a={now} b={prev} tail="előtte" /> : undefined}
      sub={!dlOn ? "Az áruházak még nem jelentettek." : aOn && gOn ? (lastDay ? `${dayS(lastDay)}-ig, az utolsó jelentett napig` : undefined) : aOn ? "Csak az App Store, a Google Play nem mérhető." : "Csak a Google Play, az App Store nem mérhető."}
      side={daysRows.length ? <StackedColumns days={daysRows} keys={["apple", "apple_re", "google"]} label={lbl} color={col} height={100} /> : undefined} /></div>
    <div className="s12 ir-stores">
      {card("apple", aOn, n(t.apple), "Első letöltés", <small className="ir-extra">+ {fmt(t.apple_re)} újraletöltés</small>, raAvg, raN ? `${fmt(raN)} értékelés, ${ra.length} ország` : "az App Store nyilvános adataiból", [
        ["Utolsó jelentett nap", aOn ? dayS(d.last.apple) : none("nincs")],
        ["Szöveges vélemény", rv("apple") ? fmt(rv("apple")) : none("még nincs")],
        ["Verzió", verA || none("nincs adat")],
        ["Összeomlás", has("apple", "crashes") ? fmt(tot("apple", "crashes")) : none("nincs adat")],
      ])}
      {card("google", gOn, n(t.google), "Telepítés", null, rg, d.real?.google?.day ? `a Play-jelentés szerint, ${agoDay(d.real.google.day)}` : "a Play-jelentésekből", [
        ["Utolsó jelentett nap", gOn ? dayS(d.last.google) : none("nincs")],
        ["Szöveges vélemény", rv("google") ? fmt(rv("google")) : none("még nincs")],
        ["Verzió", none("nem mérhető")],
        ["Összeomlás", has("google", "crash_rate") ? `${fmt(tot("google", "crash_rate"), 2)}%` : none("nincs adat")],
      ])}
    </div>
    <p className="note s12">A nem mért szám nem nulla.<Info>Az App Store első letöltést, a Google Play felhasználói telepítést ad, ezért a kettő összemérhető, de az újraletöltés külön van.</Info></p>
  </>;
}

function StoreReviews({ days }: { days: number }) {
  const q = useRpc("admin_stores", { p_days: days || 3650 }, [days]);
  const [f, setF] = useState<"open" | "all">("all"); const [more, setMore] = useState(30);
  return <Async q={q} h={260}>{(d) => {
    const all: D[] = d.reviews || [], open = all.filter((r) => !r.reply && n(r.rating) < 3), shown = f === "open" ? open : all;
    return <><section className="c"><BigRating d={d} /></section><Card eager className="s12" icon={P.mail} src={["apple", "google"]} title={`Vélemények (${fmt(all.length)})`} sub="A válasz nyilvános, és csak akkor megy ki, amikor megnyomod a küldés gombot."
      right={<div className="adm-seg sm"><button aria-pressed={f === "all"} onClick={() => { setF("all"); setMore(30); }}>Mind</button><button aria-pressed={f === "open"} onClick={() => { setF("open"); setMore(30); }}>Válaszra vár · {fmt(open.length)}</button></div>}>
      {shown.length ? <><ul className="revs">{shown.slice(0, more).map((r) => <Review key={r.store + r.review_id} r={r} done={q.load} />)}</ul>{shown.length > more && <button type="button" className="ir-more" onClick={() => setMore(more + 30)}>Még {fmt(Math.min(30, shown.length - more))} ({fmt(shown.length - more)} van még)</button>}</> : <Empty t={all.length ? "Nincs válaszra váró, 3 csillag alatti vélemény." : "Még egyik áruházból sem jött szöveges vélemény: a legutóbbi lehúzás mindkettőnél 0 sort hozott. Amint érkezik, itt lesz, innen válaszolhatsz."} icon={P.mail} />}
    </Card></>;
  }}</Async>;
}

/* ---------- revenue: fills by itself when payments go on; nothing is converted between currencies.
   InkAge takes no payments and has no packages yet: no plan names are fixed here, a ring shows only for a plan that really sold ---------- */
const PLAN_L: Record<string, string> = {};
const money = (v: unknown, c: unknown) => `${fmt(Math.round(n(v) * 100) / 100, 2)} ${String(c || "").toUpperCase()}`;
const PLAN_K: RingKind[] = ["solid", "tick", "dots", "seg"];
/* the plans as rings; a ring is the plan's share of the sales, and with no sale it stays empty */
function PlanRings({ plans }: { plans: D[] }) {
  const tot = plans.reduce((a, x) => a + n(x.n), 0), rows = [...Object.keys(PLAN_L).map((k) => plans.find((x) => x.k === k) || { k, n: 0, people: 0 }), ...plans.filter((x) => !PLAN_L[x.k])];
  return <ul className="ir-plans">{rows.map((x, i) => <li key={x.k}><Ring p={tot ? n(x.n) / tot : 0} kind={PLAN_K[i % 4]} label={`${PLAN_L[x.k] || x.k}: ${tot ? pct(n(x.n), tot) : "nincs eladás"}`}><b>{tot ? pct(n(x.n), tot) : "–"}</b></Ring><b>{PLAN_L[x.k] || x.k}</b><small>{tot ? `${fmt(x.n)} eladás · ${fmt(x.people)} fizető` : "nincs eladás"}</small></li>)}</ul>;
}
function Revenue({ days }: { days: number }) {
  const q = useRpc("admin_revenue", { p_days: days || 3650 }, [days]);
  /* the list has no period before: the double window minus this one is exactly that, currency by currency */
  const dbl = useRpc("admin_revenue", { p_days: days * 2 }, [days], !days);
  const s = useRpc("admin_sales", { p_days: Math.min(days || 365, 365) }, [days]);
  return <>
    <Async q={q} h={200}>{(d) => {
      const none = !n(d.all_time), rev: D[] = d.rev || [], dd: D[] = d.days || [], plans: D[] = d.plans || [], list: D[] = d.list || [], src: D[] = (s.d as D)?.by_source || [];
      if (none) return <div className="s12 ir-money"><Hero flip label={`Bevétel · ${daysLabel(days)}`} text="–" max={110} sub={d.live ? "A fizetés be van kapcsolva, még nem volt eladás." : "Még nincs fizetés: az InkAge most nem fogad fizetést."} /></div>;
      const cur = Array.from(new Set(dd.map((x) => String(x.currency)))), map = new Map<string, D>();
      dd.forEach((x) => { const o = map.get(x.t) || { t: x.t, v: {} }; o.v[x.currency] = n(x.v); map.set(x.t, o); });
      /* the largest currency is the figure, the others stand beside it: nothing is converted */
      const top = rev[0], rest = rev.slice(1), now2 = top ? n(((dbl.d as D)?.rev || []).find((x: D) => x.currency === top.currency)?.v) : 0, prev = top && dbl.d ? Math.round((now2 - n(top.v)) * 100) / 100 : 0;
      return <>
        <div className="s12 ir-money">
          <Hero flip label={`Bevétel · ${daysLabel(days)}`} text={top ? money(top.v, top.currency) : "0"} chg={top && prev > 0 ? <Chg a={n(top.v)} b={prev} unit={" " + String(top.currency).toUpperCase()} tail="előtte" /> : undefined}
            sub={rest.length ? rest.map((x) => money(x.v, x.currency)).join(" · ") : undefined}
            side={<div className="ink-trio"><div><b>{fmt(d.sales)}</b><small>eladás</small></div><div><b>{fmt(d.people)}</b><small>fizető</small></div></div>} />
          {plans.length > 0 && <section className="c"><h3 className="ink-h">Csomagok</h3><PlanRings plans={plans} /></section>}
        </div>
        <p className="note s12">Bruttó, ahogy a vásárlás rögzült: az áruházak jutaléka és a visszatérítés nincs levonva, mert ezt nem kapjuk meg.{cur.length > 1 ? " Pénznemenként külön, nincs átváltva." : ""}</p>
        <Card eager className="s12" icon={P.traffic} title="Bevétel naponta" sub="Budapesti idő szerint."><StackedColumns days={[...map.values()] as any} keys={cur} label={(k) => k.toUpperCase()} color={(k) => SERIES[cur.indexOf(k) % SERIES.length]} height={150} /></Card>
        <Card eager className="s12" icon={P.traffic} title="Források" sub="Webes fizetésnél a forrás becslés a fiók regisztrációjához legközelebbi látogatásból; áruházi vásárlásnál az áruház neve. Legfeljebb 365 nap.">
          {src.length ? <BarList items={src.map((x) => ({ k: `${x.source} (${String(x.currency).toUpperCase()})`, n: n(x.sales), sub: `${fmt(x.people)} fizető · ${money(x.rev, x.currency)}` }))} /> : <Empty t="Ebben az időszakban nincs eladás." />}
        </Card>
        <Card eager className="s12" icon={P.users} title={`Fizetők (${fmt(d.people)})`} sub="A legutóbbi 100 vásárlás."><Tbl name="fizetok" rows={list} empty="Nincs ilyen." cols={[
          { k: "email", l: "Fiók", ph: "name", r: (r) => r.email || "ismeretlen fiók" }, { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => money(r.amount, r.currency) },
          { k: "plan", l: "Csomag", ph: "sub", r: (r) => PLAN_L[r.plan] || r.plan || "–" }, { k: "store", l: "Hol", ph: "sub" }, { k: "at", l: "Mikor", r: (r) => ago(r.at) }]} /></Card>
      </>;
    }}</Async>
    <Card className="s12" icon={P.bolt} title="Költség előnézetenként" noData="Nem mérhető: a rendszer nem menti, mennyibe kerül egy MI-hívás, és a kódban sincs rögzített összeg előnézetenként. Ezért a bevétellel sem vethető össze. A pontos szám a szolgáltatók számlájáról jöhet." />
    <ShareOne />
  </>;
}

/* the investor link in one tap: the valid one again, a new one only when there is none (revoke: Linkek oldal) */
const SHARE_L = "Befektetői riport";
function ShareOne() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_share_list", undefined, []);
  const [busy, setBusy] = useState(false); const [url, setUrl] = useState("");
  const rows: D[] = Array.isArray(q.d) ? (q.d as D[]) : [];
  const live = rows.find((x) => x.label === SHARE_L && new Date(x.expires_at) > new Date());
  const go = async () => {
    setBusy(true); haptic(10);
    let t: string | undefined = live?.token;
    if (!t) { const { data, error } = await rpc(sb, "admin_share_create", { p_label: SHARE_L, p_days: 30 }); if (error) { setBusy(false); toast("Nem sikerült"); return; } t = String(data); q.load(); }
    const u = `${location.origin}/r/${t}`; setUrl(u); setBusy(false);
    try { await navigator.clipboard?.writeText(u); toast("Link kimásolva"); } catch { /* the link stays on screen */ }
  };
  return <section className="c gw-share"><b>Befektetői riport</b>
    <p className="gn-when">{live ? `Van érvényes linked, ${new Date(live.expires_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}-ig; ${fmt(live.views)} megnyitás.` : "Egy érintésre készül egy 30 napig élő link. Senkinek nem megy ki semmi: te küldöd el, akinek akarod."}</p>
    <div className="gx-b"><button className="adm-ibtn gold" onClick={go} disabled={busy}>{busy ? "Készül…" : live ? "Link másolása" : "Link készítése és másolása"}</button>{url && typeof navigator.share === "function" && <button className="adm-ibtn" onClick={() => navigator.share({ url: url, title: SHARE_L }).catch(() => null)}>Megosztás</button>}<a className="adm-ibtn" href="#links">Linkek</a></div>
    {url && <code className="gw-url">{url}</code>}</section>;
}

/* one review, with a reply box for the unanswered ones (the reply goes out in the store itself) */
function Review({ r, done }: { r: D; done: () => void }) {
  const [open, setOpen] = useState(false); const [txt, setTxt] = useState(""); const [busy, setBusy] = useState(false);
  const lim = r.store === "google" ? 350 : 5000;
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
      {open && <div className="grw-reply"><textarea className="adm-in" rows={3} maxLength={lim} value={txt} onChange={(x) => setTxt(x.target.value)} placeholder="A válaszod (nyilvános, az áruházban jelenik meg)" /><small className={"ir-count" + (txt.length >= lim ? " full" : "")}>{fmt(txt.length)} / {fmt(lim)}{txt.length >= lim ? `: ${ST[r.store] || "az áruház"} ennél többet nem enged` : ""}</small><button className="adm-ibtn gold" onClick={send} disabled={busy || !txt.trim()}>{busy ? "Küldés…" : "Válasz küldése"}</button></div>}
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
  const add = async (id: string) => {
    setMsg("Hozzáadás…");
    let j: D = {};
    try { const r = MOCK ? { ok: true, json: async () => ({ ok: true }) } : await fetch("/api/admin/competitors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app_id: id }) }); j = await r.json(); } catch { j = { error: "Nem sikerült: nincs kapcsolat." }; }
    setMsg(j.ok ? "Hozzáadva." : j.error || "Nem sikerült."); if (j.ok) { setQ(""); load(); }
  };
  const del = async (r: D) => { if (!window.confirm(`Biztosan leveszed a figyelésből: ${r.name}? A múltbeli adatai is törlődnek.`)) return; const { error } = await rpc(sb, "admin_competitor_delete", { p_app_id: r.app_id }); if (error) { toast("Nem sikerült törölni: " + error.message); return; } toast("Törölve"); load(); };
  /* the older shape (a plain list) still reads */
  const X: D = Array.isArray(d) ? { apps: d, countries: [], aso: [] } : (d as D) || {};
  const list: D[] = X.apps || [], countries: string[] = X.countries || [], aso: D[] = X.aso || [];
  const terms = Array.from(new Set(aso.map((x) => x.term)));
  const versions: D[] = list.flatMap((a) => ((a.versions || []) as D[]).map((v): D => ({ ...v, name: a.name, mine: a.mine }))).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 30);
  return (
    <>
      <div className="adm-row">
        <input className="adm-in" style={{ flex: "1 1 280px" }} placeholder="Keresés az App Store-ban: pl. „tattoo”, „tetoválás”, egy app neve…" value={q} onChange={(e) => setQ(e.target.value)} />{msg && <span className="note">{msg}</span>}
        {countries.length > 1 && <select className="adm-in sm" value={cc || X.country || ""} onChange={(e) => setCc(e.target.value)}>{countries.map((c) => <option key={c} value={c}>{countryName(c.toUpperCase())}</option>)}</select>}
        <div className="adm-seg sm"><button aria-pressed={mode === "stars"} onClick={() => setMode("stars")}>Trend: csillag</button><button aria-pressed={mode === "count"} onClick={() => setMode("count")}>Trend: darab</button></div>
      </div>
      {res.length > 0 && <ul className="comp-res">{res.map((x) => <li key={x.app_id}>{x.icon && <img src={x.icon} alt="" />}<span><b>{x.name}</b><small>{x.developer} · {x.rating ? fmt(x.rating, 1) + " ★" : "–"} · {fmt(x.ratings)} értékelés</small></span><button className="adm-ibtn sm" onClick={() => add(x.app_id)}>{I(P.plus)}Figyelés</button></li>)}</ul>}
      <Tbl name="versenytarsak" rows={list.map((a) => { const s = ((a.series || []) as D[]).map((x) => n(mode === "stars" ? x.r : x.v)); return { ...a, w: a.ratings_week_ago != null ? n(a.ratings) - n(a.ratings_week_ago) : null, s: s.length > 1 ? Math.round((s[s.length - 1] - s[0]) * 100) / 100 : null }; })} empty="Még nincs figyelt app. Keress rá fent egy hasonló alkalmazásra." cols={[
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
