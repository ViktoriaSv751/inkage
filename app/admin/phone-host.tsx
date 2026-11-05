"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* The phone's quiet helpers, drawn once in the dashboard: labels that explain themselves, the actions of a card
   (image, pin, note, question), explanations tucked behind a tap, one-line empty cards; and the searchable map. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CloseX, Field, Layer, Sheet, haptic, maskMail, readRecents, readVisits, toast, useLand, type MoreRow, type Recent } from "./phone";
import { ALL, I, MOCK, NAV, P, SHORT, rpc, type Tab, useSaved } from "./shared";
import { termFor, TERMS, type Term } from "./terms";
import { Giant, Mono } from "./ink";

/* ---------- pins and her own bottom tabs: settings that follow her to every device ---------- */
export type Pin = { tab: Tab; card?: string };
export type Prefs = { pins: Pin[]; tabs?: Tab[] };
export const usePrefs = () => useSaved<Prefs>("phone_prefs", { pins: [] });
export type OwnTask = { id: string; t: string; at: string; to?: Tab; done_at?: string };
export const useOwnTasks = () => useSaved<OwnTask[]>("phone_todo_tasks", []);
const samePin = (a: Pin, b: Pin) => a.tab === b.tab && (a.card || "") === (b.card || "");
const flashCard = (title: string, tries = 8) => {
  const t = title.toLowerCase();
  const el = Array.from(document.querySelectorAll<HTMLElement>(".adm-page section.c,.adm-page .kpi,.adm-page .tile,.adm-page .ink-hero")).find((c) => cardTitle(c).toLowerCase() === t);
  if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); }
  else if (tries > 0) setTimeout(() => flashCard(title, tries - 1), 250);
};

/* the pins on the Ma tab */
export function PinRow({ prefs, go }: { prefs: Prefs; go: (t: Tab) => void }) {
  if (!prefs.pins.length) return null;
  return (
    <div className="ph-pins hscroll" aria-label="Kitűzött">
      {prefs.pins.map((x) => { const pg = ALL.find((y) => y.k === x.tab); return pg ? <button key={x.tab + (x.card || "")} onClick={() => { go(x.tab); if (x.card) setTimeout(() => flashCard(x.card!), 150); }}>{I(pg.i)}<span>{x.card || SHORT[x.tab] || pg.l}</span></button> : null; })}
    </div>
  );
}

