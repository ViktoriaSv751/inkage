"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { BarList, Empty, TrendChart, fmt, pct, useWidth } from "../charts";
import { Logo } from "../wow";
import { countryName, flag } from "../visuals";
import { Band, Card, FreshRow, Kpi, Loading, P, Tbl, ago, big, daysLabel, n, secs, type D, useRpc } from "../shared";
import { PostDrawer } from "./social";

/* ---------- YouTube: Shorts and videos side by side, how long they hold the viewer, where the views come from ---------- */
const SRC: Record<string, string> = { YT_SEARCH: "YouTube-keresés", SUBSCRIBER: "Feliratkozók", SHORTS: "Shorts-hírfolyam", RELATED_VIDEO: "Ajánlott videók", BROWSE: "Kezdőlap, böngészés",
  EXT_URL: "Külső oldalak", NO_LINK_OTHER: "Közvetlen / egyéb", PLAYLIST: "Lejátszási listák", YT_CHANNEL: "A csatornád oldala", NOTIFICATION: "Értesítések", END_SCREEN: "Záróképernyő", ANNOTATION: "Kártyák", YT_OTHER_PAGE: "Más YouTube-oldal", HASHTAGS: "Hashtagek", SOUND_PAGE: "Hang-oldal" };
const AGE = (k: string) => k.replace("-", "–") + " év";
const CTYPE: Record<string, string> = { SHORTS: "Shorts", VIDEO_ON_DEMAND: "Hosszú videó", LIVE_STREAM: "Élő adás", STORY: "Story", UNSPECIFIED: "Egyéb" };

