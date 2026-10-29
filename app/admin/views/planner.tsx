"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmt } from "../charts";
import { Logo } from "../wow";
import { toast } from "../phone";
import { Card, I, Layer, MOCK, bpParts, P, PF, SOC, api, big, n, rpc, type D } from "../shared";
import { PfTabs, postTags, viewWord, vsMedian } from "./social";

/* ---------- the planner: what went out and what is coming, on one calendar; publishing from here ---------- */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/* the stages of a content, in order (the board's columns): from an idea to evaluated */
const STATUS: Record<string, [string, string]> = { otlet: ["Ötlet", "lilac"], forgatokonyv: ["Forgatókönyv", "lilac"], felvetel: ["Felvétel", "peach"], vagas: ["Vágás", "peach"], kesz: ["Elkészült", "butter"], terv: ["Ütemezve", "sky"], kint: ["Kint van", "mint"], kiertekelve: ["Kiértékelve", "mint"], hiba: ["Nem ment ki", "pink"] };
const DOWS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
/* what each platform takes: the text, and YouTube's title */
const MAXC: Record<string, number> = { tiktok: 2200, instagram: 2200, pinterest: 500, youtube: 4900, linkedin: 2900, facebook: 60000 };
const LINKLEN = "\n\ninkage.app/go/0000".length;

/* the kind of post a plan becomes on each platform (everything was taken for a video) */
const kindFor = (pf: string, media?: string | null) => pf === "tiktok" || pf === "youtube" ? "video" : pf === "instagram" ? (media === "video" ? "reel" : "image") : pf === "pinterest" ? "pin" : pf === "linkedin" ? (media ? "post" : "text") : media === "video" ? "video" : "post";

/* what a planned post can expect: the median of her posts on those platforms that share most of its tags */
export function forecastPlan(plan: D, posts: D[]) {
  const fake = { title: plan.title + " " + (plan.caption || ""), code: plan.code || (plan.autolink ? "x" : null), created_at: plan.day ? `${plan.day}T${plan.at || "18:00"}` : null };
  const out: { p: string; views: number; visits: number; n: number }[] = [];
  for (const pf of plan.platforms || []) {
    const kind = kindFor(pf, plan.media_kind);
    const all = posts.filter((q) => q.platform === pf && n(q.views) > 0);
    /* the same kind first (a reel is not measured by photos), if there are enough of them */
    const same = all.filter((q) => !q.kind || String(q.kind).toLowerCase().startsWith(kind.slice(0, 3)));
    const ps = same.length >= 3 ? same : all;
    if (ps.length < 3) continue;
    const tags = postTags({ ...fake, platform: pf, kind });
    const scored = ps.map((q) => ({ q, s: postTags(q).filter((t) => tags.includes(t)).length })).sort((a, b) => b.s - a.s);
    const like = scored.slice(0, Math.max(3, Math.ceil(scored.length / 3))).map((x) => x.q);
    const med = (a: number[]) => { const s2 = [...a].sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)] || 0; };
    const withLink = like.filter((q) => q.code && n(q.views) > 0);
    out.push({ p: pf, views: med(like.map((q) => n(q.views))), visits: withLink.length ? med(withLink.map((q) => (n(q.sessions) * 1000) / n(q.views))) * med(like.map((q) => n(q.views))) / 1000 : 0, n: like.length });
  }
  return out;
}

/* Instagram gives its followers' online hours in Pacific time: shifted to Budapest */
const ptShift = () => { try { const h = (tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date())); return (h("Europe/Budapest") - h("America/Los_Angeles") + 24) % 24; } catch { return 9; } };

