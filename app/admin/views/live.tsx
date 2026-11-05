"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { CloseX, Layer, toast, usePhone } from "../phone";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Info, Spark, fmt } from "../charts";
import { Hero, Sig, Trio, useRecentSigs } from "../ink";
import { changed } from "./todo";
import { Logo, NowSteps } from "../wow";
import { countryName } from "../visuals";
import { DayReplay } from "./visual";
import { Card, ERRS, FILES, HIDDEN, I, MOCK, P, PF, QSTEP, QVAL, ago, api, big, ch, chime, dt, ev, lang, n, type D, OWN_LINK, rpc, useFlt, useRpc } from "../shared";
import { PhMore, useSigUrls } from "./people";
import { viewWord } from "./social";
import { InboxItem } from "./inbox";

/* the windows the page counts in, said once (they were four, and none was written down) */
const W = { now: 5, langs: 15, curve: 30 };
/* the feed's event types, for the filter */
const KINDS: Record<string, [string, (x: D) => boolean]> = {
  all: ["Mind", () => true], web: ["Weboldal", (x) => x.name === "landing_view" || x.name === "cta_click"], app: ["App", (x) => x.name === "app_open" || x.name === "flow_step" || x.name.startsWith("quiz")],
  score: ["Előnézet", (x) => x.name === "flow_step" && x.props?.step === "score"], share: ["Megosztás", (x) => x.name.startsWith("share") || x.name === "reveal_share"],
  signup: ["Regisztráció", (x) => x.name === "signup"], err: ["Hiba", (x) => ERRS.has(x.name)],
};

/* where someone in a visit is: their last event, in words */
const FLOW: D = { name: "Fotót választ", sign: "Bőrfotót tölt fel", score: "Előnézetet nézi", scan: "Előnézet készül", analysis: "Előnézet készül", reveal: "Öregedést nézi", swipe: "Változatok közül választ" };
const stepName = (x: D) => x.name === "flow_step" ? FLOW[x.props?.step] || "Bevezető kérdések" : x.name === "quiz_answer" && (x.props?.step === "name" || x.props?.step === "sign") ? FLOW[x.props.step] : x.name === "landing_view" || x.name === "cta_click" || x.name === "auth_step" ? "A weboldalon" : x.name.startsWith("quiz") ? "Bevezető kérdések"
  : x.name === "share_save" || x.name === "save_done" ? "Ment" : x.name === "share_open" || x.name === "share_video" || x.name === "reveal_share" ? "Megoszt" : x.name === "celebrate" ? "A kész előnézetet nézi" : x.name === "detail_open" ? "Előnézetet ment" : x.name.startsWith("celeb") ? "MI-előnézet készül" : "Az appban";

