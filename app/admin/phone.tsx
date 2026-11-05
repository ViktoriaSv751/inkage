"use client";
/* The phone as an app, not the desktop page stacked up: a "Több" screen of its own, sub-tabs to swipe through,
   rows that slide to "Kész / Holnap", sheets that are dragged down to close, and the morning story. */
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { Empty, Spark, fmt, useLand } from "./charts";

/* the phone layout: the bottom bar and the sheets take over below 980 px */
export const phoneNow = () => typeof window !== "undefined" && matchMedia("(max-width:980px)").matches;
export function usePhone() {
  /* known from the first draw (the dashboard is only drawn in the browser), so nothing is built twice */
  const [p, setP] = useState(phoneNow);
  useEffect(() => { const m = matchMedia("(max-width:980px)"); const f = () => setP(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return p;
}

/* the big title shrinks into the top bar once the page is scrolled */
export function useScrolled(px = 44) {
  const [s, setS] = useState(false);
  /* two thresholds: the header getting smaller also shortens the page, and a short page must not flip back and forth */
  useEffect(() => { const f = () => setS((o) => (o ? window.scrollY > px / 3 : window.scrollY > px)); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, [px]);
  return s;
}

/* A drag never changes the page. The one gesture here: a clearly sideways swipe from the very left edge goes back.
   Whatever has its own drag keeps it, even from the edge: a row that slides, a map, a chart, anything scrolled sideways,
   and everything in a popup. It listens on the window, so it still works after the error screen swapped the page's elements. */
const OWN = ".swrow,.wmap,.ir-stage,.chart,.drawer,.pal,.popv,.psheet,.story-ov,.ink-bign,.ink-cel,.adm-lock,#adm-layer,input,textarea,select";
const scrollsSideways = (t: HTMLElement | null) => { for (let x = t; x && x !== document.body; x = x.parentElement) { if (x.scrollWidth > x.clientWidth + 2) { const o = getComputedStyle(x).overflowX; if ((o === "auto" || o === "scroll") && x.scrollLeft > 0) return true; } } return false; };
export function useSwipe(el: React.RefObject<HTMLElement | null>, on: { back?: () => void }) {
  const ref = useRef(on); ref.current = on;
  useEffect(() => {
    let x0 = 0, y0 = 0, t0 = 0, live = false;
    const st = (e: TouchEvent) => {
      const t = e.touches[0], tg = e.target as HTMLElement; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
      live = e.touches.length === 1 && x0 < 22 && !!el.current?.contains(tg) && !tg.closest?.(OWN) && !scrollsSideways(tg);
    };
    const en = (e: TouchEvent) => {
      if (!live) return; live = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (dx >= 70 && Math.abs(dy) <= dx / 4 && Date.now() - t0 <= 700) ref.current.back?.();
    };
    const canc = () => { live = false; };
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchend", en); addEventListener("touchcancel", canc);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchend", en); removeEventListener("touchcancel", canc); };
  }, [el]);
}

/* Every popup can be pulled down by its top to close: it follows the finger, and past 110 px it closes through its
   own close button, so each keeps its own closing logic. A sideways start (a row of chips) is left alone. */
const DRAG = ".drawer,.pal,.cbx-full,.pp-full,.story-ov";
export function useSheetDrag(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let sh: HTMLElement | null = null, y0 = 0, x0 = 0, dy = 0, lock: boolean | null = null;
    const st = (e: TouchEvent) => {
      const t = e.target as HTMLElement, d = t.closest?.(DRAG) as HTMLElement | null;
      /* scrolled down, only the header still pulls; a slider or a text field keeps its own finger */
      if (!d || t.closest?.("input,textarea,select") || (d.scrollTop > 0 && !t.closest?.(".c-h,.ps-h,.pal-in"))) { sh = null; return; }
      const r = d.getBoundingClientRect(); if (e.touches[0].clientY - r.top > 90) { sh = null; return; }
      sh = d; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; lock = null; d.style.transition = "none";
    };
    const mv = (e: TouchEvent) => {
      if (!sh) return;
      const yy = e.touches[0].clientY - y0, xx = e.touches[0].clientX - x0;
      if (lock == null && Math.abs(xx) + Math.abs(yy) > 6) lock = Math.abs(yy) >= Math.abs(xx);
      if (lock === false) { sh.style.transform = ""; sh = null; return; }
      dy = Math.max(0, yy); sh.style.transform = `translateY(${dy}px)`;
    };
    const en = () => {
      if (!sh) return; const d = sh; sh = null; d.style.transition = "transform .28s cubic-bezier(.2,.8,.2,1)";
      if (dy > 110) { d.style.transform = "translateY(100%)"; setTimeout(() => (d.querySelector("[data-close]") as HTMLElement | null)?.click(), 180); }
      else d.style.transform = "";
    };
    const canc = () => { if (sh) sh.style.transform = ""; sh = null; };
    addEventListener("touchcancel", canc);
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchmove", mv, { passive: true }); addEventListener("touchend", en);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchmove", mv); removeEventListener("touchend", en); removeEventListener("touchcancel", canc); };
  }, [on]);
}