/* ---------- the searchable map, shown under the search field while nothing is typed ---------- */
export function SiteMap({ tab, go, open, groups, badge, quick, today, foot, todoBadge, cur }: { today?: number; todoBadge?: React.ReactNode; cur?: boolean; tab: Tab; go: (t: Tab) => void; open: (r: Recent) => void; groups: { g: string; rows: MoreRow[] }[]; badge: (t: Tab) => number | string | undefined; quick: { l: string; i: string; run: () => void }[]; foot?: { theme: { l: string; icon: React.ReactNode; run: () => void }; out: () => void } }) {
  const [prefs, setPrefs] = usePrefs(); const [setOpen, setSetOpen] = useState(false);
  /* signing out wipes this browser's copies and asks for the password: a second tap says it was meant */
  const [outSure, setOutSure] = useState(false);
  useEffect(() => { if (!outSure) return; const t = setTimeout(() => setOutSure(false), 3500); return () => clearTimeout(t); }, [outSure]);
  const setRef = useRef<HTMLDivElement>(null);
  const recents = useMemo(() => readRecents().filter((r) => !(r.k === "page" && r.id === tab)).slice(0, 8), [tab]);
  /* the four she opens most on this device; a new phone starts from the usual four */
  const tiles = useMemo(() => { const v = readVisits(), base: Tab[] = ["home", "users", "todo", "social"]; return Array.from(new Set([...base, ...(Object.keys(v) as Tab[])])).filter((k) => ALL.some((x) => x.k === k)).sort((a, b) => (v[b] || 0) - (v[a] || 0)).slice(0, 4); }, []);
  const ICON: Record<string, string> = { user: P.user, post: P.play, gpage: P.doc };
  const pinPage = (t: Tab) => { const on = prefs.pins.some((x) => samePin(x, { tab: t })); setPrefs({ ...prefs, pins: on ? prefs.pins.filter((x) => !samePin(x, { tab: t })) : [...prefs.pins, { tab: t }].slice(-12) }); haptic(8); toast(on ? "Levéve a Ma fülről" : "Kitűzve a Ma fülre"); };
  /* the five groups of the computer's rail; Teendők lives only on the phone, at the head of Ma */
  const five = NAV.map((g, i) => ({ g: g.g, pages: (i === 0 ? ["todo" as Tab] : []).concat(g.items.map((x) => x.k)) }));
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.k !== "theme" && r.k !== "out");
  return (
    <div className="pmap">
      <button className="pm-me" onClick={() => go("home")}><Mono name="V" size={52} /><span>Viktória<small>előnézet ma</small></span><b>{today ?? "–"}</b></button>
      <div className="pm-tiles">{tiles.map((k) => { const pg = ALL.find((x) => x.k === k)!, b = badge(k); return <button key={k} className={k === tab ? "cur" : ""} aria-current={k === tab ? "page" : undefined} onClick={() => go(k)}>{I(pg.i)}<b>{pg.l}</b>{k === "todo" ? todoBadge : b ? <span>{b}</span> : null}</button>; })}</div>
      {five.map((th) => (
        <section key={th.g} className="plist pm-g">
          <h3>{th.g}</h3>
          <ul>{th.pages.map((k) => { const pg = ALL.find((x) => x.k === k); if (!pg) return null; const b = badge(k), on = prefs.pins.some((x) => samePin(x, { tab: k })); return (
            <li key={k} className={k === tab ? "cur" : ""}>
              <button onClick={() => go(k)} aria-current={k === tab ? "page" : undefined}><span className="pl-i">{I(pg.i)}</span><span className="pl-l">{pg.l}</span>{k === "todo" ? todoBadge : b ? <span className="pl-b">{b}</span> : null}</button>
              <button className={"pm-pin" + (on ? " on" : "")} aria-label={on ? "Levétel a Ma fülről" : "Kitűzés a Ma fülre"} aria-pressed={on} onClick={() => pinPage(k)}>{on ? "★" : "☆"}</button>
            </li>); })}</ul>
        </section>
      ))}
      {recents.length > 0 && <section className="pm-sec"><h3>Legutóbb</h3><div className="pm-chips hscroll">{recents.map((r) => { const pg = r.k === "page" ? ALL.find((x) => x.k === r.id) : null; return <button key={r.k + r.id} onClick={() => open(r)}>{I(pg?.i || ICON[r.k] || P.doc)}<span>{r.l}</span></button>; })}</div></section>}
      <section className="pm-sec"><h3>Gyors műveletek</h3><div className="pm-quick">{quick.map((x) => <button key={x.l} onClick={x.run}>{I(x.i)}<span>{x.l}</span></button>)}</div></section>
      {setOpen && <section className="plist pm-set"><h3>Beállítások</h3>
        <ul>{rows.map((r) => (
          <li key={r.k}><button onClick={r.run} role={r.toggle ? "switch" : undefined} aria-checked={r.toggle ? !!r.on : undefined}>
            <span className="pl-i">{r.icon}</span><span className="pl-l">{r.l}{r.note && <small>{r.note}</small>}</span>
            {r.toggle ? <span className={"sw" + (r.on ? " on" : "")}><i /></span> : <span className="pl-c">›</span>}
          </button></li>))}</ul>
      </section>}
      {foot && <div className="pm-foot" ref={setRef}>
        <button aria-pressed={setOpen} onClick={() => { haptic(5); setSetOpen(!setOpen); if (!setOpen) setTimeout(() => setRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60); }}><i>{I(P.layers)}</i><span>Beállítások</span></button>
        <button onClick={foot.theme.run}><i>{foot.theme.icon}</i><span>{foot.theme.l}</span></button>
        <button className={outSure ? "sure" : ""} aria-live="polite" onClick={() => { if (outSure) foot.out(); else { haptic(10); setOutSure(true); } }}><i>{I(P.x)}</i><span>{outSure ? "Biztosan?" : "Kilépés"}</span></button>
      </div>}
    </div>
  );
}

