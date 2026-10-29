"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Delta, Empty, Spark, TrendChart, fmt, pct } from "../charts";
import { toast } from "../phone";
import { BingEmpty, agoDay } from "./social";
import { Band, Card, I, Kpi, Layer, Loading, MOCK, Mini, P, Tbl, ago, api, lang, n, posChip, rpc, short, type D, useRpc } from "../shared";

/* ---------- SEO check: the whole site crawled, cannibalisation, keyword ideas, Bing, competitors' content, Google's updates ---------- */
const SEV: Record<string, string> = { bad: "Hiba", warn: "Javítandó", info: "Tipp" };
const APP: Record<string, string> = { AMP_BLUE_LINK: "AMP", RICHCARD: "Gazdag találat", VIDEO: "Videó", FAQ_RICH_RESULT: "GYIK", HOWTO_RICH_RESULT: "Útmutató", REVIEW_SNIPPET: "Értékelés", TRANSLATED_RESULT: "Fordított találat",
  WEBLITE: "Weblite", PRODUCT_SNIPPETS: "Termék", MERCHANT_LISTINGS: "Kereskedői", BREADCRUMB: "Morzsamenü", SITELINKS: "Al-linkek" };
/* the intent of a search, from its words: learning, comparing or doing */
export const intent = (q: string) => /\b(best|legjobb|top|vs|alternat|review|vélemény|comparison|összehasonl)/i.test(q) ? ["összehasonlító", "butter"]
  : /\b(app|download|letölt|generator|generátor|maker|online|free|ingyen|create|készít|tervez)/i.test(q) ? ["cselekvő", "mint"]
  : /\b(how|hogyan|what|mi |miért|why|mit jelent|meaning|jelentés|ideas|ötlet|tipp)/i.test(q) ? ["információs", "sky"] : ["általános", ""];