export function YouTube({ days }: { days: number }) {
  const soc = useRpc("admin_social", { p_days: days || 3650 }, [days]);
  const yt = useRpc("admin_youtube", undefined, []);
  const [openP, setOpenP] = useState<D | null>(null);
  const [kind, setKind] = useState<"all" | "short" | "video">("all");
  const [line, setLine] = useState<"views" | "watch_min" | "net" | "impressions">("views");
  if (soc.e || yt.e) return <div className="g"><div className="alert err s12">{soc.e || yt.e}</div></div>;
  if (!soc.d || !yt.d) return <Loading />;
  const acc = ((soc.d.accounts || []) as D[]).find((a) => a.platform === "youtube");
  const ch: D[] = yt.d.daily || [];
  const since = days ? Date.now() - days * 864e5 : 0;
  const inP = ch.filter((x) => new Date(x.day).getTime() >= since);
  const fol = ch.filter((x) => x.followers != null), last = fol.slice(-1)[0];
  const wk = last ? [...fol].reverse().find((x) => new Date(last.day).getTime() - new Date(x.day).getTime() >= 7 * 864e5) || fol[0] : undefined;
  const lastTotal = [...ch].reverse().find((x) => x.views_total != null);
  const posts: D[] = ((soc.d.posts || []) as D[]).filter((p) => p.platform === "youtube").map((p) => ({ ...p, lv: n(p.views) ? n(p.likes) / n(p.views) : null, rate: p.code && n(p.views) ? (n(p.sessions) * 1000) / n(p.views) : null }));
  const shorts = posts.filter((p) => p.kind === "short"), long = posts.filter((p) => p.kind !== "short");
  const sum = (ps: D[], k: string) => ps.reduce((a, p) => a + n(p[k]), 0);
  const avgW = (ps: D[]) => { const w = ps.filter((p) => p.watch_avg != null); return w.length ? w.reduce((a, p) => a + n(p.watch_avg), 0) / w.length : null; };
  const demo: D[] = yt.d.demo || [], ret: D[] = yt.d.retention || [];
  const by = (b: string) => demo.filter((x) => x.breakdown === b);
  const list = kind === "all" ? posts : kind === "short" ? shorts : long;
  /* the channel's own day numbers in the period (YouTube Analytics, 2–3 days late), not only the period's new videos */
  const watchMin = inP.reduce((t, x) => t + n(x.watch_min), 0), hasDays = inP.some((x) => x.watch_min != null);
  const netSubs = inP.reduce((t, x) => t + n(x.gained) - n(x.lost), 0), hasSubs = inP.some((x) => x.gained != null);
  const thumbs = inP.reduce((t, x) => t + n(x.impressions), 0);
  const pts = inP.filter((x) => (line === "net" ? x.gained != null : x[line] != null)).map((x) => ({ t: x.day, v: line === "net" ? n(x.gained) - n(x.lost) : n(x[line]) }));
  const ctr = (() => { const w = posts.filter((p) => p.ctr != null && n(p.impressions) > 0); const im = w.reduce((t, p) => t + n(p.impressions), 0); return im ? w.reduce((t, p) => t + n(p.ctr) * n(p.impressions), 0) / im : null; })();
  /* Google keeps a "Testing" app's refresh token for 7 days only: then the connection breaks */
  const A: D = yt.d.account || {}, err = String(A.last_error || acc?.last_error || "");
  const broken = /invalid_grant|expired|revoked|401/i.test(err), age = A.connected_at ? (Date.now() - new Date(A.connected_at).getTime()) / 864e5 : 0;
  if (!acc) return (
    <div className="g"><Card className="s12" icon={P.play} title="YouTube" sub="A csatorna bekötése után: feliratkozók, minden videó és Shorts nézési ideje, nézőmegtartása, forgalomforrása és a nézők kora, neme, országa.">
      <Empty t="Még nincs bekötve a YouTube. A Kapcsolatok oldalon a Google Cloud-projektben két lépés, utána egy belépés." icon={P.play}><a className="adm-ibtn gold" href="#connect">Bekötés</a></Empty>
    </Card></div>
  );
  return (
    <div className="g">
      <FreshRow srcs={["youtube"]} />
      {broken ? <div className="alert err s12">A YouTube-kapcsolat megszakadt ({err.slice(0, 120)}). Kösd be újra a Kapcsolatok oldalon. Ha a Google Cloudban az OAuth-app „Testing” állapotú, a Google 7 nap után mindig lejártatja: állítsd „In production”-re, és akkor tartós marad. <a className="lnk" href="#connect">Bekötés</a></div>
        : age >= 5 && <div className="alert s12">A YouTube {fmt(age)} napja van bekötve. Ha a Google Cloudban az OAuth-app még „Testing” állapotú, a kapcsolat a bekötés után 7 nappal ({new Date(new Date(A.connected_at).getTime() + 7 * 864e5).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}) megszakad: állítsd „In production”-re.</div>}
      <Band label="Feliratkozók" value={n(last?.followers)} now={n(last?.followers)} prev={n(wk?.followers)} unit={`@${String(acc.username || acc.display_name || "csatorna").replace(/^@/, "")}`}
        sentence={<><b>{fmt(posts.length)}</b> videó az időszakban, ebből <b>{fmt(shorts.length)}</b> Shorts (3 percig). A csatorna összes megtekintése: <b>{big(lastTotal?.views_total)}</b>. Frissítve {ago(acc.last_sync_at)}.</>} />
      <Kpi kind="api" to="@next" tone="peach" className="s3" icon={P.eye} l="Shorts megtekintés" v={big(sum(shorts, "views"))} sub={`${fmt(shorts.length)} Shorts · átl. ${secs(avgW(shorts))}`} />
      <Kpi kind="api" to="@next" tone="sky" className="s3" icon={P.eye} l="Videó megtekintés" v={big(sum(long, "views"))} sub={`${fmt(long.length)} videó · átl. ${secs(avgW(long))}`} />
      <Kpi spark={inP.filter((x) => x.watch_min != null).map((x) => n(x.watch_min))} kind="api" to="@next" tone="butter" className="s3" icon={P.clock} l="Nézési idő" v={hasDays ? secs(watchMin * 60) : secs(sum(posts, "watch_total"))} sub={hasDays ? `a csatorna összes videóján, ${days ? daysLabel(days) : "az egész idő alatt"}` : "az időszak videóin, élettartam"} />
      <Kpi spark={inP.filter((x) => x.gained != null).map((x) => n(x.gained) - n(x.lost))} kind="api" to="@next" tone="pink" className="s3" icon={P.users} l="Nettó új feliratkozó" v={hasSubs ? (netSubs >= 0 ? "+" : "") + fmt(netSubs) : fmt(sum(posts, "follows"))} sub={`${fmt(sum(posts, "sessions"))} látogató a rövid linkekből`} />

      <Card className="s12" icon={P.traffic} title="A csatorna naponta" sub="A YouTube Analytics napi számai (2–3 nap késéssel): megtekintés, nézési idő percben, nettó feliratkozó (új mínusz leiratkozott), bélyegkép-megjelenés (a Reporting API napi jelentéséből)."
        right={<div className="adm-seg sm">{([["views", "Megtekintés"], ["watch_min", "Nézési idő"], ["net", "Feliratkozó"], ["impressions", "Bélyegkép"]] as const).map(([k, l]) => <button key={k} aria-pressed={line === k} onClick={() => setLine(k)}>{l}</button>)}</div>}>
        {pts.length > 1 ? <TrendChart data={pts} label={line === "views" ? "Megtekintés" : line === "watch_min" ? "Nézési idő (perc)" : line === "net" ? "Nettó új feliratkozó" : "Bélyegkép-megjelenés"} height={220} />
          : <Empty t={line === "impressions" ? "A bélyegkép-megjelenés a YouTube Reporting API napi jelentéséből jön: a jelentés a bekötés után 1–2 nappal készül el először." : ch.length ? "Ebben az időszakban még nincs napi szám: a YouTube Analytics 2–3 nap késéssel adja őket. Válassz hosszabb időszakot." : "A napi számok a következő lehúzás után jelennek meg."} />}
      </Card>
      <Kpi kind="api" to="@next" tone="lilac" className="s4" icon={P.eye} l="Bélyegkép-megjelenés" v={thumbs ? big(thumbs) : "–"} sub={ctr != null ? `átkattintás: ${fmt(ctr * 100, 1)}%` : "a Reporting API napi jelentéséből"} />
      <Kpi kind="api" to="@next" tone="mint" className="s4" icon={P.spark} l="Kedvelés / megtekintés" v={sum(posts, "views") ? fmt((sum(posts, "likes") / sum(posts, "views")) * 100, 1) + "%" : "–"} sub={`${big(sum(posts, "likes"))} kedvelés`} />
      <Kpi kind="api" to="@next" tone="peach" className="s4" icon={P.share} l="Megosztás" v={big(sum(posts, "shares"))} sub={`${fmt(n(yt.d.comments))} komment a postafiókban`} />

      <Card className="s12" icon={P.layers} title="Nézőmegtartás" sub="A 20 legújabb és a 10 legnézettebb videó: a videó hány %-ánál hány néző nézi még (100% = mindenki, aki elindította; 100 fölött: visszatekertek). Ahol a görbe meredeken esik, ott veszíted el a nézőket.">
        {ret.length ? <Retention curves={ret} posts={posts} /> : <Empty t="A YouTube a nézőmegtartást a feltöltés után 1–2 nappal adja ki; a következő lehúzással megjelenik." icon={P.layers} />}
      </Card>
      <Card className="s6" icon={P.play} title="Shorts és hosszú videók" sub="Megtekintés tartalomtípusonként az elmúlt 90 napban (YouTube Analytics), mellette a nézési idő percben.">
        <BarList items={by("ctype").map((x) => ({ k: x.k, n: n(x.n), sub: `${fmt(n(by("ctype_min").find((y) => y.k === x.k)?.n))} perc` }))} fmtK={(k) => CTYPE[k] || k} accent empty="Még nincs adat." />
      </Card>
      <Card className="s6" icon={P.traffic} title="Honnan jönnek a nézők" sub="Megtekintés forrásonként, az elmúlt 90 napban (YouTube Analytics).">
        <BarList items={by("traffic").map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => SRC[k] || k} accent empty="Még nincs adat." />
      </Card>
      <Card className="s4" icon={P.globe} title="Országok" sub="Megtekintés országonként, 90 nap.">
        <BarList items={by("country").map((x) => ({ k: x.k, n: n(x.n) }))} fmtK={(k) => `${flag(k)} ${countryName(k)}`} max={8} empty="Még nincs adat." />
      </Card>
      <Card className="s4" icon={P.users} title="Kor" sub="A nézők %-a korcsoportonként (a YouTube a bejelentkezett nézőkből becsli).">
        <BarList items={by("age").map((x) => ({ k: x.k, n: n(x.n) / 10 }))} fmtK={AGE} empty="Még nincs adat." />
      </Card>
      <Card className="s4" icon={P.user} title="Nem" sub="A nézők %-a.">
        <BarList items={by("gender").map((x) => ({ k: x.k, n: n(x.n) / 10 }))} fmtK={(k) => ({ F: "Nő", M: "Férfi", U: "Nem ismert" } as D)[k] || k} empty="Még nincs adat." />
      </Card>

      <Card className="s12" icon={P.play} title="Videók és Shorts" sub="Megtekintés, átlagos nézési idő, kedvelés aránya, megosztás, bélyegkép-megjelenés és átkattintás, új feliratkozó és a rövid linkből érkező látogató (/1000 = látogató 1000 megtekintésenként). Kattints egy sorra: a részletek, a nézőmegtartás és az első napok görbéje."
        right={<div className="adm-seg sm"><button aria-pressed={kind === "all"} onClick={() => setKind("all")}>Mind</button><button aria-pressed={kind === "short"} onClick={() => setKind("short")}>Shorts</button><button aria-pressed={kind === "video"} onClick={() => setKind("video")}>Videók</button></div>}>
        <Tbl name="youtube" rows={list} onRow={setOpenP} empty="Ebben az időszakban nincs videó." cols={[
          { k: "title", l: "Videó", r: (r) => <span className="cellwrap" style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 420 }}>{r.thumb ? <img src={r.thumb} alt="" style={{ width: 64, height: 36, objectFit: "cover", borderRadius: 6, flex: "none" }} referrerPolicy="no-referrer" /> : <Logo k="youtube" size={30} />}<span><b>{String(r.title || "").slice(0, 80)}</b><br /><span className="mut">{r.kind === "short" ? "Shorts" : "Videó"} · {ago(r.created_at)}</span></span></span> },
          { k: "views", l: "Megtekintés", num: true, r: (r) => <b>{big(r.views)}</b> },
          { k: "watch_avg", l: "Átl. nézési idő", num: true, r: (r) => (r.watch_avg != null ? `${secs(n(r.watch_avg))}${r.duration ? ` · ${pct(n(r.watch_avg), n(r.duration))}` : ""}` : "–") },
          { k: "likes", l: "Kedvelés", num: true, r: (r) => big(r.likes) }, { k: "lv", l: "Kedvelés / megt.", num: true, r: (r) => (r.lv != null ? fmt(r.lv * 100, 1) + "%" : "–") },
          { k: "comments", l: "Komment", num: true, r: (r) => big(r.comments) }, { k: "shares", l: "Megosztás", num: true, r: (r) => big(r.shares) },
          { k: "impressions", l: "Bélyegkép-megj.", num: true, r: (r) => big(r.impressions) }, { k: "ctr", l: "CTR", num: true, r: (r) => (r.ctr != null ? fmt(n(r.ctr) * 100, 1) + "%" : "–") },
          { k: "follows", l: "Új feliratkozó", num: true, r: (r) => big(r.follows) },
          { k: "sessions", l: "Látogató", num: true, r: (r) => (r.code ? <b style={{ color: "var(--a-gold)" }}>{fmt(r.sessions)}</b> : "–") },
          { k: "rate", l: "/1000", num: true, r: (r) => (r.rate != null ? fmt(r.rate, 1) : "–") },
        ]} />
      </Card>
      {openP && <PostDrawer p={openP} close={() => setOpenP(null)} />}
    </div>
  );
}