/* ---------- who is in right now, and what they are doing: only what is measurable, so visits without names ---------- */
export function LiveNow({ online, eager, poll }: { online?: number; eager?: boolean; poll?: D | null }) {
  /* on the Élő page it reads the page's own poll, so it follows the filter and shows the same number as the top; elsewhere it asks for itself */
  const own = poll !== undefined;
  const q = useRpc("admin_live", { p_ch: null, p_lang: null }, [], own);
  useEffect(() => { if (own) return; const t = setInterval(() => { if (document.visibilityState === "visible") q.load(); }, 15_000); return () => clearInterval(t); }, [q.load, own]); // eslint-disable-line react-hooks/exhaustive-deps
  const lvRaw = (own ? poll : q.d) as D | null;
  const lv: D = lvRaw || {}, skip = new Set<string>((lv.unconfirmed_ids || []) as string[]), by = new Map<string, D>(), src = new Map<string, D>();
  (((lv.live || []) as D[])).filter((x) => !HIDDEN.has(x.name) && !skip.has(x.s) && Date.now() - new Date(x.created_at).getTime() < W.now * 60e3).forEach((x) => { if (!by.has(x.s)) by.set(x.s, x); if (x.src?.us || x.src?.from) src.set(x.s, x.src); });
  const rows = [...by.values()], count = n(lv.live_now_confirmed ?? lv.live_now ?? rows.length);
  const none = `Az elmúlt ${W.now} percben nem volt mért látogatás.${online ? ` Belépett fiók: ${fmt(online)}.` : ""}`;
  return (
    <Card eager={eager} className="s12" icon={P.live} title="Most bent" right={count ? <span className="chip good">● {fmt(count)}</span> : undefined} sub={`Az elmúlt ${W.now} perc látogatásai. Névtelenek: azt látjuk, mit csinálnak, azt nem, hogy kik. Az iPhone-app nem küld adatot, ezért az ottaniak nem látszanak.`}>
      {!lvRaw ? <div className="skel" style={{ height: 80 }} /> : !rows.length ? <p className="note">{count ? `${fmt(count)} látogatás van bent, de az utolsó lépése most nem látszik a listában.` : none}</p> : <ul className="pp-now">{rows.slice(0, 12).map((x) => { const s: D = src.get(x.s) || {}; return <li key={x.s}><b>{stepName(x)}</b><small>{s.us ? <><Logo k={s.us} size={14} />{ch(s.us)}</> : s.from ? s.from : "forrás nélkül"}{x.lang ? ` · ${lang(x.lang)}` : ""} · #{x.s}</small><time>{ago(x.created_at)}</time></li>; })}</ul>}
      {rows.length > 0 && count > rows.length ? <p className="note">További {fmt(count - rows.length)} látogatás utolsó lépése most nem látszik a listában.</p> : null}
      {rows.length > 0 && online ? <p className="note">Belépett fiók most: {fmt(online)} (a fiók és a látogatás nincs összekötve).</p> : null}
    </Card>
  );
}

/* ---------- the map: only short-link clicks, because only those carry a real country. A site visit has no location,
   so it is never drawn here. The borders are the same Natural Earth file the other maps read. ---------- */
type Land = { a2: string; d: string; c: [number, number] };
const MAP_NAME: Record<string, string> = { "United States of America": "US", "Dem. Rep. Congo": "CD", Congo: "CG", "Central African Rep.": "CF", "Bosnia and Herz.": "BA", "Dominican Rep.": "DO", "Eq. Guinea": "GQ", "S. Sudan": "SS", "Solomon Is.": "SB", Macedonia: "MK", "North Macedonia": "MK", eSwatini: "SZ", "Côte d'Ivoire": "CI", "W. Sahara": "EH", "Falkland Is.": "FK", "N. Cyprus": "CY", Somaliland: "SO", Kosovo: "XK", Myanmar: "MM", Palestine: "PS", "Timor-Leste": "TL", Czechia: "CZ", Turkey: "TR", "Türkiye": "TR" };
const MW = 1000, MH = 500;
const mapXY = (lon: number, lat: number): [number, number] => {
  /* Natural Earth I, the projection of the Piacok map */
  const l = (lon * Math.PI) / 180, f = (lat * Math.PI) / 180, f2 = f * f, f4 = f2 * f2, sc = MW / 5.45;
  return [MW / 2 + l * (0.8707 - 0.131979 * f2 + f4 * (-0.013791 + f4 * (0.003971 * f2 - 0.001529 * f4))) * sc, MH / 2 + sc * 0.17 - f * (1.007226 + f2 * (0.015085 + f4 * (-0.044475 + 0.028874 * f2 - 0.005916 * f4))) * sc];
};
let landP: Promise<Land[]> | null = null;
const loadLand = () => landP || (landP = fetch("/maps/countries-110m.json").then((r) => r.json()).then((topo: D) => {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs: [number, number][][] = topo.arcs.map((a: number[][]) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] as [number, number]; }); });
  const arc = (i: number) => (i >= 0 ? arcs[i] : [...arcs[~i]].reverse());
  const byName = new Map<string, string>();
  try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) { const c = String.fromCharCode(a, b), nm = dn.of(c); if (nm && nm !== c) byName.set(nm, c); } } catch {}
  return (topo.objects.countries.geometries as D[]).filter((g) => g.id !== "010" && g.arcs).map((g): Land => {
    const polys: number[][][] = g.type === "Polygon" ? [g.arcs] : g.arcs;
    const rings = polys.flatMap((q) => q.map((ids) => { const r = ids.flatMap((i, j) => (j ? arc(i).slice(1) : arc(i))); const xs = r.map((v) => v[0]); return Math.max(...xs) - Math.min(...xs) > 180 ? r.map(([x, y]) => [x < 0 ? x + 360 : x, y] as [number, number]) : r; }));
    /* the point sits in the middle of the country's biggest piece (not its far islands) */
    const main = [...rings].sort((a, b) => b.length - a.length)[0] || [];
    const mx = main.reduce((t, v) => t + v[0], 0) / Math.max(1, main.length), my = main.reduce((t, v) => t + v[1], 0) / Math.max(1, main.length);
    const name = g.properties?.name || "";
    return { a2: MAP_NAME[name] || byName.get(name) || "", d: rings.map((r) => r.map(([lo, la], i) => { const [x, y] = mapXY(lo, la); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + "Z").join(""), c: mapXY(mx, my) };
  });
}).catch(() => { landP = null; return [] as Land[]; }));
/* what just happened, with its language: floats over the map, sits at no place on it */
const BUBBLE: Record<string, string> = { celeb_made: "előnézet készült", signup: "új fiók", share_save: "mentés", share_open: "megosztás" };
function ClickMap({ clicks, top, bubbles }: { clicks: D[]; top?: boolean; bubbles?: D[] }) {
  const [land, setLand] = useState<Land[] | null>(null);
  useEffect(() => { let on = true; loadLand().then((x) => on && setLand(x)); return () => { on = false; }; }, []);
  const byC = new Map<string, number>();
  clicks.forEach((c) => { const a2 = String(c.country || "").toUpperCase(); if (/^[A-Z]{2}$/.test(a2)) byC.set(a2, (byC.get(a2) || 0) + 1); });
  /* "Kiemelt": only the countries with the most clicks, standing still */
  const pts = (land || []).filter((l) => byC.has(l.a2)).map((l) => ({ ...l, n: byC.get(l.a2)! })).sort((a, b) => b.n - a.n).slice(0, top ? 5 : 999);
  return <div className="io-map" role="img" aria-label={pts.length ? `Rövidlink-kattintások országonként: ${pts.map((x) => `${countryName(x.a2)} ${x.n}`).join(", ")}` : "Világtérkép, nincs rajta pont"}>
    {!land ? <div className="skel" /> : <svg viewBox={`0 0 ${MW} ${MH}`} aria-hidden="true">
      {land.map((l, i) => <path key={i} d={l.d} />)}
      {pts.map((x) => { const r = 5 + Math.sqrt(x.n) * 3.5; return <g key={x.a2}>{!top && <circle className="h" cx={x.c[0]} cy={x.c[1]} r={r} />}<circle className="p" cx={x.c[0]} cy={x.c[1]} r={r}><title>{countryName(x.a2)}: {fmt(x.n)} kattintás</title></circle></g>; })}
    </svg>}
    {!top && (bubbles || []).length > 0 && <ul className="io-bub" aria-label="Az utolsó események, hely nélkül">{(bubbles || []).map((x) => <li key={x.created_at + x.name + x.s}><b>{BUBBLE[x.name]}</b>{x.lang ? ` · ${lang(x.lang)}` : ""}</li>)}</ul>}
    {land && !pts.length && <span className="io-map-e">Az elmúlt órában nem jött országot is mutató kattintás</span>}
  </div>;
}
function FullMap({ clicks, top, bubbles, close }: { clicks: D[]; top?: boolean; bubbles?: D[]; close: () => void }) {
  return <Layer><div className="io-full" role="dialog" aria-label="Élő térkép"><div className="io-full-h"><h2>Rövidlink-kattintások</h2><CloseX close={close} /></div><ClickMap clicks={clicks} top={top} bubbles={bubbles} /><small>Az elmúlt óra. Csak a rövid linkekre kattintók országa; a weboldal látogatóinak nincs helyadata.</small></div></Layer>;
}

