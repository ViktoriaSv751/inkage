"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CountUp, Delta, Empty, Info, Spark, StackedColumns, TrendChart, chColor, fmt, pct, SERIES } from "../charts";
import { Logo } from "../wow";
import { ActionCard, type Tone } from "../visuals";
import { ALL_DAYS, Band, Card, bpParts, daysLabel, FreshRow, I, Kpi, Loading, MOCK, Mini, P, PF, PERIODS, POOL, Tbl, ago, api, big, dt, n, rpc, type D, useRpc, Layer, SOC, useFreshSocial, NeedKey } from "../shared";
import { Retention } from "./youtube";
import { ChartBox, More } from "../extra";
import { CloseX, phoneNow, pushRecent, Sheet, SubTabs, toast, usePhone } from "../phone";
import { copyText } from "./phone-security";
import { Coverage, ManualPost, PfEmpty, ReachMatrix, Timeline } from "./social-wave";
import { ContentMatrix, PostHeat, VideoWall, fmtX } from "./visual";
import { Feed, WeekTab } from "./social-phone";
import { Chg, Giant, Hero, Trio } from "../ink";

/* the run covers everything; the button says only what belongs to the page it stands on */
const SYNC_SCOPE: Record<string, string[]> = { stores: ["apple", "google", "competitors"], search: ["gsc"], social: [...SOC], audience: [...SOC], youtube: ["youtube"] };
const SYNC_L: Record<string, string> = { gsc: "Google", apple: "App Store", google: "Google Play", competitors: "Versenytársak" };
export function SyncButton({ done }: { done: () => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/admin/sync", { method: "POST" }); const j = r.json || {}, scope = SYNC_SCOPE[location.hash.slice(1)];
      setMsg(r.ok ? Object.entries(j).filter(([k]) => k !== "ok" && (!scope || scope.includes(k))).map(([k, v]) => `${PF[k] || SYNC_L[k] || k}: ${v}`).join(" · ") || "Kész, ehhez az oldalhoz nem jött új adat." : j.error || "Nem sikerült.");
    } finally { setBusy(false); done(); }
  };
  return <span className="adm-row sync-b">{msg && <span className="note">{msg}</span>}<button className={"adm-ibtn" + (busy ? " busy" : "")} onClick={go} disabled={busy}>{I(P.refresh)}Adatok lehúzása most</button></span>;
}


export function Setup({ only }: { only?: ("tiktok" | "instagram" | "gsc")[] }) {
  const [s, setS] = useState<D | null>(null);
  useEffect(() => { api("/api/admin/status").then((r) => setS(r.ok ? r.json : null)).catch(() => {}); }, []);
  if (!s) return null;
  const all = [
    { k: "tiktok", ok: !!s.tiktok, tone: "peach" as Tone, t: "TikTok-kulcsok", p: "A TikTok fejlesztői appod két kulcsa kell: a Kapcsolatok oldalon telefonról is megadhatod." },
    { k: "instagram", ok: !!s.instagram, tone: "lilac" as Tone, t: "Instagram-kulcsok", p: "Az Instagram-app azonosítója és titkos kulcsa: a Kapcsolatok oldalon lépésről lépésre." },
    { k: "gsc", ok: !!s.gsc, tone: "sky" as Tone, t: "Google Search Console", p: "Egy Google-szolgáltatásfiók kulcsfájlja: a Kapcsolatok oldalon feltöltheted." },
  ].filter((x) => !only || only.includes(x.k as "tiktok"));
  const miss = all.filter((x) => !x.ok);
  if (!miss.length) return null;
  return <section className="acts s12">{miss.map((x) => <ActionCard key={x.k} tone={x.tone} title={x.t} text={x.p} cta="Bekötés" onClick={() => { location.hash = "connect"; }} />)}</section>;
}


/* the Bing card while there is no Bing data: "Kösd be" only when the key is missing; with the key the data is on its way */
export function BingEmpty() {
  const [k, setK] = useState<boolean | null>(null);
  useEffect(() => { api("/api/admin/status").then((r) => setK(r.ok ? !!r.json?.bing : null)).catch(() => {}); }, []);
  if (k) return <Empty t="Bekötve – a Bing adatai 48 órán belül érkeznek (a Bing Webmaster Tools 1–2 nap késéssel ad adatot)." icon={P.search} />;
  return <Empty t="Kösd be a Bing Webmaster Toolst a Kapcsolatok oldalon (Microsoft-fiókkal)." icon={P.search}><NeedKey k="BING_WMT_KEY" /><a className="adm-ibtn gold" href="#connect">Kapcsolatok</a></Empty>;
}

/* platforms do not count on one scale (a Pinterest "view" is an impression, a TikTok view a play), so a post is ranked
   against its own platform: its views ÷ the median views of that platform's posts */
/* a post younger than a day has not had its views yet: it gets no multiplier and is not part of anyone's median */
export const MIN_AGE_H = 24;
export const tooYoung = (p: D) => !!p.created_at && Date.now() - new Date(p.created_at).getTime() < MIN_AGE_H * 36e5;
export const YOUNG_T = "24 óránál fiatalabb poszt: még nem összevethető";
/* ref: the posts the median is taken from. Pass every post (admin_social's "cal") so the multiplier does not change with
   the chosen period; the post itself is left out of its own median, as on the post's own sheet */
export function vsMedian(posts: D[], ref?: D[]) {
  const pool = (ref && ref.length ? ref : posts).filter((p) => n(p.views) > 0 && !tooYoung(p));
  const by: Record<string, { v: number[]; ids: Set<string> }> = {};
  pool.forEach((p) => { const o = (by[p.platform] ||= { v: [], ids: new Set() }); o.v.push(n(p.views)); o.ids.add(String(p.post_id)); });
  Object.values(by).forEach((o) => o.v.sort((a, b) => a - b));
  const med = (s: number[], skip: number) => { /* the median of s without one element of value "skip" (-1: none) */
    const i = skip < 0 ? -1 : s.indexOf(skip), m = s.length - (i < 0 ? 0 : 1); if (m < 1) return null;
    const g = (k: number) => (i < 0 || k < i ? s[k] : s[k + 1]);
    return m % 2 ? g((m - 1) / 2) : (g(m / 2 - 1) + g(m / 2)) / 2;
  };
  return (p: D): number | null => {
    const o = by[p.platform]; if (p.views == null || !o || tooYoung(p)) return null;
    const md = med(o.v, o.ids.has(String(p.post_id)) && n(p.views) > 0 ? n(p.views) : -1);
    return md ? n(p.views) / md : null;
  };
}
export const engagement = (p: D) => (n(p.views) > 0 ? (n(p.likes) + n(p.comments) + n(p.shares) + n(p.saves)) / n(p.views) : null);
/* "+7 nap" needs the post's daily snapshot of a week ago: the snapshots started on 2026-10-22, so the first values come a week after */
export const GAIN_T = "Még nincs 7 nappal korábbi napi pillanatkép erről a posztról (a posztok napi pillanatképe 2026. okt. 22-én indult): az első érték egy héttel az első pillanatkép után jelenik meg.";
export const gain7 = (p: D) => (p.views_week_ago != null && p.views != null ? n(p.views) - n(p.views_week_ago) : null);
/* what the platform's "views" and "likes" really are */
export const viewWord = (pf: string) => (pf === "pinterest" || pf === "linkedin" ? "megjelenés" : "megtekintés");
export const likeWord = (pf: string) => (pf === "pinterest" ? "pin-kattintás" : "kedvelés");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const TT_CSV = "A TikTok ezt az API-n nem adja ki: csak a TikTok Studio CSV-exportjából jön (lent: Export feltöltése).";
/* a log line with partly failed requests, in plain words: the data of the run did arrive */
const partialWhy = (m?: string | null) => { const t = String(m || ""), o: string[] = [];
  if (/403/.test(t)) o.push(t.match(/nincs statisztika ehhez a pinhez: „[^”]*”/)?.[0] || "egy pinhez nincs statisztika (valószínűleg mentett, nem a saját pined)");
  if (/404/.test(t)) o.push("a közönségadatot a Pinterest nem adja ki");
  if (/500/.test(t)) o.push("a platform egy kérésnél hibázott");
  return o.join(" · "); };
/* a Pinterest pin has no likes: its pin clicks stand in the like's place, under their own name */
const likeOf = (p: D) => (p.platform === "pinterest" ? p.pin_clicks ?? null : p.likes);
const isImp = (pf: string) => viewWord(pf) === "megjelenés";
/* the platform buttons: always all six, so it shows which one is missing; the ones without posts (not connected, nothing
   added by hand) are faint, and choosing one says why it is empty */
export function PfTabs({ pfs, v, set }: { pfs: string[]; v: string; set: (k: string) => void }) {
  return <div className="pf-tabs ic-pft" role="group" aria-label="Platform">{["all", ...SOC].map((k) => { const has = k === "all" || pfs.includes(k);
    return <button key={k} type="button" aria-pressed={v === k} aria-label={k === "all" ? "Minden platform" : PF[k] || k} className={has ? undefined : "off"} title={has ? PF[k] : `${PF[k]}: még nincs posztja itt (nincs bekötve, vagy nincs poszt ebben az időszakban)`} onClick={() => set(k)}>{k === "all" ? <span className="ic-pft-a">Mind</span> : <><Logo k={k} size={24} />{v === k && <span className="ic-pft-l">{PF[k] || k}</span>}</>}</button>; })}</div>;
}

export function PostCard({ p, rank, compact: cmp, onOpen, mult }: { p: D; rank?: number; compact?: boolean; onOpen?: (p: D) => void; mult?: number | null }) {
  const rate = n(p.views) > 0 && p.code ? (n(p.sessions) * 1000) / n(p.views) : null;
  return (
    <a className={"post" + (cmp ? " cmp" : "")} href={p.url || undefined} target="_blank" rel="noreferrer" onClick={onOpen ? (e) => { e.preventDefault(); onOpen(p); } : undefined}>
      <div className="post-img">
        {p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="ph"><Logo k={p.platform} size={46} /></span>}
        <span className="pf"><i style={{ background: chColor(p.platform) }} />{PF[p.platform]}{p.kind && !cmp ? " · " + (KIND[p.kind] || p.kind) : ""}</span>
        {rank && <span className="rk">#{rank}</span>}
        {mult != null && <span className="mx" title={`A ${PF[p.platform]}-posztjaid szokásos (medián) ${viewWord(p.platform)}ének ${fmt(mult, 1)}-szerese`}>{fmtX(mult)}×</span>}
        <div className="views"><div><b>{big(p.gained ?? p.views)}</b><br /><span>{p.gained != null ? `új ${viewWord(p.platform)}` : viewWord(p.platform)}</span></div><span>{ago(p.created_at)}</span></div>
      </div>
      <div className="post-b">
        {!cmp && <div className="post-t">{p.title || "(nincs szöveg)"}</div>}
        <div className="post-m">
          <div className="gold"><b>{p.code ? fmt(p.sessions) : "–"}</b><span>látogató</span></div>
          <div><b>{rate == null ? "–" : fmt(rate, 1)}</b><span>/1000</span></div>
          <div><b>{big(likeOf(p))}</b><span>{likeWord(p.platform)}</span></div>
        </div>
      </div>
    </a>
  );
}

/* ---------- the post grid: three columns edge to edge, the number on the picture ---------- */
function GridTile({ p, onOpen, mult, rank }: { p: D; onOpen: (p: D) => void; mult?: number | null; rank?: number }) {
  const [bad, setBad] = useState(false); const pic = p.thumb && !bad;
  return (
    <button type="button" className={"ic-tile" + (pic ? "" : " noimg")} onClick={() => onOpen(p)} aria-label={`${PF[p.platform]}: ${big(p.gained ?? p.views)} ${viewWord(p.platform)}. ${String(p.title || "").slice(0, 60)}`}>
      {pic ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} /> : <em>{String(p.title || "(nincs szöveg)").slice(0, 70)}</em>}
      <span className="ic-tile-pf"><Logo k={p.platform} size={20} /></span>
      {rank ? <span className="ic-tile-x">#{rank}</span> : null}
      {mult != null ? <span className="ic-tile-x r">{fmtX(mult)}×</span> : null}
      <b className="ic-tile-v">{I(isImp(p.platform) ? P.eye : P.play)}{p.gained != null ? "+" : ""}{big(p.gained ?? p.views)}</b>
    </button>
  );
}
export function PostGrid({ posts, onOpen, mult, ranked }: { posts: D[]; onOpen: (p: D) => void; mult?: (p: D) => number | null | undefined; ranked?: boolean }) {
  return <div className="ic-grid">{posts.map((p, i) => <GridTile key={p.platform + p.post_id} p={p} onOpen={onOpen} mult={mult?.(p)} rank={ranked ? i + 1 : undefined} />)}</div>;
}

/* ---------- the ranking: a large picture, the number as a price tag in the bottom right corner ---------- */
function RankTile({ p, i, x, onOpen }: { p: D; i: number; x?: number | null; onOpen: (p: D) => void }) {
  const [bad, setBad] = useState(false); const pic = p.thumb && !bad, v = p.gained ?? p.views;
  return (
    <button type="button" className={"ic-rk" + (pic ? "" : " noimg")} onClick={() => onOpen(p)} aria-label={`${i + 1}. hely, ${PF[p.platform]}: ${big(v)} ${viewWord(p.platform)}`}>
      <span className="ic-rk-p">{pic ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} /> : <em>{String(p.title || "(nincs szöveg)").slice(0, 90)}</em>}
        <span className="ic-rk-n">{i + 1}</span><span className="ic-rk-l"><Logo k={p.platform} size={24} /></span>
        <span className="ic-rk-tag"><b>{p.gained != null ? "+" : ""}{big(v)}</b><small>{viewWord(p.platform)}</small></span></span>
      <span className="ic-rk-t"><span>{String(p.title || "(nincs szöveg)")}</span>{x != null ? <small>{fmtX(x)}× a szokásos</small> : tooYoung(p) ? <small>friss</small> : null}</span>
    </button>
  );
}
export function PostRank({ posts, onOpen, mult }: { posts: D[]; onOpen: (p: D) => void; mult?: (p: D) => number | null | undefined }) {
  return <div className="ic-rks">{posts.map((p, i) => <RankTile key={p.platform + p.post_id} p={p} i={i} x={mult?.(p)} onOpen={onOpen} />)}</div>;
}

