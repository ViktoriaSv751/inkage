"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CountUp, Delta, PrevPartialCtx, chColor, compact, fmt, pct } from "./charts";
import { MorningStory, MoreScreen, SubTabs, Toaster, usePhone, useScrolled, useSheetDrag, useSwipe, type MoreRow, toast } from "./phone";
import { Globe, GlowRing, LANG_LAND, StepBars, flag, type Tone } from "./visuals";
import { Logo } from "./wow";
import { AIC, ALL, EXPIRED, FltCtx, FreshCtx, GOAL, GT, HIDDEN, I, Loading, MOCK, NAV, P, PA, PERIODS, PROV, PSUB, PeriodCtx, RefreshCtx, SHORT, SOLVED, TABBAR, THEME_L, ago, alerts, api, ch, chCol, ev, lang, makePeriod, n, periodName,
  readFlt, readPeriod, rpc, secOf, type Alert, type D, type Flt, type PSec, type Tab, writeFlt, writePeriod, Layer, solvedAt, FUNNEL, big, useScrollLock, markOwnDevice, useFreshData, useTheme , chList, chToggle , ASKQ } from "./shared";
import { usePush } from "./extra";
import { Alerts, signals, useSigState } from "./views/alerts";
import { Connect } from "./views/connect";
import { FunnelTab } from "./views/funnel";
import { Goals } from "./views/goals";
import { Home, dayStories } from "./views/home";
import { Links } from "./views/links";
import { Live } from "./views/live";
import { Markets } from "./views/markets";
import { Product } from "./views/product";
import { Retention } from "./views/retention";
import { PageDrawer, Search } from "./views/search";
import { PostDrawer, Social } from "./views/social";
import { Stores } from "./views/stores";
import { System } from "./views/system";
import { Traffic } from "./views/traffic";
import { UserDrawer, Users } from "./views/users";
import { Viral } from "./views/viral";
import { InkAge } from "./views/inkage";
import { Inbox } from "./views/inbox";
import { Planner } from "./views/planner";
import { Audience } from "./views/audience";
import { Ask } from "./views/ask";
import { Report } from "./views/report";
import { YouTube } from "./views/youtube";
import { Impressions } from "./views/impressions";
import { Seo } from "./views/seo";
import { Brand } from "./views/brand";
import { Monitor } from "./views/monitor";
import { Platforms } from "./views/platforms";
import { Glossary } from "./views/glossary";
import { Announce } from "./views/announce";
import { Audit } from "./views/audit";

/* a few words under each menu item */
const NAVSUB: Partial<Record<Tab, string>> = { announce: "üzenet az appban", audit: "ki, mikor, mit", platforms: "melyik mennyit ér", glossary: "minden szám jelentése", seo: "bejárás, kulcsszavak", brand: "említések, MI, versenytársak", monitor: "elérhetőség, futások, hibák", impressions: "hol láttak, mi kapcsán", youtube: "Shorts, nézőmegtartás", inbox: "kommentek, vélemények", ask: "MI a számaidról", planner: "naptár, ötletek", audience: "követők, demográfia", report: "a hét egy oldalon", home: "a nap számai", live: "most az oldalon", alerts: "teendők, jelzések", traffic: "csatornák", social: "posztok, videók", search: "keresések, cikkek",
  links: "rövid linkek", markets: "nyelvek, országok", stores: "letöltések", users: "fiókok", funnel: "lépésről lépésre", retention: "visszatérők", product: "mit használnak", inkage: "moderálás, MI, korlát",
  viral: "megosztások", connect: "bekötések", goals: "célok, jegyzetek", system: "beállítások, biztonság" };

/* Which page follows what. The dashboard's own numbers (admin_dashboard) follow the channel and language filter and the
   range of her own; the pages with their own data count in days (a range becomes "from its first day to today");
   the rest has no period at all. The controls show only where they act, so nothing looks filtered that is not. */
const FILTER_TABS: Tab[] = ["home", "alerts", "live", "ask", "traffic", "funnel", "users", "retention", "viral", "product"];
const NO_PERIOD: Tab[] = ["inkage", "announce", "audit", "glossary", "live", "links", "connect", "more", "inbox", "planner", "audience", "report", "seo", "brand", "monitor", "retention"];
const DAYS_ONLY: Tab[] = ["stores", "social", "platforms", "search", "youtube", "impressions", "markets"];
/* Google, YouTube Analytics and the stores report whole days, 1–3 days late: these pages say which days they show */
const LATE_GOOGLE: Tab[] = ["search", "impressions", "markets", "youtube", "stores"];

/* keyboard: g + a letter opens a page (capital M, B, P, G, K and L: Monitoring, Márka, Platformok, Szótár, Közlemények and Napló), single keys for the rest */
const KEYS: Record<string, Tab> = { o: "home", a: "alerts", l: "live", f: "traffic", t: "social", k: "search", i: "links", p: "markets", s: "stores", e: "users", m: "retention", u: "funnel", h: "product", r: "system", c: "goals",
  j: "impressions", z: "seo", b: "inbox", q: "ask", n: "planner", d: "audience", y: "youtube", w: "report", x: "connect", v: "viral", M: "monitor", B: "brand", P: "platforms", G: "glossary", K: "announce", L: "audit" };

