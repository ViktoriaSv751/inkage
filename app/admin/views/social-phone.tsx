"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* The Tartalom page on a phone: posts as a feed with their pictures, what worked this week, when to post, the competitors,
   and small jobs prepared for her approval. Every number comes from the same lists as the desktop page. */
import { useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, Empty, Spark, chColor, fmt } from "../charts";
import { Logo } from "../wow";
import { Async, Card, I, MOCK, P, PF, SOC, ago, big, bpParts, n, rpc, type D, useRpc, useSaved } from "../shared";
import { Lazy, toast } from "../phone";
import { cardImage } from "../phone-host";
import { BlowCard, PfTabs, PostGrid, PostRank, likeWord, postTags, rising, tooYoung, viewWord, vsMedian } from "./social";
import { fmtX } from "./visual";

const KINDS: Record<string, string> = { reel: "Reels", video: "Videó", short: "Shorts", image: "Kép", carousel_album: "Körhinta", carousel: "Körhinta", pin: "Pin", post: "Poszt", link: "Link" };
const like = (p: D) => (p.platform === "pinterest" ? p.pin_clicks : p.likes);

/* one post in the feed: its picture first, then what it did */
function FeedItem({ p, x, open }: { p: D; x: number | null; open: (p: D) => void }) {
  const [bad, setBad] = useState(false);
  return (
    <article className="fd-i" onClick={() => open(p)}>
      <div className={"fd-m" + (p.thumb && !bad ? "" : " noimg")}>
        {p.thumb && !bad ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} /> : <span className="fd-ph"><Logo k={p.platform} size={44} /></span>}
        {x != null ? <span className={"fd-x" + (x >= 1 ? " up" : "")} title="A platformod szokásos posztjához képest">{fmtX(x)}×</span> : tooYoung(p) ? <span className="fd-x">friss</span> : null}
      </div>
      <div className="fd-b">
        <div className="fd-h"><Logo k={p.platform} size={18} /><span>{PF[p.platform]}{p.kind ? " · " + (KINDS[p.kind] || p.kind) : ""}</span><time>{ago(p.created_at)}</time></div>
        <p className="fd-t">{p.title || "(nincs szöveg)"}</p>
        <div className="fd-n">
          <span><b>{big(p.views)}</b> {viewWord(p.platform)}</span>
          {like(p) != null && <span><b>{big(like(p))}</b> {likeWord(p.platform)}</span>}
          {p.comments != null && p.platform !== "pinterest" && <span><b>{big(p.comments)}</b> komment</span>}
          {p.code ? <span className="gold"><b>{fmt(p.sessions)}</b> látogató</span> : null}
        </div>
      </div>
    </article>
  );
}

/* a post under three days old, far above her usual pace. The numbers come from the hourly pull, so it says how fresh they are */
function LiveStrip({ posts, accs, open }: { posts: D[]; accs: D[]; open: (p: D) => void }) {
  const r = rising(posts).slice(0, 3);
  const last = accs.map((a) => a.last_sync_at).filter(Boolean).sort().pop() as string | undefined;
  const when = last ? `Adat: ${ago(last)}, óránként frissül` : "Még nem futott lehúzás";
  if (!r.length) return <div className="fd-live none"><span>Most nincs kiugró poszt.</span><small>{when}</small></div>;
  return (
    <div className="fd-live">
      {r.map((p) => <BlowCard key={p.platform + p.post_id} p={p} open={open} when={when} />)}
    </div>
  );
}

