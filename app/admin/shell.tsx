"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PrevPartialCtx, fmt } from "./charts";
import { Boundary, CloseX, Sheet, SubTabs, Toaster, cacheGet, cachePut, haptic, phoneNow, pushRecent, useLand, useLongPress, useOnline, usePhone, useScrolled, useSheetDrag, useSwipe, type MoreRow, type Recent, toast, toastText } from "./phone";
import { PhoneHost, PinRow, SiteMap, useNoteTap, usePrefs, useOwnTasks } from "./phone-host";
import { Giant } from "./ink";
import { useSaved } from "./shared";
import { LANG_LAND, flag } from "./visuals";
import { AIC, ALL, EXPIRED, FltCtx, FreshCtx, I, Loading, MOCK, NAV, P, PA, PERIODS, PROV, PTABS_DEFAULT, PTAB_L, PeriodCtx, RefreshCtx, SHORT, SOLVED, THEMES, THEME_L, ago, themeOf, alerts, api, ch, chCol, ev, lang, makePeriod, n,
  readFlt, rpc, rpcC, secOf, type Alert, type D, type Flt, type PSec, type Tab, writeFlt, Layer, solvedAt, big, useScrollLock, markOwnDevice, useFreshData, useTheme , chList, chToggle , ASKQ, PushNone } from "./shared";
import { PushSteps, usePush } from "./extra";
import { Alerts, signals, useSigState } from "./views/alerts";
import { Connect } from "./views/connect";
import { Accounts } from "./views/accounts";
import { Feedback } from "./views/feedback";
import { FunnelTab } from "./views/funnel";
import { Goals } from "./views/goals";
import { Home } from "./views/home";
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
import { Announce } from "./views/announce";
import { Audit } from "./views/audit";
import { Todo, TodoBadge } from "./views/todo";
import { Payments } from "./views/payments";

/* a few words under each menu item */
const NAVSUB: Partial<Record<Tab, string>> = { payments: "még nincs fizetés", announce: "üzenet az appban", audit: "ki, mikor, mit", platforms: "melyik mennyit ér", seo: "bejárás, kulcsszavak", brand: "említések, MI, versenytársak", monitor: "elérhetőség, futások, hibák", impressions: "hol láttak, mi kapcsán", youtube: "Shorts, nézőmegtartás", inbox: "kommentek, vélemények", ask: "MI a számaidról", planner: "naptár, ötletek", audience: "követők, demográfia", report: "a hét egy oldalon", home: "a nap számai", live: "most az oldalon", alerts: "teendők, jelzések", traffic: "csatornák", social: "posztok, videók", accounts: "minden fiók egymás mellett", feedback: "csillagok, vélemények", search: "keresések, cikkek",
  links: "rövid linkek", markets: "nyelvek, országok", stores: "letöltések", users: "fiókok", funnel: "lépésről lépésre", retention: "visszatérők", product: "mit használnak", inkage: "moderálás, MI, korlát",
  viral: "megosztások", connect: "bekötések", goals: "célok, jegyzetek", system: "beállítások, biztonság" };

/* Which page follows what. The dashboard's own numbers (admin_dashboard) follow the channel and language filter and the
   range of her own; the pages with their own data count in days (a range becomes "from its first day to today");
   the rest has no period at all. The controls show only where they act, so nothing looks filtered that is not. */
const FILTER_TABS: Tab[] = ["home", "alerts", "live", "ask", "traffic", "funnel", "users", "retention", "viral", "product"];
const NO_PERIOD: Tab[] = ["inkage", "feedback", "todo", "goals", "announce", "audit", "live", "links", "connect", "more", "inbox", "planner", "audience", "report", "seo", "brand", "monitor", "retention"];
const DAYS_ONLY: Tab[] = ["payments", "stores", "social", "accounts", "platforms", "search", "youtube", "impressions", "markets"];
/* Google, YouTube Analytics and the stores report whole days, 1–3 days late: these pages say which days they show */
const LATE_GOOGLE: Tab[] = ["search", "impressions", "markets", "youtube", "stores"];

/* the words for a failed load: never the browser's own English */
const offlineMsg = (m: string) => /fetch|network|load failed/i.test(m);
const loadErrText = (m: string) => (offlineMsg(m) ? "Nincs kapcsolat. Próbáld újra." : toastText(m));
/* the page from the address at the very first draw, so a reload never counts as a visit to the first page */
const hashTab = (): Tab => { try { const h = location.hash.slice(1) as Tab; if (ALL.some((x) => x.k === h)) return h; } catch {} return "home"; };
/* a title that always fits beside the buttons of the header: as large as the room allows */
function FitTitle({ text, dep, min = 13 }: { text: string; dep?: unknown; min?: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => { el.style.removeProperty("font-size"); const room = el.clientWidth, need = el.scrollWidth; if (need > room && room > 0) { const fs = parseFloat(getComputedStyle(el).fontSize); el.style.setProperty("font-size", Math.max(min, Math.floor((fs * room * 10) / need) / 10) + "px", "important"); } };
    fit(); const ro = new ResizeObserver(fit); if (el.parentElement) ro.observe(el.parentElement); document.fonts?.ready.then(fit).catch(() => null);
    return () => ro.disconnect();
  }, [text, dep, min]);
  return <h1 ref={ref}>{text}</h1>;
}

/* keyboard: g + a letter opens a page (capital M, B, P, K and L: Monitoring, Márka, Platformok, Közlemények and Napló), single keys for the rest */
const KEYS: Record<string, Tab> = { o: "home", a: "alerts", l: "live", f: "traffic", t: "social", k: "search", i: "links", p: "markets", s: "stores", e: "users", m: "retention", u: "funnel", h: "product", r: "system", c: "goals",
  j: "impressions", z: "seo", b: "inbox", q: "ask", n: "planner", d: "audience", y: "youtube", w: "report", x: "connect", v: "viral", M: "monitor", B: "brand", P: "platforms", K: "announce", L: "audit" };