export function Planner() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [view, setView] = useState<"month" | "week" | "board">("month"); const [off, setOff] = useState(0); const [pfF, setPfF] = useState("all");
  const base = new Date(); base.setHours(12, 0, 0, 0);
  let cells: (Date | null)[] = [], from = "", to = "", title = "";
  if (view === "board") {
    /* the board: two months back, four ahead, every plan in its stage */
    from = ymd(new Date(base.getFullYear(), base.getMonth() - 2, 1)); to = ymd(new Date(base.getFullYear(), base.getMonth() + 4, 0)); title = "Tartalom-tábla";
  } else if (view === "month") {
    base.setDate(1); base.setMonth(base.getMonth() + off);
    const y = base.getFullYear(), m = base.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    cells = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1))];
    from = ymd(new Date(y, m, 1)); to = ymd(new Date(y, m, days)); title = base.toLocaleDateString("hu-HU", { year: "numeric", month: "long" });
  } else {
    const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ((base.getDay() + 6) % 7) + off * 7);
    cells = Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    from = ymd(cells[0]!); to = ymd(cells[6]!); title = `${cells[0]!.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })} – ${cells[6]!.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;
  }
  const [plans, setPlans] = useState<D[]>([]); const [soc, setSoc] = useState<D | null>(null); const [gsc, setGsc] = useState<D | null>(null); const [aud, setAud] = useState<D[]>([]);
  const [cal, setCal] = useState<D | null>(null);
  const [edit, setEdit] = useState<D | null>(null); const [drag, setDrag] = useState<number | null>(null);
  const load = () => rpc(sb, "admin_plans", { p_from: from, p_to: to }).then(({ data }) => setPlans(Array.isArray(data) ? data : []));
  /* every post of the shown range (the social list stopped at 300 per platform, so older months were empty) */
  useEffect(() => { load(); rpc(sb, "admin_plan_posts", { p_from: from, p_to: to }).then(({ data }) => setCal(data || null)); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    rpc(sb, "admin_social", { p_days: 365 }).then(({ data }) => setSoc(data || null)); rpc(sb, "admin_search", { p_days: 28 }).then(({ data }) => setGsc(data || null));
    rpc(sb, "admin_audience").then(({ data }) => setAud(((data as D)?.demo || []) as D[]));
  }, [sb]);
  const posts: D[] = (soc?.posts || []) as D[];
  const calPosts: D[] = ((cal?.posts || (cal ? [] : posts)) as D[]).filter((p) => pfF === "all" || p.platform === pfF);
  const byDay = (k: string) => calPosts.filter((p) => p.created_at && ymd(new Date(p.created_at)) === k);
  const plansOn = (k: string) => plans.filter((p) => p.day === k && (pfF === "all" || (p.platforms || []).includes(pfF)));
  const today = ymd(new Date());
  const accs: D[] = (soc?.accounts || []) as D[];
  /* the median from every post (the calendar's list), so the ideas do not change with the period; posts under a day old get none */
  const vs = useMemo(() => vsMedian(posts, (soc?.cal || []) as D[]), [posts, soc]);

  /* the best posting times from her own posts (each against its platform's median), at least two posts in a slot; and when her Instagram followers are online */
  const best = useMemo(() => {
    const out: { p: string; when: string; x: number; src: string }[] = [];
    for (const pf of SOC) {
      const ps = posts.filter((q) => q.platform === pf && q.created_at && vs(q) != null);
      if (ps.length < 4) continue;
      const g = new Map<string, number[]>();
      ps.forEach((q) => { const b = bpParts(new Date(q.created_at)), k = `${DOWS[b.dow - 1]} ${b.hour}:00`; g.set(k, [...(g.get(k) || []), vs(q)!]); });
      const med = (a: number[]) => { const s2 = [...a].sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)]; };
      const top = [...g.entries()].filter(([, v]) => v.length >= 2).map(([k, v]) => ({ k, x: med(v), c: v.length })).sort((a, b) => b.x - a.x)[0];
      if (top) out.push({ p: pf, when: top.k, x: top.x, src: `${top.c} posztból` });
    }
    const on = aud.filter((x) => x.platform === "instagram" && x.breakdown === "online").sort((a, b) => n(b.n) - n(a.n))[0];
    if (on) out.push({ p: "instagram", when: `naponta ${(Number(on.k) + ptShift()) % 24}:00`, x: 0, src: "követőid ekkor vannak fent (budapesti idő)" });
    return out;
  }, [posts, aud, vs]);

  /* ideas: the tags that do best against each platform's own median (one scale), searches nearly on Google's first
     page, new searches, titles that get seen but not clicked, and the competitors' new pages */
  const IDEA: Record<string, string> = { "Előtte–utána": "Előtte–utána: a tetoválás ma és 50 év múlva", "Kérdéssel indul": "Kérdéssel induló videó: „Hogy néz ki a tetoválásod 30 év múlva?”", "Számmal / listával": "Lista: 3 stílus, ami szépen öregszik", "Pontszám a horog": "„Megéri ez a tetoválás?” videó", "15 mp alatt": "15 mp alatti gyors videó", "Van rövid link": "Videó rövid linkkel a leírásban", Reels: "Reels: a tetoválás öregedése 10, 30, 50 év", Körhinta: "Körhinta: 5 testrész, ugyanaz a minta" };
  const tagIdeas = useMemo(() => {
    const ps = posts.filter((p) => vs(p) != null); if (ps.length < 4) return [];
    const mm = new Map<string, number[]>();
    ps.forEach((p) => postTags(p).forEach((tg) => { if (IDEA[tg]) mm.set(tg, [...(mm.get(tg) || []), vs(p)!]); }));
    /* a tag on every post has nothing to be compared with (the Tartalom page's "Mi működik?" leaves it out too) */
    return [...mm].filter(([, v]) => v.length >= 2 && v.length < ps.length).map(([k, v]) => ({ k, x: v.reduce((a, b) => a + b, 0) / v.length })).filter((x) => x.x >= 1.2).sort((a, b) => b.x - a.x).slice(0, 4);
  }, [posts, vs]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = [...tagIdeas.map((t) => ({ t: IDEA[t.k], why: `a „${t.k}” posztjaid ${fmt(t.x, 1)}× annyit hoznak, mint a platformjuk szokásos posztja`, src: "Mi működik" })),
    ...((gsc?.near || []) as D[]).slice(0, 4).map((q) => ({ t: `Videó / cikk: „${q.query}”`, why: `${fmt(q.impressions)} megjelenés a Google-ben, ${fmt(n(q.pos), 1)}. hely: egy lépés az első oldalig`, src: "Google" })),
    ...((gsc?.new_queries || []) as D[]).slice(0, 3).map((q) => ({ t: `Új keresés: „${q.query}”`, why: `a héten kezdték keresni (${fmt(q.impressions)} megjelenés)`, src: "Google" })),
    ...((gsc?.low_ctr || []) as D[]).slice(0, 3).map((q) => ({ t: `Jobb cím ehhez: „${q.query}”`, why: `${fmt(q.impressions)}-szor látták, alig kattintottak: a cím vagy a leírás nem hívogató`, src: "Google" })),
    ...((cal?.competitor || []) as D[]).slice(0, 4).map((c) => ({ t: `Saját szemmel: „${String(c.title).slice(0, 70)}”`, why: `${c.domain} új oldala (${new Date(c.first_seen).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })})`, src: "Versenytárs" }))];
  const save = async (p: D) => { const r = await rpc(sb, "admin_plan_save", { p }); if (r.error) { toast(r.error.message); return null; } setEdit(null); toast(p.publish ? "Mentve: a megadott időben kimegy" : "Mentve"); load(); return r.data as D; };
  /* the plan's uploaded file goes with it */
  const del = async (p: D) => {
    if (!confirm("Törlöd a tervet?")) return;
    await rpc(sb, "admin_plan_delete", { p_id: p.id });
    if (p.media_path && !MOCK) await sb?.storage.from("admin-media").remove([p.media_path]);
    setEdit(null); toast("Törölve"); load();
  };
  const cleanMedia = async () => {
    const { data } = await rpc(sb, "admin_plan_media_old"); const l = Array.isArray(data) ? (data as D[]) : [];
    if (!l.length) { toast("Nincs régi feltöltött fájl"); return; }
    if (!confirm(`${l.length} régi fájl törlése a tárhelyről (a posztok egy hete kint vannak)?`)) return;
    if (!MOCK) await sb?.storage.from("admin-media").remove(l.map((x) => x.path));
    await rpc(sb, "admin_plan_media_clear", { p_ids: l.map((x) => x.id) }); toast(`${l.length} fájl törölve`); load();
  };
  const move = async (id: number, day: string) => { setPlans((o) => o.map((p) => (p.id === id ? { ...p, day } : p))); const r = await rpc(sb, "admin_plan_move", { p_id: id, p_day: day }); if (r.error) toast(r.error.message); else toast("Áttéve"); load(); };
  /* a new plan goes to the connected platforms (it was always TikTok and Instagram) */
  const conn = SOC.filter((k) => accs.some((a) => a.platform === k));
  const blank = (day: string, extra: D = {}) => ({ day, platforms: conn.length ? conn.slice(0, 3) : ["tiktok", "instagram"], status: "terv", title: "", autolink: true, ...extra });
  const pfsHere = SOC.filter((k) => posts.some((p) => p.platform === k) || plans.some((p) => (p.platforms || []).includes(k)));
  const maxShow = view === "week" ? 8 : 3;
  return (
    <div className="g">
      <Card className="s12 plan-card" icon={P.calendar} title={title} sub="A megjelent posztok (a platformok adataiból, a hónap minden posztja) és a terveid egy naptárban. Kattints egy napra: új terv, vagy az aznapi posztok. Egy tervet áthúzhatsz egy másik napra. Ha egy tervnél bekapcsolod a közzétételt, a megadott időben innen megy ki."
        right={<div className="adm-row" style={{ gap: 6 }}>
          <div className="adm-seg sm"><button aria-pressed={view === "month"} onClick={() => { setView("month"); setOff(0); }}>Hónap</button><button aria-pressed={view === "week"} onClick={() => { setView("week"); setOff(0); }}>Hét</button><button aria-pressed={view === "board"} onClick={() => { setView("board"); setOff(0); }}>Tábla</button></div>
          <button className="adm-ibtn sm" onClick={() => setOff(off - 1)}>←</button><button className="adm-ibtn sm" onClick={() => setOff(0)}>Ma</button><button className="adm-ibtn sm" onClick={() => setOff(off + 1)}>→</button>
          <button className="adm-ibtn gold sm" onClick={() => setEdit(blank(today))}>{I(P.plus)}Új terv</button></div>}>
        <PfTabs pfs={pfsHere} v={pfF} set={setPfF} />
        {view === "board" ? <Board plans={plans.filter((p) => pfF === "all" || (p.platforms || []).includes(pfF))} open={setEdit} setStatus={async (p, st) => { setPlans((o) => o.map((x) => (x.id === p.id ? { ...x, status: st } : x))); await save({ ...p, status: st }); }} add={(st) => setEdit(blank(today, { status: st }))} /> : <>
        <div className={"plan-g" + (view === "week" ? " week" : "")}>
          {DOWS.map((x) => <span key={x} className="plan-d">{x}</span>)}
          {cells.map((c, i) => {
            if (!c) return <span key={"e" + i} />;
            const k = ymd(c), ps = byDay(k), pl = plansOn(k), extra = ps.length - maxShow;
            return (
              <button key={k} className={"plan-c" + (k === today ? " today" : "") + (k < today ? " past" : "") + (drag != null ? " drop" : "")} onClick={() => setEdit(blank(k, { _posts: ps }))}
                onDragOver={(e) => { if (drag != null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag != null) move(drag, k); setDrag(null); }}>
                <span className="plan-n">{c.getDate()}{view === "week" ? " " + c.toLocaleDateString("hu-HU", { month: "short" }) : ""}</span>
                {ps.slice(0, maxShow).map((p) => <span key={p.platform + p.post_id} className="plan-post"><Logo k={p.platform} size={14} />{big(p.views)}</span>)}
                {extra > 0 && <span className="plan-more" onClick={(e) => { e.stopPropagation(); setEdit(blank(k, { _posts: ps })); }}>+{extra} poszt</span>}
                {pl.map((p) => <span key={p.id} className={"plan-plan t-" + (STATUS[p.status]?.[1] || "sky")} draggable={!p.published_at} onDragStart={(e) => { e.stopPropagation(); setDrag(p.id); }} onDragEnd={() => setDrag(null)}
                  onClick={(e) => { e.stopPropagation(); setEdit(p); }} title={`${STATUS[p.status]?.[0] || p.status}: ${p.title}`}>{p.publish ? "⏱ " : ""}{p.at ? String(p.at).slice(0, 5) + " " : ""}{p.title}</span>)}
              </button>
            );
          })}
        </div></>}
        <div className="plan-legend"><span><i className="pl-post" />megjelent poszt ({viewWord("tiktok")}, Pinterest/LinkedIn: megjelenés)</span>{Object.entries(STATUS).map(([k, [l, tone]]) => <span key={k}><i className={"t-" + tone} />{l}</span>)}<span>⏱ innen megy ki</span>
          <button className="lnk" onClick={cleanMedia}>Régi feltöltött fájlok törlése</button></div>
      </Card>
      <Card className="s6" icon={P.clock} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Legjobb időpont platformonként" sub="A saját posztjaidból: melyik nap és óra hozta a legtöbbet a platform szokásos posztjához képest (legalább 4 poszt platformonként, és legalább 2 ugyanabban az időpontban, hogy egy szerencsés poszt ne döntsön); Instagramon azt is, mikor vannak fent a követőid, budapesti időre átszámolva.">
        {best.length ? <ul className="best-l">{best.map((b, i) => <li key={b.p + i}><Logo k={b.p} size={28} /><b>{PF[b.p]}</b><span>{b.when}</span><em>{b.x ? `${fmt(b.x, 1)}× a szokásos · ${b.src}` : b.src}</em></li>)}</ul>
          : <p className="note">Még kevés a poszt: platformonként 4 kell, és egy időpontban legalább 2, hogy legyen mihez mérni.</p>}
      </Card>
      <Card className="s6" icon={P.spark} title="Ötletbank" sub="A „Mi működik?” címkéidből (a platform saját mediánjához mérve, így a platformok egy mércén vannak), a majdnem első oldalas, az új és a gyenge kattintású Google-keresésekből, és a versenytársak új oldalaiból. Kattints: tervbe veszi.">
        <AiIdeas posts={posts} gsc={gsc} add={(t) => setEdit(blank(today, { status: "otlet", title: t.slice(0, 200), autolink: false }))} />
        {ideas.length ? <ul className="idea-l">{ideas.map((x) => <li key={x.t}><div><b>{x.t}</b><small>{x.src} · {x.why}</small></div><button className="adm-ibtn sm" onClick={() => setEdit(blank(today, { status: "otlet", title: x.t.slice(0, 200), autolink: false }))}>Tervbe</button></li>)}</ul>
          : <p className="note">A posztjaid címkéiből, a Google-adatokból és a versenytársakból itt jelennek meg az ötletek.</p>}
      </Card>
      {edit && <PlanSheet p={edit} posts={posts} accs={accs} close={() => setEdit(null)} save={save} del={del} reload={load} />}
    </div>
  );
}

function PlanSheet({ p, posts, accs, close, save, del, reload }: { p: D; posts: D[]; accs: D[]; close: () => void; save: (p: D) => Promise<D | null>; del: (p: D) => void; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [v, setV] = useState<D>({ ...p, texts: { ...(p.texts || {}) }, opts: { ...(p.opts || {}) } });
  const [up, setUp] = useState(""); const [busy, setBusy] = useState(false); const [own, setOwn] = useState(Object.keys(p.texts || {}).length > 0);
  const set = (o: D) => setV((x) => ({ ...x, ...o }));
  /* the AI writes a text and hashtags for every chosen platform, from the topic and her best posts' words */
  const [cap, setCap] = useState("");
  const suggest = async () => {
    const pfs: string[] = v.platforms?.length ? v.platforms : ["tiktok", "instagram"];
    setCap("Írom…");
    const best = [...posts].filter((x) => x.title && x.views != null).sort((a, b) => n(b.views) - n(a.views)).slice(0, 8).map((x) => ({ platform: x.platform, szoveg: String(x.title).slice(0, 160), megtekintes: x.views }));
    const r = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "caption", data: { tema: v.title, mostani_szoveg: v.caption || null, platformok: pfs, legjobb_posztok: best } }) });
    if (!r.ok || !r.json?.text) { setCap(r.json?.error || "Nem sikerült."); return; }
    try {
      const arr = JSON.parse(String(r.json.text).replace(/^[^[]*/, "").replace(/[^\]]*$/, "")) as { pf: string; text: string; tags?: string[] }[];
      const texts: Record<string, string> = {}; arr.forEach((x) => { if (pfs.includes(x.pf)) texts[x.pf] = `${x.text}${x.tags?.length ? "\n\n" + x.tags.join(" ") : ""}`; });
      const first = texts[pfs[0]] || Object.values(texts)[0] || "";
      set({ caption: v.caption || first, texts: { ...(v.texts || {}), ...texts } }); setOwn(true); setCap("Kész: platformonként külön szöveg lent. Szerkeszd nyugodtan.");
    } catch { set({ caption: v.caption || String(r.json.text) }); setCap("Kész."); }
  };
  const dayPosts: D[] = p._posts || [];
  const fc = forecastPlan(v, posts);
  /* can it go out: the write permission, and a connection that works and has not expired */
  const pubState = (pf: string): [boolean, string] => {
    const a = accs.find((x) => x.platform === pf);
    if (!a) return [false, "nincs bekötve"];
    if (!/publish|content_publish|manage_posts|pins:write|w_organization_social|youtube\.upload|video\.publish/.test(String(a.scopes || ""))) return [false, "kell a „Publikálás bekapcsolása” a Kapcsolatok oldalon"];
    if (a.last_error) return [false, "a kapcsolat hibára fut: kösd be újra"];
    const exp = a.refresh_expires_at || (pf === "linkedin" ? a.token_expires_at : null);
    if (exp && new Date(exp).getTime() < Date.now()) return [false, "a kapcsolat lejárt: kösd be újra"];
    return [true, "mehet"];
  };
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const kind = f.type.startsWith("video") ? "video" : f.type.startsWith("image") ? "image" : null;
    if (!kind) { toast("Kép vagy videó kell."); return; }
    if (MOCK) { set({ media_url: URL.createObjectURL(f), media_kind: kind, media_path: "minta/" + f.name }); return; }
    setUp("Feltöltés…");
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${(f.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase()}`;
    const { error } = await sb!.storage.from("admin-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) { setUp(""); toast(error.message.includes("size") ? "A fájl túl nagy a tárhelyhez." : error.message); return; }
    /* the file it replaces is removed (it stayed in the bucket for ever) */
    if (v.media_path && v.media_path !== p.media_path && !String(v.media_path).startsWith("minta/")) await sb!.storage.from("admin-media").remove([v.media_path]);
    set({ media_url: sb!.storage.from("admin-media").getPublicUrl(path).data.publicUrl, media_kind: kind, media_path: path }); setUp("");
  };
  const textOf = (pf: string) => (own && v.texts?.[pf]?.trim() ? v.texts[pf] : v.caption || v.title || "");
  const over = (v.platforms || []).filter((pf: string) => MAXC[pf] && textOf(pf).length + (v.code || v.autolink ? LINKLEN : 0) > MAXC[pf]);
  const ytLong = (v.platforms || []).includes("youtube") && String(v.opts?.yt_title || v.title || "").length > 100;
  const publishNow = async () => {
    if (over.length || ytLong) { toast("Túl hosszú szöveg: " + [...over.map((k: string) => PF[k]), ...(ytLong ? ["YouTube-cím"] : [])].join(", ")); return; }
    /* it goes out publicly at once, everywhere selected: asked first, with the platforms and the text */
    const pfs = (v.platforms || []) as string[];
    if (!confirm(`Most kimegy nyilvánosan ide: ${pfs.map((k) => PF[k] || k).join(", ")}\n\n${pfs.map((k) => `${PF[k] || k}: ${String(textOf(k) || "").slice(0, 160)}`).join("\n")}\n\nKözzéteszed?`)) return;
    setBusy(true);
    const saved = await save({ ...v, _posts: undefined, publish: true, texts: own ? v.texts : {} }) || v;
    const r = MOCK ? { ok: true, json: { results: Object.fromEntries((v.platforms || []).map((x: string) => [x, { ok: true }])), status: "kint" } } : await api("/api/admin/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: saved }) });
    setBusy(false);
    if (r.json?.busy) { toast(r.json.error); reload(); return; }
    const res = (r.json?.results || {}) as Record<string, D>, okN = Object.values(res).filter((x) => x.ok).length, all = Object.keys(res).length;
    /* one clear line: did it go out, and where not */
    const head = r.json?.status === "kint" ? (okN === all ? "Kint van mindenhol" : `Kint van ${okN} / ${all} helyen`) : r.json?.status === "hiba" ? "Nem ment ki" : r.json?.status === "folyamatban" ? "Folyamatban (az Instagram még feldolgozza)" : r.ok ? "Kész" : r.json?.error || "Nem sikerült";
    const bad = Object.entries(res).filter(([, x]) => !x.ok).map(([k, x]) => `${PF[k] || k}: ${x.pending ? "feldolgozás…" : x.error || "–"}`);
    const note = Object.entries(res).filter(([, x]) => x.ok && x.error).map(([k, x]) => `${PF[k] || k}: ${x.error}`);
    toast([head, ...bad, ...note].join(" · "));
    reload();
  };
  const results = Object.entries((v.results || {}) as Record<string, D>);
  /* the plan that went out against the forecast: the posts it became (by their id or their short link) */
  const real = (v.platforms || []).map((pf: string) => { const id = v.results?.[pf]?.id, code = v.codes?.[pf] || v.code; const q = posts.find((x) => x.platform === pf && ((id && String(x.post_id) === String(id)) || (code && x.code === code))); return q ? { pf, q, f: fc.find((y) => y.p === pf) } : null; }).filter(Boolean) as { pf: string; q: D; f?: { views: number; visits: number } }[];
  const codes = Object.entries((v.codes || {}) as Record<string, string>);
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Terv">
        <div className="c-h"><div><div><span className="eyebrow">{new Date(v.day + "T12:00").toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}</span><h2 style={{ fontSize: 20, marginTop: 6 }}>{v.id ? "Terv" : "Új terv"}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        {dayPosts.length > 0 && <div className="plan-day">{dayPosts.map((q) => <a key={q.platform + q.post_id} href={q.url} target="_blank" rel="noreferrer"><Logo k={q.platform} size={22} /><span>{(q.title || "poszt").slice(0, 60)}</span><b>{big(q.views)}</b></a>)}</div>}
        <label className="lf"><span>Cím / téma</span><input className="adm-in" value={v.title || ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="pl. 3 fine line minta, ami szépen öregszik" /></label>
        <div className="form-2"><label className="lf"><span>Nap</span><input className="adm-in" type="date" value={v.day} onChange={(e) => set({ day: e.target.value })} /></label>
          <label className="lf"><span>Időpont</span><input className="adm-in" type="time" value={v.at ? String(v.at).slice(0, 5) : ""} onChange={(e) => set({ at: e.target.value })} /></label></div>
        <div className="lf"><span>Platformok</span><div className="pf-pick">{SOC.map((s) => <button key={s} type="button" aria-pressed={(v.platforms || []).includes(s)} onClick={() => set({ platforms: (v.platforms || []).includes(s) ? v.platforms.filter((x: string) => x !== s) : [...(v.platforms || []), s] })}><Logo k={s} size={20} />{PF[s]}</button>)}</div></div>
        <div className="lf"><span>Állapot</span><div className="adm-seg sm">{Object.entries(STATUS).filter(([k]) => k !== "hiba" || v.status === "hiba").map(([k, [l]]) => <button key={k} aria-pressed={v.status === k} onClick={() => set({ status: k })}>{l}</button>)}</div></div>
        <div className="adm-row"><button type="button" className="adm-ibtn sm" onClick={suggest} disabled={!String(v.title || "").trim() || cap === "Írom…"}>{I(P.spark)}Szöveg és hashtagek MI-vel</button>{cap && <span className="note">{cap}</span>}</div>
        <label className="lf"><span>Szöveg (leírás, hashtagek)</span><textarea className="adm-in" rows={4} value={v.caption || ""} onChange={(e) => set({ caption: e.target.value })} /></label>
        {/* every platform's limit, counted with the short link that goes after the text */}
        <div className="plan-cnt">{(v.platforms || []).filter((pf: string) => MAXC[pf]).map((pf: string) => { const L = textOf(pf).length + (v.code || v.autolink ? LINKLEN : 0); return <span key={pf} className={L > MAXC[pf] ? "bad" : L > MAXC[pf] * 0.9 ? "warn" : ""}><Logo k={pf} size={14} />{fmt(L)} / {fmt(MAXC[pf])}</span>; })}</div>
        <label className="ck-row"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />Külön szöveg platformonként</label>
        {own && (v.platforms || []).map((pf: string) => <label key={pf} className="lf"><span>{PF[pf]}: saját szöveg{MAXC[pf] ? ` (max. ${fmt(MAXC[pf])})` : ""}</span><textarea className="adm-in" rows={2} value={v.texts?.[pf] || ""} placeholder={v.caption || ""} onChange={(e) => set({ texts: { ...(v.texts || {}), [pf]: e.target.value } })} /></label>)}
        {(v.platforms || []).includes("youtube") && <label className="lf"><span>YouTube-cím (max. 100){String(v.opts?.yt_title || v.title || "").length > 100 ? " · túl hosszú" : ""}</span><input className="adm-in" maxLength={100} value={v.opts?.yt_title || ""} placeholder={String(v.title || "").slice(0, 100)} onChange={(e) => set({ opts: { ...(v.opts || {}), yt_title: e.target.value } })} /></label>}
        <label className="lf"><span>Rövid link (inkage.app/go/…)</span><input className="adm-in" value={codes.length ? "" : v.code || ""} onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""), codes: {} })} placeholder={codes.length ? "platformonként külön link (lent)" : v.status === "otlet" ? "ötletnél még nincs link" : v.autolink ? "mentéskor platformonként a következő szabad szám" : "pl. 14"} /></label>
        {codes.length > 0 && <div className="plan-codes">{codes.map(([pf, c]) => <span key={pf} className="chip"><Logo k={pf} size={14} />inkage.app/go/{c}</span>)}</div>}
        {!v.code && !codes.length && v.status !== "otlet" && <label className="ck-row"><input type="checkbox" checked={!!v.autolink} onChange={(e) => set({ autolink: e.target.checked })} />Rövid link automatikusan, platformonként külön (így látszik, melyik platform hozta a látogatót; a szöveg végére is odakerül)</label>}
        {fc.length > 0 && <div className="plan-fc"><span className="eyebrow">Várható a hasonló posztjaid alapján</span>{fc.map((x) => <div key={x.p}><Logo k={x.p} size={18} /><b>~{big(x.views)}</b> {viewWord(x.p)}{x.visits ? <> · <b>~{fmt(x.visits)}</b> látogató</> : null}<small>{x.n} hasonló {kindFor(x.p, v.media_kind)} mediánja</small></div>)}</div>}
        {real.length > 0 && <div className="plan-fc real"><span className="eyebrow">Várható és valós</span>{real.map(({ pf, q, f }) => <div key={pf}><Logo k={pf} size={18} /><b>{big(q.views)}</b> {viewWord(pf)}{f ? <> · várható ~{big(f.views)} ({fmt((n(q.views) / Math.max(1, f.views)) * 100)}%)</> : null}{q.code ? <> · {fmt(q.sessions)} látogató</> : null}</div>)}</div>}
        <div className="lf"><span>Kép vagy videó a közzétételhez</span>
          <div className="adm-row"><span className="conn-file"><input type="file" accept="video/*,image/*" onChange={pick} /><span>{v.media_url ? "Csere" : "Fájl kiválasztása"}</span></span>{up && <span className="note">{up}</span>}
            {v.media_url && (v.media_kind === "video" ? <video src={v.media_url} className="plan-media" muted playsInline controls /> : <img src={v.media_url} alt="" className="plan-media" />)}</div></div>
        <label className="ck-row"><input type="checkbox" checked={!!v.publish} onChange={(e) => set({ publish: e.target.checked })} />Közzététel innen a megadott időben (10 percen belül)</label>
        {v.publish && <ul className="pub-l">{(v.platforms || []).map((pf: string) => { const [ok, why] = pubState(pf); return <li key={pf}><Logo k={pf} size={18} />{PF[pf]}: <span className={"chip " + (ok ? "good" : "warn")}>{why}</span></li>; })}</ul>}
        {results.length > 0 && <ul className="pub-l">{results.map(([pf, r]) => <li key={pf}><Logo k={pf} size={18} />{PF[pf]}: {r.ok ? <span className="chip good">✓ kint{r.error ? " · " + r.error : ""}</span> : r.pending ? <span className="chip">feldolgozás…</span> : <span className="chip bad">{r.error}</span>}</li>)}</ul>}
        <div className="adm-row">
          <button className="adm-ibtn gold" onClick={() => save({ ...v, _posts: undefined, texts: own ? v.texts : {} })} disabled={!String(v.title || "").trim()}>Mentés</button>
          {v.media_url || v.caption ? <button className="adm-ibtn" onClick={publishNow} disabled={busy || !String(v.title || "").trim() || !(v.platforms || []).length || v.status === "kint"}>{busy ? "Küldés…" : v.status === "hiba" ? "Újraküldés" : "Közzététel most"}</button> : null}
          {v.id && <button className="adm-ibtn" onClick={() => del(v)}>Törlés</button>}
          {v.caption && <button className="adm-ibtn" onClick={() => { const c0 = (v.platforms || [])[0]; navigator.clipboard?.writeText(`${textOf(c0)}${v.codes?.[c0] || v.code ? `\ninkage.app/go/${v.codes?.[c0] || v.code}` : ""}`); toast("Szöveg másolva"); }}>Szöveg másolása</button>}
        </div>
        <p className="note">A terv a reggeli összefoglalóban is megjelenik azon a napon. Közzétételhez a platformot a Kapcsolatok oldalon „Publikálás bekapcsolása” gombbal egyszer újra kell kötni (írási engedély). TikTokon a TikTok auditjáig a videó privátként megy ki; LinkedInen szövegként; YouTube-on nyilvánosként, a borítóképet a YouTube választja.</p>
      </aside>
    </Layer>
  );
}

