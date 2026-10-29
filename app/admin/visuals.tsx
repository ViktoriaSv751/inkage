"use client";
/* The Irányítóközpont's showpieces: a world map and a turning globe (Natural Earth borders from world-atlas, drawn here,
   no map library), the glowing goal ring, pastel stat tiles, action cards, a radar, step bars, cohort columns, the week
   strip and the live "orbs". Every one has a hover or a label; colours come from the admin.css tokens. */
import { useEffect, useMemo, useRef, useState } from "react";
import { CountUp, Delta, Spark, fmt, pct, useWidth } from "./charts";

/* ---------- countries ---------- */
type Ring = [number, number][];
type Country = { id: string; name: string; a2: string; rings: Ring[]; box: [number, number, number, number] };
const ALIAS: Record<string, string> = {
  "United States of America": "US", "Dem. Rep. Congo": "CD", Congo: "CG", "Central African Rep.": "CF", "Bosnia and Herz.": "BA",
  "Dominican Rep.": "DO", "Eq. Guinea": "GQ", "S. Sudan": "SS", "Solomon Is.": "SB", Macedonia: "MK", "North Macedonia": "MK", eSwatini: "SZ",
  "Côte d'Ivoire": "CI", "W. Sahara": "EH", "Falkland Is.": "FK", "Fr. S. Antarctic Lands": "TF", "N. Cyprus": "CY", Somaliland: "SO",
  Kosovo: "XK", Myanmar: "MM", Palestine: "PS", "Timor-Leste": "TL", Czechia: "CZ", Turkey: "TR", "Türkiye": "TR",
};
let world: Promise<Country[]> | null = null;
/* world-atlas 110m (Natural Earth, public domain), fetched once per page load from the npm CDN */
function loadWorld() {
  if (!world) world = fetch("/maps/countries-110m.json").then((r) => r.json()).then((topo) => {
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcs: Ring[] = topo.arcs.map((a: number[][]) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] as [number, number]; }); });
    const arc = (i: number): Ring => (i >= 0 ? arcs[i] : [...arcs[~i]].reverse());
    /* a ring across the antimeridian (Fiji, Chukotka) is moved to one side, so it does not stretch across the map */
    const ring = (ids: number[]): Ring => { const r = ids.flatMap((i, j) => (j ? arc(i).slice(1) : arc(i))); const xs = r.map((p) => p[0]); return Math.max(...xs) - Math.min(...xs) > 180 ? r.map(([x, y]) => [x < 0 ? x + 360 : x, y] as [number, number]) : r; };
    const byName = new Map<string, string>();
    try {
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
      for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b); const nm = dn.of(c); if (nm && nm !== c) byName.set(nm, c); }
    } catch {}
    return (topo.objects.countries.geometries as { type: string; arcs: any; id?: string; properties: { name: string } }[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((g) => g.id !== "010" && g.arcs)
      .map((g) => {
        const polys: number[][][] = g.type === "Polygon" ? [g.arcs] : g.arcs;
        const rings = polys.flatMap((p) => p.map(ring));
        const xs = rings.flat().map((p) => p[0]), ys = rings.flat().map((p) => p[1]);
        const name = g.properties?.name || "";
        return { id: g.id || name, name, a2: ALIAS[name] || byName.get(name) || "", rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
      });
  }).catch(() => { world = null; return []; });
  return world;
}
function useWorld() {
  const [w, setW] = useState<Country[] | null>(null);
  useEffect(() => { let on = true; loadWorld().then((x) => on && setW(x)); return () => { on = false; }; }, []);
  return w;
}

/* Natural Earth I projection (lon, lat in degrees → unit plane) */
const ne = (lon: number, lat: number): [number, number] => {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180, p2 = p * p, p4 = p2 * p2;
  return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))), p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
};