/* ---------- a card as a picture: the title, the numbers, the first chart. Never an e-mail address. ---------- */
/* a label without the explanation hidden in its i icon */
const labelText = (el: Element | null) => { if (!el) return ""; const c = el.cloneNode(true) as Element; c.querySelectorAll(".info").forEach((x) => x.remove()); return (c.textContent || "").replace(/\s+/g, " ").trim(); };
const cardTitle = (c: Element) => directText(c.querySelector("h2")) || directText(c.querySelector(".kl,.tile-l")) || labelText(c.querySelector(".ink-hero-l"));
const directText = (el: Element | null) => (el ? Array.from(el.childNodes).filter((x) => x.nodeType === 3).map((x) => x.textContent).join("").trim() : "");
const SKIP = "button,input,select,textarea,.info,.c-more,svg,.skel,.note-tap,.ink-mono,.chlg,.fl,.ibadge,.ph-hide,.adm-seg,.subtabs,.pt-top,.pt-all,.pt-c,.pt-more,.st-err";
function cardLines(el: HTMLElement) {
  const groups = new Map<Element, string[]>();
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const nd = w.currentNode, pe = nd.parentElement; const t = (nd.textContent || "").trim();
    const sk = pe?.closest(SKIP);
    if (!t || !pe || (sk && sk !== el && el.contains(sk)) || pe.closest("h2") || !pe.getClientRects().length) continue;
    const key = pe.closest("li,tr,.kpi,.tile,.mini,dd,p") || pe;
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  return Array.from(groups.values()).map((a) => maskMail(a.join(" ")).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 18);
}
async function chartImage(el: HTMLElement): Promise<HTMLImageElement | null> {
  const svg = el.querySelector(".chart svg") as SVGSVGElement | null; if (!svg) return null;
  const copy = svg.cloneNode(true) as SVGSVGElement, a = svg.querySelectorAll("*"), b = copy.querySelectorAll("*");
  a.forEach((x, i) => { const c = getComputedStyle(x), y = b[i] as SVGElement; y.setAttribute("style", `fill:${c.fill};stroke:${c.stroke};stroke-width:${c.strokeWidth};opacity:${c.opacity};font:${c.font}`); });
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg"); const r = svg.getBoundingClientRect(); copy.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy)); });
}
export async function cardImage(el: HTMLElement): Promise<Blob | null> {
  const title = maskMail(directText(el.querySelector("h2")) || directText(el.querySelector(".kl")) || "InkAge");
  const lines = cardLines(el), im = await chartImage(el);
  const W = 1080, ch = im ? Math.round((W - 120) * im.height / Math.max(1, im.width)) : 0;
  const wrap = (x: CanvasRenderingContext2D, t: string, mw: number) => { const out: string[] = []; let cur = ""; t.split(" ").forEach((w) => { const nx = cur ? cur + " " + w : w; if (x.measureText(nx).width > mw && cur) { out.push(cur); cur = w; } else cur = nx; }); if (cur) out.push(cur); return out.slice(0, 3); };
  const c = document.createElement("canvas"); c.width = W; const m = c.getContext("2d"); if (!m) return null;
  m.font = "500 36px Geist, sans-serif";
  const body = lines.flatMap((l) => wrap(m, l, W - 120).map((t, i) => ({ t, gap: i === 0 }))).slice(0, 26);
  c.height = 210 + ch + (ch ? 40 : 0) + body.length * 50 + body.filter((x) => x.gap).length * 10 + 130;
  const x = c.getContext("2d")!;
  /* the theme's own black and white, so the chart copied from the screen stays readable by day too */
  const css = getComputedStyle(document.querySelector(".adm") || document.body), tk = (k: string, o: string) => css.getPropertyValue(k).trim() || o;
  const bg = tk("--a-bg", "#000"), fg = tk("--a-fg", "#fff"), dim = tk("--a-dim", "#9B9B9B"), s1 = tk("--a-s1", "#121212");
  x.fillStyle = bg; x.fillRect(0, 0, W, c.height);
  x.fillStyle = dim; x.font = "600 28px Geist, sans-serif"; x.fillText("INKAGE", 60, 80);
  x.fillStyle = fg; x.font = "italic 800 52px Archivo, Geist, sans-serif"; x.fillText(title.slice(0, 40), 60, 160);
  let y = 210;
  if (im) { x.fillStyle = s1; x.fillRect(40, y - 10, W - 80, ch + 20); x.drawImage(im, 60, y, W - 120, ch); y += ch + 40; }
  x.font = "500 36px Geist, sans-serif"; x.fillStyle = fg;
  body.forEach((l) => { if (l.gap) y += 10; x.fillText(l.t, 60, y + 36); y += 50; });
  x.fillStyle = dim; x.font = "400 26px Geist, sans-serif"; x.fillText(new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }) + " · inkage.app", 60, c.height - 50);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}
