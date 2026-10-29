"use client";
/* Charts for the admin dashboard: plain SVG, one look everywhere. Thin marks, rounded data ends, recessive grid,
   a hover tooltip on every chart, and text in text colours (the series colour only ever marks the data). */
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || !Number.isFinite(n) ? "–" : n.toLocaleString("hu-HU", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const pct = (a: number, b: number, d = 1) => (b > 0 ? fmt((a / b) * 100, a / b < 0.1 ? d : 0) + "%" : "–");
/* 1 234 → "1,2 E", 1 200 000 → "1,2 M" (axis ticks and tight spots) */
export const compact = (n: number) => (Math.abs(n) >= 1e6 ? fmt(n / 1e6, 1) + " M" : Math.abs(n) >= 1e4 ? fmt(n / 1e3, 0) + " E" : Math.abs(n) >= 1e3 ? fmt(n / 1e3, 1) + " E" : fmt(n));

/* Categorical colours (dark steps, validated in this order): a channel keeps its colour on every chart */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767", "#0A66C2"];
export const OTHER = "#6E6E73";
const CH_ORDER = ["google", "instagram", "tiktok", "facebook", "pinterest", "youtube", "ai", "email", "linkedin"];
export const chColor = (k: string) => { const i = CH_ORDER.indexOf((k || "").toLowerCase()); return i >= 0 ? SERIES[i] : OTHER; };
export const GOLD = "#F3D58A";
/* the data accent (indigo in light mode, a lighter step in dark): from the admin.css tokens */
export const ACC = "var(--acc)";

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el); setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* round-number axis ticks */
function ticks(max: number, n = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = []; for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const dayLab = (t: string, hourly?: boolean) => { const d = new Date(t); return hourly ? d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" }); };
const dayLong = (t: string, hourly?: boolean) => { const d = new Date(t); return hourly ? d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("hu-HU", { weekday: "short", month: "long", day: "numeric" }); };
/* a column / bar with a 4px rounded data end and a square base */
const colPath = (x: number, w: number, base: number, h: number) => { const r = Math.min(4, w / 2, h); return h <= 0 ? "" : `M${x} ${base}V${base - h + r}Q${x} ${base - h} ${x + r} ${base - h}H${x + w - r}Q${x + w} ${base - h} ${x + w} ${base - h + r}V${base}Z`; };

/* partial: a day the period only partly covers (its first and last day, today so far) */
export type Pt = { t: string; v: number; p?: number; partial?: boolean };
export type Mark = { t: string; label: string; color?: string };

/* the next days if the recent trend holds: a straight line through the last four weeks, with the usual spread around it */
export function project(data: Pt[], days: number, hourly?: boolean) {
  /* the line goes through whole days only: half a day (today so far, a cut first day) would pull it down */
  const whole = data.filter((d) => !d.partial).length >= 7 ? data.filter((d) => !d.partial) : data;
  const k = Math.min(28, whole.length), base = whole.slice(-k), n0 = data.length - k;
  const mx = base.reduce((a, _, i) => a + i, 0) / k, my = base.reduce((a, d) => a + d.v, 0) / k;
  const sxx = base.reduce((a, _, i) => a + (i - mx) ** 2, 0) || 1, b = base.reduce((a, d, i) => a + (i - mx) * (d.v - my), 0) / sxx, a0 = my - b * mx;
  const sd = Math.sqrt(base.reduce((a, d, i) => a + (d.v - (a0 + b * i)) ** 2, 0) / Math.max(1, k - 2));
  const step = hourly ? 3600e3 : 864e5, t0 = new Date(data[data.length - 1].t).getTime();
  const skip = data.length - 1 - data.indexOf(base[base.length - 1]);
  return Array.from({ length: days }, (_, j) => { const v = Math.max(0, a0 + b * (k + skip + j)); return { t: new Date(t0 + (j + 1) * step).toISOString(), v, lo: Math.max(0, v - 1.28 * sd), hi: v + 1.28 * sd }; }).map((x) => ({ ...x, i: n0 }));
}

/** Area + line over time, the previous period dashed behind it, optional event marks (posts, releases) on the x-axis;
    optionally the next days projected (forecast), columns instead of a line (bars), and a click on a day (onPick). */
export function TrendChart({ data, height = 260, label, prevLabel = "Előző időszak", hourly, unit = "", color = ACC, marks = [], goal, forecast = 0, bars, onPick }:
  { data: Pt[]; height?: number; label: string; prevLabel?: string; hourly?: boolean; unit?: string; color?: string; marks?: Mark[]; goal?: number; forecast?: number; bars?: boolean; onPick?: (t: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const id = useRef("g" + Math.random().toString(36).slice(2, 8)).current;
  const padL = 40, padR = 10, padT = 14, padB = marks.length ? 34 : 26;
  const iw = Math.max(10, w - padL - padR), ih = height - padT - padB;
  const hasPrev = data.some((d) => d.p != null && d.p > 0);
  const fc = forecast > 0 && data.length >= 7 ? project(data, forecast, hourly) : [];
  const N = data.length + fc.length;
  const max = Math.max(1, goal || 0, ...data.map((d) => Math.max(d.v, hasPrev ? d.p || 0 : 0)), ...fc.map((f) => f.hi));
  const tk = ticks(max), top = tk[tk.length - 1];
  const x = (i: number) => padL + (N <= 1 ? iw / 2 : (i / (N - 1)) * iw);
  const y = (v: number) => padT + ih - (v / top) * ih;
  /* straight segments: small daily counts read truthfully (a smoothed curve invents values between the days) */
  const line = (k: "v" | "p") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y((d[k] as number) || 0).toFixed(1)}`).join("");
  const area = data.length ? `${line("v")}L${x(data.length - 1).toFixed(1)} ${padT + ih}L${x(0).toFixed(1)} ${padT + ih}Z` : "";
  const every = Math.max(1, Math.ceil(N / Math.max(2, Math.floor(iw / 74))));
  const axis = [...data.map((d) => d.t), ...fc.map((f) => f.t)];
  const bw = Math.max(2, Math.min(28, (iw / Math.max(1, N)) * 0.62));
  const idxOf = (t: string) => { const tt = new Date(t).getTime(); let best = -1, bd = Infinity; data.forEach((d, i) => { const dd = Math.abs(new Date(d.t).getTime() - tt); if (dd < bd) { bd = dd; best = i; } }); return bd < (hourly ? 3600e3 : 864e5) ? best : -1; };
  const mk = marks.map((m) => ({ ...m, i: idxOf(m.t) })).filter((m) => m.i >= 0);
  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = N <= 1 ? 0 : Math.round(((e.clientX - r.left - padL) / iw) * (N - 1));
    setHi(Math.max(0, Math.min(data.length - 1, i)));
  };
  const last = data.length - 1;
  const peak = data.reduce((b, d, i) => (d.v > (data[b]?.v ?? -1) ? i : b), -1);
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerMove={move} onPointerLeave={() => setHi(null)} role="img" aria-label={label} onClick={onPick ? () => { if (hi != null && data[hi]) onPick(data[hi].t); } : undefined} style={onPick ? { cursor: "copy" } : undefined}>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".26" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {tk.map((v) => (
            <g key={v}>
              <line className="gl" x1={padL} x2={padL + iw} y1={y(v)} y2={y(v)} />
              <text className="ax" x={padL - 10} y={y(v) + 4} textAnchor="end">{compact(v)}</text>
            </g>
          ))}
          {axis.map((t, i) => (i % every === 0 || i === N - 1) && (i === N - 1 || N - 1 - i >= every * 0.6) ? (
            <text key={t} className="ax" x={x(i)} y={padT + ih + 18} textAnchor={i === 0 ? "start" : i === N - 1 ? "end" : "middle"}>{dayLab(t, hourly)}</text>
          ) : null)}
          {hasPrev && <path className="ln2" d={line("p")} />}
          {!bars && <path d={area} fill={`url(#${id})`} />}
          {bars && data.map((d, i) => <path key={"b" + i} d={colPath(x(i) - bw / 2, bw, padT + ih, (d.v / top) * ih)} style={{ fill: color, opacity: hi == null || hi === i ? 0.9 : 0.45 }} />)}
          {fc.length > 0 && <g className="fc">
            <path d={`M${x(last)} ${y(data[last].v)}${fc.map((f, j) => `L${x(last + 1 + j)} ${y(f.hi)}`).join("")}${[...fc].reverse().map((f, j) => `L${x(last + fc.length - j)} ${y(f.lo)}`).join("")}L${x(last)} ${y(data[last].v)}Z`} style={{ fill: color, opacity: 0.1 }} />
            <path d={`M${x(last)} ${y(data[last].v)}${fc.map((f, j) => `L${x(last + 1 + j)} ${y(f.v)}`).join("")}`} style={{ stroke: color, strokeDasharray: "5 5", fill: "none", strokeWidth: 2 }} />
            <text className="ax" x={x(N - 1)} y={Math.max(12, y(fc[fc.length - 1].hi) - 6)} textAnchor="end">előrejelzés: ~{fmt(fc.reduce((a, f) => a + f.v, 0))}{unit} / {fc.length} {hourly ? "óra" : "nap"}</text>
          </g>}
          {goal != null && goal > 0 && <g><line className="goal" x1={padL} x2={padL + iw} y1={y(goal)} y2={y(goal)} /><g transform={`translate(${padL + 6} ${y(goal) - 9})`}><rect className="goal-bg" width={compact(goal).length * 7 + 30} height={17} rx={8.5} y={-8} /><text className="goal-t" x={8} y={4}>cél {compact(goal)}</text></g></g>}
          {!bars && <path key={data.length + ":" + data[0]?.t} className="ln draw" pathLength={1} d={line("v")} style={{ stroke: color }} />}
          {data.length > 0 && hi == null && <circle className="pt" cx={x(last)} cy={y(data[last].v)} r={4} style={{ fill: color }} />}
          {/* the peak carries its own label, so the chart tells its story without hovering */}
          {peak >= 0 && hi == null && data.length > 4 && (() => { const px = x(peak), py = y(data[peak].v), t = `${dayLab(data[peak].t, hourly)} · ${fmt(data[peak].v)}${unit}`, tw = t.length * 6.4 + 16, lx = Math.min(Math.max(px - tw / 2, padL), padL + iw - tw);
            return <g className="peak"><circle cx={px} cy={py} r={4.5} style={{ fill: color }} /><rect x={lx} y={Math.max(0, py - 30)} width={tw} height={20} rx={10} /><text x={lx + tw / 2} y={Math.max(0, py - 30) + 14} textAnchor="middle">{t}</text></g>; })()}
          {/* posts and notes: small coloured dots under the axis instead of lines through the chart */}
          {mk.map((m, j) => (
            <g key={j} className={"mk" + (hi === m.i ? " on" : "")}>
              <circle cx={x(m.i)} cy={padT + ih + 30} r={hi === m.i ? 5.5 : 4} style={{ fill: m.color || ACC }}><title>{m.label}</title></circle>
            </g>
          ))}
          {hi != null && data[hi] && (
            <g>
              <line className="xh" x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + ih} />
              {hasPrev && <circle className="pt2" cx={x(hi)} cy={y(data[hi].p || 0)} r={3.5} />}
              <circle className="pt" cx={x(hi)} cy={y(data[hi].v)} r={4.5} style={{ fill: color }} />
            </g>
          )}
          <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" />
        </svg>
      )}
      {hi != null && data[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(x(hi), 90), w - 90), top: y(data[hi].v) }}>
          <b>{dayLong(data[hi].t, hourly)}</b>
          <div className="r"><span><i style={{ background: color }} />{label}</span><em>{fmt(data[hi].v)}{unit}</em></div>
          {hasPrev && <div className="r"><span><i className="dash" />{prevLabel}</span><em>{fmt(data[hi].p || 0)}{unit}</em></div>}
          {mk.filter((m) => m.i === hi).map((m, j) => <div key={j} className="r note-r"><span>● {m.label}</span></div>)}
        </div>
      )}
    </div>
  );
}