/* ---------- the best posts on top: a large picture fading into the page, the number on it, swiped with progress dashes ---------- */
export function Featured({ posts, vs, label, open }: { posts: D[]; vs: (p: D) => number | null; label: string; open: (p: D) => void }) {
  const ref = useRef<HTMLDivElement>(null); const [at, setAt] = useState(0);
  const top = useMemo(() => [...posts].filter((p) => n(p.views) > 0).sort((a, b) => (vs(b) ?? -1) - (vs(a) ?? -1) || n(b.views) - n(a.views)).slice(0, 5), [posts, vs]);
  if (!top.length) return null;
  const go = (i: number) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); };
  return (
    <section className="ic-feat" aria-label={label}>
      <div className="ic-feat-top">
        <span className="ic-feat-l">{label}<Info>A saját platformja szokásos (medián) posztjához mérve, így a platformok egy mércén vannak. A 24 óránál fiatalabb poszt a sor végére kerül.</Info></span>
        {top.length > 1 && <span className="ic-dash">{top.map((p, i) => <button key={p.platform + p.post_id} type="button" aria-label={`${i + 1}. poszt`} aria-current={i === at ? "true" : undefined} onClick={() => go(i)}><i className={i <= at ? "on" : ""} /></button>)}</span>}
      </div>
      <div className="ic-feat-s" ref={ref} onScroll={(e) => { const el = e.currentTarget; if (el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {top.map((p) => { const x = vs(p); return (
          <button key={p.platform + p.post_id} type="button" className={"ic-feat-i" + (p.thumb ? "" : " noimg")} onClick={() => open(p)}>
            {p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="ic-feat-ph"><Logo k={p.platform} size={64} /></span>}
            <span className="ic-feat-b">
              <Giant text={big(p.views)} max={148} />
              <span className="ic-feat-w"><b>{viewWord(p.platform)}</b>{x != null ? <span className={"ink-chg " + (x >= 1 ? "up" : "down")}>{fmtX(x)}× a szokásos</span> : tooYoung(p) ? <span className="ink-chg same">friss</span> : null}</span>
              <span className="ic-feat-t"><Logo k={p.platform} size={22} /><span>{String(p.title || "(nincs szöveg)")}</span><time>{ago(p.created_at)}</time></span>
            </span>
          </button>); })}
      </div>
    </section>
  );
}

/* what each platform needs before it can be connected */
const NEED: Record<string, string> = {
  tiktok: "TikTok-fiók és a TikTok fejlesztői app két kulcsa.",
  instagram: "Instagram Business- vagy Creator-fiók (vagy egy Facebook-oldalhoz kötött Instagram).",
  facebook: "Egy Facebook-oldal, amit kezelsz, és a Meta-app (telefonos regisztrációval).",
  pinterest: "Pinterest üzleti fiók és az app Standard hozzáférése (beküldés után).",
  linkedin: "Céges LinkedIn-oldal adminként és a Community Management API jóváhagyása.",
  youtube: "Google Cloud-projekt a YouTube Data és Analytics API-val; az OAuth-app legyen „Production” (Testing módban 7 naponta lejár).",
};
/* the leaderboard's columns that can be switched off */
const OPT_COLS: [string, string][] = [["x", "× medián"], ["gain", "+7 nap"], ["eng", "Elköteleződés"], ["likes", "Kedvelés"], ["comments", "Komment"], ["shares", "Megosztás"], ["saves", "Mentés"],
  ["imp", "Megjelenés"], ["reach", "Elérés"], ["clicks", "Kattintás"], ["watch_avg", "Átl. nézési idő"], ["completion", "Végignézés"], ["profile_visits", "Profilnézés"], ["follows", "Új követő"],
  ["sessions", "Látogató"], ["rate", "/1000"], ["scored", "Előnézet"]];
const colsKey = "inkage.admin.postcols";
const readCols = (): string[] => { try { const v = JSON.parse(localStorage.getItem(colsKey) || "null"); return Array.isArray(v) ? v : OPT_COLS.map(([k]) => k); } catch { return OPT_COLS.map(([k]) => k); } };

type SortK = "date" | "x" | "views" | "gain" | "gained" | "eng" | "likes" | "comments" | "shares" | "saves" | "watch" | "follows" | "sessions" | "rate";
const SORTS: [SortK, string][] = [["date", "Legújabb"], ["x", "A platformja átlagához képest"], ["views", "Megtekintés / megjelenés"], ["gain", "Növekedés az elmúlt 7 napban"], ["gained", "Ebben az időszakban szerzett"],
  ["eng", "Elköteleződési arány"], ["likes", "Kedvelés"], ["comments", "Komment"], ["shares", "Megosztás"], ["saves", "Mentés"], ["watch", "Átlagos nézési idő"], ["follows", "Új követő"], ["sessions", "Látogató"], ["rate", "Látogató / 1000"]];
const PAGE = 48;

/* a list of posts as CSV (the cards have no table to export from) */
function postsCsv(rows: D[], name: string) {
  const esc = (v: unknown) => { const t = v == null ? "" : String(v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const cols: [string, (r: D) => unknown][] = [["Platform", (r) => PF[r.platform] || r.platform], ["Dátum", (r) => (r.created_at ? String(r.created_at).slice(0, 10) : "")], ["Típus", (r) => KIND[r.kind] || r.kind], ["Szöveg", (r) => r.title], ["Link", (r) => r.url],
    ["Megtekintés / megjelenés", (r) => r.views], ["Ebben az időszakban", (r) => r.gained], ["× medián", (r) => (r.x != null ? r.x.toFixed(2) : "")], ["+7 nap", (r) => r.gain], ["Elköteleződés %", (r) => (r.eng != null ? (r.eng * 100).toFixed(2) : "")],
    ["Kedvelés / pin-kattintás", likeOf], ["Komment", (r) => r.comments], ["Megosztás", (r) => r.shares], ["Mentés", (r) => r.saves], ["Megjelenés", (r) => r.imp], ["Elérés", (r) => r.reach], ["Kattintás", (r) => r.clicks],
    ["Átl. nézési idő (mp)", (r) => r.watch_avg], ["Új követő", (r) => r.follows], ["Követőkód / rövid link", (r) => r.code], ["Látogató", (r) => (r.code ? r.sessions : "")], ["/1000", (r) => (r.rate != null ? r.rate.toFixed(2) : "")], ["Előnézet", (r) => (r.code ? r.scored : "")]];
  const body = [cols.map(([l]) => esc(l)).join(";"), ...rows.map((r) => cols.map(([, f]) => esc(f(r))).join(";"))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Social({ days }: { days: number }) {
  const { d, e, load } = useRpc("admin_social", { p_days: days }, [days]);
  /* "Videók és posztok" has a period of its own, "Összes" by default: the list is not emptied by the period chosen at the top.
     Its own numbers are asked only when its period differs from the top one. */
  const [secDays, setSecDays] = useState(0);
  const secEff = secDays || ALL_DAYS, secSame = secEff === days;
  const sec = useRpc("admin_social", { p_days: secEff }, [secEff], secSame);
  const secLoad = useRef(sec.load); secLoad.current = sec.load;
  const loadBoth = () => { load(); if (!secSame) secLoad.current(); };
  const reach = useRpc("admin_social_reach", undefined, []);
  const [pf, setPf] = useState<string>("all");
  const [sort, setSort] = useState<SortK>("date");
  const [view, setView] = useState<"grid" | "rank" | "timeline" | "wall" | "matrix" | "cards" | "table" | "content" | "top3">("grid");
  const [heatPf, setHeatPf] = useState("all");
  const [manual, setManual] = useState<D | null>(null);
  /* a phone: a sideways swipe over the list steps to the next platform (what scrolls sideways itself keeps the finger) */
  const tx = useRef(0), ty = useRef(0), swOff = useRef(false);
  const [mode, setMode] = useState<"born" | "gained">("born");
  const [kind, setKind] = useState("all"); const [linked, setLinked] = useState(false); const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [cols, setCols] = useState<string[]>(OPT_COLS.map(([k]) => k));
  const [tagPf, setTagPf] = useState("all"); const [tagM, setTagM] = useState<"x" | "eng" | "rate">("x");
  const [visV, setVisV] = useState<"pf" | "posts">("pf");
  const [calPf, setCalPf] = useState("all");
  const [allSync, setAllSync] = useState(false);
  const [openP, setOpenP] = useState<D | null>(null);
  /* the phone: the posts as a feed, what worked, and only then the numbers */
  const phone = usePhone(); const [ptab, setPtab] = useState<"feed" | "week" | "nums">("feed");
  const fresh = useFreshSocial((d as D | null)?.accounts, () => { load(); secLoad.current(); });
  useEffect(() => { setShown(PAGE); }, [pf, sort, kind, linked, q, mode, secDays]);
  useEffect(() => { setCols(readCols()); }, []);
  /* the chosen view's button slides into the row's visible part; only the row moves, never the page */
  const segRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = segRef.current, b = el?.querySelector('[aria-pressed="true"]') as HTMLElement | null; if (!el || !b) return; const a = el.getBoundingClientRect(), c = b.getBoundingClientRect(); el.scrollTo({ left: el.scrollLeft + c.left - a.left - (a.width - c.width) / 2, behavior: "smooth" }); }, [view, ptab, !!d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  POOL.posts = d.posts || [];
  CAL = d.cal?.length ? d.cal : d.posts || CAL;
  const accs: D[] = d.accounts || [];
  const acc = (p: string) => accs.find((a) => a.platform === p);
  const on0 = () => SOC.filter((p) => acc(p));
  const daily = (p: string) => (d.daily || []).filter((x: D) => x.platform === p);
  const last = (p: string) => daily(p).slice(-1)[0];
  /* the latest day that carries this number, and which day it was */
  const lastWith = (p: string, k: string) => [...daily(p)].reverse().find((x: D) => x[k] != null) as D | undefined;
  const dayL = (x?: D) => (x ? new Date(x.day).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "");
  /* followers a week before the last row, by date, not by row count */
  const weekAgo = (p: string) => { const a = daily(p).filter((x: D) => x.followers != null); const l = a.slice(-1)[0]; if (!l) return null; const t = new Date(l.day).getTime() - 7 * 864e5; return [...a].reverse().find((x: D) => new Date(x.day).getTime() <= t) || null; };
  const rate = (r: D) => (n(r.views) > 0 && r.code ? (n(r.sessions) * 1000) / n(r.views) : -1);
  const all: D[] = d.posts || [];
  /* every post (the calendar's list) is the median's base: the multiplier is the same in every period */
  const vs = vsMedian(all, d.cal || []);
  const deco = (p: D): D => ({ ...p, x: vs(p), gain: gain7(p), eng: engagement(p), rate: rate(p) >= 0 ? rate(p) : null, imp: p.impressions ?? (isImp(p.platform) ? p.views : null), likesShown: likeOf(p) });
  /* the posts of "Videók és posztok", by its own period (the top one's numbers when the two are the same) */
  const S: D | null = secSame ? d : (sec.d as D | null);
  const sAll: D[] = S?.posts || [];
  /* "ebben az időszakban szerzett": the posts of the period with all their views, and older posts with what they gathered since the period began */
  const gainedList: D[] = [...sAll.map((p) => ({ ...p, gained: n(p.period_gain ?? p.views) })), ...((S?.active || []) as D[]).map((p) => ({ ...p, gained: n(p.period_gain ?? Math.max(0, n(p.views) - n(p.views_start))) }))];
  const SORT: Record<SortK, (p: D) => number> = { x: (p) => p.x ?? -1, views: (p) => n(p.views), gain: (p) => p.gain ?? -1, gained: (p) => p.gained ?? -1, eng: (p) => p.eng ?? -1,
    likes: (p) => n(likeOf(p)), comments: (p) => n(p.comments), shares: (p) => n(p.shares), saves: (p) => n(p.saves), watch: (p) => (p.watch_avg == null ? -1 : n(p.watch_avg)), follows: (p) => n(p.follows),
    sessions: (p) => n(p.sessions), rate: (p) => p.rate ?? -1, date: (p) => new Date(p.created_at || 0).getTime() };
  const ql = q.trim().toLowerCase();
  const base = (mode === "gained" ? gainedList : sAll).map(deco);
  const kinds = Array.from(new Set([...base, ...((d.cal || []) as D[])].filter((r) => pf === "all" || r.platform === pf).map((r) => r.kind).filter(Boolean))) as string[];
  const posts: D[] = base.filter((r) => (pf === "all" || r.platform === pf) && (kind === "all" || r.kind === kind) && (!linked || r.code) && (!ql || String(r.title || "").toLowerCase().includes(ql) || String(r.code || "") === ql))
    .sort((a, b) => SORT[mode === "gained" && sort === "date" ? "gained" : sort](b) - SORT[mode === "gained" && sort === "date" ? "gained" : sort](a) || n(b.views) - n(a.views));
  const postPfs = SOC.filter((k) => acc(k) || all.some((x: D) => x.platform === k));
  const secPfs = SOC.filter((k) => acc(k) || sAll.some((x: D) => x.platform === k));
  /* the section's period on the timeline, the wall and the matrix too: Budapest days, as the database counts them */
  const secFrom = secDays ? bpDay(new Date(Date.now() - (secDays - 1) * 864e5)) : "";
  const inSec = (r: D) => !secFrom || (!!r.created_at && bpDay(new Date(r.created_at)) >= secFrom);
  /* the timeline: every post ever (not only the period's), with the same platform, type and text filters */
  const calAll: D[] = (d.cal?.length ? d.cal : all) as D[];
  const tlPosts = calAll.filter((r) => inSec(r) && (pf === "all" || r.platform === pf) && (kind === "all" || r.kind === kind) && (!ql || String(r.title || "").toLowerCase().includes(ql)));
  const calPfs = SOC.filter((k) => acc(k) || calAll.some((x: D) => x.platform === k));
  const vsAll = vsMedian(calAll, calAll);
  const allTime = view === "timeline" || view === "wall" || view === "matrix";
  const R: D | null = (reach.d as D | null) || null;
  const reloadAll = () => { loadBoth(); reach.load(); };
  const addPost = (p: string) => setManual({ platform: p === "all" ? "" : p });
  const tlEmpty = pf !== "all" && !calAll.some((x) => x.platform === pf) ? <PfEmpty pf={pf} connected={!!acc(pf)} add={addPost} />
    : <Empty t={q || kind !== "all" || pf !== "all" ? "Nincs a szűrésnek megfelelő poszt." : secDays ? "Ebben az időszakban nincs poszt." : "Még nincs poszt. Kösd be a platformokat, vagy vedd fel a posztokat kézzel."} icon={P.social}>{secDays && !q && kind === "all" ? <button className="adm-ibtn" onClick={() => setSecDays(0)}>Összes poszt</button> : null}</Empty>;
  /* the matrix's rows follow the filters; each row still shows its content on every platform, so "érdemes kitenni" stays true */
  const tlIds = new Set(tlPosts.map((r) => r.platform + "|" + r.post_id));
  const pickPf = (p: string) => { setPf(p); setKind("all"); setView("timeline"); document.getElementById("soc-posts")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  /* every Budapest day of the period gets its column, the empty ones too (the chart used to skip them) */
  const visits: D[] = fillDays((d.visits || []) as D[], days);
  const sum = (k: string) => visits.reduce((t, x) => t + n(x[k]), 0);
  /* plays and impressions are not added together: Pinterest and LinkedIn give impressions only */
  const inPf = all.filter((x) => pf === "all" || x.platform === pf);
  const realViews = inPf.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.views), 0), imps = inPf.filter((x) => isImp(x.platform)).reduce((t, x) => t + n(x.views), 0);
  /* what every post (old ones too) gathered on the chosen days, by platform: the number for "Megtekintés az időszakban" */
  const G: D = d.gained || {}, inG = (p: string) => pf === "all" || p === pf;
  const gotViews = Object.keys(G).filter((p) => inG(p) && !isImp(p)).reduce((t, p) => t + n(G[p]), 0);
  /* the change is taken on finished days: today is only part of a day. "Ma" has nothing whole to compare with */
  const partDay = days === 1, GF: D = d.gained_full || {}, GFP: D = d.gained_full_prev || {}, FV: D = d.full || {};
  const fullNow = Object.keys(GF).filter((p) => inG(p) && !isImp(p)).reduce((t, p) => t + n(GF[p]), 0), fullPrev = Object.keys(GFP).filter((p) => inG(p) && !isImp(p)).reduce((t, p) => t + n(GFP[p]), 0);
  /* Pinterest: the account's day numbers up to its last day with data (the pins' own numbers arrive days later) */
  const PIN: D | null = d.pin || null, pinDay = PIN?.last_day ? new Date(String(PIN.last_day).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "";
  const pinShown = !partDay && inG("pinterest") && PIN?.imps != null;
  const gotImps = Object.keys(G).filter((p) => inG(p) && isImp(p) && p !== "pinterest").reduce((t, p) => t + n(G[p]), 0) + (pinShown ? n(PIN!.imps) : 0);
  const inter = inPf.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.likes) + n(x.comments) + n(x.shares) + n(x.saves), 0);
  /* "from the videos": only posts with a trackable link can be counted. Pins are told apart: a Pinterest utm code is no short link, and impressions are no views */
  const tagged = inPf.filter((x) => x.code && !isImp(x.platform)), tv = tagged.reduce((t, x) => t + n(x.sessions), 0), tvViews = tagged.reduce((t, x) => t + n(x.views), 0);
  const pinsCoded = inPf.filter((x) => x.code && x.platform === "pinterest"), pinVisits = pinsCoded.reduce((t, x) => t + n(x.sessions), 0);
  const vidNone = !tagged.length;
  const MS: D = d.measure || {}, noWay = on0().filter((p) => !n(MS[p]?.tagged) && !n(MS[p]?.visits_ever));
  const PV: D = d.prev || {}, pp: D = PV.posts || {}, pl: D = PV.leads || {};
  const prevOf = (k: string, f: (pf: string) => boolean = () => true) => Object.entries(pp).filter(([p]) => (pf === "all" || p === pf) && f(p)).reduce((t, [, v]) => t + n((v as D)[k]), 0);
  const prevViews = prevOf("views", (p) => !isImp(p)), prevInter = ["likes", "comments", "shares", "saves"].reduce((t, k) => t + prevOf(k, (p) => !isImp(p)), 0);
  const prevTv = prevOf("sessions", (p) => !isImp(p)), prevTvViews = prevOf("tagged_views", (p) => !isImp(p));
  const on = on0(), off = SOC.filter((p) => !acc(p));
  /* the band names the platforms the visitors came from, not the connected accounts */
  const visPfs = SOC.filter((p) => sum(p) > 0);
  const allVisits = SOC.reduce((t, p) => t + sum(p), 0), prevVisits = Object.values(pl).reduce((t: number, v) => t + n((v as D).sessions), 0);
  const fvNow = Object.values(FV).reduce((t: number, v) => t + n((v as D).now), 0), fvPrev = Object.values(FV).reduce((t: number, v) => t + n((v as D).prev), 0);
  const perLabel = partDay ? "ma eddig (éjfél óta)" : daysLabel(days);
  const gone: D[] = d.gone || [];
  const stack = visits.map((x: D) => ({ t: x.t, v: Object.fromEntries(SOC.map((p) => [p, n(x[p])])) }));
  const marks = all.filter((p) => p.created_at).slice(0, 40).map((p) => ({ t: new Date(p.created_at).toISOString().slice(0, 10), label: `${PF[p.platform]}: ${String(p.title || "").slice(0, 40)}`, color: chColor(p.platform) }));
  const leads: D[] = ((d.leads || []) as D[]).map((r) => ({ ...r, prev: n(pl[r.k]?.sessions), conv_s: n(r.sessions) ? n(r.signups) / n(r.sessions) : null }));
  const pfPosts = (p: string) => all.filter((x) => x.platform === p);
  const engOf = (p: string) => { const ps = pfPosts(p).filter((x) => n(x.views) > 0); const v = ps.reduce((t, x) => t + n(x.views), 0); return v ? ps.reduce((t, x) => t + n(x.likes) + n(x.comments) + n(x.shares) + n(x.saves), 0) / v : null; };
  /* the second number each platform gives besides followers, exactly as it names it, and the day it belongs to */
  const second = (p: string) => {
    if (p === "tiktok") return <Mini l="Összes kedvelés" v={big(last(p)?.likes)} />;
    if (p === "instagram" || p === "facebook") { const r = lastWith(p, "reach"); return <Mini l={`Elérés (${r ? dayL(r) : "tegnap"})`} v={big(r?.reach)} sub={p === "instagram" && lastWith(p, "profile_views") ? `${fmt(lastWith(p, "profile_views")!.profile_views)} profilnézés` : undefined} />; }
    if (p === "pinterest") { const r = lastWith(p, "impressions_30d"); return <Mini l="Megjelenés (30 nap)" v={big(r?.impressions_30d)} sub={lastWith(p, "impressions") ? `${big(lastWith(p, "impressions")!.impressions)} egy nap alatt (${dayL(lastWith(p, "impressions"))})` : undefined} />; }
    if (p === "linkedin") { const r = lastWith(p, "impressions"); return <Mini l={`Megjelenés (${r ? dayL(r) : "napi"})`} v={big(r?.impressions)} sub={r?.clicks != null ? `${fmt(r.clicks)} kattintás` : undefined} />; }
    const r = lastWith(p, "views_total"), w = lastWith(p, "views"); return <Mini l="Összes megtekintés" v={big(r?.views_total)} sub={w ? `${big(w.views)} egy nap alatt (${dayL(w)})` : undefined} />;
  };
  const state: D[] = d.sync_state || [];
  const toggleCol = (k: string) => { const nx = cols.includes(k) ? cols.filter((x) => x !== k) : [...cols, k]; setCols(nx); try { localStorage.setItem(colsKey, JSON.stringify(nx)); } catch {} };
  const vw = pf === "all" ? "Megtekintés" : cap(viewWord(pf)), lw = pf === "all" ? "Kedvelés" : cap(likeWord(pf));
  const allCols: { k: string; l: string; num?: boolean; r?: (row: D) => React.ReactNode }[] = [
    { k: "title", l: "Poszt", r: (r) => <span className="cellwrap" style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 380 }}>{r.thumb ? <img src={r.thumb} alt="" style={{ width: 34, height: 46, objectFit: "cover", borderRadius: 6, flex: "none" }} referrerPolicy="no-referrer" /> : null}<span><a href={r.url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={{ textDecoration: "none" }}>{(r.title || "(nincs szöveg)").slice(0, 80)}</a><br /><span className="mut">{KIND[r.kind] || r.kind || "Poszt"}{r.code && <> · {r.link_kind === "short" ? "rövid link" : "követőkód"}: <b>{r.code}</b></>}</span></span></span> },
    { k: "platform", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Logo k={r.platform} size={18} />{PF[r.platform]}</span> },
    { k: "created_at", l: "Dátum", r: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) : "–") },
    { k: "views", l: vw, num: true, r: (r) => <>{big(r.views)}{pf === "all" && isImp(r.platform) ? <div className="mut" style={{ fontSize: 11 }}>megjelenés</div> : null}</> },
    ...(mode === "gained" ? [{ k: "gained", l: "Ebben az időszakban", num: true, r: (r: D) => <b>+{big(r.gained)}</b> }] : []),
    { k: "x", l: "× medián", num: true, r: (r) => (r.x != null ? <b className={r.x >= 1 ? "up" : "down"} title={`A(z) ${PF[r.platform]}-posztjaid medián ${viewWord(r.platform)}ének ${fmt(r.x, 2)}-szerese (az összes posztod alapján, időszaktól függetlenül)`}>{fmtX(r.x)}×</b> : tooYoung(r) ? <span className="mut" title={YOUNG_T}>friss</span> : "–") },
    { k: "gain", l: "+7 nap", num: true, r: (r) => (r.gain != null ? "+" + big(Math.max(0, r.gain)) : <span className="mut" title={GAIN_T}>–</span>) },
    { k: "eng", l: "Elköteleződés", num: true, r: (r) => (r.eng != null ? fmt(r.eng * 100, 1) + "%" : "–") },
    { k: "likesShown", l: lw, num: true, r: (r) => <>{big(r.likesShown)}{pf === "all" && r.platform === "pinterest" ? <div className="mut" style={{ fontSize: 11 }}>pin-kattintás</div> : null}</> }, { k: "comments", l: "Komment", num: true, r: (r) => big(r.comments) },
    { k: "shares", l: "Megosztás", num: true, r: (r) => big(r.shares) }, { k: "saves", l: "Mentés", num: true, r: (r) => big(r.saves) },
    { k: "imp", l: "Megjelenés", num: true, r: (r) => <>{big(r.imp)}{r.ctr != null ? <div className="mut" style={{ fontSize: 11 }}>CTR {fmt(n(r.ctr) * 100, 1)}%</div> : null}</> }, { k: "reach", l: "Elérés", num: true, r: (r) => big(r.reach) }, { k: "clicks", l: "Kattintás", num: true, r: (r) => big(r.clicks) },
    { k: "watch_avg", l: "Átl. nézési idő", num: true, r: (r) => (r.watch_avg != null ? `${fmt(n(r.watch_avg), 1)} mp` : r.platform === "tiktok" ? <span className="mut" title={TT_CSV}>–</span> : "–") },
    { k: "completion", l: "Végignézés", num: true, r: (r) => (r.completion != null ? fmt(n(r.completion), 1) + "%" : r.platform === "tiktok" ? <span className="mut" title={TT_CSV}>–</span> : "–") },
    { k: "profile_visits", l: "Profilnézés", num: true, r: (r) => big(r.profile_visits) }, { k: "follows", l: "Új követő", num: true, r: (r) => big(r.follows) },
    { k: "sessions", l: "Látogató", num: true, r: (r) => (r.code ? <b>{fmt(r.sessions)}</b> : <span className="mut" title="Nincs követhető link a posztban">–</span>) },
    { k: "rate", l: "/1000", num: true, r: (r) => (r.rate != null ? fmt(r.rate, 1) : "–") },
    { k: "scored", l: "Előnézet", num: true, r: (r) => (r.code ? fmt(r.scored) : "–") },
  ];
  const tblCols = allCols.filter((c) => ["title", "platform", "created_at", "views", "gained"].includes(c.k) || cols.includes(c.k === "likesShown" ? "likes" : c.k));
  const top3 = secPfs.map((p) => ({ p, list: posts.filter((r) => r.platform === p).sort((a, b) => (b.x ?? -1) - (a.x ?? -1)).slice(0, 3) })).filter((x) => x.list.length);
  const pTabs = phone ? <SubTabs items={[{ k: "feed", l: "Posztok" }, { k: "week", l: "A hét" }, { k: "nums", l: "Számok" }]} cur={ptab} go={(k) => setPtab(k as typeof ptab)} /> : null;
  const sheets = <>{openP && <PostDrawer p={openP} close={() => setOpenP(null)} />}{manual && <ManualPost init={manual} close={() => setManual(null)} saved={reloadAll} />}</>;
  /* the page's one figure: what every post gathered on the chosen days. Impressions stay apart, they are a different unit */
  const hero = <Hero flip label={<>{pf === "all" ? "" : PF[pf] + ": "}{partDay ? "Megtekintés ma eddig" : `Megtekintés · ${perLabel}`}<Info>Amit az összes posztod (a régebbiek is, azok is, amelyek már nem látszanak az élő fiókon) ezeken a napokon kapott: a napi pillanatképek különbsége; ami a mérés kezdete előtt gyűlt össze, a poszt megjelenésének napjára számít. A változás a lezárt napokat veti össze, a mai félkész nap nélkül.</Info></>} v={n(gotViews)}
    chg={!partDay && fullPrev > 0 ? <Chg a={fullNow} b={fullPrev} tail="a lezárt napokon" /> : undefined}
    side={<Trio items={[{ l: "új poszt", v: fmt(inPf.length) }, { l: "látogató innen", v: fmt(pf === "all" ? allVisits : sum(pf)) }, { l: pinShown ? `megjelenés, ${pinDay}-ig` : "megjelenés", v: gotImps ? big(gotImps) : "–" }]} />} />;
  const bestAll = all.length >= 3;
  const feat = <Featured posts={bestAll ? all : calAll} vs={vsAll} label={bestAll ? `Legjobb posztok · ${partDay ? "ma" : perLabel}` : "Legjobb posztok · minden idők"} open={setOpenP} />;
  if (phone && ptab === "feed") return <div className="ic-page">{hero}{feat}{pTabs}<FreshRow srcs={[...SOC]} /><Feed posts={sAll} cal={calAll} accs={accs} open={setOpenP} add={addPost} />{sheets}</div>;
  if (phone && ptab === "week") return <div className="ic-page">{hero}{pTabs}<WeekTab posts={sAll} cal={calAll} daily={d.daily || []} accs={accs} open={setOpenP} go={(t) => { location.hash = t; }} />{sheets}</div>;
  return (
    <div className="g ic-soc">
      <div className="s12 ic-open">{hero}{phone ? null : feat}</div>
      {pTabs && <div className="s12">{pTabs}</div>}
      <FreshRow srcs={[...SOC, "events"]} />
      {fresh && <div className="s12 fresh-note"><span className="spin" />Friss számok a platformokról…</div>}
      {!phone && <Rising posts={calAll} accs={accs} onOpen={setOpenP} />}
      <div id="soc-posts" className="s12 anchor" />
      <Card className="s12 ic-posts" icon={P.social} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Videók és posztok" sub={<>Ennek a résznek <b>saját időszaka</b> van (alapból <b>Összes poszt</b>), a fölső időszak nem szűri: minden nézetre érvényes. <b>Idővonal</b>: minden poszt minden platformról, a legújabb felül, napokra bontva (a kézzel felvettek is). Megtekintés a platformtól (Pinteresten és LinkedInen megjelenés), látogató és elemzés a mi mérésünkből (a <b>inkage.app/go/kód</b> link alapján). <b>/1000</b> = látogató 1000 megtekintésenként: ez mutatja, melyik videó hoz tényleg embert. A <b>× medián</b> (és a <b>platformja átlagához képest</b> rendezés) minden posztot a saját platformod összes posztjának medián számához mér (a poszt maga nélkül, időszaktól függetlenül; a 24 óránál fiatalabb poszt még nem kap szorzót), így a TikTok-videók, a pinek és a LinkedIn-posztok egy listában is összevethetők. Az <b>Ebben az időszakban szerzett</b> nézet a régebbi posztokat is mutatja azzal, amit az időszakban gyűjtöttek. A <b>+7 nap</b> oszlop a 7 nappal korábbi napi pillanatképhez mér: a pillanatképek 2026. okt. 22-én indultak, ezért addig „–”.</>}
        right={<>
          <select className="adm-in sm" value={secDays} onChange={(x) => setSecDays(Number(x.target.value))} aria-label="Időszak a videókhoz és posztokhoz" title="Ennek a résznek a saját időszaka; a fölső időszak nem szűri">{[...PERIODS].sort((a, b) => (a.d === 0 ? -1 : b.d === 0 ? 1 : 0)).map((x) => <option key={x.d} value={x.d}>{x.d === 0 ? "Összes poszt" : x.d === 1 ? "Ma (éjfél óta)" : "Utolsó " + x.l}</option>)}</select>
          <PfTabs pfs={allTime ? calPfs : secPfs} v={pf} set={(k) => { setPf(k); setKind("all"); }} />
          {!allTime && <><div className="adm-seg sm" role="group"><button aria-pressed={mode === "born"} onClick={() => { setMode("born"); if (sort === "gained") setSort("date"); }} title="Az időszakban megjelent posztok">Megjelent</button><button aria-pressed={mode === "gained"} onClick={() => { setMode("gained"); if (sort === "date") setSort("gained"); }} title="Ebben az időszakban szerzett megtekintés, a régebbi posztoké is">Szerzett</button></div>
          <select className="adm-in sm" value={sort} onChange={(e) => setSort(e.target.value as SortK)} aria-label="Rendezés">{SORTS.filter(([k]) => k !== "gained" || mode === "gained").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></>}
          <div className="adm-seg sm" role="group" ref={segRef}><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>Rács</button><button aria-pressed={view === "rank"} onClick={() => setView("rank")}>Rangsor</button><button aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Idővonal</button><button aria-pressed={view === "wall"} onClick={() => setView("wall")}>Fal</button><button aria-pressed={view === "matrix"} onClick={() => setView("matrix")}>Mátrix</button><button aria-pressed={view === "cards"} onClick={() => setView("cards")}>Kártyák</button><button aria-pressed={view === "table"} onClick={() => setView("table")}>Táblázat</button><button aria-pressed={view === "content"} onClick={() => setView("content")}>Tartalmanként</button><button aria-pressed={view === "top3"} onClick={() => setView("top3")}>Legjobb 3</button></div>
          <button className="adm-ibtn sm gold" onClick={() => addPost(pf)}>{I(P.plus)}Poszt kézzel</button>
        </>}
        foot={<><span>Ha egy poszt szövegében ott a <b>inkage.app/go/12</b> link, vagy a Rövid linkek fülön hozzárendeled (vagy a poszt részleteinél a „Rövid link ehhez a poszthoz” gombbal), a látogatói is a poszthoz kötődnek.</span><SyncButton done={loadBoth} /></>}>
        <div className="soc-flt">
          <input className="adm-in sm" type="search" placeholder="Keresés a szövegben vagy kódra…" value={q} onChange={(x) => setQ(x.target.value)} aria-label="Keresés a posztokban" />
          <select className="adm-in sm" value={kind} onChange={(x) => setKind(x.target.value)} aria-label="Típus"><option value="all">Minden típus</option>{kinds.map((k) => <option key={k} value={k}>{KIND[k] || k}</option>)}</select>
          {!allTime && <label className="soc-chk"><input type="checkbox" checked={linked} onChange={(x) => setLinked(x.target.checked)} />van követhető link</label>}
          {view === "table" && <details className="soc-cols"><summary className="adm-ibtn sm">Oszlopok</summary><div>{OPT_COLS.map(([k, l]) => <label key={k} className="soc-chk"><input type="checkbox" checked={cols.includes(k)} onChange={() => toggleCol(k)} />{l}</label>)}</div></details>}
          {(view === "cards" || view === "grid" || view === "rank") && posts.length > 0 && <button className="lnk" onClick={() => postsCsv(posts, "posztok")}>CSV ⤓</button>}
          <span className="mut">{allTime ? `${fmt(tlPosts.length)} poszt${secDays ? "" : ", minden időszak"}` : `${fmt(posts.length)} poszt`}{gone.length ? <span title="A lista lentebb: Részletek."> · {fmt(gone.length)} nem látszik az élő fiókon, nincs köztük</span> : null}</span>
        </div>
        {!S ? <Loading /> : <div onTouchStart={(e) => { tx.current = e.touches[0].clientX; ty.current = e.touches[0].clientY; swOff.current = tx.current < 22 || !!(e.target as HTMLElement).closest?.(".tw,.hscroll,.chart,.ic-feat-s"); }}
          onTouchEnd={(e) => { if (swOff.current) return; const dx = e.changedTouches[0].clientX - tx.current, dy = e.changedTouches[0].clientY - ty.current; if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
            const L = ["all", ...SOC], i = L.indexOf(pf), nx = L[(i + (dx < 0 ? 1 : -1) + L.length) % L.length]; setPf(nx); setKind("all"); toast(nx === "all" ? "Minden platform" : PF[nx]); }}>
        {view === "wall" ? (tlPosts.length ? <VideoWall posts={tlPosts} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} /> : tlEmpty)
          : view === "matrix" ? (tlPosts.length ? <ContentMatrix groups={groupContent(calAll, d.groups || []).filter((g) => g.some((p) => tlIds.has(p.platform + "|" + p.post_id)))} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} /> : tlEmpty)
          : view === "timeline" ? (tlPosts.length ? <Timeline posts={tlPosts} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} onEdit={setManual} /> : tlEmpty)
          : !posts.length ? (pf !== "all" && !calAll.some((x) => x.platform === pf) ? <PfEmpty pf={pf} connected={!!acc(pf)} add={addPost} />
            : <Empty t={q || kind !== "all" || linked ? "Nincs a szűrésnek megfelelő poszt." : pf !== "all" ? `Ebben az időszakban nincs ${PF[pf]}-poszt.` : "Ebben az időszakban nincs poszt."} icon={P.social}>{secDays ? <button className="adm-ibtn" onClick={() => setSecDays(0)}>Összes poszt</button> : null}</Empty>)
          : view === "content" ? <ContentTable posts={posts} groups={d.groups || []} onOpen={setOpenP} />
          : view === "top3" ? <div className="soc-top3">{top3.map(({ p, list }) => <div key={p}><h4><Logo k={p} size={20} />{PF[p]}<small>a medián {viewWord(p)} szorzója</small></h4><div className="posts">{list.map((x, i) => <PostCard key={x.post_id} p={x} rank={i + 1} mult={x.x} onOpen={setOpenP} />)}</div></div>)}</div>
          : view === "grid" ? <><PostGrid posts={posts.slice(0, shown).map((p) => (mode === "gained" ? p : { ...p, gained: undefined }))} onOpen={setOpenP} mult={sort === "x" ? (p) => p.x : undefined} ranked={!(sort === "date" && mode === "born")} />
            {posts.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + PAGE)}>Még {fmt(Math.min(PAGE, posts.length - shown))} poszt ({fmt(posts.length - shown)} van még)</button></div>}</>
          : view === "rank" ? <><PostRank posts={(sort === "date" && mode === "born" ? [...posts].sort((a, b) => (b.x ?? -1) - (a.x ?? -1) || n(b.views) - n(a.views)) : posts).slice(0, shown).map((p) => (mode === "gained" ? p : { ...p, gained: undefined }))} onOpen={setOpenP} mult={(p) => p.x} />
            {posts.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + PAGE)}>Még {fmt(Math.min(PAGE, posts.length - shown))} poszt ({fmt(posts.length - shown)} van még)</button></div>}</>
          : view === "cards" ? <><div className="posts wall">{posts.slice(0, shown).map((p, i) => <PostCard key={p.platform + p.post_id} p={mode === "gained" ? p : { ...p, gained: undefined }} rank={sort === "date" && mode === "born" ? undefined : i + 1} mult={sort === "x" ? p.x : undefined} onOpen={setOpenP} />)}</div>
            {posts.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + PAGE)}>Még {fmt(Math.min(PAGE, posts.length - shown))} poszt ({fmt(posts.length - shown)} van még)</button></div>}</>
          : <Tbl name="posztok" rows={posts} onRow={setOpenP} cols={tblCols} />}
        </div>}
      </Card>

      <Coverage r={R} pick={pickPf} add={addPost} err={reach.e} retry={reach.load} />
      <ReachMatrix r={R} pick={pickPf} add={addPost} err={reach.e} retry={reach.load} />
      <Band label={`Látogató a közösségi oldalaidról · ${perLabel}`} value={allVisits} now={partDay ? undefined : fvNow} prev={partDay ? undefined : fvPrev} unit={visPfs.length ? visPfs.map((p) => PF[p]).join(", ") : "nincs közösségi látogató"}
        sentence={<>{partDay ? "Ma éjfél óta" : "Ezekben a napokban"} a posztjaid (a régebbiek is) <b>{big(gotViews)}</b> megtekintést kaptak{pinShown ? <>; a Pinterest <b>{big(PIN!.imps)}</b> megjelenést jelent {pinDay}-ig (a fiók napi jelentéséből; a pinek saját számai napokkal később érnek be, eddig {big(PIN!.pin_sum)})</> : partDay ? <> (a Pinterest 1–2 nap késéssel adja a számait, mára még nincs)</> : null}. <b>{fmt(inPf.length)}</b> új, ma is látható poszt ment ki. {vidNone ? <>Hogy melyik videó hány látogatót hozott, az nem mérhető, mert egyikben sincs követhető link</> : <>A követhető linkes videók <b>{fmt(tv)}</b> látogatót hoztak{tvViews ? <> (<b>{fmt((tv * 1000) / Math.max(1, tvViews), 1)}</b> / 1000 megtekintés)</> : null}</>}. {partDay ? null : <>A változás a lezárt napokat veti össze: <b>{fmt(fvNow)}</b> látogató, előtte <b>{fmt(fvPrev)}</b>.</>}</>}
        side={<StackedColumns days={stack} keys={[...SOC]} label={(k) => PF[k]} height={120} />} />
      {on.map((p) => {
        const a = acc(p), l = last(p), fl = lastWith(p, "followers"), w = weekAgo(p), fs = daily(p).filter((x: D) => x.followers != null).map((x: D) => n(x.followers)), eg = engOf(p);
        return (
          <section key={p} className={"c " + (on.length === 1 ? "s12" : on.length === 2 || on.length === 4 ? "s6" : "s4")}>
            <div className="c-h">
              <div className="pfh">
                <span className={"pfh-av " + p}>{a?.avatar_url ? <img src={a.avatar_url} alt="" referrerPolicy="no-referrer" /> : PF[p][0]}</span>
                <div><h2>{a ? (a.username ? "@" + String(a.username).replace(/^@+/, "") : a.display_name || "fiók") : PF[p]}</h2><p>{a ? <>{PF[p]} · frissítve {ago(a.last_sync_at)}</> : "Még nincs összekapcsolva."}</p></div>
              </div>
              <a className={"adm-ibtn" + (a ? "" : " gold")} href={MOCK ? undefined : `/api/admin/connect/${p}`}>{a ? "Újrakapcsolás" : "Összekapcsolás"}</a>
            </div>
            {a?.last_error && <div className="alert err">Az utolsó lehúzás hibája: {String(a.last_error).slice(0, 160)}</div>}
            {a && l ? (
              <>
                <div className="mini-stats soc-ms">
                  <Mini l="Követők" v={fl?.followers == null ? "–" : big(fl.followers)} sub={w && fl ? <Delta now={n(fl.followers)} prev={n(w.followers)} /> : undefined} />
                  {second(p)}
                  <Mini l="Poszt (időszak)" v={fmt(pfPosts(p).length)} sub={eg != null ? `${fmt(eg * 100, 1)}% elköteleződés` : undefined} />
                  <Mini l="Látogató innen" v={fmt(sum(p))} sub={`${fmt(sum(p + "_scored"))} előnézet`} />
                </div>
                {fs.length > 1 && <div className="soc-spark" title="Követők naponta"><Spark values={fs} h={40} color={chColor(p)} /></div>}
              </>
            ) : <Empty t={a ? "Az első adatlehúzás után jelennek meg a számok." : `Kattints az Összekapcsolás gombra, lépj be a ${PF[p]}-fiókoddal, és itt látod a követőidet, a videóid megtekintéseit és azt, hány embert hoztak.`} icon={P.social} />}
          </section>
        );
      })}

      {off.length > 0 && <section className="c s12 soc-off">
        <span className="eyebrow">Még nincs bekötve</span>
        <div className="soc-off-l">{off.map((p) => <a key={p} className="soc-off-i" href="#connect"><Logo k={p} size={30} /><span><b>{PF[p]}</b><small>{NEED[p]}</small></span><em>›</em></a>)}</div>
      </section>}

      <Card className="s12" icon={P.users} title="Leadek platformonként" sub="Hány kattintás (rövid link), látogatás, előnézet és regisztráció indult az egyes közösségi oldalakról ebben az időszakban (a link, a bio vagy a hivatkozó alapján, a mi mérésünkből), és mennyi látogatás volt az előző ugyanilyen hosszú időszakban."
        foot={noWay.length ? <span>{noWay.map((p) => PF[p]).join(", ")}: a látogatók <b>nem mérhetők</b>. Egy posztban sincs követhető link, és az app nem adja át, honnan jött a látogató, így ők a „közvetlen” látogatók közé kerülnek. Ez nem 0, hanem ismeretlen.</span> : undefined}>
        <Tbl name="leadek" rows={leads} empty="Ebben az időszakban még nem jött látogató a közösségi oldalakról." cols={[
          { k: "k", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Logo k={r.k} size={26} /><b>{PF[r.k] || r.k}</b></span> },
          { k: "clicks", l: "Kattintás", num: true, r: (r) => (r.clicks_known === false ? <span className="mut" title="Ehhez a platformhoz nincs rövid link, így a kattintást mi nem tudjuk mérni.">nem mérhető{r.k === "pinterest" && PIN?.clicks != null ? <div style={{ fontSize: 11 }}>a Pinterest szerint {fmt(PIN.clicks)}</div> : null}</span> : <>{fmt(r.clicks)}{r.clicks_prev != null && <div className="mut" style={{ fontSize: 11 }}>előtte {fmt(r.clicks_prev)}</div>}</>) },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => <><b>{fmt(r.sessions)}</b> {!partDay && FV[r.k] ? <span title="Változás a lezárt napokon"><Delta now={n(FV[r.k].now)} prev={n(FV[r.k].prev)} /></span> : null}{n(r.bio) > 0 ? <div className="mut" style={{ fontSize: 11 }}>{n(r.bio) === n(r.sessions) ? "mind a bio linkről" : `${fmt(r.bio)} a bio linkről`}</div> : null}</> }, { k: "prev", l: "Előző időszak", num: true, r: (r) => fmt(r.prev) },
          { k: "scored", l: "Előnézet", num: true, r: (r) => fmt(r.scored) }, { k: "conv", l: "Előnézetig", num: true, r: (r) => pct(n(r.scored), n(r.sessions)) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => fmt(r.signups) }, { k: "conv_s", l: "Regisztráció / látogatás", num: true, r: (r) => pct(n(r.signups), n(r.sessions)) },
        ]} />
      </Card>

      <Kpi kind="api" to="@Mi működik" tone="butter" className="s4" icon={P.spark} l="Elköteleződési arány" v={realViews ? fmt((inter / realViews) * 100, 1) + "%" : "–"} now={realViews ? (inter / realViews) * 1e4 : undefined} prev={prevViews ? (prevInter / prevViews) * 1e4 : undefined}
        sub={`kedvelés + komment + megosztás + mentés / megtekintés`} title="A megjelenést számoló platformok (Pinterest, LinkedIn) nélkül, hogy egy mértékegység legyen." />
      <Kpi kind="own" to="links" tone="pink" className="s4" hl icon={P.target} l="Látogató a videókból" v={vidNone ? "nem mérhető" : <CountUp v={n(tv)} />} now={vidNone || partDay ? undefined : tv} prev={vidNone || partDay ? undefined : prevTv} title="Csak olyan videónál mérhető, amelyben követhető link van. A Pinterest-kódok nem rövid linkek, és a pinek megjelenést kapnak, nem megtekintést: külön szerepelnek." sub={vidNone ? `egy videóban sincs követhető link${pinsCoded.length ? ` · ${fmt(pinsCoded.length)} pinben követőkód, ${fmt(pinVisits)} látogató` : ""}` : `${fmt(tagged.length)} videóban van követhető link`} />
      <Kpi kind="own" to="platforms" tone="sky" className="s4" icon={P.bolt} l="Látogató / 1000 megtekintés" v={vidNone ? "nem mérhető" : fmt((tv * 1000) / Math.max(1, tvViews), 1)} now={!vidNone && !partDay && tvViews ? (tv * 1000) / tvViews : undefined} prev={!vidNone && !partDay && prevTvViews ? (prevTv * 1000) / prevTvViews : undefined} sub="a követhető linkes videóknál" />

      <Card className="s12" icon={P.traffic} title="Látogatók a közösségi oldalakról" sub="Naponta: hány látogatás indult az egyes platformokról (link, bio, hivatkozó alapján). A „Posztokkal” nézetben az összesen, és rajta a posztjaid megjelenésének napja: látszik, melyik poszt után ugrott meg."
        right={<div className="adm-seg sm"><button aria-pressed={visV === "pf"} onClick={() => setVisV("pf")}>Platformonként</button><button aria-pressed={visV === "posts"} onClick={() => setVisV("posts")}>Posztokkal</button></div>}
        foot={visV === "pf" ? <div className="legend">{SOC.map((p) => <span key={p}><i className="sq" style={{ background: chColor(p) }} />{PF[p]}</span>)}</div> : undefined}>
        {visV === "pf" ? <StackedColumns days={stack} keys={[...SOC]} label={(k) => PF[k]} />
          : <ChartBox data={visits.map((x: D) => ({ t: x.t, v: SOC.reduce((t, p) => t + n(x[p]), 0) }))} label="Látogató a közösségi oldalakról" marks={marks} name="kozossegi-latogatok" />}
      </Card>

      <CrossPost posts={all} groups={d.groups || []} />
      <Card className="s7" icon={P.calendar} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Posztnaptár" sub="Minden nap a posztjaival (minden hónap, nem csak a kiválasztott időszak); a szín a megtekintés. Látszik, mikor nem volt poszt, és mi ment jól."
        right={<PfTabs pfs={calPfs} v={calPf} set={setCalPf} />}>
        <PostCalendar posts={((d.cal?.length ? d.cal : all) as D[]).filter((p) => calPf === "all" || p.platform === calPf)} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} />
      </Card>
      <Card className="s5" icon={P.spark} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Mi működik?" sub="A posztjaid automatikus címkéi (horog, hossz, nap, napszak, nyelv, rövid link). Minden poszt a saját platformja mediánjához mérve, így a „Mind” nézet a tartalmat hasonlítja, nem a platformokat. Választható: megtekintés, elköteleződés vagy látogató / 1000 megtekintés. Kevés posztnál még csak irány, nem szabály."
        right={<><div className="adm-seg sm">{(["x", "eng", "rate"] as const).map((k) => <button key={k} aria-pressed={tagM === k} onClick={() => setTagM(k)}>{k === "x" ? "Nézettség" : k === "eng" ? "Elköteleződés" : "/1000"}</button>)}</div>
          <PfTabs pfs={postPfs} v={tagPf} set={setTagPf} /></>}>
        <TagInsights posts={all.filter((p) => tagPf === "all" || p.platform === tagPf)} metric={tagM} />
      </Card>

      <Card className="s12" icon={P.clock} title="Mikor posztolj?" src={[...SOC]} sub="A hét napjai × a nap órái (budapesti idő): a cella színe azt mutatja, hogy az akkor kitett posztjaid átlagosan hogyan mentek a saját platformjuk szokásos (medián) posztjához képest. Minden poszt számít, időszaktól függetlenül; a 24 óránál fiatalabbak még nem."
        right={<PfTabs pfs={calPfs} v={heatPf} set={setHeatPf} />}>
        <PostHeat posts={calAll.filter((p) => heatPf === "all" || p.platform === heatPf)} vs={vsAll} />
      </Card>
      <SeriesCard posts={calAll} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} />
      <More label="Részletek: CSV-import, adatlehúzások, nem látszó posztok">
      {gone.length > 0 && <Card className="s12" icon={P.alert} title="Nem látszik az élő fiókon" sub="Ezeket a platform a teljes listájában már nem adja vissza: törölve vagy privátra állítva, innen nem dönthető el. Semmi nem törlődött innen: a múltbeli megtekintésük a napi számokban megmaradt, de a darabszámokban, mediánban, elköteleződésben és a listákban már nem szerepelnek. Ha újra megjelennek, maguktól visszakerülnek.">
        <Tbl name="nem-lathato-posztok" rows={gone} cols={[
          { k: "platform", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Logo k={r.platform} size={18} />{PF[r.platform]}</span> },
          { k: "title", l: "Poszt", r: (r) => <span className="cellwrap">{String(r.title || "(nincs szöveg)").slice(0, 70)}</span> },
          { k: "created_at", l: "Megjelent", r: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–") },
          { k: "last_seen", l: "Utoljára látszott", r: (r) => dt(r.last_seen) },
          { k: "views", l: "Utolsó szám", num: true, r: (r) => <>{big(r.views)} <span className="mut" style={{ fontSize: 11 }}>{viewWord(r.platform)}</span></> },
          { k: "likes", l: "Kedvelés", num: true, r: (r) => big(r.likes) },
        ]} />
      </Card>}
      <Card className="s12" icon={P.doc} title="Export feltöltése (TikTok Studio, YouTube Studio, Meta)" sub="Amit az API nem ad ki (TikTokon az átlagos nézési idő, a végignézés, a mentés, az elérés és a forgalomforrás; YouTube-on a bélyegkép-megjelenés és az átkattintás; Metánál az elérés és a mentés régebbi posztokra), az a platform saját exportjából jön. TikTok Studio → Elemzések → Tartalom → Letöltés; YouTube Studio → Elemzések → Speciális mód → Exportálás; Meta Business Suite → Statisztikák → Tartalom → Exportálás. Videó-azonosító vagy link alapján párosítja a posztokhoz; amit a platform lehúzása később nem ad, az megmarad.">
        <ImportCsv done={load} />
      </Card>
      <Card className="s12" icon={P.refresh} title="Platformok állapota" sub="Forrásonként: mikor sikerült utoljára a lehúzás, mikor volt utoljára hiba, hány hiba volt a héten, és mikor jár le a kapcsolat.">
        <Tbl name="lehuzas-allapot" csv={false} rows={[...SOC.filter((p) => acc(p) || state.some((s) => s.source === p)), ...state.map((s) => s.source).filter((s) => !(SOC as readonly string[]).includes(s))].map((k) => ({ k, ...(state.find((s) => s.source === k) || {}), a: acc(k) }))} empty="Még nem futott lehúzás." cols={[
          { k: "k", l: "Forrás", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{PF[r.k] ? <Logo k={r.k} size={20} /> : null}<b>{PF[r.k] || (r.k === "gsc" ? "Google Search Console" : r.k)}</b></span> },
          { k: "last_ok", l: "Utolsó siker", r: (r) => (r.last_ok ? <span title={dt(r.last_ok)}>{ago(r.last_ok)}</span> : "–") },
          { k: "last_fail", l: "Utolsó hiba", r: (r) => (r.last_fail ? <span className="cellwrap" title={r.last_msg}><span className={"chip " + (r.last_ok && r.last_ok > r.last_fail ? "" : "bad")}>{ago(r.last_fail)}</span> <span className="mut">{String(r.last_msg || "").slice(0, 90)}</span></span> : "–") },
          { k: "fails_7d", l: "Hiba / 7 nap", num: true, r: (r) => fmt(r.fails_7d) },
          { k: "partial_7d", l: "Részben sikerült / 7 nap", r: (r) => (n(r.partial_7d) ? <span className="cellwrap"><span className="chip warn">{fmt(r.partial_7d)}</span> <span className="mut">{partialWhy(r.partial_msg) || String(r.partial_msg || "").slice(0, 90)}. A többi adat megjött.</span></span> : "–") },
          { k: "exp", l: "Kapcsolat lejár", r: (r) => { const t = r.a?.refresh_expires_at || r.a?.token_expires_at; if (!r.a) return "–"; if (!t) return <span className="mut">nem jár le</span>; const left = (new Date(t).getTime() - Date.now()) / 864e5;
            return <span className={"chip " + (left < 0 ? "bad" : left < 10 ? "warn" : "")} title={dt(t)}>{left < 0 ? "lejárt" : left < 2 ? `${fmt(left * 24)} óra múlva` : `${fmt(left)} nap múlva`}</span>; } },
        ]} />
      </Card>
      <Card className="s12" icon={P.refresh} title="Adatlehúzások" sub="Az utolsó automatikus és kézi frissítések (legfeljebb 100)."
        right={(d.sync || []).length > 20 ? <button className="adm-ibtn sm" onClick={() => setAllSync(!allSync)}>{allSync ? "Csak az utolsó 20" : `Mind a ${fmt((d.sync || []).length)}`}</button> : undefined}>
        <Tbl rows={(d.sync || []).slice(0, allSync ? 100 : 20)} empty="Még nem futott." cols={[
          { k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "source", l: "Forrás", r: (r) => PF[r.source] || (r.source === "gsc" ? "Google Search Console" : r.source) },
          { k: "ok", l: "Eredmény", r: (r) => <span className={"chip " + (!r.ok ? "bad" : r.partial ? "warn" : "good")} title={r.partial ? "Az adat megjött, de néhány kérés hibázott." : undefined}>{!r.ok ? "hiba" : r.partial ? "részben" : "rendben"}</span> },
          { k: "message", l: "Részlet", r: (r) => <span className="cellwrap mut">{r.message}{r.partial && partialWhy(r.message) ? <> ({partialWhy(r.message)})</> : null}</span> },
        ]} />
      </Card>
      </More>
      {sheets}
    </div>
  );
}
/* Budapest calendar day of a date, "YYYY-MM-DD" */
const bpDay = (t: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
/* how long ago a value was: a bare day ("2026-10-22") is a calendar day, never hours counted from its UTC midnight */
export const agoDay = (t?: string | null) => {
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(t))) return ago(t);
  const k = Math.round((Date.parse(bpDay(new Date()) + "T12:00:00Z") - Date.parse(t + "T12:00:00Z")) / 864e5);
  return k <= 0 ? "ma" : k === 1 ? "tegnap" : k < 30 ? `${k} napja` : new Date(t + "T12:00:00").toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
};
/* the visits by day with every missing day of the period as zeros ("Összes": from the first visit) */
function fillDays(rows: D[], days: number): D[] {
  const by = new Map(rows.map((x) => [String(x.t).slice(0, 10), x]));
  const end = bpDay(new Date()), first = rows.length ? String(rows[0].t).slice(0, 10) : end;
  const startMs = days && days <= 365 ? Date.parse(end + "T12:00:00Z") - (days - 1) * 864e5 : Date.parse(first + "T12:00:00Z");
  const out: D[] = [];
  for (let t = startMs; t <= Date.parse(end + "T12:00:00Z"); t += 864e5) { const k = new Date(t).toISOString().slice(0, 10); out.push(by.get(k) || { t: k + "T00:00:00" }); }
  return out.length > 400 ? out.slice(-400) : out;
}
/* every day from a pin's first to its last listed day: a day Pinterest does not list had no appearance */
function fillPinDays(rows: D[]) {
  const by = new Map(rows.map((r) => [String(r.day).slice(0, 10), n(r.impressions)])), ks = [...by.keys()].sort(), out: { t: string; v: number }[] = [];
  for (let t = Date.parse(ks[0] + "T12:00:00Z"), e = Date.parse(ks[ks.length - 1] + "T12:00:00Z"); t <= e; t += 864e5) { const k = new Date(t).toISOString().slice(0, 10); out.push({ t: k, v: by.get(k) || 0 }); }
  return out;
}
const KIND: Record<string, string> = { reel: "Reels", video: "Videó", short: "Shorts", image: "Kép", carousel_album: "Körhinta", carousel: "Körhinta", pin: "Pin", post: "Poszt", link: "Link", document: "Dokumentum", story: "Story", text: "Szöveg" };
/* every post (the calendar's list), for the multiplier on a post's own sheet: it is the list the cards measure against */
let CAL: D[] | null = null;

