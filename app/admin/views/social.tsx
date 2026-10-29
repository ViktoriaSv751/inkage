"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CountUp, Delta, Empty, Spark, StackedColumns, TrendChart, chColor, fmt, pct, SERIES } from "../charts";
import { Logo } from "../wow";
import { ActionCard, type Tone } from "../visuals";
import { ALL_DAYS, Band, Card, bpParts, daysLabel, FreshRow, I, Kpi, Loading, MOCK, Mini, P, PF, PERIODS, POOL, Tbl, ago, api, big, dt, n, rpc, type D, useRpc, Layer, SOC, useFreshSocial } from "../shared";
import { Retention } from "./youtube";
import { ChartBox, More } from "../extra";
import { toast } from "../phone";
import { Coverage, ManualPost, PfEmpty, ReachMatrix, Timeline } from "./social-wave";
import { ContentMatrix, PostHeat, VideoWall } from "./visual";

export function SyncButton({ done }: { done: () => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/admin/sync", { method: "POST" }); const j = r.json || {};
      setMsg(r.ok ? Object.entries(j).filter(([k]) => k !== "ok").map(([k, v]) => `${PF[k] || (k === "gsc" ? "Google" : k)}: ${v}`).join(" · ") || "Kész" : j.error || "Nem sikerült.");
    } finally { setBusy(false); done(); }
  };
  return <span className="adm-row" style={{ gap: 10 }}>{msg && <span className="note">{msg}</span>}<button className={"adm-ibtn" + (busy ? " busy" : "")} onClick={go} disabled={busy}>{I(P.refresh)}Adatok lehúzása most</button></span>;
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
  return <Empty t="Kösd be a Bing Webmaster Toolst a Kapcsolatok oldalon (ingyenes, Microsoft-fiókkal)." icon={P.search}><a className="adm-ibtn gold" href="#connect">Kapcsolatok</a></Empty>;
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
/* a Pinterest pin has no likes: its pin clicks stand in the like's place, under their own name */
const likeOf = (p: D) => (p.platform === "pinterest" ? p.pin_clicks ?? null : p.likes);
const isImp = (pf: string) => viewWord(pf) === "megjelenés";
/* the platform buttons: always all six, so it shows which one is missing; the ones without posts (not connected, nothing
   added by hand) are faint, and choosing one says why it is empty */
export function PfTabs({ pfs, v, set }: { pfs: string[]; v: string; set: (k: string) => void }) {
  return <div className="adm-seg sm pf-tabs" role="group">{["all", ...SOC].map((k) => { const has = k === "all" || pfs.includes(k);
    return <button key={k} aria-pressed={v === k} className={has ? undefined : "off"} title={has ? undefined : `${PF[k]}: még nincs posztja itt (nincs bekötve, vagy nincs poszt ebben az időszakban)`} onClick={() => set(k)}>{k === "all" ? "Mind" : PF[k] || k}</button>; })}</div>;
}