/** Columns stacked per day: one colour per channel (legend + tooltip carry the names). */
export function StackedColumns({ days, keys, height = 230, label = (k: string) => k, color = chColor }:
  { days: { t: string; v: Record<string, number> }[]; keys: string[]; height?: number; label?: (k: string) => string; color?: (k: string) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 40, padB = 26, padT = 10;
  const iw = Math.max(10, w - padL), ih = height - padB - padT;
  const tot = days.map((d) => keys.reduce((s, k) => s + (d.v[k] || 0), 0));
  const tk = ticks(Math.max(1, ...tot)), top = tk[tk.length - 1];
  const slot = iw / Math.max(1, days.length), bw = Math.max(3, Math.min(24, slot - 4));
  const base = padT + ih;
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(iw / 70))));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHi(null)}>
          {tk.map((v) => <g key={v}><line className="gl" x1={padL} x2={w} y1={base - (v / top) * ih} y2={base - (v / top) * ih} /><text className="ax" x={padL - 10} y={base - (v / top) * ih + 4} textAnchor="end">{compact(v)}</text></g>)}
          {days.map((d, i) => {
            let acc = 0; const x0 = padL + slot * i + (slot - bw) / 2;
            const segs = keys.map((k) => { const v = d.v[k] || 0, h = (v / top) * ih; const s = { k, y: base - acc - h, h }; acc += h; return s; }).filter((s) => s.h > 0);
            return (
              <g key={d.t} onPointerEnter={() => setHi(i)} className={hi != null && hi !== i ? "dimg" : ""}>
                <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
                {segs.map((s, j) => j === segs.length - 1
                  ? <path key={s.k} d={colPath(x0, bw, s.y + s.h, Math.max(0, s.h - (j ? 2 : 0)))} fill={color(s.k)} />
                  : <rect key={s.k} x={x0} y={s.y + (j ? 2 : 0)} width={bw} height={Math.max(0, s.h - (j ? 2 : 0))} fill={color(s.k)} />)}
                {i % every === 0 && <text className="ax" x={padL + slot * i + slot / 2} y={height - 6} textAnchor="middle">{dayLab(d.t)}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hi != null && days[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(padL + slot * hi + slot / 2, 90), w - 90), top: base - (tot[hi] / top) * ih }}>
          <b>{dayLong(days[hi].t)}</b>
          {keys.filter((k) => days[hi].v[k]).map((k) => <div key={k} className="r"><span><i style={{ background: color(k) }} />{label(k)}</span><em>{fmt(days[hi].v[k])}</em></div>)}
          <div className="r tot"><span>Összesen</span><em>{fmt(tot[hi])}</em></div>
        </div>
      )}
    </div>
  );
}

