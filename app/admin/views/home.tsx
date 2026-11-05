"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, CountUp, Delta, Donut, Empty, Heatmap, Info, Spark, chColor, compact, fmt, pct } from "../charts";
import { Logo, Stories, streakOf, type Story } from "../wow";
import { type StoryCard, CloseX, toast } from "../phone";
import { DeskHero, GoalFlip, PhoneMa, useLiveN } from "./ma";
import { Globe, LANG_LAND, StepBars, countryName, flag } from "../visuals";
import { ChartBox, More, MultiLine, PlatformToday, Spikes, WeekPlan } from "../extra";
import { PeopleToday } from "./people";
import { UserDrawer } from "./users";
import { AIC, AiNote, COUNTRY, Card, DOW, FUNNEL, FreshRow, GOAL, I, NOTE_KIND, P, PF, POOL, SOC, ago, big, ch, chCol, lang, n, periodName, rpc, series, type D, type Tab, useFlt, useRpc, Layer, useCardDays, useFreshSocial } from "../shared";
import { PfTabs, PostCard, PostDrawer, likeWord, viewWord, vsMedian } from "./social";
import { IOS_NOTE, huTill, noEmoji, signals, useActiveVisits, useSigState } from "./alerts";
import { useTodoItems, type TodoItem, type TodoState } from "./todo";

/* visits without a known source: the direct ones, and the Android app's opens (they carry none either) */
export const NOSRC = new Set(["közvetlen", "androidapp", "visszatérő"]);

export { noEmoji };
const VIDEO = (p: D) => ["video", "reel", "short", "shorts"].includes(String(p.kind || "").toLowerCase()) || p.platform === "tiktok" || p.platform === "youtube";
const ymdL = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

