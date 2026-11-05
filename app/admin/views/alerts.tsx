"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, TrendChart } from "../charts";
import { SwipeRow, toast, usePhone } from "../phone";
import { AIC, ALL, I, P, PF, PushNone, ago, alerts, n, rpc, type Alert, type D, type Tab, useFlt, usePeriod, useSaved } from "../shared";
import { Hero } from "../ink";
import { Info } from "../charts";

/* ---------- alerts: an inbox, the list on the left, the chosen signal on the right ---------- */
export const ALERT_M: Partial<Record<Tab, [string, string]>> = { traffic: ["sessions", "Látogatás"], funnel: ["revealed", "Megnézte 50 év múlva"], viral: ["shared", "Megosztás"], users: ["signups", "Regisztráció"], system: ["errors", "Hiba"], links: ["sessions", "Látogatás"], live: ["sessions", "Látogatás"], markets: ["sessions", "Látogatás"], goals: ["made", "Elkészült előnézet"] };

export type Sig = Alert & { k?: string; since?: string | null };
/* the always-there iPhone note is not a signal: it sits under the list, once */
export const IOS_NOTE = /iPhone-app nem küld/;
/* a signal's key: the server's when it has one, else its page and its title without the numbers (so "3 komment vár" and
   "4 komment vár" stay one signal, and "Kész" holds while the numbers move) */
/* a date in a sentence: "okt. 31-én", "nov. 1-jén", "okt. 30-ig". The joiners keep it on one line */
const dayShort = (k: string) => { const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(k) ? k + "T12:00:00" : k); return { l: t.toLocaleDateString("hu-HU", { month: "short" }), d: t.getDate() }; };
const onEnd = (d: number) => (d === 1 ? "jén" : [2, 3, 6, 8, 13, 16, 18, 20, 23, 26, 28, 30].includes(d) ? "án" : "én");
export const huOn = (k: string) => { const { l, d } = dayShort(k); return `${l}\u00a0${d}\u2060-\u2060${onEnd(d)}`; };
export const huTill = (k: string) => { const { l, d } = dayShort(k); return `${l}\u00a0${d}\u2060-\u2060ig`; };
/* the pages are black and white: a coloured emoji in front of a title goes */
export const noEmoji = (t: string) => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");
/* the database writes its dates as "10.26.-n": said properly, in the year it means */
const fixDates = (t: string) => (t || "").replace(/\b(\d{2})\.(\d{2})\.-(n|ig)\b/g, (_, m, d, e) => { const k = `${new Date().getFullYear()}-${m}-${d}`; return e === "n" ? huOn(k) : huTill(k); });
export const sigKey = (a: Sig) => a.k || `${a.to || ""}:${a.t.replace(/[\d\s.,%+−-]+/g, " ").trim().toLowerCase()}`;
/* the signals of the numbers, with the right pages (a language to Piacok, a link to Linkek) and without the iPhone note */
export function signals(d: D): Sig[] {
  const a0 = activeOf(d);
  return (alerts(d) as Sig[]).filter((a) => !IOS_NOTE.test(a.t) && !LIVE_HEADS.test(a.t) && !(a0 && TRAFFIC_SIG.test(a.t))).concat(a0 ? activeSignal(a0) : [])
    .map((a) => ({ ...a, t: fixDates(a.t), s: fixDates(a.s), ...(/^Legjobban konvertáló nyelv/.test(a.t) ? { to: "markets" as Tab } : /^Legjobb jelölt link/.test(a.t) ? { to: "links" as Tab } : {}) }));
}
/* the live head count is a number, not a signal: nothing to finish, and it would count differently on every page */
const LIVE_HEADS = /^Most \d/;
/* the traffic signals read the active visits, as Tölcsér does: a fall in single opens from nowhere (machines, often) is not a fall in visitors.
   One request per period, whichever page asks first; until it answers, the dashboard's own numbers stand. */