/* the replies her inbox can send from here */
const CAN_REPLY = new Set(["instagram", "facebook", "youtube"]);

export function PostDrawer({ p, close }: { p: D; close: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [x, setX] = useState<D | null>(null);
  const [link, setLink] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [noPic, setNoPic] = useState(false);
  const [grp, setGrp] = useState(""); const [reply, setReply] = useState<Record<string, string>>({}); const [sent, setSent] = useState<Record<string, boolean>>({});
  const load = () => rpc(sb, "admin_post", { p_platform: p.platform, p_post_id: p.post_id }).then(({ data }) => setX(data || {}));
  useEffect(() => { load(); pushRecent({ k: "post", id: p.platform + ":" + p.post_id, l: String(p.title || p.post_id || "Poszt").slice(0, 50), x: { platform: p.platform, post_id: p.post_id, title: p.title, views: p.views, thumb: p.thumb } }); }, [sb, p]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const q: D = { ...p, ...(x?.post || {}) };
  /* the same multiplier as on the cards: every post of the platform, those under a day old and the post itself left out.
     Only until that list has arrived, the platform's median from the database stands in */
  const [calRef, setCalRef] = useState<D[] | null>(CAL);
  useEffect(() => { if (!calRef) rpc(sb, "admin_social", { p_days: 365 }).then(({ data }) => { const l = data?.cal?.length ? data.cal : data?.posts; if (l?.length) { CAL = l; setCalRef(l); } }); }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps
  const calPf = (calRef || []).filter((o) => o.platform === p.platform), self = p.views != null ? p : calPf.find((o) => String(o.post_id) === String(p.post_id)) || q, calX = calPf.length ? vsMedian(calRef!, calRef!)(self) : null;
  const pool = POOL.posts.filter((o) => o.platform === p.platform && o.post_id !== p.post_id && n(o.views) > 0 && !tooYoung(o)).map((o) => n(o.views)).sort((a, b) => a - b);
  const peerN = calPf.length ? calPf.filter((o) => n(o.views) > 0 && !tooYoung(o) && String(o.post_id) !== String(p.post_id)).length : x?.peers ? n(x.peers.n) : pool.length;
  const med = calPf.length ? (calX ? n(self.views) / calX : 0) : x?.peers?.median != null ? n(x.peers.median) : pool.length ? pool[Math.floor(pool.length / 2)] : 0;
  const times = calPf.length ? calX : med > 0 && q.views != null && !tooYoung(q) ? n(q.views) / med : null; /* a post under a day old is not compared yet */
  const daily: D[] = x?.daily || [];
  /* a pin: Pinterest's exact day numbers (a day it does not list had none), not the difference of our readings, which puts a late number on the wrong day */
  const pinDays: D[] = p.platform === "pinterest" ? ((x?.days || []) as D[]).filter((r) => r.impressions != null) : [];
  const gained = pinDays.length ? fillPinDays(pinDays) : daily.map((dd: D, i: number) => ({ t: dd.day, v: i ? Math.max(0, n(dd.views) - n(daily[i - 1].views)) : 0 }));
  /* impressions a day: the platform's own day number where it gives one (pins, YouTube thumbnails), else the growth of the total */
  const dayImp: D[] = (x?.days || []).filter((r: D) => r.impressions != null).map((r: D) => ({ t: r.day, v: n(r.impressions) }));
  const impD = dayImp.length > 1 ? dayImp : daily.map((dd: D, i: number) => ({ t: dd.day, v: i && dd.impressions != null && daily[i - 1].impressions != null ? Math.max(0, n(dd.impressions) - n(daily[i - 1].impressions)) : null })).filter((r) => r.v != null).slice(1) as D[];
  const reachD = daily.filter((dd) => dd.reach != null).map((dd) => ({ t: dd.day, v: n(dd.reach) }));
  const clickD = ((x?.clicks || []) as D[]).map((c) => ({ t: c.t, v: n(c.n) }));
  const t0 = q.created_at ? new Date(q.created_at).getTime() : 0;
  /* an hour without a number is no number, not 0 (Pinterest gives no hourly numbers at all) */
  const hourly: D[] = (x?.hourly || []).filter((h: D) => h.views != null && (!t0 || new Date(h.at).getTime() - t0 <= 7 * 864e5));
  const first72 = hourly.filter((h: D) => !t0 || new Date(h.at).getTime() - t0 <= 72 * 3600e3);
  /* the hourly reads began on 2026-10-22: for an older post the curve starts late, and that is said, not hidden */
  const h0 = t0 && first72.length ? Math.floor((new Date(first72[0].at).getTime() - t0) / 3600e3) : 0;
  const vis: D[] = x?.visits || [], ch0: D = x?.chain || {};
  const watch = q.watch_avg != null ? n(q.watch_avg) : null;
  const vw = cap(viewWord(p.platform));
  const code0 = link || x?.code, kindL: string | null = link ? "short" : x?.link_kind ?? q.link_kind ?? null, noCode = !code0;
  /* no trackable link: nothing after the views can be measured, which is not 0. A pin's code is in the link Pinterest opens: the clicks are Pinterest's own */
  const chain = [[vw, q.views == null ? null : n(q.views)], [p.platform === "pinterest" ? "Kattintás a weboldalra" : "Kattintás a linkre", p.platform === "pinterest" ? (q.clicks ?? null) : noCode || kindL !== "short" ? null : n(ch0.clicks)], ["Látogató", noCode ? null : n(ch0.sessions ?? q.sessions)], ["Előnézet", noCode ? null : n(ch0.scored ?? q.scored)], ["Fiók", noCode ? null : n(ch0.signups)], ["Megosztás", noCode ? null : n(ch0.shared)]] as [string, number | null][];
  const traffic = q.traffic && typeof q.traffic === "object" ? Object.entries(q.traffic as Record<string, number>).map(([k, v]) => ({ k, n: n(v) })) : [];
  const comments: D[] = x?.comments || [];
  const code = link || x?.code;
  const makeLink = async () => {
    setBusy(true);
    const { data, error } = MOCK ? { data: "13", error: null } : await rpc(sb, "admin_link_for_post", { p_platform: p.platform, p_post_id: p.post_id });
    setBusy(false);
    if (error || !data) { toast(error?.message || "Nem sikerült"); return; }
    setLink(String(data)); const cp = await copyText(`inkage.app/go/${data}`); toast(cp ? `inkage.app/go/${data} · vágólapra másolva` : `inkage.app/go/${data} elkészült, de a másolás nem sikerült`);
  };
  const saveGrp = async () => { const r = MOCK ? { error: null } : await rpc(sb, "admin_post_group_set", { p_platform: p.platform, p_post_id: p.post_id, p_grp: grp.trim() || null }); if (r.error) { toast("Nem sikerült menteni: " + r.error.message); return; } toast(grp.trim() ? "Összevonva: a következő betöltéskor együtt látszik" : "Visszaállítva az automatikus párosításra"); };
  const send = async (c: D) => {
    const text = (reply[c.item_id] || "").trim(); if (!text) return;
    /* phone: a public answer is asked first, with the exact text, as in the Postafiók */
    if (phoneNow() && !confirm(`Nyilvános válasz megy ki ide: ${PF[c.source] || c.source}\n\n„${text}”\n\nElküldöd?`)) return;
    const r = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: c.source, id: c.item_id, text }) });
    if (r.ok) { setSent({ ...sent, [c.item_id]: true }); toast("Válasz elküldve"); load(); } else toast(r.json?.error || "Nem sikerült elküldeni");
  };
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Poszt részletei">
        <div className="c-h"><div><div><span className="eyebrow">{PF[p.platform]} · {KIND[q.kind] || q.kind || "poszt"} · {ago(q.created_at)}{q.gone_at ? " · nem látszik az élő fiókon" : ""}</span></div></div><CloseX close={close} /></div>
        <div className={"ic-pd" + (q.thumb && !noPic ? "" : " noimg")}>
          {q.thumb && !noPic ? <img src={q.thumb} alt="" referrerPolicy="no-referrer" onError={() => setNoPic(true)} /> : <span className="ic-pd-ph"><Logo k={p.platform} size={72} /></span>}
          <div className="ic-glass">
            <span className="ic-glass-l">{isImp(p.platform) ? "Megjelenés" : "Megtekintés"}{times != null && peerN >= 1 ? <span className={"ink-chg " + (times >= 1 ? "up" : "down")}>{fmtX(times)}× a szokásos</span> : null}</span>
            <Giant text={big(q.views)} max={120} />
            {p.platform === "pinterest" && <small>a 90 napnál régebbi napokkal együtt, amióta lehúzzuk</small>}
            <Trio items={[{ l: likeWord(p.platform), v: big(p.platform === "pinterest" ? p.pin_clicks : q.likes) }, { l: "komment", v: big(q.comments) }, { l: "megosztás", v: big(q.shares) }]} />
          </div>
        </div>
        <h2 className="ic-pd-t">{(q.title || "(nincs szöveg)").slice(0, 140)}</h2>
        {tooYoung(q) && peerN >= 1 && <p className="note">{YOUNG_T}.</p>}
        {times != null && peerN >= 1 && <div className={"vs-avg " + (times >= 1 ? "up" : "down")}><b>{fmtX(times)}×</b><span>{times >= 1 ? "jobb" : "gyengébb"}, mint a(z) {PF[p.platform]}-posztjaid szokásos (medián) {viewWord(p.platform)}e ({big(med)}, {peerN} poszt alapján)</span></div>}
        <div className="mini-stats pd-stats">
          {!isImp(p.platform) && <Mini l="Megjelenés" v={big(q.impressions)} sub={q.impressions == null ? (p.platform === "tiktok" ? "a TikTok nem adja ki" : p.platform === "youtube" ? "a bélyegkép-megjelenés napi jelentésből jön" : undefined) : p.ctr != null ? `átkattintás ${fmt(n(p.ctr) * 100, 1)}%` : undefined} />}
          <Mini l="Elérés" v={big(q.reach)} /><Mini l="Mentés" v={big(q.saves)} /><Mini l="Átl. nézési idő" v={watch != null ? `${fmt(watch, 1)} mp` : "–"} sub={watch != null && q.duration ? `a videó ${pct(watch, n(q.duration))}-a` : undefined} />
          <Mini l="Végignézés" v={q.completion != null ? fmt(n(q.completion), 1) + "%" : "–"} /><Mini l="Profilnézés" v={big(q.profile_visits)} /><Mini l="Új követő" v={big(q.follows)} />
          <Mini l={p.platform === "pinterest" ? "Kattintás a weboldalra" : "Kattintás"} v={big(q.clicks)} /><Mini l="/1000" v={code && n(q.views) ? fmt((n(ch0.sessions ?? q.sessions) * 1000) / n(q.views), 1) : "–"} />
        </div>
        {!x ? <div className="skel" style={{ height: 200 }} /> : (
          <>
            <h3>A videótól az eredményig</h3>
            <div className="chain">{chain.map(([l, v], i) => <div key={l} className="chain-i"><b>{v == null ? <span className="mut" title="Nem mérhető, ez nem 0.">–</span> : big(v)}</b><span>{l}</span>{i > 0 && v != null && n(chain[i - 1][1]) > 0 && <small>{pct(v, n(chain[i - 1][1]))}</small>}</div>)}</div>
            {!code ? <div className="pd-link"><p className="note">Ebben a posztban nincs követhető link, ezért a kattintás, a látogató, az előnézet és a fiók nem mérhető hozzá.</p><button className="adm-ibtn gold" onClick={makeLink} disabled={busy}>{I(P.links)}Rövid link ehhez a poszthoz</button></div>
              : link ? <div className="alert ok">Kész: <b>inkage.app/go/{link}</b>. Írd a poszt leírásába vagy a bióba; innentől a látogatói ehhez a poszthoz kötődnek.</div> : null}
            <h3>{h0 > 2 ? `A 72. óráig (mérve a ${h0}. órától)` : "Az első 72 óra"}</h3>
            {h0 > 2 && first72.length > 1 && <p className="note">Az óránkénti mérés a poszt {fmt(h0)}. órájától van; előtte nincs adat (az óránkénti lehúzás 2026. okt. 22-én indult).</p>}
            {first72.length > 1 ? <TrendChart data={first72.map((h: D) => ({ t: h.at, v: n(h.views) }))} label={`${vw} összesen`} hourly height={180} /> : <Empty t={p.platform === "pinterest" ? "A Pinterest csak napi számot ad, óránkéntit nem: a napi görbe látszik lent." : "Az óránkénti görbe a poszt első hetében készül (óránkénti lehúzás); régebbi posztnál a napi görbe látszik lent."} />}
            <h3>Új {viewWord(p.platform)} naponta</h3>
            {pinDays.length ? <p className="note">A Pinterest saját napi számai, 1–2 nap késéssel; a legutóbbi napok még nőhetnek.</p> : null}
            {gained.length > 1 ? <TrendChart data={pinDays.length ? gained : gained.slice(1)} label={`Új ${viewWord(p.platform)}`} color={SERIES[0]} height={170} /> : <Empty t="A napi adatok az első pár adatlehúzás után jelennek meg." />}
            {!isImp(p.platform) && impD.length > 1 && <><h3>Megjelenés naponta</h3><TrendChart data={impD as any} label="Megjelenés" color={SERIES[2]} height={150} /></>}
            {reachD.length > 1 && <><h3>Elérés</h3><TrendChart data={reachD} label="Elérés (összesen)" color={SERIES[3]} height={150} /></>}
            {(x.retention || []).length > 0 && <><h3>Nézőmegtartás</h3><Retention curves={[{ post_id: p.post_id, pts: (x.retention as D[]).map((r) => ({ x: r.x, r: r.ratio })) }]} posts={[q]} /></>}
            {traffic.length > 0 && <><h3>Honnan jöttek a nézők</h3><div className="trf">{traffic.sort((a, b) => b.n - a.n).map((t) => <span key={t.k}><b>{fmt(t.n, 1)}%</b>{t.k}</span>)}</div></>}
            <h3>{code && kindL !== "short" ? `A követőkód (${code}): látogató naponta` : `A rövid link${code ? ` (inkage.app/go/${code})` : ""}: kattintás és látogató naponta`}</h3>
            {code ? (clickD.length || vis.length ? <>{clickD.length > 0 && <TrendChart data={clickD} label="Kattintás a linkre" color={SERIES[1]} height={140} />}{vis.length > 0 && <TrendChart data={vis.map((v: D) => ({ t: v.t, v: n(v.sessions) }))} label="Látogató" height={150} />}</> : <Empty t="Még senki nem jött ezzel a linkkel." />) : <Empty t="Nincs követhető link." icon={P.links} />}
            <h3>Kommentek{comments.length ? ` (${fmt(comments.length)})` : ""}</h3>
            {comments.length ? <ul className="pd-cm">{comments.slice(0, 30).map((c) => (
              <li key={c.item_id}><div><b>{c.author || "Valaki"}</b><small>{ago(c.created_at)}</small></div><p>{c.body}</p>
                {c.reply ? <p className="pd-re">↳ {c.reply}</p> : sent[c.item_id] ? <p className="pd-re">↳ {reply[c.item_id]}</p> : CAN_REPLY.has(c.source) ? (
                  <div className="pd-rf"><input className="adm-in sm" placeholder="Válasz…" value={reply[c.item_id] || ""} onChange={(ev) => setReply({ ...reply, [c.item_id]: ev.target.value })} onKeyDown={(ev) => ev.key === "Enter" && send(c)} /><button className="adm-ibtn sm gold" onClick={() => send(c)}>Küldés</button></div>
                ) : <small className="mut">Erre a platformon, a poszt alatt tudsz válaszolni.</small>}</li>))}</ul>
              : <Empty t={p.platform === "tiktok" || p.platform === "pinterest" ? "Ennek a platformnak a kommentjeit az API nem adja ki." : "Még nincs komment (vagy még nem húztuk le: az újabb posztokét óránként hozzuk)."} />}
            <SeriesPick p={p} />
            <h3>Ugyanez a tartalom más platformon</h3>
            <div className="adm-row" style={{ gap: 6 }}><input className="adm-in sm" placeholder="Közös név, pl. 50-ev-mulva" value={grp} onChange={(ev) => setGrp(ev.target.value)} style={{ flex: 1 }} /><button className="adm-ibtn sm" onClick={saveGrp}>Összevonás</button></div>
            <p className="note">Írd be ugyanazt a nevet a többi platform ugyanilyen posztjánál: a „Tartalmanként” nézet és az „Egy tartalom, minden platformon” kártya akkor is együtt mutatja őket, ha az automatikus párosítás nem találta meg. Üresen mentve visszaáll.</p>
            <div className="adm-row">{p.url && <a className="adm-ibtn gold" href={p.url} target="_blank" rel="noreferrer">Megnyitás a(z) {PF[p.platform]}-on ↗</a>}</div>
          </>
        )}
      </aside>
    </Layer>
  );
}


