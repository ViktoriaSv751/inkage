"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, TrendChart } from "../charts";
import { SwipeRow, toast, usePhone } from "../phone";
import { AIC, ALL, I, P, PF, PushNone, TONE, ago, alerts, n, rpc, type Alert, type D, type Tab, usePeriod } from "../shared";

/* ---------- alerts: an inbox, the list on the left, the chosen signal on the right ---------- */
export const ALERT_M: Partial<Record<Tab, [string, string]>> = { traffic: ["sessions", "Látogatás"], funnel: ["scored", "Előnézet"], viral: ["shared", "Megosztás"], users: ["signups", "Regisztráció"], system: ["errors", "Hiba"], links: ["sessions", "Látogatás"], live: ["sessions", "Látogatás"], markets: ["sessions", "Látogatás"], goals: ["scored", "Előnézet"] };

export type Sig = Alert & { k?: string; since?: string | null };
/* the always-there iPhone note is not a signal: it sits under the list, once */
export const IOS_NOTE = /iPhone-app nem küld/;
/* a signal's key: the server's when it has one, else its page and its title without the numbers (so "3 komment vár" and
   "4 komment vár" stay one signal, and "Kész" holds while the numbers move) */
export const sigKey = (a: Sig) => a.k || `${a.to || ""}:${a.t.replace(/[\d\s.,%+−-]+/g, " ").trim().toLowerCase()}`;
/* the signals of the numbers, with the right pages (a language to Piacok, a link to Linkek) and without the iPhone note */
export function signals(d: D): Sig[] {
  return (alerts(d) as Sig[]).filter((a) => !IOS_NOTE.test(a.t)).map((a) => (/^Legjobban konvertáló nyelv/.test(a.t) ? { ...a, to: "markets" as Tab } : /^Legjobb jelölt link/.test(a.t) ? { ...a, to: "links" as Tab } : a));
}

const SIG_EV = "inkage:sig";
const bpDay = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
/* "Kész" and "Holnap" live on the server, so every device sees the same list (this browser's old marks are the fallback
   until the database update is installed) */