async function shareCard(el: HTMLElement) {
  const blob = await cardImage(el); if (!blob) { toast("A kép nem sikerült"); return; }
  if (MOCK) { (window as any).__cardImg = URL.createObjectURL(blob); (window as any).__cardLines = cardLines(el); toast("Kép elmentve"); return; }
  const name = `inkage-${new Date().toISOString().slice(0, 10)}.png`, file = new File([blob], name, { type: "image/png" });
  /* the phone's own menu when it has one (she chooses where it goes), otherwise a file */
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch { return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast("Kép elmentve");
}

/* ---------- long explanations behind a tap, on the computer and the phone alike ---------- */
export function useNoteTap() {
  useEffect(() => {
    let h: ReturnType<typeof setTimeout> | null = null;
    const scan = () => { h = null; document.querySelectorAll<HTMLElement>(".adm-page .c p.note,.adm-page .c>.note,.adm-page .g>.note,.adm-page .c>p.mut,.adm-page .g>p.mut,.adm-page .c-b>.note").forEach((p) => { if (p.dataset.ps) return; p.dataset.ps = "1"; if ((p.textContent || "").trim().length > 70 && !p.querySelector("button,a,input,select,.info")) p.classList.add("note-tap"); }); };
    const kick = () => { if (!h) h = setTimeout(scan, 200); };
    const mo = new MutationObserver(kick); mo.observe(document.querySelector(".adm") || document.body, { childList: true, subtree: true });
    const tap = (e: MouseEvent) => { const n = (e.target as HTMLElement)?.closest?.(".note-tap"); if (n) { n.classList.toggle("open"); e.stopPropagation(); } };
    document.addEventListener("click", tap, true); kick();
    return () => { mo.disconnect(); document.removeEventListener("click", tap, true); if (h) clearTimeout(h); };
  }, []);
}

/* ---------- any figure, alone on the screen (a phone on its side: a tap on a number; upright: hold it and choose) ---------- */
type BigN = { l: string; v: string; c: string; el: HTMLElement | null };
const BIGS = ".ink-hero,.kpi,.tile,.ink-trio>*,.ink-rings3 button";
const readBig = (el: HTMLElement): BigN | null => {
  const tx = (q: string) => (el.querySelector(q)?.textContent || "").replace(/\s+/g, " ").trim();
  const v = (el.querySelector(".ink-giant") as HTMLElement | null)?.dataset.final || tx(".ink-giant b") || tx(".tile-v") || tx(".v") || tx("b"), l = labelText(el.querySelector(".ink-hero-l")) || labelText(el.querySelector(".tile-l")) || labelText(el.querySelector(".kl")) || labelText(el.querySelector("small"));
  return v && v !== "–" ? { v, l, c: tx(".ink-chg") || tx(".delta"), el: el.matches("button,a,.click") ? el : null } : null;
};
function BigNum({ b, close, land }: { b: BigN; close: () => void; land: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [close]);
  const up = b.c.startsWith("↑"), dn = b.c.startsWith("↓"), H = typeof window === "undefined" ? 400 : window.innerHeight;
  return <Layer><div className="ink-bign" role="dialog" aria-label={b.l || "Nagy szám"} onClick={close}>
    <div className="ink-bign-x"><CloseX close={close} /></div>
    {b.l && <span className="ink-bign-l">{b.l}</span>}
    <Giant text={b.v} max={Math.round(H * (land ? 0.56 : 0.4))} />
    {b.c && <span className={"ink-chg " + (up ? "up" : dn ? "down" : "same")}>{b.c}</span>}
    {b.el && <button type="button" className="adm-ibtn gold" onClick={(e) => { e.stopPropagation(); const el = b.el!; close(); passBig = true; el.click(); passBig = false; }}>Megnyitás</button>}
  </div></Layer>;
}
let passBig = false;

/* ---------- once in the dashboard: everything that works on every page without the page knowing ---------- */
export function PhoneHost({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [term, setTerm] = useState<Term | null>(null);
  const [card, setCard] = useState<HTMLElement | null>(null); const [noteOn, setNoteOn] = useState(false); const [note, setNote] = useState("");
  const [prefs, setPrefs] = usePrefs(); const [, setTasks] = useOwnTasks();
  const tabRef = useRef(tab); tabRef.current = tab;
  const land = useLand(); const landRef = useRef(land); landRef.current = land;
  const [big, setBig] = useState<BigN | null>(null);

  /* go through what the page has drawn: tuck explanations behind a tap, one line for empty cards, the ⋯ of a card */
  useEffect(() => {
    let h: ReturnType<typeof setTimeout> | null = null;
    const scan = () => {
      h = null;
      const page = document.querySelector(".adm-page"); if (!page) return;
      /* number tiles stand two to a row: the last of an odd run takes the whole row instead of leaving half of it empty */
      page.querySelectorAll<HTMLElement>(".g").forEach((g) => {
        let run: HTMLElement[] = [];
        const flush = () => { run.forEach((x, i) => x.classList.toggle("ph-wide", i === run.length - 1 && run.length % 2 === 1)); run = []; };
        Array.from(g.children).forEach((x) => { if (x.matches(".kpi.s3,.kpi.s4,.tile.s3,.tile.s4")) run.push(x as HTMLElement); else if (x.tagName !== "STYLE" && (x as HTMLElement).offsetHeight > 0) flush(); });
        flush();
      });
      page.querySelectorAll<HTMLElement>("section.c").forEach((c) => {
        const kids = Array.from(c.children).filter((x) => !x.matches(".c-h,.c-foot,.c-more,.note-tap"));
        const none = kids.length === 1 && kids[0].matches(".empty");
        c.classList.toggle("nodata", none || c.classList.contains("nodata") && !kids.length);
        if (!c.querySelector(":scope>.c-more") && !none && c.querySelector("h2")) { const b = document.createElement("button"); b.className = "c-more"; b.type = "button"; b.setAttribute("aria-label", "A kártya műveletei"); b.textContent = "⋯"; c.appendChild(b); }
        if (none) c.querySelector(":scope>.c-more")?.remove();
      });
      page.querySelectorAll<HTMLElement>(".kpi,.tile").forEach((k) => { const v = (k.querySelector(".v,.tile-v")?.textContent || "").trim(); k.classList.toggle("kpi-none", v === "–" || v === "—" || v === "-"); });
      page.querySelectorAll<HTMLElement>(".kl,.tile-l,.lbl,.mini>span,.c-h h2,.tb th").forEach((l) => { const t = termFor(directText(l)); if (t) { l.dataset.term = t.t; l.classList.add("has-term"); } else if (l.dataset.term) { delete l.dataset.term; l.classList.remove("has-term"); } });
      page.querySelectorAll<HTMLInputElement>("input[type=number]:not([inputmode])").forEach((x) => x.setAttribute("inputmode", "decimal"));
      page.querySelectorAll<HTMLInputElement>("input[type=email],input[type=url]").forEach((x) => { x.setAttribute("autocapitalize", "off"); x.setAttribute("autocorrect", "off"); });
    };
    const kick = () => { if (!h) h = setTimeout(scan, 250); };
    const mo = new MutationObserver(kick); const root = document.querySelector(".adm-body"); if (root) mo.observe(root, { childList: true, subtree: true });
    kick();
    return () => { mo.disconnect(); if (h) clearTimeout(h); };
  }, []);

  /* a tap: an explanation opens, a label explains itself, a card's ⋯ opens its actions (before the page's own click) */
  useEffect(() => {
    const f = (e: MouseEvent) => {
      const t = e.target as HTMLElement; if (!t?.closest) return;
      /* a light tick under every button */
      if (t.closest("button,a,[role=button]")) haptic(4);
      /* on its side the phone shows a figure alone: a tap on any number (what the tile itself opens stays one tap further) */
      if (landRef.current && !passBig) { const el = t.closest(BIGS) as HTMLElement | null, inner = t.closest("button,a,input,select"); if (el && el.closest(".adm-page") && (!inner || inner === el)) { const r = readBig(el); if (r) { e.stopPropagation(); e.preventDefault(); setBig(r); return; } } }
      const m = t.closest(".c-more"); if (m) { e.stopPropagation(); setNoteOn(false); setNote(""); setCard(m.closest("section.c") as HTMLElement); return; }
      if (t.closest(".info,button,a,input,select,textarea")) return;
      const l = t.closest("[data-term]") as HTMLElement | null;
      if (l && t === l || l && !t.closest(".info")) { const x = TERMS.find((y) => y.t === l.dataset.term); if (x) { e.stopPropagation(); e.preventDefault(); setTerm(x); } }
    };
    document.addEventListener("click", f, true); return () => document.removeEventListener("click", f, true);
  }, []);

  /* holding a finger on a number tile: the same actions */
  useEffect(() => {
    let to: ReturnType<typeof setTimeout> | null = null, fired = 0;
    const st = (e: TouchEvent) => { const k = (e.target as HTMLElement).closest?.(".adm-page .kpi,.adm-page .tile,.adm-page .ink-hero") as HTMLElement | null; if (!k) return; to = setTimeout(() => { fired = Date.now(); haptic(14); setNoteOn(false); setNote(""); setCard(k); }, 520); };
    const no = () => { if (to) clearTimeout(to); to = null; };
    const swallow = (e: MouseEvent) => { if (Date.now() - fired < 500) { e.stopPropagation(); e.preventDefault(); } };
    addEventListener("touchstart", st, { passive: true }); addEventListener("touchmove", no, { passive: true }); addEventListener("touchend", no); document.addEventListener("click", swallow, true);
    return () => { removeEventListener("touchstart", st); removeEventListener("touchmove", no); removeEventListener("touchend", no); document.removeEventListener("click", swallow, true); };
  }, []);

  /* a popup never outlives the page it belongs to */
  useEffect(() => { setCard(null); setTerm(null); setBig(null); }, [tab]);
  const title = card ? cardTitle(card) || "Kártya" : "";
  const cardBig = card && card.matches(BIGS) ? readBig(card) : null;
  const pinned = !!card && prefs.pins.some((x) => samePin(x, { tab, card: title }));
  const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
  const saveNote = async (asTask: boolean) => {
    const t = note.trim(); if (!t) return;
    if (asTask) { setTasks((o) => [...o, { id: String(Date.now()), t: `${t} (${title})`, at: new Date().toISOString(), to: tabRef.current }].slice(-40)); toast("Teendő lett belőle"); }
    else { const r = await rpc(sb, "admin_note_save", { p_day: today(), p_kind: "egyeb", p_text: `${title}: ${t}` }); toast(r.error ? "Nem sikerült menteni a jegyzetet" : "Jegyzet mentve: a grafikonokon is látszik"); }
    setCard(null);
  };
  return (
    <>
      {term && <Sheet title={term.t} sub={term.g} close={() => setTerm(null)}>
        <p className="ps-p">{term.def}</p>{term.not && <p className="ps-p mut">{term.not}</p>}
        <dl className="pt-dl"><div><dt>Honnan jön</dt><dd>{term.src}</dd></div>{term.fresh && <div><dt>Frissül</dt><dd>{term.fresh}</dd></div>}</dl>
      </Sheet>}
      {big && <BigNum b={big} land={land} close={() => setBig(null)} />}
      {card && <Sheet title={title} big={cardBig ? <Giant text={cardBig.v} max={96} /> : undefined} close={() => setCard(null)}>
        {!noteOn ? <div className="ps-acts">
          {cardBig && <button onClick={() => { setCard(null); setBig(cardBig); }}>{I(P.eye)}<span>Nagy szám nézet<small>fektetve a legnagyobb</small></span></button>}
          <button onClick={() => { const c = card; setCard(null); shareCard(c); }}>{I(P.share)}<span>Mentés képként<small>e-mail-címek nélkül</small></span></button>
          <button onClick={() => { setPrefs({ ...prefs, pins: pinned ? prefs.pins.filter((x) => !samePin(x, { tab, card: title })) : [...prefs.pins, { tab, card: title }].slice(-12) }); toast(pinned ? "Levéve a Ma fülről" : "Kitűzve a Ma fülre"); setCard(null); }}>{I(P.target)}<span>{pinned ? "Levétel a Ma fülről" : "Kitűzés a Ma fülre"}</span></button>
          <button onClick={() => setNoteOn(true)}>{I(P.doc)}<span>Jegyzet ehhez<small>„ekkor változtattam a címet”, vagy teendő</small></span></button>
          <button onClick={() => { try { sessionStorage.setItem("inkage.admin.askq", `Mit jelent, és miért ilyen most ez: „${title}”?`); sessionStorage.setItem("inkage.admin.askctx", JSON.stringify(cardLines(card))); } catch {} setCard(null); go("ask"); }}>{I(P.spark)}<span>Kérdezz erről</span></button>
        </div> : <>
          <Field label="Jegyzet"><textarea className="adm-in" rows={3} value={note} autoFocus onChange={(e) => setNote(e.target.value)} placeholder="pl. ma átírtam a címet" /></Field>
          <div className="ps-row"><button className="adm-ibtn gold" disabled={!note.trim()} onClick={() => saveNote(false)}>Mentés jegyzetként</button><button className="adm-ibtn" disabled={!note.trim()} onClick={() => saveNote(true)}>Teendő lesz belőle</button></div>
        </>}
      </Sheet>}
    </>
  );
}

/* a word that explains itself on tap, when a page wants to say so outright */
export const TermLabel = ({ t, children }: { t: string; children: React.ReactNode }) => <span className="has-term" data-term={t}>{children}</span>;
