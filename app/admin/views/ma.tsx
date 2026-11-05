"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* The phone's "Ma": one sentence and a lamp on top, today's numbers against the same moment yesterday and a week ago,
   the one main task, what is unusual, the day's timeline. Every number opens: where it comes from, how sure, row by row.
   Computers keep the Home page; this is drawn only on the phone. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Num, TrendChart, fmt, pct, type Mark } from "../charts";
import { ChartBox, MultiLine, PlatformToday, PushPrompt, PushSheet, Spikes, WeekPlan, explain } from "../extra";
import { Logo, streakOf } from "../wow";
import { Field, MorningStory, Sheet, SwipeRow, haptic, toast, type StoryCard } from "../phone";
import { Chg, DayStrip, Giant, Ring, Sig, SigLine, Trio, useRecentSigs } from "../ink";
import { useSigUrls } from "./people";
import { CH, GOAL, GOAL_M, I, LANGS, MOCK, NOTE_KIND, P, PF, SRC_L, ago, api, ch, chList, lang, n, periodName, rpc, type D, type Tab, useFlt, useRpc, useSaved } from "../shared";
import { PostCard, PostDrawer } from "./social";
import { UserDrawer } from "./users";
import { huOn, noEmoji } from "./alerts";
import { Ask } from "./ask";
import { ImpStrip, LangCards, NOSRC, dayStories } from "./home";
import { useSrcs, type TodoItem, type TodoState } from "./todo";

const sb = () => supabaseBrowser();
const hu = (t: string | Date, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleString("hu-HU", o);
const hhmm = (t: string) => hu(t, { hour: "2-digit", minute: "2-digit" });

/* ---------- every number on this tab: how sure it is, where it comes from, and where its rows are ---------- */
type NK = "made" | "sessions" | "signups" | "shared" | "saved";
type Rel = "pontos" | "becslés" | "nem teljes";
const NUMS: { k: NK; l: string; to: Tab; rel: Rel; src: string; live: string }[] = [
  { k: "made", l: "Elkészült előnézet", to: "product", rel: "pontos", live: "élő", src: "A fiókok saját adatából: minden sikeresen elkészült MI-előnézet, minden eszközről (iPhone is), a saját fiókjaid nélkül." },
  { k: "sessions", l: "Látogatás", to: "traffic", rel: "becslés", live: "élő, de még szűrődik", src: "A weboldal és az Android-app névtelen méréséből. Az iPhone-app szándékosan nem küld adatot, ezért az nincs benne. A gépi látogatásokat becsléssel, óránként szűrjük ki, így a mai szám még csökkenhet." },
  { k: "signups", l: "Új fiók", to: "users", rel: "pontos", live: "élő", src: "A regisztrációkból, minden eszközről, a saját és a teszt-fiókjaid nélkül." },
  { k: "shared", l: "Megosztás", to: "viral", rel: "nem teljes", live: "élő", src: "Látogatások, amelyekben valóban megosztottak (a mentés nem számít ide). Az iPhone-app nincs benne, ezért ez alsó becslés." },
  { k: "saved", l: "Mentés", to: "product", rel: "nem teljes", live: "élő", src: "Látogatások, amelyekben megnyomták a mentés gombot. Az iPhone-app nincs benne, ezért ez alsó becslés." },
];
const REL_T: Record<Rel, string> = { pontos: "Pontos: minden esetet látunk.", "becslés": "Becslés: a szám szűrésen vagy valószínűségen múlik.", "nem teljes": "Nem teljes: egy részét nem látjuk, a valódi szám ennél több." };
const askAbout = (go: (t: Tab) => void, q: string, lines?: string[]) => { try { sessionStorage.setItem("inkage.admin.askq", q); if (lines) sessionStorage.setItem("inkage.admin.askctx", JSON.stringify(lines)); } catch {} go("ask"); };

/* ---------- speaking: the phone's own voice where it has one; nothing happens where it has none ---------- */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
export function speak(t: string, done?: () => void) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = "hu-HU"; u.rate = 1.02;
  const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("hu")); if (v) u.voice = v;
  u.onend = () => done?.(); u.onerror = () => done?.();
  speechSynthesis.speak(u); return true;
}

/* ---------- text size: this device only (read before the first paint in layout.tsx) ---------- */
const FS_KEY = "inkage.admin.fs";
function applyFs(v: string) {
  try {
    localStorage.setItem(FS_KEY, v);
    let x = v;
    /* "system": an Apple phone tells its own text size through this font; elsewhere it stays normal */
    if (v === "sys") { const s = document.createElement("span"); s.style.font = "-apple-system-body"; document.body.appendChild(s); const px = parseFloat(getComputedStyle(s).fontSize) || 17; s.remove(); x = px >= 21 ? "xl" : px >= 19 ? "l" : px <= 15 ? "s" : "m"; }
    document.documentElement.setAttribute("data-adm-fs", x);
  } catch {}
}

/* ---------- the layout ---------- */
const SECS: [string, string][] = [["nums", "Mai számok"], ["task", "Teendő-kártyák"], ["wall", "Legfrissebb előnézetek"], ["goal", "Cél: fizetők és az 1 millió"], ["changes", "Mi a szokatlan"], ["feed", "Legutóbb"], ["mirror", "Reggeli, esti és heti tükör"], ["chart", "Grafikon"], ["sources", "Honnan jönnek"], ["game", "Heti cél, sorozat, rekordok"], ["plan", "A heti terv"], ["reach", "Megjelenés és platformok"], ["more", "Kiugrások, nyelvek, videók"]];
type Lay = { order: string[]; hidden: string[] };
type Fx = { story: boolean; wall: boolean; mood: boolean };
const FX0: Fx = { story: true, wall: true, mood: true };
const VIEWS: [string, string, string][] = [["base", "Gyűrű", "a nap egy óriási gyűrűben"], ["split", "Felosztott kártyák", "egy nagy kártya, három kicsi, heti pirulák"], ["star", "Előnézet-főszereplő", "a legutóbbi előnézet hatalmasan, rajta a számok"], ["paying", "Egy szám", "csak a fizetők, a többi lehúzásra"], ["story", "Sztori", "lapozható kártyák megnyitáskor"], ["feed", "Hírfolyam", "minden esemény egy idővonalon"], ["todo", "Teendő-első", "csak amivel most dolgod van"], ["one", "Egy képernyős", "a nap egyetlen képernyőn, a többi gombnyomásra"], ["chat", "Beszélgetős", "csak kérdezel"]];

export type MaP = { d: D; go: (t: Tab) => void; T: TodoState; ln: LiveN; usersAll: number; next: number; share: number; perDay: number; tr: { t: string; v: number; p?: number }[]; metric: string; setMetric: (m: any) => void; ML: Record<string, string>; marks: Mark[]; goalPerDay?: number; posts: D[]; openP: (p: D | null) => void; openPost: D | null; imp?: D | null; ex: D | null; postStreak: number; onNote: () => void };

const todayK = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const finished = (ex: D | null): D[] => ((ex?.days_all || []) as D[]).filter((x) => String(x.t).slice(0, 10) < todayK());
const parts = (T: D) => [T.made != null ? `${fmt(n(T.made))} előnézet` : "", T.signups != null ? `${fmt(n(T.signups))} új fiók` : "", `${fmt(n(T.sessions))} látogatás`].filter(Boolean).join(", ");

/* one sentence from the numbers: what the day is like so far, against the same moment of yesterday */
function sentence(c: D | null, T: D, bad: number, warn: number, hr: number) {
  const Y: D = c?.yest || {}, A: D = c?.yest_all || {};
  const left = bad ? `${bad} sürgős dolog vár rád.` : warn ? `${warn} dolgot érdemes megnézni.` : "Nincs sürgős teendő.";
  if (hr < 8 && !n(T.made) && !n(T.signups)) return `Még korán van: tegnap ilyenkor is csak ${fmt(n(Y.made))} előnézet és ${fmt(n(Y.sessions))} látogatás volt, egész nap ${fmt(n(A.made))} előnézet lett. ${left}`;
  if (hr >= 19) return `A mai nap mérlege eddig: ${parts(T)}. ${left}`;
  const up = n(T.made) - n(Y.made), head = bad ? "Figyelj ide" : up > 0 ? "Jól indul" : up < 0 ? "Lassabb, mint tegnap" : "Nyugodt nap";
  return `${head}: ${parts(T)}. ${left}`;
}

/* only what is out of the ordinary: yesterday against the two weeks before it, with the reason where we know one */
function changes(ex: D | null, spikes: D[], c: D | null) {
  const f = finished(ex), y = f[f.length - 1], base = f.slice(-15, -1), out: { k: string; up: boolean; t: string; s: string; to: Tab }[] = [];
  if (y && base.length >= 5) (([["sessions", "látogatás", "traffic"], ["made", "elkészült előnézet", "product"], ["shared", "megosztás", "viral"], ["saved", "mentés", "product"]]) as [string, string, Tab][]).forEach(([k, l, to]) => {
    const v = n(y[k]), m = base.reduce((a, x) => a + n(x[k]), 0) / base.length, z = (v - m) / Math.sqrt(Math.max(m, 1));
    if (Math.abs(z) < 2 || Math.abs(v - m) < 3) return;
    const sp = k === "sessions" ? spikes.find((x) => String(x.day).slice(0, 10) === String(y.t).slice(0, 10)) : null, sess = n(y.sessions), mS = base.reduce((a, x) => a + n(x.sessions), 0) / base.length;
    const why = sp ? explain(sp) : k === "sessions" ? "Az ok nem látszik: nincs rövid link vagy hivatkozó, ami kitűnne." : Math.abs(sess - mS) / Math.max(mS, 1) > 0.3 ? `A látogatás is ${sess > mS ? "több" : "kevesebb"} volt (${fmt(sess)}, a szokásos ~${fmt(mS)}).` : "A látogatás nagyjából a szokásos volt, tehát az arány változott.";
    out.push({ k, up: v > m, t: `Tegnap ${fmt(v)} ${l}, a szokásos ~${fmt(m, m < 10 ? 1 : 0)} helyett`, s: why, to });
  });
  ((c?.unusual || []) as D[]).forEach((u) => {
    if (u.k === "bots") out.push({ k: "bots", up: true, t: `Sok gépi látogatás ma: ${fmt(n(u.n))}`, s: `A szokásos napi ~${fmt(n(u.usual))} helyett. Ezeket kiszűrtük, a számaidban nincsenek benne (becslés).`, to: "monitor" });
    if (u.k === "hour") out.push({ k: "hour", up: true, t: `Egy óra alatt ${fmt(n(u.n))} látogatás (${hhmm(u.at)}-tól)`, s: `A szokásos óránkénti ~${fmt(n(u.usual), 1)} helyett. Lehet egy poszt hatása vagy még ki nem szűrt robot (becslés).`, to: "live" });
    if (String(u.k).startsWith("lang:")) out.push({ k: u.k, up: true, t: `Hirtelen sok ${String(LANGS[u.lang] || u.lang).toLowerCase()} nyelvű látogató`, s: `A mai látogatások ${fmt(n(u.share))}%-a, a szokásos ${fmt(n(u.usual))}% helyett. Az országot nem mérjük, ez a nyelvből látszik.`, to: "markets" });
  });
  return out;
}

