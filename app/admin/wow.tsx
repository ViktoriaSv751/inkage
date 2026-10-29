"use client";
/* Wave 2: every page's showpiece. Story cards (home), channel cards, the hour clock, the keyword radar, QR codes in
   the InkAge look, the store front, person cards, the 3D funnel, activity rings, the score bell, the virality gauge
   and tree, goal rings and the status rows. Plain SVG / CSS on the admin.css tokens, a hover or a label on each. */
import { useEffect, useRef, useState } from "react";
import { CountUp, Spark, fmt, pct, useWidth } from "./charts";

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const n = (x: unknown) => Number(x) || 0;

/* ---------- home: "Ma" story cards, swipe or tap the arrows ---------- */
export type Story = { tone: string; kicker: string; big: React.ReactNode; line: React.ReactNode; cta?: string; run?: () => void };
export function Stories({ items }: { items: Story[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setI(Math.round(el.scrollLeft / Math.max(1, (el.firstElementChild as HTMLElement)?.offsetWidth + 14)));
    el.addEventListener("scroll", f, { passive: true }); return () => el.removeEventListener("scroll", f);
  }, []);
  const go = (k: number) => { const el = ref.current; if (!el) return; const w = (el.firstElementChild as HTMLElement)?.offsetWidth + 14; el.scrollTo({ left: Math.max(0, k) * w, behavior: "smooth" }); };
  if (!items.length) return null;
  return (
    <div className="stories">
      <div className="st-bars">{items.map((_, k) => <i key={k} className={k <= i ? "on" : ""} onClick={() => go(k)} />)}</div>
      <div className="st-row" ref={ref}>
        {items.map((s, k) => (
          <article key={k} className={`story t-${s.tone}`}>
            <span className="eyebrow">{s.kicker}</span>
            <b className="st-big">{s.big}</b>
            <p>{s.line}</p>
            {s.cta && <button className="act-b" onClick={s.run}>{s.cta}</button>}
          </article>
        ))}
      </div>
      <div className="st-nav"><button onClick={() => go(i - 1)} aria-label="Előző" disabled={i <= 0}>‹</button><button onClick={() => go(i + 1)} aria-label="Következő" disabled={i >= items.length - 1}>›</button></div>
    </div>
  );
}

/* consecutive days (up to today) with at least one analysis */
export const streakOf = (days: { v: number }[]) => { let k = 0; for (let j = days.length - 1; j >= 0; j--) { if (days[j].v > 0) k++; else if (j === days.length - 1) continue; else break; } return k; };

/* ---------- traffic: one card per channel, with its logo ---------- */
const LOGO: Record<string, [string, string]> = {
  tiktok: ["T", "linear-gradient(135deg,#25F4EE,#000 48%,#FE2C55)"], instagram: ["I", "radial-gradient(circle at 30% 110%,#FFDD55 0 12%,#FF543E 35%,#C837AB 65%,#5B4FE9 100%)"],
  google: ["G", "conic-gradient(#4285F4 0 25%,#34A853 0 50%,#FBBC05 0 75%,#EA4335 0)"], facebook: ["f", "#1877F2"], pinterest: ["P", "#E60023"], linkedin: ["in", "#0A66C2"], apple: ["A", "linear-gradient(135deg,#1AC8FC,#1D6CF2)"], play: ["▶", "linear-gradient(135deg,#00C3FF,#00E676 40%,#FFC400 70%,#FF3A44)"], youtube: ["▶", "#FF0000"],
  ai: ["✦", "linear-gradient(135deg,#D97757,#8B5CF6)"], email: ["@", "#5B5BD6"], bing: ["b", "linear-gradient(135deg,#00809D,#258FFA)"], közvetlen: ["→", "#8F887C"],
};
/* the platforms' own marks, simplified to one white glyph (letters only where the letter is the mark) */
const GLYPH: Record<string, React.ReactNode> = {
  tiktok: <path d="M14.5 3c.4 2.3 1.9 3.9 4.3 4.1v3a7.3 7.3 0 0 1-4.2-1.3v6.1a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.1a2.4 2.4 0 1 0 1.6 2.3V3z" fill="currentColor" />,
  instagram: <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="4.6" /><circle cx="12" cy="12" r="3.6" /><circle cx="16.9" cy="7.1" r=".6" fill="currentColor" /></g>,
  youtube: <path d="M10 8.5v7l6-3.5z" fill="currentColor" />,
  email: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="m4 7 8 6 8-6" /></g>,
};
export const Logo = ({ k, size = 36 }: { k: string; size?: number }) => {
  const key = (k || "").toLowerCase(), [t, bg] = LOGO[key] || [(k || "?")[0]?.toUpperCase(), "#8F887C"], g = GLYPH[key];
  return <span className="plogo" style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}>{g ? <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden="true">{g}</svg> : t}</span>;
};
/* every channel we can tell apart is shown, also the ones that brought nobody yet (greyed): so the page always
   answers "did Pinterest / LinkedIn bring anyone?" */
