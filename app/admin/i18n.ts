"use client";
/* English mode of the admin. The pages are written in Hungarian (they come from Calligra's admin); in English mode
   every Hungarian text on screen is swapped for its English from lib/admin-i18n/en.json, so a page ported from
   Calligra later needs no code change, only its new texts in the dictionary
   (node scripts/admin-i18n-extract.mjs lists the missing ones). Dates and numbers follow English formatting. */

export type ALang = "hu" | "en";
const KEY = "inkage.admin.lang";

export function adminLang(): ALang {
  try { return localStorage.getItem(KEY) === "en" ? "en" : "hu"; } catch { return "hu"; }
}
export function setAdminLang(l: ALang) {
  try { localStorage.setItem(KEY, l); } catch {}
  location.reload();
}

/* ---------- dates and numbers: hu-HU → en-GB while English is on (set before the first render) ---------- */
let patched = false;
function patchLocales() {
  if (patched) return; patched = true;
  const fix = (l: unknown) => (l == null || (typeof l === "string" && /^hu\b/i.test(l)) || (Array.isArray(l) && l.some((x) => /^hu\b/i.test(String(x)))) ? "en-GB" : l);
  const wrap = (proto: any, name: string) => { const o = proto[name]; proto[name] = function (this: any, l?: any, opt?: any) { return o.call(this, fix(l), opt); }; };
  wrap(Date.prototype, "toLocaleDateString"); wrap(Date.prototype, "toLocaleTimeString"); wrap(Date.prototype, "toLocaleString");
  wrap(Number.prototype, "toLocaleString");
  const IDT = Intl.DateTimeFormat, INF = Intl.NumberFormat, IRT = Intl.RelativeTimeFormat;
  (Intl as any).DateTimeFormat = function (l?: any, o?: any) { return new IDT(fix(l) as any, o); };
  (Intl as any).DateTimeFormat.prototype = IDT.prototype; (Intl as any).DateTimeFormat.supportedLocalesOf = IDT.supportedLocalesOf;
  (Intl as any).NumberFormat = function (l?: any, o?: any) { return new INF(fix(l) as any, o); };
  (Intl as any).NumberFormat.prototype = INF.prototype; (Intl as any).NumberFormat.supportedLocalesOf = INF.supportedLocalesOf;
  const IDN = (Intl as any).DisplayNames;
  if (IDN) { (Intl as any).DisplayNames = function (l?: any, o?: any) { return new IDN(fix(l) as any, o); }; (Intl as any).DisplayNames.prototype = IDN.prototype; }
  if (IRT) { (Intl as any).RelativeTimeFormat = function (l?: any, o?: any) { return new IRT(fix(l) as any, o); }; (Intl as any).RelativeTimeFormat.prototype = IRT.prototype; }
}
if (typeof window !== "undefined" && adminLang() === "en") { patchLocales(); document.documentElement.lang = "en"; }

/* ---------- the dictionary ---------- */
type Pat = { re: RegExp; to: string; n: number };
let EXACT: Record<string, string> | null = null;
const BY_WORD = new Map<string, Pat[]>();
const NOWORD: Pat[] = [];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s: string) => s.toLowerCase().match(/[a-záéíóöőúüű]{3,}/g) || [];

function load(dict: Record<string, string>) {
  EXACT = {};
  for (const [k, v] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(k)) { EXACT[k] = v; continue; }
    const parts = k.split(/(\{\d+\})/);
    if ((k.replace(/\{\d+\}/g, "").match(/[a-záéíóöőúüű]/gi) || []).length < 3) continue; // too little text to tell it apart: "A {0}"
    const re = new RegExp("^" + parts.map((p) => (/^\{\d+\}$/.test(p) ? "(.*?)" : esc(p))).join("") + "$", "s");
    const order = parts.filter((p) => /^\{\d+\}$/.test(p));
    let to = v; order.forEach((p, i) => { to = to.split(p).join(`\u0000${i}\u0000`); });
    const pat = { re, to, n: parts.filter((p) => !/^\{\d+\}$/.test(p)).join("").length };
    const lit = parts.filter((p) => !/^\{\d+\}$/.test(p)).join(" ");
    const w = words(lit).sort((a, b) => b.length - a.length)[0];
    if (w) { const l = BY_WORD.get(w) || []; l.push(pat); BY_WORD.set(w, l); } else NOWORD.push(pat);
  }
}