export function Dashboard({ signOut }: { signOut: (note?: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [tab, setTab] = useState<Tab>(hashTab);
  /* every entry starts on the last 24 hours, on phone and computer; another period holds for this visit only */
  const [days, setDays] = useState(1);
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<{ kind: "forbidden" | "missing" | "expired" | "other"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string>("");
  const [at, setAt] = useState<number>(0);
  const [navOpen, setNavOpen] = useState(false);
  const [flt, setFltState] = useState<Flt>(() => { try { return readFlt(); } catch { return {}; } });
  const [pushGuide, setPushGuide] = useState(false); const [pal, setPal] = useState(false); const [help, setHelp] = useState(false);
  /* one refresh for everything: every card's useRpc listens to this number */
  const [epoch, setEpoch] = useState(0);
  const theme = useTheme(), light = theme.light;
  /* the ↑ ↓ % against the previous period: shown unless switched off (Időszak menü → Összehasonlítás) */
  const [cmp, setCmp] = useState(true);
  useEffect(() => { try { setCmp(localStorage.getItem("inkage.admin.cmp") !== "off"); } catch {} }, []);
  const setCmpP = useCallback((v: boolean) => { setCmp(v); try { localStorage.setItem("inkage.admin.cmp", v ? "on" : "off"); } catch {} }, []);
  const [slim, setSlim] = useState(false);
  /* the previews of today, the same number as on Ma */
  const [madeToday, setMadeToday] = useState<number | null>(null);
  const phone = usePhone(), scrolled = useScrolled(), land = useLand(), online = useOnline();
  useFillRows(!phone, String(tab)); useNoteTap();
  const [prefs, setPrefs] = usePrefs(); const [, setTasks] = useOwnTasks();
  const [recentSheet, setRecentSheet] = useState<Recent | null>(null);
  const [hold, setHold] = useState<Tab | null>(null); const [tabEdit, setTabEdit] = useState(false); const [newTask, setNewTask] = useState<string | null>(null);
  const fresh = useFreshData(epoch), push = usePush();
  const [badges, setBadges] = useState<D | null>(null);
  /* the alerts' "Kész" / "Holnap" state, for the menu badge (the same as the Jelzések page) */
  /* one odd row of data must not take the whole frame down: the page's own part says what is missing */
  const sigList = useMemo(() => { if (!data) return []; try { return signals(data); } catch { return []; } }, [data, badges]); // eslint-disable-line react-hooks/exhaustive-deps
  const sigS = useSigState(sigList);
  /* the platforms', the SEO and the system's own signals join the alerts (bell, Jelzések, the home page's next steps) */
  const [, setPa] = useState(0);
  useEffect(() => {
    /* phone: the last known signals and counts until the fresh ones arrive, and when there is no connection */
    if (phoneNow()) cacheGet("signals").then((c) => { const v = c?.d as { pa?: Alert[]; b?: D } | undefined; if (v && !PA.list.length) { PA.list = v.pa || []; if (v.b) setBadges((o) => o || v.b!); setPa((x) => x + 1); } });
    const load = () => Promise.all([rpcC(sb, "admin_platform_alerts"), rpcC(sb, "admin_seo_alerts"), rpcC(sb, "admin_system_alerts"), rpcC(sb, "admin_badges")]).then(([a, b, c, bd]) => {
      if (phoneNow() && a.error && b.error && c.error) return;
      PA.list = [...(Array.isArray(a.data) ? a.data : []), ...(Array.isArray(b.data) ? b.data : []), ...(Array.isArray(c.data) ? c.data : [])] as Alert[];
      if (bd.data) setBadges(bd.data as D);
      setPa((x) => x + 1);
      if (phoneNow()) cachePut("signals", { pa: PA.list, b: bd.data });
    });
    load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 2 * 60_000); return () => clearInterval(t);
  }, [sb, epoch]);
  /* "Megoldva" marks from the database, so every device agrees */
  useEffect(() => { rpc(sb, "admin_solved_list").then(({ data: s }) => { if (s && typeof s === "object") { SOLVED.map = s as Record<string, string>; setPa((x) => x + 1); } }); }, [sb, epoch]);
  /* the service worker: a quick start and offline copy of this page, and the phone's notifications */
  useEffect(() => { if (MOCK || !("serviceWorker" in navigator)) return; navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(() => null); }, []);
  useSheetDrag(phone);
  /* the morning story belongs to Ma; the menu's switch is the same setting as the one in Ma's settings */
  const [maFx, setMaFx] = useSaved<{ story: boolean; wall: boolean; mood: boolean }>("phone_ma_fx", { story: true, wall: true, mood: true });
  useEffect(() => { try { setSlim(localStorage.getItem("inkage.admin.slim") === "1"); } catch {} }, []);
  useEffect(() => { let on = true; rpcC(sb, "admin_ma_compare", { p_ch: flt.ch || null, p_lang: flt.lang || null }).then(({ data: c }) => { const v = (c as D | null)?.today?.made; if (on && v != null) setMadeToday(n(v)); }); return () => { on = false; }; }, [sb, epoch, flt.ch, flt.lang]);
  /* the arrow back to the top shows only while she is scrolling up, so it never sits on a number while she reads */
  useEffect(() => {
    let last = window.scrollY, h: ReturnType<typeof setTimeout> | null = null; const root = document.documentElement;
    const f = () => { const y = window.scrollY; if (y < last - 2) { root.setAttribute("data-adm-up", "1"); if (h) clearTimeout(h); h = setTimeout(() => root.removeAttribute("data-adm-up"), 1800); } else if (y > last + 2) { root.removeAttribute("data-adm-up"); } last = y; };
    addEventListener("scroll", f, { passive: true }); return () => { removeEventListener("scroll", f); if (h) clearTimeout(h); root.removeAttribute("data-adm-up"); };
  }, []);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  /* phone: pull the page down from the top to refresh (everything, not only the main numbers) */
  const [pull, setPull] = useState(0);
  useEffect(() => {
    let y0: number | null = null, dy = 0;
    /* only on the page itself: never from inside a popup, the menu or the search, nor while one is open */
    const st = (e: TouchEvent) => { const open = !!document.querySelector("#adm-layer>*,.popv,.story-ov,.ink-bign,.ink-cel") || document.documentElement.hasAttribute("data-adm-locked"); y0 = !open && window.scrollY <= 0 ? e.touches[0].clientY : null; dy = 0; };
    const mv = (e: TouchEvent) => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) setPull(Math.min(1, dy / 90)); };
    const en = () => { if (y0 != null && dy > 90) { navigator.vibrate?.(10); setPull(2); loadRef.current?.().finally(() => setTimeout(() => setPull(0), 300)); } else setPull(0); y0 = null; };
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchmove", mv, { passive: true }); addEventListener("touchend", en);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchmove", mv); removeEventListener("touchend", en); };
  }, []);
  const toggleSlim = () => setSlim((v) => { try { localStorage.setItem("inkage.admin.slim", v ? "0" : "1"); } catch {} return !v; });
  useEffect(() => {
    if (!matchMedia("(hover:hover)").matches) return;
    const f = (e: PointerEvent) => { const c = (e.target as HTMLElement)?.closest?.(".c,.tile,.kpi") as HTMLElement | null; if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); };
    addEventListener("pointermove", f, { passive: true }); return () => removeEventListener("pointermove", f);
  }, []);
  const [, tick] = useState(0);
  useEffect(() => { setFltState(readFlt()); }, []);
  const fltRef = useRef(flt); fltRef.current = flt;
  /* one rule for every way of setting it: a last day needs a first day, and never comes before it */
  const setFlt = useCallback((p: Partial<Flt>) => { const nf = { ...fltRef.current, ...p }; if (nf.to && (!nf.from || nf.to < nf.from)) delete nf.to; (Object.keys(nf) as (keyof Flt)[]).forEach((k) => { if (!nf[k]) delete nf[k]; }); fltRef.current = nf; setFltState(nf); writeFlt(nf); }, []);

  useEffect(() => {
    try {
      /* a period remembered by an earlier version goes away: the old choice in this browser and in the address */
      localStorage.removeItem("inkage.admin.days"); Object.keys(localStorage).filter((k) => k.startsWith("inkage.admin.cd.")).forEach((k) => localStorage.removeItem(k));
      const q = new URLSearchParams(location.search); if (q.has("p") || q.has("from") || q.has("to")) { ["p", "from", "to"].forEach((k) => q.delete(k)); const qs = q.toString().replace(/=(&|$)/g, "$1"); history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash); }
    } catch {}
    if (MOCK) setMe("viktoriasoti@yahoo.com"); else {
      sb?.auth.getUser().then(({ data }) => setMe(data.user?.email || "")); markOwnDevice();
      /* where the owner is now: the morning e-mail goes out at 6:00 in this time zone */
      try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz) rpc(sb, "admin_tz_set", { p_tz: tz }); } catch {}
    }
  }, [sb]);

  /* quick start: the last numbers show at once (kept in this browser, without e-mails or the live feed), the fresh ones follow */
  const cacheKey = `inkage.admin.cache.${days}.${flt.ch || ""}.${flt.lang || ""}.${flt.from || ""}.${flt.to || ""}`;
  useEffect(() => { if (MOCK && !new URLSearchParams(location.search).has("offline")) return; try { const c = JSON.parse(localStorage.getItem(cacheKey) || "null"); if (c?.d) { setData((o) => o || c.d); if (phoneNow() && c.at) setAt((o) => o || c.at); } } catch {} }, [cacheKey]);
  const period = useMemo(() => makePeriod(days, flt), [days, flt]);
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    /* only the newest request's answer counts (a slower one for the period chosen before never overwrites it) */
    const my = ++loadSeq.current;
    setBusy(true);
    const { data: d, error, at: srvAt } = await rpcC(sb, "admin_dashboard", { p_days: days, p_from: period.p_from, p_to: period.p_to, p_ch: flt.ch || null, p_lang: flt.lang || null });
    if (my !== loadSeq.current) return;
    setBusy(false);
    if (error) {
      const m = (error.message || "") + " " + (error.code || "");
      setErr(/JWT|PGRST30[0-3]|expired/i.test(m) ? { kind: "expired", msg: m } : /forbidden|42501/.test(m) ? { kind: "forbidden", msg: m } : /PGRST202|could not find|does not exist/i.test(m) ? { kind: "missing", msg: m } : { kind: "other", msg: m });
      return;
    }
    setErr(null); setData(d as D); setAt(srvAt || Date.now());
    try { const { live: _l, errors: _e, ...rest } = d as D; localStorage.setItem(cacheKey, JSON.stringify({ at: srvAt || Date.now(), d: { ...rest, live: [], errors: [], users: rest.users ? { ...rest.users, recent: [] } : rest.users } })); } catch {}
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
    /* the main numbers and every card every minute, from the server's store (only while the page is in view) */
    /* the phone: every 3 minutes, and never while she is touching or scrolling (a whole page redrawn mid-scroll froze it) */
    const ph = phoneNow(), every = ph ? 180_000 : 60_000;
    let touched = 0; const poke = () => { touched = Date.now(); };
    if (ph) ["touchstart", "scroll"].forEach((e) => addEventListener(e, poke, { passive: true }));
    const calm = () => document.visibilityState === "visible" && (!ph || Date.now() - touched > 15_000);
    const iv = setInterval(() => { if (calm()) load(); }, every);
    const ie = setInterval(() => { if (calm()) setEpoch((x) => x + 1); }, every);
    const lv = tab === "live" || tab === "home" ? setInterval(async () => { if (document.visibilityState !== "visible") return; const { data: l } = await rpc(sb, "admin_live", { p_ch: flt.ch || null, p_lang: flt.lang || null }); if (l) setData((o) => (o ? { ...o, live: l.live, live_now: l.live_now, live_hour: l.live_hour, ...(flt.ch || flt.lang ? {} : { today: l.today }) } : o)); }, 10_000) : null;
    /* the "… perce" times: on the phone once a minute, and not mid-scroll (each tick redraws the whole page) */
    const t2 = setInterval(() => { if (calm()) tick((x) => x + 1); }, ph ? 60_000 : 15_000);
    return () => { clearInterval(iv); clearInterval(ie); clearInterval(t2); if (lv) clearInterval(lv); if (ph) ["touchstart", "scroll"].forEach((e) => removeEventListener(e, poke)); };
  }, [load, tab, sb, flt]);

  /* Navigation: every page change is a step in the browser's history, so Back goes to the previous page of the
     dashboard (not out of it), and the #page in the address bar works as a link. */
  /* how many steps back stay inside the dashboard: kept in the history entry itself, so the browser's own Back keeps it right */
  const [depth, setDepth] = useState(0); const depthRef = useRef(0); depthRef.current = depth;
  useEffect(() => { try { const d = history.state?.admD; if (typeof d === "number") setDepth(d); else history.replaceState({ ...history.state, admD: 0 }, ""); } catch {} }, []);
  const lastSub = useRef<Record<string, string>>({});
  useEffect(() => { const th = themeOf(tab); if (th) lastSub.current[th.k] = tab; }, [tab]);
  const tabRef = useRef(tab); tabRef.current = tab;
  /* phone: Back returns to the very place on the page she came from */
  const scrollAt = useRef<Record<string, number>>({});
  useEffect(() => {
    const h = (e?: Event) => {
      const raw = location.hash.slice(1); let k = raw as Tab;
      /* an address that came from outside this history (typed, a link) is one more step */
      if (e?.isTrusted && e.type === "hashchange" && typeof history.state?.admD !== "number") { try { history.replaceState({ ...history.state, admD: depthRef.current + 1 }, ""); } catch {} }
      if (typeof history.state?.admD === "number") setDepth(history.state.admD);
      /* an address that means nothing here is cleaned; on a computer "Több" and "Teendők" are the overview */
      if (raw && !raw.includes("=") && !ALL.some((x) => x.k === k)) { try { history.replaceState(history.state, "", location.pathname + location.search); } catch {} return; }
      if (!raw) return;
      if (!phoneNow() && (k === "more" || k === "todo")) { k = "home"; try { history.replaceState(history.state, "", location.pathname + location.search + "#home"); } catch {} }
      if (!phoneNow()) { setTab(k); window.scrollTo({ top: 0 }); return; }
      if (k === tabRef.current) return;
      const y = scrollAt.current[k] || 0; setTab(k); window.scrollTo({ top: y });
      /* the page draws its cards as they come near: try again until the place exists */
      let n2 = 0; const t = setInterval(() => { window.scrollTo({ top: y }); if (++n2 > 8 || Math.abs(window.scrollY - y) < 2) clearInterval(t); }, 120);
    };
    addEventListener("hashchange", h); addEventListener("popstate", h); h();
    return () => { removeEventListener("hashchange", h); removeEventListener("popstate", h); };
  }, []);
  const go = useCallback((k: Tab) => {
    /* a page that no longer exists (an old pin, an old "Legutóbb" row) stays where she is */
    if (!ALL.some((x) => x.k === k)) return;
    if (k !== tabRef.current) { scrollAt.current[tabRef.current] = window.scrollY; try { const nd = depthRef.current + 1; history.pushState({ ...history.state, tab: k, admD: nd }, "", location.search + "#" + k); setDepth(nd); } catch {} }
    setTab(k); setNavOpen(false); window.scrollTo({ top: 0 });
  }, []);
  const goBack = () => { if (depthRef.current > 0) history.back(); };
  /* phone: a swipe from the left edge goes back (sideways swipes elsewhere leave the page alone) */
  const bodyRef = useRef<HTMLDivElement>(null);
  const theme2 = themeOf(tab), subs = theme2 && theme2.pages.length > 1 ? theme2.pages : null;
  /* a drag never changes the page: the sub-tabs are tapped, rows and maps keep their own drags; only the left edge goes back */
  useSwipe(bodyRef, { back: goBack });
  /* phone: what was seen goes to "Legutóbb"; the old "Több" address opens the map */
  useEffect(() => { if (!phone) return; if (tab === "more") { setTab("home"); setPal(true); return; } const c0 = ALL.find((x) => x.k === tab); if (c0) pushRecent({ k: "page", id: tab, l: c0.l }); }, [tab, phone]);
  const pick = useCallback((d: number) => { setDays(d); setFlt({ from: undefined, to: undefined }); }, [setFlt]);
  /* coming back to the app after a while counts as a new entry too: the last 24 hours again */
  useEffect(() => {
    let away = 0;
    const f = () => { if (document.visibilityState === "hidden") { away = Date.now(); return; } if (away && Date.now() - away > 15 * 60e3) pick(1); away = 0; };
    document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f);
  }, [pick]);
  const syncNow = useCallback(async () => { toast("Lehúzás indul…"); const r = await api("/api/admin/sync", { method: "POST" }); toast(r.ok && r.json?.ok !== false ? "Lehúzás kész" : "A lehúzás hibával futott: részletek a Monitoringban"); refresh(); }, [refresh]);

  /* Escape closes the popup on top, whichever kind it is: its own close button runs, so each keeps its own closing logic.
     In the capture phase, so one press closes one popup even where a popup also listens for it */
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".adm i.info.open")) { document.body.click(); e.stopPropagation(); return; }
      const all = document.querySelectorAll<HTMLElement>("#adm-layer [data-close], .adm .popv [data-close], .story-ov [data-close]");
      const top = all[all.length - 1];
      if (top) { e.preventDefault(); e.stopPropagation(); top.click(); return; }
      setHelp(false); setNavOpen(false);
    };
    addEventListener("keydown", esc, true); return () => removeEventListener("keydown", esc, true);
  }, []);
  /* keyboard: ⌘K / Ctrl+K or "/" search, g + a letter a page, r refresh, d day / night, 1 7 3 9 0 the period, ? help */
  const keyRef = useRef<{ go: typeof go; refresh: () => void; pick: (d: number) => void; cycle: () => void }>({ go, refresh, pick, cycle: theme.cycle });
  keyRef.current = { go, refresh, pick, cycle: theme.cycle };
  useEffect(() => {
    let g = 0;
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || "") || (e.target as HTMLElement)?.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) { e.preventDefault(); setPal(true); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g") { g = Date.now(); return; }
      if (Date.now() - g < 1200 && KEYS[e.key]) { g = 0; keyRef.current.go(KEYS[e.key]); return; }
      g = 0;
      const R = keyRef.current;
      if (e.key === "?") setHelp((x) => !x);
      else if (e.key === "r") R.refresh();
      else if (e.key === "d") R.cycle();
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
  const todo = data ? sigList.filter((x) => !sigS.hidden(x)).length : 0;
  const B = { monitor: n(badges?.monitor_bad), inbox: n(badges?.inbox_open), connect: n(badges?.connect_bad) };

  const grp = NAV.find((g) => g.items.some((x) => x.k === tab))?.g || "";
  const noPeriod = NO_PERIOD.includes(tab), showFilter = FILTER_TABS.includes(tab);
  /* no connection, or the network does not answer: said once, at the top */
  const offline = !online || (!!err && offlineMsg(err.msg));
  const connected = Object.keys(fresh?.platforms || {}).length;
  const moreGroups: { g: string; rows: MoreRow[] }[] = [
    { g: "Beállítások", rows: [
      { k: "tabs", l: "Alsó menü", icon: I(P.layers), tone: "lilac", note: "te döntöd el, mi van a négy helyen", run: () => { setPal(false); setTabEdit(true); } },
      { k: "theme", l: "Téma: " + THEME_L[theme.mode], icon: I(light ? P.sun : P.moon), tone: "lilac", note: "automatikus, nappal, éjszaka", run: theme.cycle },
      { k: "push", l: "Értesítések", icon: I(P.bell), tone: "peach", note: push.st === "na" ? "ez a böngésző nem tud" : push.st === "denied" ? "a böngésző tiltja" : "robbanó poszt, új vélemény, hiba", toggle: true, on: push.st === "on", run: () => { setPal(false); setPushGuide(true); } },
      { k: "story", l: "Reggeli összefoglaló", icon: I(P.spark), tone: "butter", note: "a nap első megnyitásakor", toggle: true, on: maFx.story, run: () => setMaFx({ ...maFx, story: !maFx.story }) },
      { k: "export", l: "Teljes export (JSON)", icon: I(P.share), tone: "mint", note: "minden szám egy fájlban", run: () => exportAll(sb, data) },
      { k: "supabase", l: "Supabase", icon: I(P.layers), tone: "mint", note: "adatbázis ↗", run: () => window.open("https://supabase.com/dashboard/project/yaimucilncjkuaxnmpbg", "_blank") },
      { k: "vercel", l: "Vercel", icon: I(P.bolt), tone: "sky", note: "telepítések ↗", run: () => window.open("https://vercel.com/viktoriasv751s-projects/signa", "_blank") },
      { k: "out", l: "Kilépés", icon: I(P.x), tone: "pink", run: () => signOut() },
    ] },
  ];
  void connected;
  /* the map's and a held tab's quick actions (what the old + button held) */
  const quick = [
    { l: "Új teendő", i: P.check, run: () => { setPal(false); setHold(null); setNewTask(""); } }, { l: "Rövid linkek", i: P.links, run: () => { setPal(false); setHold(null); go("links"); } },
    { l: "Tervező", i: P.calendar, run: () => { setPal(false); setHold(null); go("planner"); } }, { l: "Célok és napló", i: P.doc, run: () => { setPal(false); setHold(null); go("goals"); } },
    { l: "Lehúzás most", i: P.refresh, run: () => { setPal(false); setHold(null); syncNow(); } },
  ];
  /* (a saved row of tabs holding a page that no longer exists falls back to the default) */
  const ptabs = prefs.tabs?.length === 4 && prefs.tabs.every((k) => ALL.some((x) => x.k === k)) ? prefs.tabs : PTABS_DEFAULT;
  /* exactly one tab is lit; a page under none of them lights the profile button, the way to it */
  const ptabCur = ptabs.includes(tab) ? tab : ptabs.find((k) => secOf(k) === secOf(tab));
  const ptabOn = (k: Tab) => k === ptabCur;
  /* the number beside a page in the menus: only what is already known without opening the page */
  const pageBadge = (k: Tab): number | undefined => (k === "system" ? errs : k === "alerts" ? todo : k === "monitor" ? B.monitor : k === "inbox" ? B.inbox : k === "connect" ? B.connect : k === "live" ? n(data?.live_now) : k === "users" ? n(data?.all?.users) : k === "product" ? n(madeToday) : k === "traffic" ? n(data?.today?.sessions) : 0) || undefined;
  const openRecent = (r: Recent) => { setPal(false); if (r.k === "page") go(r.id as Tab); else setRecentSheet(r); };
  const navBadge = (k: Tab) => {
    if (k === "system") return errs > 0 ? <span className="cnt">{errs}</span> : data ? <span className="okdot" title="Minden rendben" /> : null;
    if (k === "alerts") return data && todo > 0 ? <span className="cnt">{todo}</span> : null;
    if (k === "live") return data && n(data.live_now) > 0 ? <span className="cnt live">{data.live_now}</span> : null;
    if (k === "monitor") return B.monitor > 0 ? <span className="cnt">{B.monitor}</span> : badges ? <span className="okdot" title="Minden fut" /> : null;
    if (k === "inbox") return B.inbox > 0 ? <span className="cnt soft">{B.inbox}</span> : null;
    if (k === "connect") return B.connect > 0 ? <span className="cnt">{B.connect}</span> : null;
    if (k === "users" || k === "product" || k === "traffic") { const v = pageBadge(k); return v ? <span className="cnt soft">{fmt(v)}</span> : null; }
    return null;
  };
  /* what a page with its own day-counted data shows when the range is her own, and where Google's lag widens 24 hours */
  const pnote = noPeriod ? null : (DAYS_ONLY.includes(tab) || tab === "home") && flt.from ? `Ez az oldal napokban számol: ${flt.from.replace(/-/g, ".")} óta ${period.eff} napot mutat${flt.to ? " (a záró nap itt nem számít)" : ""}.`
    : LATE_GOOGLE.includes(tab) && days >= 1 && days <= 7 && !flt.from ? `${tab === "youtube" ? "A YouTube Analytics" : tab === "stores" ? "Az App Store és a Google Play" : "A Google"} egész napokat ad, 1–3 nap késéssel: a ${days === 1 ? "24 óra" : days + " nap"} itt a legutóbbi napokat jelenti, amelyekre már van adat (a pontos dátum a számok mellett).` : null;
  return (
    <div className={"adm" + (cmp ? "" : " nocmp") + (navOpen ? " nav-open" : "") + (light ? " light" : "") + (slim ? " slim" : "") + (scrolled ? " scrolled" : "") + (phone ? " is-phone" : "") + (land ? " is-land" : "")} onClick={(e) => { if (navOpen && (e.target as HTMLElement).classList.contains("adm")) setNavOpen(false); }}>
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
                <button key={x.k} aria-current={tab === x.k ? "page" : undefined} onClick={() => go(x.k)} title={slim ? x.l : undefined}>
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
            <button onClick={() => setHelp(true)}>Billentyűk</button>
            <a href="https://supabase.com/dashboard/project/yaimucilncjkuaxnmpbg" target="_blank" rel="noreferrer">Supabase ↗</a>
            <a href="https://vercel.com/viktoriasv751s-projects/signa" target="_blank" rel="noreferrer">Vercel ↗</a>
          </div>
        </div>
      </aside>

      <main className="adm-main">
        {phone ? <header className="adm-top ph-top">
          <button className={"ph-btn me" + (ptabCur ? "" : " here")} onClick={() => { haptic(5); setPal(true); }} aria-label={ptabCur ? "Menü és keresés" : `Menü és keresés: most itt vagy: ${cur.l}`}>V</button>
          {depth > 0 && !ptabs.includes(tab) && <button className="ph-btn bk" onClick={goBack} aria-label="Vissza">{I(P.chev)}</button>}
          <div className="ph-tt"><small>{themeOf(tab)?.l === cur.l || tab === "home" ? "" : themeOf(tab)?.l || ""}</small><FitTitle text={tab === "home" ? "Ma" : cur.l} dep={String(scrolled) + (depth > 0) + (!noPeriod || showFilter)} /></div>
          {(!noPeriod || showFilter) && <ContextPill d={data} days={days} f={flt} pick={pick} set={setFlt} cmp={cmp} setCmp={setCmpP} showPeriod={!noPeriod} showFilter={showFilter} tab={tab} go={go} note={pnote} />}
        </header> : <header className="adm-top">
          <div className="ttl">
            <button className="adm-burger" aria-label="Menü" onClick={() => setNavOpen(true)}>{I(P.menu)}</button>
            {depth > 0 && <button className="adm-back" onClick={goBack} aria-label="Vissza" title="Vissza">{I(P.chev)}</button>}
            <div style={{ minWidth: 0 }}><span className="crumb">{grp}{ASKQ[tab] && <button className="ask-here" onClick={() => { try { sessionStorage.setItem("inkage.admin.askq", ASKQ[tab]!); } catch {} go("ask"); }} title={ASKQ[tab]}>{I(P.spark)}Kérdezz erről az oldalról</button>}</span><FitTitle text={cur.l} min={16} /></div>
          </div>
          <button className="top-search" onClick={() => setPal(true)}>{I(P.search)}<span>Keresés: oldal, ember, cikk, poszt, link…</span><kbd>⌘K</kbd></button>
          <div className="adm-tools">
            {data && showFilter && <FilterPick d={data} f={flt} set={setFlt} phone={phone} />}
            <ViewsPick f={flt} set={setFlt} days={days} pick={pick} tab={tab} go={go} />
            {!noPeriod && <PeriodPick days={days} f={flt} pick={pick} set={setFlt} cmp={cmp} setCmp={setCmpP} />}
            {data && <Bell d={data} go={go} />}
            <button className={"adm-ibtn ic" + (busy ? " busy" : "")} onClick={refresh} aria-label="Frissítés" title={at ? "Frissítve " + ago(new Date(at).toISOString()) + " · r" : "Frissítés (r)"}>{I(P.refresh)}</button>
            {at > 0 && <span className="upd-ago hide-sm" title={new Date(at).toLocaleString("hu-HU")}>{ago(new Date(at).toISOString())}</span>}
          </div>
        </header>}
        <div className="adm-body" ref={bodyRef}>
          {phone && subs && <SubTabs items={subs.map((k) => ({ k, l: SHORT[k] || ALL.find((x) => x.k === k)!.l, n: k === "alerts" ? todo : k === "inbox" ? B.inbox : undefined }))} cur={tab} go={(k) => go(k as Tab)} />}
          {phone && <button className={"ph-fresh" + (offline ? " off" : "") + (busy ? " busy" : "")} onClick={refresh} aria-label="Frissítés most">
            {!offline ? <>{at > 0 ? `Frissítve ${ago(new Date(at).toISOString())}` : "Töltés…"}</> : <>Nincs kapcsolat · {at > 0 ? `utoljára ${ago(new Date(at).toISOString())} frissült` : "a legutóbbi állapot látszik"}</>}
          </button>}
          {phone && tab === "home" && <PinRow prefs={prefs} go={go} />}
          {MOCK && <div className="mock-bar">Mintaadatok · csak a fejlesztői gépen</div>}
          {err && !(phone && offline) && <div className="alert err">Az utolsó frissítés nem sikerült. {loadErrText(err.msg)} <button className="lnk" onClick={load}>Újra</button></div>}
          <ConnectNote go={go} />
          {pnote && !phone && <p className="s12 pnote">{I(P.calendar)}{pnote}</p>}
          {!phone && showFilter && (flt.ch || flt.lang || flt.from) && <div className="fchips">
            {chList(flt.ch).map((c) => <button key={c} className="fchip" onClick={() => setFlt({ ch: chToggle(flt.ch, c) })}><span className="chlg" style={{ background: chCol(c) }}>{ch(c)[0]}</span>{ch(c)}<b>✕</b></button>)}
            {flt.lang && <button className="fchip" onClick={() => setFlt({ lang: undefined })}><span className="fl">{flag((LANG_LAND[flt.lang] || [])[0])}</span>{lang(flt.lang)}<b>✕</b></button>}
            {flt.from && <button className="fchip" onClick={() => setFlt({ from: undefined, to: undefined })}>{I(P.calendar)}{flt.from} – {flt.to || "ma"}<b>✕</b></button>}
            <button className="lnk" onClick={() => setFlt({ ch: undefined, lang: undefined, from: undefined, to: undefined })}>Mind törlése</button>
          </div>}
          {!showFilter && (flt.ch || flt.lang) && <p className="s12 pnote mut">Be van állítva szűrő, de ez az oldal nem szűrhető, itt nem hat. <button className="lnk" onClick={() => setFlt({ ch: undefined, lang: undefined })}>Szűrő törlése</button></p>}
          {!data ? <Loading /> : (
            <RefreshCtx.Provider value={epoch}><PeriodCtx.Provider value={period}><FreshCtx.Provider value={fresh}><FltCtx.Provider value={{ f: flt, set: setFlt }}><PrevPartialCtx.Provider value={!!data?.prev_partial}>
              <div className="adm-page" key={tab + ":" + days + ":" + (flt.from || "") + (flt.to || "")}><Boundary label="Ez az oldal most nem tölthető be.">
              {tab === "todo" && <Todo d={data} go={go} />}
              {(tab === "home" || (tab === "more" && !phone)) && <Home d={data} days={period.eff} go={go} phone={phone} />}
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
              {tab === "accounts" && <Accounts days={period.eff} />}
              {tab === "feedback" && <Feedback />}
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
              {tab === "payments" && <Payments days={period.eff} />}
              </Boundary></div>
            </PrevPartialCtx.Provider></FltCtx.Provider></FreshCtx.Provider></PeriodCtx.Provider></RefreshCtx.Provider>
          )}
        </div>
      </main>
      {pull > 0 && <div className={"ptr" + (pull >= 2 ? " go" : "")} style={{ opacity: Math.min(1, pull), transform: `translateY(${Math.min(1, pull) * 30}px) rotate(${pull * 270}deg)` }}>{I(P.refresh)}</div>}
      {data && <Celebrate d={data} />}
      <Boundary label="A keresés most nem tölthető be."><Palette open={pal} close={() => setPal(false)} go={go} d={data} set={(p) => { setFlt(p); if ((p.ch || p.lang) && !FILTER_TABS.includes(tabRef.current)) toast("Szűrő beállítva, de ezen az oldalon nem hat"); }} refresh={refresh} recentSheet={recentSheet} clearRecent={() => setRecentSheet(null)}
        map={phone ? <SiteMap tab={tab} go={(k) => { setPal(false); go(k); }} open={openRecent} groups={moreGroups} badge={pageBadge} quick={quick} today={madeToday ?? undefined} todoBadge={data ? <TodoBadge d={data} go={go} /> : null} foot={{ theme: { l: THEME_L[theme.mode], icon: I(theme.mode === "auto" ? P.clock : light ? P.sun : P.moon), run: theme.cycle }, out: () => signOut() }} /> : undefined} settings={phone ? moreGroups : undefined}
        acts={{ theme: theme.cycle, sync: syncNow, out: () => signOut(), help: () => setHelp(true), exportAll: () => exportAll(sb, data), card: () => milestoneCard(data) }} /></Boundary>
      {help && <KeyHelp close={() => setHelp(false)} />}
      {<nav className="adm-tabbar ph-5" aria-label="Fő részek">
        {ptabs.map((k) => <PTabBtn key={k} k={k} on={ptabOn(k)} badge={k === "todo" && data ? <TodoBadge d={data} go={go} /> : null}
          tap={() => {
            haptic(6);
            /* tapping the open section again: back to its first page and the top */
            if (ptabOn(k)) { if (tab !== k) go(k); else window.scrollTo({ top: 0, behavior: "smooth" }); return; }
            const th = themeOf(k), last = th ? (lastSub.current[th.k] as Tab | undefined) : undefined;
            go(last && th!.pages.includes(last) && !ptabs.includes(last) ? last : k);
          }} hold={() => setHold(k)} />)}
        {/* the side menu (every page, search, settings) at the right thumb, the same as the "V" button at the top left */}
        <button className="ph-menu" aria-expanded={pal} aria-label="Oldalmenü: minden oldal és keresés" onClick={() => { haptic(6); setPal(true); }}>{I(P.menu)}<span>Menü</span></button>
      </nav>}
      {phone && <PhoneHost tab={tab} go={go} />}
      {hold && <Sheet title={PTAB_L[hold]?.[0] || ALL.find((x) => x.k === hold)?.l} close={() => setHold(null)}>
        {hold !== "ask" && (themeOf(hold)?.pages.length || 0) > 1 && <div className="ps-opts">{themeOf(hold)!.pages.map((k) => <button key={k} aria-pressed={k === tab} onClick={() => { setHold(null); go(k); }}>{SHORT[k] || ALL.find((x) => x.k === k)?.l}</button>)}</div>}
        <h4 className="ps-t">Gyors műveletek</h4>
        <div className="ps-acts">{quick.map((x) => <button key={x.l} onClick={x.run}>{I(x.i)}<span>{x.l}</span></button>)}<button onClick={() => { setHold(null); setTabEdit(true); }}>{I(P.layers)}<span>Alsó menü testreszabása</span></button></div>
      </Sheet>}
      {pushGuide && <Sheet title="Értesítések a telefonra" close={() => setPushGuide(false)}><PushSteps p={push} /></Sheet>}
      {newTask != null && <Sheet title="Új teendő" close={() => setNewTask(null)} foot={<button className="adm-ibtn gold" disabled={!newTask.trim()} onClick={() => { setTasks((o) => [...o, { id: String(Date.now()), t: newTask.trim().slice(0, 200), at: new Date().toISOString() }].slice(-40)); setNewTask(null); toast("Hozzáadva a Teendőkhöz"); }}>Hozzáadás</button>}>
        <textarea className="adm-in" rows={3} autoFocus value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Mit ne felejts el?" aria-label="Új teendő" />
      </Sheet>}
      {tabEdit && <Sheet title="Alsó menü" sub="A négy hely, balról jobbra" close={() => setTabEdit(false)} foot={<button className="adm-ibtn" onClick={() => setPrefs({ ...prefs, tabs: undefined })}>Vissza az eredetire</button>}>
        {ptabs.map((k, i) => <label key={i} className="pfield"><span>{i + 1}. hely</span><select className="adm-in" value={k} onChange={(e) => { const nx = [...ptabs]; const v = e.target.value as Tab, j = nx.indexOf(v); if (j >= 0) nx[j] = nx[i]; nx[i] = v; setPrefs({ ...prefs, tabs: nx }); }}>
          {THEMES.map((th) => <optgroup key={th.k} label={th.l}>{th.pages.map((p2) => <option key={p2} value={p2}>{PTAB_L[p2]?.[0] || ALL.find((x) => x.k === p2)?.l}</option>)}</optgroup>)}
        </select></label>)}
      </Sheet>}
      <div id="adm-layer" />
      <Toaster />
    </div>
  );
}