export const flag = (a2?: string) => (a2 && /^[A-Z]{2}$/.test(a2) ? String.fromCodePoint(...[...a2].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
export const countryName = (a2: string) => { try { return new Intl.DisplayNames(["hu"], { type: "region" }).of(a2) || a2; } catch { return a2; } };

/* the countries where a language is an official / main language: for the "language regions" map (an estimate) */
export const LANG_LAND: Record<string, string[]> = {
  hu: ["HU"], en: ["US", "GB", "CA", "AU", "IE", "NZ"], de: ["DE", "AT", "CH"], es: ["ES", "MX", "AR", "CO", "PE", "VE", "CL", "EC", "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY"],
  pt: ["PT", "BR", "AO", "MZ"], fr: ["FR", "BE", "SN", "CI", "CM", "ML", "BF", "NE", "TD", "GN", "MG", "HT", "BJ", "TG", "GA", "CG", "CD"], it: ["IT"], nl: ["NL", "SR"], pl: ["PL"], tr: ["TR"],
  id: ["ID"], ru: ["RU", "BY", "KZ", "KG"], ja: ["JP"], ko: ["KR"], zh: ["CN", "TW"], cs: ["CZ"], da: ["DK", "GL"], sv: ["SE"], ro: ["RO", "MD"], sk: ["SK"], uk: ["UA"],
  el: ["GR", "CY"], fi: ["FI"], no: ["NO"], nb: ["NO"], ar: ["SA", "EG", "AE", "MA", "DZ", "IQ", "JO", "TN", "LY", "SY", "YE", "OM", "KW", "QA", "LB", "SD", "MR"], hi: ["IN"], fa: ["IR", "AF"], vi: ["VN"],
};

/** Choropleth world map: one hue, light → deep by value; hover a country for its number. */
export function WorldMap({ values, label = "látogatás", height, onPick, note }: { values: Record<string, number>; label?: string; height?: number; onPick?: (a2: string) => void; note?: React.ReactNode }) {
  const geo = useWorld();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<{ c: Country; x: number; y: number } | null>(null);
  const max = Math.max(1, ...Object.values(values));
  const H = height || Math.max(200, Math.round(w * 0.46));
  const paths = useMemo(() => {
    if (!geo || !w) return [];
    /* Antarctica is left out, so the map's centre sits a little north of the equator */
    const sc = Math.min(w / 5.45, H / 2.4), cx = w / 2, cy = H / 2 + sc * 0.17;
    return geo.map((c) => ({ c, d: c.rings.map((r) => r.map(([lo, la], i) => { const [x, y] = ne(lo, la); return `${i ? "L" : "M"}${(cx + x * sc).toFixed(1)} ${(cy - y * sc).toFixed(1)}`; }).join("") + "Z").join("") }));
  }, [geo, w, H]);
  const fill = (a2: string) => { const v = values[a2]; if (!v) return "var(--map-0)"; const k = 0.18 + 0.82 * Math.sqrt(v / max); return `color-mix(in oklab, var(--map-1) ${Math.round(k * 100)}%, var(--map-0))`; };
  const ranked = Object.entries(values).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className="wmap" ref={ref}>
      {!geo ? <div className="skel" style={{ height: H }} /> : (
        <svg width={w} height={H} role="img" aria-label="Világtérkép" onPointerLeave={() => setHi(null)}>
          {paths.map(({ c, d }) => (
            <path key={c.id} d={d} style={{ fill: fill(c.a2) }} className={"wm-c" + (values[c.a2] ? " has" : "") + (hi?.c.id === c.id ? " on" : "")}
              onPointerMove={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHi({ c, x: e.clientX - r.left, y: e.clientY - r.top }); }}
              onClick={onPick && values[c.a2] ? () => onPick(c.a2) : undefined} />
          ))}
        </svg>
      )}
      {hi && (
        <div className="tip" style={{ left: Math.min(Math.max(hi.x, 90), w - 90), top: hi.y }}>
          <b>{flag(hi.c.a2)} {hi.c.a2 ? countryName(hi.c.a2) : hi.c.name}</b>
          <div className="r"><span>{label}</span><em>{fmt(values[hi.c.a2] || 0)}</em></div>
          {values[hi.c.a2] ? <div className="r"><span>helyezés</span><em>{ranked.findIndex(([k]) => k === hi.c.a2) + 1}.</em></div> : null}
        </div>
      )}
      <div className="wm-foot"><span className="wm-scale"><span>kevés</span><i /><span>sok</span></span>{note && <span className="note">{note}</span>}</div>
    </div>
  );
}

