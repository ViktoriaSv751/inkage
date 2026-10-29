"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Sankey, chColor, fmt, type SLink, type SNode } from "../charts";
import { Logo } from "../wow";
import { PF, SOC, ago, big, n, rpc, type D } from "../shared";

/* Irányítóközpont, 4. hullám: the posting-time heatmap, the video wall, the content × platform matrix and the flow from
   a platform's posts to accounts. Each takes posts already on the page; nothing here reads the database. */

const imp = (pf: string) => pf === "pinterest" || pf === "linkedin";
const vword = (pf: string) => (imp(pf) ? "megjelenés" : "megtekintés");
const bp = (t: string) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.find((x) => x.type === "weekday")!.value); return { dow: wd, h: Number(p.find((x) => x.type === "hour")!.value) }; };
const DOW = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];

/* ---------- when to post: the day of the week × the hour, coloured by how her posts did against their platform ---------- */
export function PostHeat({ posts, vs }: { posts: D[]; vs: (p: D) => number | null }) {
  const [hov, setHov] = useState<string | null>(null);
  const cells = useMemo(() => {
    const m: Record<string, { s: number; c: number; ps: D[] }> = {};
    posts.forEach((p) => { if (!p.created_at) return; const x = vs(p); if (x == null) return; const { dow, h } = bp(p.created_at); const k = dow + ":" + h; (m[k] ||= { s: 0, c: 0, ps: [] }); m[k].s += x; m[k].c++; m[k].ps.push(p); });
    return m;
  }, [posts, vs]);
  const vals = Object.values(cells).map((c) => c.s / c.c);
  if (!vals.length) return <Empty t="Ehhez legalább néhány, 24 óránál régebbi poszt kell: utána itt látszik, melyik nap melyik órájában ment a legjobban." />;
  const max = Math.max(...vals, 1.5);
  const color = (v: number) => (v >= 1 ? `rgba(47,163,107,${Math.min(1, 0.2 + ((v - 1) / Math.max(0.01, max - 1)) * 0.8)})` : `rgba(217,83,79,${Math.min(0.85, 0.2 + (1 - v) * 0.8)})`);
  const best = Object.entries(cells).sort((a, b) => b[1].s / b[1].c - a[1].s / a[1].c)[0];
  const hv = hov ? cells[hov] : null;
  return (
    <div className="heat-w">
      <div className="ph-heat">
        <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="hh">{h % 3 === 0 ? h : ""}</span>)}
        {DOW.map((dl, d) => [<span key={"l" + d} className="hd">{dl.slice(0, 3)}</span>, ...Array.from({ length: 24 }, (_, h) => { const c = cells[d + ":" + h];
          return <i key={d + ":" + h} className={c ? "on" : ""} style={c ? { background: color(c.s / c.c) } : undefined} onMouseEnter={() => setHov(c ? d + ":" + h : null)} title={c ? `${dl} ${h}:00 · ${c.c} poszt · átlag ${fmt(c.s / c.c, 1)}× a szokásos` : undefined} />; })])}
      </div>
      <p className="note">{hv ? <>{DOW[Number(hov!.split(":")[0])]} {hov!.split(":")[1]}:00 · {hv.c} poszt · átlag <b>{fmt(hv.s / hv.c, 1)}×</b>: {hv.ps.slice(0, 2).map((p) => `„${String(p.title || "").slice(0, 30)}”`).join(", ")}</>
        : best ? <>Eddig a legjobb időpont: <b>{DOW[Number(best[0].split(":")[0])]} {best[0].split(":")[1]}:00</b> körül ({best[1].c} poszt, átlag {fmt(best[1].s / best[1].c, 1)}× a szokásos). Zöld: jobb, mint a platformod szokásos posztja; piros: gyengébb. Kevés posztnál ez még csak irány.</> : null}</p>
    </div>
  );
}

