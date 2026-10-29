"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, TrendChart, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { ChartBox } from "../extra";
import { GOAL_M, I, Layer, Loading, NOTE_KIND, P, PA, PF, alerts, api, big, ch, n, rpc, type D, useRpc } from "../shared";
import { WeekPlan } from "../extra";
import { IOS_NOTE } from "./alerts";
import { viewWord } from "./social";

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
const hd = (k: string) => new Date(k + "T12:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric" });

export function Report({ d: _d }: { d: D }) {
  void _d;
  const sb = useMemo(() => supabaseBrowser(), []);
  /* on Sunday (the day the weekly e-mail goes out) the week that is ending, otherwise the last full week */
  const [per, setPer] = useState<Per>(() => (new Date().toLocaleDateString("en-US", { timeZone: "Europe/Budapest", weekday: "short" }) === "Sun" ? "week" : "lastweek")); const [inv, setInv] = useState(false);
  const [cf, setCf] = useState(ymd(addD(new Date(), -13))); const [ct, setCt] = useState(ymd(new Date()));
  const [from, to] = range(per, cf, ct);
  const days = Math.round((new Date(to + "T12:00").getTime() - new Date(from + "T12:00").getTime()) / 864e5) + 1;
  const [wiz, setWiz] = useState(false); const [letter, setLetter] = useState("");
  const [w, setW] = useState<D | null>(null); const [r, setR] = useState<D | null>(null); const [seo, setSeo] = useState<D | null>(null); const [e, setE] = useState("");
  useEffect(() => {
    setW(null); setR(null); setE("");
    /* the range in Budapest time: from its first midnight to the midnight after its last day */
    const a = new Date(from + "T00:00:00").toISOString(), b = new Date(addD(new Date(to + "T12:00"), 1).setHours(0, 0, 0, 0)).toISOString();
    rpc(sb, "admin_dashboard", { p_days: days, p_from: a, p_to: b }).then(({ data, error }) => { if (error) setE(error.message); setW(data || null); });
    rpc(sb, "admin_report", { p_from: from, p_to: to }).then(({ data }) => setR(data || null));
    rpc(sb, "admin_seo_week").then(({ data }) => setSeo(data || null));
  }, [sb, from, to, days]);
  if (e && !w) return <div className="g"><div className="alert err s12">{e}</div></div>;
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
  const mom = grow(months.slice(0, -1).length >= 2 ? months.slice(0, -1) : months, "scored"), wow = grow(weeks.slice(0, -1).length >= 2 ? weeks.slice(0, -1) : weeks, "scored");
  const exportIt = (kind: "csv" | "json") => {
    const data = { idoszak: { tol: from, ig: to, nap: days }, szamok: { latogatas: N.sessions, elemzes: N.scored, regisztracio: N.signups, megosztas: N.shared, letoltes: n(dl.apple) + n(dl.google), google_kattintas: g.clicks, google_megjelenes: g.impressions, bing_kattintas: bg.clicks, megjelenes_osszesen: imp },
      elozo: { latogatas: PV.sessions, elemzes: PV.scored, regisztracio: PV.signups, megosztas: PV.shared, letoltes: dl.prev, google_kattintas: g.prev_clicks, google_megjelenes: g.prev_impressions, bing_kattintas: bg.prev_clicks },
      google_idoszak: { tol: g.from, ig: g.to }, csatornak: chans.map((c) => ({ csatorna: ch(c.k), latogatas: c.sessions, elemzes: c.scored })),
      posztok: posts.map((p) => ({ platform: PF[p.platform], cim: p.title, nott_az_idoszakban: p.gain, szorzo: p.ratio, osszes: p.views })),
      kovetok: fol.map((x) => ({ platform: PF[x.platform] || x.platform, kezdet: x.start, veg: x.followers, valtozas: n(x.followers) - n(x.start) })),
      postafiok: r?.inbox || null, youtube_nezesi_ora: r?.yt_watch_hours ?? null };
    let body = JSON.stringify(data, null, 2), type = "application/json";
    if (kind === "csv") { type = "text/csv;charset=utf-8"; body = "﻿" + [`Időszak;${from};${to}`, "", "Mutató;Most;Előző", ...Object.keys(data.szamok).map((k) => `${k};${(data.szamok as D)[k] ?? ""};${(data.elozo as D)[k] ?? ""}`), "",
      "Platform;Követő az elején;Követő a végén;Változás", ...data.kovetok.map((x) => `${x.platform};${x.kezdet ?? ""};${x.veg ?? ""};${x.valtozas}`), "",
      "Csatorna;Látogatás;Előnézet", ...data.csatornak.map((c) => `${c.csatorna};${c.latogatas};${c.elemzes}`), "",
      "Poszt;Platform;Nőtt az időszakban;Szorzó;Összesen", ...data.posztok.map((p) => `"${String(p.cim || "").replace(/"/g, '""')}";${p.platform};${p.nott_az_idoszakban};${p.szorzo ?? ""};${p.osszes ?? ""}`)].join("\n"); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = `inkage-riport-${from}_${to}.${kind}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  /* what the weekly letter reads: the period's numbers, the one before, the channels, the posts, the followers */
  const weekData = () => ({ idoszak: { tol: from, ig: to }, most: { latogatas: N.sessions, elemzes: N.scored, regisztracio: N.signups, megosztas: N.shared }, elozo: { latogatas: PV.sessions, elemzes: PV.scored, regisztracio: PV.signups, megosztas: PV.shared },
    csatornak: chans.map((c) => ({ csatorna: ch(c.k), latogatas: c.sessions, elemzes: c.scored })), posztok: posts.map((p) => ({ platform: p.platform, cim: String(p.title || "").slice(0, 80), nott: p.gained ?? p.views, szorzo: p.x ?? null })),
    kovetok: fol.map((x) => ({ platform: x.platform, most: x.followers, kezdet: x.start })), google: { kattintas: g.clicks, elozo: g.prev_clicks }, letoltes: dl, jelzesek: sig.map((x) => x.t) });
  const title = per === "week" ? "Heti riport (eddig)" : per === "lastweek" ? "Heti riport" : per === "month" ? "Havi riport (eddig)" : per === "lastmonth" ? "Havi riport" : "Riport";
  return (
    <div className={"g report" + (inv ? " inv" : "")}>
      <section className="c s12 rp-head">
        <div><span className="eyebrow">{title} · InkAge{inv ? " · befektetői nézet" : ""}</span><h1>{hd(from)} – {hd(to)}</h1></div>
        <div className="adm-row no-print">
          <div className="adm-seg sm">{([["lastweek", "Múlt hét"], ["week", "Ez a hét"], ["lastmonth", "Múlt hónap"], ["month", "Ez a hónap"], ["custom", "Egyedi"]] as [Per, string][]).map(([k, l]) => <button key={k} aria-pressed={per === k} onClick={() => setPer(k)}>{l}</button>)}</div>
          {per === "custom" && <><input className="adm-in sm" type="date" value={cf} onChange={(x) => setCf(x.target.value)} aria-label="Ettől" /><input className="adm-in sm" type="date" value={ct} onChange={(x) => setCt(x.target.value)} aria-label="Eddig" /></>}
          <button className={"adm-ibtn sm" + (inv ? " on" : "")} onClick={() => setInv(!inv)}>{inv ? "✓ " : ""}Befektetői nézet</button>
          <button className="adm-ibtn sm" onClick={() => exportIt("csv")}>CSV</button><button className="adm-ibtn sm" onClick={() => exportIt("json")}>JSON</button>
          <button className="adm-ibtn" onClick={() => setWiz(true)}>{I(P.check)}Heti áttekintés (5 lépés)</button>
          <button className="adm-ibtn gold" onClick={() => window.print()}>{I(P.doc)}PDF / nyomtatás</button>
        </div>
      </section>
      <section className="c s12 rp-grid">
        <Row l="Látogatás" now={n(N.sessions)} prev={n(PV.sessions)} /><Row l="Előnézet" now={n(N.scored)} prev={n(PV.scored)} />
        {N.signups != null && <Row l="Regisztráció" now={n(N.signups)} prev={n(PV.signups)} />}<Row l="Megosztás" now={n(N.shared)} prev={n(PV.shared)} />
        {(n(dl.apple) + n(dl.google) > 0 || n(dl.prev) > 0) && <Row l="Letöltés" now={n(dl.apple) + n(dl.google)} prev={n(dl.prev)} sub={`App Store ${fmt(dl.apple)} · Play ${fmt(dl.google)}`} />}
        {g.to && (n(g.clicks) > 0 || n(g.prev_clicks) > 0) && <Row l="Google-kattintás" now={n(g.clicks)} prev={n(g.prev_clicks)} sub={g.from !== from ? `${gday(g.from)}–${gday(g.to)} (a Google késése)` : undefined} />}
        {(n(bg.clicks) > 0 || n(bg.prev_clicks) > 0) && <Row l="Bing-kattintás" now={n(bg.clicks)} prev={n(bg.prev_clicks)} />}
        {imp > 0 && <div className="rp-k"><span>Megjelenés</span><b>{big(imp)}</b><small>Google, Bing, közösségi, App Store</small></div>}
        <div className="rp-k"><span>Összes előnézet</span><b>{fmt(w.all?.scored)}</b><small>az 1 000 000-ból</small></div>
        {fol.map((x) => { const dv = n(x.followers) - n(x.start ?? x.followers); return <div key={x.platform} className="rp-k"><span>{PF[x.platform] || x.platform}: követő</span><b>{big(x.followers)}</b><small className={dv >= 0 ? "up" : "down"}>{dv >= 0 ? "+" : ""}{fmt(dv)} az időszakban</small></div>; })}
        {n(r?.yt_watch_hours) > 0 && <div className="rp-k"><span>YouTube-nézési idő</span><b>{fmt(r!.yt_watch_hours, 1)} óra</b><small>az időszakban megjelent videók</small></div>}
        {!inv && r?.inbox && <div className="rp-k"><span>Postafiók</span><b>{fmt(r.inbox.new)}</b><small>új komment és vélemény · {fmt(r.inbox.replied)} megválaszolva · {fmt(r.inbox.open)} vár most</small></div>}
      </section>
      <section className="c s12"><h2>Előnézetek naponta</h2><ChartBox data={(w.trend || []).map((x: D, i: number) => ({ t: x.t, v: n(x.scored), p: w.prev_trend?.[i] ? n(w.prev_trend[i].scored) : undefined }))} label="Előnézet" height={220} name="riport-elemzes" /></section>
      {/* growth: the running total, and the change month on month and week on week (the investor's view first) */}
      {(r?.cum || []).length > 1 && <section className="c s7"><h2>Összes előnézet, halmozva</h2><TrendChart data={((r!.cum || []) as D[]).map((x) => ({ t: String(x.dd), v: n(x.v) }))} label="Összes előnézet" height={200} /></section>}
      {(months.length > 1 || weeks.length > 1) && <section className={"c " + ((r?.cum || []).length > 1 ? "s5" : "s12")}><h2>Növekedés</h2><ul className="rp-l">
        {mom && <li><b>Hónapról hónapra</b><span>{fmt(mom.now)} előnézet, előtte {fmt(mom.prev)} · <Delta now={mom.now} prev={mom.prev} /></span></li>}
        {wow && <li><b>Hétről hétre</b><span>{fmt(wow.now)} előnézet, előtte {fmt(wow.prev)} · <Delta now={wow.now} prev={wow.prev} /></span></li>}
        {months.slice(-4).map((x) => <li key={x.dd}><b>{new Date(x.dd + "T12:00").toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}</b><span>{fmt(x.sessions)} látogatás · {fmt(x.scored)} előnézet</span></li>)}
      </ul></section>}
      <section className="c s6"><h2>Honnan jöttek</h2><ul className="rp-l">{chans.map((c) => <li key={c.k}><Logo k={c.k} size={24} /><b>{ch(c.k)}</b><span>{fmt(c.sessions)} látogatás · {pct(n(c.scored), n(c.sessions))} előnézetig</span></li>)}</ul>
        <p className="note">A regisztráció csatornánként nem bontható: a fiók nem tárolja, honnan jött.</p></section>
      <section className="c s6"><h2>A posztok az időszakban</h2>{posts.length ? <ul className="rp-l">{posts.map((p) => <li key={p.platform + p.post_id}><Logo k={p.platform} size={24} /><b>{String(p.title || PF[p.platform]).slice(0, 48)}</b><span>+{big(p.gain)} {viewWord(p.platform)} az időszakban{p.ratio != null ? ` · a platform szokásos ${fmt(p.ratio, 1)}×-e` : ""}</span></li>)}</ul> : <p className="note">Ebben az időszakban nem nőtt egyik poszt sem a bekötött platformokon.</p>}
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
      <p className="note s12 no-print">Vasárnap este a heti riport e-mailben is megérkezik (ha be van állítva az e-mail-küldés).</p>
      {wiz && <Wizard close={() => setWiz(false)} from={from} to={to} N={N} PV={PV} posts={posts} chans={chans} sig={sig} fol={fol} letter={letter} />}
    </div>
  );
}

/* ---------- the weekly review: five steps, one screen each, then a PDF ---------- */
function Wizard({ close, from, to, N, PV, posts, chans, sig, fol, letter }: { close: () => void; from: string; to: string; N: D; PV: D; posts: D[]; chans: D[]; sig: D[]; fol: D[]; letter: string }) {
  const [st, setSt] = useState(0);
  const goals = useRpc("admin_goals_list", undefined, []);
  const gl: D[] = Array.isArray(goals.d) ? goals.d : [];
  const ch1 = (a: number, b: number) => (b ? <Delta now={a} prev={b} /> : null);
  const weak = [...posts].filter((p) => p.x != null).sort((a, b) => n(a.x) - n(b.x)).slice(0, 2);
  const STEPS = ["A hét számai", "A legjobb 3 tartalom", "Ami nem működött", "Célok", "A jövő hét"];
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide wiz" role="dialog" aria-label="Heti áttekintés">
        <div className="c-h"><div><div><span className="eyebrow">Heti áttekintés · {hd(from)} – {hd(to)} · {st + 1} / 5</span><h2 style={{ fontSize: 22, marginTop: 6 }}>{STEPS[st]}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        <div className="wiz-dots">{STEPS.map((x, i) => <button key={x} className={i === st ? "on" : i < st ? "done" : ""} onClick={() => setSt(i)} aria-label={x} />)}</div>
        {st === 0 && <div className="rp-grid wiz-g">
          {([["Látogatás", "sessions"], ["Előnézet", "scored"], ["Regisztráció", "signups"], ["Megosztás", "shared"]] as [string, string][]).filter(([, k]) => N[k] != null).map(([l, k]) => <div key={k} className="rp-k"><span>{l}</span><b>{fmt(N[k])}</b>{ch1(n(N[k]), n(PV[k]))}<small>előtte {fmt(PV[k])}</small></div>)}
          {fol.map((x) => <div key={x.platform} className="rp-k"><span>{PF[x.platform] || x.platform}: követő</span><b>{big(x.followers)}</b><small>{n(x.followers) - n(x.start ?? x.followers) >= 0 ? "+" : ""}{fmt(n(x.followers) - n(x.start ?? x.followers))} a héten</small></div>)}
        </div>}
        {st === 1 && (posts.length ? <ol className="wiz-l">{posts.slice(0, 3).map((p) => <li key={p.platform + p.post_id}><Logo k={p.platform} size={22} /><div><b>{String(p.title || "(nincs szöveg)").slice(0, 90)}</b><small>{big(p.gained ?? p.views)} {viewWord(p.platform)} a héten{p.x != null ? ` · ${fmt(p.x, 1)}× a szokásos` : ""}</small></div></li>)}</ol> : <p className="note">A héten nem ment ki poszt.</p>)}
        {st === 2 && <ul className="wiz-l">
          {weak.map((p) => <li key={"w" + p.post_id}><Logo k={p.platform} size={22} /><div><b>Gyengébb poszt: {String(p.title || "").slice(0, 70)}</b><small>{fmt(p.x, 1)}× a platformja szokásosához</small></div></li>)}
          {chans.filter((c) => n(c.prev) > 0 && n(c.sessions) < n(c.prev) * 0.8).map((c) => <li key={"c" + c.k}><Logo k={c.k} size={22} /><div><b>Kevesebb látogató: {ch(c.k)}</b><small>{fmt(c.sessions)}, előtte {fmt(c.prev)}</small></div></li>)}
          {sig.filter((x) => x.c === "bad" || x.c === "warn").map((x, i) => <li key={"s" + i}><span /><div><b>{x.t}</b><small>{x.s}</small></div></li>)}
          {!weak.length && !sig.length && <li><span /><div><b>Nem volt kiugróan gyenge pont.</b></div></li>}
        </ul>}
        {st === 3 && (gl.length ? <ul className="wiz-l">{gl.map((x) => { const p = n(x.target) ? n(x.value) / n(x.target) : 0; return <li key={x.metric + x.period}><span className={"chip " + (p >= 1 ? "good" : p >= 0.6 ? "warn" : "bad")}>{fmt(p * 100)}%</span><div><b>{GOAL_M[x.metric] || x.metric}</b><small>{fmt(x.value)} / {fmt(x.target)} ({x.period})</small></div></li>; })}</ul>
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