/* ---------- one content = one row: the same video on every platform, added up ---------- */
const words = (t: string) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
const similar = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let k = 0; a.forEach((w) => { if (b.has(w)) k++; }); return k / Math.min(a.size, b.size); };
export function groupContent(posts: D[], manual: D[] = []) {
  const byHand = new Map(manual.map((g) => [g.platform + "|" + g.post_id, String(g.grp)]));
  const list = [...posts].filter((x) => x.created_at).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const T = list.map((p) => new Date(p.created_at).getTime()), W = list.map((p) => words(p.title));
  const parent = list.map((_, i) => i), find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  /* joined by hand first; then the closest pairs in time win: the same short link, or mostly the same words within a day, or the same video length within three.
     Many captions are the same few words, so "the first one that fits" paired videos with the post a day off. */
  const named = new Map<string, number>(), hand = new Set<number>();
  list.forEach((p, i) => { const h = byHand.get(p.platform + "|" + p.post_id); if (h) { hand.add(i); if (named.has(h)) parent[i] = named.get(h)!; else named.set(h, i); } });
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < list.length; i++) { if (hand.has(i)) continue;
    for (let j = i + 1; j < list.length; j++) { if (hand.has(j)) continue;
      const a = list[i], b = list[j], dt = T[j] - T[i];
      if (a.platform === b.platform) continue;
      if (a.code && a.code === b.code) { pairs.push([0, i, j]); continue; }
      if (dt > 3 * 864e5) { if (!a.code) break; continue; }
      if ((dt < 864e5 && similar(W[i], W[j]) >= 0.6) || (n(a.duration) > 3 && Math.abs(n(a.duration) - n(b.duration)) <= 1)) pairs.push([dt, i, j]);
    } }
  pairs.sort((x, y) => x[0] - y[0]);
  const pfs = new Map<number, Set<string>>(list.map((p, i) => [i, new Set([p.platform])]));
  for (const [, i, j] of pairs) { const ri = find(i), rj = find(j); if (ri === rj) continue; const A = pfs.get(ri)!, B = pfs.get(rj)!; if ([...B].some((k) => A.has(k))) continue; parent[rj] = ri; B.forEach((k) => A.add(k)); }
  const out = new Map<number, D[]>();
  list.forEach((p, i) => { const r = find(i), g = out.get(r); if (g) g.push(p); else out.set(r, [p]); });
  return [...out.values()];
}
function ContentTable({ posts, groups, onOpen }: { posts: D[]; groups: D[]; onOpen: (p: D) => void }) {
  const rows = groupContent(posts, groups).map((g) => ({ g, title: g[0].title, created_at: g[0].created_at, views: g.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.views), 0), imps: g.filter((x) => isImp(x.platform)).reduce((t, x) => t + n(x.views), 0),
    likes: g.reduce((t, x) => t + n(x.likes), 0), sessions: g.reduce((t, x) => t + n(x.sessions), 0), scored: g.reduce((t, x) => t + n(x.scored), 0), n: g.length })).sort((a, b) => b.views - a.views);
  return <Tbl name="tartalmak" rows={rows} onRow={(r) => onOpen([...r.g].sort((a: D, b: D) => n(b.views) - n(a.views))[0])} cols={[
    { k: "title", l: "Tartalom", r: (r) => <span className="cellwrap" style={{ maxWidth: 380, display: "block" }}><b>{String(r.title || "(nincs szöveg)").slice(0, 80)}</b><br /><span className="mut">{ago(r.created_at)}</span></span> },
    { k: "n", l: "Platformok", r: (r) => <span className="xp-p">{(r.g as D[]).map((x) => <span key={x.platform} title={`${PF[x.platform]}: ${big(x.views)} ${viewWord(x.platform)}`}><Logo k={x.platform} size={20} /><small>{big(x.views)}</small></span>)}</span> },
    { k: "views", l: "Megtekintés össz.", num: true, r: (r) => <><b>{big(r.views)}</b>{r.imps ? <div className="mut" style={{ fontSize: 11 }}>+{big(r.imps)} megjelenés</div> : null}</> }, { k: "likes", l: "Kedvelés", num: true, r: (r) => big(r.likes) },
    { k: "sessions", l: "Látogató", num: true, r: (r) => <b>{fmt(r.sessions)}</b> }, { k: "scored", l: "Előnézet", num: true, r: (r) => fmt(r.scored) },
  ]} />;
}

