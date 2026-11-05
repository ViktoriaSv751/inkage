"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarList, Delta, Empty, Info, StackedColumns, chColor, compact, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { Chg, Hero } from "../ink";
import { IRow, dayTol } from "./reach-ink";
import { daysLabel, COUNTRY, Card, DEV, FreshRow, Loading, P, PF, Tbl, big, n, posChip, short, type D, useRpc, NeedKey } from "../shared";
import { PostDrawer } from "./social";
import { ReachMatrix } from "./social-wave";

/* ---------- appearances: how many times InkAge was shown, everywhere, and in connection with what ---------- */
export const IMP_SRC: Record<string, { l: string; what: string }> = {
  google: { l: "Google-keresés", what: "megjelenés a találatok között (Search Console)" },
  instagram: { l: "Instagram", what: "megtekintés (a Meta 2025 óta így hívja a megjelenést)" },
  facebook: { l: "Facebook", what: "megtekintés (a megjelenés új neve)" },
  pinterest: { l: "Pinterest", what: "megjelenés (impression)" },
  linkedin: { l: "LinkedIn", what: "megjelenés (impression)" },
  tiktok: { l: "TikTok", what: "megtekintés (az API ennél többet nem ad)" },
  youtube: { l: "YouTube", what: "bélyegkép-megjelenés (a Reporting API napi jelentéséből); amíg nincs, a videók megtekintése" },
  appstore: { l: "App Store", what: "megjelenés keresésben és böngészésben" },
  googleplay: { l: "Google Play", what: "áruházi oldal megnyitása (a Play megjelenést nem ad ki, ez a legközelebbi szám)" },
  bing: { l: "Bing-keresés", what: "megjelenés a Bing találatai között (a ChatGPT keresője is ebből dolgozik)" },
};
const ORDER = ["google", "bing", "tiktok", "instagram", "facebook", "youtube", "pinterest", "linkedin", "appstore", "googleplay"];
/* Meta's "views" count plays as well: not added to the appearances, shown beside them like TikTok's */
const PLAYS = ["instagram", "facebook"];
/* where a number was expected and none has arrived: said by name, not left out silently */
const EMPTY: Record<string, string> = { bing: "Bing", appstore: "App Store", googleplay: "Google Play" };
const col = (k: string) => (k === "appstore" ? "var(--ser-4)" : k === "googleplay" ? "var(--ser-3)" : chColor(k));
/* how a platform's day number is made: the account's own number for the day, or the growth of its posts' counters */
const METHOD: Record<string, string> = { account: "a fiók napi száma", posts: "a posztok napi növekedése" };
const lab = (k: string) => IMP_SRC[k]?.l || PF[k] || k;
const ASRC: Record<string, string> = { "App Store Search": "App Store-keresés", "App Store Browse": "Böngészés (Ma, Játékok, Appok)", "App Referrer": "Más appból", "Web Referrer": "Weboldalról", Unavailable: "Nem ismert" };

/* a post's page counts all its views: over it, what the list above counted, so the two numbers never look like a mistake */
function PeriodNote({ p, label }: { p: D; label: string }) {
  const [host, setHost] = useState<Element | null>(null);
  /* the page draws itself a moment after this: look until it is there */
  useEffect(() => { let t = 0, live = true; const look = () => { const e = document.querySelector(".drawer"); if (!live) return; if (e) setHost(e); else if (t++ < 40) setTimeout(look, 50); }; look(); return () => { live = false; }; }, []);
  if (!host) return null;
  return createPortal(<p className="ir-postnote"><b>{big(p.n)}</b> megtekintés ebben az időszakban ({label}). Lent a poszt számai összesen, a megjelenése óta.</p>, host);
}