/* ---------- the video wall: every post's cover, the frame coloured by how it did ---------- */
export function VideoWall({ posts, vs, onOpen }: { posts: D[]; vs: (p: D) => number | null; onOpen: (p: D) => void }) {
  const [shown, setShown] = useState(96);
  const list = [...posts].filter((p) => p.created_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return (
    <>
      <div className="vwall">{list.slice(0, shown).map((p) => { const x = vs(p);
        return (
          <button key={p.platform + p.post_id} className="vw-i" onClick={() => onOpen(p)} style={{ borderColor: x == null ? "var(--a-line)" : x >= 1.5 ? "#2FA36B" : x < 0.6 ? "#D9534F" : "var(--a-line2)" }} title={`${PF[p.platform]} · ${ago(p.created_at)} · ${String(p.title || "").slice(0, 80)}`}>
            {p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="vw-ph"><Logo k={p.platform} size={30} /></span>}
            <span className="vw-pf"><Logo k={p.platform} size={14} /></span>
            <span className="vw-v"><b>{p.views == null ? "–" : big(p.views)}</b>{x != null && <small>{fmt(x, 1)}×</small>}</span>
          </button>); })}</div>
      {list.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + 96)}>Továbbiak ({fmt(list.length - shown)})</button></div>}
    </>
  );
}

/* ---------- content × platform: one row per content (the same video everywhere), one column per platform ----------
   An empty cell is a place it has not gone out yet; a content that did well somewhere and is missing elsewhere is
   marked "érdemes kitenni" (repurpose). */
export function ContentMatrix({ groups, vs, onOpen }: { groups: D[][]; vs: (p: D) => number | null; onOpen: (p: D) => void }) {
  const rows = groups.map((g) => ({ g, t: g[0].created_at, best: Math.max(...g.map((p) => vs(p) ?? 0)) })).sort((a, b) => Date.parse(b.t) - Date.parse(a.t)).slice(0, 60);
  if (!rows.length) return <Empty t="Még nincs poszt." />;
  return (
    <div className="tw"><table className="tb cmx">
      <thead><tr><th>Tartalom</th>{SOC.map((pf) => <th key={pf} className="num"><Logo k={pf} size={18} /></th>)}<th /></tr></thead>
      <tbody>{rows.map(({ g, best }, i) => { const miss = SOC.filter((pf) => !g.some((p) => p.platform === pf));
        return (
          <tr key={i}>
            <td><span className="cellwrap" style={{ display: "block", maxWidth: 320 }}><b>{String(g[0].title || "(nincs szöveg)").slice(0, 70)}</b><br /><span className="mut">{ago(g[0].created_at)}</span></span></td>
            {SOC.map((pf) => { const p = g.find((x) => x.platform === pf); const x = p ? vs(p) : null;
              return <td key={pf} className="num">{p ? <button className="cmx-c" onClick={() => onOpen(p)} title={`${PF[pf]}: ${big(p.views)} ${vword(pf)}`}><b>{big(p.views)}</b>{x != null && <small className={x >= 1 ? "up" : "down"}>{fmt(x, 1)}×</small>}</button> : <span className="cmx-x" title={`Még nem ment ki ${PF[pf]}-ra`}>·</span>}</td>; })}
            <td>{best >= 1.5 && miss.length ? <span className="chip warn" title={`Máshol a szokásos ${fmt(best, 1)}-szerese volt: érdemes kitenni ide is: ${miss.map((m) => PF[m]).join(", ")}`}>érdemes kitenni: {miss.slice(0, 2).map((m) => PF[m]).join(", ")}{miss.length > 2 ? "…" : ""}</span> : null}</td>
          </tr>); })}</tbody>
    </table></div>
  );
}

/* ---------- from a platform's posts to accounts: platform → post (the top ones with a short link) → analysis → sign-up ----------
   Visits without a short link go through "bio, egyéb". The sign-up step is an estimate: an account keeps no source of
   its own, it is matched to the visit before it. */