/* ---------- the platforms' own exports (CSV): the numbers the API does not give, matched by video id or link ---------- */
type Src = "tiktok" | "youtube" | "instagram" | "facebook";
const COLS: [RegExp, string][] = [[/average (watch time|view duration)|átlagos (nézési idő|megtekintési időtartam)|avg\.? watch/i, "watch_avg"], [/watch time \(hours\)|nézési idő \(óra\)/i, "watch_hours"], [/total (play|watch) time|teljes nézési idő/i, "watch_total"],
  [/watched full video|full video|végignéz|completion/i, "completion"], [/^(total )?(saves|favorites|kedvencek|mentések)$/i, "saves"], [/^reach$|^elérés$|accounts reached|elért fiókok/i, "reach"],
  [/new followers|új követ|^subscribers$|^feliratkozók$|^follows$/i, "follows"], [/click-through rate|átkattintási arány/i, "ctr"], [/^impressions$|^megjelenések$/i, "impressions"],
  [/^shares$|^megosztások$/i, "shares"], [/^(link )?clicks$|^kattintások$/i, "clicks"], [/profile visits|profillátogatás/i, "profile_visits"]];
const ID_COL: Record<Src, RegExp> = { tiktok: /video (id|link)|videó (azonosító|link)|^link$|^id$/i, youtube: /^content$|^tartalom$|video id|videó azonosító/i, instagram: /post id|media id|bejegyzés azonosító|permalink|^id$/i, facebook: /post id|bejegyzés azonosító|permalink|^id$/i };
function ImportCsv({ done }: { done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [msg, setMsg] = useState(""); const [src, setSrc] = useState<Src>("tiktok");
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    e.target.value = ""; /* the same file can be chosen again */
    const txt = (await f.text()).replace(/^﻿/, "");
    const sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const parse = (l: string) => { const out: string[] = []; let cur = "", q = false; for (const c of l) { if (c === '"') q = !q; else if (c === sep && !q) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map((x) => x.trim()); };
    const lines = txt.split(/\r?\n/).filter(Boolean), head = parse(lines.shift() || "");
    const idCol = head.findIndex((h) => ID_COL[src].test(h));
    if (idCol < 0) { setMsg("Nincs videó-azonosító vagy link oszlop ebben a fájlban (jó platformot választottál?)."); return; }
    const map = head.map((h) => COLS.find(([re]) => re.test(h))?.[1] || null);
    const trafficCols = head.map((h, i) => (/traffic source|forgalom/i.test(h) || /for you|following|profile|search|sound|personal/i.test(h) && /%/.test(h) ? i : -1)).filter((i) => i >= 0 && !map[i]);
    /* "1,234" and "1.234" are thousands; "1,5" and "12.5" decimals; "0:42" and "1:02:03" are durations */
    const num = (v: string) => {
      const s2 = v.replace(/[\s ]/g, "").replace("%", "");
      if (/^\d+:\d{2}(:\d{2})?$/.test(s2)) return s2.split(":").map(Number).reduce((t, x) => t * 60 + x, 0);
      let t = s2;
      if (t.includes(",") && t.includes(".")) { const dec = t.lastIndexOf(",") > t.lastIndexOf(".") ? "," : "."; t = t.split(dec === "," ? "." : ",").join("").replace(",", "."); }
      else if (/^-?[1-9]\d{0,2}([,.]\d{3})+$/.test(t)) t = t.replace(/[,.]/g, "");
      else t = t.replace(",", ".");
      const x = Number(t); return Number.isFinite(x) ? x : null;
    };
    /* the ids we know, so a Meta export's bare post id or a link finds the post */
    const known = POOL.posts.filter((p) => p.platform === src);
    const idOf = (raw: string) => {
      const v = raw.trim(); if (!v || /^(total|összesen)/i.test(v)) return null;
      if (src === "tiktok") return v.match(/video\/(\d+)/)?.[1] || (/^\d+$/.test(v.replace(/\D/g, "")) ? v.replace(/\D/g, "") : null);
      if (src === "youtube") return v.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] || (/^[\w-]{11}$/.test(v) ? v : null);
      const hit = known.find((p) => p.post_id === v || String(p.post_id).endsWith("_" + v) || (p.url && v.length > 6 && String(p.url).includes(v)) || (p.url && v.startsWith("http") && v.replace(/\/$/, "") === String(p.url).replace(/\/$/, "")));
      return hit ? hit.post_id : /^\d+(_\d+)?$/.test(v) ? v : null;
    };
    const rows = lines.map(parse).map((c) => { const id = idOf(c[idCol] || ""); if (!id) return null;
      const r: D = { platform: src, post_id: id };
      map.forEach((k, i) => { if (k && c[i] != null && c[i] !== "") { const v = num(c[i]); if (v != null) r[k] = v; } });
      /* YouTube gives watch time in hours and the click-through rate in percent */
      if (r.watch_hours != null) { r.watch_total = Math.round(r.watch_hours * 3600); delete r.watch_hours; }
      if (r.ctr != null) r.ctr = r.ctr > 1 ? r.ctr / 100 : r.ctr;
      if (trafficCols.length) r.traffic = Object.fromEntries(trafficCols.map((i) => [head[i].replace(/\s*\(%\)|%/g, "").trim(), num(c[i]) || 0]));
      return r; }).filter(Boolean);
    if (!rows.length) { setMsg("A fájlban nincs feldolgozható sor."); return; }
    if (MOCK) { setMsg(`${rows.length} sor beolvasva (minta).`); return; }
    const { data, error } = await rpc(sb, "admin_import_posts", { p_rows: rows });
    if (error) { setMsg("Nem sikerült beolvasni: " + error.message); return; }
    setMsg(`${fmt(Number(data))} poszt frissítve a(z) ${rows.length} sorból.`); toast("Export beolvasva"); done();
  };
  return <div className="adm-row"><select className="adm-in sm" value={src} onChange={(x) => setSrc(x.target.value as Src)} aria-label="Melyik platform exportja"><option value="tiktok">TikTok Studio</option><option value="youtube">YouTube Studio</option><option value="instagram">Instagram (Meta)</option><option value="facebook">Facebook (Meta)</option></select>
    <span className="conn-file"><input type="file" accept=".csv,text/csv" onChange={onFile} /><span>CSV kiválasztása</span></span>{msg && <span className="note">{msg}</span>}</div>;
}


