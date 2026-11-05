"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, TrendChart, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { ChartBox } from "../extra";
import { CloseX, toast } from "../phone";
import { GOAL_M, I, Layer, Loading, NOTE_KIND, P, PA, PF, alerts, api, big, bpDate, ch, n, rpc, type D, useRpc } from "../shared";
import { Chg, Hero } from "../ink";
import { IRow } from "./traffic";
import { WeekPlan } from "../extra";
import { IOS_NOTE } from "./alerts";
import { viewWord } from "./social";
import { LoadErr, PageErr } from "./people";

/* ---------- the week or the month on one page: the numbers, what brought them, the best posts, the signals;
   printable as a PDF, exportable, and an investor view without the internal parts ----------
   Calendar weeks (Monday to Sunday) and months, or any range; Google's part is aligned to its 2–3 day delay. */
const ymd = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
const addD = (t: Date, k: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + k);
type Per = "week" | "lastweek" | "month" | "lastmonth" | "custom";
function range(p: Per, cf: string, ct: string): [string, string] {
  const t = new Date(), mon = addD(t, -((t.getDay() + 6) % 7));
  if (p === "week") return [ymd(mon), ymd(t)];
  if (p === "lastweek") return [ymd(addD(mon, -7)), ymd(addD(mon, -1))];
  if (p === "month") return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)];
  if (p === "lastmonth") return [ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), ymd(new Date(t.getFullYear(), t.getMonth(), 0))];
  return cf <= ct ? [cf, ct] : [ct, cf];
}
/* a whole date only: while a date is being typed or cleared the field gives nothing usable, and the page keeps the last good period */
const goodDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "2020-01-01" && !Number.isNaN(Date.parse(v + "T12:00:00"));
const hd = (k: string) => new Date(k + "T12:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric" });

