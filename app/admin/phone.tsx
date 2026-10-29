"use client";
/* The phone as an app, not the desktop page stacked up: a "Több" screen of its own, sub-tabs to swipe through,
   rows that slide to "Kész / Holnap", sheets that are dragged down to close, and the morning story. */
import { useEffect, useRef, useState } from "react";

/* the phone layout: the bottom bar and the sheets take over below 980 px */
export function usePhone() {
  const [p, setP] = useState(false);
  useEffect(() => { const m = matchMedia("(max-width:980px)"); const f = () => setP(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return p;
}

/* the big title shrinks into the top bar once the page is scrolled */
export function useScrolled(px = 44) {
  const [s, setS] = useState(false);
  useEffect(() => { const f = () => setS(window.scrollY > px); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, [px]);
  return s;
}

/* Sideways swipe on the page: the next or previous sub-tab; from the left edge: back. Swipes that start on something
   that scrolls sideways itself (stories, tiles, charts, tables, sheets) are left to it. */
const OWN = ".st-row,.ph-tiles,.chart,.tw,.subtabs,.drawer,.popv,.swrow,.hscroll,input,textarea,select,.story-ov";
export function useSwipe(el: React.RefObject<HTMLElement | null>, on: { next?: () => void; prev?: () => void; back?: () => void }) {
  const ref = useRef(on); ref.current = on;
  useEffect(() => {
    const node = el.current; if (!node) return;
    let x0 = 0, y0 = 0, edge = false, skip = false, t0 = 0;
    const st = (e: TouchEvent) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); edge = x0 < 22; skip = !edge && !!(e.target as HTMLElement).closest?.(OWN); };
    const en = (e: TouchEvent) => {
      if (skip) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - t0 > 700) return;
      if (edge && dx > 0) { ref.current.back?.(); return; }
      if (dx < 0) ref.current.next?.(); else ref.current.prev?.();
    };
    node.addEventListener("touchstart", st, { passive: true }); node.addEventListener("touchend", en);
    return () => { node.removeEventListener("touchstart", st); node.removeEventListener("touchend", en); };
  }, [el]);
}

/* Every sheet (.drawer) can be pulled down by its top to close: it follows the finger, and past 110 px it closes
   through its own close button, so each sheet keeps its own closing logic. */
export function useSheetDrag(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let sh: HTMLElement | null = null, y0 = 0, dy = 0;
    const st = (e: TouchEvent) => {
      const d = (e.target as HTMLElement).closest?.(".drawer") as HTMLElement | null;
      if (!d || d.scrollTop > 0) { sh = null; return; }
      const r = d.getBoundingClientRect(); if (e.touches[0].clientY - r.top > 90) { sh = null; return; }
      sh = d; y0 = e.touches[0].clientY; dy = 0; d.style.transition = "none";
    };
    const mv = (e: TouchEvent) => { if (!sh) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
    const en = () => {
      if (!sh) return; const d = sh; sh = null; d.style.transition = "transform .28s cubic-bezier(.2,.8,.2,1)";
      if (dy > 110) { d.style.transform = "translateY(100%)"; setTimeout(() => (d.querySelector(".c-h .adm-ibtn, [data-close]") as HTMLElement | null)?.click(), 180); }
      else d.style.transform = "";
    };
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchmove", mv, { passive: true }); addEventListener("touchend", en);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchmove", mv); removeEventListener("touchend", en); };
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
                  <span className={"pl-i t-" + r.tone}>{r.icon}</span>
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

/* A row that slides: to the left shows "Holnap" (snooze for a day), further "Kész". A tap opens it. */
export function SwipeRow({ children, done, later, open }: { children: React.ReactNode; done: () => void; later?: () => void; open?: () => void }) {
  const [dx, setDx] = useState(0); const st = useRef<{ x: number; y: number; lock?: boolean } | null>(null);
  const end = () => {
    const v = dx; st.current = null;
    if (v < -150) { navigator.vibrate?.(12); setDx(-480); setTimeout(done, 200); return; }
    if (v < -70 && later) { navigator.vibrate?.(8); setDx(-480); setTimeout(later, 200); return; }
    setDx(0);
  };
  return (
    <div className="swrow">
      <div className="sw-acts" aria-hidden="true"><span className={"sw-later" + (dx < -70 && dx >= -150 ? " on" : "")}>Holnap</span><span className={"sw-done" + (dx < -150 ? " on" : "")}>Kész</span></div>
      <div className="sw-f" style={{ transform: `translateX(${dx}px)`, transition: st.current ? "none" : "transform .3s cubic-bezier(.2,.8,.2,1)" }}
        onTouchStart={(e) => { st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchMove={(e) => { const s = st.current; if (!s) return; const ddx = e.touches[0].clientX - s.x, ddy = e.touches[0].clientY - s.y; if (s.lock == null) s.lock = Math.abs(ddx) > Math.abs(ddy); if (s.lock) setDx(Math.min(0, ddx)); }}
        onTouchEnd={end} onClick={() => { if (Math.abs(dx) < 4) open?.(); }}>
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
    <div className={"story-ov t-" + c.tone} role="dialog" aria-label="A nap röviden">
      <div className="so-bars">{cards.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "on" : ""}><b key={i} /></i>)}</div>
      <button className="so-x" onClick={close} aria-label="Bezárás">✕</button>
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

/* a small message at the bottom (saved, copied, done) */
let toastFn: ((t: string) => void) | null = null;
export const toast = (t: string) => toastFn?.(t);
export function Toaster() {
  const [t, setT] = useState<{ t: string; k: number } | null>(null);
  useEffect(() => { toastFn = (x) => setT({ t: x, k: Date.now() }); return () => { toastFn = null; }; }, []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 2400); return () => clearTimeout(h); }, [t]);
  /* a failure gets an exclamation mark, not a tick */
  const bad = !!t && /nem sikerült|hiba|nem lehet|lejárt|nincs |túl hosszú|nem ment|elfogyott|hiányzik/i.test(t.t);
  return t ? <div className={"toast" + (bad ? " bad" : "")} key={t.k} role={bad ? "alert" : "status"}><span className="tk">{bad ? "!" : "✓"}</span>{t.t}</div> : null;
}