/* one bottom tab: a tap goes there, holding it opens its pages and the quick actions */
function PTabBtn({ k, on, tap, hold, badge }: { k: Tab; on: boolean; tap: () => void; hold: () => void; badge: React.ReactNode }) {
  const lp = useLongPress(hold), pg = ALL.find((x) => x.k === k), own = PTAB_L[k];
  return <button aria-current={on ? "page" : undefined} {...{ onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onContextMenu: lp.onContextMenu }} onClick={() => { if (!lp.wasLong()) tap(); }}>{I(own?.[1] || pg?.i || P.doc)}<span>{own?.[0] || SHORT[k] || pg?.l}</span>{badge}</button>;
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
        <CloseX close={() => setOpen(false)} />
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
          <input className="adm-in" type="date" max={today} min={f.from} disabled={!f.from} value={f.to || ""} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="Utolsó nap" />
        </div>
        <p className="note">Gyorsbillentyű: 1 = 24 óra, 4 = 3 nap, 7, 3 = 30 nap, 9 = 90 nap, 0 = mind. A saját időszakot a fő számok pontosan követik; a saját adatukat napokban számoló oldalak a kezdőnaptól máig mutatják.</p>
      </div></>}
    </div>
  );
}


/* ---------- phone: one pill for the period and the filter, what is set is always written on it ---------- */
/* on the computer a row of cards never ends in a half-empty gap: the last card of a short row takes what is left of it */
function useFillRows(on: boolean, key: string) {
  useEffect(() => {
    if (!on) return;
    let h: ReturnType<typeof setTimeout> | null = null;
    const fill = () => {
      h = null;
      document.querySelectorAll<HTMLElement>(".adm-page .g").forEach((g) => {
        const kids = (Array.from(g.children) as HTMLElement[]).filter((x) => x.tagName !== "STYLE");
        kids.forEach((x) => { if (x.dataset.filled) { x.style.removeProperty("grid-column"); delete x.dataset.filled; } });
        const W = g.clientWidth + 16, rows = new Map<number, HTMLElement[]>();
        kids.forEach((x) => { if (!x.offsetHeight) return; const t = x.offsetTop; const k = [...rows.keys()].find((y) => Math.abs(y - t) < 3) ?? t; rows.set(k, [...(rows.get(k) || []), x]); });
        rows.forEach((r) => {
          const span = (x: HTMLElement) => Math.round(((x.offsetWidth + 16) / W) * 12), used = r.reduce((a, x) => a + span(x), 0);
          if (used >= 12) return;
          const last = r.reduce((a, x) => (x.offsetLeft > a.offsetLeft ? x : a), r[0]);
          last.style.setProperty("grid-column", `span ${span(last) + 12 - used}`, "important"); last.dataset.filled = "1";
        });
      });
    };
    const later = () => { if (!h) h = setTimeout(fill, 180); };
    const mo = new MutationObserver(later), page = document.querySelector(".adm-main");
    if (page) mo.observe(page, { childList: true, subtree: true });
    addEventListener("resize", later); later();
    return () => { mo.disconnect(); removeEventListener("resize", later); if (h) clearTimeout(h); };
  }, [on, key]);
}