export function Seo() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [days, setDays] = useState(30);
  const { d, e, load } = useRpc("admin_seo", { p_days: days }, [days]);
  const cse = useRpc("admin_cse_ranks", undefined, []);
  const [f, setF] = useState<"all" | "bad" | "warn" | "info">("all"); const [kind, setKind] = useState(""); const [busy, setBusy] = useState(""); const [open, setOpen] = useState<D | null>(null);
  const [ql, setQl] = useState("hu"); const [site, setSite] = useState(""); const [sitemap, setSitemap] = useState(""); const [gap, setGap] = useState(""); const [lost, setLost] = useState(false);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const pages: D[] = d.pages || [];
  const all: D[] = pages.flatMap((p) => ((p.issues || []) as D[]).map((x) => ({ ...x, url: p.url })));
  const cnt = (c: string) => all.filter((x) => x.c === c).length;
  const ok200 = pages.filter((p) => p.status === 200).length;
  const score = pages.length ? Math.max(0, Math.round(100 - (cnt("bad") * 6 + cnt("warn") * 2 + cnt("info") * 0.3) / Math.max(1, pages.length) * 10)) : 0;
  const health: D[] = d.health || [], prevScore = health.length > 1 ? n(health[health.length - 2].score) : undefined;
  const byKind = Object.entries(all.reduce((m: Record<string, D>, x) => { (m[x.k] ||= { k: x.k, t: String(x.t).replace(/\s*(\(|:\s*\d)[\s\S]*$/, "").trim() || x.t, c: x.c, n: 0 }).n++; return m; }, {})).map(([, v]) => v).sort((a, b) => (a.c === "bad" ? -1 : 0) - (b.c === "bad" ? -1 : 0) || b.n - a.n);
  /* the keyword ideas have their own run (?only=kw), so the button collects now, not only on Tuesdays */
  const run = async (only: string) => { setBusy(only); const r = MOCK ? { ok: true, json: {} } : await api(`/api/admin/sync?only=${only}`, { method: "POST" }); setBusy(""); toast(r.ok ? "Kész" : r.json?.error || "Nem sikerült"); load(); };
  const ideas: D[] = (d.ideas || []).filter((x: D) => x.lang === ql);
  const langs = ((d.idea_langs || []) as D[]).map((x) => x.k as string);
  const ideaN = new Map(((d.idea_langs || []) as D[]).map((x) => [x.k, n(x.n)]));
  const addSite = async (ev: React.FormEvent) => { ev.preventDefault(); if (!site.trim()) return; await rpc(sb, "admin_watch_set", { p_kind: "site", p_a: site, p_b: sitemap.trim(), p_on: true }); setSite(""); setSitemap(""); toast("Figyelve: az új oldalai holnap reggeltől"); load(); };
  const shown = pages.filter((p) => (f === "all" || ((p.issues || []) as D[]).some((x) => x.c === f)) && (!kind || ((p.issues || []) as D[]).some((x) => x.k === kind)));
  const today = new Date().toISOString().slice(0, 10);
  const track = async (q: string) => { await rpc(sb, "admin_track_query", { p_q: q, p_on: true }); toast("Követve a Google és cikkek oldalon"); };
  const gapRun = async () => {
    setBusy("gap");
    const ours = pages.filter((p) => p.title).map((p) => p.title).slice(0, 120), theirs = (d.competitor_titles || []).map((x: D) => `${x.domain}: ${x.title}`).slice(0, 200);
    const r = MOCK ? { ok: true, json: { text: "1. Tetoválás öregedése – How do tattoos age over time? – a versenytársak 3 cikket írtak róla." } } : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "gap", data: { mieink: ours, versenytarsak: theirs } }) });
    setBusy(""); setGap(r.ok ? r.json?.text || "" : r.json?.error || "Nem sikerült.");
  };
  const bing = d.bing || {}, comps: D[] = d.competitors || [];
  return (
    <div className="g">
      <Band label="A weboldal egészsége" value={score} unit="/ 100" now={prevScore != null ? score : undefined} prev={prevScore} sentence={<>A heti bejárás {d.checked ? ago(d.checked) : "még nem futott"}: <b>{fmt(pages.length)}</b> oldal minden nyelven, ebből <b>{fmt(ok200)}</b> rendben válaszolt. <b>{fmt(cnt("bad"))}</b> hiba, <b>{fmt(cnt("warn"))}</b> javítandó, <b>{fmt(cnt("info"))}</b> tipp. A pontszám minden bejáráskor elmentődik, így látszik, javul-e.</>}
        side={<div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>{health.length > 1 && <span style={{ width: 160 }}><Spark values={health.map((h) => n(h.score))} h={46} /></span>}<button className="adm-ibtn gold" onClick={() => run("seo")} disabled={!!busy}>{I(P.refresh)}{busy === "seo" ? "Bejárás… (1–2 perc)" : "Bejárás most"}</button></div>} />
      <Kpi kind="own" to="@Oldalak" tone="pink" className="s3" icon={P.alert} l="Hiba" v={fmt(cnt("bad"))} now={cnt("bad")} prev={health.length > 1 ? n(health[health.length - 2].bad) : undefined} invert sub="404, noindex, hibás adat" />
      <Kpi kind="own" to="@Oldalak" tone="butter" className="s3" icon={P.pen} l="Javítandó" v={fmt(cnt("warn"))} now={cnt("warn")} prev={health.length > 1 ? n(health[health.length - 2].warn) : undefined} invert sub="cím, leírás, hreflang" />
      <Kpi kind="own" to="@Árva" tone="sky" className="s3" icon={P.links} l="Árva oldal" v={fmt((d.orphans || []).length)} sub="se belső link, se nyelvi változat nem mutat rá" />
      <Kpi kind="own" to="@Kannibalizáció" tone="mint" className="s3" icon={P.search} l="Kannibalizáció" v={fmt((d.cannibal || []).length)} sub={`keresés, ahol 2+ oldalunk versenyez (${days} nap)`} />

      <Card className="s5" icon={P.alert} src="seo" title="Mi a leggyakoribb" sub="Az észrevételek típusonként, a súlyosak elöl. Kattints egy sorra: az Oldalak tábla csak az ilyen típusú észrevételt hordozó oldalakat mutatja.">
        {byKind.length ? <ul className="seo-kinds">{byKind.map((x: D) => <li key={x.k} className={x.c + (kind === x.k ? " on" : "")} onClick={() => { setKind(kind === x.k ? "" : x.k); setF("all"); }}><span className={"chip " + (x.c === "bad" ? "bad" : x.c === "warn" ? "warn" : "")}>{SEV[x.c]}</span><span>{x.t}</span><b>{fmt(x.n)}</b></li>)}</ul>
          : <Empty t={pages.length ? "Nincs észrevétel. Szép!" : "Az első bejárás hétfő hajnalban fut le, vagy indítsd most fent."} icon={P.check} />}
      </Card>
      <Card className="s7" icon={P.doc} src="seo" title="Oldalak" sub="Minden bejárt oldal a válaszával, a címével, a canonicaljával, a robots-jelzésével, a H1-ek és a kimenő linkek számával és az észrevételeivel. Kattints egy oldalra: a teljes ellenőrzőlista és a cikk-ellenőrző. A sitemapból kikerült oldalak a következő bejáráskor kikerülnek innen is."
        right={<div className="adm-row" style={{ gap: 6 }}>{kind && <span className="chip">{byKind.find((x) => x.k === kind)?.t || kind} <button className="lnk" onClick={() => setKind("")}>×</button></span>}<div className="adm-seg sm">{(["all", "bad", "warn", "info"] as const).map((k) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{k === "all" ? "Mind" : SEV[k]}</button>)}</div></div>}>
        <Tbl name="seo-oldalak" rows={shown} onRow={setOpen} empty="Nincs ilyen oldal." cols={[
          { k: "url", l: "Oldal", r: (r) => <span className="cellwrap">{short(r.url) || "/"}<br /><span className="mut">{String(r.title || "").slice(0, 70)}</span></span> },
          { k: "status", l: "Válasz", num: true, r: (r) => <span className={"chip " + (r.status === 200 ? "good" : r.status >= 400 || !r.status ? "bad" : "warn")} title={r.redirect_to ? "→ " + r.redirect_to : undefined}>{r.status || "–"}{r.redirect_to ? " →" : ""}</span> },
          { k: "canonical", l: "Canonical", r: (r) => (!r.canonical ? <span className="mut">nincs</span> : String(r.canonical).replace(/\/$/, "") === String(r.url).replace(/\/$/, "") ? <span className="mut">önmaga</span> : <span className="chip warn" title={r.canonical}>{short(r.canonical) || "/"}</span>) },
          { k: "robots", l: "Robots", r: (r) => (r.robots ? <span className={/noindex/i.test(r.robots) ? "chip bad" : "mut"}>{r.robots}</span> : <span className="mut">–</span>) },
          { k: "ms", l: "Idő", num: true, r: (r) => `${fmt(n(r.ms))} ms` }, { k: "words", l: "Szó", num: true }, { k: "h1_count", l: "H1", num: true },
          { k: "links_in", l: "Link ide", num: true }, { k: "links_out", l: "Kimenő", num: true },
          { k: "issues", l: "Észrevétel", num: true, r: (r) => { const is: D[] = r.issues || []; return is.length ? <span className={"chip " + (is.some((x) => x.c === "bad") ? "bad" : is.some((x) => x.c === "warn") ? "warn" : "")}>{is.length}</span> : <span className="mut">✓</span>; } },
        ]} />
      </Card>
      <Card className="s12" icon={P.links} title={`Árva oldalak (${fmt((d.orphans || []).length)})`} sub="Élő oldalak, amelyekre se belső link, se másik nyelvi változat (hreflang) nem mutat. A Google nehezen találja meg őket: tegyél rájuk linket egy rokon cikkből vagy a tudásbázis-főoldalról.">
        {(d.orphans || []).length ? <div className="grw-row">{(d.orphans as string[]).map((u) => <a key={u} className="chip" href={u} target="_blank" rel="noreferrer">{short(u) || "/"}</a>)}</div> : <Empty t="Nincs árva oldal." icon={P.check} />}
      </Card>
      {health.length > 1 && <Card className="s12" icon={P.traffic} title="Az egészség-pontszám alakulása" sub="Minden bejárás után elmentve: a pontszám, és a hibák, javítandók száma.">
        <Tbl name="seo-egeszseg" csv rows={[...health].reverse()} cols={[{ k: "day", l: "Nap", r: (r) => new Date(r.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) }, { k: "score", l: "Pontszám", num: true, r: (r) => <b>{r.score}</b> }, { k: "pages", l: "Oldal", num: true }, { k: "bad", l: "Hiba", num: true }, { k: "warn", l: "Javítandó", num: true }, { k: "info", l: "Tipp", num: true }, { k: "orphans", l: "Árva", num: true }]} />
      </Card>}

      <Card className="s12" icon={P.search} title="Kannibalizáció" sub={`Keresések, ahol a Google két vagy több oldalunkat mutatja váltakozva (${days} nap): ilyenkor egyik sem jut előre. A „maradjon” oldal a legtöbb kattintást hozó (egyenlőségnél a több megjelenés); a többi mutasson rá belső linkkel, vagy vond össze őket.`}
        right={<div className="adm-seg sm">{[30, 60, 90, 180].map((k) => <button key={k} aria-pressed={days === k} onClick={() => setDays(k)}>{k} nap</button>)}</div>}>
        {(d.cannibal || []).length ? <ul className="canni">{(d.cannibal as D[]).map((c) => (
          <li key={c.query}><div className="cn-h"><b>„{c.query}”</b><span className="mut">{fmt(c.impressions)} megjelenés · {fmt(c.clicks)} kattintás · {fmt(c.pages)} oldal</span><button className="lnk" onClick={() => track(c.query)}>követés</button></div>
            <div className="cn-l">{(c.list as D[]).map((x, i) => <span key={x.page} className={i === 0 ? "best" : ""}>{short(x.page) || "/"} <small>{fmt(x.clicks)} katt. · {fmt(x.impressions)} megj. · {fmt(x.pos, 1)}. hely{i === 0 ? " · ez maradjon" : ""}</small></span>)}</div></li>))}</ul>
          : <Empty t="Nincs kannibalizáció: minden keresésre egy oldalunk versenyez." icon={P.check} />}
      </Card>

      <Card className="s12" icon={P.spark} src="kw_ideas" title="Kulcsszóötletek" sub="A Google automatikus kiegészítéséből (amit az emberek ténylegesen elkezdenek beírni), minden nyelven; nyelvenként a legfrissebb 80, így a magyar és az angol nem szorítja ki a többit. Hetente frissül magától, a Frissítés gomb most gyűjt. Mellettük a szándék és a mi megjelenésünk; a „követés” a napi helyezéskövetésbe teszi."
        right={<div className="adm-row" style={{ gap: 6 }}><select className="adm-in sm" value={ql} onChange={(x) => setQl(x.target.value)}>{(langs.length ? langs : ["hu"]).map((k) => <option key={k} value={k}>{lang(k)} ({fmt(ideaN.get(k) || 0)})</option>)}</select><button className="adm-ibtn sm" onClick={() => run("kw")} disabled={!!busy}>{busy === "kw" ? "Gyűjtés… (fél perc)" : "Frissítés"}</button></div>}>
        {ideas.length ? <Tbl name={"kulcsszo-otletek-" + ql} rows={ideas} cols={[
          { k: "q", l: "Keresés", r: (r) => <b>{r.q}</b> },
          { k: "intent", l: "Szándék", r: (r) => { const [l, t] = intent(r.q); return <span className={"chip" + (t ? " t-" + t : "")}>{l}</span>; } },
          { k: "impressions", l: "Megjelenésünk (60 nap)", num: true, r: (r) => (n(r.impressions) ? fmt(r.impressions) : <span className="mut">még nincs</span>) },
          { k: "first_seen", l: "Először", r: (r) => agoDay(r.first_seen) }, { k: "x", l: "", r: (r) => <button className="adm-ibtn sm" onClick={() => track(r.q)}>Követés</button> },
        ]} /> : <Empty t="Még nincs ötlet ezen a nyelven: nyomd meg a Frissítést." icon={P.spark} />}
      </Card>

      <Card className="s6" icon={P.layers} title="Hogyan jelentünk meg a Google-ben" sub={`A Search Console találattípusai (${days} nap; ebből ${fmt(d.appearance_days)} nap adatunk van): videó, GYIK, értékelés, al-linkek. Az első lehúzás 30 napot tölt be, utána naponta frissül.`}>
        <BarList items={(d.appearance || []).map((x: D) => ({ k: x.k, n: n(x.impressions), sub: `${fmt(x.clicks)} kattintás` }))} fmtK={(k) => APP[k] || k} empty="Csak sima kék linkként jelenünk meg (vagy még nincs adat). A strukturált adat (Article, FAQ) hozhat gazdag találatot." />
      </Card>
      <Card className="s6" icon={P.search} src="bing" title="Bing" sub={`A Bing Webmaster Tools adatai (${days} nap): a ChatGPT keresője és a Copilot is ebből dolgozik.`}>
        {bing.totals && (n(bing.totals.impressions) || (bing.queries || []).length) ? <>
          <div className="mini-stats" style={{ gridTemplateColumns: "1fr 1fr" }}><Mini l="Megjelenés" v={fmt(bing.totals.impressions)} sub={<Delta now={n(bing.totals.impressions)} prev={n(bing.prev?.impressions)} />} /><Mini l="Kattintás" v={fmt(bing.totals.clicks)} sub={<Delta now={n(bing.totals.clicks)} prev={n(bing.prev?.clicks)} />} /></div>
          {(bing.trend || []).length > 1 && <TrendChart data={(bing.trend as D[]).map((x) => ({ t: x.t, v: n(x.impressions), p: n(x.clicks) }))} label="Megjelenés" prevLabel="Kattintás" height={140} />}
          <BarList items={(bing.queries || []).map((x: D) => ({ k: x.query, n: n(x.impressions), sub: `${fmt(x.clicks)} katt. · ${fmt(n(x.pos), 1)}. hely` }))} max={8} />
        </> : <BingEmpty />}
      </Card>
      <Card className="s12" icon={P.links} src="bing" title="Ránk mutató linkek" sub="A Bing szerint melyik oldal linkel ránk, melyik oldalunkra és milyen szöveggel; az újak elöl. Az elveszett: egy hete nem látja a Bing (a lista minden oldalát lehúzzuk, nem csak az elsőt)."
        right={<div className="adm-seg sm"><button aria-pressed={!lost} onClick={() => setLost(false)}>Élő · {fmt((bing.links || []).length)}</button><button aria-pressed={lost} onClick={() => setLost(true)}>Elveszett · {fmt((bing.lost || []).length)}</button></div>}>
        <Tbl name={lost ? "elveszett-linkek" : "visszamutato-linkek"} rows={(lost ? bing.lost : bing.links) || []} empty={lost ? "Nincs elveszett link." : "A Bing Webmaster Tools bekötése után jelennek meg."} cols={[
          { k: "source", l: "Honnan", r: (r) => <a className="cellwrap" href={r.source} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{String(r.source).replace(/^https?:\/\//, "").slice(0, 70)}</a> },
          { k: "url", l: "Melyik oldalunkra", r: (r) => short(r.url) || "/" }, { k: "anchor", l: "Szöveg", r: (r) => <span className="mut">{r.anchor || "–"}</span> }, { k: "first_seen", l: "Először", r: (r) => agoDay(r.first_seen) },
          ...(lost ? [{ k: "last_seen", l: "Utoljára", r: (r: D) => agoDay(r.last_seen) }] : []),
        ]} />
      </Card>

      {(cse.d as D[] || []).length > 0 && <Card className="s12" icon={P.target} title="Helyezés a Google-keresőben (ahol még nincs Search Console-adat)" sub="A követett keresések naponta a Google Programmable Search szerint: hányadik helyen van a inkage.app az első 30 találat között. A „Legutóbb” oszlop a mérés napját is mutatja, ha nem mai.">
        <Tbl name="cse-helyezes" rows={Object.values(((cse.d as D[]) || []).reduce((m: Record<string, D>, x) => { (m[x.query] ||= { query: x.query, days: [] as D[] }).days.push(x); return m; }, {}))} cols={[
          { k: "query", l: "Keresés", r: (r) => <b>{r.query}</b> }, { k: "pos", l: "Legutóbb", num: true, r: (r) => { const l = (r.days as D[]).slice(-1)[0]; const when = l && String(l.day).slice(0, 10) !== today ? <small className="mut"> ({new Date(l.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })})</small> : null; return <>{l?.pos ? posChip(n(l.pos)) : <span className="mut">30 felett</span>}{when}</>; } },
          { k: "tr", l: "Alakulás", r: (r) => <span style={{ display: "inline-block", width: 120 }}><Spark values={(r.days as D[]).map((x) => -(n(x.pos) || 31))} h={26} /></span> },
        ]} />
      </Card>}

      <Card className="s12" icon={P.target} src="competitors" title="Versenytársak tartalmai" sub="Add meg a versenytársak weboldalát (és ha nem a szokásos helyen van, a sitemapjuk címét): minden reggel átnézzük, és itt látod az új oldalaikat. Az első átnézéskor talált oldalak nem számítanak újnak. A Témahiány gomb az MI-vel összeveti a címeiket a mieinkkel."
        right={<button className="adm-ibtn sm" onClick={gapRun} disabled={busy === "gap" || !(d.competitor_titles || []).length}>{busy === "gap" ? "Elemzés…" : "✦ Témahiány"}</button>}>
        <form className="adm-row" onSubmit={addSite}><input className="adm-in" style={{ flex: "1 1 220px" }} placeholder="pl. tattoodo.com" value={site} onChange={(x) => setSite(x.target.value)} /><input className="adm-in" style={{ flex: "1 1 220px" }} placeholder="sitemap címe (nem kötelező)" value={sitemap} onChange={(x) => setSitemap(x.target.value)} /><button className="adm-ibtn gold">Figyelés</button></form>
        {gap && <div className="ai-t">{gap.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>}
        {comps.length ? <div className="comp-sites">{comps.map((c) => (
          <div key={c.domain} className="cs-i"><div className="cs-h"><b>{c.domain}</b><span className="mut">{fmt(c.pages)} oldal{c.sitemap ? ` · ${String(c.sitemap).replace(/^https?:\/\//, "")}` : ""}</span><button className="lnk" onClick={async () => { await rpc(sb, "admin_watch_set", { p_kind: "site", p_a: c.domain, p_b: "", p_on: false }); load(); }}>levesz</button></div>
            {(c.new as D[]).length ? <ul>{(c.new as D[]).map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title || short(p.url)}</a><small>{agoDay(p.first_seen)}</small></li>)}</ul> : <p className="note">Nincs új oldala az elmúlt 30 napban.</p>}
          </div>))}</div> : <p className="note">Még nincs figyelt weboldal.</p>}
      </Card>

      <Card className="s6" icon={P.calendar} title="A Google frissítései" sub="A Google hivatalos frissítésnaplója: ezek automatikusan jegyzetként a grafikonokra kerülnek, így egy esés vagy ugrás magyarázható.">
        {(d.updates || []).length ? <ul className="gupd">{(d.updates as D[]).map((u) => <li key={u.id}><b>{u.title}</b><span>{new Date(u.begin_at).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" })}{u.end_at ? " – " + new Date(u.end_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : " · folyamatban"}</span></li>)}</ul> : <Empty t="Holnap reggel töltődik be." />}
      </Card>
      <Card className="s6" icon={P.pen} title="Szövegíró-segéd" sub="Írás közben: illeszd be a cikk szövegét és a célkeresést, az MI pontozza, címet és leírást javasol, és megmutatja, mi hiányzik."><Writer /></Card>
      {open && <PageSheet p={open} close={() => setOpen(null)} />}
    </div>
  );
}

/* one page: every check, and the on-page check against the search it should win */
function PageSheet({ p, close }: { p: D; close: () => void }) {
  const [q, setQ] = useState("");
  const words = (s: string) => s.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const has = (s: string | null) => !!q && !!s && words(q).every((w) => String(s).toLowerCase().includes(w));
  const checks: [string, boolean][] = q ? [["A cím tartalmazza", has(p.title)], ["A leírás tartalmazza", has(p.meta)], ["A H1 tartalmazza", has(p.h1)], ["Az első bekezdés tartalmazza", has(String(p.intro || "").slice(0, 400))],
    ["Alcímben is szerepel", ((p.h2 || []) as string[]).some((h) => has(h))], ["Legalább 600 szó", n(p.words) >= 600], ["Legalább 3 belső link mutat rá", n(p.links_in) >= 3], ["Van strukturált adat", (p.schema_types || []).length > 0]] : [];
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Oldal ellenőrzése">
        <div className="c-h"><div><div><span className="eyebrow">SEO-ellenőrzés · {ago(p.checked_at)}</span><h2 style={{ fontSize: 18, marginTop: 6, wordBreak: "break-all" }}>{short(p.url) || "/"}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}><Mini l="Válasz" v={String(p.status)} /><Mini l="Idő" v={`${fmt(p.ms)} ms`} /><Mini l="Szó" v={fmt(p.words)} /><Mini l="Belső link ide" v={fmt(p.links_in)} /></div>
        <dl className="kv"><dt>Cím</dt><dd>{p.title || "–"} <small className="mut">({String(p.title || "").length} kar.)</small></dd><dt>Leírás</dt><dd>{p.meta || "–"}</dd><dt>H1</dt><dd>{p.h1 || "–"}</dd>
          <dt>Nyelv</dt><dd>{p.lang || "–"} · {Object.keys(p.hreflangs || {}).length} nyelvi változat</dd><dt>Strukturált adat</dt><dd>{(p.schema_types || []).join(", ") || "nincs"}</dd><dt>Képek</dt><dd>{fmt(p.imgs)} kép, {fmt(p.imgs_no_alt)} alt nélkül</dd></dl>
        <h3>Észrevételek</h3>
        {(p.issues || []).length ? <ul className="seo-kinds">{(p.issues as D[]).map((x, i) => <li key={i} className={x.c}><span className={"chip " + (x.c === "bad" ? "bad" : x.c === "warn" ? "warn" : "")}>{SEV[x.c]}</span><span>{x.t}</span></li>)}</ul> : <p className="note">Nincs észrevétel.</p>}
        <h3>Cikk-ellenőrző</h3>
        <input className="adm-in" placeholder="A keresés, amire ez az oldal első akar lenni" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <ul className="checks">{checks.map(([l, ok]) => <li key={l} className={ok ? "ok" : "no"}><span>{ok ? "✓" : "✕"}</span>{l}</li>)}<li className="score"><b>{pct(checks.filter((c) => c[1]).length, checks.length)}</b> rendben</li></ul>}
        <a className="adm-ibtn gold" href={p.url} target="_blank" rel="noreferrer">Oldal megnyitása ↗</a>
      </aside>
    </Layer>
  );
}

function Writer() {
  const [q, setQ] = useState(""); const [t, setT] = useState(""); const [out, setOut] = useState(""); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = MOCK ? { ok: true, json: { text: "1. Pontszám: 72/100\n2. Title: Fine line tetoválás öregedése: 7 tipp\n3. Meta: Elmosódik a fine line? 7 bevált tipp, hogy évekig szép maradjon." } } : await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "write", data: { kereses: q, szoveg: t.slice(0, 20000) } }) });
    setBusy(false); setOut(r.ok ? r.json?.text || "" : r.json?.error || "Nem sikerült.");
  };
  return (
    <div className="writer">
      <input className="adm-in" placeholder="Célkeresés, pl. fine line tetoválás öregedése" value={q} onChange={(e) => setQ(e.target.value)} />
      <textarea className="adm-in" rows={6} placeholder="A cikk szövege" value={t} onChange={(e) => setT(e.target.value)} />
      <div className="adm-row"><button className="adm-ibtn gold" onClick={run} disabled={busy || !q.trim() || t.trim().length < 200}>{busy ? "Pontozás…" : "✦ Pontozás"}</button><span className="note">{fmt(t.trim() ? t.trim().split(/\s+/).length : 0)} szó</span></div>
      {out && <div className="ai-t">{out.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>}
    </div>
  );
}