export function PlatformFlow({ posts, leads }: { posts: D[]; leads: D[] }) {
  const pfs = SOC.filter((pf) => n(leads.find((l) => l.k === pf)?.sessions) > 0);
  if (!pfs.length) return <Empty t="Ebben az időszakban még nem jött látogató a közösségi oldalakról: amint jön, itt látszik az útja a posztoktól a regisztrációig." />;
  const layers: SNode[][] = [[], [], [{ id: "scored", l: "Előnézetig jutott", color: "#2FA36B" }, { id: "left", l: "Csak nézelődött", color: "#B9B2A6" }], [{ id: "signup", l: "Regisztrált", color: "#5B3DF5" }, { id: "nosign", l: "Nem regisztrált", color: "#D6D0C4" }]];
  const links: SLink[] = [];
  let scoredAll = 0, signAll = 0, sessAll = 0;
  pfs.forEach((pf) => {
    const L = leads.find((l) => l.k === pf) || {};
    layers[0].push({ id: pf, l: PF[pf], color: chColor(pf) });
    /* the visits of the period (sessions_now); a post's analyses are known for all time, so they are scaled to the period */
    const top = posts.filter((p) => p.platform === pf && p.code && n(p.sessions_now) > 0).sort((a, b) => n(b.sessions_now) - n(a.sessions_now)).slice(0, 3);
    let used = 0, usedSc = 0;
    top.forEach((p) => { const id = pf + ":" + p.post_id, ss = Math.min(n(p.sessions_now), Math.max(0, n(L.sessions) - used)); if (!ss) return;
      const sc = Math.min(ss, Math.round(n(p.scored) * (n(p.sessions_now) / Math.max(1, n(p.sessions)))));
      layers[1].push({ id, l: String(p.title || "poszt").slice(0, 22), color: chColor(pf) });
      links.push({ a: pf, b: id, v: ss }, { a: id, b: "scored", v: sc }, { a: id, b: "left", v: ss - sc }); used += ss; usedSc += sc; });
    const rest = Math.max(0, n(L.sessions) - used), restSc = Math.max(0, Math.min(rest, n(L.scored) - usedSc));
    if (rest > 0) { const id = pf + ":rest"; layers[1].push({ id, l: `${PF[pf]}: bio, egyéb`, color: chColor(pf) }); links.push({ a: pf, b: id, v: rest }, { a: id, b: "scored", v: restSc }, { a: id, b: "left", v: rest - restSc }); }
    scoredAll += n(L.scored); signAll += n(L.signups); sessAll += n(L.sessions);
  });
  const sg = Math.min(signAll, scoredAll);
  links.push({ a: "scored", b: "signup", v: sg }, { a: "scored", b: "nosign", v: Math.max(0, scoredAll - sg) }, { a: "left", b: "signup", v: Math.max(0, signAll - sg) }, { a: "left", b: "nosign", v: Math.max(0, sessAll - scoredAll - Math.max(0, signAll - sg)) });
  return <Sankey layers={layers} links={links.filter((l) => l.v > 0)} height={Math.max(260, layers[1].length * 34)} />;
}

/* ---------- a day played back: slide or play through the 24 hours and watch the visits, analyses and sign-ups come in,
   the channels they came from, and the posts as they went out ---------- */