/* ---------- live ---------- */
export function Live({ d: d0 }: { d: D }) {
  const { f: flt } = useFlt();
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const sbx = useMemo(() => supabaseBrowser(), []);
  /* the page's own poll: it follows the channel and language filter (the shared poll does not), and brings the
     per-minute curve of every event, the short-link clicks and the post behind each link */
  const [lv, setLv] = useState<D | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => rpc(sbx, "admin_live", { p_ch: flt.ch || null, p_lang: flt.lang || null }).then(({ data }) => { if (alive && data) setLv(data as D); });
    load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [sbx, flt.ch, flt.lang]);
  const filtered = !!(flt.ch || flt.lang);
  const d: D = lv && (filtered || lv.live) ? { ...d0, live: lv.live, live_now: lv.live_now, live_hour: lv.live_hour, ...(filtered ? { today: lv.today } : {}) } : d0;
  /* new events arrive the moment they happen (Supabase Realtime, admin-only read policy); the 10 s poll is the fallback */
  const [rt, setRt] = useState<D[]>([]); const [on, setOn] = useState(false);
  const [sound, setSound] = useState(false); const [paused, setPaused] = useState<D[] | null>(null); const [kind, setKind] = useState("all");
  useEffect(() => { try { setSound(localStorage.getItem("inkage.admin.sound") === "1"); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("inkage.admin.sound", sound ? "1" : "0"); } catch {} }, [sound]);
  /* "Ez én voltam": the visit leaves every number at once (here right away, everywhere at the next refresh) */
  const [mine, setMine] = useState<string[]>([]); const [own, setOwn] = useState<D[]>([]); const [ownAll, setOwnAll] = useState(false);
  const ownRef = useRef<Set<string>>(new Set()); const uid = useRef<string | null>(null);
  const loadOwn = () => rpc(sbx, "admin_own_list").then(({ data }) => { const l = Array.isArray(data) ? data : []; setOwn(l); ownRef.current = new Set(l.map((o: D) => o.s)); });
  useEffect(() => { loadOwn(); if (sbx && !MOCK) sbx.auth.getUser().then(({ data }) => { uid.current = data.user?.id || null; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (MOCK) return; const sb = supabaseBrowser(); if (!sb) return;
    const c = sb.channel("admin-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (pl: { new: D }) => {
      const e = pl.new || {}; const src = e.props?.src || {}, ses = String(e.session || "");
      if (/test/i.test(src.us || "") || ["qa", "qa2", "scoretest", "rec", "test"].includes(src.uc || "")) return;
      /* her own visits stay out of the stream too, not only after the next refresh: a marked visit, or one where she is signed in */
      if (ownRef.current.has(ses.slice(-6)) || (uid.current && e.user_id === uid.current)) return;
      if (flt.lang && String(e.lang || "").slice(0, 2) !== flt.lang.slice(0, 2)) return;
      setRt((o) => [{ created_at: e.created_at, name: e.name, props: { ...(e.props || {}), src: undefined }, src, path: e.path, lang: e.lang, s: ses.slice(-6), sid: ses.slice(-12) }, ...o].slice(0, 80));
    }).subscribe((st: string) => setOn(st === "SUBSCRIBED"));
    return () => { sb.removeChannel(c); };
  }, [flt.lang]);
  /* one tap takes a stranger's visit out of every number: so it can be taken back at once, right there */
  const [mineUndo, setMineUndo] = useState<{ s: string; sid?: string; at?: string } | null>(null);
  useEffect(() => { if (!mineUndo) return; const t = setTimeout(() => setMineUndo(null), 8000); return () => clearTimeout(t); }, [mineUndo]);
  const markMine = async (x: { s: string; sid?: string; at?: string }, on2 = true) => {
    if (on2) setMine((m) => [...m, x.s]); else setMine((m) => m.filter((y) => y !== x.s));
    setMineUndo(null);
    const r = await rpc(sbx, "admin_mark_own_short", { p_short: x.sid || x.s, p_on: on2, ...(x.at ? { p_at: x.at } : {}) });
    const undoMark = () => { if (on2) setMine((m) => m.filter((y) => y !== x.s)); else setMine((m) => [...m, x.s]); };
    if (r.error) { undoMark(); toast("Nem sikerült menteni: " + r.error.message); return; }
    if ((r.data as D)?.ambiguous) { undoMark(); toast("Több látogatás végződik így: nyisd meg az eseményt, és onnan jelöld"); }
    else if (on2) setMineUndo(x);
    else toast("Visszavéve");
    loadOwn();
  };
  const thisDevice = typeof localStorage !== "undefined" && (() => { try { return localStorage.getItem("inkage.own") === "1"; } catch { return false; } })();
  /* one page opened from nowhere in the last 30 minutes: not counted until it does something, shown apart. Until the poll answers, the old count */
  const unconf = n(lv?.unconfirmed), unconfIds = new Set<string>((lv?.unconfirmed_ids || []) as string[]);
  const liveNow = lv?.live_now_confirmed ?? d.live_now, liveHour = lv?.live_hour_confirmed ?? d.live_hour, todayN = lv?.today_confirmed ?? d.today?.sessions;
  const polled: D[] = d.live || [];
  const newest = polled[0]?.created_at || "";
  /* the channel filter cannot be checked on a raw realtime row (its channel is computed in the database): filtered, the poll alone feeds the list */
  /* a realtime row of a visit the hourly rules marked as a machine never shows (the poll already leaves them out) */
  const bots = new Set<string>(((lv?.bots || []) as string[]));
  const live: D[] = [...(filtered && flt.ch ? [] : rt.filter((x) => x.created_at > newest && !bots.has(x.s))), ...polled].filter((x: D) => !HIDDEN.has(x.name) && !mine.includes(x.s)).slice(0, 80);
  /* "Szünet": the list stands still while you read it; the numbers above keep counting */
  const items: D[] = (paused || live).filter((x) => (KINDS[kind] || KINDS.all)[1](x));
  const fresh = new Set<string>();
  items.forEach((x) => { const id = x.created_at + x.name + x.s; if (!first.current && !seen.current.has(id)) fresh.add(id); });
  useEffect(() => {
    /* a soft chime for each new preview, a brighter one for a sign-up (only when switched on) */
    if (sound && fresh.size && !paused) { const nw = items.filter((x) => fresh.has(x.created_at + x.name + x.s)); const tone = nw.some((x) => x.name === "signup") ? 880 : nw.some((x) => x.name === "flow_step" && x.props?.step === "score") ? 660 : 0; if (tone) chime(tone); }
    items.forEach((x) => seen.current.add(x.created_at + x.name + x.s)); first.current = false;
  });
  const codes: D = lv?.codes || {};
  const postOf = (s: D) => (s?.ux && codes[s.ux] ? codes[s.ux] : null);
  const desc = (x: D) => {
    const p = x.props || {}, parts: string[] = [];
    if (p.step) parts.push(QSTEP[p.step] || p.step); if (p.value) parts.push(QVAL[p.value] || p.value);
    if (p.kind) parts.push(p.kind); if (p.k) parts.push(FILES[p.k] || p.k); if (p.cta) parts.push(p.cta); if (p.page) parts.push(p.page === "start" ? "/app" : p.page);
    if (p.msg || p.why) parts.push(p.msg || p.why);
    const s = x.src || {}, po = postOf(s); if (s.us) parts.push("← " + ch(s.us) + (po ? ` „${String(po.title || "").slice(0, 30)}”` : s.ux ? " / " + s.ux : "")); else if (s.from) parts.push("← " + s.from);
    return parts.join(" · ") || x.path || "";
  };
  const kindOf = (x: D) => ERRS.has(x.name) ? ["bad", P.alert] : x.name === "signup" ? ["good", P.user] : x.name === "flow_step" && x.props?.step === "score" ? ["gold", P.target] : x.name === "landing_view" ? ["", P.eye] : x.name.startsWith("share") ? ["gold", P.share] : ["", P.bolt];
  /* where the people of the last 5 minutes are: their last step */
  const lastBy = new Map<string, D>(); live.filter((x) => !unconfIds.has(x.s) && Date.now() - new Date(x.created_at).getTime() < W.now * 60e3).forEach((x) => { if (!lastBy.has(x.s)) lastBy.set(x.s, x); });
  const nowSteps = Object.entries([...lastBy.values()].reduce((m: Record<string, number>, x) => { const k = stepName(x); m[k] = (m[k] || 0) + 1; return m; }, {})).map(([l, c]) => ({ l, n: c as number })).sort((a, b) => b.n - a.n);
  /* the languages of the last 15 minutes' visits (one visit counts once): a visit has a language, not a place */
  const langN: Record<string, number> = {}, langSeen = new Set<string>();
  live.filter((x) => !unconfIds.has(x.s) && Date.now() - new Date(x.created_at).getTime() < W.langs * 60e3 && x.lang).forEach((x) => { if (langSeen.has(x.s)) return; langSeen.add(x.s); const k = String(x.lang).slice(0, 2); langN[k] = (langN[k] || 0) + 1; });
  const langNow = Object.entries(langN).sort((a, b) => b[1] - a[1]);
  /* the feed by visitor: one row per anonymous visit, its path in order, the important steps lit */
  const [byVisit, setByVisit] = useState(true);
  const visits = [...items.reduce((m, x) => { const k = x.s || "?"; const g = m.get(k) || []; g.push(x); m.set(k, g); return m; }, new Map<string, D[]>()).entries()].map(([k, ev2]) => ({ k, ev: [...ev2].reverse() })).sort((a, b) => (b.ev[b.ev.length - 1]?.created_at || "").localeCompare(a.ev[a.ev.length - 1]?.created_at || ""));
  const [more, setMore] = useState(false);
  const short = (x: D) => x.name === "landing_view" ? "Weboldal" : x.name === "app_open" ? "App" : x.name === "flow_step" ? (QSTEP[x.props?.step] || ({ score: "Előnézet", scan: "Előnézet készül", reveal: "50 év múlva" } as D)[x.props?.step] || "Lépés") : x.name.startsWith("quiz") ? "Kérdések" : x.name === "signup" ? "Regisztráció" : x.name.startsWith("share") ? "Megosztás" : ERRS.has(x.name) ? "Hiba" : ev(x.name);
  /* per minute from the database: every event of the last 30 minutes, not only the 80 the list holds */
  const perMin: number[] = Array.isArray(lv?.per_min) ? lv!.per_min.map(n) : Array.from({ length: W.curve }, (_, i) => { const t1 = Date.now() - (W.curve - 1 - i) * 60e3; return live.filter((x) => { const t = new Date(x.created_at).getTime(); return t <= t1 && t > t1 - 60e3; }).length; });
  const clicks: D[] = lv?.clicks || [];
  const phone = usePhone(); const [full, setFull] = useState(false);
  /* today's finished signatures: the same source as the Ma page */
  const mc = useRpc("admin_ma_compare", { p_ch: flt.ch || null, p_lang: flt.lang || null }, [flt.ch, flt.lang]);
  const made = ((mc.d as D)?.today || d.today)?.made;
  const mappable = clicks.filter((c) => /^[A-Za-z]{2}$/.test(String(c.country || "")));
  const [mapTop, setMapTop] = useState(false);
  /* the strip stands in for the big number only while that has scrolled away; until then it would say the same thing over the content */
  const heroRef = useRef<HTMLDivElement>(null); const [heroSeen, setHeroSeen] = useState(true);
  useEffect(() => { const el = heroRef.current; if (!el || typeof IntersectionObserver === "undefined") return; const o = new IntersectionObserver(([e]) => setHeroSeen(e.isIntersecting), { rootMargin: "-40px 0px 0px 0px" }); o.observe(el); return () => o.disconnect(); }, []);
  const topC = Object.entries(mappable.reduce((m: Record<string, number>, c) => { const k = String(c.country).toUpperCase(); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const bubbles = live.filter((x) => BUBBLE[x.name] && Date.now() - new Date(x.created_at).getTime() < 10 * 60e3).slice(0, phone ? 2 : 4);
  return (
    <div className="io io-live">
    <div className="g io">
      <div className="s12 io-hero-wide" ref={heroRef}><Hero flip max={120} label={<><i className="adm-dot" />Most bent · {new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}{filtered ? " · szűrve" : ""}<Info>„Most”: az elmúlt {W.now} percben. Egy ember két lapon két látogatás, és az iPhone-app nincs benne, mert nem küld adatot. {lv?.today_engaged != null ? <>Ma eddig {fmt(lv.today_engaged)} aktív látogatás (legalább két esemény, vagy ismert forrás). </> : null}{lv?.unconfirmed != null ? <>Megerősítetlen: az elmúlt 30 percben egyetlen megnyitás forrás nélkül, ami gép is lehet; addig nem számoljuk, amíg nem tesz valamit, vagy le nem telik a 30 perc.</> : null}</Info></>} v={n(liveNow)}
        sub={`az elmúlt órában ${fmt(liveHour)} · ma eddig ${fmt(todayN)} látogatás`} side={<Trio items={[{ l: "előnézet ma", v: made == null ? "–" : fmt(n(made)) }, { l: "rövidlink-kattintás ma", v: fmt(n(lv?.clicks_today)) }, { l: "előnézetig jutott ma", v: fmt(n(d.today?.scored)) }, ...(lv?.unconfirmed != null ? [{ l: "megerősítetlen", v: fmt(unconf) }] : [])]} />} /></div>
      {phone && <LiveNow eager poll={lv} />}
      {full && <FullMap clicks={mappable} top={mapTop} bubbles={bubbles} close={() => setFull(false)} />}
      <section className="s12 io-sec">
        <div className="io-sec-h"><h3 className="ink-h">Honnan kattintanak<Info>A fehér pontok az elmúlt óra kattintásai a inkage.app/go/… rövid linkekre, abból az országból, amit a kattintás megmutat. A weboldal látogatóinak nincs helyadata, ezért ők nincsenek a térképen.</Info></h3><button className="io-pill" onClick={() => setFull(true)}>Teljes képernyő</button></div>
        <div className="adm-seg sm io-map-sw" role="group" aria-label="A térkép nézete"><button aria-pressed={!mapTop} onClick={() => setMapTop(false)}>Élő</button><button aria-pressed={mapTop} onClick={() => setMapTop(true)}>Kiemelt</button></div>
        <ClickMap clicks={mappable} top={mapTop} bubbles={bubbles} />
        {mapTop && topC.length > 0 && <div className="io-scroll" aria-label="A legtöbb kattintás országai">{topC.map(([k, c]) => <span key={k} className="io-src"><b>{fmt(c)}</b>{countryName(k)}</span>)}</div>}
      </section>
      <section className="c s12 io-now">
        <h2>Mit csinálnak most<Info>Az elmúlt {W.now} perc látogatóinak utolsó lépése. A görbe: események percenként, az elmúlt {W.curve} percben (minden esemény, nem csak a lista 80 sora).</Info></h2>
        <NowSteps steps={nowSteps} />
        <div className="io-spark"><Spark values={perMin} h={70} /></div>
      </section>
      {langNow.length > 0 && <section className="s12 io-sec"><h3 className="ink-h">Milyen nyelven<Info>Az elmúlt {W.langs} perc látogatásai a nyelvük szerint. Ez nem hely: a látogatásnak nincs országa.</Info></h3>
        <div className="io-scroll">{langNow.map(([k, c]) => <span key={k} className="io-src"><b>{fmt(c)}</b>{lang(k)}</span>)}</div></section>}
      <LivePosts />
      {clicks.length > 0 && <Card className="s12" icon={P.links} title="Rövidlink-kattintások élőben" sub="Az elmúlt óra kattintásai a inkage.app/go/… linkekre (a saját eszközödről jövők nélkül), és melyik poszt linkje volt.">
        <ul className="io-rows">{clicks.slice(0, 12).map((c, i) => <li key={c.code + c.at + i} className="io-row"><Logo k={c.source || "link"} size={36} /><div className="io-t"><b>/go/{c.code}{c.title ? ` · ${String(c.title).slice(0, 50)}` : c.note ? ` · ${String(c.note).slice(0, 50)}` : ""}</b><small>{[c.country && countryName(String(c.country).toUpperCase()), c.device].filter(Boolean).join(" · ")}</small></div><time className="io-time">{ago(c.at)}</time></li>)}</ul>
      </Card>}
      <PhMore label="Saját látogatások, a nap visszajátszása">
      <Card className="s12" icon={P.user} title="Saját látogatások kizárva" sub="A megjelölt eszközeidről nem megy adat, és a „Ez én voltam” gombbal megjelölt látogatásaid egyik számba sem kerülnek bele (élő, források, tölcsér, tartalom, rövid linkek); a saját és tesztfiókjaid a fiók- és regisztrációszámokból maradnak ki. A fiókkal belépve tett látogatást a fiók magában nem zárja ki: ehhez az eszközt kell megjelölni. Az Instagram és a TikTok saját böngészője külön eszköznek számít: küldd el magadnak a linket, és nyisd meg ott egyszer.">
        <div className="ownbox">
          <div className="own-st"><span className={"chip " + (thisDevice || MOCK ? "good" : "warn")}>{thisDevice || MOCK ? "✓ ez az eszköz ki van zárva" : "ez az eszköz még számít"}</span><span className="note">{fmt(own.length)} látogatás megjelölve sajátként</span></div>
          <div className="own-link"><code>{OWN_LINK}</code><button className="adm-ibtn sm" onClick={() => { navigator.clipboard?.writeText(OWN_LINK); toast("Link másolva"); }}>Másolás</button>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="adm-ibtn sm" onClick={() => navigator.share?.({ url: OWN_LINK, title: "InkAge · saját eszköz" }).catch(() => {})}>Küldés…</button>}</div>
          <OwnAccounts reload={loadOwn} />
          {own.length > 0 && <ul className="own-l">{(ownAll ? own : own.slice(0, 8)).map((o) => <li key={o.s + o.at}><span className="chip">#{o.s}</span><span>{fmt(o.events)} esemény · {ago(o.first)}</span><button className="lnk" onClick={() => markMine({ s: o.s, at: o.first }, false)}>visszavesz</button></li>)}</ul>}
          {own.length > 8 && <button className="lnk" onClick={() => setOwnAll(!ownAll)}>{ownAll ? "Kevesebb" : `Mind a ${own.length} →`}</button>}
        </div>
      </Card>
      <Card className="s12" icon={P.play} title="A nap visszajátszása" sub="Egy nap (az elmúlt 7 közül) 10 perces lépésekben: húzd a csúszkát vagy játszd le, és nézd, mikor jöttek a látogatók, mikor jutottak el az előnézetig és a regisztrációig, honnan jöttek, és mikor ment ki egy poszt. Jól látszik, mit mozdított meg egy videó.">
        <DayReplay />
      </Card>
      </PhMore>
      <Card className="s12" icon={P.live} title="Élő eseményfolyam" sub="Az utolsó 80 esemény. Fotó, minta és e-mail nélkül; a „#” egy névtelen látogatás rövid azonosítója, a „←” mögött a forrás és a rövid link posztja. A hang gombbal halk jelzést kapsz minden új előnézetnél; a Szünet megállítja a listát, amíg olvasod."
        right={<><button className={"adm-ibtn sm" + (paused ? " on" : "")} onClick={() => setPaused(paused ? null : live)}>{paused ? "▶ Tovább" : "❚❚ Szünet"}</button><button className={"adm-ibtn sm" + (sound ? " on" : "")} onClick={() => setSound(!sound)}>{sound ? "Hang: be" : "Hang: ki"}</button><span className={"chip " + (on ? "good" : "")}>{on ? "● élő kapcsolat" : "10 mp-es frissítés"}</span></>}>
        <div className="adm-row" style={{ gap: 8 }}>
          <div className="adm-seg sm"><button aria-pressed={byVisit} onClick={() => setByVisit(true)}>Látogatónként</button><button aria-pressed={!byVisit} onClick={() => setByVisit(false)}>Időrendben</button></div>
          <div className="adm-seg sm pp-seg" role="group" aria-label="Eseménytípus">{Object.entries(KINDS).map(([k, [l]]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
        </div>
        {byVisit && <ul className="visits">
          {(more ? visits : visits.slice(0, 20)).map((g) => { const last = g.ev[g.ev.length - 1], src = g.ev.find((x) => x.src?.us || x.src?.from)?.src || {}, po = postOf(src), imp = g.ev.some((x) => x.name === "signup") ? "good" : g.ev.some((x) => ERRS.has(x.name)) ? "bad" : g.ev.some((x) => x.name === "flow_step" && x.props?.step === "score") ? "gold" : "";
            const path = g.ev.map(short).filter((t, i, a) => t !== a[i - 1]);
            return (
              <li key={g.k} className={imp + (fresh.has(last.created_at + last.name + last.s) ? " new" : "")}>
                <div className="vh"><span className="chip">#{g.k}</span>{src.us ? <span className="vsrc"><Logo k={src.us} size={18} />{ch(src.us)}{po ? <em className="vpost"> · {String(po.title || "").slice(0, 40)}</em> : null}</span> : src.from ? <span className="vsrc">{src.from}</span> : <span className="vsrc dim">ismeretlen forrás</span>}{last.lang && <span className="vl">{String(last.lang).slice(0, 2).toUpperCase()}</span>}<time>{ago(last.created_at)}</time>
                  <button className="mine-b" onClick={() => markMine({ s: g.k, sid: g.ev.find((x) => x.sid)?.sid, at: last.created_at })} title="A saját látogatásom: ne számítson sehol">Ez én voltam</button></div>
                <div className="vp">{path.map((t, i) => <span key={i} className={t === "Regisztráció" ? "good" : t === "Hiba" ? "bad" : t === "Előnézet" ? "gold" : ""}>{t}</span>)}</div>
              </li>
            ); })}
        </ul>}
        {byVisit && visits.length > 20 && <button className="lnk" onClick={() => setMore(!more)}>{more ? "Kevesebb" : `Mind a ${visits.length} látogatás →`}</button>}
        {!byVisit && <ul className="feed">
          {items.map((x, i) => { const id = x.created_at + x.name + x.s; const [cls, icon] = kindOf(x); return (
            <li key={id + "#" + i} className={fresh.has(id) ? "new" : ""}>
              <time title={dt(x.created_at)}>{new Date(x.created_at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <span className={"fi " + cls}>{I(icon)}</span>
              <span className="nm">{ev(x.name)}</span>
              <span className="pr">{desc(x)}</span>
              <span className="chip">#{x.s || "–"}{x.lang ? " · " + String(x.lang).toUpperCase() : ""}</span>
            </li>
          ); })}
        </ul>}
        {!items.length && <p className="note">{kind === "all" ? "Még nincs esemény." : "Ilyen esemény most nincs a listában."}</p>}
      </Card>
      {/* a new signature today re-reads the ribbon */}
      <SigRibbon key={String(made ?? "")} />
    </div>
    {/* stays at the bottom of the screen while the page scrolls under it */}
    <div className={"io-glass" + (heroSeen ? " off" : "")} role="status" aria-hidden={heroSeen}><div><small>Most bent</small><b>{fmt(n(liveNow))}</b></div><div><small>Ma előnézet</small><b>{made == null ? "–" : fmt(n(made))}</b></div></div>
    {mineUndo && <div className="io-undo" role="status"><span>Kizárva a számokból</span><button onClick={() => markMine(mineUndo, false)}>Visszavonás</button></div>}
    </div>
  );
}

/* ---------- the finished previews, a ribbon to swipe; no names ---------- */
function SigRibbon() {
  const rows = useRecentSigs(14), url = useSigUrls((rows || []).map((x) => String(x.path)));
  if (rows && !rows.length) return null;
  return <section className="s12 io-sec"><h3 className="ink-h">Elkészült előnézetek</h3>{!rows ? <div className="skel" style={{ height: 110, borderRadius: 18 }} /> : <div className="io-scroll io-ribbon">{rows.map((x, i) => <Sig key={String(x.path) + i} u={url(String(x.path))} alt="Elkészült előnézet" />)}</div>}</section>;
}

/* ---------- the main posts, counting live, and the newest comments ----------
   The platforms are no longer asked every 5 minutes from here (the hourly sync keeps them fresh, and a button asks
   once more); the hourly snapshots give the pace: views in the last hour, and a post running far above its platform. */
function LivePosts() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [ps, setPs] = useState<D[] | null>(null); const [ib, setIb] = useState<D[]>([]); const [busy, setBusy] = useState(false); const [ibN, setIbN] = useState(0); const [wait, setWait] = useState("");
  /* closed here: gone from the list at once, whatever the next poll brings */
  const [shut, setShut] = useState<string[]>([]);
  /* "+N since you opened it" survives a reload: the first numbers of this visit are kept for the browser tab */
  const base = useRef<Record<string, number>>({});
  useEffect(() => { try { base.current = JSON.parse(sessionStorage.getItem("inkage.admin.livebase") || "{}"); } catch {} }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data }, { data: inb }] = await Promise.all([rpc(sb, "admin_live_posts"), rpc(sb, "admin_inbox", { p_all: true })]);
      if (!alive) return;
      const l = Array.isArray(data) ? (data as D[]) : [];
      l.forEach((p) => { const k = p.platform + p.post_id; if (base.current[k] == null) base.current[k] = n(p.views); });
      try { sessionStorage.setItem("inkage.admin.livebase", JSON.stringify(base.current)); } catch {}
      setPs(l); setIb((((inb as D)?.items || []) as D[]).filter((x) => !x.done).slice(0, 8));
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [sb, ibN]);
  /* asking the platforms now: at most once per 3 minutes from any open page (the same guard as the social pages) */
  const syncNow = async () => {
    let last = 0; try { last = Number(localStorage.getItem("inkage.admin.socsync") || 0); } catch {}
    /* too soon is not a failure and not a success: the button itself says so, for a moment */
    if (Date.now() - last < 3 * 60e3) { setWait(`Pár perce frissült, még ${Math.ceil((3 * 60e3 - (Date.now() - last)) / 60e3)} perc`); setTimeout(() => setWait(""), 3500); return; }
    setBusy(true);
    const r = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/sync?only=social", { method: "POST" }).catch(() => ({ ok: false, json: {} as D }));
    setBusy(false);
    if (!r.ok || r.json?.ok === false) { toast("Nem sikerült frissíteni a platformokról" + (r.json?.error ? `: ${String(r.json.error).slice(0, 80)}` : "")); return; }
    try { localStorage.setItem("inkage.admin.socsync", String(Date.now())); } catch {}
    setIbN((x) => x + 1); toast("Frissítve a platformokról");
  };
  /* a post's last hour against the usual last hour on its platform (the median of its posts that moved) */
  const med: Record<string, number> = {};
  for (const pf of Array.from(new Set((ps || []).map((p) => p.platform)))) { const v = (ps || []).filter((p) => p.platform === pf && n(p.gain_h) > 0).map((p) => n(p.gain_h)).sort((a, b) => a - b); if (v.length) med[pf] = v[Math.floor(v.length / 2)]; }
  const hot = (p: D) => (med[p.platform] && n(p.gain_h) >= 3 * med[p.platform] && n(p.gain_h) >= 50 ? n(p.gain_h) / med[p.platform] : 0);
  const posts = [...(ps || [])].sort((a, b) => hot(b) - hot(a) || n(b.gain_h) - n(a.gain_h) || n(b.gain_d) - n(a.gain_d)).slice(0, 6);
  const [reply, setReply] = useState<D | null>(null);
  const ibKey = (x: D) => x.source + "|" + x.item_id;
  /* "Kész, nem kell válasz" really closes it, the same as in the Postafiók */
  const closeItem = async (x: D) => {
    setReply(null); setShut((o) => [...o, ibKey(x)]);
    const { error } = await rpc(sb, "admin_inbox_done", { p_source: x.source, p_item: x.item_id, p_done: true });
    if (error) { setShut((o) => o.filter((k) => k !== ibKey(x))); toast("Nem sikerült lezárni: " + error.message); return; }
    toast("Lezárva"); changed(); setIbN((k) => k + 1);
  };
  const openIb = ib.filter((x) => !shut.includes(ibKey(x)));
  return (
    <>
      <Card className="s7" icon={P.eye} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="A fő posztok élőben" sub="A friss és a most is mozgó posztjaid, a platform saját mértékegységében (TikTok, Instagram, YouTube: megtekintés; Pinterest, LinkedIn: megjelenés). „/óra”: az elmúlt óra növekedése az óránkénti pillanatképekből; ↑: a platformod szokásos óránkénti tempójának legalább háromszorosa. A zöld szám: ennyi jött, mióta ma megnyitottad."
        right={<button className="adm-ibtn sm" onClick={syncNow} disabled={busy || !!wait}>{I(P.refresh)}{busy ? "Frissítés…" : wait || "Frissítés most"}</button>}>
        {ps == null ? <div className="skel" style={{ height: 160 }} /> : posts.length ? <div className="lp">{posts.map((p) => { const d0 = n(p.views) - n(base.current[p.platform + p.post_id]), x = hot(p);
          return <a key={p.platform + p.post_id} className={"lp-i" + (x ? " hot" : "")} href={p.url || undefined} target="_blank" rel="noreferrer"><Logo k={p.platform} size={26} /><span className="lp-t">{x ? "↑ " : ""}{String(p.title || PF[p.platform]).slice(0, 50)}</span><b>{big(p.views)}</b>{d0 > 0 && <em>+{fmt(d0)}</em>}
            <small>{viewWord(p.platform)}{p.gain_h != null ? ` · +${big(Math.max(0, n(p.gain_h)))}/óra` : ""}{p.gain_d != null ? ` · +${big(Math.max(0, n(p.gain_d)))}/nap` : ""}{x ? ` · a szokásos ${fmt(x, 1)}×-e` : ""} · {big(p.likes)} ♥ · {big(p.comments)} komment</small>
            {Array.isArray(p.hourly) && p.hourly.length > 2 && <span className="lp-sp"><Spark values={(p.hourly as number[]).map(n)} h={22} /></span>}</a>; })}</div>
          : <p className="note">A bekötött platformok friss posztjai itt pörögnek.</p>}
      </Card>
      <Card className="s5" icon={P.mail} title="Friss kommentek és vélemények" sub="A legújabb megválaszolatlan kommentek és áruházi vélemények, percenként frissül. Innen is válaszolhatsz. A TikTok-, Pinterest- és LinkedIn-kommenteket a platformok API-ja nem adja (a TikTok csak üzleti fiókkal).">
        {openIb.length ? <ul className="lc">{openIb.map((x) => <li key={x.source + x.item_id} className={reply && ibKey(reply) === ibKey(x) ? "on" : ""}><Logo k={x.source === "google" ? "play" : x.source} size={20} /><div><b>{x.author || "Névtelen"}{x.kind === "review" && x.rating ? ` · ${"★".repeat(n(x.rating))}` : ""}</b><span>{String(x.body || "").slice(0, 90)}</span></div><time>{ago(x.created_at)}</time><button className="lnk" aria-pressed={!!reply && ibKey(reply) === ibKey(x)} onClick={() => setReply(x)}>Válasz</button></li>)}</ul> : <p className="note">Nincs megválaszolatlan komment.</p>}
        {reply && <ul className="inbox lc-reply"><InboxItem key={ibKey(reply)} x={reply} onDone={() => closeItem(reply)} onSent={() => { const x = reply; setReply(null); setShut((o) => [...o, ibKey(x)]); changed(); setIbN((k) => k + 1); }} startOpen /></ul>}
        <a className="lnk" href="#inbox">Postafiók →</a>
      </Card>
    </>
  );
}

/* ---------- her own accounts: a visit where she is signed in with one of these never counts ---------- */
function OwnAccounts({ reload }: { reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [d, setD] = useState<D | null>(null); const [e, setE] = useState("");
  const load = () => rpc(sb, "admin_own_accounts_list").then(({ data }) => setD(data || null));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (ev2: React.FormEvent) => { ev2.preventDefault(); const r = await rpc(sb, "admin_own_account_set", { p_email: e, p_on: true }); if (r.error) { toast("Ez nem e-mail-cím."); return; } setE(""); toast("Ez a fiók kimarad a fiók- és regisztrációszámokból"); load(); reload(); };
  /* removing gives the account's visits back to the numbers (the database update does it) */
  const del = async (x: string) => { if (!confirm(`${x}: a látogatásai újra számítanak. Biztos?`)) return; await rpc(sb, "admin_own_account_set", { p_email: x, p_on: false }); toast("Levéve: a látogatásai újra számítanak"); load(); reload(); };
  return (
    <div className="own-acc">
      <span className="note">Saját és tesztfiókjaid: egyik fiók-, regisztráció- és megtartásszámba sem kerülnek bele. A látogatásaikat viszont csak az eszköz megjelölése zárja ki (a mérés fiókot nem küld), ezért nyisd meg a fenti linket minden eszközödön.</span>
      <div className="own-chips">{((d?.admin || []) as string[]).map((x) => <span key={x} className="chip gold">{x}</span>)}{((d?.extra || []) as string[]).map((x) => <span key={x} className="chip">{x}<button className="lnk" onClick={() => del(x)} aria-label="Levesz"> ✕</button></span>)}</div>
      <form className="adm-row" onSubmit={add}><input className="adm-in sm" style={{ flex: "1 1 220px" }} type="email" placeholder="másik saját e-mail-címed" value={e} onChange={(x) => setE(x.target.value)} /><button className="adm-ibtn sm">Hozzáadás</button></form>
    </div>
  );
}