/* audience retention curves, one line per video, the 30-second mark of a Short shaded */
export function Retention({ curves, posts }: { curves: D[]; posts: D[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<string | null>(null);
  const h = 260, padL = 40, padR = 12, padT = 12, padB = 26, iw = Math.max(10, w - padL - padR), ih = h - padT - padB;
  const max = Math.max(1.05, ...curves.flatMap((c) => (c.pts as D[]).map((p) => n(p.r))));
  const x = (v: number) => padL + v * iw, y = (v: number) => padT + ih - (v / max) * ih;
  const COL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#008300", "#e66767"];
  const title = (id: string) => String(posts.find((p) => p.post_id === id)?.title || id).slice(0, 48);
  return (
    <div>
      <div className="chart" ref={ref} style={{ height: h }}>
        {w > 0 && <svg width={w} height={h}>
          {[0, 0.5, 1].map((v) => <g key={v}><line className="gl" x1={padL} x2={padL + iw} y1={y(v)} y2={y(v)} /><text className="ax" x={padL - 8} y={y(v) + 4} textAnchor="end">{fmt(v * 100)}%</text></g>)}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => <text key={v} className="ax" x={x(v)} y={h - 6} textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"}>{fmt(v * 100)}%</text>)}
          {curves.map((c, i) => <path key={c.post_id} d={(c.pts as D[]).map((p, j) => `${j ? "L" : "M"}${x(n(p.x))} ${y(n(p.r))}`).join("")}
            style={{ stroke: COL[i % COL.length], fill: "none", strokeWidth: sel === c.post_id ? 3 : 2, opacity: sel && sel !== c.post_id ? 0.2 : 1 }} />)}
        </svg>}
      </div>
      <div className="legend">{curves.map((c, i) => { const pts = c.pts as D[], end = n(pts[pts.length - 1]?.r), half = n(pts.find((p) => n(p.x) >= 0.5)?.r);
        return <button key={c.post_id} className="lg-b" onMouseEnter={() => setSel(c.post_id)} onMouseLeave={() => setSel(null)} onClick={() => setSel(sel === c.post_id ? null : c.post_id)}><i className="sq" style={{ background: COL[i % COL.length] }} />{title(c.post_id)} · félúton {fmt(half * 100)}%, a végén {fmt(end * 100)}%</button>; })}</div>
      <p className="note">Tipp: ha az első 10%-ban 70% alá esik, a horog (az első 1–2 mp) gyenge; ha a végén 100% fölött van, sokan újranézik: ez a Shorts-algoritmusnak a legjobb jel.</p>
    </div>
  );
}