export function PhoneMa(p: MaP) {
  const { d, go, T: Todo, ln, ex, openPost, openP } = p;
  const { f: flt, set: setFlt } = useFlt();
  const [view, setView] = useSaved<string>("phone_ma_view", "base");
  const [lay, setLay] = useSaved<Lay>("phone_ma_layout", { order: [], hidden: [] });
  const [fx, setFx, fxReady] = useSaved<Fx>("phone_ma_fx", FX0);
  const q = useRpc("admin_ma_compare", { p_ch: flt.ch || null, p_lang: flt.lang || null }, [flt.ch, flt.lang]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") q.load(); }, 120_000); return () => clearInterval(t); }, [q.load]); // eslint-disable-line react-hooks/exhaustive-deps
  const spikes = useRpc("admin_spikes", { p_days: 14 }, []);
  const c = q.d as D | null;
  /* today's visits: the confirmed count, the same as on Élő */
  const T: D = { ...(c?.today || d.today || {}), ...(ln.today != null ? { sessions: ln.today } : {}) };
  const v = useDay(c, T, ex, d, !!(flt.ch || flt.lang));
  const sigs = useDaySigs(v.sel);
  const open = Todo.open;
  const bad = open.filter((a) => a.tone === "bad").length, warn = open.filter((a) => a.tone === "warn").length;
  const hr = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const line = sentence(c, T, bad, warn, hr);
  const chg = useMemo(() => changes(ex, Array.isArray(spikes.d) ? (spikes.d as D[]) : [], c), [ex, spikes.d, c]);
  const [sheet, setSheet] = useState<"set" | "fresh" | "push" | null>(null); const [num, setNum] = useState<NK | null>(null);
  const [showAll, setShowAll] = useState(false);
  /* a calm day says so, and does not fill the screen */
  const calm = !showAll && ["base", "split", "star"].includes(view) && !chg.length && !open.length && n(T.made) === 0 && n(T.sessions) < 5;
  /* the morning notification opens the story, and the Sztori view opens with it */
  const [story, setStory] = useState(false);
  useEffect(() => { try { const u = new URL(location.href); if (u.searchParams.has("story")) { u.searchParams.delete("story"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); setStory(true); } } catch {} }, []);
  /* every morning: the first opening of the day starts with the story (she can turn it off in the settings) */
  useEffect(() => { if (!fxReady || !fx.story || hr < 5 || hr >= 11) return; try { const k = "inkage.admin.story_day", t = todayK(); if (localStorage.getItem(k) === t) return; localStorage.setItem(k, t); setStory(true); } catch {} }, [fxReady]); // eslint-disable-line react-hooks/exhaustive-deps
  /* the Sztori view opens with the app, once per sitting: coming back from another tab or changing the period does not start it again */
  useEffect(() => { if (view !== "story") return; try { if (sessionStorage.getItem(STORY_SEEN)) return; sessionStorage.setItem(STORY_SEEN, "1"); } catch {} setStory(true); }, [view]);
  const cards: StoryCard[] = useMemo(() => [{ tone: "", kicker: "A nap egy mondatban", big: <span style={{ fontSize: ".3em", lineHeight: 1.22, display: "block", letterSpacing: "-.01em", fontFamily: "var(--a-ui)", fontWeight: 650 }}>{line}</span>, line: "" }, ...dayStories(d, go, ex?.days_all, open)], [line, d, go, bad, warn, ex, open.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = [...lay.order.filter((k) => SECS.some((x) => x[0] === k)), ...SECS.map((x) => x[0]).filter((k) => !lay.order.includes(k))];
  const [speaking, setSpeaking] = useState(false);
  const listen = () => {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const main = open[0];
    const said = [line, chg.length ? "Ami szokatlan: " + chg.slice(0, 3).map((x) => x.t).join(". ") + "." : "Nincs szokatlan szám.", main ? `A fő teendő: ${noEmoji(main.t)}.` : "", `Eddig ${fmt(p.usersAll)} fiók van.`].filter(Boolean).join(" ");
    if (speak(said.replace(/~/g, "körülbelül "), () => setSpeaking(false))) setSpeaking(true);
  };
  useEffect(() => () => { if (canSpeak()) speechSynthesis.cancel(); }, []);
  const secEl: Record<string, React.ReactNode> = {
    nums: view === "split" ? <SplitHero key="nums" v={v} c={c} liveNow={ln.now} usersAll={p.usersAll} open={setNum} go={go} /> : view === "star" ? <StarHero key="nums" v={v} c={c} sigs={sigs} open={setNum} />
      : <MaHero key="nums" v={v} c={c} d={d} usersAll={p.usersAll} open={setNum} go={go} sigs={fx.wall ? sigs : null} />,
    wall: <SigRow key="wall" rows={sigs} day={v.sel} />,
    task: <ActDeck key="task" T={Todo} go={go} fresh={() => setSheet("fresh")} />,
    changes: <MaChanges key="changes" list={chg} go={go} />,
    goal: <MaGoal key="goal" go={go} usersAll={p.usersAll} next={p.next} share={p.share} perDay={p.perDay} filtered={!!(flt.ch || flt.lang)} />,
    mirror: <MaMirror key="mirror" ex={ex} hr={hr} T={T} d={d} />,
    feed: <MaFeed key="feed" days={1} go={go} limit={6} day={v.sel} />,
    chart: <MaChart key="chart" {...p} />,
    sources: <MaSources key="sources" d={d} go={go} />,
    game: <MaGame key="game" ex={ex} d={d} postStreak={p.postStreak} usersAll={p.usersAll} go={go} />,
    plan: <section key="plan" className="c"><h2 style={{ marginBottom: 10 }}>A heti terv</h2><WeekPlan go={go} /></section>,
    reach: <div key="reach" className="g ph-g"><ImpStrip x={p.imp || null} days={Math.min(480, d.days || 480)} go={go} /><PlatformToday /></div>,
    more: <MaMore key="more" d={d} posts={p.posts} openP={openP} opened={view === "one"} />,
  };
  const top = (
    <section className={"ma-top " + (bad ? "bad" : warn ? "warn" : "good")}>
      <div className="ma-top-h">
        <StatusWord bad={bad} warn={warn} all={open.length} c={c} T={T} liveNow={ln.now} go={go} />
        <span className="ma-sp" />
        {canSpeak() && <button className="ma-ib" onClick={listen} aria-label={speaking ? "Felolvasás leállítása" : "A nap meghallgatása"} aria-pressed={speaking}>{I(speaking ? P.x : P.play)}</button>}
        <button className="ma-ib" onClick={() => setSheet("set")} aria-label="A Ma fül beállítása">{I(P.layers)}</button>
      </div>
      <p className="ma-line">{line}</p>
      <div className="ma-chips"><LiveChip d={d} now={ln.now} go={go} /><StreakChip v={v} open={() => setNum("signups")} /><FreshLamp open={() => setSheet("fresh")} /></div>
      {(flt.ch || flt.lang) && <button className="ma-flt" onClick={() => setFlt({ ch: undefined, lang: undefined })} aria-label="Szűrés törlése"><span>Szűrve: {[...chList(flt.ch).map(ch), ...(flt.lang ? [lang(flt.lang)] : [])].join(", ")}</span><b aria-hidden="true">{I(P.x)}</b></button>}
      {!["feed", "chat", "todo", "paying", "one"].includes(view) && <p className="ma-scope">A felső számok a mai napról szólnak. Az időszak a lenti, jelölt kártyákra hat.</p>}
    </section>
  );
  return <>
    <div className={"ph-ma ma ink-ma" + (fx.mood ? " ma-mood" : "")} style={fx.mood ? ({ ["--mood" as string]: v.mood }) : undefined}>
      {top}
      <PushPrompt />
      {view === "paying" ? <PayOne>{order.filter((k) => !lay.hidden.includes(k)).map((k) => secEl[k])}</PayOne>
        : view === "feed" ? <MaFeed days={3} go={go} limit={60} big />
        : view === "chat" ? <Ask d={d} conv />
        : view === "todo" ? <><MaTask T={Todo} go={go} all />{!open.length && secEl.nums}</>
        : view === "one" && !showAll ? <MaOneScreen v={v} T={Todo} open={setNum} go={go} more={() => setShowAll(true)} />
        : calm ? <><p className="ph-quiet">Csendes nap: nincs újdonság és nincs teendő. Egy új videó vagy rövid link most a legjobb lépés.</p>{secEl.nums}<button className="ph-more" onClick={() => setShowAll(true)}>Mutasd a többit{I(P.down)}</button></>
        : order.filter((k) => !lay.hidden.includes(k)).map((k) => secEl[k])}
      {num && <NumSheet k={num} day={v.sel} su={v.suMap} c={c} ex={ex} d={d} at={q.at} go={go} close={() => setNum(null)} />}
      {sheet === "fresh" && <FreshSheet close={() => setSheet(null)} go={go} />}
      {sheet === "set" && <MaSettings fx={fx} setFx={setFx} view={view} setView={(v) => { setView(v); setShowAll(false); if (v === "story") { try { sessionStorage.setItem(STORY_SEEN, "1"); } catch {} setStory(true); } }} lay={lay} setLay={setLay} order={order} close={() => setSheet(null)} push={() => setSheet("push")} />}
      {sheet === "push" && <PushSheet close={() => setSheet(null)} />}
      {openPost && <PostDrawer p={openPost} close={() => openP(null)} />}
    </div>
    {/* outside the lit page: the light's stacking would hold it under the bars */}
    {story && cards.length > 0 && <MorningStory cards={cards} close={() => setStory(false)} />}
  </>;
}

/* ---------- now: who is here, and about how many are making a signature ---------- */
const MAKING = new Set(["flow_step", "quiz_answer", "quiz_start", "analysis_start", "signature_captured", "celeb_request"]);
const STORY_SEEN = "inkage.admin.story_seen";
/* the same "most bent" and "ma eddig" as on Élő: a single open from nowhere does not count until it does something, or its 30 minutes are up */
export type LiveN = { now: number; today: number | null };
export function useLiveN(d: D): LiveN {
  const { f } = useFlt();
  const q = useRpc("admin_live", { p_ch: f.ch || null, p_lang: f.lang || null }, [f.ch, f.lang]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") q.load(); }, 60_000); return () => clearInterval(t); }, [q.load]); // eslint-disable-line react-hooks/exhaustive-deps
  const lv = q.d as D | null;
  return { now: n(lv?.live_now_confirmed ?? lv?.live_now ?? d.live_now), today: lv?.today_confirmed != null ? n(lv.today_confirmed) : null };
}
function LiveChip({ d, now, go }: { d: D; now: number; go: (t: Tab) => void }) {
  const last = new Map<string, D>();
  ((d.live || []) as D[]).filter((x) => Date.now() - new Date(x.created_at).getTime() < 5 * 60e3).forEach((x) => { if (x.s && !last.has(x.s)) last.set(x.s, x); });
  const making = Math.min(now, [...last.values()].filter((x) => MAKING.has(x.name)).length);
  return <button className={"ma-chip" + (now ? " on" : "")} onClick={() => go("live")}><i aria-hidden="true" />{now ? <><b>{fmt(now)}</b> most bent{making ? <>, kb. {fmt(making)} előnézetet készít</> : null}</> : "Most senki nincs bent"}</button>;
}

/* one word for the day: red flags first, then whether it runs ahead of yesterday at this moment or people are here right now */
function StatusWord({ bad, warn, all, c, T, liveNow, go }: { bad: number; warn: number; all: number; c: D | null; T: D; liveNow: number; go: (t: Tab) => void }) {
  const word = bad ? "Figyelj" : n(T.made) > n(c?.yest?.made) || liveNow >= 3 ? "Pörög" : "Nyugodt";
  return <button className="ma-word" onClick={() => go("todo")} aria-label={`Állapot: ${word}. ${all} teendő${bad ? `, ebből ${bad} sürgős` : warn ? `, ebből ${warn} megnézni való` : ""}. Megnyitom a Teendőket.`}>{word}{all > 0 && <i>{fmt(all)}</i>}</button>;
}

/* how many days in a row there was a new account; today does not break it while the day is still going */
function StreakChip({ v, open }: { v: DayV; open: () => void }) {
  if (v.streak == null) return null;
  const { k, gap } = v.streak;
  return <button className="ma-chip st" onClick={open} aria-label={k ? `${k} napja minden nap volt új fiók. Részletek` : "Új fiókok. Részletek"}>{k ? <><b>{k >= SU_DAYS - 1 ? `${SU_DAYS - 1}+` : fmt(k)}</b> nap új fiókkal</> : gap != null ? <><b>{fmt(gap)}</b> napja nincs új fiók</> : "Még nincs új fiók"}</button>;
}

/* ---------- is every source delivering ---------- */
function FreshLamp({ open }: { open: () => void }) {
  const s = useSrcs(); if (!s) return null;
  const old = s.filter((x) => !x.ok).length;
  return <button className={"ma-dq" + (old ? " old" : "")} onClick={open}>{old ? `${old} adatforrás késik` : "Minden adat friss"}</button>;
}
function FreshSheet({ close, go }: { close: () => void; go: (t: Tab) => void }) {
  const s = useSrcs() || [];
  return <Sheet title="Honnan jönnek az adatok" sub="Mikor frissült utoljára minden forrás" close={close} foot={<button className="adm-ibtn" onClick={() => { close(); go("monitor"); }}>Monitoring</button>}>
    <ul className="ma-src">{s.map((x) => <li key={x.k}><i className={x.ok ? "ok" : "old"} aria-hidden="true" /><b>{SRC_L[x.k] || x.k}</b><span>{x.at ? ago(x.at) : "még nincs adat"}{x.ok ? "" : " · késik"}{x.note ? ` · ${x.note}` : ""}</span></li>)}</ul>
  </Sheet>;
}

/* ---------- the chosen day: the strip switches the numbers, the sheets, the signatures and the timeline together ---------- */
const SU_DAYS = 60;
const dayL = (k: string) => new Date(k + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
const dayOf = (t: string) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const shift = (k: string, by: number) => new Date(new Date(k + "T12:00:00Z").getTime() + by * 864e5).toISOString().slice(0, 10);
type DayV = ReturnType<typeof useDay>;
function useDay(c: D | null, T: D, ex: D | null, d: D, filtered: boolean) {
  const today = todayK(), [picked, setSel] = useState(today);
  /* a page left open overnight falls back on the new day unless she picked one */
  const sel = picked > today ? today : picked, isToday = sel === today;
  const su = useRpc("admin_users_stats", { p_days: SU_DAYS }, []);
  const trend = d.trend;
  const suMap = useMemo(() => {
    const m = new Map<string, number>();
    (((su.d as D)?.cum || []) as D[]).forEach((y) => m.set(String(y.t).slice(0, 10), n(y.n)));
    if (d.bucket === "day" && !filtered) ((trend || []) as D[]).forEach((y) => { if (y.signups != null && !y.partial) m.set(String(y.t).slice(0, 10), n(y.signups)); });
    return m;
  }, [su.d, trend, d.bucket, filtered]);
  const all: D[] = ex?.days_all || [];
  const byDay = new Map(all.map((x) => [String(x.t).slice(0, 10), x]));
  const week = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
  const days = week.map((t) => ({ t, v: t === today ? n(T.made) : n(byDay.get(t)?.made) }));
  const row: D = isToday ? T : byDay.get(sel) || {};
  const val = (k: string) => (row[k] == null ? null : n(row[k]));
  const recent = all.slice(-30);
  const peak = (k: string, x: number | null) => Math.max(1, n(x), ...recent.map((y) => n(y[k])));
  const suKnown = suMap.size > 0;
  const suToday = T.signups != null ? n(T.signups) : suKnown ? n(suMap.get(today)) : null;
  const signups = isToday ? suToday : suKnown ? n(suMap.get(sel)) : null;
  const suTop = Math.max(1, n(suToday), ...[...suMap.values()].slice(-30));
  let streak: { k: number; gap: number | null } | null = null;
  if (suKnown) { let k = 0, o = n(suToday) > 0 ? 0 : 1; for (; o < SU_DAYS; o++, k++) if (!(o === 0 ? n(suToday) : n(suMap.get(shift(today, -o))))) break;
    let gap: number | null = null; if (!k) for (let i = 1; i < SU_DAYS; i++) if (n(suMap.get(shift(today, -i)))) { gap = i; break; }
    streak = { k, gap }; }
  const made = val("made"), prevRow = byDay.get(shift(sel, -1));
  return { today, sel, setSel, isToday, days, made, sess: val("sessions"), saved: val("saved"), shared: val("shared"), signups, suTop, peak, prev: prevRow, suMap, streak, filtered, label: isToday ? "ma" : dayL(sel),
    mood: Math.round((0.15 + 0.85 * Math.min(1, n(made) / peak("made", made))) * 100) / 100 };
}
const fm = (x: number | null) => (x == null ? "–" : fmt(x));

/* the shared link cache only redraws the one who asked first: anyone else redraws itself once */
function useUrls(paths: string[], small = true) {
  const url = useSigUrls(paths, small), [, tick] = useState(0), key = paths.join("|");
  useEffect(() => { tick((x) => x + 1); }, [key]);
  return url;
}

/* signatures made on the chosen day, newest first: the day's accounts from the same rows the number counts */
function useDaySigs(day: string) {
  const [rows, setRows] = useState<D[] | null>(null);
  useEffect(() => {
    let live = true; setRows(null);
    const load = async () => {
      const m = await rpc(sb(), "admin_ma_rows", { p_metric: "made", p_day: day });
      const ids = [...new Set((((m.data as D)?.rows || []) as D[]).map((x) => x.id).filter(Boolean))].slice(0, 40);
      if (!ids.length) { if (live) setRows([]); return; }
      const s = await rpc(sb(), "admin_people_sigs", { p_ids: ids, p_each: 6 });
      const out = (Array.isArray(s.data) ? (s.data as D[]) : []).flatMap((r) => ((r.sigs || []) as D[]).map((x) => ({ ...x, uid: r.id } as D))).filter((x) => x.at && dayOf(x.at) === day).sort((a, b) => String(b.at).localeCompare(String(a.at)));
      if (live) setRows(out);
    };
    load().catch(() => { if (live) setRows([]); });
    /* the wall is live: today's fill up while the page is open */
    const t = day === todayK() ? setInterval(() => { if (document.visibilityState === "visible") load().catch(() => {}); }, 120_000) : null;
    return () => { live = false; if (t) clearInterval(t); };
  }, [day]);
  return rows;
}

/* ---------- the newest signatures as a swiping row of covers; a tap opens the account ---------- */
function SigRow({ rows, day }: { rows: D[] | null; day: string }) {
  const latest = useRecentSigs(10), [u, setU] = useState<string | null>(null);
  const isToday = day === todayK(), own = !!rows?.length, list = own ? rows!.slice(0, 16) : latest || [];
  const url = useUrls(list.map((x) => String(x.path)));
  if (rows === null && !latest) return <section className="ma-sr"><h3 className="ink-h">Legfrissebb előnézetek</h3><div className="skel" style={{ height: 130, borderRadius: 18 }} /></section>;
  if (!list.length) return null;
  return <section className="ma-sr" aria-label="A legfrissebb előnézetek">
    <h3 className="ink-h">{own ? (isToday ? "Legfrissebb előnézetek" : `Előnézetek, ${dayL(day)}`) : "Legutóbbi előnézetek"}{!own && rows && !isToday ? <small>{huOn(day)} nem látszik előnézet</small> : null}</h3>
    <div className="ma-sr-row">{list.map((x, i) => <figure key={String(x.path) + i}><Sig u={url(String(x.path))} alt="Elkészült előnézet" onClick={x.uid ? () => setU(String(x.uid)) : undefined} /><figcaption>{x.at ? (dayOf(x.at) === todayK() ? hhmm(x.at) : hu(x.at, { month: "short", day: "numeric" })) : ""}</figcaption></figure>)}</div>
    {u && <UserDrawer id={u} close={() => setU(null)} />}
  </section>;
}

/* the day's own signatures behind the figures: nothing made means no wall, and the pen line stays */
function DayWall({ rows }: { rows: D[] }) {
  const list = rows.slice(0, 12), url = useUrls(list.map((x) => String(x.path)));
  return <div className="ma-wallbg" aria-hidden="true">{list.map((x, i) => { const u = url(String(x.path)); return u ? <img key={String(x.path) + i} src={u} alt="" referrerPolicy="no-referrer" /> : <i key={i} />; })}</div>;
}

/* a past day says which day it is and how to get back; the day strip itself lives beside it */
function DayBack({ v }: { v: DayV }) {
  if (v.isToday) return null;
  return <div className="ma-dayback"><b>{new Date(v.sel + "T12:00:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" })}</b>{v.filtered && <small>szűrés nélkül</small>}<button className="ma-chip" onClick={() => v.setSel(v.today)}>Vissza a mához</button></div>;
}
const DayChg = ({ v, c }: { v: DayV; c: D | null }) => {
  if (v.made == null) return null;
  if (v.isToday) return c ? <div className="ink-ma-chg"><Chg a={v.made} b={n(c.yest?.made)} tail="tegnap ilyenkorhoz" /></div> : null;
  return v.prev ? <div className="ink-ma-chg"><Chg a={v.made} b={n(v.prev.made)} tail="az előző naphoz" /></div> : null;
};

/* the small rings: truthful top = the best of the last 30 days */
function Rings({ v, open, four }: { v: DayV; open: (k: NK) => void; four?: boolean }) {
  return <div className={"ink-rings3" + (four ? " four" : "")}>
    <button onClick={() => open("signups")}><Ring p={n(v.signups) / v.suTop} kind="solid"><b>{fm(v.signups)}</b></Ring><small>új fiók</small></button>
    <button onClick={() => open("sessions")}><Ring p={n(v.sess) / v.peak("sessions", v.sess)} kind="dots"><b>{fm(v.sess)}</b></Ring><small>látogatás</small></button>
    <button onClick={() => open("saved")}><Ring p={n(v.saved) / v.peak("saved", v.saved)} kind="seg"><b>{fm(v.saved)}</b></Ring><small>mentés</small></button>
    {four && <button onClick={() => open("shared")}><Ring p={n(v.shared) / v.peak("shared", v.shared)} kind="tick"><b>{fm(v.shared)}</b></Ring><small>megosztás</small></button>}
  </div>;
}
const BigRing = ({ v, open }: { v: DayV; open: (k: NK) => void }) => <button className="ink-ma-ring" onClick={() => open("made")} aria-label={`${fm(v.made)} elkészült előnézet, ${v.label}. Részletek`}>
  <Ring p={n(v.made) / v.peak("made", v.made)} kind="tick"><Giant v={v.made} max={150} /><small>előnézet {v.label}</small></Ring>
</button>;

/* ---------- the computer's Áttekintés: not a stretched phone. Left the day (word, live, ring, week), right the cards; under them what to do and what just happened ---------- */
export function DeskHero({ d, ex, go, T: Todo, ln, goal }: { d: D; ex: D | null; go: (t: Tab) => void; T: TodoState; ln: LiveN; goal: React.ReactNode }) {
  const { f: flt } = useFlt();
  const [fx] = useSaved<Fx>("phone_ma_fx", FX0);
  const q = useRpc("admin_ma_compare", { p_ch: flt.ch || null, p_lang: flt.lang || null }, [flt.ch, flt.lang]);
  const c = q.d as D | null, T: D = { ...(c?.today || d.today || {}), ...(ln.today != null ? { sessions: ln.today } : {}) }, [num, setNum] = useState<NK | null>(null), [fresh, setFresh] = useState(false);
  const v = useDay(c, T, ex, d, !!(flt.ch || flt.lang)), sigs = useDaySigs(v.sel);
  const open = Todo.open, bad = open.filter((a) => a.tone === "bad").length, warn = open.filter((a) => a.tone === "warn").length;
  return <>
    <section className={"s12 ih-top" + (fx.mood ? " ma-mood" : "")} style={fx.mood ? ({ ["--mood" as string]: v.mood }) : undefined} aria-label="A nap számai">
      <div className="ih-l">
        <div className="ih-status"><StatusWord bad={bad} warn={warn} all={open.length} c={c} T={T} liveNow={ln.now} go={go} /><div className="ma-chips"><LiveChip d={d} now={ln.now} go={go} /><StreakChip v={v} open={() => setNum("signups")} /><FreshLamp open={() => setFresh(true)} /></div></div>
        <div className="ink-ma-top">{fx.wall && sigs?.length ? <DayWall rows={sigs} /> : <SigLine />}<BigRing v={v} open={setNum} /><DayChg v={v} c={c} /></div>
        <DayBack v={v} />
        <DayStrip days={v.days} sel={v.sel} pick={v.setSel} />
      </div>
      <div className="ih-r"><Rings v={v} open={setNum} four />{goal}<SigRow rows={sigs} day={v.sel} /></div>
    </section>
    <section className="s12 ih-2"><ActDeck T={Todo} go={go} fresh={() => setFresh(true)} noFlip /><MaFeed days={1} go={go} limit={6} day={v.sel} /></section>
    {num && <NumSheet k={num} day={v.sel} su={v.suMap} c={c} ex={ex} d={d} at={q.at} go={go} close={() => setNum(null)} />}
    {fresh && <FreshSheet close={() => setFresh(false)} go={go} />}
  </>;
}

/* ---------- the day as one giant figure inside a ring: the week under it picks the day, three small rings below ---------- */
function MaHero({ v, c, d, usersAll, open, go, sigs }: { v: DayV; c: D | null; d: D; usersAll: number; open: (k: NK) => void; go: (t: Tab) => void; sigs: D[] | null }) {
  return <section className="ink-ma-top" aria-label="A nap számai">
    {sigs?.length ? <DayWall rows={sigs} /> : <SigLine />}
    <Trio items={[{ l: v.isToday ? "megosztás ma" : "megosztás", v: fm(v.shared), run: () => open("shared") }, { l: "fiók összesen", v: fmt(usersAll), run: () => go("users") }, { l: "előnézet összesen", v: d.all?.made == null ? "–" : fmt(n(d.all.made)), run: () => go("product") }]} />
    <BigRing v={v} open={open} />
    <DayChg v={v} c={c} />
    <DayBack v={v} />
    <DayStrip days={v.days} sel={v.sel} pick={v.setSel} />
    <Rings v={v} open={open} />
  </section>;
}

/* ---------- the week as pills that fill up: a tap picks the day ---------- */
function WeekPills({ v }: { v: DayV }) {
  const top = Math.max(1, ...v.days.map((x) => x.v));
  return <div className="ma-pills" role="group" aria-label="Az elmúlt hét nap">{v.days.map((x) => { const dt = new Date(x.t + "T12:00:00"); return <button key={x.t} aria-pressed={x.t === v.sel} onClick={() => v.setSel(x.t)} aria-label={`${dt.toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}: ${fmt(x.v)} előnézet`}><span><i style={{ height: `${Math.max(x.v ? 10 : 0, (x.v / top) * 100)}%` }} /></span><small>{dt.getDate()}</small></button>; })}</div>;
}

/* view: one big inverted card, three small ones, the week as pills, a contrast card */
function SplitHero({ v, c, liveNow, usersAll, open, go }: { v: DayV; c: D | null; liveNow: number; usersAll: number; open: (k: NK) => void; go: (t: Tab) => void }) {
  return <section className="ma-split" aria-label="A nap számai">
    <button className="ma-split-a ink-flip" onClick={() => open("made")}><span>előnézet {v.label}</span><Giant v={v.made} max={170} />{v.made != null && (v.isToday ? c && <Chg a={v.made} b={n(c.yest?.made)} tail="tegnap ilyenkorhoz" /> : v.prev && <Chg a={v.made} b={n(v.prev.made)} tail="az előző naphoz" />)}</button>
    <div className="ma-split-3">
      <button onClick={() => open("signups")}><b>{fm(v.signups)}</b><small>új fiók</small></button>
      <button onClick={() => open("sessions")}><b>{fm(v.sess)}</b><small>látogatás</small></button>
      <button onClick={() => open("saved")}><b>{fm(v.saved)}</b><small>mentés</small></button>
    </div>
    <DayBack v={v} />
    <WeekPills v={v} />
    <div className="ma-split-c"><Trio items={[{ l: "most bent", v: fmt(liveNow), run: () => go("live") }, { l: v.isToday ? "megosztás ma" : "megosztás", v: fm(v.shared), run: () => open("shared") }, { l: "fiók összesen", v: fmt(usersAll), run: () => go("users") }]} /></div>
  </section>;
}

/* view: the day's newest signature, huge, the numbers on it; a day with none shows the newest one and says when it was */
function StarHero({ v, c, sigs, open }: { v: DayV; c: D | null; sigs: D[] | null; open: (k: NK) => void }) {
  const latest = useRecentSigs(1), x = sigs?.[0] || (sigs ? latest?.[0] : null), [u, setU] = useState<string | null>(null);
  const url = useUrls(x ? [String(x.path)] : [], false);
  return <section className="ma-star" aria-label="A nap számai">
    <div className="ma-star-i">
      {x ? <Sig u={url(String(x.path))} alt="A legutóbbi előnézet" onClick={x.uid ? () => setU(String(x.uid)) : undefined} /> : sigs && latest ? <div className="ma-star-e">Még nincs előnézet</div> : <div className="skel" />}
      {x?.at && <span className="ma-star-t">{sigs?.[0] ? "Legutóbbi előnézet" : "Az utolsó ismert előnézet"} · {ago(x.at)}</span>}
      <button className="ma-star-n" onClick={() => open("made")} aria-label={`${fm(v.made)} elkészült előnézet, ${v.label}. Részletek`}><Giant v={v.made} max={120} /><small>előnézet {v.label}</small></button>
    </div>
    <DayChg v={v} c={c} />
    <div className="ma-split-3">
      <button onClick={() => open("signups")}><b>{fm(v.signups)}</b><small>új fiók</small></button>
      <button onClick={() => open("sessions")}><b>{fm(v.sess)}</b><small>látogatás</small></button>
      <button onClick={() => open("saved")}><b>{fm(v.saved)}</b><small>mentés</small></button>
    </div>
    <button className="ma-star-sh" onClick={() => open("shared")}><b>{fm(v.shared)}</b> megosztás {v.label}<span aria-hidden="true">›</span></button>
    <DayBack v={v} />
    <DayStrip days={v.days} sel={v.sel} pick={v.setSel} />
    {u && <UserDrawer id={u} close={() => setU(null)} />}
  </section>;
}

/* ---------- view: only the paying people today; everything else waits for a pull (or the button) ---------- */
function PayOne({ children }: { children: React.ReactNode }) {
  const q = useRpc("admin_sales", { p_days: 30 }, []); const s = q.d as D | null;
  const g = useRpc("admin_setting_get", { p_k: "pay_goal" }, []); const min = n((g.d as D)?.min) || 10, max = n((g.d as D)?.max) || 50;
  const [more, setMore] = useState(false), [sheet, setSheet] = useState(false), y0 = useRef<number | null>(null);
  const today = n(s?.today_people), known = !!s && (!!s.live || today > 0), off = !!s && !known;
  /* no payments yet: there is no number to look at, so it says so plainly and the day stands under it */
  if (off) return <>
    <section className="ma-one off"><button className="ma-one-n" onClick={() => setSheet(true)}><span>Fizetők ma</span><b className="ma-one-t">A fizetés még nincs bekapcsolva.</b><small>Addig nincs mit mérni. Alatta a nap többi száma.</small></button></section>
    {children}
    {sheet && <Sheet title="Fizetők ma" sub="A fizetés még nincs bekapcsolva." close={() => setSheet(false)} tall><p className="ps-p mut">Amint a fizetés élesben megy, itt látod a mai fizetőket és a bevételt.</p></Sheet>}
  </>;
  return <>
    <section className="ma-one" onTouchStart={(e) => { y0.current = window.scrollY <= 2 ? e.touches[0].clientY : null; }} onTouchEnd={(e) => { if (y0.current != null && e.changedTouches[0].clientY - y0.current > 50) { haptic(6); setMore(true); } y0.current = null; }}>
      <button className="ma-one-n" onClick={() => setSheet(true)} aria-label={`Fizetők ma: ${fmt(today)}. Részletek`}>
        <span>Fizetők ma</span>{!s ? <div className="skel" style={{ height: 160, borderRadius: 26 }} /> : <Giant v={today} max={260} />}
        <small>{!s ? "" : `cél: napi ${min}-${max}`}</small>
      </button>
      <button className="ma-one-m" onClick={() => setMore(!more)} aria-expanded={more}>{more ? "Elrejtés" : "Húzd le, vagy koppints a többiért"}{I(P.down)}</button>
    </section>
    {more && children}
    {sheet && <Sheet title="Fizetők ma" sub="A webes eladások forrása becslés." close={() => setSheet(false)} tall>
      <p className="ma-big">{fmt(today)}</p>
      <dl className="pt-dl"><div><dt>Eladás ma</dt><dd>{fmt(n(s?.today_sales))}</dd></div><div><dt>Bevétel ma</dt><dd>{Object.entries((s?.today_rev || {}) as D).map(([k, x]) => `${Math.round(Number(x) * 100) / 100} ${k}`).join(", ") || "0"}</dd></div><div><dt>7 napos átlag</dt><dd>{fmt(n(s?.avg_7), 1)}/nap</dd></div><div><dt>Összes eladás</dt><dd>{fmt(n(s?.total_sales))}</dd></div></dl>
        {((s?.by_source || []) as D[]).length > 0 && <ul className="ma-src">{((s?.by_source || []) as D[]).map((r) => <li key={r.source + r.currency}><i className="ok" aria-hidden="true" /><b>{r.source}</b><span>{fmt(n(r.people))} fizető · {fmt(n(r.sales))} eladás · {Math.round(Number(r.rev) * 100) / 100} {r.currency}</span></li>)}</ul>}
    </Sheet>}
  </>;
}

function NumSheet({ k, day, su: suDays, c, ex, d, at, go, close }: { k: NK; day: string; su: Map<string, number>; c: D | null; ex: D | null; d: D; at: number; go: (t: Tab) => void; close: () => void }) {
  const isT = day === todayK(), x = NUMS.find((y) => y.k === k)!;
  const pick = (dk: string) => { if (k === "signups") return suDays.size ? n(suDays.get(dk)) : null; const r = ((ex?.days_all || []) as D[]).find((y) => String(y.t).slice(0, 10) === dk); return r?.[k] == null ? null : n(r[k]); };
  const t = isT ? c?.today?.[k] : pick(day), own = isT ? c?.own?.[k] : null;
  const [rows, setRows] = useState(false); const [withOwn, setWithOwn] = useState(false);
  /* on the 24-hour period the main numbers are hourly: the days come from the accounts themselves */
  const su = useRpc("admin_users_stats", { p_days: 30 }, [], k !== "signups" || d.bucket === "day");
  const days: D[] = k === "signups" ? (d.bucket === "day" ? d.trend || [] : (((su.d as D)?.cum || []) as D[]).map((y) => ({ t: y.t, signups: y.n }))) : ex?.days_all || [];
  const pts = days.slice(-30).map((y) => ({ t: String(y.t), v: n(y[k]), partial: String(y.t).slice(0, 10) >= todayK() }));
  const lines = isT ? (c ? [`${x.l} ma eddig: ${fmt(n(t))}`, `tegnap ilyenkor: ${fmt(n(c.yest?.[k]))}`, `tegnap egész nap: ${fmt(n(c.yest_all?.[k]))}`, `múlt héten ilyenkor: ${fmt(n(c.week?.[k]))}`] : undefined) : [`${x.l}, ${dayL(day)}: ${t == null ? "nincs adat" : fmt(n(t))}`];
  const pv = pick(shift(day, -1)), wk = pick(shift(day, -7));
  if (rows) return <RowsSheet k={k} day={day} label={x.l} back={() => setRows(false)} close={close} count={t == null ? null : n(t)} />;
  return <Sheet title={x.l} sub={isT ? `Ma eddig · ${x.live}` : new Date(day + "T12:00:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" })} close={close} tall foot={<><button className="adm-ibtn gold" onClick={() => setRows(true)}>Soronként</button><button className="adm-ibtn" onClick={() => { close(); askAbout(go, isT ? `Miért ennyi ma ez: „${x.l}”, és mit tegyek?` : `Miért ennyi volt ${huOn(day)} ez: „${x.l}”?`, lines); }}>{I(P.spark)}Kérdezz</button><button className="adm-ibtn" onClick={() => { close(); go(x.to); }}>Az oldala</button></>}>
    <p className="ma-big">{t == null ? "–" : fmt(n(t) + (withOwn ? n(own) : 0))}</p>
    {isT ? c && t != null && <dl className="pt-dl">
      <div><dt>Tegnap ilyenkor</dt><dd>{fmt(n(c.yest?.[k]))}</dd></div><div><dt>Tegnap egész nap</dt><dd>{fmt(n(c.yest_all?.[k]))}</dd></div>
      <div><dt>Múlt héten ilyenkor</dt><dd>{fmt(n(c.week?.[k]))}</dd></div><div><dt>Múlt héten aznap egész nap</dt><dd>{fmt(n(c.week_all?.[k]))}</dd></div>
    </dl> : <dl className="pt-dl"><div><dt>Előző nap</dt><dd>{fm(pv)}</dd></div><div><dt>Egy héttel korábban</dt><dd>{fm(wk)}</dd></div></dl>}
    {pts.length > 2 ? <TrendChart data={pts} label={x.l} height={170} /> : <p className="ma-why">Ehhez a számhoz napi görbe most nincs: válts 7 vagy 30 napos időszakra.</p>}
    <h4 className="ps-t">Honnan jön ez a szám?</h4><p className="ps-p">{x.src}</p>
    <h4 className="ps-t">Mennyire biztos?</h4><p className="ps-p"><b>{x.rel[0].toUpperCase() + x.rel.slice(1)}.</b> {(() => { const t = REL_T[x.rel].split(": ")[1]; return t[0].toUpperCase() + t.slice(1); })()}</p>
    <h4 className="ps-t">A saját forgalmad</h4>
    {!isT ? <p className="ps-p mut">A saját forgalmat csak a mai napra bontjuk külön.</p> : own == null ? <p className="ps-p mut">{k === "shared" || k === "saved" ? "Ennél a számnál a saját forgalmat nem bontjuk külön: a megjelölt eszközeid eleve kimaradnak belőle." : "Csatornára vagy nyelvre szűrve nem bontható."}</p>
      : <button className={"ma-own" + (withOwn ? " on" : "")} role="switch" aria-checked={withOwn} onClick={() => setWithOwn(!withOwn)}><span className={"sw" + (withOwn ? " on" : "")}><i /></span><span>A saját {k === "sessions" ? "eszközeiddel" : "fiókjaiddal"} együtt: <b>{fmt(n(t) + n(own))}</b> ({fmt(n(own))} a tiéd)</span></button>}
    {isT && at > 0 && <p className="ma-why">Az összevetés frissítve: {ago(new Date(at).toISOString())}.</p>}
  </Sheet>;
}

/* the number, row by row: the same counting as the tile. Visits stay anonymous. */
function RowsSheet({ k, label, day: picked, count, back, close }: { k: NK; label: string; day: string; count: number | null; back: () => void; close: () => void }) {
  const today = todayK(), yest = shift(today, -1), [day, setDay] = useState(picked); const [u, setU] = useState<string | null>(null);
  const name = (x: string) => (x === today ? "Ma" : x === yest ? "Tegnap" : dayL(x)), tabs = [today, yest, ...(picked !== today && picked !== yest ? [picked] : [])];
  const q = useRpc("admin_ma_rows", { p_metric: k, p_day: day }, [k, day]);
  const here = (q.d as D)?.day == null || String((q.d as D).day).slice(0, 10) === day || MOCK;
  const rows: D[] = here ? (q.d as D)?.rows || [] : [];
  if (u) return <UserDrawer id={u} close={() => setU(null)} />;
  return <Sheet title={label + " soronként"} sub={name(day)} close={close} tall foot={<button className="adm-ibtn" onClick={back}>Vissza</button>}>
    <div className="ps-opts">{tabs.map((x) => <button key={x} aria-pressed={day === x} onClick={() => setDay(x)}>{name(x)}</button>)}</div>
    {!q.d || !here ? <div className="skel" style={{ height: 160 }} /> : !rows.length ? <p className="ps-p mut">{name(day)} nincs ilyen sor.</p> : <>
      <p className="ma-why">{fmt(rows.length)} sor{rows.length >= 300 ? " (az első 300)" : ""}{day === picked && day === today && count != null && count !== rows.length && rows.length < 300 ? `, a szám ${fmt(count)}: közben frissült` : ""}.{k === "sessions" || k === "shared" || k === "saved" ? " A látogatások névtelenek: nincs hozzájuk fiók." : ""}</p>
      <ul className="ma-rows">{rows.map((r, i) => {
        const main = k === "made" ? (CELEB_L(r.style)) : k === "signups" ? ({ email: "E-mail + jelszó", google: "Google", apple: "Apple" } as D)[r.provider] || "Ismeretlen belépés" : `${ch(r.ch || "ismeretlen")}${r.lang ? " · " + (LANGS[r.lang] || r.lang) : ""}`;
        const sub = k === "made" || k === "signups" ? "fiók megnyitása ›" : `${fmt(n(r.events))} esemény`;
        return r.id ? <li key={i}><button onClick={() => setU(r.id)}><time>{hhmm(r.at)}</time><b>{main}</b><small>{sub}</small></button></li> : <li key={i}><div><time>{hhmm(r.at)}</time><b>{main}</b><small>{sub}</small></div></li>; })}</ul></>}
  </Sheet>;
}
const CELEB_L = (s?: string) => (s ? String(s).replace(/^celeb_/, "") + " stílus" : "előnézet");

/* ---------- what waits: big swiping cards, the count large, one big button. The same list as Teendők, in the same order: "Mind" is its continuation ---------- */
export function ActDeck({ T, go, fresh, noFlip }: { T: TodoState; go: (t: Tab) => void; fresh?: () => void; noFlip?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), touched = useRef(false);
  const open = T.open, cards = open.slice(0, 8);
  /* tasks arrive one source at a time: snapping would keep the old card in view, so the row stays on the first until she moves it */
  const first = cards[0]?.key || "";
  useEffect(() => { if (!touched.current && ref.current) ref.current.scrollLeft = 0; }, [first, cards.length]);
  if (!cards.length) return <section className="ma-deck"><h3 className="ink-h">Teendők</h3><p className="ma-deck-0">{T.ready ? "Nincs nyitott teendő." : "Betöltés…"}</p></section>;
  const by = (dir: number) => { touched.current = true; ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" }); };
  return <section className="ma-deck" aria-label="Teendők">
    <h3 className="ink-h"><span>Teendők <small>{fmt(open.length)}</small></span><span className="ma-deck-nav"><button onClick={() => by(-1)} aria-label="Előző kártya">‹</button><button onClick={() => by(1)} aria-label="Következő kártya">›</button><button className="lnk" onClick={() => go("todo")}>Mind ›</button></span></h3>
    <div className="ma-deck-row" ref={ref} onPointerDown={() => { touched.current = true; }}>{cards.map((x, i) => {
      const title = noEmoji(x.t), m = /^(\d[\d\s]*)\s+(.+)$/.exec(title), num = m?.[1], rest = m ? m[2] : title;
      const run = x.key === "work:late" && fresh ? fresh : x.act.run;
      return <article key={x.key} className={"ma-dk" + (i === 0 && !noFlip ? " ink-flip" : "")}>
        {num && <b className="ma-dk-n">{num}</b>}<h4>{rest}</h4>{x.s ? <p>{x.s}</p> : null}
        <div className="ma-dk-a"><button className="adm-ibtn gold" onClick={run}>{x.act.l}</button>{x.act.l !== "Kész" && x.act.l !== "Rendben" && <button className="adm-ibtn" onClick={() => T.act(x, "done")}>{I(P.check)}Kész</button>}<button className="adm-ibtn" onClick={() => T.act(x, "later")}>Holnap</button></div>
      </article>; })}</div>
  </section>;
}

/* ---------- the "Egy képernyős" view: what the day is, in one screen, without scrolling; the rest on request ---------- */
function MaOneScreen({ v, T, open, go, more }: { v: DayV; T: TodoState; open: (k: NK) => void; go: (t: Tab) => void; more: () => void }) {
  const main: TodoItem | undefined = T.open[0];
  return <section className="ma-1s" aria-label="A nap egy képernyőn">
    <button className="ma-1s-a" onClick={() => open("made")}><Giant v={v.made} max={84} /><small>előnézet {v.label}</small></button>
    <div className="ma-split-3 four">
      <button onClick={() => open("signups")}><b>{fm(v.signups)}</b><small>új fiók</small></button>
      <button onClick={() => open("sessions")}><b>{fm(v.sess)}</b><small>látogatás</small></button>
      <button onClick={() => open("saved")}><b>{fm(v.saved)}</b><small>mentés</small></button>
      <button onClick={() => open("shared")}><b>{fm(v.shared)}</b><small>megosztás</small></button>
    </div>
    <WeekPills v={v} />
    {main ? <button className="ma-1s-t" onClick={() => go("todo")}><small>A fő teendő · {fmt(T.open.length)} van összesen</small><b>{noEmoji(main.t)}</b></button> : <p className="ma-deck-0">{T.ready ? "Nincs nyitott teendő." : "Betöltés…"}</p>}
    <button className="ph-more" onClick={more}>Mutasd a többit{I(P.down)}</button>
  </section>;
}

/* ---------- the "Teendő-első" view: the one main task, large; the rest under it ---------- */
function MaTask({ T, go, all }: { T: TodoState; go: (t: Tab) => void; all?: boolean }) {
  const open = T.open, main = open[0];
  if (!main) return all ? <section className="ma-free"><b>Ma mindennel kész vagy.</b><span>Nincs nyitott teendő.</span><button className="lnk" onClick={() => go("todo")}>A teljes lista ›</button></section> : null;
  const rest = open.slice(1, all ? 40 : 3);
  return <section className="ma-task">
    <h3 className="ma-sec-h"><span>A fő teendő</span></h3><div className="ma-main"><b>{noEmoji(main.t)}</b>{main.s ? <p>{main.s}</p> : null}
      <div className="ma-acts"><button className="adm-ibtn gold" onClick={main.act.run}>{main.act.l}</button><button className="adm-ibtn" onClick={() => T.act(main, "done")}>{I(P.check)}Kész</button><button className="adm-ibtn" onClick={() => T.act(main, "later")}>Holnap</button></div></div>
    {rest.length > 0 && <div className="plist"><ul>{rest.map((a) => <li key={a.key}><SwipeRow done={() => T.act(a, "done")} later={() => T.act(a, "later")} open={a.act.run}><div className="pl-row"><span className="pl-i">{I(P.bolt)}</span><span className="pl-l">{noEmoji(a.t)}<small>{a.s}</small></span><span className="pl-c">›</span></div></SwipeRow></li>)}</ul>
      <p className="ph-hint">Húzd balra: Holnap · Kész</p></div>}
    {!all && open.length > 3 && <button className="lnk" onClick={() => go("todo")}>Mind a {fmt(open.length)} teendő ›</button>}
  </section>;
}

function MaChanges({ list, go }: { list: ReturnType<typeof changes>; go: (t: Tab) => void }) {
  if (!list.length) return <p className="ma-why ma-flat">Tegnap óta nincs szokatlan szám.</p>;
  return <section className="plist ma-chg"><h3>Mi a szokatlan</h3><ul>{list.map((x) => <li key={x.k}><button onClick={() => go(x.to)}><span className={"ma-tag " + (x.up ? "up" : "down")} aria-label={x.up ? "több" : "kevesebb"}>{x.up ? "↑" : "↓"}</span><span className="pl-l">{x.t}<small>{x.s}</small></span><span className="pl-c">›</span></button></li>)}</ul></section>;
}

/* ---------- the two goals: paying people today, the million ---------- */
function MaGoal({ go, usersAll, next, share, perDay, filtered }: { go: (t: Tab) => void; usersAll: number; next: number; share: number; perDay: number; filtered: boolean }) {
  const q = useRpc("admin_sales", { p_days: 30 }, []); const s = q.d as D | null;
  const g = useRpc("admin_setting_get", { p_k: "pay_goal" }, []); const min = n((g.d as D)?.min) || 10, max = n((g.d as D)?.max) || 50;
  const today = n(s?.today_people);
  const live = !!s?.live;
  const yearsTo = perDay > 0 ? (GOAL - usersAll) / perDay / 365 : null;
  return <section className="ma-goal">
    <div className="ma-g1"><h3 className="ma-sec-h"><span>Fizetők ma</span><small>cél: napi {min}-{max}</small></h3>
      {!s ? <div className="skel" style={{ height: 40 }} /> : !live && !today ? <p className="ma-why">Nem mérhető: a fizetés még nincs bekapcsolva, ezért nincs mit számolni.</p> : <>
        <p className="ma-gv"><b>{fmt(today)}</b> / {min}{today < min ? <small>még {fmt(min - today)} kell a mai célhoz</small> : <small>a napi cél megvan</small>}</p>
        <span className="ma-bar" role="img" aria-label={`${fmt(today)} a napi ${min}-ből`}><i style={{ width: `${Math.min(100, (today / Math.max(1, min)) * 100)}%` }} /></span>
        <small className="ma-why">7 napos átlag: {fmt(n(s.avg_7), 1)}/nap. A webes eladások forrása becslés.</small></>}
    </div>
    <GoalFlip usersAll={usersAll} next={next} share={share} filtered={filtered} go={go}>
      {yearsTo == null ? <small>Az első regisztrációk után látszik a tempó.</small> : <small>Az elmúlt 30 nap átlagával (napi ~{fmt(perDay, perDay < 10 ? 1 : 0)} új fiók) a következő cél, {fmt(next)} fiók, kb. {fmt(Math.ceil((next - usersAll) / perDay))} nap, az 1 millió {yearsTo > 100 ? "több mint 100" : "kb. " + fmt(Math.ceil(yearsTo))} év. Durva becslés: csak a mostani tempót vetíti előre.</small>}
    </GoalFlip>
  </section>;
}
/* the big goal in contrast: the real count against the million, the bar runs to the next milestone (a million would be an empty bar) */
export function GoalFlip({ usersAll, next, share, filtered, go, children }: { usersAll: number; next: number; share: number; filtered: boolean; go: (t: Tab) => void; children?: React.ReactNode }) {
  return <button className="ma-flip ink-flip" onClick={() => go("funnel")}>
    <span className="ma-flip-l">Út az 1 millióhoz{filtered ? " · szűrés nélkül" : ""}</span>
    <span className="ma-flip-v"><b>{fmt(usersAll)}</b><span>/ {fmt(GOAL)} felhasználó</span></span>
    <span className="ma-bar" role="img" aria-label={`${fmt(usersAll)} fiók, a következő cél ${fmt(next)}`}><i style={{ width: `${Math.max(1, Math.min(100, share * 100))}%` }} /></span>
    <small className="ma-flip-n">következő cél: {fmt(next)} fiók</small>
    {children}
  </button>;
}

/* ---------- morning: yesterday; evening: today; Sunday and Monday morning: the week in a mirror ---------- */
function MaMirror({ ex, hr, T, d }: { ex: D | null; hr: number; T: D; d: D }) {
  const f = finished(ex), y = f[f.length - 1], dow = (new Date().getDay() + 6) % 7;
  const week = dow === 6 || (dow === 0 && hr < 12);
  const [letter, setLetter] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const sum = (a: D[], k: string) => a.reduce((s, x) => s + n(x[k]), 0);
  const a = f.slice(-7), b = f.slice(-14, -7);
  const ask = async () => { setBusy(true); const r = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "letter", data: { ez_a_het: { elkeszult_alairas: sum(a, "made"), latogatas: sum(a, "sessions"), megosztas: sum(a, "shared"), mentes: sum(a, "saved") }, elozo_het: { elkeszult_alairas: sum(b, "made"), latogatas: sum(b, "sessions"), megosztas: sum(b, "shared"), mentes: sum(b, "saved") }, csatornak: (d.channels || []).slice(0, 8) } }) }); setBusy(false); setLetter(r.ok ? r.json?.text || "–" : r.json?.error || "Nem sikerült."); };
  if (week && a.length >= 3) {
    const rows = (([["made", "elkészült előnézet"], ["sessions", "látogatás"], ["shared", "megosztás"], ["saved", "mentés"]]) as [string, string][]).map(([k, l]) => ({ l, a: sum(a, k), b: sum(b, k) }));
    const good = rows.filter((x) => x.a > x.b), weak = rows.filter((x) => x.a < x.b);
    return <section className="ma-mirror"><span className="eyebrow">Heti tükör · az elmúlt 7 teljes nap</span>
      <p><b>Ami jól ment:</b> {good.length ? good.map((x) => `${x.l} ${fmt(x.b)} → ${fmt(x.a)}`).join(", ") : "ezen a héten egyik szám sem nőtt"}.</p>
      <p><b>Ami nem:</b> {weak.length ? weak.map((x) => `${x.l} ${fmt(x.b)} → ${fmt(x.a)}`).join(", ") : "egyik szám sem esett"}.</p>
      {letter ? <div className="ma-letter">{letter.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div> : <button className="adm-ibtn" onClick={ask} disabled={busy}>{I(P.spark)}{busy ? "Írom…" : "Mit próbálj jövő héten? (MI)"}</button>}
    </section>;
  }
  if (hr < 11 && y) return <section className="ma-mirror"><span className="eyebrow">Tegnap · reggeli visszatekintés</span><p>{fmt(n(y.made))} elkészült előnézet, {fmt(n(y.sessions))} látogatás, {fmt(n(y.shared))} megosztás, {fmt(n(y.saved))} mentés.</p></section>;
  if (hr >= 19) return <section className="ma-mirror"><span className="eyebrow">Esti mérleg · ma</span><p>{parts(T)}{n(T.shared) ? `, ${fmt(n(T.shared))} megosztás` : ""}.</p></section>;
  return null;
}

/* ---------- the day on one line of time ---------- */
const FEED_I: Record<string, string> = { signup: P.user, made: P.pen, post: P.social, note: P.doc, release: P.bolt, push: P.bell, inbox: P.mail };
function feedText(x: D) {
  switch (x.kind) {
    case "signup": return `${fmt(n(x.t))} új fiók`;
    case "made": return `${fmt(n(x.t))} előnézet készült`;
    case "post": return `${PF[x.t] || x.t}: ${x.s || "új poszt"}`;
    case "note": return `${NOTE_KIND[x.t] || "Jegyzet"}: ${x.s}`;
    case "release": return "Új verzió ment ki az oldalra (ebben az órában)";
    case "inbox": return `${fmt(n(x.t))} új komment vagy vélemény`;
    default: return noEmoji(String(x.s || "Jelzés"));
  }
}
export function MaFeed({ days, limit, go, big, day }: { days: number; limit: number; go: (t: Tab) => void; big?: boolean; day?: string }) {
  const today = todayK(), past = !!day && day !== today, back = past ? Math.round((Date.parse(today) - Date.parse(day!)) / 864e5) : 0, span = Math.max(days, back + 1);
  /* a past day asks for that day alone. Until the database function is installed the common list answers, and says when it does not reach that far */
  const dq = useRpc("admin_ma_feed_day", { p_day: day }, [day], !past);
  const whole = past && Array.isArray(dq.d), waiting = past && !dq.e && !dq.at && !dq.d;
  const q = useRpc("admin_ma_feed", { p_days: span }, [span], whole || waiting || (past && dq.busy));
  const [all, setAll] = useState(false);
  const list: D[] = whole ? (dq.d as unknown as D[]) : Array.isArray(q.d) ? (q.d as D[]) : [];
  const rows: D[] = list.filter((x) => !day || dayOf(x.at) === day);
  /* the common list holds 80 rows over all its days: it may stop before the end of the chosen day */
  const cut = past && !whole && list.length >= 80 && dayOf(list[list.length - 1].at) >= day!;
  const head = big ? "Hírfolyam" : past ? `Legutóbb, ${dayL(day!)}` : "Legutóbb";
  if (waiting || (past && dq.busy) || (!whole && !q.d)) return <section className="plist ma-feed"><h3>{head}</h3><div className="skel" style={{ height: 120 }} /></section>;
  if (!rows.length) return <section className="plist ma-feed"><h3>{head}</h3><p className="ma-why ma-flat">{cut ? "Ennek a napnak az idővonala most nem látszik: a lista a legutóbbi 80 eseménnyel megtelt." : past ? "Ezen a napon nem történt semmi, amit az idővonal mutatna." : "Ma még nem történt semmi, amit az idővonal mutatna."}</p></section>;
  const shown = all ? rows : rows.slice(0, limit); let lastDay = "";
  const items: React.ReactNode[] = [];
  shown.forEach((x, i) => {
    const dk = hu(x.at, { month: "long", day: "numeric", weekday: "long" });
    /* the day's title is a list item of its own: every event row looks the same */
    if (big && dk !== lastDay) items.push(<li key={"d" + dk} className="ma-day-li"><h4 className="ma-day">{dk}</h4></li>);
    lastDay = dk;
    const hourly = x.kind === "signup" || x.kind === "made" || x.kind === "inbox";
    items.push(<li key={i}><button onClick={() => go(x.to)}><time>{hhmm(x.at)}{hourly ? "-tól" : ""}</time><span className="pl-i">{I(FEED_I[x.kind] || P.spark)}</span><span className="pl-l">{feedText(x)}</span></button></li>);
  });
  return <section className={"plist ma-feed" + (big ? " big" : "")}><h3>{head}</h3><ul>{items}</ul>
    {rows.length > limit && !all && <button className="pt-all" onClick={() => setAll(true)}>Mind a {fmt(rows.length)}</button>}
    {cut && <p className="ma-why">Lehet, hogy nem teljes: a lista a legutóbbi 80 eseménnyel megtelt.</p>}
    <p className="ma-why">A fiókokat és az előnézeteket óránként összesítve mutatjuk, név nélkül.</p></section>;
}

/* ---------- the chart: a finger shows each day, two fingers zoom, the row above swipes between 7, 30 and 90 days ---------- */
const RANGES = [7, 30, 90];
function MaChart(p: MaP) {
  const { d, ex, ML, metric, setMetric, tr, marks, goalPerDay, onNote } = p;
  /* sign-ups by day come from the accounts themselves: the daily list has no such column */
  const su = useRpc("admin_users_stats", { p_days: 180 }, [], metric !== "signups");
  const suDays: D[] = useMemo(() => { const m = new Map<string, number>(((su.d as D)?.cum || []).map((y: D) => [String(y.t).slice(0, 10), n(y.n)])); if (!m.size) return []; const t = todayK(); return Array.from({ length: 180 }, (_, i) => { const k = shift(t, i - 179); return { t: k, signups: n(m.get(k)) }; }); }, [su.d]);
  const all: D[] = metric === "signups" ? suDays : ex?.days_all || [];
  const inDays = ["made", "sessions", "shared", "saved", "signups"].includes(metric) && all.length > 2;
  const [range, setRange] = useSaved<number>("phone_ma_range", 30); const [cmp, setCmp] = useState(false);
  const data = inDays ? all.slice(-range).map((x, i, a) => { const j = all.length - a.length + i - a.length; return { t: String(x.t), v: n(x[metric]), p: j >= 0 ? n(all[j][metric]) : undefined, partial: String(x.t).slice(0, 10) >= todayK() }; }) : tr;
  const x0 = useRef<number | null>(null);
  const sw = (dir: number) => { const i = RANGES.indexOf(range), j = i + dir; if (j >= 0 && j < RANGES.length) { haptic(5); setRange(RANGES[j]); } };
  const cur = data.reduce((a: number, x: { v: number }) => a + x.v, 0);
  return <section className="ma-chart">
    <div className="hscroll"><div className="adm-seg sm">{Object.keys(ML).filter((k) => k !== "scored").map((k) => <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}>{ML[k]}</button>)}</div></div>
    {inDays ? <div className="ma-ranges hscroll" onTouchStart={(e) => { x0.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(dx) > 50) sw(dx < 0 ? 1 : -1); }}>
      {RANGES.map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r} nap</button>)}<button className="ma-cmpb" onClick={() => setCmp(true)}>{I(P.layers)}Összevetés</button></div>
      : <p className="ma-why">{periodName(d)}</p>}
    <p className="ma-why"><b>{fmt(cur)}</b> {inDays ? `az elmúlt ${range} napban` : periodName(d)}.{inDays ? " Húzd rajta az ujjad a napokért, két ujjal nagyíthatsz. Szaggatott vonal: az előző ugyanennyi nap." : data.length > 1 ? " Húzd rajta az ujjad az értékekért." : ""}</p>
    <ChartBox data={data} label={ML[metric]} hourly={!inDays && d.bucket === "hour" && !["followers", "views", "gsc_clicks"].includes(metric)} marks={marks} goal={goalPerDay} height={220} name={"inkage-" + metric} onNote={onNote} />
    {cmp && <CompareSheet d={d} close={() => setCmp(false)} />}
  </section>;
}