/* the sub-pages of a bottom-bar tab, as a strip under the big title (the open one scrolls into view) */
export function SubTabs({ items, cur, go }: { items: { k: string; l: string; n?: number }[]; cur: string; go: (k: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { (ref.current?.querySelector('[aria-current="page"]') as HTMLElement | null)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [cur]);
  return (
    <div className="subtabs" ref={ref} role="tablist">
      {items.map((x) => <button key={x.k} role="tab" aria-current={x.k === cur ? "page" : undefined} onClick={() => go(x.k)}>{x.l}{x.n ? <i>{x.n}</i> : null}</button>)}
    </div>
  );
}

/* "Több": an app screen of its own, grouped rows with icons, the profile and the switches on top */
export type MoreRow = { k: string; l: string; icon: React.ReactNode; tone: string; badge?: number | string; note?: string; run: () => void; toggle?: boolean; on?: boolean };
export function MoreScreen({ who, email, groups }: { who: string; email: string; groups: { g: string; rows: MoreRow[] }[] }) {
  return (
    <div className="more">
      <section className="more-me">
        <i>{(who || "V").slice(0, 1)}</i>
        <div><b>{who}</b><span>{email}</span></div>
      </section>
      {groups.map((g) => (
        <section key={g.g} className="plist">
          <h3>{g.g}</h3>
          <ul>
            {g.rows.map((r) => (
              <li key={r.k}>
                <button onClick={r.run} role={r.toggle ? "switch" : undefined} aria-checked={r.toggle ? !!r.on : undefined}>
                  <span className="pl-i">{r.icon}</span>
                  <span className="pl-l">{r.l}{r.note && <small>{r.note}</small>}</span>
                  {r.badge ? <span className={"pl-b" + (String(r.badge).startsWith("●") ? " live" : "")}>{r.badge}</span> : null}
                  {r.toggle ? <span className={"sw" + (r.on ? " on" : "")}><i /></span> : <span className="pl-c">›</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* A row that slides. To the left: "Holnap", further "Kész". To the right (when it has hide): "Elrejt". A tap opens it. */
export function SwipeRow({ children, done, later, hide, open, labels, keep }: { children: React.ReactNode; done: () => void; later?: () => void; hide?: () => void; open?: () => void; labels?: { later?: string; done?: string; hide?: string }; keep?: boolean }) {
  const [dx, setDx] = useState(0); const st = useRef<{ x: number; y: number; lock?: boolean } | null>(null);
  const end = () => {
    const v = dx; st.current = null;
    /* keep: the row stays in the list after its action, it slides back */
    if (keep) { setDx(0); if (v < -150) { haptic(12); done(); } else if (v < -70 && later) { haptic(8); later(); } else if (v > 90 && hide) { haptic(8); hide(); } return; }
    if (v < -150) { haptic(12); setDx(-480); setTimeout(done, 200); return; }
    if (v < -70 && later) { haptic(8); setDx(-480); setTimeout(later, 200); return; }
    if (v > 90 && hide) { haptic(8); setDx(480); setTimeout(hide, 200); return; }
    setDx(0);
  };
  return (
    <div className="swrow">
      <div className="sw-acts" aria-hidden="true">{hide && <span className={"sw-hide" + (dx > 90 ? " on" : "")}>{labels?.hide || "Elrejt"}</span>}<span className={"sw-later" + (dx < -70 && dx >= -150 ? " on" : "")}>{later ? labels?.later || "Holnap" : ""}</span><span className={"sw-done" + (dx < -150 ? " on" : "")}>{labels?.done || "Kész"}</span></div>
      <div className="sw-f" style={{ transform: `translateX(${dx}px)`, transition: st.current ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)" }}
        onTouchStart={(e) => { st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchMove={(e) => { const s = st.current; if (!s) return; const ddx = e.touches[0].clientX - s.x, ddy = e.touches[0].clientY - s.y; if (s.lock == null) s.lock = Math.abs(ddx) > Math.abs(ddy); if (s.lock) setDx(hide ? ddx : Math.min(0, ddx)); }}
        onTouchEnd={end} onTouchCancel={() => { st.current = null; setDx(0); }} onClick={() => { if (Math.abs(dx) < 4) open?.(); }}>
        {children}
      </div>
    </div>
  );
}

/* The morning story: the first time the dashboard opens on a day, four or five full-screen cards, like a story:
   tap the right side for the next, the left for the previous, it closes after the last. */
export type StoryCard = { tone: string; kicker: string; big: React.ReactNode; line: React.ReactNode; cta?: string; run?: () => void };
export function MorningStory({ cards, close }: { cards: StoryCard[]; close: () => void }) {
  const [i, setI] = useState(0);
  /* the latest close, without restarting the card's timer each time the page above draws again */
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => { const t = setTimeout(() => (i < cards.length - 1 ? setI(i + 1) : closeRef.current()), 5200); return () => clearTimeout(t); }, [i, cards.length]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); if (e.key === "ArrowRight") setI((x) => Math.min(cards.length - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [cards.length]);
  const c = cards[i]; if (!c) return null;
  return (
    <div className="story-ov" role="dialog" aria-label="A nap röviden">
      <div className="so-bars">{cards.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "on" : ""}><b key={i} /></i>)}</div>
      <button className="so-x" onClick={close} data-close aria-label="Bezárás">✕</button>
      <div className="so-tap l" onClick={() => setI(Math.max(0, i - 1))} />
      <div className="so-tap r" onClick={() => (i < cards.length - 1 ? setI(i + 1) : close())} />
      <div className="so-b" key={i}>
        <span className="eyebrow">{c.kicker}</span>
        <b className="so-big">{c.big}</b>
        <p>{c.line}</p>
        {c.cta && <button className="so-cta" onClick={() => { close(); c.run?.(); }}>{c.cta} →</button>}
      </div>
    </div>
  );
}

/* a small message at the bottom (saved, copied, done). Whoever knows it failed says so: toast(text, { bad: true });
   without that the wording decides (older callers). Raw English from the browser or the network never reaches the screen. */
type ToastOpts = { bad?: boolean };
let toastFn: ((t: string, o?: ToastOpts) => void) | null = null;
export const toast = (t: string, o?: ToastOpts) => toastFn?.(t, o);
const BAD_WORDS = /nem sikerült|hiba|nem lehet|lejárt|túl hosszú|túl nagy|nem ment|elfogyott|hiányzik|nem egyezik|nem fogad|nem engedte|nem tud|megszakítva|nincs (több|kapcsolat|jog|e-mail|hely)|üres$|^(írj|írd|adj meg|válassz|kép vagy)\b|\b(kell|legyen)\.$|^legfeljebb|^ez nem /i;
const RAW_NET = /failed to fetch|networkerror|load failed|network request/i;
const RAW_EN = /^[\x00-\x7F]*\b(failed|error|cannot|can't|not allowed|denied|invalid|unexpected|undefined|violates|permission|exception|must be)\b[\x00-\x7F]*$/i;
export const toastText = (t: string) => (RAW_NET.test(t) ? "Nincs kapcsolat. Próbáld újra." : RAW_EN.test(t) ? "A művelet nem sikerült. Próbáld újra." : t);
export function Toaster() {
  const [t, setT] = useState<{ t: string; bad: boolean; k: number } | null>(null);
  useEffect(() => { toastFn = (x, o) => { const shown = toastText(String(x)); setT({ t: shown, bad: o?.bad ?? (shown !== String(x) || BAD_WORDS.test(shown)), k: Date.now() }); }; return () => { toastFn = null; }; }, []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), t.bad ? 4000 : 2400); return () => clearTimeout(h); }, [t]);
  return t ? <div className={"toast" + (t.bad ? " bad" : "")} key={t.k} role={t.bad ? "alert" : "status"}><span className="tk">{t.bad ? "!" : "✓"}</span>{t.t}</div> : null;
}

/* ---------- the phone's shared building blocks (docs/admin-phone-api.md) ---------- */

/* a light tick under the finger, where the phone can */
export const haptic = (ms = 6) => { try { navigator.vibrate?.(ms); } catch {} };

export { useLand };

export function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => { const f = () => setOn(navigator.onLine); f(); addEventListener("online", f); addEventListener("offline", f); return () => { removeEventListener("online", f); removeEventListener("offline", f); }; }, []);
  return on;
}

/* While a popup is open the page behind never scrolls (the scrollbar's width is kept, so nothing shifts) */
let locks = 0;
export function useScrollLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const h = document.documentElement.style, gap = window.innerWidth - document.documentElement.clientWidth;
    if (locks++ === 0) { h.overflow = "hidden"; h.overscrollBehavior = "none"; if (gap > 0) h.paddingRight = gap + "px"; }
    return () => { if (--locks === 0) { h.overflow = ""; h.overscrollBehavior = ""; h.paddingRight = ""; } };
  }, [on]);
}
/* Side panels, sheets and the search: drawn in a layer at the top of the dashboard (outside the animated page, so
   they always open in view, not at the top of a long page), and the page behind them stands still while open.
   Nothing darkens or blurs it; a click beside the panel still closes it. */
export function Layer({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById("adm-layer") || document.body); }, []);
  useScrollLock(true);
  return host ? createPortal(children, host) : null;
}

/* the close of every popup: a small round ✕ in the corner, with its own room (never over the content) */
export const CloseX = ({ close }: { close: () => void }) => <button type="button" className="pop-x" onClick={close} data-close aria-label="Bezárás">✕</button>;

/* A sheet from the bottom: the page behind keeps its place. Pull it down by the top, tap beside it, or ✕ closes it. */
export function Sheet({ title, sub, close, children, foot, tall, big }: { title?: ReactNode; sub?: ReactNode; close: () => void; children: ReactNode; foot?: ReactNode; tall?: boolean; big?: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <div className={"drawer psheet" + (tall ? " tall" : "")} role="dialog" aria-label={typeof title === "string" ? title : "Részletek"}>
        <div className="ps-h"><div>{title && <h2>{title}</h2>}{sub && <small>{sub}</small>}</div><CloseX close={close} /></div>
        <div className="ps-b">{big != null && <div className="ps-big-w">{big}</div>}{children}</div>
        {foot && <div className="ps-f">{foot}</div>}
      </div>
    </Layer>
  );
}

/* a form row for phones: a big label, one big field; give the field the right kind (email, number, url, date) */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="pfield"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

/* the waiting shape of what comes: kind = kpis (two tiles a row), list (rows), chart, card; rows = how many */
export function Skel({ kind = "card", rows = 3, h }: { kind?: "kpis" | "list" | "chart" | "card"; rows?: number; h?: number }) {
  if (kind === "kpis") return <div className="sk-kpis" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" />)}</div>;
  if (kind === "list") return <div className="sk-list" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" />)}</div>;
  return <div className={"skel sk-" + kind} style={h ? { height: h } : undefined} aria-busy="true" />;
}

/* Only what is near the screen is drawn: until then the skeleton, so a card's numbers are asked for when it comes into view. */
export function Lazy({ h = 160, eager, children, kind }: { h?: number; eager?: boolean; children: ReactNode; kind?: "kpis" | "list" | "chart" | "card" }) {
  /* (?eager on the development server: everything at once, to check whole pages) */
  const [on, setOn] = useState(() => !!eager || typeof IntersectionObserver === "undefined" || (process.env.NODE_ENV !== "production" && location.search.includes("eager")));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (on || !ref.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setOn(true); }, { rootMargin: "500px 0px" });
    io.observe(ref.current);
    /* printing needs everything */
    const pr = () => flushSync(() => setOn(true)); addEventListener("beforeprint", pr);
    return () => { io.disconnect(); removeEventListener("beforeprint", pr); };
  }, [on]);
  if (on) return <>{children}</>;
  return <div ref={ref}>{kind ? <Skel kind={kind} /> : <div className="skel" style={{ height: h }} aria-busy="true" />}</div>;
}

