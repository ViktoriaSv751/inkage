"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Building blocks the all-in-one round added: how fresh each source is, the chart toolbar (line / columns, forecast,
   table, PNG, full screen, a note on a day), several lines on one chart, the collapsible "Részletek", phone
   notifications, the week's plan, every spike explained, and today per platform. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, Empty, TrendChart, chColor, fmt, useWidth, type Mark, type Pt } from "./charts";
import { Logo } from "./wow";
import { toast } from "./phone";
import { I, Layer, MOCK, P, PF, PushNone, ago, api, big, ch, lang, n, rpc, type D, type Tab } from "./shared";

/* ---------- a chart with its tools ---------- */
/* inline the computed look of every element, then draw the SVG on a canvas: a PNG that looks like the screen */
export function svgToPng(svg: SVGSVGElement, name: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll("*"), dst = clone.querySelectorAll("*");
  src.forEach((el, i) => { const cs = getComputedStyle(el); const t = dst[i] as SVGElement;
    ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-family", "font-weight"].forEach((k) => t.style.setProperty(k, cs.getPropertyValue(k))); });
  const w = svg.clientWidth || Number(svg.getAttribute("width")), h = svg.clientHeight || Number(svg.getAttribute("height"));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("width", String(w)); clone.setAttribute("height", String(h));
  const img = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2; const x = c.getContext("2d")!;
    x.fillStyle = getComputedStyle(document.querySelector(".adm") || document.body).getPropertyValue("--a-s1") || "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.scale(2, 2); x.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${name}-${new Date().toISOString().slice(0, 10)}.png`; a.click();
  };
  img.src = url;
}

export function ChartBox({ data, label, height = 260, hourly, marks, goal, unit, color, name = "grafikon", onNote }: { data: Pt[]; label: string; height?: number; hourly?: boolean; marks?: Mark[]; goal?: number; unit?: string; color?: string; name?: string; onNote?: () => void }) {
  const [bars, setBars] = useState(false); const [fc, setFc] = useState(false); const [tbl, setTbl] = useState(false); const [full, setFull] = useState(false); const [note, setNote] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const sb = useMemo(() => supabaseBrowser(), []);
  const pick = async (t: string) => {
    if (!note) return;
    const day = t.slice(0, 10), text = prompt(`Jegyzet ${new Date(t).toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}-hez (pl. „új videó”, „Google-frissítés”):`);
    setNote(false);
    if (!text?.trim()) return;
    await rpc(sb, "admin_note_save", { p_day: day, p_kind: "egyeb", p_text: text.trim().slice(0, 200) }); toast("Jegyzet a grafikonra"); onNote?.();
  };
  const tools = (
    <div className="cbx-t" role="toolbar" aria-label="Grafikon">
      <div className="adm-seg sm"><button aria-pressed={!bars} onClick={() => setBars(false)}>Vonal</button><button aria-pressed={bars} onClick={() => setBars(true)}>Oszlop</button></div>
      {!hourly && <button className={"cbx-b" + (fc ? " on" : "")} onClick={() => setFc(!fc)} title="A következő 14 nap, ha így megy tovább">{I(P.traffic)}<span>Előrejelzés</span></button>}
      <button className={"cbx-b" + (tbl ? " on" : "")} onClick={() => setTbl(!tbl)}>{I(P.menu)}<span>Táblázat</span></button>
      {onNote !== undefined && !hourly && <button className={"cbx-b" + (note ? " on" : "")} onClick={() => { setNote(!note); if (!note) toast("Kattints a grafikonon egy napra"); }}>{I(P.pen)}<span>Jegyzet</span></button>}
      <button className="cbx-b" onClick={() => { const s = box.current?.querySelector("svg"); if (s) svgToPng(s as SVGSVGElement, name); }}>{I(P.share)}<span>PNG</span></button>
      <button className="cbx-b" onClick={() => setFull(true)} aria-label="Teljes képernyő">{I(P.eye)}<span>Nagyban</span></button>
    </div>
  );
  const chart = (h: number) => <TrendChart data={data} label={label} height={h} hourly={hourly} marks={marks} goal={goal} unit={unit} color={color} bars={bars} forecast={fc ? 14 : 0} onPick={note ? pick : undefined} />;
  return (
    <div className="cbx" ref={box}>
      {tools}
      {tbl ? <div className="tw cbx-tbl"><table className="tb"><thead><tr><th>Nap</th><th className="num">{label}</th>{data.some((d) => d.p != null) && <th className="num">Előző időszak</th>}</tr></thead>
        <tbody>{[...data].reverse().map((d) => <tr key={d.t}><td>{new Date(d.t).toLocaleString("hu-HU", hourly ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric", weekday: "short" })}</td><td className="num"><b>{fmt(d.v)}</b></td>{data.some((x) => x.p != null) && <td className="num">{fmt(d.p)}</td>}</tr>)}</tbody></table></div> : chart(height)}
      {full && <Layer><div className="scrim" onClick={() => setFull(false)} /><div className="cbx-full" role="dialog" aria-label={label}>
        <div className="c-h"><div><div><h2>{label}</h2></div></div><button className="adm-ibtn" onClick={() => setFull(false)}>Bezárás</button></div>
        {tools}{chart(Math.max(320, Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.62)))}
      </div></Layer>}
    </div>
  );
}

/* ---------- several lines on one chart (followers per platform, the total in gold) ---------- */
export function MultiLine({ series, height = 240, total }: { series: { k: string; l: string; pts: { t: string; v: number }[]; color?: string }[]; height?: number; total?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const days = Array.from(new Set(series.flatMap((s) => s.pts.map((p) => p.t.slice(0, 10))))).sort();
  if (!days.length) return <Empty t="Még nincs adat." />;
  const val = (s: { pts: { t: string; v: number }[] }, d: string) => { let v: number | null = null; for (const p of s.pts) if (p.t.slice(0, 10) <= d) v = p.v; return v; };
  const all = total ? [...series, { k: "_t", l: "Összesen", color: "var(--a-gold)", pts: days.map((d) => ({ t: d, v: series.reduce((a, s) => a + (val(s, d) || 0), 0) })) }] : series;
  const max = Math.max(1, ...all.flatMap((s) => s.pts.map((p) => p.v)));
  const padL = 44, padR = 10, padT = 12, padB = 24, iw = Math.max(10, w - padL - padR), ih = height - padT - padB;
  const x = (i: number) => padL + (days.length <= 1 ? iw / 2 : (i / (days.length - 1)) * iw), y = (v: number) => padT + ih - (v / max) * ih;
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && <svg width={w} height={height} onPointerMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); setHi(Math.max(0, Math.min(days.length - 1, Math.round(((e.clientX - r.left - padL) / iw) * (days.length - 1))))); }} onPointerLeave={() => setHi(null)}>
        {[0, 0.5, 1].map((f) => <g key={f}><line className="gl" x1={padL} x2={padL + iw} y1={y(max * f)} y2={y(max * f)} /><text className="ax" x={padL - 8} y={y(max * f) + 4} textAnchor="end">{big(max * f)}</text></g>)}
        {[0, days.length - 1].map((i) => <text key={i} className="ax" x={x(i)} y={height - 6} textAnchor={i ? "end" : "start"}>{new Date(days[i]).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}</text>)}
        {all.map((s) => { const pts = days.map((d, i) => [i, val(s, d)] as const).filter(([, v]) => v != null) as [number, number][];
          return <path key={s.k} d={pts.map(([i, v], j) => `${j ? "L" : "M"}${x(i)} ${y(v)}`).join("")} style={{ stroke: s.color || chColor(s.k), fill: "none", strokeWidth: s.k === "_t" ? 2.6 : 2 }} />; })}
        {hi != null && <line className="xh" x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + ih} />}
      </svg>}
      {hi != null && <div className="tip" style={{ left: Math.min(Math.max(x(hi), 90), w - 90), top: 20 }}><b>{new Date(days[hi]).toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}</b>
        {all.map((s) => <div key={s.k} className="r"><span><i style={{ background: s.color || chColor(s.k) }} />{s.l}</span><em>{fmt(val(s, days[hi]))}</em></div>)}</div>}
      <div className="legend">{all.map((s) => <span key={s.k}><i className="sq" style={{ background: s.color || chColor(s.k) }} />{s.l}</span>)}</div>
    </div>
  );
}