const memo = new Map<string, string | null>();
function tr(core: string, depth = 0): string | null {
  if (!EXACT) return null;
  if (core in EXACT) return EXACT[core];
  if (memo.has(core)) return memo.get(core)!;
  let res: string | null = null;
  const cands = new Set<Pat>();
  for (const w of words(core)) BY_WORD.get(w)?.forEach((p) => cands.add(p));
  NOWORD.forEach((p) => cands.add(p));
  for (const p of [...cands].sort((a, b) => b.n - a.n)) {
    const m = core.match(p.re); if (!m) continue;
    res = p.to.replace(/\u0000(\d+)\u0000/g, (_, i) => { const g = m[+i + 1] ?? ""; const t = depth < 2 ? tr(g.trim(), depth + 1) : null; return t != null ? g.replace(g.trim(), t) : g; });
    break;
  }
  if (res == null && depth < 2) {
    for (const sep of [" · ", ". ", ": ", " – ", " — "]) {
      if (!core.includes(sep)) continue;
      const bits = core.split(sep);
      const outBits = bits.map((b) => { const t = b.trim() ? tr(b.trim(), depth + 1) : null; return t != null ? t : b; });
      if (outBits.some((b, i) => b !== bits[i])) { res = outBits.join(sep); break; }
    }
  }
  if (memo.size > 20000) memo.clear();
  memo.set(core, res);
  return res;
}
function swap(s: string): string | null {
  const core = s.replace(/\s+/g, " ").trim();
  if (core.length < 2 || !/[a-záéíóöőúüű]/i.test(core)) return null;
  const t = tr(core);
  if (t == null || t === core) return null;
  const lead = /^\s/.test(s) ? " " : "", trail = /\s$/.test(s) ? " " : "";
  return lead + t + trail;
}

/* ---------- swapping what is on screen ---------- */
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const done = new WeakMap<Node, string>(); // node → the English we wrote, so our own write is not translated again
const skip = (el: Element | null) => !!el?.closest("script,style,textarea,code,pre,[contenteditable],[data-noi18n]");

function doText(n: Text) {
  const v = n.nodeValue || "";
  if (done.get(n) === v || skip(n.parentElement)) return;
  const t = swap(v);
  if (t != null) { done.set(n, t); n.nodeValue = t; } else done.set(n, v);
}
function doEl(el: Element) {
  if (skip(el)) return;
  for (const a of ATTRS) { const v = el.getAttribute(a); if (!v) continue; const t = swap(v); if (t != null) el.setAttribute(a, t); }
  if (el instanceof HTMLInputElement && (el.type === "button" || el.type === "submit") && el.value) { const t = swap(el.value); if (t != null) el.value = t; }
}
function walk(root: Node) {
  if (root.nodeType === 3) { doText(root as Text); return; }
  if (root.nodeType !== 1) return;
  doEl(root as Element);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) doText(n as Text); else doEl(n as Element); }
}

let started = false;
/** Starts English mode (no-op in Hungarian). Call once from the admin's top component. */
export async function startAdminI18n() {
  if (started || typeof window === "undefined" || adminLang() !== "en") return;
  started = true;
  const dict = (await import("@/lib/admin-i18n/en.json")).default as Record<string, string>;
  load(dict);
  walk(document.documentElement);
  const titleFix = () => { const t = swapTitle(document.title); if (t && t !== document.title) document.title = t; };
  titleFix();
  /* the observer runs before the browser paints, so the Hungarian never shows */
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "childList") m.addedNodes.forEach((n) => n.isConnected && walk(n));
      else if (m.target.isConnected) { if (m.type === "attributes") doEl(m.target as Element); else walk(m.target); }
    }
    titleFix();
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
/* the tab title is "Page · period · InkAge": each piece on its own */
function swapTitle(s: string) { return s.split(" · ").map((p) => swap(p)?.trim() ?? p).join(" · "); }

/* short day names (single letters cannot go through the dictionary): Sunday first or Monday first */
const EN_D = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], HU_D = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
export const daysSun = () => (typeof window !== "undefined" && adminLang() === "en" ? EN_D : HU_D);
export const daysMon = () => { const d = daysSun(); return [...d.slice(1), d[0]]; };
