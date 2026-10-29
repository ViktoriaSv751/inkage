"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useState } from "react";
import { BarList, Delta, Empty, Heatmap, Spark, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { countryName, flag } from "../visuals";
import { useCardDays, bpParts, Card, DOW, FreshCtx, Loading, P, PF, SOC, ago, big, ch, freshOf, lang, n, type D, useRpc } from "../shared";
import { ChartBox, MultiLine } from "../extra";
import { vsMedian } from "./social";

/* ---------- the audience: followers on every platform, who they are, when they are online, the stories ---------- */
const BD: Record<string, string> = { age: "Kor", gender: "Nem", country: "Ország", city: "Város", seniority: "Beosztás", function: "Szakterület" };
const GEN: Record<string, string> = { F: "Nő", M: "Férfi", U: "Nem ismert" };
/* what a platform's demographic number is: a count of followers, a share of viewers (per mille), or views */
const UNIT = (pf: string, bd: string) => (pf === "youtube" ? (bd === "country" ? "megtekintés" : "% néző") : pf === "pinterest" ? "% közönség" : "követő");
const permille = (pf: string, bd: string) => (pf === "youtube" && bd !== "country") || pf === "pinterest";
const RANGES: [number, string][] = [[30, "30 nap"], [90, "90 nap"], [365, "1 év"], [0, "Összes"]];
/* the hour in another time zone, as Budapest reads it (Meta gives the online hours in Pacific time) */
const tzShift = (tz: string) => { const now = new Date(), at = (z: string) => new Date(now.toLocaleString("en-US", { timeZone: z })).getTime(); return Math.round((at("Europe/Budapest") - at(tz)) / 3600e3); };

export function Audience() {
  const [range, setRange] = useState(90);
  const { d, e } = useRpc("admin_audience", { p_days: range || 3650 }, [range]);
  const [htDays, htCtl] = useCardDays("heat", 90);
  const heat = useRpc("admin_heat_ch", { p_days: htDays }, [htDays]);
  const inbox = useRpc("admin_inbox", { p_all: true }, []);
  const dash = useRpc("admin_dashboard", { p_days: range || 3650, p_from: null, p_to: null, p_ch: null, p_lang: null }, [range]);
  const [hch, setHch] = useState("all");
  const fr = useContext(FreshCtx);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const fol: D[] = d.followers || [], demo: D[] = d.demo || [], stories: D[] = d.stories || [], posts: D[] = d.posts || [];
  const plats = SOC.filter((p) => fol.some((x) => x.platform === p && x.followers != null));
  const series = (p: string) => fol.filter((x) => x.platform === p && x.followers != null);
  /* the number a week before the last day, found by date (rows can be missing on some days) */
  const weekBefore = (s: D[]) => { const l = s.slice(-1)[0]; if (!l) return null; const t = new Date(l.day).getTime() - 7 * 864e5; return [...s].reverse().find((x) => new Date(x.day).getTime() <= t) || null; };
  const total = plats.reduce((t, p) => t + n(series(p).slice(-1)[0]?.followers), 0);
  /* a week's change needs a week of data: with fewer days it says so instead of a "+0" */
  const week = plats.length > 0 && plats.every((p) => weekBefore(series(p)) != null);
  const ago7 = plats.reduce((t, p) => t + n(weekBefore(series(p))?.followers), 0);
  /* net new followers a day, all platforms together: the day's change of the count (or gained − lost where the count has gaps) */
  const net = new Map<string, number>();
  for (const p of plats) {
    const rows = fol.filter((x) => x.platform === p).sort((a, b) => String(a.day).localeCompare(String(b.day)));
    let prev: D | null = null;
    for (const r of rows) {
      const k = String(r.day).slice(0, 10);
      if (r.followers != null && prev && (new Date(r.day).getTime() - new Date(prev.day).getTime()) <= 2 * 864e5) net.set(k, (net.get(k) || 0) + n(r.followers) - n(prev.followers));
      else if (r.gained != null) net.set(k, (net.get(k) || 0) + n(r.gained) - n(r.lost));
      if (r.followers != null) prev = r;
    }
  }
  const netPts = [...net].sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => ({ t, v }));
  const marks = posts.slice(-40).map((p) => ({ t: String(p.created_at).slice(0, 10), label: `${PF[p.platform]}: ${String(p.title || "").slice(0, 40)}` }));
  const demoP = Array.from(new Set(demo.filter((x) => BD[x.breakdown]).map((x) => x.platform)));
  /* the active hours: website visits by weekday and hour, from one channel or all */
  const cells: D[] = ((heat.d as D[]) || []).filter((x) => hch === "all" || x.ch === hch);
  const merged = new Map<string, number>(); cells.forEach((x) => merged.set(`${x.w}:${x.h}`, (merged.get(`${x.w}:${x.h}`) || 0) + n(x.n)));
  const grid = [...merged].map(([k, v]) => { const [w, h] = k.split(":").map(Number); return { w, h, n: v }; });
  const bestCell = [...grid].sort((a, b) => b.n - a.n)[0];
  const hchs = Array.from(new Set(((heat.d as D[]) || []).map((x) => x.ch))).filter((k) => k !== "közvetlen");
  /* when her posts did best on the platforms themselves: each post against its platform's median, by weekday and 3-hour slot */
  const vs = vsMedian(posts);
  const slots = new Map<string, { n: number; v: number }>();
  posts.forEach((p) => { const x = vs(p); if (x == null || !p.created_at) return; const b = bpParts(new Date(p.created_at)), w = b.dow, h = Math.floor(b.hour / 3) * 3, k = `${w}:${h}`; const o = slots.get(k) || { n: 0, v: 0 }; o.n++; o.v += x; slots.set(k, o); });
  const bestSlots = [...slots].map(([k, o]) => { const [w, h] = k.split(":").map(Number); return { k: `${DOW[w]} ${h}–${h + 3} óra`, n: Math.round((o.v / o.n) * 10) / 10, sub: `${fmt(o.n)} poszt` }; }).filter((x) => x.sub !== "1 poszt").sort((a, b) => b.n - a.n); /* a slot of one post says nothing about the slot (all five bars were single posts) */
  const shift = tzShift("America/Los_Angeles");
  /* "frissítve": the last read's real time; a bare day ("2026-10-22") read as UTC midnight said "13 órája" minutes after a read */
  const upd = (p: string, day?: string) => { const at = freshOf(fr, p).at; return at ? `frissítve ${ago(at)}` : day ? `adat: ${new Date(String(day).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}` : "–"; };
  const online = demo.filter((x) => x.platform === "instagram" && x.breakdown === "online").map((x) => ({ k: String((Number(x.k) + shift + 24) % 24), n: n(x.n) })).sort((a, b) => Number(a.k) - Number(b.k));
  const authors: D[] = (inbox.d as D)?.authors || [];
  const siteLangs: D[] = ((dash.d as D)?.langs || []).filter((x: D) => x.k && x.k !== "?");
  /* the stories in short: how many, seen how often, how many tapped out, the best one */
  const sv = stories.filter((s) => n(s.views) > 0), exitRate = sv.length ? sv.reduce((t, s) => t + n(s.exits), 0) / Math.max(1, sv.reduce((t, s) => t + n(s.views), 0)) : null;
  const bestStory = [...stories].sort((a, b) => n(b.views) - n(a.views))[0];
  const demoPfs = (bd: string) => demoP.filter((p) => demo.some((x) => x.platform === p && x.breakdown === bd)).map((p) => PF[p]).join(", ");
  return (
    <div className="g">
      <section className="band plain s12">
        <div><span className="lbl">Követők összesen</span><div className="num"><b>{fmt(total)}</b>{week ? <><Delta now={total} prev={ago7} /><small>az elmúlt 7 napban ({total - ago7 >= 0 ? "+" : ""}{fmt(total - ago7)})</small></> : <small>az elmúlt 7 nap: még kevés adat (a napi követőszám {plats.length ? new Date(String(series(plats[0])[0]?.day).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " óta" : "még nem"} gyűlik)</small>}</div></div>
        <div className="side"><div className="adm-seg sm" role="group" aria-label="Időszak">{RANGES.map(([v, l]) => <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div></div>
      </section>
      {plats.length > 0 && <Card className="s12" icon={P.traffic} title="Követők naponta, minden platform" sub="Platformonként egy vonal, aranyban az összesen. Vidd az egeret egy napra." src={[...plats]}>
        <MultiLine total series={plats.map((p) => ({ k: p, l: PF[p], pts: series(p).map((x) => ({ t: x.day, v: n(x.followers) })) }))} height={260} />
      </Card>}
      {netPts.length > 1 && <Card className="s12" icon={P.users} title="Új követő naponta (nettó)" sub="Minden platform együtt: a követők számának napi változása (új követők mínusz a leiratkozók). A jelölők a posztjaid megjelenésének napjai: látszik, melyik poszt hozott követőt.">
        <ChartBox data={netPts} label="Nettó új követő" marks={marks} name="uj-kovetok" height={220} />
      </Card>}
      {plats.length ? plats.map((p) => { const s = series(p), l = s.slice(-1)[0], w = weekBefore(s);
        return (
          <section key={p} className="c s4 aud-c">
            <div className="aud-h"><Logo k={p} size={34} /><b>{PF[p]}</b><span className="note">{upd(p, l?.day)}</span></div>
            <div className="aud-v"><b>{big(l?.followers)}</b>{w && <Delta now={n(l?.followers)} prev={n(w.followers)} />}</div>
            <Spark values={s.map((x) => n(x.followers))} h={46} />
          </section>
        ); }) : <div className="s12 c"><Empty t="A bekötött platformok követői itt jelennek meg, naponta." icon={P.users} /></div>}
      {/* the platforms without followers yet: each with why, so none of them silently disappears */}
      {SOC.filter((p) => !plats.includes(p)).map((p) => (
        <a key={p} className="c s4 aud-c aud-off" href="#connect">
          <div className="aud-h"><Logo k={p} size={34} /><b>{PF[p]}</b><span className="note">nincs bekötve</span></div>
          <div className="aud-v"><b className="mut">–</b></div>
          <span className="note">Kösd be a Kapcsolatok oldalon, és itt látod a követőket naponta. ›</span>
        </a>))}

      {Object.keys(BD).map((bd) => { const rows = demo.filter((x) => x.breakdown === bd); if (!rows.length) return null;
        const byP = demoP.filter((p) => rows.some((x) => x.platform === p));
        return (
          <Card key={bd} className={bd === "country" ? "s12" : "s6"} icon={P.users} title={`Közönség: ${BD[bd]}`} sub={`Platformonként egymás mellett (${demoPfs(bd)})${bd === "country" ? ", és a weboldal látogatóinak nyelve (az országot a weboldalon nem mérjük)" : ""}. A számok platformonként mást jelentenek: Instagramon és LinkedInen követő, YouTube-on a nézők %-a (országnál megtekintés), Pinteresten a közönség %-a; a százalék mindenhol a platformon belüli arány. Az Instagram 100 követő fölött adja ki.`}>
            <div className="demo-cols">{byP.map((p) => (
              <div key={p}><h4><Logo k={p} size={20} />{PF[p]}<small className="mut"> · {UNIT(p, bd)}</small></h4>
                <BarList items={rows.filter((x) => x.platform === p).map((x) => ({ k: x.k, n: permille(p, bd) ? n(x.n) / 10 : n(x.n) }))} fmtK={(k) => bd === "gender" ? GEN[k] || k : bd === "country" ? `${flag(k)} ${countryName(k)}` : k} max={6} accent /></div>))}
              {bd === "country" && siteLangs.length > 0 && <div><h4>{flag("HU")} Weboldal (nyelv)</h4><BarList items={siteLangs.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} max={6} /></div>}
            </div>
          </Card>
        ); })}
      {!demo.some((x) => BD[x.breakdown]) && <Card className="s12" icon={P.users} title="Közönség: kor, nem, ország" sub="A követőid életkora, neme és országa, ahogy a platformok kiadják (az Instagram csak 100 követő fölött, a TikTok az üzleti API nélkül nem adja). Itt jelenik meg, amint egy bekötött platform elküldi."><Empty t="Az Instagram (100 követő fölött), a YouTube, a Pinterest és a LinkedIn közönségadatai a bekötésük után itt jelennek meg. TikTokon ehhez Business API kell." icon={P.users} /></Card>}

      <Card className="s8" icon={P.clock} title="Mikor aktívak (a weboldalon)" sub="A weboldal látogatásai a hét napjai és az órák szerint (budapesti idő, 90 nap), csatornánként: ez a mi mérésünk arról, mikor jönnek át hozzád az egyes platformokról, nem a platformok saját közönségadata."
        right={<>{htCtl}<div className="adm-seg sm"><button aria-pressed={hch === "all"} onClick={() => setHch("all")}>Mind</button>{hchs.slice(0, 5).map((k) => <button key={k} aria-pressed={hch === k} onClick={() => setHch(k)}>{ch(k)}</button>)}</div></>}>
        {heat.e ? <div className="alert err">{heat.e}</div> : grid.length ? <><Heatmap cells={grid} />{bestCell && <p className="note">Csúcs: <b>{DOW[bestCell.w]} {bestCell.h}:00</b></p>}</> : <Empty t="Még nincs elég látogatás ebből a csatornából." />}
      </Card>
      <Card className="s4" icon={P.eye} src="instagram" title="Instagram: mikor vannak fent" sub={`A követőid száma óránként (az Instagram a legutóbbi napot adja ki, csendes-óceáni idő szerint; itt budapesti időre átváltva, most ${shift >= 0 ? "+" : ""}${shift} óra).`}>
        {online.length ? <BarList items={online} fmtK={(k) => `${k}:00`} max={24} accent /> : <Empty t="Az Instagram bekötése után jelenik meg." />}
      </Card>
      <Card className="s12" icon={P.calendar} title="Mikor posztolva ment a legjobban" sub="A platformok saját számaiból: minden poszt a saját platformja mediánjához mérve, a megjelenés napja és 3 órás sávja szerint (budapesti idő). 1,0 = szokásos; 2,0 = kétszer annyi megtekintés. Kevés posztnál még csak irány.">
        {bestSlots.length ? <BarList items={bestSlots} max={8} accent rank /> : <Empty t="Még nincs olyan napszak, amelyben legalább két posztod van: néhány poszt után látszik, melyik napszakban mennek jobban." />}
      </Card>

      <Card className="s6" icon={P.mail} title="Legaktívabb kommentelők" sub="Akik a legtöbbször írnak a posztjaid alá (a postafiókból: Instagram, Facebook, YouTube, LinkedIn): a visszatérő rajongóid.">
        {inbox.e ? <div className="alert err">{inbox.e}</div> : authors.length ? <ul className="authors">{authors.map((a) => <li key={a.source + a.author}><Logo k={a.source} size={22} /><b>{a.author}</b><span>{fmt(a.n)} komment · utoljára {ago(a.last)}</span></li>)}</ul> : <Empty t="A kommentek a platformok bekötése után gyűlnek." icon={P.mail} />}
      </Card>
      <Card className="s6" icon={P.eye} src="instagram" title="Storyk" sub="Az Instagram (és a Facebook-oldal) a storyk számait csak 24 óráig adja ki; az óránkénti lehúzás mindegyiket megőrzi. A kiválasztott időszak storyjai: megtekintés, elérés, válasz, előre lépés, kilépés.">
        {stories.length ? <>
          <div className="mini-stats" style={{ marginBottom: 10 }}>
            <div className="mini"><span>Story</span><b>{fmt(stories.length)}</b></div>
            <div className="mini"><span>Megtekintés</span><b>{big(stories.reduce((t, s) => t + n(s.views), 0))}</b><small>átl. {big(sv.length ? sv.reduce((t, s) => t + n(s.views), 0) / sv.length : 0)} / story</small></div>
            <div className="mini"><span>Kilépési arány</span><b>{exitRate == null ? "–" : fmt(exitRate * 100, 1) + "%"}</b><small>kilépés / megtekintés</small></div>
            {bestStory && <div className="mini"><span>A legjobb</span><b>{big(bestStory.views)}</b><small>{ago(bestStory.created_at)}</small></div>}
          </div>
          <div className="story-l">{stories.map((s) => (
            <a key={s.platform + s.story_id} className="sty" href={s.url || undefined} target="_blank" rel="noreferrer">
              <div className="sty-img">{s.thumb ? <img src={s.thumb} alt="" referrerPolicy="no-referrer" /> : <Logo k={s.platform || "instagram"} size={40} />}<span>{ago(s.created_at)}</span></div>
              <div className="sty-m"><b>{big(s.views)}</b><small>megtekintés</small></div>
              <div className="sty-s"><span>elérés {big(s.reach)}</span><span>válasz {big(s.replies)}</span><span>tovább {big(s.taps_forward)}</span><span>kilépés {big(s.exits)}</span>{n(s.views) > 0 && <span>kilépési arány {pct(n(s.exits), n(s.views))}</span>}</div>
            </a>))}</div></> : <Empty t="Az Instagram bekötése után itt gyűlnek a storyk, a 24 órán túl is." icon={P.eye} />}
      </Card>
    </div>
  );
}