export function PostCard({ p, rank, compact: cmp, onOpen, mult }: { p: D; rank?: number; compact?: boolean; onOpen?: (p: D) => void; mult?: number | null }) {
  const rate = n(p.views) > 0 && p.code ? (n(p.sessions) * 1000) / n(p.views) : null;
  return (
    <a className={"post" + (cmp ? " cmp" : "")} href={p.url || undefined} target="_blank" rel="noreferrer" onClick={onOpen ? (e) => { e.preventDefault(); onOpen(p); } : undefined}>
      <div className="post-img">
        {p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="ph"><Logo k={p.platform} size={46} /></span>}
        <span className="pf"><i style={{ background: chColor(p.platform) }} />{PF[p.platform]}{p.kind && !cmp ? " · " + p.kind : ""}</span>
        {rank && <span className="rk">#{rank}</span>}
        {mult != null && <span className="mx" title={`A ${PF[p.platform]}-posztjaid szokásos (medián) ${viewWord(p.platform)}ének ${fmt(mult, 1)}-szerese`}>{fmt(mult, 1)}×</span>}
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
  const cols: [string, (r: D) => unknown][] = [["Platform", (r) => PF[r.platform] || r.platform], ["Dátum", (r) => (r.created_at ? String(r.created_at).slice(0, 10) : "")], ["Típus", (r) => r.kind], ["Szöveg", (r) => r.title], ["Link", (r) => r.url],
    ["Megtekintés / megjelenés", (r) => r.views], ["Ebben az időszakban", (r) => r.gained], ["× medián", (r) => (r.x != null ? r.x.toFixed(2) : "")], ["+7 nap", (r) => r.gain], ["Elköteleződés %", (r) => (r.eng != null ? (r.eng * 100).toFixed(2) : "")],
    ["Kedvelés / pin-kattintás", likeOf], ["Komment", (r) => r.comments], ["Megosztás", (r) => r.shares], ["Mentés", (r) => r.saves], ["Megjelenés", (r) => r.imp], ["Elérés", (r) => r.reach], ["Kattintás", (r) => r.clicks],
    ["Átl. nézési idő (mp)", (r) => r.watch_avg], ["Új követő", (r) => r.follows], ["Rövid link", (r) => r.code], ["Látogató", (r) => (r.code ? r.sessions : "")], ["/1000", (r) => (r.rate != null ? r.rate.toFixed(2) : "")], ["Előnézet", (r) => (r.code ? r.scored : "")]];
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
  const [view, setView] = useState<"timeline" | "wall" | "matrix" | "cards" | "table" | "content" | "top3">("cards");
  const [heatPf, setHeatPf] = useState("all");
  const [manual, setManual] = useState<D | null>(null);
  /* a phone: a sideways swipe over the list steps to the next platform */
  const tx = useRef(0), ty = useRef(0);
  const [mode, setMode] = useState<"born" | "gained">("born");
  const [kind, setKind] = useState("all"); const [linked, setLinked] = useState(false); const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [cols, setCols] = useState<string[]>(OPT_COLS.map(([k]) => k));
  const [tagPf, setTagPf] = useState("all"); const [tagM, setTagM] = useState<"x" | "eng" | "rate">("x");
  const [visV, setVisV] = useState<"pf" | "posts">("pf");
  const [calPf, setCalPf] = useState("all");
  const [allSync, setAllSync] = useState(false);
  const [openP, setOpenP] = useState<D | null>(null);
  const fresh = useFreshSocial((d as D | null)?.accounts, () => { load(); secLoad.current(); });
  useEffect(() => { setShown(PAGE); }, [pf, sort, kind, linked, q, mode, secDays]);
  useEffect(() => { setCols(readCols()); }, []);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  POOL.posts = d.posts || [];
  const accs: D[] = d.accounts || [];
  const acc = (p: string) => accs.find((a) => a.platform === p);
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
  const gainedList: D[] = [...sAll.map((p) => ({ ...p, gained: n(p.views) })), ...((S?.active || []) as D[]).map((p) => ({ ...p, gained: Math.max(0, n(p.views) - n(p.views_start)) }))];
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
  const pickPf = (p: string) => { setPf(p); setKind("all"); setView("timeline"); document.getElementById("soc-posts")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  /* every Budapest day of the period gets its column, the empty ones too (the chart used to skip them) */
  const visits: D[] = fillDays((d.visits || []) as D[], days);
  const sum = (k: string) => visits.reduce((t, x) => t + n(x[k]), 0);
  /* plays and impressions are not added together: Pinterest and LinkedIn give impressions only */
  const inPf = all.filter((x) => pf === "all" || x.platform === pf);
  const realViews = inPf.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.views), 0), imps = inPf.filter((x) => isImp(x.platform)).reduce((t, x) => t + n(x.views), 0);
  /* what every post (old ones too) gathered on the chosen days, by platform: the number for "Megtekintés az időszakban" */
  const G: D = d.gained || {}, GP: D = d.gained_prev || {}, inG = (p: string) => pf === "all" || p === pf;
  const gotViews = Object.keys(G).filter((p) => inG(p) && !isImp(p)).reduce((t, p) => t + n(G[p]), 0), gotPrev = Object.keys(GP).filter((p) => inG(p) && !isImp(p)).reduce((t, p) => t + n(GP[p]), 0);
  const gotImps = Object.keys(G).filter((p) => inG(p) && isImp(p)).reduce((t, p) => t + n(G[p]), 0);
  const inter = inPf.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.likes) + n(x.comments) + n(x.shares) + n(x.saves), 0);
  const tagged = inPf.filter((x) => x.code), tv = tagged.reduce((t, x) => t + n(x.sessions), 0), tvViews = tagged.reduce((t, x) => t + n(x.views), 0);
  const PV: D = d.prev || {}, pp: D = PV.posts || {}, pl: D = PV.leads || {};
  const prevOf = (k: string, f: (pf: string) => boolean = () => true) => Object.entries(pp).filter(([p]) => (pf === "all" || p === pf) && f(p)).reduce((t, [, v]) => t + n((v as D)[k]), 0);
  const prevViews = prevOf("views", (p) => !isImp(p)), prevInter = ["likes", "comments", "shares", "saves"].reduce((t, k) => t + prevOf(k, (p) => !isImp(p)), 0);
  const prevTv = prevOf("sessions"), prevTvViews = prevOf("tagged_views");
  const on = SOC.filter((p) => acc(p)), off = SOC.filter((p) => !acc(p));
  /* the band names the platforms the visitors came from, not the connected accounts */
  const visPfs = SOC.filter((p) => sum(p) > 0);
  const allVisits = SOC.reduce((t, p) => t + sum(p), 0), prevVisits = Object.values(pl).reduce((t: number, v) => t + n((v as D).sessions), 0);
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
    { k: "title", l: "Poszt", r: (r) => <span className="cellwrap" style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 380 }}>{r.thumb ? <img src={r.thumb} alt="" style={{ width: 34, height: 46, objectFit: "cover", borderRadius: 6, flex: "none" }} referrerPolicy="no-referrer" /> : null}<span><a href={r.url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={{ textDecoration: "none" }}>{(r.title || "(nincs szöveg)").slice(0, 80)}</a><br /><span className="mut">{r.kind || "poszt"}{r.code && <> · kód: <b>{r.code}</b></>}</span></span></span> },
    { k: "platform", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Logo k={r.platform} size={18} />{PF[r.platform]}</span> },
    { k: "created_at", l: "Dátum", r: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) : "–") },
    { k: "views", l: vw, num: true, r: (r) => <>{big(r.views)}{pf === "all" && isImp(r.platform) ? <div className="mut" style={{ fontSize: 11 }}>megjelenés</div> : null}</> },
    ...(mode === "gained" ? [{ k: "gained", l: "Ebben az időszakban", num: true, r: (r: D) => <b>+{big(r.gained)}</b> }] : []),
    { k: "x", l: "× medián", num: true, r: (r) => (r.x != null ? <b className={r.x >= 1 ? "up" : "down"} title={`A(z) ${PF[r.platform]}-posztjaid medián ${viewWord(r.platform)}ének ${fmt(r.x, 2)}-szerese (az összes posztod alapján, időszaktól függetlenül)`}>{fmt(r.x, 1)}×</b> : tooYoung(r) ? <span className="mut" title={YOUNG_T}>friss</span> : "–") },
    { k: "gain", l: "+7 nap", num: true, r: (r) => (r.gain != null ? "+" + big(Math.max(0, r.gain)) : <span className="mut" title={GAIN_T}>–</span>) },
    { k: "eng", l: "Elköteleződés", num: true, r: (r) => (r.eng != null ? fmt(r.eng * 100, 1) + "%" : "–") },
    { k: "likesShown", l: lw, num: true, r: (r) => <>{big(r.likesShown)}{pf === "all" && r.platform === "pinterest" ? <div className="mut" style={{ fontSize: 11 }}>pin-kattintás</div> : null}</> }, { k: "comments", l: "Komment", num: true, r: (r) => big(r.comments) },
    { k: "shares", l: "Megosztás", num: true, r: (r) => big(r.shares) }, { k: "saves", l: "Mentés", num: true, r: (r) => big(r.saves) },
    { k: "imp", l: "Megjelenés", num: true, r: (r) => <>{big(r.imp)}{r.ctr != null ? <div className="mut" style={{ fontSize: 11 }}>CTR {fmt(n(r.ctr) * 100, 1)}%</div> : null}</> }, { k: "reach", l: "Elérés", num: true, r: (r) => big(r.reach) }, { k: "clicks", l: "Kattintás", num: true, r: (r) => big(r.clicks) },
    { k: "watch_avg", l: "Átl. nézési idő", num: true, r: (r) => (r.watch_avg != null ? `${fmt(n(r.watch_avg), 1)} mp` : "–") },
    { k: "completion", l: "Végignézés", num: true, r: (r) => (r.completion != null ? fmt(n(r.completion), 1) + "%" : "–") },
    { k: "profile_visits", l: "Profilnézés", num: true, r: (r) => big(r.profile_visits) }, { k: "follows", l: "Új követő", num: true, r: (r) => big(r.follows) },
    { k: "sessions", l: "Látogató", num: true, r: (r) => (r.code ? <b style={{ color: "var(--a-gold)" }}>{fmt(r.sessions)}</b> : <span className="mut" title="Nincs rövid link a posztban">–</span>) },
    { k: "rate", l: "/1000", num: true, r: (r) => (r.rate != null ? fmt(r.rate, 1) : "–") },
    { k: "scored", l: "Előnézet", num: true, r: (r) => (r.code ? fmt(r.scored) : "–") },
  ];
  const tblCols = allCols.filter((c) => ["title", "platform", "created_at", "views", "gained"].includes(c.k) || cols.includes(c.k === "likesShown" ? "likes" : c.k));
  const top3 = secPfs.map((p) => ({ p, list: base.filter((r) => r.platform === p).sort((a, b) => (b.x ?? -1) - (a.x ?? -1)).slice(0, 3) })).filter((x) => x.list.length);
  return (
    <div className="g">
      <FreshRow srcs={[...SOC, "events"]} />
      {fresh && <div className="s12 fresh-note"><span className="spin" />Friss számok a platformokról…</div>}
      <Coverage r={R} pick={pickPf} add={addPost} err={reach.e} retry={reach.load} />
      <ReachMatrix r={R} pick={pickPf} add={addPost} err={reach.e} retry={reach.load} />
      <Band label={`Látogató a közösségi oldalaidról · ${daysLabel(days)}`} value={allVisits} now={allVisits} prev={prevVisits} unit={visPfs.length ? visPfs.map((p) => PF[p]).join(", ") : "nincs közösségi látogató"}
        sentence={<>Ezekben a napokban a posztjaid (a régebbiek is) <b>{big(gotViews)}</b> megtekintést{gotImps ? <> és <b>{big(gotImps)}</b> megjelenést (Pinterest, LinkedIn)</> : null} kaptak; <b>{fmt(inPf.length)}</b> új poszt ment ki. A rövid linkes posztok <b>{fmt(tv)}</b> látogatót hoztak{tvViews ? <> (<b>{fmt((tv * 1000) / Math.max(1, tvViews), 1)}</b> / 1000 megtekintés)</> : null}. Az előző ugyanilyen hosszú időszakban <b>{fmt(prevVisits)}</b> látogató jött.</>}
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

      <Card className="s12" icon={P.users} title="Leadek platformonként" sub="Hány kattintás (rövid link), látogatás, előnézet és regisztráció indult az egyes közösségi oldalakról ebben az időszakban (a link, a bio vagy a hivatkozó alapján, a mi mérésünkből), és mennyi látogatás volt az előző ugyanilyen hosszú időszakban.">
        <Tbl name="leadek" rows={leads} empty="Ebben az időszakban még nem jött látogató a közösségi oldalakról." cols={[
          { k: "k", l: "Platform", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Logo k={r.k} size={26} /><b>{PF[r.k] || r.k}</b></span> },
          { k: "clicks", l: "Kattintás", num: true, r: (r) => <>{fmt(r.clicks)}{r.clicks_prev != null && <div className="mut" style={{ fontSize: 11 }}>előtte {fmt(r.clicks_prev)}</div>}</> },
          { k: "sessions", l: "Látogatás", num: true, r: (r) => <><b>{fmt(r.sessions)}</b> <Delta now={n(r.sessions)} prev={n(r.prev)} /></> }, { k: "prev", l: "Előző időszak", num: true, r: (r) => fmt(r.prev) },
          { k: "scored", l: "Előnézet", num: true, r: (r) => fmt(r.scored) }, { k: "conv", l: "Előnézetig", num: true, r: (r) => pct(n(r.scored), n(r.sessions)) },
          { k: "signups", l: "Regisztráció", num: true, r: (r) => fmt(r.signups) }, { k: "conv_s", l: "Regisztráció / látogatás", num: true, r: (r) => pct(n(r.signups), n(r.sessions)) },
        ]} />
      </Card>

      <Kpi kind="api" to="@Videók és posztok" tone="peach" className="s3" icon={P.eye} l="Megtekintés az időszakban" v={big(gotViews)} now={gotViews} prev={gotPrev} title="Amit az összes posztod (a régebbiek is) ezeken a napokon kapott: a napi pillanatképek különbsége; ami a mérés kezdete előtt gyűlt össze, a poszt megjelenésének napjára számít." sub={`${fmt(inPf.length)} új poszt${gotImps ? ` · +${big(gotImps)} megjelenés (Pinterest, LinkedIn)` : ""}`} />
      <Kpi kind="api" to="@Mi működik" tone="butter" className="s3" icon={P.spark} l="Elköteleződési arány" v={realViews ? fmt((inter / realViews) * 100, 1) + "%" : "–"} now={realViews ? (inter / realViews) * 1e4 : undefined} prev={prevViews ? (prevInter / prevViews) * 1e4 : undefined}
        sub={`kedvelés + komment + megosztás + mentés / megtekintés`} title="A megjelenést számoló platformok (Pinterest, LinkedIn) nélkül, hogy egy mértékegység legyen." />
      <Kpi kind="own" to="links" tone="pink" className="s3" hl icon={P.target} l="Látogató a videókból" v={<CountUp v={n(tv)} />} now={tv} prev={prevTv} sub={`${fmt(tagged.length)} posztban van rövid link`} />
      <Kpi kind="own" to="platforms" tone="sky" className="s3" icon={P.bolt} l="Látogató / 1000 megtekintés" v={tagged.length ? fmt((tv * 1000) / Math.max(1, tvViews), 1) : "–"} now={tvViews ? (tv * 1000) / tvViews : undefined} prev={prevTvViews ? (prevTv * 1000) / prevTvViews : undefined} sub="a rövid linkes posztoknál" />

      <Card className="s12" icon={P.traffic} title="Látogatók a közösségi oldalakról" sub="Naponta: hány látogatás indult az egyes platformokról (link, bio, hivatkozó alapján). A „Posztokkal” nézetben az összesen, és rajta a posztjaid megjelenésének napja: látszik, melyik poszt után ugrott meg."
        right={<div className="adm-seg sm"><button aria-pressed={visV === "pf"} onClick={() => setVisV("pf")}>Platformonként</button><button aria-pressed={visV === "posts"} onClick={() => setVisV("posts")}>Posztokkal</button></div>}
        foot={visV === "pf" ? <div className="legend">{SOC.map((p) => <span key={p}><i className="sq" style={{ background: chColor(p) }} />{PF[p]}</span>)}</div> : undefined}>
        {visV === "pf" ? <StackedColumns days={stack} keys={[...SOC]} label={(k) => PF[k]} />
          : <ChartBox data={visits.map((x: D) => ({ t: x.t, v: SOC.reduce((t, p) => t + n(x[p]), 0) }))} label="Látogató a közösségi oldalakról" marks={marks} name="kozossegi-latogatok" />}
      </Card>

      <Rising posts={all} onOpen={setOpenP} />
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

      <Card className="s12" icon={P.clock} title="Mikor posztolj?" src={[...SOC]} sub="A hét napjai × a nap órái (budapesti idő): a cella színe azt mutatja, hogy az akkor kitett posztjaid átlagosan hogyan mentek a saját platformjuk szokásos (medián) posztjához képest. Zöld: jobban, piros: gyengébben. Minden poszt számít, időszaktól függetlenül; a 24 óránál fiatalabbak még nem."
        right={<PfTabs pfs={calPfs} v={heatPf} set={setHeatPf} />}>
        <PostHeat posts={calAll.filter((p) => heatPf === "all" || p.platform === heatPf)} vs={vsAll} />
      </Card>
      <SeriesCard posts={calAll} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} />
      <div id="soc-posts" className="s12 anchor" />
      <Card className="s12" icon={P.social} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Videók és posztok" sub={<>Ennek a résznek <b>saját időszaka</b> van (alapból <b>Összes poszt</b>), a fölső időszak nem szűri: minden nézetre érvényes. <b>Idővonal</b>: minden poszt minden platformról, a legújabb felül, napokra bontva (a kézzel felvettek is). Megtekintés a platformtól (Pinteresten és LinkedInen megjelenés), látogató és előnézet a mi mérésünkből (a <b>inkage.app/go/kód</b> link alapján). <b>/1000</b> = látogató 1000 megtekintésenként: ez mutatja, melyik videó hoz tényleg embert. A <b>× medián</b> (és a <b>platformja átlagához képest</b> rendezés) minden posztot a saját platformod összes posztjának medián számához mér (a poszt maga nélkül, időszaktól függetlenül; a 24 óránál fiatalabb poszt még nem kap szorzót), így a TikTok-videók, a pinek és a LinkedIn-posztok egy listában is összevethetők. Az <b>Ebben az időszakban szerzett</b> nézet a régebbi posztokat is mutatja azzal, amit az időszakban gyűjtöttek. A <b>+7 nap</b> oszlop a 7 nappal korábbi napi pillanatképhez mér: a pillanatképek 2026. okt. 22-én indultak, ezért addig „–”.</>}
        right={<>
          <select className="adm-in sm" value={secDays} onChange={(x) => setSecDays(Number(x.target.value))} aria-label="Időszak a videókhoz és posztokhoz" title="Ennek a résznek a saját időszaka; a fölső időszak nem szűri">{[...PERIODS].sort((a, b) => (a.d === 0 ? -1 : b.d === 0 ? 1 : 0)).map((x) => <option key={x.d} value={x.d}>{x.d === 0 ? "Összes poszt" : x.d === 1 ? "Ma (24 óra)" : "Utolsó " + x.l}</option>)}</select>
          <PfTabs pfs={allTime ? calPfs : secPfs} v={pf} set={(k) => { setPf(k); setKind("all"); }} />
          {!allTime && <><div className="adm-seg sm" role="group"><button aria-pressed={mode === "born"} onClick={() => setMode("born")} title="Az időszakban megjelent posztok">Megjelent</button><button aria-pressed={mode === "gained"} onClick={() => { setMode("gained"); if (sort === "date") setSort("gained"); }} title="Ebben az időszakban szerzett megtekintés, a régebbi posztoké is">Szerzett</button></div>
          <select className="adm-in sm" value={sort} onChange={(e) => setSort(e.target.value as SortK)} aria-label="Rendezés">{SORTS.filter(([k]) => k !== "gained" || mode === "gained").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></>}
          <div className="adm-seg sm" role="group"><button aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Idővonal</button><button aria-pressed={view === "wall"} onClick={() => setView("wall")}>Fal</button><button aria-pressed={view === "matrix"} onClick={() => setView("matrix")}>Mátrix</button><button aria-pressed={view === "cards"} onClick={() => setView("cards")}>Kártyák</button><button aria-pressed={view === "table"} onClick={() => setView("table")}>Táblázat</button><button aria-pressed={view === "content"} onClick={() => setView("content")}>Tartalmanként</button><button aria-pressed={view === "top3"} onClick={() => setView("top3")}>Legjobb 3</button></div>
          <button className="adm-ibtn sm gold" onClick={() => addPost(pf)}>{I(P.plus)}Poszt kézzel</button>
        </>}
        foot={<><span>Ha egy poszt szövegében ott a <b>inkage.app/go/12</b> link, vagy a Rövid linkek fülön hozzárendeled (vagy a poszt részleteinél a „Rövid link ehhez a poszthoz” gombbal), a látogatói is a poszthoz kötődnek.</span><SyncButton done={loadBoth} /></>}>
        <div className="soc-flt">
          <input className="adm-in sm" type="search" placeholder="Keresés a szövegben vagy kódra…" value={q} onChange={(x) => setQ(x.target.value)} aria-label="Keresés a posztokban" />
          <select className="adm-in sm" value={kind} onChange={(x) => setKind(x.target.value)} aria-label="Típus"><option value="all">Minden típus</option>{kinds.map((k) => <option key={k} value={k}>{KIND[k] || k}</option>)}</select>
          {!allTime && <label className="soc-chk"><input type="checkbox" checked={linked} onChange={(x) => setLinked(x.target.checked)} />van rövid link</label>}
          {view === "table" && <details className="soc-cols"><summary className="adm-ibtn sm">Oszlopok</summary><div>{OPT_COLS.map(([k, l]) => <label key={k} className="soc-chk"><input type="checkbox" checked={cols.includes(k)} onChange={() => toggleCol(k)} />{l}</label>)}</div></details>}
          {view === "cards" && posts.length > 0 && <button className="lnk" onClick={() => postsCsv(posts, "posztok")}>CSV ⤓</button>}
          <span className="mut">{allTime ? `${fmt(tlPosts.length)} poszt${secDays ? "" : ", minden időszak"}` : `${fmt(posts.length)} poszt`}</span>
        </div>
        {!S ? <Loading /> : <div onTouchStart={(e) => { tx.current = e.touches[0].clientX; ty.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - tx.current, dy = e.changedTouches[0].clientY - ty.current; if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
            const L = ["all", ...SOC], i = L.indexOf(pf), nx = L[(i + (dx < 0 ? 1 : -1) + L.length) % L.length]; setPf(nx); setKind("all"); toast(nx === "all" ? "Minden platform" : PF[nx]); }}>
        {view === "wall" ? (tlPosts.length ? <VideoWall posts={tlPosts} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} /> : pf !== "all" ? <PfEmpty pf={pf} connected={!!acc(pf)} add={addPost} /> : <Empty t="Még nincs poszt." icon={P.social} />)
          : view === "matrix" ? <ContentMatrix groups={groupContent(calAll.filter((r) => (kind === "all" || r.kind === kind) && (!ql || String(r.title || "").toLowerCase().includes(ql))), d.groups || [])} vs={vsAll} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} />
          : view === "timeline" ? (tlPosts.length ? <Timeline posts={tlPosts} onOpen={(p) => setOpenP(all.find((x) => x.platform === p.platform && x.post_id === p.post_id) || p)} onEdit={setManual} />
            : pf !== "all" && !calAll.some((x) => x.platform === pf) ? <PfEmpty pf={pf} connected={!!acc(pf)} add={addPost} />
            : <Empty t={q || kind !== "all" ? "Nincs a szűrésnek megfelelő poszt." : secDays ? "Ebben az időszakban nincs poszt." : "Még nincs poszt. Kösd be a platformokat, vagy vedd fel a posztokat kézzel."} icon={P.social}>{secDays && !q && kind === "all" ? <button className="adm-ibtn" onClick={() => setSecDays(0)}>Összes poszt</button> : null}</Empty>)
          : !posts.length ? (pf !== "all" && !calAll.some((x) => x.platform === pf) ? <PfEmpty pf={pf} connected={!!acc(pf)} add={addPost} />
            : <Empty t={q || kind !== "all" || linked ? "Nincs a szűrésnek megfelelő poszt." : pf !== "all" ? `Ebben az időszakban nincs ${PF[pf]}-poszt.` : "Ebben az időszakban nincs poszt."} icon={P.social}>{secDays ? <button className="adm-ibtn" onClick={() => setSecDays(0)}>Összes poszt</button> : null}</Empty>)
          : view === "content" ? <ContentTable posts={posts} groups={d.groups || []} onOpen={setOpenP} />
          : view === "top3" ? <div className="soc-top3">{top3.map(({ p, list }) => <div key={p}><h4><Logo k={p} size={20} />{PF[p]}<small>a medián {viewWord(p)} szorzója</small></h4><div className="posts">{list.map((x, i) => <PostCard key={x.post_id} p={x} rank={i + 1} mult={x.x} onOpen={setOpenP} />)}</div></div>)}</div>
          : view === "cards" ? <><div className="posts wall">{posts.slice(0, shown).map((p, i) => <PostCard key={p.platform + p.post_id} p={mode === "gained" ? p : { ...p, gained: undefined }} rank={sort === "date" && mode === "born" ? undefined : i + 1} mult={sort === "x" ? p.x : undefined} onOpen={setOpenP} />)}</div>
            {posts.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + PAGE)}>Még {fmt(Math.min(PAGE, posts.length - shown))} poszt ({fmt(posts.length - shown)} van még)</button></div>}</>
          : <Tbl name="posztok" rows={posts} onRow={setOpenP} cols={tblCols} />}
        </div>}
      </Card>

      <More label="Részletek: CSV-import, adatlehúzások">
      <Card className="s12" icon={P.doc} title="Export feltöltése (TikTok Studio, YouTube Studio, Meta)" sub="Amit az API nem ad ki (TikTokon az átlagos nézési idő, a végignézés, a mentés, az elérés és a forgalomforrás; YouTube-on a bélyegkép-megjelenés és az átkattintás; Metánál az elérés és a mentés régebbi posztokra), az a platform saját exportjából jön. TikTok Studio → Elemzések → Tartalom → Letöltés; YouTube Studio → Elemzések → Speciális mód → Exportálás; Meta Business Suite → Statisztikák → Tartalom → Exportálás. Videó-azonosító vagy link alapján párosítja a posztokhoz; amit a platform lehúzása később nem ad, az megmarad.">
        <ImportCsv done={load} />
      </Card>
      <Card className="s12" icon={P.refresh} title="Platformok állapota" sub="Forrásonként: mikor sikerült utoljára a lehúzás, mikor volt utoljára hiba, hány hiba volt a héten, és mikor jár le a kapcsolat.">
        <Tbl name="lehuzas-allapot" csv={false} rows={[...SOC.filter((p) => acc(p) || state.some((s) => s.source === p)), ...state.map((s) => s.source).filter((s) => !(SOC as readonly string[]).includes(s))].map((k) => ({ k, ...(state.find((s) => s.source === k) || {}), a: acc(k) }))} empty="Még nem futott lehúzás." cols={[
          { k: "k", l: "Forrás", r: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{PF[r.k] ? <Logo k={r.k} size={20} /> : null}<b>{PF[r.k] || (r.k === "gsc" ? "Google Search Console" : r.k)}</b></span> },
          { k: "last_ok", l: "Utolsó siker", r: (r) => (r.last_ok ? <span title={dt(r.last_ok)}>{ago(r.last_ok)}</span> : "–") },
          { k: "last_fail", l: "Utolsó hiba", r: (r) => (r.last_fail ? <span className="cellwrap" title={r.last_msg}><span className={"chip " + (r.last_ok && r.last_ok > r.last_fail ? "" : "bad")}>{ago(r.last_fail)}</span> <span className="mut">{String(r.last_msg || "").slice(0, 90)}</span></span> : "–") },
          { k: "fails_7d", l: "Hiba / 7 nap", num: true, r: (r) => fmt(r.fails_7d) },
          { k: "exp", l: "Kapcsolat lejár", r: (r) => { const t = r.a?.refresh_expires_at || r.a?.token_expires_at; if (!r.a) return "–"; if (!t) return <span className="mut">nem jár le</span>; const left = (new Date(t).getTime() - Date.now()) / 864e5;
            return <span className={"chip " + (left < 0 ? "bad" : left < 10 ? "warn" : "")} title={dt(t)}>{left < 0 ? "lejárt" : left < 2 ? `${fmt(left * 24)} óra múlva` : `${fmt(left)} nap múlva`}</span>; } },
        ]} />
      </Card>
      <Card className="s12" icon={P.refresh} title="Adatlehúzások" sub="Az utolsó automatikus és kézi frissítések (legfeljebb 100)."
        right={(d.sync || []).length > 20 ? <button className="adm-ibtn sm" onClick={() => setAllSync(!allSync)}>{allSync ? "Csak az utolsó 20" : `Mind a ${fmt((d.sync || []).length)}`}</button> : undefined}>
        <Tbl rows={(d.sync || []).slice(0, allSync ? 100 : 20)} empty="Még nem futott." cols={[
          { k: "at", l: "Mikor", r: (r) => dt(r.at) }, { k: "source", l: "Forrás", r: (r) => PF[r.source] || (r.source === "gsc" ? "Google Search Console" : r.source) },
          { k: "ok", l: "Eredmény", r: (r) => <span className={"chip " + (r.ok ? "good" : "bad")}>{r.ok ? "rendben" : "hiba"}</span> },
          { k: "message", l: "Részlet", r: (r) => <span className="cellwrap mut">{r.message}</span> },
        ]} />
      </Card>
      </More>
      {openP && <PostDrawer p={openP} close={() => setOpenP(null)} />}
      {manual && <ManualPost init={manual} close={() => setManual(null)} saved={reloadAll} />}
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
const KIND: Record<string, string> = { reel: "Reels", video: "Videó", short: "Shorts", image: "Kép", carousel_album: "Körhinta", carousel: "Körhinta", pin: "Pin", post: "Poszt", link: "Link", document: "Dokumentum" };