/* one card failing leaves the others working */
export class Boundary extends Component<{ children: ReactNode; label?: string }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="st-err" role="alert"><span>{this.props.label || "Ez a rész most nem tölthető be."} A többi működik.</span><button className="adm-ibtn sm" onClick={() => this.setState({ err: false })}>Újra</button></div>;
  }
}

/* holding a finger on something: quick actions (a normal tap still works) */
export function useLongPress(run: () => void, ms = 480) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null), fired = useRef(false);
  const clear = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  return {
    onTouchStart: () => { fired.current = false; clear(); t.current = setTimeout(() => { fired.current = true; haptic(14); run(); }, ms); },
    onTouchMove: clear, onTouchEnd: clear,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    /* true right after a long press: the tap that ends it is ignored */
    wasLong: () => { const f = fired.current; fired.current = false; return f; },
  };
}

/* ---------- the last numbers, kept for a quick start and for reading without a connection ----------
   Every admin function's last answer, in this browser only, with e-mail addresses masked. Signing out wipes it. */
const MEM = new Map<string, { d: unknown; at: number }>();
const IDB = "inkage-admin-cache";
let dbp: Promise<IDBDatabase> | null = null;
const idb = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const maskMail = (t: string) => t.replace(EMAIL, (m) => m.slice(0, 2) + "•••@" + m.split("@")[1]);
const scrub = (x: unknown): unknown => typeof x === "string" ? (x.includes("@") ? maskMail(x) : x) : Array.isArray(x) ? x.map(scrub) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, scrub(v)])) : x;
export const cacheMem = (k: string) => MEM.get(k);
export async function cacheGet(k: string) {
  const m = MEM.get(k); if (m) return m;
  try { const db = await idb(); return await new Promise<{ d: unknown; at: number } | undefined>((res) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => { if (q.result) MEM.set(k, q.result); res(q.result); }; q.onerror = () => res(undefined); }); } catch { return undefined; }
}
export function cachePut(k: string, d: unknown) {
  const v = { d, at: Date.now() }; MEM.set(k, v);
  /* quietly, after the screen is drawn; a very long answer stays in memory only */
  const run = async () => { try { if (MEM.get(k) !== v) return; /* a newer answer came meanwhile */ const clean = scrub(d); const db = await idb(); db.transaction("kv", "readwrite").objectStore("kv").put({ d: clean, at: v.at }, k); } catch {} };
  /* when the phone is idle, not right after the answer while the page is drawing it (that froze the bigger pages) */
  const ric = (globalThis as any).requestIdleCallback as undefined | ((f: () => void, o?: { timeout: number }) => number); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (ric) ric(run, { timeout: 4000 }); else setTimeout(run, 1500);
}
/* Signing out: the open connection closes first (a delete otherwise waits for the tab to close), and of what this browser
   keeps only the look stays (theme, text size, the lock). The saved settings come back from the database at the next sign-in. */