/* two channels or two languages on one chart */
function CompareSheet({ d, close }: { d: D; close: () => void }) {
  const [kind, setKind] = useState<"ch" | "lang">("ch");
  const chs = ((d.channels || []) as D[]).map((x) => String(x.k)), lgs = ((d.langs || []) as D[]).map((x) => String(x.k)).filter((x) => x && x !== "?");
  const opts = kind === "ch" ? chs : lgs;
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [res, setRes] = useState<{ k: string; l: string; pts: { t: string; v: number }[]; color?: string }[] | null>(null); const [busy, setBusy] = useState(false);
  const A = a && opts.includes(a) ? a : opts[0] || "", B = b && opts.includes(b) ? b : opts[1] || "";
  const name = (k: string) => (kind === "ch" ? ch(k) : lang(k));
  const run = async () => {
    setBusy(true);
    const one = async (k: string, color: string) => { const { data } = await rpc(sb(), "admin_dashboard", { p_days: Math.min(d.days || 30, 90), p_from: null, p_to: null, p_ch: kind === "ch" ? k : null, p_lang: kind === "lang" ? k : null }); return { k, l: name(k), color, pts: (((data as D)?.trend || []) as D[]).map((x) => ({ t: String(x.t), v: n(x.sessions) })) }; };
    const r = await Promise.all([one(A, "var(--ser-0)"), one(B, "var(--ser-1)")]); setRes(r); setBusy(false);
  };
  return <Sheet title="Összevetés" sub={`Látogatás ${periodName(d)}, két csatorna vagy két nyelv egymás mellett`} close={close} tall foot={<button className="adm-ibtn gold" disabled={busy || !A || !B || A === B} onClick={run}>{busy ? "Töltöm…" : "Mutasd"}</button>}>
    <div className="ps-opts"><button aria-pressed={kind === "ch"} onClick={() => { setKind("ch"); setRes(null); }}>Két csatorna</button><button aria-pressed={kind === "lang"} onClick={() => { setKind("lang"); setRes(null); }}>Két nyelv</button></div>
    <Field label="Első"><select className="adm-in" value={A} onChange={(e) => { setA(e.target.value); setRes(null); }}>{opts.map((k) => <option key={k} value={k}>{name(k)}</option>)}</select></Field>
    <Field label="Második"><select className="adm-in" value={B} onChange={(e) => { setB(e.target.value); setRes(null); }}>{opts.map((k) => <option key={k} value={k}>{name(k)}</option>)}</select></Field>
    {A === B && A && <p className="ma-why">Válassz két különbözőt.</p>}
    {res && (new Set(res[0].pts.map((x) => x.t.slice(0, 10))).size <= 2 ? <><TrendChart data={res[0].pts.map((x, i) => ({ t: x.t, v: x.v, p: res[1].pts[i]?.v }))} label={res[0].l} prevLabel={res[1].l} hourly height={220} /><p className="ma-why">Folytonos: {res[0].l}. Szaggatott: {res[1].l}.</p></> : <MultiLine series={res} height={220} />)}
  </Sheet>;
}