export function Home({ d, days, go, phone }: { d: D; days: number; go: (t: Tab) => void; phone?: boolean }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { f: flt, set } = useFlt();
  const filtered = !!(flt.ch || flt.lang);
  const [metric, setMetric] = useState<string>("made");
  const [soc, setSoc] = useState<D | null>(null);
  const [socN, setSocN] = useState(0); const [hp, setHp] = useState("all"); const [pm, setPm] = useState("x");
  useEffect(() => { rpc(sb, "admin_social", { p_days: Math.max(days || 3650, 7) }).then(({ data }) => { setSoc(data || null); if (data?.posts) POOL.posts = data.posts; }); }, [sb, days, socN]);
  useFreshSocial(soc?.accounts, () => setSocN((x) => x + 1));
  const reach = useRpc("admin_social_reach", undefined, []);
  const [spDays, spCtl] = useCardDays("spikes", 0);
  /* her own layout of this page: cards hidden, cards pinned to the top (kept in the database, every device) */
  const [lay, setLay] = useState<Lay>({ hidden: [], pinned: [] }); const [layOpen, setLayOpen] = useState(false);
  useEffect(() => { try { const c = JSON.parse(localStorage.getItem("inkage.admin.homelay") || "null"); if (c) setLay(c); } catch {} rpc(sb, "admin_setting_get", { p_k: "home_layout" }).then(({ data }) => { if (data && typeof data === "object" && !Array.isArray(data)) { const x = data as Partial<Lay>; setLay({ hidden: x.hidden || [], pinned: x.pinned || [] }); }; }); }, [sb]);
  const saveLay = (l: Lay) => { setLay(l); try { localStorage.setItem("inkage.admin.homelay", JSON.stringify(l)); } catch {} rpc(sb, "admin_setting_save", { p_k: "home_layout", p_v: l }).catch(() => null); };
  /* the page's extras: downloads, new followers, Google aligned to its delay, the curves, every article; the real total in a filtered view */
  const [ex, setEx] = useState<D | null>(null); const [grand, setGrand] = useState<D | null>(null); const [imp, setImp] = useState<D | null>(null); const [rs, setRs] = useState<D | null>(null);
  useEffect(() => { rpc(sb, "admin_home_extra", { p_days: days || 3650 }).then(({ data }) => setEx(data || null)); }, [sb, days]);
  useEffect(() => { if (filtered) rpc(sb, "admin_grand_total").then(({ data }) => setGrand(data || null)); else setGrand(null); }, [sb, filtered]);
  const impDays = Math.min(480, days || 480);
  useEffect(() => { rpc(sb, "admin_impressions", { p_days: impDays }).then(({ data }) => setImp(data || null)); }, [sb, impDays]);
  useEffect(() => { rpc(sb, "admin_rollup_status").then(({ data }) => setRs(data || null)); }, [sb]);
  /* the one list of what is to be done: the same on Ma, here, the badge and Teendők */
  const [todoUser, setTodoUser] = useState<string | null>(null);
  const T = useTodoItems({ d, go, openUser: setTodoUser });
  const liveN = useLiveN(d), act = useActiveVisits(d);
  const [notes, setNotes] = useState<D[]>([]); const [goals, setGoals] = useState<D[]>([]); const [openP, setOpenP] = useState<D | null>(null); const [noteN, setNoteN] = useState(0);
  const [spk, setSpk] = useState<{ t: string; label: string; color?: string }[]>([]);
  useEffect(() => { rpc(sb, "admin_notes_list", {}).then(({ data }) => setNotes(Array.isArray(data) ? data : [])); rpc(sb, "admin_goals_list").then(({ data }) => setGoals(Array.isArray(data) ? data : [])); }, [sb, noteN]);
  const N = d.now || {}, PV = d.prev || {}, A = d.all || {};
  /* the ring is the goal, a million users, and the real total: in a channel or language view it does not shrink to the filtered part */
  const usersAll = filtered && grand ? n(grand.users) : n(A.users);
  /* the pace is always the last 30 days' average, whatever period the header shows and whatever the filter: a forecast of years cannot jump with a menu */
  const su30 = useRpc("admin_users_stats", { p_days: 30 }, []);
  const age = d.first_event ? (Date.now() - new Date(d.first_event).getTime()) / 864e5 : 30;
  const su30n = (((su30.d as D)?.cum || []) as D[]).reduce((a, x) => a + n(x.n), 0);
  const perDay = su30n / Math.max(1, Math.min(30, age)) || (usersAll && d.first_event ? usersAll / Math.max(1, age) : 0);
  const STEPS = [1_000, 10_000, 100_000, GOAL];
  const next = STEPS.find((x) => x > usersAll) || GOAL, prevStep = [0, ...STEPS].filter((x) => x <= usersAll).pop() || 0;
  const eta = perDay > 0 ? (next - usersAll) / perDay : null;
  const prevTrend = d.prev_trend || [];
  /* the chart's choices: the period's events, and (by day) followers, views gained and Google clicks */
  const ML: Record<string, string> = { made: "Elkészült előnézet", sessions: "Látogatás", signups: "Regisztráció", shared: "Megosztás", saved: "Mentés", scored: "Előnézetig jutott látogatás", ...(d.bucket === "day" && ex?.series?.length ? { followers: "Követő", views: "Új megtekintés", gsc_clicks: "Google-kattintás" } : {}) };
  const m = ML[metric] ? metric : "made";
  const exSeries: D[] = ex?.series || [];
  const tr: { t: string; v: number; p?: number }[] = ["followers", "views", "gsc_clicks"].includes(m) ? exSeries.filter((x) => x[m] != null).map((x) => ({ t: String(x.t), v: n(x[m]) }))
    : (d.trend || []).map((x: D, i: number) => ({ t: x.t, v: n(x[m]), p: prevTrend[i] ? n(prevTrend[i][m]) : undefined, partial: !!x.partial }));
  const from = d.from ? new Date(d.from).getTime() : 0;
  /* every post inside the chart's range gets its dot (it was the 30 newest only) */
  const marks = [...(soc?.posts || []).filter((p: D) => p.created_at && new Date(p.created_at).getTime() >= from).slice(0, 300).map((p: D) => ({ t: p.created_at, label: `${PF[p.platform] || p.platform}: ${(p.title || "poszt").slice(0, 40)}`, color: chColor(p.platform) })),
    ...notes.map((x: D) => ({ t: x.day + "T12:00:00", label: `${NOTE_KIND[x.kind] || "Jegyzet"}: ${x.text}`, color: "var(--a-mut)" })), ...spk.map((x) => ({ ...x, label: "Kiugrás: " + x.label }))];
  /* every post against its own platform's usual views, so a Pinterest pin and a TikTok video can stand in one list */
  /* the posts are asked for 7 days at least ("a hét posztja" needs the whole week even at 24 óra or 3 nap); the period's
     own blocks take the posts of the period only */
  const allPosts: D[] = ((soc?.posts || []) as D[]).filter((p) => !from || (p.created_at && new Date(p.created_at).getTime() >= from));
  const vs = vsMedian(allPosts, soc?.cal || []);
  const byX = (a: D, b: D) => (vs(b) ?? -1) - (vs(a) ?? -1) || n(b.sessions) - n(a.sessions) || n(b.views) - n(a.views);
  /* the week's post: the one of the last 7 days that did best against its own platform; and the best on each platform */
  const week = ((soc?.posts || []) as D[]).filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 864e5).sort(byX);
  const weekPost = week[0];
  const weekBest = SOC.map((k) => week.find((p) => p.platform === k)).filter(Boolean) as D[];
  /* where the visitors of the last 30 minutes are, estimated from their language, each country as heavy as its visitors */
  const pinN: Record<string, number> = {};
  ((d.live || []) as D[]).filter((x) => Date.now() - new Date(x.created_at).getTime() < 30 * 60e3 && x.lang).forEach((x) => { const a2 = (LANG_LAND[String(x.lang).slice(0, 2)] || [])[0]; if (a2) pinN[a2] = (pinN[a2] || 0) + 1; });
  const pins = Object.entries(pinN).map(([a2, c]) => ({ a2, n: c }));
  /* a goal line per day; with a weekly and a monthly goal on one metric, the stricter pace is drawn and both are named */
  const gl = goals.filter((x: D) => x.metric === m && ["week", "month"].includes(x.period));
  const perDayOf = (x: D) => n(x.target) / (x.period === "week" ? 7 : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  const goalPerDay = gl.length && d.bucket === "day" && m !== "followers" ? Math.max(...gl.map(perDayOf)) : undefined;
    const chans = (d.channels || []) as D[];
  const topCh = chans.filter((c) => !NOSRC.has(c.k))[0];
  const f = (k: string) => n((d.funnel || []).find((x: D) => x.k === k)?.n);
  const heat = d.heat || [];
  const best = [...heat].sort((a: D, b: D) => n(b.n) - n(a.n))[0];
  const postPfs = SOC.filter((k) => allPosts.some((p) => p.platform === k));
  const PM: Record<string, [string, (p: D) => number | null]> = { x: ["Szorzó", (p) => vs(p)], likes: ["Kedvelés", (p) => n(p.likes)], saves: ["Mentés", (p) => (p.saves == null ? null : n(p.saves))],
    sessions: ["Látogató", (p) => (p.code ? n(p.sessions) : null)], rate: ["Látogató/1000", (p) => (p.code && n(p.views) > 0 ? (n(p.sessions) * 1000) / n(p.views) : null)], signups: ["Regisztráció", (p) => (p.code ? n(p.signups) : null)] };
  const pmf = (PM[pm] || PM.x)[1];
  const posts = allPosts.filter((p) => hp === "all" || p.platform === hp).sort((a, b) => (pmf(b) ?? -1) - (pmf(a) ?? -1) || byX(a, b)).slice(0, 4);
  const articles: D[] = ex?.articles || (d.pages || []).filter((p: D) => String(p.k).startsWith("/tudastar/"));
  /* the day in cards: records and streaks always by day (in the 24-hour view too), the strongest channel beside the streak */
  const allDays: D[] = ex?.days_all?.length ? ex.days_all : d.bucket === "day" ? d.trend || [] : [];
  const todayK = ymdL(new Date());
  const finished = allDays.filter((x) => String(x.t).slice(0, 10) < todayK);
  const yest = finished[finished.length - 1], rec = [...allDays].sort((a, b) => n(b.made) - n(a.made))[0];
  const streak = streakOf(allDays.map((x) => ({ v: n(x.made) })));
  const recIsYest = rec && yest && rec.t === yest.t;
  /* posting streak: the days in a row (up to today, or yesterday if nothing went out yet today) with at least one post anywhere */
  const postDays = new Set(((soc?.cal || []) as D[]).filter((p) => p.created_at).map((p) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date(p.created_at))));
  let postStreak = 0; { const t = new Date(); let k = 0; const key = (o: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date(t.getTime() - o * 864e5));
    if (!postDays.has(key(0))) k = 1; while (postDays.has(key(k))) { postStreak++; k++; } }
  const lr = ex?.latest_review;
  const stories: Story[] = [
    ...(rec && n(rec.made) > 0 ? [{ tone: "pink", kicker: recIsYest ? "Tegnap: rekordnap" : "Rekordnap", big: <CountUp v={n(rec.made)} />, line: <>elkészült előnézet · {new Date(rec.t).toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" })}{!recIsYest && yest ? <> · tegnap {fmt(yest.made)}</> : null}</> }] : []),
    ...(streak > 1 ? [{ tone: "lilac", kicker: "Sorozat", big: <>{streak} nap</>, line: <>ennyi napja készül minden nap előnézet</> }] : []),
    ...(postStreak > 1 ? [{ tone: "peach", kicker: "Posztolási sorozat", big: <>{postStreak} nap</>, line: <>ennyi napja posztolsz minden nap (bármelyik platformon) · ne szakítsd meg ma se</>, cta: "Tervező", run: () => go("planner") }] : []),
    ...(topCh ? [{ tone: "sky", kicker: "A legerősebb csatorna", big: ch(topCh.k), line: <>{fmt(topCh.sessions)} látogatás · {pct(n(topCh.revealed), n(topCh.sessions))} nézi meg 50 év múlva</>, cta: "Források", run: () => go("traffic") }] : []),
    ...(weekPost && vs(weekPost) != null ? [{ tone: "peach", kicker: `A hét ${VIDEO(weekPost) ? "videója" : "posztja"} · ${PF[weekPost.platform]}`, big: <>{fmt(vs(weekPost)!, 1)}×</>, line: <>a szokásos {viewWord(weekPost.platform)} · „{String(weekPost.title || "").slice(0, 50)}”</>, cta: "Megnézem", run: () => setOpenP(weekPost) }] : []),
    ...(n(ex?.followers_gain) > 0 ? [{ tone: "mint", kicker: "Új követők", big: <>+{fmt(ex!.followers_gain)}</>, line: <>{periodName(d)}, minden platformon együtt</>, cta: "Közönség", run: () => go("audience") }] : []),
    ...(lr ? [{ tone: "sky", kicker: `Új értékelés · ${lr.store === "apple" ? "App Store" : "Google Play"}`, big: <>{"★".repeat(n(lr.rating))}</>, line: <>{lr.author || "Névtelen"}: „{String(lr.body || "").slice(0, 80)}”</>, cta: "Válasz", run: () => go("inbox") }] : []),
  ];
  const isRec = (k: string) => { const v = series(d, k); return v.length > 3 && v[v.length - 1] > 0 && v[v.length - 1] >= Math.max(...v); };
  /* one sentence over the chart, written from the numbers */
  const curM = ["followers", "views", "gsc_clicks"].includes(m) ? tr.reduce((s, x) => s + x.v, 0) : n(N[m]);
  const chg = !["followers", "views", "gsc_clicks"].includes(m) && n(PV[m]) > 0 ? ((n(N[m]) - n(PV[m])) / n(PV[m])) * 100 : null;
  const headline = (m === "signups" || m === "made") && N[m] == null ? <>{ML[m]} csatornára vagy nyelvre szűrve nem bontható (a fiók nem tárolja, honnan jött).</>
    : m === "followers" ? <>Követők összesen: <b>{fmt(tr[tr.length - 1]?.v)}</b>; {periodName(d)} <b>{n(ex?.followers_gain) >= 0 ? "+" : ""}{fmt(ex?.followers_gain)}</b>.</>
    : <>{ML[m]}: <b>{fmt(curM)}</b> {periodName(d)}{chg != null && Math.abs(chg) >= 1 ? <>, <b className={chg > 0 ? "up" : "down"}>{fmt(Math.abs(chg))}%-kal {chg > 0 ? "több" : "kevesebb"}</b>, mint előtte</> : null}{m === "gsc_clicks" && ex?.gsc?.last ? <> (a Google {huTill(ex.gsc.last)} adott adatot)</> : null}{topCh && ["sessions", "scored"].includes(m) ? <>; a legtöbb azonosított látogató: <b>{ch(topCh.k)}</b></> : null}.</>;
  const goalNote2 = gl.length > 1 ? <span className="note">Célvonal: {gl.map((x) => `${x.period === "week" ? "heti" : "havi"} ${fmt(n(x.target))} (napi ~${fmt(perDayOf(x), 1)})`).join(" · ")}; a szigorúbb látszik.</span> : null;
  const ringShare = (usersAll - prevStep) / Math.max(1, next - prevStep);
  const goalNote = eta == null ? "Az első regisztrációk után itt látod, mikorra éred el a következő célt." : eta > 3650 ? "Az elmúlt 30 nap átlagával 10 évnél több a következő célig." : <>Az elmúlt 30 nap átlagával (napi ~{fmt(perDay, perDay < 10 ? 1 : 0)} új fiók) kb. <b>{fmt(Math.ceil(eta))} nap</b> a következő célig.</>;
  /* what the AI reads: the page's numbers plus the platforms, stores, Google and appearances (anonymous totals) */
  const aiData = { ...d, extra: ex ? { letoltes: ex.downloads, letoltes_elozo: ex.downloads_prev, uj_kovetok: ex.followers_gain, google: ex.gsc, cikkek: (ex.articles || []).slice(0, 15) } : null,
    megjelenes: imp ? { osszes: imp.totals, elozo: imp.prev, videomegtekintes_nem_megjelenes: imp.views } : null, kovetok: ((soc?.daily || []) as D[]).reduce((o: D, x) => { o[x.platform] = x.followers; return o; }, {}),
    posztok: [...allPosts].sort(byX).slice(0, 15).map((p) => ({ platform: p.platform, cim: String(p.title || "").slice(0, 60), megtekintes: p.views, szorzo: vs(p), latogato: p.sessions, regisztracio: p.signups })) };
  /* the share rate: of those who saw their new signatures, how many really shared (a save is not a share; the same on Megosztás and in the signals) */

  const shareRate = n(N.revealed_shared ?? N.scored_shared ?? N.shared) / Math.max(1, n(N.revealed ?? N.scored));
  /* the period before began before the first data: its tiles show no change (not "új") */
  const pv = (v: number) => (d.prev_partial ? undefined : v);

  const userDrawer = todoUser && <UserDrawer id={todoUser} close={() => setTodoUser(null)} />;
  if (phone) return <><PhoneMa d={d} go={go} T={T} ln={liveN} usersAll={usersAll} next={next} share={ringShare} perDay={perDay} tr={tr} metric={m} setMetric={setMetric} ML={ML} marks={marks} goalPerDay={goalPerDay} posts={posts} openP={setOpenP} openPost={openP} imp={imp} ex={ex} postStreak={postStreak} onNote={() => setNoteN((x) => x + 1)} />{userDrawer}</>;
  /* the cards behind "Részletek": one pinned to the top stands outside it, wherever the button is */
  const details: [string, React.ReactNode][] = [
    ["langs", <Card key="langs" className="s7 hk-langs" icon={P.globe} title="Milyen nyelven olvasnak" sub="A látogatások nyelve. Országot az események szándékosan nem tárolnak; mellette az áruházi letöltések és a Google-kattintások országai (ezek valódi országadatok)." right={<button className="lnk" onClick={() => go("markets")}>Piacok →</button>}>
        <LangCards langs={d.langs || []} onPick={(k) => set({ lang: k })} max={6} />
        <CountryPair ex={ex} />
      </Card>],
    ["chans", <Card key="chans" className="s5 hk-chans" icon={P.links} title="Honnan jönnek" sub="Az ismert forrású látogatások csatornánként. Kattints egy szeletre: minden erre szűr." right={<button className="lnk" onClick={() => go("traffic")}>Részletek →</button>}>
        <KnownShare chans={chans} total={n(N.sessions)} onPick={(k) => set({ ch: k })} go={go} size={150} />
      </Card>],
    ["path", <Card key="path" className="s6 hk-path" icon={P.funnel} title="Az út az appban" sub="A látogatások hány %-a jut el az egyes lépésekig, láncban: egy lépés csak azokat számolja, akik az előzőket is megtették (a megosztás is csak a végigmentekét). Ugyanaz a szám, mint a Tölcsér és a Használat oldalon; a Megosztás csempe ennél több: minden megosztót mutat." right={<button className="lnk" onClick={() => go("funnel")}>Teljes tölcsér →</button>}>
        <StepBars steps={["app", "named", "captured", "scored", "quiz", "revealed", "detail", "shared"].map((k) => ({ l: FUNNEL[k][0], n: f(k), base: f("sessions") }))} />
      </Card>],
    ["when", <Card key="when" className="s6 hk-when" icon={P.clock} title="Mikor jönnek" sub="Mikor kezdődnek a látogatások, a hét napjai és az órák szerint (budapesti idő). Ez a látogatók ideje, nem a posztjaidé: a posztolási időpontot a Tervező a posztjaid eredményéből számolja."
        right={best ? <span className="chip gold">Csúcs: {DOW[best.w]} {best.h}:00</span> : undefined}>
        {heat.length ? <Heatmap cells={heat} /> : <Empty t="Még nincs elég látogatás." />}
      </Card>],
    ["posts", <Card key="posts" className="s6 hk-posts" icon={P.social} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Legjobb videók és posztok" sub="Alapból minden poszt a saját platformja szokásos (medián) megtekintéséhez mérve: a 2× azt jelenti, kétszer annyian látták, mint egy átlagos posztodat ott. Válthatsz kedvelésre, mentésre, látogatóra, látogató/1000-re és regisztrációra is."
        right={<><PfTabs pfs={postPfs} v={hp} set={setHp} /><button className="lnk" onClick={() => go("social")}>Mind →</button></>}>
        <div className="adm-seg sm" role="group">{Object.entries(PM).map(([k, [l]]) => <button key={k} aria-pressed={pm === k} onClick={() => setPm(k)}>{l}</button>)}</div>
        {posts.length ? <div className="posts two">{posts.map((p, i) => <div key={p.platform + p.post_id} className="post-w"><PostCard p={p} rank={i + 1} compact mult={vs(p)} onOpen={setOpenP} /><PostMore p={p} /></div>)}</div>
          : <Empty title="Még nincs poszt" t={hp === "all" ? "Kösd be a közösségi fiókjaidat (TikTok, Instagram, Facebook, YouTube, Pinterest, LinkedIn), és itt látod, melyik posztod teljesít a legjobban." : `Ebben az időszakban nincs ${PF[hp] || hp}-poszt.`} icon={P.social}><button className="adm-ibtn gold" onClick={() => go("connect")}>Bekötés</button></Empty>}
      </Card>],
    ["articles", <Card key="articles" className="s6 hk-articles" icon={P.doc} src="gsc" title="Legolvasottabb cikkek" sub="A tudásbázis minden oldala az időszakban, a gépi látogatások szűrése után. A Google-oszlop alsó becslés: oldalra csak a kattintások egy része bontható, mert a Google a ritka kereséseket elrejti." right={<button className="lnk" onClick={() => go("search")}>Google-adatok →</button>}>
        <BarList items={articles.map((p: D) => ({ k: String(p.k).replace("/tudastar/", ""), n: n(p.n), sub: `${fmt(p.sessions)} látogató${p.gsc_clicks != null ? ` · ${fmt(p.gsc_clicks)} Google-kattintás` : ""}` }))} rank accent max={10} empty="Még nincs cikk-megtekintés." />
      </Card>],
    ["acts", <Card key="acts" className="s7 hk-acts" icon={P.spark} title="Amit most tudnod kell" sub="Automatikus jelzések a számokból (az állandó iPhone-megjegyzés és az élő létszám nélkül: azok fent látszanak)." right={<button className="lnk" onClick={() => go("alerts")}>Mind →</button>}>
        <Insights d={d} go={go} />
      </Card>],
    ["ai", <Card key="ai" className="s5 hk-ai" icon={P.bolt} title="Mit mondanak a számok?" sub="Az MI elolvassa ennek az oldalnak az anonim összesítőit (e-mail, név és élő esemény nélkül): a webet, a posztokat, a követőket, a letöltéseket, a Google-t és a megjelenéseket, és megírja a változásokat meg a hét három teendőjét.">
        <AiNote page="Áttekintés" data={aiData} />
      </Card>],
  ];
  return (
    <div className="g home-g">
      <style>{layCss(lay)}</style>
      {layOpen && <LayoutEditor lay={lay} save={saveLay} close={() => setLayOpen(false)} />}
      <section className="hello s12">
        <span className="eyebrow">{new Date().toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}</span>
        <button className="adm-ibtn sm lay-btn" onClick={() => setLayOpen(true)}>{I(P.layers)}Elrendezés</button>
      </section>
      <DeskHero d={d} ex={ex} go={go} T={T} ln={liveN} goal={<GoalFlip usersAll={usersAll} next={next} share={ringShare} filtered={filtered} go={go}>
        <span className="ms-chips">{STEPS.map((x) => <span key={x} className={x <= usersAll ? "done" : x === next ? "cur" : ""}>{x <= usersAll ? "✓ " : ""}{compact(x)}</span>)}</span>
        <small>{goalNote}{filtered ? " A szám a teljes összeg, a szűrő nem csökkenti." : ""}</small>
      </GoalFlip>} />
      <FreshRow srcs={["events", ...SOC, "gsc", "apple", "google", "index"]} />
      <MoreFresh rs={rs} ex={ex} />
      {/* with the Google channel chosen: our visits from Google and Search Console's clicks are two different numbers, side by side */}
      {(flt.ch || "").split(",").includes("google") && <div className="alert s12">
        <b>Google-ről jött látogatás (saját mérés, {periodName(d)}): {fmt(N.sessions)}</b> · <b>Google-kattintás a Search Console szerint: {fmt(ex?.gsc?.clicks)}</b>{ex?.gsc?.last ? ` (a Google ${huTill(ex.gsc.last)} adott adatot)` : ""}.
        {" "}A kettő nem ugyanaz: a látogatást mi mérjük valós időben (a Google-alkalmazásból és a képkeresésből jövőket is), a kattintást a Google 1–3 nap késéssel, a saját (amerikai) napjai szerint adja, és egy keresésből több látogatás is lehet.</div>}
      <Morning yest={yest} days7={finished.slice(-8, -1)} reach={reach.d as D | null} open0={T.open} best={week[0]} worst={week.length > 1 ? week[week.length - 1] : undefined} vs={vs} open={setOpenP} go={go} />

      <section className="s12 hk-stories"><Stories items={stories} /></section>

      <section className="s12 ih-tiles hk-tiles" aria-label={`Számok ${periodName(d)}`}>
        <h2 className="ih-h">Az időszak <small>{periodName(d)}</small></h2>
        <div className="ih-tg">
          <DT rec={isRec("made")} icon={P.pen} label="Elkészült előnézet" v={N.made == null ? "–" : <CountUp v={n(N.made)} />} now={N.made == null ? undefined : n(N.made)} prev={PV.made == null ? undefined : pv(n(PV.made))} cap={N.made == null ? "szűrt nézetben nem bontható" : "MI-előnézet, minden eszközről, a saját fiókjaid nélkül"} spark={N.made == null ? undefined : series(d, "made")} onClick={() => go("product")} />
          <DT icon={P.user} label="Előnézetet készített fiók" v={N.made_users == null ? "–" : <CountUp v={n(N.made_users)} />} now={N.made_users == null ? undefined : n(N.made_users)} prev={PV.made_users == null ? undefined : pv(n(PV.made_users))} cap={N.made_users == null ? "szűrt nézetben nem bontható" : `${fmt(A.made_users)} fiók eddig összesen`} onClick={() => go("users")} />
          <DT rec={isRec("sessions")} icon={P.eye} label="Látogatás" v={<CountUp v={n(N.sessions)} />} now={act ? act.now : n(N.sessions)} prev={pv(act ? act.prev : n(PV.sessions))} cap={`${act ? `a változás az aktív látogatásból: ${fmt(act.prev)} → ${fmt(act.now)} · ` : ""}ma ${fmt(liveN.today ?? d.today?.sessions)} · most ${fmt(liveN.now)}`} spark={series(d, "sessions")} onClick={() => go("traffic")} />
          {/* an account keeps no source: in a channel or language view the number is unknown, and her own accounts never count */}
          <DT icon={P.user} label="Regisztráció" v={N.signups == null ? "–" : <CountUp v={n(N.signups)} />} now={N.signups == null ? undefined : n(N.signups)} prev={PV.signups == null ? undefined : pv(n(PV.signups))} cap={N.signups == null ? "szűrt nézetben nem bontható" : `${fmt(A.users)} fiók összesen · saját és tesztfiókok nélkül`} spark={N.signups == null ? undefined : series(d, "signups")} onClick={() => go("users")} />
          <DT icon={P.share} label="Megosztás" v={<CountUp v={n(N.shared)} />} now={n(N.shared)} prev={pv(n(PV.shared))} cap={`valódi megosztás · az öregedést 50 év múlva megnézők ${fmt(shareRate * 100, shareRate < 0.1 ? 1 : 0)}%-a`} spark={series(d, "shared")} onClick={() => go("viral")} />
          <DT icon={P.doc} label="Mentés" v={<CountUp v={n(N.saved)} />} now={n(N.saved)} prev={pv(n(PV.saved))} cap="a mentés gomb: a kép a telefonra vagy a gépre kerül" spark={series(d, "saved")} onClick={() => go("product")} />
          <MoreTiles ex={ex} imp={imp} go={go} filtered={filtered} />
        </div>
      </section>
      {/* which numbers see which device: the iPhone app sends nothing on purpose, the machines are filtered by an estimate */}
      <p className="note s12" style={{ margin: "-4px 0 0" }}>Az elkészült előnézet és a regisztráció minden eszközről számol, az iPhone-t is beleértve. A látogatás, a megosztás és a mentés csak a weboldalt és az Android-appot látja: az iPhone-app szándékosan nem küld használati adatot, ezért a két fajta szám aránya nem pontos. A gépi látogatásokat becsléssel szűrjük ki. A saját fiókjaid az előnézetekből és a regisztrációból kimaradnak, a látogatásokból pedig az általad megjelölt eszközök és látogatások.</p>

      {/* the chart gets the whole width: the road to the million stands at the top now */}
      <section className="c s12 ih-chart hk-chart">
        <div className="c-h">
            <div><div><h2>Alakulás<Info>{ML[m]} {periodName(d)}; szaggatott vonal: az előző ugyanilyen hosszú időszak. A pontok a tengely alatt: a posztjaid (mind, ami az időszakba esik) és a jegyzeteid. A követő, a megtekintés és a Google-kattintás napi adat.</Info></h2></div></div>
            <div className="c-tools"><div className="adm-seg sm">{Object.keys(ML).filter((k) => k !== "scored").map((k) => <button key={k} aria-pressed={m === k} onClick={() => setMetric(k)}>{ML[k]}</button>)}</div></div>
          </div>
          <p className="headline">{headline}</p>
          <ChartBox data={tr} label={ML[m]} hourly={d.bucket === "hour" && !["followers", "views", "gsc_clicks"].includes(m)} marks={marks} goal={goalPerDay} height={300} name={"inkage-" + m} onNote={() => setNoteN((x) => x + 1)} />
          {goalNote2}
      </section>

      <ImpStrip x={imp} days={impDays} go={go} />
      <div className="s12 hk-platforms hk-wrap"><PlatformToday /></div>
      <div className="s12 hk-people hk-wrap"><PeopleTodayCard /></div>
      <FollowersCard soc={soc} go={go} />
      {weekPost && <section className="c s7 weekvid hk-weekvid" onClick={() => setOpenP(weekPost)}>
        <div className="wv-img">{weekPost.thumb ? <img src={weekPost.thumb} alt="" referrerPolicy="no-referrer" /> : <Logo k={weekPost.platform} size={64} />}</div>
        <div className="wv-b"><span className="eyebrow">A hét {VIDEO(weekPost) ? "videója" : "posztja"} · {PF[weekPost.platform]}{vs(weekPost) != null ? ` · a szokásos ${fmt(vs(weekPost)!, 1)}-szerese` : ""}</span><h2>{String(weekPost.title || "").slice(0, 90)}</h2>
          <div className="wv-n"><span><b>{big(weekPost.views)}</b>{viewWord(weekPost.platform)}</span><span><b>{big(weekPost.likes)}</b>{likeWord(weekPost.platform)}</span><span><b>{weekPost.code ? fmt(weekPost.sessions) : "–"}</b>látogató</span></div>
          {/* the best of the week on every platform, each against its own platform's median */}
          {weekBest.length > 1 && <div className="wv-pf" onClick={(e) => e.stopPropagation()}>{weekBest.map((p) => <button key={p.platform} className="chip" onClick={() => setOpenP(p)}><Logo k={p.platform} size={16} />{PF[p.platform]}: {vs(p) != null ? `${fmt(vs(p)!, 1)}×` : big(p.views)}</button>)}</div>}
          <small>{ago(weekPost.created_at)} · kattints a részletekért</small></div>
      </section>}
      <PayGoal />
      <Card className={(weekPost ? "s5" : "s6") + " hk-plan"} icon={P.target} title="A heti terv" sub="Hétfőnként 3 konkrét lépés a múlt hét számaiból; pipáld ki, szerkeszd vagy tervezd újra. A szám a hét eddigi részét a múlt hét ugyanilyen hosszú részéhez méri."><WeekPlan go={go} /></Card>
      <Card right={spCtl} className={(weekPost ? "s7" : "s6") + " hk-spikes"} icon={P.traffic} title="Kiugrások és visszaesések" sub="Minden nap, amikor a látogatás legalább 1,6-szorosa volt az előző két hét napi átlagának (vagy a fele sem volt); az átlag csak a mért napokból számol, és legalább 3 nap adat kell hozzá: melyik csatorna, nyelv és poszt hozta a többletet vagy a hiányt. A grafikonon pont jelöli. Legalább 7 napot néz (24 óránál és 3 napnál is)."><Spikes days={Math.max(7, spDays || 90)} onMarks={setSpk} /></Card>
      <section className="c s12 miniglobe hk-globe"><Globe pins={pins} size={200} /><div className="mg-t"><span className="eyebrow">Most az oldalon · {fmt(liveN.now)} ember<Info>Az országot a látogató nyelvéből becsüljük (az események szándékosan nem tárolnak országot); minél több látogató egy nyelvterületről, annál erősebb a pont.</Info></span>
        {pins.length ? <ul className="mg-l">{[...pins].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => <li key={x.a2}><b>{fmt(x.n)}</b>{countryName(x.a2)}</li>)}</ul> : <p className="note">Az elmúlt 30 percben nem volt látogató ismert nyelvvel.</p>}
        <button className="lnk" onClick={() => go("live")}>Élő nézet →</button></div></section>

      {details.filter(([k]) => lay.pinned.includes(k)).map(([, el]) => el)}
      <More label="Részletek: nyelvek, források, tölcsér, időpontok, posztok, cikkek, MI">{details.filter(([k]) => !lay.pinned.includes(k)).map(([, el]) => el)}</More>
      {openP && <PostDrawer p={openP} close={() => setOpenP(null)} />}
      {userDrawer}
    </div>
  );
}

/* the freshness of what the shared row does not know: the daily summary (spikes and experiments read it) and Bing */
function MoreFresh({ rs, ex }: { rs: D | null; ex: D | null }) {
  if (!rs) return null;
  const s = rs.state || {}, at = [s.recent?.at, s.week?.at, s.full?.at].filter(Boolean).sort().pop() as string | undefined;
  const wk = rs.jobs?.["admin-rollup-week"]?.last;
  /* a failed night run that was redone since (by hand, or the job's next run) is no longer red */
  const wkOk = !!wk && (wk.status !== "failed" || (!!s.week?.at && new Date(s.week.at) > new Date(wk.at)));
  const items: { k: string; ok: boolean; l: string; tip: string }[] = [];
  items.push({ k: "rollup", ok: !!at && Date.now() - new Date(at).getTime() < 30 * 60e3, l: `Napi összesítő: ${at ? ago(at) : "még nincs"}`, tip: "A Kiugrások, a Kísérletek és a heti terv erre épül; 10 percenként frissül." });
  if (wk) items.push({ k: "week", ok: wkOk, l: `Hajnali újraszámolás (7 nap): ${wkOk ? "rendben" : "hiba"}`, tip: `${new Date(wk.at).toLocaleString("hu-HU")}${wk.msg && !wkOk ? " · " + wk.msg : ""}${s.week?.at ? ` · utoljára lefutott: ${new Date(s.week.at).toLocaleString("hu-HU")}` : ""}` });
  /* the run can succeed and still bring nothing: no row means no data, whatever the run says */
  if (rs.bing || rs.bing_error) items.push({ k: "bing", ok: ex?.bing_has !== false && !!rs.bing && (!rs.bing_error || rs.bing > rs.bing_error), l: ex?.bing_has === false ? "Bing: lefut, de nincs adat" : `Bing: ${rs.bing ? ago(rs.bing) : "hiba"}`, tip: ex?.bing_has === false ? "A Bing eddig egyetlen napról sem adott keresési adatot." : rs.bing ? new Date(rs.bing).toLocaleString("hu-HU") : "az utolsó lehúzás hibára futott" });
  if (ex && !ex.stores_on) items.push({ k: "stores", ok: false, l: "Áruházak: nincs adat", tip: "Az App Store-ból és a Google Playből nem jött adat, ezért a letöltés most nem mérhető." });
  return <div className="s12 fresh-row">{items.map((x) => <span key={x.k} className={"fresh " + (x.ok ? "ok" : "old")} title={x.tip}><i />{x.l}</span>)}</div>;
}

/* a tile of the page: the label, the wide figure, the change in its pill, the curve in ink. A record says so in words. */
function DT({ icon, label, v, cap, now, prev, spark, rec, onClick }: { icon: string; label: string; v: React.ReactNode; cap?: React.ReactNode; now?: number; prev?: number; spark?: number[]; rec?: boolean; onClick: () => void }) {
  return <button type="button" className="ih-t" onClick={onClick}>
    <span className="ih-t-h"><i>{I(icon)}</i><span>{label}</span>{rec && <em>rekord</em>}</span>
    <b className="ih-t-v">{v}</b>
    {now != null && prev != null ? <span className="ih-t-d"><Delta now={now} prev={prev} /></span> : null}
    <small>{cap}</small>
    {spark && spark.length > 1 ? <span className="ih-t-sp"><Spark values={spark} h={34} color="currentColor" /></span> : null}
  </button>;
}

/* four more tiles: store downloads, new followers, Google clicks (aligned to Google's delay), appearances */
function MoreTiles({ ex, imp, go, filtered }: { ex: D | null; imp: D | null; go: (t: Tab) => void; filtered?: boolean }) {
  if (!ex) return null;
  const tot = imp ? Object.values((imp.totals || {}) as D).reduce((a: number, v) => a + n(v), 0) : 0, pv = imp ? Object.values((imp.prev || {}) as D).reduce((a: number, v) => a + n(v), 0) : 0;
  const g = ex.gsc || {};
  /* these four are calendar days and know no channel or language: in a filtered view they say so */
  const nf = filtered ? " · szűrés nélkül" : "";
  return <>
    <DT icon={P.layers} label="Letöltés" v={ex.stores_on ? <CountUp v={n(ex.downloads)} /> : "–"} now={ex.stores_on ? n(ex.downloads) : undefined} prev={ex.stores_on ? n(ex.downloads_prev) : undefined} cap={(ex.stores_on ? `App Store, és a Google Play, ha ad adatot; naptári napok${ex.stores_last ? `, ${huTill(ex.stores_last)} (az áruházak késve adnak adatot)` : ""}` : "az áruházakból nincs adat, ezért most nem mérhető") + nf} onClick={() => go("stores")} />
    {/* the period before is unknown when no follower count is older than it (it said −4: today's TikTok count) */}
    <DT icon={P.users} label="Új követő" v={ex.followers_on ? <>{n(ex.followers_gain) > 0 ? "+" : ""}<CountUp v={n(ex.followers_gain)} /></> : "–"} now={ex.followers_on && ex.followers_gain_prev != null ? n(ex.followers_gain) : undefined} prev={ex.followers_on && ex.followers_gain_prev != null ? n(ex.followers_gain_prev) : undefined} cap={(ex.followers_since && ex.followers_gain_prev == null ? `minden platformon együtt · ${new Date(ex.followers_since + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} óta mérjük` : "minden platformon együtt") + nf} onClick={() => go("audience")} />
    <DT icon={P.search} label="Google-kattintás" v={g.last ? <CountUp v={n(g.clicks)} /> : "–"} now={g.last && g.prev_known !== false ? n(g.clicks) : undefined} prev={g.last && g.prev_known !== false ? n(g.prev) : undefined} cap={(g.last ? `${huTill(g.last)} (a Google késése) · ${fmt(g.impressions)} megjelenés` : "a Google még nincs bekötve") + nf} onClick={() => go("search")} />
    <DT icon={P.eye} label="Megjelenés" v={tot ? big(tot) : "–"} now={tot || undefined} prev={tot && pv ? pv : undefined} cap={"Google, Bing, közösségi, App Store (videó-megtekintés nélkül)" + nf} onClick={() => go("impressions")} />
  </>;
}

/* followers per platform on one chart, the total in gold */
function FollowersCard({ soc, go }: { soc: D | null; go: (t: Tab) => void }) {
  const daily: D[] = (soc?.daily || []) as D[];
  const pfs = SOC.filter((k) => daily.some((x) => x.platform === k && x.followers != null));
  if (!pfs.length) return null;
  return (
    <Card className="s12 hk-followers" icon={P.users} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="Követők platformonként" sub="A napi pillanatképekből, legalább az elmúlt 30 napról (rövidebb időszaknál is); vastag vonal: az összes platform együtt." right={<button className="lnk" onClick={() => go("audience")}>Közönség →</button>}>
      <MultiLine total={pfs.length > 1} series={pfs.map((k) => ({ k, l: PF[k], pts: daily.filter((x) => x.platform === k && x.followers != null).map((x) => ({ t: String(x.day), v: n(x.followers) })) }))} height={220} />
    </Card>
  );
}

/* what the card itself does not show: sign-ups, reveals, saves, shares, completion */
function PostMore({ p }: { p: D }) {
  const bits = [p.code ? `${fmt(p.signups)} regisztráció` : "", p.code && n(p.revealed) ? `${fmt(p.revealed)} megnézte 50 év múlva` : "", p.saves != null ? `${big(p.saves)} mentés` : "", p.shares != null ? `${big(p.shares)} megosztás` : "",
    p.completion != null ? `${fmt(n(p.completion) <= 1 ? n(p.completion) * 100 : n(p.completion))}% végignézés` : ""].filter(Boolean);
  return bits.length ? <p className="post-more">{bits.join(" · ")}</p> : null;
}

/* the stores' and Google's countries beside the languages (real country data) */
function CountryPair({ ex }: { ex: D | null }) {
  const sc: D[] = ex?.store_countries || [], gc: D[] = ex?.gsc?.countries || [];
  if (!sc.length && !gc.length) return null;
  return (
    <div className="cpair">
      {sc.length > 0 && <div><span className="eyebrow">Letöltés országonként</span><BarList items={sc.map((x) => ({ k: String(x.k).length === 2 ? `${flag(String(x.k).toUpperCase())} ${String(x.k).toUpperCase()}` : String(x.k), n: n(x.n) }))} max={5} /></div>}
      {gc.length > 0 && <div><span className="eyebrow">Google-kattintás országonként{ex?.gsc?.clicks != null ? ` · ${fmt(ex.gsc.detail_clicks)} / ${fmt(ex.gsc.clicks)}` : ""}<Info>A Google országonkénti pontos összege. A legfrissebb napok még változhatnak.</Info></span><BarList items={gc.map((x) => ({ k: COUNTRY(x.k), n: n(x.clicks), sub: `${big(x.impressions)} megjelenés` }))} max={5} /></div>}
    </div>
  );
}


/* the morning story on the phone: yesterday, the record, the best channel, the streak, the most urgent signal */
export function dayStories(d: D, go: (t: Tab) => void, daysAll?: D[], open: TodoItem[] = []): StoryCard[] {
  /* the page opens on 24 hours, whose curve is hourly: the days come from the daily list when there is one */
  const tdays: D[] = daysAll?.length ? daysAll : d.bucket === "day" ? d.trend || [] : [];
  const tk = ymdL(new Date()), done = tdays.filter((x) => String(x.t).slice(0, 10) < tk);
  const yest = done[done.length - 1], rec = [...tdays].sort((a, b) => n(b.made) - n(a.made))[0];
  const streak = streakOf(tdays.map((x) => ({ v: n(x.made) })));
  const topCh = ((d.channels || []) as D[]).filter((c) => !NOSRC.has(c.k))[0];
  const urgent = open.find((x) => x.tone === "bad" || x.tone === "warn");
  return [
    ...(yest ? [{ tone: "peach", kicker: "Tegnap", big: fmt(yest.made), line: <>elkészült előnézet · {fmt(yest.sessions)} látogatás{yest.signups != null ? <> · {fmt(yest.signups)} új fiók</> : null}</> }] : []),
    ...(rec && n(rec.made) > 0 ? [{ tone: "pink", kicker: "Rekordnap", big: fmt(rec.made), line: <>elkészült előnézet egy nap alatt · {new Date(rec.t).toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}</> }] : []),
    ...(topCh ? [{ tone: "sky", kicker: "A legerősebb csatorna", big: <span className="so-fit" style={{ ["--n" as string]: [...ch(topCh.k)].length }}>{ch(topCh.k)}</span>, line: <>{fmt(topCh.sessions)} látogatás · {pct(n(topCh.revealed), n(topCh.sessions))} nézi meg 50 év múlva</>, cta: "Források", run: () => go("traffic") }] : []),
    ...(streak > 1 ? [{ tone: "lilac", kicker: "Sorozat", big: `${streak} nap`, line: <>ennyi napja készül minden nap előnézet. Tartsd életben egy új videóval!</> }] : []),
    ...(urgent ? [{ tone: "butter", kicker: "A mai teendő", big: <span style={{ fontSize: ".42em", lineHeight: 1.1, display: "block" }}>{noEmoji(urgent.t)}</span>, line: urgent.s, cta: urgent.act.l, run: urgent.act.run }] : []),
  ];
}


/* languages as cards with a flag: an honest stand-in for the map until countries are measured */
export function LangCards({ langs, onPick, max = 6 }: { langs: D[]; onPick?: (k: string) => void; max?: number }) {
  const rows = langs.filter((l) => l.k && l.k !== "?" && n(l.n) > 0).sort((a, b) => n(b.n) - n(a.n));
  const tot = rows.reduce((s2, x) => s2 + n(x.n), 0) || 1, top = n(rows[0]?.n) || 1;
  if (!rows.length) return <Empty t="Még nincs látogatás ebben az időszakban." icon={P.globe} />;
  return (
    <div className="lgc">
      {rows.slice(0, max).map((l, i) => (
        <button key={l.k} className="lgc-i" onClick={onPick ? () => onPick(l.k) : undefined}>
          <span className="lgc-f">{flag((LANG_LAND[String(l.k).slice(0, 2)] || [])[0])}</span>
          <span className="lgc-n"><b>{lang(l.k)}</b><small>{l.revealed != null ? `${pct(n(l.revealed), n(l.n))} nézi meg 50 év múlva` : `${pct(n(l.scored), n(l.n))} jut el az előnézetig`}</small></span>
          <span className="lgc-v"><b>{fmt(l.n)}</b><small>{i === 0 ? "#1 · " : ""}{pct(n(l.n), tot)}</small></span>
          <span className="lgc-b"><i style={{ width: `${(n(l.n) / top) * 100}%` }} /></span>
        </button>
      ))}
    </div>
  );
}


/* the donut shows only the sources we know; the unknown share sits apart in one quiet strip */
export function KnownShare({ chans, total, onPick, go, size = 176 }: { chans: D[]; total: number; onPick?: (k: string) => void; go?: (t: Tab) => void; size?: number }) {
  const known = chans.filter((c) => !NOSRC.has(c.k) && n(c.sessions) > 0);
  const kn = known.reduce((s2, c) => s2 + n(c.sessions), 0), unk = Math.max(0, total - kn);
  return (
    <div className="kshare">
      {known.length ? <Donut items={known.map((c) => ({ k: c.k, n: n(c.sessions) }))} center={fmt(kn)} sub="ismert forrás" color={chCol} label={ch} onPick={onPick} size={size} />
        : <Empty t="Még egyetlen látogatásnál sem tudjuk, honnan jött." icon={P.links} />}
      {total > 0 && <div className="unk" onClick={go ? () => go("links") : undefined} role={go ? "button" : undefined}>
        <div className="unk-t"><span>Ismeretlen forrás</span><b>{pct(unk, total)}</b></div>
        <span className="unk-b"><i style={{ width: `${(unk / total) * 100}%` }} /></span>
        <small>{fmt(unk)} látogatás link nélkül érkezett · rövid linkkel ez csökken →</small>
      </div>}
    </div>
  );
}

/* the signals worth a look: the iPhone note and the live head count are said elsewhere and no longer take the room */
export function Insights({ d, go }: { d: D; go: (t: Tab) => void }) {
  const all = signals(d), S = useSigState(all);
  const out = all.filter((x) => !IOS_NOTE.test(x.t) && !S.hidden(x));
  if (!out.length) return <Empty t="Most nincs jelzés. Minden rendben." icon={P.check} />;
  return (
    <ul className="ins">
      {out.slice(0, 6).map((x, i) => (
        <li key={i} className={x.c + (x.to ? " go" : "")} onClick={x.to ? () => go(x.to!) : undefined}>
          <span className="ic">{I(AIC[x.c])}</span>
          <div><b>{x.t}</b><span className="t">{x.s}</span></div>
          {x.to ? <span className="arr">→</span> : <span />}
        </li>
      ))}
    </ul>
  );
}


/* appearances in one line: everywhere we were shown in the period, and where. admin_impressions already counts each source over
   the same number of days up to its own last day, so the change needs no correction of its own (Google counted 40% too much at 7 days). */
const IMP_L: Record<string, string> = { google: "Google", appstore: "App Store", bing: "Bing", play: "Google Play" };
export function ImpStrip({ x, days, go }: { x: D | null; days: number; go: (t: Tab) => void }) {
  if (!x) return null;
  /* Instagram and Facebook give plays, another measure: left out, as on the Megjelenések page */
  const PLAYS = ["instagram", "facebook"];
  const T: D = x.totals || {}, P0: D = x.prev || {}, ks = Object.keys(T).filter((k) => !PLAYS.includes(k)).sort((a, b) => n(T[b]) - n(T[a]));
  const tot = ks.reduce((a, k) => a + n(T[k]), 0), pv = Object.keys(P0).filter((k) => !PLAYS.includes(k)).reduce((a, k) => a + n(P0[k]), 0);


  if (!tot) return (
    <section className="c s12 imp-strip empty hk-imp" onClick={() => go("connect")} role="button">
      <div><span className="eyebrow">Megjelenés · {days} nap</span><b>–</b></div>
      <span className="note">Még nincs megjelenés-adat: a Google Search Console, a közösségi fiókok, a Bing és az App Store bekötése után itt látod, hányszor mutattak minket.</span>
      <span className="lnk">Bekötés →</span>
    </section>
  );
  return (
    <section className="c s12 imp-strip hk-imp" onClick={() => go("impressions")} role="button">
      <div><span className="eyebrow">Megjelenés · {days} nap<Info>Minden forrás ugyanannyi napot számol, a saját legutolsó adatáig (a Google 1–3 nappal késik).</Info></span><b>{big(tot)}</b>{pv > 0 && <Delta now={Math.round(tot)} prev={pv} />}</div>
      <div className="imp-strip-l">{ks.map((k) => <span key={k}>{k === "appstore" ? <Logo k="apple" size={20} /> : <Logo k={k} size={20} />}<b>{big(T[k])}</b><small>{IMP_L[k] || PF[k] || k}</small></span>)}
        {/* video views are not appearances: shown apart, never added to the total */}
        {Object.entries((x.views || {}) as D).filter(([, v]) => n(v) > 0).map(([k, v]) => <span key={"v" + k} className="mut" title="Videó-megtekintés: nem megjelenés, nincs az összegben"><Logo k={k} size={20} /><b>{big(v)}</b><small>{PF[k] || k}-megtekintés</small></span>)}</div>
      <span className="lnk">Mi kapcsán? →</span>
    </section>
  );
}


/* ---------- the morning in 30 seconds: yesterday's three numbers, the day's three tasks, the week's best and weakest post ---------- */
function Morning({ yest, days7, reach, open0, best, worst, vs, open, go }: { yest?: D; days7: D[]; reach: D | null; open0: TodoState["open"]; best?: D; worst?: D; vs: (p: D) => number | null; open: (p: D) => void; go: (t: Tab) => void }) {
  const avg = (k: string) => (days7.length ? days7.reduce((t, x) => t + n(x[k]), 0) / days7.length : null);
  /* yesterday's views on every platform that counts views (the "prev" side of the one-day window is yesterday) */
  const cells: D[] = reach?.cells || [];
  const yv = cells.filter((c) => c.k === 1 && c.per === "prev" && !["pinterest", "linkedin"].includes(c.platform));
  const views = yv.some((c) => c.views != null || c.acc_views != null) ? yv.reduce((t, c) => t + n(c.views ?? c.acc_views), 0) : null;
  const say = (v: number | null | undefined, a: number | null) => (v == null || a == null || a === 0 ? null : v >= a * 1.25 ? ["up", `a heti átlag ${fmt(v / a, 1)}-szerese`] : v <= a * 0.75 ? ["down", `a heti átlag ${fmt((v / a) * 100)}%-a`] : ["", "a szokásos körül"]);
  const nums: [string, number | null | undefined, ReturnType<typeof say>, Tab][] = [
    ["elkészült előnézet", yest ? n(yest.made) : null, say(yest ? n(yest.made) : null, avg("made")), "product"],
    ["látogatás", yest ? n(yest.sessions) : null, say(yest ? n(yest.sessions) : null, avg("sessions")), "traffic"],
    ["megtekintés a közösségi oldalakon", views, null, "social"],
  ];
  /* only what is still open: the same list as Teendők */
  const top = open0.slice(0, 3);
  return (
    <section className="c s12 morning hk-morning">
      <div className="mo-h"><span className="eyebrow">Reggel 30 másodpercben · tegnap</span>{!open0.some((a) => a.tone === "bad" || a.tone === "warn") && <span className="chip good">Minden rendben</span>}</div>
      <div className="mo-n">{nums.map(([l, v, s, to]) => (
        <button key={l} className="mo-i" onClick={() => go(to)}><b>{v == null ? "–" : big(v)}</b><span>{l}</span>{s && <small className={s[0]}>{s[1]}</small>}</button>))}</div>
      <div className="mo-g">
        <div><h4>A nap teendői</h4>{top.length ? <ol className="mo-t">{top.map((a, i) => <li key={i}><button onClick={a.act.run}><b>{noEmoji(a.t)}</b><small>{a.act.l} →</small></button></li>)}</ol> : <p className="note">Nincs teendő: minden rendben.</p>}</div>
        <div><h4>A hét posztjai</h4>
          {best ? <button className="mo-p good" onClick={() => open(best)}><span>Legjobb · {PF[best.platform]}</span><b>{String(best.title || "(nincs szöveg)").slice(0, 60)}</b><small>{vs(best) != null ? `${fmt(vs(best)!, 1)}× a szokásos` : big(best.views) + " " + viewWord(best.platform)}</small></button> : <p className="note">Az elmúlt 7 napban nem volt poszt.</p>}
          {worst && worst !== best && <button className="mo-p bad" onClick={() => open(worst)}><span>Leggyengébb · {PF[worst.platform]}</span><b>{String(worst.title || "(nincs szöveg)").slice(0, 60)}</b><small>{vs(worst) != null ? `${fmt(vs(worst)!, 1)}× a szokásos` : big(worst.views) + " " + viewWord(worst.platform)}</small></button>}
        </div>
      </div>
    </section>
  );
}

/* ---------- the page's own layout ---------- */
type Lay = { hidden: string[]; pinned: string[] };
const HOME_CARDS: [string, string][] = [["morning", "Reggel 30 másodpercben"], ["stories", "A nap kártyái"], ["tiles", "Az időszak csempéi"], ["chart", "Alakulás"], ["imp", "Megjelenés"], ["platforms", "Platformok ma"], ["people", "Kivel foglalkozz ma"], ["weekvid", "A hét videója"], ["pay", "Fizetők ma"], ["globe", "Most az oldalon"], ["acts", "Amit most tudnod kell"], ["plan", "A heti terv"], ["spikes", "Kiugrások és visszaesések"], ["posts", "Legjobb videók és posztok"],
  ["followers", "Követők platformonként"], ["chans", "Honnan jönnek"], ["path", "Az út az appban"], ["when", "Mikor jönnek"], ["langs", "Milyen nyelven olvasnak"], ["articles", "Legolvasottabb cikkek"], ["ai", "Mit mondanak a számok?"]];
const layCss = (l: Lay) => [".home-g>.hello{order:-30}",
  ...l.pinned.map((k, i) => `.home-g>.hk-${k}{order:${-20 + i}}`), ...l.hidden.map((k) => `.home-g>.hk-${k}{display:none!important}`)].join("");
function LayoutEditor({ lay, save, close }: { lay: Lay; save: (l: Lay) => void; close: () => void }) {
  const tog = (k: string, f: "hidden" | "pinned") => save({ ...lay, [f]: lay[f].includes(k) ? lay[f].filter((x) => x !== k) : [...lay[f], k] });
  const mv = (k: string, d: number) => { const p = [...lay.pinned], i = p.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; save({ ...lay, pinned: p }); };
  const list = [...lay.pinned.map((k) => HOME_CARDS.find((c) => c[0] === k)).filter(Boolean) as [string, string][], ...HOME_CARDS.filter((c) => !lay.pinned.includes(c[0]))];
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Elrendezés">
        <div className="c-h"><div><div><span className="eyebrow">Áttekintés</span><h2 style={{ fontSize: 20, marginTop: 6 }}>Az oldal elrendezése</h2></div></div><CloseX close={close} /></div>
        <p className="note">Rejtsd el, ami most nem kell, és tűzd felülre, amit minden reggel elsőnek látnál. Minden eszközödön így jelenik meg.</p>
        <ul className="lay-l">{list.map(([k, l]) => { const pin = lay.pinned.includes(k), hid = lay.hidden.includes(k);
          return <li key={k} className={hid ? "hid" : ""}><b>{l}</b>
            <span>{pin && <><button className="lnk" onClick={() => mv(k, -1)} aria-label="Feljebb">↑</button><button className="lnk" onClick={() => mv(k, 1)} aria-label="Lejjebb">↓</button></>}
              <button className={"adm-ibtn sm" + (pin ? " on" : "")} onClick={() => tog(k, "pinned")}>{pin ? "Felül ✓" : "Felülre"}</button>
              <button className="adm-ibtn sm" onClick={() => tog(k, "hidden")}>{hid ? "Megjelenítés" : "Elrejtés"}</button></span></li>; })}</ul>
        <button className="lnk" onClick={() => save({ hidden: [], pinned: [] })}>Alapértelmezett elrendezés</button>
      </aside>
    </Layer>
  );
}

/* "Kivel foglalkozz ma" on the home page, opening the account in its own panel */
function PeopleTodayCard() {
  const [open, setOpen] = useState<string | null>(null);
  return <><PeopleToday open={setOpen} max={6} />{open && <UserDrawer id={open} close={() => setOpen(null)} />}</>;
}

/* the goal in one card: paying people every day against her own target (10-50 until she sets another; kept with her settings) */

function PayGoal() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [d, setD] = useState<any>(null);
  useEffect(() => { rpc(sb, "admin_sales", { p_days: 30 }).then(({ data }: any) => setD(data || {})); }, [sb]);
  const [goal, setGoal] = useState({ min: 10, max: 50 });
  /* what she is typing: saved when she leaves the field, and only if it makes sense */
  const [draft, setDraft] = useState<{ min: string; max: string } | null>(null);
  useEffect(() => { rpc(sb, "admin_setting_get", { p_k: "pay_goal" }).then(({ data }: any) => { if (data && n(data.min) > 0) setGoal({ min: n(data.min), max: Math.max(n(data.min), n(data.max)) }); }); }, [sb]);
  const typed = draft || { min: String(goal.min), max: String(goal.max) };
  const type = (k: "min" | "max", v: string) => setDraft({ ...typed, [k]: v.replace(/\D/g, "") });
  const commit = () => {
    if (!draft) return;
    const g = { min: Number(draft.min), max: Number(draft.max) }; setDraft(null);
    if (g.min === goal.min && g.max === goal.max) return;
    if (!(g.min > 0) || g.max < g.min) { toast("Nem lehet: az alsó határ legalább 1, és nem nagyobb a felsőnél. Maradt az előző cél."); return; }
    setGoal(g);
    rpc(sb, "admin_setting_save", { p_k: "pay_goal", p_v: g }).then(({ error }: any) => toast(error ? "Nem sikerült menteni a célt" : "Cél elmentve")).catch(() => toast("Nem sikerült menteni a célt"));
  };
  const PAY_MIN = goal.min, PAY_MAX = goal.max;
  const today = n(d?.today_people), gap = Math.max(0, PAY_MIN - today);
  const rev = Object.entries(d?.today_rev || {}).map(([c, v]) => `${Math.round(Number(v) * 100) / 100} ${c}`).join(", ") || "0";
  return (
    <Card className="s12 hk-pay" icon={P.target} title="Fizetők ma a célhoz képest" sub={`Cél: napi ${PAY_MIN}-${PAY_MAX} fizető (jobbra átírhatod). A webes forrás becslés, a store-eladásokat a store neve jelöli.`} right={<span className="adm-row" style={{ gap: 4 }}><input className="adm-in sm" style={{ width: 56 }} inputMode="numeric" aria-label="Napi cél alja" value={typed.min} onChange={(e) => type("min", e.target.value)} onBlur={commit} />–<input className="adm-in sm" style={{ width: 56 }} inputMode="numeric" aria-label="Napi cél teteje" value={typed.max} onChange={(e) => type("max", e.target.value)} onBlur={commit} /></span>}>
      {d === null ? <Empty t="Betöltés…" /> : <>
        <div className="ih-pay"><b>{today}</b><span><strong>fizető ma</strong>{gap ? `még ${gap} kell a napi ${PAY_MIN}-hez` : `megvan a napi ${PAY_MIN}`}</span><span><strong>{rev}</strong>bevétel ma</span><span><strong>{d.avg_7 ?? 0}/nap</strong>7 napos átlag</span></div>
        {(d.by_source || []).length ? <table className="adm-t"><thead><tr><th>Forrás (30 nap)</th><th>Fizető</th><th>Eladás</th><th>Bevétel</th></tr></thead><tbody>
          {d.by_source.map((r: any) => <tr key={r.source + r.currency}><td>{r.source}</td><td>{r.people}</td><td>{r.sales}</td><td>{Math.round(Number(r.rev) * 100) / 100} {r.currency}</td></tr>)}
        </tbody></table> : <Empty t={d.live ? "Még nincs eladás." : "Még nincs eladás: a fizetés most nincs bekapcsolva."} />}
      </>}
    </Card>
  );
}
