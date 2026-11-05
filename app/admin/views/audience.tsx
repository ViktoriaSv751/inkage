"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useState } from "react";
import { BarList, Delta, Empty, Heatmap, Spark, fmt, pct } from "../charts";
import { Chg, Hero, Ring, type RingKind } from "../ink";
import { Logo } from "../wow";
import { countryName } from "../visuals";
import { useCardDays, bpParts, Card, daysLabel, DOW, FreshCtx, Loading, P, PF, SOC, ago, big, ch, freshOf, lang, n, type D, useRpc } from "../shared";
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

/* a share that really adds up to a whole (age, gender): one ring each. A list that only holds the top rows (country, city) stays a list */
const WHOLE = new Set(["age", "gender"]);
const KINDS: RingKind[] = ["solid", "tick", "dots", "seg"];
function PctRings({ rows, fmtK, unit }: { rows: { k: string; n: number }[]; fmtK: (k: string) => string; unit: string }) {
  const tot = rows.reduce((t, x) => t + x.n, 0), list = [...rows].sort((a, b) => b.n - a.n);
  return <ul className="ic-prs">{list.map((x, i) => { const p = tot ? x.n / tot : 0; return <li key={x.k}><Ring p={p} kind={KINDS[i % 4]} label={`${fmtK(x.k)}: ${fmt(p * 100)}%`}><b>{fmt(p * 100)}<i>%</i></b></Ring><b>{fmtK(x.k)}</b><small>{unit.startsWith("%") ? `${fmt(x.n, 1)}${unit}` : `${fmt(x.n)} ${unit}`}</small></li>; })}</ul>;
}

/* the 24 hours on a dial: the longer the notch, the more people; a tap shows that hour's number */
function HourDial({ rows, unit, label }: { rows: { h: number; n: number }[]; unit: string; label: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const by = new Map(rows.map((x) => [x.h, x.n])), top = Math.max(1, ...rows.map((x) => x.n)), peak = [...rows].sort((a, b) => b.n - a.n)[0]?.h ?? 0, cur = sel ?? peak;
  const at = (h: number, r: number) => { const a = (h / 24) * 2 * Math.PI - Math.PI / 2; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; };
  return (
    <div className="ic-dial" role="group" aria-label={label}>
      <svg viewBox="0 0 100 100">
        {Array.from({ length: 24 }, (_, h) => { const v = by.get(h) || 0, [x1, y1] = at(h, 40), [x2, y2] = at(h, 40 - 2 - (v / top) * 15), [hx, hy] = at(h, 48), [hx0, hy0] = at(h, 22); return (
          <g key={h} role="button" tabIndex={0} aria-label={`${h}:00: ${fmt(v)} ${unit}`} aria-pressed={cur === h} onClick={() => setSel(h)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(h); } }}>
            <line className="hit" x1={hx} y1={hy} x2={hx0} y2={hy0} /><line className={"t" + (v ? " on" : "") + (cur === h ? " cur" : "")} x1={x1} y1={y1} x2={x2} y2={y2} />
          </g>); })}
        {[0, 6, 12, 18].map((h) => { const [x, y] = at(h, 46); return <text key={h} x={x} y={y + 1.6} textAnchor="middle">{h}</text>; })}
      </svg>
      <span className="ic-dial-c"><b>{cur}:00</b><small>{fmt(by.get(cur) || 0)} {unit}</small><small>{cur === peak ? "a csúcs" : `a csúcs: ${peak}:00`}</small></span>
    </div>
  );
}

