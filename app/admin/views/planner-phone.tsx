"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* The planner on a phone: one week as a strip, the chosen day below it, a plan dragged by its handle onto another day;
   and the idea box: a quick note, by voice where the browser can, or a link shared from another app. */
import { useEffect, useRef, useState } from "react";
import { fmt } from "../charts";
import { Logo } from "../wow";
import { Card, I, P, big, type D, useSaved } from "../shared";
import { haptic, toast, usePhone } from "../phone";
import { SHARED } from "../lock";
import { DayStrip } from "../ink";
import { viewWord } from "./social";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* the week as a strip of rings on top, the chosen day's cards with pictures under it; a plan dragged by its handle onto another day */
export function PhoneWeek({ cells, sel, setSel, today, off, setOff, byDay, plansOn, open, openPost, move, add, label, head, tabs, range }: { cells: Date[]; sel: string; setSel: (k: string) => void; today: string; off: number; setOff: (n: number) => void; byDay: (k: string) => D[]; plansOn: (k: string) => D[]; open: (p: D) => void; openPost: (p: D) => void; move: (id: number, day: string) => boolean; add: (day: string) => void; label: Record<string, [string, string]>; head?: React.ReactNode; tabs?: React.ReactNode; range: string }) {
  const [drag, setDrag] = useState<{ p: D; x: number; y: number; over: string | null } | null>(null);
  const sx = useRef(0), sy = useRef(0);
  /* the strip's buttons come in the week's order */
  const dayAt = (x: number, y: number) => { const b = document.elementFromPoint(x, y)?.closest(".ic-strip .ink-days button, .ic-wg button"); if (!b?.parentElement) return null; const c = cells[[...b.parentElement.children].indexOf(b)]; return c ? ymd(c) : null; };
  const drop = () => {
    const d = drag; setDrag(null); if (!d?.over || d.over === d.p.day) return;
    /* (the question before a plan that would go out at once is in move, the same on every device) */
    if (move(d.p.id, d.over)) { haptic(10); setSel(d.over); }
  };
  const posts = byDay(sel), plans = plansOn(sel);
  const idx = (k: string | null | undefined) => cells.findIndex((c) => ymd(c) === k);
  const movable = (p: D) => !p.published_at && p.status !== "kint" && p.status !== "kiertekelve";
  /* a sideways swipe over the rings or the pictures steps the week; the left edge stays "back" */
  const weekSwipe = { onTouchStart: (e: React.TouchEvent) => { sx.current = e.touches[0].clientX; sy.current = e.touches[0].clientY; },
    onTouchEnd: (e: React.TouchEvent) => { if (drag || sx.current < 22) return; const dx = e.changedTouches[0].clientX - sx.current, dy = e.changedTouches[0].clientY - sy.current; if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) { haptic(6); setOff(off + (dx < 0 ? 1 : -1)); } } };
  return (
    <div className="s12 ic-week">
      <div className="ic-week-l">
        {head}
        <div className="ic-weeknav"><b>{range}</b><span><button className="adm-ibtn sm" aria-label="Előző hét" onClick={() => setOff(off - 1)}>←</button><button className="adm-ibtn sm" onClick={() => { setOff(0); setSel(today); }}>Ma</button><button className="adm-ibtn sm" aria-label="Következő hét" onClick={() => setOff(off + 1)}>→</button></span></div>
        <div className="ic-strip" data-today={idx(today)} data-over={drag ? idx(drag.over) : -1} {...weekSwipe}>
          <DayStrip days={cells.map((c) => ({ t: ymd(c), v: byDay(ymd(c)).length + plansOn(ymd(c)).length }))} sel={sel} pick={setSel} label="A hét napjai" />
        </div>
        {/* the week's pictures: filled = out, outlined = a plan */}
        <div className="ic-wg" role="group" aria-label="A hét képei" {...weekSwipe}>{cells.map((c) => { const k = ymd(c), pl = plansOn(k), ps = byDay(k), more = pl.length + ps.length - 3; return (
          <button key={k} type="button" aria-pressed={k === sel} className={drag?.over === k ? "over" : undefined} aria-label={`${new Date(k + "T12:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}: ${fmt(ps.length)} poszt, ${fmt(pl.length)} terv`} onClick={() => setSel(k)}>
            {pl.slice(0, 3).map((p) => <span key={"p" + p.id} className="ic-wg-i plan">{p.media_url && p.media_kind !== "video" ? <img src={p.media_url} alt="" loading="lazy" /> : (p.platforms || [])[0] ? <Logo k={p.platforms[0]} size={16} /> : null}</span>)}
            {ps.slice(0, Math.max(0, 3 - pl.length)).map((q) => <span key={q.platform + q.post_id} className="ic-wg-i">{q.thumb ? <img src={q.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <Logo k={q.platform} size={16} />}</span>)}
            {more > 0 ? <small>+{more}</small> : !pl.length && !ps.length ? <i className="ic-wg-0" aria-hidden="true" /> : null}
          </button>); })}</div>
        {tabs}
      </div>
      <div className="ic-week-r">
        <div className="ic-day-h"><h3 className="ink-h">{new Date(sel + "T12:00").toLocaleDateString("hu-HU", { weekday: "long", month: "long", day: "numeric" })}</h3><button type="button" className="ic-plus" aria-label="Új terv erre a napra" title="Új terv erre a napra" onClick={() => add(sel)}>{I(P.plus)}</button></div>
        {!plans.length && !posts.length && <div className="ic-day-0"><b>Üres nap</b><small>Ezen a napon nincs se terv, se megjelent poszt.</small></div>}
        {plans.length > 0 && <ul className="ic-dc">{plans.map((p) => (
          <li key={p.id} className={drag?.p.id === p.id ? "drag" : undefined}>
            {movable(p) && <span className="ic-grip" role="button" aria-label="Húzd egy másik napra" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); haptic(8); setDrag({ p, x: e.clientX, y: e.clientY, over: null }); }}
              onPointerMove={(e) => { if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY, over: dayAt(e.clientX, e.clientY) }); }} onPointerUp={drop} onPointerCancel={() => setDrag(null)}>⠿</span>}
            <button className="ic-dc-b" onClick={() => open(p)}>
              <span className="ic-dc-img">{p.media_url ? (p.media_kind === "video" ? <video src={p.media_url} muted playsInline preload="metadata" /> : <img src={p.media_url} alt="" loading="lazy" />) : I(P.calendar)}</span>
              <span className="ic-rt"><b>{p.title || "(nincs cím)"}</b><small>{label[p.status]?.[0] || p.status}{p.publish ? " · innen megy ki" : ""}</small><span className="ic-dc-pf">{(p.platforms || []).map((x: string) => <Logo key={x} k={x} size={18} />)}</span></span>
              <span className="ic-rv"><b>{p.at ? String(p.at).slice(0, 5) : "–"}</b><small>terv</small></span>
            </button>
          </li>))}</ul>}
        {posts.length > 0 && <ul className="ic-dc">{posts.map((q) => <li key={q.platform + q.post_id}><button className="ic-dc-b" onClick={() => openPost(q)}>
          <span className="ic-dc-img">{q.thumb ? <img src={q.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <Logo k={q.platform} size={30} />}</span>
          <span className="ic-rt"><b>{String(q.title || "poszt").slice(0, 80)}</b><small>Megjelent</small><span className="ic-dc-pf"><Logo k={q.platform} size={18} /></span></span>
          <span className="ic-rv"><b>{big(q.views)}</b><small>{viewWord(q.platform)}</small></span></button></li>)}</ul>}
        {plans.some(movable) && <p className="note">A fogantyúval a terv áthúzható a hét egy másik napjára.</p>}
      </div>
      {drag && <div className="pw-ghost" style={{ left: drag.x, top: drag.y }}>{String(drag.p.title).slice(0, 26)}</div>}
    </div>
  );
}