export function Dashboard({ signOut }: { signOut: (note?: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [tab, setTab] = useState<Tab>("home");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<{ kind: "forbidden" | "missing" | "expired" | "other"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string>("");
  const [at, setAt] = useState<number>(0);
  const [navOpen, setNavOpen] = useState(false);
  const [flt, setFltState] = useState<Flt>({});
  const [pal, setPal] = useState(false); const [help, setHelp] = useState(false);
  /* one refresh for everything: every card's useRpc listens to this number */
  const [epoch, setEpoch] = useState(0);
  const theme = useTheme(), light = theme.light;
  const [tv, setTv] = useState(false);
  /* the ↑ ↓ % against the previous period: shown unless switched off (Időszak menü → Összehasonlítás) */
  const [cmp, setCmp] = useState(true);
  useEffect(() => { try { setCmp(localStorage.getItem("inkage.admin.cmp") !== "off"); } catch {} }, []);
  const setCmpP = useCallback((v: boolean) => { setCmp(v); try { localStorage.setItem("inkage.admin.cmp", v ? "on" : "off"); } catch {} }, []);
  const [slim, setSlim] = useState(false); const [plus, setPlus] = useState(false); const [dockHide, setDockHide] = useState(false);
  const phone = usePhone(), scrolled = useScrolled();
  const fresh = useFreshData(epoch), push = usePush();
  const [badges, setBadges] = useState<D | null>(null);
  /* the alerts' "Kész" / "Holnap" state, for the menu badge (the same as the Jelzések page) */
  const sigList = data ? signals(data) : [];
  const sigS = useSigState(sigList);
  /* the platforms', the SEO and the system's own signals join the alerts (bell, Jelzések, the home page's next steps) */
  const [, setPa] = useState(0);
  useEffect(() => {
    const load = () => Promise.all([rpc(sb, "admin_platform_alerts"), rpc(sb, "admin_seo_alerts"), rpc(sb, "admin_system_alerts"), rpc(sb, "admin_badges")]).then(([a, b, c, bd]) => {
      PA.list = [...(Array.isArray(a.data) ? a.data : []), ...(Array.isArray(b.data) ? b.data : []), ...(Array.isArray(c.data) ? c.data : [])] as Alert[];
      if (bd.data) setBadges(bd.data as D);
      setPa((x) => x + 1);
    });
    load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 2 * 60_000); return () => clearInterval(t);
  }, [sb, epoch]);
  /* "Megoldva" marks from the database, so every device agrees */
  useEffect(() => { rpc(sb, "admin_solved_list").then(({ data: s }) => { if (s && typeof s === "object") { SOLVED.map = s as Record<string, string>; setPa((x) => x + 1); } }); }, [sb, epoch]);
  /* the service worker: a quick start and offline copy of this page, and the phone's notifications */
  useEffect(() => { if (MOCK || !("serviceWorker" in navigator)) return; navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(() => null); }, []);
  useScrollLock(plus);
  useSheetDrag(phone);
  const [story, setStory] = useState(false); const [storyOn, setStoryOn] = useState(false);
  /* the morning story only when switched on (Több → Reggeli összefoglaló) */
  useEffect(() => { try { setStoryOn(localStorage.getItem("inkage.admin.story") === "on"); } catch {} }, []);
  const toggleStory = () => setStoryOn((v) => { try { localStorage.setItem("inkage.admin.story", v ? "off" : "on"); } catch {} return !v; });
  useEffect(() => { try { setSlim(localStorage.getItem("inkage.admin.slim") === "1"); } catch {} }, []);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  /* phone: pull the page down from the top to refresh (everything, not only the main numbers) */
  const [pull, setPull] = useState(0);
  useEffect(() => {
    let y0: number | null = null, dy = 0;
    const st = (e: TouchEvent) => { y0 = window.scrollY <= 0 ? e.touches[0].clientY : null; dy = 0; };
    const mv = (e: TouchEvent) => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) setPull(Math.min(1, dy / 90)); };
    const en = () => { if (y0 != null && dy > 90) { navigator.vibrate?.(10); setPull(2); loadRef.current?.().finally(() => setTimeout(() => setPull(0), 300)); } else setPull(0); y0 = null; };
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchmove", mv, { passive: true }); addEventListener("touchend", en);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchmove", mv); removeEventListener("touchend", en); };
  }, []);
  const toggleSlim = () => setSlim((v) => { try { localStorage.setItem("inkage.admin.slim", v ? "0" : "1"); } catch {} return !v; });
  /* the phone dock steps aside while scrolling down, and comes back on the way up */
  useEffect(() => { let y = window.scrollY; const f = () => { const ny = window.scrollY; setDockHide(ny > y + 4 && ny > 140); if (ny < y - 4) setDockHide(false); y = ny; }; addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  useEffect(() => { try { if (new URLSearchParams(location.search).has("tv")) setTv(true); } catch {} }, []);
  useEffect(() => {
    if (!matchMedia("(hover:hover)").matches) return;
    const f = (e: PointerEvent) => { const c = (e.target as HTMLElement)?.closest?.(".c,.tile,.kpi") as HTMLElement | null; if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); };
    addEventListener("pointermove", f, { passive: true }); return () => removeEventListener("pointermove", f);
  }, []);
  const [, tick] = useState(0);
  useEffect(() => { setFltState(readFlt()); }, []);
  const setFlt = useCallback((p: Partial<Flt>) => setFltState((o) => { const nf = { ...o, ...p }; (Object.keys(nf) as (keyof Flt)[]).forEach((k) => { if (!nf[k]) delete nf[k]; }); writeFlt(nf); return nf; }), []);

  useEffect(() => {
    try {
      const h = location.hash.slice(1) as Tab; if (ALL.some((x) => x.k === h)) setTab(h);
      const u = readPeriod(), p = localStorage.getItem("inkage.admin.days");
      if (u !== null) setDays(u); else if (p !== null && [0, 1, 3, 7, 30, 90].includes(Number(p))) setDays(Number(p));
    } catch {}
    if (MOCK) setMe("viktoriasoti@yahoo.com"); else {
      sb?.auth.getUser().then(({ data }) => setMe(data.user?.email || "")); markOwnDevice();
      /* where the owner is now: the morning e-mail goes out at 6:00 in this time zone */
      try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz) rpc(sb, "admin_tz_set", { p_tz: tz }); } catch {}
    }
  }, [sb]);

  /* quick start: the last numbers show at once (kept in this browser, without e-mails or the live feed), the fresh ones follow */
  const cacheKey = `inkage.admin.cache.${days}.${flt.ch || ""}.${flt.lang || ""}.${flt.from || ""}.${flt.to || ""}`;
  useEffect(() => { if (MOCK) return; try { const c = JSON.parse(localStorage.getItem(cacheKey) || "null"); if (c?.d) setData((o) => o || c.d); } catch {} }, [cacheKey]);
  const period = useMemo(() => makePeriod(days, flt), [days, flt]);
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    /* only the newest request's answer counts (a slower one for the period chosen before never overwrites it) */
    const my = ++loadSeq.current;
    setBusy(true);
    const { data: d, error } = await rpc(sb, "admin_dashboard", { p_days: days, p_from: period.p_from, p_to: period.p_to, p_ch: flt.ch || null, p_lang: flt.lang || null });
    if (my !== loadSeq.current) return;
    setBusy(false);
    if (error) {
      const m = (error.message || "") + " " + (error.code || "");
      setErr(/JWT|PGRST30[0-3]|expired/i.test(m) ? { kind: "expired", msg: m } : /forbidden|42501/.test(m) ? { kind: "forbidden", msg: m } : /PGRST202|could not find|does not exist/i.test(m) ? { kind: "missing", msg: m } : { kind: "other", msg: m });
      return;
    }
    setErr(null); setData(d as D); setAt(Date.now());
    try { const { live: _l, errors: _e, ...rest } = d as D; localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), d: { ...rest, live: [], errors: [], users: rest.users ? { ...rest.users, recent: [] } : rest.users } })); } catch {}
  }, [sb, days, flt, cacheKey, period.p_from, period.p_to]);
  /* everything at once: the main numbers and every card of the open page */
  const refresh = useCallback(async () => { setEpoch((x) => x + 1); await load(); }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRef.current = refresh; }, [refresh]);
  /* a sign-in that expired, or was taken away: back to the sign-in with a plain sentence */
  useEffect(() => { if (err?.kind === "forbidden") signOut("Ezzel a fiókkal nem lehet belépni."); if (err?.kind === "expired") signOut("Lejárt a belépés. Lépj be újra."); }, [err, signOut]);
  useEffect(() => { const f = () => signOut("Lejárt a belépés. Lépj be újra."); addEventListener(EXPIRED, f); return () => removeEventListener(EXPIRED, f); }, [signOut]);
  /* signed out after a while without touching anything, when switched on (Rendszer → Biztonság) */
  useEffect(() => {
    let mins = 0; try { mins = Number(localStorage.getItem("inkage.admin.idle") || 0); } catch {}
    if (!mins || MOCK) return;
    let last = Date.now(); const poke = () => { last = Date.now(); };
    const ev2 = ["pointerdown", "keydown", "scroll", "touchstart"]; ev2.forEach((e) => addEventListener(e, poke, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last > mins * 60e3) signOut(`${mins} perc tétlenség után kiléptettünk.`); }, 30_000);
    return () => { clearInterval(t); ev2.forEach((e) => removeEventListener(e, poke)); };
  }, [signOut]);
  useEffect(() => {
    /* the main numbers every minute, every card every 5 minutes (only while the page is in view) */
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    const ie = setInterval(() => { if (document.visibilityState === "visible") setEpoch((x) => x + 1); }, 5 * 60_000);
    const lv = tab === "live" || tab === "home" ? setInterval(async () => { if (document.visibilityState !== "visible") return; const { data: l } = await rpc(sb, "admin_live", { p_ch: flt.ch || null, p_lang: flt.lang || null }); if (l) setData((o) => (o ? { ...o, live: l.live, live_now: l.live_now, live_hour: l.live_hour, ...(flt.ch || flt.lang ? {} : { today: l.today }) } : o)); }, 10_000) : null;
    const t2 = setInterval(() => tick((x) => x + 1), 15_000);
    return () => { clearInterval(iv); clearInterval(ie); clearInterval(t2); if (lv) clearInterval(lv); };
  }, [load, tab, sb, flt]);

  /* Navigation: every page change is a step in the browser's history, so Back goes to the previous page of the
     dashboard (not out of it), and the #page in the address bar works as a link. */
  const hist = useRef<Tab[]>([]);
  const lastSub = useRef<Record<string, string>>({});
  useEffect(() => { const s2 = secOf(tab); if (s2 === "grow" || s2 === "people") lastSub.current[s2] = tab; }, [tab]);
  useEffect(() => { const h = () => { const k = location.hash.slice(1) as Tab; if (ALL.some((x) => x.k === k)) { setTab(k); window.scrollTo({ top: 0 }); } }; addEventListener("hashchange", h); addEventListener("popstate", h); return () => { removeEventListener("hashchange", h); removeEventListener("popstate", h); }; }, []);
  const tabRef = useRef(tab); tabRef.current = tab;
  const go = useCallback((k: Tab) => {
    if (k !== tabRef.current) { hist.current = [...hist.current.slice(-20), tabRef.current]; try { history.pushState({ tab: k }, "", location.search + "#" + k); } catch {} }
    setTab(k); setNavOpen(false); window.scrollTo({ top: 0 });
  }, []);
  const goBack = () => { if (hist.current.length) { hist.current.pop(); history.back(); } };
  /* phone: a swipe from the left edge goes back (sideways swipes elsewhere leave the page alone) */
  const bodyRef = useRef<HTMLDivElement>(null);
  useSwipe(bodyRef, { back: goBack });
  const sec = secOf(tab), subs = sec === "grow" || sec === "people" ? PSUB[sec] : null;
  /* the morning story: once a day, at the first open on the phone */
  useEffect(() => {
    if (!phone || !data || !storyOn || tab !== "home") return;
    const day = new Date().toDateString(); let seen = ""; try { seen = localStorage.getItem("inkage.admin.storyday") || ""; } catch {}
    if (MOCK ? !new URLSearchParams(location.search).has("story") : seen === day) return;
    try { localStorage.setItem("inkage.admin.storyday", day); } catch {}
    setStory(true);
  }, [phone, data, storyOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((d: number) => { setDays(d); setFlt({ from: undefined, to: undefined }); writePeriod(d); try { localStorage.setItem("inkage.admin.days", String(d)); } catch {} }, [setFlt]);
  const enterTv = useCallback(() => { setTv(true); try { document.documentElement.requestFullscreen?.(); } catch {} }, []);
  const syncNow = useCallback(async () => { toast("Lehúzás indul…"); const r = await api("/api/admin/sync", { method: "POST" }); toast(r.ok && r.json?.ok !== false ? "Lehúzás kész" : "A lehúzás hibával futott: részletek a Monitoringban"); refresh(); }, [refresh]);

  /* keyboard: ⌘K / Ctrl+K or "/" search, g + a letter a page, r refresh, d day / night, f TV mode, 1 7 3 9 0 the period, ? help */
  const keyRef = useRef<{ go: typeof go; refresh: () => void; pick: (d: number) => void; cycle: () => void; tv: () => void }>({ go, refresh, pick, cycle: theme.cycle, tv: enterTv });
  keyRef.current = { go, refresh, pick, cycle: theme.cycle, tv: enterTv };
  useEffect(() => {
    let g = 0;
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || "") || (e.target as HTMLElement)?.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) { e.preventDefault(); setPal(true); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setTv(false); setHelp(false); return; }
      if (e.key === "g") { g = Date.now(); return; }
      if (Date.now() - g < 1200 && KEYS[e.key]) { g = 0; keyRef.current.go(KEYS[e.key]); return; }
      g = 0;
      const R = keyRef.current;
      if (e.key === "?") setHelp((x) => !x);
      else if (e.key === "r") R.refresh();
      else if (e.key === "d") R.cycle();
      else if (e.key === "f") R.tv();
      else if (({ "1": 1, "4": 3, "7": 7, "3": 30, "9": 90, "0": 0 } as Record<string, number>)[e.key] !== undefined) R.pick(({ "1": 1, "4": 3, "7": 7, "3": 30, "9": 90, "0": 0 } as Record<string, number>)[e.key]);
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, []);

  const cur = ALL.find((x) => x.k === tab)!;
  /* the browser tab says where she is and which period */
  useEffect(() => { try { document.title = `${cur?.l || "Irányítóközpont"}${NO_PERIOD.includes(tab) ? "" : " · " + period.label} · InkAge`; } catch {} }, [cur, tab, period.label]);

  if (err?.kind === "forbidden" || err?.kind === "expired") return null;
  if (err && !data) return <Gate err={err} retry={load} signOut={() => signOut()} />;

  /* System and Monitoring count only the errors still open (resolved on either page, or fixed in the app, do not count) */
  const errsOld = data ? Math.max(0, n(data.now?.errors) - ((data.signin_fail || []) as D[]).filter((x) => solvedAt(x)).reduce((t, x) => t + n(x.n), 0)) : 0;
  const errs = badges ? n(badges.errors_open) : errsOld;
  /* the same list as the Jelzések page: what was marked "Kész" or "Holnap" no longer counts */
  const todo = data ? sigList.filter((x) => (x.c === "bad" || x.c === "warn") && !sigS.hidden(x)).length : 0;
  const B = { monitor: n(badges?.monitor_bad), inbox: n(badges?.inbox_open), connect: n(badges?.connect_bad) };

  if (tv && data) return <PrevPartialCtx.Provider value={!!data.prev_partial}><TvView d={data} light={light} exit={() => { setTv(false); try { document.exitFullscreen?.(); } catch {} }} /></PrevPartialCtx.Provider>;
  const grp = NAV.find((g) => g.items.some((x) => x.k === tab))?.g || "";
  const noPeriod = NO_PERIOD.includes(tab), showFilter = FILTER_TABS.includes(tab);
  const PSEC_L: Record<PSec, string> = { ma: "Ma", grow: "Növekedés", people: "Emberek", more: "Több" };
  const connected = Object.keys(fresh?.platforms || {}).length;
  const moreGroups: { g: string; rows: MoreRow[] }[] = [
    { g: "Most", rows: [
      { k: "live", l: "Élő", icon: I(P.live), tone: "mint", badge: data && n(data.live_now) > 0 ? "● " + data.live_now : undefined, note: "ami most történik", run: () => go("live") },
      { k: "alerts", l: "Jelzések", icon: I(P.alert), tone: "pink", badge: todo || undefined, run: () => go("alerts") },
      { k: "inbox", l: "Postafiók", icon: I(P.mail), tone: "sky", badge: B.inbox || undefined, note: "kommentek és vélemények", run: () => go("inbox") },
      { k: "ask", l: "Kérdezz", icon: I(P.spark), tone: "lilac", note: "MI a számaidról", run: () => go("ask") },
    ] },
    { g: "Termék", rows: [
      { k: "product", l: "Használat", icon: I(P.product), tone: "butter", run: () => go("product") },
      { k: "viral", l: "Megosztás", icon: I(P.viral), tone: "sky", run: () => go("viral") },
    ] },
    { g: "Működés", rows: [
      { k: "connect", l: "Kapcsolatok", icon: I(P.bolt), tone: B.connect ? "pink" : "lilac", badge: B.connect || undefined, note: connected ? `${connected} platform bekötve` : "platformok, kulcsok", run: () => go("connect") },
      { k: "goals", l: "Célok és napló", icon: I(P.target), tone: "peach", run: () => go("goals") },
      { k: "report", l: "Heti riport", icon: I(P.doc), tone: "butter", note: "PDF-be menthető", run: () => go("report") },
      { k: "system", l: "Rendszer", icon: I(P.system), tone: errs ? "pink" : "mint", badge: errs || undefined, note: errs ? undefined : "beállítások, biztonság", run: () => go("system") },
      { k: "monitor", l: "Monitoring", icon: I(P.live), tone: B.monitor ? "pink" : "mint", badge: B.monitor || undefined, note: "elérhetőség, futások, hibák", run: () => go("monitor") },
      { k: "supabase", l: "Supabase", icon: I(P.layers), tone: "mint", note: "adatbázis ↗", run: () => window.open("https://supabase.com/dashboard/project/yaimucilncjkuaxnmpbg", "_blank") },
      { k: "vercel", l: "Vercel", icon: I(P.bolt), tone: "sky", note: "telepítések ↗", run: () => window.open("https://vercel.com/viktoriasv751s-projects/signa", "_blank") },
    ] },
    { g: "Beállítások", rows: [
      { k: "theme", l: "Téma: " + THEME_L[theme.mode], icon: I(light ? P.sun : P.moon), tone: "lilac", note: "automatikus, nappal, éjszaka", run: theme.cycle },
      { k: "push", l: "Értesítések", icon: I(P.bell), tone: "peach", note: push.st === "na" ? "ez a böngésző nem tud" : push.st === "denied" ? "a böngésző tiltja" : "robbanó poszt, új vélemény, hiba", toggle: true, on: push.st === "on", run: () => (push.st === "on" ? push.off() : push.on()) },
      { k: "story", l: "Reggeli összefoglaló", icon: I(P.spark), tone: "butter", note: "a nap első megnyitásakor", toggle: true, on: storyOn, run: toggleStory },
      { k: "tv", l: "TV-mód", icon: I(P.eye), tone: "sky", run: enterTv },
      { k: "export", l: "Teljes export (JSON)", icon: I(P.share), tone: "mint", note: "minden szám egy fájlban", run: () => exportAll(sb, data) },
      { k: "out", l: "Kilépés", icon: I(P.x), tone: "pink", run: () => signOut() },
    ] },
  ];
  const navBadge = (k: Tab) => {
    if (k === "system") return errs > 0 ? <span className="cnt">{errs}</span> : data ? <span className="okdot" title="Minden rendben" /> : null;
    if (k === "alerts") return data && todo > 0 ? <span className="cnt">{todo}</span> : null;
    if (k === "live") return data && n(data.live_now) > 0 ? <span className="cnt live">{data.live_now}</span> : null;
    if (k === "monitor") return B.monitor > 0 ? <span className="cnt">{B.monitor}</span> : badges ? <span className="okdot" title="Minden fut" /> : null;
    if (k === "inbox") return B.inbox > 0 ? <span className="cnt soft">{B.inbox}</span> : null;
    if (k === "connect") return B.connect > 0 ? <span className="cnt">{B.connect}</span> : null;
    return null;
  };
  /* what a page with its own day-counted data shows when the range is her own, and where Google's lag widens 24 hours */
  const pnote = noPeriod ? null : (DAYS_ONLY.includes(tab) || tab === "home") && flt.from ? `Ez az oldal napokban számol: ${flt.from.replace(/-/g, ".")} óta ${period.eff} napot mutat${flt.to ? " (a záró nap itt nem számít)" : ""}.`
    : LATE_GOOGLE.includes(tab) && days >= 1 && days <= 7 && !flt.from ? `${tab === "youtube" ? "A YouTube Analytics" : tab === "stores" ? "Az App Store és a Google Play" : "A Google"} egész napokat ad, 1–3 nap késéssel: a ${days === 1 ? "24 óra" : days + " nap"} itt a legutóbbi napokat jelenti, amelyekre már van adat (a pontos dátum a számok mellett).` : null;
  return (
    <div className={"adm" + (cmp ? "" : " nocmp") + (navOpen ? " nav-open" : "") + (light ? " light" : "") + (slim ? " slim" : "") + (scrolled ? " scrolled" : "") + (phone ? " is-phone" : "")} onClick={(e) => { if (navOpen && (e.target as HTMLElement).classList.contains("adm")) setNavOpen(false); }}>
      <aside className="adm-side">
        <button className="side-tog" onClick={toggleSlim} aria-label={slim ? "Menü kinyitása" : "Menü összecsukása"}>{I(slim ? P.chevr : P.chev)}</button>
        <a className="adm-brand" href={MOCK ? "/admin?mock" : "/admin"}>
          <span><b>InkAge</b></span>
          {data && n(data.live_now) > 0 && <i className="live" title={`${data.live_now} ember most`} />}
        </a>
        {NAV.map((g) => (
          <div key={g.g}>
            <div className="adm-grp">{g.g}</div>
            <nav className="adm-nav" aria-label={g.g}>
              {g.items.map((x) => (
                <button key={x.k} aria-current={tab === x.k ? "page" : undefined} onClick={() => go(x.k)} title={slim ? x.l : undefined}
                  style={{ ["--peb-bg" as string]: `var(--t-${GT[g.g]})`, ["--peb-ink" as string]: `var(--t-${GT[g.g]}-i)` }}>
                  <span className="peb">{I(x.i)}</span><span className="lbl">{x.l}<small>{NAVSUB[x.k]}</small></span>
                  {navBadge(x.k)}
                </button>
              ))}
            </nav>
          </div>
        ))}
        <div className="adm-side-foot">
          <div className="adm-who"><i>{(me || "V").slice(0, 1).toUpperCase()}</i><span>Viktória<small>{me}</small></span><button onClick={theme.cycle} aria-label={"Téma: " + THEME_L[theme.mode]} title={"Téma: " + THEME_L[theme.mode] + " (d)"}>{I(theme.mode === "auto" ? P.clock : light ? P.sun : P.moon)}</button></div>
          <div className="adm-links">
            <button onClick={() => signOut()}>Kilépés</button>
            <button onClick={enterTv}>TV-mód</button>
            <button onClick={() => setHelp(true)}>Billentyűk</button>
            <a href="https://supabase.com/dashboard/project/yaimucilncjkuaxnmpbg" target="_blank" rel="noreferrer">Supabase ↗</a>
            <a href="https://vercel.com/viktoriasv751s-projects/signa" target="_blank" rel="noreferrer">Vercel ↗</a>
          </div>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <div className="ttl">
            <button className="adm-burger" aria-label="Menü" onClick={() => setNavOpen(true)}>{I(P.menu)}</button>
            {phone && sec === "more" && tab !== "more" ? <button className="ph-back" onClick={() => go("more")}>{I(P.chev)}Több</button>
              : phone && <span className="ph-word" aria-hidden="true">InkAge</span>}
            <div style={{ minWidth: 0 }}><span className="crumb">{grp}{ASKQ[tab] && <button className="ask-here" onClick={() => { try { sessionStorage.setItem("inkage.admin.askq", ASKQ[tab]!); } catch {} go("ask"); }} title={ASKQ[tab]}>{I(P.spark)}Kérdezz erről az oldalról</button>}</span><h1>{phone && tab === "home" ? "Ma" : cur.l}</h1></div>
          </div>
          <button className="top-search" onClick={() => setPal(true)}>{I(P.search)}<span>Keresés: oldal, ember, cikk, poszt, link…</span><kbd>⌘K</kbd></button>
          <div className="adm-tools">
            {data && showFilter && <FilterPick d={data} f={flt} set={setFlt} phone={phone} />}
            {phone && <button className="adm-ibtn ic" onClick={() => setPal(true)} aria-label="Keresés">{I(P.search)}</button>}
            {!phone && <ViewsPick f={flt} set={setFlt} days={days} pick={pick} tab={tab} go={go} />}
            {!noPeriod && <PeriodPick days={days} f={flt} pick={pick} set={setFlt} cmp={cmp} setCmp={setCmpP} />}
            {data && <Bell d={data} go={go} />}
            <button className={"adm-ibtn ic" + (busy ? " busy" : "")} onClick={refresh} aria-label="Frissítés" title={at ? "Frissítve " + ago(new Date(at).toISOString()) + " · r" : "Frissítés (r)"}>{I(P.refresh)}</button>
            {at > 0 && <span className="upd-ago hide-sm" title={new Date(at).toLocaleString("hu-HU")}>{ago(new Date(at).toISOString())}</span>}
          </div>
        </header>
        <div className="adm-body" ref={bodyRef}>
          {phone && <div className="ph-head">
            <span className="eyebrow">{tab === "home" ? new Date().toLocaleDateString("hu-HU", { weekday: "long", month: "short", day: "numeric" }) : tab === "more" ? "InkAge · Irányítóközpont" : PSEC_L[sec]}</span>
            <h1>{tab === "home" ? "Ma" : cur.l}</h1>
            {at > 0 && <small className="ph-upd">Frissítve {ago(new Date(at).toISOString())}</small>}
          </div>}
          {phone && subs && <SubTabs items={subs.map((k) => ({ k, l: SHORT[k] || ALL.find((x) => x.k === k)!.l }))} cur={tab} go={(k) => go(k as Tab)} />}
          {phone && !noPeriod && <div className="ph-period" role="group" aria-label="Időszak">
            {[[1, "24 óra"], [3, "3 nap"], [7, "7 nap"], [30, "30 nap"], [90, "90 nap"], [0, "Mind"]].map(([dd, l]) => <button key={dd} aria-pressed={!flt.from && days === dd} onClick={() => { navigator.vibrate?.(5); pick(dd as number); }}>{l}</button>)}
            <PeriodPick days={days} f={flt} pick={pick} set={setFlt} compact cmp={cmp} setCmp={setCmpP} />
          </div>}
          {MOCK && <div className="mock-bar">Mintaadatok · csak a fejlesztői gépen</div>}
          {err && <div className="alert err">Az utolsó frissítés nem sikerült: {err.msg} <button className="lnk" onClick={load}>Újra</button></div>}
          <ConnectNote go={go} />
          {pnote && <p className="s12 pnote">{I(P.calendar)}{pnote}</p>}
          {showFilter && (flt.ch || flt.lang || flt.from) && <div className="fchips">
            {chList(flt.ch).map((c) => <button key={c} className="fchip" onClick={() => setFlt({ ch: chToggle(flt.ch, c) })}><span className="chlg" style={{ background: chCol(c) }}>{ch(c)[0]}</span>{ch(c)}<b>✕</b></button>)}
            {flt.lang && <button className="fchip" onClick={() => setFlt({ lang: undefined })}><span className="fl">{flag((LANG_LAND[flt.lang] || [])[0])}</span>{lang(flt.lang)}<b>✕</b></button>}
            {flt.from && <button className="fchip" onClick={() => setFlt({ from: undefined, to: undefined })}>{I(P.calendar)}{flt.from} – {flt.to || "ma"}<b>✕</b></button>}
            <button className="lnk" onClick={() => setFlt({ ch: undefined, lang: undefined, from: undefined, to: undefined })}>Mind törlése</button>
          </div>}
          {!showFilter && (flt.ch || flt.lang) && !noPeriod && <p className="s12 pnote mut">Ez az oldal nem szűrhető csatornára és nyelvre: a szűrő itt nem hat.</p>}
          {!data ? <Loading /> : (
            <RefreshCtx.Provider value={epoch}><PeriodCtx.Provider value={period}><FreshCtx.Provider value={fresh}><FltCtx.Provider value={{ f: flt, set: setFlt }}><PrevPartialCtx.Provider value={!!data?.prev_partial}>
              <div className="adm-page" key={tab + ":" + days + ":" + (flt.from || "") + (flt.to || "")}>
              {(tab === "home" || (tab === "more" && !phone)) && <Home d={data} days={period.eff} go={go} phone={phone} />}
              {tab === "more" && phone && <MoreScreen who="Viktória" email={me} groups={moreGroups} />}
              {tab === "alerts" && <Alerts d={data} go={go} />}
              {tab === "goals" && <Goals d={data} />}
              {tab === "announce" && <Announce />}
              {tab === "audit" && <Audit />}
              {tab === "connect" && <Connect />}
              {tab === "retention" && <Retention />}
              {tab === "markets" && <Markets d={data} days={period.eff} />}
              {tab === "stores" && <Stores days={period.eff} />}
              {tab === "traffic" && <Traffic d={data} />}
              {tab === "social" && <Social days={period.eff} />}
              {tab === "search" && <Search days={period.eff} />}
              {tab === "links" && <Links />}
              {tab === "funnel" && <FunnelTab d={data} />}
              {tab === "users" && <Users d={data} />}
              {tab === "viral" && <Viral d={data} />}
              {tab === "inkage" && <InkAge />}
              {tab === "product" && <Product d={data} />}
              {tab === "system" && <System d={data} />}
              {tab === "live" && <Live d={data} />}
              {tab === "inbox" && <Inbox />}
              {tab === "planner" && <Planner />}
              {tab === "audience" && <Audience />}
              {tab === "ask" && <Ask d={data} />}
              {tab === "report" && <Report d={data} />}
              {tab === "youtube" && <YouTube days={period.eff} />}
              {tab === "impressions" && <Impressions days={period.eff} />}
              {tab === "seo" && <Seo />}
              {tab === "brand" && <Brand />}
              {tab === "monitor" && <Monitor />}
              {tab === "platforms" && <Platforms days={period.eff} />}
              {tab === "glossary" && <Glossary go={go} />}
              </div>
            </PrevPartialCtx.Provider></FltCtx.Provider></FreshCtx.Provider></PeriodCtx.Provider></RefreshCtx.Provider>
          )}
        </div>
      </main>
      {pull > 0 && <div className={"ptr" + (pull >= 2 ? " go" : "")} style={{ opacity: Math.min(1, pull), transform: `translateY(${Math.min(1, pull) * 30}px) rotate(${pull * 270}deg)` }}>{I(P.refresh)}</div>}
      {data && <Celebrate d={data} />}
      <Palette open={pal} close={() => setPal(false)} go={go} d={data} set={setFlt} refresh={refresh}
        acts={{ theme: theme.cycle, tv: enterTv, sync: syncNow, out: () => signOut(), help: () => setHelp(true), exportAll: () => exportAll(sb, data), card: () => milestoneCard(data) }} />
      {help && <KeyHelp close={() => setHelp(false)} />}
      {plus && <><div className="scrim-t" onClick={() => setPlus(false)} /><div className="plus-sheet">
        {([["links", "Új rövid link", P.links, "peach"], ["planner", "Új terv", P.calendar, "sky"], ["goals", "Jegyzet vagy cél", P.doc, "butter"], ["ask", "Kérdezz", P.spark, "lilac"], ["live", "Élő nézet", P.live, "mint"], ["connect", "Kapcsolatok", P.bolt, "lilac"]] as [Tab, string, string, Tone][]).map(([k, l, ic, tn]) => (
          <button key={k} className={"t-" + tn} onClick={() => { setPlus(false); go(k); }}>{I(ic)}{l}</button>
        ))}
        <button className="t-pink" onClick={() => { setPlus(false); syncNow(); }}>{I(P.refresh)}Lehúzás most</button>
      </div></>}
      <nav className={"adm-tabbar" + (dockHide && !plus ? " hide" : "")} aria-label="Fő részek">
        {TABBAR.map((x) => x.k === "plus"
          ? <button key="plus" className="plus" aria-label="Új" onClick={() => { navigator.vibrate?.(8); setPlus(!plus); }}>{I(plus ? P.x : P.plus)}</button>
          : <button key={x.k} aria-current={sec === x.k ? "page" : undefined} onClick={() => {
              navigator.vibrate?.(6);
              /* tapping the open section again: back to its first page and the top */
              if (sec === x.k) { if (tab !== x.to) go(x.to); else window.scrollTo({ top: 0, behavior: "smooth" }); return; }
              go(x.k === "grow" || x.k === "people" ? (PSUB[x.k].includes(lastSub.current[x.k] as Tab) ? lastSub.current[x.k] as Tab : x.to) : x.to);
            }}>
              {I(x.i)}{x.l}{x.k === "more" && (todo + B.monitor + B.connect) > 0 && <span className="cnt">{todo + B.monitor + B.connect}</span>}
            </button>)}
      </nav>
      <div id="adm-layer" />
      <Toaster />
      {story && data && <MorningStory cards={dayStories(data, go)} close={() => setStory(false)} />}
    </div>
  );
}