/** Small area sparkline (KPI tiles): fills its width. */
export function Spark({ values, h = 44, color = ACC }: { values: number[]; h?: number; color?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const id = useRef("s" + Math.random().toString(36).slice(2, 8)).current;
  if (values.length < 2) return <div className="spark" style={{ height: h }} />;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)]);
  const p = pts.map(([X, Y], i) => (i ? `L${X.toFixed(1)} ${Y.toFixed(1)}` : `M${X.toFixed(1)} ${Y.toFixed(1)}`)).join("");
  return (
    <div className="spark" ref={ref} style={{ height: h }} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={h}>
          <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${p}L${w} ${h}L0 ${h}Z`} fill={`url(#${id})`} />
          <path d={p} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
        </svg>
      )}
    </div>
  );
}

/** Vertical columns for a small set of categories (hours of the day, score bands, weekdays). */
export function Columns({ data, height = 180, unit = "", hiK }: { data: { k: string; v: number; tip?: string }[]; height?: number; unit?: string; hiK?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 34, padB = 22, padT = 10;
  const iw = Math.max(10, w - padL), ih = height - padB - padT;
  const max = Math.max(1, ...data.map((d) => d.v));
  const tk = ticks(max, 3), top = tk[tk.length - 1];
  const slot = iw / Math.max(1, data.length), bw = Math.max(3, Math.min(24, slot - 4));
  const y = (v: number) => padT + ih - (v / top) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 34))));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHi(null)}>
          {tk.map((v) => <g key={v}><line className="gl" x1={padL} x2={w} y1={y(v)} y2={y(v)} /><text className="ax" x={padL - 8} y={y(v) + 4} textAnchor="end">{compact(v)}</text></g>)}
          {data.map((d, i) => {
            const cx = padL + slot * i + slot / 2, hh = Math.max(d.v > 0 ? 3 : 0, (d.v / top) * ih);
            return (
              <g key={d.k} onPointerEnter={() => setHi(i)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
                <path className={"col" + (hi === i ? " on" : d.k === hiK ? " peak" : hi != null ? " dim" : "")} d={colPath(cx - bw / 2, bw, padT + ih, hh)} />
                {i % every === 0 && <text className="ax" x={cx} y={height - 6} textAnchor="middle">{d.k}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hi != null && data[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(padL + slot * hi + slot / 2, 70), w - 70), top: y(data[hi].v) }}>
          <b>{data[hi].tip || data[hi].k}</b>
          <div className="r"><span>Darab</span><em>{fmt(data[hi].v)}{unit}</em></div>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars with value and share; an optional colour dot carries identity. */
export function BarList({ items, total, max = 8, empty = "Még nincs adat ebben az időszakban.", fmtK, color, rank, accent, onPick }:
  { items: { k: string; n: number; sub?: string }[]; total?: number; max?: number; empty?: string; fmtK?: (k: string) => string; color?: (k: string) => string; rank?: boolean; accent?: boolean; onPick?: (k: string) => void }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <Empty t={empty} />;
  const sum = total ?? items.reduce((s, i) => s + i.n, 0);
  const top = Math.max(1, ...items.map((i) => i.n));
  const shown = all ? items : items.slice(0, max);
  return (
    <>
      <ul className={"a-bl" + (accent ? " accent" : "") + (onPick ? " pick" : "")}>
        {shown.map((i, j) => (
          <li key={i.k} title={`${fmtK ? fmtK(i.k) : i.k}: ${fmt(i.n)}`} onClick={onPick ? () => onPick(i.k) : undefined}>
            <span className="k">{rank && <em className="rk">{j + 1}</em>}{color && <i className="dot" style={{ background: color(i.k) }} />}{fmtK ? fmtK(i.k) : i.k}{i.sub && <span className="bsub"> · {i.sub}</span>}</span>
            <span className="n">{fmt(i.n)}<small>{pct(i.n, sum)}</small></span>
            <span className="t"><i style={{ width: `${(i.n / top) * 100}%`, background: color ? color(i.k) : undefined }} /></span>
          </li>
        ))}
      </ul>
      {items.length > max && <button className="lnk" onClick={() => setAll(!all)}>{all ? "Kevesebb" : `Mind a ${items.length} →`}</button>}
    </>
  );
}

/** Donut for a share of a whole (≤ 6 slices + Other); the centre carries the headline. */
export function Donut({ items, size = 168, center, sub, color = chColor, label = (k: string) => k, onPick }:
  { items: { k: string; n: number }[]; size?: number; center?: React.ReactNode; sub?: React.ReactNode; color?: (k: string) => string; label?: (k: string) => string; onPick?: (k: string) => void }) {
  const [hi, setHi] = useState<string | null>(null);
  const sorted = [...items].filter((i) => i.n > 0).sort((a, b) => b.n - a.n);
  const head = sorted.slice(0, 6), rest = sorted.slice(6).reduce((s, i) => s + i.n, 0);
  const parts = rest ? [...head, { k: "__other", n: rest }] : head;
  const tot = parts.reduce((s, i) => s + i.n, 0) || 1;
  const r = size / 2 - 10, sw = 16, C = 2 * Math.PI * r, gap = parts.length > 1 ? 3 : 0;
  let off = 0;
  const lab = (k: string) => (k === "__other" ? "Egyéb" : label(k));
  const col = (k: string) => (k === "__other" ? OTHER : color(k));
  const cur = hi ? parts.find((p) => p.k === hi) : null;
  return (
    <div className="donut">
      <div className="donut-svg" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Megoszlás">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--a-s3)" strokeWidth={sw} />
          {parts.map((p) => {
            const len = (p.n / tot) * C, dash = Math.max(0.01, len - gap);
            const el = <circle key={p.k} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col(p.k)} strokeWidth={hi === p.k ? sw + 4 : sw}
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-width .15s", opacity: hi && hi !== p.k ? 0.45 : 1 }}
              onPointerEnter={() => setHi(p.k)} onPointerLeave={() => setHi(null)} onClick={onPick && p.k !== "__other" ? () => onPick(p.k) : undefined} />;
            off += len; return el;
          })}
        </svg>
        <div className="donut-c">{cur ? <><b>{pct(cur.n, tot)}</b><span>{lab(cur.k)}</span></> : <><b>{center}</b><span>{sub}</span></>}</div>
      </div>
      <ul className="legend-l">
        {parts.map((p) => (
          <li key={p.k} onPointerEnter={() => setHi(p.k)} onPointerLeave={() => setHi(null)} className={(hi === p.k ? "on" : "") + (onPick && p.k !== "__other" ? " pick" : "")} onClick={onPick && p.k !== "__other" ? () => onPick(p.k) : undefined}>
            <i style={{ background: col(p.k) }} /><span>{lab(p.k)}</span><b>{fmt(p.n)}</b><small>{pct(p.n, tot)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Progress ring toward a goal. */
export function Ring({ value, size = 150, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  const shown = v > 0 ? Math.max(v, 0.012) : 0; /* a sliver stays visible at the very start */
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id="ringG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#C9A85B" /><stop offset="1" stopColor="#FBE7B0" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringG)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${shown * C} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ filter: "drop-shadow(0 0 10px rgba(243,213,138,.45))" }} />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}

/** Weekday × hour heat map (sequential gold, one hue). */
export function Heatmap({ cells }: { cells: { w: number; h: number; n: number }[] }) {
  const [hi, setHi] = useState<{ w: number; h: number; n: number } | null>(null);
  const m = new Map(cells.map((c) => [c.w * 100 + c.h, c.n]));
  const max = Math.max(1, ...cells.map((c) => c.n));
  const D = ["H", "K", "Sze", "Cs", "P", "Szo", "V"], DL = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  return (
    <div className="heat">
      <div className="heat-g">
        {D.map((d, wi) => (
          <div key={d} className="heat-r">
            <span className="heat-d">{d}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = m.get((wi + 1) * 100 + h) || 0, a = v ? 0.12 + 0.88 * Math.sqrt(v / max) : 0;
              return <span key={h} className="heat-c" style={{ background: v ? `color-mix(in srgb, var(--acc) ${(a * 100).toFixed(0)}%, transparent)` : undefined }}
                onPointerEnter={() => setHi({ w: wi, h, n: v })} onPointerLeave={() => setHi(null)} />;
            })}
          </div>
        ))}
        <div className="heat-r heat-x"><span className="heat-d" />{Array.from({ length: 24 }, (_, h) => <span key={h} className="heat-l">{h % 3 === 0 ? h : ""}</span>)}</div>
      </div>
      <div className="heat-foot">
        <span>{hi ? <><b>{DL[hi.w]} {hi.h}:00–{hi.h}:59</b> · {fmt(hi.n)} látogatás</> : "Vidd az egeret egy cellára."}</span>
        <span className="heat-scale">kevés<i /><i /><i /><i /><i />sok</span>
      </div>
    </div>
  );
}

/** Funnel: each step's bar from the first step's width, the drop to the next step between them. */
export function Funnel({ steps, worst, accentK = "scored" }: { steps: { k: string; l: string; sub?: string; n: number; prev?: number }[]; worst?: string; accentK?: string }) {
  const base = Math.max(1, steps[0]?.n || 0);
  return (
    <div className="fnl">
      {steps.map((s, i) => {
        const w = Math.max(1.5, (s.n / base) * 100), rate = s.prev ? s.n / s.prev : null;
        return (
          <div key={s.k} className={"fnl-s" + (s.k === worst ? " worst" : "") + (s.k === accentK ? " acc" : "")}>
            <div className="fnl-l"><b>{s.l}</b>{s.sub && <small>{s.sub}</small>}</div>
            <div className="fnl-b"><i style={{ width: w + "%" }} /><span style={w > 22 ? undefined : { left: `calc(${w}% + 10px)`, color: "var(--a-fg)" }}><CountUp v={s.n} /></span></div>
            <div className="fnl-v"><b>{pct(s.n, base)}</b>{i > 0 && rate != null && <small className={rate < 0.6 && (s.prev || 0) >= 5 ? "drop" : ""}>{rate >= 1 ? "" : "−"}{fmt(Math.abs(1 - rate) * 100)}% az előzőhöz</small>}</div>
          </div>
        );
      })}
    </div>
  );
}

/* the period before the chosen one began before the first measurement: a 0 there is "no data", not "nothing happened" */
export const PrevPartialCtx = createContext(false);
export function Delta({ now, prev, invert }: { now: number; prev: number; invert?: boolean }) {
  const partial = useContext(PrevPartialCtx);
  if (!prev && !now) return <span className="delta flat">–</span>;
  if (!prev) return partial ? <span className="delta flat" title="Az előző időszakban még nem volt mérés">nincs előző</span> : <span className="delta up">új</span>;
  const d = ((now - prev) / prev) * 100;
  const good = invert ? d < 0 : d > 0;
  const cls = Math.abs(d) < 0.5 ? "flat" : good ? "up" : "down";
  return <span className={"delta " + cls} title={`Előző időszak: ${fmt(prev)}`}>{d > 0 ? "↑" : d < 0 ? "↓" : ""} {fmt(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)}%</span>;
}

/** Empty state: what will appear here, how to get it, and a faint sketch of the chart behind it. */
export function Empty({ t, title, icon = "M3 12h18M12 3v18", children, ghost = true }: { t: React.ReactNode; title?: string; icon?: string; children?: React.ReactNode; ghost?: boolean }) {
  return (
    <div className="empty">
      {ghost && <div className="ghost" aria-hidden="true">{[40, 62, 48, 75, 58, 82, 66, 90, 72, 95, 80, 70, 86, 64].map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>}
      <div className="empty-glass">
        <span className="empty-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg></span>
        {title && <b className="et">{title}</b>}
        <p>{t}</p>{children}
      </div>
    </div>
  );
}

/** A number that counts up from zero when it first appears (600 ms; instant with reduced motion). */
export function CountUp({ v, d = 0, fmtFn }: { v: number; d?: number; fmtFn?: (n: number) => string }) {
  const [shown, setShown] = useState(v);
  const from = useRef(0);
  useEffect(() => {
    const target = Number(v) || 0, start = from.current;
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || start === target) { setShown(target); from.current = target; return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - k, 3); setShown(start + (target - start) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  const r = d ? shown : Math.round(shown);
  return <>{fmtFn ? fmtFn(r) : fmt(r, d)}</>;
}

/** ⓘ with the explanation on hover / focus: the card keeps only its title. */
export function Info({ children }: { children: React.ReactNode }) {
  /* hover or focus on a computer; a tap opens it (on a phone as a small sheet from the bottom), a second tap closes */
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const c = () => setOpen(false); const t = setTimeout(() => addEventListener("click", c), 0); return () => { clearTimeout(t); removeEventListener("click", c); }; }, [open]);
  return <i className={"info" + (open ? " open" : "")} tabIndex={0} aria-label="Magyarázat" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>i<span className="pop" role="tooltip">{children}</span></i>;
}

/** Milestones toward the goal: always the next step large, so there is something to reach this month. */
export function Milestones({ value, goal = 1_000_000, unit = "előnézet", perDay }: { value: number; goal?: number; unit?: string; perDay?: number }) {
  const steps = [1_000, 10_000, 100_000, goal].filter((x, i, a) => a.indexOf(x) === i && x <= goal);
  const next = steps.find((x) => x > value) || goal;
  const prev = [0, ...steps].filter((x) => x <= value).pop() || 0;
  const share = Math.max(0, Math.min(1, (value - prev) / Math.max(1, next - prev)));
  const days = perDay && perDay > 0 ? (next - value) / perDay : null;
  return (
    <div className="ms">
      <div className="ms-top"><b><CountUp v={value} /> / {compact(next)}</b><span>{days == null ? "" : days > 3650 ? "10+ év a következőig" : `kb. ${fmt(Math.ceil(days))} nap a következőig`}</span></div>
      <div className="ms-bar"><i style={{ width: `${share * 100}%` }} /></div>
      <div className="ms-steps">{steps.map((x) => <span key={x} className={x <= value ? "done" : x === next ? "cur" : ""}>{x <= value ? "✓" : "○"} {compact(x)}</span>)}</div>
    </div>
  );
}

/** Sankey: layers of nodes left to right, links as soft bands; width = count. Hover a band for the numbers. */
export type SNode = { id: string; l: string; color?: string };
export type SLink = { a: string; b: string; v: number; color?: string };
export function Sankey({ layers, links, height = 300 }: { layers: SNode[][]; links: SLink[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const nodeW = 12, padY = 10, gap = 10, labW = 132;
  const iw = Math.max(200, w - labW);
  const colX = (i: number) => (layers.length <= 1 ? 0 : (i / (layers.length - 1)) * (iw - nodeW));
  const val = (id: string) => Math.max(links.filter((l) => l.a === id).reduce((s, l) => s + l.v, 0), links.filter((l) => l.b === id).reduce((s, l) => s + l.v, 0));
  const maxCol = Math.max(1, ...layers.map((c) => c.reduce((s, nd) => s + val(nd.id), 0)));
  const usable = (c: SNode[]) => height - padY * 2 - gap * Math.max(0, c.length - 1);
  const k = Math.min(...layers.map((c) => usable(c) / maxCol));
  const pos = new Map<string, { x: number; y: number; h: number; outY: number; inY: number }>();
  layers.forEach((c, i) => { let y = padY; c.forEach((nd) => { const h = Math.max(2, val(nd.id) * k); pos.set(nd.id, { x: colX(i), y, h, outY: y, inY: y }); y += h + gap; }); });
  const paths = links.filter((l) => l.v > 0).map((l) => {
    const A = pos.get(l.a)!, B = pos.get(l.b)!, h = l.v * k;
    const y0 = A.outY + h / 2, y1 = B.inY + h / 2; A.outY += h; B.inY += h;
    const x0 = A.x + nodeW, x1 = B.x, mx = (x0 + x1) / 2;
    return { ...l, h, d: `M${x0} ${y0}C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`, mx, my: (y0 + y1) / 2 };
  });
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHi(null)}>
          {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.color || "var(--a-dim)"} strokeWidth={Math.max(1, p.h)} strokeOpacity={hi == null ? 0.38 : hi === i ? 0.75 : 0.12} onPointerEnter={() => setHi(i)} style={{ transition: "stroke-opacity .15s" }} />)}
          {layers.flatMap((c) => c.map((nd) => { const p = pos.get(nd.id)!; return (
            <g key={nd.id}>
              <rect x={p.x} y={p.y} width={nodeW} height={p.h} rx={3} fill={nd.color || "var(--a-mut)"} />
              <text className="ax" x={p.x + nodeW + 6} y={p.y + p.h / 2 + 4} style={{ fill: "var(--a-fg)", fontSize: 11.5 }}>{nd.l} · {fmt(val(nd.id))}</text>
            </g>
          ); }))}
        </svg>
      )}
      {hi != null && paths[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(paths[hi].mx, 90), w - 90), top: paths[hi].my }}>
          <b>{[...layers.flat()].find((x) => x.id === paths[hi].a)?.l} → {[...layers.flat()].find((x) => x.id === paths[hi].b)?.l}</b>
          <div className="r"><span>Látogatás</span><em>{fmt(paths[hi].v)}</em></div>
          <div className="r"><span>Arány</span><em>{pct(paths[hi].v, val(paths[hi].a))}</em></div>
        </div>
      )}
    </div>
  );
}