/* ---------- the content board: one column per stage, drag a card to move it on ---------- */
function Board({ plans, open, setStatus, add }: { plans: D[]; open: (p: D) => void; setStatus: (p: D, st: string) => void; add: (st: string) => void }) {
  const [drag, setDrag] = useState<number | null>(null); const [over, setOver] = useState<string | null>(null);
  return (
    <div className="kb">{Object.entries(STATUS).map(([k, [l, tone]]) => { const col = plans.filter((p) => (p.status || "terv") === k).sort((a, b) => String(a.day).localeCompare(String(b.day)));
      return (
        <section key={k} className={"kb-c" + (over === k ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setOver(k); }} onDragLeave={() => setOver(null)}
          onDrop={() => { const p = plans.find((x) => x.id === drag); setOver(null); setDrag(null); if (p && p.status !== k) setStatus(p, k); }}>
          <h4><span className={"kb-dot t-" + tone} />{l}<small>{col.length}</small></h4>
          {col.map((p) => (
            <button key={p.id} className="kb-i" draggable onDragStart={() => setDrag(p.id)} onClick={() => open(p)}>
              <b>{p.title || "(nincs cím)"}</b>
              <span>{new Date(p.day + "T12:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}{p.at ? " " + String(p.at).slice(0, 5) : ""} · {(p.platforms || []).map((x: string) => <Logo key={x} k={x} size={13} />)}</span>
            </button>))}
          <button className="kb-add" onClick={() => add(k)}>+ Új</button>
        </section>); })}</div>
  );
}

/* ---------- 10 video ideas from the AI, built on what works (her best and weakest posts, Google searches) ---------- */
function AiIdeas({ posts, gsc, add }: { posts: D[]; gsc: D | null; add: (t: string) => void }) {
  const [l, setL] = useState<D[] | null>(null); const [msg, setMsg] = useState("");
  const go = async () => {
    setMsg("Gondolkodom…"); setL(null);
    const vs = vsMedian(posts, posts), rated = posts.filter((p) => p.title && vs(p) != null).sort((a, b) => n(vs(b)) - n(vs(a)));
    const data = { legjobb: rated.slice(0, 8).map((p) => ({ platform: p.platform, cim: String(p.title).slice(0, 120), szorzo: Number(vs(p)!.toFixed(2)) })), leggyengebb: rated.slice(-5).map((p) => ({ platform: p.platform, cim: String(p.title).slice(0, 120), szorzo: Number(vs(p)!.toFixed(2)) })),
      keresesek: ((gsc?.queries || []) as D[]).slice(0, 15).map((q) => ({ kifejezes: q.query || q.k, megjelenes: q.impressions })) };
    const r = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ideas", data }) });
    if (!r.ok || !r.json?.text) { setMsg(r.json?.error || "Nem sikerült."); return; }
    try { setL(JSON.parse(String(r.json.text).replace(/^[^[]*/, "").replace(/[^\]]*$/, ""))); setMsg(""); } catch { setMsg(String(r.json.text).slice(0, 600)); }
  };
  return (
    <div className="ai-ideas">
      <button className="adm-ibtn sm" onClick={go} disabled={msg === "Gondolkodom…"}>{I(P.spark)}10 új videóötlet MI-vel</button>{msg && <span className="note"> {msg}</span>}
      {l && <ul className="idea-l">{l.map((x, i) => <li key={i}><div><b>{x.title}</b><small>Horog: „{x.hook}” · {x.why}{Array.isArray(x.pf) ? " · " + x.pf.map((k: string) => PF[k] || k).join(", ") : ""}</small></div><button className="adm-ibtn sm" onClick={() => add(String(x.title))}>Tervbe</button></li>)}</ul>}
    </div>
  );
}