const ALLCH = ["google", "tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube", "ai", "email"];
export function ChannelCards({ chans, trend, label, onPick }: { chans: D[]; trend: D[]; label: (k: string) => string; onPick?: (k: string) => void }) {
  const tot = chans.reduce((s, c) => s + n(c.sessions), 0) || 1;
  const have = new Map(chans.map((c) => [c.k, c]));
  const known = [...chans.filter((c) => c.k !== "közvetlen" && n(c.sessions) > 0), ...ALLCH.filter((k) => !have.has(k) || !n(have.get(k)?.sessions)).map((k) => ({ k, sessions: 0, scored: 0 }))];
  const direct = have.get("közvetlen");
  const list = [...known, ...(direct ? [direct] : [])];
  return (
    <div className="chcards">
      {list.map((c) => {
        const sp = trend.filter((x) => x.k === c.k).map((x) => n(x.n)), zero = !n(c.sessions);
        return (
          <button key={c.k} className={"chcard" + (zero ? " zero" : "")} onClick={onPick && !zero ? () => onPick(c.k) : undefined}>
            <span className="chc-h"><Logo k={c.k} /><span className="chc-s">{zero ? "–" : pct(n(c.sessions), tot)}</span></span>
            <b>{label(c.k)}</b>
            <span className="chc-v"><CountUp v={n(c.sessions)} /><small> látogatás</small></span>
            <span className="chc-c">{zero ? "Még nem jött innen látogató" : `${pct(n(c.scored), n(c.sessions))} jut el az előnézetig`}</span>
            {sp.length > 1 && !zero && <span className="chc-sp"><Spark values={sp} h={34} /></span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- the hour clock: 24 bars around a dial ---------- */
export function HourClock({ hours, size = 260, label = "látogatás" }: { hours: { h: number; n: number }[]; size?: number; label?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...hours.map((x) => x.n)), c = size / 2, r0 = size * 0.22, r1 = size * 0.44;
  const best = [...hours].sort((a, b) => b.n - a.n)[0];
  const cur = hi != null ? hours.find((x) => x.h === hi) : best;
  return (
    <div className="hclock" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Napszakok">
        <circle cx={c} cy={c} r={r1} className="hc-ring" />
        {hours.map((x) => {
          const a = ((x.h / 24) * 360 - 90) * (Math.PI / 180), len = r0 + (r1 - r0) * Math.max(0.04, x.n / max);
          return <line key={x.h} x1={c + Math.cos(a) * r0} y1={c + Math.sin(a) * r0} x2={c + Math.cos(a) * len} y2={c + Math.sin(a) * len} className={"hc-b" + (x.h === best?.h ? " best" : "") + (hi === x.h ? " on" : "")} strokeWidth={size / 34} onPointerEnter={() => setHi(x.h)} onPointerLeave={() => setHi(null)} />;
        })}
        {[0, 6, 12, 18].map((h) => { const a = ((h / 24) * 360 - 90) * (Math.PI / 180); return <text key={h} x={c + Math.cos(a) * (r1 + 12)} y={c + Math.sin(a) * (r1 + 12) + 4} textAnchor="middle" className="hc-t">{h}</text>; })}
      </svg>
      <div className="hc-c"><b>{cur ? `${cur.h}:00` : "–"}</b><span>{cur ? `${fmt(cur.n)} ${label}` : ""}</span>{hi == null && <small>csúcs</small>}</div>
    </div>
  );
}

/* ---------- Google: the keyword radar (closer to the centre = better position) ---------- */
export function KeywordRadar({ rows, onPick }: { rows: D[]; onPick?: (r: D) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const S = Math.min(w || 420, 520), c = S / 2, R = S / 2 - 18;
  const rings = [{ p: 3, l: "1–3." }, { p: 10, l: "1. oldal" }, { p: 20, l: "2. oldal" }, { p: 50, l: "messze" }];
  const rad = (pos: number) => (Math.min(50, Math.max(1, pos)) <= 3 ? (pos / 3) * 0.22 : pos <= 10 ? 0.22 + ((pos - 3) / 7) * 0.3 : pos <= 20 ? 0.52 + ((pos - 10) / 10) * 0.25 : 0.77 + ((Math.min(pos, 50) - 20) / 30) * 0.23) * R;
  const maxI = Math.max(1, ...rows.map((r) => n(r.impressions)));
  const pts = rows.slice(0, 40).map((r, i) => { const a = i * 2.39996 - Math.PI / 2, d = rad(n(r.pos)); return { r, x: c + Math.cos(a) * d, y: c + Math.sin(a) * d, s: 4 + Math.sqrt(n(r.impressions) / maxI) * 16, ctr: n(r.impressions) ? n(r.clicks) / n(r.impressions) : 0 }; });
  return (
    <div className="kwr" ref={ref}>
      {w > 0 && (
        <svg width={S} height={S} role="img" aria-label="Kulcsszó-radar" onPointerLeave={() => setHi(null)}>
          {[...rings].reverse().map((g, i) => <circle key={g.p} cx={c} cy={c} r={rad(g.p)} className={"kw-ring" + (g.p === 20 ? " near" : "")} style={{ opacity: 1 - i * 0.12 }} />)}
          {rings.map((g) => <text key={g.l} x={c + 4} y={c - rad(g.p) + 13} className="kw-l">{g.l}</text>)}
          <circle cx={c} cy={c} r={5} className="kw-core" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.s} className={"kw-p" + (n(p.r.pos) > 7 && n(p.r.pos) <= 20 ? " near" : "") + (hi === i ? " on" : "")} style={{ opacity: 0.35 + Math.min(0.6, p.ctr * 8) }} onPointerEnter={() => setHi(i)} onClick={onPick ? () => onPick(p.r) : undefined} />)}
        </svg>
      )}
      {hi != null && pts[hi] && (
        <div className="tip" style={{ left: Math.min(Math.max(pts[hi].x, 90), S - 90), top: pts[hi].y - pts[hi].s }}>
          <b>{pts[hi].r.query}</b>
          <div className="r"><span>helyezés</span><em>{fmt(n(pts[hi].r.pos), 1)}.</em></div>
          <div className="r"><span>megjelenés</span><em>{fmt(pts[hi].r.impressions)}</em></div>
          <div className="r"><span>kattintás</span><em>{fmt(pts[hi].r.clicks)} · {pct(n(pts[hi].r.clicks), n(pts[hi].r.impressions))}</em></div>
        </div>
      )}
      <div className="kw-leg"><span><i className="near" />majdnem első oldal: itt a leggyorsabb a nyerés</span><span><i />a buborék mérete: hányan látják</span></div>
    </div>
  );
}

/* ---------- links: a QR code in the InkAge look (qrcode-generator from the npm CDN, loaded on demand) ---------- */
type QRLib = (t: number, e: string) => { addData: (s: string) => void; make: () => void; getModuleCount: () => number; isDark: (r: number, c: number) => boolean };
let qrLib: Promise<QRLib> | null = null;
const loadQR = () => (qrLib ||= import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm" as string).then((m) => (m.default || m) as QRLib));
export function QR({ text, size = 168, label }: { text: string; size?: number; label?: string }) {
  const [mods, setMods] = useState<boolean[][] | null>(null);
  useEffect(() => { let on = true; loadQR().then((q) => { const qr = q(0, "H"); qr.addData(text); qr.make(); const k = qr.getModuleCount(); on && setMods(Array.from({ length: k }, (_, r) => Array.from({ length: k }, (_, c) => qr.isDark(r, c)))); }).catch(() => on && setMods(null)); return () => { on = false; }; }, [text]);
  const k = mods?.length || 25, cell = size / (k + 2);
  const eye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= k - 7) || (r >= k - 7 && c < 7);
  const svg = mods && (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} rx={size * 0.08} fill="#FFFDF8" />
      {mods.flatMap((row, r) => row.map((on, c) => on && !eye(r, c) ? <circle key={r + "-" + c} cx={(c + 1.5) * cell} cy={(r + 1.5) * cell} r={cell * 0.44} fill="#17140F" /> : null))}
      {[[0, 0], [0, k - 7], [k - 7, 0]].map(([r, c]) => <g key={r + "-" + c}><rect x={(c + 1.5) * cell} y={(r + 1.5) * cell} width={cell * 6} height={cell * 6} rx={cell * 2} fill="none" stroke="#17140F" strokeWidth={cell} /><rect x={(c + 3) * cell} y={(r + 3) * cell} width={cell * 3} height={cell * 3} rx={cell} fill="#B8892E" /></g>)}
      <circle cx={size / 2} cy={size / 2} r={size * 0.11} fill="#FFFDF8" />
      <text x={size / 2} y={size / 2 + size * 0.045} textAnchor="middle" fontFamily="Mr Dafoe, cursive" fontSize={size * 0.13} fill="#17140F">C</text>
    </svg>
  );
  const save = () => {
    if (!mods) return;
    const el = document.getElementById("qr-" + text.replace(/\W/g, ""))?.querySelector("svg"); if (!el) return;
    const xml = new XMLSerializer().serializeToString(el), img = new Image();
    img.onload = () => { const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920; const x = cv.getContext("2d")!; const g = x.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, "#F9CBB6"); g.addColorStop(0.5, "#F5CEE2"); g.addColorStop(1, "#DAD4F8"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
      x.drawImage(img, 240, 620, 600, 600); x.fillStyle = "#17140F"; x.textAlign = "center"; x.font = "600 64px 'Cormorant Garamond', Georgia, serif"; x.fillText(label || "Próbáld ki", 540, 470); x.font = "600 44px Geist, sans-serif"; x.fillText(text.replace(/^https?:\/\//, ""), 540, 1340); x.font = "90px 'Mr Dafoe', cursive"; x.fillText("InkAge", 540, 1600);
      const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = `inkage-qr-${text.split("/").pop()}.png`; a.click(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  };
  return (
    <div className="qr" id={"qr-" + text.replace(/\W/g, "")}>
      {svg || <div className="skel" style={{ width: size, height: size, borderRadius: size * 0.08 }} />}
      <button className="adm-ibtn sm" onClick={save} disabled={!mods}>Story-kép (PNG)</button>
    </div>
  );
}

/* ---------- stores: the shop window ---------- */
export function Storefront({ avg, count, dist, downloads }: { avg: number; count: number; dist: number[]; downloads: number }) {
  const max = Math.max(1, ...dist);
  return (
    <div className="shop">
      <div className="shop-app"><img src="/brand/icon-192.png" alt="" /><div><b>InkAge</b><span>MI tetoválás-előnézet</span><span className="chip good">Tetoválás öregedése</span></div></div>
      <div className="shop-rate"><b>{count ? fmt(avg, 1) : "–"}</b><span className="stars">{"★★★★★".slice(0, Math.round(avg))}{"☆☆☆☆☆".slice(0, 5 - Math.round(avg))}</span><small>{fmt(count)} értékelés</small></div>
      <ul className="shop-dist">{[5, 4, 3, 2, 1].map((r, i) => <li key={r}><span>{r}</span><i><em style={{ width: `${(dist[i] / max) * 100}%` }} /></i></li>)}</ul>
      <div className="shop-dl"><b><CountUp v={downloads} /></b><span>letöltés</span></div>
    </div>
  );
}

/* ---------- people: cards ---------- */
const AV = ["linear-gradient(135deg,#FFB38A,#FF6FA3)", "linear-gradient(135deg,#8BD3FF,#5B5BD6)", "linear-gradient(135deg,#B9F3D0,#2BA597)", "linear-gradient(135deg,#FFE29A,#F2A93B)", "linear-gradient(135deg,#E2D3FF,#8B5CF6)"];
/* how long a visit lasted: "45 mp", "2 p 50 mp", "1 ó 5 p" */
export const dur = (s: unknown) => { const t = Math.max(0, Math.round(Number(s) || 0)); return t < 60 ? `${t} mp` : t < 3600 ? `${Math.floor(t / 60)} p${t % 60 ? ` ${t % 60} mp` : ""}` : `${Math.floor(t / 3600)} ó ${Math.floor((t % 3600) / 60)} p`; };

export function PeopleGrid({ rows, onOpen, prov, langName, flag, ago }: { rows: D[]; onOpen: (id: string) => void; prov: (k: string) => string; langName: (k: string) => string; flag: (k: string) => string; ago: (t?: string | null) => string }) {
  return (
    <div className="people">
      {rows.map((x, i) => (
        <button key={x.id} className="person" onClick={() => onOpen(x.id)}>
          <span className="pav" style={{ background: AV[i % AV.length] }}>{(x.email || "?").slice(0, 1).toUpperCase()}</span>
          <b>{(x.email || "–").replace(/@.*/, "")}<small>@{(x.email || "").split("@")[1] || ""}</small></b>
          {/* the card stays short: what the visit and the account did is on the user's page (click) */}
          <span className="pmeta"><span className="chip">{prov(x.provider)}</span></span>
          {x.score != null && <span className="pmeta"><span className="chip" style={{ fontWeight: 800 }} title="Aktivitási pontszám 0–100">{n(x.score)}</span>{x.stage && <span className={"chip" + ({ aktiv: " good", probalgatja: " warn", veszelyben: " warn", alvo: " bad" } as Record<string, string>)[x.stage as string] || ""}>{({ uj: "Új", probalgatja: "Próbálgatja", aktiv: "Aktív", veszelyben: "Veszélyben", alvo: "Alvó" } as Record<string, string>)[x.stage as string] || x.stage}</span>}{x.churn && <span className="chip warn">lemorzsolódhat</span>}{x.online && <span className="chip good">● most</span>}</span>}
          <span className="pwhen">regisztrált {ago(x.created_at)} · {x.last_active_at ? <>aktív {ago(x.last_active_at)}</> : <>belépett {ago(x.last_sign_in_at)}</>}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- funnel: stacked, narrowing discs ---------- */
export function Funnel3D({ steps }: { steps: { l: string; n: number }[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const base = Math.max(1, steps[0]?.n || 1), W = Math.min(w || 600, 760), rowH = 46, H = steps.length * rowH + 20;
  const col = ["#FFB547", "#FF8A5B", "#FF6B8B", "#F2558C", "#C85CD9", "#8B5CF6", "#6B6BF0", "#5B5BD6"];
  return (
    <div className="f3d" ref={ref}>
      {w > 0 && (
        <svg width={W} height={H} role="img" aria-label="Tölcsér">
          <defs>{col.map((c, i) => <linearGradient key={i} id={"f3" + i} x1="0" x2="1"><stop offset="0" stopColor={c} stopOpacity=".95" /><stop offset=".5" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".75" /></linearGradient>)}</defs>
          {steps.map((s, i) => {
            const k = Math.max(0.08, s.n / base), nk = Math.max(0.08, (steps[i + 1]?.n ?? s.n * 0.9) / base), mid = W * 0.36, hw = (W * 0.34) * k, nw = (W * 0.34) * nk, y = 10 + i * rowH;
            const drop = i > 0 && steps[i - 1].n ? 1 - s.n / steps[i - 1].n : 0;
            return (
              <g key={i} className="f3-l" style={{ animationDelay: `${i * 70}ms` }}>
                <path d={`M${mid - hw} ${y} L${mid + hw} ${y} L${mid + nw} ${y + rowH - 8} L${mid - nw} ${y + rowH - 8} Z`} fill={`url(#f3${i % col.length})`} />
                <ellipse cx={mid} cy={y} rx={hw} ry={6} fill={col[i % col.length]} opacity=".55" />
                <text x={mid} y={y + rowH / 2 + 1} textAnchor="middle" className="f3-n">{fmt(s.n)}</text>
                <text x={W * 0.74} y={y + rowH / 2 - 4} className="f3-t">{s.l}</text>
                <text x={W * 0.74} y={y + rowH / 2 + 12} className={"f3-p" + (drop > 0.4 ? " bad" : "")}>{pct(s.n, base)}{i > 0 ? ` · −${fmt(drop * 100)}%` : ""}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ---------- retention: activity rings (daily / weekly / monthly active of all accounts) ---------- */
export function ActivityRings({ rings, size = 220 }: { rings: { l: string; v: number; of: number; c: string }[]; size?: number }) {
  const sw = size * 0.085, gap = 4;
  return (
    <div className="arings">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Aktivitás">
        {rings.map((r, i) => {
          const rad = size / 2 - sw / 2 - i * (sw + gap), C = 2 * Math.PI * rad, k = Math.min(1, r.of ? r.v / r.of : 0);
          return (
            <g key={r.l} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.c} strokeOpacity=".16" strokeWidth={sw} />
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.001, k) * C} ${C}`} className="ar-arc" />
            </g>
          );
        })}
      </svg>
      <ul>{rings.map((r) => <li key={r.l}><i style={{ background: r.c }} /><span>{r.l}</span><b>{fmt(r.v)}</b><small>{pct(r.v, r.of)}</small></li>)}</ul>
    </div>
  );
}

/* ---------- product: the score bell ---------- */
export function BellCurve({ bins, height = 220 }: { bins: { k: number; n: number }[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const tot = bins.reduce((s, b) => s + b.n, 0) || 1, mean = bins.reduce((s, b) => s + (b.k + 5) * b.n, 0) / tot;
  const max = Math.max(1, ...bins.map((b) => b.n)), pad = 24, iw = Math.max(10, w - pad * 2), ih = height - 40;
  const x = (v: number) => pad + (v / 100) * iw, y = (v: number) => 10 + ih - (v / max) * ih;
  const pts = bins.map((b) => [x(b.k + 5), y(b.n)]);
  const path = pts.reduce((acc, [px, py], i) => { if (!i) return `M${x(0)} ${y(0)} L${px} ${py}`; const [qx, qy] = pts[i - 1]; const cx = (qx + px) / 2; return acc + ` C${cx} ${qy} ${cx} ${py} ${px} ${py}`; }, "") + ` L${x(100)} ${y(0)}`;
  return (
    <div className="bell" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs><linearGradient id="bellg" x1="0" x2="1"><stop offset="0" stopColor="#FF8A5B" /><stop offset=".5" stopColor="#F2558C" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient>
            <linearGradient id="bellf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F2558C" stopOpacity=".28" /><stop offset="1" stopColor="#F2558C" stopOpacity="0" /></linearGradient></defs>
          <path d={path + " Z"} fill="url(#bellf)" />
          <path d={path} fill="none" stroke="url(#bellg)" strokeWidth="3" strokeLinecap="round" className="bell-l2" />
          <line x1={x(mean)} x2={x(mean)} y1={8} y2={10 + ih} className="bell-m" />
          <text x={x(mean)} y={height - 22} textAnchor="middle" className="bell-mt">átlag {fmt(mean)}</text>
          {[0, 25, 50, 75, 100].map((v) => <text key={v} x={x(v)} y={height - 6} textAnchor="middle" className="ax">{v}</text>)}
        </svg>
      )}
    </div>
  );
}

/* ---------- viral: the gauge (0 → 1) and the tree ---------- */
export function Gauge({ v, max = 1, target = 0.3, label }: { v: number; max?: number; target?: number; label: string }) {
  const k = Math.max(0, Math.min(1, v / max)), a = Math.PI * (1 - k), r = 90, cx = 110, cy = 104;
  const arc = (a0: number, a1: number) => `M${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  const ta = Math.PI * (1 - target / max);
  return (
    <div className="gauge">
      <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label={label}>
        <path d={arc(Math.PI, ta)} className="g-z1" /><path d={arc(ta, Math.PI * (1 - 0.6 / max))} className="g-z2" /><path d={arc(Math.PI * (1 - 0.6 / max), 0)} className="g-z3" />
        <line x1={cx} y1={cy} x2={cx + (r - 16) * Math.cos(a)} y2={cy - (r - 16) * Math.sin(a)} className="g-needle" />
        <circle cx={cx} cy={cy} r="7" className="g-hub" />
      </svg>
      <b>{fmt(v, 2)}</b><span>{label}</span>
    </div>
  );
}
export function ViralTree({ shared, visits, scored }: { shared: number; visits: number; scored: number }) {
  const kids = Math.min(6, Math.max(1, Math.round(visits / Math.max(1, shared)) || 1)), grand = Math.min(3, Math.max(0, Math.round(scored / Math.max(1, visits) * 3)));
  const W = 520, H = 210, root = { x: W / 2, y: 30 };
  const L1 = shared ? 5 : 1;
  const lv1 = Array.from({ length: L1 }, (_, i) => ({ x: (W / (L1 + 1)) * (i + 1), y: 110 }));
  return (
    <div className="vtree">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Megosztási fa">
        {lv1.map((p, i) => <path key={i} d={`M${root.x} ${root.y} C${root.x} ${(root.y + p.y) / 2} ${p.x} ${(root.y + p.y) / 2} ${p.x} ${p.y}`} className="vt-l" style={{ animationDelay: `${i * 120}ms` }} />)}
        {lv1.flatMap((p, i) => Array.from({ length: Math.min(3, kids) }, (_, j) => { const q = { x: p.x + (j - 1) * 26, y: 180 }; return <g key={i + "-" + j}><path d={`M${p.x} ${p.y} C${p.x} ${(p.y + q.y) / 2} ${q.x} ${(p.y + q.y) / 2} ${q.x} ${q.y}`} className="vt-l s" style={{ animationDelay: `${400 + (i * 3 + j) * 60}ms` }} /><circle cx={q.x} cy={q.y} r={j < grand ? 7 : 5} className={"vt-n" + (j < grand ? " hot" : "")} /></g>; }))}
        {lv1.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={10} className="vt-n mid" />)}
        <circle cx={root.x} cy={root.y} r={16} className="vt-n root" />
      </svg>
      <div className="vt-leg"><span><i className="root" />{fmt(shared)} megosztás</span><span><i className="mid" />{fmt(visits)} látogató jött vissza</span><span><i className="hot" />{fmt(scored)} új előnézet</span></div>
    </div>
  );
}

/* ---------- goals: one ring per goal ---------- */
export function GoalRing({ value, target, label, sub, c = "var(--acc)" }: { value: number; target: number; label: string; sub?: string; c?: string }) {
  const k = Math.min(1, target ? value / target : 0), r = 44, C = 2 * Math.PI * r;
  return (
    <div className={"gr" + (k >= 1 ? " done" : "")}>
      <svg width="112" height="112" viewBox="0 0 112 112"><circle cx="56" cy="56" r={r} fill="none" stroke={c} strokeOpacity=".15" strokeWidth="11" /><circle cx="56" cy="56" r={r} fill="none" stroke={c} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${Math.max(0.001, k) * C} ${C}`} transform="rotate(-90 56 56)" className="ar-arc" /></svg>
      <div className="gr-c"><b>{fmt(k * 100)}%</b></div>
      <span className="gr-l">{label}</span><small>{fmt(value)} / {fmt(target)}{sub ? " · " + sub : ""}</small>
    </div>
  );
}

/* ---------- system: status rows with a 30-day strip ---------- */
export function StatusRows({ rows }: { rows: { l: string; ok: boolean | null; note: string; days?: number[] }[] }) {
  return (
    <ul className="srows">
      {rows.map((r) => (
        <li key={r.l}>
          <span className={"sr-d " + (r.ok == null ? "" : r.ok ? "ok" : "bad")} />
          <b>{r.l}</b>
          <span className="sr-n">{r.note}</span>
          {r.days && <span className="sr-strip">{r.days.slice(-30).map((v, i) => <i key={i} className={v > 0 ? "bad" : "ok"} title={v > 0 ? `${v} hiba` : "rendben"} />)}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- live: who is where right now ---------- */
export function NowSteps({ steps }: { steps: { l: string; n: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.n));
  if (!steps.length) return <p className="note">Most senki nincs egy lépésen sem.</p>;
  return <ul className="nows">{steps.map((s) => <li key={s.l}><span>{s.l}</span><i><em style={{ width: `${(s.n / max) * 100}%` }} /></i><b>{s.n}</b></li>)}</ul>;
}

/* tiny confetti burst at an element (a finished action, a record) */
export function burst(el: HTMLElement | null) {
  if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), box = document.createElement("div");
  box.className = "burst"; box.style.left = r.left + r.width / 2 + "px"; box.style.top = r.top + r.height / 2 + "px";
  ["#FFB547", "#FF4FA3", "#8B5CF6", "#2BA597", "#5B5BD6"].forEach((c, i) => { for (let j = 0; j < 4; j++) { const p = document.createElement("i"); const a = ((i * 4 + j) / 20) * Math.PI * 2; p.style.background = c; p.style.setProperty("--dx", Math.cos(a) * (40 + j * 14) + "px"); p.style.setProperty("--dy", Math.sin(a) * (40 + j * 14) + "px"); box.appendChild(p); } });
  document.body.appendChild(box); setTimeout(() => box.remove(), 900);
}