/* the replies her inbox can send from here */
const CAN_REPLY = new Set(["instagram", "facebook", "youtube"]);

export function PostDrawer({ p, close }: { p: D; close: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [x, setX] = useState<D | null>(null);
  const [link, setLink] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [grp, setGrp] = useState(""); const [reply, setReply] = useState<Record<string, string>>({}); const [sent, setSent] = useState<Record<string, boolean>>({});
  const load = () => rpc(sb, "admin_post", { p_platform: p.platform, p_post_id: p.post_id }).then(({ data }) => setX(data || {}));
  useEffect(() => { load(); }, [sb, p]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const q: D = { ...p, ...(x?.post || {}) };
  /* the platform's median from the database (the page it was opened from may not have the platform's posts) */
  const pool = POOL.posts.filter((o) => o.platform === p.platform && o.post_id !== p.post_id && n(o.views) > 0).map((o) => n(o.views)).sort((a, b) => a - b);
  const peerN = x?.peers ? n(x.peers.n) : pool.length, med = x?.peers?.median != null ? n(x.peers.median) : pool.length ? pool[Math.floor(pool.length / 2)] : 0;
  const times = med > 0 && q.views != null && !tooYoung(q) ? n(q.views) / med : null; /* a post under a day old is not compared yet */
  const daily: D[] = x?.daily || [];
  const gained = daily.map((dd: D, i: number) => ({ t: dd.day, v: i ? Math.max(0, n(dd.views) - n(daily[i - 1].views)) : 0 }));
  /* impressions a day: the platform's own day number where it gives one (pins, YouTube thumbnails), else the growth of the total */
  const dayImp: D[] = (x?.days || []).filter((r: D) => r.impressions != null).map((r: D) => ({ t: r.day, v: n(r.impressions) }));
  const impD = dayImp.length > 1 ? dayImp : daily.map((dd: D, i: number) => ({ t: dd.day, v: i && dd.impressions != null && daily[i - 1].impressions != null ? Math.max(0, n(dd.impressions) - n(daily[i - 1].impressions)) : null })).filter((r) => r.v != null).slice(1) as D[];
  const reachD = daily.filter((dd) => dd.reach != null).map((dd) => ({ t: dd.day, v: n(dd.reach) }));
  const clickD = ((x?.clicks || []) as D[]).map((c) => ({ t: c.t, v: n(c.n) }));
  const t0 = q.created_at ? new Date(q.created_at).getTime() : 0;
  const hourly: D[] = (x?.hourly || []).filter((h: D) => !t0 || new Date(h.at).getTime() - t0 <= 7 * 864e5);
  const first72 = hourly.filter((h: D) => !t0 || new Date(h.at).getTime() - t0 <= 72 * 3600e3);
  /* the hourly reads began on 2026-10-22: for an older post the curve starts late, and that is said, not hidden */
  const h0 = t0 && first72.length ? Math.floor((new Date(first72[0].at).getTime() - t0) / 3600e3) : 0;
  const vis: D[] = x?.visits || [], ch0: D = x?.chain || {};
  const watch = q.watch_avg != null ? n(q.watch_avg) : null;
  const vw = cap(viewWord(p.platform));
  const chain = [[vw, n(q.views)], ["Kattintás a linkre", n(ch0.clicks)], ["Látogató", n(ch0.sessions ?? q.sessions)], ["Előnézet", n(ch0.scored ?? q.scored)], ["Fiók", n(ch0.signups)], ["Megosztás", n(ch0.shared)]] as [string, number][];
  const traffic = q.traffic && typeof q.traffic === "object" ? Object.entries(q.traffic as Record<string, number>).map(([k, v]) => ({ k, n: n(v) })) : [];
  const comments: D[] = x?.comments || [];
  const code = link || x?.code;
  const makeLink = async () => {
    setBusy(true);
    const { data, error } = MOCK ? { data: "13", error: null } : await rpc(sb, "admin_link_for_post", { p_platform: p.platform, p_post_id: p.post_id });
    setBusy(false);
    if (error || !data) { toast(error?.message || "Nem sikerült"); return; }
    setLink(String(data)); navigator.clipboard?.writeText(`inkage.app/go/${data}`).catch(() => {}); toast(`inkage.app/go/${data} · vágólapra másolva`);
  };
  const saveGrp = async () => { if (!MOCK) await rpc(sb, "admin_post_group_set", { p_platform: p.platform, p_post_id: p.post_id, p_grp: grp.trim() || null }); toast(grp.trim() ? "Összevonva: a következő betöltéskor együtt látszik" : "Visszaállítva az automatikus párosításra"); };
  const send = async (c: D) => {
    const text = (reply[c.item_id] || "").trim(); if (!text) return;
    const r = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: c.source, id: c.item_id, text }) });
    if (r.ok) { setSent({ ...sent, [c.item_id]: true }); toast("Válasz elküldve"); load(); } else toast(r.json?.error || "Nem sikerült elküldeni");
  };
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer wide" role="dialog" aria-label="Poszt részletei">
        <div className="c-h"><div><div><span className="eyebrow">{PF[p.platform]} · {KIND[q.kind] || q.kind || "poszt"} · {ago(q.created_at)}</span><h2 style={{ fontSize: 18, marginTop: 6, lineHeight: 1.35 }}>{(q.title || "(nincs szöveg)").slice(0, 140)}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {tooYoung(q) && peerN >= 2 && <p className="note">{YOUNG_T}.</p>}
        {times != null && peerN >= 2 && <div className={"vs-avg " + (times >= 1 ? "up" : "down")}><b>{fmt(times, times < 10 ? 1 : 0)}×</b><span>{times >= 1 ? "jobb" : "gyengébb"}, mint a(z) {PF[p.platform]}-posztjaid szokásos (medián) {viewWord(p.platform)}e ({big(med)}, {peerN} poszt alapján)</span></div>}
        <div className="mini-stats pd-stats">
          {isImp(p.platform) ? <Mini l="Megjelenés" v={big(q.views)} sub={p.platform === "pinterest" ? "a 90 napnál régebbi napokkal együtt, amióta lehúzzuk" : undefined} />
            : <><Mini l="Megtekintés" v={big(q.views)} /><Mini l="Megjelenés" v={big(q.impressions)} sub={q.impressions == null ? (p.platform === "tiktok" ? "a TikTok nem adja ki" : p.platform === "youtube" ? "a bélyegkép-megjelenés napi jelentésből jön" : undefined) : p.ctr != null ? `átkattintás ${fmt(n(p.ctr) * 100, 1)}%` : undefined} /></>}
          <Mini l="Elérés" v={big(q.reach)} /><Mini l={cap(likeWord(p.platform))} v={big(p.platform === "pinterest" ? p.pin_clicks : q.likes)} /><Mini l="Komment" v={big(q.comments)} />
          <Mini l="Megosztás" v={big(q.shares)} /><Mini l="Mentés" v={big(q.saves)} /><Mini l="Átl. nézési idő" v={watch != null ? `${fmt(watch, 1)} mp` : "–"} sub={watch != null && q.duration ? `a videó ${pct(watch, n(q.duration))}-a` : undefined} />
          <Mini l="Végignézés" v={q.completion != null ? fmt(n(q.completion), 1) + "%" : "–"} /><Mini l="Profilnézés" v={big(q.profile_visits)} /><Mini l="Új követő" v={big(q.follows)} />
          <Mini l={p.platform === "pinterest" ? "Kattintás a weboldalra" : "Kattintás"} v={big(q.clicks)} /><Mini l="/1000" v={code && n(q.views) ? fmt((n(ch0.sessions ?? q.sessions) * 1000) / n(q.views), 1) : "–"} />
        </div>
        {!x ? <div className="skel" style={{ height: 200 }} /> : (
          <>
            <h3>A videótól az eredményig</h3>
            <div className="chain">{chain.map(([l, v], i) => <div key={l} className="chain-i"><b>{big(v)}</b><span>{l}</span>{i > 0 && chain[i - 1][1] > 0 && <small>{pct(v, chain[i - 1][1])}</small>}</div>)}</div>
            {!code ? <div className="pd-link"><p className="note">Ebben a posztban nincs rövid link, ezért a kattintás, a látogató, az előnézet és a fiók nem köthető hozzá.</p><button className="adm-ibtn gold" onClick={makeLink} disabled={busy}>{I(P.links)}Rövid link ehhez a poszthoz</button></div>
              : link ? <div className="alert ok">Kész: <b>inkage.app/go/{link}</b>. Írd a poszt leírásába vagy a bióba; innentől a látogatói ehhez a poszthoz kötődnek.</div> : null}
            <h3>{h0 > 2 ? `A 72. óráig (mérve a ${h0}. órától)` : "Az első 72 óra"}</h3>
            {h0 > 2 && first72.length > 1 && <p className="note">Az óránkénti mérés a poszt {fmt(h0)}. órájától van; előtte nincs adat (az óránkénti lehúzás 2026. okt. 22-én indult).</p>}
            {first72.length > 1 ? <TrendChart data={first72.map((h: D) => ({ t: h.at, v: n(h.views) }))} label={`${vw} összesen`} hourly height={180} /> : <Empty t="Az óránkénti görbe a poszt első hetében készül (óránkénti lehúzás); régebbi posztnál a napi görbe látszik lent." />}
            <h3>Új {viewWord(p.platform)} naponta</h3>
            {gained.length > 1 ? <TrendChart data={gained.slice(1)} label={`Új ${viewWord(p.platform)}`} color={SERIES[0]} height={170} /> : <Empty t="A napi adatok az első pár adatlehúzás után jelennek meg." />}
            {!isImp(p.platform) && impD.length > 1 && <><h3>Megjelenés naponta</h3><TrendChart data={impD as any} label="Megjelenés" color={SERIES[2]} height={150} /></>}
            {reachD.length > 1 && <><h3>Elérés</h3><TrendChart data={reachD} label="Elérés (összesen)" color={SERIES[3]} height={150} /></>}
            {(x.retention || []).length > 0 && <><h3>Nézőmegtartás</h3><Retention curves={[{ post_id: p.post_id, pts: (x.retention as D[]).map((r) => ({ x: r.x, r: r.ratio })) }]} posts={[q]} /></>}
            {traffic.length > 0 && <><h3>Honnan jöttek a nézők</h3><div className="trf">{traffic.sort((a, b) => b.n - a.n).map((t) => <span key={t.k}><b>{fmt(t.n, 1)}%</b>{t.k}</span>)}</div></>}
            <h3>A rövid link{code ? ` (inkage.app/go/${code})` : ""}: kattintás és látogató naponta</h3>
            {code ? (clickD.length || vis.length ? <>{clickD.length > 0 && <TrendChart data={clickD} label="Kattintás a linkre" color={SERIES[1]} height={140} />}{vis.length > 0 && <TrendChart data={vis.map((v: D) => ({ t: v.t, v: n(v.sessions) }))} label="Látogató" height={150} />}</> : <Empty t="Még senki nem jött ezzel a linkkel." />) : <Empty t="Nincs rövid link." icon={P.links} />}
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
  const groups: D[][] = [];
  const named = new Map<string, D[]>();
  for (const p of [...posts].filter((x) => x.created_at).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    /* joined by hand first; then the same short link; then mostly the same words, or the same video length, within a few days, on a platform not yet in the group */
    const h = byHand.get(p.platform + "|" + p.post_id);
    if (h) { const g = named.get(h); if (g) g.push(p); else { const ng = [p]; named.set(h, ng); groups.push(ng); } continue; }
    const w = words(p.title), t = new Date(p.created_at).getTime();
    const g = groups.find((x) => !x.some((y) => y.platform === p.platform) && !byHand.get(x[0].platform + "|" + x[0].post_id) && (
      (p.code && x.some((y) => y.code === p.code)) ||
      (Math.abs(new Date(x[0].created_at).getTime() - t) < 5 * 864e5 && similar(words(x[0].title), w) >= 0.6) ||
      (n(p.duration) > 3 && x.some((y) => Math.abs(n(y.duration) - n(p.duration)) <= 1 && Math.abs(new Date(y.created_at).getTime() - t) < 3 * 864e5))));
    if (g) g.push(p); else groups.push([p]);
  }
  return groups;
}
function ContentTable({ posts, groups, onOpen }: { posts: D[]; groups: D[]; onOpen: (p: D) => void }) {
  const rows = groupContent(posts, groups).map((g) => ({ g, title: g[0].title, created_at: g[0].created_at, views: g.filter((x) => !isImp(x.platform)).reduce((t, x) => t + n(x.views), 0), imps: g.filter((x) => isImp(x.platform)).reduce((t, x) => t + n(x.views), 0),
    likes: g.reduce((t, x) => t + n(x.likes), 0), sessions: g.reduce((t, x) => t + n(x.sessions), 0), scored: g.reduce((t, x) => t + n(x.scored), 0), n: g.length })).sort((a, b) => b.views - a.views);
  return <Tbl name="tartalmak" rows={rows} onRow={(r) => onOpen([...r.g].sort((a: D, b: D) => n(b.views) - n(a.views))[0])} cols={[
    { k: "title", l: "Tartalom", r: (r) => <span className="cellwrap" style={{ maxWidth: 380, display: "block" }}><b>{String(r.title || "(nincs szöveg)").slice(0, 80)}</b><br /><span className="mut">{ago(r.created_at)}</span></span> },
    { k: "n", l: "Platformok", r: (r) => <span className="xp-p">{(r.g as D[]).map((x) => <span key={x.platform} title={`${PF[x.platform]}: ${big(x.views)} ${viewWord(x.platform)}`}><Logo k={x.platform} size={20} /><small>{big(x.views)}</small></span>)}</span> },
    { k: "views", l: "Megtekintés össz.", num: true, r: (r) => <><b>{big(r.views)}</b>{r.imps ? <div className="mut" style={{ fontSize: 11 }}>+{big(r.imps)} megjelenés</div> : null}</> }, { k: "likes", l: "Kedvelés", num: true, r: (r) => big(r.likes) },
    { k: "sessions", l: "Látogató", num: true, r: (r) => <b style={{ color: "var(--a-gold)" }}>{fmt(r.sessions)}</b> }, { k: "scored", l: "Előnézet", num: true, r: (r) => fmt(r.scored) },
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
    setMsg(error ? error.message : `${fmt(Number(data))} poszt frissítve a(z) ${rows.length} sorból.`); toast("Export beolvasva"); done();
  };
  return <div className="adm-row"><select className="adm-in sm" value={src} onChange={(x) => setSrc(x.target.value as Src)} aria-label="Melyik platform exportja"><option value="tiktok">TikTok Studio</option><option value="youtube">YouTube Studio</option><option value="instagram">Instagram (Meta)</option><option value="facebook">Facebook (Meta)</option></select>
    <span className="conn-file"><input type="file" accept=".csv,text/csv" onChange={onFile} /><span>CSV kiválasztása</span></span>{msg && <span className="note">{msg}</span>}</div>;
}


/* ---------- post calendar ---------- */
export function PostCalendar({ posts, onOpen }: { posts: D[]; onOpen: (p: D) => void }) {
  const [off, setOff] = useState(0);
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
      <div className="cal-h"><button className="adm-ibtn sm" disabled={!canBack} onClick={() => setOff(off + 1)}>←</button><b>{base.toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}</b><button className="adm-ibtn sm" disabled={!off} onClick={() => setOff(Math.max(0, off - 1))}>→</button></div>
      <div className="cal-g">
        {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((x) => <span key={x} className="cal-d">{x}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={"e" + i} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1, ps = [...(byDay.get(day) || [])].sort((a, b) => n(b.views) - n(a.views)), best = ps[0];
          const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
          return (
            <button key={day} className={"cal-c" + (ps.length ? " has" : "") + (isToday ? " today" : "")} disabled={!ps.length} onClick={() => best && onOpen(best)}
              style={best ? { ["--heat" as string]: (0.15 + 0.85 * Math.sqrt(n(best.views) / maxV)).toFixed(2), backgroundImage: best.thumb ? `linear-gradient(180deg,transparent 30%,rgba(0,0,0,.62)),url("${String(best.thumb).replace(/"/g, "")}")` : undefined } : undefined} title={ps.map((p) => `${PF[p.platform]}: ${big(p.views)} ${viewWord(p.platform)} · ${(p.title || "").slice(0, 40)}`).join("\n")}>
              <span className="cal-n">{day}</span>{ps.length > 0 && <span className="cal-v"><i style={{ background: chColor(best.platform) }} />{big(best.views)}{ps.length > 1 ? ` +${ps.length - 1}` : ""}</span>}
              {best && <span className="cal-heat" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="cal-leg"><span>A cella: a nap legnézettebb posztja (borítóval, ha van) · {fmt(inMonth.length)} poszt ebben a hónapban</span><span className="heat-scale">kevés<i /><i /><i /><i /><i />sok megtekintés</span></div>
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
  if (p.code) t.push("Van rövid link");
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
function Rising({ posts, onOpen }: { posts: D[]; onOpen: (p: D) => void }) {
  const r = rising(posts);
  if (!r.length) return null;
  return (
    <section className="s12 rising">{r.slice(0, 3).map((p) => (
      <button key={p.platform + p.post_id} className="rise" onClick={() => onOpen(p)}>
        <span className="rise-f">🔥 Most robban</span><Logo k={p.platform} size={26} />
        <span className="rise-t"><b>{String(p.title || PF[p.platform]).slice(0, 70)}</b><small>{big(p.views)} {viewWord(p.platform)} {fmt(p.h, 0)} óra alatt · a szokásos tempó {fmt(p.x, 1)}×-ese. Most érdemes kommentekre válaszolni és továbbposztolni.</small></span>
      </button>))}
    </section>
  );
}

/* the same video on several platforms is one piece of content: grouped by hand, by its short link, or its words / length and the days it went out */
function CrossPost({ posts, groups }: { posts: D[]; groups: D[] }) {
  const all = groupContent(posts, groups);
  const multi = all.filter((g) => g.length > 1).sort((a, b) => b.reduce((t, x) => t + n(x.views), 0) - a.reduce((t, x) => t + n(x.views), 0)).slice(0, 8);
  if (!multi.length) return null;
  return (
    <Card className="s12" icon={P.layers} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Egy tartalom, minden platformon" sub="Ugyanaz a videó vagy poszt több platformon: összeadva, és platformonként egymás mellett. A kézi összevonás (poszt részletei), a közös rövid link, a szöveg nagyrészt egyező szavai vagy az egyforma videóhossz és a megjelenés napja alapján párosítja.">
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
  const save = (x: Series) => { SER = x; serSubs.forEach((g) => g()); if (!MOCK) rpc(sb, "admin_setting_save", { p_k: "series", p_v: x }).catch(() => null); };
  return [SER || {}, save] as const;
}
function SeriesPick({ p }: { p: D }) {
  const [ser, save] = useSeries(); const key = p.platform + "|" + p.post_id;
  const cur = Object.keys(ser).find((k) => ser[k].includes(key)) || "";
  const [v, setV] = useState(cur); useEffect(() => setV(cur), [cur]);
  const put = () => { const nx: Series = {}; Object.entries(ser).forEach(([k, l]) => { const r = l.filter((x) => x !== key); if (r.length) nx[k] = r; }); const nm = v.trim().slice(0, 40); if (nm) nx[nm] = [...(nx[nm] || []), key]; save(nx); toast(nm ? `Sorozat: ${nm}` : "Kivéve a sorozatból"); };
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