/** Country list with flags, bars and share (beside the map). */
export function CountryList({ values, max = 8, label = "látogatás", onPick }: { values: Record<string, number>; max?: number; label?: string; onPick?: (a2: string) => void }) {
  const rows = Object.entries(values).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const tot = rows.reduce((s, [, v]) => s + v, 0) || 1, top = rows[0]?.[1] || 1;
  if (!rows.length) return null;
  return (
    <ul className="clist">
      {rows.slice(0, max).map(([k, v], i) => (
        <li key={k} onClick={onPick ? () => onPick(k) : undefined} className={onPick ? "pick" : ""}>
          <span className="cl-f">{flag(k)}</span>
          <span className="cl-n"><b>{countryName(k)}</b><small>{fmt(v)} {label}</small></span>
          <span className="cl-b"><i style={{ width: `${(v / top) * 100}%` }} /></span>
          <span className="cl-p">{i === 0 ? <em>#1</em> : null}{pct(v, tot)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A turning dotted globe (orthographic); pins pulse where people are right now. Drag to turn it. */
export function Globe({ pins = [], size = 420 }: { pins?: { a2: string; n: number; label?: string }[]; size?: number }) {
  const geo = useWorld();
  const cv = useRef<HTMLCanvasElement>(null);
  const [ref, w] = useWidth<HTMLDivElement>();
  const S = Math.min(size, w || size);
  /* land dots: a 2.6° grid, kept where it falls inside a country */
  const dots = useMemo(() => {
    if (!geo) return [] as { lo: number; la: number; a2: string }[];
    const inside = (x: number, y: number, r: Ring) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const out: { lo: number; la: number; a2: string }[] = [];
    for (let la = -58; la <= 82; la += 2.6) {
      const step = 2.6 / Math.max(0.25, Math.cos((la * Math.PI) / 180));
      for (let lo = -180; lo < 180; lo += step) {
        const c = geo.find((g) => lo >= g.box[0] && lo <= g.box[2] && la >= g.box[1] && la <= g.box[3] && g.rings.some((r) => inside(lo, la, r)));
        if (c) out.push({ lo, la, a2: c.a2 });
      }
    }
    return out;
  }, [geo]);
  const centers = useMemo(() => {
    const m = new Map<string, [number, number]>();
    geo?.forEach((g) => { if (!g.a2 || m.has(g.a2)) return; const big = [...g.rings].sort((a, b) => b.length - a.length)[0]; const lo = big.reduce((s, p) => s + p[0], 0) / big.length, la = big.reduce((s, p) => s + p[1], 0) / big.length; m.set(g.a2, [lo, la]); });
    return m;
  }, [geo]);
  const seen = useRef(true);
  const rot = useRef({ l: -19, p: 22, drag: null as null | { x: number; y: number; l: number; p: number }, t: 0 });
  useEffect(() => {
    const c = cv.current; if (!c || !dots.length || !S) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = S * dpr; c.height = S * dpr;
    const x = c.getContext("2d")!; x.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const dot = css.getPropertyValue("--globe-dot").trim() || "#38b2a5", hot = css.getPropertyValue("--globe-hot").trim() || "#5b5bd6";
    const pinSet = new Set(pins.map((p) => p.a2));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = performance.now();
    const R = S / 2 - 6, cx = S / 2, cy = S / 2;
    const draw = (now: number) => {
      /* drawn only while on screen, at most 30 times a second: scrolling stays smooth */
      if (!seen.current || document.hidden || now - last < 32) { raf = requestAnimationFrame(draw); return; }
      const r = rot.current, dt = Math.min(64, now - last); last = now;
      if (!r.drag && !reduce) r.l += dt * 0.006;
      const l0 = (r.l * Math.PI) / 180, p0 = (r.p * Math.PI) / 180, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
      x.clearRect(0, 0, S, S);
      const proj = (lo: number, la: number) => { const l = (lo * Math.PI) / 180 + l0, p = (la * Math.PI) / 180; const cosc = sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(l); return { v: cosc, X: cx + R * Math.cos(p) * Math.sin(l), Y: cy - R * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(l)) }; };
      for (const d of dots) {
        const q = proj(d.lo, d.la); if (q.v <= 0) continue;
        const on = pinSet.has(d.a2);
        x.globalAlpha = on ? 0.95 : 0.25 + 0.65 * q.v;
        x.fillStyle = on ? hot : dot;
        x.beginPath(); x.arc(q.X, q.Y, on ? 1.9 : 1.35 + 0.5 * q.v, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
      const pulse = (now % 1800) / 1800;
      for (const p of pins) {
        const cc = centers.get(p.a2); if (!cc) continue; const q = proj(cc[0], cc[1]); if (q.v <= 0.05) continue;
        x.strokeStyle = hot; x.globalAlpha = 1 - pulse; x.lineWidth = 1.5;
        x.beginPath(); x.arc(q.X, q.Y, 5 + pulse * 16, 0, Math.PI * 2); x.stroke();
        x.globalAlpha = 1; x.fillStyle = hot; x.beginPath(); x.arc(q.X, q.Y, 4.5, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#fff"; x.beginPath(); x.arc(q.X, q.Y, 1.8, 0, Math.PI * 2); x.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const io = new IntersectionObserver(([e]) => { seen.current = e.isIntersecting; });
    if (ref.current) io.observe(ref.current);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [dots, centers, pins, S]);
  const down = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); rot.current.drag = { x: e.clientX, y: e.clientY, l: rot.current.l, p: rot.current.p }; };
  const move = (e: React.PointerEvent) => { const d = rot.current.drag; if (!d) return; rot.current.l = d.l + (e.clientX - d.x) * 0.4; rot.current.p = Math.max(-60, Math.min(70, d.p - (e.clientY - d.y) * 0.3)); };
  const up = () => { rot.current.drag = null; };
  return (
    <div className="globe" ref={ref}>
      <div className="globe-in" style={{ width: S, height: S }}>
        <div className="globe-sphere" />
        {!geo && <div className="globe-load">A térkép betöltése…</div>}
        <canvas ref={cv} style={{ width: S, height: S }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Forgó földgömb" />
      </div>
    </div>
  );
}

/** The glowing goal ring (big number in the middle, progress around it, a soft halo). */
export function GlowRing({ value, label, sub, share, size = 300, children }: { value: number; label: string; sub?: React.ReactNode; share: number; size?: number; children?: React.ReactNode }) {
  const p = Math.max(0.015, Math.min(1, share));
  return (
    <div className="gring" style={{ width: size, height: size, ["--p" as string]: `${(p * 100).toFixed(2)}%` }}>
      <div className="gring-halo" /><div className="gring-track" /><div className="gring-arc" /><div className="gring-core" />
      <div className="gring-c">
        <span className="gring-l">{label}</span>
        <b><CountUp v={value} /></b>
        {sub && <span className="gring-s">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/** Pastel stat tile: icon, LABEL, a big number, one line, the change, a faint trend. */
export type Tone = "peach" | "butter" | "pink" | "sky" | "lilac" | "mint";
export function Tile({ tone, icon, label, v, cap, now, prev, invert, spark, onClick, className = "" }: { tone: Tone; icon?: React.ReactNode; label: string; v: React.ReactNode; cap?: React.ReactNode; now?: number; prev?: number; invert?: boolean; spark?: number[]; onClick?: () => void; className?: string }) {
  return (
    <div className={`tile t-${tone} ${onClick ? "click" : ""} ${className}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}>
      <div className="tile-h"><span className="tile-i">{icon}</span><span className="tile-l">{label}</span></div>
      <div className="tile-v">{v}</div>
      <div className="tile-c">{now != null && prev != null && <Delta now={now} prev={prev} invert={invert} />}<span>{cap}</span></div>
      {spark && spark.length > 1 && <div className="tile-sp"><Spark values={spark} h={40} color="var(--tile-ink)" /></div>}
    </div>
  );
}

/** Action card: a pastel panel with one clear next step. */
export function ActionCard({ tone, title, text, cta, onClick, href, done }: { tone: Tone; title: string; text: React.ReactNode; cta: string; onClick?: () => void; href?: string; done?: boolean }) {
  const btn = href ? <a className="act-b" href={href}>{cta}</a> : <button className="act-b" onClick={onClick}>{cta}</button>;
  return (
    <div className={`act t-${tone}${done ? " done" : ""}`}>
      <div><b>{done ? "✓ " : ""}{title}</b><p>{text}</p></div>
      {done ? <span className="act-ok">Kész</span> : btn}
    </div>
  );
}

/** Radar: one value 0–100 per axis, the shape shows where it is strong and where weak. */
export function Radar({ axes, size = 320 }: { axes: { l: string; v: number; sub?: string }[]; size?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const W = Math.min(w || size, 520), H = Math.min(size, W * 0.86), cx = W / 2, cy = H / 2 + 6, R = Math.min(W * 0.26, H * 0.34);
  const n = axes.length, ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const poly = (k: number) => axes.map((_, i) => pt(i, R * k).join(",")).join(" ");
  const shape = axes.map((a, i) => pt(i, R * Math.max(0.04, Math.min(1, a.v / 100))).join(",")).join(" ");
  return (
    <div className="radar" ref={ref}>
      {w > 0 && n >= 3 && (
        <svg width={W} height={H} role="img" aria-label="Radar">
          {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={poly(k)} className="rd-g" />)}
          {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="rd-a" />; })}
          <polygon points={shape} className="rd-s" />
          {axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.04, Math.min(1, a.v / 100))); return <circle key={i} cx={x} cy={y} r={5} className="rd-p" />; })}
          {axes.map((a, i) => {
            const [x, y] = pt(i, R + 22), c = Math.cos(ang(i));
            return <text key={i} x={x} y={y} textAnchor={Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end"} className="rd-t"><tspan>{a.l} </tspan><tspan className="rd-v">{fmt(a.v)}%</tspan></text>;
          })}
        </svg>
      )}
    </div>
  );
}

/** Step bars (an activation list): label, a thin bar, the share in the accent colour. */
export function StepBars({ steps }: { steps: { l: string; n: number; base: number }[] }) {
  return (
    <ul className="sbars">
      {steps.map((s, i) => { const r = s.base ? s.n / s.base : 0; return (
        <li key={i} className={r === 0 ? "z" : ""}><span>{s.l}</span><span className="sb-t"><i style={{ width: `${Math.max(r ? 2 : 0, r * 100)}%` }} /></span><b>{fmt(r * 100, r < 0.1 && r > 0 ? 1 : 0)}%</b></li>
      ); })}
    </ul>
  );
}

/** Retention columns: one stacked column per day mark, each made of cells, falling to the right. */
export function CohortBars({ cols, height = 190 }: { cols: { l: string; v: number; tip?: string }[]; height?: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const cells = 12;
  return (
    <div className="cbars" style={{ height }}>
      {cols.map((c, i) => {
        const on = Math.round((Math.max(0, Math.min(100, c.v)) / 100) * cells);
        return (
          <div key={i} className={"cb" + (hi === i ? " on" : "")} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)}>
            <div className="cb-st">{Array.from({ length: cells }, (_, k) => <i key={k} className={cells - k <= on ? "f" : ""} />)}</div>
            <span className="cb-l">{c.l}</span>
            {hi === i && <div className="tip" style={{ left: "50%", top: 0 }}><b>{c.l}</b><div className="r"><span>aktív maradt</span><em>{fmt(c.v)}%</em></div>{c.tip && <div className="r"><span>{c.tip}</span></div>}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** The last 7 days as a strip: a check where the day had activity, a star for today. */
export function WeekStrip({ days }: { days: { t: string; v: number }[] }) {
  const last = days.slice(-7);
  const DN = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
  return (
    <ul className="wstrip">
      {last.map((d, i) => { const dt = new Date(d.t), today = i === last.length - 1; return (
        <li key={d.t} className={(d.v > 0 ? "ok" : "") + (today ? " today" : "")} title={`${dt.toLocaleDateString("hu-HU", { weekday: "long", month: "short", day: "numeric" })}: ${fmt(d.v)}`}>
          <span className="ws-i">{today ? "★" : d.v > 0 ? "✓" : "·"}</span><b>{fmt(d.v)}</b><span>{DN[dt.getDay()]}</span>
        </li>
      ); })}
    </ul>
  );
}

/** Live behaviour orbs: three glowing stages with their counts, joined by a line. */
export function Orbs({ items }: { items: { l: string; v: number; tone: "a" | "b" | "c" }[] }) {
  return (
    <div className="orbs">
      <span className="orbs-line" />
      {items.map((x, i) => <div key={i} className={"orb o-" + x.tone}><span className="orb-b"><i /></span><b><CountUp v={x.v} /></b><small>{x.l}</small></div>)}
    </div>
  );
}

/** The InkAge wordmark, drawn stroke by stroke then filled (the page's flourish); a plain bold word, not a handwritten signature. */
const WORDMARK = { fontFamily: "Geist, system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.02em" } as const;
export function SignatureLine({ text = "InkAge", className = "" }: { text?: string; className?: string }) {
  return (
    <svg className={"sigline " + className} viewBox="0 0 520 150" aria-hidden="true">
      <text x="10" y="112" className="sig-s" style={WORDMARK}>{text}</text>
      <text x="10" y="112" className="sig-f" style={WORDMARK}>{text}</text>
    </svg>
  );
}