function MaSources({ d, go }: { d: D; go: (t: Tab) => void }) {
  const { set } = useFlt();
  const chans = ((d.channels || []) as D[]).filter((c) => !NOSRC.has(c.k));
  return <section className="plist"><h3>Honnan jönnek <small className="ma-per">{periodName(d)}</small> <button className="lnk" onClick={() => go("traffic")}>Mind ›</button></h3>
    {chans.length ? <ul>{chans.slice(0, 3).map((c) => <li key={c.k}><button onClick={() => { set({ ch: c.k }); go("traffic"); }}><Logo k={c.k} size={30} /><span className="pl-l">{CH[c.k] ? ch(c.k) : c.k}<small>{pct(n(c.revealed), n(c.sessions))} nézi meg 50 év múlva</small></span><span className="pl-n" >{fmt(c.sessions)}</span><span className="pl-c">›</span></button></li>)}</ul>
      : <p className="ph-hint">Még nincs ismert forrás: tegyél rövid linket a videókba.</p>}</section>;
}

/* ---------- a little game, kept modest: this week's goals, streaks, her own records, milestones ---------- */
const STEPS_U = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
function milestoneImage(title: string, line: string) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, "#F7F3EA"); g.addColorStop(1, "#EDE4D3"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
  x.textAlign = "center"; x.fillStyle = "#1A1714"; x.font = "italic 600 96px 'Cormorant Garamond', serif"; x.fillText("InkAge", 540, 240);
  x.font = "700 170px Geist, sans-serif"; x.fillText(title, 540, 580); x.font = "500 52px Geist, sans-serif"; x.fillStyle = "#6E655A"; x.fillText(line, 540, 680);
  return new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
}
async function shareMilestone(title: string, line: string) {
  const b = await milestoneImage(title, line); if (!b) { toast("A kép nem sikerült"); return; }
  const file = new File([b], `inkage-${title.replace(/\D/g, "") || "merfoldko"}.png`, { type: "image/png" });
  if (MOCK) { toast("Kép elkészült"); return; }
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch { return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast("Kép elmentve");
}
function MaGame({ ex, d, postStreak, usersAll, go }: { ex: D | null; d: D; postStreak: number; usersAll: number; go: (t: Tab) => void }) {
  const g = useRpc("admin_goals_list", undefined, []);
  const goals = (Array.isArray(g.d) ? (g.d as D[]) : []).filter((x) => x.period === "week").slice(0, 3);
  const all: D[] = ex?.days_all || [], f = finished(ex);
  const streak = streakOf(all.map((x) => ({ v: n(x.made) })));
  const best = (k: string) => [...f].sort((a, b) => n(b[k]) - n(a[k]))[0];
  const bm = best("made"), bs = best("sessions");
  const weeks = f.length >= 7 ? Math.max(...f.map((_, i) => (i >= 6 ? f.slice(i - 6, i + 1).reduce((a, x) => a + n(x.made), 0) : 0))) : 0;
  const reached = STEPS_U.filter((x) => x <= usersAll).pop(), nx = STEPS_U.find((x) => x > usersAll);
  const madeAll = n(d.all?.made);
  return <section className="ma-game"><h2 className="ink-h">A heted</h2>
    {goals.length > 0 ? <ul className="ma-goals">{goals.map((x, i) => <li key={i}><span>{GOAL_M[x.metric] || x.metric}<b>{fmt(n(x.value))} / {fmt(n(x.target))}</b></span><span className="ma-bar"><i style={{ width: `${Math.min(100, (n(x.value) / Math.max(1, n(x.target))) * 100)}%` }} /></span></li>)}</ul>
      : <button className="lnk" onClick={() => go("goals")}>Még nincs heti célod: tűzz ki egyet ›</button>}
    <div className="ma-recs">
      <div><b>{streak}</b><small>napja készül minden nap előnézet</small></div>
      <div><b>{postStreak}</b><small>napja posztolsz minden nap</small></div>
      {bm && n(bm.made) > 0 && <div><b>{fmt(n(bm.made))}</b><small>előnézet a legjobb napon, {hu(bm.t, { month: "short", day: "numeric" })}</small></div>}
      {bs && n(bs.sessions) > 0 && <div><b>{fmt(n(bs.sessions))}</b><small>látogatás a legjobb napon, {hu(bs.t, { month: "short", day: "numeric" })}</small></div>}
      {weeks > 0 && <div><b>{fmt(weeks)}</b><small>előnézet a legjobb 7 napban</small></div>}
    </div>
    <p className="ma-why">Saját rekordjaid az elmúlt 120 napból. Fiók: {fmt(usersAll)}, elkészült előnézet: {fmt(madeAll)}.{nx ? ` Következő mérföldkő: ${fmt(nx)}. fiók.` : ""}</p>
    {reached && <button className="adm-ibtn" onClick={() => shareMilestone(fmt(reached), "fiók a Calligrán")}>{I(P.share)}Kép a {fmt(reached)}. fiókról</button>}
  </section>;
}

function MaMore({ d, posts, openP, opened }: { d: D; posts: D[]; openP: (p: D | null) => void; opened?: boolean }) {
  const { set } = useFlt();
  const [more, setMore] = useState(false); const on = more || opened;
  return <>{!opened && <button className="ph-more" onClick={() => setMore(!more)} aria-expanded={more}>{more ? "Kevesebb" : "Kiugrások, nyelvek, videók"}{I(P.down)}</button>}
    {on && <div className="ph-more-b">
      <section className="c"><h2 style={{ marginBottom: 10 }}>Kiugrások és visszaesések</h2><Spikes days={Math.max(7, d.days || 90)} /></section>
      <section className="c"><h2 style={{ marginBottom: 10 }}>Nyelvek</h2><LangCards langs={d.langs || []} onPick={(k) => set({ lang: k })} max={4} /></section>
      {posts.length > 0 && <section className="c"><h2 style={{ marginBottom: 10 }}>Legjobb videók és posztok</h2><div className="posts two">{posts.slice(0, 4).map((p, i) => <PostCard key={p.platform + p.post_id} p={p} rank={i + 1} compact onOpen={openP} />)}</div></section>}
    </div>}</>;
}

/* ---------- this tab's settings: the view, the cards in her order, the text size, notifications ---------- */
function MaSettings({ fx, setFx, view, setView, lay, setLay, order, close, push }: { fx: Fx; setFx: (f: Fx) => void; view: string; setView: (v: string) => void; lay: Lay; setLay: (l: Lay) => void; order: string[]; close: () => void; push: () => void }) {
  const [fs, setFs] = useState(() => { try { return localStorage.getItem(FS_KEY) || "m"; } catch { return "m"; } });
  const drag = useRef<{ i: number; y: number } | null>(null); const H = 52;
  const mv = (i: number, j: number) => { if (j < 0 || j >= order.length || i === j) return; const o = [...order]; const [x] = o.splice(i, 1); o.splice(j, 0, x); setLay({ ...lay, order: o }); haptic(5); };
  return <Sheet title="A Ma fül" close={close} tall foot={<button className="adm-ibtn" onClick={push}>{I(P.bell)}Értesítések</button>}>
    <h4 className="ps-t">Nézet</h4>
    <div className="ma-views">{VIEWS.map(([k, l, s]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}><b>{l}</b><small>{s}</small></button>)}</div>
    <h4 className="ps-t">Látvány</h4>
    <ul className="ma-fx">{([["story", "Reggeli sztori", "minden reggel az első megnyitáskor"], ["wall", "Előnézetfal a háttérben", "a nap előnézetei a számok mögött"], ["mood", "Hangulat-fény", "a fény a nap teljesítményével erősödik"]] as [keyof Fx, string, string][]).map(([k, l, s]) => <li key={k}><span><b>{l}</b><small>{s}</small></span><button className={"sw" + (fx[k] ? " on" : "")} role="switch" aria-checked={fx[k]} aria-label={l} onClick={() => setFx({ ...fx, [k]: !fx[k] })}><i /></button></li>)}</ul>
    <h4 className="ps-t">Kártyák: húzd vagy a nyilakkal rendezd, a kapcsolóval rejtsd el</h4>
    <ul className="ma-lay">{order.map((k, i) => { const on = !lay.hidden.includes(k), l = SECS.find((x) => x[0] === k)?.[1];
      return <li key={k} style={{ height: H }}>
        <span className="ma-h" aria-hidden="true" onPointerDown={(e) => { drag.current = { i, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { const s = drag.current; if (!s) return; const j = Math.max(0, Math.min(order.length - 1, s.i + Math.round((e.clientY - s.y) / H))); if (j !== s.i) { mv(s.i, j); drag.current = { i: j, y: s.y + (j - s.i) * H }; } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>≡</span>
        <span className="ma-ll">{l}</span>
        <button className="ma-up" onClick={() => mv(i, i - 1)} aria-label={`${l} feljebb`} disabled={i === 0}>↑</button>
        <button className="ma-up" onClick={() => mv(i, i + 1)} aria-label={`${l} lejjebb`} disabled={i === order.length - 1}>↓</button>
        <button className={"sw" + (on ? " on" : "")} role="switch" aria-checked={on} aria-label={l} onClick={() => setLay({ ...lay, hidden: on ? [...lay.hidden, k] : lay.hidden.filter((x) => x !== k) })}><i /></button>
      </li>; })}</ul>
    <button className="lnk" onClick={() => setLay({ order: [], hidden: [] })}>Eredeti sorrend</button>
    <h4 className="ps-t">Betűméret ezen a telefonon</h4>
    <div className="ps-opts">{[["sys", "A telefoné"], ["s", "Kisebb"], ["m", "Normál"], ["l", "Nagyobb"], ["xl", "Legnagyobb"]].map(([k, l]) => <button key={k} aria-pressed={fs === k} onClick={() => { setFs(k); applyFs(k); }}>{l}</button>)}</div>
  </Sheet>;
}