/* ---------- fewer, stronger cards: the rest waits under "Részletek" ---------- */
export function More({ children, label = "Részletek" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="s12 more-b" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Kevesebb" : label}{I(P.down)}</button>
      {open && children}
    </>
  );
}

/* ---------- phone notifications ---------- */
const b64u = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
export function usePush() {
  const [st, setSt] = useState<"na" | "off" | "on" | "denied" | "busy">("na");
  const check = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setSt("na"); return; }
    if (Notification.permission === "denied") { setSt("denied"); return; }
    const reg = await navigator.serviceWorker.getRegistration("/admin");
    setSt((await reg?.pushManager.getSubscription()) ? "on" : "off");
  }, []);
  useEffect(() => { check(); }, [check]);
  const on = async () => {
    if (MOCK) { setSt("on"); toast("Értesítések bekapcsolva (minta)"); return; }
    if (st === "busy") return;
    /* an iPhone opens notifications only from the home-screen app (Safari's tab has none) */
    if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) { setSt("na"); toast("Ez a böngésző nem tud értesítést fogadni. iPhone-on: Megosztás → Főképernyőhöz adás, és onnan nyisd meg."); return; }
    setSt("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setSt("denied"); return; }
      const reg = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }); await navigator.serviceWorker.ready;
      const k = await api("/api/admin/push"); if (!k.ok || !k.json?.key) throw new Error(k.json?.error || "Nincs kulcs.");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.json.key) });
      const r = await api("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), ua: navigator.userAgent }) });
      if (!r.ok) throw new Error(r.json?.error || "Nem sikerült menteni.");
      setSt("on"); toast("Értesítések bekapcsolva ezen az eszközön");
    } catch (e) { const m = String((e as Error)?.message || e); toast(/ReferenceError|not defined|NotAllowed|AbortError/i.test(m) ? "Nem sikerült bekapcsolni az értesítéseket ezen az eszközön." : m); check(); }
  };
  const off = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/admin"), sub = await reg?.pushManager.getSubscription();
    if (sub) { await api("/api/admin/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setSt("off"); toast("Értesítések kikapcsolva ezen az eszközön");
  };
  const test = async () => { const r = await api("/api/admin/push?test=1", { method: "POST" }); toast(r.ok ? `Próba elküldve (${r.json?.sent ?? 0} eszköz)` : "Nem sikerült."); };
  return { st, on, off, test };
}
export function PushCard() {
  const p = usePush();
  const sb = useMemo(() => supabaseBrowser(), []);
  const [s, setS] = useState<D | null>(null);
  useEffect(() => { rpc(sb, "admin_push_status").then(({ data }) => setS(data || null)); }, [sb, p.st]);
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent) && !(navigator as any).standalone;
  return (
    <div className="push-c">
      <div className="push-h"><span className={"chip " + (p.st === "on" ? "good" : p.st === "denied" ? "bad" : "")}>{p.st === "on" ? "✓ ezen az eszközön be" : p.st === "denied" ? "a böngésző tiltja" : p.st === "na" ? "ez a böngésző nem tud értesíteni" : "ezen az eszközön ki"}</span><span className="note">{s && !n(s.devices) ? <b className="down">0 eszköz: senki nem kap értesítést</b> : `${fmt(s?.devices)} eszköz kap értesítést`}</span></div>
      <p className="note">Robbanó poszt, új komment és értékelés, rekordnap, hibahullám, hibás kapcsolat, Google-ből kiesett oldal: mindegyikről egyszer szól.{ios ? " iPhone-on előbb tedd a főképernyőre (Megosztás → Főképernyőhöz adás), és onnan nyisd meg." : ""}</p>
      <div className="adm-row">
        {p.st === "on" ? <><button className="adm-ibtn" onClick={p.test}>{I(P.bell)}Próba</button><button className="adm-ibtn" onClick={p.off}>Kikapcsolás</button></>
          : <button className="adm-ibtn gold" onClick={p.on} disabled={p.st === "na" || p.st === "busy"}>{I(P.bell)}{p.st === "busy" ? "Bekapcsolás…" : "Értesítések bekapcsolása"}</button>}
      </div>
      {(s?.sent || []).length > 0 && <ul className="push-l">{(s!.sent as D[]).slice(0, 6).map((x, i) => <li key={i}><b>{x.title} <PushNone x={x} /></b><span>{x.body}</span><time>{ago(x.at)}</time></li>)}</ul>}
    </div>
  );
}