export function DayReplay() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const t = new Date(Date.now() - i * 864e5); return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(t); }), []);
  const [day, setDay] = useState(days[1]); const [x, setX] = useState<D | null>(null); const [m, setM] = useState(1439); const [play, setPlay] = useState(false);
  useEffect(() => { setX(null); rpc(sb, "admin_day_replay", { p_day: day }).then(({ data }) => { setX(data || {}); setM(day === days[0] ? nowMin() : 1439); }); }, [sb, day, days]);
  useEffect(() => { if (!play) return; const end = day === days[0] ? nowMin() : 1439; const t = setInterval(() => setM((v) => { if (v >= end) { setPlay(false); return end; } return Math.min(end, v + 10); }), 80); return () => clearInterval(t); }, [play, day, days]);
  const steps: D[] = x?.steps || [], chs: D[] = x?.channels || [], posts: D[] = x?.posts || [];
  const upto = (k: string) => steps.filter((s) => n(s.m) <= m).reduce((t, s) => t + n(s[k]), 0);
  const byCh: Record<string, number> = {}; chs.filter((c) => n(c.m) <= m).forEach((c) => { byCh[c.k || "ismeretlen"] = (byCh[c.k || "ismeretlen"] || 0) + 1; });
  const top = Object.entries(byCh).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(1, ...steps.map((s) => n(s.sessions)));
  const hm = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  return (
    <div className="rp">
      <div className="adm-row" style={{ flexWrap: "wrap", gap: 6 }}>{days.map((d0, i) => <button key={d0} className={"adm-ibtn sm" + (d0 === day ? " on" : "")} onClick={() => { setPlay(false); setDay(d0); }}>{i === 0 ? "Ma" : i === 1 ? "Tegnap" : new Date(d0 + "T12:00").toLocaleDateString("hu-HU", { weekday: "short", month: "short", day: "numeric" })}</button>)}</div>
      {!x ? <div className="skel" style={{ height: 180 }} /> : <>
        <div className="rp-bars" aria-hidden="true">{Array.from({ length: 144 }, (_, i) => { const s = steps.find((y) => n(y.m) === i * 10); return <i key={i} className={i * 10 <= m ? "on" : ""} style={{ height: s ? Math.max(4, (n(s.sessions) / max) * 100) + "%" : "2px" }} />; })}
          {posts.map((p, i) => <span key={i} className="rp-post" style={{ left: (n(p.m) / 1440) * 100 + "%" }} title={`${PF[p.platform]} · ${hm(n(p.m))} · ${p.title || ""}`}><Logo k={p.platform} size={14} /></span>)}
          <b className="rp-cur" style={{ left: (m / 1440) * 100 + "%" }} /></div>
        <div className="adm-row" style={{ gap: 10 }}>
          <button className="adm-ibtn sm gold" onClick={() => { if (!play && m >= (day === days[0] ? nowMin() : 1439)) setM(0); setPlay(!play); }}>{play ? "Megállítás" : "▶ Lejátszás"}</button>
          <input type="range" min={0} max={1439} step={10} value={m} onChange={(e) => { setPlay(false); setM(Number(e.target.value)); }} style={{ flex: 1 }} aria-label="Időpont" />
          <b className="rp-time">{hm(m)}</b>
        </div>
        <div className="mini-stats">
          <div className="mini"><span>Látogatás eddig</span><b>{fmt(upto("sessions"))}</b></div><div className="mini"><span>Előnézet</span><b>{fmt(upto("scored"))}</b></div>
          <div className="mini"><span>Regisztráció</span><b>{fmt(upto("signups"))}</b></div><div className="mini"><span>Megosztás</span><b>{fmt(upto("shared"))}</b></div>
        </div>
        <div className="rp-ch">{top.map(([k, v]) => <span key={k} className="chip"><Logo k={k} size={14} />{CHL[k] || k} · {fmt(v)}</span>)}{posts.filter((p) => n(p.m) <= m).map((p, i) => <span key={"p" + i} className="chip warn"><Logo k={p.platform} size={14} />{hm(n(p.m))} poszt: {String(p.title || "").slice(0, 30)}</span>)}</div>
      </>}
    </div>
  );
}
const nowMin = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":"); return Number(p[0]) * 60 + Number(p[1]); };
const CHL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", google: "Google", közvetlen: "Közvetlen", ismeretlen: "Ismeretlen", link: "Rövid link", bing: "Bing", ai: "MI-keresők" };