export function Audience() {
  const [range, setRange] = useState(90);
  const { d, e } = useRpc("admin_audience", { p_days: range || 3650 }, [range]);
  const [htDays, htCtl] = useCardDays("heat", 90);
  const heat = useRpc("admin_heat_ch", { p_days: htDays }, [htDays]);
  const inbox = useRpc("admin_inbox", { p_all: true }, []);
  const dash = useRpc("admin_dashboard", { p_days: range || 3650, p_from: null, p_to: null, p_ch: null, p_lang: null }, [range]);
  /* every post, whatever the period: the multiplier is measured against the same round as on the other pages */
  const everyPost = useRpc("admin_social", { p_days: 365 }, []);
  const [hch, setHch] = useState("all");
  const fr = useContext(FreshCtx);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const conn: string[] = d.connected || [], igConn = conn.includes("instagram"), igN = n(d.ig_followers), pinConn = conn.includes("pinterest");
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
  const vs = vsMedian(posts, ((everyPost.d as D | null)?.cal || []) as D[]);
  const slots = new Map<string, { n: number; v: number }>();
  posts.forEach((p) => { const x = vs(p); if (x == null || !p.created_at) return; const b = bpParts(new Date(p.created_at)), w = b.dow, h = Math.floor(b.hour / 3) * 3, k = `${w}:${h}`; const o = slots.get(k) || { n: 0, v: 0 }; o.n++; o.v += x; slots.set(k, o); });
  const bestSlots = [...slots].map(([k, o]) => { const [w, h] = k.split(":").map(Number); return { k: `${DOW[w]} ${h}–${h + 3} óra`, n: Math.round((o.v / o.n) * 10) / 10, sub: `${fmt(o.n)} poszt` }; }).filter((x) => x.sub !== "1 poszt").sort((a, b) => b.n - a.n); /* a slot of one post says nothing about the slot (all five bars were single posts) */
  const hourRows = Array.from(grid.reduce((m, x) => m.set(x.h, (m.get(x.h) || 0) + x.n), new Map<number, number>())).map(([h, v]) => ({ h, n: v }));
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
      <div className="s12 ic-aud-top">
        <Hero flip label="Követők összesen" v={total} chg={week ? <Chg a={total} b={ago7} tail="az elmúlt 7 napban" /> : undefined}
          sub={week ? undefined : `A hét napos változáshoz még kevés az adat (a napi követőszám ${plats.length ? new Date(String(series(plats[0])[0]?.day).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " óta" : "még nem"} gyűlik).`}
          side={<div className="adm-seg sm" role="group" aria-label="Időszak">{RANGES.map(([v, l]) => <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>)}</div>} />
        <section className="c ic-aud-l">
          <h3 className="ink-h">Platformonként</h3>
          <ul className="ic-rows">
            {plats.map((p, i) => { const s = series(p), l = s.slice(-1)[0], w = weekBefore(s), kinds: RingKind[] = ["solid", "tick", "dots", "seg"];
              return <li key={p}><div className="ic-rb"><Ring size={56} p={total ? n(l?.followers) / total : 0} kind={kinds[i % 4]} label={`Az összes követő ${total ? fmt((n(l?.followers) / total) * 100) : 0}%-a`}><Logo k={p} size={26} /></Ring>
                <span className="ic-rt"><b>{PF[p]}</b><small>{upd(p, l?.day)}</small></span>
                <span className="ic-sp"><Spark values={s.map((x) => n(x.followers))} h={34} /></span>
                <span className="ic-rv"><b>{big(l?.followers)}</b>{w ? <Delta now={n(l?.followers)} prev={n(w.followers)} /> : <small>követő</small>}</span></div></li>; })}
            {/* the platforms without followers yet: none of them silently disappears */}
            {SOC.filter((p) => !plats.includes(p)).map((p) => <li key={p} className="dim"><a className="ic-rb" href="#connect"><span className="ic-rlogo"><Logo k={p} size={26} /></span><span className="ic-rt"><b>{PF[p]}</b><small>nincs bekötve</small></span><span className="ic-rv"><b>–</b><small>Bekötés ›</small></span></a></li>)}
          </ul>
          {!plats.length && <Empty t="A bekötött platformok követői itt jelennek meg, naponta." icon={P.users} />}
        </section>
      </div>
      {plats.length > 0 && <Card className="s12" icon={P.traffic} title="Követők naponta, minden platform" sub="Platformonként egy vonal, és az összesen. Érintsd meg vagy vidd fölé az egeret egy napra." src={[...plats]}>
        <MultiLine total series={plats.map((p) => ({ k: p, l: PF[p], pts: series(p).map((x) => ({ t: x.day, v: n(x.followers) })) }))} height={260} />
      </Card>}
      {netPts.length > 1 && <Card className="s12" icon={P.users} title="Új követő naponta (nettó)" sub="Minden platform együtt: a követők számának napi változása (új követők mínusz a leiratkozók). A jelölők a posztjaid megjelenésének napjai: látszik, melyik poszt hozott követőt.">
        <ChartBox data={netPts} label="Nettó új követő" marks={marks} name="uj-kovetok" height={220} />
      </Card>}

      {Object.keys(BD).map((bd) => { const rows = demo.filter((x) => x.breakdown === bd); if (!rows.length) return null;
        const byP = demoP.filter((p) => rows.some((x) => x.platform === p));
        return (
          <Card key={bd} className={bd === "country" ? "s12" : "s6"} icon={P.users} title={`Közönség: ${BD[bd]}`} sub={`Platformonként egymás mellett (${demoPfs(bd)})${bd === "country" ? ", és a weboldal látogatóinak nyelve (az országot a weboldalon nem mérjük)" : ""}. A számok platformonként mást jelentenek: Instagramon és LinkedInen követő, YouTube-on a nézők %-a (országnál megtekintés), Pinteresten a közönség %-a; a százalék mindenhol a platformon belüli arány. Az Instagram 100 követő fölött adja ki.`}>
            <div className="demo-cols">{byP.map((p) => (
              <div key={p}><h4><Logo k={p} size={20} />{PF[p]}<small className="mut"> · {UNIT(p, bd)}</small></h4>
                {WHOLE.has(bd) ? <PctRings rows={rows.filter((x) => x.platform === p).map((x) => ({ k: x.k, n: permille(p, bd) ? n(x.n) / 10 : n(x.n) }))} fmtK={(k) => (bd === "gender" ? GEN[k] || k : k)} unit={permille(p, bd) ? (p === "youtube" ? "% néző" : "% közönség") : "követő"} />
                  : <BarList items={rows.filter((x) => x.platform === p).map((x) => ({ k: x.k, n: permille(p, bd) ? n(x.n) / 10 : n(x.n) }))} fmtK={(k) => (bd === "country" ? countryName(k) : k)} max={6} accent />}</div>))}
              {bd === "country" && siteLangs.length > 0 && <div><h4>Weboldal (nyelv)</h4><BarList items={siteLangs.map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={lang} max={6} /></div>}
            </div>
          </Card>
        ); })}
      {!demo.some((x) => BD[x.breakdown]) && <Card className="s12" icon={P.users} title="Közönség: kor, nem, ország" sub="A követőid életkora, neme és országa, ahogy a platformok kiadják."><Empty t={[igConn ? `Instagram: be van kötve, de csak 100 követő fölött adja ki, most ${fmt(igN)} követőd van.` : "Instagram: nincs bekötve.", pinConn ? (d.pin_audience_failed_at ? "Pinterest: be van kötve, de a közönségadatot a lekérésre nem adja ki (hibát ad vissza), ezért itt nem lesz róla adat, amíg ez nem változik." : "Pinterest: be van kötve, még nem érkezett közönségadat.") : "Pinterest: nincs bekötve.", "TikTok: ehhez Business API kell."].join(" ")} icon={P.users} /></Card>}

      <Card className="s8" icon={P.clock} title="Mikor aktívak (a weboldalon)" sub={`A weboldal látogatásai a hét napjai és az órák szerint (budapesti idő, ${daysLabel(htDays)}), csatornánként: ez a mi mérésünk arról, mikor jönnek át hozzád az egyes platformokról, nem a platformok saját közönségadata.`}
        right={<>{htCtl}<div className="adm-seg sm"><button aria-pressed={hch === "all"} onClick={() => setHch("all")}>Mind</button>{hchs.slice(0, 5).map((k) => <button key={k} aria-pressed={hch === k} onClick={() => setHch(k)}>{ch(k)}</button>)}</div></>}>
        {heat.e ? <div className="alert err">{heat.e}</div> : grid.length ? <div className="ic-heatdial"><div><Heatmap cells={grid} />{bestCell && <p className="note">Csúcs: <b>{DOW[bestCell.w]} {bestCell.h}:00</b></p>}</div><HourDial rows={hourRows} unit="látogatás" label="A látogatások a nap óráiban" /></div> : <Empty t="Még nincs elég látogatás ebből a csatornából." />}
      </Card>
      <Card className="s4" icon={P.eye} src="instagram" title="Instagram: mikor vannak fent" sub={`A követőid száma óránként (az Instagram a legutóbbi napot adja ki, csendes-óceáni idő szerint; itt budapesti időre átváltva, most ${shift >= 0 ? "+" : ""}${shift} óra).`}>
        {online.length ? <HourDial rows={online.map((x) => ({ h: Number(x.k), n: x.n }))} unit="követő" label="Az Instagram-követők a nap óráiban" /> : <Empty t={igConn ? `Az Instagram be van kötve, de ezt csak 100 követő fölött adja ki (most ${fmt(igN)} követőd van).` : "Az Instagram bekötése után jelenik meg."} />}
      </Card>
      <Card className="s12" icon={P.calendar} title="Mikor posztolva ment a legjobban" sub="A platformok saját számaiból: minden poszt a saját platformja mediánjához mérve, a megjelenés napja és 3 órás sávja szerint (budapesti idő). 1,0 = szokásos; 2,0 = kétszer annyi megtekintés. Kevés posztnál még csak irány.">
        {bestSlots.length ? <BarList items={bestSlots} max={8} accent rank /> : <Empty t="Még nincs olyan napszak, amelyben legalább két posztod van: néhány poszt után látszik, melyik napszakban mennek jobban." />}
      </Card>

      <Card className="s6" icon={P.mail} title="Legaktívabb kommentelők" sub="Akik a legtöbbször írnak a posztjaid alá (a postafiókból: Instagram, Facebook, YouTube, LinkedIn): a visszatérő rajongóid.">
        {inbox.e ? <div className="alert err">{inbox.e}</div> : authors.length ? <ul className="authors">{authors.map((a) => <li key={a.source + a.author}><Logo k={a.source} size={22} /><b>{a.author}</b><span>{fmt(a.n)} komment · utoljára {ago(a.last)}</span></li>)}</ul> : <Empty t="Még egy komment sincs a postafiókban: az Instagram-posztjaid alatt nincs komment. A TikTok-kommenteket a jelenlegi bekötés nem hozza be." icon={P.mail} />}
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
            </a>))}</div></> : <Empty t={igConn ? (n(d.stories_total) ? "Ebben az időszakban nem volt story." : "Az Instagram be van kötve, de még egy storyt sem talált a lehúzás. Ha kiteszel egyet, itt megmarad a 24 órán túl is.") : "Az Instagram bekötése után itt gyűlnek a storyk, a 24 órán túl is."} icon={P.eye} />}
      </Card>
    </div>
  );
}