export function ContextPill({ d, days, f, pick, set, cmp, setCmp, showPeriod, showFilter, tab, go, note }: { d: D | null; days: number; f: Flt; pick: (d: number) => void; set: (p: Partial<Flt>) => void; cmp: boolean; setCmp: (v: boolean) => void; showPeriod: boolean; showFilter: boolean; tab: Tab; go: (t: Tab) => void; note?: string | null }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState("");
  const V = useViews();
  const now = new Date(), today = ymd(now);
  const ranges: [string, string, string?][] = [["Ez a hónap", ymd(new Date(now.getFullYear(), now.getMonth(), 1))], ["Előző hónap", ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))], ["Idén", ymd(new Date(now.getFullYear(), 0, 1))]];
  const perL = f.from ? (ranges.find((r) => r[1] === f.from && (r[2] || "") === (f.to || ""))?.[0] || `${f.from.slice(5).replace("-", ".")} – ${(f.to || today).slice(5).replace("-", ".")}`) : PERIODS.find((p) => p.d === days)?.l || "Időszak";
  const parts = [showPeriod ? perL : "", ...(showFilter ? chList(f.ch).map(ch) : []), showFilter && f.lang ? lang(f.lang) : ""].filter(Boolean);
  const chans = ((d?.channels || []) as D[]).map((c) => c.k), langs = ((d?.langs || []) as D[]).map((c) => c.k).filter((k: string) => k && k !== "?");
  const has = !!(f.ch || f.lang);
  const save = () => { const nm = name.trim(); if (!nm) return; V.save(nm, { ch: f.ch, lang: f.lang, from: f.from, to: f.to }, tab, days); setName(""); toast("Nézet mentve"); };
  const apply = (x: View) => { if (!x.f?.from && x.days != null) pick(x.days); set({ ch: x.f?.ch, lang: x.f?.lang, ...(x.f?.from ? { from: x.f.from, to: x.f.to } : {}) }); if (x.tab && ALL.some((y) => y.k === x.tab)) go(x.tab as Tab); setOpen(false); };
  return (
    <>
      <button className={"ph-pill" + (has ? " on" : "")} onClick={() => { haptic(5); setOpen(true); }} aria-label={"Időszak és szűrő: " + parts.join(", ")}>{I(has ? P.funnel : P.calendar)}<span>{parts.join(" · ") || "Szűrő"}</span></button>
      {open && <Sheet title="Időszak és szűrő" close={() => setOpen(false)} foot={<button className="adm-ibtn gold" onClick={() => setOpen(false)}>Kész</button>}>
        {note && <p className="ps-p mut">{note}</p>}
        {showPeriod && <>
          <h4 className="ps-t">Időszak</h4>
          <div className="ps-opts">{PERIODS.map((p) => <button key={p.d} aria-pressed={!f.from && days === p.d} onClick={() => { haptic(5); pick(p.d); }}>{p.l}</button>)}{ranges.map(([l, a, b]) => <button key={l} aria-pressed={f.from === a && (f.to || "") === (b || "")} onClick={() => set({ from: a, to: b })}>{l}</button>)}</div>
          <div className="drange ps-range"><input className="adm-in" type="date" max={today} value={f.from || ""} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="Kezdő nap" /><span>–</span><input className="adm-in" type="date" max={today} min={f.from} disabled={!f.from} value={f.to || ""} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="Utolsó nap" /></div>
          <h4 className="ps-t">Összehasonlítás az előző időszakkal</h4>
          <div className="ps-opts"><button aria-pressed={cmp} onClick={() => setCmp(true)}>Látszik</button><button aria-pressed={!cmp} onClick={() => setCmp(false)}>Nem látszik</button></div>
        </>}
        {showFilter && <>
          <h4 className="ps-t">Csatorna</h4>
          <div className="ps-opts">{chans.map((k) => <button key={k} aria-pressed={chList(f.ch).includes(k)} onClick={() => set({ ch: chToggle(f.ch, k) })}>{ch(k)}</button>)}</div>
          <h4 className="ps-t">Nyelv</h4>
          <div className="ps-opts">{langs.map((k: string) => <button key={k} aria-pressed={f.lang === k} onClick={() => set({ lang: f.lang === k ? undefined : k })}>{lang(k)}</button>)}</div>
          {(has || f.from) && <button className="lnk" onClick={() => set({ ch: undefined, lang: undefined, from: undefined, to: undefined })}>Szűrők törlése</button>}
        </>}
        <h4 className="ps-t">Mentett nézetek</h4>
        {V.list.length > 0 && <div className="ps-views">{V.list.map((x) => <div key={x.name}><button onClick={() => apply(x)}><b>{x.name}</b><small>{[ALL.find((y) => y.k === x.tab)?.l, x.f?.from ? `${x.f.from} – ${x.f.to || "ma"}` : PERIODS.find((p) => p.d === x.days)?.l, ...chList(x.f?.ch).map(ch), x.f?.lang ? lang(x.f.lang) : ""].filter(Boolean).join(" · ")}</small></button><button className="lnk" aria-label={"Törlés: " + x.name} onClick={() => V.remove(x.name)}>✕</button></div>)}</div>}
        <div className="ps-row"><input className="adm-in" value={name} maxLength={40} placeholder="A mostani mentése, pl. TikTok, 7 nap" onChange={(e) => setName(e.target.value)} enterKeyHint="done" onKeyDown={(e) => { if (e.key === "Enter") save(); }} aria-label="A nézet neve" /><button className="adm-ibtn" disabled={!name.trim()} onClick={save}>Mentés</button></div>
      </Sheet>}
    </>
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
        <CloseX close={() => setOpen(false)} />
        <h4>Csatorna <small className="mut">(több is választható)</small></h4>
        <div className="pick-list">{chans.map((k) => <button key={k} aria-pressed={chList(f.ch).includes(k)} onClick={() => set({ ch: chToggle(f.ch, k) })}><span className="chlg" style={{ background: chCol(k) }}>{ch(k)[0]}</span>{ch(k)}</button>)}</div>
        <h4>Nyelv</h4>
        <div className="pick-list">{langs.map((k: string) => <button key={k} aria-pressed={f.lang === k} onClick={() => set({ lang: f.lang === k ? undefined : k })}><span className="fl">{flag((LANG_LAND[k] || [])[0])}</span>{lang(k)}</button>)}</div>
        <div className="adm-row">{cnt > 0 && <button className="lnk" onClick={() => set({ ch: undefined, lang: undefined })}>Szűrők törlése</button>}</div>
        <p className="note">A szűrő az Áttekintés, a Jelzések, az Élő, a Kérdezz, a Források, a Tölcsér, az Emberek, a Megtartás, a Használat és a Megosztás számaira hat. A posztok, a követők, a Piacok, a Google és az áruházak számai nem szűrhetők csatornára és nyelvre.</p>
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
  /* only what stayed open long enough to be seen counts as read */
  const readRef = useRef(markRead); readRef.current = markRead;
  useEffect(() => { if (!open) return; const t = setTimeout(() => readRef.current(), 1200); return () => clearTimeout(t); }, [open]);
  return (
    <div className="pop-w">
      <button className="adm-ibtn ic" onClick={() => setOpen(!open)} aria-label={`Jelzések${unread ? `, ${unread} olvasatlan` : ""}`} aria-expanded={open}>{I(P.bell)}{unread > 0 && <span className="badge">{unread}</span>}</button>
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv bell-pop" role="dialog" aria-label="Jelzések">
        <CloseX close={() => setOpen(false)} />
        <div className="adm-seg sm"><button aria-pressed={view === "now"} onClick={() => setView("now")}>Most</button><button aria-pressed={view === "push"} onClick={() => setView("push")}>Értesítések</button></div>
        {view === "now" ? <>
          <ul className="bell-l">{out.slice(0, 10).map((x, i) => <li key={i} className={x.c + (seen.includes(sig(x)) ? " read" : "")} onClick={() => { setOpen(false); go(x.to || "alerts"); }}><span className="ic">{I(AIC[x.c])}</span><div><b>{x.t}</b><span>{x.s}</span></div></li>)}
            {!out.length && <li className="good"><span className="ic">{I(P.check)}</span><div><b>Minden rendben</b><span>Nincs teendő.</span></div></li>}</ul>
          <button className="lnk" onClick={() => { setOpen(false); go("alerts"); }}>Mind a {out.length} jelzés →</button>
        </> : <ul className="bell-l">{!hist ? <li><div className="skel" style={{ height: 60, width: "100%" }} /></li> : hist.length ? hist.map((x, i) => (
          <li key={i} className="info" onClick={() => { setOpen(false); const k = String(x.url || "").split("#")[1] as Tab; go(ALL.some((a) => a.k === k) ? k : "alerts"); }}><span className="ic">{I(P.bell)}</span><div><b>{x.title} <PushNone x={x} /></b><span>{x.body}</span><small className="mut">{ago(x.at)}</small></div></li>))
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
        <div className="c-h"><div><div><h2>Gyorsbillentyűk</h2></div></div><CloseX close={close} /></div>
        <dl className="kv">
          <dt><kbd>⌘K</kbd> <kbd>/</kbd></dt><dd>Keresés és műveletek</dd>
          <dt><kbd>r</kbd></dt><dd>Minden frissítése</dd>
          <dt><kbd>d</kbd></dt><dd>Téma: automatikus, nappal, éjszaka</dd>
          <dt><kbd>esc</kbd></dt><dd>A felső felugró ablak bezárása</dd>
          <dt><kbd>1</kbd> <kbd>4</kbd> <kbd>7</kbd> <kbd>3</kbd> <kbd>9</kbd> <kbd>0</kbd></dt><dd>Időszak: 24 óra, 3, 7, 30, 90 nap, mind</dd>
          <dt><kbd>?</kbd></dt><dd>Ez a súgó</dd>
        </dl>
        <h3 style={{ margin: "12px 0 6px" }}>Oldalak: <kbd>g</kbd>, utána</h3>
        <ul className="keys-l">{names.map(([k, l]) => <li key={k}><kbd>{k !== k.toLowerCase() ? "⇧" + k : k}</kbd>{l}</li>)}</ul>
      </div>
    </Layer>
  );
}


/* ---------- shared bits ---------- */
export function Gate({ err, retry, signOut }: { err: { kind: string; msg: string }; retry: () => void; signOut?: () => void }) {
  /* the chosen theme here too (the sign-in screen's, not always dark); never the browser's own English */
  const { light } = useTheme();
  return (
    <div className={"adm gate" + (light ? " light" : "")}>
      <div className="gate-card">
        <img src="/icons/icon-192.png" alt="" />
        <h1>Nem sikerült betölteni</h1>
        <p>{err.kind === "missing" ? "Az adatbázis-frissítés még nincs telepítve." : offlineMsg(err.msg) ? (phoneNow() ? "Nincs kapcsolat, és ezen a telefonon még nincs elmentett állapot." : "Nincs kapcsolat. Próbáld újra.") : loadErrText(err.msg)}</p>
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
type Acts = { theme: () => void; sync: () => void; out: () => void; help: () => void; exportAll: () => void; card: () => void };
export function Palette({ open, close, go, d, set, refresh, acts, map, settings, recentSheet, clearRecent }: { open: boolean; close: () => void; go: (t: Tab) => void; d: D | null; set: (p: Partial<Flt>) => void; refresh: () => void; acts?: Acts; map?: React.ReactNode; settings?: { g: string; rows: MoreRow[] }[]; recentSheet?: Recent | null; clearRecent?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = useState(""); const [sel, setSel] = useState(0); const [people, setPeople] = useState<D[]>([]);
  const [more, setMore] = useState<D | null>(null);
  const [sheet, setSheet] = useState<{ k: "post" | "page" | "user"; x: any } | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  /* on a phone the keyboard waits until she taps the field: the map is the first thing to see */
  useEffect(() => { if (open) { setQ(""); setSel(0); if (!map) setTimeout(() => inp.current?.focus(), 10); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  /* something seen earlier, from "Legutóbb" */
  useEffect(() => { if (!recentSheet) return; setSheet(recentSheet.k === "user" ? { k: "user", x: recentSheet.id } : recentSheet.k === "post" ? { k: "post", x: recentSheet.x } : { k: "page", x: recentSheet.id }); clearRecent?.(); }, [recentSheet, clearRecent]);
  /* the searchable lists load once, the first time the palette opens */
  useEffect(() => {
    /* phone: the lists are fetched when she starts typing, the map itself needs none */
    if (!open || more || (map && !q)) return;
    const today = new Date(), iso = (x: Date) => x.toISOString().slice(0, 10);
    Promise.all([rpc(sb, "admin_social", { p_days: 365 }), rpc(sb, "admin_links"), rpc(sb, "admin_search", { p_days: 90 }), rpc(sb, "admin_inbox", { p_all: false }),
      rpc(sb, "admin_plans", { p_from: iso(new Date(today.getTime() - 60 * 864e5)), p_to: iso(new Date(today.getTime() + 60 * 864e5)) })])
      .then(([s, l, g, ib, pl]) => setMore({ errs: [s, l, g, ib, pl].filter((x) => x.error).length, posts: (s.data as D)?.posts || [], links: Array.isArray(l.data) ? l.data : [], queries: (g.data as D)?.queries || [], gpages: (g.data as D)?.pages || [], inbox: (ib.data as D)?.items || [], plans: Array.isArray(pl.data) ? pl.data : [] }));
  }, [open, more, sb, q === ""]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open || q.trim().length < 3) { setPeople([]); return; } const t = setTimeout(async () => { const { data } = await rpc(sb, map ? "admin_people" : "admin_users", map ? { p_q: q.trim(), p_limit: 8, p_offset: 0, p_filter: "all" } : { p_q: q.trim(), p_limit: 5, p_offset: 0, p_filter: "all" }); setPeople(data?.rows || []); }, 200); return () => clearTimeout(t); }, [q, open, sb, !!map]); // eslint-disable-line react-hooks/exhaustive-deps
  /* keep: what it opens stays above the search, and closing it brings the results back */
  type It = { g: string; l: string; s?: string; i: string; run: () => void; keep?: boolean };
  const [wide, setWide] = useState<string[]>([]);
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const items: It[] = useMemo(() => {
    const out: It[] = ALL.filter((x) => x.k !== "more" && (x.k !== "todo" || !!map)).map((x) => ({ g: "Oldalak", l: x.l, s: x.d, i: x.i, run: () => go(x.k) }));
    /* phone: the settings are found by the same field */
    if (settings) settings.forEach((sg) => sg.rows.forEach((r) => out.push({ g: sg.g, l: r.l, s: r.note, i: P.system, run: r.run })));
    /* a list that did not load is said, not left as an empty group */
    if (n(more?.errs) > 0) out.unshift({ g: "Figyelem", l: `${more!.errs} lista nem töltődött be (posztok, linkek, keresések…)`, s: "újrapróbálás", i: P.refresh, run: () => setMore(null) });
    out.push({ g: "Műveletek", l: "Frissítés", s: "minden kártya (r)", i: P.refresh, run: refresh }, { g: "Műveletek", l: "Rövid linkek", i: P.plus, run: () => go("links") },
      { g: "Műveletek", l: "Célok és napló", i: P.doc, run: () => go("goals") }, { g: "Műveletek", l: "Tervező", i: P.calendar, run: () => go("planner") },
      { g: "Műveletek", l: "Nyomtatás / PDF", i: P.doc, run: () => setTimeout(() => window.print(), 100) },
      { g: "Műveletek", l: "Szűrők törlése", i: P.funnel, run: () => set({ ch: undefined, lang: undefined, from: undefined, to: undefined }) });
    if (acts) out.push({ g: "Műveletek", l: "Téma váltása", s: "automatikus, nappal, éjszaka (d)", i: P.moon, run: acts.theme }, 
      { g: "Műveletek", l: "Lehúzás most", s: "minden platform, Google, áruházak", i: P.refresh, run: acts.sync },
      { g: "Műveletek", l: "Összefoglaló-próba", s: "a reggeli összefoglaló most, e-mailben", i: P.mail, run: () => { toast("Küldés…"); api("/api/admin/digest", { method: "POST" }).then((r) => toast(r.ok && r.json?.ok !== false ? "Elküldve: " + (r.json?.email || "kész") : "Nem sikerült: " + (r.json?.error || ""))); } },
      { g: "Műveletek", l: "Teljes export (JSON)", s: "minden oldal száma egy fájlban", i: P.share, run: acts.exportAll },
      { g: "Műveletek", l: "Mérföldkő-kártya (PNG)", s: "a legutóbbi elért mérföldkő", i: P.target, run: acts.card },
      { g: "Műveletek", l: "Gyorsbillentyűk", s: "?", i: P.spark, run: acts.help }, { g: "Műveletek", l: "Kilépés", i: P.x, run: acts.out });
    ((d?.channels || []) as D[]).forEach((c) => out.push({ g: "Szűrés csatornára", l: ch(c.k), s: `${fmt(c.sessions)} látogatás`, i: P.globe, run: () => set({ ch: c.k }) }));
    ((d?.langs || []) as D[]).filter((x) => x.k && x.k !== "?").forEach((x) => out.push({ g: "Szűrés nyelvre", l: lang(x.k), s: `${fmt(x.n)} látogatás`, i: P.globe, run: () => set({ lang: x.k }) }));
    ((d?.pages || []) as D[]).forEach((x) => out.push({ g: "Oldalak és cikkek", l: x.k === "start" ? "/app" : x.k, s: `${fmt(x.n)} megtekintés · részletek`, i: P.doc, keep: true, run: () => setSheet({ k: "page", x: "https://inkage.app" + (String(x.k).startsWith("/") ? x.k : "/" + x.k) }) }));
    ((d?.campaigns || []) as D[]).forEach((x) => out.push({ g: "Kampányok", l: `${ch(x.source)} · ${x.campaign} · ${x.content}`, s: `${fmt(x.sessions)} látogatás`, i: P.target, run: () => go("traffic") }));
    ((more?.posts || []) as D[]).forEach((p) => out.push({ g: "Posztok és videók", l: String(p.title || p.post_id || "").slice(0, 90), s: `${ch(p.platform)} · ${big(p.views)} ${p.platform === "pinterest" || p.platform === "linkedin" ? "megjelenés" : "megtekintés"}`, i: P.play, keep: true, run: () => setSheet({ k: "post", x: p }) }));
    ((more?.links || []) as D[]).forEach((x) => out.push({ g: "Rövid linkek", l: "inkage.app/go/" + x.code, s: [x.campaign, x.note, x.target].filter(Boolean).join(" · "), i: P.links, run: () => go("links") }));
    ((more?.gpages || []) as D[]).slice(0, 200).forEach((x) => out.push({ g: "Oldalak és cikkek", l: String(x.page || x.k || "").replace(/^https?:\/\/[^/]+/, "") || "/", s: `${fmt(x.clicks)} Google-kattintás · részletek`, i: P.doc, keep: true, run: () => setSheet({ k: "page", x: x.page || x.k }) }));
    ((more?.queries || []) as D[]).slice(0, 200).forEach((x) => out.push({ g: "Google-keresések", l: String(x.query), s: `${fmt(x.clicks)} kattintás · ${fmt(n(x.pos ?? x.position), 1)}. hely`, i: P.search, keep: !!x.page, run: () => (x.page ? setSheet({ k: "page", x: x.page }) : go("search")) }));
    ((more?.inbox || []) as D[]).forEach((x) => out.push({ g: "Postafiók", l: `${x.author || "Névtelen"}: ${String(x.body || "").slice(0, 70)}`, s: ch(x.source), i: P.mail, run: () => go("inbox") }));
    ((more?.plans || []) as D[]).forEach((x) => out.push({ g: "Tervek", l: String(x.title || "Terv"), s: `${x.day || ""} · ${x.status || ""}`, i: P.calendar, run: () => go("planner") }));
    ((d?.error_groups || []) as D[]).forEach((x) => out.push({ g: "Hibák", l: String(x.msg || x.name).slice(0, 90), s: `${ev(x.name)} · ${fmt(x.n)} eset`, i: P.alert, run: () => go("monitor") }));
    return out;
  }, [d, go, set, refresh, acts, more, settings]);
  const list = useMemo(() => {
    const nq = norm(q.trim());
    if (map && !nq) return [];
    const base = nq ? items.filter((x) => norm(x.l + " " + (x.s || "") + " " + x.g).includes(nq)) : items.filter((x) => x.g === "Oldalak" || x.g === "Műveletek");
    const all: It[] = [...base, ...people.map((u) => ({ g: "Emberek", l: u.email || "–", s: `${PROV[u.provider] || u.provider} · ${ago(u.created_at)} · részletek`, i: P.user, keep: !!u.id, run: () => (u.id ? setSheet({ k: "user", x: u.id }) : go("users")) }))];
    /* one heading per group, a few results of each, and a row that says how many more there are */
    const groups = new Map<string, It[]>(); all.forEach((x) => groups.set(x.g, [...(groups.get(x.g) || []), x]));
    const lim = nq ? 6 : 200;
    return Array.from(groups.entries()).flatMap(([g, l]) => (l.length <= lim || wide.includes(g) ? l : [...l.slice(0, lim), { g, l: `Még ${fmt(l.length - lim)} találat`, i: P.down, keep: true, run: () => setWide((o) => [...o, g]) }]));
  }, [q, items, people, go, map, wide]); // eslint-disable-line react-hooks/exhaustive-deps
  if (sheet) return sheet.k === "post" ? <PostDrawer p={sheet.x} close={() => setSheet(null)} /> : sheet.k === "page" ? <PageDrawer page={sheet.x} close={() => setSheet(null)} /> : <UserDrawer id={sheet.x} close={() => setSheet(null)} />;
  if (!open) return null;
  /* a result that opens a sheet keeps the palette's place; anything else closes it */
  const run = (x?: It) => { if (!x) return; if (!x.keep) close(); x.run(); };
  let lastG = "";
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <div className="pal" role="dialog" aria-label="Keresés">
        <div className="pal-in">{I(P.search)}<input ref={inp} type={map ? "search" : undefined} enterKeyHint={map ? "search" : undefined} value={q} placeholder={map ? "Oldal, ember, cikk, poszt, kulcsszó…" : "Keresés: oldal, cikk, poszt, link, keresés, e-mail, művelet…"} onChange={(e) => { setQ(e.target.value); setSel(0); setWide([]); }}
          onKeyDown={(e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(list.length - 1, sel + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); } else if (e.key === "Enter") run(list[sel]); }} /><button className="pal-x" onClick={close} data-close aria-label="Bezárás"><kbd>esc</kbd><span>✕</span></button></div>
        <div className="pal-l">
          {map && !q.trim() ? map : !list.length && <p className="note" style={{ padding: 14 }}>Nincs találat.</p>}
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
function useViews() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [list, setList] = useState<View[]>([]);
  useEffect(() => {
    try { setList(JSON.parse(localStorage.getItem("inkage.admin.views") || "[]")); } catch {}
    rpc(sb, "admin_setting_get", { p_k: "views" }).then(({ data }) => { if (Array.isArray(data)) { setList(data as View[]); try { localStorage.setItem("inkage.admin.views", JSON.stringify(data)); } catch {} } });
  }, [sb]);
  const store = (l: View[]) => { setList(l); try { localStorage.setItem("inkage.admin.views", JSON.stringify(l)); } catch {} rpc(sb, "admin_setting_save", { p_k: "views", p_v: l }).catch(() => null); };
  return { list, store, save: (name: string, f: Flt, tab: Tab, days: number) => store([...list.filter((x) => x.name !== name), { name: name.slice(0, 40), f, tab, days }].slice(-20)), remove: (name: string) => store(list.filter((x) => x.name !== name)) };
}
export function ViewsPick({ f, set, days, pick, tab, go }: { f: Flt; set: (p: Partial<Flt>) => void; days: number; pick: (d: number) => void; tab: Tab; go: (t: Tab) => void }) {
  const { list, store } = useViews();
  const [open, setOpen] = useState(false); const [name, setName] = useState("");
  useScrollLock(open);
  const pname = (x: View) => (x.f?.from ? `${x.f.from} – ${x.f.to || "ma"}` : x.days == null ? "" : PERIODS.find((p) => p.d === x.days)?.l || x.days + " nap");
  const save = () => { const nm = name.trim().slice(0, 40); if (!nm) return; store([...list.filter((x) => x.name !== nm), { name: nm, f: { ch: f.ch, lang: f.lang, from: f.from, to: f.to }, tab, days }].slice(-20)); setName(""); toast("Nézet mentve"); };
  const apply = (x: View) => { if (!x.f?.from && x.days != null) pick(x.days); set({ ch: x.f?.ch, lang: x.f?.lang, ...(x.f?.from ? { from: x.f.from, to: x.f.to } : {}) }); if (x.tab && ALL.some((y) => y.k === x.tab)) go(x.tab as Tab); setOpen(false); };
  return (
    <div className="pop-w">
      <button className={"adm-ibtn ic" + (open ? " on" : "")} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Mentett nézetek" title="Mentett nézetek: oldal + időszak + szűrő egy kattintással">{I(P.layers)}</button>
      {open && <><div className="scrim-t" onClick={() => setOpen(false)} /><div className="popv views-pop" role="dialog" aria-label="Mentett nézetek">
        <CloseX close={() => setOpen(false)} />
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


/* ---------- milestone celebration: once per milestone, in this browser ---------- */
export const MS_SCORED = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export const MS_USERS = [10, 50, 100, 250, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000];

/* the milestone's image: white on black, the figure as wide as it fits */
type MS = { v: number; what: string };
const lastMilestone = (d: D | null): MS | null => {
  if (!d) return null;
  const sc = n(d.all?.scored), us = n(d.all?.users);
  const a = [...MS_SCORED].reverse().find((x) => sc >= x), b = [...MS_USERS].reverse().find((x) => us >= x);
  return a ? { v: a, what: "kész előnézet" } : b ? { v: b, what: "regisztrált fiók" } : null;
};
function drawMilestone(m: MS) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 1080, 1350); x.textAlign = "center"; x.fillStyle = "#fff";
  x.font = "800 86px Geist, sans-serif"; x.fillText("InkAge", 540, 210);
  const t = m.v.toLocaleString("hu-HU"); let s = 300;
  try { (x as any).fontStretch = "expanded"; } catch {}
  x.font = `italic 900 ${s}px Archivo, Geist, sans-serif`; const w = x.measureText(t).width; if (w > 960) { s = Math.floor((s * 960) / w); x.font = `italic 900 ${s}px Archivo, Geist, sans-serif`; }
  x.fillText(t, 540, 660 + s / 3);
  try { (x as any).fontStretch = "normal"; } catch {}
  x.font = "600 58px Geist, sans-serif"; x.fillText(m.what, 540, 880);
  x.fillStyle = "#9B9B9B"; x.font = "400 36px Geist, sans-serif"; x.fillText("inkage.app", 540, 1210);
  return c;
}
export async function milestoneCard(d: D | null) {
  const m = lastMilestone(d); if (!m) { toast("Még nincs elért mérföldkő."); return; }
  try { await document.fonts?.load("italic 900 100px Archivo"); } catch {}
  const c = drawMilestone(m), name = `inkage-${m.v}.png`;
  /* the phone's own share menu when it has one, otherwise a file */
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (blob && !MOCK) { const file = new File([blob], name, { type: "image/png" }); try { if (phoneNow() && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch { return; } }
  const el = document.createElement("a"); el.href = c.toDataURL("image/png"); el.download = name; el.click(); toast("Kép elmentve");
}

/* once per milestone, in this browser: a black band over the top with the giant figure and falling white paper; nothing to wait for, it leaves by itself */
export function Celebrate({ d }: { d: D }) {
  const [ms, setMs] = useState<MS | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (MOCK && q.has("nocel")) return; /* design screenshots of the preview */
    let seen: string[] = []; try { seen = JSON.parse(localStorage.getItem("inkage.admin.ms") || "[]"); } catch {}
    const sc = n(d.all?.scored), us = n(d.all?.users);
    const a = [...MS_SCORED].reverse().find((x) => sc >= x), b = [...MS_USERS].reverse().find((x) => us >= x);
    const pick = a && !seen.includes("s" + a) ? { v: a, what: "kész előnézet", key: "s" + a } : b && !seen.includes("u" + b) ? { v: b, what: "regisztrált fiók", key: "u" + b } : null;
    if (!pick) return;
    /* the first visit marks every milestone already passed below this one, so only new ones celebrate later */
    const all = [...MS_SCORED.filter((x) => sc >= x).map((x) => "s" + x), ...MS_USERS.filter((x) => us >= x).map((x) => "u" + x)];
    try { localStorage.setItem("inkage.admin.ms", JSON.stringify(Array.from(new Set([...seen, ...all])))); } catch {}
    setMs({ v: pick.v, what: pick.what });
    /* a short fall of white and grey paper (two seconds, not with reduced motion) */
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const c = document.createElement("div"); c.className = "confetti"; c.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 36; i++) { const s = document.createElement("i"); s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.4 + "s"; s.className = ["a", "b", "c"][i % 3]; c.appendChild(s); }
      document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
    }
  }, [d.all?.scored, d.all?.users]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ms) return null;
  return <Layer><div className="ink-cel" role="dialog" aria-label="Mérföldkő">
    <div className="ink-cel-t"><span>Mérföldkő</span><CloseX close={() => setMs(null)} /></div>
    <div className="ink-cel-b"><Giant v={ms.v} /><b>{ms.what}</b></div>
    <button type="button" className="adm-ibtn gold" onClick={() => { milestoneCard(d); }}>{I(P.share)}Kép megosztása</button>
  </div></Layer>;
}