export function Feed({ posts, cal, accs, open, add }: { posts: D[]; cal: D[]; accs: D[]; open: (p: D) => void; add: (pf: string) => void }) {
  const [pf, setPf] = useState("all"); const [best, setBest] = useState(false); const [shown, setShown] = useState(24); const [lay, setLay] = useState<"grid" | "rank" | "list">("grid");
  const vs = useMemo(() => vsMedian(cal, cal), [cal]);
  const pfs = SOC.filter((k) => cal.some((x) => x.platform === k));
  const list = useMemo(() => (posts.length ? posts : cal).filter((p) => pf === "all" || p.platform === pf).map((p) => ({ p, x: vs(p) }))
    .sort((a, b) => (best ? (b.x ?? -1) - (a.x ?? -1) : 0) || new Date(b.p.created_at || 0).getTime() - new Date(a.p.created_at || 0).getTime()), [posts, cal, pf, best, vs]);
  return (
    <div className="fd">
      <LiveStrip posts={posts.length ? posts : cal} accs={accs} open={open} />
      <div className="fd-tools"><PfTabs pfs={pfs} v={pf} set={(k) => { setPf(k); setShown(24); }} /></div>
      <div className="fd-sort">{lay !== "rank" && <div className="adm-seg sm"><button aria-pressed={!best} onClick={() => setBest(false)}>Legújabb</button><button aria-pressed={best} onClick={() => setBest(true)}>Legjobb</button></div>}<div className="adm-seg sm"><button aria-pressed={lay === "grid"} onClick={() => setLay("grid")}>Rács</button><button aria-pressed={lay === "rank"} onClick={() => setLay("rank")}>Rangsor</button><button aria-pressed={lay === "list"} onClick={() => setLay("list")}>Lista</button></div><button className="adm-ibtn sm" onClick={() => add(pf)}>{I(P.plus)}Kézzel</button><span className="mut">{fmt(list.length)} poszt, minden időszak</span></div>
      {list.length ? (lay === "rank" ? <PostRank posts={[...list].sort((a, b) => (b.x ?? -1) - (a.x ?? -1) || n(b.p.views) - n(a.p.views)).slice(0, shown).map(({ p }) => p)} onOpen={open} mult={vs} /> : lay === "grid" ? <PostGrid posts={list.slice(0, shown).map(({ p }) => p)} onOpen={open} mult={best ? (p) => vs(p) : undefined} /> : list.slice(0, shown).map(({ p, x }) => <FeedItem key={p.platform + p.post_id} p={p} x={x} open={open} />)) : <Empty t={pf === "all" ? "Még nincs poszt." : `${PF[pf]}: nincs itt poszt, mert nincs bekötve, vagy még nem ment ki semmi.`} icon={P.social} />}
      {list.length > shown && <button className="pt-all" onClick={() => setShown(shown + 24)}>Még {fmt(Math.min(24, list.length - shown))} ({fmt(list.length - shown)} van még)</button>}
    </div>
  );
}

/* the week's best three against their own platform, and only what they really share and the rest of the week does not */
export function WeekTop({ cal, posts, open }: { cal: D[]; posts: D[]; open: (p: D) => void }) {
  const source = posts.length ? posts : cal;
  const vs = useMemo(() => vsMedian(cal, cal), [cal]);
  const week = source.filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 864e5).map((p) => ({ p, x: vs(p) })).filter((r) => r.x != null) as { p: D; x: number }[];
  const top = [...week].sort((a, b) => b.x - a.x).slice(0, 3), rest = week.filter((r) => !top.includes(r));
  const shared = top.length === 3 ? [...new Set(top.flatMap((r) => postTags(r.p)))].map((t) => ({ t, k: top.filter((r) => postTags(r.p).includes(t)).length, o: rest.length ? rest.filter((r) => postTags(r.p).includes(t)).length / rest.length : null }))
    .filter((s) => s.k >= 2 && s.o != null && s.k / 3 >= s.o + 0.25).sort((a, b) => b.k - a.k).slice(0, 3) : [];
  return (
    <Card className="s12" eager icon={P.spark} title="Mi működött a héten?" sub="Az elmúlt 7 nap posztjai, mindegyik a saját platformja szokásos posztjához mérve. A 24 óránál fiatalabbak még nem számítanak.">
      {top.length < 3 ? <Empty t={`Nincs elég poszt az összevetéshez: ${fmt(week.length)} összevethető poszt van a héten, 3 kell.`} icon={P.spark} /> : <>
        <ol className="wk-top">{top.map((r, i) => <li key={r.p.platform + r.p.post_id} onClick={() => open(r.p)}><span className="wk-n">{i + 1}</span>{r.p.thumb ? <img src={r.p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="wk-ph"><Logo k={r.p.platform} size={22} /></span>}<div><b>{String(r.p.title || "(nincs szöveg)").slice(0, 70)}</b><small>{PF[r.p.platform]} · {big(r.p.views)} {viewWord(r.p.platform)}</small></div><em>{fmtX(r.x)}×</em></li>)}</ol>
        <div className="wk-why"><b>Mi a közös bennük?</b>
          {shared.length ? <ul>{shared.map((s) => <li key={s.t}>{s.t}: <b>{s.k} a 3-ból</b>, a hét többi posztjának {fmt(n(s.o) * 100)}%-a</li>)}</ul> : <p>{rest.length ? "Nincs olyan közös vonás, ami a többi posztra ne lenne ugyanúgy jellemző." : "A héten nincs más poszt, amihez mérni lehetne."}</p>}
          <small>Pár posztból: irány, nem szabály.</small></div>
      </>}
    </Card>
  );
}