const TRAFFIC_SIG = /^(Visszaesett a forgalom|Forgalmi kiugrás)/;
const ACTIVE: { k: string; now: number; prev: number } = { k: "", now: 0, prev: 0 };
const activeKey = (d: D) => `${d.days}|${d.from || ""}`;
const activeOf = (d: D) => (ACTIVE.k && ACTIVE.k === activeKey(d) && !d.prev_partial ? ACTIVE : null);
const activeSignal = (x: { now: number; prev: number }): Sig[] => x.prev >= 10 && x.now > x.prev * 1.5 ? [{ c: "good", t: "Forgalmi kiugrás", s: `${Math.round(((x.now - x.prev) / x.prev) * 100)}%-kal több aktív látogatás, mint előtte (${x.prev} → ${x.now}).`, to: "traffic" }]
  : x.prev >= 10 && x.now < x.prev * 0.5 ? [{ c: "warn", t: "Visszaesett a forgalom", s: `Feleannyi aktív látogatás sincs, mint előtte (${x.prev} → ${x.now}).`, to: "traffic" }] : [];
export function useActiveVisits(d: D) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f } = useFlt();
  const [v, setV] = useState<{ now: number; prev: number } | null>(null);
  const days = d.days, from = d.from;
  useEffect(() => {
    let live = true; setV(null); if (!days) return;
    rpc(sb, "admin_traffic", { p_days: days, p_from: f.from ? from : null, p_to: f.to ? d.to : null, p_ch: f.ch || null, p_lang: f.lang || null }).then(({ data }) => {
      const T = (data || {}) as D; if (!live || T.engaged == null || T.prev_engaged == null) return;
      const x = { now: n(T.engaged), prev: n(T.prev_engaged) }; setV(x);
      ACTIVE.k = activeKey({ days, from }); ACTIVE.now = x.now; ACTIVE.prev = x.prev; dispatchEvent(new Event(SIG_EV));
    });
    return () => { live = false; };
  }, [sb, days, from, f.ch, f.lang, f.from, f.to]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

const SIG_EV = "inkage:sig";
export const bpDay = (plus = 0) => new Date(Date.now() + plus * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
/* grown enough to be news again: half as much again, and by at least five */
export const worse = (was: number, now: number) => now >= Math.max(was * 1.5, was + 5);
const sigNum = (a: Sig) => { if (a.c !== "bad" && a.c !== "warn") return null; const m = /\d[\d\s]*/.exec(a.t); return m ? Number(m[0].replace(/\s/g, "")) : null; };
/* "Kész" and "Holnap" live on the server, so every device sees the same list (this browser's old marks are the fallback
   until the database update is installed) */
export function useSigState(list: Sig[]) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [st, setSt] = useState<Record<string, D>>({}); const [hist, setHist] = useState<D[]>([]); const [server, setServer] = useState<boolean | null>(null);
  const [loc, setLoc] = useState<{ done: string[]; later: Record<string, string> }>({ done: [], later: {} });
  /* the figure a signal had when it was closed: a real worsening opens it again, whatever the "Kész" said */
  const [doneN, setDoneN] = useSaved<Record<string, number>>("phone_sig_done_n", {});
  /* a mark made anywhere (Jelzések, the home page) re-reads the state everywhere, so the menu badge follows at once */
  const [ver, setVer] = useState(0);
  useEffect(() => { const f = () => setVer((x) => x + 1); addEventListener(SIG_EV, f); return () => removeEventListener(SIG_EV, f); }, []);
  useEffect(() => { try { setLoc({ done: JSON.parse(localStorage.getItem("inkage.admin.done") || "[]"), later: JSON.parse(localStorage.getItem("inkage.admin.later") || "{}") }); } catch {} }, [ver]);
  const keys = list.map(sigKey).join("|");
  useEffect(() => {
    /* with no live signal too: the answer also holds the history */
    rpc(sb, "admin_alerts_sync", { p_list: list.map((a) => ({ k: sigKey(a), c: a.c, t: a.t })) }).then(({ data, error }) => {
      if (error) { setServer(false); return; }
      setServer(true); const rows = Array.isArray(data) ? (data as D[]) : []; setHist(rows); setSt(Object.fromEntries(rows.map((x) => [x.k, x])));
    });
  }, [sb, keys, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = bpDay(), todayS = new Date().toDateString();
  const hidden = (a: Sig) => {
    if (server === false) return loc.done.includes(a.t) || loc.later[a.t] === todayS;
    const s = st[sigKey(a)]; if (!s) return false;
    if (s.done_at) { const was = doneN[sigKey(a)], now = sigNum(a); if (!(was != null && now != null && worse(was, now))) return true; }
    return !!s.later_until && String(s.later_until) > today;
  };
  /* put off until when, or null: the Teendők list shows these as "későbbre téve" */
  const laterUntil = (a: Sig): string | null => {
    if (server === false) return loc.later[a.t] === todayS ? bpDay(1) : null;
    const s = st[sigKey(a)]; return s && !s.done_at && s.later_until && String(s.later_until) > today ? String(s.later_until).slice(0, 10) : null;
  };
  const mark = (a: Sig, state: "done" | "later" | "open") => {
    const k = sigKey(a);
    if (state === "done") { const now = sigNum(a); if (now != null) setDoneN((o) => { const es = Object.entries({ ...o, [k]: now }); return Object.fromEntries(es.slice(-80)); }); }
    if (server === false) {
      const x = state === "done" ? { ...loc, done: [...loc.done, a.t].slice(-60) } : state === "later" ? { ...loc, later: { ...loc.later, [a.t]: todayS } } : { done: loc.done.filter((t) => t !== a.t), later: { ...loc.later, [a.t]: "" } };
      setLoc(x); try { localStorage.setItem("inkage.admin.done", JSON.stringify(x.done)); localStorage.setItem("inkage.admin.later", JSON.stringify(x.later)); } catch {}
      dispatchEvent(new Event(SIG_EV));
    } else {
      const tm = bpDay(1);
      setSt((o) => ({ ...o, [k]: { ...(o[k] || { k }), done_at: state === "done" ? new Date().toISOString() : state === "open" ? null : o[k]?.done_at, later_until: state === "later" ? tm : state === "open" ? null : o[k]?.later_until } }));
      rpc(sb, "admin_alert_mark", { p_k: k, p_state: state }).then(({ error }) => { if (error) toast(error.message); else dispatchEvent(new Event(SIG_EV)); });
    }
    toast(state === "done" ? "Kész · szép munka" : state === "later" ? "Holnap újra szól" : "Visszatéve");
  };
  /* when a signal began: the server's first sighting, or the platform's own time */
  const since = (a: Sig) => a.since || st[sigKey(a)]?.first_seen || null;
  return { hidden, mark, since, hist, server, st, laterUntil };
}

export function Alerts({ d, go }: { d: D; go: (t: Tab) => void }) {
  const phone = usePhone();
  useActiveVisits(d);
  const all = signals(d);
  const S = useSigState(all);
  const out = all.filter((x) => !S.hidden(x));
  const ios = alerts(d).find((a) => IOS_NOTE.test(a.t));
  const [f, setF] = useState<"all" | Alert["c"] | "hist">("all"); const [sel, setSel] = useState(""); const top = useRef<HTMLElement>(null);
  const cnt = (c: string) => out.filter((x) => x.c === c).length;
  /* the most important first: it stands on the big card; a tap on a row brings that one up */
  const SEV: Record<Alert["c"], number> = { bad: 0, warn: 1, good: 2, info: 3 };
  const list = f === "hist" ? [] : out.filter((x) => f === "all" || x.c === f).sort((a, b) => SEV[a.c] - SEV[b.c]), cur = list.find((x) => sigKey(x) === sel) || list[0], rest = list.filter((x) => x !== cur);
  const pick = (x: Sig) => { setSel(sigKey(x)); top.current?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const LBL: Record<string, string> = { bad: "Hiba", warn: "Figyelem", good: "Jó hír", info: "Tipp" };
  const curKeys = new Set(all.map(sigKey));
  /* the past: signals that are over, or put away */
  const openKeys = new Set(out.map(sigKey));
  const past = S.hist.filter((x) => !openKeys.has(x.k) && (!curKeys.has(x.k) || x.done_at));
  return (
    <div className="g io">
      <div className="s12 io-hero-wide"><Hero max={120} label={<>Jelzés most{(ios || S.server === false) && <Info>{ios ? `${ios.t}: ${ios.s} ` : ""}{S.server === false ? "A „Kész” most csak ebben a böngészőben tárolódik (az adatbázis-frissítés még nincs telepítve)." : ""}</Info>}</>} v={out.length} sub={[cnt("bad") ? `${cnt("bad")} hiba, ezzel kezdd` : cnt("warn") ? `${cnt("warn")} figyelmet kér` : "", out.length ? "A Teendők listán is ott vannak." : ""].filter(Boolean).join(" ")} /></div>
      <div className="s12 adm-seg io-seg">
        <button aria-pressed={f === "all"} onClick={() => { setF("all"); setSel(""); }}>Mind · {out.length}</button>
        {(["bad", "warn", "good", "info"] as const).map((c) => <button key={c} aria-pressed={f === c} onClick={() => { setF(c); setSel(""); }}>{LBL[c]} · {cnt(c)}</button>)}
        <button aria-pressed={f === "hist"} onClick={() => setF("hist")}>Előzmény{S.server ? ` · ${past.length}` : ""}</button>
      </div>
      {f === "hist" ? <History rows={past} server={S.server} reopen={(k, t) => S.mark({ c: "info", t, s: "", k }, "open")} /> : <>
      {cur ? <section ref={top} className="s12 io-card ink-flip io-al-top">
        <small className="io-card-m"><span>{LBL[cur.c]}{S.since(cur) ? ` · ${ago(S.since(cur))} óta` : ""}</span>{list.length > 1 && <span>{list.indexOf(cur) + 1} / {list.length}</span>}</small>
        <b className="io-card-t">{cur.t}</b>
        {cur.s && <p className="io-card-s">{cur.s}</p>}
        <AlertChart a={cur} d={d} />
        <div className="io-card-a">{cur.to && <button className="adm-ibtn gold" onClick={() => go(cur.to!)}>Megnézem</button>}
          <button className="adm-ibtn" onClick={() => S.mark(cur, "done")}>{I(P.check)}Kész</button>
          <button className="adm-ibtn" onClick={() => S.mark(cur, "later")}>Holnapig elhalasztom</button></div>
        {cur.to && <small className="io-card-s">a {ALL.find((x) => x.k === cur.to)?.l} oldalon</small>}
      </section> : <section className="s12 io-card io-done"><span aria-hidden="true">{I(P.check)}</span><b className="io-card-t">Most nincs jelzés</b></section>}
      {rest.length > 0 && <section className="s12 io-sec"><h3 className="ink-h">A többi · {rest.length}</h3><ul className="io-rows">
        {rest.map((x) => { const sn = S.since(x), body = <div className={"io-row go " + x.c} onClick={phone ? undefined : () => pick(x)}><span className="io-ic">{I(AIC[x.c])}</span><div className="io-t"><b>{x.t}</b><small>{x.s}{sn ? `${x.s ? " · " : ""}${ago(sn)} óta` : ""}</small></div>
          {x.to ? <button className="io-pill" onClick={(e) => { e.stopPropagation(); go(x.to!); }}>Megnézem</button> : <button className="io-pill" onClick={(e) => { e.stopPropagation(); S.mark(x, "done"); }}>Kész</button>}</div>;
          return <li key={sigKey(x)}>{phone ? <SwipeRow done={() => S.mark(x, "done")} later={() => S.mark(x, "later")} open={() => pick(x)}>{body}</SwipeRow> : body}</li>; })}
        {phone && <li className="ph-hint">Húzd balra: Holnap · Kész</li>}
      </ul></section>}
      </>}
      <PushLog />
    </div>
  );
}

/* the chart behind a signal: its own number over the period, the dashed line the period before */
function AlertChart({ a, d }: { a: Sig; d: D }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [x, setX] = useState<{ pts: { t: string; v: number; p?: number }[]; l: string } | null>(null);
  const pf = Object.keys(PF).find((k) => a.t.startsWith(PF[k] + ":"));
  const per = usePeriod();
  const tr: D[] = d.trend || [], pt: D[] = d.prev_trend || [];
  useEffect(() => {
    setX(null);
    /* a platform signal: that platform's followers; a Google signal: Google's clicks */
    if (pf && (a.to === "audience" || a.to === "connect")) rpc(sb, "admin_social", { p_days: per.eff }).then(({ data }) => setX({ l: `${PF[pf]}: követő`, pts: (((data as D)?.daily || []) as D[]).filter((r) => r.platform === pf && r.followers != null).map((r) => ({ t: r.day, v: n(r.followers) })) }));
    else if (a.to === "search") rpc(sb, "admin_search", { p_days: per.eff }).then(({ data }) => setX({ l: "Google-kattintás", pts: (((data as D)?.trend || []) as D[]).map((r, i) => ({ t: r.t, v: n(r.clicks), p: (data as D)?.prev_trend?.[i] ? n((data as D).prev_trend[i].clicks) : undefined })) }));
  }, [sb, a.t, a.to, pf, per.eff]);
  const m = a.to ? ALERT_M[a.to] : undefined;
  if (x) return x.pts.length > 1 ? <div className="ib-chart"><TrendChart data={x.pts} label={x.l} height={190} /></div> : null;
  if (!m || tr.length <= 2) return null;
  /* errors have no per-day line for the period before: its average stands in */
  const avgErr = m[0] === "errors" ? n(d.prev?.errors) / Math.max(1, tr.length) : null;
  return <div className="ib-chart"><TrendChart data={tr.map((r, i) => ({ t: r.t, v: n(r[m[0]]), p: avgErr != null ? avgErr : pt[i] ? n(pt[i][m[0]]) : undefined }))} label={m[1]} prevLabel={avgErr != null ? "Előző időszak átlaga" : undefined} hourly={d.bucket === "hour"} height={190} /></div>;
}

/* signals that are over, or put away; one click brings one back */
function History({ rows, server, reopen }: { rows: D[]; server: boolean | null; reopen: (k: string, t: string) => void }) {
  if (server === false) return <section className="c s12"><Empty t="Az előzményhez az adatbázis-frissítés kell." /></section>;
  if (!rows.length) return <section className="c s12"><Empty t="Még nincs lezárt jelzés." /></section>;
  return (
    <section className="c s12"><ul className="io-rows">{rows.map((x) => (
      <li key={x.k} className={"io-row " + (x.c || "")}><span className="io-ic">{I(AIC[x.c as Alert["c"]] || P.check)}</span>
        <div className="io-t"><b>{x.title || x.k}</b><small>{x.done_at ? "kész" : "elmúlt"} · {new Date(x.first_seen).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} – {new Date(x.last_seen).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} · {n(x.seen_n)}× látva</small></div>
        {x.done_at && <button className="io-pill" onClick={() => reopen(x.k, x.title || "")}>Visszatesz</button>}</li>))}</ul></section>
  );
}

/* what went out to the phone */
function PushLog() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [s, setS] = useState<D[] | null>(null);
  useEffect(() => { rpc(sb, "admin_push_status").then(({ data }) => setS(((data as D)?.sent || []) as D[])); }, [sb]);
  if (!s?.length) return null;
  return (
    <section className="c s12"><h2 style={{ marginBottom: 10 }}>Telefonra küldött értesítések</h2>
      {s.some((x) => x.devices === 0) && <p className="note" style={{ margin: "0 0 10px" }}>A „0 eszközre ment” jelölésűeket senki nem kapta meg: akkor egyetlen eszköz sem volt feliratkozva. Bekapcsolás: Rendszer → Értesítések a telefonra.</p>}
      <ul className="io-rows">{s.slice(0, 12).map((x, i) => <li key={i} className="io-row"><span className="io-ic">{I(P.bell)}</span><div className="io-t"><b>{noEmoji(String(x.title || ""))} <PushNone x={x} /></b><small>{x.body}</small></div><time className="io-time">{ago(x.at)}</time></li>)}</ul></section>
  );
}