/* ---------- the whole dashboard in one file: every page's numbers, for a spreadsheet or an archive ---------- */
async function exportAll(sb: ReturnType<typeof supabaseBrowser>, d: D | null) {
  toast("Export készül…");
  const fns: [string, Record<string, unknown>?][] = [["admin_social", { p_days: 3650 }], ["admin_search", { p_days: 365 }], ["admin_stores", { p_days: 3650 }], ["admin_links"], ["admin_monitor"], ["admin_goals_list"], ["admin_impressions", { p_days: 365 }]];
  const out: D = { exported_at: new Date().toISOString(), dashboard: d };
  let bad = 0;
  for (const [fn, args] of fns) { const r = await rpc(sb, fn, args); if (r.error) bad++; out[fn.replace("admin_", "")] = r.error ? { error: r.error.message } : r.data; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
  a.download = `inkage-iranyito-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  /* honest: what could not be read is said, not hidden behind "kész" */
  toast(!bad ? "Export letöltve" : bad === fns.length && !d ? "Az export nem sikerült: egyik rész sem töltődött be." : `Export letöltve, de ${bad} rész hiányzik belőle (a fájlban „error” jelzi).`);
}


/* ---------- period: presets, a range, all in one pill ---------- */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function PeriodPick({ days, f, pick, set, compact: cmp, cmp: cmpOn, setCmp }: { days: number; f: Flt; pick: (d: number) => void; set: (p: Partial<Flt>) => void; compact?: boolean; cmp?: boolean; setCmp?: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const now = new Date(), today = ymd(now);
  const m0 = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), pm0 = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), pm1 = ymd(new Date(now.getFullYear(), now.getMonth(), 0)), y0 = ymd(new Date(now.getFullYear(), 0, 1));
  const ranges: [string, string, string?][] = [["Ez a hónap", m0], ["Előző hónap", pm0, pm1], ["Idén", y0]];
  const label = f.from ? (ranges.find((r) => r[1] === f.from && (r[2] || "") === (f.to || ""))?.[0] || `${f.from.slice(5).replace("-", ".")} – ${(f.to || today).slice(5).replace("-", ".")}`) : PERIODS.find((p) => p.d === days)?.l.replace(/^(\d)/, "Utolsó $1") || "Időszak";
  return (
    <div className={"pop-w pp" + (cmp ? " pp-c" : "")}>
      {cmp ? <button aria-pressed={!!f.from} onClick={() => setOpen(!open)} aria-expanded={open}>{f.from ? label : "Saját…"}</button>
        : <button className="adm-ibtn" onClick={() => setOpen(!open)} aria-expanded={open}>{I(P.calendar)}<span>{label}</span>{I(P.down)}</button>}
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv" role="dialog" aria-label="Időszak">
        <h4>Gyors választás</h4>
        <div className="presets">
          {PERIODS.map((p) => <button key={p.d} aria-pressed={!f.from && days === p.d} onClick={() => { pick(p.d); setOpen(false); }}>{p.d === 1 ? "Ma (24 óra)" : p.d === 0 ? "A kezdetek óta" : "Utolsó " + p.l}</button>)}
          {ranges.map(([l, a, b]) => <button key={l} aria-pressed={f.from === a && (f.to || "") === (b || "")} onClick={() => { set({ from: a, to: b }); setOpen(false); }}>{l}</button>)}
        </div>
        {setCmp && <><h4>Összehasonlítás</h4>
        <div className="presets"><button aria-pressed={!!cmpOn} onClick={() => setCmp(true)}>Az előző ugyanilyen hosszú időszakkal</button><button aria-pressed={!cmpOn} onClick={() => setCmp(false)}>Nincs (a ↑ ↓ % elrejtve)</button></div></>}
        <h4>Saját időszak</h4>
        <div className="drange">
          <input className="adm-in" type="date" max={today} value={f.from || ""} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="Kezdő nap" />
          <span>–</span>
          <input className="adm-in" type="date" max={today} min={f.from} value={f.to || ""} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="Utolsó nap" />
        </div>
        <p className="note">Gyorsbillentyű: 1 = 24 óra, 4 = 3 nap, 7, 3 = 30 nap, 9 = 90 nap, 0 = mind. A saját időszakot a fő számok pontosan követik; a saját adatukat napokban számoló oldalak a kezdőnaptól máig mutatják.</p>
      </div></>}
    </div>
  );
}


/* ---------- filters: a channel and a language, on the pages built on the dashboard's own numbers ---------- */
export function FilterPick({ d, f: live, set: setLive, phone }: { d: D; f: Flt; set: (p: Partial<Flt>) => void; phone?: boolean }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  /* on a phone the choices wait for "Alkalmaz" at the bottom of the sheet; on a computer they apply at once */
  const [draft, setDraft] = useState<Flt>(live);
  useEffect(() => { if (open) setDraft(live); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = phone ? draft : live, set = phone ? (p: Partial<Flt>) => setDraft((o) => ({ ...o, ...p })) : setLive;
  const chans = ((d.channels || []) as D[]).map((c) => c.k);
  const langs = ((d.langs || []) as D[]).map((c) => c.k).filter((k: string) => k && k !== "?");
  const cnt = chList(f.ch).length + (f.lang ? 1 : 0);
  return (
    <div className="pop-w">
      <button className={"adm-ibtn" + (cnt ? " on" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>{I(P.funnel)}<span>Szűrő{cnt ? ` · ${cnt}` : ""}</span></button>
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv" role="dialog" aria-label="Szűrők">
        <h4>Csatorna <small className="mut">(több is választható)</small></h4>
        <div className="pick-list">{chans.map((k) => <button key={k} aria-pressed={chList(f.ch).includes(k)} onClick={() => set({ ch: chToggle(f.ch, k) })}><span className="chlg" style={{ background: chCol(k) }}>{ch(k)[0]}</span>{ch(k)}</button>)}</div>
        <h4>Nyelv</h4>
        <div className="pick-list">{langs.map((k: string) => <button key={k} aria-pressed={f.lang === k} onClick={() => set({ lang: f.lang === k ? undefined : k })}><span className="fl">{flag((LANG_LAND[k] || [])[0])}</span>{lang(k)}</button>)}</div>
        <div className="adm-row">{cnt > 0 && <button className="lnk" onClick={() => set({ ch: undefined, lang: undefined })}>Szűrők törlése</button>}</div>
        <p className="note">A szűrő az Áttekintés, a Jelzések, az Élő, a Kérdezz, a Piacok, a Források, a Tölcsér, az Emberek, a Megtartás, a Használat és a Megosztás számaira hat. A posztok, a követők, a Google és az áruházak számai nem szűrhetők csatornára és nyelvre.</p>
        {phone && <button className="adm-ibtn gold filt-ok" onClick={() => { setLive({ ch: draft.ch, lang: draft.lang }); setOpen(false); }}>Alkalmaz</button>}
      </div></>}
    </div>
  );
}


/* ---------- the bell: every signal, newest worry first; read marks; the phone's notification history ---------- */
const sig = (x: Alert) => x.c + "|" + x.t;
export function Bell({ d, go }: { d: D; go: (t: Tab) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = useState(false); const [view, setView] = useState<"now" | "push">("now");
  const [seen, setSeen] = useState<string[]>([]); const [hist, setHist] = useState<D[] | null>(null);
  useScrollLock(open);
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem("inkage.admin.bellseen") || "[]")); } catch {} }, []);
  useEffect(() => { if (open && view === "push" && !hist) rpc(sb, "admin_push_status").then(({ data }) => setHist(((data as D)?.sent || []) as D[])); }, [open, view, hist, sb]);
  const out = alerts(d), unread = out.filter((x) => (x.c === "bad" || x.c === "warn") && !seen.includes(sig(x))).length;
  /* opening the bell marks what it shows as read (kept in this browser); a new or changed signal counts again */
  const markRead = () => { const s = out.map(sig).slice(0, 60); setSeen(s); try { localStorage.setItem("inkage.admin.bellseen", JSON.stringify(s)); } catch {} };
  return (
    <div className="pop-w">
      <button className="adm-ibtn ic" onClick={() => { setOpen(!open); if (!open) setTimeout(markRead, 1200); }} aria-label={`Jelzések${unread ? `, ${unread} olvasatlan` : ""}`} aria-expanded={open}>{I(P.bell)}{unread > 0 && <span className="badge">{unread}</span>}</button>
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv bell-pop" role="dialog" aria-label="Jelzések">
        <div className="adm-seg sm"><button aria-pressed={view === "now"} onClick={() => setView("now")}>Most</button><button aria-pressed={view === "push"} onClick={() => setView("push")}>Értesítések</button></div>
        {view === "now" ? <>
          <ul className="bell-l">{out.slice(0, 10).map((x, i) => <li key={i} className={x.c + (seen.includes(sig(x)) ? " read" : "")} onClick={() => { setOpen(false); go(x.to || "alerts"); }}><span className="ic">{I(AIC[x.c])}</span><div><b>{x.t}</b><span>{x.s}</span></div></li>)}
            {!out.length && <li className="good"><span className="ic">{I(P.check)}</span><div><b>Minden rendben</b><span>Nincs teendő.</span></div></li>}</ul>
          <button className="lnk" onClick={() => { setOpen(false); go("alerts"); }}>Mind a {out.length} jelzés →</button>
        </> : <ul className="bell-l">{!hist ? <li><div className="skel" style={{ height: 60, width: "100%" }} /></li> : hist.length ? hist.map((x, i) => (
          <li key={i} className="info" onClick={() => { setOpen(false); const k = String(x.url || "").split("#")[1] as Tab; go(ALL.some((a) => a.k === k) ? k : "alerts"); }}><span className="ic">{I(P.bell)}</span><div><b>{x.title}</b><span>{x.body}</span><small className="mut">{ago(x.at)}</small></div></li>))
          : <li><div><b>Még nem ment értesítés</b><span>Kapcsold be a Rendszer oldalon.</span></div></li>}</ul>}
      </div></>}
    </div>
  );
}


/* ---------- the keyboard's help ---------- */
function KeyHelp({ close }: { close: () => void }) {
  const names = Object.entries(KEYS).map(([k, t]) => [k, ALL.find((x) => x.k === t)?.l || t]);
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <div className="pal keyhelp" role="dialog" aria-label="Gyorsbillentyűk">
        <div className="c-h"><div><div><h2>Gyorsbillentyűk</h2></div></div><button className="adm-ibtn" onClick={close} data-close>Bezárás</button></div>
        <dl className="kv">
          <dt><kbd>⌘K</kbd> <kbd>/</kbd></dt><dd>Keresés és műveletek</dd>
          <dt><kbd>r</kbd></dt><dd>Minden frissítése</dd>
          <dt><kbd>d</kbd></dt><dd>Téma: automatikus, nappal, éjszaka</dd>
          <dt><kbd>f</kbd></dt><dd>TV-mód (Esc: kilépés; ← → lapoz, szóköz megállít)</dd>
          <dt><kbd>1</kbd> <kbd>4</kbd> <kbd>7</kbd> <kbd>3</kbd> <kbd>9</kbd> <kbd>0</kbd></dt><dd>Időszak: 24 óra, 3, 7, 30, 90 nap, mind</dd>
          <dt><kbd>?</kbd></dt><dd>Ez a súgó</dd>
        </dl>
        <h3 style={{ margin: "12px 0 6px" }}>Oldalak: <kbd>g</kbd>, utána</h3>
        <ul className="keys-l">{names.map(([k, l]) => <li key={k}><kbd>{k === "M" || k === "B" ? "⇧" + k : k}</kbd>{l}</li>)}</ul>
      </div>
    </Layer>
  );
}


/* ---------- shared bits ---------- */
export function Gate({ err, retry, signOut }: { err: { kind: string; msg: string }; retry: () => void; signOut?: () => void }) {
  /* the chosen theme here too (the sign-in screen's, not always dark) */
  const { light } = useTheme();
  return (
    <div className={"adm gate" + (light ? " light" : "")}>
      <div className="gate-card">
        <img src="/icons/icon-192.png" alt="" />
        <h1>Nem sikerült betölteni</h1>
        <p>{err.kind === "missing" ? "Az adatbázis-frissítés még nincs telepítve." : err.msg}</p>
        <div className="adm-row" style={{ justifyContent: "center" }}><button className="adm-ibtn" onClick={retry}>Újra</button>{signOut && <button className="adm-ibtn" onClick={signOut}>Kilépés</button>}</div>
      </div>
    </div>
  );
}


/* after the platform's sign-in sends the owner back: one line on how it went */
export function ConnectNote({ go }: { go?: (t: Tab) => void }) {
  const [m, setM] = useState("");
  useEffect(() => {
    try {
      const u = new URL(location.href); const c = u.searchParams.get("connect");
      if (c) { setM(c); u.searchParams.delete("connect"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); }
    } catch {}
  }, []);
  if (!m) return null;
  const ok = m === "ok" || m.startsWith("ok:");
  const t = m === "ok" ? "Kapcsolódva. A posztok adatai betöltődtek." : m === "ok:slow" ? "Kapcsolódva. Az első lehúzás még tart; a számok pár percen belül (legkésőbb az óránkénti lehúzással) megjelennek."
    : m === "ok:syncerr" ? "Kapcsolódva, de az első lehúzás hibát adott. A részletek a Kapcsolatok oldalon, a platform kártyáján." : "A kapcsolódás nem sikerült: " + m;
  return <div className={"alert " + (ok && m !== "ok:syncerr" ? "ok" : "err")}>{t}{m === "ok:syncerr" && go && <> <button className="lnk" onClick={() => go("connect")}>Kapcsolatok →</button></>}<button className="lnk" style={{ marginLeft: 8 }} onClick={() => setM("")}>✕</button></div>;
}


/* ---------- command palette (⌘K): pages, actions, filters, and everything that has a name ---------- */
type Acts = { theme: () => void; tv: () => void; sync: () => void; out: () => void; help: () => void; exportAll: () => void; card: () => void };
export function Palette({ open, close, go, d, set, refresh, acts }: { open: boolean; close: () => void; go: (t: Tab) => void; d: D | null; set: (p: Partial<Flt>) => void; refresh: () => void; acts?: Acts }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [sel, setSel] = useState(0); const [people, setPeople] = useState<D[]>([]);
  const [more, setMore] = useState<D | null>(null);
  const [sheet, setSheet] = useState<{ k: "post" | "page" | "user"; x: any } | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inp.current?.focus(), 10); } }, [open]);
  /* the searchable lists load once, the first time the palette opens */
  useEffect(() => {
    if (!open || more) return;
    const today = new Date(), iso = (x: Date) => x.toISOString().slice(0, 10);
    Promise.all([rpc(sb, "admin_social", { p_days: 365 }), rpc(sb, "admin_links"), rpc(sb, "admin_search", { p_days: 90 }), rpc(sb, "admin_inbox", { p_all: false }),
      rpc(sb, "admin_plans", { p_from: iso(new Date(today.getTime() - 60 * 864e5)), p_to: iso(new Date(today.getTime() + 60 * 864e5)) })])
      .then(([s, l, g, ib, pl]) => setMore({ errs: [s, l, g, ib, pl].filter((x) => x.error).length, posts: (s.data as D)?.posts || [], links: Array.isArray(l.data) ? l.data : [], queries: (g.data as D)?.queries || [], inbox: (ib.data as D)?.items || [], plans: Array.isArray(pl.data) ? pl.data : [] }));
  }, [open, more, sb]);
  useEffect(() => { if (!open || q.trim().length < 3) { setPeople([]); return; } const t = setTimeout(async () => { const { data } = await rpc(sb, "admin_users", { p_q: q.trim(), p_limit: 5, p_offset: 0, p_filter: "all" }); setPeople(data?.rows || []); }, 200); return () => clearTimeout(t); }, [q, open, sb]);
  type It = { g: string; l: string; s?: string; i: string; run: () => void };
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const items: It[] = useMemo(() => {
    const out: It[] = ALL.filter((x) => x.k !== "more").map((x) => ({ g: "Oldalak", l: x.l, s: x.d, i: x.i, run: () => go(x.k) }));
    /* a list that did not load is said, not left as an empty group */
    if (n(more?.errs) > 0) out.unshift({ g: "Figyelem", l: `${more!.errs} lista nem töltődött be (posztok, linkek, keresések…)`, s: "újrapróbálás", i: P.refresh, run: () => setMore(null) });
    out.push({ g: "Műveletek", l: "Frissítés", s: "minden kártya (r)", i: P.refresh, run: refresh }, { g: "Műveletek", l: "Új rövid link", i: P.plus, run: () => go("links") },
      { g: "Műveletek", l: "Jegyzet vagy cél hozzáadása", i: P.doc, run: () => go("goals") }, { g: "Műveletek", l: "Új terv a Tervezőben", i: P.calendar, run: () => go("planner") },
      { g: "Műveletek", l: "Nyomtatás / PDF", i: P.doc, run: () => setTimeout(() => window.print(), 100) },
      { g: "Műveletek", l: "Szűrők törlése", i: P.funnel, run: () => set({ ch: undefined, lang: undefined, from: undefined, to: undefined }) });
    if (acts) out.push({ g: "Műveletek", l: "Téma váltása", s: "automatikus, nappal, éjszaka (d)", i: P.moon, run: acts.theme }, { g: "Műveletek", l: "TV-mód", s: "f", i: P.eye, run: acts.tv },
      { g: "Műveletek", l: "Lehúzás most", s: "minden platform, Google, áruházak", i: P.refresh, run: acts.sync },
      { g: "Műveletek", l: "Összefoglaló-próba", s: "a reggeli összefoglaló most, e-mailben", i: P.mail, run: () => { toast("Küldés…"); api("/api/admin/digest", { method: "POST" }).then((r) => toast(r.ok && r.json?.ok !== false ? "Elküldve: " + (r.json?.email || "kész") : "Nem sikerült: " + (r.json?.error || ""))); } },
      { g: "Műveletek", l: "Teljes export (JSON)", s: "minden oldal száma egy fájlban", i: P.share, run: acts.exportAll },
      { g: "Műveletek", l: "Mérföldkő-kártya (PNG)", s: "a legutóbbi elért mérföldkő", i: P.target, run: acts.card },
      { g: "Műveletek", l: "Gyorsbillentyűk", s: "?", i: P.spark, run: acts.help }, { g: "Műveletek", l: "Kilépés", i: P.x, run: acts.out });
    ((d?.channels || []) as D[]).forEach((c) => out.push({ g: "Szűrés csatornára", l: ch(c.k), s: `${fmt(c.sessions)} látogatás`, i: P.globe, run: () => set({ ch: c.k }) }));
    ((d?.langs || []) as D[]).filter((x) => x.k && x.k !== "?").forEach((x) => out.push({ g: "Szűrés nyelvre", l: lang(x.k), s: `${fmt(x.n)} látogatás`, i: P.globe, run: () => set({ lang: x.k }) }));
    ((d?.pages || []) as D[]).forEach((x) => out.push({ g: "Oldalak és cikkek", l: x.k === "start" ? "/app" : x.k, s: `${fmt(x.n)} megtekintés · részletek`, i: P.doc, run: () => setSheet({ k: "page", x: "https://inkage.app" + (String(x.k).startsWith("/") ? x.k : "/" + x.k) }) }));
    ((d?.campaigns || []) as D[]).forEach((x) => out.push({ g: "Kampányok", l: `${ch(x.source)} · ${x.campaign} · ${x.content}`, s: `${fmt(x.sessions)} látogatás`, i: P.target, run: () => go("traffic") }));
    ((more?.posts || []) as D[]).forEach((p) => out.push({ g: "Posztok és videók", l: String(p.title || p.post_id || "").slice(0, 90), s: `${ch(p.platform)} · ${big(p.views)} ${p.platform === "pinterest" || p.platform === "linkedin" ? "megjelenés" : "megtekintés"}`, i: P.play, run: () => setSheet({ k: "post", x: p }) }));
    ((more?.links || []) as D[]).forEach((x) => out.push({ g: "Rövid linkek", l: "inkage.app/go/" + x.code, s: [x.campaign, x.note, x.target].filter(Boolean).join(" · "), i: P.links, run: () => go("links") }));
    ((more?.queries || []) as D[]).slice(0, 200).forEach((x) => out.push({ g: "Google-keresések", l: String(x.query), s: `${fmt(x.clicks)} kattintás · ${fmt(n(x.pos ?? x.position), 1)}. hely`, i: P.search, run: () => (x.page ? setSheet({ k: "page", x: x.page }) : go("search")) }));
    ((more?.inbox || []) as D[]).forEach((x) => out.push({ g: "Postafiók", l: `${x.author || "Névtelen"}: ${String(x.body || "").slice(0, 70)}`, s: ch(x.source), i: P.mail, run: () => go("inbox") }));
    ((more?.plans || []) as D[]).forEach((x) => out.push({ g: "Tervek", l: String(x.title || "Terv"), s: `${x.day || ""} · ${x.status || ""}`, i: P.calendar, run: () => go("planner") }));
    ((d?.error_groups || []) as D[]).forEach((x) => out.push({ g: "Hibák", l: String(x.msg || x.name).slice(0, 90), s: `${ev(x.name)} · ${fmt(x.n)} eset`, i: P.alert, run: () => go("monitor") }));
    return out;
  }, [d, go, set, refresh, acts, more]);
  const list = useMemo(() => {
    const nq = norm(q.trim());
    const base = nq ? items.filter((x) => norm(x.l + " " + (x.s || "") + " " + x.g).includes(nq)) : items.filter((x) => x.g === "Oldalak" || x.g === "Műveletek");
    return [...base.slice(0, 60), ...people.map((u) => ({ g: "Emberek", l: u.email || "–", s: `${PROV[u.provider] || u.provider} · ${ago(u.created_at)} · részletek`, i: P.user, run: () => (u.id ? setSheet({ k: "user", x: u.id }) : go("users")) }))];
  }, [q, items, people, go]);
  if (sheet) return sheet.k === "post" ? <PostDrawer p={sheet.x} close={() => setSheet(null)} /> : sheet.k === "page" ? <PageDrawer page={sheet.x} close={() => setSheet(null)} /> : <UserDrawer id={sheet.x} close={() => setSheet(null)} />;
  if (!open) return null;
  /* a result that opens a sheet keeps the palette's place; anything else closes it */
  const run = (x?: It) => { if (!x) return; close(); x.run(); };
  let lastG = "";
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <div className="pal" role="dialog" aria-label="Keresés">
        <div className="pal-in">{I(P.search)}<input ref={inp} value={q} placeholder="Keresés: oldal, cikk, poszt, link, keresés, e-mail, művelet…" onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(list.length - 1, sel + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); } else if (e.key === "Enter") run(list[sel]); }} /><button className="pal-x" onClick={close} aria-label="Bezárás"><kbd>esc</kbd><span>Mégse</span></button></div>
        <div className="pal-l">
          {!list.length && <p className="note" style={{ padding: 14 }}>Nincs találat.</p>}
          {list.map((x, i) => { const head = x.g !== lastG ? (lastG = x.g) : null; return (
            <div key={i}>{head && <div className="pal-g">{head}</div>}
              <button className={"pal-i" + (i === sel ? " on" : "")} onMouseEnter={() => setSel(i)} onClick={() => run(x)}><span className="pal-ic">{I(x.i)}</span><span className="pal-t">{x.l}{x.s && <small>{x.s}</small>}</span>{i === sel && <kbd>↵</kbd>}</button>
            </div>
          ); })}
          {!more && q && <p className="note" style={{ padding: "6px 14px" }}>A posztok, linkek és keresések még töltődnek…</p>}
        </div>
      </div>
    </Layer>
  );
}


/* ---------- saved views: kept in the database (every device), this browser keeps a copy ----------
   A view is the page, the period and the filter together ("TikTok, 7 nap, Források"); one click brings all of it back.
   Shown on every page, in the header. */
type View = { name: string; f: Flt; tab: string; days?: number };
export function ViewsPick({ f, set, days, pick, tab, go }: { f: Flt; set: (p: Partial<Flt>) => void; days: number; pick: (d: number) => void; tab: Tab; go: (t: Tab) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [list, setList] = useState<View[]>([]);
  const [open, setOpen] = useState(false); const [name, setName] = useState("");
  useScrollLock(open);
  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem("inkage.admin.views") || "[]")); } catch {}
    rpc(sb, "admin_setting_get", { p_k: "views" }).then(({ data }) => { if (Array.isArray(data)) { setList(data as View[]); try { localStorage.setItem("inkage.admin.views", JSON.stringify(data)); } catch {} } });
  }, [sb]);
  const store = (l: View[]) => { setList(l); try { localStorage.setItem("inkage.admin.views", JSON.stringify(l)); } catch {} rpc(sb, "admin_setting_save", { p_k: "views", p_v: l }).catch(() => null); };
  const pname = (x: View) => (x.f?.from ? `${x.f.from} – ${x.f.to || "ma"}` : x.days == null ? "" : PERIODS.find((p) => p.d === x.days)?.l || x.days + " nap");
  const save = () => { const nm = name.trim().slice(0, 40); if (!nm) return; store([...list.filter((x) => x.name !== nm), { name: nm, f: { ch: f.ch, lang: f.lang, from: f.from, to: f.to }, tab, days }].slice(-20)); setName(""); toast("Nézet mentve"); };
  const apply = (x: View) => { if (!x.f?.from && x.days != null) pick(x.days); set({ ch: x.f?.ch, lang: x.f?.lang, ...(x.f?.from ? { from: x.f.from, to: x.f.to } : {}) }); if (x.tab && ALL.some((y) => y.k === x.tab)) go(x.tab as Tab); setOpen(false); };
  return (
    <div className="pop-w">
      <button className={"adm-ibtn ic" + (open ? " on" : "")} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Mentett nézetek" title="Mentett nézetek: oldal + időszak + szűrő egy kattintással">{I(P.layers)}</button>
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv views-pop" role="dialog" aria-label="Mentett nézetek">
        <h4>Mentett nézetek</h4>
        {list.length ? <div className="views-l">{list.map((x) => (
          <div key={x.name} className="views-i"><button onClick={() => apply(x)}><b>{x.name}</b><small>{[ALL.find((y) => y.k === x.tab)?.l, pname(x), ...chList(x.f?.ch).map(ch), x.f?.lang ? lang(x.f.lang) : ""].filter(Boolean).join(" · ")}</small></button>
            <button className="lnk" aria-label={"Törlés: " + x.name} onClick={() => store(list.filter((y) => y.name !== x.name))}>✕</button></div>))}</div>
          : <p className="note">Még nincs mentett nézet. Állítsd be az oldalt, az időszakot és a szűrőt, és mentsd el egy névvel.</p>}
        <h4>A mostani mentése</h4>
        <div className="adm-row"><input className="adm-in sm" value={name} maxLength={40} placeholder="pl. TikTok, 7 nap" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} /><button className="adm-ibtn sm gold" onClick={save} disabled={!name.trim()}>Mentés</button></div>
        <p className="note">Elmenti: {ALL.find((y) => y.k === tab)?.l} · {f.from ? `${f.from} – ${f.to || "ma"}` : PERIODS.find((p) => p.d === days)?.l}{chList(f.ch).length ? " · " + chList(f.ch).map(ch).join(", ") : ""}{f.lang ? " · " + lang(f.lang) : ""}. Minden eszközödön megjelenik.</p>
      </div></>}
    </div>
  );
}


/* ---------- TV mode: full screen, large numbers, refreshes itself ---------- */
/* TV mode: a wall screen that tells the day without touching anything. Seven slides turn (12 s by default; ?tv=20 or
   + / − set it, the choice follows her to every device); a click or the arrows turn them too, space pauses; a strip at
   the bottom always shows today's numbers and the people on the site right now. The posts refresh every 10 minutes. */
const SLIDES = ["Ma eddig", "Cél", "Élő", "Csatornák", "Posztok", "Tölcsér", "Teendők", "Platformok"];
export function TvView({ d, light, exit }: { d: D; light: boolean; exit: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const N = d.now || {}, PV = d.prev || {}, A = d.all || {}, T = d.today || {};
  const [cfg, setCfg] = useState<{ sec: number; off: number[] }>({ sec: 12, off: [] });
  const [now, setNow] = useState(new Date()); const [k, setK] = useState(0); const [soc, setSoc] = useState<D | null>(null); const [paused, setPaused] = useState(false); const [menu, setMenu] = useState(false);
  const on = useMemo(() => SLIDES.map((_, i) => i).filter((i) => !cfg.off.includes(i)), [cfg.off]);
  const SL = SLIDES.length;
  const nextOf = useCallback((x: number, dir = 1) => { const l = on.length ? on : [0]; const i = l.indexOf(x); return l[((i < 0 ? 0 : i) + dir + l.length) % l.length]; }, [on]);
  useEffect(() => {
    rpc(sb, "admin_setting_get", { p_k: "tv" }).then(({ data }) => { const s = Number(new URLSearchParams(location.search).get("tv")); const x = (data || {}) as D; setCfg({ sec: s >= 5 && s <= 120 ? s : Number(x.sec) >= 5 ? Number(x.sec) : 12, off: Array.isArray(x.off) ? x.off : [] }); });
  }, [sb]);
  const saveCfg = (c: { sec: number; off: number[] }) => { setCfg(c); rpc(sb, "admin_setting_save", { p_k: "tv", p_v: c }).catch(() => null); };
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (paused) return; const s2 = setInterval(() => setK((x) => nextOf(x)), cfg.sec * 1000); return () => clearInterval(s2); }, [cfg.sec, paused, nextOf]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setK((x) => nextOf(x)); if (e.key === "ArrowLeft") setK((x) => nextOf(x, -1));
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === "+") saveCfg({ ...cfg, sec: Math.min(120, cfg.sec + 4) }); if (e.key === "-") saveCfg({ ...cfg, sec: Math.max(5, cfg.sec - 4) });
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, [cfg, nextOf]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const ld = () => rpc(sb, "admin_social", { p_days: 30 }).then(({ data }) => setSoc(data || null)); ld(); const t = setInterval(ld, 10 * 60_000); return () => clearInterval(t); }, [sb]);
  const items: D[] = (d.live || []).filter((x: D) => !HIDDEN.has(x.name));
  const scoredAll = n(A.scored), STEPS = [1_000, 10_000, 100_000, GOAL], next = STEPS.find((x) => x > scoredAll) || GOAL, prevStep = [0, ...STEPS].filter((x) => x <= scoredAll).pop() || 0;
  const pins = Array.from(new Set(items.slice(0, 20).filter((x) => x.lang).map((x) => (LANG_LAND[String(x.lang).slice(0, 2)] || [])[0]).filter(Boolean))).map((a2) => ({ a2: a2 as string, n: 1 }));
  /* today against yesterday, and where the day ends if the pace holds */
  const tdays: D[] = d.bucket === "day" ? d.trend || [] : [];
  const yest = tdays[tdays.length - 2] || {};
  const dayGone = Math.max(0.04, (now.getHours() * 60 + now.getMinutes()) / 1440);
  const proj = Math.round(n(T.scored) / dayGone);
  const perDay = n(N.scored) / Math.max(1, Math.min(d.days, (Date.now() - new Date(d.first_event || Date.now()).getTime()) / 864e5 || 1));
  const eta = perDay > 0 ? Math.ceil((next - scoredAll) / perDay) : null;
  const chans = ((d.channels || []) as D[]).filter((c) => c.k !== "közvetlen").slice(0, 6), topC = Math.max(1, ...chans.map((c) => n(c.sessions)));
  const posts = [...((soc?.posts || []) as D[])].sort((a, b) => n(b.sessions) - n(a.sessions) || n(b.views) - n(a.views)).slice(0, 5);
  const accs = ((soc?.accounts || []) as D[]), last = (p: string) => ((soc?.daily || []) as D[]).filter((x) => x.platform === p).slice(-1)[0];
  const f = (k2: string) => n((d.funnel || []).find((x: D) => x.k === k2)?.n);
  const todo = alerts(d).filter((x) => x.c === "bad" || x.c === "warn" || x.c === "good").slice(0, 4);
  const lastBy = new Map<string, D>(); items.filter((x) => Date.now() - new Date(x.created_at).getTime() < 5 * 60e3).forEach((x) => { if (!lastBy.has(x.s)) lastBy.set(x.s, x); });
  return (
    <div className={"adm tv" + (light ? " light" : "")} onClick={() => setK((x) => nextOf(x))}>
      <div className="tv-h">
        <span className="tv-word">InkAge</span>
        <span className="tv-clock">{now.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}<small>{now.toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}</small></span>
        <div className="adm-row" onClick={(e) => e.stopPropagation()}>
          <button className="adm-ibtn" onClick={() => setPaused(!paused)}>{paused ? "▶ Tovább" : "❚❚ Megállít"}</button>
          <button className="adm-ibtn" onClick={() => setMenu(!menu)} aria-expanded={menu}>Diák · {cfg.sec} mp</button>
          <button className="adm-ibtn" onClick={exit}>Kilépés (Esc)</button>
        </div>
      </div>
      {menu && <div className="tv-menu" onClick={(e) => e.stopPropagation()}>
        <label className="lf"><span>Egy dia ideje: {cfg.sec} mp</span><input type="range" min={5} max={60} step={1} value={cfg.sec} onChange={(e) => saveCfg({ ...cfg, sec: Number(e.target.value) })} /></label>
        <div className="pick-list">{SLIDES.map((l, i) => <button key={l} aria-pressed={!cfg.off.includes(i)} onClick={() => saveCfg({ ...cfg, off: cfg.off.includes(i) ? cfg.off.filter((x) => x !== i) : cfg.off.length >= SL - 1 ? cfg.off : [...cfg.off, i] })}>{l}</button>)}</div>
      </div>}
      <div className="tv-slide" key={k}>
        {k === 0 && <div className="tv-today">
          <span className="eyebrow">Ma eddig</span>
          <div className="tv-hero"><b><CountUp v={n(T.scored)} /></b><span>előnézet<small>{fmt(T.sessions)} látogatásból · tegnap egész nap {fmt(yest.scored)}</small></span></div>
          <div className="tv-row">
            <div><span>Várható a nap végére</span><b>{fmt(proj)}</b><small>ha így megy tovább</small></div>
            <div><span>Új fiók ma</span><b>{fmt(T.signups)}</b><small>tegnap {fmt(yest.signups)}</small></div>
            <div><span>Megosztás ma</span><b>{fmt(T.shared)}</b><small>{pct(n(T.shared), n(T.scored))} az előnézetekből</small></div>
            <div className="live"><span>Most az oldalon</span><b>{fmt(d.live_now)}</b><small>az elmúlt órában {fmt(d.live_hour)}</small></div>
          </div>
        </div>}
        {k === 1 && <div className="tv-goal">
          <GlowRing value={scoredAll} label="Kész előnézet" sub={`következő cél: ${compact(next)}`} share={(scoredAll - prevStep) / Math.max(1, next - prevStep)} size={440} />
          <div><span className="eyebrow">Út az 1 000 000 felé</span><h1>{fmt(next - scoredAll)} előnézet a következő célig</h1>
            <p>{eta ? <>A mostani ütemben (napi ~{fmt(perDay, perDay < 10 ? 1 : 0)}) kb. <b>{fmt(eta)} nap</b>.</> : "Az első előnézetek után itt látszik, mikorra éred el."}</p>
            <div className="ms-chips" style={{ justifyContent: "flex-start" }}>{STEPS.map((x) => <span key={x} className={x <= scoredAll ? "done" : x === next ? "cur" : ""}>{x <= scoredAll ? "✓ " : ""}{compact(x)}</span>)}</div></div>
        </div>}
        {k === 2 && <div className="livegrid">
          <div><span className="eyebrow">Élőben</span><h1 style={{ fontSize: 88, marginTop: 8 }}>{fmt(d.live_now)} ember most</h1>
            <ul className="tv-now">{[...lastBy.values()].slice(0, 6).map((x, i) => <li key={i}><Logo k={x.src?.us || "közvetlen"} size={34} /><b>{ev(x.name)}</b><span>{x.lang ? String(x.lang).toUpperCase() : ""} · {ago(x.created_at)}</span></li>)}
              {!lastBy.size && <li><span>Az elmúlt 5 percben senki. Az óra {fmt(d.live_hour)} látogatást hozott.</span></li>}</ul></div>
          <Globe pins={pins} size={540} />
        </div>}
        {k === 3 && <div className="tv-list"><span className="eyebrow">Honnan jönnek · {periodName(d)}</span><h1>A legerősebb csatornák</h1>
          <ul>{chans.map((c) => <li key={c.k}><Logo k={c.k} size={44} /><b>{ch(c.k)}</b><span className="bar"><i style={{ width: `${(n(c.sessions) / topC) * 100}%`, background: chColor(c.k) }} /></span><em>{fmt(c.sessions)}</em><small>{pct(n(c.scored), n(c.sessions))} előnézetig</small></li>)}</ul></div>}
        {k === 4 && <div className="tv-list"><span className="eyebrow">Tartalom · 30 nap</span><h1>A legjobb posztok</h1>
          <div className="tv-accs">{accs.map((a) => { const l = last(a.platform) || {}; return <span key={a.platform}><Logo k={a.platform} size={30} /><b>{big(l.followers)}</b> követő</span>; })}</div>
          {posts.length ? <div className="tv-posts">{posts.map((p) => <div key={p.platform + p.post_id} className="tv-post">{p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" /> : <span className="ph"><Logo k={p.platform} size={54} /></span>}<b>{big(p.views)}</b><span>{p.platform === "pinterest" || p.platform === "linkedin" ? "megjelenés" : "megtekintés"} · {fmt(p.sessions)} látogató</span></div>)}</div>
            : <p className="note" style={{ fontSize: 20 }}>A bekötött platformok posztjai itt jelennek meg.</p>}</div>}
        {k === 5 && <div className="tv-list"><span className="eyebrow">Az út · {periodName(d)}</span><h1>Hol esnek ki</h1>
          <StepBars steps={["app", "named", "captured", "scored", "revealed", "shared"].map((k2) => ({ l: FUNNEL[k2][0], n: k2 === "shared" ? n(N.shared) : f(k2), base: f("sessions") }))} /></div>}
        {k === 7 && <TvPlatforms soc={soc} />}
        {k === 6 && <div className="tv-list"><span className="eyebrow">Most fontos</span><h1>Amit érdemes tudni</h1>
          <ul className="tv-alerts">{todo.map((x, i) => <li key={i} className={x.c}><b>{x.t}</b><span>{x.s}</span></li>)}{!todo.length && <li className="good"><b>Minden rendben</b><span>Nincs teendő.</span></li>}</ul></div>}
      </div>
      <div className="tv-strip">
        <span><b>{fmt(T.scored)}</b> előnézet ma</span><span><b>{fmt(T.sessions)}</b> látogatás</span><span><b>{fmt(T.signups)}</b> új fiók</span>
        <span className="live"><i />{fmt(d.live_now)} most</span><span><b>{fmt(N.scored)}</b> előnézet {periodName(d)} <Delta now={n(N.scored)} prev={n(PV.scored)} /></span>
        <span className="tv-dots">{on.map((i) => <i key={i} className={i === k ? "on" : ""} />)}{paused && <em> szünet</em>}</span>
      </div>
    </div>
  );
}


/* ---------- milestone celebration: once per milestone, in this browser ---------- */
export const MS_SCORED = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export const MS_USERS = [10, 50, 100, 250, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000];

/* the last milestone reached, as a shareable card (PNG): from the search (⌘K → Mérföldkő-kártya) or the toast */
export function milestoneCard(d: D | null) {
  if (!d) return;
  const sc = n(d.all?.scored), us = n(d.all?.users);
  const a = [...MS_SCORED].reverse().find((x) => sc >= x), b = [...MS_USERS].reverse().find((x) => us >= x);
  const m = a ? { v: a, what: "kész előnézet" } : b ? { v: b, what: "regisztrált fiók" } : null;
  if (!m) { toast("Még nincs elért mérföldkő."); return; }
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d")!;
  const g = x.createRadialGradient(240, 200, 50, 540, 675, 1100); g.addColorStop(0, "#2a2310"); g.addColorStop(1, "#050506"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = "#F3D58A"; x.font = "600 34px Geist, sans-serif"; x.textAlign = "center"; x.fillText("INKAGE", 540, 200);
  x.font = "800 220px Geist, sans-serif"; x.fillStyle = "#F4F2EC"; x.fillText(m.v.toLocaleString("hu-HU"), 540, 720);
  x.font = "500 58px Geist, sans-serif"; x.fillStyle = "#F3D58A"; x.fillText(m.what, 540, 820);
  x.font = "400 36px Geist, sans-serif"; x.fillStyle = "#A3A3A8"; x.fillText("Köszönjük! · inkage.app", 540, 1180);
  const el = document.createElement("a"); el.href = c.toDataURL("image/png"); el.download = `inkage-${m.v}.png`; el.click();
}

export function Celebrate({ d }: { d: D }) {
  useEffect(() => {
    if (MOCK && new URLSearchParams(location.search).has("nocel")) return; /* design screenshots of the preview */
    let seen: string[] = []; try { seen = JSON.parse(localStorage.getItem("inkage.admin.ms") || "[]"); } catch {}
    const sc = n(d.all?.scored), us = n(d.all?.users);
    const a = [...MS_SCORED].reverse().find((x) => sc >= x), b = [...MS_USERS].reverse().find((x) => us >= x);
    const pick = a && !seen.includes("s" + a) ? { v: a, what: "kész előnézet", key: "s" + a } : b && !seen.includes("u" + b) ? { v: b, what: "regisztrált fiók", key: "u" + b } : null;
    if (!pick) return;
    /* the first visit marks every milestone already passed below this one, so only new ones celebrate later */
    const all = [...MS_SCORED.filter((x) => sc >= x).map((x) => "s" + x), ...MS_USERS.filter((x) => us >= x).map((x) => "u" + x)];
    try { localStorage.setItem("inkage.admin.ms", JSON.stringify(Array.from(new Set([...seen, ...all])))); } catch {}
    /* no popup: a quiet line at the top; the shareable card is in the search (⌘K → Mérföldkő-kártya) */
    toast(`Mérföldkő: ${pick.v.toLocaleString("hu-HU")} ${pick.what} · kártya: ⌘K`);
    /* a short burst of confetti over the page (two seconds, nothing to close; not with reduced motion) */
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const c = document.createElement("div"); c.className = "confetti"; c.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 36; i++) { const s = document.createElement("i"); s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.4 + "s"; s.style.background = ["#5B3DF5", "#2FA36B", "#F2B705", "#FF4FA3", "#25F4EE"][i % 5]; c.appendChild(s); }
      document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
    }
  }, [d.all?.scored, d.all?.users]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* the TV's platform slide: every platform side by side, one of them lit up in turn (followers, posts and views of the
   last 30 days, visitors from it); a platform without a connection says so instead of a zero */
function TvPlatforms({ soc }: { soc: D | null }) {
  const [hi, setHi] = useState(0);
  useEffect(() => { const t = setInterval(() => setHi((x) => (x + 1) % 6), 3000); return () => clearInterval(t); }, []);
  const PFS = ["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"];
  const accs: D[] = soc?.accounts || [], posts: D[] = soc?.posts || [], leads: D[] = soc?.leads || [], daily: D[] = soc?.daily || [];
  return (
    <div className="tv-list"><span className="eyebrow">Platformok · 30 nap</span><h1>Minden platform egy pillantásra</h1>
      <div className="tv-pfs">{PFS.map((pf, i) => { const on = accs.some((a) => a.platform === pf), ps = posts.filter((p) => p.platform === pf), fl = daily.filter((x) => x.platform === pf && x.followers != null).slice(-1)[0];
        return (
          <div key={pf} className={"tv-pf" + (i === hi ? " hi" : "") + (on || ps.length ? "" : " off")}>
            <Logo k={pf} size={52} />
            {on || ps.length ? <><b>{fl ? big(fl.followers) : "–"}</b><span>követő</span>
              <small>{fmt(ps.length)} poszt · {big(ps.reduce((t, p) => t + n(p.views), 0))} {pf === "pinterest" || pf === "linkedin" ? "megjelenés" : "megtekintés"} · {fmt(n(leads.find((l) => l.k === pf)?.sessions))} látogató</small></>
              : <small>nincs bekötve</small>}
          </div>); })}</div>
    </div>
  );
}
