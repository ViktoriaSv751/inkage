"use client";
/* The reach pages' small pieces on the ink system: a thick curve in the card's own ink, a row of pills,
   and a rounded row with an icon on the left and two lines of value on the right. */
import { useRef, useState } from "react";
import { fmt, useWidth } from "../charts";

/* a date inside a sentence: "okt. 30" (no closing dot); the article follows the month, the ending the day's last sound */
const dayOf = (x: string | number | Date) => new Date(typeof x === "string" && x.length === 10 ? x + "T12:00:00" : x);
export const dayHu = (x: string | number | Date) => dayOf(x).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }).replace(/\.$/, "");
const azA = (s: string) => (/^[aáeéiíoóöőuúüű]/i.test(s) ? "az " : "a ") + s;
/* "okt. 30-i" and with its article "az okt. 30-i" */
export const dayI = (x: string | number | Date) => `${dayHu(x)}-i`;
export const azDayI = (x: string | number | Date) => azA(dayI(x));
/* "okt. 7-től", "okt. 30-tól" */
export const dayTol = (x: string | number | Date) => { const v = dayHu(x), d = Number(v.match(/(\d+)$/)?.[1] || 0); return `${v}-${[3, 6, 8, 20, 30].includes(d) || [3, 6, 8].includes(d % 10) ? "tól" : "től"}`; };

/* a smooth line with a fade under it, in the colour of the card it sits on (it works on an inverted card too) */
export function Curve({ values, h = 110, label }: { values: number[]; h?: number; label?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const id = useRef("c" + Math.random().toString(36).slice(2, 8)).current;
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(0, ...values), span = max - min || 1, pad = 6;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, pad + (1 - (v - min) / span) * (h - pad * 2)] as const);
  const d = pts.reduce((a, [x, y], i) => { if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`; const [px, py] = pts[i - 1], mx = ((px + x) / 2).toFixed(1); return `${a}C${mx} ${py.toFixed(1)} ${mx} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; }, "");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <div className="ir-curve" ref={ref} style={{ height: h }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {w > 0 && <svg width={w} height={h}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".26" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path d={`${d}L${w} ${h}L0 ${h}Z`} fill={`url(#${id})`} />
        <path className="ir-curve-l" pathLength={1} d={d} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={Math.min(lx, w - 5)} cy={ly} r="5" fill="currentColor" />
      </svg>}
    </div>
  );
}

/* a row of round choices */
export function Pills<K extends string | number>({ items, cur, pick, label }: { items: readonly (readonly [K, string])[]; cur: K | null; pick: (k: K) => void; label?: string }) {
  return <div className="ir-pills" role="group" aria-label={label}>{items.map(([k, l]) => <button key={String(k)} type="button" aria-pressed={cur === k} onClick={() => pick(k)}>{l}</button>)}</div>;
}

/* a rounded row: icon or logo, a title with one line under it, two right-aligned lines of value */
export function IRow({ ico, t, sub, a, b, onClick, href, children }: { ico?: React.ReactNode; t: React.ReactNode; sub?: React.ReactNode; a?: React.ReactNode; b?: React.ReactNode; onClick?: () => void; href?: string; children?: React.ReactNode }) {
  const body = <>{ico != null && <span className="ir-ico">{ico}</span>}<span className="ir-m"><b>{t}</b>{sub != null && <small>{sub}</small>}{children}</span>{(a != null || b != null) && <span className="ir-v">{a != null && <b>{a}</b>}{b != null && <small>{b}</small>}</span>}</>;
  if (href) return <a className="ir-row" href={href} target="_blank" rel="noreferrer">{body}</a>;
  return onClick ? <button type="button" className="ir-row" onClick={onClick}>{body}</button> : <div className="ir-row">{body}</div>;
}

/* a dense table as designed rows: title and line under it, every other column as a small figure, the main one large on the right.
   The table itself stays one tap away (Sorok / Táblázat), with its sorting and its CSV */
export type SRow<T> = { key: (r: T) => string; t: (r: T) => React.ReactNode; sub?: (r: T) => React.ReactNode; big: (r: T) => React.ReactNode; bigL?: (r: T) => React.ReactNode; stats?: (r: T) => [string, React.ReactNode][]; acts?: (r: T) => React.ReactNode; on?: (r: T) => boolean };
export function StatRows<T>({ rows, def, onRow, empty, step = 30 }: { rows: T[]; def: SRow<T>; onRow?: (r: T) => void; empty?: React.ReactNode; step?: number }) {
  const [shown, setShown] = useState(step);
  if (!rows.length) return <>{empty}</>;
  return <>
    <ul className="ir-sr">{rows.slice(0, shown).map((r) => { const body = <>
      <span className="ir-sr-m"><b>{def.t(r)}</b>{def.sub && <small>{def.sub(r)}</small>}</span>
      {def.stats && <span className="ir-sr-s">{def.stats(r).map(([l, v]) => <span key={l}><b>{v}</b><small>{l}</small></span>)}</span>}
      <span className="ir-sr-v"><b>{def.big(r)}</b>{def.bigL && <small>{def.bigL(r)}</small>}</span></>;
      return <li key={def.key(r)} className={def.on?.(r) ? "on" : undefined}>{onRow ? <button type="button" className="ir-sr-b" onClick={() => onRow(r)}>{body}</button> : <div className="ir-sr-b">{body}</div>}{def.acts && <div className="ir-sr-a">{def.acts(r)}</div>}</li>; })}</ul>
    {rows.length > shown && <button type="button" className="ir-more" onClick={() => setShown(shown + step)}>Még {fmt(Math.min(step, rows.length - shown))} ({fmt(rows.length - shown)} van még)</button>}
  </>;
}
export const LAY = [["rows", "Sorok"], ["tbl", "Táblázat"]] as const;

/* a Google place as a large figure: lower is better, so it carries no colour and no bar */
export const BigPos = ({ p, unit = "hely" }: { p?: number | null; unit?: string }) => <span className="ir-pos"><b>{p ? fmt(p, 1) : "–"}</b><small>{p ? unit : "nincs adat"}</small></span>;

/* how far along: a stripe of cells, filled against a real total */
export function Stripe({ a, of, cells = 20, label }: { a: number; of: number; cells?: number; label?: string }) {
  const c = Math.min(cells, Math.max(1, of)), on = of > 0 ? Math.round((Math.min(a, of) / of) * c) : 0;
  return <span className="ir-stripe" role={label ? "img" : undefined} aria-label={label}>{Array.from({ length: c }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</span>;
}

/* five stars filled to the real average */
export const Stars = ({ v, size = 22 }: { v: number; size?: number }) => <span className="ir-stars" style={{ fontSize: size }} role="img" aria-label={`${fmt(v, 1)} csillag az 5-ből`}><span>★★★★★</span><span className="on" style={{ width: `${Math.max(0, Math.min(5, v)) * 20}%` }}>★★★★★</span></span>;