/* the best hour in one sentence, only when enough posts stand behind it: 15 on the platform, 5 in that hour, and it really stands out */
export function bestHour(cal: D[], vs: (p: D) => number | null) {
  const out: { p: string; hour: number; x: number; c: number }[] = [];
  for (const pf of SOC) {
    const ps = cal.filter((q) => q.platform === pf && q.created_at && vs(q) != null); if (ps.length < 15) continue;
    const g = new Map<number, number[]>(); ps.forEach((q) => { const h = bpParts(new Date(q.created_at)).hour; g.set(h, [...(g.get(h) || []), vs(q)!]); });
    const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const top = [...g.entries()].filter(([, v]) => v.length >= 5).map(([hour, v]) => ({ hour, x: med(v), c: v.length })).sort((a, b) => b.x - a.x)[0];
    if (top && top.x >= 1.2) out.push({ p: pf, ...top });
  }
  return out;
}
export function BestTime({ cal, extra }: { cal: D[]; extra?: string[] }) {
  const vs = useMemo(() => vsMedian(cal, cal), [cal]);
  const b = useMemo(() => bestHour(cal, vs), [cal, vs]);
  return (
    <Card className="s12" eager icon={P.clock} title="Mikor posztolj?" sub="Csak akkor mond időpontot, ha elég poszt áll mögötte: a platformon legalább 15, abban az órában legalább 5.">
      {b.length ? <ul className="wk-best">{b.map((x) => <li key={x.p}><Logo k={x.p} size={22} /><span><b>{PF[x.p]}: {x.hour}:00 körül</b> (budapesti idő) a szokásos {fmt(x.x, 1)}×-ese ment, {fmt(x.c)} posztból.</span></li>)}</ul>
        : <Empty t="Még nincs elég adat egy biztos időponthoz: egyik platformon sincs olyan óra, ahol legalább 5 posztból kiugró eredmény látszana." icon={P.clock} />}
      {extra?.map((t) => <p key={t} className="note">{t}</p>)}
    </Card>
  );
}

/* followers on one small curve per platform; a platform that gives no number says so */
export function Followers({ daily, accs }: { daily: D[]; accs: D[] }) {
  const rows = SOC.filter((p) => accs.some((a) => a.platform === p)).map((p) => { const a = daily.filter((x) => x.platform === p && x.followers != null); const l = a[a.length - 1];
    const t = l ? new Date(l.day).getTime() - 7 * 864e5 : 0; const w = l ? [...a].reverse().find((x) => new Date(x.day).getTime() <= t) : null;
    return { p, s: a.map((x) => n(x.followers)), now: l ? n(l.followers) : null, w: w ? n(w.followers) : null }; });
  if (!rows.length) return null;
  return (
    <Card className="s12" eager icon={P.users} title="Követők platformonként" sub="A kiválasztott időszak napjai. A változás az egy héttel korábbi számhoz mér.">
      <ul className="wk-fol">{rows.map((r) => <li key={r.p}><Logo k={r.p} size={22} /><b>{PF[r.p]}</b>{r.s.length > 1 ? <span className="wk-sp"><Spark values={r.s} h={26} color={chColor(r.p)} /></span> : <span className="wk-sp" />}<span className="wk-v">{r.now == null ? <small>nincs adat</small> : <><b>{big(r.now)}</b>{r.w != null ? <small><Delta now={r.now} prev={r.w} /></small> : <small>még nincs heti</small>}</>}</span></li>)}</ul>
    </Card>
  );
}

/* the competitors: the rows we really have, the same list as Áruházak; nothing invented when there are none */
export function CompetitorsWeek({ go }: { go: (t: "stores" | "brand") => void }) {
  const q = useRpc("admin_competitors", { p_country: null }, []);
  return (
    <Card className="s12" icon={P.target} title="Versenytársak a héten" sub="Áruházi értékelések száma az App Store nyilvános adataiból, egy héttel korábbihoz mérve. Közösségi számok a Márka oldalon, ha van felvett fiók.">
      <Async q={q} h={120}>{(d) => { const rows = ((Array.isArray(d) ? d : []) as D[]).filter((x) => !x.mine);
        return rows.length ? <><ul className="wk-comp">{rows.slice(0, 5).map((c) => <li key={c.app_id}><div><b>{c.name}</b><small>{c.rating != null ? `${fmt(n(c.rating), 1)} ★` : "nincs értékelés"}{c.version ? ` · v${c.version}` : ""}</small></div><span>{c.ratings == null ? <small>nincs adat</small> : <><b>{big(c.ratings)}</b>{c.ratings_week_ago != null ? <small>{n(c.ratings) - n(c.ratings_week_ago) >= 0 ? "+" : ""}{fmt(n(c.ratings) - n(c.ratings_week_ago))} a héten</small> : <small>még nincs heti</small>}</>}</span></li>)}</ul><button className="lnk" onClick={() => go("stores")}>Mind az Áruházak oldalon →</button></>
          : <Empty t="Még nincs versenytárs-adat: nincs felvett versenytárs, vagy még nem futott a napi lehúzás. Felvenni az Áruházak oldalon lehet." icon={P.target}><button className="adm-ibtn sm" onClick={() => go("stores")}>Áruházak</button></Empty>; }}</Async>
    </Card>
  );
}