/* ---------- the week's plan: three steps, ticked off, measured against the same days of last week ---------- */
const WM: Record<string, string> = { sessions: "látogatás", scored: "előnézet", signups: "regisztráció", shared: "megosztás" };
export function WeekPlan({ go }: { go?: (t: Tab) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [d, setD] = useState<D | null>(null); const [busy, setBusy] = useState(false); const [ed, setEd] = useState<D[] | null>(null);
  const load = useCallback(() => rpc(sb, "admin_week_plan").then(({ data }) => setD(data || null)), [sb]);
  useEffect(() => { load(); }, [load]);
  const items: D[] = d?.items || [];
  const save = async (it: D[]) => { setD((o) => (o ? { ...o, items: it } : o)); const r = await rpc(sb, "admin_week_plan_save", { p_items: it }); if (r.error) toast(r.error.message); };
  /* force: a new plan replaces this week's (asked first: the ticks go with it) */
  const make = async (force = false) => {
    if (force && !confirm("Új heti terv a mostani helyett? A pipák elvesznek.")) return;
    setBusy(true); const r = await api("/api/admin/digest?plan=1" + (force ? "&force=1" : ""), { method: "POST" }); setBusy(false);
    if (!r.ok) toast(r.json?.error || "Nem sikerült."); else toast(force ? "Új terv kész" : "Kész"); load();
  };
  const done = items.filter((x) => x.done).length;
  const last: D | null = d?.last || null, lastItems: D[] = last?.items || [];
  if (ed) return (
    <div className="wplan">
      <ul className="wp-ed">{ed.map((x, i) => (
        <li key={i}><input className="adm-in" value={x.t || ""} maxLength={200} onChange={(e) => setEd(ed.map((y, j) => (j === i ? { ...y, t: e.target.value } : y)))} placeholder="a lépés" />
          <select className="adm-in sm" value={x.metric || ""} onChange={(e) => setEd(ed.map((y, j) => (j === i ? { ...y, metric: e.target.value || undefined } : y)))} aria-label="Mit mér"><option value="">nem mér</option>{Object.entries(WM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="adm-ibtn sm" onClick={() => setEd(ed.filter((_, j) => j !== i))} aria-label="Törlés">✕</button></li>))}</ul>
      <div className="adm-row">{ed.length < 6 && <button className="adm-ibtn sm" onClick={() => setEd([...ed, { t: "", done: false }])}>{I(P.plus)}Új lépés</button>}<span style={{ flex: 1 }} />
        <button className="adm-ibtn sm" onClick={() => setEd(null)}>Mégse</button><button className="adm-ibtn gold sm" onClick={() => { save(ed.filter((x) => String(x.t || "").trim())); setEd(null); toast("Mentve"); }}>Mentés</button></div>
    </div>
  );
  return (
    <div className="wplan">
      {!d ? <div className="skel" style={{ height: 120 }} /> : !items.length ? <Empty t="Hétfő reggel magától elkészül a múlt hét számaiból; vagy kérd most, vagy írd meg magad." icon={P.target}>
          <div className="adm-row"><button className="adm-ibtn gold" onClick={() => make()} disabled={busy}>{busy ? "Készül…" : "Heti terv most"}</button><button className="adm-ibtn" onClick={() => setEd([{ t: "", done: false }])}>Saját terv</button></div></Empty> : <>
        <div className="wp-top"><b>{done} / {items.length} kész</b><span className="note">a hét: {new Date(d.week).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} –</span></div>
        <ul>{items.map((x, i) => { const m = x.metric, nowV = n(d.now?.[m]), base = n(d.base?.[m]);
          return (
            <li key={i} className={x.done ? "done" : ""}>
              <button className="wp-ck" aria-pressed={!!x.done} onClick={() => save(items.map((y, j) => (j === i ? { ...y, done: !y.done } : y)))}>{x.done ? "✓" : ""}</button>
              {/* this week so far against the same days and hours of last week (a half week against a whole one was always "down") */}
              <div><b>{x.t}</b>{x.why && <small>{x.why}</small>}{m && WM[m] && <span className="wp-m">{WM[m]} a héten eddig: <b>{fmt(nowV)}</b> <Delta now={nowV} prev={base} /> <em>múlt héten ugyaneddig {fmt(base)} · egész héten {fmt(d.base_full?.[m])}</em></span>}</div>
            </li>); })}</ul>
        <div className="adm-row wp-tools"><button className="lnk" onClick={() => setEd(items.map((x) => ({ ...x })))}>Szerkesztés</button><button className="lnk" onClick={() => make(true)} disabled={busy}>{busy ? "Készül…" : "Újratervezés"}</button>{go && <button className="lnk" onClick={() => go("planner")}>A Tervezőbe →</button>}</div>
      </>}
      {/* last week's plan, and what its numbers did */}
      {lastItems.length > 0 && <details className="wp-last"><summary>Múlt heti terv: {lastItems.filter((x) => x.done).length} / {lastItems.length} kész</summary>
        <ul>{lastItems.map((x, i) => { const m = x.metric, a = n(last?.now?.[m]), b = n(last?.base?.[m]);
          return <li key={i} className={x.done ? "done" : ""}><span className="wp-ck" aria-hidden="true">{x.done ? "✓" : ""}</span><div><b>{x.t}</b>{m && WM[m] && <span className="wp-m">{WM[m]}: <b>{fmt(a)}</b> <Delta now={a} prev={b} /> <em>előtte {fmt(b)}</em></span>}</div></li>; })}</ul>
      </details>}
    </div>
  );
}

/* ---------- every spike explained: which channel, language and post brought the extra visitors; the drops too ---------- */
export function Spikes({ days = 90, onMarks }: { days?: number; onMarks?: (m: Mark[]) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [s, setS] = useState<D[] | null>(null); const [all, setAll] = useState(false); const [kind, setKind] = useState<"all" | "up" | "down">("all");
  /* "Miért?": the AI reads the day (its channels, languages, posts, notes and the usual level) and says the likely cause */
  const [why, setWhy] = useState<Record<string, string>>({});
  const ask = async (x: D) => { const k = x.day + (x.kind || ""); setWhy((o) => ({ ...o, [k]: "…" }));
    const r = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "why", data: { nap: x.day, tipus: x.kind === "down" ? "visszaesés" : "kiugrás", latogatas: x.sessions, szokasos: x.base, csatornak: x.chans, nyelvek: x.langs, posztok: x.posts, jegyzetek: x.notes } }) });
    setWhy((o) => ({ ...o, [k]: r.ok && r.json?.text ? r.json.text : r.json?.error || "Nem sikerült." })); };
  useEffect(() => { rpc(sb, "admin_spikes", { p_days: days || 90 }).then(({ data }) => { const l = Array.isArray(data) ? data : []; setS(l); onMarks?.(l.map((x: D) => ({ t: x.day + "T12:00:00", label: (x.kind === "down" ? "Visszaesés: " : "") + explain(x), color: x.kind === "down" ? "#8A8F98" : "#E5484D" }))); }); }, [sb, days]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="skel" style={{ height: 90 }} />;
  if (!s.length) return <Empty t="Nem volt kiugró nap (1,6-szor annyi látogató, mint az előző két hét átlaga), és visszaesés sem (feleannyi sem)." icon={P.traffic} />;
  const list = s.filter((x) => kind === "all" || (x.kind || "up") === kind), shown = all ? list : list.slice(0, 6), downs = s.filter((x) => x.kind === "down").length;
  return <>
    {downs > 0 && <div className="adm-seg sm" role="group"><button aria-pressed={kind === "all"} onClick={() => setKind("all")}>Mind · {s.length}</button><button aria-pressed={kind === "up"} onClick={() => setKind("up")}>Kiugrás · {s.length - downs}</button><button aria-pressed={kind === "down"} onClick={() => setKind("down")}>Visszaesés · {downs}</button></div>}
    <ul className="spikes">{shown.map((x) => { const down = x.kind === "down", chg = ((n(x.sessions) - n(x.base)) / Math.max(1, n(x.base))) * 100;
      return (
        <li key={x.day + (x.kind || "")} className={down ? "down" : ""}><span className="sp-d">{new Date(x.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}</span>
          <div><b>{down ? "" : "+"}{fmt(chg)}% · {fmt(x.sessions)} látogatás <em className="sp-k">{down ? "visszaesés" : "kiugrás"}, a szokásos ~{fmt(x.base)} helyett</em></b><span>{explain(x)}</span>
            {why[x.day + (x.kind || "")] ? <p className="sp-why">{why[x.day + (x.kind || "")]}</p> : <button className="lnk sp-ask" onClick={() => ask(x)}>Miért? (MI) →</button>}</div></li>); })}</ul>
    {list.length > 6 && <button className="lnk" onClick={() => setAll(!all)}>{all ? "Kevesebb" : `Mind a ${list.length} nap →`}</button>}
  </>;
}
export const explain = (x: D) => {
  const c = (x.chans || []) as D[], l = (x.langs || []) as D[], p = (x.posts || []) as D[], nt = (x.notes || []) as string[], down = x.kind === "down";
  const parts = [c.length ? `${down ? "kevesebb" : "főleg"} ${c.map((y) => `${ch(y.k)} (${n(y.extra) > 0 ? "+" : ""}${fmt(y.extra)})`).join(", ")}` : "", l.length ? `${l.map((y) => lang(y.k).toLowerCase()).join(" és ")} nyelven` : "",
    p.length ? `előtte: ${PF[p[0].platform] || p[0].platform} „${String(p[0].title || "").slice(0, 40)}”` : "", nt.length ? `jegyzet: ${nt[0]}` : ""].filter(Boolean);
  return parts.join(" · ") || (down ? "egyik csatorna sem tűnik ki: általános csendes nap" : "a forrás ismeretlen (nincs rövid link vagy hivatkozó)");
};

/* ---------- today per platform: followers since the last count, views gained today, visitors; downloads and Google ---------- */
export function PlatformToday() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [d, setD] = useState<D[] | null>(null); const [m, setM] = useState<D | null>(null);
  useEffect(() => { rpc(sb, "admin_platform_today").then(({ data }) => setD(Array.isArray(data) ? data : [])); rpc(sb, "admin_today_more").then(({ data }) => setM(data || null)); }, [sb]);
  const t = new Date(), today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const dayL = (k?: string | null) => (!k ? "" : String(k).slice(0, 10) === today ? "ma" : new Date(k).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + "-n");
  const dl = m?.downloads, g = m?.gsc;
  if (!d?.length && !dl && !g) return null;
  return <section className="s12 ptoday">{(d || []).map((x) => { const df = n(x.followers) - n(x.followers_prev);
    return (
      <div key={x.platform} className="pt-i"><Logo k={x.platform} size={30} />
        {/* the follower change belongs to the day of the last count: "ma" only when today's count is in */}
        <div><b>{big(x.followers)}</b><small>követő {x.followers_prev != null && <span className={df >= 0 ? "up" : "down"}>{df >= 0 ? "+" : ""}{fmt(df)} {dayL(x.followers_day)}</span>}</small></div>
        {x.platform === "pinterest" ? <div><b>{x.impressions_today == null ? "–" : big(x.impressions_today)}</b><small>megjelenés ma</small></div>
          : <div><b>{x.synced_today === false ? "–" : big(x.views_today)}</b><small>{x.synced_today === false ? "ma még nem frissült" : "új megtekintés ma"}</small></div>}
        <div><b>{fmt(x.visits_today)}</b><small>látogató ma</small></div></div>); })}
    {dl && <div className="pt-i"><Logo k="apple" size={30} /><div><b>{fmt(n(dl.apple) + n(dl.google))}</b><small>letöltés {dayL(dl.day)}</small></div><div><b>{fmt(dl.apple)}</b><small>App Store</small></div><div><b>{fmt(dl.google)}</b><small>Google Play · előző nap {fmt(dl.prev)}</small></div></div>}
    {g && <div className="pt-i"><Logo k="google" size={30} /><div><b>{fmt(g.clicks)}</b><small>Google-kattintás {dayL(g.day)}</small></div><div><b>{big(g.impressions)}</b><small>megjelenés</small></div><div><b>{fmt(g.prev)}</b><small title="A Google 2–3 nap késéssel adja az adatot">előtte való nap</small></div></div>}
  </section>;
}

/* ---------- a story image for a short link: 1080 × 1920, the QR code and the link, to post as an Instagram story ---------- */
export function storyImage(code: string, note: string) {
  const qr = document.querySelector(`[data-qr="${code}"] svg`) as SVGSVGElement | null;
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, "#F7F3EA"); g.addColorStop(1, "#EDE4D3"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
  x.fillStyle = "#1A1714"; x.textAlign = "center"; x.font = "italic 600 120px 'Cormorant Garamond', serif"; x.fillText("InkAge", 540, 330);
  x.font = "500 52px Geist, sans-serif"; x.fillText(note || "Próbáld ki", 540, 470);
  const done = () => { x.font = "700 72px Geist, sans-serif"; x.fillText(`inkage.app/go/${code}`, 540, 1520); x.font = "400 40px Geist, sans-serif"; x.fillStyle = "#6E655A"; x.fillText("Így néz ki a tetoválásod 50 év múlva", 540, 1610);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `inkage-story-${code}.png`; a.click(); };
  if (!qr) return done();
  const img = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(qr)], { type: "image/svg+xml" }));
  img.onload = () => { x.fillStyle = "#fff"; x.beginPath(); x.roundRect(240, 600, 600, 600, 48); x.fill(); x.drawImage(img, 290, 650, 500, 500); URL.revokeObjectURL(url); done(); };
  img.onerror = done; img.src = url;
}