/* ---------- the period as a story: one big number on each card, swiped sideways, on the page or on the whole screen. Never printed: the printed report is the full page below ---------- */
export type SC = { k: string; l: string; v?: number; text?: string; chg?: React.ReactNode; sub?: React.ReactNode; ic?: React.ReactNode; flip?: boolean };
function StoryCards({ cards, when, full, close }: { cards: SC[]; when: string; full?: boolean; close?: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const [i, setI] = useState(0);
  /* a button moves exactly one card. The move is our own, not the browser's smooth scroll: that one overshot by a card when the page was slow. It lands within half a second even where no frames are drawn */
  const aim = useRef<number | null>(null), stop = useRef<() => void>(() => {});
  const onScroll = () => { const el = ref.current; if (!el || aim.current != null) return; let best = 0, dist = Infinity; Array.from(el.children).forEach((c, k) => { const x = Math.abs((c as HTMLElement).offsetLeft - el.scrollLeft); if (x < dist) { dist = x; best = k; } }); setI(best); };
  const to = (k: number) => {
    const el = ref.current, c = el?.children[k] as HTMLElement | undefined; if (!el || !c) return;
    stop.current(); aim.current = k; setI(k);
    const from = el.scrollLeft, x = c.offsetLeft, t0 = performance.now(), put = (v: number) => el.scrollTo({ left: v, behavior: "instant" as ScrollBehavior });
    let raf = 0;
    const end = () => { cancelAnimationFrame(raf); clearTimeout(late); el.style.scrollSnapType = ""; aim.current = null; stop.current = () => {}; };
    const late = setTimeout(() => { put(x); end(); }, 500);
    stop.current = end; el.style.scrollSnapType = "none";
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) { put(x); end(); return; }
    const step = () => { const p = Math.min(1, (performance.now() - t0) / 320); put(from + (x - from) * (1 - (1 - p) ** 3)); if (p < 1) raf = requestAnimationFrame(step); else end(); };
    raf = requestAnimationFrame(step);
  };
  /* a finger takes over from a move under way */
  const handOver = () => stop.current();
  useEffect(() => () => stop.current(), []);
  useEffect(() => { if (!full) return; const key = (e: KeyboardEvent) => { if (e.key === "Escape") close?.(); if (e.key === "ArrowRight") to(i + 1); if (e.key === "ArrowLeft") to(i - 1); }; addEventListener("keydown", key); return () => removeEventListener("keydown", key); }, [full, i, close]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <div className="ix-st-bars" aria-hidden="true">{cards.map((c, k) => <i key={c.k} className={k <= i ? "on" : ""} />)}</div>
    <div className="ix-st-row" ref={ref} onScroll={onScroll} onPointerDown={handOver} onTouchStart={handOver} tabIndex={0} aria-label={when}>
      {cards.map((c, k) => <div key={c.k} className="ix-st-c"><Hero flip={c.flip ?? (full ? k % 2 === 0 : k % 3 === 0)} label={c.l} v={c.v} text={c.text} chg={c.chg} sub={c.sub} side={c.ic} /></div>)}
    </div>
    {cards.length > 1 && <div className={"ix-st-nav" + (full ? "" : " inpage")}><button type="button" className="adm-ibtn" disabled={i === 0} onClick={() => to(i - 1)}>← Vissza</button><span>{i + 1} / {cards.length}</span><button type="button" className="adm-ibtn" disabled={i === cards.length - 1} onClick={() => to(i + 1)}>Tovább →</button></div>}
  </>;
}
/* the same cards over the whole screen, also for the other pages */
export function StoryFull({ cards, when, close }: { cards: SC[]; when: string; close: () => void }) {
  return <Layer><div className="ix-st-fs" role="dialog" aria-label={when}><div className="ix-st-h"><span>{when}</span><CloseX close={close} /></div><StoryCards full cards={cards} when={when} close={close} /></div></Layer>;
}
function Story({ cards, when }: { cards: SC[]; when: string }) {
  const [full, setFull] = useState(false);
  return <section className="s12 ix-story no-print" aria-label="Az időszak sztoriként">
    <div className="ix-st-h"><span>{when}</span><button type="button" className="adm-ibtn sm" onClick={() => setFull(true)}>Teljes képernyő</button></div>
    <StoryCards cards={cards} when={when} />
    {full && <StoryFull cards={cards} when={when} close={() => setFull(false)} />}
  </section>;
}

export function Report({ d: _d }: { d: D }) {
  void _d;
  const sb = useMemo(() => supabaseBrowser(), []);
  /* on Sunday (the day the weekly e-mail goes out) the week that is ending, otherwise the last full week */
  const [per, setPer] = useState<Per>(() => (new Date().toLocaleDateString("en-US", { timeZone: "Europe/Budapest", weekday: "short" }) === "Sun" ? "week" : "lastweek")); const [inv, setInv] = useState(false);
  const [cf, setCf] = useState(ymd(addD(new Date(), -13))); const [ct, setCt] = useState(ymd(new Date()));
  const [rawF, setRawF] = useState(cf), [rawT, setRawT] = useState(ct);
  const [from, to] = range(per, cf, ct);
  const days = Math.round((new Date(to + "T12:00").getTime() - new Date(from + "T12:00").getTime()) / 864e5) + 1;
  const [wiz, setWiz] = useState(false); const [letter, setLetter] = useState("");
  const [w, setW] = useState<D | null>(null); const [r, setR] = useState<D | null>(null); const [seo, setSeo] = useState<D | null>(null); const [e, setE] = useState(""); const [re, setRe] = useState(""); const [rv, setRv] = useState(0);
  useEffect(() => {
    /* only the period chosen last may answer: a slower answer for the one before is dropped */
    let live = true;
    setW(null); setR(null); setE(""); setRe("");
    /* the range in Budapest time: from its first midnight to the midnight after its last day */
    const a = new Date(from + "T00:00:00").toISOString(), b = new Date(addD(new Date(to + "T12:00"), 1).setHours(0, 0, 0, 0)).toISOString();
    rpc(sb, "admin_dashboard", { p_days: days, p_from: a, p_to: b }).then(({ data, error }) => { if (!live) return; if (error) setE(error.message); setW(data || null); });
    rpc(sb, "admin_report", { p_from: from, p_to: to }).then(({ data, error }) => { if (!live) return; if (error) setRe(error.message); setR(data || null); });
    rpc(sb, "admin_seo_week").then(({ data }) => { if (live) setSeo(data || null); });
    return () => { live = false; };
  }, [sb, from, to, days, rv]);
  if (e && !w) return <PageErr e={e} retry={() => setRv((x) => x + 1)} />;
  if (!w) return <Loading />;
  const N = w.now || {}, PV = w.prev || {};
  /* the channels with a source (the Android app's opens carry none), each with the period before */
  const chans = ((w.channels || []) as D[]).filter((c) => c.k !== "közvetlen" && c.k !== "androidapp").slice(0, 6).map((c): D => ({ ...c, prev: n((w.channels_prev || {})[c.k]) }));
  /* the posts by the views they gained in the period, each against its platform's median gain */
  const posts: D[] = ((r?.posts || []) as D[]).slice(0, 10).map((p) => ({ ...p, gained: p.gain, x: p.ratio }));
  /* only what belongs to the period: not the platforms' current signals, not "now" */
  const sig = alerts(w).filter((x) => !PA.list.includes(x) && !IOS_NOTE.test(x.t) && !/^Most \d/.test(x.t) && x.c !== "info").slice(0, 6);
  const fol: D[] = ((r?.followers || []) as D[]).filter((x) => x.followers != null);
  const g = r?.gsc || {}, bg = r?.bing || {}, dl = r?.downloads || {};
  const imp = n(g.impressions) + n(bg.impressions) + n(r?.appstore_impressions) + Object.values((r?.social_impressions || {}) as D).reduce((a: number, v) => a + n(v), 0);
  const Row = ({ l, now, prev, sub }: { l: string; now: number; prev?: number; sub?: string }) => <div className="rp-k"><span>{l}</span><b>{fmt(now)}</b>{prev != null && <Delta now={now} prev={prev} />}{sub && <small>{sub}</small>}</div>;
  const gday = (k?: string) => (k ? new Date(k + "T12:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "");
  const months: D[] = (r?.months || []) as D[], weeks: D[] = (r?.weeks || []) as D[];
  const grow = (l: D[], k: string) => l.length >= 2 ? { now: n(l[l.length - 1][k]), prev: n(l[l.length - 2][k]) } : null;
  /* only finished months and weeks are compared: one day of November against all of October read as −98% */
  const yd = bpDate(new Date(Date.now() - 864e5));
  const monthDone = (x: D) => { const [y, mo] = String(x.dd).split("-").map(Number); return ymd(new Date(y, mo, 0)) <= yd; }, weekDone = (x: D) => ymd(addD(new Date(x.dd + "T12:00"), 6)) <= yd;
  const mom = grow(months.filter(monthDone), "made"), wow = grow(weeks.filter(weekDone), "made");
  const exportIt = (kind: "csv" | "json") => {
    if (!r) toast("A riport egy része nem töltődött be, ezért a fájlból is hiányzik.");
    const data = { idoszak: { tol: from, ig: to, nap: days }, szamok: { elkeszult_elonezet: N.made, elonezetet_keszitett_fiok: N.made_users, latogatas: N.sessions, elonezetig_jutott: N.scored, regisztracio: N.signups, megosztas: N.shared, mentes: N.saved, letoltes: !r || r.stores_on === false ? null : n(dl.apple) + n(dl.google), google_kattintas: g.clicks, google_megjelenes: g.impressions, bing_kattintas: bg.clicks, megjelenes_osszesen: imp },
      elozo: { elkeszult_elonezet: PV.made, elonezetet_keszitett_fiok: PV.made_users, latogatas: PV.sessions, elonezetig_jutott: PV.scored, regisztracio: PV.signups, megosztas: PV.shared, mentes: PV.saved, letoltes: !r || r.stores_on === false ? null : dl.prev, google_kattintas: g.prev_clicks, google_megjelenes: g.prev_impressions, bing_kattintas: bg.prev_clicks },
      google_idoszak: { tol: g.from, ig: g.to }, csatornak: chans.map((c) => ({ csatorna: ch(c.k), latogatas: c.sessions, megnezte_50_ev_mulva: c.revealed })),
      posztok: posts.map((p) => ({ platform: PF[p.platform], cim: p.title, nott_az_idoszakban: p.gain, szorzo: p.ratio, osszes: p.views })),
      kovetok: fol.map((x) => ({ platform: PF[x.platform] || x.platform, kezdet: x.start, veg: x.followers, valtozas: n(x.followers) - n(x.start) })),
      ...(inv ? {} : { postafiok: r?.inbox || null }), youtube_nezesi_ora: r?.yt_watch_hours ?? null };
    let body = JSON.stringify(data, null, 2), type = "application/json";
    if (kind === "csv") { type = "text/csv;charset=utf-8"; body = "﻿" + [`Időszak;${from};${to}`, "", "Mutató;Most;Előző", ...Object.keys(data.szamok).map((k) => `${k};${(data.szamok as D)[k] ?? ""};${(data.elozo as D)[k] ?? ""}`), "",
      "Platform;Követő az elején;Követő a végén;Változás", ...data.kovetok.map((x) => `${x.platform};${x.kezdet ?? ""};${x.veg ?? ""};${x.valtozas}`), "",
      "Csatorna;Látogatás;Megnézte 50 év múlva", ...data.csatornak.map((c) => `${c.csatorna};${c.latogatas};${c.megnezte_50_ev_mulva}`), "",
      "Poszt;Platform;Nőtt az időszakban;Szorzó;Összesen", ...data.posztok.map((p) => `"${String(p.cim || "").replace(/"/g, '""')}";${p.platform};${p.nott_az_idoszakban};${p.szorzo ?? ""};${p.osszes ?? ""}`)].join("\n"); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = `inkage-riport-${from}_${to}.${kind}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  /* what the weekly letter reads: the period's numbers, the one before, the channels, the posts, the followers */
  const weekData = () => ({ idoszak: { tol: from, ig: to }, most: { elkeszult_elonezet: N.made, elonezetet_keszitett_fiok: N.made_users, latogatas: N.sessions, regisztracio: N.signups, megosztas: N.shared, mentes: N.saved }, elozo: { elkeszult_elonezet: PV.made, elonezetet_keszitett_fiok: PV.made_users, latogatas: PV.sessions, regisztracio: PV.signups, megosztas: PV.shared, mentes: PV.saved },
    csatornak: chans.map((c) => ({ csatorna: ch(c.k), latogatas: c.sessions, megnezte_50_ev_mulva: c.revealed })), posztok: posts.map((p) => ({ platform: p.platform, cim: String(p.title || "").slice(0, 80), nott: p.gained ?? p.views, szorzo: p.x ?? null })),
    kovetok: fol.map((x) => ({ platform: x.platform, most: x.followers, kezdet: x.start })), google: { kattintas: g.clicks, elozo: g.prev_clicks }, letoltes: dl, jelzesek: sig.map((x) => x.t) });
  const title = per === "week" ? "Heti riport (eddig)" : per === "lastweek" ? "Heti riport" : per === "month" ? "Havi riport (eddig)" : per === "lastmonth" ? "Havi riport" : "Riport";
  const cmp = (a: number, b: number) => (w.prev_partial ? undefined : <Chg a={a} b={b} tail="az előző időszakhoz" />);
  const bestCh = [...chans].sort((a, b) => n(b.sessions) - n(a.sessions))[0], bestPost = posts[0];
  /* every card is a number the page below shows too; a card without real data is left out */
  const story: SC[] = [
    { k: "made", l: "Elkészült előnézet", v: n(N.made), chg: cmp(n(N.made), n(PV.made)), sub: "minden eszközről" },
    { k: "users", l: "Előnézetet készített fiók", v: n(N.made_users), chg: cmp(n(N.made_users), n(PV.made_users)) },
    { k: "sessions", l: "Látogatás", v: n(N.sessions), chg: cmp(n(N.sessions), n(PV.sessions)), sub: "aki elfogadta a statisztikát" },
    ...(N.signups != null ? [{ k: "signups", l: "Regisztráció", v: n(N.signups), chg: cmp(n(N.signups), n(PV.signups)) }] : []),
    { k: "shared", l: "Megosztás", v: n(N.shared), chg: cmp(n(N.shared), n(PV.shared)), sub: "valódi megosztás" },
    { k: "saved", l: "Mentés", v: n(N.saved), chg: cmp(n(N.saved), n(PV.saved)), sub: "elmentett előnézet" },
    ...(r && r.stores_on !== false ? [{ k: "dl", l: "Letöltés", v: n(dl.apple) + n(dl.google), chg: cmp(n(dl.apple) + n(dl.google), n(dl.prev)), sub: `App Store ${fmt(dl.apple)} · Play ${fmt(dl.google)}` }] : []),
    ...(bestCh && n(bestCh.sessions) ? [{ k: "ch", l: `Legerősebb forrás: ${ch(bestCh.k)}`, v: n(bestCh.sessions), sub: `látogatás · ${pct(n(bestCh.revealed), n(bestCh.sessions))} nézi meg 50 év múlva`, ic: <Logo k={bestCh.k} size={72} /> }] : []),
    ...(bestPost ? [{ k: "post", l: `A legjobb poszt: ${PF[bestPost.platform] || bestPost.platform}`, text: `+${big(bestPost.gain)}`, sub: `${viewWord(bestPost.platform)} az időszakban · ${String(bestPost.title || "").slice(0, 48)}`, ic: <Logo k={bestPost.platform} size={72} /> }] : []),
    ...(g.to && (n(g.clicks) > 0 || n(g.prev_clicks) > 0) ? [{ k: "gsc", l: "Google-kattintás", v: n(g.clicks), chg: cmp(n(g.clicks), n(g.prev_clicks)), sub: g.from !== from ? `${gday(g.from)}–${gday(g.to)} (a Google késése)` : undefined }] : []),
    ...(fol.map((x) => ({ k: "f" + x.platform, l: `${PF[x.platform] || x.platform}: követő`, text: big(x.followers), sub: `${n(x.followers) - n(x.start ?? x.followers) >= 0 ? "+" : ""}${fmt(n(x.followers) - n(x.start ?? x.followers))} az időszakban`, ic: <Logo k={x.platform} size={72} /> }))),
    ...(!inv && r?.inbox ? [{ k: "inbox", l: "Postafiók: új komment és vélemény", v: n(r.inbox.new), sub: `${fmt(r.inbox.replied)} megválaszolva · ${fmt(r.inbox.open)} vár most` }] : []),
    { k: "all", l: "Összes felhasználó", v: n(w.all?.users), sub: `az 1 000 000-ból · ${fmt(w.all?.made)} előnézet készült eddig` },
  ];
  return (
    <div className={"g ix report" + (inv ? " inv" : "")}>
      <Story cards={story} when={`${title}${inv ? " · befektetői nézet" : ""} · ${hd(from)} – ${hd(to)}`} />
      <section className="c s12 rp-head">
        <div><span className="eyebrow">{title} · InkAge{inv ? " · befektetői nézet" : ""}</span><h1>{hd(from)} – {hd(to)}</h1></div>
        <div className="adm-row no-print">
          <div className="adm-seg sm">{([["lastweek", "Múlt hét"], ["week", "Ez a hét"], ["lastmonth", "Múlt hónap"], ["month", "Ez a hónap"], ["custom", "Egyedi"]] as [Per, string][]).map(([k, l]) => <button key={k} aria-pressed={per === k} onClick={() => setPer(k)}>{l}</button>)}</div>
          {per === "custom" && <><input className="adm-in sm" type="date" value={rawF} onChange={(x) => { setRawF(x.target.value); if (goodDay(x.target.value)) setCf(x.target.value); }} onBlur={() => setRawF(cf)} aria-label="Ettől" /><input className="adm-in sm" type="date" value={rawT} onChange={(x) => { setRawT(x.target.value); if (goodDay(x.target.value)) setCt(x.target.value); }} onBlur={() => setRawT(ct)} aria-label="Eddig" /></>}
          <button className={"adm-ibtn sm" + (inv ? " on" : "")} onClick={() => setInv(!inv)}>{inv ? "✓ " : ""}Befektetői nézet</button>
          <button className="adm-ibtn sm" onClick={() => exportIt("csv")}>CSV</button><button className="adm-ibtn sm" onClick={() => exportIt("json")}>JSON</button>
          <button className="adm-ibtn" onClick={() => setWiz(true)}>{I(P.check)}Heti áttekintés (5 lépés)</button>
          <button className="adm-ibtn gold" onClick={() => window.print()}>{I(P.doc)}PDF / nyomtatás</button>
        </div>
      </section>
      {re && <div className="s12 no-print"><LoadErr e={re} retry={() => setRv((x) => x + 1)} /></div>}
      <section className="c s12 rp-grid">
        <Row l="Elkészült előnézet" now={n(N.made)} prev={n(PV.made)} sub="minden eszközről" /><Row l="Előnézetet készített fiók" now={n(N.made_users)} prev={n(PV.made_users)} /><Row l="Látogatás" now={n(N.sessions)} prev={n(PV.sessions)} sub="aki elfogadta a statisztikát" />
        {N.signups != null && <Row l="Regisztráció" now={n(N.signups)} prev={n(PV.signups)} />}<Row l="Megosztás" now={n(N.shared)} prev={n(PV.shared)} sub="valódi megosztás" /><Row l="Mentés" now={n(N.saved)} prev={n(PV.saved)} sub="elmentett előnézet" />
        {re ? <div className="rp-k"><span>Letöltés</span><b>–</b><small>nem sikerült betölteni</small></div> : !r ? <div className="rp-k"><span>Letöltés</span><b>…</b></div> : r.stores_on === false ? <div className="rp-k"><span>Letöltés</span><b>–</b><small>az áruházakból nincs adat</small></div> : <Row l="Letöltés" now={n(dl.apple) + n(dl.google)} prev={n(dl.prev)} sub={`App Store ${fmt(dl.apple)} · Play ${fmt(dl.google)}`} />}
        {g.to && (n(g.clicks) > 0 || n(g.prev_clicks) > 0) && <Row l="Google-kattintás" now={n(g.clicks)} prev={n(g.prev_clicks)} sub={g.from !== from ? `${gday(g.from)}–${gday(g.to)} (a Google késése)` : undefined} />}
        {(n(bg.clicks) > 0 || n(bg.prev_clicks) > 0) && <Row l="Bing-kattintás" now={n(bg.clicks)} prev={n(bg.prev_clicks)} />}
        {imp > 0 && <div className="rp-k"><span>Megjelenés</span><b>{big(imp)}</b><small>Google, Bing, közösségi, App Store</small></div>}
        <div className="rp-k"><span>Összes felhasználó</span><b>{fmt(w.all?.users)}</b><small>az 1 000 000-ból · {fmt(w.all?.made)} előnézet készült eddig</small></div>
        {fol.map((x) => { const dv = n(x.followers) - n(x.start ?? x.followers); return <div key={x.platform} className="rp-k"><span>{PF[x.platform] || x.platform}: követő</span><b>{big(x.followers)}</b><small className={dv >= 0 ? "up" : "down"}>{dv >= 0 ? "+" : ""}{fmt(dv)} az időszakban</small></div>; })}
        {n(r?.yt_watch_hours) > 0 && <div className="rp-k"><span>YouTube-nézési idő</span><b>{fmt(r!.yt_watch_hours, 1)} óra</b><small>az időszakban megjelent videók</small></div>}
        {!inv && r?.inbox && <div className="rp-k"><span>Postafiók</span><b>{fmt(r.inbox.new)}</b><small>új komment és vélemény · {fmt(r.inbox.replied)} megválaszolva · {fmt(r.inbox.open)} vár most</small></div>}
      </section>
      <section className="c s12"><h2>Elkészült előnézetek naponta</h2><ChartBox data={(w.trend || []).map((x: D, i: number) => ({ t: x.t, v: n(x.made), p: w.prev_trend?.[i] ? n(w.prev_trend[i].made) : undefined }))} label="Elkészült előnézet" height={220} name="riport-elonezet" /></section>
      {/* growth: the running total, and the change month on month and week on week (the investor's view first) */}
      {(r?.cum || []).length > 1 && <section className="c s7"><h2>Összes elkészült előnézet, halmozva</h2><TrendChart data={((r!.cum || []) as D[]).map((x) => ({ t: String(x.dd), v: n(x.m) }))} label="Elkészült előnézet" height={200} /></section>}
      {(months.length > 1 || weeks.length > 1) && <section className={"c " + ((r?.cum || []).length > 1 ? "s5" : "s12")}><h2>Növekedés</h2><ul className="rp-l">
        {mom ? <li><b>Hónapról hónapra</b><span>{fmt(mom.now)} előnézet, előtte {fmt(mom.prev)} · <Delta now={mom.now} prev={mom.prev} /></span></li> : <li><b>Hónapról hónapra</b><span>Még nincs két lezárt hónap: a folyó hónapot nem hasonlítjuk egy teljeshez.</span></li>}
        {wow ? <li><b>Hétről hétre</b><span>{fmt(wow.now)} előnézet, előtte {fmt(wow.prev)} · <Delta now={wow.now} prev={wow.prev} /></span></li> : <li><b>Hétről hétre</b><span>Még nincs két lezárt hét.</span></li>}
        {months.slice(-4).map((x) => <li key={x.dd}><b>{new Date(x.dd + "T12:00").toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}{monthDone(x) ? "" : " (eddig)"}</b><span>{fmt(x.sessions)} látogatás · {fmt(x.made)} előnézet</span></li>)}
      </ul></section>}
      <section className="c s6"><h2>Honnan jöttek</h2><div className="ix-rows">{chans.map((c) => <IRow key={c.k} ic={<Logo k={c.k} size={36} />} t={ch(c.k)} s={`${pct(n(c.revealed), n(c.sessions))} nézi meg 50 év múlva`} v={fmt(c.sessions)} vs="látogatás" />)}</div>
        <p className="note">A látogatások forrása mért adat. A regisztrációk forrása csak becslés, ezért itt nem szerepel (a Megtartás oldalon jelölve látszik).</p></section>
      <section className="c s6"><h2>A posztok az időszakban</h2>{re ? <LoadErr e={re} retry={() => setRv((x) => x + 1)} /> : !r ? <div className="skel" style={{ height: 160 }} aria-busy="true" /> : posts.length ? <div className="ix-rows">{posts.map((p) => <IRow key={p.platform + p.post_id} ic={<Logo k={p.platform} size={36} />} t={String(p.title || PF[p.platform]).slice(0, 48)} s={p.ratio != null ? `a platform szokásos ${fmt(p.ratio, 1)}×-e` : undefined} v={`+${big(p.gain)}`} vs={`${viewWord(p.platform)} az időszakban`} />)}</div> : <p className="note">Ebben az időszakban nem nőtt egyik poszt sem a bekötött platformokon.</p>}
        <p className="note">Sorrend: az időszakban szerzett megtekintés a saját platformja szokásos növekedéséhez mérve (nem az élettartam-szám), így a platformok egy listában is összevethetők.</p></section>
      {!inv && <section className="c s12"><h2>Google és a weboldal</h2><ul className="rp-l">
        {g.to && <li><b>Google</b><span>{fmt(g.clicks)} kattintás · {big(g.impressions)} megjelenés · {gday(g.from)}–{gday(g.to)}{g.from !== from ? " (a Google 2–3 nap késéssel ad: ugyanannyi nap, a legutolsó adatig)" : ""}</span></li>}
        {(n(bg.clicks) > 0 || n(bg.impressions) > 0) && <li><b>Bing</b><span>{fmt(bg.clicks)} kattintás · {big(bg.impressions)} megjelenés</span></li>}
        {seo && days <= 8 && <>
          {((seo.up || []) as D[]).map((x) => <li key={"u" + x.query}><b>▲ „{x.query}”</b><span>{fmt(x.gain, 1)} hellyel feljebb</span></li>)}
          {((seo.down || []) as D[]).map((x) => <li key={"d" + x.query}><b>▼ „{x.query}”</b><span>{fmt(x.loss, 1)} hellyel lejjebb</span></li>)}
          <li><b>A weboldal (a hét)</b><span>{fmt(seo.broken)} hibás oldal, {fmt(seo.issues)} SEO-észrevétel · elérhetőség {seo.uptime != null ? fmt(n(seo.uptime), 2) + "%" : "–"} · {fmt(seo.mentions)} új említés a weben</span></li></>}
        {seo && days > 8 && <li><b>A weboldal</b><span>A helyezésváltozások és a bejárás heti adatok: a SEO-ellenőrzés oldalon látszanak hétről hétre.</span></li>}
      </ul></section>}
      {!inv && ((r?.notes || []) as D[]).length > 0 && <section className="c s12"><h2>Napló</h2><ul className="rp-l">{((r!.notes || []) as D[]).map((x, i) => <li key={i}><b>{new Date(x.day + "T12:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} · {NOTE_KIND[x.kind] || "Jegyzet"}</b><span>{x.text}</span></li>)}</ul></section>}
      {!inv && <section className="c s12"><h2>Amit érdemes tudni</h2><ul className="rp-l">{sig.map((x, i) => <li key={i}><b>{x.t}</b><span>{x.s}</span></li>)}{!sig.length && <li><b>Nyugodt időszak</b><span>Nincs figyelmeztetés ebből az időszakból.</span></li>}</ul></section>}
      {!inv && <section className="c s12 rp-letter"><h2>Heti levél</h2>
        {letter ? <p className="rp-lt">{letter}</p> : <p className="note">Egy rövid, személyes levél a hétről: mi ment jól, mi nem, és 3 lépés erre a hétre. Az MI csak az oldal számaiból ír.</p>}
        <button className="adm-ibtn sm no-print" disabled={letter === "Írom…"} onClick={async () => { setLetter("Írom…"); const x = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "letter", data: weekData() }) }); setLetter(x.ok && x.json?.text ? x.json.text : x.json?.error || "Nem sikerült."); }}>{I(P.spark)}{letter && letter !== "Írom…" ? "Újraírás" : "Megírom a heti levelet (MI)"}</button>
      </section>}
      <p className="note s12 no-print">Vasárnap este a heti riport e-mailben is megérkezik (ha be van állítva az e-mail-küldés). Az e-mail az elmúlt 7 napot számolja a küldés pillanatától, ez az oldal hétfőtől, ezért a számok kicsit eltérhetnek. Az „eddig” jelzésű időszak még tart.</p>
      {wiz && <Wizard close={() => setWiz(false)} word={per === "week" || per === "lastweek" ? "a héten" : per === "month" || per === "lastmonth" ? "a hónapban" : "az időszakban"} postsOk={!!r} from={from} to={to} N={N} PV={PV} posts={posts} chans={chans} sig={sig} fol={fol} letter={letter} />}
    </div>
  );
}

/* ---------- the weekly review: five steps, one screen each, then a PDF ---------- */
const GOAL_P: Record<string, string> = { week: "heti", month: "havi" };
function Wizard({ close, word, postsOk, from, to, N, PV, posts, chans, sig, fol, letter }: { close: () => void; word: string; postsOk: boolean; from: string; to: string; N: D; PV: D; posts: D[]; chans: D[]; sig: D[]; fol: D[]; letter: string }) {
  const [st, setSt] = useState(0);
  const goals = useRpc("admin_goals_list", undefined, []);
  const gl: D[] = Array.isArray(goals.d) ? goals.d : [];
  const ch1 = (a: number, b: number) => (b ? <Delta now={a} prev={b} /> : null);
  /* only what really stayed under its platform's usual: the two lowest can still be above it */
  const weak = [...posts].filter((p) => p.x != null && n(p.x) < 1).sort((a, b) => n(a.x) - n(b.x)).slice(0, 2);
  const lessCh = chans.filter((c) => n(c.prev) > 0 && n(c.sessions) < n(c.prev) * 0.8);
  const STEPS = [word === "a héten" ? "A hét számai" : "Az időszak számai", "A legjobb 3 tartalom", "Ami nem működött", "Célok", "A jövő hét"];
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide wiz" role="dialog" aria-label="Heti áttekintés">
        <div className="c-h"><div><div><span className="eyebrow">Heti áttekintés · {hd(from)} – {hd(to)} · {st + 1} / 5</span><h2 style={{ fontSize: 22, marginTop: 6 }}>{STEPS[st]}</h2></div></div><CloseX close={close} /></div>
        <div className="wiz-dots">{STEPS.map((x, i) => <button key={x} className={i === st ? "on" : i < st ? "done" : ""} onClick={() => setSt(i)} aria-label={x} />)}</div>
        {st === 0 && <div className="rp-grid wiz-g">
          {([["Elkészült előnézet", "made"], ["Előnézetet készített fiók", "made_users"], ["Látogatás", "sessions"], ["Regisztráció", "signups"], ["Megosztás", "shared"], ["Mentés", "saved"]] as [string, string][]).filter(([, k]) => N[k] != null).map(([l, k]) => <div key={k} className="rp-k"><span>{l}</span><b>{fmt(N[k])}</b>{ch1(n(N[k]), n(PV[k]))}<small>előtte {fmt(PV[k])}</small></div>)}
          {fol.map((x) => <div key={x.platform} className="rp-k"><span>{PF[x.platform] || x.platform}: követő</span><b>{big(x.followers)}</b><small>{n(x.followers) - n(x.start ?? x.followers) >= 0 ? "+" : ""}{fmt(n(x.followers) - n(x.start ?? x.followers))} {word}</small></div>)}
        </div>}
        {st === 1 && (posts.length ? <ol className="wiz-l">{posts.slice(0, 3).map((p) => <li key={p.platform + p.post_id}><Logo k={p.platform} size={22} /><div><b>{String(p.title || "(nincs szöveg)").slice(0, 90)}</b><small>{big(p.gained ?? p.views)} {viewWord(p.platform)} {word}{p.x != null ? ` · ${fmt(p.x, 1)}× a szokásos` : ""}</small></div></li>)}</ol> : <p className="note">{postsOk ? "Ebben az időszakban nem nőtt egyik poszt sem." : "A posztok adatai nem töltődtek be."}</p>)}
        {st === 2 && <ul className="wiz-l">
          {weak.map((p) => <li key={"w" + p.post_id}><Logo k={p.platform} size={22} /><div><b>Gyengébb poszt: {String(p.title || "").slice(0, 70)}</b><small>{fmt(p.x, 1)}× a platformja szokásosához</small></div></li>)}
          {lessCh.map((c) => <li key={"c" + c.k}><Logo k={c.k} size={22} /><div><b>Kevesebb látogató: {ch(c.k)}</b><small>{fmt(c.sessions)}, előtte {fmt(c.prev)}</small></div></li>)}
          {sig.filter((x) => x.c === "bad" || x.c === "warn").map((x, i) => <li key={"s" + i}><span /><div><b>{x.t}</b><small>{x.s}</small></div></li>)}
          {!weak.length && !lessCh.length && !sig.filter((x) => x.c === "bad" || x.c === "warn").length && <li><span /><div><b>Nem volt kiugróan gyenge pont.</b></div></li>}
        </ul>}
        {st === 3 && (gl.length ? <ul className="wiz-l">{gl.map((x) => { const p = n(x.target) ? n(x.value) / n(x.target) : 0; return <li key={x.metric + x.period}><span className={"chip " + (p >= 1 ? "good" : p >= 0.6 ? "warn" : "bad")}>{fmt(p * 100)}%</span><div><b>{GOAL_M[x.metric] || x.metric}</b><small>{x.value == null ? "nincs adat" : fmt(x.value)} / {fmt(x.target)} ({GOAL_P[x.period] || x.period})</small></div></li>; })}</ul>
          : <p className="note">Még nincs beállított cél. A Célok oldalon adhatsz meg heti vagy havi célt, és itt követed.</p>)}
        {st === 4 && <><WeekPlan />{letter && letter !== "Írom…" && <p className="rp-lt">{letter}</p>}</>}
        <div className="adm-row" style={{ justifyContent: "space-between", marginTop: "auto" }}>
          <button className="adm-ibtn" disabled={st === 0} onClick={() => setSt(st - 1)}>← Vissza</button>
          {st < 4 ? <button className="adm-ibtn gold" onClick={() => setSt(st + 1)}>Tovább →</button> : <button className="adm-ibtn gold" onClick={() => { close(); setTimeout(() => window.print(), 300); }}>{I(P.doc)}Kész · PDF</button>}
        </div>
      </aside>
    </Layer>
  );
}