/* ---------- small safe jobs, prepared from the data and done only when she approves them one by one ---------- */
type Sug = { key: string; t: string; why: string; ok: string; run: () => Promise<string | null> };
export function SuggestQueue({ cal, posts }: { cal: D[]; posts: D[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [no, setNo] = useSaved<string[]>("phone_queue_no", []);
  const [done, setDone] = useState<string[]>([]); const [busy, setBusy] = useState("");
  const day = (k: number) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
  const plans = useRpc("admin_plans", { p_from: day(-60), p_to: day(0) }, []);
  const media = useRpc("admin_plan_media_old", undefined, []);
  const inbox = useRpc("admin_inbox", { p_all: false }, []);
  const vs = useMemo(() => vsMedian(cal, cal), [cal]);
  const list: Sug[] = [];
  /* a plan that went out over a week ago can go to "Kiértékelve" (only its stage changes, nothing goes out) */
  ((Array.isArray(plans.d) ? plans.d : []) as D[]).filter((p) => p.status === "kint" && String(p.day) < day(-7)).slice(0, 5).forEach((p) => list.push({ key: "plan:" + p.id, t: `„${String(p.title).slice(0, 50)}”: kiértékeltnek jelölöm`, why: `Több mint egy hete kint van (${p.day}). Csak a terv állapota változik.`, ok: "Kiértékelve",
    run: async () => { const r = await rpc(sb, "admin_plan_save", { p: { ...p, status: "kiertekelve" } }); return r.error ? r.error.message : null; } }));
  /* files of posts that have been out for a week: the same cleaning as the planner's */
  const old = (Array.isArray(media.d) ? media.d : []) as D[];
  if (old.length) list.push({ key: "media:" + old.map((x) => x.id).join(","), t: `${fmt(old.length)} régi feltöltött fájl törlése a tárhelyről`, why: "A posztjaik több mint egy hete kint vannak. A kint lévő posztokat nem érinti.", ok: "Törlés",
    run: async () => { if (!MOCK) await sb?.storage.from("admin-media").remove(old.map((x) => x.path)); const r = await rpc(sb, "admin_plan_media_clear", { p_ids: old.map((x) => x.id) }); return r.error ? r.error.message : null; } });
  /* old praise needing no answer can leave the open list; nobody gets anything and it can be reopened */
  const praise = (((inbox.d as D)?.items || []) as D[]).filter((x) => !x.done && !x.reply && x.tag === "dicséret" && x.created_at && Date.now() - new Date(x.created_at).getTime() > 14 * 864e5);
  if (praise.length) list.push({ key: "praise:" + praise.map((x) => x.item_id).join(","), t: `${fmt(praise.length)} régi dicséret lezárása`, why: "Két hétnél régebbi, válasz nélküli dicséretek. Senki nem kap semmit, a Postafiókban visszanyitható.", ok: "Lezárás",
    run: async () => { const r = await rpc(sb, "admin_inbox_done_many", { p_items: praise.map((x) => ({ source: x.source, item_id: x.item_id })), p_done: true }); return r.error ? r.error.message : null; } });
  /* this week's strongest post with no trackable link: a link is prepared and copied, she puts it in the post herself */
  const strong = posts.filter((p) => p.created_at && !p.code && p.platform !== "pinterest" && Date.now() - new Date(p.created_at).getTime() < 7 * 864e5 && n(vs(p)) >= 1.5).sort((a, b) => n(vs(b)) - n(vs(a)))[0];
  if (strong) list.push({ key: "link:" + strong.platform + ":" + strong.post_id, t: `Rövid link ehhez: „${String(strong.title || "poszt").slice(0, 50)}”`, why: `A szokásos ${fmt(n(vs(strong)), 1)}×-ese ment, de nincs benne követhető link. A linket te teszed a posztba, innen nem kerül ki semmi.`, ok: "Elkészítem",
    run: async () => { const r = MOCK ? { data: "13", error: null } : await rpc(sb, "admin_link_for_post", { p_platform: strong.platform, p_post_id: strong.post_id }); if (r.error || !r.data) return r.error?.message || "Nem sikerült"; navigator.clipboard?.writeText(`inkage.app/go/${r.data}`).catch(() => {}); return null; } });
  const shown = list.filter((x) => !no.includes(x.key) && !done.includes(x.key));
  const yes = async (s: Sug) => { setBusy(s.key); const e = await s.run(); setBusy(""); if (e) { toast("Nem sikerült: " + e); return; } setDone((o) => [...o, s.key]); toast("Kész"); };
  return (
    <Card className="s12" icon={P.check} title="Javaslatok jóváhagyásra" sub="Kicsi, biztonságos feladatok az adataidból. Semmi nem történik magától: csak az fut le, amit jóváhagysz, és innen senkinek nem megy üzenet.">
      {shown.length ? <ul className="wk-q">{shown.map((s) => <li key={s.key}><b>{s.t}</b><small>{s.why}</small><div className="adm-row"><button className="adm-ibtn gold sm" disabled={busy === s.key} onClick={() => yes(s)}>{busy === s.key ? "Folyamatban…" : s.ok}</button><button className="adm-ibtn sm" onClick={() => setNo([...no, s.key].slice(-150))}>Nem kell</button></div></li>)}</ul>
        : <Empty t="Most nincs jóváhagyásra váró javaslat." icon={P.check} />}
    </Card>
  );
}

/* ---------- the week as one picture, shared only when she taps (a video would be too much for now) ---------- */
export function WeekCard() {
  const q = useRpc("admin_social", { p_days: 7 }, []);
  const el = useRef<HTMLElement>(null); const [busy, setBusy] = useState(false);
  const share = async () => {
    if (!el.current) return; setBusy(true);
    const blob = await cardImage(el.current); setBusy(false);
    if (!blob) { toast("A kép nem sikerült"); return; }
    if (MOCK) { (window as any).__weekImg = URL.createObjectURL(blob); toast("Kép elkészült"); return; }
    const name = `inkage-het-${new Date().toISOString().slice(0, 10)}.png`, file = new File([blob], name, { type: "image/png" });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch { return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast("Kép elmentve");
  };
  const d = (q.d || {}) as D, posts = (d.posts || []) as D[], G = (d.gained || {}) as D;
  const vs = vsMedian(posts, (d.cal || []) as D[]);
  const top = [...posts].filter((p) => vs(p) != null).sort((a, b) => n(vs(b)) - n(vs(a)))[0];
  const views = Object.keys(G).filter((p) => viewWord(p) === "megtekintés").reduce((t, p) => t + n(G[p]), 0);
  const visits = ((d.visits || []) as D[]).reduce((t, x) => t + SOC.reduce((s, p) => s + n(x[p]), 0), 0);
  return (
    <section className="c s12 wk-card" ref={el}>
      <div className="c-h"><div><div><h2>A hét egy képen</h2></div></div></div>
      {!q.d ? <div className="skel" style={{ height: 110 }} /> : <>
        <ul className="wk-nums"><li>Utolsó 7 nap</li><li><b>{fmt(posts.length)}</b> új poszt</li><li>{Object.keys(G).length ? <><b>{big(views)}</b> új megtekintés (a Pinterest és a LinkedIn megjelenései nélkül)</> : "Új megtekintés: nincs adat, a napi pillanatképek még nem érkeztek meg"}</li><li><b>{fmt(visits)}</b> látogató a közösségi oldalakról</li>{top ? <li>{`Legjobb poszt: ${String(top.title || PF[top.platform]).slice(0, 50)} (${PF[top.platform]}, a szokásos ${fmt(n(vs(top)), 1)}×-ese)`}</li> : null}</ul>
        <button className="adm-ibtn sm gold" disabled={busy} onClick={share}>{busy ? "Készül…" : "Kép megosztása"}</button></>}
    </section>
  );
}

/* the second tab of the page */
export function WeekTab({ posts, cal, daily, accs, open, go }: { posts: D[]; cal: D[]; daily: D[]; accs: D[]; open: (p: D) => void; go: (t: "stores" | "brand") => void }) {
  return (
    <div className="g">
      <WeekTop posts={posts} cal={cal} open={open} />
      <BestTime cal={cal} />
      <Followers daily={daily} accs={accs} />
      <CompetitorsWeek go={go} />
      <SuggestQueue posts={posts} cal={cal} />
      <Lazy h={160} kind="card"><WeekCard /></Lazy>
    </div>
  );
}