/* ---------- the idea box ---------- */
type Idea = { id: string; t: string; url?: string; at: string };
const speech = () => (typeof window === "undefined" ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);
export const isIos = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
/* the saved ideas as a deck of note cards: one on top, the next two behind it; swiped or stepped through */
function IdeaDeck({ list, plan, del }: { list: Idea[]; plan: (x: Idea) => void; del: (x: Idea) => void }) {
  const [at, setAt] = useState(0); const sx = useRef(0);
  const i = Math.min(at, list.length - 1), x = list[i], step = (k: number) => { haptic(8); setAt((i + k + list.length) % list.length); };
  return (
    <div className="ic-deck" aria-label="Ötletek">
      <div className="ic-deck-s" data-left={Math.min(2, list.length - 1)} onTouchStart={(e) => { sx.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - sx.current; if (sx.current >= 22 && Math.abs(dx) > 50 && list.length > 1) step(dx < 0 ? 1 : -1); }}>
        <i aria-hidden="true" /><i aria-hidden="true" />
        <article key={x.id} className="ic-note">
          <small>{new Date(x.at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}<span>{fmt(i + 1)} / {fmt(list.length)}</span></small>
          <b>{x.t || "Link"}</b>
          {safeUrl(x.url) && <a href={safeUrl(x.url)} target="_blank" rel="noreferrer">{String(x.url).replace(/^https?:\/\/(www\.)?/, "").slice(0, 44)}</a>}
        </article>
      </div>
      <div className="ic-deck-a">
        <button type="button" className="adm-ibtn gold" onClick={() => plan(x)}>Tervbe</button>
        {list.length > 1 && <span className="ic-deck-n"><button type="button" className="adm-ibtn" aria-label="Előző ötlet" onClick={() => step(-1)}>←</button><button type="button" className="adm-ibtn" aria-label="Következő ötlet" onClick={() => step(1)}>→</button></span>}
        <button type="button" className="adm-ibtn" onClick={() => del(x)}>Törlés</button>
      </div>
    </div>
  );
}
export function IdeaBox({ plan }: { plan: (t: string, url: string | undefined, saved: () => void) => void }) {
  const phone = usePhone();
  const [list, setList] = useSaved<Idea[]>("phone_ideas", []);
  const [t, setT] = useState(""); const [url, setUrl] = useState(""); const [rec, setRec] = useState(false); const recRef = useRef<any>(null);
  /* a link shared from another app waits here */
  useEffect(() => { const f = () => { try { const v = JSON.parse(localStorage.getItem(SHARED) || "null"); if (v) { setUrl(v.url || ""); setT((o) => o || v.text || ""); localStorage.removeItem(SHARED); toast("A megosztott link az ötletládában"); setTimeout(() => document.querySelector(".idea-box")?.scrollIntoView({ block: "center" }), 300); } } catch {} }; f(); addEventListener("adm-shared", f); return () => removeEventListener("adm-shared", f); }, []);
  const save = () => {
    const x = t.trim(), u = url.trim(); if (!x && !u) return;
    const nx = [{ id: String(Date.now()), t: x.slice(0, 400), url: u.slice(0, 500) || undefined, at: new Date().toISOString() }, ...list];
    /* the saved setting holds 8000 characters */
    if (JSON.stringify(nx).length > 7800) { toast("Nincs több hely: előbb tegyél tervbe vagy törölj néhány ötletet"); return; }
    setList(nx); setT(""); setUrl(""); toast("Ötlet elmentve");
  };
  const voice = () => {
    if (rec) { recRef.current?.stop(); return; }
    const S = speech(); if (!S) return;
    const r = new S(); r.lang = "hu-HU"; r.interimResults = false; r.continuous = false; recRef.current = r;
    r.onresult = (e: any) => { const s = Array.from(e.results as any[]).map((x: any) => x[0].transcript).join(" "); setT((o) => (o ? o + " " : "") + s); };
    r.onerror = () => { setRec(false); toast("Nem sikerült a hangfelvétel: a böngésző nem kapott engedélyt, vagy nincs kapcsolat"); };
    r.onend = () => setRec(false);
    setRec(true); try { r.start(); } catch { setRec(false); }
  };
  return (
    <Card className="s12 idea-box" eager icon={P.spark} title="Ötletláda" sub="Gyors jegyzet, mielőtt elfelejted. Az eszközeid között szinkronban marad, innen egy érintéssel tervbe teheted.">
      <textarea className="adm-in" rows={1} maxLength={400} value={t} onChange={(e) => setT(e.target.value)} placeholder="Mi jutott eszedbe?" aria-label="Az ötlet szövege" />
      <input className="adm-in" type="url" inputMode="url" autoCapitalize="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (nem kötelező), pl. egy TikTok-videó" aria-label="Link" />
      <div className="adm-row">
        <button className="adm-ibtn gold" onClick={save} disabled={!t.trim() && !url.trim()}>Mentés</button>
        {speech() ? <button className={"adm-ibtn" + (rec ? " rec" : "")} onClick={voice}>{rec ? "● Hallgatlak… (megállít)" : "Mondd el"}</button> : <span className="note">Hangról: ez a böngésző nem tudja.</span>}
      </div>
      {phone && <p className="note">{isIos() ? "iPhone-on a megosztás menüből nem küldhető ide link, mert az Apple ezt webes appnak nem engedi: másold ki a linket, és illeszd be ide." : "Androidon, ha az Irányító a kezdőképernyődön van: bármelyik appban Megosztás → Irányító, és a link ide érkezik."} A hang szöveggé alakul, hangfelvétel nem marad.</p>}
      {list.length > 0 && <IdeaDeck list={list} plan={(x) => plan(x.t || x.url || "Ötlet", x.url, () => setList((o) => o.filter((y) => y.id !== x.id)))} del={(x) => { if (confirm("Törlöd ezt az ötletet?")) setList(list.filter((y) => y.id !== x.id)); }} />}
    </Card>
  );
}