export function useSigState(list: Sig[]) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [st, setSt] = useState<Record<string, D>>({}); const [hist, setHist] = useState<D[]>([]); const [server, setServer] = useState<boolean | null>(null);
  const [loc, setLoc] = useState<{ done: string[]; later: Record<string, string> }>({ done: [], later: {} });
  /* a mark made anywhere (Jelzések, the home page) re-reads the state everywhere, so the menu badge follows at once */
  const [ver, setVer] = useState(0);
  useEffect(() => { const f = () => setVer((x) => x + 1); addEventListener(SIG_EV, f); return () => removeEventListener(SIG_EV, f); }, []);
  useEffect(() => { try { setLoc({ done: JSON.parse(localStorage.getItem("inkage.admin.done") || "[]"), later: JSON.parse(localStorage.getItem("inkage.admin.later") || "{}") }); } catch {} }, [ver]);
  const keys = list.map(sigKey).join("|");
  useEffect(() => {
    if (!list.length) return;
    rpc(sb, "admin_alerts_sync", { p_list: list.map((a) => ({ k: sigKey(a), c: a.c, t: a.t })) }).then(({ data, error }) => {
      if (error) { setServer(false); return; }
      setServer(true); const rows = Array.isArray(data) ? (data as D[]) : []; setHist(rows); setSt(Object.fromEntries(rows.map((x) => [x.k, x])));
    });
  }, [sb, keys, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = bpDay(), todayS = new Date().toDateString();
  const hidden = (a: Sig) => {
    if (server === false) return loc.done.includes(a.t) || loc.later[a.t] === todayS;
    const s = st[sigKey(a)]; return !!s && (!!s.done_at || (!!s.later_until && String(s.later_until) > today));
  };
  const mark = (a: Sig, state: "done" | "later" | "open") => {
    const k = sigKey(a);
    if (server === false) {
      const x = state === "done" ? { ...loc, done: [...loc.done, a.t].slice(-60) } : state === "later" ? { ...loc, later: { ...loc.later, [a.t]: todayS } } : { done: loc.done.filter((t) => t !== a.t), later: { ...loc.later, [a.t]: "" } };
      setLoc(x); try { localStorage.setItem("inkage.admin.done", JSON.stringify(x.done)); localStorage.setItem("inkage.admin.later", JSON.stringify(x.later)); } catch {}
      dispatchEvent(new Event(SIG_EV));
    } else {
      const tm = new Date(Date.now() + 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
      setSt((o) => ({ ...o, [k]: { ...(o[k] || { k }), done_at: state === "done" ? new Date().toISOString() : state === "open" ? null : o[k]?.done_at, later_until: state === "later" ? tm : state === "open" ? null : o[k]?.later_until } }));
      rpc(sb, "admin_alert_mark", { p_k: k, p_state: state }).then(({ error }) => { if (error) toast(error.message); else dispatchEvent(new Event(SIG_EV)); });
    }
    toast(state === "done" ? "Kész · szép munka" : state === "later" ? "Holnap újra szól" : "Visszatéve");
  };
  /* when a signal began: the server's first sighting, or the platform's own time */
  const since = (a: Sig) => a.since || st[sigKey(a)]?.first_seen || null;
  return { hidden, mark, since, hist, server, st };
}

export function Alerts({ d, go }: { d: D; go: (t: Tab) => void }) {
  const phone = usePhone();
  const all = signals(d);
  const S = useSigState(all);
  const out = all.filter((x) => !S.hidden(x));
  const ios = alerts(d).find((a) => IOS_NOTE.test(a.t));
  const [f, setF] = useState<"all" | Alert["c"] | "hist">("all"); const [sel, setSel] = useState(0);
  const cnt = (c: string) => out.filter((x) => x.c === c).length;
  const list = f === "hist" ? [] : out.filter((x) => f === "all" || x.c === f), cur = list[Math.min(sel, list.length - 1)];
  const LBL: Record<string, string> = { bad: "Hiba", warn: "Figyelem", good: "Jó hír", info: "Tipp" };
  const curKeys = new Set(all.map(sigKey));
  /* the past: signals that are over, or put away */
  const past = S.hist.filter((x) => !curKeys.has(x.k) || x.done_at);
  return (
    <div className="g">
      <div className="s12 adm-seg" style={{ alignSelf: "flex-start", justifySelf: "start" }}>
        <button aria-pressed={f === "all"} onClick={() => { setF("all"); setSel(0); }}>Mind · {out.length}</button>
        {(["bad", "warn", "good", "info"] as const).map((c) => <button key={c} aria-pressed={f === c} onClick={() => { setF(c); setSel(0); }}>{LBL[c]} · {cnt(c)}</button>)}
        <button aria-pressed={f === "hist"} onClick={() => setF("hist")}>Előzmény{S.server ? ` · ${past.length}` : ""}</button>
      </div>
      {f === "hist" ? <History rows={past} server={S.server} reopen={(k, t) => S.mark({ c: "info", t, s: "", k }, "open")} /> : <>
      <section className="s5"><ul className="alist">
        {list.map((x, i) => { const sn = S.since(x); return phone ? (
          <li key={sigKey(x)} className={"swipe-li " + x.c}><SwipeRow done={() => S.mark(x, "done")} later={() => S.mark(x, "later")} open={() => (x.to ? go(x.to) : setSel(i))}>
            <div className={"al-row " + x.c}><span className="ic">{I(AIC[x.c])}</span><div><b>{x.t}</b><span className="t">{x.s}</span>{sn && <span className="al-since">{ago(sn)} óta</span>}</div></div>
          </SwipeRow></li>
        ) : (
          <li key={sigKey(x)} className={x.c + " go" + (cur === x ? " sel" : "")} onClick={() => setSel(i)}>
            <span className="ic">{I(AIC[x.c])}</span><div><b>{x.t}</b><span className="t">{x.s}</span>{sn && <span className="al-since">{ago(sn)} óta</span>}</div><span />
          </li>
        ); })}
        {phone && list.length > 0 && <li className="ph-hint">Húzd balra: Holnap · Kész</li>}
      </ul>
      {ios && <p className="note al-foot">{ios.t}: {ios.s}</p>}
      {S.server === false && <p className="note al-foot">A „Kész” most csak ebben a böngészőben tárolódik (az adatbázis-frissítés még nincs telepítve).</p>}
      </section>
      <section className={"c s7 inbox-d t-" + (cur ? TONE[cur.c] : "sky")}>
        {cur ? <>
          <span className="eyebrow">{LBL[cur.c]}{S.since(cur) ? ` · ${ago(S.since(cur))} óta áll fenn` : ""}</span>
          <h1 style={{ fontSize: 34 }}>{cur.t}</h1>
          <p className="ib-s">{cur.s}</p>
          <AlertChart a={cur} d={d} />
          <div className="adm-row">{cur.to && <button className="adm-ibtn gold" onClick={() => go(cur.to!)}>Megnézem →</button>}
            <button className="adm-ibtn" onClick={() => S.mark(cur, "done")}>{I(P.check)}Kész</button>
            <button className="adm-ibtn" onClick={() => S.mark(cur, "later")}>Holnapig elhalasztom</button>
            {cur.to && <span className="note">a {ALL.find((x) => x.k === cur.to)?.l} oldalon</span>}</div>
        </> : <Empty t="Most nincs jelzés. Minden rendben." />}
      </section>
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
    <section className="c s12"><ul className="al-hist">{rows.map((x) => (
      <li key={x.k}><span className={"chip " + (x.c === "bad" ? "bad" : x.c === "warn" ? "warn" : x.c === "good" ? "good" : "")}>{x.done_at ? "kész" : "elmúlt"}</span>
        <b>{x.title || x.k}</b><span className="note">{new Date(x.first_seen).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} – {new Date(x.last_seen).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} · {n(x.seen_n)}× látva</span>
        {x.done_at && <button className="lnk" onClick={() => reopen(x.k, x.title || "")}>visszatesz</button>}</li>))}</ul></section>
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
      <ul className="push-l">{s.slice(0, 12).map((x, i) => <li key={i}><b>{x.title} <PushNone x={x} /></b><span>{x.body}</span><time>{ago(x.at)}</time></li>)}</ul></section>
  );
}
