"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* The admin's own pieces: black and white only, carried by size, contrast, pattern and movement.
   Giant: a figure as wide as its box. Ring: four patterns instead of colours. Chg: a change in a pill (full = up, outline = down).
   Hero: a page's one main figure. DayStrip: the week as rings. Mono: an account as its capital. Sig: a stored preview image. */
import { daysSun } from "./i18n";
import { useEffect, useState } from "react";
import { CountUp, fmt } from "./charts";
import { rpc, n, type D } from "./shared";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSigUrls } from "./views/people";

/* ---------- a figure that fills the width of its box, never wider ---------- */
export function Giant({ v, d = 0, unit, text, max }: { v?: number | null; d?: number; unit?: string; text?: string; max?: number }) {
  const shown = text ?? (v == null ? "–" : fmt(v, d)) + (unit || "");
  return <span className="ink-giant" data-final={shown} style={{ ["--n" as string]: Math.max(1, [...shown].length + (shown.includes("%") ? 0.8 : 0)), ...(max ? { ["--max" as string]: `${max}px` } : {}) }}><b>{text != null || v == null ? shown : <><CountUp v={v} d={d} />{unit}</>}</b></span>;
}

/* ---------- rings: the pattern tells them apart, never a colour ---------- */
export type RingKind = "solid" | "tick" | "dots" | "seg";
const pos = (i: number, c: number, r: number) => { const a = (i / c) * 2 * Math.PI - Math.PI / 2; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const; };
export function Ring({ p, kind = "solid", size, children, label }: { p: number; kind?: RingKind; size?: number; children?: React.ReactNode; label?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
  const count = kind === "tick" ? 60 : kind === "dots" ? 36 : 24, on = Math.round(v * count);
  return (
    <span className={"ink-ring k-" + kind} style={size ? { width: size, height: size } : undefined} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {kind === "solid" && <><circle className="tr" cx="50" cy="50" r="44" /><circle className="ar" cx="50" cy="50" r="44" pathLength={100} style={{ strokeDasharray: `${v * 100} 100` }} transform="rotate(-90 50 50)" /></>}
        {kind === "tick" && Array.from({ length: count }, (_, i) => { const [x1, y1] = pos(i, count, 47), [x2, y2] = pos(i, count, 39); return <line key={i} className={i < on ? "on" : ""} style={{ animationDelay: `${i * 12}ms` }} x1={x1} y1={y1} x2={x2} y2={y2} />; })}
        {kind === "dots" && Array.from({ length: count }, (_, i) => { const [x, y] = pos(i, count, 44); return <circle key={i} className={i < on ? "on" : ""} style={{ animationDelay: `${i * 18}ms` }} cx={x} cy={y} r="3" />; })}
        {kind === "seg" && Array.from({ length: count }, (_, i) => { const [x1, y1] = pos(i + 0.14, count, 44), [x2, y2] = pos(i + 0.86, count, 44); return <path key={i} className={i < on ? "on" : ""} style={{ animationDelay: `${i * 26}ms` }} d={`M${x1} ${y1} A44 44 0 0 1 ${x2} ${y2}`} />; })}
      </svg>
      {children != null && <span className="ink-ring-c">{children}</span>}
    </span>
  );
}

/* ---------- a change: full pill up, outlined pill down ---------- */
export function Chg({ a, b, tail, unit }: { a: number; b: number; tail?: string; unit?: string }) {
  const up = a > b, same = a === b;
  return <span className={"ink-chg " + (same ? "same" : up ? "up" : "down")}>{same ? "=" : up ? "↑" : "↓"} {same ? "ugyanannyi" : `${fmt(Math.abs(a - b))}${unit || ""}`}{tail ? <small>{tail}</small> : null}</span>;
}

/* ---------- a page's one main figure ---------- */
export function Hero({ label, v, d, unit, text, chg, sub, flip, side, onClick, max }: { max?: number; label: React.ReactNode; v?: number | null; d?: number; unit?: string; text?: string; chg?: React.ReactNode; sub?: React.ReactNode; flip?: boolean; side?: React.ReactNode; onClick?: () => void }) {
  const body = <><span className="ink-hero-l">{label}</span><Giant v={v} d={d} unit={unit} text={text} max={max} />{(chg || sub) && <span className="ink-hero-s">{chg}{sub && <small>{sub}</small>}</span>}{side && <span className="ink-hero-side">{side}</span>}</>;
  const c = "ink-hero" + (flip ? " ink-flip" : "");
  return onClick ? <button type="button" className={c} onClick={onClick}>{body}</button> : <section className={c}>{body}</section>;
}

/* ---------- three small figures in a row ---------- */
export function Trio({ items }: { items: { l: string; v: React.ReactNode; run?: () => void }[] }) {
  const val = (v: React.ReactNode) => (typeof v === "number" ? <CountUp v={v} /> : v);
  return <div className="ink-trio">{items.map((x) => x.run ? <button key={x.l} type="button" onClick={x.run}><b>{val(x.v)}</b><small>{x.l}</small></button> : <div key={x.l}><b>{val(x.v)}</b><small>{x.l}</small></div>)}</div>;
}

/* ---------- the week as rings; a tap picks the day ---------- */
const WD = daysSun();
export function DayStrip({ days, sel, pick, label = "Az elmúlt hét nap" }: { days: { t: string; v: number }[]; sel: string; pick: (t: string) => void; label?: string }) {
  const top = Math.max(1, ...days.map((x) => x.v));
  return <div className="ink-days" role="group" aria-label={label}>{days.map((x) => { const dt = new Date(x.t + "T12:00:00"); return (
    <button key={x.t} type="button" aria-pressed={x.t === sel} onClick={() => pick(x.t)} aria-label={`${dt.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}: ${fmt(x.v)}`}>
      <small>{WD[dt.getDay()]}</small><Ring p={x.v / top} kind="seg"><b>{dt.getDate()}</b></Ring>
    </button>); })}</div>;
}

/* ---------- an account as its capital, with a count in the corner ---------- */
export function Mono({ name, badge, size = 48 }: { name?: string | null; badge?: React.ReactNode; size?: number }) {
  const ch = (String(name || "?").trim()[0] || "?").toLocaleUpperCase("hu-HU");
  return <span className="ink-mono" style={{ width: size, height: size, fontSize: size * 0.46 }}>{ch}{badge != null && badge !== 0 && <i>{badge}</i>}</span>;
}

/* ---------- a line of pen that writes itself: drawn for the admin, nobody's real signature ---------- */
export function SigLine({ className }: { className?: string }) {
  return <svg className={"ink-line " + (className || "")} viewBox="0 0 800 300" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <path pathLength={1} d="M28 214 C62 120 112 28 150 44 C186 60 118 214 104 250 C152 170 196 128 226 136 C252 144 214 206 242 208 C276 210 300 130 326 136 C348 142 316 206 344 206 C384 206 420 112 452 118 C476 124 442 204 470 206 C514 208 548 96 590 104 C626 112 560 232 610 222 C664 210 712 150 776 112" />
    <path pathLength={1} className="b" d="M72 262 C240 226 520 214 742 238" />
  </svg>;
}

/* ---------- a stored signature as white ink on black (black on white by day) ---------- */
export const Sig = ({ u, alt, onClick }: { u: string; alt: string; onClick?: () => void }) => {
  const img = u ? <img src={u} alt={alt} loading="lazy" referrerPolicy="no-referrer" /> : <i className="skel" aria-hidden="true" />;
  return onClick ? <button type="button" className="ink-sig" onClick={onClick}>{img}</button> : <span className="ink-sig">{img}</span>;
};

/* the newest finished previews across accounts (admin_people_sigs: InkAge serves its saved previews under the same name) */
export function useRecentSigs(limit: number) {
  const [rows, setRows] = useState<D[] | null>(null);
  useEffect(() => {
    let live = true; const sb = supabaseBrowser();
    (async () => {
      const p = await rpc(sb, "admin_people", { p_q: "", p_limit: 30, p_offset: 0, p_filter: "all" });
      const ppl: D[] = ((p.data as D)?.rows || (p.data as D)?.people || []) as D[];
      if (!ppl.length) { if (live) setRows([]); return; }
      const s = await rpc(sb, "admin_people_sigs", { p_ids: ppl.map((x) => x.id), p_each: 1 });
      const out: D[] = (Array.isArray(s.data) ? (s.data as D[]) : []).flatMap((r) => { const who = ppl.find((x) => x.id === r.id); return ((r.sigs || []) as D[]).map((x) => ({ ...x, uid: r.id, who })); });
      /* newest first, across the accounts asked (these are the 30 accounts the list starts with) */
      out.sort((a, b) => String(b.at || b.created_at || "").localeCompare(String(a.at || a.created_at || "")));
      if (live) setRows(out.slice(0, limit));
    })().catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [limit]);
  return rows;
}
export function SigWall({ limit = 6, open }: { limit?: number; open?: (uid: string) => void }) {
  const rows = useRecentSigs(limit);
  const url = useSigUrls((rows || []).map((x) => String(x.path)));
  if (rows && !rows.length) return null;
  return <section className="ink-wall" aria-label="A legutóbbi előnézetek">
    <h3 className="ink-h">Legutóbbi előnézetek</h3>
    {!rows ? <div className="skel" style={{ height: 180, borderRadius: 26 }} /> : <div className="ink-wall-g">{rows.map((x, i) => <Sig key={String(x.path) + i} u={url(String(x.path))} alt="Elkészült előnézet" onClick={open ? () => open(String(x.uid)) : undefined} />)}</div>}
  </section>;
}

/* the same number helper for every page that compares with the best recent day */
export const bestOf = (a: number[]) => Math.max(1, ...a.map((x) => n(x)));