/* ---------- post calendar ---------- */
export function PostCalendar({ posts, onOpen }: { posts: D[]; onOpen: (p: D) => void }) {
  const [off, setOff] = useState(0); const [pick, setPick] = useState<number | null>(null);
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() - off);
  const y = base.getFullYear(), m = base.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const byDay = new Map<number, D[]>();
  posts.forEach((p) => { if (!p.created_at) return; const d = new Date(p.created_at); if (d.getFullYear() === y && d.getMonth() === m) { const a = byDay.get(d.getDate()) || []; a.push(p); byDay.set(d.getDate(), a); } });
  const inMonth = Array.from(byDay.values()).flat();
  const maxV = Math.max(1, ...inMonth.map((p) => n(p.views)));
  /* how far back there are posts at all */
  const oldest = posts.reduce((t, p) => Math.min(t, p.created_at ? new Date(p.created_at).getTime() : t), Date.now());
  const canBack = new Date(y, m, 1).getTime() > oldest;
  const today = new Date();
  return (
    <div className="cal">
      <div className="cal-h"><button className="adm-ibtn sm" disabled={!canBack} onClick={() => { setPick(null); setOff(off + 1); }}>←</button><b>{base.toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}</b><button className="adm-ibtn sm" disabled={!off} onClick={() => { setPick(null); setOff(Math.max(0, off - 1)); }}>→</button></div>
      <div className="cal-g">
        {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((x) => <span key={x} className="cal-d">{x}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={"e" + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1, ps = [...(byDay.get(day) || [])].sort((a, b) => n(b.views) - n(a.views)), best = ps[0];
          const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
          return (
            <button key={day} className={"cal-c" + (ps.length ? " has" : "") + (isToday ? " today" : "")} disabled={!ps.length} aria-label={ps.length ? `${day}. nap: ${fmt(ps.length)} poszt` : undefined} onClick={() => { if (ps.length > 1) setPick(day); else if (best) onOpen(best); }}
              style={best ? { ["--heat" as string]: (0.15 + 0.85 * Math.sqrt(n(best.views) / maxV)).toFixed(2), backgroundImage: best.thumb ? `linear-gradient(180deg,transparent 30%,rgba(0,0,0,.62)),url("${String(best.thumb).replace(/"/g, "")}")` : undefined } : undefined} title={ps.map((p) => `${PF[p.platform]}: ${big(p.views)} ${viewWord(p.platform)} · ${(p.title || "").slice(0, 40)}`).join("\n")}>
              <span className="cal-n">{day}</span>{ps.length > 0 && <span className="cal-v"><i style={{ background: chColor(best.platform) }} />{big(best.views)}{ps.length > 1 ? ` +${ps.length - 1}` : ""}</span>}
              {best && <span className="cal-heat" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="cal-leg"><span>A cella: a nap legnézettebb posztja (borítóval, ha van); több poszt esetén a napra koppintva mind látszik · {fmt(inMonth.length)} poszt ebben a hónapban</span><span className="heat-scale">kevés<i /><i /><i /><i /><i />sok megtekintés</span></div>
      {pick != null && <Sheet title={new Date(y, m, pick).toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" })} sub={`${fmt((byDay.get(pick) || []).length)} poszt`} close={() => setPick(null)}>
        <ul className="ic-dc">{[...(byDay.get(pick) || [])].sort((a, b) => n(b.views) - n(a.views)).map((p) => <li key={p.platform + p.post_id}><button className="ic-dc-b" onClick={() => { setPick(null); onOpen(p); }}>
          <span className="ic-dc-img">{p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <Logo k={p.platform} size={30} />}</span>
          <span className="ic-rt"><b>{String(p.title || "(nincs szöveg)").slice(0, 80)}</b><small>{PF[p.platform]}{p.kind ? " · " + (KIND[p.kind] || p.kind) : ""}</small></span>
          <span className="ic-rv"><b>{big(p.views)}</b><small>{viewWord(p.platform)}</small></span></button></li>)}</ul>
      </Sheet>}
    </div>
  );
}


/* ---------- "Mi működik?": automatic tags and how they compare with the average ---------- */
export function postTags(p: D): string[] {
  const t: string[] = [], title = String(p.title || "");
  t.push(PF[p.platform] || p.platform);
  if (p.kind) t.push(KIND[p.kind] || p.kind);
  if (/\?/.test(title)) t.push("Kérdéssel indul");
  if (/^\s*\d/.test(title) || /\b\d+\s*(tipp|hiba|tetoválás|tattoo|ways|tips)/i.test(title)) t.push("Számmal / listával");
  if (/before|after|előtte|utána|→/i.test(title)) t.push("Előtte–utána");
  if (/rate|pontoz|score|\/100/i.test(title)) t.push("Pontszám a horog");
  if (/[áéíóöőúüű]/i.test(title)) t.push("Magyar szöveg"); else if (title) t.push("Angol szöveg");
  if (p.code) t.push("Van követhető link");
  const dur = n(p.duration); if (dur) t.push(dur <= 15 ? "15 mp alatt" : dur <= 30 ? "15–30 mp" : "30 mp fölött");
  if (p.created_at) { const b = bpParts(new Date(p.created_at)), h = b.hour, w = b.dow % 7; t.push(h < 12 ? "Délelőtt posztolva" : h < 18 ? "Délután posztolva" : "Este posztolva"); t.push(w === 0 || w === 6 ? "Hétvégén" : "Hétköznap"); }
  return t;
}

/* each post scored against its own platform (views ÷ platform median, or engagement, or visitors per 1000 views), so a
   tag that is mostly on one platform does not win only because that platform counts bigger numbers */
export function TagInsights({ posts, metric = "x" }: { posts: D[]; metric?: "x" | "eng" | "rate" }) {
  const vs = vsMedian(posts);
  const score = (p: D) => (metric === "x" ? vs(p) : metric === "eng" ? (isImp(p.platform) ? null : engagement(p)) : p.code && n(p.views) > 0 ? (n(p.sessions) * 1000) / n(p.views) : null);
  const ps = posts.map((p) => ({ p, v: score(p) })).filter((x) => x.v != null) as { p: D; v: number }[];
  if (ps.length < 3) return <Empty t={metric === "rate" ? "Legalább 3 rövid linkes poszt kell ehhez az összevetéshez." : "Legalább 3 poszt kell az összevetéshez. Kapcsold össze a fiókjaidat, és itt megjelenik, milyen típusú videó működik nálad."} icon={P.spark} ghost />;
  const avg = ps.reduce((s, x) => s + x.v, 0) / ps.length;
  const m = new Map<string, { n: number; v: number }>();
  ps.forEach(({ p, v }) => postTags(p).filter((tg) => tg !== PF[p.platform]).forEach((tg) => { const o = m.get(tg) || { n: 0, v: 0 }; o.n++; o.v += v; m.set(tg, o); }));
  const rows = [...m].filter(([, o]) => o.n >= 2 && o.n < ps.length).map(([k, o]) => ({ k, n: o.n, x: o.v / o.n / Math.max(1e-9, avg) })).sort((a, b) => b.x - a.x);
  if (!rows.length) return <Empty t="Még nincs elég változatos poszt az összevetéshez." />;
  const max = Math.max(...rows.map((r) => r.x), 1.2);
  return (
    <ul className="tags">
      {rows.slice(0, 10).map((r) => (
        <li key={r.k}><span className="tg">{r.k}<small>{fmt(r.n)} poszt</small></span>
          <span className="tb2"><i style={{ width: `${(r.x / max) * 100}%`, background: r.x >= 1.15 ? "var(--a-good)" : r.x <= 0.85 ? "var(--a-bad)" : "var(--ink-bar)" }} /><em className="mid" style={{ left: `${(1 / max) * 100}%` }} /></span>
          <b style={{ color: r.x >= 1.15 ? "var(--a-good)" : r.x <= 0.85 ? "var(--a-bad)" : "var(--a-fg)" }}>{fmt(r.x, 1)}×</b></li>
      ))}
    </ul>
  );
}

/* "Most robban": a post under three days old that gathers views far faster than her posts usually do. Two older posts
   on the platform are enough for a first comparison (with one or none there is nothing to compare with). */
export function rising(posts: D[]) {
  const out: D[] = [];
  for (const pf of SOC) {
    const ps = posts.filter((p) => p.platform === pf && p.created_at && n(p.views) > 0);
    const old = ps.filter((p) => Date.now() - new Date(p.created_at).getTime() > 3 * 864e5).map((p) => n(p.views)).sort((a, b) => a - b);
    if (old.length < 2) continue;
    const med = old.length % 2 ? old[(old.length - 1) / 2] : (old[old.length / 2 - 1] + old[old.length / 2]) / 2;
    for (const p of ps) {
      const h = (Date.now() - new Date(p.created_at).getTime()) / 36e5;
      if (h > 72 || h < 2) continue;
      /* views so far, projected to three days at the same pace, against the median of her older posts */
      const x = (n(p.views) / h) * 72 / Math.max(1, med);
      if (x >= 2) out.push({ ...p, x, h });
    }
  }
  return out.sort((a, b) => b.x - a.x);
}
/* one post taking off. The counter runs up to the last real reading and moves again when the next hourly reading arrives: it never runs ahead of the data */
export function BlowCard({ p, open, when }: { p: D; open: (p: D) => void; when?: string }) {
  const [bad, setBad] = useState(false), pic = p.thumb && !bad;
  return (
    <button type="button" className="ic-blow" onClick={() => open(p)}>
      <span className="ic-blow-p">{pic ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} /> : <Logo k={p.platform} size={44} />}</span>
      <span className="ic-blow-b">
        <span className="ic-blow-l"><i aria-hidden="true" />Most robban<Logo k={p.platform} size={20} /></span>
        <b className="ic-blow-v"><CountUp v={n(p.views)} fmtFn={(x) => fmt(Math.round(x))} /></b>
        <small>{viewWord(p.platform)} {fmt(p.h, 0)} óra alatt</small>
        <span className="ic-blow-t">{String(p.title || PF[p.platform])}</span>
        <span className="ic-blow-m"><span className="ink-chg up">{fmt(p.x, 1)}× a szokásos tempó</span><span className="ink-chg same">{big(n(p.views) / Math.max(1, p.h))} / óra</span></span>
        {when && <small className="ic-blow-w">{when}</small>}
      </span>
    </button>
  );
}
function Rising({ posts, accs, onOpen }: { posts: D[]; accs: D[]; onOpen: (p: D) => void }) {
  const r = rising(posts);
  if (!r.length) return null;
  const last = accs.map((a) => a.last_sync_at).filter(Boolean).sort().pop() as string | undefined;
  return <section className="s12 ic-blows" aria-label="Most robban">{r.slice(0, 3).map((p) => <BlowCard key={p.platform + p.post_id} p={p} open={onOpen} when={last ? `Adat: ${ago(last)}, óránként frissül. Most érdemes kommentekre válaszolni és továbbposztolni.` : undefined} />)}</section>;
}

/* the same video on several platforms is one piece of content: grouped by hand, by its short link, or its words / length and the days it went out */
function CrossPost({ posts, groups }: { posts: D[]; groups: D[] }) {
  const all = groupContent(posts, groups);
  const multi = all.filter((g) => g.length > 1).sort((a, b) => b.reduce((t, x) => t + n(x.views), 0) - a.reduce((t, x) => t + n(x.views), 0)).slice(0, 8);
  if (!multi.length) return null;
  return (
    <Card className="s12" icon={P.layers} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Egy tartalom, minden platformon" sub="Ugyanaz a videó vagy poszt több platformon: összeadva, és platformonként egymás mellett. A kézi összevonás (poszt részletei), a közös rövid link, a szöveg nagyrészt egyező szavai vagy az egyforma videóhossz és a megjelenés ideje alapján párosítja, időben a legközelebbieket. Ez becslés: hasonló feliratoknál tévedhet, ilyenkor a poszt részleteinél kézzel javítható.">
      <ul className="xpost">{multi.map((g) => { const tot = g.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.views), 0), vis = g.reduce((t, x) => t + n(x.sessions), 0);
        return (
          <li key={g[0].platform + g[0].post_id}>
            <div className="xp-h"><b>{String(g[0].title).slice(0, 80)}</b><span>{big(tot)} megtekintés összesen{vis ? ` · ${fmt(vis)} látogató` : ""}</span></div>
            <div className="xp-p">{g.map((x) => <a key={x.platform} href={x.url} target="_blank" rel="noreferrer" title={viewWord(x.platform)}><Logo k={x.platform} size={20} /><b>{big(x.views)}</b><small>{isImp(x.platform) ? "megjelenés" : pct(n(x.views), tot)}</small></a>)}</div>
          </li>
        ); })}</ul>
    </Card>
  );
}

/* ---------- series: posts gathered under one name ("50 év múlva", "Előtte–utána"), kept in the database ---------- */
type Series = Record<string, string[]>; /* name → "platform|post_id" */
let SER: Series | null = null; const serSubs = new Set<() => void>();
function useSeries() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); serSubs.add(f); if (!SER) rpc(sb, "admin_setting_get", { p_k: "series" }).then(({ data }) => { SER = data && typeof data === "object" && !Array.isArray(data) ? (data as Series) : {}; serSubs.forEach((g) => g()); }); return () => { serSubs.delete(f); }; }, [sb]);
  const save = async (x: Series) => { const old = SER; SER = x; serSubs.forEach((g) => g()); if (MOCK) return ""; const r = await rpc(sb, "admin_setting_save", { p_k: "series", p_v: x }).catch((er) => ({ error: { message: String(er?.message || er) } })); if (r.error) { SER = old; serSubs.forEach((g) => g()); return r.error.message; } return ""; };
  return [SER || {}, save] as const;
}
function SeriesPick({ p }: { p: D }) {
  const [ser, save] = useSeries(); const key = p.platform + "|" + p.post_id;
  const cur = Object.keys(ser).find((k) => ser[k].includes(key)) || "";
  const [v, setV] = useState(cur); useEffect(() => setV(cur), [cur]);
  const put = async () => { const nx: Series = {}; Object.entries(ser).forEach(([k, l]) => { const r = l.filter((x) => x !== key); if (r.length) nx[k] = r; }); const nm = v.trim().slice(0, 40); if (nm) nx[nm] = [...(nx[nm] || []), key]; const er = await save(nx); toast(er ? "Nem sikerült menteni: " + er : nm ? `Sorozat: ${nm}` : "Kivéve a sorozatból"); };
  return <>
    <h3>Sorozat</h3>
    <div className="adm-row" style={{ gap: 6 }}><input className="adm-in sm" list="ser-l" placeholder="pl. 50 év múlva" value={v} onChange={(e) => setV(e.target.value)} style={{ flex: 1 }} /><datalist id="ser-l">{Object.keys(ser).map((k) => <option key={k} value={k} />)}</datalist><button className="adm-ibtn sm" onClick={put}>{v.trim() ? "Mentés" : "Kivétel"}</button></div>
  </>;
}
function SeriesCard({ posts, vs, onOpen }: { posts: D[]; vs: (p: D) => number | null; onOpen: (p: D) => void }) {
  const [ser] = useSeries();
  const rows = Object.entries(ser).map(([name, keys]) => { const ps = posts.filter((p) => keys.includes(p.platform + "|" + p.post_id)); const xs = ps.map(vs).filter((x): x is number => x != null);
    return { name, ps, n: ps.length, views: ps.filter((p) => !isImp(p.platform)).reduce((t, p) => t + n(p.views), 0), avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, last: ps.map((p) => p.created_at).sort().pop() }; })
    .sort((a, b) => n(b.avg) - n(a.avg));
  return (
    <Card className="s12" icon={P.layers} title="Sorozatok" sub="A posztjaid sorozatokba rendezve (egy poszt részleteinél adhatod meg a sorozat nevét). Sorozatonként: hány rész ment ki, mennyi megtekintést hoztak, és átlagosan hogyan mentek a saját platformjuk szokásos posztjához képest. Így látszik, melyik sorozatot érdemes folytatni.">
      {rows.length ? <Tbl name="sorozatok" rows={rows} cols={[
        { k: "name", l: "Sorozat", r: (r) => <b>{r.name}</b> }, { k: "n", l: "Rész", num: true, r: (r) => fmt(r.n) },
        { k: "views", l: "Megtekintés", num: true, r: (r) => big(r.views) }, { k: "avg", l: "Átlag × medián", num: true, r: (r) => (r.avg == null ? "–" : <b className={r.avg >= 1 ? "up" : "down"}>{fmt(r.avg, 1)}×</b>) },
        { k: "last", l: "Utolsó rész", r: (r) => (r.last ? ago(r.last) : "–") },
        { k: "ps", l: "Részek", r: (r) => <span className="xp-p">{(r.ps as D[]).slice(0, 8).map((p) => <button key={p.platform + p.post_id} className="lnk" onClick={() => onOpen(p)} title={String(p.title || "")}><Logo k={p.platform} size={18} /></button>)}</span> },
      ]} /> : <Empty t="Még nincs sorozat. Nyiss meg egy posztot, és a „Sorozat” mezőben adj neki egy nevet: a további részeket ugyanígy veheted hozzá." icon={P.layers} />}
    </Card>
  );
}