/** Bubble scatter: x = size (log scale), y = a rate; ≤ 12 labelled dots. */
export function Scatter({ pts, xl, yl, height = 280 }: { pts: { k: string; l: string; x: number; y: number; r?: number }[]; xl: string; yl: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const padL = 46, padB = 34, padT = 12, padR = 16;
  const iw = Math.max(10, w - padL - padR), ih = height - padT - padB;
  const xs = pts.map((p) => Math.log10(Math.max(1, p.x))), xmax = Math.max(1, ...xs), ymax = Math.max(0.05, ...pts.map((p) => p.y)) * 1.15;
  const X = (v: number) => padL + (Math.log10(Math.max(1, v)) / xmax) * iw, Y = (v: number) => padT + ih - (v / ymax) * ih;
  const yt = ticks(ymax * 100, 4).map((t) => t / 100).filter((t) => t <= ymax);
  const avgY = pts.length ? pts.reduce((s, p) => s + p.y * p.x, 0) / Math.max(1, pts.reduce((s, p) => s + p.x, 0)) : 0;
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHi(null)}>
          {yt.map((t) => <g key={t}><line className="gl" x1={padL} x2={padL + iw} y1={Y(t)} y2={Y(t)} /><text className="ax" x={padL - 8} y={Y(t) + 4} textAnchor="end">{fmt(t * 100)}%</text></g>)}
          {[1, 10, 100, 1000, 10000, 100000].filter((v) => Math.log10(v) <= xmax).map((v) => <text key={v} className="ax" x={X(v)} y={padT + ih + 16} textAnchor="middle">{compact(v)}</text>)}
          <line className="goal" x1={padL} x2={padL + iw} y1={Y(avgY)} y2={Y(avgY)} style={{ stroke: "var(--a-dim)" }} />
          <text className="ax" x={padL + iw} y={Y(avgY) - 5} textAnchor="end">átlag {fmt(avgY * 100, 1)}%</text>
          <text className="ax" x={padL + iw} y={height - 2} textAnchor="end">{xl} →</text>
          <text className="ax" x={6} y={padT + 4}>{yl}</text>
          {pts.map((p, i) => (
            <g key={p.k} onPointerEnter={() => setHi(i)}>
              <circle cx={X(p.x)} cy={Y(p.y)} r={Math.max(5, Math.min(18, p.r || 6))} fill="color-mix(in srgb, var(--acc) 22%, transparent)" stroke={ACC} strokeWidth={hi === i ? 2.5 : 1.5} />
              {i < 8 && <text className="ax" x={X(p.x) > padL + iw * 0.78 ? X(p.x) - 9 : X(p.x) + 9} y={Y(p.y) - 8 - (i % 2) * 11} textAnchor={X(p.x) > padL + iw * 0.78 ? "end" : "start"} style={{ fill: "var(--a-fg)" }}>{p.l}</text>}
            </g>
          ))}
        </svg>
      )}
      {hi != null && pts[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(X(pts[hi].x), 90), w - 90), top: Y(pts[hi].y) }}>
          <b>{pts[hi].l}</b><div className="r"><span>{xl}</span><em>{fmt(pts[hi].x)}</em></div><div className="r"><span>{yl}</span><em>{fmt(pts[hi].y * 100, 1)}%</em></div>
        </div>
      )}
    </div>
  );
}