const KEEP = ["theme", "fs", "lock", "lock_left", "lock_on", "desk", "idle", "slim", "cmp", "ms"].map((k) => "inkage.admin." + k);
export function cacheClear() {
  MEM.clear(); const open = dbp; dbp = null;
  const del = () => { try { indexedDB.deleteDatabase(IDB); } catch {} };
  if (open) open.then((db) => db.close()).catch(() => null).finally(del); else del();
  try { Object.keys(localStorage).filter((k) => k.startsWith("inkage.admin.") && !KEEP.includes(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
  try { Object.keys(sessionStorage).filter((k) => k.startsWith("inkage.admin.")).forEach((k) => sessionStorage.removeItem(k)); } catch {}
}

/* ---------- recently seen: pages, people, posts, articles (masked, in this browser) ---------- */
export type Recent = { k: "page" | "user" | "post" | "gpage"; id: string; l: string; x?: unknown };
const RECENT = "inkage.admin.recents";
export const readRecents = (): Recent[] => { try { return JSON.parse(localStorage.getItem(RECENT) || "[]"); } catch { return []; } };
/* how often each page was opened on this device, for the menu's four big tiles */
const VISITS = "inkage.admin.visits";
export const readVisits = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(VISITS) || "{}"); } catch { return {}; } };
export const pushRecent = (r: Recent) => { try { if (r.k === "page") { const v = readVisits(); v[r.id] = (v[r.id] || 0) + 1; localStorage.setItem(VISITS, JSON.stringify(v)); } const c = { ...r, l: maskMail(r.l) }; localStorage.setItem(RECENT, JSON.stringify([c, ...readRecents().filter((x) => !(x.k === r.k && x.id === r.id))].slice(0, 14))); } catch {} };