export function Impressions({ days }: { days: number }) {
  /* exactly the chosen days: each source counts them back from its own last day of data (Google is 1–3 days late) */
  const dd = days || 480;
  const { d, e } = useRpc("admin_impressions", { p_days: dd }, [dd]);
  const reach = useRpc("admin_social_reach", undefined, []);
  const [openP, setOpenP] = useState<D | null>(null);
  const [qv, setQv] = useState<"queries" | "pages">("queries");
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const T: D = d.totals || {}, PV: D = d.prev || {};
  const allKeys = ORDER.filter((k) => T[k] != null || PV[k] != null), keys = allKeys.filter((k) => !PLAYS.includes(k)), plays = allKeys.filter((k) => PLAYS.includes(k));
  const empty = Object.keys(EMPTY).filter((k) => T[k] == null && PV[k] == null);
  /* a previous window reaching before the first day a source has numbers compares with days that were never measured */
  const cmpOk = (k: string) => { const w = (d.windows || {})[k], s = (d.since || {})[k]; if (!w || !s) return true; const p = new Date(new Date(w.from + "T12:00:00Z").getTime() - dd * 864e5).toISOString().slice(0, 10); return p >= s; };
  const total = keys.reduce((a, k) => a + n(T[k]), 0), prev = keys.reduce((a, k) => a + n(PV[k]), 0), allCmp = keys.every(cmpOk);
  const daily = ((d.daily || []) as D[]).map((x) => ({ t: x.day, v: Object.fromEntries(keys.map((k) => [k, n(x.v?.[k])])) }));
  const posts: D[] = d.posts || [];
  const M: D = d.method || {}, VB: D = d.visits_by || {};
  /* the days a source's number covers, e.g. "okt. 16 – okt. 22" (one day: just the day) */
  const dl = (s: string) => new Date(s + "T12:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
  const rng = (k: string) => { const w = (d.windows || {})[k]; return w ? (w.from === w.to ? dl(w.from) : `${dl(w.from)} – ${dl(w.to)}`) : ""; };
  /* every how-many-th appearance became a visit, per source (store visits are not ours to count) */
  const every = (k: string) => { const v = k === "appstore" || k === "googleplay" ? 0 : n(VB[k]); return v && n(T[k]) ? n(T[k]) / v : null; };
  /* the visits that came from a source we have appearances for (not every visit of the period: most come with no source) */
  const fromShown = keys.filter((k) => k !== "appstore" && k !== "googleplay").reduce((a, k) => a + n(VB[k]), 0);
  /* video views (TikTok; YouTube until its thumbnail report): not appearances, apart */
  /* the click rate as a value of its own: without it its column cannot be sorted or exported */
  const withCtr = (rows?: D[]) => (rows || []).map((r) => ({ ...r, ctr: n(r.impressions) ? Math.round((n(r.clicks) / n(r.impressions)) * 1000) / 10 : 0 }));
  const VW: D = d.views || {}, VWP: D = d.views_prev || {}, vks = Object.keys(VW).filter((k) => n(VW[k]) > 0 || n(VWP[k]) > 0);
  return (
    <div className="g">
      <FreshRow srcs={["gsc", "tiktok", "instagram", "facebook", "youtube", "pinterest", "linkedin", "apple", "google"]} />
      {d.bing_last && <div className="s12 fresh-row"><span className={"fresh " + (Date.now() - new Date(d.bing_last).getTime() < 5 * 864e5 ? "ok" : "old")}><i />Bing: adat {new Date(d.bing_last).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}-ig</span></div>}
      <div className="s12"><Hero flip label={<>Megjelenés összesen · {dd === 1 ? "ma" : daysLabel(dd)}<Info>Ennyiszer jelentünk meg itt: <b>{keys.map(lab).join(", ") || "még sehol"}</b>{empty.length ? <> (innen még nincs adat: {empty.map((k) => EMPTY[k]).join(", ")})</> : null}. Nincs benne a lejátszás és a megtekintés: {[...plays, ...vks].map((k) => `${PF[k] || k} ${big(n(T[k]) + n(VW[k]))} megtekintés`).join(", ") || "nincs ilyen adat"}; ezek más mértékegység, külön látszanak. Ezekről a megjelenést számoló forrásokról <b>{fmt(fromShown)}</b> látogatás jött: minden <b>{total && fromShown ? fmt(total / fromShown) : "–"}</b>. megjelenésből egy (az időszak összes látogatása {fmt(d.visits)}, a legtöbb forrás nélkül érkezik). A források utolsó napja eltér, mindegyik a saját utolsó adatos napjáig számol.{allCmp ? null : " Az előző időszakhoz nem hasonlítunk, mert még nem volt mérés akkor."} A Google-szám a Google napi összesítőjéből jön (ugyanaz, mint a Search Console felületén{d.gsc_exact_from ? `, ${dayTol(d.gsc_exact_from)}; előtte a keresési sorokból, kisebb` : ""}), 2–3 nap késéssel{d.gsc_last ? ` (utolsó nap: ${new Date(d.gsc_last + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}, a mai még félkész)` : ""}.</Info></>} v={total}
        chg={allCmp ? <Chg a={total} b={prev} tail="előtte" /> : undefined} sub={d.windows?.google ? "Google: " + rng("google") : undefined}
        side={<div className="ir-side"><ul className="ir-ics">{keys.map((k) => <li key={k} title={lab(k)}>{k === "appstore" ? <Logo k="apple" size={34} /> : <Logo k={k === "googleplay" ? "play" : k} size={34} />}<b>{big(T[k])}</b><small>{lab(k)}</small></li>)}{[...plays.map((k) => [k, T[k]] as const), ...vks.map((k) => [k, VW[k]] as const)].map(([k, v]) => <li key={"v" + k} className="vw" title={`${PF[k] || k}: megtekintés, nincs az összegben`}><Logo k={k} size={34} /><b>{big(v)}</b><small>megtekintés</small></li>)}</ul>{daily.length ? <StackedColumns days={daily} keys={keys} label={lab} color={col} height={110} /> : null}</div>} /></div>

      <section className="s12 ir-list">{keys.map((k) => (
        <IRow key={k} ico={k === "appstore" ? <Logo k="apple" size={44} /> : <Logo k={k === "googleplay" ? "play" : k} size={44} />}
          t={<>{lab(k)}<Info>{IMP_SRC[k]?.what}.{M[k] ? ` Forrás: ${METHOD[M[k]]}.` : ""}{k === "google" || k === "bing" ? " A legutóbbi napokig, amit a Google vagy a Bing kiadott." : ""}</Info></>}
          sub={[rng(k), every(k) != null ? `minden ${fmt(every(k)!)}. megjelenésből látogatás lett (${fmt(VB[k])})` : ""].filter(Boolean).join(" · ") || undefined} a={big(T[k])} b={cmpOk(k) ? <Delta now={n(T[k])} prev={n(PV[k])} /> : pct(n(T[k]), Math.max(1, total))} />))}
        {!keys.length && <div className="c"><Empty t="A bekötött platformok és a Google megjelenései itt gyűlnek, naponta." icon={P.eye} /></div>}
        {plays.map((k) => (
          <IRow key={"p" + k} ico={<Logo k={k} size={44} />} t={<>{lab(k)}-megtekintés<Info>A fiók napi száma: a lejátszásokkal együtt, ezért nincs a megjelenések összegében. {IMP_SRC[k]?.what}. A posztok saját számai (Közösségi oldal) ettől eltérnek: ott csak a posztok számítanak, budapesti napokra bontva.</Info></>}
            sub={[rng(k), n(VB[k]) ? `${fmt(VB[k])} látogatás innen` : ""].filter(Boolean).join(" · ") || undefined} a={big(T[k])} b={cmpOk(k) ? <Delta now={n(T[k])} prev={n(PV[k])} /> : undefined} />))}
        {empty.map((k) => (
          <IRow key={"e" + k} ico={k === "appstore" ? <Logo k="apple" size={44} /> : <Logo k={k === "googleplay" ? "play" : k} size={44} />} t={lab(k)} sub="Még nincs adat: nem 0, hanem ismeretlen." a="–" />))}
        {vks.map((k) => (
          <IRow key={"v" + k} ico={<Logo k={k} size={44} />} t={<>{PF[k] || k}-megtekintés<Info>Videó-megtekintés, nem megjelenés: nincs az összegben (a platform megjelenést nem ad ki). Amit a videók ezeken a napokon kaptak: a napi pillanatképek különbsége; ami a mérés kezdete előtt gyűlt össze, az a videó megjelenésének napjára számít.</Info></>}
            sub={rng(k) || undefined} a={big(VW[k])} b={n(VWP[k]) > 0 ? <Delta now={n(VW[k])} prev={n(VWP[k])} /> : undefined} />))}
      </section>
      {/* the platforms side by side for today, 3, 7 and 30 days, whatever period the header shows */}
      <ReachMatrix r={(reach.d as D | null) || null} pick={() => { location.hash = "social"; }} add={() => { location.hash = "social"; }} err={reach.e} retry={reach.load} />

      <Card className="s12" icon={P.layers} title="Megjelenés naponta, forrásonként" sub="Minden oszlop egy nap; a színek a források. Csak megjelenés: a TikTok-, Instagram- és Facebook-megtekintés más mértékegység, itt nem szerepel. A Pinterest (és a LinkedIn, YouTube-on a bélyegkép-megjelenés) a fiók saját napi számával szerepel, a napi jelentésből, nem a 90 napos gördülő összegből; 1–2 nap késéssel érkezik." src={["gsc", "tiktok", "instagram", "facebook", "youtube", "pinterest", "linkedin", "apple"]}
        foot={<div className="legend">{keys.map((k) => <span key={k}><i className="sq" style={{ background: col(k) }} />{lab(k)}</span>)}</div>}>
        {daily.length ? <StackedColumns days={daily} keys={keys} label={lab} color={col} /> : <Empty t="Még nincs napi adat." />}
      </Card>

      <Card className="s12" icon={P.search} title="Mi kapcsán jelentünk meg a Google-ben" sub="A keresések, amelyekre a Google megmutatott minket, a megjelenések szerint: hányszor láttak, hányan kattintottak, hányadik helyen voltunk. Az Oldalak nézet: melyik oldalunk hány keresésnél jelent meg." src="gsc"
        right={<div className="adm-seg sm"><button aria-pressed={qv === "queries"} onClick={() => setQv("queries")}>Keresések</button><button aria-pressed={qv === "pages"} onClick={() => setQv("pages")}>Oldalak</button></div>}>
        {qv === "queries" ? <Tbl name="megjelenes-keresesek" rows={withCtr(d.queries)} empty="Még nincs Google-adat." cols={[
          { k: "query", l: "Keresés", r: (r) => <span className="cellwrap">{r.query}<br /><span className="mut">{short(r.page)}</span></span> },
          { k: "impressions", l: "Megjelenés", num: true, r: (r) => <b>{fmt(r.impressions)}</b> }, { k: "clicks", l: "Kattintás", num: true, r: (r) => fmt(r.clicks) },
          { k: "ctr", l: "CTR", num: true, r: (r) => pct(n(r.clicks), n(r.impressions)) }, { k: "pos", l: "Helyezés", num: true, r: (r) => posChip(n(r.pos)) },
        ]} /> : <Tbl name="megjelenes-oldalak" rows={withCtr(d.pages)} empty="Még nincs Google-adat." cols={[
          { k: "page", l: "Oldal", r: (r) => <a className="cellwrap" href={r.page} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{short(r.page) || "/"}</a> },
          { k: "impressions", l: "Megjelenés", num: true, r: (r) => <b>{fmt(r.impressions)}</b> }, { k: "queries", l: "Keresés", num: true, r: (r) => fmt(r.queries) },
          { k: "clicks", l: "Kattintás", num: true, r: (r) => fmt(r.clicks) }, { k: "ctr", l: "CTR", num: true, r: (r) => pct(n(r.clicks), n(r.impressions)) },
        ]} />}
      </Card>

      <Card className="s7" icon={P.social} title="Mely posztok kapcsán jelentünk meg" sub="A posztok, amelyek ebben az időszakban a legtöbb megjelenést (megtekintést) gyűjtötték, minden platformról. Kattints egy posztra a részletekért." src={["tiktok", "instagram", "facebook", "youtube", "pinterest", "linkedin"]}>
        {posts.length ? <ul className="imp-posts">{posts.slice(0, 10).map((p) => (
          <li key={p.platform + p.post_id} onClick={() => setOpenP(p)}><Logo k={p.platform} size={24} /><span>{String(p.title || "(nincs szöveg)").slice(0, 70)}{p.views != null && n(p.views) !== n(p.n) && <small className="ir-postsum">összesen {big(p.views)}</small>}</span><b>{big(p.n)}</b></li>))}</ul>
          : <Empty t="Még nincs poszt ebben az időszakban (vagy még csak egy napi pillanatkép van róluk)." icon={P.social} />}
      </Card>
      <Card className="s5" icon={P.globe} title="Hol: országok és eszközök" sub={`A Google-megjelenések országonként és eszközönként, a keresési sorokból: ezekből a Google kihagyja az anonimizált kereséseket, ezért együtt csak ${fmt(d.rows_impressions)} megjelenést fednek le a ${fmt(T.google)}-ból.`} src="gsc">
        <BarList items={((d.countries || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={COUNTRY} max={6} accent empty="Még nincs adat." />
        <div style={{ height: 10 }} />
        <BarList items={((d.devices || []) as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => DEV[k] || k} max={3} />
      </Card>
      <Card className="s12" icon={P.layers} title="App Store: hol láttak minket" sub="Az App Store-megjelenések forrásonként (keresés, böngészés, más app, weboldal), az App Store Connect elemzéseiből." src="apple">
        {(d.store_sources || []).length ? <BarList items={(d.store_sources as D[]).map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => ASRC[k] || k} accent />
          : <Empty t="Az App Store Connect kulcsai és az első napi jelentés után jelenik meg (az Apple 1–2 nap késéssel adja)." icon={P.layers}><NeedKey k={["ASC_ISSUER_ID", "ASC_KEY_ID", "ASC_PRIVATE_KEY", "ASC_APP_ID"]} /></Empty>}
      </Card>
      <p className="note s12">A megtekintés nincs a megjelenésekben. Összesen: {compact(total)} megjelenés.<Info>TikTokon a nyilvános API csak megtekintést ad, az Instagram és a Facebook pedig a lejátszásokat is a megtekintésbe számolja: ezeket külön mutatjuk, és nem adjuk a megjelenésekhez; a „megjelenés a hírfolyamban” száma a TikTok Business API engedélyével jöhet. YouTube-on a bélyegkép-megjelenés a Reporting API napi jelentéséből jön (a bekötés után 1–2 nappal indul).</Info></p>
      {openP && <><PostDrawer p={openP} close={() => setOpenP(null)} /><PeriodNote key={openP.platform + openP.post_id} p={openP} label={daysLabel(dd)} /></>}
    </div>
  );
}