/* ---------- a table as a list of clean cards ----------
   Name, main number, change, optional mini curve; first 5 rows and "Mind a 42"; one button for sort and filter. */
export type TblCol = { k: string; l: string; num?: boolean; r?: (row: Record<string, any>) => ReactNode; ph?: "name" | "main" | "delta" | "spark" | "sub" | "hide" }; // eslint-disable-line @typescript-eslint/no-explicit-any
const textOf = (v: unknown) => (v == null ? "" : typeof v === "object" ? "" : String(v));
const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function PhoneTbl({ cols, rows, onRow, empty, download, limit = 5, sk, dir, sortBy, alpha }: { cols: TblCol[]; rows: Record<string, any>[]; onRow?: (r: Record<string, any>) => void; empty?: string; download?: () => void; limit?: number; sk: string | null; dir: 1 | -1; sortBy: (k: string, d?: 1 | -1) => void; alpha?: boolean }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [all, setAll] = useState(false); const [tools, setTools] = useState(false); const [q, setQ] = useState(""); const [det0, setDet] = useState<Record<string, any> | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  /* an open row always reads the current list by its id, so a switch in it follows the new state at once */
  const rid = (r: Record<string, any>) => r.id ?? r.jobid ?? r.key ?? r.k ?? null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const det = det0 ? rows.find((r) => r === det0) || (rid(det0) != null ? rows.find((r) => rid(r) === rid(det0)) : null) || det0 : null;
  const named = cols.filter((c) => c.l && c.ph !== "hide");
  const lead = cols[0] && !cols[0].l ? cols[0] : null;
  const name = cols.find((c) => c.ph === "name") || named.find((c) => !c.num) || named[0];
  const main = cols.find((c) => c.ph === "main") || named.find((c) => c.num && c !== name && !c.ph);
  const delta = cols.find((c) => c.ph === "delta") || named.find((c) => /változás/i.test(c.l) && c !== main);
  const spark = cols.find((c) => c.ph === "spark");
  const subs = (cols.some((c) => c.ph === "sub") ? cols.filter((c) => c.ph === "sub") : named.filter((c) => c !== name && c !== main && c !== delta && c !== spark)).slice(0, 2);
  const ql = fold(q.trim());
  const list = ql ? rows.filter((r) => cols.some((c) => fold(textOf(r[c.k])).includes(ql))) : rows;
  const shown = all || ql ? list.slice(0, 300) : list.slice(0, limit);
  const cell = (c: TblCol, r: Record<string, any>) => (c.r ? c.r(r) : r[c.k] ?? "–"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const hasMore = cols.length > (lead ? 1 : 0) + (name ? 1 : 0) + (main ? 1 : 0) + subs.length;
  /* the letters at the side, for a long list in order of name */
  const listRef = useRef<HTMLUListElement>(null);
  const letters = alpha && all && !ql && list.length > 25 && name && sk === name.k ? Array.from(new Set(list.map((r) => fold(textOf(r[name.k])).slice(0, 1).toUpperCase()).filter(Boolean))) : [];
  const jump = (L: string) => { const i = shown.findIndex((r) => fold(textOf(r[name!.k])).slice(0, 1).toUpperCase() === L); (listRef.current?.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  if (!rows.length) return <Empty t={empty || "Még nincs adat."} />;
  return (
    <div className="pt">
      {(rows.length > 3 || download) && <div className="pt-top"><span>{fmt(list.length)}{ql ? ` / ${fmt(rows.length)}` : ""} sor</span><button className="pt-tool" onClick={() => setTools(true)} aria-label="Rendezés és szűrés">Rendezés, szűrés{sk || ql ? " •" : ""}</button></div>}
      <ul className="pt-l" ref={listRef}>
        {shown.map((r, i) => (
          <li key={i} className={onRow ? "click" : ""} onClick={() => (onRow ? onRow(r) : setDet(r))}>
            {lead && <span className="pt-lead">{cell(lead, r)}</span>}
            <div className="pt-m">
              <b className="pt-name">{name ? cell(name, r) : ""}</b>
              {subs.length > 0 && <small className="pt-sub">{subs.map((c) => <span key={c.k}><i>{c.l}</i> {cell(c, r)}</span>)}</small>}
            </div>
            {spark && <span className="pt-sp"><Spark values={(r[spark.k] || []) as number[]} h={26} /></span>}
            <div className="pt-n">{main && <b>{cell(main, r)}</b>}{main?.l && <small className="pt-nl">{main.l}</small>}{delta && <small>{cell(delta, r)}</small>}</div>
            {onRow && hasMore ? <button className="pt-more" aria-label="Minden adat" onClick={(e) => { e.stopPropagation(); setDet(r); }}>⋯</button> : <span className="pt-c" aria-hidden="true">›</span>}
          </li>
        ))}
      </ul>
      {letters.length > 0 && <div className="pt-az" aria-label="Ugrás betűre">{letters.map((L) => <button key={L} onClick={() => jump(L)}>{L}</button>)}</div>}
      {!all && !ql && list.length > limit && <button className="pt-all" onClick={() => setAll(true)}>Mind a {fmt(list.length)}</button>}
      {all && !ql && list.length > limit && <button className="pt-all" onClick={() => setAll(false)}>Kevesebb</button>}
      {tools && <Sheet title="Rendezés és szűrés" close={() => setTools(false)} foot={<button className="adm-ibtn gold" onClick={() => setTools(false)}>Kész</button>}>
        <Field label="Keresés a sorokban"><input className="adm-in" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="név, szöveg, szám…" /></Field>
        <h4 className="ps-t">Rendezés</h4>
        <div className="ps-opts">{cols.filter((c) => c.l).map((c) => <button key={c.k} aria-pressed={sk === c.k} onClick={() => sortBy(c.k)}>{c.l}{sk === c.k ? (dir === 1 ? " ↑" : " ↓") : ""}</button>)}</div>
        {download && <button className="lnk ps-csv" onClick={download}>A lista letöltése táblázatként ⤓</button>}
      </Sheet>}
      {det && <Sheet title={name ? cell(name, det) : "Részletek"} sub={main?.l || undefined} big={main ? <b className="ps-big-n">{cell(main, det)}</b> : undefined} close={() => setDet(null)} foot={onRow ? <button className="adm-ibtn gold" onClick={() => { const r = det; setDet(null); onRow(r); }}>Megnyitás</button> : undefined}>
        <dl className="pt-dl">{cols.filter((c) => c !== name && c !== main).map((c) => <div key={c.k}>{c.l && <dt>{c.l}</dt>}<dd>{cell(c, det)}</dd></div>)}</dl>
      </Sheet>}
    </div>
  );
}
